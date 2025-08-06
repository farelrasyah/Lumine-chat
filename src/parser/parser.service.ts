import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';

const kategoriKeywords: Record<string, string[]> = {
  Makanan: ['makan', 'jajan', 'kopi', 'minum', 'padang', 'bakso', 'nasi', 'martabak', 'sarapan', 'mcd', 'burger', 'pizza'],
  Transportasi: ['grab', 'gojek', 'ojek', 'angkot', 'bus', 'kereta', 'taksi', 'gocar', 'goride'],
  Belanja: ['beli', 'belanja', 'shopee', 'tokopedia', 'lazada', 'bukalapak', 'indomaret', 'alfamart'],
  Hiburan: ['nonton', 'bioskop', 'game', 'netflix', 'spotify', 'youtube'],
  Lainnya: [],
};

@Injectable()
export class ParserService {
  parseMessage(message: string, pengirim: string) {
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
    // Kategori otomatis
    let kategori = 'Lainnya';
    for (const [cat, keywords] of Object.entries(kategoriKeywords)) {
      for (const keyword of keywords) {
        if (deskripsi.toLowerCase().includes(keyword)) {
          kategori = cat;
          break;
        }
      }
      if (kategori !== 'Lainnya') break;
    }
    // Format tanggal untuk display di WhatsApp
    const tanggalDisplay = dayjs().format('DD/MM/YYYY');
    // Format tanggal untuk database (ISO format YYYY-MM-DD)
    const tanggalDB = dayjs().format('YYYY-MM-DD');
    const waktu = dayjs().format('HH:mm');
    return {
      tanggal: tanggalDB, // Simpan format ISO ke database
      tanggalDisplay, // Format tampilan untuk WhatsApp
      waktu,
      deskripsi,
      nominal,
      kategori,
      pengirim,
    };
  }
}
