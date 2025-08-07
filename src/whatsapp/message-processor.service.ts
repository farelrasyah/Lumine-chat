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
    
    this.logger.log(`DEBUG: Pengirim detected: "${pengirim}"`);
    this.logger.log(`DEBUG: Message details - notify: "${msg.notify}", pushName: "${msg.pushName}", sender.name: "${msg.sender?.name}"`);

    // === PRIORITAS 1: DETEKSI QUERY INFORMASI KEUANGAN ===
    // Cek dulu apakah ini pertanyaan keuangan sebelum diparsing sebagai transaksi
    if (this.isFinanceQueryRequest(prompt)) {
      this.logger.log(`🔍 Detected finance query request: "${prompt}"`);
      
      try {
        const financeResponse = await this.financeQAService.processFinanceQuestion(prompt, pengirim);
        if (financeResponse) {
          // Simpan ke chat history
          const userNumber = msg.key?.remoteJid || msg.from || 'unknown';
          await SupabaseService.saveMessage(userNumber, 'user', prompt);
          await SupabaseService.saveMessage(userNumber, 'assistant', financeResponse);
          this.history.push({ prompt, response: financeResponse });
          this.logger.log(`Finance Query Q: ${prompt}\nA: ${financeResponse}`);
          return { reply: financeResponse, log: `Finance Query Q: ${prompt}\nA: ${financeResponse}` };
        }
      } catch (error) {
        this.logger.error('Error processing finance query:', error);
        const errorReply = 'Maaf, terjadi kesalahan saat menganalisis data keuangan Anda.';
        return { reply: errorReply, log: `Finance Query Error: ${error}` };
      }
    }

    // === PRIORITAS 2: PARSING TRANSAKSI BARU ===
    // Jika bukan query informasi, baru coba parsing sebagai transaksi
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
    const userNumber = msg.key?.remoteJid || msg.from || 'unknown';
    try {
      // Simpan pesan user ke Supabase
      await SupabaseService.saveMessage(userNumber, 'user', prompt);

      // Ambil seluruh riwayat chat user (limit 30 terakhir, urut kronologis)
      const messages = await SupabaseService.getMessages(userNumber, 30);

      // Format untuk prompt ke AI ala ChatGPT API
      const chatContext = messages.map((m: any) => ({ role: m.role, content: m.content }));
      chatContext.push({ role: 'user', content: prompt });

      // Deteksi pertanyaan tentang identitas/fungsi
      const identitasRegex = /^(siapa|siapakah|siapa kah|apakah|kenapa|apa|tolong)?\s*(kamu|anda|lumine|fungsi(mu)?|tugas(mu)?|siapakah|siapa kah|apakah|peran(mu)?|tentangmu|tentang lumine|who are you|what are you|your function|your role|describe yourself)/i;
      if (identitasRegex.test(prompt)) {
        const personalReply = 'Saya Lumine, asisten pribadi Farel Rasyah, siap membantu berbagai keperluan Anda.';
        await SupabaseService.saveMessage(userNumber, 'assistant', personalReply);
        this.history.push({ prompt, response: personalReply });
        this.logger.log(`Q: ${prompt}\nA: ${personalReply}`);
        return { reply: personalReply, log: `Q: ${prompt}\nA: ${personalReply}` };
      }

      // === FITUR TANYA JAWAB KEUANGAN LANJUTAN ===
      
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
        return `💼 **Status Budget:**\n\nAnda belum menetapkan budget. Gunakan perintah seperti:\n• "set batas bulanan 2 juta"\n• "budget makanan 500 ribu per bulan"\n\nUntuk mulai mengatur keuangan Anda!`;
      }

      const alerts = await this.budgetService.checkBudgets(pengirim);
      if (alerts.length > 0) {
        let response = `💼 **Status Budget:**\n\n`;
        alerts.forEach(alert => {
          const emoji = alert.alertLevel === 'exceeded' ? '🚨' : alert.alertLevel === 'danger' ? '⚠️' : '✅';
          response += `${emoji} ${alert.message}\n`;
        });
        return response;
      } else {
        return `✅ **Status Budget:**\n\nSemua budget Anda masih dalam batas aman! Lanjutkan kebiasaan baik ini.`;
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
        return `🧠 **Analisis Keuangan:**\n\nBelum ada cukup data untuk menganalisis pola pengeluaran Anda. Catat beberapa transaksi terlebih dahulu untuk mendapatkan insight yang lebih akurat.`;
      }

      let response = `🧠 **Analisis Keuangan ${timeframe === 'week' ? 'Mingguan' : 'Bulanan'}:**\n\n`;
      
      insights.slice(0, 5).forEach((insight, index) => {
        const emoji = this.getInsightEmoji(insight.type);
        response += `${emoji} **${insight.title}**\n${insight.message}\n\n`;
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
        return `✅ **Deteksi Pengeluaran:**\n\nTidak ada pola pengeluaran yang tidak biasa terdeteksi. Pengeluaran Anda terlihat konsisten!`;
      }

      let response = `⚠️ **Deteksi Pengeluaran Tidak Biasa:**\n\n`;
      notifications.forEach(notif => {
        response += `• ${notif.message}\n`;
      });

      return response;
    }

    // Personalized tips
    if (normalizedPrompt.includes('tips') || normalizedPrompt.includes('saran') || normalizedPrompt.includes('rekomendasi')) {
      const tips = await this.insightService.generatePersonalizedTips(pengirim);
      
      if (tips.length === 0) {
        return `💡 **Tips Keuangan:**\n\nBelum ada tips spesifik yang bisa diberikan. Lakukan lebih banyak transaksi untuk mendapatkan rekomendasi yang lebih personal!`;
      }

      let response = `💡 **Tips Keuangan Personal:**\n\n`;
      tips.forEach(tip => {
        response += `• ${tip.message}\n\n`;
      });

      return response;
    }

    return null;
  }

  /**
   * Deteksi apakah prompt adalah query informasi keuangan, bukan pencatatan transaksi
   */
  private isFinanceQueryRequest(prompt: string): boolean {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Pattern untuk query informasi vs pencatatan transaksi
    const informationQueryPatterns = [
      // Query dengan kata tanya eksplisit
      /^(berapa|total|jumlah|apa|daftar|riwayat|history|ringkasan|analisis)/,
      
      // Pattern "pengeluaranku [waktu]" - ini query, bukan transaksi
      /pengeluaranku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
      /pengeluaran.*ku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
      
      // Pattern "pengeluaranku [angka] [waktu] lalu" - ini juga query
      /pengeluaranku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
      /pengeluaran.*ku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
      
      // Pattern "pengeluaran [waktu]" tanpa nominal
      /^pengeluaran\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu|ini)/,
      /^pengeluaran\s+dari\s+/,
      
      // Pattern informational lainnya  
      /belanja\s+(apa|dimana|kapan)/,
      /beli\s+(apa|dimana|kapan)\s+(aja|saja)/,
      /(ada|punya)\s+data/,
      /cek\s+(pengeluaran|transaksi|saldo)/,
      
      // Pattern perbandingan
      /(bandingkan|banding|vs|versus)\s+(pengeluaran|belanja)/,
      /pengeluaran.*vs.*pengeluaran/,
      
      // Pattern prediksi & analisis
      /(prediksi|proyeksi|estimasi|perkiraan)\s+(pengeluaran|belanja)/,
      /analisis\s+(keuangan|pengeluaran|belanja)/,
      /(tren|pola|pattern)\s+(pengeluaran|belanja)/,
      
      // Pattern dengan rentang waktu spesifik  
      /dari\s+\d+.*sampai.*\d+/,
      /antara.*dan/,
      /selama\s+\d+\s+(hari|minggu|bulan)/
    ];
    
    // Cek apakah prompt cocok dengan pattern query informasi
    const isInformationQuery = informationQueryPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Pattern yang menunjukkan ini adalah transaksi, bukan query
    const transactionPatterns = [
      // Ada nominal eksplisit
      /\b\d+\s*(ribu|rb|juta|jt|rupiah|rp)\b/,
      /rp\s*\d+/,
      
      // Pattern pencatatan transaksi
      /^(beli|buat|bayar|bayar)\s+\w+.*\d+/,
      /^(aku|saya)\s+(beli|bayar)/,
      
      // Deskripsi detail item
      /beli\s+(nasi|ayam|kopi|mie|pizza|burger|baju|sepatu|bensin|pulsa|token)/,
      
      // Lokasi spesifik dengan item
      /(di|ke|dari)\s+\w+.*\d+/
    ];
    
    const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Logic: Jika cocok dengan information query DAN TIDAK cocok dengan transaction, maka ini adalah query
    const result = isInformationQuery && !isTransaction;
    
    this.logger.debug(`🔍 Finance query detection for "${prompt}": informationQuery=${isInformationQuery}, transaction=${isTransaction}, result=${result}`);
    
    return result;
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
}
