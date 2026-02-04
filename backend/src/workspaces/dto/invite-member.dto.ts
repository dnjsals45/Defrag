import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRole } from "../../database/entities/workspace-member.entity";

export class InviteMemberDto {
  @ApiProperty({ example: "member@example.com", description: "초대할 사용자 이메일" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: MemberRole, example: "MEMBER", description: "부여할 역할 (기본: MEMBER)" })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}
