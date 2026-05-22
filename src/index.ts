import "dotenv/config"; // must be first — loads .env before any other imports read process.env

import express from "express";
import cors from "cors";
import path from "path";

// Config validates env vars and initializes clients
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { verifyAuth } from "./middleware/auth";
import catsRouter from "./routes/cats";
import chatRouter from "./routes/chat";
import userRouter from "./routes/user";
import labsRouter, { getLabById, confirmLab } from "./routes/labs";
import trendsRouter from "./routes/trends";
import purchasesRouter from "./routes/purchases";
import vetVisitsRouter from "./routes/vetVisits";
import adminRouter from "./routes/admin";
import subscribeRouter from "./routes/subscribe";
import { adminAuth } from "./middleware/adminAuth";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve Supabase config to frontend (public, non-secret values only)
app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
});

// Protected API routes
app.use("/api/cats", verifyAuth, catsRouter);
app.use("/api/cats/:catId/labs", verifyAuth, labsRouter);
app.use("/api/cats/:catId/trends", verifyAuth, trendsRouter);
app.use("/api/cats/:catId/purchases", verifyAuth, purchasesRouter);
app.use("/api/cats/:catId/vet-visits", verifyAuth, vetVisitsRouter);
app.get("/api/labs/:labId", verifyAuth, getLabById);
app.put("/api/labs/:labId/confirm", verifyAuth, confirmLab);
app.use("/api/chat", verifyAuth, chatRouter);
app.use("/api/subscribe", verifyAuth, subscribeRouter);
app.use("/api/admin", adminAuth, adminRouter);
app.use("/api", verifyAuth, userRouter);

// Admin panel — before static middleware to avoid express.static 301 redirect on /admin directory
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/index.html"));
});

// Serve static frontend files (CSS, JS, images, admin assets)
app.use(express.static(path.join(__dirname, "../public")));

// SPA fallback: serve index.html for all non-API, non-admin routes
app.get("*splat", (req, res) => {
  if (req.path.startsWith("/admin")) return res.status(404).send("Not found");
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🐱 KucingKu Sehat running at http://localhost:${PORT}`);
});
