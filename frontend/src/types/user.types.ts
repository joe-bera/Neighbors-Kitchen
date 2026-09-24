export type UserRole = 'CUSTOMER' | 'CHEF' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePhotoUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}

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

export interface CurrentUser extends User {
  chefProfile: ChefProfileSummary | null;
}
