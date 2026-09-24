import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';
import * as kitchenController from '../controllers/kitchenController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { kitchenProfileSchema } from '../validators/kitchenSchemas.js';

// Public browsing needs no login. Becoming a chef (POST /chefs) needs any signed-in account.

export const chefRoutes = Router();
chefRoutes.get('/', catalogController.listChefs);
chefRoutes.post('/', requireAuth, validateBody(kitchenProfileSchema), kitchenController.becomeChef);
chefRoutes.get('/:id', catalogController.getChef);

export const mealRoutes = Router();
mealRoutes.get('/', catalogController.listMeals);
mealRoutes.get('/filters', catalogController.getMealFilters);
mealRoutes.get('/:id', catalogController.getMeal);
