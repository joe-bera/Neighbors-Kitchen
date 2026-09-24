import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';

// Public browsing: no login needed.

export const chefRoutes = Router();
chefRoutes.get('/', catalogController.listChefs);
chefRoutes.get('/:id', catalogController.getChef);

export const mealRoutes = Router();
mealRoutes.get('/', catalogController.listMeals);
mealRoutes.get('/filters', catalogController.getMealFilters);
mealRoutes.get('/:id', catalogController.getMeal);
