import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OAuthStateService } from './oauth-state.service';
import { GitHubOAuthService } from './providers/github.service';
import { SlackOAuthService } from './providers/slack.service';
import { NotionOAuthService } from './providers/notion.service';
import { GoogleOAuthService } from './providers/google.service';
import { KakaoOAuthService } from './providers/kakao.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    OAuthStateService,
    GitHubOAuthService,
    SlackOAuthService,
    NotionOAuthService,
    GoogleOAuthService,
    KakaoOAuthService,
  ],
  exports: [
    OAuthStateService,
    GitHubOAuthService,
    SlackOAuthService,
    NotionOAuthService,
    GoogleOAuthService,
    KakaoOAuthService,
  ],
})
export class OAuthModule {}
