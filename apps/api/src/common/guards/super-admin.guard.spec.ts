import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuperAdminGuard, Reflector],
    }).compile();

    guard = module.get<SuperAdminGuard>(SuperAdminGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(user?: { sub?: string; email?: string; role?: string }): ExecutionContext {
    const request = { user } as any;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn() as any,
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('when superAdminOnly metadata is not set', () => {
    it('should allow access regardless of user role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockContext({ sub: 'user-1', role: 'USER' });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access even without a user', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockContext(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when superAdminOnly metadata is set', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    });

    it('should allow SUPER_ADMIN users', () => {
      const context = createMockContext({
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject regular ADMIN users', () => {
      const context = createMockContext({
        sub: 'admin-2',
        email: 'admin2@example.com',
        role: 'ADMIN',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Super Admin access required');
    });

    it('should reject regular USER role', () => {
      const context = createMockContext({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should reject when user has no role', () => {
      const context = createMockContext({
        sub: 'user-1',
        email: 'user@example.com',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should reject when user is undefined', () => {
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should reject when request has no user property', () => {
      const request = {} as any;
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn() as any,
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
