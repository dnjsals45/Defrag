import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Workspace } from "../database/entities/workspace.entity";
import { WorkspaceMember } from "../database/entities/workspace-member.entity";
import { WorkspaceInvitation } from "../database/entities/workspace-invitation.entity";
import { WorkspacesService } from "./workspaces.service";
import { WorkspacesController } from "./workspaces.controller";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceInvitation]),
    UsersModule,
  ],
  controllers: [WorkspacesController, MembersController],
  providers: [WorkspacesService, MembersService],
  exports: [WorkspacesService, MembersService],
})
export class WorkspacesModule {}
