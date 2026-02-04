import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({ description: "리프레시 토큰" })
  @IsString()
  refreshToken: string;
}
