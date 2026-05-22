import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;

    // Only log write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user) {
      return next.handle().pipe(
        tap(async (data) => {
          try {
            // Basic logic: extract entity type from URL (e.g., /leads -> Lead)
            const entityType =
              url.split('/')[1]?.replace(/s$/, '') || 'Unknown';
            const entityId = data?.id || body?.id || 'N/A';

            await this.prisma.auditLog.create({
              data: {
                userId: user.id,
                action: method,
                entityType,
                entityId: String(entityId),
                newValue: body ? body : undefined,
                // In a full system, we would fetch the oldValue before the update
              },
            });
          } catch (err) {
            console.error('Failed to create audit log:', err);
          }
        }),
      );
    }

    return next.handle();
  }
}
