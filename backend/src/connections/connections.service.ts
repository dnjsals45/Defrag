import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConnection, Provider } from '../database/entities/user-connection.entity';
import { CryptoService } from '../common/services/crypto.service';

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(UserConnection)
    private readonly connectionsRepository: Repository<UserConnection>,
    private readonly cryptoService: CryptoService,
  ) {}

  async findAllByUser(userId: string) {
    const connections = await this.connectionsRepository.find({
      where: { userId },
    });

    const providers = Object.values(Provider);
    return providers.map((provider) => {
      const connection = connections.find((c) => c.provider === provider);
      return {
        provider,
        connected: !!connection,
        providerUserId: connection?.providerUserId || null,
      };
    });
  }

  async findByUserAndProvider(
    userId: string,
    provider: Provider,
  ): Promise<UserConnection | null> {
    return this.connectionsRepository.findOne({
      where: { userId, provider },
    });
  }

  async upsert(
    userId: string,
    provider: Provider,
    data: {
      providerUserId: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      installationId?: string;
    },
  ): Promise<UserConnection> {
    const existing = await this.findByUserAndProvider(userId, provider);

    // Encrypt tokens before storing
    const encryptedData = {
      ...data,
      accessToken: this.cryptoService.encrypt(data.accessToken),
      refreshToken: data.refreshToken
        ? this.cryptoService.encrypt(data.refreshToken)
        : undefined,
    };

    if (existing) {
      Object.assign(existing, encryptedData);
      return this.connectionsRepository.save(existing);
    }

    const connection = this.connectionsRepository.create({
      userId,
      provider,
      ...encryptedData,
    });
    return this.connectionsRepository.save(connection);
  }

  /**
   * Get decrypted access token for a connection
   */
  async getDecryptedAccessToken(
    userId: string,
    provider: Provider,
  ): Promise<string | null> {
    const connection = await this.findByUserAndProvider(userId, provider);
    if (!connection) return null;
    return this.cryptoService.safeDecrypt(connection.accessToken);
  }

  /**
   * Get decrypted refresh token for a connection
   */
  async getDecryptedRefreshToken(
    userId: string,
    provider: Provider,
  ): Promise<string | null> {
    const connection = await this.findByUserAndProvider(userId, provider);
    if (!connection?.refreshToken) return null;
    return this.cryptoService.safeDecrypt(connection.refreshToken);
  }

  async delete(userId: string, provider: Provider): Promise<void> {
    await this.connectionsRepository.softDelete({ userId, provider });
  }
}
