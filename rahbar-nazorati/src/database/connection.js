const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function connectDatabase() {
  await prisma.$connect();
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
