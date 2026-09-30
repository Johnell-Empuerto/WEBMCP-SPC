import { Router } from 'express';
import * as ctrl from '../controllers/dprMasterController';
import { authenticate } from '../middleware/auth';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for DPR Master.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (dprMasterController.ts, HTTP concerns)
//   Controller → Service    (dprMasterService.ts, business logic)
//   Service    → Repository (dprMasterRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.listRecords);
router.post('/', ctrl.createRecord);
router.put('/', ctrl.updateRecord);
router.delete('/', ctrl.deleteRecord);

export default router;
