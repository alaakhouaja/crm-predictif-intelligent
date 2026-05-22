import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InteractionType, Prisma } from '@prisma/client';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  private canSeeAllRead(user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.EXECUTIVE ||
      user.role === UserRole.MARKETING
    );
  }

  private canSeeAllWrite(user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.EXECUTIVE ||
      user.role === UserRole.MARKETING
    );
  }

  private readonly include = {
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    lead: true,
  };

  async create(user: AuthUser, dto: CreateInteractionDto) {
    // Vérifier que le lead existe
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!this.canSeeAllRead(user) && lead.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this lead');
    }

    return this.prisma.interaction.create({
      data: {
        type: dto.type,
        content: dto.content,
        leadId: dto.leadId,
        userId: user.id,
      },
      include: this.include,
    });
  }

  async findAll(
    user: AuthUser,
    query: {
      leadId?: string;
      userId?: string;
      type?: InteractionType;
      page?: number;
      limit?: number;
    },
  ) {
    const { leadId, userId, type, page = 1, limit = 10 } = query;
    const where: Prisma.InteractionWhereInput = {};

    if (leadId) where.leadId = leadId;
    if (userId) where.userId = userId;
    if (type) where.type = type;

    // Si pas admin, on restreint aux interactions des leads dont l'user est propriétaire
    // OU aux interactions créées par l'user lui-même
    if (!this.canSeeAllRead(user)) {
      where.OR = [{ userId: user.id }, { lead: { ownerId: user.id } }];
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 10);
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.prisma.interaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: this.include,
        skip,
        take: l,
      }),
      this.prisma.interaction.count({ where }),
    ]);

    return {
      data,
      total,
      page: p,
      lastPage: Math.ceil(total / l) || 1,
    };
  }

  async findOne(user: AuthUser, id: string) {
    const interaction = await this.prisma.interaction.findUnique({
      where: { id },
      include: this.include,
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found');
    }

    if (
      !this.canSeeAllRead(user) &&
      interaction.userId !== user.id &&
      interaction.lead.ownerId !== user.id
    ) {
      throw new ForbiddenException();
    }

    return interaction;
  }

  async update(user: AuthUser, id: string, dto: UpdateInteractionDto) {
    const interaction = await this.findOne(user, id);

    // Seul le créateur ou un admin peut modifier
    if (!this.canSeeAllWrite(user) && interaction.userId !== user.id) {
      throw new ForbiddenException('You can only update your own interactions');
    }

    return this.prisma.interaction.update({
      where: { id },
      data: {
        type: dto.type,
        content: dto.content,
      },
      include: this.include,
    });
  }

  async remove(user: AuthUser, id: string) {
    const interaction = await this.findOne(user, id);

    // Seul le créateur ou un admin peut supprimer
    if (!this.canSeeAllWrite(user) && interaction.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own interactions');
    }

    return this.prisma.interaction.delete({ where: { id } });
  }
}
