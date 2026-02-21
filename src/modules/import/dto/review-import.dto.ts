import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
  IsInt,
} from 'class-validator';

/**
 * Used by the admin to patch a staging record before approving.
 * All fields optional — only provide what you're correcting.
 */
export class ReviewImportDto {
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsString()
  @IsOptional()
  addressRaw?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  membershipDurationMonths?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  membershipAmount?: number;

  @IsIn([
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
  ])
  @IsOptional()
  paymentMode?: string;

  @IsString()
  @IsOptional()
  reviewNote?: string;
}
