import { ApiProperty } from '@nestjs/swagger';
import { LeadStage } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ enum: LeadStage, required: false })
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'Admin assigns owner' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  conversionProbability?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  consentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dataOrigin?: string;
}
