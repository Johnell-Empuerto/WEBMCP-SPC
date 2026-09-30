import { Router } from 'express';
import * as ctrl from '../controllers/settingsController';
import { authenticate, authorize } from '../middleware';

// ════════════════════════════════════════════════════════════════════════════
// Route layer for Settings.
// Defines the API endpoints only — no SQL, no business logic, no validation.
//   Route      → Controller (settingsController.ts, HTTP concerns)
//   Controller → Service    (settingsService.ts, business logic)
//   Service    → Repository (settingsRepository.ts, SQL Server access)
// ════════════════════════════════════════════════════════════════════════════
//
// Authorization: GET is available to any logged-in user (the client idle
// monitor needs it); PUT is admin only (role 1 Super Admin, 2 Admin).

const router = Router();

router.get('/session-timeout', authenticate, ctrl.getSessionTimeout);
router.put('/session-timeout', authenticate, authorize(1, 2), ctrl.updateSessionTimeout);

export default router;
