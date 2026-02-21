"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewImportDto = void 0;
const class_validator_1 = require("class-validator");
class ReviewImportDto {
    clientName;
    clientPhone;
    addressRaw;
    membershipDurationMonths;
    membershipAmount;
    paymentMode;
    reviewNote;
}
exports.ReviewImportDto = ReviewImportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewImportDto.prototype, "clientName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewImportDto.prototype, "clientPhone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewImportDto.prototype, "addressRaw", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ReviewImportDto.prototype, "membershipDurationMonths", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ReviewImportDto.prototype, "membershipAmount", void 0);
__decorate([
    (0, class_validator_1.IsIn)([
        'online',
        'cash',
        'upi',
        'card',
        'bank',
        'neft',
        'imps',
        'gpay',
        'phonepe',
        'paytm',
    ]),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewImportDto.prototype, "paymentMode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewImportDto.prototype, "reviewNote", void 0);
//# sourceMappingURL=review-import.dto.js.map