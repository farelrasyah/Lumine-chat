# Integrasi Google Sheets Lumine

## Cara Kerja
- Parsing pesan WhatsApp menggunakan `ParserService` (ekstraksi deskripsi, nominal, kategori, dll)
- Data dikirim ke Google Sheets menggunakan `SheetService`

## Struktur Data
| Tanggal | Waktu | Deskripsi | Nominal (Rp) | Kategori | Pengirim |

## Cara Pakai
1. Pastikan `.env` sudah diisi:
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SHEET_CREDENTIALS_PATH`
2. Masukkan file kredensial Service Account ke `src/credentials/credentials.json`
3. Install dependency:
   ```bash
   npm install googleapis dayjs
   ```
4. Inject dan panggil service di handler WhatsApp Anda:
   ```ts
   const parsed = parserService.parseMessage(pesan, pengirim);
   if (parsed) await sheetService.appendTransaction(parsed);
   ```

## Catatan
- Parsing mendukung format: `5k`, `10rb`, `12.000`, `15 ribu`, dll
- Jika parsing gagal (nominal tidak ditemukan), data tidak dikirim ke Google Sheets
- Kategori otomatis berdasarkan kata kunci
