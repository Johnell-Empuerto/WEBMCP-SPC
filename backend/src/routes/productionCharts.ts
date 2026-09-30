// Route layer for Production Charts:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see
// productionChartsController.ts, productionChartsService.ts and
// productionChartsRepository.ts.

import { Router } from 'express';
import * as ctrl from '../controllers/productionChartsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/yearly', ctrl.getYearly);

export default router;
