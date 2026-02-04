import { IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateIntegrationConfigDto {
  @ApiProperty({
    example: { selectedRepos: ["owner/repo1", "owner/repo2"] },
    description: "연동 설정 (provider별로 다름)"
  })
  @IsObject()
  config: Record<string, any>;
}
