import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { SolicitudesService } from './solicitudes.service.js';

const solicitudExample = {
  id: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  cliente: 'Comercial Andina S.A.',
  descripcion: 'Seguimiento de cotizacion de equipos de computo',
  asesor: 'asesor01',
  estado: EstadoSolicitud.PENDIENTE,
  creadaEn: '2026-01-15T10:00:00.000Z',
  actualizadaEn: '2026-01-15T10:00:00.000Z',
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
      'Cualquier usuario identificado puede registrar una solicitud. El estado inicial es siempre PENDIENTE. Si el usuario es asesor, el campo asesor se asigna automaticamente a su propio identificador. Para admin y supervisor, el campo asesor es obligatorio y debe existir con rol asesor.',
  })
  @ApiCreatedResponse({
    description: 'Solicitud registrada.',
    schema: {
      example: { success: true, data: solicitudExample },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos invalidos o asesor inexistente.',
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
      'admin y supervisor consultan todas las solicitudes. asesor solo consulta sus propias solicitudes (filtro aplicado en la consulta a la base de datos).',
  })
  @ApiOkResponse({
    description: 'Listado de solicitudes autorizadas.',
    schema: {
      example: { success: true, data: [solicitudExample] },
    },
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Solicitud[]> {
    return this.solicitudesService.findAll(user);
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
    example: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
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

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'admin y supervisor pueden cambiar el estado de cualquier solicitud. asesor solo de las propias. Transiciones permitidas: PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA. El resto devuelve 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la solicitud.',
    example: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ApiOkResponse({
    description: 'Estado actualizado.',
    schema: {
      example: {
        success: true,
        data: { ...solicitudExample, estado: EstadoSolicitud.EN_GESTION },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Estado invalido.' })
  @ApiConflictResponse({
    description: 'Transicion de estado no permitida.',
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
