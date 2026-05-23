import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TaskStatus, TaskType } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING)
  @ApiOperation({ summary: 'Créer une tâche' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Get()
  @ApiQuery({ name: 'leadId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiQuery({ name: 'type', enum: TaskType, required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'overdue', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortDir', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Lister les tâches' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('leadId') leadId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: TaskType,
    @Query('search') search?: string,
    @Query('overdue') overdue?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tasks.findAll(user, {
      leadId,
      assignedToId,
      status,
      type,
      search,
      overdue,
      sortBy,
      sortDir,
      page,
      limit,
    });
  }

  @Get('stats')
  @ApiQuery({ name: 'leadId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiQuery({ name: 'type', enum: TaskType, required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'overdue', required: false, type: String })
  @ApiOperation({ summary: 'Statistiques tâches (cartes dashboard)' })
  stats(
    @CurrentUser() user: AuthUser,
    @Query('leadId') leadId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: TaskType,
    @Query('search') search?: string,
    @Query('overdue') overdue?: string,
  ) {
    return this.tasks.getStats(user, {
      leadId,
      assignedToId,
      status,
      type,
      search,
      overdue,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail tâche' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.findOne(user, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING)
  @ApiOperation({ summary: 'Mettre à jour une tâche' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING)
  @ApiOperation({ summary: 'Supprimer une tâche' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }
}
