import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthUser) {
    return this.dashboard.getOverview(user.id, user.role);
  }

  @Get('pipeline')
  getPipelineMetrics(@CurrentUser() user: AuthUser) {
    return this.dashboard.getPipelineMetrics(user.id, user.role);
  }

  @Get('by-source')
  getLeadsBySource(@CurrentUser() user: AuthUser) {
    return this.dashboard.getLeadsBySource(user.id, user.role);
  }

  @Get('by-owner')
  getPerformanceByOwner(@CurrentUser() user: AuthUser) {
    return this.dashboard.getPerformanceByOwner(user.id, user.role);
  }

  @Get('trends')
  getTrends(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.dashboard.getTrends(user.id, user.role, days ? parseInt(days, 10) : 30);
  }

  @Get('activity')
  getRecentActivity(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.dashboard.getRecentActivity(user.id, user.role, limit ? parseInt(limit, 10) : 10);
  }

  @Get('stage-conversion')
  getStageConversion(@CurrentUser() user: AuthUser) {
    return this.dashboard.getStageConversion(user.id, user.role);
  }
}
