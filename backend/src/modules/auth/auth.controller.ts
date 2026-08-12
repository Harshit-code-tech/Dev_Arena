import type { Request, Response } from "express";
import { authService } from "./auth.service";

async function sendResult(
  res: Response,
  handler: () => Promise<{ statusCode: number; body: Record<string, unknown> }>,
) {
  const result = await handler();
  res.status(result.statusCode).json(result.body);
}

export const register = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    code: "FIREBASE_AUTH_REQUIRED",
    message: "Email/password signup is handled by Firebase Authentication. Update the DevArena client and try again.",
  });
};

export const login = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    code: "FIREBASE_AUTH_REQUIRED",
    message: "Email/password login is handled by Firebase Authentication. Update the DevArena client and try again.",
  });
};

export const verifyAuthOtp = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.verifyAuthOtp(req.body));
};

export const resendAuthOtp = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.resendAuthOtp(req.body));
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.forgotPassword(req.body));
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.resetPassword(req.body));
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.getCurrentUser(req.user?.id));
};

export const prepareFirebaseMigration = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.prepareFirebaseMigration(req.body));
};

export const syncFirebase = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.syncFirebase(req.body));
};

export const usernameAvailability = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.usernameAvailability(req.user?.id, req.query.username));
};

export const chooseUsername = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.chooseUsername(req.user?.id, req.body));
};

export const completeOnboarding = async (req: Request, res: Response): Promise<void> => {
  await sendResult(res, () => authService.completeOnboarding(req.user?.id));
};
