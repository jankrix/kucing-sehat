import { openai } from "../config";
import { ChatMessage, MessageContent } from "../types";
import { SYSTEM_PROMPT } from "../prompt";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ChatResult {
  reply: string;
  history: ChatMessage[];
  tool_calls?: ToolCall[];
  // messages at the point tool_calls were returned, needed to continue
  _messages_for_tool_continue?: any[];
}

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  image?: string,
  extraSystemContext?: string,
  tools?: ToolDefinition[]
): Promise<ChatResult> {
  let systemPrompt = SYSTEM_PROMPT;
  if (extraSystemContext) systemPrompt += "\n\n" + extraSystemContext;

  let userContent: MessageContent;
  if (image) {
    userContent = [
      { type: "text", text: message },
      { type: "image_url", image_url: { url: image } },
    ];
  } else {
    userContent = message;
  }

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userContent },
  ];

  const params: any = {
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  };

  if (tools?.length) {
    params.tools = tools;
    params.tool_choice = "auto";
  }

  const response = await openai.chat.completions.create(params);
  const choice = response.choices[0];
  const assistantMsg = choice.message;

  const historyUserContent: MessageContent = image
    ? `${message} [foto dilampirkan]`
    : message;

  // GPT wants to call a tool — return tool calls to the route handler for execution
  if (assistantMsg.tool_calls?.length) {
    return {
      reply: "",
      history: [...history, { role: "user", content: historyUserContent }],
      tool_calls: assistantMsg.tool_calls.map((tc) => ({
        id: tc.id,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
      _messages_for_tool_continue: [
        ...messages,
        { role: "assistant", tool_calls: assistantMsg.tool_calls },
      ],
    };
  }

  const reply = assistantMsg.content ?? "Maaf, terjadi kesalahan. Coba lagi ya.";

  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: historyUserContent },
    { role: "assistant", content: reply },
  ];

  return { reply, history: updatedHistory };
}

// Called after the route handler executes tool calls and has results
export async function continueWithToolResults(
  messagesBeforeTools: any[],
  toolResults: Array<{ tool_call_id: string; content: string }>,
  tools?: ToolDefinition[]
): Promise<string> {
  const messages = [
    ...messagesBeforeTools,
    ...toolResults.map((r) => ({
      role: "tool",
      tool_call_id: r.tool_call_id,
      content: r.content,
    })),
  ];

  const params: any = {
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  };
  if (tools?.length) params.tools = tools;

  const response = await openai.chat.completions.create(params);
  return response.choices[0]?.message?.content ?? "Oke, sudah dicatat!";
}
