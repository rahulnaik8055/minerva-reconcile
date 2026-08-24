import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DemoLoadResultDto, DemoStatusDto } from './demo.service';
import { DemoService } from './demo.service';

@ApiTags('demo')
@ApiBearerAuth()
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the synthetic demo dataset is currently loaded' })
  @ApiOkResponse({ description: 'Demo dataset presence flag' })
  getStatus(): Promise<DemoStatusDto> {
    return this.demoService.getStatus();
  }

  @Post('load')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Replace all reconciliation data with the deterministic synthetic demo dataset and run the real matching engine',
  })
  @ApiOkResponse({ description: 'Imported record counts and proposals created by the engine' })
  loadDemoData(): Promise<DemoLoadResultDto> {
    return this.demoService.loadDemoData();
  }

  @Delete('data')
  @ApiOperation({ summary: 'Remove the demo dataset and everything derived from it' })
  @ApiOkResponse({ description: 'Reconciliation tables cleared' })
  resetDemoData(): Promise<{ cleared: boolean }> {
    return this.demoService.resetDemoData();
  }
}
