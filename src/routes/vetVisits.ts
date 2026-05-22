import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import * as catQueries from "../db/queries/cats";
import * as vetVisitQueries from "../db/queries/vetVisits";

const router = Router({ mergeParams: true });

// GET /api/cats/:catId/vet-visits
router.get("/", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) { res.status(404).json({ error: "Cat not found" }); return; }

  try {
    const visits = await vetVisitQueries.listByCat(req.params.catId);
    res.json(visits);
  } catch (err) {
    console.error("List vet visits error:", err);
    res.status(500).json({ error: "Failed to list vet visits" });
  }
});

// GET /api/cats/:catId/vet-visits/recent?days=30
router.get("/recent", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) { res.status(404).json({ error: "Cat not found" }); return; }

  const days = Math.min(Number(req.query.days) || 30, 90);
  try {
    const visits = await vetVisitQueries.getRecentByCat(req.params.catId, days);
    res.json(visits);
  } catch (err) {
    console.error("Recent vet visits error:", err);
    res.status(500).json({ error: "Failed to get recent vet visits" });
  }
});

// DELETE /api/cats/:catId/vet-visits/:visitId
router.delete("/:visitId", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) { res.status(404).json({ error: "Cat not found" }); return; }

  try {
    const { error } = await (await import("../../config")).supabaseAdmin
      .from("vet_visits")
      .delete()
      .eq("id", req.params.visitId)
      .eq("user_id", req.userId!);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Delete vet visit error:", err);
    res.status(500).json({ error: "Failed to delete vet visit" });
  }
});

export default router;
