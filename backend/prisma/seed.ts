// Sample data for local development: demo chefs with menus, plus a demo customer.
// Safe to run more than once - existing demo records are updated, not duplicated.
//
//   npm run db:seed
//
// Every demo account uses the password below. Emails use the reserved .test domain,
// so no real inbox can ever receive mail sent to them.
// Meal photos are hosted by TheMealDB (https://www.themealdb.com) for development only.

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { MealCategory, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123';
const photo = (file: string) => `https://www.themealdb.com/images/media/meals/${file}`;

interface SeedMeal {
  name: string;
  description: string;
  price: number;
  category: MealCategory;
  cuisineType: string;
  dietaryTags: string[];
  servings: number;
  prepTimeMinutes: number;
  maxOrdersPerDay: number;
  imageUrl: string;
}

interface SeedChef {
  email: string;
  firstName: string;
  lastName: string;
  kitchenName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  certifications: string[];
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  serviceRadiusMiles: number;
  menuName: string;
  menuDescription: string;
  meals: SeedMeal[];
}

const foodHandler = 'California Food Handler Card';
const cottageFood = 'Cottage Food Operation Permit';

const chefs: SeedChef[] = [
  {
    email: 'maria@neighborskitchen.test',
    firstName: 'Maria',
    lastName: 'Delgado',
    kitchenName: "Abuela's Table",
    bio: "Recipes from my grandmother's kitchen in Michoacán, cooked fresh every week in Redlands. Everything is made from scratch, including the salsas.",
    specialties: ['Mexican', 'Comfort Food'],
    yearsExperience: 20,
    certifications: [foodHandler, cottageFood],
    addressLine1: '101 Demo Lane',
    city: 'Redlands',
    state: 'CA',
    zipCode: '92373',
    latitude: 34.0489,
    longitude: -117.1942,
    serviceRadiusMiles: 8,
    menuName: 'Family Favorites',
    menuDescription: 'The dishes my family asks for every Sunday.',
    meals: [
      {
        name: 'Chicken Enchilada Casserole',
        description: 'Layers of corn tortillas, slow-cooked chicken, roasted green chile sauce and melted Monterey Jack.',
        price: 14,
        category: 'DINNER',
        cuisineType: 'Mexican',
        dietaryTags: ['gluten-free'],
        servings: 2,
        prepTimeMinutes: 60,
        maxOrdersPerDay: 12,
        imageUrl: photo('qtuwxu1468233098.jpg'),
      },
      {
        name: 'Smoky Chickpea Fajitas',
        description: 'Chipotle chickpeas with charred peppers and onions, warm flour tortillas and fresh pico de gallo.',
        price: 12,
        category: 'LUNCH',
        cuisineType: 'Mexican',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 30,
        maxOrdersPerDay: 15,
        imageUrl: photo('tvtxpq1511464705.jpg'),
      },
      {
        name: 'Mexican Rice & Charro Beans',
        description: 'Tomato-simmered rice with pinto beans cooked low and slow with onion, garlic and cilantro.',
        price: 7,
        category: 'LUNCH',
        cuisineType: 'Mexican',
        dietaryTags: ['vegetarian', 'gluten-free'],
        servings: 2,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 20,
        imageUrl: photo('j8c1d51782772399.jpg'),
      },
      {
        name: 'Churros with Chocolate Sauce',
        description: 'Crisp cinnamon-sugar churros with a rich chocolate and salted caramel dipping sauce.',
        price: 7,
        category: 'DESSERT',
        cuisineType: 'Mexican',
        dietaryTags: ['vegetarian'],
        servings: 2,
        prepTimeMinutes: 25,
        maxOrdersPerDay: 20,
        imageUrl: photo('erzs951763296201.jpg'),
      },
    ],
  },
  {
    email: 'kenji@neighborskitchen.test',
    firstName: 'Kenji',
    lastName: 'Tanaka',
    kitchenName: 'Tanaka Home Kitchen',
    bio: 'Japanese home cooking the way my mother made it in Osaka: simple, seasonal and comforting. Now cooking for neighbors in Riverside.',
    specialties: ['Japanese', 'Asian Fusion'],
    yearsExperience: 12,
    certifications: [foodHandler],
    addressLine1: '202 Demo Lane',
    city: 'Riverside',
    state: 'CA',
    zipCode: '92501',
    latitude: 33.9806,
    longitude: -117.3755,
    serviceRadiusMiles: 10,
    menuName: 'Weeknight Japanese',
    menuDescription: 'Comforting Japanese dishes, ready for dinner.',
    meals: [
      {
        name: 'Chicken Katsu Curry',
        description: 'Panko-crusted chicken cutlet over steamed rice with a mild, velvety Japanese curry sauce.',
        price: 15,
        category: 'DINNER',
        cuisineType: 'Japanese',
        dietaryTags: ['dairy-free'],
        servings: 1,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 15,
        imageUrl: photo('vwrpps1503068729.jpg'),
      },
      {
        name: 'Honey Teriyaki Salmon',
        description: 'Glazed salmon fillet with house-made teriyaki, sesame greens and jasmine rice.',
        price: 17,
        category: 'DINNER',
        cuisineType: 'Japanese',
        dietaryTags: ['dairy-free'],
        servings: 1,
        prepTimeMinutes: 35,
        maxOrdersPerDay: 10,
        imageUrl: photo('xxyupu1468262513.jpg'),
      },
      {
        name: 'Homestyle Sushi Platter',
        description: 'Sixteen pieces of hand-rolled maki: salmon, cucumber and avocado, with pickled ginger.',
        price: 18,
        category: 'LUNCH',
        cuisineType: 'Japanese',
        dietaryTags: ['dairy-free'],
        servings: 1,
        prepTimeMinutes: 50,
        maxOrdersPerDay: 8,
        imageUrl: photo('g046bb1663960946.jpg'),
      },
      {
        name: 'Shoyu Ramen with Soft Egg',
        description: 'Springy noodles in a savory soy broth with a jammy marinated egg, scallions and nori.',
        price: 14,
        category: 'DINNER',
        cuisineType: 'Japanese',
        dietaryTags: ['dairy-free'],
        servings: 1,
        prepTimeMinutes: 40,
        maxOrdersPerDay: 12,
        imageUrl: photo('ip5xtp1769779958.jpg'),
      },
    ],
  },
  {
    email: 'aisha@neighborskitchen.test',
    firstName: 'Aisha',
    lastName: 'Rahman',
    kitchenName: 'Saffron & Sumac',
    bio: 'Mediterranean and Middle Eastern plates with bright spices and fresh herbs. All meat is halal. Cooking in Rancho Cucamonga.',
    specialties: ['Mediterranean', 'Middle Eastern', 'Halal'],
    yearsExperience: 9,
    certifications: [foodHandler, cottageFood],
    addressLine1: '303 Demo Lane',
    city: 'Rancho Cucamonga',
    state: 'CA',
    zipCode: '91730',
    latitude: 34.1215,
    longitude: -117.5703,
    serviceRadiusMiles: 7,
    menuName: 'Mezze & Mains',
    menuDescription: 'Share-friendly plates, spice-forward and fresh.',
    meals: [
      {
        name: 'Chicken Shawarma Plate',
        description: 'Spiced roasted chicken with garlic-herb yogurt, pickled onions, salad and warm pita.',
        price: 15,
        category: 'DINNER',
        cuisineType: 'Middle Eastern',
        dietaryTags: ['halal'],
        servings: 1,
        prepTimeMinutes: 40,
        maxOrdersPerDay: 15,
        imageUrl: photo('hcg6l91763596970.jpg'),
      },
      {
        name: 'Falafel Pita with Tahini',
        description: 'Crispy herb falafel tucked into pita with tahini sauce, tomato, cucumber and parsley.',
        price: 11,
        category: 'LUNCH',
        cuisineType: 'Middle Eastern',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 25,
        maxOrdersPerDay: 20,
        imageUrl: photo('ae6clc1760524712.jpg'),
      },
      {
        name: 'Shakshuka',
        description: 'Eggs gently poached in a spiced tomato and pepper sauce, finished with herbs. Bread on the side.',
        price: 12,
        category: 'BREAKFAST',
        cuisineType: 'Middle Eastern',
        dietaryTags: ['vegetarian', 'gluten-free'],
        servings: 2,
        prepTimeMinutes: 30,
        maxOrdersPerDay: 10,
        imageUrl: photo('g373701551450225.jpg'),
      },
      {
        name: 'Hummus & Warm Pita',
        description: 'Silky hummus with olive oil, paprika and chickpeas, served with freshly baked pita.',
        price: 8,
        category: 'SNACK',
        cuisineType: 'Mediterranean',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free'],
        servings: 2,
        prepTimeMinutes: 15,
        maxOrdersPerDay: 25,
        imageUrl: photo('gpon5u1763801180.jpg'),
      },
      {
        name: 'Honey Pistachio Baklava',
        description: 'Flaky layers of phyllo with spiced nuts and honey syrup. Six pieces.',
        price: 6,
        category: 'DESSERT',
        cuisineType: 'Mediterranean',
        dietaryTags: ['vegetarian', 'contains-nuts'],
        servings: 2,
        prepTimeMinutes: 20,
        maxOrdersPerDay: 25,
        imageUrl: photo('ytme8t1764111401.jpg'),
      },
    ],
  },
  {
    email: 'tony@neighborskitchen.test',
    firstName: 'Tony',
    lastName: 'Russo',
    kitchenName: "Nonna Rosa's",
    bio: "Southern Italian cooking passed down from my Nonna Rosa. Fresh pasta, long-simmered sauces and plenty of it. Serving Fontana and nearby.",
    specialties: ['Italian'],
    yearsExperience: 15,
    certifications: [foodHandler],
    addressLine1: '404 Demo Lane',
    city: 'Fontana',
    state: 'CA',
    zipCode: '92335',
    latitude: 34.1031,
    longitude: -117.4527,
    serviceRadiusMiles: 10,
    menuName: 'Sunday Supper',
    menuDescription: 'Classic Italian-American comfort food.',
    meals: [
      {
        name: 'Lasagna Bolognese',
        description: 'Fresh pasta sheets layered with slow-cooked beef ragù, béchamel and Parmigiano.',
        price: 16,
        category: 'DINNER',
        cuisineType: 'Italian',
        dietaryTags: [],
        servings: 2,
        prepTimeMinutes: 90,
        maxOrdersPerDay: 10,
        imageUrl: photo('wtsvxx1511296896.jpg'),
      },
      {
        name: 'Spaghetti alla Carbonara',
        description: 'Spaghetti tossed with crispy pancetta, egg yolk, Pecorino Romano and black pepper.',
        price: 14,
        category: 'DINNER',
        cuisineType: 'Italian',
        dietaryTags: [],
        servings: 1,
        prepTimeMinutes: 25,
        maxOrdersPerDay: 15,
        imageUrl: photo('llcbn01574260722.jpg'),
      },
      {
        name: 'Penne Arrabbiata',
        description: 'Penne in a fiery tomato, garlic and chili sauce with fresh basil.',
        price: 12,
        category: 'LUNCH',
        cuisineType: 'Italian',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free', 'spicy'],
        servings: 1,
        prepTimeMinutes: 25,
        maxOrdersPerDay: 20,
        imageUrl: photo('ustsqw1468250014.jpg'),
      },
      {
        name: 'Ricotta Cheesecake',
        description: 'A light, creamy cheesecake with ricotta and lemon zest on a buttery crust.',
        price: 7,
        category: 'DESSERT',
        cuisineType: 'Italian',
        dietaryTags: ['vegetarian'],
        servings: 1,
        prepTimeMinutes: 20,
        maxOrdersPerDay: 16,
        imageUrl: photo('swttys1511385853.jpg'),
      },
    ],
  },
  {
    email: 'grace@neighborskitchen.test',
    firstName: 'Grace',
    lastName: 'Johnson',
    kitchenName: "Grace's Soul Kitchen",
    bio: 'Southern soul food made with love and a little bit of Louisiana. My fried chicken has been winning church potlucks in San Bernardino for 25 years.',
    specialties: ['Soul Food', 'Southern'],
    yearsExperience: 25,
    certifications: [foodHandler, cottageFood],
    addressLine1: '505 Demo Lane',
    city: 'San Bernardino',
    state: 'CA',
    zipCode: '92401',
    latitude: 34.1231,
    longitude: -117.3004,
    serviceRadiusMiles: 12,
    menuName: 'Soul Food Sundays',
    menuDescription: 'Hearty Southern plates and desserts.',
    meals: [
      {
        name: 'Southern Fried Chicken',
        description: 'Buttermilk-brined chicken fried golden and crispy. Four pieces with a biscuit.',
        price: 15,
        category: 'DINNER',
        cuisineType: 'Southern',
        dietaryTags: [],
        servings: 1,
        prepTimeMinutes: 60,
        maxOrdersPerDay: 15,
        imageUrl: photo('40r49m1763197022.jpg'),
      },
      {
        name: 'Skillet Pork Chops with Sweet Potatoes',
        description: 'Pan-seared pork chops with caramelized apples, roasted sweet potatoes and zucchini.',
        price: 16,
        category: 'DINNER',
        cuisineType: 'Southern',
        dietaryTags: ['gluten-free'],
        servings: 1,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 10,
        imageUrl: photo('h3ijwo1581013377.jpg'),
      },
      {
        name: 'Baked Mac and Cheese',
        description: 'Three-cheese baked macaroni with a golden, bubbly top.',
        price: 9,
        category: 'LUNCH',
        cuisineType: 'Southern',
        dietaryTags: ['vegetarian'],
        servings: 2,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 20,
        imageUrl: photo('kpiu4t1782242131.jpg'),
      },
      {
        name: 'Peach Cobbler',
        description: 'Juicy spiced peaches and blueberries under a soft, buttery biscuit topping.',
        price: 7,
        category: 'DESSERT',
        cuisineType: 'Southern',
        dietaryTags: ['vegetarian'],
        servings: 2,
        prepTimeMinutes: 50,
        maxOrdersPerDay: 12,
        imageUrl: photo('ssxvup1511387476.jpg'),
      },
    ],
  },
  {
    email: 'priya@neighborskitchen.test',
    firstName: 'Priya',
    lastName: 'Patel',
    kitchenName: 'Masala Home',
    bio: 'Gujarati and North Indian home cooking with plenty of vegetarian options. Spice levels made to order. Cooking in Palm Desert.',
    specialties: ['Indian', 'Vegetarian'],
    yearsExperience: 11,
    certifications: [foodHandler],
    addressLine1: '606 Demo Lane',
    city: 'Palm Desert',
    state: 'CA',
    zipCode: '92260',
    latitude: 33.7302,
    longitude: -116.3895,
    serviceRadiusMiles: 10,
    menuName: 'Masala Classics',
    menuDescription: 'Everyday Indian favorites, mostly vegetarian.',
    meals: [
      {
        name: 'Matar Paneer',
        description: 'Soft paneer and sweet peas in a creamy, gently spiced tomato gravy. Served with basmati rice.',
        price: 13,
        category: 'DINNER',
        cuisineType: 'Indian',
        dietaryTags: ['vegetarian', 'gluten-free'],
        servings: 1,
        prepTimeMinutes: 40,
        maxOrdersPerDay: 15,
        imageUrl: photo('xxpqsy1511452222.jpg'),
      },
      {
        name: 'Dal Fry with Basmati Rice',
        description: 'Yellow lentils tempered with cumin, garlic and chili. Comforting and protein-packed.',
        price: 11,
        category: 'DINNER',
        cuisineType: 'Indian',
        dietaryTags: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 35,
        maxOrdersPerDay: 20,
        imageUrl: photo('wuxrtu1483564410.jpg'),
      },
      {
        name: 'Lamb Biryani',
        description: 'Fragrant basmati layered with tender spiced lamb, saffron and crispy onions. Raita on the side.',
        price: 16,
        category: 'DINNER',
        cuisineType: 'Indian',
        dietaryTags: ['gluten-free'],
        servings: 2,
        prepTimeMinutes: 90,
        maxOrdersPerDay: 8,
        imageUrl: photo('xrttsx1487339558.jpg'),
      },
      {
        name: 'Rajma Kidney Bean Curry',
        description: 'Punjabi-style kidney beans simmered in an onion-tomato masala. Great with rice.',
        price: 12,
        category: 'LUNCH',
        cuisineType: 'Indian',
        dietaryTags: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 15,
        imageUrl: photo('sywrsu1511463066.jpg'),
      },
      {
        name: 'Mango Lassi',
        description: 'Chilled blend of ripe mango, yogurt and a pinch of cardamom.',
        price: 5,
        category: 'SNACK',
        cuisineType: 'Indian',
        dietaryTags: ['vegetarian', 'gluten-free'],
        servings: 1,
        prepTimeMinutes: 10,
        maxOrdersPerDay: 30,
        imageUrl: photo('pjbaq11784731571.jpg'),
      },
    ],
  },
  {
    email: 'linh@neighborskitchen.test',
    firstName: 'Linh',
    lastName: 'Nguyen',
    kitchenName: 'Little Saigon Kitchen',
    bio: 'Vietnamese street food and family recipes, full of fresh herbs. My pho broth simmers for twelve hours. Cooking in Palm Springs.',
    specialties: ['Vietnamese'],
    yearsExperience: 8,
    certifications: [foodHandler],
    addressLine1: '707 Demo Lane',
    city: 'Palm Springs',
    state: 'CA',
    zipCode: '92262',
    latitude: 33.8165,
    longitude: -116.5302,
    serviceRadiusMiles: 8,
    menuName: 'Street Food Favorites',
    menuDescription: 'Bright, herby Vietnamese classics.',
    meals: [
      {
        name: 'Beef Pho',
        description: 'Twelve-hour beef broth with rice noodles, thin-sliced beef, Thai basil, lime and bean sprouts.',
        price: 14,
        category: 'DINNER',
        cuisineType: 'Vietnamese',
        dietaryTags: ['dairy-free', 'gluten-free'],
        servings: 1,
        prepTimeMinutes: 30,
        maxOrdersPerDay: 15,
        imageUrl: photo('pbzcrx1763765096.jpg'),
      },
      {
        name: 'Lemongrass Beef Noodles',
        description: 'Lemongrass-braised beef over rice noodles with pickled vegetables and herbs.',
        price: 15,
        category: 'DINNER',
        cuisineType: 'Vietnamese',
        dietaryTags: ['dairy-free'],
        servings: 1,
        prepTimeMinutes: 45,
        maxOrdersPerDay: 12,
        imageUrl: photo('ntafxw1763586291.jpg'),
      },
      {
        name: 'Tofu Banh Mi',
        description: 'Crusty baguette with lemongrass tofu, pickled carrot and daikon, cucumber, cilantro and chili mayo.',
        price: 10,
        category: 'LUNCH',
        cuisineType: 'Vietnamese',
        dietaryTags: ['vegetarian', 'vegan'],
        servings: 1,
        prepTimeMinutes: 20,
        maxOrdersPerDay: 20,
        imageUrl: photo('sonirb1763782831.jpg'),
      },
      {
        name: 'Herb Noodle Salad Bowl',
        description: 'Cool rice noodles with crunchy vegetables, mint, peanuts and a sweet-tangy nuoc cham dressing.',
        price: 12,
        category: 'LUNCH',
        cuisineType: 'Vietnamese',
        dietaryTags: ['dairy-free', 'contains-nuts'],
        servings: 1,
        prepTimeMinutes: 20,
        maxOrdersPerDay: 15,
        imageUrl: photo('zry07j1763779321.jpg'),
      },
    ],
  },
  {
    email: 'sofia@neighborskitchen.test',
    firstName: 'Sofia',
    lastName: 'Morales',
    kitchenName: 'Desert Greens',
    bio: 'Colorful plant-based meals for busy people in the Coachella Valley. Everything is vegan and most dishes are gluten-free.',
    specialties: ['Vegan', 'Healthy'],
    yearsExperience: 6,
    certifications: [foodHandler],
    addressLine1: '808 Demo Lane',
    city: 'Indio',
    state: 'CA',
    zipCode: '92201',
    latitude: 33.7157,
    longitude: -116.224,
    serviceRadiusMiles: 15,
    menuName: 'Plant-Powered Week',
    menuDescription: 'Healthy vegan meals that keep you full.',
    meals: [
      {
        name: 'Quinoa & Black Bean Stuffed Peppers',
        description: 'Roasted bell peppers filled with quinoa, black beans, corn and smoky tomato sauce.',
        price: 13,
        category: 'DINNER',
        cuisineType: 'Healthy',
        dietaryTags: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
        servings: 2,
        prepTimeMinutes: 50,
        maxOrdersPerDay: 12,
        imageUrl: photo('b66myb1683207208.jpg'),
      },
      {
        name: 'Tofu, Greens & Cashew Stir-Fry',
        description: 'Crispy tofu with bok choy, broccoli and toasted cashews in a ginger-garlic sauce, over brown rice.',
        price: 13,
        category: 'DINNER',
        cuisineType: 'Asian Fusion',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free', 'contains-nuts'],
        servings: 1,
        prepTimeMinutes: 30,
        maxOrdersPerDay: 15,
        imageUrl: photo('minfsc1763766806.jpg'),
      },
      {
        name: 'Smoky Lentil Chili with Squash',
        description: 'Hearty lentil and butternut squash chili with chipotle, topped with cilantro and lime.',
        price: 12,
        category: 'LUNCH',
        cuisineType: 'Healthy',
        dietaryTags: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
        servings: 2,
        prepTimeMinutes: 60,
        maxOrdersPerDay: 15,
        imageUrl: photo('uwxqwy1483389553.jpg'),
      },
      {
        name: 'Oatmeal Pancakes',
        description: 'Fluffy oat pancakes with fresh berries and maple syrup. A stack of four.',
        price: 9,
        category: 'BREAKFAST',
        cuisineType: 'Healthy',
        dietaryTags: ['vegetarian', 'vegan', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 20,
        maxOrdersPerDay: 15,
        imageUrl: photo('c400ok1764439058.jpg'),
      },
      {
        name: 'Chocolate Avocado Mousse',
        description: 'Silky dark chocolate mousse made with avocado and maple. Rich, but light.',
        price: 7,
        category: 'DESSERT',
        cuisineType: 'Healthy',
        dietaryTags: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
        servings: 1,
        prepTimeMinutes: 15,
        maxOrdersPerDay: 20,
        imageUrl: photo('uttuxy1511382180.jpg'),
      },
    ],
  },
];

const customers = [
  { email: 'customer@neighborskitchen.test', firstName: 'Chris', lastName: 'Walker' },
];

async function upsertUser(
  data: { email: string; firstName: string; lastName: string },
  role: UserRole,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: { firstName: data.firstName, lastName: data.lastName, role, passwordHash, isActive: true },
    create: { ...data, role, passwordHash, emailVerified: true },
  });
}

async function seedChef(chef: SeedChef, passwordHash: string) {
  const { meals, menuName, menuDescription, email, firstName, lastName, ...profile } = chef;
  const user = await upsertUser({ email, firstName, lastName }, 'CHEF', passwordHash);

  const chefProfile = await prisma.chefProfile.upsert({
    where: { userId: user.id },
    update: profile,
    create: { ...profile, userId: user.id },
  });

  const existingMenu = await prisma.menu.findFirst({ where: { chefId: chefProfile.id, name: menuName } });
  const menu = existingMenu
    ? await prisma.menu.update({ where: { id: existingMenu.id }, data: { description: menuDescription, isActive: true } })
    : await prisma.menu.create({ data: { chefId: chefProfile.id, name: menuName, description: menuDescription } });

  for (const meal of meals) {
    const existingMeal = await prisma.meal.findFirst({ where: { chefId: chefProfile.id, name: meal.name } });
    if (existingMeal) {
      await prisma.meal.update({ where: { id: existingMeal.id }, data: { ...meal, menuId: menu.id, isAvailable: true } });
    } else {
      await prisma.meal.create({ data: { ...meal, menuId: menu.id, chefId: chefProfile.id } });
    }
  }
  return meals.length;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const customer of customers) {
    await upsertUser(customer, 'CUSTOMER', passwordHash);
  }

  let mealCount = 0;
  for (const chef of chefs) {
    mealCount += await seedChef(chef, passwordHash);
  }

  console.log(`Seeded ${chefs.length} chefs, ${mealCount} meals and ${customers.length} customer.`);
  console.log(`Demo logins (password for all: ${DEMO_PASSWORD}):`);
  console.log(`  Customer: ${customers[0].email}`);
  console.log(`  Chef:     ${chefs[0].email} (and kenji@, aisha@, tony@, grace@, priya@, linh@, sofia@)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
