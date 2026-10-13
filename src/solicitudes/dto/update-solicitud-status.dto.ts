import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

export class UpdateSolicitudStatusDto {
  @ApiProperty({
    description:
      'Nuevo estado de la solicitud. Transiciones permitidas: PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA.',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.EN_GESTION,
  })
  @IsEnum(EstadoSolicitud, {
    message: 'estado debe ser PENDIENTE, EN_GESTION o RESUELTA',
  })
  estado: EstadoSolicitud;
}
