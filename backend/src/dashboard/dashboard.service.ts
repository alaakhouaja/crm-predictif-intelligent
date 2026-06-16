import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadStage } from '@prisma/client';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string, userRole: UserRole) {
    const where = userRole === UserRole.SALES ? { ownerId: userId, isAnonymized: false } : { isAnonymized: false };

    const [total, newLeads, contacted, qualified, proposal, won, lost] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Nouveau } }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Contacte } }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Qualifie } }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Proposition } }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Gagne } }),
      this.prisma.lead.count({ where: { ...where, stage: LeadStage.Perdu } }),
    ]);

    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

    const avgScore = await this.prisma.lead.aggregate({
      where: { ...where, score: { not: null } },
      _avg: { score: true },
    });

    return {
      total,
      newLeads,
      contacted,
      qualified,
      proposal,
      won,
      lost,
      conversionRate,
      closed,
      avgScore: avgScore._avg.score !== null ? Math.round(avgScore._avg.score * 10) / 10 : null,
    };
  }

  async getPipelineMetrics(userId: string, userRole: UserRole) {
    const where = userRole === UserRole.SALES ? { ownerId: userId, isAnonymized: false } : { isAnonymized: false };

    const stages: LeadStage[] = [
      LeadStage.Nouveau,
      LeadStage.Contacte,
      LeadStage.Qualifie,
      LeadStage.Proposition,
      LeadStage.Gagne,
      LeadStage.Perdu,
    ];
    const stageLabels: Record<LeadStage, string> = {
      [LeadStage.Nouveau]: 'Nouveau',
      [LeadStage.Contacte]: 'Contacte',
      [LeadStage.Qualifie]: 'Qualifie',
      [LeadStage.Proposition]: 'Proposition',
      [LeadStage.Gagne]: 'Gagne',
      [LeadStage.Perdu]: 'Perdu',
    };

    const counts = await Promise.all(
      stages.map(async (stage) => {
        const count = await this.prisma.lead.count({ where: { ...where, stage } });
        return { stage, label: stageLabels[stage], count };
      }),
    );

    const total = counts.reduce((sum, c) => sum + c.count, 0);
    return counts.map((c) => ({
      ...c,
      percentage: total > 0 ? Math.round((c.count / total) * 100) : 0,
    }));
  }

  async getLeadsBySource(userId: string, userRole: UserRole) {
    const where = userRole === UserRole.SALES ? { ownerId: userId, isAnonymized: false } : { isAnonymized: false };

    const results = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { ...where, source: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const total = results.reduce((sum, r) => sum + r._count.id, 0);

    return results.map((r) => ({
      source: r.source || 'Autre',
      count: r._count.id,
      percentage: total > 0 ? Math.round((r._count.id / total) * 100) : 0,
    }));
  }

  async getPerformanceByOwner(userId: string, userRole: UserRole) {
    const canSeeAll = userRole !== UserRole.SALES;
    const where = canSeeAll ? { isAnonymized: false } : { ownerId: userId, isAnonymized: false };

    const groupedLeads = await this.prisma.lead.groupBy({
      by: ['ownerId', 'stage'],
      where,
      _count: { id: true },
    });

    if (groupedLeads.length === 0) {
      return [];
    }

    const ownerIds = [...new Set(groupedLeads.map((lead) => lead.ownerId))];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    const ownerMap = new Map(
      owners.map((owner) => [
        owner.id,
        {
          ownerId: owner.id,
          ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
          ownerRole: owner.role,
          total: 0,
          won: 0,
          lost: 0,
          newLeads: 0,
          conversionRate: 0,
        },
      ]),
    );

    for (const lead of groupedLeads) {
      const stats = ownerMap.get(lead.ownerId);
      if (!stats) continue;

      const count = lead._count.id;
      stats.total += count;
      if (lead.stage === LeadStage.Gagne) stats.won += count;
      else if (lead.stage === LeadStage.Perdu) stats.lost += count;
      else if (lead.stage === LeadStage.Nouveau) stats.newLeads += count;
    }

    for (const stats of ownerMap.values()) {
      const closed = stats.won + stats.lost;
      stats.conversionRate = closed > 0 ? Math.round((stats.won / closed) * 100) : 0;
    }

    return Array.from(ownerMap.values()).sort((a, b) => b.total - a.total);
  }

  async getTrends(userId: string, userRole: UserRole, days: number = 30) {
    const where = userRole === UserRole.SALES ? { ownerId: userId, isAnonymized: false } : { isAnonymized: false };
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const leads = await this.prisma.lead.findMany({
      where: { ...where, createdAt: { gte: startDate } },
      select: { createdAt: true, stage: true },
    });

    const trendMap = new Map<string, { date: string; created: number; won: number; lost: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendMap.set(key, { date: key, created: 0, won: 0, lost: 0 });
    }

    for (const lead of leads) {
      const key = lead.createdAt.toISOString().split('T')[0];
      const entry = trendMap.get(key);
      if (entry) {
        entry.created++;
        if (lead.stage === LeadStage.Gagne) entry.won++;
        if (lead.stage === LeadStage.Perdu) entry.lost++;
      }
    }

    return Array.from(trendMap.values()).reverse();
  }

  async getRecentActivity(userId: string, userRole: UserRole, limit: number = 10) {
    const canSeeAll = userRole !== UserRole.SALES;
    const ownerFilter = canSeeAll ? {} : { userId };

    const [interactions, leadUpdates] = await Promise.all([
      this.prisma.interaction.findMany({
        where: ownerFilter,
        include: {
          user: { select: { firstName: true, lastName: true } },
          lead: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.auditLog.findMany({
        where: { ...ownerFilter, entityType: 'Lead' },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const activities = [
      ...interactions.map((i) => ({
        id: i.id,
        type: 'interaction',
        subtype: i.type,
        content: i.content,
        user: `${i.user.firstName || ''} ${i.user.lastName || ''}`.trim(),
        lead: `${i.lead.firstName} ${i.lead.lastName}`,
        leadEmail: i.lead.email,
        createdAt: i.createdAt,
      })),
      ...leadUpdates.map((a) => ({
        id: a.id,
        type: 'update',
        subtype: a.action,
        content: a.newValue ? `Modifié: ${JSON.stringify(a.newValue)}` : a.action,
        user: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim(),
        lead: a.entityId,
        createdAt: a.createdAt,
      })),
    ];

    return activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async getStageConversion(userId: string, userRole: UserRole) {
    const where = userRole === UserRole.SALES ? { ownerId: userId, isAnonymized: false } : { isAnonymized: false };

    const stages: LeadStage[] = [
      LeadStage.Nouveau,
      LeadStage.Contacte,
      LeadStage.Qualifie,
      LeadStage.Proposition,
      LeadStage.Gagne,
    ];
    const stageLabels: Record<string, string> = {
      [LeadStage.Nouveau]: 'Nouveau',
      [LeadStage.Contacte]: 'Contacte',
      [LeadStage.Qualifie]: 'Qualifie',
      [LeadStage.Proposition]: 'Proposition',
      [LeadStage.Gagne]: 'Gagne',
    };

    const counts: Record<string, number> = {};
    for (const stage of stages) {
      counts[stage] = await this.prisma.lead.count({ where: { ...where, stage } });
    }

    const conversions = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const from = stages[i];
      const to = stages[i + 1];
      const fromCount = counts[from];
      const toCount = counts[to];
      const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      conversions.push({
        from: stageLabels[from],
        to: stageLabels[to],
        fromCount,
        toCount,
        rate,
      });
    }

    return conversions;
  }
}
