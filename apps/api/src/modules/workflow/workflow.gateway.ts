import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface WorkflowProgressEvent {
  workflowId: string;
  projectId: string;
  step: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  data?: unknown;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/workflow',
})
export class WorkflowGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WorkflowGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log('Workflow WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      this.logger.warn(`Client ${client.id} rejected: no token provided`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.emit('error', { message: 'Invalid authentication token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('workflow:subscribe')
  handleSubscribe(client: Socket, payload: { projectId: string }) {
    const userId = client.data.user?.sub;

    if (!userId) {
      return { event: 'workflow:error', data: { message: 'Authentication required' } };
    }

    client.join(`workflow:${payload.projectId}`);
    this.logger.log(`Client ${client.id} subscribed to workflow events for project ${payload.projectId}`);
    return { event: 'workflow:subscribed', data: { projectId: payload.projectId } };
  }

  emitWorkflowStarted(projectId: string, data: WorkflowProgressEvent) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:started', data);
  }

  emitWorkflowProgress(projectId: string, data: WorkflowProgressEvent) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:progress', data);
  }

  emitWorkflowFilesUpdated(projectId: string, data: { workflowId: string; files: string[] }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:files-updated', data);
  }

  emitWorkflowCompleted(projectId: string, data: WorkflowProgressEvent) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:completed', data);
  }

  emitWorkflowError(projectId: string, data: WorkflowProgressEvent) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:error', data);
  }

  // ==========================================================================
  // Per-Agent Progress Events for Parallel Execution
  // ==========================================================================

  emitAgentStarted(projectId: string, data: { agentRole: string; taskDescription: string }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:agent-started', data);
  }

  emitAgentProgress(projectId: string, data: { agentRole: string; status: string; filesGenerated: string[] }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:agent-progress', data);
  }

  emitAgentCompleted(projectId: string, data: { agentRole: string; result: Record<string, unknown> }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:agent-completed', data);
  }

  emitPlanProgress(projectId: string, data: { completedTasks: number; totalTasks: number; parallelGroup: number }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:plan-progress', data);
  }

  // ==========================================================================
  // Recovery and Rollback Events
  // ==========================================================================

  emitRollbackStarted(projectId: string, data: { reason: string; snapshotId: string }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:rollback-started', data);
  }

  emitRollbackCompleted(projectId: string, data: { restoredSnapshotId: string; filesRestored: number }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:rollback-completed', data);
  }

  emitRetryStarted(projectId: string, data: { attempt: number; strategy: string }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:retry-started', data);
  }

  emitValidationFailed(projectId: string, data: { errors: string[]; willRollback: boolean }) {
    this.server?.to(`workflow:${projectId}`).emit('workflow:validation-failed', data);
  }
}
