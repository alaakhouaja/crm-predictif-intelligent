import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus, TaskType } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly taskInclude = {
    lead: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        ownerId: true,
      },
    },
    assignedTo: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
  } as const;

  private canReadAll(user: AuthUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.EXECUTIVE;
  }

  private canReadLeadAll(user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.EXECUTIVE ||
      user.role === UserRole.MARKETING
    );
  }

  private enforceTaskType(user: AuthUser, requested?: TaskType): TaskType {
    if (user.role === UserRole.MARKETING) return TaskType.MARKETING;
    if (user.role === UserRole.SALES) return TaskType.SALES;
    return requested ?? TaskType.SALES;
  }

  private async assertCanUseLead(user: AuthUser, leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (!this.canReadLeadAll(user) && lead.ownerId !== user.id) {
      throw new ForbiddenException('You can only use your own leads');
    }
  }

  private async ensureOverdueNotifications(userId: string) {
    const now = new Date();
    const overdue = await this.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: TaskStatus.OPEN,
        dueDate: { lt: now },
        overdueNotifiedAt: null,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    for (const t of overdue) {
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
        await this.notifications.create(
          userId,
          'Tâche en retard',
          `La tâche "${t.title}" est en retard (échéance: ${t.dueDate?.toLocaleString() ?? '—'}).`,
        );
      });
    }
  }

  private canReadTask(user: AuthUser, task: { type: TaskType; assignedToId: string | null; createdById: string; lead?: { ownerId: string } | null }) {
    if (this.canReadAll(user)) return true;

    if (user.role === UserRole.MARKETING) {
      return (
        task.type === TaskType.MARKETING ||
        task.assignedToId === user.id ||
        task.createdById === user.id
      );
    }

    return (
      task.assignedToId === user.id ||
      task.createdById === user.id ||
      task.lead?.ownerId === user.id
    );
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const type = this.enforceTaskType(user, dto.type);
    const assignedToId = dto.assignedToId ?? user.id;

    if (assignedToId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can assign tasks to someone else');
    }

    if (dto.leadId) {
      await this.assertCanUseLead(user, dto.leadId);
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        type,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        leadId: dto.leadId,
        assignedToId,
        createdById: user.id,
      },
      include: this.taskInclude,
    });

    await this.ensureOverdueNotifications(assignedToId);
    return task;
  }

  async findAll(
    user: AuthUser,
    query: {
      leadId?: string;
      assignedToId?: string;
      status?: TaskStatus;
      type?: TaskType;
      overdue?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.ensureOverdueNotifications(user.id);

    const {
      leadId,
      assignedToId,
      status,
      type,
      overdue,
      page = 1,
      limit = 10,
    } = query;

    if (leadId) await this.assertCanUseLead(user, leadId);

    if (
      assignedToId &&
      assignedToId !== user.id &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.EXECUTIVE
    ) {
      throw new ForbiddenException('You can only query your own tasks');
    }

    const where: Prisma.TaskWhereInput = {};
    if (leadId) where.leadId = leadId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (overdue === 'true') {
      where.status = TaskStatus.OPEN;
      where.dueDate = { lt: new Date() };
    }

    if (!this.canReadAll(user)) {
      if (user.role === UserRole.MARKETING) {
        where.OR = [
          { type: TaskType.MARKETING },
          { assignedToId: user.id },
          { createdById: user.id },
        ];
      } else {
        where.OR = [
          { assignedToId: user.id },
          { createdById: user.id },
          { lead: { ownerId: user.id } },
        ];
      }
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 10);
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.taskInclude,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: l,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      total,
      page: p,
      lastPage: Math.ceil(total / l) || 1,
    };
  }

  async findOne(user: AuthUser, id: string) {
    await this.ensureOverdueNotifications(user.id);

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!this.canReadTask(user, task)) throw new ForbiddenException();
    return task;
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        lead: { select: { ownerId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Task not found');
    if (
      user.role !== UserRole.ADMIN &&
      existing.createdById !== user.id &&
      existing.assignedToId !== user.id
    ) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    if (dto.leadId) {
      await this.assertCanUseLead(user, dto.leadId);
    }

    if (
      dto.assignedToId &&
      dto.assignedToId !== (existing.assignedToId ?? user.id) &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only admin can re-assign tasks');
    }

    const type = dto.type ? this.enforceTaskType(user, dto.type) : undefined;

    const status = dto.status;
    const completedAt =
      status === TaskStatus.DONE && !dto.completedAt
        ? new Date()
        : dto.completedAt
          ? new Date(dto.completedAt)
          : undefined;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type,
        priority: dto.priority,
        status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId,
        overdueNotifiedAt:
          status && status !== TaskStatus.OPEN ? null : undefined,
      },
      include: this.taskInclude,
    });

    const notifyFor = task.assignedToId ?? user.id;
    await this.ensureOverdueNotifications(notifyFor);
    return task;
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    if (user.role !== UserRole.ADMIN && existing.createdById !== user.id) {
      throw new ForbiddenException('You can only delete your own tasks');
    }

    return this.prisma.task.delete({ where: { id: existing.id } });
  }
}
