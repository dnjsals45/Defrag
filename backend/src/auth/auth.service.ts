import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { UsersService } from "../users/users.service";
import { EmailService } from "../email/email.service";
import { SignUpDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthProvider } from "../database/entities/user.entity";

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
      throw new ConflictException("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(signUpDto.password, 10);

    const user = await this.usersService.create({
      ...signUpDto,
      password: hashedPassword,
      authProvider: "local",
    });

    const tokens = this.generateTokens(user.id, user.email);

    return {
      message: "회원가입이 완료되었습니다",
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Social login users cannot login with password
    if (user.authProvider !== "local" || !user.password) {
      throw new UnauthorizedException(
        `이 계정은 ${user.authProvider} 소셜 로그인으로 가입되었습니다`,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileImage: user.profileImage,
      },
      ...tokens,
    };
  }

  async validateSocialLogin(
    provider: AuthProvider,
    providerId: string,
    email: string,
    nickname: string,
    profileImage?: string,
  ) {
    // First, check if user exists with this provider ID
    let user = await this.usersService.findByProviderId(provider, providerId);

    if (user) {
      // User exists with this social account, return tokens
      const tokens = this.generateTokens(user.id, user.email);
      return {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          profileImage: user.profileImage,
        },
        ...tokens,
        isNewUser: false,
      };
    }

    // Check if user exists with this email
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      // Link social account to existing user
      await this.usersService.linkSocialAccount(
        existingUser.id,
        provider,
        providerId,
        profileImage,
      );

      const tokens = this.generateTokens(existingUser.id, existingUser.email);
      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          nickname: existingUser.nickname,
          profileImage: profileImage || existingUser.profileImage,
        },
        ...tokens,
        isNewUser: false,
        accountLinked: true,
      };
    }

    // Create new user with social account
    user = await this.usersService.createSocialUser({
      email,
      nickname,
      authProvider: provider,
      providerId,
      profileImage,
    });

    const tokens = this.generateTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileImage: user.profileImage,
      },
      ...tokens,
      isNewUser: true,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("Invalid token");
      }
      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Security: Always return success even if user doesn't exist
    // to prevent email enumeration attacks
    if (!user) {
      return { message: "비밀번호 재설정 이메일을 발송했습니다" };
    }

    // Social login users cannot reset password
    if (user.authProvider !== "local") {
      return { message: "비밀번호 재설정 이메일을 발송했습니다" };
    }

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set expiry to 1 hour from now
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    // Save token and expiry to database
    await this.usersService.setPasswordResetToken(user.id, resetToken, expiry);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: "비밀번호 재설정 이메일을 발송했습니다" };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByPasswordResetToken(
      resetPasswordDto.token,
    );

    if (!user) {
      throw new BadRequestException("유효하지 않거나 만료된 토큰입니다");
    }

    // Check if token has expired
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException("유효하지 않거나 만료된 토큰입니다");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);

    // Update password and clear reset token
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: "비밀번호가 변경되었습니다" };
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
      refreshToken: this.jwtService.sign(payload, { expiresIn: "30d" }),
    };
  }
}
