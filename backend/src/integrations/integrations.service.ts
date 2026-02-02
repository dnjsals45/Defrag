import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';
import { Provider } from '../database/entities/user-connection.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MemberRole } from '../database/entities/workspace-member.entity';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly integrationsRepository: Repository<WorkspaceIntegration>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async findAllByWorkspace(workspaceId: string, userId: string) {
    await this.checkAccess(workspaceId, userId);

    const integrations = await this.integrationsRepository.find({
      where: { workspaceId },
    });

    const providers = Object.values(Provider);
    return providers.map((provider) => {
      const integration = integrations.find((i) => i.provider === provider);
      return {
        provider,
        connected: !!integration,
        config: integration?.config || null,
        connectedAt: integration?.createdAt || null,
      };
    });
  }

  async upsert(
    workspaceId: string,
    userId: string,
    provider: Provider,
    data: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      config?: Record<string, any>;
    },
  ): Promise<WorkspaceIntegration> {
    await this.checkAdminAccess(workspaceId, userId);

    const existing = await this.integrationsRepository.findOne({
      where: { workspaceId, provider },
    });

    if (existing) {
      Object.assign(existing, data);
      return this.integrationsRepository.save(existing);
    }

    const integration = this.integrationsRepository.create({
      workspaceId,
      provider,
      connectedBy: userId,
      ...data,
    });
    return this.integrationsRepository.save(integration);
  }

  async updateConfig(
    workspaceId: string,
    userId: string,
    provider: Provider,
    config: Record<string, any>,
  ): Promise<WorkspaceIntegration> {
    await this.checkAdminAccess(workspaceId, userId);

    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider },
    });

    if (!integration) {
      throw new ForbiddenException('Integration not found');
    }

    integration.config = { ...integration.config, ...config };
    return this.integrationsRepository.save(integration);
  }

  async delete(
    workspaceId: string,
    userId: string,
    provider: Provider,
  ): Promise<void> {
    await this.checkAdminAccess(workspaceId, userId);
    await this.integrationsRepository.softDelete({ workspaceId, provider });
  }

  private async checkAccess(workspaceId: string, userId: string) {
    const member = await this.workspacesService.checkAccess(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
    return member;
  }

  private async checkAdminAccess(workspaceId: string, userId: string) {
    const member = await this.checkAccess(workspaceId, userId);
    if (member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return member;
  }
}
