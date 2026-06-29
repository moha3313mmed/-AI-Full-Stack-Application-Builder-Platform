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

import { ProjectsService } from '../projects/projects.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/files',
})
export class FilesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FilesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly projectsService: ProjectsService,
  ) {}

  afterInit() {
    this.logger.log('Files WebSocket Gateway initialized');
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

  @SubscribeMessage('file:subscribe')
  async handleSubscribe(client: Socket, payload: { projectId: string }) {
    const userId = client.data.user?.sub;

    if (!userId) {
      return { event: 'file:error', data: { message: 'Authentication required' } };
    }

    // Verify project ownership before allowing subscription
    try {
      await this.projectsService.findOne(payload.projectId, userId);
    } catch {
      this.logger.warn(
        `Client ${client.id} denied access to project ${payload.projectId}`,
      );
      return { event: 'file:error', data: { message: 'Access denied' } };
    }

    client.join(`project:${payload.projectId}`);
    this.logger.log(`Client ${client.id} subscribed to project ${payload.projectId}`);
    return { event: 'file:subscribed', data: { projectId: payload.projectId } };
  }

  emitFileCreated(projectId: string, data: unknown) {
    this.server?.to(`project:${projectId}`).emit('file:created', data);
  }

  emitFileUpdated(projectId: string, data: unknown) {
    this.server?.to(`project:${projectId}`).emit('file:updated', data);
  }

  emitFileDeleted(projectId: string, data: unknown) {
    this.server?.to(`project:${projectId}`).emit('file:deleted', data);
  }

  emitFileMoved(projectId: string, data: unknown) {
    this.server?.to(`project:${projectId}`).emit('file:moved', data);
  }
}
