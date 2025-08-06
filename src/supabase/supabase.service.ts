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
console.log('DEBUG SUPABASE_KEY:', SUPABASE_KEY);

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
    if (error) throw error;
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
}
