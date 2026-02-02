import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConnection, Provider } from '../database/entities/user-connection.entity';

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(UserConnection)
    private readonly connectionsRepository: Repository<UserConnection>,
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
    },
  ): Promise<UserConnection> {
    const existing = await this.findByUserAndProvider(userId, provider);

    if (existing) {
      Object.assign(existing, data);
      return this.connectionsRepository.save(existing);
    }

    const connection = this.connectionsRepository.create({
      userId,
      provider,
      ...data,
    });
    return this.connectionsRepository.save(connection);
  }

  async delete(userId: string, provider: Provider): Promise<void> {
    await this.connectionsRepository.softDelete({ userId, provider });
  }
}
