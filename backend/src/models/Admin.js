const prisma = require('../database/connection');
const config = require('../config/default');

const Admin = {
  list() {
    return prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
  },

  findByTelegramId(telegramId) {
    return prisma.admin.findUnique({ where: { telegramId: String(telegramId) } });
  },

  // .env dagi OWNER_IDS egalari avtomatik OWNER bo'ladi
  async resolve(tgUser) {
    const telegramId = String(tgUser.id);
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
    const existing = await this.findByTelegramId(telegramId);

    if (config.ownerIds.includes(telegramId)) {
      return prisma.admin.upsert({
        where: { telegramId },
        update: { role: 'OWNER', isActive: true, username: tgUser.username || null },
        create: { telegramId, name, username: tgUser.username || null, role: 'OWNER' },
      });
    }
    if (existing && existing.isActive) {
      if (tgUser.username && existing.username !== tgUser.username) {
        return prisma.admin.update({ where: { id: existing.id }, data: { username: tgUser.username } });
      }
      return existing;
    }
    return null;
  },

  create({ telegramId, name, role }) {
    return prisma.admin.upsert({
      where: { telegramId: String(telegramId) },
      update: { name, role: role || 'MANAGER', isActive: true },
      create: { telegramId: String(telegramId), name, role: role || 'MANAGER' },
    });
  },

  update(id, data) {
    return prisma.admin.update({ where: { id: Number(id) }, data });
  },

  remove(id) {
    return prisma.admin.delete({ where: { id: Number(id) } });
  },

  activeRecipients() {
    return prisma.admin.findMany({ where: { isActive: true } });
  },
};

module.exports = Admin;
