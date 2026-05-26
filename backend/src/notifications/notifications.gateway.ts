import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly jwt: JwtService) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie as string | undefined;
    const tokenFromCookie = cookieHeader
      ?.split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith('access_token='))
      ?.slice('access_token='.length);

    const rawToken =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization as string | undefined) ??
      tokenFromCookie;
    const token = rawToken?.startsWith('Bearer ')
      ? rawToken.slice(7)
      : rawToken;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      client.join(`user_${payload.sub}`);
      console.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
