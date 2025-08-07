import { Injectable, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import 'dayjs/locale/id';
import * as weekOfYear from 'dayjs/plugin/weekOfYear';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(weekOfYear);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);
dayjs.locale('id');

export interface DateRange {
  startDate: string;
  endDate: string;
  description: string;
}

export interface TimeContext {
  type: 'day' | 'week' | 'month' | 'year' | 'range' | 'specific';
  period?: string;
  weekOffset?: number;
  monthOffset?: number;
  yearOffset?: number;
  dayOffset?: number;
  specificDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  dayOfWeek?: string;
}

@Injectable()
export class EnhancedDateService {
  private readonly logger = new Logger(EnhancedDateService.name);
  
  private readonly dayNames = {
    'senin': 1, 'monday': 1,
    'selasa': 2, 'tuesday': 2,
    'rabu': 3, 'wednesday': 3,
    'kamis': 4, 'thursday': 4,
    'jumat': 5, 'friday': 5,
    'sabtu': 6, 'saturday': 6,
    'minggu': 0, 'ahad': 0, 'sunday': 0
  };

  private readonly monthNames = {
    'januari': 1, 'january': 1, 'jan': 1,
    'februari': 2, 'february': 2, 'feb': 2,
    'maret': 3, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'mei': 5, 'may': 5,
    'juni': 6, 'june': 6, 'jun': 6,
    'juli': 7, 'july': 7, 'jul': 7,
    'agustus': 8, 'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'oktober': 10, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'desember': 12, 'december': 12, 'dec': 12
  };

  /**
   * Parse natural language date expressions
   */
  parseTimeExpression(text: string): TimeContext | null {
    const normalizedText = text.toLowerCase().trim();
    this.logger.debug(`Parsing time expression: "${normalizedText}"`);

    // Hari tertentu dalam minggu ini
    const dayMatch = normalizedText.match(/hari\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu|ahad)/);
    if (dayMatch) {
      return {
        type: 'day',
        dayOfWeek: dayMatch[1]
      };
    }

    // X hari lalu
    const dayAgoMatch = normalizedText.match(/(\d+)\s+hari\s+lalu/);
    if (dayAgoMatch) {
      return {
        type: 'day',
        dayOffset: parseInt(dayAgoMatch[1])
      };
    }

    // Hari lalu, kemarin
    if (normalizedText.includes('hari lalu') || normalizedText.includes('kemarin')) {
      return {
        type: 'day',
        dayOffset: 1
      };
    }

    // Minggu lalu, 2 minggu lalu, dst
    const weekMatch = normalizedText.match(/(\d+)\s+minggu\s+lalu/);
    if (weekMatch) {
      return {
        type: 'week',
        weekOffset: parseInt(weekMatch[1])
      };
    }

    // Minggu ini, minggu lalu (tanpa angka)
    if (normalizedText.includes('minggu ini')) {
      return {
        type: 'week',
        weekOffset: 0
      };
    }

    if (normalizedText.includes('minggu lalu')) {
      return {
        type: 'week',
        weekOffset: 1
      };
    }

    // Bulan tertentu dengan tahun
    const monthYearMatch = normalizedText.match(/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/);
    if (monthYearMatch) {
      const monthNum = this.monthNames[monthYearMatch[1]];
      const year = parseInt(monthYearMatch[2]);
      return {
        type: 'month',
        period: `${year}-${monthNum.toString().padStart(2, '0')}`
      };
    }

    // Bulan tertentu tahun ini
    const monthMatch = normalizedText.match(/bulan\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/);
    if (monthMatch) {
      const monthNum = this.monthNames[monthMatch[1]];
      const currentYear = dayjs().year();
      return {
        type: 'month',
        period: `${currentYear}-${monthNum.toString().padStart(2, '0')}`
      };
    }

    // Bulan lalu, bulan ini
    if (normalizedText.includes('bulan lalu')) {
      return {
        type: 'month',
        monthOffset: 1
      };
    }

    if (normalizedText.includes('bulan ini')) {
      return {
        type: 'month',
        monthOffset: 0
      };
    }

    // Tahun ini, tahun lalu
    if (normalizedText.includes('tahun ini')) {
      return {
        type: 'year',
        yearOffset: 0
      };
    }

    if (normalizedText.includes('tahun lalu')) {
      return {
        type: 'year',
        yearOffset: 1
      };
    }

    // Range tanggal: dari X sampai Y
    const rangeMatch = normalizedText.match(/dari\s+(\d+)\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\s+sampai\s+(\d+)\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?/);
    if (rangeMatch) {
      const startDay = parseInt(rangeMatch[1]);
      const startMonth = this.monthNames[rangeMatch[2]];
      const startYear = rangeMatch[3] ? parseInt(rangeMatch[3]) : dayjs().year();
      
      const endDay = parseInt(rangeMatch[4]);
      const endMonth = this.monthNames[rangeMatch[5]];
      const endYear = rangeMatch[6] ? parseInt(rangeMatch[6]) : dayjs().year();

      return {
        type: 'range',
        rangeStart: `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`,
        rangeEnd: `${endYear}-${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`
      };
    }

    // Range bulan: dari X sampai Y
    const monthRangeMatch = normalizedText.match(/dari\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+sampai\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?/);
    if (monthRangeMatch) {
      const startMonth = this.monthNames[monthRangeMatch[1]];
      const endMonth = this.monthNames[monthRangeMatch[2]];
      const year = monthRangeMatch[3] ? parseInt(monthRangeMatch[3]) : dayjs().year();

      return {
        type: 'range',
        rangeStart: `${year}-${startMonth.toString().padStart(2, '0')}-01`,
        rangeEnd: `${year}-${endMonth.toString().padStart(2, '0')}-${dayjs(`${year}-${endMonth}`).endOf('month').date()}`
      };
    }

    // Tanggal spesifik: 3 Juni 2025
    const specificDateMatch = normalizedText.match(/(\d+)\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?/);
    if (specificDateMatch) {
      const day = parseInt(specificDateMatch[1]);
      const month = this.monthNames[specificDateMatch[2]];
      const year = specificDateMatch[3] ? parseInt(specificDateMatch[3]) : dayjs().year();

      return {
        type: 'specific',
        specificDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      };
    }

    return null;
  }

  /**
   * Convert TimeContext to DateRange
   */
  getDateRange(context: TimeContext): DateRange {
    const now = dayjs();
    
    switch (context.type) {
      case 'day':
        if (context.dayOfWeek) {
          const targetDay = this.dayNames[context.dayOfWeek];
          
          // Get the most recent occurrence of this day of the week
          // If today is Wednesday (3) and we want Monday (1), go back 2 days
          // If today is Monday (1) and we want Monday (1), stay on today
          const todayDayOfWeek = now.day(); // 0 = Sunday, 1 = Monday, etc.
          
          let targetDate;
          if (targetDay === todayDayOfWeek) {
            // Same day as today
            targetDate = now;
          } else {
            // Calculate days to go back to find the target day in this week
            let daysBack = (todayDayOfWeek - targetDay + 7) % 7;
            if (daysBack === 0) daysBack = 7; // If same day, go to last week's occurrence
            targetDate = now.subtract(daysBack, 'day');
          }
          
          this.logger.debug(`Parsing day: ${context.dayOfWeek} (${targetDay}), today is ${todayDayOfWeek}, target date: ${targetDate.format('YYYY-MM-DD')}`);
          
          return {
            startDate: targetDate.format('YYYY-MM-DD'),
            endDate: targetDate.format('YYYY-MM-DD'),
            description: `hari ${context.dayOfWeek} (${targetDate.format('DD MMM YYYY')})`
          };
        } else if (context.dayOffset !== undefined) {
          // Handle X hari lalu
          const targetDate = now.subtract(context.dayOffset, 'day');
          
          return {
            startDate: targetDate.format('YYYY-MM-DD'),
            endDate: targetDate.format('YYYY-MM-DD'),
            description: context.dayOffset === 0 ? 'hari ini' :
                        context.dayOffset === 1 ? `kemarin (${targetDate.format('DD MMM YYYY')})` :
                        `${context.dayOffset} hari lalu (${targetDate.format('DD MMM YYYY')})`
          };
        }
        break;

      case 'week':
        const weekOffset = context.weekOffset || 0;
        const targetWeek = now.subtract(weekOffset, 'week');
        const weekStart = targetWeek.startOf('week');
        const weekEnd = targetWeek.endOf('week');
        
        return {
          startDate: weekStart.format('YYYY-MM-DD'),
          endDate: weekEnd.format('YYYY-MM-DD'),
          description: weekOffset === 0 ? 'minggu ini' : 
                      weekOffset === 1 ? 'minggu lalu' : `${weekOffset} minggu lalu`
        };

      case 'month':
        if (context.period) {
          const [year, month] = context.period.split('-');
          const targetMonth = dayjs(`${year}-${month}-01`);
          
          return {
            startDate: targetMonth.startOf('month').format('YYYY-MM-DD'),
            endDate: targetMonth.endOf('month').format('YYYY-MM-DD'),
            description: `bulan ${targetMonth.format('MMMM YYYY')}`
          };
        } else {
          const monthOffset = context.monthOffset || 0;
          const targetMonth = now.subtract(monthOffset, 'month');
          
          return {
            startDate: targetMonth.startOf('month').format('YYYY-MM-DD'),
            endDate: targetMonth.endOf('month').format('YYYY-MM-DD'),
            description: monthOffset === 0 ? 'bulan ini' : 
                        monthOffset === 1 ? 'bulan lalu' : `${monthOffset} bulan lalu`
          };
        }

      case 'year':
        const yearOffset = context.yearOffset || 0;
        const targetYear = now.subtract(yearOffset, 'year');
        
        return {
          startDate: targetYear.startOf('year').format('YYYY-MM-DD'),
          endDate: targetYear.endOf('year').format('YYYY-MM-DD'),
          description: yearOffset === 0 ? 'tahun ini' : `tahun ${targetYear.year()}`
        };

      case 'range':
        return {
          startDate: context.rangeStart!,
          endDate: context.rangeEnd!,
          description: `dari ${dayjs(context.rangeStart).format('DD MMM YYYY')} sampai ${dayjs(context.rangeEnd).format('DD MMM YYYY')}`
        };

      case 'specific':
        return {
          startDate: context.specificDate!,
          endDate: context.specificDate!,
          description: `tanggal ${dayjs(context.specificDate).format('DD MMMM YYYY')}`
        };

      default:
        return {
          startDate: now.format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
          description: 'hari ini'
        };
    }

    return {
      startDate: now.format('YYYY-MM-DD'),
      endDate: now.format('YYYY-MM-DD'),
      description: 'hari ini'
    };
  }

  /**
   * Get specific periods for analysis
   */
  getCurrentWeek(): DateRange {
    const now = dayjs();
    return {
      startDate: now.startOf('week').format('YYYY-MM-DD'),
      endDate: now.endOf('week').format('YYYY-MM-DD'),
      description: 'minggu ini'
    };
  }

  getCurrentMonth(): DateRange {
    const now = dayjs();
    return {
      startDate: now.startOf('month').format('YYYY-MM-DD'),
      endDate: now.endOf('month').format('YYYY-MM-DD'),
      description: 'bulan ini'
    };
  }

  getCurrentYear(): DateRange {
    const now = dayjs();
    return {
      startDate: now.startOf('year').format('YYYY-MM-DD'),
      endDate: now.endOf('year').format('YYYY-MM-DD'),
      description: 'tahun ini'
    };
  }

  getPreviousMonth(): DateRange {
    const lastMonth = dayjs().subtract(1, 'month');
    return {
      startDate: lastMonth.startOf('month').format('YYYY-MM-DD'),
      endDate: lastMonth.endOf('month').format('YYYY-MM-DD'),
      description: 'bulan lalu'
    };
  }

  /**
   * Format date for display
   */
  formatDateForDisplay(dateString: string): string {
    return dayjs(dateString).format('DD MMMM YYYY');
  }

  /**
   * Get day name in Indonesian
   */
  getDayName(dateString: string): string {
    return dayjs(dateString).format('dddd');
  }

  /**
   * Check if date is within range
   */
  isDateInRange(date: string, startDate: string, endDate: string): boolean {
    const checkDate = dayjs(date);
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    return checkDate.isSameOrAfter(start) && checkDate.isSameOrBefore(end);
  }

  /**
   * Get remaining days in current month
   */
  getRemainingDaysInMonth(): number {
    const now = dayjs();
    const endOfMonth = now.endOf('month');
    return endOfMonth.diff(now, 'day') + 1;
  }

  /**
   * Get weeks between two dates
   */
  getWeeksBetween(startDate: string, endDate: string): number {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    return end.diff(start, 'week');
  }
}
