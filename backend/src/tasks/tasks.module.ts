import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksRemindersRunner } from './tasks.reminders.runner';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRemindersRunner],
  exports: [TasksService],
})
export class TasksModule {}
