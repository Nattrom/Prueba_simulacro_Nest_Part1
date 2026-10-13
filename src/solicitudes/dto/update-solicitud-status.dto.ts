import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';
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

  @ApiProperty({
    description:
      'Version que el cliente observo al leer la solicitud. Si no coincide con la version actual se rechaza con HTTP 409 (control de concurrencia optimista).',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'versionEsperada debe ser un numero entero' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1' })
  versionEsperada: number;
}
