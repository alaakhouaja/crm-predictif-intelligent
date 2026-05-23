import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { Prisma, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
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

  private readonly attachmentSelect = {
    id: true,
    originalName: true,
    mimeType: true,
    size: true,
    createdAt: true,
    uploadedBy: {
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

  private allowedTypes(user: AuthUser): TaskType[] {
    if (user.role === UserRole.ADMIN) {
      return Object.values(TaskType);
    }
    if (user.role === UserRole.SALES) {
      return [
        TaskType.SALES,
        TaskType.CALL,
        TaskType.MEETING,
        TaskType.EMAIL_FOLLOW_UP,
      ];
    }
    if (user.role === UserRole.MARKETING) {
      return [TaskType.MARKETING, TaskType.EMAIL_FOLLOW_UP];
    }
    return [];
  }

  private normalizeType(user: AuthUser, requested?: TaskType): TaskType {
    const allowed = this.allowedTypes(user);
    const fallback = allowed[0] ?? TaskType.SALES;
    const t = requested ?? fallback;
    if (user.role !== UserRole.ADMIN && !allowed.includes(t)) {
      throw new ForbiddenException('Task type not allowed for this role');
    }
    return t;
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
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
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
    const type = this.normalizeType(user, dto.type);
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
        progress: dto.progress,
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
      search?: string;
      overdue?: string;
      sortBy?: string;
      sortDir?: string;
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
      search,
      overdue,
      sortBy,
      sortDir,
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

    const where = this.buildWhere(user, {
      leadId,
      assignedToId,
      status,
      type,
      search,
      overdue,
    });

    const orderBy = this.buildOrderBy(sortBy, sortDir);

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 10);
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.taskInclude,
        orderBy,
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
      include: {
        ...this.taskInclude,
        attachments: {
          select: this.attachmentSelect,
          orderBy: { createdAt: 'desc' },
        },
      },
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

    const type = dto.type ? this.normalizeType(user, dto.type) : undefined;

    const status = dto.status;
    const completedAt =
      status === TaskStatus.DONE
        ? dto.completedAt
          ? new Date(dto.completedAt)
          : new Date()
        : status
          ? null
          : undefined;

    const progress =
      status === TaskStatus.DONE
        ? 100
        : dto.progress;

    const resetNotifications =
      dto.dueDate !== undefined ||
      dto.status !== undefined;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type,
        priority: dto.priority,
        status,
        progress,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId,
        overdueNotifiedAt: resetNotifications ? null : undefined,
        reminderNotifiedAt: resetNotifications ? null : undefined,
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

  async getActivity(user: AuthUser, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        assignedToId: true,
        createdById: true,
        lead: { select: { ownerId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!this.canReadTask(user, task)) throw new ForbiddenException();

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityId: id,
        entityType: { in: ['task', 'Task', 'TASK'] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs;
  }

  async addAttachment(
    user: AuthUser,
    taskId: string,
    file: { path: string; originalname: string; mimetype: string; size: number },
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        type: true,
        lead: { select: { ownerId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (
      user.role !== UserRole.ADMIN &&
      task.createdById !== user.id &&
      task.assignedToId !== user.id
    ) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById: user.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
      },
      select: this.attachmentSelect,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ATTACH',
        entityType: 'task',
        entityId: taskId,
        newValue: {
          attachmentId: attachment.id,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.size,
        },
      },
    });

    return attachment;
  }

  async listAttachments(user: AuthUser, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        type: true,
        assignedToId: true,
        createdById: true,
        lead: { select: { ownerId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!this.canReadTask(user, task)) throw new ForbiddenException();

    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      select: this.attachmentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAttachmentForDownload(user: AuthUser, attachmentId: string) {
    const att = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        taskId: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        task: {
          select: {
            type: true,
            assignedToId: true,
            createdById: true,
            lead: { select: { ownerId: true } },
          },
        },
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (!this.canReadTask(user, att.task)) throw new ForbiddenException();

    return {
      id: att.id,
      originalName: att.originalName,
      mimeType: att.mimeType,
      storagePath: att.storagePath,
    };
  }

  async removeAttachment(user: AuthUser, attachmentId: string) {
    const att = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        taskId: true,
        storagePath: true,
        task: {
          select: {
            createdById: true,
            assignedToId: true,
          },
        },
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (
      user.role !== UserRole.ADMIN &&
      att.task.createdById !== user.id &&
      att.task.assignedToId !== user.id
    ) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    await this.prisma.taskAttachment.delete({ where: { id: att.id } });
    await unlink(att.storagePath).catch(() => undefined);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DETACH',
        entityType: 'task',
        entityId: att.taskId,
        newValue: { attachmentId: att.id },
      },
    });

    return { ok: true };
  }

  async getStats(
    user: AuthUser,
    query: {
      leadId?: string;
      assignedToId?: string;
      status?: TaskStatus;
      type?: TaskType;
      search?: string;
      overdue?: string;
    },
  ) {
    await this.ensureOverdueNotifications(user.id);

    const where = this.buildWhere(user, query);
    const now = new Date();

    const [total, completed, overdueCount, highPriority] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: { AND: [where, { status: TaskStatus.DONE }] },
      }),
      this.prisma.task.count({
        where: {
          AND: [
            where,
            {
              status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
              dueDate: { lt: now },
            },
          ],
        },
      }),
      this.prisma.task.count({
        where: {
          AND: [
            where,
            {
              priority: TaskPriority.HIGH,
              status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
            },
          ],
        },
      }),
    ]);

    return {
      total,
      completed,
      overdue: overdueCount,
      highPriority,
    };
  }

  private buildWhere(
    user: AuthUser,
    query: {
      leadId?: string;
      assignedToId?: string;
      status?: TaskStatus;
      type?: TaskType;
      search?: string;
      overdue?: string;
    },
  ): Prisma.TaskWhereInput {
    const { leadId, assignedToId, status, type, search, overdue } = query;
    const and: Prisma.TaskWhereInput[] = [];

    if (leadId) and.push({ leadId });
    if (assignedToId) and.push({ assignedToId });
    if (type) and.push({ type });

    if (overdue === 'true') {
      and.push({
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        dueDate: { lt: new Date() },
      });
    } else if (status) {
      and.push({ status });
    }

    if (search && search.trim()) {
      const q = search.trim();
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (!this.canReadAll(user)) {
      if (user.role === UserRole.MARKETING) {
        and.push({
          OR: [
            { type: TaskType.MARKETING },
            { assignedToId: user.id },
            { createdById: user.id },
          ],
        });
      } else {
        and.push({
          OR: [
            { assignedToId: user.id },
            { createdById: user.id },
            { lead: { ownerId: user.id } },
          ],
        });
      }
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    sortBy?: string,
    sortDir?: string,
  ): Prisma.TaskOrderByWithRelationInput[] {
    const dir: Prisma.SortOrder = sortDir === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'priority') return [{ priority: dir }, { updatedAt: 'desc' }];
    if (sortBy === 'dueDate') return [{ dueDate: dir }, { updatedAt: 'desc' }];
    if (sortBy === 'status') return [{ status: dir }, { updatedAt: 'desc' }];
    if (sortBy === 'progress') return [{ progress: dir }, { updatedAt: 'desc' }];
    if (sortBy === 'createdAt') return [{ createdAt: dir }, { updatedAt: 'desc' }];

    return [{ status: 'asc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }];
  }
}
