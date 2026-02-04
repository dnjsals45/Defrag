import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, AuthProvider } from "../database/entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: {
    email: string;
    password?: string | null;
    nickname: string;
    authProvider?: AuthProvider;
    providerId?: string | null;
    profileImage?: string | null;
  }): Promise<User> {
    const user = this.usersRepository.create({
      ...data,
      authProvider: data.authProvider || "local",
    });
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByProviderId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { authProvider: provider, providerId },
    });
  }

  async createSocialUser(data: {
    email: string;
    nickname: string;
    authProvider: AuthProvider;
    providerId: string;
    profileImage?: string | null;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email,
      nickname: data.nickname,
      authProvider: data.authProvider,
      providerId: data.providerId,
      profileImage: data.profileImage || null,
      password: null,
    });
    return this.usersRepository.save(user);
  }

  async linkSocialAccount(
    userId: string,
    provider: AuthProvider,
    providerId: string,
    profileImage?: string | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      authProvider: provider,
      providerId,
      ...(profileImage && { profileImage }),
    });
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { passwordResetToken: token },
    });
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expiry: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      passwordResetToken: token,
      passwordResetExpiry: expiry,
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
    });
  }
}
