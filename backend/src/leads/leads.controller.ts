import {
  ForbiddenException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LeadStage } from '@prisma/client';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a lead (owner = current user unless admin sets ownerId)',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user, dto);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import leads from CSV' })
  importLeads(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.leads.importFromCsv(user, file.buffer);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook for external form capture' })
  webhookCapture(@Body() dto: CreateLeadDto, @Query('secret') secret?: string) {
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid webhook secret');
    }
    return this.leads.createFromWebhook(dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a lead' })
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.archive(user, id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a lead' })
  unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.unarchive(user, id);
  }

  @Get('export-ai')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EXECUTIVE)
  @ApiOperation({ summary: 'Export won/lost leads for AI training' })
  exportAI() {
    return this.leads.exportForAI();
  }

  @Get()
  @ApiQuery({ name: 'stage', enum: LeadStage, required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'archived', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiOperation({
    summary: 'List leads (sales: own only; admin/marketing/executive: all)',
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: LeadStage,
    @Query('ownerId') ownerId?: string,
    @Query('search') search?: string,
    @Query('archived') archived?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.leads.findAll(user, {
      stage,
      ownerId,
      search,
      archived,
      page,
      limit,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.remove(user, id);
  }
}
