import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { TriggerScanDto } from './dto/trigger-scan.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async triggerScan(dto: TriggerScanDto) {
    const scan = await this.prisma.securityScan.create({
      data: {
        projectId: dto.projectId,
        scanType: dto.scanType,
        status: 'PENDING',
        triggeredBy: dto.triggeredBy || 'system',
        startedAt: new Date(),
      },
    });

    // TODO: This is a stub implementation. In production, this should queue the
    // scan for asynchronous processing using the @builder/security pipeline
    // (ScanPipeline class). The pipeline would read project files, run the
    // registered scanners, and update the scan record with real findings and
    // scores upon completion. The current implementation immediately marks the
    // scan as COMPLETED with a perfect score, which masks real vulnerabilities.
    const completedScan = await this.prisma.securityScan.update({
      where: { id: scan.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        score: 100,
        findingsCount: 0,
        findings: '[]' as unknown as Prisma.InputJsonValue,
      },
    });

    return completedScan;
  }

  async getScansByProject(projectId: string, limit = 20, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.securityScan.findMany({
        where: { projectId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.securityScan.count({ where: { projectId } }),
    ]);

    return { items, total };
  }

  async getScanById(projectId: string, scanId: string) {
    const scan = await this.prisma.securityScan.findFirst({
      where: { id: scanId, projectId },
    });

    if (!scan) {
      throw new NotFoundException(
        `Security scan with id "${scanId}" not found for project "${projectId}"`,
      );
    }

    return scan;
  }

  async getSecurityScore(projectId: string) {
    // Get the most recent completed scan for each scan type
    const latestScans = await this.prisma.securityScan.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    if (latestScans.length === 0) {
      return {
        projectId,
        overallScore: null,
        scansCompleted: 0,
        lastScanAt: null,
        message: 'No completed scans found for this project',
      };
    }

    const scores = latestScans
      .filter((scan) => scan.score !== null)
      .map((scan) => scan.score as number);

    const overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null;

    return {
      projectId,
      overallScore,
      scansCompleted: latestScans.length,
      lastScanAt: latestScans[0]?.completedAt,
      totalFindings: latestScans.reduce((sum, s) => sum + s.findingsCount, 0),
    };
  }

  async getRules(limit = 50, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.securityRule.findMany({
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
      }),
      this.prisma.securityRule.count(),
    ]);

    return { items, total };
  }

  async updateRule(id: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.securityRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Security rule with id "${id}" not found`);
    }

    return this.prisma.securityRule.update({
      where: { id },
      data: {
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
      },
    });
  }
}
