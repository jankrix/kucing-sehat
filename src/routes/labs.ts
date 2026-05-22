import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { UploadLabSchema, ConfirmLabSchema } from "../types/api";
import * as catQueries from "../db/queries/cats";
import * as labQueries from "../db/queries/labs";
import { extractLabValues } from "../services/labExtractor";
import { supabaseAdmin } from "../config";

const router = Router({ mergeParams: true });

// POST /api/cats/:catId/labs/upload
router.post("/upload", async (req: AuthRequest, res) => {
  const parsed = UploadLabSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { image, test_date, lab_name, vet_visit_id } = parsed.data;

  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  // Upload image to storage (only when STORE_LAB_IMAGES=true — off by default to save storage costs)
  let document_url: string | undefined;
  if (process.env.STORE_LAB_IMAGES === "true") {
    try {
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const ext = contentType.split("/")[1] || "jpg";
        const filePath = `${req.userId}/${req.params.catId}/labs/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("cat-files")
          .upload(filePath, buffer, { contentType, upsert: false });

        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from("cat-files")
            .getPublicUrl(filePath);
          document_url = publicUrl;
        }
      }
    } catch {
      // Storage upload failure is non-fatal
    }
  }

  // Create lab result record with processing status
  let labResult;
  try {
    labResult = await labQueries.create(req.params.catId, req.userId!, {
      test_date,
      lab_name,
      document_url,
      vet_visit_id: vet_visit_id || undefined,
      status: "processing",
    });
  } catch (err) {
    console.error("Create lab record error:", err);
    res.status(500).json({ error: "Failed to create lab record" });
    return;
  }

  // Run GPT-4o extraction
  try {
    const { values, raw_output } = await extractLabValues(image);

    await labQueries.updateStatus(labResult.id, "extracted", { ai_raw_output: raw_output });
    const labValues = await labQueries.insertValues(labResult.id, values);

    res.status(201).json({
      ...labResult,
      status: "extracted",
      ai_raw_output: raw_output,
      lab_values: labValues,
    });
  } catch (err) {
    console.error("Lab extraction error:", err);
    await labQueries.updateStatus(labResult.id, "error");
    res.status(422).json({
      error: err instanceof Error ? err.message : "Gagal mengekstrak data lab",
      lab_id: labResult.id,
    });
  }
});

// GET /api/cats/:catId/labs
router.get("/", async (req: AuthRequest, res) => {
  const cat = await catQueries.getByIdAndUser(req.params.catId, req.userId!);
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const labs = await labQueries.listByCat(req.params.catId);
    res.json(labs);
  } catch (err) {
    console.error("List labs error:", err);
    res.status(500).json({ error: "Failed to list lab results" });
  }
});

// GET /api/labs/:labId  (mounted separately at /api/labs)
export async function getLabById(req: AuthRequest, res: any) {
  try {
    const lab = await labQueries.getById(req.params.labId, req.userId!);
    if (!lab) {
      res.status(404).json({ error: "Lab result not found" });
      return;
    }
    res.json(lab);
  } catch (err) {
    console.error("Get lab error:", err);
    res.status(500).json({ error: "Failed to get lab result" });
  }
}

// PUT /api/labs/:labId/confirm  (mounted separately at /api/labs)
export async function confirmLab(req: AuthRequest, res: any) {
  const parsed = ConfirmLabSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const existing = await labQueries.getById(req.params.labId, req.userId!);
    if (!existing) {
      res.status(404).json({ error: "Lab result not found" });
      return;
    }

    const labValues = await labQueries.replaceValues(req.params.labId, parsed.data.values);
    await labQueries.updateStatus(req.params.labId, "confirmed");

    res.json({ ...existing, status: "confirmed", lab_values: labValues });
  } catch (err) {
    console.error("Confirm lab error:", err);
    res.status(500).json({ error: "Failed to confirm lab result" });
  }
}

export default router;
