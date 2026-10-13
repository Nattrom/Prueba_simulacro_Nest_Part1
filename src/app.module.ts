import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { configuration } from './config/configuration.js';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { UsersModule } from './users/users.module.js';

const buildTypeOrmOptions = (config: ConfigService): TypeOrmModuleOptions => {
  const database =
    config.get<string>('databasePath') ?? 'data/solicitudes.sqlite';

  if (database !== ':memory:') {
    mkdirSync(dirname(resolve(database)), { recursive: true });
  }

  return {
    type: 'better-sqlite3',
    database,
    autoLoadEntities: true,
    synchronize:
      (config.get<string>('nodeEnv') ?? 'development') !== 'production',
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    UsersModule,
    SolicitudesModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
