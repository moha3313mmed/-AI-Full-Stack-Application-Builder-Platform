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

import { AgentsService } from './agents.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/agents',
})
export class AgentsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentsGateway.name);
  private agentsService!: AgentsService;

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Set the AgentsService reference (called after construction to avoid circular dependency).
   */
  setAgentsService(service: AgentsService): void {
    this.agentsService = service;
  }

  afterInit() {
    this.logger.log('Agents WebSocket Gateway initialized');
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

  @SubscribeMessage('agent:subscribe')
  handleSubscribe(client: Socket, payload: { workflowId: string }) {
    const userId = client.data.user?.sub;

    if (!userId) {
      return { event: 'agent:error', data: { message: 'Authentication required' } };
    }

    // Verify the workflow belongs to the requesting user
    if (this.agentsService && !this.agentsService.isWorkflowOwner(payload.workflowId, userId)) {
      this.logger.warn(
        `Client ${client.id} (user: ${userId}) denied subscription to workflow ${payload.workflowId}`,
      );
      return { event: 'agent:error', data: { message: 'Access denied: workflow does not belong to this user' } };
    }

    client.join(`workflow:${payload.workflowId}`);
    this.logger.log(`Client ${client.id} subscribed to workflow ${payload.workflowId}`);
    return { event: 'agent:subscribed', data: { workflowId: payload.workflowId } };
  }

  emitProgress(workflowId: string, data: unknown) {
    this.server?.to(`workflow:${workflowId}`).emit('agent:progress', data);
  }

  emitComplete(workflowId: string, data: unknown) {
    this.server?.to(`workflow:${workflowId}`).emit('agent:complete', data);
  }

  emitError(workflowId: string, data: unknown) {
    this.server?.to(`workflow:${workflowId}`).emit('agent:error', data);
  }
}
