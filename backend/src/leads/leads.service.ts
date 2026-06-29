import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
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
import { IaService } from '../ia/ia.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsService } from '../notifications/notifications.service';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

@Injectable()
export class LeadsService implements OnModuleInit {
  private readonly logger = new Logger(LeadsService.name);

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

    // Score the new lead in background — response is already sent
    setImmediate(() => { void this.computeAndSaveScore(lead.id); });

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

    const lead = await this.prisma.lead.create({
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

    setImmediate(() => { void this.computeAndSaveScore(lead.id); });

    return lead;
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

    type DuplicateEntry = {
      email: string;
      firstName: string;
      lastName: string;
      reason: 'email' | 'phone' | 'name';
    };

    const results: CsvLeadRow[] = [];
    let existingCount = 0;
    let errorCount = 0;
    const duplicates: DuplicateEntry[] = [];
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
        duplicates.push({
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
          reason: hasSeenEmail ? 'email' : 'phone',
        });
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
            select: { email: true, phone: true, firstName: true, lastName: true },
          });
    const existingEmails = new Set(existing.map((x) => x.email.toLowerCase()));
    const existingPhones = new Set(
      existing
        .map((x) => x.phone)
        .filter((phone): phone is string => Boolean(phone)),
    );
    // Build a map from email → DB lead info for capturing duplicate details
    const existingByEmail = new Map(existing.map((x) => [x.email.toLowerCase(), x]));
    const existingByPhone = new Map(
      existing
        .filter((x): x is typeof x & { phone: string } => Boolean(x.phone))
        .map((x) => [x.phone as string, x]),
    );

    const toCreate: CsvLeadRow[] = [];

    for (const leadData of unique) {
      const emailMatch = existingEmails.has(leadData.email);
      const phoneMatch = leadData.phone ? existingPhones.has(leadData.phone) : false;
      if (emailMatch || phoneMatch) {
        existingCount += 1;
        const dbLead = emailMatch
          ? existingByEmail.get(leadData.email)
          : existingByPhone.get(leadData.phone as string);
        duplicates.push({
          email: leadData.email,
          firstName: dbLead?.firstName ?? leadData.firstName,
          lastName: dbLead?.lastName ?? leadData.lastName,
          reason: emailMatch ? 'email' : 'phone',
        });
        continue;
      }
      toCreate.push(leadData);
    }

    // Detect name duplicates among leads that passed email/phone checks
    if (toCreate.length > 0) {
      const namePairs = toCreate.map((l) => ({
        firstName: l.firstName.toLowerCase(),
        lastName: l.lastName.toLowerCase(),
      }));

      const nameMatches = await this.prisma.lead.findMany({
        where: {
          OR: namePairs.map((p) => ({
            firstName: { equals: p.firstName, mode: 'insensitive' as const },
            lastName: { equals: p.lastName, mode: 'insensitive' as const },
          })),
        },
        select: { firstName: true, lastName: true, email: true },
      });

      const nameMatchSet = new Set(
        nameMatches.map((x) => `${x.firstName.toLowerCase()}|${x.lastName.toLowerCase()}`),
      );

      const toCreateFiltered: CsvLeadRow[] = [];
      for (const leadData of toCreate) {
        const key = `${leadData.firstName.toLowerCase()}|${leadData.lastName.toLowerCase()}`;
        if (nameMatchSet.has(key)) {
          existingCount += 1;
          duplicates.push({
            email: leadData.email,
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            reason: 'name',
          });
        } else {
          toCreateFiltered.push(leadData);
        }
      }
      // Replace toCreate with filtered list
      toCreate.length = 0;
      toCreate.push(...toCreateFiltered);
    }

    const createdIds: string[] = [];
    const chunkSize = 100;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      const results = await this.prisma.$transaction(
        chunk.map((leadData) => this.prisma.lead.create({ data: leadData, select: { id: true } })),
      );
      for (const r of results) createdIds.push(r.id);
    }
    const addedCount = createdIds.length;

    await this.notifications.createForAll(
      'Import de leads termine',
      `${user.email} a lance un import: ${addedCount} lead(s) ajoute(s), ${existingCount} deja existant(s), ${errorCount} erreur(s).`,
    );

    // Score all newly created leads in background
    if (createdIds.length > 0) {
      this.logger.log(`[IA] Queuing background scoring for ${createdIds.length} imported lead(s)…`);
      setImmediate(() => { void this.scoreLeadsInBackground(createdIds); });
    }

    return {
      message: `Import termine : ${addedCount} lead(s) ajoute(s), ${existingCount} deja existant(s), ${errorCount} erreur(s).`,
      addedCount,
      existingCount,
      errorCount,
      duplicates,
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

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  onModuleInit() {
    // Score leads that have no score yet — runs in background at startup
    setImmediate(() => { void this.scoreUnscoredLeadsOnStartup(); });
  }

  private async scoreUnscoredLeadsOnStartup(): Promise<void> {
    try {
      const leads = await this.prisma.lead.findMany({
        where: { score: null, isAnonymized: false },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (leads.length === 0) return;

      this.logger.log(`[IA] Scoring ${leads.length} unscored lead(s) on startup…`);

      for (const { id } of leads) {
        await this.computeAndSaveScore(id);
        await new Promise((r) => setTimeout(r, 400));
      }

      this.logger.log('[IA] Startup scoring complete.');
    } catch (err) {
      this.logger.warn(`[IA] Startup scoring aborted: ${String(err)}`);
    }
  }

  // ─── Background scoring ────────────────────────────────────────────────────

  /**
   * Fetches lead data, calls Ollama, persists score.
   * Never throws — errors are logged and swallowed so callers can fire-and-forget.
   */
  private async computeAndSaveScore(leadId: string) {
    try {
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        include: this.leadInclude,
      });

      if (!lead || lead.isAnonymized) return null;

      const now = new Date();

      const [interactions, tasks] = await Promise.all([
        this.prisma.interaction.findMany({
          where: { leadId },
          select: { type: true, createdAt: true },
        }),
        this.prisma.task.findMany({
          where: { leadId },
          select: { status: true, dueDate: true, completedAt: true, updatedAt: true, createdAt: true },
        }),
      ]);

      const lastInteractionAt =
        interactions.length > 0
          ? new Date(Math.max(...interactions.map((i) => i.createdAt.getTime())))
          : lead.createdAt;

      const lastTaskActivityAt =
        tasks.length > 0
          ? new Date(Math.max(...tasks.map((t) => (t.completedAt ?? t.updatedAt ?? t.createdAt).getTime())))
          : lead.createdAt;

      const lastActivityAt = new Date(
        Math.max(lead.updatedAt.getTime(), lastInteractionAt.getTime(), lastTaskActivityAt.getTime()),
      );

      // Cache key changes whenever lead data changes → auto-invalidation
      const cacheKey = `${leadId}:${lastActivityAt.getTime()}:${lead.stage}`;

      const prediction = await this.ia.predictLead({
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company ?? null,
        source: lead.source ?? null,
        stage: lead.stage,
        notes: lead.notes ?? null,
        interactionCount: interactions.length,
        callCount: interactions.filter((i) => i.type === InteractionType.CALL).length,
        emailCount: interactions.filter((i) => i.type === InteractionType.EMAIL).length,
        meetingCount: interactions.filter((i) => i.type === InteractionType.MEETING).length,
        taskCount: tasks.length,
        completedTaskCount: tasks.filter((t) => t.status === TaskStatus.DONE).length,
        overdueTaskCount: tasks.filter(
          (t) =>
            (t.status === TaskStatus.OPEN || t.status === TaskStatus.IN_PROGRESS) &&
            !!t.dueDate &&
            t.dueDate.getTime() < now.getTime(),
        ).length,
        daysSinceCreation: this.daysBetween(lead.createdAt, now),
        daysSinceLastActivity: this.daysBetween(lastActivityAt, now),
      }, cacheKey);

      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          score: prediction.score / 10,
          conversionProbability: prediction.probability,
        },
      });

      this.logger.log(`[IA] Lead ${leadId} scored: ${prediction.score}/100`);
      return prediction;
    } catch (err) {
      this.logger.warn(`[IA] Scoring failed for lead ${leadId}: ${String(err)}`);
      return null;
    }
  }

  private async scoreLeadsInBackground(leadIds: string[]): Promise<void> {
    for (const id of leadIds) {
      await this.computeAndSaveScore(id);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ─── Public prediction endpoint ────────────────────────────────────────────

  async getPrediction(user: AuthUser, id: string) {
    // Permission check only — actual work delegated to computeAndSaveScore
    await this.findOne(user, id);

    const prediction = await this.computeAndSaveScore(id);
    if (!prediction) {
      throw new BadRequestException('Service IA indisponible, veuillez réessayer.');
    }
    return prediction;
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
