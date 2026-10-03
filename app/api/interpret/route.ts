import { interpret, InterpretError } from "@/lib/gemma";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BODY = 3 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON request." }, 415);
    // Bound the body even when Content-Length is absent.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "An image is required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return json({ error: "Image is too large. Capture it again." }, 413); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return json({ error: "Invalid JSON request." }, 400); }
    if (!body || !["trace", "object"].includes(body.mode) || typeof body.image !== "string") return json({ error: "Choose a mode and capture an image first." }, 400);
    const image = body.image.replace(/^data:image\/(?:png|jpeg);base64,/, "");
    if (!image || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return json({ error: "Invalid image. Please capture it again." }, 400);
    const bytes = Buffer.from(image, "base64");
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : null;
    if (!mimeType || bytes.length < 32) return json({ error: "Use a PNG trace or JPEG camera capture." }, 400);
    return json(await interpret(body.mode, image, mimeType));
  } catch (error) {
    if (error instanceof InterpretError) return json({ error: error.message }, error.status);
    return json({ error: "Could not analyze the image. Please try again." }, 500);
  }
}
