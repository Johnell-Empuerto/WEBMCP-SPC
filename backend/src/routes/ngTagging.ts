// Route layer for NG Tagging:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see ngTaggingController.ts,
// ngTaggingService.ts and ngTaggingRepository.ts.
//
// LEGACY: AngularJS → Node-RED (POST /ngtagging) → SQL Server
//   EXEC [dbo].[spHandyNGTagging] — the stored procedure is the source of
//   truth for the tagging side-effects; we call it as-is.

import { Router } from 'express';
import * as ctrl from '../controllers/ngTaggingController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/processes', ctrl.getProcesses);
router.get('/defects', ctrl.getDefects);
router.get('/lookup', ctrl.lookup);
router.post('/', ctrl.tag);
router.get('/', ctrl.history);

export default router;
