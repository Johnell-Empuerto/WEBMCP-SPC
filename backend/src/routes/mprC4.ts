// Route layer for MPR C4:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see mprC4Controller.ts,
// mprC4Service.ts and mprC4Repository.ts.

import { Router } from 'express';
import * as ctrl from '../controllers/mprC4Controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/data', ctrl.getData);
router.post('/ng-data', ctrl.getNgData);

export default router;
