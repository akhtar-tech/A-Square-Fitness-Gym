"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        databaseUrl: process.env.DATABASE_URL,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3000',
        ],
    };
};
//# sourceMappingURL=app.config.js.map