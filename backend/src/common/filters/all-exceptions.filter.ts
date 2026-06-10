import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => any;
      json: (body: any) => any;
    }>();
    const request = ctx.getRequest<{
      url?: string;
      method?: string;
      requestId?: string;
    }>();
    const requestId = request?.requestId ?? undefined;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        response.status(status).json({ message: res, requestId });
        return;
      }
      response.status(status).json({ ...res, requestId });
      return;
    }

    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'Fichier trop volumineux'
          : exception.message || 'Erreur upload';
      response.status(HttpStatus.BAD_REQUEST).json({ message, requestId });
      return;
    }

    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? 'UNKNOWN';
    console.error(`[API] ${method} ${url} requestId=${requestId ?? '-'}`, exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Une erreur est survenue. Réessayez.',
      requestId,
    });
  }
}
