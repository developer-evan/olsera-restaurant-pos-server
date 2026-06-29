import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

async function seedSuperAdmin() {
  const logger = new Logger('SeedSuperAdmin');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.log('Super admin seed finished. Check logs above for details.');
  await app.close();
}

seedSuperAdmin().catch((error) => {
  console.error('Super admin seed failed:', error);
  process.exit(1);
});
