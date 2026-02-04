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
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { SignUpDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { GoogleOAuthService } from "../oauth/providers/google.service";
import { KakaoOAuthService } from "../oauth/providers/kakao.service";
import { OAuthStateService } from "../oauth/oauth-state.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly kakaoOAuthService: KakaoOAuthService,
    private readonly oauthStateService: OAuthStateService,
  ) {}

  @Post("signup")
  @ApiOperation({ summary: "회원가입", description: "이메일/비밀번호로 회원가입" })
  @ApiResponse({ status: 201, description: "회원가입 성공" })
  @ApiResponse({ status: 409, description: "이미 존재하는 이메일" })
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post("login")
  @ApiOperation({ summary: "로그인", description: "이메일/비밀번호로 로그인" })
  @ApiResponse({ status: 200, description: "로그인 성공, JWT 토큰 반환" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "토큰 갱신", description: "리프레시 토큰으로 액세스 토큰 갱신" })
  @ApiResponse({ status: 200, description: "토큰 갱신 성공" })
  @ApiResponse({ status: 401, description: "유효하지 않은 리프레시 토큰" })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "내 정보 조회", description: "현재 로그인한 사용자 정보 조회" })
  @ApiResponse({ status: 200, description: "사용자 정보 반환" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  async me(@Request() req: any) {
    return {
      id: req.user.id,
      email: req.user.email,
      nickname: req.user.nickname,
      profileImage: req.user.profileImage,
      createdAt: req.user.createdAt,
    };
  }

  @Get("google")
  @ApiOperation({ summary: "Google OAuth 시작", description: "Google 로그인 페이지로 리다이렉트" })
  @ApiResponse({ status: 302, description: "Google OAuth 페이지로 리다이렉트" })
  async googleAuth(@Res() res: Response) {
    const state = await this.oauthStateService.generateState({
      provider: "google",
    });
    const authUrl = this.googleOAuthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  @Get("google/callback")
  @ApiOperation({ summary: "Google OAuth 콜백", description: "Google 인증 후 콜백 처리" })
  @ApiResponse({ status: 302, description: "프론트엔드로 리다이렉트 (토큰 포함)" })
  async googleCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get("FRONTEND_URL") || "http://localhost:3000";

    try {
      const stateData = await this.oauthStateService.validateState(state);
      if (!stateData || stateData.provider !== "google") {
        throw new BadRequestException("Invalid state");
      }

      const tokenResponse =
        await this.googleOAuthService.exchangeCodeForToken(code);

      const googleUser = await this.googleOAuthService.getUser(
        tokenResponse.access_token,
      );

      const result = await this.authService.validateSocialLogin(
        "google",
        googleUser.id,
        googleUser.email,
        googleUser.name || googleUser.email.split("@")[0],
        googleUser.picture,
      );

      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: String(result.isNewUser),
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error: any) {
      console.error("Google OAuth error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @Get("kakao")
  @ApiOperation({ summary: "Kakao OAuth 시작", description: "Kakao 로그인 페이지로 리다이렉트" })
  @ApiResponse({ status: 302, description: "Kakao OAuth 페이지로 리다이렉트" })
  async kakaoAuth(@Res() res: Response) {
    const state = await this.oauthStateService.generateState({
      provider: "kakao",
    });
    const authUrl = this.kakaoOAuthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  @Get("kakao/callback")
  @ApiOperation({ summary: "Kakao OAuth 콜백", description: "Kakao 인증 후 콜백 처리" })
  @ApiResponse({ status: 302, description: "프론트엔드로 리다이렉트 (토큰 포함)" })
  async kakaoCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get("FRONTEND_URL") || "http://localhost:3000";

    try {
      const stateData = await this.oauthStateService.validateState(state);
      if (!stateData || stateData.provider !== "kakao") {
        throw new BadRequestException("Invalid state");
      }

      const tokenResponse =
        await this.kakaoOAuthService.exchangeCodeForToken(code);

      const kakaoUser = await this.kakaoOAuthService.getUser(
        tokenResponse.access_token,
      );

      const email = kakaoUser.kakao_account?.email;
      const nickname =
        kakaoUser.kakao_account?.profile?.nickname || `kakao_${kakaoUser.id}`;
      const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url;

      if (!email) {
        throw new BadRequestException("이메일 제공 동의가 필요합니다");
      }

      const result = await this.authService.validateSocialLogin(
        "kakao",
        String(kakaoUser.id),
        email,
        nickname,
        profileImage,
      );

      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: String(result.isNewUser),
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      console.error("Kakao OAuth error:", error);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "비밀번호 찾기", description: "비밀번호 재설정 이메일 발송" })
  @ApiResponse({ status: 200, description: "이메일 발송 성공" })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "비밀번호 재설정", description: "토큰을 통한 비밀번호 재설정" })
  @ApiResponse({ status: 200, description: "비밀번호 재설정 성공" })
  @ApiResponse({ status: 400, description: "유효하지 않은 토큰" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get("verify-reset-token")
  @ApiOperation({ summary: "재설정 토큰 검증", description: "비밀번호 재설정 토큰 유효성 확인" })
  @ApiResponse({ status: 200, description: "유효한 토큰" })
  @ApiResponse({ status: 400, description: "유효하지 않은 토큰" })
  async verifyResetToken(@Query("token") token: string) {
    return this.authService.verifyResetToken(token);
  }
}
