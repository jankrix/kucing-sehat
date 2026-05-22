import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { CreatePurchaseSchema } from "../types/api";
import * as catQueries from "../db/queries/cats";
import * as purchaseQueries from "../db/queries/purchases";

const router = Router({ mergeParams: true });

// GET /api/cats/:catId/purchases
router.get("/", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const purchases = await purchaseQueries.listByCat(req.params.catId);
    res.json(purchases);
  } catch (err) {
    console.error("List purchases error:", err);
    res.status(500).json({ error: "Failed to list purchases" });
  }
});

// POST /api/cats/:catId/purchases
router.post("/", async (req: AuthRequest, res) => {
  const parsed = CreatePurchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const purchase = await purchaseQueries.create(
      req.params.catId,
      req.userId!,
      parsed.data
    );
    res.status(201).json(purchase);
  } catch (err) {
    console.error("Create purchase error:", err);
    res.status(500).json({ error: "Failed to create purchase" });
  }
});

// DELETE /api/cats/:catId/purchases/:purchaseId
router.delete("/:purchaseId", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    await purchaseQueries.remove(req.params.purchaseId, req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete purchase error:", err);
    res.status(500).json({ error: "Failed to delete purchase" });
  }
});

export default router;
