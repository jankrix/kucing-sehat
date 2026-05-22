import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { CreateCatSchema, UpdateCatSchema } from "../types/api";
import * as catQueries from "../db/queries/cats";
import { supabaseAdmin } from "../config";

const router = Router();

// GET /api/cats - list all cats for authenticated user
router.get("/", async (req: AuthRequest, res) => {
  try {
    const cats = await catQueries.listByUser(req.userId!);
    res.json(cats);
  } catch (err) {
    console.error("List cats error:", err);
    res.status(500).json({ error: "Failed to list cats" });
  }
});

// POST /api/cats - create a new cat
router.post("/", async (req: AuthRequest, res) => {
  const parsed = CreateCatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const cat = await catQueries.create(req.userId!, parsed.data);
    res.status(201).json(cat);
  } catch (err) {
    console.error("Create cat error:", err);
    res.status(500).json({ error: "Failed to create cat" });
  }
});

// GET /api/cats/:catId - get a single cat
router.get("/:catId", async (req: AuthRequest, res) => {
  try {
    const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
    if (!cat) {
      res.status(404).json({ error: "Cat not found" });
      return;
    }
    res.json(cat);
  } catch (err) {
    console.error("Get cat error:", err);
    res.status(500).json({ error: "Failed to get cat" });
  }
});

// PUT /api/cats/:catId - update a cat
router.put("/:catId", async (req: AuthRequest, res) => {
  const parsed = UpdateCatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const cat = await catQueries.update(
      req.params.catId,
      req.userId!,
      parsed.data
    );
    res.json(cat);
  } catch (err) {
    console.error("Update cat error:", err);
    res.status(500).json({ error: "Failed to update cat" });
  }
});

// DELETE /api/cats/:catId - soft delete a cat
router.delete("/:catId", async (req: AuthRequest, res) => {
  try {
    await catQueries.softDelete(req.params.catId, req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete cat error:", err);
    res.status(500).json({ error: "Failed to delete cat" });
  }
});

// POST /api/cats/:catId/photo - upload cat photo
router.post("/:catId/photo", async (req: AuthRequest, res) => {
  const { image } = req.body; // base64 data URL

  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "Image is required (base64 data URL)" });
    return;
  }

  try {
    // Verify cat belongs to user
    const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
    if (!cat) {
      res.status(404).json({ error: "Cat not found" });
      return;
    }

    // Extract the base64 data
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Invalid base64 data URL format" });
      return;
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const ext = contentType.split("/")[1] || "jpg";
    const filePath = `${req.userId}/${req.params.catId}/photo.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("cat-files")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("cat-files").getPublicUrl(filePath);

    await catQueries.updatePhoto(req.params.catId, req.userId!, publicUrl);

    res.json({ photo_url: publicUrl });
  } catch (err) {
    console.error("Upload photo error:", err);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

export default router;
