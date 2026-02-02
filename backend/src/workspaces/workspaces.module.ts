import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../database/entities/workspace.entity';
import { WorkspaceMember } from '../database/entities/workspace-member.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember]),
    UsersModule,
  ],
  controllers: [WorkspacesController, MembersController],
  providers: [WorkspacesService, MembersService],
  exports: [WorkspacesService, MembersService],
})
export class WorkspacesModule {}
