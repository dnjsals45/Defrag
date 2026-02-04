import { IsString, IsOptional, IsBoolean } from "class-validator";

export class AskDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;
}
