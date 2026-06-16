import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TaskStatus, TaskType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
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
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING, UserRole.EXECUTIVE)
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

  @Get('attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Télécharger une pièce jointe' })
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const att = await this.tasks.getAttachmentForDownload(user, attachmentId);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(att.storagePath);
    if (!resolved.startsWith(uploadsRoot + path.sep)) {
      throw new ForbiddenException();
    }
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(att.originalName)}"`,
    );
    return res.sendFile(resolved);
  }

  @Delete('attachments/:attachmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING)
  @ApiOperation({ summary: 'Supprimer une pièce jointe' })
  removeAttachment(
    @CurrentUser() user: AuthUser,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.tasks.removeAttachment(user, attachmentId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Historique activité d’une tâche' })
  activity(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.getActivity(user, id);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Lister les pièces jointes d’une tâche' })
  listAttachments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.listAttachments(user, id);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.MARKETING)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const taskId = (req.params as { id?: string }).id ?? 'unknown';
          const dest = path.join(process.cwd(), 'uploads', 'tasks', taskId);
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const safeOriginal = file.originalname.replace(/[^\w.\- ]+/g, '_');
          cb(null, `${randomUUID()}_${safeOriginal}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/gif',
          'image/webp',
          'text/plain',
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/zip',
        ]);
        if (!allowed.has(file.mimetype)) {
          (req as unknown as { fileValidationError?: string }).fileValidationError =
            'Unsupported file type';
          cb(null, false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Uploader une pièce jointe' })
  addAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const err =
      (req as unknown as { fileValidationError?: string }).fileValidationError ??
      null;
    if (err) throw new BadRequestException(err);
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    return this.tasks.addAttachment(user, id, file);
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
