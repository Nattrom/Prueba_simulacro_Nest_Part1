import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { UsersService } from '../users/users.service.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';

const ALLOWED_TRANSITIONS: Record<EstadoSolicitud, EstadoSolicitud[]> = {
  [EstadoSolicitud.PENDIENTE]: [EstadoSolicitud.EN_GESTION],
  [EstadoSolicitud.EN_GESTION]: [EstadoSolicitud.RESUELTA],
  [EstadoSolicitud.RESUELTA]: [],
};

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudesRepository: Repository<Solicitud>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    dto: CreateSolicitudDto,
    user: AuthenticatedUser,
  ): Promise<Solicitud> {
    const asesor = this.resolveAsesor(dto, user);

    const solicitud = this.solicitudesRepository.create({
      cliente: dto.cliente,
      descripcion: dto.descripcion,
      asesor,
      estado: EstadoSolicitud.PENDIENTE,
    });

    return this.solicitudesRepository.save(solicitud);
  }

  findAll(user: AuthenticatedUser): Promise<Solicitud[]> {
    if (user.role === 'asesor') {
      return this.solicitudesRepository.find({
        where: { asesor: user.id },
        order: { creadaEn: 'DESC' },
      });
    }

    return this.solicitudesRepository.find({ order: { creadaEn: 'DESC' } });
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

  async updateEstado(
    id: string,
    dto: UpdateSolicitudStatusDto,
    user: AuthenticatedUser,
  ): Promise<Solicitud> {
    const solicitud = await this.solicitudesRepository.findOne({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    this.assertCanAccess(solicitud, user);
    this.assertValidTransition(solicitud.estado, dto.estado);

    solicitud.estado = dto.estado;

    return this.solicitudesRepository.save(solicitud);
  }

  private resolveAsesor(
    dto: CreateSolicitudDto,
    user: AuthenticatedUser,
  ): string {
    if (user.role === 'asesor') {
      if (dto.asesor && dto.asesor !== user.id) {
        throw new ForbiddenException(
          'Un asesor solo puede registrar solicitudes a su propio nombre',
        );
      }
      return user.id;
    }

    if (!dto.asesor) {
      throw new BadRequestException(
        'El campo asesor es obligatorio para administradores y supervisores',
      );
    }

    if (!this.usersService.isAsesor(dto.asesor)) {
      throw new BadRequestException(
        'El asesor indicado no existe o no tiene el rol asesor',
      );
    }

    return dto.asesor;
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
