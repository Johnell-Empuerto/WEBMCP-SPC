// Route layer for MPR ADC:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see mprAdcController.ts,
// mprAdcService.ts and mprAdcRepository.ts.

import { Router } from 'express';
import * as ctrl from '../controllers/mprAdcController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/data', ctrl.getData);
router.post('/ng-data', ctrl.getNgData);

export default router;
