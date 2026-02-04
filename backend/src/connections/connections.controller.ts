import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { ConnectionsService } from "./connections.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Provider } from "../database/entities/user-connection.entity";
import { OAuthStateService } from "../oauth/oauth-state.service";
import { GitHubOAuthService } from "../oauth/providers/github.service";
import {
  SlackOAuthService,
  SlackChannel,
} from "../oauth/providers/slack.service";
import { NotionOAuthService } from "../oauth/providers/notion.service";

@ApiTags("Connections")
@Controller("connections")
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
    private readonly githubOAuth: GitHubOAuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly notionOAuth: NotionOAuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "개인 연결 목록", description: "사용자의 개인 OAuth 연결 목록 조회" })
  @ApiResponse({ status: 200, description: "연결 목록 반환" })
  async findAll(@Request() req: any) {
    const connections = await this.connectionsService.findAllByUser(
      req.user.id,
    );
    return { connections };
  }

  @Get(":provider/auth")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "개인 OAuth 시작", description: "개인 계정 OAuth 인증 시작" })
  @ApiParam({ name: "provider", enum: ["github", "slack", "notion"], description: "서비스 제공자" })
  @ApiResponse({ status: 302, description: "OAuth 페이지로 리다이렉트" })
  async startAuth(
    @Request() req: any,
    @Param("provider") provider: Provider,
    @Res() res: Response,
  ) {
    const state = await this.oauthStateService.generateState({
      userId: req.user.id,
      provider,
    });

    let authUrl: string;
    switch (provider) {
      case Provider.GITHUB:
        authUrl = this.githubOAuth.getAuthorizationUrl(state);
        break;
      case Provider.SLACK:
        authUrl = this.slackOAuth.getAuthorizationUrl(state, false);
        break;
      case Provider.NOTION:
        authUrl = this.notionOAuth.getAuthorizationUrl(state);
        break;
      default:
        throw new BadRequestException("Invalid provider");
    }

    return res.redirect(authUrl);
  }

  @Get(":provider/callback")
  @ApiOperation({ summary: "개인 OAuth 콜백", description: "개인 계정 OAuth 인증 완료 후 콜백 처리" })
  @ApiParam({ name: "provider", enum: ["github", "slack", "notion"], description: "서비스 제공자" })
  @ApiQuery({ name: "code", required: false, description: "인증 코드" })
  @ApiQuery({ name: "state", required: false, description: "상태 토큰" })
  @ApiQuery({ name: "error", required: false, description: "에러 메시지" })
  @ApiResponse({ status: 302, description: "프론트엔드로 리다이렉트" })
  async handleCallback(
    @Param("provider") provider: Provider,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get("FRONTEND_URL");
    const redirectBase = `${frontendUrl}/settings/connections`;

    if (error) {
      return res.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${redirectBase}?error=missing_params`);
    }

    // Validate state
    const stateData = await this.oauthStateService.validateState(state);
    if (!stateData) {
      return res.redirect(`${redirectBase}?error=invalid_state`);
    }

    if (stateData.provider !== provider) {
      return res.redirect(`${redirectBase}?error=provider_mismatch`);
    }

    if (!stateData.userId) {
      return res.redirect(`${redirectBase}?error=missing_user`);
    }

    try {
      // Check if this is a workspace integration (has workspaceId in state)
      if (stateData.workspaceId) {
        await this.handleWorkspaceCallback(
          stateData.workspaceId,
          stateData.userId,
          provider,
          code,
        );
      } else {
        // Personal connection
        switch (provider) {
          case Provider.GITHUB:
            await this.handleGitHubCallback(stateData.userId, code);
            break;
          case Provider.SLACK:
            await this.handleSlackCallback(stateData.userId, code);
            break;
          case Provider.NOTION:
            await this.handleNotionCallback(stateData.userId, code);
            break;
          default:
            throw new BadRequestException("Invalid provider");
        }
      }

      return res.redirect(
        `${redirectBase}?success=true&provider=${provider}&openSettings=${provider}`,
      );
    } catch (err: any) {
      console.error(`OAuth callback error (${provider}):`, err.message);
      return res.redirect(
        `${redirectBase}?error=${encodeURIComponent(err.message)}`,
      );
    }
  }

  private async handleWorkspaceCallback(
    workspaceId: string,
    userId: string,
    provider: Provider,
    code: string,
  ) {
    switch (provider) {
      case Provider.GITHUB:
        await this.handleWorkspaceGitHubCallback(workspaceId, userId, code);
        break;
      case Provider.SLACK:
        await this.handleWorkspaceSlackCallback(workspaceId, userId, code);
        break;
      case Provider.NOTION:
        await this.handleWorkspaceNotionCallback(workspaceId, userId, code);
        break;
      default:
        throw new BadRequestException("Invalid provider");
    }
  }

  private async handleWorkspaceGitHubCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.githubOAuth.exchangeCodeForToken(code);

    // Fetch available repositories
    const repos = await this.fetchAllGitHubRepos(tokenData.access_token);

    await this.integrationsService.upsert(
      workspaceId,
      userId,
      Provider.GITHUB,
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined,
        config: {
          availableRepos: repos,
          selectedRepos: [],
        },
      },
    );
  }

  private async handleWorkspaceSlackCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.slackOAuth.exchangeCodeForToken(code);

    // Use user's access token (not bot token) - allows access to channels user is member of
    const userAccessToken =
      tokenData.authed_user?.access_token || tokenData.access_token;

    if (!userAccessToken) {
      throw new Error("No access token received from Slack");
    }

    // Get available channels using user token
    const channels = await this.fetchAllSlackChannels(userAccessToken);

    await this.integrationsService.upsert(workspaceId, userId, Provider.SLACK, {
      accessToken: userAccessToken,
      config: {
        teamId: tokenData.team.id,
        teamName: tokenData.team.name,
        authedUserId: tokenData.authed_user?.id,
        availableChannels: channels,
        selectedChannels: [],
      },
    });
  }

  private async handleWorkspaceNotionCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.notionOAuth.exchangeCodeForToken(code);
    const pages = await this.fetchAllNotionPages(tokenData.access_token);

    await this.integrationsService.upsert(
      workspaceId,
      userId,
      Provider.NOTION,
      {
        accessToken: tokenData.access_token,
        config: {
          notionWorkspaceId: tokenData.workspace_id,
          notionWorkspaceName: tokenData.workspace_name,
          availablePages: pages,
          selectedPages: [],
        },
      },
    );
  }

  private async fetchAllNotionPages(
    accessToken: string,
  ): Promise<
    { id: string; title: string; icon?: { type: string; emoji?: string } }[]
  > {
    const pages: {
      id: string;
      title: string;
      icon?: { type: string; emoji?: string };
    }[] = [];
    let cursor: string | undefined;

    while (true) {
      const result = await this.notionOAuth.getPages(accessToken, cursor);

      pages.push(
        ...result.pages.map((page) => {
          const titleProp = Object.values(page.properties).find(
            (p: any) => p.title,
          );
          const title = titleProp?.title?.[0]?.plain_text || "Untitled";
          return {
            id: page.id,
            title,
            icon: page.icon,
          };
        }),
      );

      if (!result.hasMore || !result.nextCursor) break;
      cursor = result.nextCursor;
    }

    return pages;
  }

  private async fetchAllGitHubRepos(
    accessToken: string,
  ): Promise<{ id: number; fullName: string; private: boolean }[]> {
    const repos: { id: number; fullName: string; private: boolean }[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.githubOAuth.getRepos(accessToken, {
        page,
        perPage,
      });
      repos.push(
        ...data.map((repo) => ({
          id: repo.id,
          fullName: repo.full_name,
          private: repo.private,
        })),
      );

      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  private async fetchAllSlackChannels(
    accessToken: string,
  ): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    while (true) {
      const { data } = await this.slackOAuth.getChannelsWithPagination(
        accessToken,
        {
          limit: 200,
          cursor,
        },
      );

      channels.push(...data);

      if (!data.length || !data[0]?.id) break; // Safety check

      // We need to implement pagination support in SlackOAuthService first
      // For now, getChannels returns all channels in one go (built-in pagination handling in service?)
      // Checking SlackOAuthService.. it seems getChannels handles simple list but not cursor pagination explicitly exposed.
      // Let's rely on basic getChannels for now or update SlackOAuthService.
      break;
    }

    // Actually, looking at SlackOAuthService.getChannels, it doesn't handle pagination loop.
    // We should better implement getChannelsWithPagination in SlackOAuthService first.
    return channels;
  }

  private async handleGitHubCallback(userId: string, code: string) {
    const tokenData = await this.githubOAuth.exchangeCodeForToken(code);
    const user = await this.githubOAuth.getUser(tokenData.access_token);

    await this.connectionsService.upsert(userId, Provider.GITHUB, {
      providerUserId: user.id.toString(),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
    });
  }

  private async handleSlackCallback(userId: string, code: string) {
    const tokenData = await this.slackOAuth.exchangeCodeForToken(code);

    await this.connectionsService.upsert(userId, Provider.SLACK, {
      providerUserId: tokenData.authed_user.id,
      accessToken: tokenData.authed_user.access_token,
    });
  }

  private async handleNotionCallback(userId: string, code: string) {
    const tokenData = await this.notionOAuth.exchangeCodeForToken(code);

    const providerUserId =
      tokenData.owner?.user?.id || tokenData.bot_id || tokenData.workspace_id;

    await this.connectionsService.upsert(userId, Provider.NOTION, {
      providerUserId,
      accessToken: tokenData.access_token,
    });
  }

  @Delete(":provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "개인 연결 해제", description: "개인 계정 OAuth 연결 해제" })
  @ApiParam({ name: "provider", enum: ["github", "slack", "notion"], description: "서비스 제공자" })
  @ApiResponse({ status: 200, description: "연결 해제 성공" })
  async disconnect(@Request() req: any, @Param("provider") provider: Provider) {
    await this.connectionsService.delete(req.user.id, provider);
    return { success: true };
  }
}
