import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsDateString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  clientId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'])
  @IsOptional()
  method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;

  // Plan to apply after payment; 'none' = fee-only (no date/plan change)
  // Required — must always be explicit so the client record stays in sync
  @IsIn(['none', 'monthly', 'quarterly', 'yearly', 'custom'])
  extendMembership: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

  @IsDateString()
  @IsOptional()
  newEndDate?: string;
}
