import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(userId: string, title: string, content: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        content,
      },
    });

    this.gateway.sendToUser(userId, 'notification', notification);
    return notification;
  }

  async createForAll(title: string, content: string) {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    const notifications = await this.prisma.$transaction(
      users.map(({ id }) =>
        this.prisma.notification.create({
          data: {
            userId: id,
            title,
            content,
          },
        }),
      ),
    );

    for (const notification of notifications) {
      this.gateway.sendToUser(notification.userId, 'notification', notification);
    }

    return notifications;
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only update your own notifications',
      );
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });
  }
}
