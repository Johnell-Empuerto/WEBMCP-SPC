import { Router } from 'express';
import * as ctrl from '../controllers/preferenceMasterController';
import { authenticate } from '../middleware/auth';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for Preference Master.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (preferenceMasterController.ts, HTTP concerns)
//   Controller → Service    (preferenceMasterService.ts, business logic)
//   Service    → Repository (preferenceMasterRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.listRecords);
router.get('/groups', ctrl.getGroups);
router.get('/check', ctrl.checkKey);
router.post('/', ctrl.addRecord);
router.put('/', ctrl.updateRecord);
router.delete('/', ctrl.deleteRecord);

export default router;
