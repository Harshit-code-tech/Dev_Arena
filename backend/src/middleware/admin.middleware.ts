import type { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";

function configuredAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true },
    });
    const envAdmin = user ? configuredAdminEmails().has(user.email.toLowerCase()) : false;
    if (!user || (user.role !== "Admin" && user.role !== "Judge" && !envAdmin)) {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
