require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5050;
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

if (!process.env.MONGO_URI) {
  console.error("Missing MONGO_URI in environment");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in environment");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("DB connected"))
  .catch((error) => {
    console.error("DB connection error", error);
    process.exit(1);
  });

app.use("/api/auth", require("./routes/auth"));
app.use("/api/content", require("./routes/content"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/reports", require("./routes/reports"));

app.use(express.static(FRONTEND_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "app.html"));
});

app.get(["/discover", "/login", "/register", "/profile"], (req, res) => {
  const routeMap = {
    "/discover": "app.html",
    "/login": "login-page.html",
    "/register": "register-page.html",
    "/profile": "profile-page.html"
  };

  res.sendFile(path.join(FRONTEND_DIR, routeMap[req.path]));
});

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API route not found" });
});

app.use((error, _req, res, _next) => {
  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
