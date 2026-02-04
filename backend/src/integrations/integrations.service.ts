import { Injectable, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WorkspaceIntegration } from "../database/entities/workspace-integration.entity";
import { Provider } from "../database/entities/user-connection.entity";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { MemberRole } from "../database/entities/workspace-member.entity";
import { CryptoService } from "../common/services/crypto.service";

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly integrationsRepository: Repository<WorkspaceIntegration>,
    private readonly workspacesService: WorkspacesService,
    private readonly cryptoService: CryptoService,
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

    // Encrypt tokens before storing
    const encryptedData = {
      ...data,
      accessToken: this.cryptoService.encrypt(data.accessToken),
      refreshToken: data.refreshToken
        ? this.cryptoService.encrypt(data.refreshToken)
        : undefined,
    };

    // Include soft-deleted records to handle reconnection
    const existing = await this.integrationsRepository.findOne({
      where: { workspaceId, provider },
      withDeleted: true,
    });

    if (existing) {
      // Restore if soft-deleted
      if (existing.deletedAt) {
        existing.deletedAt = null;
      }
      Object.assign(existing, encryptedData);
      return this.integrationsRepository.save(existing);
    }

    const integration = this.integrationsRepository.create({
      workspaceId,
      provider,
      connectedBy: userId,
      ...encryptedData,
    });
    return this.integrationsRepository.save(integration);
  }

  /**
   * Get decrypted access token for an integration
   */
  async getDecryptedAccessToken(
    workspaceId: string,
    provider: Provider,
  ): Promise<string | null> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider },
    });
    if (!integration) return null;
    return this.cryptoService.safeDecrypt(integration.accessToken);
  }

  /**
   * Get decrypted refresh token for an integration
   */
  async getDecryptedRefreshToken(
    workspaceId: string,
    provider: Provider,
  ): Promise<string | null> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider },
    });
    if (!integration?.refreshToken) return null;
    return this.cryptoService.safeDecrypt(integration.refreshToken);
  }

  /**
   * Get GitHub selected repositories for a workspace
   */
  async getGitHubSelectedRepos(workspaceId: string): Promise<string[]> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider: Provider.GITHUB },
    });
    return integration?.config?.selectedRepos ?? [];
  }

  /**
   * Get Slack selected channels for a workspace
   */
  async getSlackSelectedChannels(workspaceId: string): Promise<string[]> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider: Provider.SLACK },
    });
    return integration?.config?.selectedChannels ?? [];
  }

  /**
   * Get Slack team ID for a workspace
   */
  async getSlackTeamId(workspaceId: string): Promise<string | null> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider: Provider.SLACK },
    });
    return integration?.config?.teamId ?? null;
  }

  /**
   * Get Notion selected pages for a workspace
   */
  async getNotionSelectedPages(workspaceId: string): Promise<string[]> {
    const integration = await this.integrationsRepository.findOne({
      where: { workspaceId, provider: Provider.NOTION },
    });
    return integration?.config?.selectedPages ?? [];
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
      throw new ForbiddenException("Integration not found");
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
    const member = await this.workspacesService.checkAccess(
      workspaceId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException("Access denied");
    }
    return member;
  }

  private async checkAdminAccess(workspaceId: string, userId: string) {
    const member = await this.checkAccess(workspaceId, userId);
    if (member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException("Admin access required");
    }
    return member;
  }
}
