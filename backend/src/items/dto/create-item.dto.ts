import { IsString, IsUrl, IsOptional } from 'class-validator';

export class CreateItemDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
