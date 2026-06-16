import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class BootstrapDto {
  @ApiProperty({ example: 'alaa@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'alaa1919' })
  @IsString()
  @MinLength(8)
  password: string;
}
