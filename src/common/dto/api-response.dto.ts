export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponseDto<T> {
  success: boolean;
  data: T;
  meta?: PaginationMetaDto;
  requestId?: string;
}

export class ApiErrorDto {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId?: string;
  timestamp: string;
  path: string;
}
