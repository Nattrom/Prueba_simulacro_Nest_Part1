import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { EntityManager, FindOptionsWhere } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { PaginatedResponse } from '../common/interfaces/pagination.interface.js';
import { UsersService } from '../users/users.service.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto.js';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from './enums/tipo-evento-historial.enum.js';

const ALLOWED_TRANSITIONS: Record<EstadoSolicitud, EstadoSolicitud[]> = {
  [EstadoSolicitud.PENDIENTE]: [EstadoSolicitud.EN_GESTION],
  [EstadoSolicitud.EN_GESTION]: [EstadoSolicitud.RESUELTA],
  [EstadoSolicitud.RESUELTA]: [],
};

const CONCURRENCY_MESSAGE =
  'La solicitud fue modificada por otro usuario. Consulte la version actual.';

interface HistorialInput {
  solicitudId: string;
  tipoEvento: TipoEventoHistorial;
  usuario: string;
  estadoAnterior?: EstadoSolicitud | null;
  estadoNuevo?: EstadoSolicitud | null;
  asesorAnterior?: string | null;
  asesorNuevo?: string | null;
  detalle?: string | null;
}

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudesRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudHistorial)
    private readonly historialRepository: Repository<SolicitudHistorial>,
    private readonly usersService: UsersService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateSolicitudDto,
    user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.dataSource.transaction(async (manager) => {
      const asesor = user.role === 'asesor' ? user.id : null;

      const solicitud = manager.create(Solicitud, {
        cliente: dto.cliente,
        descripcion: dto.descripcion,
        asesor,
        estado: EstadoSolicitud.PENDIENTE,
        version: 1,
      });

      const saved = await manager.save(solicitud);

      await this.registrarHistorial(manager, {
        solicitudId: saved.id,
        tipoEvento: TipoEventoHistorial.CREACION,
        estadoNuevo: EstadoSolicitud.PENDIENTE,
        asesorNuevo: saved.asesor,
        usuario: user.id,
        detalle: 'Solicitud registrada',
      });

      return saved;
    });
  }

  async findAll(
    query: QuerySolicitudesDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Solicitud>> {
    const page = query.page;
    const limit = query.limit;
    const where: FindOptionsWhere<Solicitud> = {};

    if (user.role === 'asesor') {
      where.asesor = user.id;
    } else if (query.asesor) {
      where.asesor = query.asesor;
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.cliente) {
      where.cliente = Like(`%${query.cliente}%`);
    }

    if (query.fechaDesde && query.fechaHasta) {
      where.creadaEn = Between(
        new Date(query.fechaDesde),
        new Date(query.fechaHasta),
      );
    } else if (query.fechaDesde) {
      where.creadaEn = MoreThanOrEqual(new Date(query.fechaDesde));
    } else if (query.fechaHasta) {
      where.creadaEn = LessThanOrEqual(new Date(query.fechaHasta));
    }

    const [items, total] = await this.solicitudesRepository.findAndCount({
      where,
      order: { creadaEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<Solicitud> {
    const solicitud = await this.solicitudesRepository.findOne({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    this.assertCanAccess(solicitud, user);

    return solicitud;
  }

  async historial(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SolicitudHistorial[]> {
    const solicitud = await this.solicitudesRepository.findOne({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    this.assertCanAccess(solicitud, user);

    return this.historialRepository
      .createQueryBuilder('historial')
      .where('historial.solicitud_id = :solicitudId', { solicitudId: id })
      .orderBy('historial.fecha_evento', 'ASC')
      .addOrderBy('historial.rowid', 'ASC')
      .getMany();
  }

  async asignar(
    id: string,
    dto: AsignarSolicitudDto,
    user: AuthenticatedUser,
  ): Promise<Solicitud> {
    if (!this.usersService.isAsesor(dto.asesor)) {
      throw new BadRequestException(
        'El asesor indicado no existe o no tiene el rol asesor',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.findOne(Solicitud, { where: { id } });

      if (!solicitud) {
        throw new NotFoundException('Solicitud no encontrada');
      }

      if (solicitud.estado === EstadoSolicitud.RESUELTA) {
        throw new ConflictException(
          'No se puede asignar o reasignar una solicitud resuelta',
        );
      }

      if (solicitud.asesor === dto.asesor) {
        return solicitud;
      }

      const asesorAnterior = solicitud.asesor;
      solicitud.asesor = dto.asesor;

      const saved = await manager.save(solicitud);

      await this.registrarHistorial(manager, {
        solicitudId: saved.id,
        tipoEvento: TipoEventoHistorial.ASIGNACION,
        asesorAnterior,
        asesorNuevo: dto.asesor,
        usuario: user.id,
        detalle: asesorAnterior
          ? `Reasignada de ${asesorAnterior} a ${dto.asesor}`
          : `Asignada a ${dto.asesor}`,
      });

      return saved;
    });
  }

  async updateEstado(
    id: string,
    dto: UpdateSolicitudStatusDto,
    user: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.findOne(Solicitud, { where: { id } });

      if (!solicitud) {
        throw new NotFoundException('Solicitud no encontrada');
      }

      this.assertCanAccess(solicitud, user);
      this.assertValidTransition(solicitud.estado, dto.estado);

      if (solicitud.version !== dto.versionEsperada) {
        throw new ConflictException(CONCURRENCY_MESSAGE);
      }

      const estadoAnterior = solicitud.estado;

      const result = await manager
        .createQueryBuilder()
        .update(Solicitud)
        .set({
          estado: dto.estado,
          version: () => 'version + 1',
          actualizadaEn: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id AND version = :version', {
          id,
          version: dto.versionEsperada,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(CONCURRENCY_MESSAGE);
      }

      await this.registrarHistorial(manager, {
        solicitudId: id,
        tipoEvento: TipoEventoHistorial.ESTADO,
        estadoAnterior,
        estadoNuevo: dto.estado,
        usuario: user.id,
        detalle: `Cambio de estado ${estadoAnterior} -> ${dto.estado}`,
      });

      return (await manager.findOne(Solicitud, { where: { id } })) as Solicitud;
    });
  }

  private async registrarHistorial(
    manager: EntityManager,
    data: HistorialInput,
  ): Promise<SolicitudHistorial> {
    const registro = manager.create(SolicitudHistorial, {
      solicitudId: data.solicitudId,
      tipoEvento: data.tipoEvento,
      estadoAnterior: data.estadoAnterior ?? null,
      estadoNuevo: data.estadoNuevo ?? null,
      asesorAnterior: data.asesorAnterior ?? null,
      asesorNuevo: data.asesorNuevo ?? null,
      usuario: data.usuario,
      detalle: data.detalle ?? null,
      fechaEvento: new Date(),
    });

    return manager.save(registro);
  }

  private assertCanAccess(
    solicitud: Solicitud,
    user: AuthenticatedUser,
  ): void {
    if (user.role === 'asesor' && solicitud.asesor !== user.id) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a esta solicitud',
      );
    }
  }

  private assertValidTransition(
    current: EstadoSolicitud,
    next: EstadoSolicitud,
  ): void {
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new ConflictException(
        `Transicion de estado no permitida: ${current} -> ${next}`,
      );
    }
  }
}
