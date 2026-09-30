// Route:
// Defines the Logs endpoints and connects them to middleware
// and controller handlers. No SQL or business logic lives here — see
// logsController.ts, logsService.ts and logsRepository.ts.

import { Router } from 'express';
import * as ctrl from '../controllers/logsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.getLogs);
router.get('/options', ctrl.getOptions);

export default router;