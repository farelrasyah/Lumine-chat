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
  dateRange?: {
    start: Date;
    end: Date;
  };
}

@Injectable()
export class PdfGeneratorService {
  
  // Modern Color Palette - Professional & Elegant
  private readonly colors = {
    primary: '#1e293b',      // Slate 800 - Primary dark
    secondary: '#0f172a',    // Slate 900 - Deeper dark
    accent: '#3b82f6',       // Blue 500 - Modern blue accent
    success: '#10b981',      // Emerald 500 - Success green
    warning: '#f59e0b',      // Amber 500 - Warning amber
    danger: '#ef4444',       // Red 500 - Danger red
    surface: '#f8fafc',      // Slate 50 - Light surface
    border: '#e2e8f0',       // Slate 200 - Subtle border
    text: {
      primary: '#0f172a',    // Slate 900 - Primary text
      secondary: '#475569',  // Slate 600 - Secondary text
      muted: '#94a3b8',      // Slate 400 - Muted text
      white: '#ffffff'       // White text for dark backgrounds
    },
    gradient: {
      primary: '#3b82f6',    // Blue 500
      secondary: '#8b5cf6'   // Violet 500
    }
  };

  // Premium Typography System
  private readonly fonts = {
    heading: 'Helvetica-Bold',
    subheading: 'Helvetica',
    body: 'Helvetica',
    monospace: 'Courier'
  };

  /**
   * Generate professional financial report PDF with modern design
   */
  async generateFinancialReportPdf(reportData: FinancialReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 0,  // Custom margins for full control
          bufferPages: true
        });
        
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Page setup and background
        this.setupPage(doc);
        
        // Hero Header Section
        this.addHeroHeader(doc, reportData);
        
        // Executive Summary Card
        this.addExecutiveSummary(doc, reportData);
        
        // Category Breakdown with Visual Chart
        this.addCategoryBreakdownSection(doc, reportData);
        
        // Transaction Analysis Table
        this.addTransactionAnalysis(doc, reportData);
        
        // Add new page if needed for transaction details
        if (reportData.transactions.length > 0) {
          doc.addPage();
          this.setupPage(doc);
          this.addTransactionDetails(doc, reportData);
        }
        
        // Professional Footer on all pages
        this.addProfessionalFooter(doc, reportData);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup page with premium background and grid
   */
  private setupPage(doc: PDFKit.PDFDocument) {
    // Clean white background
    doc.rect(0, 0, 595, 842).fill('#ffffff');
    
    // Subtle grid pattern for professional look
    doc.strokeColor(this.colors.border);
    doc.lineWidth(0.5);
    
    // Vertical guide lines (invisible but helpful for alignment)
    const margin = 40;
    doc.moveTo(margin, 0).lineTo(margin, 842).stroke(); // Left margin
    doc.moveTo(555, 0).lineTo(555, 842).stroke(); // Right margin
  }

  /**
   * Modern hero header with gradient background
   */
  private addHeroHeader(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    // Hero background with subtle gradient effect
    doc.rect(0, 0, 595, 120)
       .fill(this.colors.primary);
    
    // Accent stripe
    doc.rect(0, 115, 595, 5)
       .fill(this.colors.accent);

    // Company/App branding
    doc.fontSize(12)
       .fillColor(this.colors.text.white)
       .font(this.fonts.body)
       .text('LUMINE FINANCIAL ASSISTANT', 50, 25, { align: 'right' });

    // Main title
    doc.fontSize(32)
       .fillColor(this.colors.text.white)
       .font(this.fonts.heading)
       .text('LAPORAN KEUANGAN', 50, 45);
    
    // Subtitle with period
    doc.fontSize(16)
       .fillColor(this.colors.text.white)
       .font(this.fonts.body)
       .text(data.period, 50, 85);

    // User info badge
    const userBadgeX = 400;
    const userBadgeY = 25;
    
    doc.rect(userBadgeX, userBadgeY, 145, 25)
       .fill(this.colors.accent);
    
    doc.fontSize(12)
       .fillColor(this.colors.text.white)
       .font(this.fonts.body)
       .text(data.userName, userBadgeX + 10, userBadgeY + 8);

    // Generation date
    doc.fontSize(10)
       .fillColor(this.colors.text.white)
       .font(this.fonts.body)
       .text(`Generated: ${new Date().toLocaleDateString('id-ID', { 
         day: 'numeric', 
         month: 'long', 
         year: 'numeric' 
       })}`, userBadgeX, userBadgeY + 35);
  }

  /**
   * Executive summary with modern cards
   */
  private addExecutiveSummary(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    const startY = 140;
    
    // Section title
    doc.fontSize(20)
       .fillColor(this.colors.text.primary)
       .font(this.fonts.heading)
       .text('Executive Summary', 50, startY);

    // Summary cards layout
    const cardY = startY + 40;
    const cardWidth = 160;
    const cardHeight = 100;
    const cardSpacing = 15;

    // Card 1: Total Expense
    this.drawSummaryCard(doc, {
      x: 50,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      title: 'Total Pengeluaran',
      value: this.formatRupiah(data.totalExpense),
      color: this.colors.danger,
      icon: '💰'
    });

    // Card 2: Transaction Count
    this.drawSummaryCard(doc, {
      x: 50 + cardWidth + cardSpacing,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      title: 'Transaksi',
      value: data.transactions.length.toString(),
      color: this.colors.accent,
      icon: '📊'
    });

    // Card 3: Average per Transaction
    const avgPerTransaction = data.transactions.length > 0 ? 
      data.totalExpense / data.transactions.length : 0;
    
    this.drawSummaryCard(doc, {
      x: 50 + (cardWidth + cardSpacing) * 2,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      title: 'Rata-rata/Transaksi',
      value: this.formatRupiahCompact(avgPerTransaction),
      color: this.colors.success,
      icon: '📈'
    });
  }

  /**
   * Draw modern summary card
   */
  private drawSummaryCard(doc: PDFKit.PDFDocument, options: {
    x: number, y: number, width: number, height: number,
    title: string, value: string, color: string, icon: string
  }) {
    const { x, y, width, height, title, value, color, icon } = options;

    // Card shadow effect
    doc.rect(x + 2, y + 2, width, height)
       .fill('#00000010');

    // Card background
    doc.rect(x, y, width, height)
       .fill('#ffffff')
       .stroke(this.colors.border);

    // Accent border top
    doc.rect(x, y, width, 4)
       .fill(color);

    // Icon
    doc.fontSize(24)
       .text(icon, x + 15, y + 20);

    // Title
    doc.fontSize(10)
       .fillColor(this.colors.text.secondary)
       .font(this.fonts.body)
       .text(title, x + 15, y + 50);

    // Value
    doc.fontSize(14)
       .fillColor(this.colors.text.primary)
       .font(this.fonts.heading)
       .text(value, x + 15, y + 65, { width: width - 30 });
  }

  /**
   * Category breakdown with visual representation
   */
  private addCategoryBreakdownSection(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    const startY = 280;
    
    // Section title
    doc.fontSize(20)
       .fillColor(this.colors.text.primary)
       .font(this.fonts.heading)
       .text('Breakdown per Kategori', 50, startY);

    // Modern table header
    const tableStartY = startY + 50;
    const tableHeaders = ['Kategori', 'Nominal', 'Persentase', 'Visual'];
    const columnWidths = [150, 120, 80, 145];
    const rowHeight = 35;

    // Header background
    doc.rect(50, tableStartY, 495, rowHeight)
       .fill(this.colors.primary);

    // Header text
    let currentX = 50;
    tableHeaders.forEach((header, index) => {
      doc.fontSize(12)
         .fillColor(this.colors.text.white)
         .font(this.fonts.heading)
         .text(header, currentX + 15, tableStartY + 12);
      currentX += columnWidths[index];
    });

    // Table rows with alternating colors
    let currentY = tableStartY + rowHeight;
    
    data.categoryBreakdown.slice(0, 8).forEach((item, index) => {
      const isEven = index % 2 === 0;
      const bgColor = isEven ? this.colors.surface : '#ffffff';

      // Row background
      doc.rect(50, currentY, 495, rowHeight)
         .fill(bgColor)
         .stroke(this.colors.border);

      currentX = 50;

      // Category name with icon
      const categoryIcon = this.getCategoryIcon(item.category);
      doc.fontSize(11)
         .fillColor(this.colors.text.primary)
         .font(this.fonts.body)
         .text(`${categoryIcon} ${item.category}`, currentX + 15, currentY + 12);
      currentX += columnWidths[0];

      // Amount
      doc.fontSize(11)
         .fillColor(this.colors.text.primary)
         .font(this.fonts.heading)
         .text(this.formatRupiah(item.amount), currentX + 15, currentY + 12);
      currentX += columnWidths[1];

      // Percentage
      doc.fontSize(11)
         .fillColor(this.colors.accent)
         .font(this.fonts.heading)
         .text(`${item.percentage.toFixed(1)}%`, currentX + 15, currentY + 12);
      currentX += columnWidths[2];

      // Visual bar chart
      const barWidth = (item.percentage / 100) * 120;
      const barY = currentY + 15;
      
      // Background bar
      doc.rect(currentX + 15, barY, 120, 8)
         .fill(this.colors.border);
      
      // Progress bar with gradient effect
      if (barWidth > 0) {
        doc.rect(currentX + 15, barY, barWidth, 8)
           .fill(this.getGradientColor(item.percentage));
      }

      currentY += rowHeight;
    });
  }

  /**
   * Transaction analysis with insights
   */
  private addTransactionAnalysis(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    const startY = 550;
    
    // Section title
    doc.fontSize(18)
       .fillColor(this.colors.text.primary)
       .font(this.fonts.heading)
       .text('Analisis Transaksi', 50, startY);

    // Analysis insights boxes
    const insights = this.generateInsights(data);
    const boxY = startY + 40;
    const boxHeight = 60;

    insights.forEach((insight, index) => {
      const boxX = 50 + (index * 165);
      
      // Insight box
      doc.rect(boxX, boxY, 155, boxHeight)
         .fill(insight.color + '20')
         .stroke(insight.color);

      // Insight icon
      doc.fontSize(16)
         .text(insight.icon, boxX + 15, boxY + 10);

      // Insight title
      doc.fontSize(10)
         .fillColor(this.colors.text.secondary)
         .font(this.fonts.body)
         .text(insight.title, boxX + 15, boxY + 30);

      // Insight value
      doc.fontSize(12)
         .fillColor(this.colors.text.primary)
         .font(this.fonts.heading)
         .text(insight.value, boxX + 15, boxY + 42);
    });
  }

  /**
   * Detailed transaction list with modern styling
   */
  private addTransactionDetails(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    const startY = 50;
    
    // Section title
    doc.fontSize(20)
       .fillColor(this.colors.text.primary)
       .font(this.fonts.heading)
       .text('Detail Transaksi Terbaru', 50, startY);

    const tableStartY = startY + 50;
    const tableHeaders = ['Tanggal', 'Deskripsi', 'Kategori', 'Nominal'];
    const columnWidths = [80, 180, 120, 115];
    const rowHeight = 30;

    // Modern header
    doc.rect(50, tableStartY, 495, rowHeight)
       .fill(this.colors.primary);

    let currentX = 50;
    tableHeaders.forEach((header, index) => {
      doc.fontSize(11)
         .fillColor(this.colors.text.white)
         .font(this.fonts.heading)
         .text(header, currentX + 10, tableStartY + 10);
      currentX += columnWidths[index];
    });

    // Transaction rows
    let currentY = tableStartY + rowHeight;
    const recentTransactions = data.transactions.slice(0, 20);
    
    recentTransactions.forEach((transaction, index) => {
      // Check if we need a new page
      if (currentY > 750) {
        doc.addPage();
        this.setupPage(doc);
        currentY = 50;
        
        // Re-add header on new page
        doc.rect(50, currentY, 495, rowHeight)
           .fill(this.colors.primary);

        currentX = 50;
        tableHeaders.forEach((header, idx) => {
          doc.fontSize(11)
             .fillColor(this.colors.text.white)
             .font(this.fonts.heading)
             .text(header, currentX + 10, currentY + 10);
          currentX += columnWidths[idx];
        });

        currentY += rowHeight;
      }

      const isEven = index % 2 === 0;
      const bgColor = isEven ? this.colors.surface : '#ffffff';

      // Row background
      doc.rect(50, currentY, 495, rowHeight)
         .fill(bgColor)
         .stroke(this.colors.border);

      currentX = 50;

      // Date
      const tanggal = new Date(transaction.tanggal).toLocaleDateString('id-ID');
      doc.fontSize(9)
         .fillColor(this.colors.text.primary)
         .font(this.fonts.body)
         .text(tanggal, currentX + 10, currentY + 8);
      currentX += columnWidths[0];

      // Description
      const deskripsi = this.truncateText(transaction.deskripsi, 25);
      doc.fontSize(9)
         .fillColor(this.colors.text.primary)
         .font(this.fonts.body)
         .text(deskripsi, currentX + 10, currentY + 8);
      currentX += columnWidths[1];

      // Category with icon
      const categoryIcon = this.getCategoryIcon(transaction.kategori);
      doc.fontSize(9)
         .fillColor(this.colors.text.secondary)
         .font(this.fonts.body)
         .text(`${categoryIcon} ${transaction.kategori}`, currentX + 10, currentY + 8);
      currentX += columnWidths[2];

      // Amount with color coding
      const amountColor = transaction.nominal > 100000 ? this.colors.danger : 
                         transaction.nominal > 50000 ? this.colors.warning : this.colors.success;
      
      doc.fontSize(10)
         .fillColor(amountColor)
         .font(this.fonts.heading)
         .text(this.formatRupiahCompact(transaction.nominal), currentX + 10, currentY + 8);

      currentY += rowHeight;
    });

    // Summary footer
    if (data.transactions.length > 20) {
      currentY += 15;
      doc.fontSize(10)
         .fillColor(this.colors.text.muted)
         .font(this.fonts.body)
         .text(`Menampilkan 20 dari ${data.transactions.length} transaksi terakhir`, 50, currentY, { align: 'center' });
    }
  }

  /**
   * Professional footer with branding
   */
  private addProfessionalFooter(doc: PDFKit.PDFDocument, data: FinancialReportData) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 60;
    
    // Footer background
    doc.rect(0, footerY, 595, 60)
       .fill(this.colors.surface);

    // Divider line
    doc.moveTo(0, footerY)
       .lineTo(595, footerY)
       .strokeColor(this.colors.border)
       .lineWidth(1)
       .stroke();

    // Left side - Branding
    doc.fontSize(10)
       .fillColor(this.colors.text.secondary)
       .font(this.fonts.heading)
       .text('🤖 LUMINE FINANCIAL ASSISTANT', 50, footerY + 15);

    doc.fontSize(8)
       .fillColor(this.colors.text.muted)
       .font(this.fonts.body)
       .text('Laporan dibuat otomatis dengan teknologi AI', 50, footerY + 30);

    // Right side - Confidentiality notice
    doc.fontSize(8)
       .fillColor(this.colors.text.muted)
       .font(this.fonts.body)
       .text('🔒 Dokumen Rahasia & Pribadi', 400, footerY + 15, { align: 'right' });

    doc.fontSize(8)
       .fillColor(this.colors.text.muted)
       .font(this.fonts.body)
       .text(`© ${new Date().getFullYear()} - Generated on ${new Date().toLocaleDateString('id-ID')}`, 400, footerY + 30, { align: 'right' });
  }

  /**
   * Generate insights from transaction data
   */
  private generateInsights(data: FinancialReportData): Array<{title: string, value: string, icon: string, color: string}> {
    const insights: Array<{title: string, value: string, icon: string, color: string}> = [];

    // Highest expense category
    if (data.categoryBreakdown.length > 0) {
      const topCategory = data.categoryBreakdown[0];
      insights.push({
        title: 'Kategori Tertinggi',
        value: topCategory.category,
        icon: this.getCategoryIcon(topCategory.category),
        color: this.colors.danger
      });
    }

    // Transaction frequency
    const avgPerDay = data.transactions.length / 30; // Assuming monthly data
    insights.push({
      title: 'Frekuensi/Hari',
      value: `${avgPerDay.toFixed(1)}x`,
      icon: '📅',
      color: this.colors.accent
    });

    // Expense trend (simplified)
    insights.push({
      title: 'Status Keuangan',
      value: data.totalExpense > 3000000 ? 'Tinggi' : data.totalExpense > 1500000 ? 'Sedang' : 'Rendah',
      icon: data.totalExpense > 3000000 ? '⚠️' : '✅',
      color: data.totalExpense > 3000000 ? this.colors.warning : this.colors.success
    });

    return insights;
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: string): string {
    const iconMap: { [key: string]: string } = {
      'Makanan': '🍽️',
      'Transport': '🚗',
      'Hiburan': '🎬',
      'Belanja': '🛍️',
      'Kesehatan': '🏥',
      'Pendidikan': '📚',
      'Tagihan': '💳',
      'Lainnya': '📦'
    };
    
    return iconMap[category] || '📋';
  }

  /**
   * Get gradient color based on percentage
   */
  private getGradientColor(percentage: number): string {
    if (percentage > 30) return this.colors.danger;
    if (percentage > 15) return this.colors.warning;
    return this.colors.success;
  }

  /**
   * Format rupiah currency
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
   * Format compact rupiah
   */
  private formatRupiahCompact(amount: number): string {
    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`;
    } else if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}jt`;
    } else if (amount >= 1000) {
      return `Rp ${Math.round(amount / 1000)}rb`;
    }
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  /**
   * Truncate text to specified length
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
