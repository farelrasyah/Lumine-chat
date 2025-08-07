import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EnhancedDateService } from './enhanced-date.service';
import { FinanceAnalysisService } from './finance-analysis.service';
import * as dayjs from 'dayjs';

export interface BudgetRule {
  id: string;
  pengirim: string;
  category?: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  alertThreshold: number; // percentage (e.g., 80 for 80%)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAlert {
  budgetId: string;
  pengirim: string;
  category?: string;
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  alertLevel: 'warning' | 'danger' | 'exceeded';
  message: string;
  createdAt: string;
}

export interface SpendingGoal {
  id: string;
  pengirim: string;
  targetAmount: number;
  currentAmount: number;
  goalType: 'save' | 'spend_limit';
  deadline?: string;
  category?: string;
  description: string;
  isAchieved: boolean;
  createdAt: string;
}

@Injectable()
export class BudgetManagementService {
  private readonly logger = new Logger(BudgetManagementService.name);

  // In-memory storage (in production, use Supabase)
  private budgets: Map<string, BudgetRule> = new Map();
  private goals: Map<string, SpendingGoal> = new Map();
  private alerts: BudgetAlert[] = [];

  constructor(
    private dateService: EnhancedDateService,
    private analysisService: FinanceAnalysisService
  ) {}

  /**
   * Create or update budget rule
   */
  async setBudget(
    pengirim: string,
    amount: number,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    category?: string,
    alertThreshold: number = 80
  ): Promise<BudgetRule> {
    const budgetId = `${pengirim}-${period}-${category || 'all'}`;
    
    const budget: BudgetRule = {
      id: budgetId,
      pengirim,
      category,
      amount,
      period,
      alertThreshold,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.budgets.set(budgetId, budget);
    this.logger.log(`Budget set for ${pengirim}: ${amount} per ${period} ${category ? `for ${category}` : ''}`);

    return budget;
  }

  /**
   * Get all active budgets for a user
   */
  async getBudgets(pengirim: string): Promise<BudgetRule[]> {
    return Array.from(this.budgets.values())
      .filter(budget => budget.pengirim === pengirim && budget.isActive);
  }

  /**
   * Check budget status and generate alerts
   */
  async checkBudgets(pengirim: string): Promise<BudgetAlert[]> {
    const budgets = await this.getBudgets(pengirim);
    const alerts: BudgetAlert[] = [];

    for (const budget of budgets) {
      const dateRange = this.getBudgetPeriodRange(budget.period);
      
      let currentSpending: number;
      if (budget.category) {
        currentSpending = await SupabaseService.getTotalTransactions(
          pengirim,
          dateRange.startDate,
          dateRange.endDate,
          budget.category
        );
      } else {
        const analysis = await this.analysisService.analyzeSpending(pengirim, dateRange);
        currentSpending = analysis.total;
      }

      const percentageUsed = (currentSpending / budget.amount) * 100;
      
      if (percentageUsed >= budget.alertThreshold) {
        const alert = this.generateBudgetAlert(budget, currentSpending, percentageUsed);
        alerts.push(alert);
      }
    }

    this.alerts.push(...alerts);
    return alerts;
  }

  /**
   * Set spending goal
   */
  async setGoal(
    pengirim: string,
    targetAmount: number,
    goalType: 'save' | 'spend_limit',
    description: string,
    deadline?: string,
    category?: string
  ): Promise<SpendingGoal> {
    const goalId = `${pengirim}-${Date.now()}`;
    
    const goal: SpendingGoal = {
      id: goalId,
      pengirim,
      targetAmount,
      currentAmount: 0,
      goalType,
      deadline,
      category,
      description,
      isAchieved: false,
      createdAt: new Date().toISOString()
    };

    this.goals.set(goalId, goal);
    return goal;
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(pengirim: string): Promise<SpendingGoal[]> {
    const userGoals = Array.from(this.goals.values())
      .filter(goal => goal.pengirim === pengirim && !goal.isAchieved);

    for (const goal of userGoals) {
      if (goal.goalType === 'save') {
        // For savings goals, calculate based on reduced spending
        const previousMonth = this.dateService.getPreviousMonth();
        const currentMonth = this.dateService.getCurrentMonth();
        
        const [prevSpending, currentSpending] = await Promise.all([
          this.analysisService.analyzeSpending(pengirim, previousMonth),
          this.analysisService.analyzeSpending(pengirim, currentMonth)
        ]);

        const savedAmount = Math.max(0, prevSpending.total - currentSpending.total);
        goal.currentAmount = savedAmount;
      } else {
        // For spending limit goals, track current spending
        let dateRange;
        if (goal.deadline) {
          dateRange = {
            startDate: dayjs(goal.createdAt).format('YYYY-MM-DD'),
            endDate: goal.deadline,
            description: 'goal period'
          };
        } else {
          dateRange = this.dateService.getCurrentMonth();
        }

        const analysis = await this.analysisService.analyzeSpending(pengirim, dateRange);
        goal.currentAmount = analysis.total;
      }

      // Check if goal is achieved
      if (goal.goalType === 'save' && goal.currentAmount >= goal.targetAmount) {
        goal.isAchieved = true;
      } else if (goal.goalType === 'spend_limit' && goal.currentAmount <= goal.targetAmount) {
        goal.isAchieved = true;
      }

      this.goals.set(goal.id, goal);
    }

    return userGoals;
  }

  /**
   * Get spending recommendations based on budget and goals
   */
  async getSpendingRecommendations(pengirim: string): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Check budget alerts
    const alerts = await this.checkBudgets(pengirim);
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        recommendations.push(`⚠️ ${alert.message}`);
      });
    }

    // Check goals progress
    const goals = await this.updateGoalProgress(pengirim);
    goals.forEach(goal => {
      const progressPercent = (goal.currentAmount / goal.targetAmount) * 100;
      
      if (goal.goalType === 'save') {
        if (progressPercent < 50) {
          recommendations.push(`🎯 Target menabung ${goal.description} baru tercapai ${progressPercent.toFixed(1)}%. Coba kurangi pengeluaran kategori terbesar.`);
        }
      } else if (goal.goalType === 'spend_limit') {
        if (progressPercent > 80) {
          recommendations.push(`🚨 Pengeluaran untuk ${goal.description} sudah mencapai ${progressPercent.toFixed(1)}% dari target!`);
        }
      }
    });

    // Add proactive recommendations
    const currentMonth = this.dateService.getCurrentMonth();
    const analysis = await this.analysisService.analyzeSpending(pengirim, currentMonth);
    
    if (analysis.total > 0) {
      const topCategory = Object.entries(analysis.categoryBreakdown)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (topCategory) {
        const [category, amount] = topCategory;
        const percentage = (amount / analysis.total) * 100;
        
        if (percentage > 40) {
          recommendations.push(`💡 ${percentage.toFixed(1)}% pengeluaran Anda untuk ${category}. Pertimbangkan untuk mengurangi pengeluaran di kategori ini.`);
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate weekly/monthly budget reports
   */
  async generateBudgetReport(pengirim: string, period: 'weekly' | 'monthly'): Promise<string> {
    const dateRange = period === 'weekly' ? 
      this.dateService.getCurrentWeek() : 
      this.dateService.getCurrentMonth();

    const analysis = await this.analysisService.analyzeSpending(pengirim, dateRange);
    const budgets = await this.getBudgets(pengirim);
    const goals = await this.updateGoalProgress(pengirim);

    let report = `📊 **Laporan Budget ${period === 'weekly' ? 'Mingguan' : 'Bulanan'}**\n`;
    report += `📅 Periode: ${dateRange.description}\n\n`;

    // Overall spending
    report += `💸 **Total Pengeluaran:** ${this.formatRupiah(analysis.total)}\n`;
    report += `🔢 **Total Transaksi:** ${analysis.transactionCount}\n`;
    report += `📊 **Rata-rata per transaksi:** ${this.formatRupiah(analysis.averagePerTransaction)}\n\n`;

    // Budget status
    if (budgets.length > 0) {
      report += `🎯 **Status Budget:**\n`;
      
      for (const budget of budgets) {
        const budgetRange = this.getBudgetPeriodRange(budget.period);
        let currentSpending: number;
        
        if (budget.category) {
          currentSpending = await SupabaseService.getTotalTransactions(
            pengirim,
            budgetRange.startDate,
            budgetRange.endDate,
            budget.category
          );
        } else {
          const budgetAnalysis = await this.analysisService.analyzeSpending(pengirim, budgetRange);
          currentSpending = budgetAnalysis.total;
        }

        const percentageUsed = (currentSpending / budget.amount) * 100;
        const statusEmoji = percentageUsed > 90 ? '🚨' : percentageUsed > 70 ? '⚠️' : '✅';
        
        report += `${statusEmoji} ${budget.category || 'Total'}: ${this.formatRupiah(currentSpending)} / ${this.formatRupiah(budget.amount)} (${percentageUsed.toFixed(1)}%)\n`;
      }
      report += '\n';
    }

    // Goals progress
    if (goals.length > 0) {
      report += `🏆 **Progress Target:**\n`;
      
      goals.forEach(goal => {
        const progressPercent = (goal.currentAmount / goal.targetAmount) * 100;
        const statusEmoji = goal.isAchieved ? '🎉' : progressPercent > 75 ? '🔥' : '📈';
        
        report += `${statusEmoji} ${goal.description}: ${this.formatRupiah(goal.currentAmount)} / ${this.formatRupiah(goal.targetAmount)} (${progressPercent.toFixed(1)}%)\n`;
      });
      report += '\n';
    }

    // Top categories
    if (Object.keys(analysis.categoryBreakdown).length > 0) {
      report += `📈 **Top Kategori Pengeluaran:**\n`;
      
      const topCategories = Object.entries(analysis.categoryBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      topCategories.forEach(([category, amount], index) => {
        const percentage = (amount / analysis.total) * 100;
        const emoji = this.getCategoryEmoji(category);
        report += `${index + 1}. ${emoji} ${category}: ${this.formatRupiah(amount)} (${percentage.toFixed(1)}%)\n`;
      });
    }

    // Recommendations
    const recommendations = await this.getSpendingRecommendations(pengirim);
    if (recommendations.length > 0) {
      report += `\n💡 **Rekomendasi:**\n`;
      recommendations.slice(0, 3).forEach(rec => {
        report += `• ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * Smart budget suggestions based on spending history
   */
  async suggestBudgets(pengirim: string): Promise<string> {
    const lastThreeMonths = [
      { ...this.dateService.getCurrentMonth() },
      { ...this.dateService.getPreviousMonth() },
      {
        startDate: dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().subtract(2, 'month').endOf('month').format('YYYY-MM-DD'),
        description: '2 bulan lalu'
      }
    ];

    const analyses = await Promise.all(
      lastThreeMonths.map(range => this.analysisService.analyzeSpending(pengirim, range))
    );

    if (analyses.every(a => a.total === 0)) {
      return `💡 **Saran Budget:**\n\nBelum ada data pengeluaran yang cukup untuk memberikan saran budget. Catat pengeluaran Anda selama beberapa minggu terlebih dahulu.`;
    }

    const averageSpending = analyses.reduce((sum, a) => sum + a.total, 0) / analyses.length;
    const categoryAverages: Record<string, number> = {};

    // Calculate average per category
    analyses.forEach(analysis => {
      Object.entries(analysis.categoryBreakdown).forEach(([category, amount]) => {
        categoryAverages[category] = (categoryAverages[category] || 0) + amount;
      });
    });

    Object.keys(categoryAverages).forEach(category => {
      categoryAverages[category] /= analyses.length;
    });

    let suggestions = `💡 **Saran Budget Berdasarkan Riwayat:**\n\n`;
    suggestions += `📊 Rata-rata pengeluaran 3 bulan terakhir: ${this.formatRupiah(averageSpending)}\n\n`;

    // Suggest overall budget
    const suggestedMonthly = averageSpending * 0.9; // 10% reduction target
    suggestions += `🎯 **Budget Bulanan yang Disarankan:** ${this.formatRupiah(suggestedMonthly)}\n`;
    suggestions += `(10% lebih rendah dari rata-rata untuk mendorong penghematan)\n\n`;

    // Suggest category budgets
    if (Object.keys(categoryAverages).length > 0) {
      suggestions += `📂 **Budget per Kategori:**\n`;
      
      const topCategories = Object.entries(categoryAverages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      topCategories.forEach(([category, amount]) => {
        const suggestedAmount = amount * 0.85; // 15% reduction for top categories
        const emoji = this.getCategoryEmoji(category);
        suggestions += `${emoji} ${category}: ${this.formatRupiah(suggestedAmount)}\n`;
      });
    }

    suggestions += `\n💡 **Untuk mengaktifkan budget:**\n`;
    suggestions += `• "set batas bulanan 1.5 juta"\n`;
    suggestions += `• "budget makanan 500 ribu per bulan"\n`;
    suggestions += `• "target hemat 200 ribu bulan ini"`;

    return suggestions;
  }

  // Private helper methods

  private getBudgetPeriodRange(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const now = dayjs();
    
    switch (period) {
      case 'daily':
        return {
          startDate: now.format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
          description: 'hari ini'
        };
      case 'weekly':
        return this.dateService.getCurrentWeek();
      case 'monthly':
        return this.dateService.getCurrentMonth();
      case 'yearly':
        return this.dateService.getCurrentYear();
      default:
        return this.dateService.getCurrentMonth();
    }
  }

  private generateBudgetAlert(
    budget: BudgetRule,
    currentSpending: number,
    percentageUsed: number
  ): BudgetAlert {
    let alertLevel: 'warning' | 'danger' | 'exceeded';
    let message: string;

    if (percentageUsed >= 100) {
      alertLevel = 'exceeded';
      message = `Budget ${budget.category || 'total'} telah terlampaui! ${this.formatRupiah(currentSpending)} dari ${this.formatRupiah(budget.amount)}`;
    } else if (percentageUsed >= 90) {
      alertLevel = 'danger';
      message = `Budget ${budget.category || 'total'} hampir habis (${percentageUsed.toFixed(1)}%). Sisa ${this.formatRupiah(budget.amount - currentSpending)}`;
    } else {
      alertLevel = 'warning';
      message = `Budget ${budget.category || 'total'} sudah terpakai ${percentageUsed.toFixed(1)}%. Sisa ${this.formatRupiah(budget.amount - currentSpending)}`;
    }

    return {
      budgetId: budget.id,
      pengirim: budget.pengirim,
      category: budget.category,
      currentSpending,
      budgetLimit: budget.amount,
      percentageUsed,
      alertLevel,
      message,
      createdAt: new Date().toISOString()
    };
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
