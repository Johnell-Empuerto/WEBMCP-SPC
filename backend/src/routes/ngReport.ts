// Route layer for NG Report:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see ngReportController.ts,
// ngReportService.ts and ngReportRepository.ts.
//
// READ-ONLY module: every handler executes SELECT statements only, reusing
// the exact NG retrieval logic proven working in MPR ADC / C4 / KD.

import { Router } from 'express';
import * as ctrl from '../controllers/ngReportController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/options', ctrl.getOptions);
router.get('/', ctrl.getRecords);

export default router;
