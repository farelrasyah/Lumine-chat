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
  // Modern gradient color palette with better contrast and visual appeal
  private readonly modernColorPalette = [
    '#FF6B6B', // Vibrant coral
    '#4ECDC4', // Teal
    '#45B7D1', // Sky blue
    '#96CEB4', // Mint green
    '#FFEAA7', // Soft yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Aquamarine
    '#F7DC6F', // Light gold
    '#BB8FCE', // Lavender
    '#85C1E9', // Light blue
    '#F8C471', // Peach
    '#82E0AA', // Light green
    '#F1948A', // Light coral
    '#AED6F1', // Baby blue
    '#D5A6BD', // Dusty rose
    '#A9DFBF'  // Pale green
  ];

  // Darker variants for highlighting
  private readonly accentColorPalette = [
    '#E74C3C', // Dark coral
    '#16A085', // Dark teal
    '#2980B9', // Dark blue
    '#27AE60', // Dark green
    '#F39C12', // Dark orange
    '#8E44AD', // Dark purple
    '#17A2B8', // Dark cyan
    '#DC7633', // Dark gold
    '#7D3C98', // Dark lavender
    '#5DADE2', // Medium blue
    '#E67E22', // Dark peach
    '#58D68D', // Medium green
    '#EC7063', // Medium coral
    '#7FB3D3', // Medium baby blue
    '#C39BD3', // Medium dusty rose
    '#7DCEA0'  // Medium pale green
  ];

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
      return `Rp ${(value / 1000000000).toFixed(1)}M`;
    } else if (value >= 1000000) {
      return `Rp ${(value / 1000000).toFixed(1)}jt`;
    } else if (value >= 1000) {
      return `Rp ${(value / 1000).toFixed(0)}rb`;
    }
    return this.formatRupiah(value);
  }

  private calculatePercentage(value: number, total: number): string {
    const percentage = (value / total) * 100;
    return percentage.toFixed(1) + '%';
  }

  async buildSpendingPiePng(input: BuildSpendingPieParams): Promise<Buffer> {
    const {
      labels,
      values,
      title = 'Pengeluaran per Kategori',
      highlightMax = true,
      locale = 'id-ID',
      width = 1200,
      height = 700,
      doughnut = true
    } = input;

    if (!labels || !values || labels.length === 0 || values.length === 0) {
      throw new Error('Labels and values cannot be empty');
    }

    const total = values.reduce((sum, val) => sum + val, 0);
    
    // Find index of maximum value for highlighting
    const maxIndex = highlightMax ? values.indexOf(Math.max(...values)) : -1;
    
    // Prepare modern gradient colors with transparency
    const backgroundColors = labels.map((_, index) => {
      const baseColor = this.modernColorPalette[index % this.modernColorPalette.length];
      if (highlightMax && index === maxIndex) {
        return baseColor; // Full opacity for max
      }
      return baseColor + 'E6'; // Add transparency (90%)
    });

    const borderColors = labels.map((_, index) => {
      if (highlightMax && index === maxIndex) {
        return this.accentColorPalette[index % this.accentColorPalette.length];
      }
      return this.modernColorPalette[index % this.modernColorPalette.length];
    });

    // Create advanced chart configuration
    const chartConfig = {
      type: doughnut ? 'doughnut' : 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: highlightMax ? labels.map((_, index) => index === maxIndex ? 4 : 2) : 2,
          hoverBorderWidth: 4,
          hoverBorderColor: '#FFFFFF',
          // Add shadow effect
          shadowOffsetX: 3,
          shadowOffsetY: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            bottom: 20,
            left: 20,
            right: 20
          }
        },
        plugins: {
          title: {
            display: true,
            text: [title, `Total: ${this.formatRupiah(total)}`],
            font: {
              size: 24,
              weight: 'bold',
              family: 'Inter, system-ui, -apple-system, sans-serif'
            },
            color: '#2C3E50',
            padding: {
              top: 15,
              bottom: 30
            }
          },
          legend: {
            display: true,
            position: 'right',
            align: 'center',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 14,
                family: 'Inter, system-ui, -apple-system, sans-serif',
                weight: '500'
              },
              color: '#34495E',
              padding: 20,
              generateLabels: (chart: any) => {
                const data = chart.data;
                return data.labels.map((label: string, index: number) => {
                  const value = values[index];
                  const percentage = this.calculatePercentage(value, total);
                  const compactValue = this.formatCompactRupiah(value);
                  
                  return {
                    text: `${label}  ${percentage}  (${compactValue})`,
                    fillStyle: backgroundColors[index],
                    strokeStyle: borderColors[index],
                    lineWidth: highlightMax && index === maxIndex ? 3 : 1,
                    pointStyle: 'circle',
                    pointRadius: highlightMax && index === maxIndex ? 8 : 6
                  };
                });
              }
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(44, 62, 80, 0.95)',
            titleColor: '#FFFFFF',
            titleFont: {
              size: 16,
              weight: 'bold',
              family: 'Inter, system-ui, -apple-system, sans-serif'
            },
            bodyColor: '#FFFFFF',
            bodyFont: {
              size: 14,
              family: 'Inter, system-ui, -apple-system, sans-serif'
            },
            borderColor: '#BDC3C7',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              title: (context: any) => {
                return context[0].label;
              },
              label: (context: any) => {
                const value = context.parsed;
                const percentage = this.calculatePercentage(value, total);
                const rupiah = this.formatRupiah(value);
                return [
                  `Nilai: ${rupiah}`,
                  `Persentase: ${percentage}`,
                  `Dari total: ${this.formatRupiah(total)}`
                ];
              }
            }
          },
          // Enhanced data labels
          datalabels: {
            display: true,
            color: '#FFFFFF',
            font: {
              weight: 'bold',
              size: 12,
              family: 'Inter, system-ui, -apple-system, sans-serif'
            },
            formatter: (value: number, context: any) => {
              const percentage = this.calculatePercentage(value, total);
              // Only show percentage if it's >= 3% to avoid clutter
              return parseFloat(percentage) >= 3 ? percentage : '';
            },
            textStrokeColor: 'rgba(0, 0, 0, 0.3)',
            textStrokeWidth: 1,
            // Position labels nicely
            anchor: 'center',
            align: 'center'
          }
        },
        // Enhanced animations
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 2000,
          easing: 'easeOutQuart'
        },
        // Custom cutout for doughnut
        cutout: doughnut ? '60%' : '0%',
        // Better spacing
        spacing: 2
      },
      // Add custom plugins for center text in doughnut
      plugins: doughnut ? [{
        id: 'centerText',
        beforeDraw: (chart: any) => {
          if (chart.config.type === 'doughnut') {
            const ctx = chart.ctx;
            const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Main total text
            ctx.fillStyle = '#2C3E50';
            ctx.font = 'bold 18px Inter, system-ui, -apple-system, sans-serif';
            ctx.fillText('Total Pengeluaran', centerX, centerY - 15);
            
            // Amount text
            ctx.fillStyle = '#E74C3C';
            ctx.font = 'bold 24px Inter, system-ui, -apple-system, sans-serif';
            const compactTotal = this.formatCompactRupiah(total);
            ctx.fillText(compactTotal, centerX, centerY + 15);
            
            ctx.restore();
          }
        }
      }] : []
    };

    try {
      const quickChartUrl = 'https://quickchart.io/chart';
      const response = await axios.post(quickChartUrl, {
        chart: chartConfig,
        width: width,
        height: height,
        format: 'png',
        backgroundColor: '#FFFFFF',
        // Add quality settings for better output
        quality: 0.9,
        // Enable plugins
        plugins: {
          datalabels: {
            version: 'latest'
          }
        }
      }, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LumineChat/1.0'
        },
        timeout: 45000 // Increased timeout for complex charts
      });

      return Buffer.from(response.data);
      
    } catch (error) {
      console.error('Error generating modern chart:', error);
      
      // Enhanced fallback with better error handling
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      }
      
      throw new Error(`Failed to generate modern chart: ${error.message}`);
    }
  }
}
