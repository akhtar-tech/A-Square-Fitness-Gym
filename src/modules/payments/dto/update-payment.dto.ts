import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePaymentDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'])
  @IsOptional()
  method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
