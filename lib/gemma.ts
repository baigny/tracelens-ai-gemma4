import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { isInterpretation, type Mode } from "@/types";

// Single model configuration. Imported only by the server route.
export const GEMMA_MODEL = "gemma-4-26b-a4b-it";

export class InterpretError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function parseInterpretation(text: string | undefined) {
  try {
    const result: unknown = JSON.parse(text ?? "");
    if (!isInterpretation(result)) throw new Error("Invalid shape");
    return { object: result.object.trim(), confidence: result.confidence, description: result.description.trim() };
  } catch { throw new InterpretError("Gemma returned an unreadable result. Please try again.", 502); }
}

export async function interpret(mode: Mode, image: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new InterpretError("Add GEMINI_API_KEY to .env.local and restart the app to enable analysis.", 503);
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } } });
  try {
    const response = await ai.models.generateContent({
      model: GEMMA_MODEL,
      contents: [{ role: "user", parts: [
        { text: `Identify the most likely object in this ${mode === "trace" ? "rough air-drawn trace" : "photograph"}. Return JSON only: {"object":"","confidence":"low|medium|high","description":""}. Keep description under 20 words. Use low confidence if unclear. No markdown.` },
        { inlineData: { mimeType, data: image } },
      ] }],
      config: { maxOutputTokens: 256, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
    });
    return parseInterpretation(response.text);
  } catch (error) {
    if (error instanceof InterpretError) throw error;
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 429) throw new InterpretError("Gemma's free-tier limit was reached. Wait a little, then click Analyze again.", 429);
    if (status === 401 || status === 403) throw new InterpretError("Gemini API access was denied. Check the server's API key and model access.", 503);
    if (status === 404) throw new InterpretError("The configured Gemma model is unavailable. Check GEMMA_MODEL in lib/gemma.ts.", 503);
    throw new InterpretError("Could not analyze the image. Please try again. No automatic retry was made.", 502);
  }
}
