// server_side/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");
const prisma = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const boardRoutes = require("./routes/boardRoutes");

const app = express();

// CORS Configuration - Allows Credentials for Cookies/Sessions
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Express Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super_secret_session_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if serving over HTTPS
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport Session Middleware
app.use(passport.initialize());
app.use(passport.session());

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);

const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

require("./socket/boardSocket")(io);

const PORT = process.env.PORT || 5000;

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