// Sample data for local development: demo chefs with menus, demo customers, past orders with
// reviews, and dish requests with votes.
// Safe to run more than once - existing demo records are updated, not duplicated.
//
//   npm run db:seed
//
// Every demo account uses the password below. Emails use the reserved .test domain,
// so no real inbox can ever receive mail sent to them.
// Meal photos are hosted by TheMealDB (https://www.themealdb.com) for development only.

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { MealCategory, OrderStatus, Prisma, PrismaClient, SuggestionStatus, UserRole } from '@prisma/client';
import { approximateLocation, seededRandom } from '../src/services/geo.js';
import { zipCentroid } from '../src/services/zipCodes.js';

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
  // Neighbors who have ordered, left reviews and requested dishes.
  { email: 'dana@neighborskitchen.test', firstName: 'Dana', lastName: 'Kim' },
  { email: 'luis@neighborskitchen.test', firstName: 'Luis', lastName: 'Ortega' },
  { email: 'hannah@neighborskitchen.test', firstName: 'Hannah', lastName: 'Lee' },
  { email: 'marcus@neighborskitchen.test', firstName: 'Marcus', lastName: 'Brown' },
];

const CHRIS = 'customer@neighborskitchen.test';
const DANA = 'dana@neighborskitchen.test';
const LUIS = 'luis@neighborskitchen.test';
const HANNAH = 'hannah@neighborskitchen.test';
const MARCUS = 'marcus@neighborskitchen.test';

interface SeedPastOrder {
  chef: string;
  customer: string;
  meal: string;
  daysAgo: number;
  /** Left out for an order that is completed but not reviewed yet, so the demo customer can try rating it. */
  rating?: number;
  comment?: string;
  reply?: string;
}

// Completed pickup orders, one meal each, most with the customer's review.
const pastOrders: SeedPastOrder[] = [
  { chef: 'maria@neighborskitchen.test', customer: CHRIS, meal: 'Chicken Enchilada Casserole', daysAgo: 12, rating: 5, comment: "Tasted just like my tía's. The green chile sauce is incredible.", reply: 'Gracias, Chris! That sauce is my grandmother\'s recipe.' },
  { chef: 'maria@neighborskitchen.test', customer: DANA, meal: 'Chicken Enchilada Casserole', daysAgo: 5, rating: 5, comment: 'Fed our family of four with leftovers for lunch. Will order again.' },
  { chef: 'maria@neighborskitchen.test', customer: LUIS, meal: 'Churros with Chocolate Sauce', daysAgo: 9, rating: 4, comment: 'Crispy and still warm at pickup. The chocolate sauce could be a little thicker.', reply: "Thanks, Luis! I'm making the next batch richer." },
  { chef: 'maria@neighborskitchen.test', customer: HANNAH, meal: 'Smoky Chickpea Fajitas', daysAgo: 3, rating: 5, comment: "Best vegetarian fajitas I've had. Great smoky flavor." },
  { chef: 'kenji@neighborskitchen.test', customer: HANNAH, meal: 'Chicken Katsu Curry', daysAgo: 10, rating: 5, comment: 'Crunchy katsu and a rich, mild curry. My kids loved it.', reply: 'So happy the kids liked it!' },
  { chef: 'kenji@neighborskitchen.test', customer: MARCUS, meal: 'Shoyu Ramen with Soft Egg', daysAgo: 6, rating: 4, comment: 'Great broth. The noodles were packed separately so they stayed perfect.' },
  { chef: 'kenji@neighborskitchen.test', customer: DANA, meal: 'Honey Teriyaki Salmon', daysAgo: 2, rating: 5 },
  { chef: 'kenji@neighborskitchen.test', customer: CHRIS, meal: 'Chicken Katsu Curry', daysAgo: 1 },
  { chef: 'aisha@neighborskitchen.test', customer: LUIS, meal: 'Chicken Shawarma Plate', daysAgo: 8, rating: 5, comment: 'Generous portion, and the garlic sauce is addictive.', reply: 'The garlic sauce is the secret. Thank you, Luis!' },
  { chef: 'aisha@neighborskitchen.test', customer: CHRIS, meal: 'Falafel Pita with Tahini', daysAgo: 4, rating: 4, comment: 'Fresh, crispy falafel. I would love extra pickles next time.' },
  { chef: 'aisha@neighborskitchen.test', customer: MARCUS, meal: 'Honey Pistachio Baklava', daysAgo: 11, rating: 5, comment: 'Flaky and not too sweet. Perfect with coffee.' },
  { chef: 'tony@neighborskitchen.test', customer: DANA, meal: 'Lasagna Bolognese', daysAgo: 7, rating: 5, comment: 'Huge, cheesy, and the sauce tastes like it simmered all day.', reply: 'It did! Eight hours. Thanks, Dana.' },
  { chef: 'tony@neighborskitchen.test', customer: HANNAH, meal: 'Spaghetti alla Carbonara', daysAgo: 13, rating: 3, comment: 'Good flavor, but a bit salty for me.', reply: 'Thanks for the honest feedback. I have cut back on the pecorino.' },
  { chef: 'tony@neighborskitchen.test', customer: CHRIS, meal: 'Ricotta Cheesecake', daysAgo: 2, rating: 5, comment: 'Light and creamy. Gone in one evening.' },
  { chef: 'grace@neighborskitchen.test', customer: MARCUS, meal: 'Southern Fried Chicken', daysAgo: 9, rating: 5, comment: 'Crispiest fried chicken in the Inland Empire. Period.', reply: 'You made my day, Marcus!' },
  { chef: 'grace@neighborskitchen.test', customer: LUIS, meal: 'Peach Cobbler', daysAgo: 5, rating: 5, comment: 'Warm, buttery and full of peaches.' },
  { chef: 'grace@neighborskitchen.test', customer: DANA, meal: 'Baked Mac and Cheese', daysAgo: 3, rating: 4 },
  { chef: 'priya@neighborskitchen.test', customer: CHRIS, meal: 'Matar Paneer', daysAgo: 6, rating: 5, comment: 'Soft paneer and a beautifully spiced gravy.' },
  { chef: 'priya@neighborskitchen.test', customer: LUIS, meal: 'Lamb Biryani', daysAgo: 12, rating: 5, comment: 'Fragrant rice and tender lamb. Worth ordering ahead.', reply: 'Thank you! Biryani is my favorite dish to share.' },
  { chef: 'priya@neighborskitchen.test', customer: HANNAH, meal: 'Dal Fry with Basmati Rice', daysAgo: 1, rating: 4, comment: 'Comforting and filling. Great value.' },
  { chef: 'linh@neighborskitchen.test', customer: DANA, meal: 'Beef Pho', daysAgo: 8, rating: 5, comment: 'Clear, rich broth, with all the herbs packed fresh on the side.', reply: 'Cảm ơn, Dana! Enjoy the next bowl.' },
  { chef: 'linh@neighborskitchen.test', customer: MARCUS, meal: 'Tofu Banh Mi', daysAgo: 4, rating: 4, comment: 'Crusty bread and lots of pickled veggies.' },
  { chef: 'sofia@neighborskitchen.test', customer: HANNAH, meal: 'Quinoa & Black Bean Stuffed Peppers', daysAgo: 10, rating: 5, comment: 'Healthy and actually filling. Great for meal prep.' },
  { chef: 'sofia@neighborskitchen.test', customer: CHRIS, meal: 'Oatmeal Pancakes', daysAgo: 3, rating: 4, comment: 'Fluffy and not too sweet. They reheated well.', reply: 'Try them with the berry compote next time!' },
];

interface SeedSuggestion {
  chef: string;
  by: string;
  mealName: string;
  description: string;
  dietaryRequirements?: string[];
  /** Neighbors who voted for it, besides the person who asked. */
  voters: string[];
  status?: SuggestionStatus;
  reply?: string;
}

const suggestions: SeedSuggestion[] = [
  { chef: 'maria@neighborskitchen.test', by: DANA, mealName: 'Birria tacos with consommé', description: 'Slow-cooked beef birria with a cup of consommé for dipping. Would order every weekend!', voters: [LUIS, HANNAH, CHRIS], status: 'CONSIDERING', reply: 'Love this idea! I am testing my family recipe this month.' },
  { chef: 'maria@neighborskitchen.test', by: LUIS, mealName: 'Tamales de rajas', description: 'Pepper and cheese tamales for the holidays, by the dozen.', dietaryRequirements: ['vegetarian', 'gluten-free'], voters: [MARCUS] },
  { chef: 'kenji@neighborskitchen.test', by: HANNAH, mealName: 'Chicken karaage bento', description: 'Japanese fried chicken with rice, pickles and a little salad. Great for school lunches.', voters: [DANA, CHRIS], status: 'ACCEPTED', reply: 'Coming to the menu next Saturday!' },
  { chef: 'tony@neighborskitchen.test', by: MARCUS, mealName: 'Gluten-free lasagna', description: 'Your lasagna, but with gluten-free noodles so my whole family can share it.', dietaryRequirements: ['gluten-free'], voters: [HANNAH] },
  { chef: 'priya@neighborskitchen.test', by: CHRIS, mealName: 'Butter chicken', description: 'Creamy, mildly spiced butter chicken with naan. A family favorite at our house.', voters: [DANA, LUIS, MARCUS, HANNAH], status: 'CONSIDERING' },
  { chef: 'grace@neighborskitchen.test', by: DANA, mealName: 'Shrimp and grits', description: 'Creamy grits with Cajun shrimp, like in Charleston.', voters: [], status: 'DECLINED', reply: 'I cannot get shellfish fresh enough here, sorry! Try my fried catfish instead.' },
];

// When each chef has food ready (0 = Sunday ... 6 = Saturday) and how it is handed over.
const weekly = (days: number[], startTime: string, endTime: string) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));

const fulfillment: Record<
  string,
  { availability: ReturnType<typeof weekly>; orderLeadTimeHours: number; offersDelivery: boolean; deliveryFee: number }
> = {
  'maria@neighborskitchen.test': { availability: weekly([2, 3, 4, 5, 6], '17:00', '20:00'), orderLeadTimeHours: 24, offersDelivery: true, deliveryFee: 4.99 },
  'kenji@neighborskitchen.test': { availability: weekly([0, 3, 4, 5, 6], '16:30', '19:30'), orderLeadTimeHours: 24, offersDelivery: false, deliveryFee: 0 },
  'aisha@neighborskitchen.test': { availability: weekly([1, 2, 3, 4, 5], '11:00', '14:00'), orderLeadTimeHours: 12, offersDelivery: true, deliveryFee: 3.99 },
  'tony@neighborskitchen.test': { availability: weekly([0, 5, 6], '16:00', '19:00'), orderLeadTimeHours: 48, offersDelivery: true, deliveryFee: 5.99 },
  'grace@neighborskitchen.test': { availability: weekly([0, 6], '12:00', '18:00'), orderLeadTimeHours: 48, offersDelivery: false, deliveryFee: 0 },
  'priya@neighborskitchen.test': { availability: weekly([1, 2, 3, 4, 5], '17:30', '20:00'), orderLeadTimeHours: 24, offersDelivery: true, deliveryFee: 4.49 },
  'linh@neighborskitchen.test': { availability: weekly([0, 2, 3, 4, 5, 6], '11:00', '15:00'), orderLeadTimeHours: 12, offersDelivery: false, deliveryFee: 0 },
  'sofia@neighborskitchen.test': { availability: weekly([1, 2, 3, 4, 5], '08:00', '12:00'), orderLeadTimeHours: 24, offersDelivery: true, deliveryFee: 2.99 },
};

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
  const { meals, menuName, menuDescription, email, firstName, lastName, ...details } = chef;
  const { availability, ...handover } = fulfillment[email];
  // The public area center is picked from the chef's email, so reseeding keeps the same circle on the map.
  const area = approximateLocation({ latitude: details.latitude, longitude: details.longitude }, seededRandom(email));
  const profile = {
    ...details,
    ...handover,
    approxLatitude: area.latitude,
    approxLongitude: area.longitude,
    offersPickup: true,
    isAcceptingOrders: true,
  };
  const user = await upsertUser({ email, firstName, lastName }, 'CHEF', passwordHash);

  const chefProfile = await prisma.chefProfile.upsert({
    where: { userId: user.id },
    update: profile,
    create: { ...profile, userId: user.id },
  });

  await prisma.chefAvailability.deleteMany({ where: { chefId: chefProfile.id } });
  await prisma.chefAvailability.createMany({
    data: availability.map((window) => ({ ...window, chefId: chefProfile.id })),
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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);

/** Around 6 PM in California, `days` days ago. */
function daysAgoAtDinner(days: number): Date {
  const date = new Date(Date.now() - days * DAY);
  date.setUTCHours(1, 0, 0, 0);
  return date;
}

async function findChef(email: string) {
  return prisma.chefProfile.findFirstOrThrow({ where: { user: { email } } });
}

async function findUser(email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function seedPastOrder(entry: SeedPastOrder, index: number) {
  const orderNumber = `NK-DEMO${String(index + 1).padStart(2, '0')}`;
  const [customer, chef] = await Promise.all([findUser(entry.customer), findChef(entry.chef)]);
  const meal = await prisma.meal.findFirstOrThrow({ where: { chefId: chef.id, name: entry.meal } });

  const scheduledFor = daysAgoAtDinner(entry.daysAgo);
  const placedAt = new Date(scheduledFor.getTime() - 2 * DAY);
  const completedAt = new Date(scheduledFor.getTime() + HOUR / 2);
  const order = {
    customerId: customer.id,
    chefId: chef.id,
    status: 'COMPLETED' as OrderStatus,
    subtotal: meal.price,
    deliveryFee: new Prisma.Decimal(0),
    platformFee: meal.price.mul(platformFeePercent).div(100).toDecimalPlaces(2),
    total: meal.price,
    pickupOrDelivery: 'PICKUP' as const,
    scheduledFor,
    completedAt,
    createdAt: placedAt,
  };
  const saved = await prisma.order.upsert({ where: { orderNumber }, update: order, create: { ...order, orderNumber } });

  await prisma.orderItem.deleteMany({ where: { orderId: saved.id } });
  await prisma.orderItem.create({
    data: { orderId: saved.id, mealId: meal.id, mealName: meal.name, quantity: 1, priceAtPurchase: meal.price },
  });
  await prisma.orderEvent.deleteMany({ where: { orderId: saved.id } });
  const steps: [OrderStatus, Date][] = [
    ['PENDING', placedAt],
    ['CONFIRMED', new Date(placedAt.getTime() + 2 * HOUR)],
    ['PREPARING', new Date(scheduledFor.getTime() - 3 * HOUR)],
    ['READY', new Date(scheduledFor.getTime() - HOUR / 4)],
    ['COMPLETED', completedAt],
  ];
  await prisma.orderEvent.createMany({
    data: steps.map(([status, createdAt]) => ({ orderId: saved.id, status, createdAt })),
  });

  if (entry.rating === undefined) return false;
  const review = {
    chefId: chef.id,
    customerId: customer.id,
    rating: entry.rating,
    comment: entry.comment ?? null,
    chefResponse: entry.reply ?? null,
    chefRespondedAt: entry.reply ? new Date(completedAt.getTime() + DAY) : null,
    createdAt: new Date(completedAt.getTime() + 2 * HOUR),
  };
  await prisma.review.upsert({
    where: { orderId_mealId: { orderId: saved.id, mealId: meal.id } },
    update: review,
    create: { ...review, orderId: saved.id, mealId: meal.id },
  });
  return true;
}

async function seedSuggestion(entry: SeedSuggestion) {
  const [chef, suggester] = await Promise.all([findChef(entry.chef), findUser(entry.by)]);
  const details = {
    description: entry.description,
    dietaryRequirements: entry.dietaryRequirements ?? [],
    status: entry.status ?? 'PENDING',
    chefResponse: entry.reply ?? null,
  };
  const existing = await prisma.suggestion.findFirst({
    where: { chefId: chef.id, customerId: suggester.id, mealName: entry.mealName },
  });
  const suggestion = existing
    ? await prisma.suggestion.update({ where: { id: existing.id }, data: details })
    : await prisma.suggestion.create({ data: { ...details, chefId: chef.id, customerId: suggester.id, mealName: entry.mealName } });

  const voters = await Promise.all([entry.by, ...entry.voters].map(findUser));
  await prisma.suggestionVote.createMany({
    data: voters.map((voter) => ({ suggestionId: suggestion.id, userId: voter.id })),
    skipDuplicates: true,
  });
  const votes = await prisma.suggestionVote.count({ where: { suggestionId: suggestion.id } });
  await prisma.suggestion.update({ where: { id: suggestion.id }, data: { votes } });
}

const averageOf = (value: number | null) => (value === null ? null : new Prisma.Decimal(value).toDecimalPlaces(2));

/** Recounts ratings and completed orders from the records, the same numbers the app keeps up to date. */
async function refreshStats() {
  const meals = await prisma.meal.findMany({ select: { id: true } });
  for (const meal of meals) {
    const [reviews, totalOrders] = await Promise.all([
      prisma.review.aggregate({ where: { mealId: meal.id }, _avg: { rating: true }, _count: true }),
      prisma.orderItem.count({ where: { mealId: meal.id, order: { status: 'COMPLETED' } } }),
    ]);
    await prisma.meal.update({
      where: { id: meal.id },
      data: { averageRating: averageOf(reviews._avg.rating), totalReviews: reviews._count, totalOrders },
    });
  }
  const chefProfiles = await prisma.chefProfile.findMany({ select: { id: true } });
  for (const chef of chefProfiles) {
    const [reviews, totalOrders] = await Promise.all([
      prisma.review.aggregate({ where: { chefId: chef.id }, _avg: { rating: true }, _count: true }),
      prisma.order.count({ where: { chefId: chef.id, status: 'COMPLETED' } }),
    ]);
    await prisma.chefProfile.update({
      where: { id: chef.id },
      data: { averageRating: averageOf(reviews._avg.rating), totalReviews: reviews._count, totalOrders },
    });
  }
}

/** Puts kitchens made outside the seed (for example while trying the app) on the map, without calling the geocoder. */
async function fillMissingAreas() {
  const chefs = await prisma.chefProfile.findMany({
    where: { OR: [{ approxLatitude: null }, { approxLongitude: null }] },
    select: { id: true, latitude: true, longitude: true, zipCode: true },
  });
  let placed = 0;
  for (const chef of chefs) {
    const exact =
      chef.latitude && chef.longitude
        ? { latitude: chef.latitude.toNumber(), longitude: chef.longitude.toNumber() }
        : zipCentroid(chef.zipCode);
    if (!exact) continue;
    const area = approximateLocation(exact, seededRandom(chef.id));
    await prisma.chefProfile.update({
      where: { id: chef.id },
      data: { ...exact, approxLatitude: area.latitude, approxLongitude: area.longitude },
    });
    placed += 1;
  }
  return placed;
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
  const otherKitchens = await fillMissingAreas();

  let reviewCount = 0;
  for (const [index, entry] of pastOrders.entries()) {
    if (await seedPastOrder(entry, index)) reviewCount += 1;
  }
  for (const entry of suggestions) {
    await seedSuggestion(entry);
  }
  await refreshStats();

  console.log(`Seeded ${chefs.length} chefs, ${mealCount} meals and ${customers.length} customers.`);
  console.log(`Added ${pastOrders.length} past orders, ${reviewCount} reviews and ${suggestions.length} dish requests.`);
  console.log(`Placed ${otherKitchens} other kitchens on the map.`);
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
