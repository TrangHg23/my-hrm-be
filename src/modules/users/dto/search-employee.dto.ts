import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class SearchEmployeeDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
