export interface TransactionData {
  tanggal: string; // Format ISO YYYY-MM-DD untuk database
  tanggalDisplay?: string; // Format DD/MM/YYYY untuk tampilan WhatsApp
  waktu: string;
  deskripsi: string;
  nominal: number;
  kategori: string;
  pengirim: string;
  source?: string;
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string;

console.log('DEBUG SUPABASE_URL:', SUPABASE_URL);
console.log('DEBUG SUPABASE_KEY length:', SUPABASE_KEY ? SUPABASE_KEY.length : 'undefined');
console.log('DEBUG SUPABASE_KEY first 10 chars:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 10) + '...' : 'undefined');

export class SupabaseService {
  private static client: SupabaseClient;

  static getClient(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return this.client;
  }

  static async saveTransaction(data: TransactionData) {
    const client = this.getClient();
    console.log('DEBUG saveTransaction - Attempting to save:', data);
    
    const { error } = await client.from('transactions').insert([
      {
        tanggal: data.tanggal,
        waktu: data.waktu,
        deskripsi: data.deskripsi,
        nominal: data.nominal,
        kategori: data.kategori,
        pengirim: data.pengirim,
        source: data.source || 'whatsapp',
      },
    ]);
    
    console.log('DEBUG saveTransaction - Insert result, error:', error);
    
    if (error) {
      console.error('DEBUG saveTransaction - Insert failed:', error);
      throw error;
    }
    
    // After successful insert, try to read back to verify
    console.log('DEBUG saveTransaction - Verifying insert by reading back...');
    const verification = await client
      .from('transactions')
      .select('*')
      .eq('pengirim', data.pengirim)
      .eq('deskripsi', data.deskripsi)
      .limit(1);
      
    console.log('DEBUG saveTransaction - Verification read result:', verification);
  }

  static async saveMessage(userNumber: string, role: 'user' | 'assistant', content: string) {
    const client = this.getClient();
    const { error } = await client.from('chat_messages').insert([
      { user_number: userNumber, role, content }
    ]);
    if (error) throw error;
  }

  static async getMessages(userNumber: string, limit = 30) {
    const client = this.getClient();
    const { data, error } = await client
      .from('chat_messages')
      .select('role, content')
      .eq('user_number', userNumber)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // === FITUR QUERY KEUANGAN ===

  static async getTotalTransactions(pengirim: string, startDate?: string, endDate?: string, kategori?: string) {
    const client = this.getClient();
    let query = client
      .from('transactions')
      .select('nominal')
      .eq('pengirim', pengirim);

    console.log('DEBUG getTotalTransactions params:', { pengirim, startDate, endDate, kategori });

    if (startDate) {
      query = query.gte('tanggal', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
    }
    if (kategori) {
      query = query.ilike('kategori', `%${kategori}%`);
    }

    const { data, error } = await query;
    console.log('DEBUG getTotalTransactions result:', { data, error });
    
    if (error) throw error;
    
    const total = data?.reduce((sum, transaction) => sum + transaction.nominal, 0) || 0;
    console.log('DEBUG getTotalTransactions total:', total);
    return total;
  }

  static async getLastTransaction(pengirim: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('pengirim', pengirim)
      .order('tanggal', { ascending: false })
      .order('waktu', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return data?.[0] || null;
  }

  static async getBiggestTransaction(pengirim: string, startDate?: string, endDate?: string) {
    const client = this.getClient();
    let query = client
      .from('transactions')
      .select('*')
      .eq('pengirim', pengirim);

    if (startDate) {
      query = query.gte('tanggal', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
    }

    const { data, error } = await query
      .order('nominal', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return data?.[0] || null;
  }

  static async getTransactionHistory(pengirim: string, startDate?: string, endDate?: string, limit = 5) {
    const client = this.getClient();
    let query = client
      .from('transactions')
      .select('*')
      .eq('pengirim', pengirim);

    if (startDate) {
      query = query.gte('tanggal', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
    }

    const { data, error } = await query
      .order('tanggal', { ascending: false })
      .order('waktu', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }

  static async getTransactionsByCategory(pengirim: string, kategori: string, startDate?: string, endDate?: string) {
    const client = this.getClient();
    let query = client
      .from('transactions')
      .select('*')
      .eq('pengirim', pengirim)
      .ilike('kategori', `%${kategori}%`);

    if (startDate) {
      query = query.gte('tanggal', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
    }

    const { data, error } = await query
      .order('tanggal', { ascending: false })
      .order('waktu', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async getTransactionSummaryByCategory(pengirim: string, startDate?: string, endDate?: string) {
    const client = this.getClient();
    
    console.log('DEBUG getTransactionSummaryByCategory params:', { pengirim, startDate, endDate });
    console.log('DEBUG Environment check - SUPABASE_URL exists:', !!SUPABASE_URL);
    console.log('DEBUG Environment check - SUPABASE_KEY exists:', !!SUPABASE_KEY);
    
    let query = client
      .from('transactions')
      .select('kategori, nominal')
      .eq('pengirim', pengirim);

    if (startDate) {
      query = query.gte('tanggal', startDate);
      console.log('DEBUG Applied startDate filter:', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
      console.log('DEBUG Applied endDate filter:', endDate);
    }

    const { data, error } = await query;
    console.log('DEBUG getTransactionSummaryByCategory result:', { data, error });
    console.log('DEBUG Raw query result - data length:', data?.length || 0);
    console.log('DEBUG Raw query result - first 3 items:', data?.slice(0, 3) || []);
    
    if (error) {
      console.error('DEBUG getTransactionSummaryByCategory error:', error);
      throw error;
    }
    
    // Group by kategori and sum nominal
    const summary: Record<string, number> = {};
    data?.forEach(transaction => {
      const kategori = transaction.kategori || 'Lainnya';
      summary[kategori] = (summary[kategori] || 0) + transaction.nominal;
    });
    
    console.log('DEBUG getTransactionSummaryByCategory summary:', summary);
    console.log('DEBUG Number of categories found:', Object.keys(summary).length);
    console.log('DEBUG Total transactions processed:', data?.length || 0);
    
    return summary;
  }

  static async debugAllTransactions(pengirim: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('pengirim', pengirim);
    
    console.log('DEBUG debugAllTransactions for pengirim:', pengirim);
    console.log('DEBUG debugAllTransactions result count:', data?.length || 0);
    console.log('DEBUG debugAllTransactions first few records:', data?.slice(0, 3) || []);
    console.log('DEBUG debugAllTransactions error:', error);
    
    return data || [];
  }

  static async getAllUniquePengirimValues() {
    const client = this.getClient();
    console.log('DEBUG getAllUniquePengirimValues - Starting query...');
    console.log('DEBUG Environment check - SUPABASE_URL:', SUPABASE_URL ? 'exists' : 'missing');
    console.log('DEBUG Environment check - SUPABASE_KEY:', SUPABASE_KEY ? 'exists' : 'missing');
    
    // First, try to get ANY data from the table to verify table exists
    console.log('DEBUG Testing table access with simple select...');
    const testQuery = await client
      .from('transactions')
      .select('*')
      .limit(5);
    
    console.log('DEBUG Simple test query result:', testQuery);
    
    // Try different possible table names
    const possibleTableNames = ['transactions', 'transaction', 'Transactions', 'public.transactions'];
    
    for (const tableName of possibleTableNames) {
      console.log(`DEBUG Testing table name: "${tableName}"`);
      try {
        const testResult = await client
          .from(tableName)
          .select('*')
          .limit(1);
        
        console.log(`DEBUG Table "${tableName}" result:`, testResult);
        
        if (testResult.data && testResult.data.length > 0) {
          console.log(`DEBUG Found data in table: "${tableName}"`);
          break;
        }
      } catch (error) {
        console.log(`DEBUG Error testing table "${tableName}":`, error);
      }
    }
    
    const { data, error } = await client
      .from('transactions')
      .select('pengirim')
      .limit(1000); // Reasonable limit to avoid performance issues
    
    console.log('DEBUG getAllUniquePengirimValues - Query completed');
    console.log('DEBUG getAllUniquePengirimValues - Raw data:', data);
    console.log('DEBUG getAllUniquePengirimValues - Error:', error);
    console.log('DEBUG getAllUniquePengirimValues - Data length:', data?.length || 0);
    
    if (error) {
      console.error('DEBUG getAllUniquePengirimValues error:', error);
      return [];
    }
    
    // Get unique pengirim values
    const uniquePengirim = [...new Set(data?.map(t => t.pengirim) || [])];
    console.log('DEBUG All unique pengirim values in database:', uniquePengirim);
    
    return uniquePengirim;
  }

  // === BUDGET MANAGEMENT FUNCTIONS ===
  
  static async saveBudget(data: {
    pengirim: string;
    kategori: string;
    limit: number;
    periode: string;
    bulan: string;
  }) {
    const client = this.getClient();
    console.log('DEBUG saveBudget - Attempting to save:', data);
    
    // Check if budget already exists for this pengirim, kategori, and bulan
    const { data: existing, error: checkError } = await client
      .from('budgets')
      .select('*')
      .eq('pengirim', data.pengirim)
      .eq('kategori', data.kategori)
      .eq('bulan', data.bulan)
      .limit(1);
    
    console.log('DEBUG saveBudget - Existing budget check:', { existing, checkError });
    
    if (checkError) {
      console.error('DEBUG saveBudget - Check existing failed:', checkError);
      throw checkError;
    }
    
    let result;
    if (existing && existing.length > 0) {
      // Update existing budget
      console.log('DEBUG saveBudget - Updating existing budget with ID:', existing[0].id);
      result = await client
        .from('budgets')
        .update({
          limit: data.limit,
          periode: data.periode,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing[0].id);
    } else {
      // Insert new budget
      console.log('DEBUG saveBudget - Inserting new budget');
      result = await client.from('budgets').insert([{
        pengirim: data.pengirim,
        kategori: data.kategori,
        limit: data.limit,
        periode: data.periode,
        bulan: data.bulan,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
    }
    
    console.log('DEBUG saveBudget - Operation result:', result);
    
    if (result.error) {
      console.error('DEBUG saveBudget - Operation failed:', result.error);
      throw result.error;
    }
    
    return result;
  }

  static async getBudget(pengirim: string, kategori?: string, bulan?: string) {
    const client = this.getClient();
    console.log('DEBUG getBudget params:', { pengirim, kategori, bulan });
    
    let query = client
      .from('budgets')
      .select('*')
      .eq('pengirim', pengirim);
    
    if (kategori) {
      query = query.ilike('kategori', `%${kategori}%`);
    }
    if (bulan) {
      query = query.eq('bulan', bulan);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    console.log('DEBUG getBudget result:', { data, error });
    
    if (error) {
      console.error('DEBUG getBudget failed:', error);
      throw error;
    }
    
    return data || [];
  }

  static async getAllBudgets(pengirim: string, bulan?: string) {
    const client = this.getClient();
    console.log('DEBUG getAllBudgets params:', { pengirim, bulan });
    
    let query = client
      .from('budgets')
      .select('*')
      .eq('pengirim', pengirim);
    
    if (bulan) {
      query = query.eq('bulan', bulan);
    }
    
    const { data, error } = await query.order('kategori');
    
    console.log('DEBUG getAllBudgets result:', { data, error });
    
    if (error) {
      console.error('DEBUG getAllBudgets failed:', error);
      throw error;
    }
    
    return data || [];
  }

  static async deleteBudget(pengirim: string, kategori?: string, bulan?: string) {
    const client = this.getClient();
    console.log('DEBUG deleteBudget params:', { pengirim, kategori, bulan });
    
    let query = client
      .from('budgets')
      .delete()
      .eq('pengirim', pengirim);
    
    if (kategori) {
      query = query.ilike('kategori', `%${kategori}%`);
    }
    if (bulan) {
      query = query.eq('bulan', bulan);
    }
    
    const { error } = await query;
    
    console.log('DEBUG deleteBudget result error:', error);
    
    if (error) {
      console.error('DEBUG deleteBudget failed:', error);
      throw error;
    }
    
    return true;
  }

  static async checkBudgetOverage(pengirim: string, kategori: string, bulan: string) {
    const client = this.getClient();
    console.log('DEBUG checkBudgetOverage params:', { pengirim, kategori, bulan });
    
    // Get budget for this category and month
    const { data: budgetData, error: budgetError } = await client
      .from('budgets')
      .select('limit')
      .eq('pengirim', pengirim)
      .ilike('kategori', `%${kategori}%`)
      .eq('bulan', bulan)
      .limit(1);
    
    console.log('DEBUG checkBudgetOverage - Budget data:', { budgetData, budgetError });
    
    if (budgetError || !budgetData || budgetData.length === 0) {
      console.log('DEBUG checkBudgetOverage - No budget found for this category');
      return null; // No budget set for this category
    }
    
    const budgetLimit = budgetData[0].limit;
    
    // Get total expenses for this category and month
    const startDate = `${bulan}-01`;
    const endDate = `${bulan}-31`; // Simplified, could use dayjs for exact month end
    
    const totalSpent = await this.getTotalTransactions(pengirim, startDate, endDate, kategori);
    
    console.log('DEBUG checkBudgetOverage - Budget limit:', budgetLimit, 'Total spent:', totalSpent);
    
    return {
      kategori,
      budgetLimit,
      totalSpent,
      remaining: budgetLimit - totalSpent,
      isOverBudget: totalSpent > budgetLimit,
      percentageUsed: Math.round((totalSpent / budgetLimit) * 100)
    };
  }

  // Test function untuk debugging koneksi
  static async testSupabaseConnection() {
    console.log('=== TESTING SUPABASE CONNECTION ===');
    const client = this.getClient();
    
    // Test 1: Simple ping
    try {
      console.log('Test 1: Basic connection test...');
      const { data, error } = await client.from('transactions').select('count').limit(1);
      console.log('Basic connection result:', { data, error });
    } catch (err) {
      console.error('Basic connection failed:', err);
    }
    
    // Test 2: Check if table exists
    try {
      console.log('Test 2: Check table schema...');
      const { data, error } = await client.rpc('version'); // Built-in function
      console.log('Version check result:', { data, error });
    } catch (err) {
      console.error('Version check failed:', err);
    }
    
    // Test 3: Try to create a test transaction
    try {
      console.log('Test 3: Insert test data...');
      const testData = {
        tanggal: '2025-08-06',
        waktu: '14:00',
        deskripsi: 'Test transaction',
        nominal: 1000,
        kategori: 'Test',
        pengirim: 'farelrasyah | RPL A',
        source: 'test'
      };
      
      const insertResult = await client.from('transactions').insert([testData]);
      console.log('Insert test result:', insertResult);
      
      // Try to read it back
      const readResult = await client
        .from('transactions')
        .select('*')
        .eq('deskripsi', 'Test transaction')
        .limit(1);
      console.log('Read test result:', readResult);
      
      // Clean up test data
      if (readResult.data && readResult.data.length > 0) {
        const deleteResult = await client
          .from('transactions')
          .delete()
          .eq('deskripsi', 'Test transaction');
        console.log('Cleanup test result:', deleteResult);
      }
    } catch (err) {
      console.error('Insert/Read test failed:', err);
    }
    
    console.log('=== END CONNECTION TEST ===');
  }
}
