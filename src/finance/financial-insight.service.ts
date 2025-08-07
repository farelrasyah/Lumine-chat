import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, TransactionData } from '../supabase/supabase.service';
import { EnhancedDateService } from './enhanced-date.service';
import { FinanceAnalysisService } from './finance-analysis.service';
import { BudgetManagementService } from './budget-management.service';
import * as dayjs from 'dayjs';
import * as quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(quarterOfYear);

export interface FinancialInsight {
  type: 'achievement' | 'warning' | 'tip' | 'milestone' | 'trend';
  title: string;
  message: string;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  data?: any;
  createdAt: string;
}

export interface AutomatedReport {
  pengirim: string;
  reportType: 'weekly' | 'monthly' | 'quarterly';
  period: string;
  summary: {
    totalSpending: number;
    transactionCount: number;
    topCategory: string;
    biggestExpense: TransactionData;
    savings?: number;
  };
  insights: FinancialInsight[];
  recommendations: string[];
  budgetStatus?: any;
  generatedAt: string;
}

export interface SmartNotification {
  pengirim: string;
  type: 'budget_alert' | 'unusual_spending' | 'goal_progress' | 'tip' | 'reminder';
  message: string;
  urgency: 'low' | 'medium' | 'high';
  scheduledFor?: string;
  sentAt?: string;
}

@Injectable()
export class FinancialInsightService {
  private readonly logger = new Logger(FinancialInsightService.name);

  constructor(
    private dateService: EnhancedDateService,
    private analysisService: FinanceAnalysisService,
    private budgetService: BudgetManagementService
  ) {}

  /**
   * Generate comprehensive financial insights for a user
   */
  async generateInsights(pengirim: string, timeframe: 'week' | 'month' | 'quarter' = 'month'): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];

    // Get date ranges
    const currentPeriod = this.getTimeframePeriod(timeframe);
    const previousPeriod = this.getPreviousPeriod(timeframe);

    try {
      // Spending comparison insights
      const comparisonInsights = await this.generateComparisonInsights(
        pengirim, currentPeriod, previousPeriod, timeframe
      );
      insights.push(...comparisonInsights);

      // Category insights
      const categoryInsights = await this.generateCategoryInsights(pengirim, currentPeriod);
      insights.push(...categoryInsights);

      // Pattern insights
      const patternInsights = await this.generatePatternInsights(pengirim, currentPeriod);
      insights.push(...patternInsights);

      // Goal and achievement insights
      const achievementInsights = await this.generateAchievementInsights(pengirim);
      insights.push(...achievementInsights);

      // Budget insights
      const budgetInsights = await this.generateBudgetInsights(pengirim);
      insights.push(...budgetInsights);

      // Predictive insights
      const predictiveInsights = await this.generatePredictiveInsights(pengirim);
      insights.push(...predictiveInsights);

    } catch (error) {
      this.logger.error('Error generating insights:', error);
      insights.push({
        type: 'warning',
        title: 'Kesalahan Analisis',
        message: 'Tidak dapat menganalisis semua data keuangan. Beberapa insight mungkin tidak tersedia.',
        actionable: false,
        priority: 'low',
        createdAt: new Date().toISOString()
      });
    }

    // Sort by priority and limit results
    return insights
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority))
      .slice(0, 10);
  }

  /**
   * Generate automated weekly/monthly reports
   */
  async generateAutomatedReport(pengirim: string, reportType: 'weekly' | 'monthly'): Promise<AutomatedReport> {
    const period = reportType === 'weekly' ? 
      this.dateService.getCurrentWeek() : 
      this.dateService.getCurrentMonth();

    const analysis = await this.analysisService.analyzeSpending(pengirim, period);
    const insights = await this.generateInsights(pengirim, reportType === 'weekly' ? 'week' : 'month');
    const recommendations = await this.analysisService.generateSavingsRecommendations(pengirim);

    // Get budget status
    let budgetStatus;
    try {
      const budgets = await this.budgetService.getBudgets(pengirim);
      if (budgets.length > 0) {
        budgetStatus = await this.budgetService.checkBudgets(pengirim);
      }
    } catch (error) {
      this.logger.error('Error getting budget status:', error);
    }

    const report: AutomatedReport = {
      pengirim,
      reportType,
      period: period.description,
      summary: {
        totalSpending: analysis.total,
        transactionCount: analysis.transactionCount,
        topCategory: analysis.mostFrequentCategory || 'Tidak ada',
        biggestExpense: analysis.largestTransaction!,
        savings: reportType === 'monthly' ? await this.calculateMonthlySavings(pengirim) : undefined
      },
      insights,
      recommendations: recommendations.slice(0, 5),
      budgetStatus,
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  /**
   * Detect unusual spending patterns and generate alerts
   */
  async detectUnusualSpending(pengirim: string): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];
    const currentWeek = this.dateService.getCurrentWeek();
    const previousWeek = {
      startDate: dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
      endDate: dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
      description: 'minggu lalu'
    };

    const [currentAnalysis, previousAnalysis] = await Promise.all([
      this.analysisService.analyzeSpending(pengirim, currentWeek),
      this.analysisService.analyzeSpending(pengirim, previousWeek)
    ]);

    // Check for spending spike
    if (previousAnalysis.total > 0) {
      const spendingIncrease = ((currentAnalysis.total - previousAnalysis.total) / previousAnalysis.total) * 100;
      
      if (spendingIncrease > 50) {
        notifications.push({
          pengirim,
          type: 'unusual_spending',
          message: `🚨 Pengeluaran minggu ini naik ${spendingIncrease.toFixed(0)}% dari minggu lalu (${this.formatRupiah(currentAnalysis.total)} vs ${this.formatRupiah(previousAnalysis.total)}). Ada yang tidak biasa?`,
          urgency: 'high'
        });
      }
    }

    // Check for large single transactions
    const recentTransactions = await SupabaseService.getTransactionHistory(
      pengirim,
      dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD'),
      10
    );

    const avgTransaction = currentAnalysis.averagePerTransaction;
    const unusualTransactions = recentTransactions.filter(t => t.nominal > avgTransaction * 3);

    if (unusualTransactions.length > 0) {
      const largest = unusualTransactions.sort((a, b) => b.nominal - a.nominal)[0];
      notifications.push({
        pengirim,
        type: 'unusual_spending',
        message: `💰 Transaksi besar terdeteksi: ${largest.deskripsi} senilai ${this.formatRupiah(largest.nominal)}. Pastikan ini sesuai rencana!`,
        urgency: 'medium'
      });
    }

    return notifications;
  }

  /**
   * Generate personalized financial tips
   */
  async generatePersonalizedTips(pengirim: string): Promise<SmartNotification[]> {
    const tips: SmartNotification[] = [];
    const currentMonth = this.dateService.getCurrentMonth();
    const patterns = await this.analysisService.analyzeSpendingPatterns(pengirim, currentMonth);

    // Day-based tips
    if (Object.keys(patterns.dayOfWeek).length > 0) {
      const highestDay = Object.entries(patterns.dayOfWeek)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (highestDay[1] > 0) {
        tips.push({
          pengirim,
          type: 'tip',
          message: `💡 Tip: Hari ${highestDay[0]} adalah hari termahal Anda (${this.formatRupiah(highestDay[1])}). Buat budget khusus untuk hari ini!`,
          urgency: 'low'
        });
      }
    }

    // Category-based tips
    const topCategory = Object.entries(patterns.category)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      const [category, amount] = topCategory;
      const categoryTips = this.getCategorySpecificTips(category, amount);
      
      if (categoryTips) {
        tips.push({
          pengirim,
          type: 'tip',
          message: categoryTips,
          urgency: 'low'
        });
      }
    }

    // Recurring expense tips
    if (patterns.recurringExpenses.length > 0) {
      const totalRecurring = patterns.recurringExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      tips.push({
        pengirim,
        type: 'tip',
        message: `🔄 Anda memiliki ${patterns.recurringExpenses.length} pengeluaran rutin senilai total ${this.formatRupiah(totalRecurring)}. Review apakah semuanya masih diperlukan.`,
        urgency: 'medium'
      });
    }

    return tips;
  }

  /**
   * Create smart reminders based on user patterns
   */
  async createSmartReminders(pengirim: string): Promise<SmartNotification[]> {
    const reminders: SmartNotification[] = [];
    const patterns = await this.analysisService.analyzeSpendingPatterns(pengirim);

    // Recurring expense reminders
    patterns.recurringExpenses.forEach(expense => {
      if (expense.nextDue) {
        const daysUntilDue = dayjs(expense.nextDue).diff(dayjs(), 'day');
        
        if (daysUntilDue <= 3 && daysUntilDue >= 0) {
          reminders.push({
            pengirim,
            type: 'reminder',
            message: `🔔 Pengingat: ${expense.description} (${this.formatRupiah(expense.amount)}) akan jatuh tempo dalam ${daysUntilDue} hari.`,
            urgency: 'medium',
            scheduledFor: dayjs(expense.nextDue).subtract(1, 'day').toISOString()
          });
        }
      }
    });

    // Budget check reminders (weekly for monthly budgets)
    const budgets = await this.budgetService.getBudgets(pengirim);
    const monthlyBudgets = budgets.filter(b => b.period === 'monthly');
    
    if (monthlyBudgets.length > 0) {
      const dayOfMonth = dayjs().date();
      
      // Mid-month budget check
      if (dayOfMonth === 15) {
        reminders.push({
          pengirim,
          type: 'reminder',
          message: `📊 Pertengahan bulan! Waktunya cek status budget. Ketik "status budget" untuk melihat progress.`,
          urgency: 'low'
        });
      }
    }

    return reminders;
  }

  /**
   * Format automated report as WhatsApp message
   */
  formatAutomatedReport(report: AutomatedReport): string {
    const periodEmoji = report.reportType === 'weekly' ? '📅' : '📊';
    const reportTitle = report.reportType === 'weekly' ? 'Laporan Mingguan' : 'Laporan Bulanan';
    
    let message = `${periodEmoji} **${reportTitle}**\n`;
    message += `📅 Periode: ${report.period}\n\n`;

    // Summary
    message += `💰 **Ringkasan:**\n`;
    message += `• Total pengeluaran: ${this.formatRupiah(report.summary.totalSpending)}\n`;
    message += `• Jumlah transaksi: ${report.summary.transactionCount}\n`;
    message += `• Kategori utama: ${report.summary.topCategory}\n`;
    
    if (report.summary.biggestExpense) {
      message += `• Pengeluaran terbesar: ${report.summary.biggestExpense.deskripsi} (${this.formatRupiah(report.summary.biggestExpense.nominal)})\n`;
    }
    
    if (report.summary.savings !== undefined) {
      const savingsStatus = report.summary.savings >= 0 ? 'Hemat' : 'Boros';
      message += `• Status: ${savingsStatus} ${this.formatRupiah(Math.abs(report.summary.savings))} dari bulan lalu\n`;
    }

    // Top insights
    if (report.insights.length > 0) {
      message += `\n🧠 **Insight Utama:**\n`;
      report.insights.slice(0, 3).forEach((insight, index) => {
        const emoji = this.getInsightEmoji(insight.type);
        message += `${emoji} ${insight.title}: ${insight.message}\n`;
      });
    }

    // Budget status
    if (report.budgetStatus && report.budgetStatus.length > 0) {
      message += `\n🎯 **Status Budget:**\n`;
      report.budgetStatus.slice(0, 2).forEach((alert: any) => {
        const emoji = alert.alertLevel === 'danger' ? '🚨' : '⚠️';
        message += `${emoji} ${alert.message}\n`;
      });
    }

    // Top recommendations
    if (report.recommendations.length > 0) {
      message += `\n💡 **Rekomendasi:**\n`;
      report.recommendations.slice(0, 2).forEach(rec => {
        message += `• ${rec}\n`;
      });
    }

    message += `\n📱 Ketik "analisis keuangan" untuk insight lebih detail!`;
    
    return message;
  }

  // Private helper methods

  private getTimeframePeriod(timeframe: 'week' | 'month' | 'quarter') {
    switch (timeframe) {
      case 'week':
        return this.dateService.getCurrentWeek();
      case 'quarter':
        // Fallback to 3-month period for quarter
        return {
          startDate: dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD'),
          endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
          description: '3 bulan terakhir'
        };
      default:
        return this.dateService.getCurrentMonth();
    }
  }

  private getPreviousPeriod(timeframe: 'week' | 'month' | 'quarter') {
    switch (timeframe) {
      case 'week':
        return {
          startDate: dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
          endDate: dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
          description: 'minggu lalu'
        };
      case 'quarter':
        // Fallback to previous 3-month period
        return {
          startDate: dayjs().subtract(5, 'month').startOf('month').format('YYYY-MM-DD'),
          endDate: dayjs().subtract(3, 'month').endOf('month').format('YYYY-MM-DD'),
          description: '3 bulan sebelumnya'
        };
      default:
        return this.dateService.getPreviousMonth();
    }
  }

  private async generateComparisonInsights(
    pengirim: string, 
    current: any, 
    previous: any, 
    timeframe: string
  ): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      const comparison = await this.analysisService.compareSpending(pengirim, current, previous);
      
      if (Math.abs(comparison.changePercent) > 20) {
        const trend = comparison.changePercent > 0 ? 'meningkat' : 'menurun';
        const priority = Math.abs(comparison.changePercent) > 50 ? 'high' : 'medium';
        
        insights.push({
          type: comparison.changePercent > 0 ? 'warning' : 'achievement',
          title: `Perubahan Signifikan`,
          message: `Pengeluaran ${timeframe} ini ${trend} ${Math.abs(comparison.changePercent).toFixed(1)}% dari periode sebelumnya`,
          actionable: comparison.changePercent > 0,
          priority,
          data: comparison,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error generating comparison insights:', error);
    }

    return insights;
  }

  private async generateCategoryInsights(pengirim: string, period: any): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      const analysis = await this.analysisService.analyzeSpending(pengirim, period);
      
      // Identify dominant category
      const topCategory = Object.entries(analysis.categoryBreakdown)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (topCategory) {
        const [category, amount] = topCategory;
        const percentage = (amount / analysis.total) * 100;
        
        if (percentage > 40) {
          insights.push({
            type: 'warning',
            title: 'Dominasi Kategori',
            message: `${percentage.toFixed(1)}% pengeluaran Anda untuk ${category} (${this.formatRupiah(amount)})`,
            actionable: true,
            priority: 'medium',
            category,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.error('Error generating category insights:', error);
    }

    return insights;
  }

  private async generatePatternInsights(pengirim: string, period: any): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      const patterns = await this.analysisService.analyzeSpendingPatterns(pengirim, period);
      
      // Unusual transactions insight
      if (patterns.unusualTransactions.length > 0) {
        const totalUnusual = patterns.unusualTransactions.reduce((sum, t) => sum + t.nominal, 0);
        
        insights.push({
          type: 'warning',
          title: 'Transaksi Tidak Biasa',
          message: `Terdeteksi ${patterns.unusualTransactions.length} transaksi dengan nilai tinggi (total: ${this.formatRupiah(totalUnusual)})`,
          actionable: true,
          priority: 'medium',
          data: patterns.unusualTransactions,
          createdAt: new Date().toISOString()
        });
      }

      // Day pattern insight
      const topSpendingDay = Object.entries(patterns.dayOfWeek)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (topSpendingDay && topSpendingDay[1] > 0) {
        insights.push({
          type: 'tip',
          title: 'Pola Harian',
          message: `Hari ${topSpendingDay[0]} adalah hari dengan pengeluaran tertinggi (${this.formatRupiah(topSpendingDay[1])})`,
          actionable: true,
          priority: 'low',
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error generating pattern insights:', error);
    }

    return insights;
  }

  private async generateAchievementInsights(pengirim: string): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      // Check for positive trends
      const currentMonth = this.dateService.getCurrentMonth();
      const previousMonth = this.dateService.getPreviousMonth();
      
      const comparison = await this.analysisService.compareSpending(
        pengirim, currentMonth, previousMonth
      );
      
      if (comparison.changePercent < -10) {
        insights.push({
          type: 'achievement',
          title: 'Hebat! Penghematan Berhasil',
          message: `Anda berhasil menghemat ${Math.abs(comparison.changePercent).toFixed(1)}% bulan ini!`,
          actionable: false,
          priority: 'high',
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error generating achievement insights:', error);
    }

    return insights;
  }

  private async generateBudgetInsights(pengirim: string): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      const alerts = await this.budgetService.checkBudgets(pengirim);
      
      alerts.forEach(alert => {
        insights.push({
          type: alert.alertLevel === 'exceeded' ? 'warning' : 'tip',
          title: 'Status Budget',
          message: alert.message,
          actionable: true,
          priority: alert.alertLevel === 'exceeded' ? 'high' : 'medium',
          category: alert.category,
          createdAt: new Date().toISOString()
        });
      });
    } catch (error) {
      this.logger.error('Error generating budget insights:', error);
    }

    return insights;
  }

  private async generatePredictiveInsights(pengirim: string): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    try {
      const prediction = await this.analysisService.predictMonthEndSpending(pengirim);
      
      if (prediction.confidence > 70) {
        const currentSpending = await this.analysisService.analyzeSpending(
          pengirim, 
          this.dateService.getCurrentMonth()
        );
        
        const remainingBudget = prediction.predicted - currentSpending.total;
        const daysLeft = this.dateService.getRemainingDaysInMonth();
        const dailyBudget = remainingBudget / daysLeft;
        
        insights.push({
          type: 'tip',
          title: 'Prediksi Pengeluaran',
          message: `Berdasarkan pola Anda, sisa budget ±${this.formatRupiah(dailyBudget)} per hari untuk mencapai target`,
          actionable: true,
          priority: 'medium',
          data: prediction,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error generating predictive insights:', error);
    }

    return insights;
  }

  private async calculateMonthlySavings(pengirim: string): Promise<number> {
    const currentMonth = this.dateService.getCurrentMonth();
    const previousMonth = this.dateService.getPreviousMonth();
    
    const [current, previous] = await Promise.all([
      this.analysisService.analyzeSpending(pengirim, currentMonth),
      this.analysisService.analyzeSpending(pengirim, previousMonth)
    ]);

    return previous.total - current.total;
  }

  private getPriorityWeight(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private getInsightEmoji(type: FinancialInsight['type']): string {
    const emojiMap = {
      'achievement': '🎉',
      'warning': '⚠️',
      'tip': '💡',
      'milestone': '🏆',
      'trend': '📈'
    };

    return emojiMap[type] || '💡';
  }

  private getCategorySpecificTips(category: string, amount: number): string | null {
    const tips: Record<string, string> = {
      'makanan': `🍽️ Tip: Pengeluaran makanan Anda ${this.formatRupiah(amount)}. Coba masak di rumah 2-3 kali seminggu untuk menghemat!`,
      'transportasi': `🚗 Tip: Biaya transportasi ${this.formatRupiah(amount)}. Pertimbangkan carpool atau transportasi umum untuk menghemat.`,
      'hiburan': `🎬 Tip: Pengeluaran hiburan ${this.formatRupiah(amount)}. Cari aktivitas gratis atau diskon khusus!`,
      'belanja': `🛒 Tip: Belanja ${this.formatRupiah(amount)} bulan ini. Buat daftar belanja dan hindari pembelian impulsif.`,
      'minuman': `🥤 Tip: Pengeluaran minuman ${this.formatRupiah(amount)}. Bawa botol minum sendiri untuk menghemat!`
    };

    return tips[category] || null;
  }

  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
