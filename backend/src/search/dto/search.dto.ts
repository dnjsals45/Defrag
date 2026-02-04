import { IsString, IsOptional, IsArray, IsNumber, Max } from "class-validator";
import { SourceType } from "../../database/entities/context-item.entity";

export class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsArray()
  sources?: SourceType[];

  @IsOptional()
  @IsNumber()
  @Max(50)
  limit?: number;
}
