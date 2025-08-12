import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { SupabaseService } from '../supabase/supabase.service';

export interface FinancialReportData {
  transactions: any[];
  period: string;
  totalExpense: number;
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  userId: string;
  userName: string;
}

@Injectable()
export class PdfGeneratorService {
  
  /**
   * Generate financial report PDF
   */
  async generateFinancialReportPdf(reportData: FinancialReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        this.addHeader(doc, reportData);
        
        // Summary Section
        this.addSummarySection(doc, reportData);
        
        // Category Breakdown
        this.addCategoryBreakdown(doc, reportData);
        
        // Transactions Detail
        this.addTransactionDetails(doc, reportData);
        
        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    // Title
    doc.fontSize(24)
       .fillColor('#1a365d')
       .text('LAPORAN KEUANGAN', 50, 50, { align: 'center' });
    
    // Subtitle
    doc.fontSize(16)
       .fillColor('#4a5568')
       .text(`Periode: ${data.period}`, 50, 80, { align: 'center' });

    // User info
    doc.fontSize(12)
       .fillColor('#2d3748')
       .text(`Nama: ${data.userName}`, 50, 110)
       .text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 50, 125);

    // Line separator
    doc.moveTo(50, 150)
       .lineTo(545, 150)
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();
  }

  /**
   * Add summary section
   */
  private addSummarySection(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    let currentY = 170;

    // Summary title
    doc.fontSize(16)
       .fillColor('#1a365d')
       .text('RINGKASAN PENGELUARAN', 50, currentY);

    currentY += 30;

    // Total expense box
    doc.rect(50, currentY, 495, 60)
       .fillAndStroke('#f7fafc', '#e2e8f0');

    doc.fontSize(14)
       .fillColor('#2d3748')
       .text('Total Pengeluaran:', 70, currentY + 15)
       .fontSize(20)
       .fillColor('#e53e3e')
       .text(this.formatRupiah(data.totalExpense), 70, currentY + 35);

    // Statistics
    doc.fontSize(12)
       .fillColor('#4a5568')
       .text(`Jumlah Transaksi: ${data.transactions.length}`, 300, currentY + 15)
       .text(`Rata-rata per transaksi: ${this.formatRupiah(data.totalExpense / data.transactions.length || 0)}`, 300, currentY + 30)
       .text(`Periode: ${data.period}`, 300, currentY + 45);
  }

  /**
   * Add category breakdown
   */
  private addCategoryBreakdown(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    let currentY = 280;

    // Category title
    doc.fontSize(16)
       .fillColor('#1a365d')
       .text('BREAKDOWN PER KATEGORI', 50, currentY);

    currentY += 30;

    // Table header
    doc.rect(50, currentY, 495, 25)
       .fillAndStroke('#4299e1', '#3182ce');

    doc.fontSize(12)
       .fillColor('#ffffff')
       .text('Kategori', 70, currentY + 8)
       .text('Jumlah', 250, currentY + 8)
       .text('Persentase', 400, currentY + 8);

    currentY += 25;

    // Category rows
    data.categoryBreakdown.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? '#f7fafc' : '#ffffff';
      
      doc.rect(50, currentY, 495, 20)
         .fillAndStroke(bgColor, '#e2e8f0');

      doc.fontSize(11)
         .fillColor('#2d3748')
         .text(item.category, 70, currentY + 5)
         .text(this.formatRupiah(item.amount), 250, currentY + 5)
         .text(`${item.percentage.toFixed(1)}%`, 400, currentY + 5);

      currentY += 20;
    });
  }

  /**
   * Add transaction details
   */
  private addTransactionDetails(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    let currentY = 500;

    // Check if we need a new page
    if (currentY + 200 > 750) {
      doc.addPage();
      currentY = 50;
    }

    // Transactions title
    doc.fontSize(16)
       .fillColor('#1a365d')
       .text('DETAIL TRANSAKSI', 50, currentY);

    currentY += 30;

    // Table header
    doc.rect(50, currentY, 495, 25)
       .fillAndStroke('#38a169', '#2f855a');

    doc.fontSize(10)
       .fillColor('#ffffff')
       .text('Tanggal', 60, currentY + 8)
       .text('Deskripsi', 130, currentY + 8)
       .text('Kategori', 300, currentY + 8)
       .text('Nominal', 420, currentY + 8);

    currentY += 25;

    // Transaction rows (show latest 20 transactions)
    const recentTransactions = data.transactions.slice(0, 20);
    
    recentTransactions.forEach((transaction, index) => {
      // Check if we need a new page
      if (currentY > 720) {
        doc.addPage();
        currentY = 50;
        
        // Re-add header on new page
        doc.rect(50, currentY, 495, 25)
           .fillAndStroke('#38a169', '#2f855a');

        doc.fontSize(10)
           .fillColor('#ffffff')
           .text('Tanggal', 60, currentY + 8)
           .text('Deskripsi', 130, currentY + 8)
           .text('Kategori', 300, currentY + 8)
           .text('Nominal', 420, currentY + 8);

        currentY += 25;
      }

      const bgColor = index % 2 === 0 ? '#f7fafc' : '#ffffff';
      
      doc.rect(50, currentY, 495, 20)
         .fillAndStroke(bgColor, '#e2e8f0');

      const tanggal = new Date(transaction.tanggal).toLocaleDateString('id-ID');
      const deskripsi = this.truncateText(transaction.deskripsi, 20);

      doc.fontSize(9)
         .fillColor('#2d3748')
         .text(tanggal, 60, currentY + 5)
         .text(deskripsi, 130, currentY + 5)
         .text(transaction.kategori, 300, currentY + 5)
         .text(this.formatRupiah(transaction.nominal), 420, currentY + 5);

      currentY += 20;
    });

    // Show more transactions note
    if (data.transactions.length > 20) {
      currentY += 10;
      doc.fontSize(10)
         .fillColor('#718096')
         .text(`Menampilkan 20 dari ${data.transactions.length} transaksi terbaru`, 50, currentY, { align: 'center' });
    }
  }

  /**
   * Add footer
   */
  private addFooter(doc: PDFKit.PDFDocument) {
    const pageHeight = doc.page.height;
    
    doc.fontSize(8)
       .fillColor('#718096')
       .text('Generated by Lumine Financial Assistant', 50, pageHeight - 50, { align: 'center' })
       .text(`© ${new Date().getFullYear()} - Laporan ini dibuat secara otomatis`, 50, pageHeight - 35, { align: 'center' });
  }

  /**
   * Format rupiah
   */
  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Truncate text
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get financial data for PDF report
   */
  async getFinancialReportData(userId: string, period: 'today' | 'week' | 'month' = 'month'): Promise<FinancialReportData> {
    let startDate: Date;
    let periodText: string;

    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodText = `Hari ini (${now.toLocaleDateString('id-ID')})`;
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodText = `7 Hari Terakhir (${startDate.toLocaleDateString('id-ID')} - ${now.toLocaleDateString('id-ID')})`;
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodText = `Bulan ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
        break;
    }

    try {
      // Get transactions - filter by 'pengirim' not 'user_id'
      const { data: transactions, error } = await SupabaseService.getClient()
        .from('transactions')
        .select('*')
        .eq('pengirim', userId)
        .gte('tanggal', startDate.toISOString().split('T')[0])
        .order('tanggal', { ascending: false });

      if (error) throw error;

      const validTransactions = transactions || [];
      const totalExpense = validTransactions.reduce((sum, t) => sum + (t.nominal || 0), 0);

      // Category breakdown
      const categoryMap = new Map<string, number>();
      validTransactions.forEach(t => {
        const category = t.kategori || 'Lainnya';
        categoryMap.set(category, (categoryMap.get(category) || 0) + (t.nominal || 0));
      });

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: (amount / totalExpense) * 100
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        transactions: validTransactions,
        period: periodText,
        totalExpense,
        categoryBreakdown,
        userId: userId, // Keep as is for identification
        userName: userId || 'User' // Use full name, not split by @
      };
    } catch (error) {
      throw new Error(`Failed to get financial data: ${error.message}`);
    }
  }

  /**
   * Get financial report data by custom date range
   */
  async getFinancialReportDataByDateRange(
    userId: string, 
    startDate: string, 
    endDate: string, 
    periodLabel: string
  ): Promise<FinancialReportData> {
    try {
      // Get transactions - filter by 'pengirim' not 'user_id'
      const { data: transactions, error } = await SupabaseService.getClient()
        .from('transactions')
        .select('*')
        .eq('pengirim', userId)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;

      const validTransactions = transactions || [];
      const totalExpense = validTransactions.reduce((sum, t) => sum + (t.nominal || 0), 0);

      // Category breakdown
      const categoryMap = new Map<string, number>();
      validTransactions.forEach(t => {
        const category = t.kategori || 'Lainnya';
        categoryMap.set(category, (categoryMap.get(category) || 0) + (t.nominal || 0));
      });

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        transactions: validTransactions,
        period: periodLabel,
        totalExpense,
        categoryBreakdown,
        userId: userId,
        userName: userId || 'User'
      };
    } catch (error) {
      throw new Error(`Failed to get financial data by date range: ${error.message}`);
    }
  }
}