import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { db } from './server/db.js';

/**
 * Next.js-compatible Middleware Configuration Matcher
 * Explicitly intercepts /, /dashboard, /reports, and /api/:path*
 */
export const config = {
  matcher: [
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/reports',
    '/reports/:path*',
    '/api/:path*',
  ],
};

/**
 * Standard Next.js Edge Middleware signature
 */
export function middleware(request: any) {
  const pathname = request.nextUrl?.pathname || request.url || '/';

  // 1. Never redirect or block if already on /login
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return;
  }

  // 2. Allow public auth APIs, health check, cron jobs, push public keys, and static asset bundles
  if (
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/cron/notify' ||
    pathname === '/api/cron/status' ||
    pathname === '/api/notifications/vapid-public-key' ||
    pathname === '/api/notifications/action' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/@') ||
    pathname.includes('.')
  ) {
    return;
  }

  // 3. Extract authentication token from cookie or Authorization header
  const token =
    request.cookies?.get?.('session_token')?.value ||
    request.headers?.get?.('authorization')?.replace('Bearer ', '');

  const isAuthenticated = db.validateSession(token);

  // 4. Protect API endpoints
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized: Valid authentication required to access this resource',
          unauthenticated: true,
          redirect: '/login',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return;
  }

  // 5. Protect page routes (/, /dashboard, /reports): Redirect to /login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url || 'http://localhost:3000');
    if (typeof Response !== 'undefined' && 'redirect' in Response) {
      return Response.redirect(loginUrl.toString(), 307);
    }
  }
}

/**
 * Express Middleware Checkpoint
 * Protects all routes, pages, and API endpoints during development and runtime.
 */
export function authMiddleware(req: Request, res: ExpressResponse, next: NextFunction) {
  const pathname = req.path;

  // 1. Never redirect if already accessing /login (Prevents infinite loops)
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return next();
  }

  // 2. Allow public static assets and bundles
  const isStaticAsset =
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.ts') ||
    pathname.endsWith('.tsx') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.map');

  if (isStaticAsset) {
    return next();
  }

  // 3. Allow public auth API endpoints, health checks, cron notify, and public notification helpers
  if (
    pathname === '/api/health' ||
    pathname === '/api/db/status' ||
    pathname === '/api/db/sync' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/cron/notify' ||
    pathname === '/api/cron/status' ||
    pathname === '/api/notifications/vapid-public-key' ||
    pathname === '/api/notifications/action'
  ) {
    return next();
  }

  // 4. Extract authentication token from Cookie or Authorization header
  let token: string | undefined = undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/session_token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]).trim();
    }
  }

  const isAuthenticated = db.validateSession(token);

  // 5. Protected API endpoints: return 401 Unauthorized
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized: Valid authentication required to access this resource',
        unauthenticated: true,
        redirect: '/login',
      });
    }
    return next();
  }

  // 6. Protected Photo Uploads
  if (pathname.startsWith('/uploads/')) {
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized image access' });
    }
    return next();
  }

  // 7. Protected page routes (e.g. /, /dashboard, /reports):
  // If not authenticated, redirect browser requests immediately to /login
  if (!isAuthenticated) {
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
      return res.redirect('/login');
    }
  }

  return next();
}

export default middleware;
