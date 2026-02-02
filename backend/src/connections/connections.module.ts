import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserConnection } from '../database/entities/user-connection.entity';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserConnection])],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
