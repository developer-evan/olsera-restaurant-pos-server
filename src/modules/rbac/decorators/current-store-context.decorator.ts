import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { StoreContextPayload } from '../types/rbac.types';

type StoreContextRequest = Request & { storeContext?: StoreContextPayload };

export const CurrentStoreContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StoreContextPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<StoreContextRequest>();
    return request.storeContext;
  },
);
