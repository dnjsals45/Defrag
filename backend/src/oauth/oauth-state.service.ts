import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';

interface OAuthStateData {
  userId?: string; // Optional for social login (user not yet authenticated)
  provider: string;
  workspaceId?: string; // For workspace integrations
  redirectUrl?: string;
}

@Injectable()
export class OAuthStateService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly STATE_TTL = 600; // 10 minutes

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  async generateState(data: OAuthStateData): Promise<string> {
    const state = randomBytes(32).toString('hex');
    const key = `oauth:state:${state}`;

    await this.redis.setex(key, this.STATE_TTL, JSON.stringify(data));

    return state;
  }

  async validateState(state: string): Promise<OAuthStateData | null> {
    const key = `oauth:state:${state}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    // Delete state after use (one-time use)
    await this.redis.del(key);

    return JSON.parse(data);
  }
}
