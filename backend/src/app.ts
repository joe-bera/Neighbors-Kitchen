import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { SAMPLE_PHOTOS_DIR } from './services/samplePhotos.js';
import { contentSecurityDirectives, proxyCheck } from './web/security.js';
import { noIndex, websiteRoutes, wwwRedirect } from './web/website.js';

export interface AppOptions {
  /** The show-and-tell preview: pages get the preview marker and search engines are asked to stay away. */
  preview: boolean;
  /** The site's public address (FRONTEND_URL). */
  publicUrl: string;
  /** The built website (frontend/dist). Set in production, where the API hands out the website too. */
  websiteDir?: string;
  /** Proxies in front of the app (1 on Railway), so rate limits see each visitor's own address. */
  trustProxyHops?: number;
}

/** The options for the real server, from the settings. */
export function appOptionsFromEnv(): AppOptions {
  return {
    preview: env.PREVIEW_MODE,
    publicUrl: env.FRONTEND_URL,
    websiteDir: isProduction ? env.WEB_DIST_DIR : undefined,
    trustProxyHops: env.TRUST_PROXY_HOPS,
  };
}

export function createApp(options: AppOptions = appOptionsFromEnv()): Express {
  const app = express();
  // Off for the whole app: helmet only hides it on requests that reach helmet, and the www redirect answers first.
  app.disable('x-powered-by');

  // Behind Railway's proxy the visitor's own address arrives in X-Forwarded-For.
  if (options.trustProxyHops) {
    app.set('trust proxy', options.trustProxyHops);
    app.use(proxyCheck());
  }
  if (options.websiteDir) app.use(wwwRedirect(options.publicUrl));

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: { directives: contentSecurityDirectives(options.publicUrl) },
      // OpenStreetMap's tile policy asks for a Referer; other sites only ever see our bare address.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  if (options.preview) app.use(noIndex);

  // Rate limiting
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    skip: () => env.NODE_ENV === 'test',
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests from this IP, please try again later.' },
    },
  });
  app.use('/api/', limiter);

  // Body and cookie parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Neighbors-Kitchen API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // Uploaded photos have random, never-reused names, so browsers may cache them for a long time.
  app.use('/uploads', express.static(env.UPLOAD_DIR, { index: false, immutable: true, maxAge: '30d' }));
  // The sample meals' photos ship with the app (prisma/sample-photos); an uploaded photo with the same name would win.
  app.use('/uploads/meals', express.static(SAMPLE_PHOTOS_DIR, { index: false, immutable: true, maxAge: '30d' }));

  app.use('/api/v1', apiRoutes);

  // Production: the same server hands out the website, so the whole app lives at one address.
  if (options.websiteDir) app.use(websiteRoutes({ distDir: options.websiteDir, preview: options.preview }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
