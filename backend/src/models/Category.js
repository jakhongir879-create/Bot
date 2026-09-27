const prisma = require('../database/connection');

const Category = {
  list() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },
  create(name) {
    return prisma.category.create({ data: { name: String(name).trim() } });
  },
  update(id, name) {
    return prisma.category.update({ where: { id: Number(id) }, data: { name: String(name).trim() } });
  },
  remove(id) {
    return prisma.category.delete({ where: { id: Number(id) } });
  },
};

module.exports = Category;
