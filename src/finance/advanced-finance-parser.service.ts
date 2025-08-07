import { Injectable, Logger } from '@nestjs/common';
import { EnhancedDateService, TimeContext } from './enhanced-date.service';

export interface AdvancedFinanceQuery {
  intent: 'total' | 'category' | 'history' | 'comparison' | 'prediction' | 'budget' | 'pattern' | 'recommendation' | 'search' | 'goal' | 'reminder' | 'challenge' | 'simulation' | 'hari_paling_boros';
  timeContext?: TimeContext;
  category?: string;
  comparisonType?: 'month-to-month' | 'week-to-week' | 'year-to-year';
  searchKeyword?: string;
  budgetAmount?: number;
  budgetPeriod?: 'weekly' | 'monthly' | 'yearly';
  goalAmount?: number;
  goalDeadline?: string;
  simulationScenario?: string;
  challengeType?: string;
  pengirim: string;
  rawQuery: string;
}

@Injectable()
export class AdvancedFinanceParserService {
  private readonly logger = new Logger(AdvancedFinanceParserService.name);

  constructor(private dateService: EnhancedDateService) {}

  /**
   * Parse sophisticated natural language finance queries
   */
  parseAdvancedQuery(message: string, pengirim: string): AdvancedFinanceQuery | null {
    const normalizedMessage = message.toLowerCase().trim();
    this.logger.debug(`Parsing advanced finance query: "${normalizedMessage}"`);

    // Intent: Total/Pengeluaran queries
    if (this.matchesTotal(normalizedMessage)) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'total',
        timeContext: timeContext || undefined,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Category-specific queries
    const category = this.extractCategory(normalizedMessage);
    if (category && this.matchesCategoryQuery(normalizedMessage)) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'category',
        timeContext: timeContext || undefined,
        category,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Comparison queries
    const comparisonType = this.extractComparisonType(normalizedMessage);
    if (comparisonType) {
      return {
        intent: 'comparison',
        comparisonType,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Budget management
    const budgetMatch = this.extractBudgetInfo(normalizedMessage);
    if (budgetMatch) {
      return {
        intent: 'budget',
        budgetAmount: budgetMatch.amount,
        budgetPeriod: budgetMatch.period,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Goal setting
    const goalMatch = this.extractGoalInfo(normalizedMessage);
    if (goalMatch) {
      return {
        intent: 'goal',
        goalAmount: goalMatch.amount,
        goalDeadline: goalMatch.deadline,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Search transactions
    const searchKeyword = this.extractSearchKeyword(normalizedMessage);
    if (searchKeyword) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'search',
        searchKeyword,
        timeContext: timeContext || undefined,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Prediction queries
    if (this.matchesPrediction(normalizedMessage)) {
      return {
        intent: 'prediction',
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Pattern analysis
    if (this.matchesPattern(normalizedMessage)) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'pattern',
        timeContext: timeContext || undefined,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Recommendations
    if (this.matchesRecommendation(normalizedMessage)) {
      return {
        intent: 'recommendation',
        pengirim,
        rawQuery: message
      };
    }

    // Intent: History with context
    if (this.matchesHistory(normalizedMessage)) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'history',
        timeContext: timeContext || undefined,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Challenge
    const challengeType = this.extractChallengeType(normalizedMessage);
    if (challengeType) {
      return {
        intent: 'challenge',
        challengeType,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Simulation
    const simulation = this.extractSimulationScenario(normalizedMessage);
    if (simulation) {
      return {
        intent: 'simulation',
        simulationScenario: simulation,
        pengirim,
        rawQuery: message
      };
    }

    // Intent: Hari Paling Boros
    if (this.matchesHariPalingBoros(normalizedMessage)) {
      const timeContext = this.dateService.parseTimeExpression(normalizedMessage);
      return {
        intent: 'hari_paling_boros',
        timeContext: timeContext || undefined,
        pengirim,
        rawQuery: message
      };
    }

    return null;
  }

  // Pattern matching methods

  private matchesTotal(text: string): boolean {
    const patterns = [
      /total.*pengeluaran/,
      /pengeluaran.*total/,
      /berapa.*pengeluaran/,
      /pengeluaran.*berapa/,
      /jumlah.*pengeluaran/,
      /pengeluaran.*jumlah/,
      /habis.*berapa/,
      /berapa.*habis/,
      /keluar.*berapa/,
      /berapa.*keluar/,
      /sisa.*uang/,
      /uang.*sisa/,
      /pengeluaranku/,
      /pengeluaran.*ku/,
      /ku.*pengeluaran/,
      /pengeluaran.*hari/,
      /hari.*pengeluaran/,
      /pengeluaran.*minggu/,
      /minggu.*pengeluaran/,
      /pengeluaran.*bulan/,
      /bulan.*pengeluaran/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private matchesCategoryQuery(text: string): boolean {
    const patterns = [
      /pengeluaran.*untuk/,
      /untuk.*pengeluaran/,
      /belanja.*kategori/,
      /kategori.*belanja/,
      /habis.*untuk/,
      /untuk.*habis/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPrediction(text: string): boolean {
    const patterns = [
      /prediksi.*pengeluaran/,
      /pengeluaran.*prediksi/,
      /perkiraan.*pengeluaran/,
      /pengeluaran.*perkiraan/,
      /kira.*kira.*pengeluaran/,
      /estimasi.*pengeluaran/,
      /pengeluaran.*estimasi/,
      /berapa.*akhir.*bulan/,
      /total.*bulan.*ini/,
      /proyeksi.*pengeluaran/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPattern(text: string): boolean {
    const patterns = [
      /pola.*pengeluaran/,
      /kebiasaan.*belanja/,
      /analisis.*pengeluaran/,
      /tren.*pengeluaran/,
      /kapan.*sering.*belanja/,
      /hari.*paling.*boros/,
      /jam.*paling.*boros/,
      /pengeluaran.*tidak.*biasa/,
      /transaksi.*aneh/,
      /paling.*sering.*beli/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private matchesRecommendation(text: string): boolean {
    const patterns = [
      /saran.*hemat/,
      /tips.*hemat/,
      /cara.*hemat/,
      /gimana.*hemat/,
      /biar.*hemat/,
      /supaya.*hemat/,
      /rekomendasi.*hemat/,
      /advice.*pengeluaran/,
      /bisa.*hemat/,
      /mau.*hemat/,
      /pengen.*hemat/,
      /apa.*yang.*bisa.*dihemat/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private matchesHistory(text: string): boolean {
    const patterns = [
      /riwayat.*transaksi/,
      /transaksi.*riwayat/,
      /history.*pengeluaran/,
      /pengeluaran.*history/,
      /daftar.*transaksi/,
      /list.*transaksi/,
      /transaksi.*terakhir/,
      /terakhir.*kali.*beli/,
      /kapan.*terakhir/,
      /transaksi.*terbesar/,
      /terbesar.*transaksi/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private extractCategory(text: string): string | null {
    const categoryMap = {
      'makanan': ['makanan', 'makan', 'food', 'meal', 'snack', 'jajan', 'nasi', 'ayam', 'burger', 'pizza', 'kfc', 'mcd', 'warteg', 'padang', 'sushi', 'bakso', 'mie', 'soto', 'gudeg', 'rendang', 'gofood', 'grabfood', 'delivery'],
      'minuman': ['minuman', 'minum', 'drink', 'kopi', 'coffee', 'teh', 'tea', 'jus', 'juice', 'air', 'aqua', 'soda', 'cola', 'starbucks', 'kopiken', 'kopi kenangan', 'janji jiwa'],
      'transportasi': ['transport', 'transportasi', 'bensin', 'bbm', 'fuel', 'gojek', 'grab', 'ojek', 'taxi', 'bus', 'kereta', 'parkir', 'tol', 'angkot', 'ojol', 'gocar', 'grabcar'],
      'belanja': ['belanja', 'shopping', 'beli', 'buy', 'purchase', 'tokped', 'shopee', 'lazada', 'blibli', 'bukalapak', 'olshop', 'online shop', 'marketplace', 'mall', 'supermarket', 'minimarket', 'indomaret', 'alfamart'],
      'hiburan': ['hiburan', 'entertainment', 'nonton', 'bioskop', 'cinema', 'netflix', 'spotify', 'youtube', 'game', 'gaming', 'ps', 'xbox', 'steam', 'mobile legend', 'pubg', 'free fire', 'karaoke', 'ktv'],
      'kesehatan': ['kesehatan', 'health', 'dokter', 'rumah sakit', 'hospital', 'obat', 'medicine', 'vitamin', 'suplemen', 'apotek', 'kimia farma', 'guardian', 'medical', 'klinik', 'puskesmas'],
      'pendidikan': ['pendidikan', 'education', 'sekolah', 'kuliah', 'kursus', 'les', 'bimbel', 'buku', 'book', 'alat tulis', 'fotocopy', 'print', 'semester', 'spp', 'uang kuliah'],
      'pakaian': ['pakaian', 'baju', 'celana', 'sepatu', 'sandal', 'tas', 'topi', 'jaket', 'kemeja', 'kaos', 'dress', 'rok', 'fashion', 'clothing', 'uniqlo', 'zara', 'h&m'],
      'tagihan': ['tagihan', 'bill', 'listrik', 'air', 'pdam', 'pln', 'internet', 'wifi', 'telpon', 'pulsa', 'paket data', 'xl', 'telkomsel', 'indosat', 'tri', 'smartfren', 'by.u'],
      'lainnya': ['lainnya', 'other', 'misc', 'miscellaneous']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return null;
  }

  private extractComparisonType(text: string): 'month-to-month' | 'week-to-week' | 'year-to-year' | null {
    if (text.includes('bandingkan') || text.includes('compare') || text.includes('beda')) {
      if (text.includes('bulan')) return 'month-to-month';
      if (text.includes('minggu')) return 'week-to-week';
      if (text.includes('tahun')) return 'year-to-year';
      return 'month-to-month'; // default
    }
    return null;
  }

  private extractBudgetInfo(text: string): { amount: number; period: 'weekly' | 'monthly' | 'yearly' } | null {
    const budgetPatterns = [
      /set.*batas.*(.*?)(?:per\s+)?(mingguan|bulanan|minggu|bulan|tahun)/,
      /batas.*pengeluaran.*(.*?)(?:per\s+)?(mingguan|bulanan|minggu|bulan|tahun)/,
      /budget.*(.*?)(?:per\s+)?(mingguan|bulanan|minggu|bulan|tahun)/,
      /anggaran.*(.*?)(?:per\s+)?(mingguan|bulanan|minggu|bulan|tahun)/
    ];

    for (const pattern of budgetPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountText = match[1];
        const periodText = match[2];
        
        const amount = this.extractAmount(amountText);
        if (amount) {
          const period = periodText.includes('minggu') ? 'weekly' : 
                        periodText.includes('tahun') ? 'yearly' : 'monthly';
          return { amount, period };
        }
      }
    }

    return null;
  }

  private extractGoalInfo(text: string): { amount: number; deadline?: string } | null {
    const goalPatterns = [
      /target.*pengeluaran.*(.*?)(?:untuk|sampai|sebelum)?\s*(.*)$/,
      /goal.*(.*?)(?:untuk|sampai|sebelum)?\s*(.*)$/,
      /pengen.*kumpulkan.*(.*?)(?:untuk|sampai|sebelum)?\s*(.*)$/,
      /mau.*nabung.*(.*?)(?:untuk|sampai|sebelum)?\s*(.*)$/
    ];

    for (const pattern of goalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountText = match[1];
        const deadlineText = match[2];
        
        const amount = this.extractAmount(amountText);
        if (amount) {
          const deadline = this.extractDeadline(deadlineText);
          return { amount, deadline: deadline || undefined };
        }
      }
    }

    return null;
  }

  private extractSearchKeyword(text: string): string | null {
    const searchPatterns = [
      /beli\s+(.+?)\s+di\s+mana/,
      /beli\s+(.+?)\s+kapan/,
      /cari.*transaksi.*(.+)/,
      /transaksi.*(.+)/,
      /pengeluaran.*untuk.*(.+)/,
      /aku.*beli.*(.+)/
    ];

    for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractChallengeType(text: string): string | null {
    const challengePatterns = [
      /challenge.*(\d+.*hari)/,
      /tantangan.*(\d+.*hari)/,
      /(\d+.*hari).*tanpa.*belanja/,
      /hemat.*(\d+.*ribu).*per.*hari/,
      /no.*spend.*(\d+.*hari)/
    ];

    for (const pattern of challengePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private extractSimulationScenario(text: string): string | null {
    const simulationPatterns = [
      /sisa.*uang.*berapa/,
      /kalau.*hemat.*(.+)/,
      /simulasi.*(.+)/,
      /gimana.*kalau.*(.+)/,
      /what.*if.*(.+)/,
      /bagaimana.*jika.*(.+)/
    ];

    for (const pattern of simulationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || 'general';
      }
    }

    return null;
  }

  private extractAmount(text: string): number | null {
    // Remove common words and normalize
    const cleaned = text.replace(/(ribu|rb|juta|jt|rp|rupiah)/gi, '');
    
    const numberMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)/);
    if (!numberMatch) return null;

    let amount = parseFloat(numberMatch[1].replace(',', '.'));
    
    // Apply multipliers
    if (/ribu|rb/i.test(text)) amount *= 1000;
    if (/juta|jt/i.test(text)) amount *= 1000000;
    
    return amount;
  }

  private matchesHariPalingBoros(text: string): boolean {
    const patterns = [
      /hari\s+(paling\s+)?(boros|besar|tinggi|mahal)/,
      /hari\s+(ter)?(boros|mahal|tinggi)/,
      /(paling\s+)?boros\s+hari/,
      /hari\s+(dengan\s+)?pengeluaran\s+(paling\s+)?(besar|tinggi|banyak)/,
      /hari\s+(yang\s+)?paling\s+(boros|mahal)/,
      /kapan\s+(paling\s+)?(boros|mahal)/,
      /tanggal\s+berapa\s+(paling\s+)?(boros|mahal)/,
      /(paling\s+)?(boros|mahal)\s+tanggal\s+berapa/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private extractDeadline(text: string): string | null {
    if (!text || text.trim().length === 0) return null;
    
    const timeContext = this.dateService.parseTimeExpression(text);
    if (timeContext) {
      const dateRange = this.dateService.getDateRange(timeContext);
      return dateRange.endDate;
    }
    
    return null;
  }
}
