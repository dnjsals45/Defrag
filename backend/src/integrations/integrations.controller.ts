import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Provider } from '../database/entities/user-connection.entity';
import { UpdateIntegrationConfigDto } from './dto/update-integration-config.dto';

@Controller('workspaces/:workspaceId/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
  ) {
    const integrations = await this.integrationsService.findAllByWorkspace(
      workspaceId,
      req.user.id,
    );
    return { integrations };
  }

  @Get(':provider/auth')
  async startAuth(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Res() res: Response,
  ) {
    // Store workspaceId in state for callback
    // TODO: Implement proper state management (Redis/session)
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');

    // Build OAuth URL with state
    // Actual implementation depends on provider
    const frontendUrl = this.configService.get('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/workspaces/${workspaceId}/settings?provider=${provider}`);
  }

  @Get(':provider/callback')
  async handleCallback(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Request() req: any,
    @Res() res: Response,
  ) {
    // TODO: Handle OAuth callback
    const frontendUrl = this.configService.get('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/workspaces/${workspaceId}/settings?success=true`);
  }

  @Patch(':provider')
  async updateConfig(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Body() dto: UpdateIntegrationConfigDto,
  ) {
    await this.integrationsService.updateConfig(
      workspaceId,
      req.user.id,
      provider,
      dto.config,
    );
    return { success: true };
  }

  @Delete(':provider')
  async disconnect(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
  ) {
    await this.integrationsService.delete(workspaceId, req.user.id, provider);
    return { success: true };
  }
}
