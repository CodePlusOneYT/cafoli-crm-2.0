"use node";
import Anthropic from "@anthropic-ai/sdk";
import { ActionCtx } from "../_generated/server";

// Keep the same export name for backward compatibility
export const modelsToTry = ["claude-haiku-4-5"];
export const gemmaModel = "claude-haiku-4-5";

export function extractJsonFromMarkdown(text: string): string {
  const jsonBlockRegex = new RegExp("\\x60{3}(?:json)?\\s*([\\s\\S]*?)\\s*\\x60{3}");
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return text;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  return new Anthropic({ apiKey });
}

// Kept for backward compat — no-op since we use env key directly
export async function getGeminiKeys(_ctx: ActionCtx) {
  return [{ apiKey: process.env.ANTHROPIC_API_KEY || "", label: "Anthropic Env Key" }];
}

export async function generateWithGemini(
  _ctx: ActionCtx,
  systemPrompt: string,
  userPrompt: string,
  config: {
    jsonMode?: boolean;
    model?: string;
    useGemma?: boolean;
  } = {}
): Promise<{ text: string; model: string }> {
  const client = getAnthropicClient();
  const model = "claude-haiku-4-5";

  const systemContent = config.jsonMode
    ? systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, just the JSON object."
    : systemPrompt;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemContent,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return { text, model };
}

export async function generateWithGeminiVision(
  _ctx: ActionCtx,
  systemPrompt: string,
  userPrompt: string,
  imageUrl: string,
  config: { jsonMode?: boolean } = {}
): Promise<{ text: string; model: string }> {
  const client = getAnthropicClient();
  const model = "claude-opus-4-5"; // Use vision-capable model

  // Download the image
  let imageData: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } | null = null;
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const mimeType = contentType.split(";")[0].trim() as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      imageData = { data: base64, mediaType: mimeType };
    }
  } catch (e) {
    console.warn("Failed to download image for vision:", e);
  }

  if (!imageData) {
    // Fall back to text-only
    return generateWithGemini(_ctx, systemPrompt, userPrompt, config);
  }

  const systemContent = config.jsonMode
    ? systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, just the JSON object."
    : systemPrompt;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemContent,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageData.mediaType,
              data: imageData.data,
            },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return { text, model };
}