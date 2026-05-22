import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../config";
import { validateVoucher } from "./admin";

const router = Router();

// POST /api/subscribe  { plan, voucher_code? }
// For now: testing_mode or 100%-off voucher = instant grant.
// Payment gateway integration hooks in here later.
router.post("/", async (req: AuthRequest, res) => {
  const { plan, voucher_code } = req.body;

  if (!plan || !["basic", "premium"].includes(plan)) {
    res.status(400).json({ error: "plan must be 'basic' or 'premium'" });
    return;
  }

  try {
    // Fetch pricing config
    const { data: configRow } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "pricing")
      .single();

    const pricing = configRow?.value ?? { basic_idr: 35000, premium_idr: 49000, testing_mode: false };
    const basePrice: number = plan === "premium" ? pricing.premium_idr : pricing.basic_idr;

    let finalPrice = basePrice;
    let voucherResult = null;

    // Validate voucher if provided
    if (voucher_code) {
      voucherResult = await validateVoucher(voucher_code);
      if (!voucherResult.valid) {
        res.status(400).json({ error: voucherResult.error });
        return;
      }
      const discount = voucherResult.discount_percent ?? 0;
      finalPrice = Math.round(basePrice * (1 - discount / 100));
    }

    // Can activate immediately if: testing mode OR price = 0
    const isFree = pricing.testing_mode || finalPrice === 0;

    if (!isFree && finalPrice < (pricing.min_price_idr ?? 35000)) {
      finalPrice = pricing.min_price_idr ?? 35000;
    }

    let subscription = null;

    if (isFree) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: req.userId!,
          plan,
          status: "active",
          expires_at: expires.toISOString(),
          payment_ref: pricing.testing_mode ? "testing_mode" : "voucher_100pct",
        })
        .select()
        .single();

      if (error) throw error;
      subscription = data;

      // Increment voucher usage
      if (voucherResult?.valid && voucher_code) {
        await supabaseAdmin
          .from("vouchers")
          .update({ used_count: supabaseAdmin.rpc("increment_voucher", { code: voucher_code.trim().toUpperCase() }) });
        // Simpler fallback if rpc not defined:
        const { data: v } = await supabaseAdmin.from("vouchers").select("used_count").eq("code", voucher_code.trim().toUpperCase()).single();
        if (v) await supabaseAdmin.from("vouchers").update({ used_count: v.used_count + 1 }).eq("code", voucher_code.trim().toUpperCase());
      }
    }

    res.json({
      requires_payment: !isFree,
      final_price_idr: finalPrice,
      discount_percent: voucherResult?.discount_percent ?? 0,
      subscription,
      // payment_url will be added when payment gateway is integrated
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Gagal memproses langganan" });
  }
});

// POST /api/vouchers/validate  { code } — let users check before subscribing
router.post("/validate-voucher", async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  const result = await validateVoucher(code);
  res.json(result);
});

export default router;
