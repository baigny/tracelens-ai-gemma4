export type Mode = "trace" | "object";
export type Point = { x: number; y: number };
export type TracePoint = Point & { breakBefore?: boolean };
export type Interpretation = { object: string; confidence: "low" | "medium" | "high"; description: string };
export type CameraStatus = { ready: boolean; tracking: boolean; message: string };

export function isInterpretation(value: unknown): value is Interpretation {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.object === "string" && !!r.object.trim() && r.object.length <= 100
    && ["low", "medium", "high"].includes(String(r.confidence))
    && typeof r.description === "string" && !!r.description.trim()
    && r.description.trim().split(/\s+/).length < 20;
}
