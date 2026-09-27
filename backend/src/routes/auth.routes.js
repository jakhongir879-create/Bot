const { Router } = require('express');
const auth = require('../controllers/authController');
const { requireAuth, validate } = require('../middlewares/auth.middleware');
const { wrap } = require('../middlewares/error.middleware');

const router = Router();

router.post('/login', validate(['password']), wrap(auth.login));
router.post('/telegram', validate(['initData']), wrap(auth.telegramLogin));
router.get('/me', requireAuth, wrap(auth.me));

module.exports = router;
