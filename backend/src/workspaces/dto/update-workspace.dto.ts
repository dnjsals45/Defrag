import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: "새 이름", description: "워크스페이스 이름 (최대 100자)" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
