import type { Request, Response } from "express";
import { authService } from "./auth.service";

async function sendResult(
    res: Response,
    handler: () => Promise<{ statusCode: number; body: Record<string, unknown> }>,
) {
    const result = await handler();
    res.status(result.statusCode).json(result.body);
}

export const register = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.register(req.body));
};

export const login = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.login(req.body));
};

export const setup2FA = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.setup2FA({ ...req.body, userId: req.user?.id }));
};

export const verify2FA = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.verify2FA(req.body));
};

export const sendOTPController = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.sendOTP(req.body));
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.verifyOTP(req.body));
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

export const syncFirebase = async (req: Request, res: Response): Promise<void> => {
    await sendResult(res, () => authService.syncFirebase(req.body));
};
