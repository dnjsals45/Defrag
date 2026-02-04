import { IsString, IsNotEmpty, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendMessageDto {
  @ApiProperty({ example: "지난 주 회의록 요약해줘", description: "AI에게 보낼 메시지 (최대 10,000자)" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  question: string;
}
