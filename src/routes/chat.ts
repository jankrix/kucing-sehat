import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { ChatRequestSchema } from "../types/api";
import { chat, continueWithToolResults, ToolDefinition } from "../services/openai";
import { buildCatContext } from "../services/chatContext";
import { extractSessionMemory } from "../services/memoryExtractor";
import * as catQueries from "../db/queries/cats";
import * as purchaseQueries from "../db/queries/purchases";
import * as vetVisitQueries from "../db/queries/vetVisits";
import * as chatSessionQueries from "../db/queries/chatSessions";

const router = Router();

const LOG_EXPENSE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "log_expense",
    description:
      "Record a purchase or vet visit expense for the cat whenever the user mentions spending money — buying food, medicine, vitamins, supplements, or visiting a vet/clinic. Always call this when you detect a purchase mention, even if details are partial.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["food", "vitamin", "medicine", "supplement", "vet_visit", "other"],
          description: "Use 'vet_visit' for clinic visits, doctor fees, treatments, or surgery.",
        },
        item_name: {
          type: "string",
          description: "Product name (e.g. 'Royal Canin Kitten') or visit description (e.g. 'Konsultasi + cek darah').",
        },
        brand_or_clinic: {
          type: "string",
          description: "Brand name for products; clinic or hospital name for vet visits.",
        },
        quantity: { type: "string", description: "e.g. '2kg', '1 botol', '30 tablet'" },
        price_idr: { type: "number", description: "Total price in Indonesian Rupiah. Omit if not mentioned." },
        date: { type: "string", description: "Date in YYYY-MM-DD format. Use today if not mentioned." },
        notes: { type: "string", description: "Any extra detail the user mentioned." },
      },
      required: ["category", "item_name"],
    },
  },
};

const TOOLS = [LOG_EXPENSE_TOOL];

// GET /api/chat/sessions/:catId — list sessions for a cat
router.get("/sessions/:catId", async (req: AuthRequest, res) => {
  try {
    const sessions = await chatSessionQueries.listByCat(req.params.catId, req.userId!);
    res.json(sessions);
  } catch (err) {
    console.error("List sessions error:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// GET /api/chat/sessions/:catId/latest — get or create latest session
router.get("/sessions/:catId/latest", async (req: AuthRequest, res) => {
  try {
    const session = await chatSessionQueries.getOrCreate(req.params.catId, req.userId!);
    res.json(session);
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ error: "Failed to get session" });
  }
});

// POST /api/chat/sessions/:catId/new — start a fresh session
router.post("/sessions/:catId/new", async (req: AuthRequest, res) => {
  const catId = req.params.catId;
  const userId = req.userId!;
  try {
    // Grab the current session before creating a new one
    const prevSession = await chatSessionQueries.getLatest(catId, userId);

    const session = await chatSessionQueries.createNew(catId, userId);
    res.json(session);

    // Async memory extraction — runs after response is sent, user doesn't wait
    if (prevSession && prevSession.messages?.length >= 2) {
      const cat = await catQueries.getByIdAndUser(catId, userId);
      if (cat) {
        extractSessionMemory(cat, prevSession.id, prevSession.messages).catch((err) =>
          console.error("Memory extraction failed:", err)
        );
      }
    }
  } catch (err) {
    console.error("Create session error:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// POST /api/chat
router.post("/", async (req: AuthRequest, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { message, image, cat_id, session_id, history: reqHistory } = parsed.data;

  try {
    let cat = null;
    let extraSystemContext: string | undefined;

    if (cat_id) {
      cat = await catQueries.getByIdAndUser(cat_id, req.userId!);
      if (cat) extraSystemContext = await buildCatContext(cat);
    }

    const tools = cat ? TOOLS : undefined;
    const result = await chat(message.trim(), reqHistory ?? [], image, extraSystemContext, tools);

    // Handle tool call — execute and continue
    if (result.tool_calls?.length && cat) {
      const toolResults: Array<{ tool_call_id: string; content: string }> = [];

      for (const tc of result.tool_calls) {
        if (tc.function.name !== "log_expense") continue;

        let args: any = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

        let saved = false;
        let savedDescription = "";
        const today = new Date().toISOString().split("T")[0];
        const date = args.date || today;

        try {
          if (args.category === "vet_visit") {
            await vetVisitQueries.create(cat.id, req.userId!, {
              visit_date: date,
              clinic_name: args.brand_or_clinic || null,
              reason: args.item_name || null,
              cost_idr: args.price_idr ? Math.round(args.price_idr) : null,
              notes: args.notes || null,
            });
            savedDescription = `kunjungan dokter hewan: "${args.item_name}"${args.brand_or_clinic ? ` di ${args.brand_or_clinic}` : ""}${args.price_idr ? `, Rp ${Number(args.price_idr).toLocaleString("id-ID")}` : ""}`;
          } else {
            await purchaseQueries.create(cat.id, req.userId!, {
              category: args.category,
              product_name: args.item_name,
              brand: args.brand_or_clinic || undefined,
              quantity: args.quantity || undefined,
              price_idr: args.price_idr ? Math.round(args.price_idr) : undefined,
              purchase_date: date,
              notes: args.notes || undefined,
            });
            savedDescription = `${args.item_name}${args.brand_or_clinic ? ` (${args.brand_or_clinic})` : ""}${args.quantity ? `, ${args.quantity}` : ""}${args.price_idr ? `, Rp ${Number(args.price_idr).toLocaleString("id-ID")}` : ""}`;
          }
          saved = true;
        } catch (err) {
          console.error("log_expense save error:", err);
        }

        toolResults.push({
          tool_call_id: tc.id,
          content: saved
            ? `Berhasil dicatat: ${savedDescription}`
            : "Gagal menyimpan ke database.",
        });
      }

      const finalReply = await continueWithToolResults(
        result._messages_for_tool_continue!,
        toolResults,
        tools
      );

      // Persist to session
      if (session_id) {
        await chatSessionQueries.appendMessages(session_id, [
          { role: "user", content: message.trim(), timestamp: new Date().toISOString() },
          { role: "assistant", content: finalReply, timestamp: new Date().toISOString() },
        ], message.trim());
      }

      const updatedHistory = [
        ...result.history,
        { role: "assistant" as const, content: finalReply },
      ];
      res.json({ reply: finalReply, history: updatedHistory, logged: true });
      return;
    }

    // Persist to session
    if (session_id) {
      await chatSessionQueries.appendMessages(session_id, [
        { role: "user", content: message.trim(), timestamp: new Date().toISOString() },
        { role: "assistant", content: result.reply, timestamp: new Date().toISOString() },
      ], message.trim());
    }

    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Maaf, ada masalah teknis. Coba lagi ya." });
  }
});

export default router;
