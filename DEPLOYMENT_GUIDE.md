# 🚀 DEPLOYMENT GUIDE - Render.com

Deploy bot WhatsApp Lumine ke Render.com untuk hidup 24/7 tanpa perlu menjalankan di lokal.

## 📋 PRASYARAT

### 1. Persiapan Repository
- ✅ Bot sudah berjalan sempurna di lokal
- ✅ Repository sudah di-push ke GitHub
- ✅ Environment variables sudah diidentifikasi

### 2. Akun dan API Keys
- 🔑 **Google Gemini API Key**: [Get API Key](https://makersuite.google.com/app/apikey)
- 🗄️ **Supabase Project**: URL + Anon Key dari dashboard
- 📊 **Google Sheets**: Service Account credentials
- 🌐 **Render.com Account**: [Sign up](https://render.com/)

## 🛠️ LANGKAH DEPLOYMENT

### STEP 1: Setup Repository di GitHub

1. **Push semua perubahan ke GitHub**:
```bash
git add .
git commit -m "feat: add Render deployment configuration"
git push origin main
```

2. **Pastikan file berikut ada di repo**:
- ✅ `render.yaml` - Konfigurasi deployment
- ✅ `Dockerfile` - Container configuration
- ✅ `.env.example` - Template environment variables
- ✅ `src/health/` - Health check services

### STEP 2: Koneksi Repository ke Render

1. **Login ke Render.com**
   - Buka [render.com](https://render.com/)
   - Sign up/Login dengan GitHub

2. **Create New Service**
   - Klik "New +" → "Background Worker"
   - Select repository: `farelrasyah/Lumine-chat`
   - Branch: `main`

### STEP 3: Konfigurasi Background Worker (Main Bot)

#### Basic Settings:
- **Name**: `lumine-chat-bot`
- **Region**: `Singapore` (recommended untuk Indonesia)
- **Branch**: `main`
- **Runtime**: `Node`

#### Build & Deploy:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

#### Advanced Settings:
- **Plan**: `Starter` atau `Standard` (recommended)
- **Auto-Deploy**: `Yes` 
- **Health Check Path**: `/health` (opsional)

### STEP 4: Environment Variables

Tambahkan semua environment variables di Render dashboard:

#### 🔐 Required Variables:
```bash
# Application
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta

# AI API
AI_API_KEY=your_google_gemini_api_key_here

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here

# Google Sheets
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SHEET_CREDENTIALS_PATH=src/credentials/credentials.json
```

#### 📝 Cara Menambahkan di Render:
1. Buka service dashboard
2. Go to "Environment" tab
3. Klik "Add Environment Variable"
4. Input key dan value
5. Save changes

### STEP 5: Google Sheets Credentials

#### Option A: Encode credentials sebagai environment variable
1. **Encode file credentials.json**:
```bash
# Di lokal, encode file credentials
base64 -i src/credentials/credentials.json > credentials-base64.txt
```

2. **Add ke Render env vars**:
```bash
GOOGLE_CREDENTIALS_BASE64=paste_encoded_string_here
```

3. **Update service untuk decode**:
```typescript
// Di constructor SheetService
const credsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
if (credsBase64) {
  const credentials = JSON.parse(Buffer.from(credsBase64, 'base64').toString());
  // Use credentials...
}
```

#### Option B: Build-time file injection
1. Fork repo dan commit credentials.json
2. Gunakan private repository
3. Set build command: `npm install && npm run build`

### STEP 6: Deploy & Monitor

1. **Deploy Service**:
   - Klik "Create Background Worker"
   - Wait for deployment (~5-10 minutes)
   - Monitor logs di "Logs" tab

2. **Check Deployment Status**:
   - ✅ Build successful
   - ✅ Service running
   - ✅ Health check passing
   - ✅ WhatsApp QR code generated

3. **WhatsApp QR Code**:
   - Check logs untuk QR code
   - Scan dengan WhatsApp di HP
   - Bot akan terkoneksi dan siap menerima pesan

### STEP 7: (Optional) Setup Health Check Web Service

Untuk monitoring dan keep-alive yang lebih baik:

1. **Create Web Service** (terpisah):
   - Name: `lumine-chat-health`
   - Build: `npm install && npm run build`
   - Start: `npm run start:health`
   - Plan: `Free`

2. **Environment Variables**:
```bash
NODE_ENV=production
PORT=10000
HEALTH_CHECK_PORT=10000
```

3. **Health Check Path**: `/health`

## 🔧 KONFIGURASI LANJUTAN

### Auto-Restart Configuration
Render otomatis restart service jika crash. Konfigurasi tambahan:

1. **Resource Limits**:
   - Memory: 512MB (Starter) atau 1GB (Standard)
   - CPU: Shared (Starter) atau Dedicated (Standard)

2. **Health Check**:
   - Path: `/health`
   - Interval: 30s
   - Timeout: 5s
   - Retries: 3

### Keep-Alive Service (Anti-Sleep)
Render free tier bisa "sleep" setelah 15 menit idle:

1. **Setup Cron-job.org**:
   - URL: `https://your-app.onrender.com/alive`
   - Interval: Setiap 10 menit

2. **Atau gunakan Uptime Monitor**:
   - UptimeRobot, Pingdom, dll
   - Monitor endpoint `/alive`

### Custom Domain (Optional)
1. Upgrade ke paid plan
2. Add custom domain di settings
3. Update DNS records

## 🔍 VERIFIKASI & TROUBLESHOOTING

### ✅ Checklist Verifikasi

1. **Deployment Success**:
```bash
# Check service status
curl https://your-app.onrender.com/health
```

2. **WhatsApp Connection**:
   - Cek logs untuk QR code
   - Test kirim pesan ke bot
   - Verify response

3. **Database Connection**:
```bash
# Check health endpoint
curl https://your-app.onrender.com/health | jq
```

4. **Memory Usage**:
   - Monitor di Render dashboard
   - Check health endpoint untuk memory stats

### 🐛 Common Issues & Solutions

#### 1. Build Failures
```bash
# Check package.json scripts
npm run build

# Check dependencies
npm audit
npm update
```

#### 2. Environment Variables
- Pastikan semua vars sudah di-set
- Check case sensitivity
- Verify special characters di-escape

#### 3. Memory Issues
- Upgrade ke Starter plan (512MB)
- Monitor memory usage di health endpoint
- Optimize memory-intensive operations

#### 4. WhatsApp Connection Failed
- Check QR code di logs
- Verify phone number format
- Re-scan QR code if expired

#### 5. Database Connection Issues
```bash
# Test Supabase connection
curl -H "Authorization: Bearer YOUR_KEY" \
     "https://your-project.supabase.co/rest/v1/transactions?select=*&limit=1"
```

#### 6. Google Sheets Access
- Verify service account email di-share ke sheet
- Check credentials format
- Test API access manually

### 📊 Monitoring & Logging

#### 1. Render Logs
- Real-time logs di dashboard
- Download logs untuk analisis
- Set log retention

#### 2. Health Monitoring
```bash
# Setup monitoring URLs
https://your-app.onrender.com/health    # Detailed health
https://your-app.onrender.com/alive     # Simple ping  
https://your-app.onrender.com/status    # Basic status
```

#### 3. Performance Monitoring
- Response time tracking
- Memory usage alerts
- Error rate monitoring

### 🚨 Alert Setup

#### 1. Render Notifications
- Email alerts untuk deployment
- Slack/Discord webhooks
- Custom alert conditions

#### 2. External Monitoring
```bash
# UptimeRobot setup
URL: https://your-app.onrender.com/alive
Interval: 5 minutes
Alert: Email, SMS, Slack
```

#### 3. Log-based Alerts
- Error threshold alerts
- Performance degradation
- Resource usage warnings

## 💡 OPTIMISASI PRODUCTION

### 1. Performance Tweaks
```typescript
// Memory optimization
process.setMaxListeners(20);

// Garbage collection hints
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 30000);
}
```

### 2. Error Handling
```typescript
// Graceful error recovery
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Attempt graceful recovery
});
```

### 3. Rate Limiting
```typescript
// WhatsApp message rate limiting
const messageQueue = new Queue({ concurrent: 1 });
```

### 4. Caching Strategy
```typescript
// Cache frequently accessed data
const cache = new Map();
setInterval(() => cache.clear(), 3600000); // Clear every hour
```

## 📈 SCALING OPTIONS

### 1. Horizontal Scaling
- Multiple Background Workers
- Load balancer untuk Web Services
- Database read replicas

### 2. Vertical Scaling
- Upgrade ke Standard/Pro plan
- Dedicated CPU cores
- More memory allocation

### 3. Geographic Distribution
- Multiple regions deployment
- CDN untuk static assets
- Region-based routing

## 🔒 SECURITY BEST PRACTICES

### 1. Environment Variables
- Never commit secrets
- Use Render's secure variable storage
- Rotate API keys regularly

### 2. Network Security
- HTTPS only
- Rate limiting
- Input validation

### 3. Monitoring
- Security event logging
- Anomaly detection
- Regular security audits

## 📞 SUPPORT & RESOURCES

### 1. Render.com Resources
- [Render Docs](https://render.com/docs)
- [Community Forum](https://community.render.com/)
- [Status Page](https://status.render.com/)

### 2. Bot-specific Resources
- Check project README
- WhatsApp API documentation
- NestJS deployment guide

### 3. Getting Help
- Render support tickets
- Community Discord/Telegram
- Stack Overflow dengan tag [render.com]

---

## 🎉 DEPLOYMENT COMPLETE!

Setelah mengikuti semua langkah di atas, bot WhatsApp Lumine Anda akan:

✅ **Berjalan 24/7** di cloud tanpa perlu PC lokal
✅ **Auto-restart** jika terjadi crash  
✅ **Health monitoring** dengan endpoint dedicated
✅ **Scalable** sesuai kebutuhan traffic
✅ **Secure** dengan environment variables terenkripsi
✅ **Monitored** dengan logs dan alerts

**Selamat! Bot Anda sekarang production-ready! 🚀**
