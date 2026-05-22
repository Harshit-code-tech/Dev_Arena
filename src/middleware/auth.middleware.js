// This middleware verifies the JWT token on protected routes.
// It should attach req.user = { id, email, name } on success.

exports.protect = async (req, res, next) => {
    // Placeholder - let all requests through until auth is implemented
    // REMOVE this and implement JWT verification before production
    req.user = { id: "placeholder", email: "[EMAIL_ADDRESS]", name: "Dev" };
    next();
};
