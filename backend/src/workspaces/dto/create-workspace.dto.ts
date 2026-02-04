import { IsString, IsEnum, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkspaceType } from "../../database/entities/workspace.entity";

export class CreateWorkspaceDto {
  @ApiProperty({ example: "내 프로젝트", description: "워크스페이스 이름 (최대 100자)" })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: WorkspaceType, example: "personal", description: "워크스페이스 유형" })
  @IsOptional()
  @IsEnum(WorkspaceType)
  type?: WorkspaceType;
}
