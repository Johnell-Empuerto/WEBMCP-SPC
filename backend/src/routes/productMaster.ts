import { Router } from 'express';
import * as ctrl from '../controllers/productMasterController';
import { authenticate } from '../middleware/auth';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for Product Master.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (productMasterController.ts, HTTP concerns)
//   Controller → Service    (productMasterService.ts, business logic)
//   Service    → Repository (productMasterRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/', ctrl.listRecords);
router.get('/details', ctrl.getDetails);
router.get('/lookups', ctrl.getLookups);
router.post('/', ctrl.addRecord);
router.put('/', ctrl.updateRecord);
router.delete('/', ctrl.deleteRecord);

export default router;
