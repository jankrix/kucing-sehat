import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import * as catQueries from "../db/queries/cats";
import * as labQueries from "../db/queries/labs";
import { groupByParameter, analyzeTrends } from "../services/trendAnalyzer";

const router = Router({ mergeParams: true });

// GET /api/cats/:catId/trends
router.get("/", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const labs = await labQueries.listByCat(req.params.catId);
    const all = groupByParameter(labs);
    const confirmedCount = labs.filter((l) => l.status === "confirmed").length;

    res.json({
      trends: all,
      total_confirmed_labs: confirmedCount,
    });
  } catch (err) {
    console.error("Trends error:", err);
    res.status(500).json({ error: "Failed to get trends" });
  }
});

// POST /api/cats/:catId/trends/analyze
router.post("/analyze", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const labs = await labQueries.listByCat(req.params.catId);
    const trends = groupByParameter(labs);
    const analysis = await analyzeTrends(cat.name, trends);
    res.json({ analysis });
  } catch (err) {
    console.error("Trend analysis error:", err);
    res.status(500).json({ error: "Gagal menganalisis tren" });
  }
});

export default router;
