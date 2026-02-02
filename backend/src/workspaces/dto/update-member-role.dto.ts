import { IsEnum } from 'class-validator';
import { MemberRole } from '../../database/entities/workspace-member.entity';

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role: MemberRole;
}
