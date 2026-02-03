import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoogleOAuthService } from '../oauth/providers/google.service';
import { KakaoOAuthService } from '../oauth/providers/kakao.service';
import { OAuthStateService } from '../oauth/oauth-state.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly kakaoOAuthService: KakaoOAuthService,
    private readonly oauthStateService: OAuthStateService,
  ) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return {
      id: req.user.id,
      email: req.user.email,
      nickname: req.user.nickname,
      profileImage: req.user.profileImage,
      createdAt: req.user.createdAt,
    };
  }

  // Google OAuth
  @Get('google')
  async googleAuth(@Res() res: Response) {
    const state = await this.oauthStateService.generateState({ provider: 'google' });
    const authUrl = this.googleOAuthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    try {
      // Validate state
      const stateData = await this.oauthStateService.validateState(state);
      if (!stateData || stateData.provider !== 'google') {
        throw new BadRequestException('Invalid state');
      }

      // Exchange code for token
      const tokenResponse = await this.googleOAuthService.exchangeCodeForToken(code);

      // Get user info
      const googleUser = await this.googleOAuthService.getUser(tokenResponse.access_token);

      // Validate social login and get/create user
      const result = await this.authService.validateSocialLogin(
        'google',
        googleUser.id,
        googleUser.email,
        googleUser.name || googleUser.email.split('@')[0],
        googleUser.picture,
      );

      // Redirect to frontend with tokens
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: String(result.isNewUser),
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  // Kakao OAuth
  @Get('kakao')
  async kakaoAuth(@Res() res: Response) {
    const state = await this.oauthStateService.generateState({ provider: 'kakao' });
    const authUrl = this.kakaoOAuthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  @Get('kakao/callback')
  async kakaoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    try {
      // Validate state
      const stateData = await this.oauthStateService.validateState(state);
      if (!stateData || stateData.provider !== 'kakao') {
        throw new BadRequestException('Invalid state');
      }

      // Exchange code for token
      const tokenResponse = await this.kakaoOAuthService.exchangeCodeForToken(code);

      // Get user info
      const kakaoUser = await this.kakaoOAuthService.getUser(tokenResponse.access_token);

      // Extract user info from Kakao response
      const email = kakaoUser.kakao_account?.email;
      const nickname = kakaoUser.kakao_account?.profile?.nickname || `kakao_${kakaoUser.id}`;
      const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url;

      if (!email) {
        throw new BadRequestException('이메일 제공 동의가 필요합니다');
      }

      // Validate social login and get/create user
      const result = await this.authService.validateSocialLogin(
        'kakao',
        String(kakaoUser.id),
        email,
        nickname,
        profileImage,
      );

      // Redirect to frontend with tokens
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: String(result.isNewUser),
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      console.error('Kakao OAuth error:', error);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('verify-reset-token')
  async verifyResetToken(@Query('token') token: string) {
    return this.authService.verifyResetToken(token);
  }
}
