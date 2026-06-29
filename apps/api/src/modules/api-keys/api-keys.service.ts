import { createHash, randomBytes } from 'crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateApiKeyDto } from './dto/create-api-key.dto';

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string; // full key, only returned once
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreateResult> {
    const rawKey = this.generateKey();
    const prefix = rawKey.substring(0, 8);
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix,
        scopes: dto.scopes || [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  async findAllByUser(userId: string) {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, keyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  async validateKey(
    rawKey: string,
  ): Promise<{ userId: string; scopes: string[] } | null> {
    const prefix = rawKey.substring(0, 8);
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        prefix,
        keyHash,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update lastUsedAt (fire-and-forget to avoid adding latency on the hot path)
    this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // Non-critical telemetry update - silently ignore failures
    });

    return {
      userId: apiKey.userId,
      scopes: apiKey.scopes,
    };
  }

  private generateKey(): string {
    return `bld_${randomBytes(32).toString('hex')}`;
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
