import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as planUploaderController from '../controllers/planUploaderController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Reference data
router.get('/cost-centers', planUploaderController.getCostCenters);
router.get('/product-codes', planUploaderController.getProductCodes);
router.get('/templates', planUploaderController.getTemplates);
router.get('/template-list', planUploaderController.getTemplateList);

// Template download
router.get('/template/download', planUploaderController.downloadTemplate);

// Validation & upload
router.post('/validate', planUploaderController.validateUpload);
router.post('/insert', planUploaderController.insertRecords);

// History
router.get('/history/:yearmonth', planUploaderController.checkHistory);

export default router;
