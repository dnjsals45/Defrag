import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMService } from './llm.service';

@Module({
  imports: [HttpModule],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
