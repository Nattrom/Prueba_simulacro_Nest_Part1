import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Solicitud, SolicitudHistorial]),
    UsersModule,
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
