import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface FinanceQuery {
  intent: string;
  timeRange?: string | null;
  kategori?: string;
  pengirim: string;
}

@Injectable()
export class FinanceQAService {
  private readonly logger = new Logger(FinanceQAService.name);

  async processFinanceQuestion(question: string, pengirim: string): Promise<string | null> {
    const query = this.parseFinanceQuestion(question, pengirim);
    if (!query) return null;

    try {
      switch (query.intent) {
        case 'total':
          return await this.handleTotalQuery(query);
        case 'kategori':
          return await this.handleCategoryQuery(query);
        case 'terakhir':
          return await this.handleLastTransactionQuery(query);
        case 'terbesar':
          return await this.handleBiggestTransactionQuery(query);
        case 'riwayat':
          return await this.handleHistoryQuery(query);
        default:
          return null;
      }
    } catch (error) {
      this.logger.error('Error processing finance question:', error);
      return 'Maaf, terjadi kesalahan saat mengambil data keuangan.';
    }
  }

  private parseFinanceQuestion(question: string, pengirim: string): FinanceQuery | null {
    const normalizedQuestion = question.toLowerCase().trim();
    
    this.logger.log(`Parsing finance question: "${normalizedQuestion}"`);

    // Intent: Kategori - cek dulu kategori karena lebih spesifik
    const kategori = this.extractKategori(normalizedQuestion);
    if (kategori) {
      this.logger.log(`Detected category: ${kategori}`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { intent: 'kategori', timeRange, kategori, pengirim };
    }

    // Intent: Total pengeluaran
    if (this.matchTotal(normalizedQuestion)) {
      this.logger.log(`Detected total query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { intent: 'total', timeRange, pengirim };
    }

    // Intent: Transaksi terakhir
    if (this.matchTerakhir(normalizedQuestion)) {
      this.logger.log(`Detected last transaction query`);
      return { intent: 'terakhir', pengirim };
    }

    // Intent: Transaksi terbesar
    if (this.matchTerbesar(normalizedQuestion)) {
      this.logger.log(`Detected biggest transaction query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { intent: 'terbesar', timeRange, pengirim };
    }

    // Intent: Riwayat
    if (this.matchRiwayat(normalizedQuestion)) {
      this.logger.log(`Detected history query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { intent: 'riwayat', timeRange, pengirim };
    }

    this.logger.log(`No finance intent detected for: "${normalizedQuestion}"`);
    return null;
  }

  private matchTotal(question: string): boolean {
    // Deteksi jika mengandung kata pengeluaran TAPI BUKAN untuk kategori spesifik
    const hasGeneralPengeluaran = /pengeluaran/.test(question) && 
                                  !/pengeluaran\s+(makanan|transportasi|belanja|hiburan|kesehatan|pendidikan|utilitas|lainnya)/.test(question);
    
    const hasTotal = /total|jumlah|berapa/.test(question);
    
    return hasGeneralPengeluaran || hasTotal;
  }

  private matchTerakhir(question: string): boolean {
    return /terakhir|akhir|beli apa|transaksi terakhir|pembelian terakhir/.test(question);
  }

  private matchTerbesar(question: string): boolean {
    return /terbesar|terbanyak|paling besar|paling mahal|tertinggi|maksimal/.test(question);
  }

  private matchRiwayat(question: string): boolean {
    return /riwayat|history|daftar|list|apa saja|yang dibeli|pembelian/.test(question);
  }

  private extractKategori(question: string): string | null {
    const kategoriMap: Record<string, string> = {
      'makanan': 'makanan|makan|food|kuliner|restoran|warteg|nasi|ayam|sate|bakso|mie|burger|pizza|kfc|mcd',
      'transportasi': 'transportasi|transport|grab|gojek|taxi|bensin|bbm|motor|mobil|parkir|tol|kereta|bus',
      'belanja': 'belanja|shopping|baju|sepatu|tas|kosmetik|skincare|elektronik|gadget|hp|laptop',
      'hiburan': 'hiburan|entertainment|bioskop|game|streaming|netflix|spotify|youtube|concert|wisata',
      'kesehatan': 'kesehatan|health|dokter|obat|vitamin|rumah sakit|klinik|medical|check up',
      'pendidikan': 'pendidikan|education|sekolah|kuliah|kursus|buku|alat tulis|seminar|training',
      'utilitas': 'utilitas|listrik|air|gas|internet|wifi|pulsa|token|pln|pdam|telkom',
      'lainnya': 'lainnya|others|misc|miscellaneous'
    };

    // Deteksi kategori dari pertanyaan
    for (const [kategori, patterns] of Object.entries(kategoriMap)) {
      const regex = new RegExp(patterns, 'i');
      if (regex.test(question)) {
        this.logger.log(`Found category match: ${kategori} for pattern: ${patterns}`);
        return kategori;
      }
    }

    return null;
  }

  private extractTimeRange(question: string): string | null {
    const today = new Date();
    
    if (/hari ini|today/.test(question)) {
      return 'today';
    } else if (/kemarin|yesterday/.test(question)) {
      return 'yesterday';
    } else if (/minggu ini|seminggu|week/.test(question)) {
      return 'thisWeek';
    } else if (/bulan ini|sebulan|month/.test(question)) {
      return 'thisMonth';
    } else if (/tahun ini|setahun|year/.test(question)) {
      return 'thisYear';
    }

    return null;
  }

  private getDateRange(timeRange: string): { startDate: string; endDate: string } {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (timeRange) {
      case 'today':
        return {
          startDate: this.formatDate(startOfToday),
          endDate: this.formatDate(today)
        };
        
      case 'yesterday':
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: this.formatDate(yesterday),
          endDate: this.formatDate(yesterday)
        };
        
      case 'thisWeek':
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return {
          startDate: this.formatDate(startOfWeek),
          endDate: this.formatDate(today)
        };
        
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: this.formatDate(startOfMonth),
          endDate: this.formatDate(today)
        };
        
      case 'thisYear':
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        return {
          startDate: this.formatDate(startOfYear),
          endDate: this.formatDate(today)
        };
        
      default:
        return {
          startDate: '',
          endDate: ''
        };
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  private async handleTotalQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const total = await SupabaseService.getTotalTransactions(
      query.pengirim,
      startDate || undefined,
      endDate || undefined
    );

    if (total === 0) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `📊 Belum ada transaksi yang tercatat${periode ? ` ${periode}` : ''}.`;
    }

    const periode = this.getTimeRangeText(query.timeRange);
    return `💸 Total pengeluaran${periode ? ` ${periode}` : ''}: **${this.formatRupiah(total)}**`;
  }

  private async handleCategoryQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const total = await SupabaseService.getTotalTransactions(
      query.pengirim,
      startDate || undefined,
      endDate || undefined,
      query.kategori
    );

    if (total === 0) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `📂 Belum ada pengeluaran untuk kategori ${query.kategori}${periode ? ` ${periode}` : ''}.`;
    }

    const emoji = this.getCategoryEmoji(query.kategori || '');
    const periode = this.getTimeRangeText(query.timeRange);
    return `${emoji} ${query.kategori?.charAt(0).toUpperCase()}${query.kategori?.slice(1)}${periode ? ` ${periode}` : ''}: **${this.formatRupiah(total)}**`;
  }

  private async handleLastTransactionQuery(query: FinanceQuery): Promise<string> {
    const transaction = await SupabaseService.getLastTransaction(query.pengirim);
    
    if (!transaction) {
      return `🕒 Belum ada transaksi yang tercatat.`;
    }

    return `🕒 Transaksi terakhir kamu: *${transaction.deskripsi}* seharga **${this.formatRupiah(transaction.nominal)}**`;
  }

  private async handleBiggestTransactionQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const transaction = await SupabaseService.getBiggestTransaction(
      query.pengirim,
      startDate || undefined,
      endDate || undefined
    );

    if (!transaction) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `💥 Belum ada transaksi yang tercatat${periode ? ` ${periode}` : ''}.`;
    }

    const periode = this.getTimeRangeText(query.timeRange);
    return `💥 Pengeluaran terbesar${periode ? ` ${periode}` : ''}: *${transaction.deskripsi}* sebesar **${this.formatRupiah(transaction.nominal)}**`;
  }

  private async handleHistoryQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const transactions = await SupabaseService.getTransactionHistory(
      query.pengirim,
      startDate || undefined,
      endDate || undefined,
      5
    );

    if (transactions.length === 0) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `📋 Belum ada transaksi yang tercatat${periode ? ` ${periode}` : ''}.`;
    }

    const periode = this.getTimeRangeText(query.timeRange);
    let response = `🧾 Riwayat${periode ? ` ${periode}` : ''}:\n\n`;
    
    transactions.forEach((transaction) => {
      response += `• ${transaction.deskripsi}: ${this.formatRupiah(transaction.nominal)}\n`;
    });

    return response.trim();
  }

  private getTimeRangeText(timeRange?: string | null): string {
    if (!timeRange) return '';
    
    switch (timeRange) {
      case 'today':
        return 'hari ini';
      case 'yesterday':
        return 'kemarin';
      case 'thisWeek':
        return 'minggu ini';
      case 'thisMonth':
        return 'bulan ini';
      case 'thisYear':
        return 'tahun ini';
      default:
        return '';
    }
  }

  private getCategoryEmoji(kategori: string): string {
    const emojiMap: Record<string, string> = {
      'makanan': '🍔',
      'transportasi': '🚗',
      'belanja': '🛍️',
      'hiburan': '🎮',
      'kesehatan': '🏥',
      'pendidikan': '📚',
      'utilitas': '⚡',
      'lainnya': '📂'
    };

    return emojiMap[kategori.toLowerCase()] || '📂';
  }

  isFinanceQuestion(question: string): boolean {
    const normalizedQuestion = question.toLowerCase().trim();
    
    this.logger.log(`Checking if finance question: "${normalizedQuestion}"`);
    
    // Pattern yang lebih spesifik untuk mendeteksi pertanyaan keuangan
    const financePatterns = [
      /pengeluaran/,
      /transaksi/,
      /total.*(?:hari ini|minggu ini|bulan ini|tahun ini|kemarin)/,
      /jumlah.*(?:hari ini|minggu ini|bulan ini|tahun ini|kemarin)/,
      /berapa.*(?:hari ini|minggu ini|bulan ini|tahun ini|kemarin)/,
      /terakhir.*beli/,
      /beli.*apa/,
      /terbesar.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /paling mahal.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /riwayat.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /history.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /daftar.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /apa saja.*(?:hari ini|minggu ini|bulan ini|tahun ini)/,
      /kategori.*(?:makanan|transportasi|belanja|hiburan|kesehatan|pendidikan|utilitas|lainnya)/,
      /pengeluaran.*(?:makanan|transportasi|belanja|hiburan|kesehatan|pendidikan|utilitas|lainnya)/
    ];

    // Cek apakah cocok dengan pattern keuangan
    const matchesFinancePattern = financePatterns.some(pattern => pattern.test(normalizedQuestion));
    
    // Atau jika mengandung kata "pengeluaran" dan kata waktu
    const hasTimeKeyword = /hari ini|minggu ini|bulan ini|tahun ini|kemarin|today|yesterday|week|month|year/.test(normalizedQuestion);
    const hasFinanceKeyword = /pengeluaran|transaksi|total|jumlah|berapa/.test(normalizedQuestion);
    
    const isFinance = matchesFinancePattern || (hasFinanceKeyword && hasTimeKeyword);
    
    this.logger.log(`Is finance question: ${isFinance} (pattern: ${matchesFinancePattern}, finance+time: ${hasFinanceKeyword && hasTimeKeyword})`);
    
    return isFinance;
  }
}
