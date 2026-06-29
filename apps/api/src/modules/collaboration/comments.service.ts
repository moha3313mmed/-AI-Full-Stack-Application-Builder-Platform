import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, authorId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        projectId,
        authorId,
        content: dto.content,
        filePath: dto.filePath,
        lineNumber: dto.lineNumber,
        threadId: dto.threadId,
      },
    });
  }

  async findByProject(projectId: string, filePath?: string) {
    const where: Record<string, unknown> = { projectId };
    if (filePath) {
      where.filePath = filePath;
    }

    return this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async resolve(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }

    return this.prisma.comment.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
  }

  async update(id: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }

    return this.prisma.comment.update({
      where: { id },
      data: { content: dto.content },
    });
  }

  async delete(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }

  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { replies: true },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }

    return comment;
  }
}
