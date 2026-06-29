import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { JwtPayload } from '../../common/decorators/current-user.decorator';

import { AUDITED_KEY, AuditedOptions } from './audit.decorator';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    const auditedOptions = this.reflector.getAllAndOverride<AuditedOptions>(
      AUDITED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditedOptions) {
      return next.handle();
    }

    const user = request['user'] as JwtPayload | undefined;
    const resource =
      auditedOptions.resource || this.extractResource(request.path);
    const action =
      auditedOptions.action || `${request.method} ${request.path}`;

    return next.handle().pipe(
      tap(() => {
        // Fire and forget: don't await to not block the response
        this.auditService
          .logAction({
            userId: user?.sub,
            action,
            resource,
            resourceId: request.params?.id as string | undefined,
            metadata: {
              method: request.method,
              path: request.path,
              body: this.sanitizeBody(request.body),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .catch(() => {
            // Silently fail - audit logging should not break the request
          });
      }),
    );
  }

  private extractResource(path: string): string {
    // Extract resource name from path, e.g., /api/projects/123 -> projects
    const parts = path.split('/').filter(Boolean);
    // Skip 'api' prefix if present
    const startIdx = parts[0] === 'api' ? 1 : 0;
    return parts[startIdx] || 'unknown';
  }

  private sanitizeBody(
    body: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!body) return {};
    // Remove sensitive fields
    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'key',
      'apiKey',
    ];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
