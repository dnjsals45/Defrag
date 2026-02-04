import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: "프로젝트 관련 대화", description: "대화 제목 (최대 255자)" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
