import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export async function loadUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.session.userId;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  if (req.user.role !== 'admin') {
    throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}
