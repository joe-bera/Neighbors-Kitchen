import { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../config/env.js';
import * as authService from '../services/authService.js';

const REFRESH_COOKIE = 'nk_refresh';

// The refresh token lives in an httpOnly cookie that is only sent to the auth routes.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/v1/auth',
};

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({
    success: true,
    data: { user, accessToken },
    message: 'Account created',
  });
}

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({
    success: true,
    data: { user, accessToken },
    message: 'Logged in',
  });
}

export async function refreshToken(req: Request, res: Response) {
  const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
  res.status(200).json({ success: true, data: session });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(200).json({ success: true, message: 'Logged out' });
}
