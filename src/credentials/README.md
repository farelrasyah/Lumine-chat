# Petunjuk Kredensial Google Sheets

1. Simpan file kredensial Service Account Google Anda sebagai `credentials.json` di folder ini (`src/credentials/`).
2. Pastikan `.env` Anda mengarah ke file ini:
   
   ```env
   GOOGLE_SHEET_CREDENTIALS_PATH=src/credentials/credentials.json
   ```
3. Email Service Account (`lumine-sheet-bot@lumine-chat.iam.gserviceaccount.com`) sudah di-share ke Google Sheet target.
