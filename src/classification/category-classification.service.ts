import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

export interface ClassificationResult {
  kategori: string;
  confidence: number;
  reason: string;
}

@Injectable()
export class CategoryClassificationService {
  private readonly logger = new Logger(CategoryClassificationService.name);

  // Kategori yang tersedia dalam sistem
  private readonly availableCategories = [
    'Makanan',
    'Transportasi', 
    'Belanja',
    'Hiburan',
    'Kesehatan',
    'Pendidikan',
    'Utilitas',
    'Lainnya'
  ];

  async classifyTransaction(description: string): Promise<ClassificationResult> {
    try {
      this.logger.log(`Attempting to classify: "${description}"`);
      
      const prompt = this.buildClassificationPrompt(description);
      
      const response = await axios.post(
        `${AI_API_URL}?key=${AI_API_KEY}`,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );

      const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) {
        this.logger.warn('No AI response received, falling back to rule-based classification');
        return this.fallbackClassification(description);
      }

      return this.parseAIResponse(aiResponse, description);
      
    } catch (error) {
      this.logger.error('Error in AI classification:', error.message);
      return this.fallbackClassification(description);
    }
  }

  private buildClassificationPrompt(description: string): string {
    return `Kamu adalah ahli klasifikasi transaksi keuangan. Tugasmu adalah menganalisis deskripsi transaksi dan menentukan kategori yang paling tepat.

KATEGORI YANG TERSEDIA:
1. Makanan - makanan, minuman, kuliner, restoran, jajanan, snack
2. Transportasi - kendaraan, bensin, parkir, grab, gojek, ojek, taxi, tol
3. Belanja - pembelian barang, shopping, pakaian, elektronik, kosmetik, kebutuhan rumah tangga
4. Hiburan - film, game, musik, wisata, rekreasi, streaming
5. Kesehatan - obat, dokter, rumah sakit, vitamin, medical check up
6. Pendidikan - buku, kursus, sekolah, pelatihan, seminar
7. Utilitas - listrik, air, internet, pulsa, gas, tagihan
8. Lainnya - jika tidak cocok dengan kategori lainnya

DESKRIPSI TRANSAKSI: "${description}"

Instruksi:
- Analisis deskripsi dengan cermat
- Pilih SATU kategori yang paling relevan
- Berikan tingkat kepercayaan (1-100)
- Berikan alasan singkat

Format respons (HANYA berikan JSON, tanpa teks lain):
{
  "kategori": "nama_kategori",
  "confidence": tingkat_kepercayaan_angka,
  "reason": "alasan_singkat"
}`;
  }

  private parseAIResponse(aiResponse: string, description: string): ClassificationResult {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in AI response');
        return this.fallbackClassification(description);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      if (!parsed.kategori || !this.availableCategories.includes(parsed.kategori)) {
        this.logger.warn(`Invalid category from AI: ${parsed.kategori}`);
        return this.fallbackClassification(description);
      }

      const confidence = Math.min(Math.max(parsed.confidence || 50, 0), 100);

      this.logger.log(`AI Classification: ${parsed.kategori} (${confidence}%) - ${parsed.reason}`);

      return {
        kategori: parsed.kategori,
        confidence: confidence,
        reason: parsed.reason || 'AI classification'
      };

    } catch (error) {
      this.logger.error('Error parsing AI response:', error.message);
      this.logger.debug('AI response was:', aiResponse);
      return this.fallbackClassification(description);
    }
  }

  private fallbackClassification(description: string): ClassificationResult {
    // Rule-based fallback system (enhanced version of current system)
    const desc = description.toLowerCase();
    
    const rules = [
      {
        kategori: 'Makanan',
        keywords: ['makan', 'jajan', 'kopi', 'minum', 'padang', 'bakso', 'nasi', 'martabak', 'sarapan', 'mcd', 'burger', 'pizza', 'cilok', 'sate', 'gado-gado', 'soto', 'rendang', 'gudeg', 'warteg', 'resto', 'cafe', 'warung', 'ayam', 'ikan', 'daging', 'sayur', 'buah', 'kue', 'roti', 'mie', 'sop', 'rujak', 'es', 'jus', 'teh', 'susu'],
        weight: 1
      },
      {
        kategori: 'Transportasi',
        keywords: ['grab', 'gojek', 'ojek', 'angkot', 'bus', 'kereta', 'taksi', 'gocar', 'goride', 'bensin', 'solar', 'bbm', 'parkir', 'tol', 'motor', 'mobil', 'travel', 'damri', 'transjakarta'],
        weight: 1
      },
      {
        kategori: 'Belanja',
        keywords: ['beli', 'belanja', 'shopee', 'tokopedia', 'lazada', 'bukalapak', 'indomaret', 'alfamart', 'supermarket', 'mall', 'toko', 'fashion', 'baju', 'celana', 'sepatu', 'tas', 'hp', 'laptop', 'elektronik', 'gadget', 'kosmetik', 'skincare', 'kursi', 'meja', 'lemari', 'kasur'],
        weight: 1
      },
      {
        kategori: 'Hiburan',
        keywords: ['nonton', 'bioskop', 'game', 'netflix', 'spotify', 'youtube', 'cinema', 'concert', 'konser', 'wisata', 'liburan', 'vacation', 'trip', 'tour', 'museum', 'pantai', 'gunung'],
        weight: 1
      },
      {
        kategori: 'Kesehatan',
        keywords: ['dokter', 'rumah sakit', 'klinik', 'obat', 'vitamin', 'check up', 'medical', 'apotek', 'hospital', 'terapi', 'dental', 'gigi'],
        weight: 1
      },
      {
        kategori: 'Pendidikan',
        keywords: ['buku', 'sekolah', 'kuliah', 'kursus', 'les', 'training', 'seminar', 'workshop', 'edukasi', 'pembelajaran', 'study', 'universitas'],
        weight: 1
      },
      {
        kategori: 'Utilitas',
        keywords: ['listrik', 'air', 'gas', 'internet', 'wifi', 'pulsa', 'token', 'pln', 'pdam', 'telkom', 'indihome', 'tagihan', 'bill', 'cicilan'],
        weight: 1
      }
    ];

    let bestMatch: ClassificationResult = {
      kategori: 'Lainnya',
      confidence: 30,
      reason: 'No matching keywords found'
    };

    for (const rule of rules) {
      const matchedKeywords = rule.keywords.filter(keyword => desc.includes(keyword));
      if (matchedKeywords.length > 0) {
        const confidence = Math.min(60 + (matchedKeywords.length * 10), 90);
        bestMatch = {
          kategori: rule.kategori,
          confidence: confidence,
          reason: `Matched keywords: ${matchedKeywords.join(', ')}`
        };
        break;
      }
    }

    this.logger.log(`Fallback Classification: ${bestMatch.kategori} (${bestMatch.confidence}%) - ${bestMatch.reason}`);
    return bestMatch;
  }
}
