import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OAuthStateService } from './oauth-state.service';
import { GitHubOAuthService } from './providers/github.service';
import { SlackOAuthService } from './providers/slack.service';
import { NotionOAuthService } from './providers/notion.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    OAuthStateService,
    GitHubOAuthService,
    SlackOAuthService,
    NotionOAuthService,
  ],
  exports: [
    OAuthStateService,
    GitHubOAuthService,
    SlackOAuthService,
    NotionOAuthService,
  ],
})
export class OAuthModule {}
