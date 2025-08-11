import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface BuildSpendingPieParams {
  labels: string[];
  values: number[];
  title?: string;
  highlightMax?: boolean;
  locale?: 'id-ID';
  width?: number;
  height?: number;
  doughnut?: boolean;
}

@Injectable()
export class ChartsService {
  // OKLCH/HCL-based modern color palette (color-blind safe, high contrast)
  // Inspired by Okabe-Ito and Material Design 3.0
  private readonly professionalColorPalette = [
    '#E53E3E', // Red (high contrast)
    '#3182CE', // Blue
    '#38A169', // Green
    '#D69E2E', // Gold/Yellow
    '#805AD5', // Purple
    '#DD6B20', // Orange
    '#319795', // Teal
    '#C53030', // Dark Red
    '#2B6CB0', // Dark Blue
    '#2F855A', // Dark Green
    '#B7791F', // Dark Gold
    '#6B46C1', // Dark Purple
    '#C05621', // Dark Orange
    '#2C7A7B', // Dark Teal
    '#9F7AEA', // Light Purple
    '#4FD1C7'  // Light Teal
  ];

  // Optimized palette for Indonesian financial data
  private readonly indonesianPalette = [
    { main: '#FF6B6B', dark: '#E53E3E', name: 'Merah Coral' },
    { main: '#4ECDC4', dark: '#319795', name: 'Teal Modern' },
    { main: '#45B7D1', dark: '#3182CE', name: 'Biru Langit' },
    { main: '#96CEB4', dark: '#38A169', name: 'Hijau Mint' },
    { main: '#FFEAA7', dark: '#D69E2E', name: 'Kuning Emas' },
    { main: '#DDA0DD', dark: '#805AD5', name: 'Ungu Lavender' },
    { main: '#F8C471', dark: '#DD6B20', name: 'Jingga Hangat' },
    { main: '#82E0AA', dark: '#2F855A', name: 'Hijau Segar' },
    { main: '#AED6F1', dark: '#2B6CB0', name: 'Biru Muda' },
    { main: '#F1948A', dark: '#C53030', name: 'Salmon' }
  ];

  // Professional utility methods
  private formatRupiahCompact(value: number): string {
    if (value >= 1000000000) {
      const billions = (value / 1000000000).toFixed(1);
      return `Rp ${billions} M`;
    } else if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(1);
      return `Rp ${millions} jt`;
    } else if (value >= 1000) {
      const thousands = Math.round(value / 1000);
      return `Rp ${thousands} rb`;
    }
    return `Rp ${value.toLocaleString('id-ID')}`;
  }

  private formatRupiahFull(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private formatPercentage(value: number, total: number): string {
    return ((value / total) * 100).toFixed(1) + '%';
  }

  private truncateLabel(label: string, maxLength: number = 15): string {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  }

  // Clean up duplicate categories and merge small segments
  private cleanupCategories(labels: string[], values: number[], minPercentage: number = 3): {
    cleanLabels: string[];
    cleanValues: number[];
    hasOthers: boolean;
  } {
    const total = values.reduce((sum, val) => sum + val, 0);
    const categoryMap = new Map<string, number>();
    
    // Merge duplicate categories
    labels.forEach((label, index) => {
      const cleanLabel = label.trim() || 'Tidak Berkategori';
      const currentValue = categoryMap.get(cleanLabel) || 0;
      categoryMap.set(cleanLabel, currentValue + values[index]);
    });

    // Sort by value descending
    const sortedEntries = Array.from(categoryMap.entries())
      .sort(([,a], [,b]) => b - a);

    // Separate significant and small categories
    const significantCategories: [string, number][] = [];
    let othersTotal = 0;
    
    sortedEntries.forEach(([label, value]) => {
      const percentage = (value / total) * 100;
      if (percentage >= minPercentage) {
        significantCategories.push([label, value]);
      } else {
        othersTotal += value;
      }
    });

    // Add "Lainnya" if there are small categories
    const hasOthers = othersTotal > 0;
    if (hasOthers) {
      significantCategories.push(['Lainnya', othersTotal]);
    }

    return {
      cleanLabels: significantCategories.map(([label]) => label),
      cleanValues: significantCategories.map(([, value]) => value),
      hasOthers
    };
  }

  // Generate smart colors based on data
  private generateSmartColors(dataLength: number): {
    backgroundColors: string[];
    borderColors: string[];
  } {
    const backgroundColors: string[] = [];
    const borderColors: string[] = [];

    for (let i = 0; i < dataLength; i++) {
      const colorIndex = i % this.indonesianPalette.length;
      const colorSet = this.indonesianPalette[colorIndex];
      
      // Add slight transparency for better visual depth
      backgroundColors.push(colorSet.main + 'E6'); // 90% opacity
      borderColors.push(colorSet.dark);
    }

    return { backgroundColors, borderColors };
  }

  private formatRupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private formatCompactRupiah(value: number): string {
    if (value >= 1000000000) {
      const billions = (value / 1000000000).toFixed(1);
      return `Rp ${billions} M`;
    } else if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(1);
      return `Rp ${millions} jt`;
    } else if (value >= 1000) {
      const thousands = Math.round(value / 1000);
      return `Rp ${thousands} rb`;
    }
    // Untuk angka kecil, gunakan format penuh dengan titik pemisah
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private calculatePercentage(value: number, total: number): string {
    const percentage = (value / total) * 100;
    return percentage.toFixed(1) + '%';
  }

  /**
   * Merge small categories into "Lainnya" if they're less than 3% of total
   */
  private optimizeCategories(labels: string[], values: number[], minPercentage: number = 3): { labels: string[], values: number[] } {
    const total = values.reduce((sum, val) => sum + val, 0);
    const optimized: { labels: string[], values: number[] } = { labels: [], values: [] };
    let othersTotal = 0;
    
    for (let i = 0; i < labels.length; i++) {
      const percentage = (values[i] / total) * 100;
      if (percentage >= minPercentage) {
        optimized.labels.push(labels[i]);
        optimized.values.push(values[i]);
      } else {
        othersTotal += values[i];
      }
    }
    
    if (othersTotal > 0) {
      optimized.labels.push('Lainnya');
      optimized.values.push(othersTotal);
    }
    
    return optimized;
  }

  async buildSpendingPiePng(input: BuildSpendingPieParams): Promise<Buffer> {
    const {
      labels,
      values,
      title = 'Pengeluaran per Kategori',
      highlightMax = false, // Disable highlighting for cleaner look
      locale = 'id-ID',
      width = 1400,
      height = 900,
      doughnut = true
    } = input;

    if (!labels || !values || labels.length === 0 || values.length === 0) {
      throw new Error('Labels and values cannot be empty');
    }

    // Optimize categories (merge small ones)
    const optimized = this.optimizeCategories(labels, values, 2.5);
    const total = optimized.values.reduce((sum, val) => sum + val, 0);
    
    // Generate dynamic colors from Indonesian palette
    const backgroundColors = optimized.labels.map((_, index) => {
      const paletteIndex = index % this.indonesianPalette.length;
      return this.indonesianPalette[paletteIndex].main;
    });

    const borderColors = optimized.labels.map((_, index) => {
      const paletteIndex = index % this.indonesianPalette.length;
      return this.indonesianPalette[paletteIndex].dark;
    });

    // Professional chart configuration
    const chartConfig = {
      type: doughnut ? 'doughnut' : 'pie',
      data: {
        labels: optimized.labels,
        datasets: [{
          data: optimized.values,
          backgroundColor: backgroundColors,
          borderColor: '#FFFFFF', // White separator between segments
          borderWidth: 3, // Thicker separator for clarity
          hoverBorderWidth: 4,
          hoverBorderColor: '#FFFFFF',
          hoverOffset: 8 // Slight expansion on hover
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 80,
            bottom: 100,
            left: 120,
            right: 120 // More padding for external labels with leader lines
          }
        },
        plugins: {
          title: {
            display: true,
            text: [title, `Total: ${this.formatRupiah(total)}`],
            font: {
              size: 28,
              weight: 'bold',
              family: "'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif"
            },
            color: '#1a202c', // Dark gray for title
            padding: {
              top: 20,
              bottom: 40
            }
          },
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              pointRadius: 8,
              font: {
                size: 16,
                family: "'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif",
                weight: '500'
              },
              color: '#2d3748', // Slightly darker gray
              padding: 25,
              boxWidth: 16,
              generateLabels: (chart: any) => {
                const data = chart.data;
                return data.labels.map((label: string, index: number) => {
                  const value = optimized.values[index];
                  const percentage = this.calculatePercentage(value, total);
                  const formatted = this.formatCompactRupiah(value);
                  
                  return {
                    text: `${label}  •  ${percentage}  •  ${formatted}`,
                    fillStyle: backgroundColors[index],
                    strokeStyle: borderColors[index],
                    lineWidth: 2,
                    pointStyle: 'circle',
                    pointRadius: 8
                  };
                });
              }
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(26, 32, 44, 0.95)', // Dark professional background
            titleColor: '#FFFFFF',
            titleFont: {
              size: 18,
              weight: 'bold',
              family: "'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif"
            },
            bodyColor: '#FFFFFF',
            bodyFont: {
              size: 16,
              family: "'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif"
            },
            borderColor: '#E2E8F0',
            borderWidth: 1,
            cornerRadius: 12,
            padding: 16,
            displayColors: true,
            callbacks: {
              title: (context: any) => {
                return `📊 ${context[0].label}`;
              },
              label: (context: any) => {
                const value = context.parsed;
                const percentage = ((value / total) * 100);
                const percentageStr = percentage % 1 === 0 ? `${percentage}%` : `${percentage.toFixed(1)}%`;
                const rupiah = this.formatRupiah(value);
                return [
                  `💰 Nominal: ${rupiah}`,
                  `📊 Persentase: ${percentageStr}`,
                  `🎯 Total keseluruhan: ${this.formatRupiah(total)}`
                ];
              }
            }
          },
          datalabels: {
            display: true,
            color: (context: any) => {
              const value = context.parsed;
              const percentage = (value / total) * 100;
              
              // For small segments (<5%), use dark color since they'll be outside
              if (percentage < 5) {
                return '#2D3748';
              }
              
              // For larger segments, use contrast color based on background
              const bgColor = backgroundColors[context.dataIndex];
              return this.getContrastColor(bgColor);
            },
            font: {
              weight: 'bold',
              size: 13,
              family: "'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif"
            },
            formatter: (value: number, context: any) => {
              // Only show percentage, rounded to 1 decimal if needed
              const percentage = (value / total) * 100;
              return percentage % 1 === 0 ? `${percentage}%` : `${percentage.toFixed(1)}%`;
            },
            // Use external positioning for all labels to prevent overlap
            anchor: 'end', // Position at edge of segment
            align: 'end', // Align text to end of anchor line
            offset: 15, // Distance from chart edge
            // Draw leader lines for all segments
            borderColor: '#CBD5E0',
            borderWidth: 1,
            borderRadius: 2,
            // Consistent external styling
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 4,
            // Keep text readable with subtle stroke
            textStrokeColor: 'rgba(0, 0, 0, 0.1)',
            textStrokeWidth: 0.5,
            // Allow labels outside chart
            clip: false
          }
        },
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 1800,
          easing: 'easeOutQuart'
        },
        cutout: doughnut ? '42%' : '0%', // Perfect donut ratio
        spacing: 4, // Space between segments
        // Remove hover animations for cleaner look
        onHover: () => {},
        elements: {
          arc: {
            // Smooth arc transitions
            borderJoinStyle: 'round'
          }
        }
      }
    };

    // Add custom center text plugin for donut charts
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw: (chart: any) => {
        if (chart.config.type === 'doughnut') {
          const ctx = chart.ctx;
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Main label
          ctx.fillStyle = '#4A5568';
          ctx.font = "bold 18px 'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif";
          ctx.fillText('Total Pengeluaran', centerX, centerY - 18);
          
          // Amount - using full rupiah format for center text
          ctx.fillStyle = '#E53E3E';
          ctx.font = "bold 24px 'Inter', 'Plus Jakarta Sans', 'Poppins', system-ui, -apple-system, sans-serif";
          const fullTotal = this.formatRupiah(total);
          ctx.fillText(fullTotal, centerX, centerY + 18);
          
          ctx.restore();
        }
      }
    };

    try {
      const quickChartUrl = 'https://quickchart.io/chart';
      const response = await axios.post(quickChartUrl, {
        chart: chartConfig,
        width: width,
        height: height,
        format: 'png',
        backgroundColor: '#FFFFFF',
        devicePixelRatio: 2.0, // HD quality
        version: '3.9.1', // Latest Chart.js version
        plugins: [centerTextPlugin]
      }, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LumineChat/2.0 (Professional Charts)'
        },
        timeout: 60000 // Extended timeout for HD rendering
      });

      return Buffer.from(response.data);
      
    } catch (error) {
      console.error('Error generating professional chart:', error);
      
      if (error.response) {
        console.error('API Response:', error.response.status, error.response.statusText);
        console.error('Error details:', error.response.data?.toString?.() || error.response.data);
      }
      
      throw new Error(`Failed to generate professional chart: ${error.message}`);
    }
  }

  /**
   * Calculate contrast color for text based on background
   */
  private getContrastColor(hexColor: string): string {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark backgrounds, dark for light backgrounds
    return luminance > 0.5 ? '#2D3748' : '#FFFFFF';
  }
}
