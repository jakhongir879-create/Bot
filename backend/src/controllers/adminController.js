// Dashboard uchun CRUD API
const Product = require('../models/Product');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Admin = require('../models/Admin');
const { resolveRange } = require('../utils/date');
const { notifySale } = require('../services/notify.service');

const rangeFrom = (q) => (q.period ? resolveRange(q.period, q.from, q.to) : {});

module.exports = {
  // Kategoriyalar
  listCategories: async (req, res) => res.json(await Category.list()),
  createCategory: async (req, res) => res.status(201).json(await Category.create(req.body.name)),
  updateCategory: async (req, res) => res.json(await Category.update(req.params.id, req.body.name)),
  removeCategory: async (req, res) => res.json(await Category.remove(req.params.id)),

  // Mahsulotlar
  listProducts: async (req, res) => res.json(await Product.list()),
  createProduct: async (req, res) => res.status(201).json(await Product.create(req.body)),
  updateProduct: async (req, res) => res.json(await Product.update(req.params.id, req.body)),
  removeProduct: async (req, res) => res.json(await Product.remove(req.params.id)),

  // Mijozlar
  listCustomers: async (req, res) => res.json(await Customer.list()),
  createCustomer: async (req, res) => res.status(201).json(await Customer.create(req.body)),
  updateCustomer: async (req, res) => res.json(await Customer.update(req.params.id, req.body)),
  removeCustomer: async (req, res) => res.json(await Customer.remove(req.params.id)),

  // Sotuvlar
  listSales: async (req, res) => {
    const { from, to } = rangeFrom(req.query);
    res.json(
      await Sale.list({
        from,
        to,
        onlyDebt: req.query.debt === '1',
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 50, 500),
      })
    );
  },
  createSale: async (req, res) => {
    const sale = await Sale.create({ ...req.body, createdById: req.user.id });
    notifySale(sale).catch(() => {});
    res.status(201).json(sale);
  },
  paySale: async (req, res) => res.json(await Sale.pay(req.params.id, req.body.amount)),
  removeSale: async (req, res) => res.json(await Sale.remove(req.params.id)),

  // Xarajatlar
  listExpenses: async (req, res) => {
    const { from, to } = rangeFrom(req.query);
    res.json(await Expense.list({ from, to }));
  },
  createExpense: async (req, res) => res.status(201).json(await Expense.create(req.body, req.user.id)),
  updateExpense: async (req, res) => res.json(await Expense.update(req.params.id, req.body)),
  removeExpense: async (req, res) => res.json(await Expense.remove(req.params.id)),

  // Xodimlar (bot foydalanuvchilari)
  listAdmins: async (req, res) => res.json(await Admin.list()),
  createAdmin: async (req, res) => res.status(201).json(await Admin.create(req.body)),
  updateAdmin: async (req, res) => {
    const { name, role, isActive } = req.body;
    res.json(await Admin.update(req.params.id, { name, role, isActive }));
  },
  removeAdmin: async (req, res) => res.json(await Admin.remove(req.params.id)),
};
