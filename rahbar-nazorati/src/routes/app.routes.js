const express = require('express');
const multer = require('multer');
const { telegramAuth } = require('../middlewares/telegramAuth.middleware');
const app = require('../controllers/appController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const router = express.Router();

router.use(telegramAuth);

router.get('/me', app.me);
router.post('/onboarded', app.markOnboarded);
router.get('/tasks', app.listTasks);
router.post('/tasks', app.createTask);
router.get('/tasks/:id', app.getTask);
router.post('/tasks/:id/action', app.changeStatus);
router.post('/tasks/:id/files', upload.single('file'), app.uploadFile);
router.post('/files/:fileId/send', app.sendFileToChat);
router.get('/assignees', app.assignees);
router.get('/team', app.team);
router.get('/team/:id', app.teamMember);
router.get('/profile', app.profile);

module.exports = router;
