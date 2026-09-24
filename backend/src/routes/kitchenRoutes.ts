import { Router } from 'express';
import multer from 'multer';
import * as kitchenController from '../controllers/kitchenController.js';
import * as uploadController from '../controllers/uploadController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { MAX_PHOTO_BYTES } from '../services/uploadService.js';
import { availabilitySchema, kitchenUpdateSchema } from '../validators/kitchenSchemas.js';
import { mealCreateSchema, mealUpdateSchema } from '../validators/mealSchemas.js';

// The signed-in chef's own kitchen: /api/v1/chefs/me/...
export const myKitchenRoutes = Router();
myKitchenRoutes.use(requireAuth, requireRole('CHEF'));

myKitchenRoutes.get('/', kitchenController.getMyKitchen);
myKitchenRoutes.put('/', validateBody(kitchenUpdateSchema), kitchenController.updateMyKitchen);
myKitchenRoutes.put('/availability', validateBody(availabilitySchema), kitchenController.updateMyAvailability);
myKitchenRoutes.get('/meals', kitchenController.listMyMeals);
myKitchenRoutes.post('/meals', validateBody(mealCreateSchema), kitchenController.createMyMeal);
myKitchenRoutes.put('/meals/:id', validateBody(mealUpdateSchema), kitchenController.updateMyMeal);
myKitchenRoutes.delete('/meals/:id', kitchenController.deleteMyMeal);

// Photo uploads: /api/v1/uploads/...
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

export const uploadRoutes = Router();
// Check who is uploading before reading the file.
uploadRoutes.post('/meal-photo', requireAuth, requireRole('CHEF'), photoUpload.single('photo'), uploadController.uploadMealPhoto);
