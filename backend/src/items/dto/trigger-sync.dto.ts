import { IsOptional, IsArray, IsEnum, IsString, IsDateString } from 'class-validator';
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
}
