import { Router } from 'express';
import * as ctrl from '../controllers/locatorMasterController';
import { authenticate } from '../middleware/auth';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for Locator Master.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (locatorMasterController.ts, HTTP concerns)
//   Controller → Service    (locatorMasterService.ts, business logic)
//   Service    → Repository (locatorMasterRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.listRecords);
router.get('/check', ctrl.checkCode);
router.post('/', ctrl.addRecord);
router.put('/', ctrl.updateRecord);
router.delete('/', ctrl.deleteRecord);

export default router;
