import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// Claude model to use
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!ENV.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropicClient = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return anthropicClient;
}

/**
 * Extract system message and convert remaining messages to Anthropic format.
 */
function convertMessages(messages: Message[]): {
  system: string | undefined;
  anthropicMessages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  let system: string | undefined;
  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const msg of messages) {
    const textContent = extractText(msg.content);

    if (msg.role === "system") {
      // Combine multiple system messages
      system = system ? `${system}\n\n${textContent}` : textContent;
    } else if (msg.role === "user" || msg.role === "assistant") {
      anthropicMessages.push({ role: msg.role, content: textContent });
    }
    // Skip tool/function messages as they're not used in this chatbot
  }

  // Anthropic requires messages to start with a user message
  // If first message is assistant, prepend a placeholder user message
  if (anthropicMessages.length > 0 && anthropicMessages[0].role === "assistant") {
    anthropicMessages.unshift({ role: "user", content: "(conversation start)" });
  }

  // Anthropic requires alternating user/assistant messages
  // Merge consecutive same-role messages
  const merged: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of anthropicMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += "\n\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  return { system, anthropicMessages: merged };
}

function extractText(content: MessageContent | MessageContent[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    if (content.type === "text") return content.text;
    return JSON.stringify(content);
  }
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      return JSON.stringify(part);
    })
    .join("\n");
}

/**
 * Invoke Claude LLM and return result in OpenAI-compatible format
 * (so existing callers don't need to change).
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();

  const maxTokens = params.maxTokens || params.max_tokens || 4096;
  const { system, anthropicMessages } = convertMessages(params.messages);

  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: "user", content: "(empty)" });
  }

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: anthropicMessages,
  });

  // Extract text from response
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Convert to OpenAI-compatible format for existing callers
  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: responseText,
        },
        finish_reason: response.stop_reason === "end_turn" ? "stop" : response.stop_reason,
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
