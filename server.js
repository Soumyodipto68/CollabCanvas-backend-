const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");
const prisma = require("./config/db");
const { connectRedis, redisClient } = require("./config/redis");
const { flushRedisToDatabase } = require("./services/boardBuffer");

// Import Route Handlers
const authRoutes = require("./routes/authRoutes");
const boardRoutes = require("./routes/boardRoutes");

// Import Socket Handler
const registerBoardSocket = require("./socket/boardSocket");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy if deployed behind Nginx / Render / Heroku
app.set("trust proxy", 1);

// CORS Configuration - Allows Credentials for Session Cookies
app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server port
    credentials: true,
  })
);

// Express JSON Body Parser (increased limit for large payloads)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Express Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super_secret_session_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport Session Middleware
app.use(passport.initialize());
app.use(passport.session());

// Mount REST API Routes
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);

// Create Native HTTP Server wrapping Express
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings matching Express
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Attach Socket.IO Board Event Handlers
registerBoardSocket(io);

// Background timer reference for clean teardown
let flushIntervalId = null;

// Graceful Shutdown Function
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new flush intervals
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
  }

  // 2. Perform a final flush of all un-saved Redis strokes to PostgreSQL
  console.log("Flushing remaining Redis buffers to PostgreSQL...");
  try {
    await flushRedisToDatabase();
    console.log("Redis buffers successfully flushed.");
  } catch (err) {
    console.error("Error flushing Redis during shutdown:", err);
  }

  // 3. Disconnect Redis client
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log("Redis client disconnected.");
  }

  // 4. Disconnect Prisma client
  await prisma.$disconnect();
  console.log("Prisma client disconnected.");

  // 5. Close HTTP server and exit
  server.close(() => {
    console.log("HTTP server closed. Exiting process.");
    process.exit(0);
  });
}

// Intercept SIGINT (Ctrl+C) and SIGTERM (kill / container termination)
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Database Connection & Server Initialization
async function main() {
  try {
    // Connect to PostgreSQL via Prisma
    await prisma.$connect();
    console.log("Database connected successfully via Prisma");

    // Connect to Redis
    await connectRedis();

    // Start background flush job (runs every 10 seconds)
    flushIntervalId = setInterval(() => {
      flushRedisToDatabase();
    }, 10000);

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server dependencies:", error);
    process.exit(1);
  }
}

main();