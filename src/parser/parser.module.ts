import { Module } from '@nestjs/common';
import { ParserService } from './parser.service';
import { ClassificationModule } from '../classification/classification.module';

@Module({
  imports: [ClassificationModule],
  providers: [ParserService],
  exports: [ParserService],
})
export class ParserModule {}
