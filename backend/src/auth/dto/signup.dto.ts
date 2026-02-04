import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SignUpDto {
  @ApiProperty({ example: "user@example.com", description: "사용자 이메일" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", description: "비밀번호 (8자 이상)" })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({ example: "홍길동", description: "닉네임 (2-100자)" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nickname: string;
}
