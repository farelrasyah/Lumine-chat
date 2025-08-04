import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  // Placeholder: fitur pengingat tugas akan dikembangkan di masa depan
  async scheduleTask(task: string, time: Date) {
    this.logger.log(`Scheduled task: ${task} at ${time}`);
  }
}
