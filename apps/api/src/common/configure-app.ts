import { INestApplication } from '@nestjs/common';

import { ZodExceptionFilter } from './zod-exception.filter';

export function configureApp(app: INestApplication) {
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ZodExceptionFilter());
}
