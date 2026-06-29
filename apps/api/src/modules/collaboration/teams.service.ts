import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AddMemberDto } from './dto/add-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto) {
    const existing = await this.prisma.team.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Team with slug "${dto.slug}" already exists`);
    }

    return this.prisma.team.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
      },
    });
  }

  async findAll(limit = 20, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { members: true },
      }),
      this.prisma.team.count(),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { members: true, projects: true },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    return team;
  }

  async addMember(teamId: string, dto: AddMemberDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${teamId}" not found`);
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: dto.userId } },
    });

    if (existingMember) {
      throw new ConflictException(`User "${dto.userId}" is already a member of this team`);
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: dto.userId,
        role: dto.role,
        permissions: dto.permissions || [],
      },
    });
  }

  async removeMember(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) {
      throw new NotFoundException(`Member not found in team`);
    }

    return this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
  }
}
