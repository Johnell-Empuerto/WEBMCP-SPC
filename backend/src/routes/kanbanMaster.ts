import { Router } from 'express';
import * as ctrl from '../controllers/kanbanMasterController';
import { authenticate } from '../middleware/auth';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for Kanban Master.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (kanbanMasterController.ts, HTTP concerns)
//   Controller → Service    (kanbanMasterService.ts, business logic)
//   Service    → Repository (kanbanMasterRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.listRecords);
router.post('/', ctrl.addRecord);
router.put('/', ctrl.updateRecord);
router.delete('/', ctrl.deleteRecord);
router.get('/lookups', ctrl.getLookups);

export default router;
