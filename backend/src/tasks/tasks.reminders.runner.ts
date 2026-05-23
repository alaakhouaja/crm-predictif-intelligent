import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksRemindersRunner implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    const now = new Date();

    await this.notifyOverdue(now);
    await this.notifyDueSoon(now);
  }

  private async notifyOverdue(now: Date) {
    const overdue = await this.prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        dueDate: { lt: now },
        overdueNotifiedAt: null,
      },
      select: { id: true, title: true, dueDate: true, assignedToId: true },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    for (const t of overdue) {
      if (!t.assignedToId) continue;
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.task.findUnique({
          where: { id: t.id },
          select: { overdueNotifiedAt: true },
        });
        if (!current || current.overdueNotifiedAt) return;

        await tx.task.update({
          where: { id: t.id },
          data: { overdueNotifiedAt: now },
        });
      });

      await this.notifications.create(
        t.assignedToId,
        'Tâche en retard',
        `La tâche "${t.title}" est en retard (échéance: ${t.dueDate?.toLocaleString() ?? '—'}).`,
      );
    }
  }

  private async notifyDueSoon(now: Date) {
    const soon = new Date(now.getTime() + 60 * 60 * 1000);

    const dueSoon = await this.prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        dueDate: { gte: now, lte: soon },
        reminderNotifiedAt: null,
      },
      select: { id: true, title: true, dueDate: true, assignedToId: true },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    for (const t of dueSoon) {
      if (!t.assignedToId) continue;
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.task.findUnique({
          where: { id: t.id },
          select: { reminderNotifiedAt: true },
        });
        if (!current || current.reminderNotifiedAt) return;

        await tx.task.update({
          where: { id: t.id },
          data: { reminderNotifiedAt: now },
        });
      });

      await this.notifications.create(
        t.assignedToId,
        'Rappel de tâche',
        `La tâche "${t.title}" arrive à échéance (${t.dueDate?.toLocaleString() ?? '—'}).`,
      );
    }
  }
}

