/**
 * Global error handler middleware.
 * Must be registered LAST in server.js using: app.use(errorHandler)
 *
 * Catches any error passed via next(err) from route handlers.
 */
const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url} →`, err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Only show stack trace in development
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

module.exports = errorHandler;
