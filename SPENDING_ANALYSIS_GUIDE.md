# 📊 FITUR ANALISIS PENGELUARAN (BOROS/HEMAT)

## 🎯 Fitur yang Ditambahkan

✅ **Deteksi Otomatis**: Bot mendeteksi pertanyaan tentang pola pengeluaran  
✅ **Multi-Timeframe**: Mendukung analisis harian, mingguan, bulanan, tahunan  
✅ **Analisis Mendalam**: Threshold spending, perbandingan historis, breakdown kategori  
✅ **Rekomendasi Personal**: Insights dan tips berdasarkan data pengeluaran  

## 🧪 CARA TESTING

### **1. Pertanyaan Boros/Hemat**
```
@lumine apakah aku boros bulan ini?
@lumine aku hemat tidak minggu ini?
@lumine pola pengeluaran ku hari ini bagaimana?
@lumine spending saya tahun ini gimana?
```

**Expected Result:**
```
📊 Analisis Pengeluaran Bulanan

💰 Total: Rp 1.234.567
📈 Status: 🟡 Sedang (↑15% dari biasanya)

📂 Breakdown Kategori:
• Makan: Rp 500.000 (40%)
• Transport: Rp 300.000 (24%)
• Hiburan: Rp 200.000 (16%)

💡 Insights & Rekomendasi:

⚖️ Pengeluaran Sedang: Pola pengeluaran Anda cukup wajar.

📊 Ada sedikit peningkatan dari biasanya. Tetap waspada dan pantau terus.

🎯 Fokus Kategori: 40% pengeluaran Anda pada "Makan". Pertimbangkan meal prep atau masak di rumah untuk menghemat.

📝 Tips:
• Catat semua pengeluaran untuk tracking yang lebih baik
• Set budget bulanan dan pantau progress
• Review pengeluaran mingguan untuk evaluasi cepat
```

### **2. Analisis Berdasarkan Timeframe**

#### **Harian:**
```
@lumine boros tidak aku hari ini?
@lumine pengeluaran harian ku gimana?
```

#### **Mingguan:**
```
@lumine aku hemat minggu ini?
@lumine spending this week bagaimana?
```

#### **Bulanan:**
```
@lumine apakah aku boros bulan ini?
@lumine pengeluaran bulanan ku tinggi tidak?
```

#### **Tahunan:**
```
@lumine pola keuangan ku tahun ini?
@lumine spending pattern yearly gimana?
```

### **3. Variasi Pertanyaan yang Didukung**

**Personal Pronouns:**
- aku boros, saya hemat, ku pengeluaran, gue spending
- keuangan ku, finansial saya, my spending

**Keywords yang Dideteksi:**
- boros, pemborosan, terlalu banyak, kebanyakan
- hemat, irit, berhemat, mengirit
- over budget, under budget, budget aman
- pola pengeluaran, analisis pengeluaran

## 📊 FITUR ANALISIS

### **1. Spending Levels**
- 🔴 **Tinggi**: Di atas threshold tinggi
- 🟡 **Sedang**: Dalam range normal
- 🟢 **Rendah**: Pengeluaran terkontrol

### **2. Threshold Default (Dapat disesuaikan)**
- **Harian**: Tinggi: 100k, Sedang: 50k, Rendah: 25k
- **Mingguan**: Tinggi: 500k, Sedang: 250k, Rendah: 100k  
- **Bulanan**: Tinggi: 2M, Sedang: 1M, Rendah: 500k
- **Tahunan**: Tinggi: 20M, Sedang: 10M, Rendah: 5M

### **3. Historical Comparison**
- **Harian**: Dibandingkan dengan 7 hari terakhir
- **Mingguan**: Dibandingkan dengan 4 minggu terakhir
- **Bulanan**: Dibandingkan dengan 3 bulan terakhir
- **Tahunan**: Dibandingkan dengan 2 tahun terakhir

### **4. Category-Specific Advice**
- **Makan**: Saran meal prep, masak di rumah
- **Transport**: Saran transportasi publik
- **Hiburan**: Cari alternatif ekonomis
- **Belanja**: Stick to budget
- **Kesehatan**: Cost-effective options

## 🐛 DEBUGGING

### **Check Console Logs:**
```
DEBUG: Spending analysis - timeframe: monthly, startDate: 2025-08-01, endDate: 2025-08-11
DEBUG: Total spending: 1234567, transactions: 15
Spending Analysis Q: apakah aku boros bulan ini?
A: [Full analysis response]
```

### **Jika Tidak Terdeteksi:**
1. **Pastikan menggunakan keyword yang tepat**
2. **Tambahkan timeframe** (hari ini, minggu ini, bulan ini)
3. **Gunakan personal pronoun** (aku, saya, ku)

### **Test Database Connection:**
```
@lumine total pengeluaran bulan ini
[Should return some data first before testing analysis]
```

## 🎯 TESTING SEQUENCE

```bash
# 1. Pastikan ada data transaksi
@lumine beli makan 50000
@lumine bayar transport 25000

# 2. Test analisis
@lumine apakah aku boros hari ini?

# 3. Test timeframe lain
@lumine pola pengeluaran ku minggu ini?

# 4. Test dengan keyword berbeda
@lumine aku hemat tidak bulan ini?

# 5. Check logs untuk debug
```

## ⚡ RESTART & TEST

```bash
# Restart bot
npm run start

# Test immediately
@lumine apakah aku boros bulan ini?
```

Bot sekarang akan memberikan **analisis mendalam** tentang pola pengeluaran Anda! 📊💡
