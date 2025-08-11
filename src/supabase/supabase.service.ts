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

  static async saveMessage(
    userNumber: string, 
    role: 'user' | 'assistant', 
    content: string, 
    replyToId?: string, 
    conversationId?: string, 
    metadata?: any
  ) {
    const client = this.getClient();
    const { error } = await client.from('chat_messages').insert([
      { 
        user_number: userNumber, 
        role, 
        content,
        reply_to_id: replyToId || null,
        conversation_id: conversationId || null,
        metadata: metadata || null
      }
    ]);
    if (error) throw error;
  }

  static async getMessages(userNumber: string, limit = 30) {
    const client = this.getClient();
    const { data, error } = await client
      .from('chat_messages')
      .select('id, role, content, reply_to_id, conversation_id, metadata, created_at')
      .eq('user_number', userNumber)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // === FITUR REPLY DAN THREADING ===
  
  static async saveReplyMessage(
    userNumber: string,
    role: 'user' | 'assistant',
    content: string,
    replyToId: string,
    conversationId?: string,
    metadata?: any
  ) {
    return this.saveMessage(userNumber, role, content, replyToId, conversationId, metadata);
  }

  static async getMessageWithReplies(messageId: string) {
    const client = this.getClient();
    
    // Get the original message
    const { data: originalMessage, error: originalError } = await client
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (originalError) throw originalError;
    
    // Get all replies to this message
    const { data: replies, error: repliesError } = await client
      .from('chat_messages')
      .select('*')
      .eq('reply_to_id', messageId)
      .order('created_at', { ascending: true });
    
    if (repliesError) throw repliesError;
    
    return {
      original: originalMessage,
      replies: replies || []
    };
  }

  static async getConversationMessages(conversationId: string, limit = 50) {
    const client = this.getClient();
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }

  static async createConversationThread(
    userNumber: string,
    initialMessage: string,
    metadata?: any
  ) {
    const client = this.getClient();
    
    // Generate a new conversation ID (you can use crypto.randomUUID() if available)
    const conversationId = crypto.randomUUID();
    
    // Save the initial message with conversation_id
    await this.saveMessage(
      userNumber,
      'user',
      initialMessage,
      undefined,
      conversationId,
      { ...metadata, thread_starter: true }
    );
    
    return conversationId;
  }

  static async updateMessageMetadata(messageId: string, metadata: any) {
    const client = this.getClient();
    const { error } = await client
      .from('chat_messages')
      .update({ metadata })
      .eq('id', messageId);
    
    if (error) throw error;
  }

  static async getMessagesByMetadata(userNumber: string, metadataQuery: any) {
    const client = this.getClient();
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('user_number', userNumber)
      .contains('metadata', metadataQuery)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async getThreadSummary(userNumber: string) {
    const client = this.getClient();
    
    // Get all messages with conversation_id for this user
    const { data, error } = await client
      .from('chat_messages')
      .select('conversation_id, content, created_at, metadata')
      .eq('user_number', userNumber)
      .not('conversation_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Group by conversation_id
    const threads: Record<string, any[]> = {};
    data?.forEach(message => {
      const convId = message.conversation_id;
      if (!threads[convId]) {
        threads[convId] = [];
      }
      threads[convId].push(message);
    });
    
    return threads;
  }

  // === HELPER FUNCTIONS UNTUK REPLY PESAN LAMA ===

  static async findOldMessageByContent(userNumber: string, searchContent: string, daysBack = 7) {
    const client = this.getClient();
    
    // Cari pesan berdasarkan konten dalam X hari terakhir
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysBack);
    
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('user_number', userNumber)
      .ilike('content', `%${searchContent}%`)
      .gte('created_at', dateLimit.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    return data || [];
  }

  static async getRecentMessagesWithIds(userNumber: string, limit = 10) {
    const client = this.getClient();
    
    const { data, error } = await client
      .from('chat_messages')
      .select('id, content, created_at, role, metadata')
      .eq('user_number', userNumber)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }

  static async replyToMessageByIndex(
    userNumber: string,
    messageIndex: number,
    replyContent: string,
    role: 'user' | 'assistant' = 'user',
    metadata?: any
  ) {
    // Ambil pesan terbaru
    const recentMessages = await this.getRecentMessagesWithIds(userNumber, messageIndex + 1);
    
    if (recentMessages.length <= messageIndex) {
      throw new Error(`Message index ${messageIndex} not found. Only ${recentMessages.length} recent messages available.`);
    }
    
    const targetMessage = recentMessages[messageIndex];
    
    return await this.saveReplyMessage(
      userNumber,
      role,
      replyContent,
      targetMessage.id,
      undefined,
      {
        ...metadata,
        replied_to_content: targetMessage.content.substring(0, 50) + '...', // Preview pesan yang di-reply
        reply_delay_minutes: this.calculateMinutesSince(targetMessage.created_at)
      }
    );
  }

  static async searchAndReplyToMessage(
    userNumber: string,
    searchKeyword: string,
    replyContent: string,
    role: 'user' | 'assistant' = 'user',
    metadata?: any
  ) {
    // Cari pesan lama berdasarkan keyword
    const foundMessages = await this.findOldMessageByContent(userNumber, searchKeyword);
    
    if (foundMessages.length === 0) {
      throw new Error(`No messages found containing "${searchKeyword}"`);
    }
    
    // Reply ke pesan pertama yang ditemukan
    const targetMessage = foundMessages[0];
    
    return await this.saveReplyMessage(
      userNumber,
      role,
      replyContent,
      targetMessage.id,
      undefined,
      {
        ...metadata,
        search_keyword: searchKeyword,
        replied_to_content: targetMessage.content.substring(0, 50) + '...',
        reply_delay_minutes: this.calculateMinutesSince(targetMessage.created_at)
      }
    );
  }

  private static calculateMinutesSince(timestamp: string): number {
    const messageTime = new Date(timestamp);
    const now = new Date();
    return Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
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
