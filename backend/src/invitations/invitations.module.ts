import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WorkspaceInvitation } from "../database/entities/workspace-invitation.entity";
import { WorkspaceMember } from "../database/entities/workspace-member.entity";
import { InvitationsService } from "./invitations.service";
import { InvitationsController } from "./invitations.controller";

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceInvitation, WorkspaceMember])],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
