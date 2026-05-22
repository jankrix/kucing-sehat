// Re-export all types
export * from "./db";
export * from "./api";

// Legacy types kept for backward compatibility with existing chat code
export type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: MessageContent;
}
