import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction,
) {
  const rid = randomUUID();
  req.requestId = rid;
  res.setHeader('x-request-id', rid);
  next();
}
