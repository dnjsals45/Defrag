import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      createdAt: req.user.createdAt,
    };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendDto.email);
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
