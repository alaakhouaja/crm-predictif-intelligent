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
    const response = ctx.getResponse<{ status: (code: number) => any; json: (body: any) => any }>();
    const request = ctx.getRequest<{ url?: string; method?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      response.status(status).json(res);
      return;
    }

    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'Fichier trop volumineux'
          : exception.message || 'Erreur upload';
      response.status(HttpStatus.BAD_REQUEST).json({ message });
      return;
    }

    const e = exception as { message?: string };
    const message =
      process.env.NODE_ENV !== 'production'
        ? e?.message || 'Internal server error'
        : 'Internal server error';

    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? 'UNKNOWN';
    console.error(`[API] ${method} ${url}`, exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
  }
}

