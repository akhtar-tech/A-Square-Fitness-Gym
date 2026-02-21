export declare class PaginationDto {
    skip?: number;
    take?: number;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
}
