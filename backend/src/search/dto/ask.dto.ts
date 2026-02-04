import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AskDto {
  @ApiProperty({ example: "이번 주 회의 내용 요약해줘", description: "AI에게 질문할 내용" })
  @IsString()
  question: string;

  @ApiPropertyOptional({ example: true, description: "컨텍스트 포함 여부" })
  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;
}
