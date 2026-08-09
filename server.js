// server_side/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");
const prisma = require("./config/db");

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

// Express JSON Body Parser
app.use(express.json());

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

// Graceful Shutdown Handler for Prisma
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("\nPrisma client disconnected. Server shutting down.");
  process.exit(0);
});

// Database Connection & Server Initialization
async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully via Prisma");

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to DB:", error);
    process.exit(1);
  }
}

main();