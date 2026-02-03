import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
      version: process.env.npm_package_version || '0.1.0',
    };
  }

  @Get('ready')
  ready() {
    // Can be extended to check database, redis, etc.
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
