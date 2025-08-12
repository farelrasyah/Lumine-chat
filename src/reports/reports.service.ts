import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SpendingByCategoryResult {
  labels: string[];
  values: number[];
  total: number;
}

export interface SpendingByCategoryParams {
  from: string;
  to: string;
  pengirim?: string;
}

@Injectable()
export class ReportsService {
  async getSpendingByCategory(params: SpendingByCategoryParams): Promise<SpendingByCategoryResult> {
    try {
      const { from, to, pengirim } = params;
      
      // Build query
      let query = SupabaseService.getClient()
        .from('transactions')
        .select('kategori, nominal')
        .gte('tanggal', from)
        .lte('tanggal', to);

      // Add pengirim filter if provided
      if (pengirim) {
        query = query.eq('pengirim', pengirim);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching spending by category:', error);
        return { labels: [], values: [], total: 0 };
      }

      if (!data || data.length === 0) {
        return { labels: [], values: [], total: 0 };
      }

      // Aggregate by category
      const categoryTotals = new Map<string, number>();
      let grandTotal = 0;

      data.forEach(transaction => {
        const kategori = transaction.kategori || 'Tidak Terkategorisasi';
        const nominal = Math.abs(transaction.nominal); // Use absolute value for expenses
        
        categoryTotals.set(kategori, (categoryTotals.get(kategori) || 0) + nominal);
        grandTotal += nominal;
      });

      // Convert to arrays and sort by value (descending)
      const sortedCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1]);

      const labels = sortedCategories.map(([kategori]) => kategori);
      const values = sortedCategories.map(([, total]) => total);

      return {
        labels,
        values,
        total: grandTotal
      };

    } catch (error) {
      console.error('Error in getSpendingByCategory:', error);
      return { labels: [], values: [], total: 0 };
    }
  }
}
