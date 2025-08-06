import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as dayjs from 'dayjs';
import * as path from 'path';

@Injectable()
export class SheetService {
  private sheets: sheets_v4.Sheets;
  private sheetId: string;
  private sheetName = 'Rekap Keuangan';
  private logger = new Logger(SheetService.name);

  constructor() {
    // Path credentials bisa diatur lewat env, default ke src/credentials/credentials.json
    const credentialsPath = process.env.GOOGLE_SHEET_CREDENTIALS_PATH || 'src/credentials/credentials.json';
    if (!fs.existsSync(path.resolve(credentialsPath))) {
      throw new Error(`Google credentials file not found at ${credentialsPath}. Set GOOGLE_SHEET_CREDENTIALS_PATH env variable if you move the file.`);
    }
    const credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf8'));
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }
    this.sheetId = sheetId;
  }

  async appendTransaction(data: {
    tanggal: string;
    tanggalDisplay?: string;
    waktu: string;
    deskripsi: string;
    nominal: number;
    kategori: string;
    pengirim: string;
  }): Promise<boolean> {
    try {
      const values = [[
        data.tanggalDisplay || data.tanggal, // Gunakan tanggalDisplay (DD/MM/YYYY) untuk Google Sheets, fallback ke tanggal ISO
        data.waktu,
        data.deskripsi,
        data.nominal,
        data.kategori,
        data.pengirim,
      ]];
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A2:F2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to append to Google Sheets', error);
      return false;
    }
  }
}
