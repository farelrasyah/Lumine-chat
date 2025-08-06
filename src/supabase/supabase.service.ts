export interface TransactionData {
  tanggal: string;
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
    if (error) throw error;
    
    const total = data?.reduce((sum, transaction) => sum + transaction.nominal, 0) || 0;
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
}
