import { Router } from 'express';
import * as ctrl from '../controllers/dprC4Controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/distinct-die-no', ctrl.getDistinctDieNo);
router.post('/die-no', ctrl.getDieNo);
router.post('/data', ctrl.getDPRData);
router.post('/details', ctrl.getDPRDetails);
router.post('/header/insert', ctrl.insertHeader);
router.post('/header/update', ctrl.updateHeader);
router.post('/details/insert', ctrl.insertDetails);
router.post('/details/update', ctrl.updateDetails);
router.get('/shifts', ctrl.getShifts);
router.get('/team-leaders', ctrl.getTeamLeaders);
router.get('/group-leaders', ctrl.getGroupLeaders);
router.get('/line-checkers', ctrl.getLineCheckers);
router.post('/check-header', ctrl.checkExistingHeader);

export default router;
