import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IaService } from '../ia/ia.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule],
  controllers: [LeadsController],
  providers: [LeadsService, IaService],
  exports: [LeadsService],
})
export class LeadsModule {}
