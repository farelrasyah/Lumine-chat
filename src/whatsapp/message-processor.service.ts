import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { SupabaseService } from '../supabase/supabase.service';
dotenv.config();

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private history: Array<{ prompt: string; response: string }> = [];

  async processMessage(msg: any): Promise<{ reply: string | null; log: string }> {
    const text = this.extractText(msg);
    if (!text) return { reply: null, log: '' };
    const match = text.match(/@lumine\b/i);
    if (!match) return { reply: null, log: '' };
    // Remove @lumine (case-insensitive, only 1st occurrence)
    const prompt = text.replace(/@lumine\b/i, '').trim();
    if (!prompt) return { reply: null, log: '' };

    // Ambil nomor user (misal dari msg.key.remoteJid, sesuaikan dengan struktur msg Anda)
    const userNumber = msg.key?.remoteJid || msg.from || 'unknown';
    try {
      // Simpan pesan user ke Supabase
      await SupabaseService.saveMessage(userNumber, 'user', prompt);

      // Ambil seluruh riwayat chat user (limit 30 terakhir, urut kronologis)
      const messages = await SupabaseService.getMessages(userNumber, 30);

      // Format untuk prompt ke AI ala ChatGPT API
      const chatContext = messages.map((m: any) => ({ role: m.role, content: m.content }));
      chatContext.push({ role: 'user', content: prompt });

      // Deteksi pertanyaan tentang identitas/fungsi
      const identitasRegex = /^(siapa|siapakah|siapa kah|apakah|kenapa|apa|tolong)?\s*(kamu|anda|lumine|fungsi(mu)?|tugas(mu)?|siapakah|siapa kah|apakah|peran(mu)?|tentangmu|tentang lumine|who are you|what are you|your function|your role|describe yourself)/i;
      if (identitasRegex.test(prompt)) {
        const personalReply = 'Saya Lumine, asisten pribadi Farel Rasyah, siap membantu berbagai keperluan Anda.';
        await SupabaseService.saveMessage(userNumber, 'assistant', personalReply);
        this.history.push({ prompt, response: personalReply });
        this.logger.log(`Q: ${prompt}\nA: ${personalReply}`);
        return { reply: personalReply, log: `Q: ${prompt}\nA: ${personalReply}` };
      }

      // Kirim konteks chat ke AI
      const aiResponse = await this.queryAIWithContext(chatContext);
      // Bersihkan simbol markdown
      const cleanResponse = this.stripMarkdown(aiResponse);
      await SupabaseService.saveMessage(userNumber, 'assistant', cleanResponse);
      this.history.push({ prompt, response: cleanResponse });
      this.logger.log(`Q: ${prompt}\nA: ${cleanResponse}`);
      return { reply: cleanResponse, log: `Q: ${prompt}\nA: ${cleanResponse}` };
    } catch (e: any) {
      if (e.response && e.response.status === 400) {
        this.logger.error(`AI error (400): ${JSON.stringify(e.response.data)}`);
      } else {
        this.logger.error('AI error detail:', JSON.stringify(e, null, 2));
      }
      throw e;
    }
  }

  extractText(msg: any): string | null {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return null;
  }

  // Fungsi baru: queryAIWithContext menerima array messages ala ChatGPT API
  async queryAIWithContext(messages: { role: string; content: string }[]): Promise<string> {
    // Adaptasi ke format Gemini jika perlu (misal, gabungkan menjadi satu string, atau gunakan sesuai API baru jika tersedia)
    // Untuk Gemini, kita gabungkan semua pesan sebelumnya sebagai konteks
    const contextText = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const res = await axios.post(
      `${AI_API_URL}?key=${AI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: contextText }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }
    );
    // Gemini response: res.data.candidates[0].content.parts[0].text
    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return answer || 'Maaf, tidak ada jawaban.';
  }

  // Fungsi lama tetap ada untuk kompatibilitas jika diperlukan
  async queryAI(prompt: string): Promise<string> {
    const res = await axios.post(
      `${AI_API_URL}?key=${AI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }
    );
    // Gemini response: res.data.candidates[0].content.parts[0].text
    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return answer || 'Maaf, tidak ada jawaban.';
  }

  getHistory() {
    return this.history;
  }

  /**
   * Menghapus simbol markdown dari teks.
   */
  stripMarkdown(text: string): string {
    if (!text) return '';
    // Hapus seluruh simbol markdown dan karakter dekoratif
    return text
      // Hapus seluruh *, **, _, __, ~~, `, >, | secara global
      .replace(/\*\*|\*|__|_|~~|`|>|\|/g, '')
      // Hilangkan link markdown [teks](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Hilangkan gambar markdown ![alt](img)
      .replace(/\!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      // Hilangkan heading markdown
      .replace(/#+\s/g, '')
      // Hilangkan escape backslash
      .replace(/\\/g, '')
      // Normalisasi newline
      .replace(/\r?\n/g, '\n')
      .trim();
  }
}
