import type { Request, Response } from "express";
import { dashboardService } from "./dashboard.service";
import type { DashboardUpdateInput } from "./dashboard.types";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        const dashboard = await dashboardService.getDashboard(req.user.id);

        if (!dashboard) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json(dashboard);
    } catch (error: unknown) {
        res.status(500).json({
            message: "Failed to fetch dashboard data",
            error: getErrorMessage(error),
        });
    }
};

export const updateDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        const user = await dashboardService.updateDashboard(
            req.user.id,
            req.body as DashboardUpdateInput,
        );

        res.status(200).json({ message: "Dashboard updated successfully", user });
    } catch (error: unknown) {
        res.status(500).json({
            message: "Failed to update dashboard data",
            error: getErrorMessage(error),
        });
    }
};
