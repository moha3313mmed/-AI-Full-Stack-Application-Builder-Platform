import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateMemoryDto } from './dto/create-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateMemoryDto) {
    return this.prisma.projectMemory.create({
      data: {
        projectId,
        category: dto.category,
        title: dto.title,
        content: dto.content,
        tags: dto.tags || [],
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string) {
    const memory = await this.prisma.projectMemory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException(`Memory entry with id "${id}" not found`);
    }

    return memory;
  }

  async search(projectId: string, query: QueryMemoryDto) {
    const where: Record<string, unknown> = { projectId };

    if (query.categories && query.categories.length > 0) {
      where.category = { in: query.categories };
    }

    if (query.tags && query.tags.length > 0) {
      where.tags = { hasSome: query.tags };
    }

    if (query.searchText) {
      where.OR = [
        { title: { contains: query.searchText, mode: 'insensitive' } },
        { content: { contains: query.searchText, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.projectMemory.findMany({
        where,
        take: query.limit || 20,
        skip: query.offset || 0,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.projectMemory.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, dto: UpdateMemoryDto) {
    const existing = await this.prisma.projectMemory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Memory entry with id "${id}" not found`);
    }

    return this.prisma.projectMemory.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as Prisma.InputJsonValue }),
        version: { increment: 1 },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.projectMemory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Memory entry with id "${id}" not found`);
    }

    return this.prisma.projectMemory.delete({
      where: { id },
    });
  }

  async listByProject(projectId: string, limit = 20, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.projectMemory.findMany({
        where: { projectId },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.projectMemory.count({ where: { projectId } }),
    ]);

    return { items, total };
  }

  async getByCategory(projectId: string, category: string) {
    return this.prisma.projectMemory.findMany({
      where: { projectId, category: category as never },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProjectContext(projectId: string): Promise<string> {
    const categories = [
      'ARCHITECTURE',
      'CODING_STANDARDS',
      'USER_PREFERENCES',
      'FEATURE_HISTORY',
      'BUSINESS_RULES',
      'DESIGN_LANGUAGE',
      'DATABASE_EVOLUTION',
      'DECISIONS',
    ];

    const allEntries = await this.prisma.projectMemory.findMany({
      where: {
        projectId,
        category: { in: categories as never[] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (allEntries.length === 0) {
      return 'No project context available.';
    }

    // Group by category and take top 5 per category
    const grouped = new Map<string, Array<{ title: string; content: string }>>();
    for (const entry of allEntries) {
      const cat = entry.category as string;
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      const group = grouped.get(cat)!;
      if (group.length < 5) {
        group.push({ title: entry.title, content: entry.content });
      }
    }

    const sections: string[] = [];
    for (const category of categories) {
      const entries = grouped.get(category);
      if (entries && entries.length > 0) {
        const categoryTitle = category.replace(/_/g, ' ');
        const entriesText = entries
          .map((e) => `- ${e.title}: ${e.content}`)
          .join('\n');
        sections.push(`## ${categoryTitle}\n${entriesText}`);
      }
    }

    if (sections.length === 0) {
      return 'No project context available.';
    }

    return `# Project Context\n\n${sections.join('\n\n')}`;
  }
}
