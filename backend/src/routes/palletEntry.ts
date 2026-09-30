import { Router } from 'express';
import * as ctrl from '../controllers/palletEntryController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All endpoints require authentication (Bearer JWT, see middleware/auth.ts).
router.use(authenticate);

router.post('/filter', ctrl.filterPallets);
router.post('/load', ctrl.loadPallet);
router.post('/product-details', ctrl.loadProductDetails);
router.get('/customer-codes', ctrl.getCustomerCodes);
router.post('/update', ctrl.updatePalletLoading);
router.post('/cancel', ctrl.cancelPallets);
router.post('/print', ctrl.loadPalletForPrint);

export default router;