// server_side/config/db.js
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

// Create PostgreSQL connection pool using your DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Prisma adapter
const adapter = new PrismaPg(pool);

// Pass adapter directly to the constructor
const prisma = new PrismaClient({ adapter });

module.exports = prisma;