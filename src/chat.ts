import OpenAI from "openai";
import { ChatMessage, MessageContent } from "./types";
import { SYSTEM_PROMPT } from "./prompt";

let openai: OpenAI;

export function initOpenAI() {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  image?: string
): Promise<{ reply: string; history: ChatMessage[] }> {
  // Build user content: text only or text + image
  let userContent: MessageContent;
  if (image) {
    userContent = [
      { type: "text", text: message },
      { type: "image_url", image_url: { url: image } },
    ];
  } else {
    userContent = message;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userContent },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 1000,
  });

  const reply =
    response.choices[0]?.message?.content ??
    "Maaf, terjadi kesalahan. Coba lagi ya.";

  // For history, store a text summary if image was sent (to keep history lean)
  const historyUserContent: MessageContent = image
    ? `${message} [foto kucing dilampirkan]`
    : message;

  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: historyUserContent },
    { role: "assistant", content: reply },
  ];

  return { reply, history: updatedHistory };
}
