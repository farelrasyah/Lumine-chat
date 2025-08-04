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
}
