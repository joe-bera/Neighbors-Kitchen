import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Prisma, User, UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { LoginInput, RegisterInput } from '../validators/authSchemas.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Checked when the email is unknown, so that path takes as long as a real password check.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePhotoUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    profilePhotoUrl: user.profilePhotoUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    return { sub: payload.sub as string, role: payload.role as UserRole };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Your session is not valid. Please log in again.');
  }
}

async function createSession(user: User): Promise<Session> {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    },
  });
  return { user: toPublicUser(user), accessToken: signAccessToken(user), refreshToken };
}

export async function register(input: RegisterInput): Promise<Session> {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
    });
    return await createSession(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw error;
  }
}

function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
}

function accountLocked(lockedUntil: Date) {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
  return new AppError(
    423,
    'ACCOUNT_LOCKED',
    `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  );
}

/** Counts a wrong password and locks the account once the limit is reached. */
async function recordFailedLogin(userId: string): Promise<Date | null> {
  const { failedLoginAttempts } = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
  });
  if (failedLoginAttempts < MAX_FAILED_LOGINS) return null;

  const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil },
  });
  return lockedUntil;
}

export async function login({ email, password }: LoginInput): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw accountLocked(user.lockedUntil);
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const lockedUntil = await recordFailedLogin(user.id);
    throw lockedUntil ? accountLocked(lockedUntil) : invalidCredentials();
  }

  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
  return createSession(user);
}

function invalidRefreshToken() {
  return new AppError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again');
}

/** Exchanges a refresh token for a new access token. */
export async function refresh(refreshToken: string | undefined): Promise<Omit<Session, 'refreshToken'>> {
  if (!refreshToken) throw invalidRefreshToken();

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!record) throw invalidRefreshToken();

  if (record.expiresAt <= new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } });
    throw invalidRefreshToken();
  }
  if (!record.user.isActive) throw invalidRefreshToken();

  return { user: toPublicUser(record.user), accessToken: signAccessToken(record.user) };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
}
