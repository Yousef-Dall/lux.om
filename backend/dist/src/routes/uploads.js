"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadsRouter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
exports.uploadsRouter = (0, express_1.Router)();
const uploadPath = path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR);
fs_1.default.mkdirSync(uploadPath, {
    recursive: true
});
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const storage = multer_1.default.diskStorage({
    destination: uploadPath,
    filename: (_req, file, callback) => {
        const extension = path_1.default.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.has(extension)) {
            callback(new http_1.AppError(400, 'Unsupported image file extension'), '');
            return;
        }
        const safeFilename = `${Date.now()}-${crypto_1.default.randomBytes(12).toString('hex')}${extension}`;
        callback(null, safeFilename);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: env_1.maxUploadBytes,
        files: 1
    },
    fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            callback(new http_1.AppError(400, 'Only JPG, PNG, WEBP, and GIF images are allowed'));
            return;
        }
        callback(null, true);
    }
});
function getUploadedFile(req) {
    const files = req.files;
    return files?.image?.[0] ?? files?.file?.[0] ?? null;
}
exports.uploadsRouter.post('/', (0, auth_1.requireAuth)(), (req, res, next) => {
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 }
    ])(req, res, (error) => {
        try {
            if (error instanceof multer_1.default.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    throw new http_1.AppError(400, `File is too large. Maximum size is ${env_1.env.MAX_UPLOAD_MB}MB`);
                }
                if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                    throw new http_1.AppError(400, 'Unexpected upload field. Use image or file.');
                }
                throw new http_1.AppError(400, error.message);
            }
            if (error) {
                throw error;
            }
            const uploadedFile = getUploadedFile(req);
            if (!uploadedFile) {
                throw new http_1.AppError(400, 'No file uploaded');
            }
            const url = `/uploads/${uploadedFile.filename}`;
            res.status(201).json({
                url,
                fileUrl: url,
                imageUrl: url,
                file: {
                    originalName: uploadedFile.originalname,
                    filename: uploadedFile.filename,
                    size: uploadedFile.size,
                    mimetype: uploadedFile.mimetype,
                    url
                }
            });
        }
        catch (caughtError) {
            next(caughtError);
        }
    });
});
