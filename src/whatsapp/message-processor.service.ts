import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { SupabaseService } from '../supabase/supabase.service';
dotenv.config();

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

import { ParserService } from '../parser/parser.service';
import { SheetService } from '../sheet/sheet.service';
import { FinanceQAService } from '../finance/finance-qa.service';
import { BudgetManagementService } from '../finance/budget-management.service';
import { FinancialInsightService } from '../finance/financial-insight.service';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private history: Array<{ prompt: string; response: string }> = [];

  constructor(
    private readonly parserService: ParserService,
    private readonly sheetService: SheetService,
    private readonly financeQAService: FinanceQAService,
    private readonly budgetService: BudgetManagementService,
    private readonly insightService: FinancialInsightService,
  ) {}

  async processMessage(msg: any): Promise<{ reply: string | null; log: string }> {
    const text = this.extractText(msg);
    if (!text) return { reply: null, log: '' };
    const match = text.match(/@lumine\b/i);
    if (!match) return { reply: null, log: '' };
    // Remove @lumine (case-insensitive, only 1st occurrence)
    const prompt = text.replace(/@lumine\b/i, '').trim();
    if (!prompt) return { reply: null, log: '' };

    // Ambil nama pengirim WA jika ada (misal dari msg.notify atau msg.pushName)
    const pengirim = msg.notify || msg.pushName || msg.sender?.name || 'unknown';
    const userNumber = msg.key?.remoteJid || msg.from || 'unknown';
    
    this.logger.log(`DEBUG: Pengirim detected: "${pengirim}"`);
    this.logger.log(`DEBUG: Message details - notify: "${msg.notify}", pushName: "${msg.pushName}", sender.name: "${msg.sender?.name}"`);
    this.logger.log(`DEBUG: Full message structure:`, JSON.stringify(msg, null, 2));

    // === DETEKSI REPLY OTOMATIS ===
    const replyInfo = this.extractReplyInfo(msg);
    if (replyInfo.isReply) {
      this.logger.log(`DEBUG: Reply detected! Original message: "${replyInfo.quotedText?.substring(0, 50)}..."`);
      
      try {
        // Handle sebagai reply context, bukan transaksi
        const replyResponse = await this.handleContextualReply(prompt, userNumber, replyInfo);
        if (replyResponse) {
          // Simpan sebagai reply message dengan metadata
          await SupabaseService.saveMessage(
            userNumber, 
            'user', 
            prompt,
            replyInfo.quotedMessageId,
            undefined,
            { 
              is_contextual_reply: true,
              quoted_text: replyInfo.quotedText?.substring(0, 100),
              wamid: msg.key?.id || `reply_${Date.now()}`,
              original_sender: replyInfo.originalSender
            }
          );

          await SupabaseService.saveMessage(userNumber, 'assistant', replyResponse);
          this.logger.log(`Reply Context Q: ${prompt}\nA: ${replyResponse}`);
          return { reply: replyResponse, log: `Reply Context Q: ${prompt}\nA: ${replyResponse}` };
        } else {
          // If contextual reply fails, still prevent transaction parsing
          this.logger.log(`DEBUG: Contextual reply failed, providing simple reply response`);
          const simpleReply = this.generateSimpleReplyResponse(replyInfo.quotedText, prompt);
          await SupabaseService.saveMessage(userNumber, 'user', prompt);
          await SupabaseService.saveMessage(userNumber, 'assistant', simpleReply);
          return { reply: simpleReply, log: `Simple Reply: ${prompt}\nA: ${simpleReply}` };
        }
      } catch (error) {
        this.logger.error('Error handling contextual reply:', error);
        // Still provide a contextual response even if there's an error
        const errorReply = this.generateSimpleReplyResponse(replyInfo.quotedText, prompt);
        await SupabaseService.saveMessage(userNumber, 'user', prompt);
        await SupabaseService.saveMessage(userNumber, 'assistant', errorReply);
        return { reply: errorReply, log: `Error Reply: ${prompt}\nA: ${errorReply}` };
      }
    }

    // --- Integrasi parser, Supabase & Google Sheets ---
    const parsed = await this.parserService.parseMessage(prompt, pengirim);
    if (parsed && parsed.nominal && parsed.nominal > 0) {
      let supabaseError: any = null;
      let sheetError: boolean = false;
      // Simpan ke Supabase
      try {
        await SupabaseService.saveTransaction({
          tanggal: parsed.tanggal,
          waktu: parsed.waktu,
          deskripsi: parsed.deskripsi,
          nominal: parsed.nominal,
          kategori: parsed.kategori,
          pengirim: parsed.pengirim,
          source: 'whatsapp',
        });
      } catch (e) {
        supabaseError = e;
        this.logger.error('Gagal mencatat transaksi ke Supabase', e);
      }
      // Simpan ke Google Sheets
      let sheetErrorMsg = '';
      const ok = await this.sheetService.appendTransaction(parsed);
      if (!ok) {
        sheetError = true;
        sheetErrorMsg = 'Gagal mencatat transaksi ke Google Sheets. Cek kredensial, ID sheet, dan nama sheet.';
        this.logger.error(sheetErrorMsg);
      }
      // Balasan sukses/gagal
      if (!supabaseError && !sheetError) {
        const reply = `📝 Dicatat: ${parsed.deskripsi} - Rp${parsed.nominal.toLocaleString('id-ID')}` +
          `\n📅 ${parsed.tanggalDisplay || parsed.tanggal} ⏰ ${parsed.waktu}` +
          `\n📂 Kategori: ${parsed.kategori}`;
        this.logger.log(`Transaksi dicatat ke Supabase & Google Sheets: ${JSON.stringify(parsed)}`);
        return { reply, log: JSON.stringify(parsed) };
      } else if (supabaseError && sheetError) {
        return { reply: 'Gagal mencatat transaksi ke database & Google Sheets.', log: 'Supabase & Sheet error' };
      } else if (supabaseError) {
        return { reply: 'Gagal mencatat transaksi ke database, tapi berhasil di Google Sheets.', log: 'Supabase error' };
      } else {
        return { reply: `${sheetErrorMsg} Tapi berhasil di database.`, log: 'Sheet error' };
      }
    }
    // --- Jika bukan transaksi, lanjutkan ke AI ---

    // Ambil nomor user (misal dari msg.key.remoteJid, sesuaikan dengan struktur msg Anda)
    // const userNumber = msg.key?.remoteJid || msg.from || 'unknown'; // Hapus karena sudah dideklarasi di atas
    try {
      // Simpan pesan user ke Supabase
      await SupabaseService.saveMessage(userNumber, 'user', prompt);

      // Ambil seluruh riwayat chat user (limit 30 terakhir, urut kronologis)
      const messages = await SupabaseService.getMessages(userNumber, 30);

      // Format untuk prompt ke AI ala ChatGPT API
      const chatContext = messages.map((m: any) => ({ role: m.role, content: m.content }));
      chatContext.push({ role: 'user', content: prompt });

      // === FITUR ANALISIS PENGELUARAN (BOROS/HEMAT) ===
      if (this.isSpendingAnalysisQuestion(prompt)) {
        try {
          const spendingAnalysis = await this.handleSpendingAnalysisQuestion(prompt, pengirim);
          if (spendingAnalysis) {
            await SupabaseService.saveMessage(userNumber, 'assistant', spendingAnalysis);
            this.history.push({ prompt, response: spendingAnalysis });
            this.logger.log(`Spending Analysis Q: ${prompt}\nA: ${spendingAnalysis}`);
            return { reply: spendingAnalysis, log: `Spending Analysis Q: ${prompt}\nA: ${spendingAnalysis}` };
          }
        } catch (error) {
          this.logger.error('Error processing spending analysis:', error);
          const errorReply = 'Maaf, terjadi kesalahan saat menganalisis pola pengeluaran Anda.';
          await SupabaseService.saveMessage(userNumber, 'assistant', errorReply);
          return { reply: errorReply, log: `Spending Analysis Error: ${error}` };
        }
      }

      // Deteksi pertanyaan tentang identitas/fungsi (tapi exclude pertanyaan keuangan)
      const identitasRegex = /^(siapa|siapakah|siapa kah|apakah|kenapa|apa|tolong)?\s*(kamu|anda|lumine|fungsi(mu)?|tugas(mu)?|siapakah|siapa kah|apakah|peran(mu)?|tentangmu|tentang lumine|who are you|what are you|your function|your role|describe yourself)/i;
      const isFinancialQuestion = this.containsFinancialKeywords(prompt);
      
      if (identitasRegex.test(prompt) && !isFinancialQuestion) {
        const personalReply = 'Saya Lumine, asisten pribadi Farel Rasyah, siap membantu berbagai keperluan Anda.';
        await SupabaseService.saveMessage(userNumber, 'assistant', personalReply);
        this.history.push({ prompt, response: personalReply });
        this.logger.log(`Q: ${prompt}\nA: ${personalReply}`);
        return { reply: personalReply, log: `Q: ${prompt}\nA: ${personalReply}` };
      }

      // === FITUR TANYA JAWAB KEUANGAN LANJUTAN ===
      
      // === FITUR TESTING REPLY ===
      if (this.isReplyTestCommand(prompt)) {
        try {
          const replyTestResponse = await this.handleReplyTestCommand(prompt, userNumber);
          if (replyTestResponse) {
            await SupabaseService.saveMessage(userNumber, 'assistant', replyTestResponse);
            this.history.push({ prompt, response: replyTestResponse });
            this.logger.log(`Reply Test Q: ${prompt}\nA: ${replyTestResponse}`);
            return { reply: replyTestResponse, log: `Reply Test Q: ${prompt}\nA: ${replyTestResponse}` };
          }
        } catch (error) {
          this.logger.error('Error processing reply test command:', error);
          const errorReply = 'Maaf, terjadi kesalahan saat testing fitur reply.';
          await SupabaseService.saveMessage(userNumber, 'assistant', errorReply);
          return { reply: errorReply, log: `Reply Test Error: ${error}` };
        }
      }
      
      // Check for budget-related commands first
      if (this.isBudgetCommand(prompt)) {
        try {
          const budgetResponse = await this.handleBudgetCommand(prompt, pengirim);
          if (budgetResponse) {
            await SupabaseService.saveMessage(userNumber, 'assistant', budgetResponse);
            this.history.push({ prompt, response: budgetResponse });
            this.logger.log(`Budget Q: ${prompt}\nA: ${budgetResponse}`);
            return { reply: budgetResponse, log: `Budget Q: ${prompt}\nA: ${budgetResponse}` };
          }
        } catch (error) {
          this.logger.error('Error processing budget command:', error);
        }
      }

      // Check for insight commands
      if (this.isInsightCommand(prompt)) {
        try {
          const insightResponse = await this.handleInsightCommand(prompt, pengirim);
          if (insightResponse) {
            await SupabaseService.saveMessage(userNumber, 'assistant', insightResponse);
            this.history.push({ prompt, response: insightResponse });
            this.logger.log(`Insight Q: ${prompt}\nA: ${insightResponse}`);
            return { reply: insightResponse, log: `Insight Q: ${prompt}\nA: ${insightResponse}` };
          }
        } catch (error) {
          this.logger.error('Error processing insight command:', error);
        }
      }

      // Enhanced finance questions
      if (this.financeQAService.isFinanceQuestion(prompt)) {
        try {
          const financeResponse = await this.financeQAService.processFinanceQuestion(prompt, pengirim);
          if (financeResponse) {
            await SupabaseService.saveMessage(userNumber, 'assistant', financeResponse);
            this.history.push({ prompt, response: financeResponse });
            this.logger.log(`Finance Q: ${prompt}\nA: ${financeResponse}`);
            return { reply: financeResponse, log: `Finance Q: ${prompt}\nA: ${financeResponse}` };
          }
        } catch (error) {
          this.logger.error('Error processing finance question:', error);
          const errorReply = 'Maaf, terjadi kesalahan saat menganalisis data keuangan Anda.';
          await SupabaseService.saveMessage(userNumber, 'assistant', errorReply);
          return { reply: errorReply, log: `Finance Error: ${error}` };
        }
      }

      // Kirim konteks chat ke AI
      const aiResponse = await this.queryAIWithContext(chatContext);
      // Bersihkan simbol markdown
      const cleanResponse = this.stripMarkdown(aiResponse);
      await SupabaseService.saveMessage(userNumber, 'assistant', cleanResponse);
      this.history.push({ prompt, response: cleanResponse });
      this.logger.log(`Q: ${prompt}\nA: ${cleanResponse}`);
      return { reply: cleanResponse, log: `Q: ${prompt}\nA: ${cleanResponse}` };
    } catch (e: any) {
      if (e.response && e.response.status === 400) {
        this.logger.error(`AI error (400): ${JSON.stringify(e.response.data)}`);
      } else {
        this.logger.error('AI error detail:', JSON.stringify(e, null, 2));
      }
      throw e;
    }
  }

  extractText(msg: any): string | null {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return null;
  }

  // Fungsi baru: queryAIWithContext menerima array messages ala ChatGPT API
  async queryAIWithContext(messages: { role: string; content: string }[]): Promise<string> {
    // Adaptasi ke format Gemini jika perlu (misal, gabungkan menjadi satu string, atau gunakan sesuai API baru jika tersedia)
    // Untuk Gemini, kita gabungkan semua pesan sebelumnya sebagai konteks
    const contextText = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const res = await axios.post(
      `${AI_API_URL}?key=${AI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: contextText }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }
    );
    // Gemini response: res.data.candidates[0].content.parts[0].text
    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return answer || 'Maaf, tidak ada jawaban.';
  }

  // Fungsi lama tetap ada untuk kompatibilitas jika diperlukan
  async queryAI(prompt: string): Promise<string> {
    const res = await axios.post(
      `${AI_API_URL}?key=${AI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }
    );
    // Gemini response: res.data.candidates[0].content.parts[0].text
    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return answer || 'Maaf, tidak ada jawaban.';
  }

  getHistory() {
    return this.history;
  }

  /**
   * Menghapus simbol markdown dari teks.
   */
  stripMarkdown(text: string): string {
    if (!text) return '';
    // Hapus seluruh simbol markdown dan karakter dekoratif
    return text
      // Hapus seluruh *, **, _, __, ~~, `, >, | secara global
      .replace(/\*\*|\*|__|_|~~|`|>|\|/g, '')
      // Hilangkan link markdown [teks](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Hilangkan gambar markdown ![alt](img)
      .replace(/\!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      // Hilangkan heading markdown
      .replace(/#+\s/g, '')
      // Hilangkan escape backslash
      .replace(/\\/g, '')
      // Normalisasi newline
      .replace(/\r?\n/g, '\n')
      .trim();
  }

  // === ADVANCED FINANCE COMMAND HANDLERS ===

  /**
   * Check if the message is a budget-related command
   */
  private isBudgetCommand(prompt: string): boolean {
    const budgetKeywords = [
      'budget', 'anggaran', 'batas', 'limit',
      'set batas', 'buat budget', 'atur anggaran',
      'status budget', 'cek budget', 'budget saya',
      'saran budget', 'rekomendasi budget'
    ];

    const normalizedPrompt = prompt.toLowerCase();
    return budgetKeywords.some(keyword => normalizedPrompt.includes(keyword));
  }

  /**
   * Handle budget-related commands
   */
  private async handleBudgetCommand(prompt: string, pengirim: string): Promise<string | null> {
    const normalizedPrompt = prompt.toLowerCase();

    // Status budget
    if (normalizedPrompt.includes('status') || normalizedPrompt.includes('cek') || normalizedPrompt.includes('budget saya')) {
      const budgets = await this.budgetService.getBudgets(pengirim);
      if (budgets.length === 0) {
        return `💼 Status Budget:\n\nAnda belum menetapkan budget. Gunakan perintah seperti:\n• "set batas bulanan 2 juta"\n• "budget makanan 500 ribu per bulan"\n\nUntuk mulai mengatur keuangan Anda!`;
      }

      const alerts = await this.budgetService.checkBudgets(pengirim);
      if (alerts.length > 0) {
        let response = `💼 Status Budget:\n\n`;
        alerts.forEach(alert => {
          const emoji = alert.alertLevel === 'exceeded' ? '🚨' : alert.alertLevel === 'danger' ? '⚠️' : '✅';
          response += `${emoji} ${alert.message}\n`;
        });
        return response;
      } else {
        return `✅ Status Budget:\n\nSemua budget Anda masih dalam batas aman! Lanjutkan kebiasaan baik ini.`;
      }
    }

    // Saran budget
    if (normalizedPrompt.includes('saran') || normalizedPrompt.includes('rekomendasi')) {
      return await this.budgetService.suggestBudgets(pengirim);
    }

    // Laporan budget
    if (normalizedPrompt.includes('laporan') || normalizedPrompt.includes('report')) {
      const reportType = normalizedPrompt.includes('minggu') ? 'weekly' : 'monthly';
      return await this.budgetService.generateBudgetReport(pengirim, reportType);
    }

    return null;
  }

  /**
   * Check if the message is an insight-related command
   */
  private isInsightCommand(prompt: string): boolean {
    const insightKeywords = [
      'analisis', 'insight', 'pola', 'tren', 'trend',
      'laporan keuangan', 'financial report', 'summary',
      'rekomendasi hemat', 'tips hemat', 'cara hemat',
      'prediksi', 'perkiraan', 'proyeksi',
      'ringkasan', 'kesimpulan', 'evaluasi keuangan',
      'analisis keuangan', 'finance insight'
    ];

    const normalizedPrompt = prompt.toLowerCase();
    return insightKeywords.some(keyword => normalizedPrompt.includes(keyword));
  }

  /**
   * Handle insight-related commands
   */
  private async handleInsightCommand(prompt: string, pengirim: string): Promise<string | null> {
    const normalizedPrompt = prompt.toLowerCase();

    // Generate comprehensive insights
    if (normalizedPrompt.includes('analisis') || normalizedPrompt.includes('insight')) {
      const timeframe = normalizedPrompt.includes('minggu') ? 'week' : 
                      normalizedPrompt.includes('kuartal') ? 'quarter' : 'month';
      
      const insights = await this.insightService.generateInsights(pengirim, timeframe);
      
      if (insights.length === 0) {
        return `🧠 Analisis Keuangan:\n\nBelum ada cukup data untuk menganalisis pola pengeluaran Anda. Catat beberapa transaksi terlebih dahulu untuk mendapatkan insight yang lebih akurat.`;
      }

      let response = `🧠 Analisis Keuangan ${timeframe === 'week' ? 'Mingguan' : 'Bulanan'}:\n\n`;
      
      insights.slice(0, 5).forEach((insight, index) => {
        const emoji = this.getInsightEmoji(insight.type);
        response += `${emoji} ${insight.title}\n${insight.message}\n\n`;
      });

      response += `💡 Ketik "rekomendasi hemat" untuk tips penghematan personal!`;
      return response;
    }

    // Generate automated report
    if (normalizedPrompt.includes('laporan') || normalizedPrompt.includes('report') || normalizedPrompt.includes('ringkasan')) {
      const reportType = normalizedPrompt.includes('minggu') ? 'weekly' : 'monthly';
      const report = await this.insightService.generateAutomatedReport(pengirim, reportType);
      return this.insightService.formatAutomatedReport(report);
    }

    // Detect unusual spending
    if (normalizedPrompt.includes('unusual') || normalizedPrompt.includes('tidak biasa') || normalizedPrompt.includes('aneh')) {
      const notifications = await this.insightService.detectUnusualSpending(pengirim);
      
      if (notifications.length === 0) {
        return `✅ Deteksi Pengeluaran:\n\nTidak ada pola pengeluaran yang tidak biasa terdeteksi. Pengeluaran Anda terlihat konsisten!`;
      }

      let response = `⚠️ Deteksi Pengeluaran Tidak Biasa:\n\n`;
      notifications.forEach(notif => {
        response += `• ${notif.message}\n`;
      });

      return response;
    }

    // Personalized tips
    if (normalizedPrompt.includes('tips') || normalizedPrompt.includes('saran') || normalizedPrompt.includes('rekomendasi')) {
      const tips = await this.insightService.generatePersonalizedTips(pengirim);
      
      if (tips.length === 0) {
        return `💡 Tips Keuangan:\n\nBelum ada tips spesifik yang bisa diberikan. Lakukan lebih banyak transaksi untuk mendapatkan rekomendasi yang lebih personal!`;
      }

      let response = `💡 Tips Keuangan Personal:\n\n`;
      tips.forEach(tip => {
        response += `• ${tip.message}\n\n`;
      });

      return response;
    }

    return null;
  }

  /**
   * Get emoji for insight types
   */
  private getInsightEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      'achievement': '🎉',
      'warning': '⚠️',
      'tip': '💡',
      'milestone': '🏆',
      'trend': '📈'
    };

    return emojiMap[type] || '💡';
  }

  /**
   * Check if the prompt is a reply test command
   */
  private isReplyTestCommand(prompt: string): boolean {
    const replyTestKeywords = [
      'test reply', 'testing reply', 'tes reply', 'reply test',
      'reply ke pesan', 'balas pesan', 'reply pesan lama',
      'lihat pesan lama', 'pesan terbaru', 'cari pesan',
      'thread test', 'conversation test'
    ];

    const normalizedPrompt = prompt.toLowerCase();
    return replyTestKeywords.some(keyword => normalizedPrompt.includes(keyword));
  }

  /**
   * Handle reply test commands
   */
  private async handleReplyTestCommand(prompt: string, userNumber: string): Promise<string | null> {
    const normalizedPrompt = prompt.toLowerCase();

    // Test 1: Lihat pesan terbaru dengan ID
    if (normalizedPrompt.includes('pesan terbaru') || normalizedPrompt.includes('lihat pesan')) {
      const recentMessages = await SupabaseService.getRecentMessagesWithIds(userNumber, 10);
      
      if (recentMessages.length === 0) {
        return `📋 Pesan Terbaru:\n\nBelum ada pesan tersimpan untuk testing reply.`;
      }

      let response = `📋 10 Pesan Terbaru (untuk testing reply):\n\n`;
      
      recentMessages.forEach((msg, index) => {
        const shortContent = msg.content.length > 50 ? 
          msg.content.substring(0, 50) + '...' : msg.content;
        const timeAgo = this.getTimeAgo(msg.created_at);
        const roleEmoji = msg.role === 'user' ? '👤' : '🤖';
        
        response += `${index}. ${roleEmoji} ${shortContent}\n`;
        response += `   📝 ID: ${msg.id.substring(0, 8)}... | ⏰ ${timeAgo}\n\n`;
      });

      response += `💡 Cara testing:\n`;
      response += `• "reply ke pesan 2 [pesan Anda]" - Reply ke pesan index 2\n`;
      response += `• "cari pesan budget" - Cari pesan berisi kata budget\n`;
      response += `• "test thread baru" - Buat conversation baru`;

      return response;
    }

    // Test 2: Reply berdasarkan index
    if (normalizedPrompt.includes('reply ke pesan')) {
      const indexMatch = normalizedPrompt.match(/reply ke pesan (\d+)\s+(.+)/);
      if (indexMatch) {
        const messageIndex = parseInt(indexMatch[1]);
        const replyContent = indexMatch[2];

        try {
          await SupabaseService.replyToMessageByIndex(
            userNumber,
            messageIndex,
            replyContent,
            'user',
            { test_reply: true, wamid: `test_${Date.now()}` }
          );

          // Get the replied message for confirmation
          const recentMessages = await SupabaseService.getRecentMessagesWithIds(userNumber, messageIndex + 1);
          const repliedMsg = recentMessages[messageIndex];
          
          return `✅ Reply Berhasil!\n\n` +
                 `📤 Reply Anda: "${replyContent}"\n` +
                 `📥 Ke pesan: "${repliedMsg.content.substring(0, 50)}..."\n\n` +
                 `🔗 Reply tersimpan dengan relasi ke pesan asli!`;

        } catch (error) {
          return `❌ Reply Gagal:\n\n${error.message}`;
        }
      }
    }

    // Test 3: Cari dan reply pesan berdasarkan keyword
    if (normalizedPrompt.includes('cari pesan')) {
      const searchMatch = normalizedPrompt.match(/cari pesan (.+)/);
      if (searchMatch) {
        const keyword = searchMatch[1];

        try {
          const foundMessages = await SupabaseService.findOldMessageByContent(userNumber, keyword, 7);
          
          if (foundMessages.length === 0) {
            return `🔍 Hasil Pencarian:\n\nTidak ada pesan yang mengandung "${keyword}" dalam 7 hari terakhir.`;
          }

          let response = `🔍 **Hasil Pencarian untuk "${keyword}":**\n\n`;
          
          foundMessages.forEach((msg, index) => {
            const shortContent = msg.content.length > 60 ? 
              msg.content.substring(0, 60) + '...' : msg.content;
            const timeAgo = this.getTimeAgo(msg.created_at);
            const roleEmoji = msg.role === 'user' ? '👤' : '🤖';
            
            response += `${index + 1}. ${roleEmoji} ${shortContent}\n`;
            response += `   📝 ID: ${msg.id.substring(0, 8)}... | ⏰ ${timeAgo}\n\n`;
          });

          response += `💡 **Untuk reply:** Ketik "reply search ${keyword} [pesan reply Anda]"`;
          
          return response;

        } catch (error) {
          return `❌ **Pencarian Gagal:**\n\n${error.message}`;
        }
      }
    }

    // Test 4: Reply hasil pencarian
    if (normalizedPrompt.includes('reply search')) {
      const replySearchMatch = normalizedPrompt.match(/reply search (.+?) (.+)/);
      if (replySearchMatch) {
        const keyword = replySearchMatch[1];
        const replyContent = replySearchMatch[2];

        try {
          await SupabaseService.searchAndReplyToMessage(
            userNumber,
            keyword,
            replyContent,
            'user',
            { test_search_reply: true, search_keyword: keyword }
          );

          return `✅ **Search Reply Berhasil!**\n\n` +
                 `🔍 Keyword: "${keyword}"\n` +
                 `📤 Reply: "${replyContent}"\n\n` +
                 `🔗 Reply tersimpan dengan relasi ke pesan yang ditemukan!`;

        } catch (error) {
          return `❌ **Search Reply Gagal:**\n\n${error.message}`;
        }
      }
    }

    // Test 5: Buat thread baru
    if (normalizedPrompt.includes('test thread') || normalizedPrompt.includes('thread baru')) {
      try {
        const conversationId = await SupabaseService.createConversationThread(
          userNumber,
          'Thread testing untuk fitur conversation',
          { topic: 'testing', created_via: 'whatsapp_command' }
        );

        return `🧵 **Thread Baru Dibuat!**\n\n` +
               `📝 Conversation ID: ${conversationId.substring(0, 8)}...\n` +
               `💬 Pesan awal: "Thread testing untuk fitur conversation"\n\n` +
               `💡 **Testing lanjutan:**\n` +
               `• Semua pesan selanjutnya bisa dikaitkan ke thread ini\n` +
               `• Ketik "lihat thread" untuk melihat semua thread Anda`;

      } catch (error) {
        return `❌ **Thread Gagal Dibuat:**\n\n${error.message}`;
      }
    }

    // Test 6: Lihat semua thread
    if (normalizedPrompt.includes('lihat thread') || normalizedPrompt.includes('thread saya')) {
      try {
        const threads = await SupabaseService.getThreadSummary(userNumber);
        const threadIds = Object.keys(threads);

        if (threadIds.length === 0) {
          return `🧵 **Thread Conversations:**\n\nBelum ada thread conversation. Ketik "test thread baru" untuk membuat thread pertama!`;
        }

        let response = `🧵 **Thread Conversations (${threadIds.length}):**\n\n`;

        threadIds.slice(0, 5).forEach((threadId, index) => {
          const messages = threads[threadId];
          const messageCount = messages.length;
          const latestMessage = messages[0]; // sudah diurutkan desc
          const shortId = threadId.substring(0, 8);
          const timeAgo = this.getTimeAgo(latestMessage.created_at);

          response += `${index + 1}. 🧵 Thread ${shortId}...\n`;
          response += `   💬 ${messageCount} pesan | ⏰ ${timeAgo}\n`;
          response += `   📝 "${latestMessage.content.substring(0, 40)}..."\n\n`;
        });

        return response;

      } catch (error) {
        return `❌ **Thread Load Gagal:**\n\n${error.message}`;
      }
    }

    // Default help
    return `🧪 **Testing Reply Features:**\n\n` +
           `📋 **Perintah yang tersedia:**\n` +
           `• "lihat pesan terbaru" - Lihat 10 pesan terbaru\n` +
           `• "reply ke pesan [index] [pesan]" - Reply ke pesan\n` +
           `• "cari pesan [keyword]" - Cari pesan lama\n` +
           `• "reply search [keyword] [pesan]" - Reply hasil cari\n` +
           `• "test thread baru" - Buat conversation thread\n` +
           `• "lihat thread" - Lihat semua thread\n\n` +
           `💡 **Contoh:**\n` +
           `"reply ke pesan 2 Terima kasih!" - Reply ke pesan index 2\n` +
           `"cari pesan budget" - Cari pesan berisi "budget"`;
  }

  /**
   * Helper function to calculate time ago
   */
  private getTimeAgo(timestamp: string): string {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return `${Math.floor(diffDays / 7)} minggu lalu`;
  }

  /**
   * Extract reply information from WhatsApp message structure
   */
  private extractReplyInfo(msg: any): {
    isReply: boolean;
    quotedMessageId?: string;
    quotedText?: string;
    originalSender?: string;
  } {
    // Debug: Log full message structure to understand reply format
    this.logger.log('DEBUG extractReplyInfo - Full msg structure:', JSON.stringify(msg, null, 2));

    // Check different possible reply structures in WhatsApp messages
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                         msg.message?.conversation?.contextInfo?.quotedMessage ||
                         msg.contextInfo?.quotedMessage ||
                         msg.quoted;

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                       msg.message?.conversation?.contextInfo ||
                       msg.contextInfo;

    if (quotedMessage || contextInfo?.participant || contextInfo?.stanzaId) {
      this.logger.log('DEBUG: Reply detected with contextInfo:', JSON.stringify(contextInfo, null, 2));
      
      return {
        isReply: true,
        quotedMessageId: contextInfo?.stanzaId || contextInfo?.id,
        quotedText: this.extractQuotedText(quotedMessage),
        originalSender: contextInfo?.participant || contextInfo?.remoteJid
      };
    }

    // Check if message has reply indicators in text
    const text = this.extractText(msg);
    if (text && this.hasReplyIndicators(text)) {
      return {
        isReply: true,
        quotedText: 'Reply detected by text pattern'
      };
    }

    return { isReply: false };
  }

  /**
   * Extract text from quoted message
   */
  private extractQuotedText(quotedMessage: any): string | undefined {
    if (!quotedMessage) return undefined;

    return quotedMessage.conversation ||
           quotedMessage.extendedTextMessage?.text ||
           quotedMessage.text ||
           'Quoted message';
  }

  /**
   * Check if text has reply indicators
   */
  private hasReplyIndicators(text: string): boolean {
    const replyPatterns = [
      /^(re:|reply:|balasan:|jawaban:)/i,
      /membalas|menanggapi|menjawab/i,
      /tentang (pesan|chat|pertanyaan) (sebelum|tadi|kemarin)/i
    ];

    return replyPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Handle contextual reply based on quoted message
   */
  private async handleContextualReply(prompt: string, userNumber: string, replyInfo: any): Promise<string | null> {
    try {
      // If we have quoted text, use it as context
      if (replyInfo.quotedText) {
        this.logger.log(`DEBUG: Handling contextual reply to: "${replyInfo.quotedText}"`);
        
        // Create contextual response first (don't worry about database relationship if it fails)
        const contextPrompt = `User is replying to this message: "${replyInfo.quotedText}"\nUser's reply: "${prompt}"\n\nPlease provide a contextual response that acknowledges the original message and responds appropriately to the reply.`;
        
        // Get AI response with context
        const contextualResponse = await this.queryAIWithContext([
          { role: 'assistant', content: replyInfo.quotedText },
          { role: 'user', content: prompt }
        ]);

        const cleanResponse = this.stripMarkdown(contextualResponse);
        
        // Try to save to database, but don't fail if there's an issue
        try {
          // Try to find the original message in our database
          let originalMessage: { id: string; created_at: string } | null = null;
          if (replyInfo.quotedText !== 'Quoted message' && replyInfo.quotedText !== 'Reply detected by text pattern') {
            const foundMessages = await SupabaseService.findOldMessageByContent(
              userNumber, 
              replyInfo.quotedText.substring(0, 20), // First 20 chars
              7 // Search in last 7 days
            );
            originalMessage = foundMessages.length > 0 ? foundMessages[0] as { id: string; created_at: string } : null;
          }

          // Save the reply relationship if we found the original message
          if (originalMessage) {
            this.logger.log(`DEBUG: Found original message in database, creating reply relationship`);
            await SupabaseService.saveReplyMessage(
              userNumber,
              'user',
              prompt,
              originalMessage.id, // Use database UUID, not WhatsApp stanzaId
              undefined,
              {
                contextual_reply: true,
                reply_delay_minutes: this.calculateMinutesSince(originalMessage.created_at),
                whatsapp_stanza_id: replyInfo.quotedMessageId // Store WhatsApp ID separately
              }
            );
          } else {
            // Save as regular message with reply metadata if can't find original
            await SupabaseService.saveMessage(
              userNumber, 
              'user', 
              prompt,
              undefined, // No reply_to_id since we can't find the original
              undefined,
              { 
                is_contextual_reply: true,
                quoted_text: replyInfo.quotedText?.substring(0, 100),
                whatsapp_stanza_id: replyInfo.quotedMessageId,
                original_sender: replyInfo.originalSender,
                reply_attempt_failed: 'original_message_not_found'
              }
            );
            this.logger.log(`DEBUG: Could not find original message in database, saved as contextual message`);
          }
        } catch (dbError) {
          this.logger.error('Error saving reply to database (continuing with response):', dbError);
          // Continue with response even if database fails
        }

        return `💬 **Re:** ${replyInfo.quotedText.substring(0, 30)}...\n\n${cleanResponse}`;
      }

      // Fallback for reply patterns in text
      if (this.hasReplyIndicators(prompt)) {
        const response = await this.queryAIWithContext([
          { role: 'user', content: `This is a reply/follow-up message: ${prompt}. Please respond contextually.` }
        ]);
        return this.stripMarkdown(response);
      }

      return null;
    } catch (error) {
      this.logger.error('Error in handleContextualReply:', error);
      
      // Even if there's an error, try to give a contextual response
      if (replyInfo.quotedText) {
        return `💬 Saya melihat Anda merespons tentang tips keuangan. ${replyInfo.quotedText.includes('Tips') ? 'Senang mendengar Anda akan mencoba tips tersebut!' : 'Terima kasih atas responnya!'} Ada yang ingin ditanyakan lebih lanjut?`;
      }
      
      return `Maaf, saya mendeteksi ini adalah balasan pesan, tapi terjadi kesalahan saat memproses konteksnya. Bisa dijelaskan lagi?`;
    }
  }

  /**
   * Calculate minutes since timestamp
   */
  private calculateMinutesSince(timestamp: string): number {
    const messageTime = new Date(timestamp);
    const now = new Date();
    return Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
  }

  /**
   * Generate simple contextual reply when full AI processing fails
   */
  private generateSimpleReplyResponse(quotedText: string | undefined, userReply: string): string {
    if (!quotedText) {
      return `Terima kasih atas responnya! Ada yang bisa saya bantu lagi?`;
    }

    // Simple context-based responses
    if (quotedText.includes('Tips') || quotedText.includes('tips')) {
      if (userReply.toLowerCase().includes('terima kasih') || userReply.toLowerCase().includes('thanks')) {
        return `💡 Sama-sama! Senang bisa membantu dengan tips keuangannya. Semoga berhasil diterapkan! Ada yang ingin ditanyakan lagi?`;
      }
      if (userReply.toLowerCase().includes('coba') || userReply.toLowerCase().includes('akan')) {
        return `💡 Bagus! Semoga tips keuangan tersebut membantu menghemat pengeluaran Anda. Jangan ragu untuk bertanya jika butuh tips lainnya!`;
      }
      return `💡 Mengenai tips keuangan tersebut, ada yang ingin ditanyakan lebih detail?`;
    }

    if (quotedText.includes('budget') || quotedText.includes('Budget')) {
      return `💰 Tentang budget tersebut, apakah ada yang ingin dibahas lebih lanjut? Saya bisa membantu analisis atau memberikan saran.`;
    }

    if (quotedText.includes('pengeluaran') || quotedText.includes('Pengeluaran')) {
      return `📊 Mengenai analisis pengeluaran tersebut, ada kategori tertentu yang ingin dibahas lebih detail?`;
    }

    if (quotedText.includes('transaksi') || quotedText.includes('Transaksi')) {
      return `📝 Tentang pencatatan transaksi tersebut, apakah sudah sesuai atau perlu penyesuaian?`;
    }

    // Generic contextual response
    return `💬 Mengenai hal tersebut, ada yang bisa saya bantu lebih lanjut? Saya siap membantu dengan pertanyaan keuangan Anda.`;
  }

  /**
   * Check if the prompt is a spending analysis question
   */
  private isSpendingAnalysisQuestion(prompt: string): boolean {
    const spendingKeywords = [
      // Boros patterns
      'boros', 'pemborosan', 'terlalu banyak', 'kebanyakan', 
      'over budget', 'melebihi budget', 'budget terlampaui',
      
      // Hemat patterns  
      'hemat', 'irit', 'berhemat', 'mengirit', 'penghematan',
      'under budget', 'di bawah budget', 'budget aman',
      
      // Analysis patterns
      'pola pengeluaran', 'analisis pengeluaran', 'spending pattern',
      'keuangan ku', 'keuangan saya', 'finansial ku', 'finansial saya',
      
      // Time-based spending questions
      'pengeluaran hari ini', 'pengeluaran minggu ini', 'pengeluaran bulan ini',
      'pengeluaran tahun ini', 'spending today', 'spending this week',
      'spending this month', 'spending this year'
    ];

    const timeframes = [
      'hari ini', 'minggu ini', 'bulan ini', 'tahun ini',
      'today', 'this week', 'this month', 'this year',
      'harian', 'mingguan', 'bulanan', 'tahunan'
    ];

    const normalizedPrompt = prompt.toLowerCase();
    
    // Check for direct spending keywords
    const hasSpendingKeyword = spendingKeywords.some(keyword => 
      normalizedPrompt.includes(keyword)
    );

    // Check for spending questions with personal pronouns
    const personalSpendingPattern = /\b(aku|saya|ku|gue|gua|i|my)\s+(boros|hemat|pengeluaran|spending|budget)\b/i;
    const spendingWithTime = timeframes.some(time => normalizedPrompt.includes(time)) && 
                           (normalizedPrompt.includes('boros') || 
                            normalizedPrompt.includes('hemat') || 
                            normalizedPrompt.includes('pengeluaran'));

    return hasSpendingKeyword || personalSpendingPattern.test(prompt) || spendingWithTime;
  }

  /**
   * Handle spending analysis questions
   */
  private async handleSpendingAnalysisQuestion(prompt: string, pengirim: string): Promise<string | null> {
    try {
      const normalizedPrompt = prompt.toLowerCase();
      
      // Determine timeframe
      let timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'; // default
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      if (normalizedPrompt.includes('hari ini') || normalizedPrompt.includes('today') || normalizedPrompt.includes('harian')) {
        timeframe = 'daily';
        startDate = today;
        endDate = today;
      } else if (normalizedPrompt.includes('minggu ini') || normalizedPrompt.includes('this week') || normalizedPrompt.includes('mingguan')) {
        timeframe = 'weekly';
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1); // Get Monday
        startDate = monday.toISOString().split('T')[0];
        endDate = today;
      } else if (normalizedPrompt.includes('tahun ini') || normalizedPrompt.includes('this year') || normalizedPrompt.includes('tahunan')) {
        timeframe = 'yearly';
        startDate = `${now.getFullYear()}-01-01`;
        endDate = today;
      } else {
        // Default to current month
        timeframe = 'monthly';
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = today;
      }

      this.logger.log(`DEBUG: Spending analysis - timeframe: ${timeframe}, startDate: ${startDate}, endDate: ${endDate}`);

      // Get spending data
      const totalSpending = await SupabaseService.getTotalTransactions(pengirim, startDate, endDate);
      const transactionHistory = await SupabaseService.getTransactionHistory(pengirim, startDate, endDate, 10);
      const categoryBreakdown = await SupabaseService.getTransactionSummaryByCategory(pengirim, startDate, endDate);

      this.logger.log(`DEBUG: Total spending: ${totalSpending}, transactions: ${transactionHistory.length}`);

      if (totalSpending === 0) {
        return this.generateNoSpendingResponse(timeframe);
      }

      // Calculate spending analysis
      const analysis = await this.calculateSpendingAnalysis(
        totalSpending, 
        transactionHistory, 
        categoryBreakdown, 
        timeframe,
        pengirim
      );

      return analysis;

    } catch (error) {
      this.logger.error('Error in spending analysis:', error);
      return 'Maaf, terjadi kesalahan saat menganalisis pola pengeluaran Anda. Silakan coba lagi.';
    }
  }

  /**
   * Calculate comprehensive spending analysis
   */
  private async calculateSpendingAnalysis(
    totalSpending: number,
    transactions: any[],
    categoryBreakdown: Record<string, number>,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly',
    pengirim: string
  ): Promise<string> {
    
    // Define spending thresholds (adjust based on your needs)
    const thresholds = {
      daily: { high: 100000, medium: 50000, low: 25000 },
      weekly: { high: 500000, medium: 250000, low: 100000 },
      monthly: { high: 2000000, medium: 1000000, low: 500000 },
      yearly: { high: 20000000, medium: 10000000, low: 5000000 }
    };

    const threshold = thresholds[timeframe];
    let spendingLevel: 'high' | 'medium' | 'low';
    
    if (totalSpending > threshold.high) {
      spendingLevel = 'high';
    } else if (totalSpending > threshold.medium) {
      spendingLevel = 'medium';
    } else {
      spendingLevel = 'low';
    }

    // Get historical comparison for context
    const historicalAverage = await this.getHistoricalAverage(pengirim, timeframe);
    const isAboveAverage = totalSpending > historicalAverage;
    const percentageDiff = historicalAverage > 0 ? 
      Math.round(((totalSpending - historicalAverage) / historicalAverage) * 100) : 0;

    // Generate response based on analysis
    let response = `📊 Analisis Pengeluaran ${this.getTimeframeName(timeframe)}\n\n`;
    
    // Main spending assessment
    response += `💰 Total: Rp ${totalSpending.toLocaleString('id-ID')}\n`;
    response += `📈 Status: ${this.getSpendingStatusText(spendingLevel, isAboveAverage, percentageDiff)}\n\n`;

    // Category breakdown
    if (Object.keys(categoryBreakdown).length > 0) {
      response += `📂 Breakdown Kategori:\n`;
      const sortedCategories = Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedCategories.forEach(([category, amount]) => {
        const percentage = Math.round((amount / totalSpending) * 100);
        response += `• ${category}: Rp ${amount.toLocaleString('id-ID')} (${percentage}%)\n`;
      });
      response += '\n';
    }

    // Insights and recommendations
    response += this.generateSpendingInsights(spendingLevel, isAboveAverage, categoryBreakdown, timeframe);
    
    return response;
  }

  /**
   * Get historical average for comparison
   */
  private async getHistoricalAverage(pengirim: string, timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<number> {
    try {
      const now = new Date();
      let historicalStartDate: string;
      let periods = 3; // Compare with last 3 periods

      switch (timeframe) {
        case 'daily':
          // Compare with last 7 days average
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          historicalStartDate = weekAgo.toISOString().split('T')[0];
          periods = 7;
          break;
        case 'weekly':
          // Compare with last 4 weeks
          const monthAgo = new Date(now);
          monthAgo.setDate(now.getDate() - 28);
          historicalStartDate = monthAgo.toISOString().split('T')[0];
          periods = 4;
          break;
        case 'monthly':
          // Compare with last 3 months
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          historicalStartDate = threeMonthsAgo.toISOString().split('T')[0];
          periods = 3;
          break;
        case 'yearly':
          // Compare with last 2 years
          const twoYearsAgo = new Date(now);
          twoYearsAgo.setFullYear(now.getFullYear() - 2);
          historicalStartDate = twoYearsAgo.toISOString().split('T')[0];
          periods = 2;
          break;
      }

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const endDate = yesterday.toISOString().split('T')[0];

      const historicalTotal = await SupabaseService.getTotalTransactions(pengirim, historicalStartDate, endDate);
      return Math.round(historicalTotal / periods);

    } catch (error) {
      this.logger.error('Error getting historical average:', error);
      return 0;
    }
  }

  /**
   * Generate spending insights and recommendations
   */
  private generateSpendingInsights(
    spendingLevel: 'high' | 'medium' | 'low',
    isAboveAverage: boolean,
    categoryBreakdown: Record<string, number>,
    timeframe: string
  ): string {
    let insights = `💡 Insights & Rekomendasi:\n\n`;

    // Main assessment
    if (spendingLevel === 'high') {
      insights += `⚠️ Pengeluaran Tinggi: Anda termasuk dalam kategori pengeluaran tinggi untuk periode ini.\n\n`;
      
      if (isAboveAverage) {
        insights += `📈 Pengeluaran Anda lebih tinggi dari rata-rata periode sebelumnya. Pertimbangkan untuk:\n`;
        insights += `• Review pengeluaran tidak penting\n`;
        insights += `• Buat budget ketat untuk periode selanjutnya\n`;
        insights += `• Fokus pada kategori pengeluaran terbesar\n\n`;
      }
    } else if (spendingLevel === 'medium') {
      insights += `⚖️ Pengeluaran Sedang: Pola pengeluaran Anda cukup wajar.\n\n`;
      
      if (isAboveAverage) {
        insights += `📊 Ada sedikit peningkatan dari biasanya. Tetap waspada dan pantau terus.\n\n`;
      } else {
        insights += `✅ Pengeluaran Anda terkendali dengan baik.\n\n`;
      }
    } else {
      insights += `✅ Pengeluaran Rendah: Selamat! Anda berhasil mengontrol pengeluaran dengan baik.\n\n`;
      insights += `💡 Pertimbangkan untuk menabung atau investasi dari sisa budget Anda.\n\n`;
    }

    // Category-specific insights
    const topCategory = Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      const [category, amount] = topCategory;
      const totalSpending = Object.values(categoryBreakdown).reduce((sum, val) => sum + val, 0);
      const percentage = Math.round((amount / totalSpending) * 100);
      
      if (percentage > 40) {
        insights += `🎯 Fokus Kategori: ${percentage}% pengeluaran Anda pada "${category}". `;
        insights += this.getCategorySpecificAdvice(category) + '\n\n';
      }
    }

    // General tips
    insights += `📝 Tips:\n`;
    insights += `• Catat semua pengeluaran untuk tracking yang lebih baik\n`;
    insights += `• Set budget ${timeframe} dan pantau progress\n`;
    insights += `• Review pengeluaran mingguan untuk evaluasi cepat`;

    return insights;
  }

  /**
   * Get category-specific spending advice
   */
  private getCategorySpecificAdvice(category: string): string {
    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes('makan') || categoryLower.includes('food')) {
      return `Pertimbangkan meal prep atau masak di rumah untuk menghemat.`;
    } else if (categoryLower.includes('transport') || categoryLower.includes('bensin')) {
      return `Coba gunakan transportasi publik atau carpooling.`;
    } else if (categoryLower.includes('hiburan') || categoryLower.includes('entertainment')) {
      return `Cari alternatif hiburan yang lebih ekonomis atau gratis.`;
    } else if (categoryLower.includes('belanja') || categoryLower.includes('shopping')) {
      return `Buat daftar belanja dan stick to budget yang sudah ditentukan.`;
    } else if (categoryLower.includes('kesehatan') || categoryLower.includes('health')) {
      return `Investasi kesehatan memang penting, tapi bisa dicari yang lebih cost-effective.`;
    }
    
    return `Evaluasi apakah semua pengeluaran di kategori ini memang diperlukan.`;
  }

  /**
   * Helper functions
   */
  private getTimeframeName(timeframe: string): string {
    const names = {
      'daily': 'Harian',
      'weekly': 'Mingguan', 
      'monthly': 'Bulanan',
      'yearly': 'Tahunan'
    };
    return names[timeframe] || 'Periode Ini';
  }

  private getSpendingStatusText(spendingLevel: 'high' | 'medium' | 'low', isAboveAverage: boolean, percentageDiff: number): string {
    const levelText = {
      'high': '🔴 Tinggi',
      'medium': '🟡 Sedang', 
      'low': '🟢 Rendah'
    };
    
    let statusText = levelText[spendingLevel];
    
    if (isAboveAverage && percentageDiff > 0) {
      statusText += ` (↑${percentageDiff}% dari biasanya)`;
    } else if (!isAboveAverage && percentageDiff < 0) {
      statusText += ` (↓${Math.abs(percentageDiff)}% dari biasanya)`;
    }
    
    return statusText;
  }

  private generateNoSpendingResponse(timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
    const timeframeName = this.getTimeframeName(timeframe).toLowerCase();
    return `📊 Analisis Pengeluaran ${this.getTimeframeName(timeframe)}\n\n` +
           `💰 Tidak ada pengeluaran tercatat untuk periode ${timeframeName} ini.\n\n` +
           `💡 Tips: Pastikan untuk mencatat semua transaksi agar analisis lebih akurat!`;
  }

  /**
   * Check if prompt contains financial keywords (to avoid identity confusion)
   */
  private containsFinancialKeywords(prompt: string): boolean {
    const financialKeywords = [
      'boros', 'hemat', 'pengeluaran', 'keuangan', 'budget', 'spending', 
      'uang', 'rupiah', 'transaksi', 'bayar', 'beli', 'jual', 'finansial',
      'tabung', 'investasi', 'cicilan', 'kredit', 'debit', 'cash', 'transfer'
    ];
    
    const normalizedPrompt = prompt.toLowerCase();
    return financialKeywords.some(keyword => normalizedPrompt.includes(keyword));
  }
}
