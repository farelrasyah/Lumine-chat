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

    // === PRIORITAS 2: DETEKSI PERINTAH BUDGET ===
    // Check for budget-related commands before transaction parsing
    if (this.isBudgetCommand(prompt)) {
      this.logger.log(`💰 Detected budget command: "${prompt}"`);
      
      try {
        const userNumber = msg.key?.remoteJid || msg.from || 'unknown';
        const budgetResponse = await this.handleBudgetCommand(prompt, pengirim);
        if (budgetResponse) {
          await SupabaseService.saveMessage(userNumber, 'user', prompt);
          await SupabaseService.saveMessage(userNumber, 'assistant', budgetResponse);
          this.history.push({ prompt, response: budgetResponse });
          this.logger.log(`Budget Q: ${prompt}\nA: ${budgetResponse}`);
          return { reply: budgetResponse, log: `Budget Q: ${prompt}\nA: ${budgetResponse}` };
        }
      } catch (error) {
        this.logger.error('Error processing budget command:', error);
        const errorReply = 'Maaf, terjadi kesalahan saat menyimpan budget.';
        return { reply: errorReply, log: `Budget Error: ${error}` };
      }
    }

    // === PRIORITAS 3: PARSING TRANSAKSI BARU ===
    // Jika bukan query informasi dan bukan budget command, baru coba parsing sebagai transaksi
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
        let reply = `📝 Dicatat: ${parsed.deskripsi} - Rp${parsed.nominal.toLocaleString('id-ID')}` +
          `\n📅 ${parsed.tanggalDisplay || parsed.tanggal} ⏰ ${parsed.waktu}` +
          `\n📂 Kategori: ${parsed.kategori}`;

        // === CEK PERINGATAN ANGGARAN SETELAH TRANSAKSI ===
        try {
          const budgetAlert = await this.checkBudgetAlert(parsed.pengirim, parsed.kategori, parsed.nominal);
          if (budgetAlert) {
            reply += `\n\n${budgetAlert}`;
            this.logger.log(`Budget alert triggered for ${parsed.pengirim}: ${budgetAlert}`);
          }
        } catch (alertError) {
          this.logger.error('Error checking budget alert:', alertError);
          // Don't fail transaction if alert check fails
        }

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
      'saran budget', 'rekomendasi budget',
      // DELETE BUDGET KEYWORDS
      'hapus anggaran', 'hapus budget', 'hapus batas',
      'batalkan anggaran', 'batalkan budget', 'batalkan batas',
      'delete budget', 'remove budget', 'clear budget'
    ];

    const normalizedPrompt = prompt.toLowerCase();
    
    // Prioritas tinggi: pattern yang jelas menunjukkan budget setting
    const budgetSetPatterns = [
      /set\s+batas\s+(bulanan|mingguan|harian)/,
      /budget\s+\w+\s+\d+/,
      /batas\s+pengeluaran/,
      /anggaran\s+\w+\s+\d+/
    ];
    
    // DELETE BUDGET PATTERNS
    const budgetDeletePatterns = [
      /hapus\s+(anggaran|budget|batas)/,
      /batalkan\s+(anggaran|budget|batas)/,
      /(delete|remove|clear)\s+budget/
    ];
    
    // Check explicit budget patterns first
    if (budgetSetPatterns.some(pattern => pattern.test(normalizedPrompt))) {
      return true;
    }
    
    // Check delete budget patterns
    if (budgetDeletePatterns.some(pattern => pattern.test(normalizedPrompt))) {
      return true;
    }
    
    // Check budget keywords
    return budgetKeywords.some(keyword => normalizedPrompt.includes(keyword));
  }

  /**
   * Handle budget-related commands
   */
  private async handleBudgetCommand(prompt: string, pengirim: string): Promise<string | null> {
    const normalizedPrompt = prompt.toLowerCase();

    // DELETE BUDGET COMMANDS
    if (this.isBudgetDeleteCommand(normalizedPrompt)) {
      return await this.handleBudgetDeleteCommand(prompt, pengirim);
    }

    // SET/CREATE BUDGET COMMANDS
    if (this.isBudgetSetCommand(normalizedPrompt)) {
      return await this.handleBudgetSetCommand(prompt, pengirim);
    }

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
   * Check if this is a budget setting command (not status/report)
   */
  private isBudgetSetCommand(normalizedPrompt: string): boolean {
    const setBudgetPatterns = [
      /set\s+batas\s+(bulanan|mingguan|harian)/,
      /budget\s+\w+\s+\d+/,
      /batas\s+pengeluaran/,
      /anggaran\s+\w+\s+\d+/,
      /atur\s+budget/,
      /buat\s+budget/
    ];
    
    return setBudgetPatterns.some(pattern => pattern.test(normalizedPrompt));
  }

  /**
   * Handle budget setting commands
   */
  private async handleBudgetSetCommand(prompt: string, pengirim: string): Promise<string> {
    try {
      this.logger.log(`🎯 Processing budget set command: "${prompt}"`);
      
      // Parse budget information
      const budgetInfo = this.parseBudgetCommand(prompt);
      if (!budgetInfo) {
        return `❌ Maaf, tidak bisa memahami perintah budget. Gunakan format seperti:\n• "budget makanan 500 ribu per bulan"\n• "set batas bulanan 2 juta"\n• "anggaran transportasi 300 ribu mingguan"`;
      }

      // Get current month
      const currentDate = new Date();
      const bulan = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      // Save to database using SupabaseService
      await SupabaseService.saveBudget({
        pengirim,
        kategori: budgetInfo.kategori,
        limit: budgetInfo.nominal,
        periode: budgetInfo.periode,
        bulan: bulan
      });

      this.logger.log(`✅ Budget saved successfully for ${pengirim}: ${budgetInfo.kategori} - Rp${budgetInfo.nominal.toLocaleString('id-ID')}`);

      return `✅ **Budget Berhasil Disimpan!**\n\n💰 **Kategori:** ${budgetInfo.kategori}\n💸 **Limit:** Rp${budgetInfo.nominal.toLocaleString('id-ID')}\n📅 **Periode:** ${budgetInfo.periode}\n🗓️ **Bulan:** ${this.formatBulanDisplay(bulan)}\n\nSistem akan mengingatkan Anda jika pengeluaran mendekati atau melebihi batas ini! 🔔`;
      
    } catch (error) {
      this.logger.error('Error saving budget:', error);
      return `❌ **Gagal menyimpan budget!**\n\nTerjadi kesalahan sistem. Silakan coba lagi nanti.`;
    }
  }

  /**
   * Parse budget command to extract information
   */
  private parseBudgetCommand(prompt: string): { kategori: string; nominal: number; periode: string } | null {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Extract nominal (amount)
    let nominal = 0;
    const nominalPatterns = [
      /(\d+)\s*(juta|jt)/,
      /(\d+)\s*(ribu|rb|k)/,
      /(\d+)\s*(rp|rupiah)/,
      /(\d+)/
    ];
    
    for (const pattern of nominalPatterns) {
      const match = normalizedPrompt.match(pattern);
      if (match) {
        const number = parseInt(match[1]);
        if (match[2]?.includes('juta') || match[2]?.includes('jt')) {
          nominal = number * 1000000;
        } else if (match[2]?.includes('ribu') || match[2]?.includes('rb') || match[2]?.includes('k')) {
          nominal = number * 1000;
        } else {
          nominal = number;
        }
        break;
      }
    }
    
    if (nominal === 0) return null;
    
    // Extract periode
    let periode = 'bulanan'; // default
    if (normalizedPrompt.includes('mingguan') || normalizedPrompt.includes('minggu')) {
      periode = 'mingguan';
    } else if (normalizedPrompt.includes('harian') || normalizedPrompt.includes('hari')) {
      periode = 'harian';
    }
    
    // Extract kategori
    let kategori = 'Umum'; // default
    const kategoriPatterns = [
      { pattern: /(makanan|makan|food)/i, kategori: 'Makanan' },
      { pattern: /(transport|transportasi|bensin|ojek|grab|taxi)/i, kategori: 'Transportasi' },
      { pattern: /(belanja|shopping|baju|pakaian)/i, kategori: 'Belanja' },
      { pattern: /(hiburan|entertainment|nonton|bioskop|game)/i, kategori: 'Hiburan' },
      { pattern: /(kesehatan|obat|dokter|rumah\s*sakit)/i, kategori: 'Kesehatan' },
      { pattern: /(pendidikan|sekolah|kuliah|kursus|buku)/i, kategori: 'Pendidikan' },
      { pattern: /(tagihan|listrik|air|internet|pulsa)/i, kategori: 'Tagihan' }
    ];
    
    for (const { pattern, kategori: kat } of kategoriPatterns) {
      if (pattern.test(normalizedPrompt)) {
        kategori = kat;
        break;
      }
    }
    
    // Special case: "set batas bulanan" without specific category
    if (normalizedPrompt.includes('set batas') || normalizedPrompt.includes('batas pengeluaran')) {
      kategori = 'Total Pengeluaran';
    }
    
    return { kategori, nominal, periode };
  }

  /**
   * Format bulan untuk display
   */
  private formatBulanDisplay(bulan: string): string {
    const [year, month] = bulan.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  /**
   * Check if this is a budget delete command
   */
  private isBudgetDeleteCommand(normalizedPrompt: string): boolean {
    const deleteBudgetPatterns = [
      /hapus\s+(anggaran|budget|batas)/,
      /batalkan\s+(anggaran|budget|batas)/,
      /(delete|remove|clear)\s+budget/,
      /hapus.*budget/,
      /hapus.*anggaran/,
      /hapus.*batas/
    ];
    
    return deleteBudgetPatterns.some(pattern => pattern.test(normalizedPrompt));
  }

  /**
   * Handle budget delete commands
   */
  private async handleBudgetDeleteCommand(prompt: string, pengirim: string): Promise<string> {
    try {
      this.logger.log(`🗑️ Processing budget delete command: "${prompt}"`);
      
      // Parse delete information
      const deleteInfo = this.parseBudgetDeleteCommand(prompt);
      if (!deleteInfo) {
        return `❌ Tidak bisa memahami perintah hapus budget. Gunakan format seperti:\n• "hapus anggaran makanan"\n• "hapus budget transportasi"\n• "batalkan batas pengeluaran makanan"\n• "hapus budget bulan ini" (hapus semua budget bulan ini)`;
      }

      // Get current month
      const currentDate = new Date();
      const bulan = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      let deletedCount = 0;
      let deletedCategories: string[] = [];

      if (deleteInfo.deleteAll) {
        // Delete all budgets for current month
        const existingBudgets = await SupabaseService.getAllBudgets(pengirim, bulan);
        deletedCategories = existingBudgets.map(b => b.kategori);
        
        if (existingBudgets.length > 0) {
          await SupabaseService.deleteBudget(pengirim, undefined, bulan);
          deletedCount = existingBudgets.length;
        }
      } else if (deleteInfo.kategori) {
        // Delete specific category budget
        const existingBudgets = await SupabaseService.getBudget(pengirim, deleteInfo.kategori, bulan);
        
        if (existingBudgets.length > 0) {
          await SupabaseService.deleteBudget(pengirim, deleteInfo.kategori, bulan);
          deletedCount = 1;
          deletedCategories.push(deleteInfo.kategori);
        }
      }

      // Generate response
      if (deletedCount === 0) {
        if (deleteInfo.deleteAll) {
          return `❌ **Tidak ada budget yang ditemukan untuk dihapus di bulan ${this.formatBulanDisplay(bulan)}.**\n\nAnda belum mengatur budget untuk bulan ini.`;
        } else {
          return `❌ **Tidak ada budget untuk kategori "${deleteInfo.kategori}" di bulan ${this.formatBulanDisplay(bulan)}.**\n\nMungkin budget sudah dihapus sebelumnya atau belum pernah diatur.`;
        }
      } else {
        this.logger.log(`✅ Successfully deleted ${deletedCount} budget(s) for ${pengirim}: ${deletedCategories.join(', ')}`);
        
        if (deleteInfo.deleteAll) {
          return `✅ **Semua Budget Berhasil Dihapus!**\n\n🗓️ **Bulan:** ${this.formatBulanDisplay(bulan)}\n📂 **Kategori yang Dihapus:** ${deletedCategories.join(', ')}\n🗑️ **Total Dihapus:** ${deletedCount} budget\n\n💡 *Anda dapat mengatur budget baru kapan saja dengan perintah "budget [kategori] [nominal] per bulan"*`;
        } else {
          return `✅ **Budget Berhasil Dihapus!**\n\n💰 **Kategori:** ${deleteInfo.kategori}\n🗓️ **Bulan:** ${this.formatBulanDisplay(bulan)}\n🗑️ **Status:** Budget telah dihapus dari sistem\n\n💡 *Anda dapat mengatur budget baru untuk kategori ini kapan saja.*`;
        }
      }
      
    } catch (error) {
      this.logger.error('Error deleting budget:', error);
      return `❌ **Gagal menghapus budget!**\n\nTerjadi kesalahan sistem. Silakan coba lagi nanti.`;
    }
  }

  /**
   * Parse budget delete command to extract information
   */
  private parseBudgetDeleteCommand(prompt: string): { kategori?: string; deleteAll: boolean } | null {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Check if user wants to delete all budgets
    if (normalizedPrompt.includes('bulan ini') || normalizedPrompt.includes('semua') || normalizedPrompt.includes('all')) {
      return { deleteAll: true };
    }
    
    // Extract kategori using same logic as budget setting
    let kategori: string | undefined;
    const kategoriPatterns = [
      { pattern: /(makanan|makan|food)/i, kategori: 'Makanan' },
      { pattern: /(transport|transportasi|bensin|ojek|grab|taxi)/i, kategori: 'Transportasi' },
      { pattern: /(belanja|shopping|baju|pakaian)/i, kategori: 'Belanja' },
      { pattern: /(hiburan|entertainment|nonton|bioskop|game)/i, kategori: 'Hiburan' },
      { pattern: /(kesehatan|obat|dokter|rumah\s*sakit)/i, kategori: 'Kesehatan' },
      { pattern: /(pendidikan|sekolah|kuliah|kursus|buku)/i, kategori: 'Pendidikan' },
      { pattern: /(tagihan|listrik|air|internet|pulsa)/i, kategori: 'Tagihan' }
    ];
    
    for (const { pattern, kategori: kat } of kategoriPatterns) {
      if (pattern.test(normalizedPrompt)) {
        kategori = kat;
        break;
      }
    }
    
    // Special case for "batas pengeluaran" or generic budget
    if (normalizedPrompt.includes('batas pengeluaran') && !kategori) {
      kategori = 'Total Pengeluaran';
    }
    
    if (!kategori) {
      // If no specific category found, try to extract any word after delete keywords
      const extractPattern = /(?:hapus|batalkan|delete|remove)\s+(?:anggaran|budget|batas)\s+(\w+)/;
      const match = normalizedPrompt.match(extractPattern);
      if (match) {
        // Capitalize first letter for consistency
        kategori = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
    
    return kategori ? { kategori, deleteAll: false } : null;
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
      
      // ANALYTICAL PATTERNS - FIXED: Hari paling boros, trends, analytics
      /hari\s+(paling\s+)?(boros|besar|tinggi|mahal)/,
      /hari\s+(ter)?(boros|mahal|tinggi)/,
      /(kapan|tanggal)\s+(paling\s+)?(boros|besar|mahal)/,
      /(waktu|saat|periode)\s+(ter)?(boros|mahal)/,
      
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
      
      // Pattern dengan rentang waktu spesifik - DATE RANGES  
      /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
      /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/,
      /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
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
      /^(beli|buat|bayar)\s+\w+.*\d+/,
      /^(aku|saya)\s+(beli|bayar)/,
      
      // Deskripsi detail item
      /beli\s+(nasi|ayam|kopi|mie|pizza|burger|baju|sepatu|bensin|pulsa|token)/,
      
      // Lokasi spesifik dengan item (EXCLUDE date ranges)
      /(di|ke)\s+\w+.*\d+/,  // Removed 'dari' to avoid conflicting with date ranges
      /dari\s+(?!tanggal)\w+.*\d+/  // Only match 'dari' if NOT followed by 'tanggal'
    ];
    
    const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Logic: Jika cocok dengan information query DAN TIDAK cocok dengan transaction, maka ini adalah query
    const result = isInformationQuery && !isTransaction;
    
    this.logger.debug(`🔍 Finance query detection for "${prompt}": informationQuery=${isInformationQuery}, transaction=${isTransaction}, result=${result}`);
    
    return result;
  }

  /**
   * Check budget alert after transaction is saved
   */
  private async checkBudgetAlert(pengirim: string, kategori: string, transactionAmount: number): Promise<string | null> {
    try {
      // Get current month for budget check
      const currentDate = new Date();
      const bulan = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      this.logger.debug(`Checking budget alert for ${pengirim}, kategori: ${kategori}, bulan: ${bulan}`);

      // Check if there's an active budget for this category
      const budgets = await SupabaseService.getBudget(pengirim, kategori, bulan);
      
      if (!budgets || budgets.length === 0) {
        this.logger.debug(`No budget found for kategori: ${kategori}`);
        return null; // No budget set for this category
      }

      const budget = budgets[0]; // Take the first matching budget
      const budgetLimit = budget.limit;
      
      this.logger.debug(`Found budget: limit=${budgetLimit} for kategori=${kategori}`);

      // Get total spending for this category in current month
      const startDate = `${bulan}-01`;
      const endDate = `${bulan}-31`; // Simplified end date
      
      const totalSpent = await SupabaseService.getTotalTransactions(pengirim, startDate, endDate, kategori);
      const previousSpent = totalSpent - transactionAmount; // Before this transaction
      
      this.logger.debug(`Budget check: totalSpent=${totalSpent}, previousSpent=${previousSpent}, budgetLimit=${budgetLimit}`);

      // Calculate percentages
      const currentPercentage = Math.round((totalSpent / budgetLimit) * 100);
      const remainingBudget = budgetLimit - totalSpent;
      
      // Generate appropriate alert message
      if (totalSpent > budgetLimit) {
        // 🚨 Budget exceeded
        const overAmount = totalSpent - budgetLimit;
        return `🚨 **PERINGATAN ANGGARAN!**\n\nKamu telah **melebihi** anggaran ${kategori} bulan ini!\n💸 **Total Pengeluaran:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Kelebihan:** Rp${overAmount.toLocaleString('id-ID')} (${currentPercentage}%)\n\n⚠️ *Pertimbangkan untuk lebih hemat di kategori ini!*`;
        
      } else if (currentPercentage >= 80) {
        // ⚠️ Warning: approaching limit (80%+)
        return `⚠️ **PERINGATAN ANGGARAN!**\n\nAnggaran ${kategori} kamu hampir habis!\n💸 **Total Pengeluaran:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Sisa:** Rp${remainingBudget.toLocaleString('id-ID')} (${100-currentPercentage}%)\n\n💡 *Sisanya cukup untuk ${Math.floor(remainingBudget / (totalSpent / 30))} hari lagi.*`;
        
      } else if (currentPercentage >= 50) {
        // 💡 Info: halfway point (50%+)
        return `💡 **INFO ANGGARAN**\n\nKamu sudah menggunakan ${currentPercentage}% anggaran ${kategori} bulan ini.\n💸 **Terpakai:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Sisa:** Rp${remainingBudget.toLocaleString('id-ID')}\n\n✅ *Masih dalam batas aman.*`;
      }
      
      // No alert needed if under 50%
      return null;
      
    } catch (error) {
      this.logger.error('Error in checkBudgetAlert:', error);
      return null; // Don't fail transaction if alert check fails
    }
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
