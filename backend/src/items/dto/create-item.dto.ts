import {
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
} from "class-validator";

export class CreateItemDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  urls: string[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
