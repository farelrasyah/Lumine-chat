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
    let credentials;
    
    // Try to get credentials from base64 environment variable first (for deployment)
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (credentialsBase64) {
      try {
        const credentialsString = Buffer.from(credentialsBase64, 'base64').toString('utf8');
        credentials = JSON.parse(credentialsString);
        this.logger.log('Google credentials loaded from base64 environment variable');
      } catch (error) {
        this.logger.error('Failed to parse base64 credentials:', error);
        throw new Error('Invalid GOOGLE_CREDENTIALS_BASE64 format');
      }
    } else {
      // Fallback to file-based credentials (for local development)
      const credentialsPath = process.env.GOOGLE_SHEET_CREDENTIALS_PATH || 'src/credentials/credentials.json';
      if (!fs.existsSync(path.resolve(credentialsPath))) {
        throw new Error(`Google credentials not found. Set GOOGLE_CREDENTIALS_BASE64 env variable or ensure file exists at ${credentialsPath}`);
      }
      credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf8'));
      this.logger.log(`Google credentials loaded from file: ${credentialsPath}`);
    }
    
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
