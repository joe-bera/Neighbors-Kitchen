import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';
import * as feedbackController from '../controllers/feedbackController.js';
import * as kitchenController from '../controllers/kitchenController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { suggestionSchema } from '../validators/feedbackSchemas.js';
import { kitchenProfileSchema } from '../validators/kitchenSchemas.js';

// Public browsing needs no login. Becoming a chef (POST /chefs) and requesting a dish need a signed-in account.

export const chefRoutes = Router();
chefRoutes.get('/', catalogController.listChefs);
chefRoutes.get('/map', catalogController.listChefsForMap); // before /:id, so "map" is not read as a chef id
chefRoutes.post('/', requireAuth, validateBody(kitchenProfileSchema), kitchenController.becomeChef);
chefRoutes.get('/:id', catalogController.getChef);
chefRoutes.get('/:id/order-slots', catalogController.getOrderSlots);
chefRoutes.get('/:id/reviews', feedbackController.listChefReviews);
chefRoutes.get('/:id/suggestions', optionalAuth, feedbackController.listChefSuggestions);
chefRoutes.post('/:id/suggestions', requireAuth, validateBody(suggestionSchema), feedbackController.createSuggestion);

export const mealRoutes = Router();
mealRoutes.get('/', catalogController.listMeals);
mealRoutes.get('/filters', catalogController.getMealFilters);
mealRoutes.get('/:id', catalogController.getMeal);
mealRoutes.get('/:id/reviews', feedbackController.listMealReviews);
