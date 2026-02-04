import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { MemberRole } from "../../database/entities/workspace-member.entity";

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: MemberRole, example: "ADMIN", description: "변경할 역할" })
  @IsEnum(MemberRole)
  role: MemberRole;
}
