import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * Build a stable per-client rate-limit key after Express has resolved the
 * trusted Render proxy hop. ipKeyGenerator keeps IPv6 clients grouped safely.
 */
export function rateLimitKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  return ipKeyGenerator(ip);
}
