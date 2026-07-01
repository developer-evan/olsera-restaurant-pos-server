import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { RequestIdInterceptor } from '../common/interceptors/request-id.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Olsera Restaurant POS API')
    .setDescription(
      'SaaS restaurant POS platform — platform admin onboarding and tenant operations.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health', 'Application and database health checks')
    .addTag('Auth', 'Registration, login, and session management')
    .addTag('Platform', 'Super admin tenant onboarding and management')
    .addTag('Organizations', 'Tenant organization context')
    .addTag('Stores', 'Store switcher, store management, and staff invites')
    .addTag('Categories', 'Menu category management per store')
    .addTag('Products', 'Menu product management per store')
    .addTag('Promos', 'Discount codes and promo validation for POS')
    .addTag('Orders', 'POS order lifecycle and line items')
    .addTag('Transactions', 'Order payments, refunds, and transaction history')
    .addTag('RBAC', 'Role-based access control and store permissions')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
}
