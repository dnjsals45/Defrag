import { IsString, IsEnum, IsOptional, MaxLength } from "class-validator";
import { WorkspaceType } from "../../database/entities/workspace.entity";

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(WorkspaceType)
  type?: WorkspaceType;
}
