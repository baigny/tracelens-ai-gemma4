import type { TracePoint } from "@/types";

export function exportTrace(points: TracePoint[]): string | null {
  if (!points.some((p, i) => i > 0 && !p.breakBefore && Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) >= 4)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable. Please reload your browser.");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const width = maxX - minX, height = maxY - minY;
  const scale = 640 / Math.max(width, height, 1);
  const offsetX = (768 - width * scale) / 2, offsetY = (768 - height * scale) / 2;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 768, 768);
  drawTrace(ctx, points.map(p => ({ ...p, x: (p.x - minX) * scale + offsetX, y: (p.y - minY) * scale + offsetY })), "#171717", 8);
  return canvas.toDataURL("image/png");
}

export function drawTrace(ctx: CanvasRenderingContext2D, points: TracePoint[], color = "#a0f0ce", width = 6) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (!previous || point.breakBefore) ctx.moveTo(point.x, point.y);
    else {
      ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2);
      if (!points[index + 1] || points[index + 1].breakBefore) ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
}
