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

export interface TransactionSearchResult {
  transactions: Array<{
    id: string;
    tanggal: string;
    deskripsi: string;
    kategori: string;
    nominal: number;
    pengirim: string;
  }>;
  total: number;
  count: number;
}

export interface TransactionSearchParams {
  keyword: string;
  pengirim?: string;
  limit?: number;
  from?: string;
  to?: string;
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

  async searchTransactions(params: TransactionSearchParams): Promise<TransactionSearchResult> {
    try {
      const { keyword, pengirim, limit = 20, from, to } = params;
      
      // Build query
      let query = SupabaseService.getClient()
        .from('transactions')
        .select('id, tanggal, deskripsi, kategori, nominal, pengirim')
        .order('tanggal', { ascending: false })
        .limit(limit);

      // Add pengirim filter if provided
      if (pengirim) {
        query = query.eq('pengirim', pengirim);
      }

      // Add date range filter if provided
      if (from) {
        query = query.gte('tanggal', from);
      }
      if (to) {
        query = query.lte('tanggal', to);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching transactions:', error);
        return { transactions: [], total: 0, count: 0 };
      }

      if (!data || data.length === 0) {
        return { transactions: [], total: 0, count: 0 };
      }

      // Filter by keyword (case-insensitive search in deskripsi and kategori)
      const keywordLower = keyword.toLowerCase();
      const filteredTransactions = data.filter(transaction => {
        const deskripsi = (transaction.deskripsi || '').toLowerCase();
        const kategori = (transaction.kategori || '').toLowerCase();
        
        return deskripsi.includes(keywordLower) || kategori.includes(keywordLower);
      });

      // Calculate total amount
      const total = filteredTransactions.reduce((sum, transaction) => {
        return sum + Math.abs(transaction.nominal);
      }, 0);

      return {
        transactions: filteredTransactions.map(t => ({
          id: t.id,
          tanggal: t.tanggal,
          deskripsi: t.deskripsi || '',
          kategori: t.kategori || 'Tidak Terkategorisasi',
          nominal: t.nominal,
          pengirim: t.pengirim || ''
        })),
        total,
        count: filteredTransactions.length
      };

    } catch (error) {
      console.error('Error in searchTransactions:', error);
      return { transactions: [], total: 0, count: 0 };
    }
  }
}
