import { Injectable, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { CategoryClassificationService } from '../classification/category-classification.service';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  
  constructor(
    private readonly categoryClassificationService: CategoryClassificationService,
  ) {}
  async parseMessage(message: string, pengirim: string) {
    // Nominal: 5k, 10rb, 12.000, 12.5k, 20000, 15 ribu
    const nominalRegex = /([\d.,]+)\s*(k|rb|ribu|\.000)?/i;
    const match = message.match(nominalRegex);
    if (!match) return null;
    let nominalStr = match[1].replace(/\./g, '').replace(/,/g, '.');
    let nominal = 0;
    if (match[2]) {
      if (/k/i.test(match[2])) {
        nominal = parseFloat(nominalStr) * 1000;
      } else if (/rb|ribu|\.000/i.test(match[2])) {
        nominal = parseFloat(nominalStr) * 1000;
      }
    } else {
      nominal = parseFloat(nominalStr);
      if (nominal < 1000) {
        // Anggap 5 = 5000 jika tidak ada satuan
        nominal = nominal * 1000;
      }
    }
    nominal = Math.round(nominal);
    
    // Deskripsi: hapus nominal dari pesan
    const deskripsi = message.replace(nominalRegex, '').replace(/rp\s*/i, '').trim();
    
    // Kategori otomatis menggunakan AI
    this.logger.log(`Starting AI classification for: "${deskripsi}"`);
    
    let kategori = 'Lainnya';
    try {
      const classificationResult = await this.categoryClassificationService.classifyTransaction(deskripsi);
      kategori = classificationResult.kategori;
      
      this.logger.log(`AI Classification result: ${kategori} (confidence: ${classificationResult.confidence}%) - ${classificationResult.reason}`);
      
      // Log classification result for monitoring
      if (classificationResult.confidence < 60) {
        this.logger.warn(`Low confidence classification (${classificationResult.confidence}%) for "${deskripsi}" -> ${kategori}`);
      }
    } catch (error) {
      this.logger.error('Error in AI classification, using fallback:', error.message);
      kategori = 'Lainnya';
    }
    
    // Format tanggal untuk display di WhatsApp
    const tanggalDisplay = dayjs().format('DD/MM/YYYY');
    // Format tanggal untuk database (ISO format YYYY-MM-DD)
    const tanggalDB = dayjs().format('YYYY-MM-DD');
    const waktu = dayjs().format('HH:mm');
    
    const result = {
      tanggal: tanggalDB, // Simpan format ISO ke database
      tanggalDisplay, // Format tampilan untuk WhatsApp
      waktu,
      deskripsi,
      nominal,
      kategori,
      pengirim,
    };
    
    this.logger.log(`Parse result: ${JSON.stringify(result)}`);
    return result;
  }
}
