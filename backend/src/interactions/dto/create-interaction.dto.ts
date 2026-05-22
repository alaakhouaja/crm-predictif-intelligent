import { ApiProperty } from '@nestjs/swagger';
import { InteractionType } from '@prisma/client';
import { IsEnum, IsString, IsUUID } from 'class-validator';

export class CreateInteractionDto {
  @ApiProperty({ enum: InteractionType })
  @IsEnum(InteractionType)
  type: InteractionType;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty()
  @IsUUID()
  leadId: string;
}
