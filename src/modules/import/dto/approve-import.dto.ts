import { IsString, IsOptional } from 'class-validator';

/**
 * Required fields to approve a staging entry and create a real Client record.
 * clientName and clientPhone are mandatory if not already set on the staging record.
 */
export class ApproveImportDto {
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsString()
  @IsOptional()
  reviewNote?: string;
}
