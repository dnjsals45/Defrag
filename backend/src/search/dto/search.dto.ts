import { IsString, IsOptional, IsArray, IsNumber, Max } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SourceType } from "../../database/entities/context-item.entity";

export class SearchDto {
  @ApiProperty({ example: "프로젝트 일정", description: "검색 쿼리" })
  @IsString()
  query: string;

  @ApiPropertyOptional({ enum: SourceType, isArray: true, description: "필터링할 소스 타입" })
  @IsOptional()
  @IsArray()
  sources?: SourceType[];

  @ApiPropertyOptional({ example: 10, description: "결과 개수 제한 (최대 50)" })
  @IsOptional()
  @IsNumber()
  @Max(50)
  limit?: number;
}
