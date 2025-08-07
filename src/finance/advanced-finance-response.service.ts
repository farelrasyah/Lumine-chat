import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, TransactionData } from '../supabase/supabase.service';
import { EnhancedDateService } from './enhanced-date.service';
import { FinanceAnalysisService, FinanceAnalysis, ComparisonResult, BudgetAnalysis, SpendingPattern } from './finance-analysis.service';
import { AdvancedFinanceQuery } from './advanced-finance-parser.service';
import * as dayjs from 'dayjs';

interface BudgetData {
  pengirim: string;
  budgetAmount: number;
  budgetPeriod: 'weekly' | 'monthly' | 'yearly';
  createdAt: string;
}

interface FinanceGoal {
  pengirim: string;
  goalAmount: number;
  goalDeadline?: string;
  goalDescription: string;
  createdAt: string;
}

@Injectable()
export class AdvancedFinanceResponseService {
  private readonly logger = new Logger(AdvancedFinanceResponseService.name);
  
  // In-memory storage for demo (in production, use database)
  private budgets: Map<string, BudgetData> = new Map();
  private goals: Map<string, FinanceGoal> = new Map();

  constructor(
    private dateService: EnhancedDateService,
    private analysisService: FinanceAnalysisService
  ) {}

  /**
   * Process advanced finance queries and return formatted responses
   */
  async processAdvancedQuery(query: AdvancedFinanceQuery): Promise<string> {
    this.logger.debug(`Processing query with intent: ${query.intent}`);

    try {
      switch (query.intent) {
        case 'total':
          return await this.handleTotalQuery(query);
        case 'category':
          return await this.handleCategoryQuery(query);
        case 'comparison':
          return await this.handleComparisonQuery(query);
        case 'prediction':
          return await this.handlePredictionQuery(query);
        case 'pattern':
          return await this.handlePatternQuery(query);
        case 'recommendation':
          return await this.handleRecommendationQuery(query);
        case 'history':
          return await this.handleHistoryQuery(query);
        case 'search':
          return await this.handleSearchQuery(query);
        case 'budget':
          return await this.handleBudgetQuery(query);
        case 'goal':
          return await this.handleGoalQuery(query);
        case 'simulation':
          return await this.handleSimulationQuery(query);
        case 'challenge':
          return await this.handleChallengeQuery(query);
        default:
          return 'Maaf, saya belum bisa memahami pertanyaan keuangan ini. Coba gunakan kata kunci seperti "pengeluaran", "total", "bulan lalu", atau "kategori makanan".';
      }
    } catch (error) {
      this.logger.error('Error processing advanced finance query:', error);
      return 'Maaf, terjadi kesalahan saat menganalisis data keuangan Anda. Silakan coba lagi nanti.';
    }
  }

  // Query handlers

  private async handleTotalQuery(query: AdvancedFinanceQuery): Promise<string> {
    let dateRange;
    if (query.timeContext) {
      dateRange = this.dateService.getDateRange(query.timeContext);
      this.logger.debug(`Date range parsed: ${JSON.stringify(dateRange)}`);
    } else {
      this.logger.debug('No time context provided for total query');
    }

    this.logger.debug(`Analyzing spending for pengirim: ${query.pengirim}, dateRange: ${JSON.stringify(dateRange)}`);
    const analysis = await this.analysisService.analyzeSpending(query.pengirim, dateRange);
    this.logger.debug(`Analysis result: total=${analysis.total}, transactionCount=${analysis.transactionCount}`);

    if (analysis.total === 0) {
      const period = dateRange ? ` ${dateRange.description}` : '';
      return `💸 Belum ada pengeluaran yang tercatat${period}.`;
    }

    let response = `💸 **Total Pengeluaran${dateRange ? ` ${dateRange.description}` : ''}:**\n`;
    response += `${this.formatRupiah(analysis.total)}\n\n`;

    if (Object.keys(analysis.categoryBreakdown).length > 0) {
      response += `📊 **Breakdown per kategori:**\n`;
      
      const sortedCategories = Object.entries(analysis.categoryBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      sortedCategories.forEach(([category, amount]) => {
        const percentage = (amount / analysis.total) * 100;
        const emoji = this.getCategoryEmoji(category);
        response += `${emoji} ${category}: ${this.formatRupiah(amount)} (${percentage.toFixed(1)}%)\n`;
      });

      response += `\n🔢 **Total ${analysis.transactionCount} transaksi**`;
      
      if (dateRange) {
        response += `\n📅 Rata-rata per hari: ${this.formatRupiah(analysis.averagePerDay)}`;
      }
    }

    // Add contextual insights
    if (analysis.largestTransaction) {
      response += `\n\n💥 Pengeluaran terbesar: *${analysis.largestTransaction.deskripsi}* - ${this.formatRupiah(analysis.largestTransaction.nominal)}`;
    }

    return response;
  }

  private async handleCategoryQuery(query: AdvancedFinanceQuery): Promise<string> {
    let dateRange;
    if (query.timeContext) {
      dateRange = this.dateService.getDateRange(query.timeContext);
    }

    const total = await SupabaseService.getTotalTransactions(
      query.pengirim,
      dateRange?.startDate,
      dateRange?.endDate,
      query.category
    );

    if (total === 0) {
      const period = dateRange ? ` ${dateRange.description}` : '';
      return `📂 Belum ada pengeluaran untuk kategori **${query.category}**${period}.`;
    }

    const transactions = await SupabaseService.getTransactionsByCategory(
      query.pengirim,
      query.category!,
      dateRange?.startDate,
      dateRange?.endDate
    );

    const emoji = this.getCategoryEmoji(query.category!);
    const period = dateRange ? ` ${dateRange.description}` : '';
    
    let response = `${emoji} **Pengeluaran kategori ${query.category}${period}:**\n`;
    response += `${this.formatRupiah(total)}\n\n`;

    if (transactions.length > 0) {
      response += `🗂️ **Detail transaksi (${transactions.length}):**\n`;
      
      transactions.slice(0, 5).forEach((transaction, index) => {
        const date = this.dateService.formatDateForDisplay(transaction.tanggal);
        response += `${index + 1}. ${transaction.deskripsi}: ${this.formatRupiah(transaction.nominal)} (${date})\n`;
      });

      if (transactions.length > 5) {
        response += `\n... dan ${transactions.length - 5} transaksi lainnya`;
      }

      const avgAmount = total / transactions.length;
      response += `\n\n📊 Rata-rata per transaksi: ${this.formatRupiah(avgAmount)}`;
    }

    return response;
  }

  private async handleComparisonQuery(query: AdvancedFinanceQuery): Promise<string> {
    let currentRange, previousRange;

    switch (query.comparisonType) {
      case 'month-to-month':
        currentRange = this.dateService.getCurrentMonth();
        previousRange = this.dateService.getPreviousMonth();
        break;
      case 'week-to-week':
        currentRange = this.dateService.getCurrentWeek();
        previousRange = {
          startDate: dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
          endDate: dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
          description: 'minggu lalu'
        };
        break;
      case 'year-to-year':
        currentRange = this.dateService.getCurrentYear();
        previousRange = {
          startDate: dayjs().subtract(1, 'year').startOf('year').format('YYYY-MM-DD'),
          endDate: dayjs().subtract(1, 'year').endOf('year').format('YYYY-MM-DD'),
          description: 'tahun lalu'
        };
        break;
      default:
        currentRange = this.dateService.getCurrentMonth();
        previousRange = this.dateService.getPreviousMonth();
    }

    const comparison = await this.analysisService.compareSpending(
      query.pengirim, currentRange, previousRange
    );

    return this.formatComparisonResponse(comparison, currentRange, previousRange);
  }

  private async handlePredictionQuery(query: AdvancedFinanceQuery): Promise<string> {
    const prediction = await this.analysisService.predictMonthEndSpending(query.pengirim);
    
    let response = `🔮 **Prediksi Pengeluaran Akhir Bulan:**\n`;
    response += `${this.formatRupiah(prediction.predicted)}\n\n`;
    response += `📊 Tingkat kepercayaan: ${prediction.confidence.toFixed(0)}%\n\n`;
    response += `📈 **Faktor analisis:**\n`;
    
    prediction.factors.forEach((factor, index) => {
      response += `${index + 1}. ${factor}\n`;
    });

    // Add budget warning if available
    const currentMonth = this.dateService.getCurrentMonth();
    const currentSpending = await this.analysisService.analyzeSpending(query.pengirim, currentMonth);
    
    if (currentSpending.total > 0) {
      const remainingDays = this.dateService.getRemainingDaysInMonth();
      const dailyBudget = (prediction.predicted - currentSpending.total) / remainingDays;
      
      response += `\n💡 **Saran:**\n`;
      response += `Sisa ${remainingDays} hari lagi, usahakan pengeluaran tidak lebih dari ${this.formatRupiah(dailyBudget)} per hari.`;
    }

    return response;
  }

  private async handlePatternQuery(query: AdvancedFinanceQuery): Promise<string> {
    let dateRange;
    if (query.timeContext) {
      dateRange = this.dateService.getDateRange(query.timeContext);
    } else {
      dateRange = this.dateService.getCurrentMonth();
    }

    const patterns = await this.analysisService.analyzeSpendingPatterns(query.pengirim, dateRange);

    let response = `🧠 **Analisis Pola Pengeluaran ${dateRange.description}:**\n\n`;

    // Day of week analysis
    if (Object.keys(patterns.dayOfWeek).length > 0) {
      const topDay = Object.entries(patterns.dayOfWeek)
        .sort(([,a], [,b]) => b - a)[0];
      
      response += `📅 **Hari paling boros:** ${topDay[0]} (${this.formatRupiah(topDay[1])})\n\n`;
    }

    // Time of day analysis
    if (Object.keys(patterns.timeOfDay).length > 0) {
      const topTime = Object.entries(patterns.timeOfDay)
        .sort(([,a], [,b]) => b - a)[0];
      
      response += `⏰ **Waktu paling boros:** ${topTime[0]} (${this.formatRupiah(topTime[1])})\n\n`;
    }

    // Unusual transactions
    if (patterns.unusualTransactions.length > 0) {
      response += `⚠️ **Transaksi tidak biasa:**\n`;
      patterns.unusualTransactions.slice(0, 3).forEach(t => {
        const date = this.dateService.formatDateForDisplay(t.tanggal);
        response += `• ${t.deskripsi}: ${this.formatRupiah(t.nominal)} (${date})\n`;
      });
      response += '\n';
    }

    // Recurring expenses
    if (patterns.recurringExpenses.length > 0) {
      response += `🔁 **Pengeluaran rutin yang terdeteksi:**\n`;
      patterns.recurringExpenses.forEach(expense => {
        response += `• ${expense.description}: ${this.formatRupiah(expense.amount)} (${expense.frequency})\n`;
        if (expense.nextDue) {
          const nextDue = this.dateService.formatDateForDisplay(expense.nextDue);
          response += `  Perkiraan jatuh tempo berikutnya: ${nextDue}\n`;
        }
      });
    }

    return response;
  }

  private async handleRecommendationQuery(query: AdvancedFinanceQuery): Promise<string> {
    const recommendations = await this.analysisService.generateSavingsRecommendations(query.pengirim);

    if (recommendations.length === 0) {
      return `💡 **Rekomendasi Penghematan:**\n\nData transaksi masih terbatas untuk memberikan rekomendasi yang spesifik. Coba lakukan beberapa transaksi terlebih dahulu, lalu tanya lagi!`;
    }

    let response = `💡 **Rekomendasi Penghematan Personal:**\n\n`;
    
    recommendations.forEach((rec, index) => {
      response += `${index + 1}. ${rec}\n\n`;
    });

    // Add general tips
    response += `🌟 **Tips umum:**\n`;
    response += `• Catat semua pengeluaran untuk tracking yang lebih baik\n`;
    response += `• Buat budget bulanan dan pantau secara berkala\n`;
    response += `• Pisahkan kebutuhan dan keinginan\n`;
    response += `• Gunakan prinsip 50/30/20 (kebutuhan/keinginan/tabungan)`;

    return response;
  }

  private async handleHistoryQuery(query: AdvancedFinanceQuery): Promise<string> {
    let dateRange;
    if (query.timeContext) {
      dateRange = this.dateService.getDateRange(query.timeContext);
    }

    const transactions = await SupabaseService.getTransactionHistory(
      query.pengirim,
      dateRange?.startDate,
      dateRange?.endDate,
      10
    );

    if (transactions.length === 0) {
      const period = dateRange ? ` ${dateRange.description}` : '';
      return `📋 Belum ada riwayat transaksi${period}.`;
    }

    const period = dateRange ? ` ${dateRange.description}` : '';
    let response = `📋 **Riwayat Transaksi${period}:**\n\n`;

    const total = transactions.reduce((sum, t) => sum + t.nominal, 0);
    response += `💰 Total: ${this.formatRupiah(total)} (${transactions.length} transaksi)\n\n`;

    transactions.forEach((transaction, index) => {
      const date = this.dateService.formatDateForDisplay(transaction.tanggal);
      const emoji = this.getCategoryEmoji(transaction.kategori);
      response += `${index + 1}. ${emoji} **${transaction.deskripsi}**\n`;
      response += `   ${this.formatRupiah(transaction.nominal)} • ${transaction.kategori || 'Lainnya'} • ${date}\n\n`;
    });

    return response;
  }

  private async handleSearchQuery(query: AdvancedFinanceQuery): Promise<string> {
    let dateRange;
    if (query.timeContext) {
      dateRange = this.dateService.getDateRange(query.timeContext);
    }

    const transactions = await SupabaseService.getTransactionHistory(
      query.pengirim,
      dateRange?.startDate,
      dateRange?.endDate,
      100
    );

    const keyword = query.searchKeyword!.toLowerCase();
    const matchingTransactions = transactions.filter(t => 
      t.deskripsi.toLowerCase().includes(keyword) ||
      (t.kategori && t.kategori.toLowerCase().includes(keyword))
    );

    if (matchingTransactions.length === 0) {
      const period = dateRange ? ` ${dateRange.description}` : '';
      return `🔍 Tidak ditemukan transaksi dengan kata kunci "*${query.searchKeyword}*"${period}.`;
    }

    const total = matchingTransactions.reduce((sum, t) => sum + t.nominal, 0);
    const period = dateRange ? ` ${dateRange.description}` : '';
    
    let response = `🔍 **Hasil pencarian "*${query.searchKeyword}*"${period}:**\n\n`;
    response += `💰 Total: ${this.formatRupiah(total)} (${matchingTransactions.length} transaksi)\n\n`;

    matchingTransactions.slice(0, 8).forEach((transaction, index) => {
      const date = this.dateService.formatDateForDisplay(transaction.tanggal);
      const emoji = this.getCategoryEmoji(transaction.kategori);
      response += `${index + 1}. ${emoji} ${transaction.deskripsi}\n`;
      response += `   ${this.formatRupiah(transaction.nominal)} • ${date}\n\n`;
    });

    if (matchingTransactions.length > 8) {
      response += `... dan ${matchingTransactions.length - 8} transaksi lainnya\n`;
    }

    // Add insights
    const avgAmount = total / matchingTransactions.length;
    response += `📊 Rata-rata per transaksi: ${this.formatRupiah(avgAmount)}`;

    return response;
  }

  private async handleBudgetQuery(query: AdvancedFinanceQuery): Promise<string> {
    const budgetKey = `${query.pengirim}-${query.budgetPeriod}`;
    
    if (query.budgetAmount) {
      // Set budget
      const budgetData: BudgetData = {
        pengirim: query.pengirim,
        budgetAmount: query.budgetAmount,
        budgetPeriod: query.budgetPeriod!,
        createdAt: new Date().toISOString()
      };
      
      this.budgets.set(budgetKey, budgetData);
      
      return `💼 **Budget berhasil ditetapkan!**\n\n` +
             `🎯 Target: ${this.formatRupiah(query.budgetAmount)} per ${query.budgetPeriod === 'weekly' ? 'minggu' : 'bulan'}\n\n` +
             `Saya akan membantu memantau pengeluaran Anda dan memberi peringatan jika mendekati batas.`;
    } else {
      // Check current budget status
      const budget = this.budgets.get(budgetKey);
      if (!budget) {
        return `💼 **Budget belum ditetapkan.**\n\n` +
               `Gunakan perintah seperti "set batas bulanan 1 juta" untuk menetapkan budget.`;
      }

      const analysis = await this.analysisService.analyzeBudget(
        query.pengirim, 
        budget.budgetAmount, 
        budget.budgetPeriod === 'weekly' ? 'weekly' : 'monthly'
      );

      return this.formatBudgetAnalysis(analysis, budget);
    }
  }

  private async handleGoalQuery(query: AdvancedFinanceQuery): Promise<string> {
    if (query.goalAmount) {
      // Set goal
      const goalData: FinanceGoal = {
        pengirim: query.pengirim,
        goalAmount: query.goalAmount,
        goalDeadline: query.goalDeadline,
        goalDescription: `Target ${this.formatRupiah(query.goalAmount)}`,
        createdAt: new Date().toISOString()
      };
      
      this.goals.set(query.pengirim, goalData);
      
      let response = `🎯 **Target keuangan berhasil ditetapkan!**\n\n`;
      response += `💰 Jumlah: ${this.formatRupiah(query.goalAmount)}\n`;
      
      if (query.goalDeadline) {
        const deadline = this.dateService.formatDateForDisplay(query.goalDeadline);
        response += `📅 Deadline: ${deadline}\n\n`;
        
        // Calculate required savings per period
        const daysUntilDeadline = dayjs(query.goalDeadline).diff(dayjs(), 'day');
        const weeksUntilDeadline = Math.ceil(daysUntilDeadline / 7);
        const monthsUntilDeadline = Math.ceil(daysUntilDeadline / 30);
        
        if (daysUntilDeadline > 0) {
          response += `⏰ **Strategi pencapaian:**\n`;
          response += `• Per hari: ${this.formatRupiah(query.goalAmount / daysUntilDeadline)}\n`;
          response += `• Per minggu: ${this.formatRupiah(query.goalAmount / weeksUntilDeadline)}\n`;
          if (monthsUntilDeadline > 0) {
            response += `• Per bulan: ${this.formatRupiah(query.goalAmount / monthsUntilDeadline)}\n`;
          }
        }
      }
      
      return response;
    } else {
      // Check current goal
      const goal = this.goals.get(query.pengirim);
      if (!goal) {
        return `🎯 **Belum ada target keuangan yang ditetapkan.**\n\n` +
               `Gunakan perintah seperti "target 2 juta untuk Oktober" untuk menetapkan target.`;
      }

      return `🎯 **Target Keuangan Aktif:**\n\n` +
             `💰 ${goal.goalDescription}\n` +
             (goal.goalDeadline ? `📅 Deadline: ${this.dateService.formatDateForDisplay(goal.goalDeadline)}\n` : '') +
             `📊 Status: Sedang dipantau...`;
    }
  }

  private async handleSimulationQuery(query: AdvancedFinanceQuery): Promise<string> {
    const currentMonth = this.dateService.getCurrentMonth();
    const analysis = await this.analysisService.analyzeSpending(query.pengirim, currentMonth);
    
    if (query.simulationScenario?.includes('hemat')) {
      // Extract savings amount
      const match = query.simulationScenario.match(/(\d+(?:\.\d+)?)\s*(ribu|juta|rb|jt)?/);
      if (match) {
        let savingsAmount = parseFloat(match[1]);
        if (match[2]?.includes('ribu') || match[2] === 'rb') savingsAmount *= 1000;
        if (match[2]?.includes('juta') || match[2] === 'jt') savingsAmount *= 1000000;
        
        const daysRemaining = this.dateService.getRemainingDaysInMonth();
        const totalSavings = savingsAmount * daysRemaining;
        const newProjected = analysis.total - totalSavings;
        
        let response = `🎯 **Simulasi Penghematan:**\n\n`;
        response += `💰 Jika hemat ${this.formatRupiah(savingsAmount)} per hari:\n`;
        response += `• Total hemat bulan ini: ${this.formatRupiah(totalSavings)}\n`;
        response += `• Proyeksi pengeluaran: ${this.formatRupiah(Math.max(0, newProjected))}\n`;
        response += `• Dalam 6 bulan: ${this.formatRupiah(savingsAmount * 30 * 6)}\n`;
        response += `• Dalam 1 tahun: ${this.formatRupiah(savingsAmount * 365)}\n\n`;
        response += `💡 **Tips mencapai target:** Kurangi pengeluaran kategori dengan nominal terbesar.`;
        
        return response;
      }
    }

    // General simulation
    const prediction = await this.analysisService.predictMonthEndSpending(query.pengirim);
    
    return `🔮 **Simulasi Keuangan:**\n\n` +
           `💸 Pengeluaran saat ini: ${this.formatRupiah(analysis.total)}\n` +
           `📈 Prediksi akhir bulan: ${this.formatRupiah(prediction.predicted)}\n` +
           `⏰ Sisa hari: ${this.dateService.getRemainingDaysInMonth()} hari\n\n` +
           `💡 Untuk menjaga pengeluaran stabil, batasi pengeluaran harian maksimal ${this.formatRupiah(prediction.predicted / 30)}.`;
  }

  private async handleChallengeQuery(query: AdvancedFinanceQuery): Promise<string> {
    let response = `🏆 **Challenge Finansial Dimulai!**\n\n`;
    
    if (query.challengeType?.includes('hari')) {
      const dayMatch = query.challengeType.match(/(\d+)/);
      const days = dayMatch ? parseInt(dayMatch[1]) : 7;
      
      const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD');
      
      response += `🎯 **Challenge: ${days} Hari Tanpa Belanja Impulsif**\n\n`;
      response += `📅 Dimulai: ${dayjs().format('DD MMMM YYYY')}\n`;
      response += `🏁 Berakhir: ${this.dateService.formatDateForDisplay(endDate)}\n\n`;
      response += `📋 **Aturan:**\n`;
      response += `• Hanya belanja kebutuhan pokok\n`;
      response += `• Tunggu 24 jam sebelum membeli barang non-esensial\n`;
      response += `• Catat setiap keinginan yang berhasil ditahan\n\n`;
      response += `🏆 Saya akan cek progress Anda secara berkala!`;
    } else if (query.challengeType?.includes('ribu')) {
      const amountMatch = query.challengeType.match(/(\d+)/);
      const amount = amountMatch ? parseInt(amountMatch[1]) * 1000 : 50000;
      
      response += `💰 **Challenge: Hemat ${this.formatRupiah(amount)} Per Hari**\n\n`;
      response += `🎯 Target: ${this.formatRupiah(amount * 30)} per bulan\n`;
      response += `💡 **Tips mencapai target:**\n`;
      response += `• Masak di rumah daripada beli makanan\n`;
      response += `• Gunakan transportasi umum\n`;
      response += `• Hindari pembelian impulsif\n`;
      response += `• Cari alternatif gratis untuk hiburan`;
    } else {
      response += `🌟 **Challenge: Smart Spending**\n\n`;
      response += `📊 Tantangan umum untuk mengoptimalkan pengeluaran:\n`;
      response += `• Analisis pengeluaran mingguan\n`;
      response += `• Kurangi 1 kategori pengeluaran terbesar\n`;
      response += `• Catat semua pengeluaran\n`;
      response += `• Bandingkan dengan minggu sebelumnya`;
    }

    return response;
  }

  // Helper methods

  private formatComparisonResponse(
    comparison: ComparisonResult, 
    currentRange: any, 
    previousRange: any
  ): string {
    let response = `📊 **Perbandingan ${currentRange.description} vs ${previousRange.description}:**\n\n`;
    
    // Current period
    response += `📈 **${currentRange.description}:**\n`;
    response += `💰 ${this.formatRupiah(comparison.currentPeriod.total)}\n`;
    response += `🔢 ${comparison.currentPeriod.transactionCount} transaksi\n\n`;
    
    // Previous period
    response += `📉 **${previousRange.description}:**\n`;
    response += `💰 ${this.formatRupiah(comparison.previousPeriod.total)}\n`;
    response += `🔢 ${comparison.previousPeriod.transactionCount} transaksi\n\n`;
    
    // Comparison
    const changeText = comparison.changeAmount >= 0 ? 'meningkat' : 'menurun';
    const changeEmoji = comparison.changeAmount >= 0 ? '📈' : '📉';
    
    response += `${changeEmoji} **Perubahan:**\n`;
    response += `${changeText} ${this.formatRupiah(Math.abs(comparison.changeAmount))} (${Math.abs(comparison.changePercent).toFixed(1)}%)\n\n`;
    
    // Insights
    if (comparison.insights.length > 0) {
      response += `💡 **Insights:**\n`;
      comparison.insights.forEach(insight => {
        response += `• ${insight}\n`;
      });
    }
    
    return response;
  }

  private formatBudgetAnalysis(analysis: BudgetAnalysis, budget: BudgetData): string {
    const statusEmoji = analysis.status === 'safe' ? '✅' : 
                       analysis.status === 'warning' ? '⚠️' : '🚨';
    
    let response = `${statusEmoji} **Status Budget ${budget.budgetPeriod === 'weekly' ? 'Mingguan' : 'Bulanan'}:**\n\n`;
    response += `🎯 Target: ${this.formatRupiah(analysis.budgetLimit)}\n`;
    response += `💸 Terpakai: ${this.formatRupiah(analysis.currentSpending)} (${analysis.percentUsed.toFixed(1)}%)\n`;
    response += `💰 Sisa: ${this.formatRupiah(analysis.remaining)}\n`;
    response += `📅 Sisa hari: ${analysis.daysLeft}\n\n`;
    
    if (analysis.projectedMonthEnd > analysis.budgetLimit) {
      const overBudget = analysis.projectedMonthEnd - analysis.budgetLimit;
      response += `⚠️ **Peringatan:** Proyeksi melebihi budget ${this.formatRupiah(overBudget)}\n`;
      response += `💡 Batasi pengeluaran harian maksimal ${this.formatRupiah(analysis.remaining / analysis.daysLeft)}\n`;
    } else {
      response += `✅ **Bagus!** Anda masih on-track dengan budget.\n`;
      response += `💡 Bisa belanja ${this.formatRupiah(analysis.remaining / analysis.daysLeft)} per hari.\n`;
    }
    
    return response;
  }

  private getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
      'makanan': '🍽️',
      'minuman': '🥤',
      'transportasi': '🚗',
      'belanja': '🛒',
      'hiburan': '🎬',
      'kesehatan': '🏥',
      'pendidikan': '📚',
      'pakaian': '👕',
      'tagihan': '📄',
      'lainnya': '📦'
    };

    return emojiMap[category?.toLowerCase()] || '💳';
  }

  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
