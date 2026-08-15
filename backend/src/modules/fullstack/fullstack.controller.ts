import type { Request, Response } from "express";
import { sendTrackingError } from "../../shared/utils/tracking";
import { fullstackService } from "./fullstack.service";
import type { FullstackLogInput } from "./fullstack.types";

function userId(req: Request) {
    return req.user?.id || "";
}

export const getLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ success: true, data: await fullstackService.getLogs(userId(req)) });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const createLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await fullstackService.createLog(userId(req), req.body as Partial<FullstackLogInput>);
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const updateLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await fullstackService.updateLog(userId(req), req.params.id as string, req.body as Partial<FullstackLogInput>);
        res.status(200).json({ success: true, data: log });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const deleteLog = async (req: Request, res: Response): Promise<void> => {
    try {
        await fullstackService.deleteLog(userId(req), req.params.id as string);
        res.status(200).json({ success: true, message: "Fullstack entry deleted." });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
