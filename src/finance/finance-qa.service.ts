import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EnhancedDateService, TimeContext } from './enhanced-date.service';
import { FinanceAnalysisService } from './finance-analysis.service';
import { AdvancedFinanceParserService } from './advanced-finance-parser.service';
import { AdvancedFinanceResponseService } from './advanced-finance-response.service';

export interface FinanceQuery {
  intent: string;
  timeRange?: string | null;
  timeContext?: TimeContext | null;
  kategori?: string;
  pengirim: string;
  originalQuestion?: string;
}

@Injectable()
export class FinanceQAService {
  private readonly logger = new Logger(FinanceQAService.name);

  constructor(
    private enhancedDateService: EnhancedDateService,
    private analysisService: FinanceAnalysisService,
    private parserService: AdvancedFinanceParserService,
    private responseService: AdvancedFinanceResponseService
  ) {}

  /**
   * Main entry point for processing finance questions
   */
  async processFinanceQuestion(question: string, pengirim: string): Promise<string | null> {
    this.logger.log(`Processing enhanced finance question: "${question}" from ${pengirim}`);

    try {
      // Try advanced parsing first
      const advancedQuery = this.parserService.parseAdvancedQuery(question, pengirim);
      if (advancedQuery) {
        this.logger.log(`Advanced query detected: ${advancedQuery.intent}`);
        return await this.responseService.processAdvancedQuery(advancedQuery);
      }

      // Fall back to legacy parsing for backward compatibility
      const legacyQuery = this.parseFinanceQuestion(question, pengirim);
      if (legacyQuery) {
        this.logger.log(`Legacy query detected: ${legacyQuery.intent}`);
        return await this.processLegacyQuery(legacyQuery);
      }

      return null;
    } catch (error) {
      this.logger.error('Error processing finance question:', error);
      return 'Maaf, terjadi kesalahan saat menganalisis pertanyaan keuangan Anda. Silakan coba lagi nanti.';
    }
  }

  /**
   * Process legacy queries for backward compatibility
   */
  private async processLegacyQuery(query: FinanceQuery): Promise<string> {
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
        return 'Maaf, saya belum bisa memahami pertanyaan keuangan ini.';
    }
  }

  private parseFinanceQuestion(question: string, pengirim: string): FinanceQuery | null {
    const normalizedQuestion = question.toLowerCase().trim();
    
    this.logger.log(`Parsing finance question: "${normalizedQuestion}"`);

    // Try enhanced time parsing first
    const timeContext = this.enhancedDateService.parseTimeExpression(normalizedQuestion);

    // Intent: Kategori - cek dulu kategori karena lebih spesifik
    const kategori = this.extractKategori(normalizedQuestion);
    if (kategori) {
      this.logger.log(`Detected category: ${kategori}`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { 
        intent: 'kategori', 
        timeRange, 
        timeContext, 
        kategori, 
        pengirim,
        originalQuestion: question
      };
    }

    // Intent: Total pengeluaran
    if (this.matchTotal(normalizedQuestion)) {
      this.logger.log(`Detected total query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { 
        intent: 'total', 
        timeRange, 
        timeContext, 
        pengirim,
        originalQuestion: question
      };
    }

    // Intent: Transaksi terakhir
    if (this.matchTerakhir(normalizedQuestion)) {
      this.logger.log(`Detected last transaction query`);
      return { 
        intent: 'terakhir', 
        timeContext, 
        pengirim,
        originalQuestion: question
      };
    }

    // Intent: Transaksi terbesar
    if (this.matchTerbesar(normalizedQuestion)) {
      this.logger.log(`Detected biggest transaction query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { 
        intent: 'terbesar', 
        timeRange, 
        timeContext, 
        pengirim,
        originalQuestion: question
      };
    }

    // Intent: Riwayat
    if (this.matchRiwayat(normalizedQuestion)) {
      this.logger.log(`Detected history query`);
      const timeRange = this.extractTimeRange(normalizedQuestion);
      return { 
        intent: 'riwayat', 
        timeRange, 
        timeContext, 
        pengirim,
        originalQuestion: question
      };
    }

    this.logger.log(`No finance intent detected for: "${normalizedQuestion}"`);
    return null;
  }

  private matchTotal(question: string): boolean {
    // Deteksi jika mengandung kata pengeluaran TAPI BUKAN untuk kategori spesifik
    const hasGeneralPengeluaran = /pengeluaran/.test(question) && 
                                  !/pengeluaran\s+(makanan|transportasi|belanja|hiburan|kesehatan|pendidikan|utilitas|lainnya)/.test(question);
    
    const hasTotal = /total|jumlah|berapa/.test(question);
    
    // Additional patterns for enhanced matching
    const hasPengeluaranKu = /pengeluaranku|pengeluaran.*ku|ku.*pengeluaran/.test(question);
    const hasPengeluaranHari = /pengeluaran.*hari|hari.*pengeluaran/.test(question);
    
    return hasGeneralPengeluaran || hasTotal || hasPengeluaranKu || hasPengeluaranHari;
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
    // Try enhanced date parsing first
    const timeContext = this.enhancedDateService.parseTimeExpression(question);
    if (timeContext) {
      this.logger.log(`Enhanced date parsing detected context: ${JSON.stringify(timeContext)}`);
      return 'enhanced'; // Special marker for enhanced parsing
    }

    // Fallback to legacy parsing
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
    // Use local timezone to avoid timezone issues
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // Convert to 1-based (1 = January, 8 = August)
    const currentDate = today.getDate();
    
    this.logger.log(`Current date: ${today.toISOString()}, Year: ${currentYear}, Month: ${currentMonth}, Date: ${currentDate}, timeRange: ${timeRange}`);
    
    switch (timeRange) {
      case 'today':
        const todayFormatted = this.formatDateLocal(currentYear, currentMonth, currentDate);
        return {
          startDate: todayFormatted,
          endDate: todayFormatted
        };
        
      case 'yesterday':
        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(today.getDate() - 1);
        const yesterdayFormatted = this.formatDateLocal(yesterdayDate.getFullYear(), yesterdayDate.getMonth() + 1, yesterdayDate.getDate());
        return {
          startDate: yesterdayFormatted,
          endDate: yesterdayFormatted
        };
        
      case 'thisWeek':
        const startOfWeekDate = new Date(today);
        startOfWeekDate.setDate(today.getDate() - today.getDay());
        const startOfWeekFormatted = this.formatDateLocal(startOfWeekDate.getFullYear(), startOfWeekDate.getMonth() + 1, startOfWeekDate.getDate());
        const endOfWeekFormatted = this.formatDateLocal(currentYear, currentMonth, currentDate);
        return {
          startDate: startOfWeekFormatted,
          endDate: endOfWeekFormatted
        };
        
      case 'thisMonth':
        // currentMonth is already 1-based (8 for August)
        const startOfMonth = this.formatDateLocal(currentYear, currentMonth, 1);
        // Get last day of the month using 0-based month for Date constructor
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const endOfMonth = this.formatDateLocal(currentYear, currentMonth, daysInMonth);
        const result = {
          startDate: startOfMonth,
          endDate: endOfMonth
        };
        this.logger.log(`thisMonth range calculated: ${JSON.stringify(result)} (Year: ${currentYear}, Month: ${currentMonth}, DaysInMonth: ${daysInMonth})`);
        return result;
        
      case 'thisYear':
        const startOfYear = this.formatDateLocal(currentYear, 1, 1);
        const endOfYear = this.formatDateLocal(currentYear, 12, 31);
        return {
          startDate: startOfYear,
          endDate: endOfYear
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

  private formatDateLocal(year: number, month: number, day: number): string {
    // Format tanggal lokal tanpa masalah timezone
    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  }

  private formatDateForDisplay(isoDateString: string): string {
    // Konversi dari YYYY-MM-DD ke DD/MM/YYYY untuk tampilan
    const [year, month, day] = isoDateString.split('-');
    return `${day}/${month}/${year}`;
  }

  private formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  private normalizeUserName(pengirim: string): string {
    // Clean and normalize the username
    let normalized = pengirim.trim();
    
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Return the cleaned version without hardcoded assumptions
    return normalized;
  }

  private async tryDifferentPengirimVariations(originalPengirim: string, startDate?: string, endDate?: string) {
    // First normalize the pengirim
    const normalizedPengirim = this.normalizeUserName(originalPengirim);
    
    // Generate variations dynamically based on the input
    const variations = [
      normalizedPengirim,
      originalPengirim,
    ];
    
    // Add first name variation
    const firstName = originalPengirim.split(' ')[0];
    if (firstName && firstName !== originalPengirim) {
      variations.push(firstName);
    }
    
    // Add last name variation
    const lastName = originalPengirim.split(' ').pop();
    if (lastName && lastName !== originalPengirim && lastName !== firstName) {
      variations.push(lastName);
    }
    
    // Remove duplicates
    const uniqueVariations = [...new Set(variations)];
    
    this.logger.log(`Testing pengirim variations: ${JSON.stringify(uniqueVariations)}`);
    
    // First, let's check what data exists for this pengirim without date filter for debugging
    this.logger.log(`Checking all data for pengirim variations...`);
    for (const variation of uniqueVariations.slice(0, 2)) { // Only check first 2 to avoid spam
      const allData = await SupabaseService.debugAllTransactions(variation);
      if (allData.length > 0) {
        this.logger.log(`Found ALL DATA for pengirim "${variation}": ${allData.length} transactions`);
        this.logger.log(`Sample transaction:`, allData[0]);
      }
    }
    
    // Now try with date filter
    for (const variation of uniqueVariations) {
      this.logger.log(`Trying with pengirim variation: "${variation}", startDate: "${startDate}", endDate: "${endDate}"`);
      const summary = await SupabaseService.getTransactionSummaryByCategory(
        variation,
        startDate,
        endDate
      );
      if (Object.keys(summary).length > 0) {
        this.logger.log(`✅ Found data with variation: "${variation}"`);
        return summary;
      } else {
        this.logger.log(`❌ No data found with variation: "${variation}"`);
      }
    }
    
    // If still no data found, try fuzzy matching with existing pengirim values
    this.logger.log(`No exact match found. Trying fuzzy matching...`);
    const allPengirimValues = await SupabaseService.getAllUniquePengirimValues();
    const fuzzyMatches = this.findFuzzyMatches(originalPengirim, allPengirimValues);
    
    for (const fuzzyMatch of fuzzyMatches) {
      this.logger.log(`Trying fuzzy match: "${fuzzyMatch}"`);
      const summary = await SupabaseService.getTransactionSummaryByCategory(
        fuzzyMatch,
        startDate,
        endDate
      );
      if (Object.keys(summary).length > 0) {
        this.logger.log(`✅ Found data with fuzzy match: "${fuzzyMatch}"`);
        return summary;
      }
    }
    
    // If still no data found, try without date filter
    this.logger.log(`No data found with date filter. Trying without date filter...`);
    for (const variation of uniqueVariations) {
      const summary = await SupabaseService.getTransactionSummaryByCategory(variation);
      if (Object.keys(summary).length > 0) {
        this.logger.log(`Found data without date filter for variation: "${variation}"`);
        return summary;
      }
    }
    
    // Debug: Try to get ALL transactions without any filter to see if table is empty
    this.logger.log(`Testing if transactions table has any data at all...`);
    try {
      // Test dengan SQL langsung
      this.logger.log(`Testing with direct SQL query...`);
      const directSQLTest = await SupabaseService.testSupabaseConnection();
      this.logger.log(`Direct SQL test completed`);
      
      const allUnique = await SupabaseService.getAllUniquePengirimValues();
      this.logger.log(`All unique pengirim values found: ${JSON.stringify(allUnique)}`);
      
      if (allUnique.length > 0) {
        this.logger.log(`Database has data but no match found for user variations: ${JSON.stringify(uniqueVariations)}`);
        // Try with the first available pengirim as test
        const testSummary = await SupabaseService.getTransactionSummaryByCategory(allUnique[0]);
        this.logger.log(`Test query with "${allUnique[0]}" returns:`, testSummary);
      } else {
        this.logger.log(`Database appears to be empty or connection issue`);
      }
    } catch (error) {
      this.logger.error(`Error testing database:`, error);
    }
    
    return {};
  }

  private findFuzzyMatches(input: string, candidates: string[]): string[] {
    const normalizedInput = input.toLowerCase().trim();
    const matches: string[] = [];
    
    for (const candidate of candidates) {
      const normalizedCandidate = candidate.toLowerCase().trim();
      
      // Check if candidate contains any word from input
      const inputWords = normalizedInput.split(/\s+/);
      const candidateWords = normalizedCandidate.split(/\s+/);
      
      const hasCommonWord = inputWords.some(inputWord => 
        candidateWords.some(candidateWord => 
          candidateWord.includes(inputWord) || inputWord.includes(candidateWord)
        )
      );
      
      if (hasCommonWord) {
        matches.push(candidate);
      }
    }
    
    return matches.slice(0, 3); // Limit to top 3 matches
  }

  private async handleTotalQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    this.logger.log(`Getting total transactions for original pengirim: "${query.pengirim}", normalized: "${this.normalizeUserName(query.pengirim)}", startDate: "${startDate}", endDate: "${endDate}"`);
    
    // Try different variations of pengirim name
    const categorySummary = await this.tryDifferentPengirimVariations(
      this.normalizeUserName(query.pengirim),
      startDate || undefined,
      endDate || undefined
    );

    this.logger.log(`Category summary found:`, categorySummary);

    if (Object.keys(categorySummary).length === 0) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `📊 Belum ada transaksi yang tercatat${periode ? ` ${periode}` : ''}.`;
    }

    // Build response with category breakdown
    const periode = this.getTimeRangeText(query.timeRange);
    let response = `� Pengeluaran${periode ? ` ${periode}` : ''}:\n\n`;
    
    let totalKeseluruhan = 0;
    
    // Sort categories and display
    Object.entries(categorySummary)
      .sort(([,a], [,b]) => b - a) // Sort by amount descending
      .forEach(([kategori, amount]) => {
        const emoji = this.getCategoryEmoji(kategori);
        response += `${emoji} ${kategori}: ${this.formatRupiah(amount)}\n`;
        totalKeseluruhan += amount;
      });
    
    response += `\n💰 Total: ${this.formatRupiah(totalKeseluruhan)}`;
    
    return response;
  }

  private async handleCategoryQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const normalizedPengirim = this.normalizeUserName(query.pengirim);
    
    const total = await SupabaseService.getTotalTransactions(
      normalizedPengirim,
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
    const normalizedPengirim = this.normalizeUserName(query.pengirim);
    const transaction = await SupabaseService.getLastTransaction(normalizedPengirim);
    
    if (!transaction) {
      return `🕒 Belum ada transaksi yang tercatat.`;
    }

    const formattedDate = this.formatDateForDisplay(transaction.tanggal);
    return `🕒 Transaksi terakhir kamu: *${transaction.deskripsi}* seharga **${this.formatRupiah(transaction.nominal)}** pada ${formattedDate}`;
  }

  private async handleBiggestTransactionQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const normalizedPengirim = this.normalizeUserName(query.pengirim);
    const transaction = await SupabaseService.getBiggestTransaction(
      normalizedPengirim,
      startDate || undefined,
      endDate || undefined
    );

    if (!transaction) {
      const periode = this.getTimeRangeText(query.timeRange);
      return `💥 Belum ada transaksi yang tercatat${periode ? ` ${periode}` : ''}.`;
    }

    const periode = this.getTimeRangeText(query.timeRange);
    const formattedDate = this.formatDateForDisplay(transaction.tanggal);
    return `💥 Pengeluaran terbesar${periode ? ` ${periode}` : ''}: *${transaction.deskripsi}* sebesar **${this.formatRupiah(transaction.nominal)}** pada ${formattedDate}`;
  }

  private async handleHistoryQuery(query: FinanceQuery): Promise<string> {
    const { startDate, endDate } = query.timeRange ? this.getDateRange(query.timeRange) : { startDate: '', endDate: '' };
    
    const normalizedPengirim = this.normalizeUserName(query.pengirim);
    const transactions = await SupabaseService.getTransactionHistory(
      normalizedPengirim,
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
      const formattedDate = this.formatDateForDisplay(transaction.tanggal);
      response += `• ${transaction.deskripsi}: ${this.formatRupiah(transaction.nominal)} (${formattedDate})\n`;
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
      'lainnya': '📂',
      // Add variations of category names that might be in database
      'Lainnya': '📂',
      'Makanan': '🍔',
      'Transportasi': '🚗',
      'Belanja': '🛍️',
      'Hiburan': '🎮',
      'Kesehatan': '🏥',
      'Pendidikan': '📚',
      'Utilitas': '⚡'
    };

    return emojiMap[kategori] || '📂';
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
