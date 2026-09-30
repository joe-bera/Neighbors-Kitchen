import { readFileSync } from 'node:fs';
import path from 'node:path';
import express, { Request, RequestHandler, Response, Router } from 'express';
import { notFoundHandler } from '../middleware/errorHandler.js';

// In production the API also hands out the built website (frontend/dist), so the whole app lives at one address.
// Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

/** Paths the website never answers: the API, photos and the health check keep their own 404s. */
const NOT_WEBSITE = /^\/(api|uploads|health)(\/|$)/;
const PREVIEW_MARKER = '<meta name="nk-preview" content="true" />';

/** The page every website address gets. On the preview it carries the marker the banner looks for. */
export function pageHtml(indexHtml: string, preview: boolean): string {
  return preview ? indexHtml.replace('</head>', `  ${PREVIEW_MARKER}\n  </head>`) : indexHtml;
}

export function robotsTxt(preview: boolean): string {
  return preview ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';
}

export function websiteRoutes({ distDir, preview }: { distDir: string; preview: boolean }): Router {
  const html = pageHtml(readFileSync(path.join(distDir, 'index.html'), 'utf8'), preview);
  const sendPage = (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  };

  const router = Router();
  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(robotsTxt(preview));
  });
  router.get('/index.html', sendPage);
  // Built files carry the build's fingerprint in their names, so browsers may keep them for a year.
  router.use('/assets', express.static(path.join(distDir, 'assets'), { index: false, immutable: true, maxAge: '1y' }));
  router.use('/assets', notFoundHandler);
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));
  // Every other page address belongs to the React app, which shows its own "not found" page.
  router.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || NOT_WEBSITE.test(req.path)) return next();
    sendPage(req, res);
  });
  return router;
}

/** Sends www.<site> to the site's own address, keeping the path and query. */
export function wwwRedirect(publicUrl: string): RequestHandler {
  const site = new URL(publicUrl);
  const wwwHost = `www.${site.hostname}`;
  return (req, res, next) => {
    if (req.hostname !== wwwHost) return next();
    res.redirect(301, new URL(req.originalUrl, site).toString());
  };
}

/** The preview: every answer asks search engines not to list it. */
export const noIndex: RequestHandler = (_req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
};
