import { MealCategory } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

// Test-only helpers for creating chefs and meals directly in the test database.

let sequence = 0;

interface ChefOptions {
  firstName?: string;
  lastName?: string;
  kitchenName?: string | null;
  city?: string;
  specialties?: string[];
  isActive?: boolean;
  menuIsActive?: boolean;
}

export async function createChef(options: ChefOptions = {}) {
  sequence += 1;
  const user = await prisma.user.create({
    data: {
      email: `chef${sequence}@example.com`,
      passwordHash: 'not-a-real-hash',
      firstName: options.firstName ?? 'Maria',
      lastName: options.lastName ?? 'Delgado',
      role: 'CHEF',
      isActive: options.isActive ?? true,
    },
  });
  const chef = await prisma.chefProfile.create({
    data: {
      userId: user.id,
      kitchenName: options.kitchenName === undefined ? `Kitchen ${sequence}` : options.kitchenName,
      bio: 'Home cooking with love.',
      specialties: options.specialties ?? ['Mexican'],
      yearsExperience: 10,
      certifications: ['California Food Handler Card'],
      addressLine1: '123 Private Street',
      city: options.city ?? 'Redlands',
      state: 'CA',
      zipCode: '92373',
      latitude: 34.0556,
      longitude: -117.1825,
    },
  });
  const menu = await prisma.menu.create({
    data: { chefId: chef.id, name: 'Main Menu', isActive: options.menuIsActive ?? true },
  });
  return { user, chef, menu };
}

interface MealOptions {
  name?: string;
  description?: string;
  price?: number;
  category?: MealCategory;
  cuisineType?: string | null;
  dietaryTags?: string[];
  isAvailable?: boolean;
  imageUrl?: string | null;
}

export async function createMeal(owner: { chef: { id: string }; menu: { id: string } }, options: MealOptions = {}) {
  sequence += 1;
  return prisma.meal.create({
    data: {
      chefId: owner.chef.id,
      menuId: owner.menu.id,
      name: options.name ?? `Meal ${sequence}`,
      description: options.description ?? 'A delicious home-cooked meal.',
      price: options.price ?? 12,
      category: options.category ?? 'DINNER',
      cuisineType: options.cuisineType === undefined ? 'Mexican' : options.cuisineType,
      dietaryTags: options.dietaryTags ?? [],
      isAvailable: options.isAvailable ?? true,
      imageUrl: options.imageUrl === undefined ? `https://images.example.com/meal-${sequence}.jpg` : options.imageUrl,
      prepTimeMinutes: 30,
      servings: 1,
    },
  });
}
