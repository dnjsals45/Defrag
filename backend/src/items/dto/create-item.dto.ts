import {
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateItemDto {
  @ApiProperty({
    example: ["https://example.com/article1", "https://example.com/article2"],
    description: "추가할 웹 아티클 URL (1-5개)"
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  urls: string[];

  @ApiPropertyOptional({ example: "아티클 제목", description: "수동 제목 지정" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "아티클 내용", description: "수동 내용 지정" })
  @IsOptional()
  @IsString()
  content?: string;
}
