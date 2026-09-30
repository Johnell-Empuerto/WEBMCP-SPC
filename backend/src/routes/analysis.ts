import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.get('/machines', dashboardController.getMachineList);
router.get('/monthly-charts', dashboardController.getMonthlyCharts);
router.get('/totals', dashboardController.getDashboardTotals);
router.get('/summary', dashboardController.getDashboardSummary);
router.get('/production-trend', dashboardController.getProductionTrend);
router.get('/plan-vs-actual', dashboardController.getPlanVsActual);
router.get('/ng-summary', dashboardController.getNGSummary);
router.get('/daily-production', dashboardController.getDailyProduction);

export default router;
