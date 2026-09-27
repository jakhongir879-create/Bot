const report = require('../services/report.service');
const { buildWorkbook } = require('../services/excel.service');
const config = require('../config/default');

async function overview(req, res) {
  const { period = 'today', from, to } = req.query;
  res.json(await report.overview(period, from, to));
}

async function exportExcel(req, res) {
  const { period = 'month', from, to } = req.query;
  const { buffer, filename } = await buildWorkbook(period, from, to);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function meta(req, res) {
  res.json({
    businessName: config.businessName,
    paymentMethods: config.paymentMethods,
    expenseCategories: config.expenseCategories,
    dailyReportTime: config.dailyReportTime,
  });
}

module.exports = { overview, exportExcel, meta };
