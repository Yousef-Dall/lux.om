"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadsRouter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
exports.uploadsRouter = (0, express_1.Router)();
const uploadPath = path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR);
fs_1.default.mkdirSync(uploadPath, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: uploadPath,
    filename: (_req, file, callback) => {
        const extension = path_1.default.extname(file.originalname).toLowerCase();
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: env_1.env.MAX_UPLOAD_MB * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
            callback(new http_1.AppError(400, 'Only image uploads are allowed'));
            return;
        }
        callback(null, true);
    }
});
exports.uploadsRouter.post('/', (0, auth_1.requireAuth)(), upload.single('file'), (req, res, next) => {
    try {
        if (!req.file)
            throw new http_1.AppError(400, 'No file uploaded');
        res.status(201).json({
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype
            },
            url: `/uploads/${req.file.filename}`
        });
    }
    catch (error) {
        next(error);
    }
});
