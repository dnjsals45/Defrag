import { IsOptional, IsArray, IsEnum, IsString } from 'class-validator';
import { Provider } from '../../database/entities/user-connection.entity';

export class TriggerSyncDto {
  @IsOptional()
  @IsArray()
  @IsEnum(Provider, { each: true })
  providers?: Provider[];

  @IsOptional()
  @IsEnum(['full', 'incremental'])
  syncType?: 'full' | 'incremental';

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetItems?: string[];  // 특정 항목만 동기화 (repo fullName, channel id, page id)
}
