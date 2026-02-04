import { IsOptional, IsArray, IsEnum, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Provider } from "../../database/entities/user-connection.entity";

export class TriggerSyncDto {
  @ApiPropertyOptional({ enum: Provider, isArray: true, description: "동기화할 프로바이더" })
  @IsOptional()
  @IsArray()
  @IsEnum(Provider, { each: true })
  providers?: Provider[];

  @ApiPropertyOptional({ enum: ["full", "incremental"], example: "incremental", description: "동기화 유형" })
  @IsOptional()
  @IsEnum(["full", "incremental"])
  syncType?: "full" | "incremental";

  @ApiPropertyOptional({ example: "2024-01-01", description: "이 날짜 이후 데이터만 동기화" })
  @IsOptional()
  @IsString()
  since?: string;

  @ApiPropertyOptional({
    example: ["owner/repo", "C12345678"],
    description: "특정 항목만 동기화 (repo fullName, channel id, page id)"
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetItems?: string[];
}
