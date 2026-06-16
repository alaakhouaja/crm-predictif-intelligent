import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  InteractionType,
  LeadStage,
  Prisma,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  IaService,
  type LeadPredictionFeatures,
} from '../ia/ia.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsService } from '../notifications/notifications.service';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly ia: IaService,
  ) {}

  private canReadAll(user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.EXECUTIVE ||
      user.role === UserRole.MARKETING
    );
  }

  private canCreate(user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.MARKETING ||
      user.role === UserRole.SALES
    );
  }

  private canUpdateAnyLead(user: AuthUser) {
    return user.role === UserRole.ADMIN;
  }

  private canUpdateCommercialFields(user: AuthUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SALES;
  }

  private canDelete(user: AuthUser) {
    return user.role === UserRole.ADMIN;
  }

  private readonly ownerSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
  };

  /**
   * Centralized mapping for lead selection to ensure consistency
   */
  private readonly leadInclude = {
    owner: { select: this.ownerSelect },
  };

  private readonly auditUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
  } as const;

  private snapshotLead(
    lead: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      company: string | null;
      source: string | null;
      stage: LeadStage;
      notes: string | null;
      score: number | null;
      conversionProbability: number | null;
      ownerId: string;
      isAnonymized?: boolean;
    },
  ) {
    return {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone ?? null,
      company: lead.company ?? null,
      source: lead.source ?? null,
      stage: lead.stage,
      notes: lead.notes ?? null,
      score: lead.score ?? null,
      conversionProbability: lead.conversionProbability ?? null,
      ownerId: lead.ownerId,
      isAnonymized: lead.isAnonymized ?? false,
    };
  }

  private diffLeadState(
    previous: ReturnType<LeadsService['snapshotLead']>,
    current: ReturnType<LeadsService['snapshotLead']>,
  ) {
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(current) as Array<keyof typeof current>) {
      if (previous[key] !== current[key]) {
        oldValue[key] = previous[key];
        newValue[key] = current[key];
      }
    }

    return { oldValue, newValue };
  }

  private async createLeadAuditLog(
    userId: string,
    action: string,
    entityId: string,
    payload: { oldValue?: Record<string, unknown>; newValue?: Record<string, unknown> },
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'Lead',
        entityId,
        oldValue: payload.oldValue as Prisma.InputJsonValue | undefined,
        newValue: payload.newValue as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async create(user: AuthUser, dto: CreateLeadDto) {
    if (!this.canCreate(user)) {
      throw new ForbiddenException();
    }
    const ownerId =
      user.role === UserRole.ADMIN && dto.ownerId ? dto.ownerId : user.id;
    const lead = await this.prisma.$transaction(async (tx) => {
      const createdLead = await tx.lead.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          company: dto.company,
          source: dto.source,
          stage: dto.stage ?? LeadStage.Nouveau,
          notes: dto.notes,
          score: dto.score,
          conversionProbability: dto.conversionProbability,
          ownerId,
          consentDate: dto.consentDate ? new Date(dto.consentDate) : new Date(),
          dataOrigin: dto.dataOrigin || 'formulaire',
        },
        include: this.leadInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'Lead',
          entityId: createdLead.id,
          newValue: this.snapshotLead(createdLead),
        },
      });

      return createdLead;
    });

    if (ownerId !== user.id) {
      await this.notifications.create(
        ownerId,
        'Nouveau lead assigné',
        `Le prospect ${lead.firstName} ${lead.lastName} vous a été assigné par ${user.email}`,
      );
    }

    return lead;
  }

  async createFromWebhook(dto: CreateLeadDto) {
    // Route webhook does not have a JWT user, so we attach the lead
    // to a real internal user account (admin first, fallback first user).
    const fallbackOwner = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });

    const anyUser =
      fallbackOwner ??
      (await this.prisma.user.findFirst({
        select: { id: true },
      }));

    if (!anyUser) {
      throw new BadRequestException('No user available to own webhook lead');
    }

    return this.prisma.lead.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        company: dto.company,
        source: dto.source ?? 'Webhook',
        stage: dto.stage ?? LeadStage.Nouveau,
        notes: dto.notes,
        score: dto.score,
        conversionProbability: dto.conversionProbability,
        ownerId: anyUser.id,
        consentDate: dto.consentDate ? new Date(dto.consentDate) : new Date(),
        dataOrigin: dto.dataOrigin || 'webhook',
      },
      include: this.leadInclude,
    });
  }

  async getActivity(user: AuthUser, id: string) {
    await this.findOne(user, id);

    return this.prisma.auditLog.findMany({
      where: {
        entityId: id,
        entityType: 'Lead',
      },
      include: {
        user: {
          select: this.auditUserSelect,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async importFromCsv(user: AuthUser, fileBuffer: Buffer) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MARKETING) {
      throw new ForbiddenException('Only Admin or Marketing can import leads');
    }

    type CsvLeadRow = {
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      company: string | null;
      source: string;
      ownerId: string;
      stage: LeadStage;
      consentDate: Date;
      dataOrigin: string;
    };

    const results: CsvLeadRow[] = [];
    let existingCount = 0;
    let errorCount = 0;
    const stream = Readable.from(fileBuffer).pipe(csv());

    for await (const row of stream) {
      // Normalisation des clés (au cas où il y aurait des espaces ou majuscules dans le CSV)
      const email = (row.email || row.Email || row.EMAIL || '')
        .toLowerCase()
        .trim();
      const firstName = String(
        row.firstName || row.FirstName || row.prenom || row.Prenom || '',
      ).trim();
      const lastName = String(
        row.lastName || row.LastName || row.nom || row.Nom || '',
      ).trim();
      const phoneRaw = String(
        row.phone || row.Phone || row.telephone || row.Telephone || '',
      ).trim();
      const companyRaw = String(
        row.company || row.Company || row.entreprise || row.Entreprise || '',
      ).trim();
      const sourceRaw = String(row.source || row.Source || 'CSV Import').trim();
      const phone = phoneRaw || null;
      const company = companyRaw || null;
      const source = sourceRaw || 'CSV Import';

      if (!email || !firstName || !lastName) {
        errorCount += 1;
        continue;
      }

      results.push({
        firstName,
        lastName,
        email,
        phone,
        company,
        source,
        ownerId: user.id,
        stage: LeadStage.Nouveau,
        consentDate: new Date(),
        dataOrigin: 'CSV Import',
      });
    }

    if (results.length === 0 && errorCount === 0) {
      throw new BadRequestException('No valid leads found in CSV');
    }

    const unique: CsvLeadRow[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    for (const lead of results) {
      const hasSeenEmail = seenEmails.has(lead.email);
      const hasSeenPhone = lead.phone ? seenPhones.has(lead.phone) : false;

      if (hasSeenEmail || hasSeenPhone) {
        existingCount += 1;
        continue;
      }

      seenEmails.add(lead.email);
      if (lead.phone) seenPhones.add(lead.phone);
      unique.push(lead);
    }

    const emails = unique.map((x) => x.email);
    const phones = unique
      .map((x) => x.phone)
      .filter((phone): phone is string => Boolean(phone));
    const existing =
      emails.length === 0 && phones.length === 0
        ? []
        : await this.prisma.lead.findMany({
            where: {
              OR: [
                ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
                ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
              ],
            },
            select: { email: true, phone: true },
          });
    const existingEmails = new Set(existing.map((x) => x.email.toLowerCase()));
    const existingPhones = new Set(
      existing
        .map((x) => x.phone)
        .filter((phone): phone is string => Boolean(phone)),
    );

    const toCreate: CsvLeadRow[] = [];

    for (const leadData of unique) {
      const alreadyExists =
        existingEmails.has(leadData.email) ||
        (leadData.phone ? existingPhones.has(leadData.phone) : false);
      if (alreadyExists) {
        existingCount += 1;
        continue;
      }
      toCreate.push(leadData);
    }

    const runBatches = async (ops: Array<() => any>) => {
      const chunkSize = 100;
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize).map((fn) => fn());
        await this.prisma.$transaction(chunk);
      }
    };

    await runBatches(
      toCreate.map((leadData) => () => this.prisma.lead.create({ data: leadData })),
    );
    const addedCount = toCreate.length;

    await this.notifications.createForAll(
      'Import de leads termine',
      `${user.email} a lance un import: ${addedCount} lead(s) ajoute(s), ${existingCount} deja existant(s), ${errorCount} erreur(s).`,
    );

    return {
      message: `Import termine : ${addedCount} lead(s) ajoute(s), ${existingCount} deja existant(s), ${errorCount} erreur(s).`,
      addedCount,
      existingCount,
      errorCount,
    };
  }

  async archive(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can archive leads');
    }

    const lead = await this.findOne(user, id);
    const previous = this.snapshotLead(lead);

    return this.prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          isAnonymized: true,
        },
        include: this.leadInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ARCHIVE',
          entityType: 'Lead',
          entityId: id,
          oldValue: { isAnonymized: previous.isAnonymized },
          newValue: { isAnonymized: true },
        },
      });

      return updatedLead;
    });
  }

  async unarchive(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can unarchive leads');
    }
    const lead = await this.findOne(user, id);
    const previous = this.snapshotLead(lead);

    return this.prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          isAnonymized: false,
        },
        include: this.leadInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UNARCHIVE',
          entityType: 'Lead',
          entityId: id,
          oldValue: { isAnonymized: previous.isAnonymized },
          newValue: { isAnonymized: false },
        },
      });

      return updatedLead;
    });
  }

  async exportForAI(user: AuthUser) {
    const leads = await this.prisma.lead.findMany({
      where: {
        isAnonymized: false,
        stage: { in: [LeadStage.Gagne, LeadStage.Perdu] },
        ...(user.role === UserRole.SALES ? { ownerId: user.id } : {}),
      },
      include: {
        interactions: { select: { type: true, createdAt: true } },
        tasks: {
          select: {
            type: true,
            status: true,
            progress: true,
            dueDate: true,
            completedAt: true,
            updatedAt: true,
            createdAt: true,
          },
        },
        owner: { select: { role: true } },
      },
    });

    const now = new Date();

    return leads.map((l) => {
      const interactions = l.interactions;
      const tasks = l.tasks;

      const taskCount = tasks.length;
      const avgTaskProgress =
        taskCount > 0
          ? Number((tasks.reduce((s, t) => s + t.progress, 0) / taskCount).toFixed(2))
          : 0;

      const lastInteractionAt =
        interactions.length > 0
          ? new Date(Math.max(...interactions.map((i) => i.createdAt.getTime())))
          : l.createdAt;

      const lastTaskActivityAt =
        tasks.length > 0
          ? new Date(
              Math.max(...tasks.map((t) => (t.completedAt ?? t.updatedAt ?? t.createdAt).getTime())),
            )
          : l.createdAt;

      const lastActivityAt = new Date(
        Math.max(l.updatedAt.getTime(), lastInteractionAt.getTime(), lastTaskActivityAt.getTime()),
      );

      return {
        // No PII (Problem 6) — pseudonym only
        lead_id: l.id,
        source: l.source ?? 'unknown',
        has_company: l.company ? 1 : 0,
        owner_role: l.owner.role,
        interaction_count: interactions.length,
        call_count: interactions.filter((i) => i.type === InteractionType.CALL).length,
        email_interaction_count: interactions.filter((i) => i.type === InteractionType.EMAIL).length,
        meeting_interaction_count: interactions.filter((i) => i.type === InteractionType.MEETING).length,
        task_count: taskCount,
        completed_task_count: tasks.filter((t) => t.status === TaskStatus.DONE).length,
        open_task_count: tasks.filter(
          (t) => t.status === TaskStatus.OPEN || t.status === TaskStatus.IN_PROGRESS,
        ).length,
        overdue_task_count: tasks.filter(
          (t) =>
            (t.status === TaskStatus.OPEN || t.status === TaskStatus.IN_PROGRESS) &&
            !!t.dueDate &&
            t.dueDate.getTime() < now.getTime(),
        ).length,
        call_task_count: tasks.filter((t) => t.type === TaskType.CALL).length,
        email_task_count: tasks.filter((t) => t.type === TaskType.EMAIL).length,
        meeting_task_count: tasks.filter((t) => t.type === TaskType.MEETING).length,
        todo_task_count: tasks.filter((t) => t.type === TaskType.TODO).length,
        avg_task_progress: avgTaskProgress,
        days_since_last_activity: this.daysBetween(lastActivityAt, now),
        days_since_creation: this.daysBetween(l.createdAt, now),
        label: l.stage === LeadStage.Gagne ? 1 : 0,
      };
    });
  }

  async findAll(
    user: AuthUser,
    query: {
      stage?: LeadStage;
      ownerId?: string;
      search?: string;
      archived?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const {
      stage,
      ownerId,
      search,
      archived,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = query;
    const where: Prisma.LeadWhereInput = {};

    if (!this.canReadAll(user)) {
      where.ownerId = user.id;
    } else if (ownerId) {
      where.ownerId = ownerId;
    }

    if (archived === undefined) {
      where.isAnonymized = false;
    } else if (archived === 'true') {
      where.isAnonymized = true;
    } else if (archived === 'false') {
      where.isAnonymized = false;
    }

    if (stage) {
      where.stage = stage;
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { firstName: { contains: searchLower, mode: 'insensitive' } },
        { lastName: { contains: searchLower, mode: 'insensitive' } },
        { email: { contains: searchLower, mode: 'insensitive' } },
        { company: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: this.leadInclude,
        skip,
        take: l,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data,
      total,
      page: p,
      lastPage: Math.ceil(total / l) || 1,
    };
  }

  private daysBetween(date: Date, now: Date) {
    return Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  async getPrediction(user: AuthUser, id: string) {
    const lead = await this.findOne(user, id);
    const now = new Date();

    const [interactions, tasks] = await Promise.all([
      this.prisma.interaction.findMany({
        where: { leadId: id },
        select: {
          type: true,
          createdAt: true,
        },
      }),
      this.prisma.task.findMany({
        where: { leadId: id },
        select: {
          type: true,
          status: true,
          progress: true,
          dueDate: true,
          completedAt: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const interactionCount = interactions.length;
    const callCount = interactions.filter(
      (interaction) => interaction.type === InteractionType.CALL,
    ).length;
    const emailInteractionCount = interactions.filter(
      (interaction) => interaction.type === InteractionType.EMAIL,
    ).length;
    const meetingInteractionCount = interactions.filter(
      (interaction) => interaction.type === InteractionType.MEETING,
    ).length;

    const taskCount = tasks.length;
    const completedTaskCount = tasks.filter(
      (task) => task.status === TaskStatus.DONE,
    ).length;
    const openTaskCount = tasks.filter(
      (task) =>
        task.status === TaskStatus.OPEN || task.status === TaskStatus.IN_PROGRESS,
    ).length;
    const overdueTaskCount = tasks.filter(
      (task) =>
        (task.status === TaskStatus.OPEN ||
          task.status === TaskStatus.IN_PROGRESS) &&
        !!task.dueDate &&
        task.dueDate.getTime() < now.getTime(),
    ).length;
    const callTaskCount = tasks.filter(
      (task) => task.type === TaskType.CALL,
    ).length;
    const emailTaskCount = tasks.filter(
      (task) => task.type === TaskType.EMAIL,
    ).length;
    const meetingTaskCount = tasks.filter(
      (task) => task.type === TaskType.MEETING,
    ).length;
    const todoTaskCount = tasks.filter(
      (task) => task.type === TaskType.TODO,
    ).length;
    const avgTaskProgress =
      taskCount > 0
        ? Number(
            (
              tasks.reduce((sum, task) => sum + task.progress, 0) / taskCount
            ).toFixed(2),
          )
        : 0;

    const lastInteractionAt =
      interactions.length > 0
        ? new Date(
            Math.max(
              ...interactions.map((interaction) => interaction.createdAt.getTime()),
            ),
          )
        : lead.createdAt;

    const lastTaskActivityAt =
      tasks.length > 0
        ? new Date(
            Math.max(
              ...tasks.map((task) =>
                (task.completedAt ?? task.updatedAt ?? task.createdAt).getTime(),
              ),
            ),
          )
        : lead.createdAt;

    const lastActivityAt = new Date(
      Math.max(
        lead.updatedAt.getTime(),
        lastInteractionAt.getTime(),
        lastTaskActivityAt.getTime(),
      ),
    );

    const features: LeadPredictionFeatures = {
      source: lead.source ?? 'unknown',
      has_company: lead.company ? 1 : 0,
      owner_role: lead.owner.role,
      interaction_count: interactionCount,
      call_count: callCount,
      email_interaction_count: emailInteractionCount,
      meeting_interaction_count: meetingInteractionCount,
      task_count: taskCount,
      completed_task_count: completedTaskCount,
      open_task_count: openTaskCount,
      overdue_task_count: overdueTaskCount,
      call_task_count: callTaskCount,
      email_task_count: emailTaskCount,
      meeting_task_count: meetingTaskCount,
      todo_task_count: todoTaskCount,
      avg_task_progress: avgTaskProgress,
      days_since_last_activity: this.daysBetween(lastActivityAt, now),
      days_since_creation: this.daysBetween(lead.createdAt, now),
    };

    const prediction = await this.ia.predictLead(features);

    return {
      probability: prediction.probability,
      score: prediction.score,
      label: prediction.label,
    };
  }

  async findOne(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: this.leadInclude,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!this.canReadAll(user) && lead.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    return lead;
  }

  async update(user: AuthUser, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(user, id);
    if (!this.canUpdateAnyLead(user) && lead.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    const previous = this.snapshotLead(lead);
    const data: Prisma.LeadUncheckedUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.company !== undefined) data.company = dto.company;
    if (dto.source !== undefined) data.source = dto.source;

    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.stage !== undefined) {
      if (!this.canUpdateCommercialFields(user)) throw new ForbiddenException();
      data.stage = dto.stage;
    }
    if (dto.score !== undefined) {
      if (!this.canUpdateAnyLead(user)) throw new ForbiddenException();
      data.score = dto.score;
    }
    if (dto.conversionProbability !== undefined) {
      if (!this.canUpdateAnyLead(user)) throw new ForbiddenException();
      data.conversionProbability = dto.conversionProbability;
    }
    if (dto.ownerId !== undefined) {
      if (!this.canUpdateAnyLead(user)) throw new ForbiddenException();
      data.ownerId = dto.ownerId;
    }
    const updatedLead = await this.prisma.lead.update({
      where: { id },
      data,
      include: this.leadInclude,
    });

    const current = this.snapshotLead(updatedLead);
    const { oldValue, newValue } = this.diffLeadState(previous, current);

    if (Object.keys(newValue).length > 0) {
      await this.createLeadAuditLog(user.id, 'UPDATE', id, { oldValue, newValue });
    }

    if (dto.ownerId && dto.ownerId !== user.id) {
      await this.notifications.create(
        dto.ownerId,
        'Lead réassigné',
        `Le prospect ${updatedLead.firstName} ${updatedLead.lastName} vous a été réassigné.`,
      );
    }

    return updatedLead;
  }

  async remove(user: AuthUser, id: string) {
    const lead = await this.findOne(user, id);
    if (!this.canDelete(user)) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'Lead',
          entityId: id,
          oldValue: this.snapshotLead(lead),
        },
      });

      return tx.lead.delete({ where: { id } });
    });
  }
}
