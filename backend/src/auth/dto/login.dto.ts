import { IsEmail, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "user@example.com", description: "사용자 이메일" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", description: "비밀번호" })
  @IsString()
  password: string;
}
