import { PaginationDto } from '../../../common/dto/pagination.dto';
export declare class QueryExpenseDto extends PaginationDto {
    month?: number;
    year?: number;
    category?: string;
}
