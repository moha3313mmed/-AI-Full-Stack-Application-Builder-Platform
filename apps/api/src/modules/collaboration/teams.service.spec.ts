import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { TeamRoleDto } from './dto/add-member.dto';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;

  const mockPrismaService = {
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new team', async () => {
      const dto = { name: 'Frontend Team', slug: 'frontend-team', description: 'Frontend devs' };
      const expected = { id: 'team-1', ...dto, createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.team.findUnique.mockResolvedValue(null);
      mockPrismaService.team.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(result).toEqual(expected);
      expect(mockPrismaService.team.create).toHaveBeenCalledWith({
        data: { name: 'Frontend Team', slug: 'frontend-team', description: 'Frontend devs' },
      });
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'existing', slug: 'frontend-team' });

      await expect(
        service.create({ name: 'Frontend Team', slug: 'frontend-team' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return teams with pagination', async () => {
      const items = [{ id: 'team-1', name: 'Team A', members: [] }];
      mockPrismaService.team.findMany.mockResolvedValue(items);
      mockPrismaService.team.count.mockResolvedValue(1);

      const result = await service.findAll(10, 0);

      expect(result).toEqual({ items, total: 1 });
      expect(mockPrismaService.team.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: { members: true },
      });
    });
  });

  describe('findById', () => {
    it('should return a team by id', async () => {
      const expected = { id: 'team-1', name: 'Team A', members: [], projects: [] };
      mockPrismaService.team.findUnique.mockResolvedValue(expected);

      const result = await service.findById('team-1');
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('should add a member to a team', async () => {
      const dto = { userId: 'user-1', role: TeamRoleDto.EDITOR };
      const expected = { id: 'member-1', teamId: 'team-1', userId: 'user-1', role: 'EDITOR' };

      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'team-1' });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue(expected);

      const result = await service.addMember('team-1', dto);
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('non-existent', { userId: 'user-1', role: TeamRoleDto.VIEWER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already a member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'team-1' });
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addMember('team-1', { userId: 'user-1', role: TeamRoleDto.EDITOR }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from a team', async () => {
      const member = { id: 'member-1', teamId: 'team-1', userId: 'user-1' };
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamMember.delete.mockResolvedValue(member);

      const result = await service.removeMember('team-1', 'user-1');
      expect(result).toEqual(member);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('team-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
