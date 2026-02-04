import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WorkspaceIntegration } from "../database/entities/workspace-integration.entity";
import { Provider } from "../database/entities/user-connection.entity";

@Injectable()
export class WebhookWorkspaceService {
  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly workspaceIntegrationRepository: Repository<WorkspaceIntegration>,
  ) {}

  /**
   * Find workspace by GitHub repository full name
   * @param repoFullName - GitHub repository full name (e.g., "owner/repo")
   * @returns Workspace ID if found, null otherwise
   */
  async findWorkspaceByGitHubRepo(
    repoFullName: string,
  ): Promise<string | null> {
    const integration = await this.workspaceIntegrationRepository
      .createQueryBuilder("wi")
      .where("wi.provider = :provider", {
        provider: Provider.GITHUB,
      })
      .andWhere("wi.config->>'repoFullName' = :repoFullName", {
        repoFullName,
      })
      .getOne();

    return integration?.workspaceId || null;
  }

  /**
   * Find workspace by Slack team ID
   * @param teamId - Slack team ID
   * @returns Workspace ID if found, null otherwise
   */
  async findWorkspaceBySlackTeam(teamId: string): Promise<string | null> {
    const integration = await this.workspaceIntegrationRepository
      .createQueryBuilder("wi")
      .where("wi.provider = :provider", {
        provider: Provider.SLACK,
      })
      .andWhere("wi.config->>'teamId' = :teamId", { teamId })
      .getOne();

    return integration?.workspaceId || null;
  }

  /**
   * Find workspace by Notion workspace ID
   * @param notionWorkspaceId - Notion workspace ID
   * @returns Workspace ID if found, null otherwise
   */
  async findWorkspaceByNotionWorkspace(
    notionWorkspaceId: string,
  ): Promise<string | null> {
    const integration = await this.workspaceIntegrationRepository
      .createQueryBuilder("wi")
      .where("wi.provider = :provider", {
        provider: Provider.NOTION,
      })
      .andWhere("wi.config->>'workspaceId' = :workspaceId", {
        workspaceId: notionWorkspaceId,
      })
      .getOne();

    return integration?.workspaceId || null;
  }
}
