// Route layer for Production Management:
// Defines the API endpoints and connects them to the controller.
// No SQL or business logic belongs here — see
// productionManagementController.ts, productionManagementService.ts and
// productionManagementRepository.ts.
//
// Legacy equivalents (Node-RED): getCalendarEvents, getCalendarDetails,
// getMonthlySummary, getDailyProdDetails.

import { Router } from 'express';
import * as ctrl from '../controllers/productionManagementController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/calendar-events', ctrl.getCalendarEvents);
router.post('/product-details', ctrl.getProductDetails);
router.post('/monthly-summary', ctrl.getMonthlySummary);
router.post('/daily-details', ctrl.getDailyDetails);

export default router;
