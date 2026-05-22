import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../config";

const router = Router();

// ─── Stats ────────────────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [users, cats, labs, subs] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("cats").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("lab_results").select("id,status", { count: "exact" }),
      supabaseAdmin.from("subscriptions").select("id,plan,status", { count: "exact" }).eq("status", "active"),
    ]);

    const labRows = labs.data ?? [];
    const labsByStatus = labRows.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      total_users: users.data?.users?.length ?? 0,
      total_cats: cats.count ?? 0,
      total_labs: labRows.length,
      labs_by_status: labsByStatus,
      active_subscriptions: subs.count ?? 0,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const userIds = users.map((u) => u.id);

    const [subs, cats, labs] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("user_id,plan,status,expires_at").in("user_id", userIds).eq("status", "active"),
      supabaseAdmin.from("cats").select("user_id").eq("is_active", true).in("user_id", userIds),
      supabaseAdmin.from("lab_results").select("user_id").in("user_id", userIds),
    ]);

    const subMap: Record<string, { plan: string; expires_at: string | null }> = {};
    for (const s of subs.data ?? []) subMap[s.user_id] = { plan: s.plan, expires_at: s.expires_at };

    const catCounts: Record<string, number> = {};
    for (const c of cats.data ?? []) catCounts[c.user_id] = (catCounts[c.user_id] ?? 0) + 1;

    const labCounts: Record<string, number> = {};
    for (const l of labs.data ?? []) labCounts[l.user_id] = (labCounts[l.user_id] ?? 0) + 1;

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned: !!(u as any).banned_until,
      subscription: subMap[u.id] ?? null,
      cat_count: catCounts[u.id] ?? 0,
      lab_count: labCounts[u.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Send password reset email
router.post("/users/:userId/reset-password", async (req: Request, res: Response) => {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.params.userId);
    if (error || !user?.email) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: user.email,
    });
    if (linkError) throw linkError;
    res.json({ message: "Password reset email sent to " + user.email });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

// Set password directly (admin use / testing)
router.post("/users/:userId/set-password", async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.userId, { password });
    if (error) throw error;
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Set password error:", err);
    res.status(500).json({ error: "Failed to set password" });
  }
});

// Ban / unban user
router.patch("/users/:userId/ban", async (req: Request, res: Response) => {
  const { banned } = req.body;
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.userId, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) throw error;
    res.json({ message: banned ? "User banned" : "User unbanned" });
  } catch (err) {
    console.error("Ban user error:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// ─── Lab Reports ──────────────────────────────────────────────────────────

router.get("/labs", async (req: Request, res: Response) => {
  const { status } = req.query;
  try {
    let query = supabaseAdmin
      .from("lab_results")
      .select("id,user_id,cat_id,test_date,lab_name,document_url,status,created_at,cats(name),lab_values(id)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) query = query.eq("status", status as string);

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with user emails
    const userIds = [...new Set((data ?? []).map((l: any) => l.user_id))];
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users ?? []) emailMap[u.id] = u.email ?? "";
    }

    const result = (data ?? []).map((l: any) => ({
      ...l,
      user_email: emailMap[l.user_id] ?? l.user_id,
      cat_name: l.cats?.name ?? "Unknown",
      value_count: l.lab_values?.length ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("Admin labs error:", err);
    res.status(500).json({ error: "Failed to list labs" });
  }
});

router.delete("/labs/:labId", async (req: Request, res: Response) => {
  try {
    // Delete stored document if any
    const { data: lab } = await supabaseAdmin
      .from("lab_results")
      .select("document_url")
      .eq("id", req.params.labId)
      .single();

    if (lab?.document_url) {
      const url = new URL(lab.document_url);
      const pathParts = url.pathname.split("/object/public/cat-files/");
      if (pathParts[1]) {
        await supabaseAdmin.storage.from("cat-files").remove([pathParts[1]]);
      }
    }

    const { error } = await supabaseAdmin.from("lab_results").delete().eq("id", req.params.labId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Delete lab error:", err);
    res.status(500).json({ error: "Failed to delete lab" });
  }
});

// Bulk delete stored lab images (free up storage, keep DB records)
router.post("/labs/purge-images", async (_req: Request, res: Response) => {
  try {
    const { data: labs } = await supabaseAdmin
      .from("lab_results")
      .select("id,document_url")
      .not("document_url", "is", null);

    let deleted = 0;
    const paths: string[] = [];
    for (const lab of labs ?? []) {
      if (!lab.document_url) continue;
      try {
        const url = new URL(lab.document_url);
        const pathParts = url.pathname.split("/object/public/cat-files/");
        if (pathParts[1]) paths.push(pathParts[1]);
      } catch { /* skip malformed URLs */ }
    }

    if (paths.length > 0) {
      await supabaseAdmin.storage.from("cat-files").remove(paths);
      deleted = paths.length;
      // Clear document_url references
      await supabaseAdmin
        .from("lab_results")
        .update({ document_url: null })
        .not("document_url", "is", null);
    }

    res.json({ deleted, message: `Removed ${deleted} stored lab images` });
  } catch (err) {
    console.error("Purge images error:", err);
    res.status(500).json({ error: "Failed to purge images" });
  }
});

// ─── Subscriptions ────────────────────────────────────────────────────────

router.get("/subscriptions", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const userIds = [...new Set((data ?? []).map((s) => s.user_id))];
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users ?? []) emailMap[u.id] = u.email ?? "";
    }

    res.json((data ?? []).map((s) => ({ ...s, user_email: emailMap[s.user_id] ?? s.user_id })));
  } catch (err) {
    console.error("Admin subs error:", err);
    res.status(500).json({ error: "Failed to list subscriptions" });
  }
});

// Grant / extend subscription
router.post("/subscriptions", async (req: Request, res: Response) => {
  const { user_id, plan, days } = req.body;
  if (!user_id || !plan || !days) {
    res.status(400).json({ error: "user_id, plan, and days are required" });
    return;
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + Number(days));

  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id,
        plan,
        status: "active",
        expires_at: expires.toISOString(),
        payment_ref: "admin_grant",
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("Grant sub error:", err);
    res.status(500).json({ error: "Failed to grant subscription" });
  }
});

// Cancel subscription
router.patch("/subscriptions/:subId/cancel", async (req: Request, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", req.params.subId);

    if (error) throw error;
    res.json({ message: "Subscription cancelled" });
  } catch (err) {
    console.error("Cancel sub error:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ─── Vouchers ─────────────────────────────────────────────────────────────

router.get("/vouchers", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: "Failed to list vouchers" });
  }
});

router.post("/vouchers", async (req: Request, res: Response) => {
  const { code, discount_percent, max_uses, expires_at } = req.body;

  if (!code?.trim() || !discount_percent) {
    res.status(400).json({ error: "code and discount_percent are required" });
    return;
  }
  if (discount_percent < 1 || discount_percent > 100) {
    res.status(400).json({ error: "discount_percent must be 1–100" });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .insert({
        code: code.trim().toUpperCase(),
        discount_percent: Number(discount_percent),
        max_uses: max_uses ? Number(max_uses) : null,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "Voucher code already exists" });
        return;
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error("Create voucher error:", err);
    res.status(500).json({ error: "Failed to create voucher" });
  }
});

router.patch("/vouchers/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { data: current } = await supabaseAdmin
      .from("vouchers")
      .select("is_active")
      .eq("id", req.params.id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .update({ is_active: !current?.is_active })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle voucher" });
  }
});

router.delete("/vouchers/:id", async (req: Request, res: Response) => {
  try {
    const { error } = await supabaseAdmin.from("vouchers").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete voucher" });
  }
});

// ─── Pricing ──────────────────────────────────────────────────────────────

router.get("/pricing", async (_req: Request, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "pricing")
      .single();

    res.json(data?.value ?? { basic_idr: 35000, premium_idr: 49000, testing_mode: false, min_price_idr: 35000 });
  } catch (err) {
    res.status(500).json({ error: "Failed to get pricing" });
  }
});

router.put("/pricing", async (req: Request, res: Response) => {
  const { basic_idr, premium_idr, testing_mode, min_price_idr } = req.body;

  const value = {
    basic_idr: Number(basic_idr ?? 35000),
    premium_idr: Number(premium_idr ?? 49000),
    testing_mode: Boolean(testing_mode),
    min_price_idr: Number(min_price_idr ?? 35000),
  };

  try {
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ key: "pricing", value, updated_at: new Date().toISOString() });

    if (error) throw error;
    res.json(value);
  } catch (err) {
    console.error("Update pricing error:", err);
    res.status(500).json({ error: "Failed to update pricing" });
  }
});

// ─── Platform Reset ───────────────────────────────────────────────────────

router.post("/reset", async (req: Request, res: Response) => {
  const { confirm_secret, include_users } = req.body;

  // Double-check the secret in the request body as a second factor
  if (!confirm_secret || confirm_secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: "Confirmation secret does not match" });
    return;
  }

  const results: Record<string, string> = {};

  try {
    // 1. Delete all user data in dependency order
    // lab_values cascade-delete when lab_results are deleted
    const { error: lvErr } = await supabaseAdmin.from("lab_values").delete().gte("created_at", "2000-01-01");
    results.lab_values = lvErr ? `error: ${lvErr.message}` : "cleared";

    const { error: lrErr } = await supabaseAdmin.from("lab_results").delete().gte("created_at", "2000-01-01");
    results.lab_results = lrErr ? `error: ${lrErr.message}` : "cleared";

    const { error: pvErr } = await supabaseAdmin.from("vet_visits").delete().gte("created_at", "2000-01-01");
    results.vet_visits = pvErr ? `error: ${pvErr.message}` : "cleared";

    const { error: plErr } = await supabaseAdmin.from("purchase_log").delete().gte("created_at", "2000-01-01");
    results.purchase_log = plErr ? `error: ${plErr.message}` : "cleared";

    const { error: csErr } = await supabaseAdmin.from("chat_sessions").delete().gte("created_at", "2000-01-01");
    results.chat_sessions = csErr ? `error: ${csErr.message}` : "cleared";

    const { error: subErr } = await supabaseAdmin.from("subscriptions").delete().gte("created_at", "2000-01-01");
    results.subscriptions = subErr ? `error: ${subErr.message}` : "cleared";

    const { error: catErr } = await supabaseAdmin.from("cats").delete().gte("created_at", "2000-01-01");
    results.cats = catErr ? `error: ${catErr.message}` : "cleared";

    // 2. Clear Supabase Storage (cat-files bucket)
    try {
      const { data: files } = await supabaseAdmin.storage.from("cat-files").list("", { limit: 1000 });
      if (files && files.length > 0) {
        // List is top-level folders (user IDs) — remove recursively
        const folderPaths = files.map((f) => f.name);
        for (const folder of folderPaths) {
          const { data: subFiles } = await supabaseAdmin.storage
            .from("cat-files")
            .list(folder, { limit: 1000 });
          if (subFiles?.length) {
            const paths = subFiles.map((f) => `${folder}/${f.name}`);
            await supabaseAdmin.storage.from("cat-files").remove(paths);
          }
        }
        await supabaseAdmin.storage.from("cat-files").remove(folderPaths);
      }
      results.storage = "cleared";
    } catch (storageErr: any) {
      results.storage = `error: ${storageErr.message}`;
    }

    // 3. Optionally delete all auth users
    if (include_users) {
      try {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        let deleted = 0;
        for (const user of users ?? []) {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (!error) deleted++;
        }
        results.auth_users = `${deleted} deleted`;
      } catch (authErr: any) {
        results.auth_users = `error: ${authErr.message}`;
      }
    } else {
      results.auth_users = "skipped (kept)";
    }

    console.log("Platform reset executed:", results);
    res.json({ success: true, results });
  } catch (err: any) {
    console.error("Reset error:", err);
    res.status(500).json({ error: err.message, partial_results: results });
  }
});

// ─── Voucher validation (used by subscribe flow) ──────────────────────────
// This is a public endpoint but included here for convenience
export async function validateVoucher(code: string): Promise<{ valid: boolean; discount_percent?: number; error?: string }> {
  const { data } = await supabaseAdmin
    .from("vouchers")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("is_active", true)
    .single();

  if (!data) return { valid: false, error: "Voucher tidak ditemukan atau tidak aktif" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false, error: "Voucher sudah kedaluwarsa" };
  if (data.max_uses !== null && data.used_count >= data.max_uses) return { valid: false, error: "Voucher sudah habis" };

  return { valid: true, discount_percent: data.discount_percent };
}

export default router;
