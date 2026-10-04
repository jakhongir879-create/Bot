const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

process.env.TZ = 'Asia/Tashkent';

function clean(value) {
  return (value || '').trim();
}

const config = {
  port: Number(process.env.PORT) || 3000,
  timezone: 'Asia/Tashkent',
  databaseUrl: clean(process.env.DATABASE_URL),
  botToken: clean(process.env.BOT_TOKEN),
  anthropicApiKey: clean(process.env.ANTHROPIC_API_KEY),
  claudeModel: clean(process.env.CLAUDE_MODEL) || 'claude-opus-5-5',
  directorTelegramId: clean(process.env.DIRECTOR_TELEGRAM_ID),
  adminLogin: clean(process.env.ADMIN_LOGIN),
  adminPassword: clean(process.env.ADMIN_PASSWORD),
  jwtSecret: clean(process.env.JWT_SECRET),
  webappUrl: clean(process.env.WEBAPP_URL).replace(/\/+$/, ''),
  dashboardPublic: clean(process.env.DASHBOARD_PUBLIC) === 'true',
  maxUploadBytes: 20 * 1024 * 1024,
  paths: {
    miniappDist: path.join(__dirname, '..', '..', 'miniapp', 'dist'),
    dashboardDist: path.join(__dirname, '..', '..', 'dashboard', 'dist'),
  },
};

config.aiEnabled = Boolean(config.anthropicApiKey && config.anthropicApiKey.startsWith('sk-ant-'));

function validateConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.botToken) missing.push('BOT_TOKEN');
  if (!config.directorTelegramId) missing.push('DIRECTOR_TELEGRAM_ID');
  if (!config.adminLogin) missing.push('ADMIN_LOGIN');
  if (!config.adminPassword) missing.push('ADMIN_PASSWORD');
  if (!config.jwtSecret || config.jwtSecret.length < 16) missing.push('JWT_SECRET (kamida 16 belgi)');
  return missing;
}

module.exports = { config, validateConfig };
