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
import { InteractionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { InteractionsService } from './interactions.service';

@ApiTags('interactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an interaction' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInteractionDto) {
    return this.interactions.create(user, dto);
  }

  @Get()
  @ApiQuery({ name: 'leadId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'type', enum: InteractionType, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'List interactions' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('leadId') leadId?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: InteractionType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.interactions.findAll(user, {
      leadId,
      userId,
      type,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an interaction' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.interactions.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an interaction' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.interactions.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an interaction' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.interactions.remove(user, id);
  }
}
