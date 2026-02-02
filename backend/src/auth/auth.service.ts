import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const existingUser = await this.usersService.findByEmail(signUpDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(signUpDto.password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    const user = await this.usersService.create({
      ...signUpDto,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      isEmailVerified: false,
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    const tokens = this.generateTokens(user.id, user.email);

    return {
      message: '인증 이메일을 발송했습니다',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
      ...((!user.isEmailVerified) && { warning: '이메일 인증이 완료되지 않았습니다' }),
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }
      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestException('유효하지 않은 인증 토큰입니다');
    }

    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException('인증 토큰이 만료되었습니다');
    }

    await this.usersService.verifyEmail(user.id);

    return {
      message: '이메일 인증이 완료되었습니다',
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('이미 인증된 이메일입니다');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    await this.usersService.updateVerificationToken(
      user.id,
      verificationToken,
      verificationExpiry,
    );

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: '인증 이메일을 재발송했습니다',
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Security: Always return success even if user doesn't exist
    // to prevent email enumeration attacks
    if (!user) {
      return { message: '비밀번호 재설정 이메일을 발송했습니다' };
    }

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Set expiry to 1 hour from now
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    // Save token and expiry to database
    await this.usersService.setPasswordResetToken(user.id, resetToken, expiry);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: '비밀번호 재설정 이메일을 발송했습니다' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByPasswordResetToken(
      resetPasswordDto.token,
    );

    if (!user) {
      throw new BadRequestException('유효하지 않거나 만료된 토큰입니다');
    }

    // Check if token has expired
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('유효하지 않거나 만료된 토큰입니다');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);

    // Update password and clear reset token
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: '비밀번호가 변경되었습니다' };
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean }> {
    const user = await this.usersService.findByPasswordResetToken(token);

    if (!user) {
      return { valid: false };
    }

    // Check if token has expired
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return { valid: false };
    }

    return { valid: true };
  }

  private generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
    };
  }
}
