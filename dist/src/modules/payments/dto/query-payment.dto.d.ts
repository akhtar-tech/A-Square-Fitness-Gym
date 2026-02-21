import { PaginationDto } from '../../../common/dto/pagination.dto';
export declare class QueryPaymentDto extends PaginationDto {
    clientId?: string;
    month?: number;
    year?: number;
}
