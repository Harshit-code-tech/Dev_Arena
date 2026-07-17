import type { Request, Response, NextFunction } from "express";

interface HttpError extends Error {
    statusCode?: number;
}

/**
 * Global error handler middleware.
 * Must be registered LAST in server.ts using: app.use(errorHandler)
 *
 * Catches any error passed via next(err) from route handlers.
 */
const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction): void => {
    console.error(`[ERROR] ${req.method} ${req.url} →`, err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Only show stack trace in development
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

export default errorHandler;
