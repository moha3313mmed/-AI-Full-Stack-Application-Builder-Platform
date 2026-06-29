import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RecoveryService, type SnapshotRecord, type RecoveryState } from './recovery.service';

/**
 * DTO for rollback requests.
 */
export class RollbackDto {
  snapshotId?: string;
}

/**
 * DTO for retry requests.
 */
export class RetryDto {
  strategy?: string;
}

/**
 * RecoveryController provides REST API endpoints for manual recovery operations.
 *
 * Endpoints:
 * - GET  /projects/:id/snapshots       - List available snapshots
 * - POST /projects/:id/rollback        - Rollback to a specific snapshot
 * - POST /projects/:id/retry           - Retry the last failed generation
 * - GET  /projects/:id/recovery/status - Get current recovery state
 *
 * All endpoints require JWT authentication (enforced globally via APP_GUARD
 * and explicitly via @UseGuards for defense-in-depth).
 */
@ApiTags('recovery')
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'List available snapshots for a project' })
  @ApiResponse({ status: 200, description: 'List of snapshots' })
  listSnapshots(@Param('id') projectId: string): SnapshotRecord[] {
    return this.recoveryService.listSnapshots(projectId);
  }

  @Post(':id/rollback')
  @ApiOperation({ summary: 'Rollback to a specific snapshot or latest good state' })
  @ApiResponse({ status: 201, description: 'Rollback completed' })
  @ApiResponse({ status: 404, description: 'Snapshot not found' })
  async rollback(
    @Param('id') projectId: string,
    @Body() dto: RollbackDto,
  ): Promise<{ success: boolean; snapshot: SnapshotRecord }> {
    const snapshot = await this.recoveryService.rollback(projectId, dto.snapshotId);
    return { success: true, snapshot };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry the last failed generation with a different strategy' })
  @ApiResponse({ status: 201, description: 'Retry initiated' })
  async retry(
    @Param('id') projectId: string,
    @Body() dto: RetryDto,
  ): Promise<{ success: boolean; message: string; strategy: string }> {
    // Retry rolls back to last good state first, then the caller can re-trigger generation
    const records = this.recoveryService.listSnapshots(projectId);
    const lastGood = [...records].reverse().find(
      (r) => r.status === 'confirmed' || r.status === 'pending',
    );

    if (lastGood) {
      await this.recoveryService.rollback(projectId, lastGood.id);
    }

    return {
      success: true,
      message: 'Rolled back to last good state. Ready for retry.',
      strategy: dto.strategy || 'default',
    };
  }

  @Get(':id/recovery/status')
  @ApiOperation({ summary: 'Get current recovery state for a project' })
  @ApiResponse({ status: 200, description: 'Recovery state' })
  getRecoveryStatus(@Param('id') projectId: string): RecoveryState {
    return this.recoveryService.getStatus(projectId);
  }
}
