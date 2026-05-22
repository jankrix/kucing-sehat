import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../config";

const router = Router();

// GET /api/me - get current user profile and subscription
router.get("/me", async (req: AuthRequest, res) => {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.userId!);
    if (error || !user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get subscription
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      subscription: subscription ?? { plan: "free", status: "active" },
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
