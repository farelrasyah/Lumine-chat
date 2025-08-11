import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SavingsSimulationParams {
  monthlyAmount: number;
  targetAmount?: number;
  months?: number;
  interestRate?: number; // Annual interest rate in percentage
  userId: string;
}

export interface SavingsProjection {
  month: number;
  monthlyDeposit: number;
  interestEarned: number;
  totalBalance: number;
  cumulativeDeposits: number;
  cumulativeInterest: number;
}

@Injectable()
export class SavingsSimulationService {
  /**
   * Run savings simulation based on monthly amount and parameters
   */
  async runSavingsSimulation(params: SavingsSimulationParams): Promise<{
    projections: SavingsProjection[];
    summary: {
      totalDeposits: number;
      totalInterest: number;
      finalBalance: number;
      monthsToTarget?: number;
      targetReached: boolean;
    };
    recommendations: string[];
  }> {
    const {
      monthlyAmount,
      targetAmount,
      months = 12, // Default 1 year
      interestRate = 3.5, // Default 3.5% annual interest
      userId
    } = params;

    // Validate input
    if (monthlyAmount <= 0) {
      throw new Error('Jumlah tabungan bulanan harus lebih dari 0');
    }

    // Calculate monthly interest rate
    const monthlyInterestRate = interestRate / 100 / 12;
    
    const projections: SavingsProjection[] = [];
    let currentBalance = 0;
    let cumulativeDeposits = 0;
    let cumulativeInterest = 0;
    let monthsToTarget: number | undefined;

    // Get user's current spending patterns for recommendations
    const spendingAnalysis = await this.analyzeUserSpending(userId);

    // Calculate projections
    for (let month = 1; month <= months; month++) {
      // Add monthly deposit
      currentBalance += monthlyAmount;
      cumulativeDeposits += monthlyAmount;

      // Calculate interest on current balance
      const interestEarned = currentBalance * monthlyInterestRate;
      currentBalance += interestEarned;
      cumulativeInterest += interestEarned;

      projections.push({
        month,
        monthlyDeposit: monthlyAmount,
        interestEarned,
        totalBalance: currentBalance,
        cumulativeDeposits,
        cumulativeInterest
      });

      // Check if target is reached
      if (targetAmount && !monthsToTarget && currentBalance >= targetAmount) {
        monthsToTarget = month;
      }
    }

    const finalBalance = projections[projections.length - 1]?.totalBalance || 0;
    const targetReached = targetAmount ? finalBalance >= targetAmount : false;

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      monthlyAmount,
      spendingAnalysis,
      targetAmount,
      finalBalance,
      monthsToTarget
    });

    return {
      projections,
      summary: {
        totalDeposits: cumulativeDeposits,
        totalInterest: cumulativeInterest,
        finalBalance,
        monthsToTarget,
        targetReached
      },
      recommendations
    };
  }

  /**
   * Calculate how much needs to be saved monthly to reach a target
   */
  async calculateTargetSavings(
    targetAmount: number,
    months: number,
    interestRate: number = 3.5,
    userId: string
  ): Promise<{
    monthlyRequired: number;
    totalDeposits: number;
    totalInterest: number;
    feasibilityAnalysis: string;
  }> {
    const monthlyInterestRate = interestRate / 100 / 12;
    
    // Calculate required monthly payment using compound interest formula
    // FV = PMT * (((1 + r)^n - 1) / r)
    // PMT = FV / (((1 + r)^n - 1) / r)
    
    const compoundFactor = Math.pow(1 + monthlyInterestRate, months);
    const annuityFactor = (compoundFactor - 1) / monthlyInterestRate;
    const monthlyRequired = targetAmount / annuityFactor;
    
    const totalDeposits = monthlyRequired * months;
    const totalInterest = targetAmount - totalDeposits;

    // Analyze user's spending to check feasibility
    const spendingAnalysis = await this.analyzeUserSpending(userId);
    const feasibilityAnalysis = this.analyzeFeasibility(monthlyRequired, spendingAnalysis);

    return {
      monthlyRequired,
      totalDeposits,
      totalInterest,
      feasibilityAnalysis
    };
  }

  /**
   * Analyze user's spending patterns
   */
  private async analyzeUserSpending(userId: string): Promise<{
    averageMonthlySpending: number;
    categoryBreakdown: { [key: string]: number };
    topCategories: string[];
  }> {
    try {
      // Get last 3 months of transactions
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: transactions, error } = await SupabaseService
        .getClient()
        .from('transactions')
        .select('amount, category, description, created_at')
        .eq('user_id', userId)
        .gte('created_at', threeMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error || !transactions?.length) {
        return {
          averageMonthlySpending: 0,
          categoryBreakdown: {},
          topCategories: []
        };
      }

      // Calculate monthly spending
      const totalSpending = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const averageMonthlySpending = totalSpending / 3;

      // Category breakdown
      const categoryBreakdown: { [key: string]: number } = {};
      transactions.forEach(t => {
        const category = t.category || 'Lainnya';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + Math.abs(t.amount);
      });

      // Top categories
      const topCategories = Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category);

      return {
        averageMonthlySpending,
        categoryBreakdown,
        topCategories
      };
    } catch (error) {
      console.error('Error analyzing user spending:', error);
      return {
        averageMonthlySpending: 0,
        categoryBreakdown: {},
        topCategories: []
      };
    }
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(params: {
    monthlyAmount: number;
    spendingAnalysis: any;
    targetAmount?: number;
    finalBalance: number;
    monthsToTarget?: number;
  }): string[] {
    const recommendations: string[] = [];
    const { monthlyAmount, spendingAnalysis, targetAmount, finalBalance, monthsToTarget } = params;

    // Basic recommendations
    if (monthlyAmount < spendingAnalysis.averageMonthlySpending * 0.1) {
      recommendations.push('💡 Coba tingkatkan tabungan menjadi minimal 10% dari pengeluaran bulanan Anda');
    }

    if (monthlyAmount >= spendingAnalysis.averageMonthlySpending * 0.2) {
      recommendations.push('👏 Bagus! Anda sudah menabung lebih dari 20% dari pengeluaran bulanan');
    }

    // Target-specific recommendations
    if (targetAmount && monthsToTarget) {
      recommendations.push(`🎯 Target Anda akan tercapai dalam ${monthsToTarget} bulan`);
    } else if (targetAmount && finalBalance < targetAmount) {
      const shortfall = targetAmount - finalBalance;
      const additionalMonthly = shortfall / 12; // Rough estimate
      recommendations.push(`⚠️ Untuk mencapai target, pertimbangkan menambah Rp ${this.formatRupiah(additionalMonthly)} per bulan`);
    }

    // Spending optimization recommendations
    if (spendingAnalysis.topCategories.length > 0) {
      const topCategory = spendingAnalysis.topCategories[0];
      const categoryAmount = spendingAnalysis.categoryBreakdown[topCategory];
      if (categoryAmount > spendingAnalysis.averageMonthlySpending * 0.3) {
        recommendations.push(`💰 Kategori "${topCategory}" menghabiskan ${((categoryAmount / spendingAnalysis.averageMonthlySpending) * 100).toFixed(0)}% pengeluaran. Pertimbangkan untuk menguranginya`);
      }
    }

    // Interest rate recommendations
    recommendations.push('📈 Pertimbangkan deposito atau reksa dana untuk bunga yang lebih tinggi');
    
    // Emergency fund recommendation
    const emergencyFund = spendingAnalysis.averageMonthlySpending * 6;
    if (finalBalance >= emergencyFund) {
      recommendations.push('✅ Tabungan Anda sudah cukup untuk dana darurat 6 bulan');
    } else {
      recommendations.push(`🚨 Prioritaskan dana darurat: Rp ${this.formatRupiah(emergencyFund)} (6x pengeluaran bulanan)`);
    }

    return recommendations;
  }

  /**
   * Analyze feasibility of monthly savings target
   */
  private analyzeFeasibility(monthlyRequired: number, spendingAnalysis: any): string {
    const spendingRatio = monthlyRequired / spendingAnalysis.averageMonthlySpending;

    if (spendingRatio < 0.1) {
      return '✅ Sangat mudah dicapai - hanya ' + (spendingRatio * 100).toFixed(1) + '% dari pengeluaran bulanan';
    } else if (spendingRatio < 0.2) {
      return '✅ Mudah dicapai - sekitar ' + (spendingRatio * 100).toFixed(1) + '% dari pengeluaran bulanan';
    } else if (spendingRatio < 0.3) {
      return '⚠️ Menantang tapi realistis - ' + (spendingRatio * 100).toFixed(1) + '% dari pengeluaran bulanan';
    } else if (spendingRatio < 0.5) {
      return '⚠️ Cukup sulit - perlu disiplin tinggi (' + (spendingRatio * 100).toFixed(1) + '% dari pengeluaran)';
    } else {
      return '🚨 Sangat sulit dicapai - mungkin perlu perpanjang waktu atau kurangi target';
    }
  }

  /**
   * Format number to Indonesian Rupiah
   */
  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format compact numbers (for large amounts)
   */
  private formatCompactRupiah(amount: number): string {
    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`;
    } else if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)} juta`;
    } else if (amount >= 1000) {
      return `Rp ${(amount / 1000).toFixed(0)} ribu`;
    }
    return this.formatRupiah(amount);
  }
}
