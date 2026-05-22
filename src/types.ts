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

export interface ChatRequest {
  message: string;
  image?: string; // base64 data URL (e.g. "data:image/jpeg;base64,...")
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  history: ChatMessage[];
}
