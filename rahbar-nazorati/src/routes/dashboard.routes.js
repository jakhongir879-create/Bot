const express = require('express');
const multer = require('multer');
const { config } = require('../config/default');
const { adminAuth, login } = require('../middlewares/adminAuth.middleware');
const d = require('../controllers/dashboardController');
const { ALLOWED_EXTENSIONS } = require('../services/stock.service');

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) return cb(null, true);
    return cb(new d.ValidationError('Faqat Excel (.xlsx, .xls) yoki .csv fayl qabul qilinadi'));
  },
});

const router = express.Router();

router.post('/login', login);
router.use(adminAuth);

router.get('/overview', d.overview);

router.get('/tasks', d.tasks);
router.get('/tasks/:id', d.taskDetail);

router.get('/activity', d.activity);
router.get('/activity/:id', d.employeeActivity);

router.post('/stock/upload', excelUpload.single('file'), d.stockUpload);
router.get('/stock/checks', d.stockChecks);
router.get('/stock/checks/:id', d.stockCheckDetail);
router.delete('/stock/checks/:id', d.stockDelete);
router.get('/stock/template', d.stockTemplate);

router.get('/finance', d.finance);
router.post('/finance/entries', d.saveFinanceEntry);
router.delete('/finance/entries/:id', d.deleteFinanceEntry);
router.post('/finance/goals', d.createGoal);
router.put('/finance/goals/:id', d.updateGoal);
router.delete('/finance/goals/:id', d.deleteGoal);
router.post('/finance/decisions', d.createDecision);
router.put('/finance/decisions/:id', d.updateDecision);
router.delete('/finance/decisions/:id', d.deleteDecision);
router.post('/finance/decisions/:id/evaluate', d.evaluateDecision);

router.get('/ai/reports', d.aiReports);
router.delete('/ai/reports/:id', d.deleteAiReport);
router.get('/ai/latest/:module', d.latestAi);
router.post('/ai/ask', d.askAi);
router.post('/ai/:module', d.generateAi);

router.get('/employees', d.employees);
router.post('/employees', d.createEmployee);
router.put('/employees/:id', d.updateEmployee);
router.patch('/employees/:id/active', d.setEmployeeActive);

router.get('/settings', d.getSettings);
router.put('/settings', d.updateSettings);

module.exports = router;
