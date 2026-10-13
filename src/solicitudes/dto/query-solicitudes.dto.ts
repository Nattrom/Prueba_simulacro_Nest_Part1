import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { normalizeText } from '../../common/utils/normalize-text.js';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

export class QuerySolicitudesDto {
  @ApiPropertyOptional({
    description: 'Filtra por estado exacto.',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(EstadoSolicitud, {
    message: 'estado debe ser PENDIENTE, EN_GESTION o RESUELTA',
  })
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({
    description:
      'Filtra por asesor. Un asesor siempre queda restringido a su propio identificador, aunque envie otro valor.',
    example: 'asesor02',
  })
  @Transform(normalizeText)
  @IsOptional()
  @IsString({ message: 'asesor debe ser una cadena de texto' })
  asesor?: string;

  @ApiPropertyOptional({
    description: 'Filtra por coincidencia parcial en el nombre del cliente.',
    example: 'Andina',
  })
  @Transform(normalizeText)
  @IsOptional()
  @IsString({ message: 'cliente debe ser una cadena de texto' })
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial (ISO 8601) del rango sobre creadaEn.',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'fechaDesde debe ser una fecha ISO 8601 valida' },
  )
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (ISO 8601) del rango sobre creadaEn.',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaHasta debe ser una fecha ISO 8601 valida' })
  fechaHasta?: string;

  @ApiPropertyOptional({
    description: 'Numero de pagina (desde 1). Por defecto 1.',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page debe ser un numero entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por pagina (1 a 100). Por defecto 10.',
    example: 10,
    default: 10,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un numero entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede superar 100' })
  limit: number = 10;
}
