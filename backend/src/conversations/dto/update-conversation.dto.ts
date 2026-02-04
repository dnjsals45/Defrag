import { IsString, IsOptional, MaxLength } from "class-validator";

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
