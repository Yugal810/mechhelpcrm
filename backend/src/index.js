import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import carsRouter from "./routes/cars.js";
import garagesRouter from "./routes/garages.js";
import aisensyRouter from "./routes/aisensy.js";
import connectDB from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection error in middleware:", err.message);
    res.status(500).json({ detail: "Database connection failure: " + err.message });
  }
});

app.use("/api/cars", carsRouter);
app.use("/cars", carsRouter);
app.use("/api/garages", garagesRouter);
app.use("/garages", garagesRouter);
app.use("/api/aisensy", aisensyRouter);
app.use("/aisensy", aisensyRouter);

app.get("/api/health-tool", (_req, res) => {
  res.json({
    status: "online",
    message: "MechHelp Tool API is running inside CRM",
  });
});

// Serve frontend dist if available (Production / Docker mode)
const distPath = path.resolve(__dirname, "../../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/cars") ||
      req.path.startsWith("/garages") ||
      req.path.startsWith("/aisensy")
    ) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;
