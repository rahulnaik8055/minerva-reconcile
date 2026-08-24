import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { ReviewModule } from '../reconciliation/review/review.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [ImportsModule, ReviewModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
