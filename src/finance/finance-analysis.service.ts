 import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, TransactionData } from '../supabase/supabase.service';
import { EnhancedDateService, DateRange, TimeContext } from './enhanced-date.service';
import * as dayjs from 'dayjs';

export interface FinanceAnalysis {
  total: number;
  categoryBreakdown: Record<string, number>;
  transactionCount: number;
  averagePerDay: number;
  averagePerTransaction: number;
  largestTransaction?: TransactionData;
  smallestTransaction?: TransactionData;
  mostFrequentCategory?: string;
}

export interface ComparisonResult {
  currentPeriod: FinanceAnalysis;
  previousPeriod: FinanceAnalysis;
  changePercent: number;
  changeAmount: number;
  trend: 'up' | 'down' | 'stable';
  insights: string[];
}

export interface BudgetAnalysis {
  budgetLimit: number;
  currentSpending: number;
  remaining: number;
  percentUsed: number;
  projectedMonthEnd: number;
  status: 'safe' | 'warning' | 'danger';
  daysLeft: number;
}

export interface SpendingPattern {
  dayOfWeek: Record<string, number>;
  timeOfDay: Record<string, number>;
  category: Record<string, number>;
  unusualTransactions: TransactionData[];
  recurringExpenses: Array<{
    description: string;
    amount: number;
    frequency: string;
    nextDue?: string;
  }>;
}

@Injectable()
export class FinanceAnalysisService {
  private readonly logger = new Logger(FinanceAnalysisService.name);

  constructor(private dateService: EnhancedDateService) {}

  /**
   * Analyze spending for a specific period
   */
  async analyzeSpending(pengirim: string, dateRange?: DateRange): Promise<FinanceAnalysis> {
    const startDate = dateRange?.startDate;
    const endDate = dateRange?.endDate;
    
    this.logger.debug(`Analyzing spending for ${pengirim}, dateRange: ${startDate || 'undefined'} to ${endDate || 'undefined'}`);
    
    // Get all transactions for the period
    const transactions = await SupabaseService.getTransactionHistory(
      pengirim, startDate, endDate, 1000
    );

    this.logger.debug(`Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      this.logger.debug(`No transactions found, returning zero analysis`);
      return {
        total: 0,
        categoryBreakdown: {},
        transactionCount: 0,
        averagePerDay: 0,
        averagePerTransaction: 0
      };
    }

    const total = transactions.reduce((sum, t) => sum + t.nominal, 0);
    this.logger.debug(`Total calculated: ${total}`);
    
    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    transactions.forEach(t => {
      const category = t.kategori || 'Lainnya';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + t.nominal;
    });

    this.logger.debug(`Category breakdown: ${JSON.stringify(categoryBreakdown)}`);

    // Find largest and smallest transactions
    const sortedByAmount = transactions.sort((a, b) => b.nominal - a.nominal);
    const largestTransaction = sortedByAmount[0];
    const smallestTransaction = sortedByAmount[sortedByAmount.length - 1];

    // Most frequent category
    const categoryCount: Record<string, number> = {};
    transactions.forEach(t => {
      const category = t.kategori || 'Lainnya';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    const mostFrequentCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    // Calculate averages
    const dayCount = dateRange ? 
      dayjs(dateRange.endDate).diff(dayjs(dateRange.startDate), 'day') + 1 : 1;
    const averagePerDay = total / dayCount;
    const averagePerTransaction = total / transactions.length;

    return {
      total,
      categoryBreakdown,
      transactionCount: transactions.length,
      averagePerDay,
      averagePerTransaction,
      largestTransaction,
      smallestTransaction,
      mostFrequentCategory
    };
  }

  /**
   * Compare spending between two periods
   */
  async compareSpending(pengirim: string, currentRange: DateRange, previousRange: DateRange): Promise<ComparisonResult> {
    const [currentAnalysis, previousAnalysis] = await Promise.all([
      this.analyzeSpending(pengirim, currentRange),
      this.analyzeSpending(pengirim, previousRange)
    ]);

    const changeAmount = currentAnalysis.total - previousAnalysis.total;
    const changePercent = previousAnalysis.total === 0 ? 0 : 
      (changeAmount / previousAnalysis.total) * 100;

    const trend = changePercent > 5 ? 'up' : 
                 changePercent < -5 ? 'down' : 'stable';

    const insights = this.generateComparisonInsights(
      currentAnalysis, previousAnalysis, changePercent
    );

    return {
      currentPeriod: currentAnalysis,
      previousPeriod: previousAnalysis,
      changePercent,
      changeAmount,
      trend,
      insights
    };
  }

  /**
   * Analyze budget status
   */
  async analyzeBudget(pengirim: string, budgetLimit: number, period: 'weekly' | 'monthly' = 'monthly'): Promise<BudgetAnalysis> {
    const currentPeriodRange = period === 'monthly' ? 
      this.dateService.getCurrentMonth() : 
      this.dateService.getCurrentWeek();

    const analysis = await this.analyzeSpending(pengirim, currentPeriodRange);
    const remaining = budgetLimit - analysis.total;
    const percentUsed = (analysis.total / budgetLimit) * 100;

    // Project month-end spending
    const daysElapsed = dayjs().diff(dayjs(currentPeriodRange.startDate), 'day') + 1;
    const totalDays = dayjs(currentPeriodRange.endDate).diff(dayjs(currentPeriodRange.startDate), 'day') + 1;
    const projectedMonthEnd = (analysis.total / daysElapsed) * totalDays;

    const status = percentUsed > 90 ? 'danger' : 
                  percentUsed > 70 ? 'warning' : 'safe';

    const daysLeft = dayjs(currentPeriodRange.endDate).diff(dayjs(), 'day') + 1;

    return {
      budgetLimit,
      currentSpending: analysis.total,
      remaining,
      percentUsed,
      projectedMonthEnd,
      status,
      daysLeft
    };
  }

  /**
   * Analyze spending patterns
   */
  async analyzeSpendingPatterns(pengirim: string, dateRange?: DateRange): Promise<SpendingPattern> {
    const transactions = await SupabaseService.getTransactionHistory(
      pengirim, dateRange?.startDate, dateRange?.endDate, 1000
    );

    // Day of week analysis
    const dayOfWeek: Record<string, number> = {};
    const timeOfDay: Record<string, number> = {};
    const category: Record<string, number> = {};

    transactions.forEach(t => {
      // Day analysis
      const day = dayjs(t.tanggal).format('dddd');
      dayOfWeek[day] = (dayOfWeek[day] || 0) + t.nominal;

      // Time analysis
      if (t.waktu) {
        const hour = parseInt(t.waktu.split(':')[0]);
        let timeSlot = 'Pagi';
        if (hour >= 12 && hour < 17) timeSlot = 'Siang';
        else if (hour >= 17 && hour < 21) timeSlot = 'Sore';
        else if (hour >= 21 || hour < 6) timeSlot = 'Malam';
        
        timeOfDay[timeSlot] = (timeOfDay[timeSlot] || 0) + t.nominal;
      }

      // Category analysis
      const cat = t.kategori || 'Lainnya';
      category[cat] = (category[cat] || 0) + t.nominal;
    });

    // Find unusual transactions (3x above average)
    const averageAmount = transactions.reduce((sum, t) => sum + t.nominal, 0) / transactions.length;
    const unusualTransactions = transactions.filter(t => t.nominal > averageAmount * 3);

    // Detect recurring expenses
    const recurringExpenses = this.findRecurringExpenses(transactions);

    return {
      dayOfWeek,
      timeOfDay,
      category,
      unusualTransactions,
      recurringExpenses
    };
  }

  /**
   * Generate savings recommendations
   */
  async generateSavingsRecommendations(pengirim: string): Promise<string[]> {
    const currentMonth = this.dateService.getCurrentMonth();
    const previousMonth = this.dateService.getPreviousMonth();
    
    const [currentAnalysis, patterns] = await Promise.all([
      this.analyzeSpending(pengirim, currentMonth),
      this.analyzeSpendingPatterns(pengirim, currentMonth)
    ]);

    const recommendations: string[] = [];

    // Top spending category analysis
    const topCategory = Object.entries(currentAnalysis.categoryBreakdown)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      const [category, amount] = topCategory;
      const percentage = (amount / currentAnalysis.total) * 100;
      
      if (percentage > 30) {
        recommendations.push(`💡 Kategori ${category} menghabiskan ${percentage.toFixed(1)}% dari total pengeluaran (${this.formatRupiah(amount)}). Pertimbangkan untuk mengurangi pengeluaran di kategori ini.`);
      }
    }

    // Unusual transactions
    if (patterns.unusualTransactions.length > 0) {
      const totalUnusual = patterns.unusualTransactions.reduce((sum, t) => sum + t.nominal, 0);
      recommendations.push(`⚠️ Ada ${patterns.unusualTransactions.length} transaksi tidak biasa senilai ${this.formatRupiah(totalUnusual)}. Pastikan ini sesuai dengan kebutuhan.`);
    }

    // Frequent small expenses
    const smallFrequent = await this.findFrequentSmallExpenses(pengirim, currentMonth);
    if (smallFrequent.length > 0) {
      recommendations.push(`☕ Pengeluaran kecil yang sering: ${smallFrequent.join(', ')}. Total bisa cukup besar dalam sebulan.`);
    }

    // Day-based recommendations
    const highestSpendingDay = Object.entries(patterns.dayOfWeek)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (highestSpendingDay) {
      const [day, amount] = highestSpendingDay;
      recommendations.push(`📅 Hari ${day} adalah hari dengan pengeluaran tertinggi (${this.formatRupiah(amount)}). Buat rencana khusus untuk hari ini.`);
    }

    return recommendations;
  }

  /**
   * Predict month-end spending
   */
  async predictMonthEndSpending(pengirim: string): Promise<{
    predicted: number;
    confidence: number;
    factors: string[];
  }> {
    const currentMonth = this.dateService.getCurrentMonth();
    const previousMonth = this.dateService.getPreviousMonth();
    
    const [currentAnalysis, previousAnalysis] = await Promise.all([
      this.analyzeSpending(pengirim, currentMonth),
      this.analyzeSpending(pengirim, previousMonth)
    ]);

    const daysElapsed = dayjs().diff(dayjs(currentMonth.startDate), 'day') + 1;
    const totalDays = dayjs(currentMonth.endDate).diff(dayjs(currentMonth.startDate), 'day') + 1;
    const daysRemaining = totalDays - daysElapsed;

    // Simple linear prediction based on current trend
    const dailyAverage = currentAnalysis.total / daysElapsed;
    const predicted = currentAnalysis.total + (dailyAverage * daysRemaining);

    // Adjust based on previous month pattern
    const adjustment = previousAnalysis.total > 0 ? 
      (predicted * 0.3) + (previousAnalysis.total * 0.7) : predicted;

    // Confidence calculation (higher if more data available)
    const confidence = Math.min(95, 50 + (daysElapsed * 2));

    const factors = [
      `Rata-rata harian saat ini: ${this.formatRupiah(dailyAverage)}`,
      `Pengeluaran bulan lalu: ${this.formatRupiah(previousAnalysis.total)}`,
      `Sisa hari dalam bulan: ${daysRemaining} hari`
    ];

    return {
      predicted: adjustment,
      confidence,
      factors
    };
  }

  // Private helper methods

  private generateComparisonInsights(
    current: FinanceAnalysis, 
    previous: FinanceAnalysis, 
    changePercent: number
  ): string[] {
    const insights: string[] = [];

    if (Math.abs(changePercent) > 20) {
      const direction = changePercent > 0 ? 'meningkat' : 'menurun';
      insights.push(`Pengeluaran ${direction} signifikan sebesar ${Math.abs(changePercent).toFixed(1)}%`);
    }

    // Category changes
    Object.entries(current.categoryBreakdown).forEach(([category, amount]) => {
      const prevAmount = previous.categoryBreakdown[category] || 0;
      if (prevAmount > 0) {
        const categoryChange = ((amount - prevAmount) / prevAmount) * 100;
        if (Math.abs(categoryChange) > 30) {
          const direction = categoryChange > 0 ? 'naik' : 'turun';
          insights.push(`Kategori ${category} ${direction} ${Math.abs(categoryChange).toFixed(1)}%`);
        }
      }
    });

    // Transaction frequency
    const freqChange = current.transactionCount - previous.transactionCount;
    if (Math.abs(freqChange) > 5) {
      const direction = freqChange > 0 ? 'meningkat' : 'menurun';
      insights.push(`Frekuensi transaksi ${direction} ${Math.abs(freqChange)} kali`);
    }

    return insights;
  }

  private findRecurringExpenses(transactions: TransactionData[]): Array<{
    description: string;
    amount: number;
    frequency: string;
    nextDue?: string;
  }> {
    // Group by similar descriptions
    const groups: Record<string, TransactionData[]> = {};
    
    transactions.forEach(t => {
      const normalizedDesc = this.normalizeDescription(t.deskripsi);
      if (!groups[normalizedDesc]) {
        groups[normalizedDesc] = [];
      }
      groups[normalizedDesc].push(t);
    });

    const recurring: Array<{
      description: string;
      amount: number;
      frequency: string;
      nextDue?: string;
    }> = [];

    Object.entries(groups).forEach(([desc, txns]) => {
      if (txns.length >= 2) {
        // Calculate frequency
        const dates = txns.map(t => dayjs(t.tanggal)).sort((a, b) => a.valueOf() - b.valueOf());
        const intervals: number[] = [];
        
        for (let i = 1; i < dates.length; i++) {
          intervals.push(dates[i].diff(dates[i-1], 'day'));
        }

        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        const avgAmount = txns.reduce((sum, t) => sum + t.nominal, 0) / txns.length;

        let frequency = 'Tidak teratur';
        if (avgInterval <= 8) frequency = 'Mingguan';
        else if (avgInterval <= 35) frequency = 'Bulanan';
        else if (avgInterval <= 95) frequency = 'Per 3 bulan';

        if (frequency !== 'Tidak teratur') {
          const lastDate = dates[dates.length - 1];
          const nextDue = lastDate.add(avgInterval, 'day').format('YYYY-MM-DD');

          recurring.push({
            description: desc,
            amount: avgAmount,
            frequency,
            nextDue
          });
        }
      }
    });

    return recurring;
  }

  private async findFrequentSmallExpenses(pengirim: string, dateRange: DateRange): Promise<string[]> {
    const transactions = await SupabaseService.getTransactionHistory(
      pengirim, dateRange.startDate, dateRange.endDate, 1000
    );

    // Find transactions under 50k that occur frequently
    const smallExpenses = transactions.filter(t => t.nominal < 50000);
    const expenseGroups: Record<string, number> = {};

    smallExpenses.forEach(t => {
      const normalized = this.normalizeDescription(t.deskripsi);
      expenseGroups[normalized] = (expenseGroups[normalized] || 0) + 1;
    });

    return Object.entries(expenseGroups)
      .filter(([, count]) => count >= 5)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([desc]) => desc);
  }

  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/\d+/g, '') // Remove numbers
      .replace(/[^\w\s]/g, '') // Remove special chars
      .trim();
  }

  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
