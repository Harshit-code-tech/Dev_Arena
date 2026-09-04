import type { Request, Response } from "express";
import { sendTrackingError } from "../../shared/utils/tracking";
import { challengeService } from "./challenge.service";
import type { SubmitCodeInput, CreateCompetitionInput, CreateTaskInput, CreateTestCaseInput } from "./challenge.types";

function userId(req: Request) {
    return req.user?.id || "";
}

// ── Player-facing ────────────────────────────────────────────────

export const getActiveCompetition = async (req: Request, res: Response): Promise<void> => {
    try {
        const competition = await challengeService.getActiveCompetition(userId(req));
        if (!competition) {
            res.status(200).json({ success: true, data: null, message: "No active competition this week." });
            return;
        }
        res.status(200).json({ success: true, data: competition });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const submitCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const submission = await challengeService.submitCode(userId(req), req.body as SubmitCodeInput);
        res.status(200).json({ success: true, data: submission });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const getResults = async (req: Request, res: Response): Promise<void> => {
    try {
        const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
        const results = await challengeService.getResults(userId(req), weekStart);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

// ── Admin ────────────────────────────────────────────────────────

export const createCompetition = async (req: Request, res: Response): Promise<void> => {
    try {
        const competition = await challengeService.createCompetition(req.body as CreateCompetitionInput);
        res.status(201).json({ success: true, data: competition });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const activateCompetition = async (req: Request, res: Response): Promise<void> => {
    try {
        const competition = await challengeService.activateCompetition(String(req.params.id));
        res.status(200).json({ success: true, data: competition });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const task = await challengeService.createTask(req.body as CreateTaskInput);
        res.status(201).json({ success: true, data: task });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const createTestCase = async (req: Request, res: Response): Promise<void> => {
    try {
        const testCase = await challengeService.createTestCase(req.body as CreateTestCaseInput);
        res.status(201).json({ success: true, data: testCase });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const aggregateResults = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await challengeService.aggregateResults(String(req.params.id));
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
