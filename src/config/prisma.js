const { PrismaClient } = require("@prisma/client");

// Reuse a single Prisma instance across the app (important in dev with
// hot-reload to avoid exhausting DB connections).
const prisma = new PrismaClient();

module.exports = prisma;
