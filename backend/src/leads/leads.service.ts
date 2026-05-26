import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LeadStage, Prisma } from '@prisma/client';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
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
  };

  /**
   * Centralized mapping for lead selection to ensure consistency
   */
  private readonly leadInclude = {
    owner: { select: this.ownerSelect },
  };

  async create(user: AuthUser, dto: CreateLeadDto) {
    if (!this.canCreate(user)) {
      throw new ForbiddenException();
    }
    const ownerId =
      user.role === UserRole.ADMIN && dto.ownerId ? dto.ownerId : user.id;
    const lead = await this.prisma.lead.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        company: dto.company,
        source: dto.source,
        stage: dto.stage ?? LeadStage.NEW,
        notes: dto.notes,
        score: dto.score,
        conversionProbability: dto.conversionProbability,
        ownerId,
        consentDate: dto.consentDate ? new Date(dto.consentDate) : new Date(),
        dataOrigin: dto.dataOrigin || 'formulaire',
      },
      include: this.leadInclude,
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
        stage: dto.stage ?? LeadStage.NEW,
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

  async importFromCsv(user: AuthUser, fileBuffer: Buffer) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MARKETING) {
      throw new ForbiddenException('Only Admin or Marketing can import leads');
    }

    const results: any[] = [];
    const stream = Readable.from(fileBuffer).pipe(csv());

    for await (const row of stream) {
      // Normalisation des clés (au cas où il y aurait des espaces ou majuscules dans le CSV)
      const email = (row.email || row.Email || row.EMAIL || '')
        .toLowerCase()
        .trim();
      const firstName =
        row.firstName || row.FirstName || row.prenom || row.Prenom || '';
      const lastName = row.lastName || row.LastName || row.nom || row.Nom || '';
      const phone = row.phone || row.Phone || row.telephone || '';
      const company = row.company || row.Company || row.entreprise || '';
      const source = row.source || row.Source || 'CSV Import';

      if (!email || !firstName || !lastName) continue;

      results.push({
        firstName,
        lastName,
        email,
        phone,
        company,
        source,
        ownerId: user.id,
        stage: LeadStage.NEW,
        consentDate: new Date(),
        dataOrigin: 'CSV Import',
      });
    }

    if (results.length === 0) {
      throw new BadRequestException('No valid leads found in CSV');
    }

    const byEmail = new Map<string, (typeof results)[number]>();
    for (const r of results) byEmail.set(r.email, r);
    const unique = Array.from(byEmail.values());

    const emails = unique.map((x) => x.email);
    const existing = await this.prisma.lead.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const existingByEmail = new Map(existing.map((x) => [x.email, x.id]));

    const toCreate: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const leadData of unique) {
      const id = existingByEmail.get(leadData.email);
      if (id) {
        toUpdate.push({ id, data: leadData });
      } else {
        toCreate.push(leadData);
      }
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
    await runBatches(
      toUpdate.map(({ id, data }) => () =>
        this.prisma.lead.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        }),
      ),
    );

    const importedCount = toCreate.length;
    const updatedCount = toUpdate.length;

    return {
      message: `${importedCount} leads créés, ${updatedCount} leads mis à jour avec succès.`,
      importedCount,
      updatedCount,
    };
  }

  async archive(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can archive leads');
    }

    await this.findOne(user, id);
    return this.prisma.lead.update({
      where: { id },
      data: {
        isAnonymized: true,
      },
      include: this.leadInclude,
    });
  }

  async unarchive(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can unarchive leads');
    }
    await this.findOne(user, id);
    return this.prisma.lead.update({
      where: { id },
      data: {
        isAnonymized: false,
      },
      include: this.leadInclude,
    });
  }

  async exportForAI() {
    const leads = await this.prisma.lead.findMany({
      where: {
        isAnonymized: false,
        stage: { in: [LeadStage.WON, LeadStage.LOST] },
      },
      include: {
        interactions: true,
        owner: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Export enrichi: dataset IA + coordonnees principales du lead
    return leads.map((l) => ({
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      phone: l.phone,
      company: l.company,
      source: l.source,
      stage: l.stage,
      score: l.score,
      conversionProbability: l.conversionProbability,
      ownerEmail: l.owner.email,
      interactionsCount: l.interactions.length,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      label: l.stage === LeadStage.WON ? 1 : 0,
    }));
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
    const l = Math.max(1, Number(limit) || 10);
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
    await this.findOne(user, id);
    if (!this.canDelete(user)) throw new ForbiddenException();
    return this.prisma.lead.delete({ where: { id } });
  }
}
