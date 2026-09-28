import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { EmailSettingsInput } from '../validators/userSchemas.js';
import { PublicUser, toPublicUser } from './authService.js';

export interface ChefProfileSummary {
  id: string;
  kitchenName: string | null;
  bio: string | null;
  city: string;
  state: string;
  specialties: string[];
  isAcceptingOrders: boolean;
  mealCount: number;
}

/** The optional emails a person can turn off. Order and password emails always go out. */
export interface EmailSettings {
  rateReminders: boolean;
  dishRequestNews: boolean;
  kitchenFeedback: boolean;
}

function toEmailSettings(user: { emailRateReminders: boolean; emailDishRequestNews: boolean; emailKitchenFeedback: boolean }): EmailSettings {
  return {
    rateReminders: user.emailRateReminders,
    dishRequestNews: user.emailDishRequestNews,
    kitchenFeedback: user.emailKitchenFeedback,
  };
}

export interface CurrentUser extends PublicUser {
  chefProfile: ChefProfileSummary | null;
  emailSettings: EmailSettings;
}

export async function getCurrentUser(userId: string): Promise<CurrentUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { chefProfile: { include: { _count: { select: { meals: true } } } } },
  });
  if (!user || !user.isActive) {
    throw new AppError(401, 'INVALID_TOKEN', 'Your session is not valid. Please log in again.');
  }

  const chef = user.chefProfile;
  return {
    ...toPublicUser(user),
    chefProfile: chef && {
      id: chef.id,
      kitchenName: chef.kitchenName,
      bio: chef.bio,
      city: chef.city,
      state: chef.state,
      specialties: chef.specialties,
      isAcceptingOrders: chef.isAcceptingOrders,
      mealCount: chef._count.meals,
    },
    emailSettings: toEmailSettings(user),
  };
}

/** Turns optional emails on or off. Settings left out stay as they are. */
export async function updateEmailSettings(userId: string, changes: EmailSettingsInput): Promise<EmailSettings> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailRateReminders: changes.rateReminders,
      emailDishRequestNews: changes.dishRequestNews,
      emailKitchenFeedback: changes.kitchenFeedback,
    },
  });
  return toEmailSettings(user);
}
