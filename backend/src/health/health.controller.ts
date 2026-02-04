import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: "헬스체크", description: "서버 상태 확인" })
  @ApiResponse({ status: 200, description: "서버 정상" })
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: this.configService.get("NODE_ENV", "development"),
      version: process.env.npm_package_version || "0.1.0",
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "준비 상태", description: "서버 준비 상태 확인" })
  @ApiResponse({ status: 200, description: "서버 준비됨" })
  ready() {
    return {
      status: "ready",
      timestamp: new Date().toISOString(),
    };
  }
}
