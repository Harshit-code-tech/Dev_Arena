import type { Request, Response } from "express";
import { sendTrackingError } from "../../shared/utils/tracking";
import { dsaService } from "./dsa.service";
import type { DsaLogInput } from "./dsa.types";

function userId(req: Request) {
    return req.user?.id || "";
}

export const getLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ success: true, data: await dsaService.getLogs(userId(req)) });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const createLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await dsaService.createLog(userId(req), req.body as Partial<DsaLogInput>);
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const updateLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await dsaService.updateLog(userId(req), req.params.id as string, req.body as Partial<DsaLogInput>);
        res.status(200).json({ success: true, data: log });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const deleteLog = async (req: Request, res: Response): Promise<void> => {
    try {
        await dsaService.deleteLog(userId(req), req.params.id as string);
        res.status(200).json({ success: true, message: "DSA entry deleted." });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
