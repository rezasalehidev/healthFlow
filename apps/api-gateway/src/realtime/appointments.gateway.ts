import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';

export interface AppointmentRealtimePayload {
  type: string;
  appointmentId?: string;
  patientId?: string;
  doctorId?: string;
  status?: string;
  occurredAt: string;
  [key: string]: unknown;
}

interface GatewayJwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

/**
 * Real-time appointment updates.
 * Clients connect with: io(..., { auth: { token: '<accessJwt>' } })
 * Then optionally: emit('subscribe.appointment', { appointmentId })
 */
@WebSocketGateway({
  namespace: '/appointments',
  cors: { origin: true, credentials: true },
})
export class AppointmentsRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppointmentsRealtimeGateway.name);
  private readonly usersBySocketId = new Map<string, GatewayJwtPayload>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<GatewayJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      this.usersBySocketId.set(client.id, payload);
      await client.join(`user:${payload.sub}`);
      this.logger.log({ message: 'ws connected', userId: payload.sub, socketId: client.id });
    } catch (error: unknown) {
      this.logger.warn({
        message: 'ws auth failed',
        error: error instanceof Error ? error.message : error,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = this.usersBySocketId.get(client.id);
    this.usersBySocketId.delete(client.id);
    this.logger.log({
      message: 'ws disconnected',
      userId: user?.sub,
      socketId: client.id,
    });
  }

  @SubscribeMessage('subscribe.appointment')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { appointmentId?: string },
  ): { ok: boolean } {
    if (!body?.appointmentId) {
      return { ok: false };
    }
    void client.join(`appointment:${body.appointmentId}`);
    return { ok: true };
  }

  /** Broadcast an appointment domain event to relevant rooms. */
  broadcastAppointmentUpdate(event: AppointmentRealtimePayload): void {
    const rooms = new Set<string>();
    if (typeof event.appointmentId === 'string') {
      rooms.add(`appointment:${event.appointmentId}`);
    }
    if (typeof event.patientId === 'string') {
      rooms.add(`user:${event.patientId}`);
    }
    if (typeof event.doctorId === 'string') {
      rooms.add(`user:${event.doctorId}`);
    }

    const payload = {
      event: 'appointment.updated',
      data: event,
    };

    for (const room of rooms) {
      this.server.to(room).emit('appointment.updated', payload);
    }

    // Also emit on the namespace for subscribers listening broadly (demo)
    this.server.emit('appointment.updated', payload);

    this.logger.log({
      message: 'ws broadcast',
      type: event.type,
      appointmentId: event.appointmentId,
      rooms: [...rooms],
    });
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
