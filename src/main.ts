import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SupabaseService } from './supabase/supabase.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Test Supabase connection on startup
  console.log('Testing Supabase connection on startup...');
  try {
    await SupabaseService.testSupabaseConnection();
  } catch (error) {
    console.error('Supabase connection test failed:', error);
  }
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
