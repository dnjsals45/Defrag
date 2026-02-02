import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { MemberRole } from '../../database/entities/workspace-member.entity';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}
