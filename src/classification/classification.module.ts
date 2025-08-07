import { Module } from '@nestjs/common';
import { CategoryClassificationService } from './category-classification.service';

@Module({
  providers: [CategoryClassificationService],
  exports: [CategoryClassificationService],
})
export class ClassificationModule {}
