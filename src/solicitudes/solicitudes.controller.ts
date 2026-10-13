import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UserGuard } from '../common/guards/user.guard.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { PaginatedResponse } from '../common/interfaces/pagination.interface.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto.js';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from './enums/tipo-evento-historial.enum.js';
import { SolicitudesService } from './solicitudes.service.js';

const solicitudExample = {
  id: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  cliente: 'Comercial Andina S.A.',
  descripcion: 'Seguimiento de cotizacion de equipos de computo',
  asesor: 'asesor01',
  estado: EstadoSolicitud.PENDIENTE,
  version: 1,
  creadaEn: '2026-01-15T10:00:00.000Z',
  actualizadaEn: '2026-01-15T10:00:00.000Z',
};

const historialExample = {
  id: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  solicitudId: solicitudExample.id,
  tipoEvento: TipoEventoHistorial.CREACION,
  estadoAnterior: null,
  estadoNuevo: EstadoSolicitud.PENDIENTE,
  asesorAnterior: null,
  asesorNuevo: 'asesor01',
  usuario: 'asesor01',
  detalle: 'Solicitud registrada',
  fechaEvento: '2026-01-15T10:00:00.000Z',
};

@ApiTags('Solicitudes')
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-user',
  required: true,
  description:
    'Identificador del usuario (admin01, supervisor01, asesor01, asesor02).',
})
@ApiUnauthorizedResponse({
  description: 'API Key invalida o usuario no identificado.',
})
@ApiForbiddenResponse({ description: 'Permisos insuficientes.' })
@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Registrar una solicitud',
    description:
      'Cualquier usuario identificado puede registrar una solicitud. El estado inicial es siempre PENDIENTE. Si el usuario es asesor, la solicitud se asigna automaticamente a su propio identificador. Para admin y supervisor la solicitud se crea SIN asignacion; su asignacion se realiza con PATCH /solicitudes/:id/asignacion.',
  })
  @ApiCreatedResponse({
    description: 'Solicitud registrada.',
    schema: {
      example: { success: true, data: solicitudExample },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos invalidos o propiedades no permitidas.',
  })
  async create(
    @Body() dto: CreateSolicitudDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.solicitudesService.create(dto, user);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar solicitudes',
    description:
      'admin y supervisor consultan todas las solicitudes (o filtradas). asesor solo consulta sus propias solicitudes: el filtro por asesor se aplica en la consulta a la base de datos y no puede ampliarse desde el cliente. Permite filtrar por estado, asesor, coincidencia parcial de cliente y rango de fechas (creadaEn), y paginar con page/limit.',
  })
  @ApiOkResponse({
    description: 'Listado paginado de solicitudes autorizadas.',
    schema: {
      example: {
        success: true,
        data: {
          items: [solicitudExample],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      },
    },
  })
  async findAll(
    @Query() query: QuerySolicitudesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Solicitud>> {
    return this.solicitudesService.findAll(query, user);
  }

  @Get(':id/historial')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar el historial de una solicitud',
    description:
      'Devuelve los eventos de auditoria persistidos (CREACION, ASIGNACION, ESTADO) en orden cronologico. admin y supervisor consultan cualquier solicitud; asesor solo las propias (HTTP 403 si es ajena).',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la solicitud.',
    example: solicitudExample.id,
  })
  @ApiOkResponse({
    description: 'Historial de la solicitud.',
    schema: { example: { success: true, data: [historialExample] } },
  })
  @ApiNotFoundResponse({ description: 'Solicitud inexistente.' })
  async historial(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudHistorial[]> {
    return this.solicitudesService.historial(id, user);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar una solicitud',
    description:
      'admin y supervisor consultan cualquier solicitud. asesor solo puede consultar sus propias solicitudes; en caso contrario recibe 403 sin exponer datos protegidos.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la solicitud.',
    example: solicitudExample.id,
  })
  @ApiOkResponse({
    description: 'Solicitud encontrada.',
    schema: { example: { success: true, data: solicitudExample } },
  })
  @ApiNotFoundResponse({ description: 'Solicitud inexistente.' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.solicitudesService.findOne(id, user);
  }

  @Patch(':id/asignacion')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Asignar o reasignar una solicitud',
    description:
      'Solo admin y supervisor. Asigna la solicitud a un asesor existente. Devuelve 400 si el asesor no existe o no tiene rol asesor, 404 si la solicitud no existe y 409 si la solicitud esta RESUELTA. Si el asesor coincide con el actual no produce cambios.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la solicitud.',
    example: solicitudExample.id,
  })
  @ApiOkResponse({
    description: 'Solicitud asignada.',
    schema: { example: { success: true, data: solicitudExample } },
  })
  @ApiBadRequestResponse({ description: 'Asesor invalido o inexistente.' })
  @ApiConflictResponse({ description: 'Solicitud resuelta.' })
  @ApiNotFoundResponse({ description: 'Solicitud inexistente.' })
  async asignar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AsignarSolicitudDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.solicitudesService.asignar(id, dto, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'admin y supervisor pueden cambiar el estado de cualquier solicitud. asesor solo de las propias. Transiciones permitidas: PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA. El resto devuelve 409. Debe enviarse versionEsperada (concurrencia optimista); si no coincide con la version actual devuelve 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la solicitud.',
    example: solicitudExample.id,
  })
  @ApiOkResponse({
    description: 'Estado actualizado.',
    schema: {
      example: {
        success: true,
        data: {
          ...solicitudExample,
          estado: EstadoSolicitud.EN_GESTION,
          version: 2,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Estado o versionEsperada invalidos.' })
  @ApiConflictResponse({
    description:
      'Transicion de estado no permitida o version desactualizada.',
  })
  @ApiNotFoundResponse({ description: 'Solicitud inexistente.' })
  async updateEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSolicitudStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.solicitudesService.updateEstado(id, dto, user);
  }
}
