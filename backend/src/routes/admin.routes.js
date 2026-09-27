const { Router } = require('express');
const c = require('../controllers/adminController');
const r = require('../controllers/reportController');
const { requireAuth, requireOwner, validate } = require('../middlewares/auth.middleware');
const { wrap } = require('../middlewares/error.middleware');

const router = Router();
router.use(requireAuth);

// Hisobotlar
router.get('/meta', wrap(r.meta));
router.get('/reports/overview', wrap(r.overview));
router.get('/reports/export', wrap(r.exportExcel));

// Kategoriyalar
router.get('/categories', wrap(c.listCategories));
router.post('/categories', validate(['name']), wrap(c.createCategory));
router.put('/categories/:id', validate(['name']), wrap(c.updateCategory));
router.delete('/categories/:id', wrap(c.removeCategory));

// Mahsulotlar
router.get('/products', wrap(c.listProducts));
router.post('/products', validate(['name', 'salePrice']), wrap(c.createProduct));
router.put('/products/:id', wrap(c.updateProduct));
router.delete('/products/:id', wrap(c.removeProduct));

// Mijozlar
router.get('/customers', wrap(c.listCustomers));
router.post('/customers', validate(['name']), wrap(c.createCustomer));
router.put('/customers/:id', validate(['name']), wrap(c.updateCustomer));
router.delete('/customers/:id', wrap(c.removeCustomer));

// Sotuvlar
router.get('/sales', wrap(c.listSales));
router.post('/sales', validate(['items']), wrap(c.createSale));
router.post('/sales/:id/pay', validate(['amount']), wrap(c.paySale));
router.delete('/sales/:id', wrap(c.removeSale));

// Xarajatlar
router.get('/expenses', wrap(c.listExpenses));
router.post('/expenses', validate(['category', 'amount']), wrap(c.createExpense));
router.put('/expenses/:id', wrap(c.updateExpense));
router.delete('/expenses/:id', wrap(c.removeExpense));

// Xodimlar — faqat egasi
router.get('/admins', requireOwner, wrap(c.listAdmins));
router.post('/admins', requireOwner, validate(['telegramId', 'name']), wrap(c.createAdmin));
router.put('/admins/:id', requireOwner, wrap(c.updateAdmin));
router.delete('/admins/:id', requireOwner, wrap(c.removeAdmin));

module.exports = router;
