import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';

export type MembershipType = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export class CreateClientDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsIn(['monthly', 'quarterly', 'yearly', 'custom'])
  membershipType: MembershipType;

  // Initial payment amount — stored as a Payment record, not on the client
  @IsNumber()
  @Min(0)
  initialAmount: number;

  // Payment method for the initial payment
  @IsIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'])
  @IsOptional()
  initialPaymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';

  @IsDateString()
  startDate: string;

  // Only required when membershipType = 'custom'
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  photoFilename?: string;

  @IsString()
  @IsOptional()
  entryNumber?: string;
}
