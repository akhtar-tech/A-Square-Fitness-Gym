import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryExpenseDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @IsOptional()
  @IsIn([
    'RENT',
    'UTILITIES',
    'EQUIPMENT',
    'SALARIES',
    'MAINTENANCE',
    'MARKETING',
    'OTHER',
  ])
  category?: string;
}
