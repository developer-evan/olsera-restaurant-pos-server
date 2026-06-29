import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/headers.constants';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ headers: Record<string, string> }>();
    const response = http.getResponse<Response>();

    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string | undefined) ??
      randomUUID();

    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
