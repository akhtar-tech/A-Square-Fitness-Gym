"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILE_SIZE = exports.imageFileFilter = void 0;
const common_1 = require("@nestjs/common");
const imageFileFilter = (_req, file, callback) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return callback(new common_1.BadRequestException('Only image files (jpg, jpeg, png, webp) are allowed'), false);
    }
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = file.originalname
        .toLowerCase()
        .substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
        return callback(new common_1.BadRequestException('Invalid file extension'), false);
    }
    callback(null, true);
};
exports.imageFileFilter = imageFileFilter;
exports.MAX_FILE_SIZE = 5 * 1024 * 1024;
//# sourceMappingURL=file-type.validator.js.map