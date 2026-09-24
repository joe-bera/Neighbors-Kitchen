import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
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

export interface CurrentUser extends PublicUser {
  chefProfile: ChefProfileSummary | null;
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
  };
}
