import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export type ExpenseCategoryType =
  | 'RENT'
  | 'UTILITIES'
  | 'EQUIPMENT'
  | 'SALARIES'
  | 'MAINTENANCE'
  | 'MARKETING'
  | 'OTHER';

export class CreateExpenseDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn([
    'RENT',
    'UTILITIES',
    'EQUIPMENT',
    'SALARIES',
    'MAINTENANCE',
    'MARKETING',
    'OTHER',
  ])
  category: ExpenseCategoryType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
