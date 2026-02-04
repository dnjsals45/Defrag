import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserConnection } from "../database/entities/user-connection.entity";
import { ConnectionsService } from "./connections.service";
import { ConnectionsController } from "./connections.controller";
import { IntegrationsModule } from "../integrations/integrations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserConnection]),
    forwardRef(() => IntegrationsModule),
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
