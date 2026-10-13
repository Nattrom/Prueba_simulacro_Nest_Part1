import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SWAGGER_PATH, setupSwagger } from './config/swagger.config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  setupSwagger(app);

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API de solicitudes disponible en http://localhost:${port}`);
  logger.log(`Swagger disponible en http://localhost:${port}/${SWAGGER_PATH}`);
}

void bootstrap();
