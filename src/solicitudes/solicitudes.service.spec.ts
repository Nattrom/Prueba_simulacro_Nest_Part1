import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import type { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { QuerySolicitudesDto } from './dto/query-solicitudes.dto.js';
import type { UsersService } from '../users/users.service.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from './enums/tipo-evento-historial.enum.js';
import { SolicitudesService } from './solicitudes.service.js';

interface MockManager {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface MockQueryBuilder {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  execute: jest.Mock;
}

const createEntity = (partial: Partial<Solicitud>): Solicitud =>
  ({
    id: 'generated-id',
    cliente: 'Cliente',
    descripcion: 'Descripcion',
    asesor: 'asesor01',
    estado: EstadoSolicitud.PENDIENTE,
    version: 1,
    creadaEn: new Date(),
    actualizadaEn: new Date(),
    ...partial,
  }) as Solicitud;

const buildQuery = (
  overrides: Partial<QuerySolicitudesDto> = {},
): QuerySolicitudesDto =>
  ({ page: 1, limit: 10, ...overrides }) as QuerySolicitudesDto;

const buildService = (options: {
  solicitud?: Solicitud | null;
  historial?: SolicitudHistorial[];
  affected?: number;
} = {}) => {
  const queryBuilder: MockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(() =>
      Promise.resolve({ affected: options.affected ?? 1 }),
    ),
  };

  const manager: MockManager = {
    create: jest.fn((_target: unknown, input: object) => ({
      id: 'generated-id',
      ...input,
    })),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    findOne: jest.fn(() => Promise.resolve(options.solicitud ?? null)),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const solicitudesRepository = {
    findOne: jest.fn(() => Promise.resolve(options.solicitud ?? null)),
    findAndCount: jest.fn(() =>
      Promise.resolve([options.historial ?? [], 0]),
    ),
  };

  const historialQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(() => Promise.resolve(options.historial ?? [])),
  };

  const historialRepository = {
    find: jest.fn(() => Promise.resolve(options.historial ?? [])),
    createQueryBuilder: jest.fn(() => historialQueryBuilder),
  };

  const usersService = {
    findById: jest.fn(),
    findAsesores: jest.fn(() => []),
    isAsesor: jest.fn(() => true),
  };

  const dataSource = {
    transaction: jest.fn((callback: (m: MockManager) => unknown) =>
      callback(manager),
    ),
  };

  const service = new SolicitudesService(
    solicitudesRepository as unknown as Repository<Solicitud>,
    historialRepository as unknown as Repository<SolicitudHistorial>,
    usersService as unknown as UsersService,
    dataSource as unknown as DataSource,
  );

  return {
    service,
    manager,
    queryBuilder,
    solicitudesRepository,
    historialRepository,
    historialQueryBuilder,
    usersService,
    dataSource,
  };
};

describe('SolicitudesService', () => {
  const asesor: AuthenticatedUser = { id: 'asesor01', role: 'asesor' };
  const admin: AuthenticatedUser = { id: 'admin01', role: 'admin' };
  const supervisor: AuthenticatedUser = { id: 'supervisor01', role: 'supervisor' };

  describe('create', () => {
    it('asigna el propio asesor, estado PENDIENTE y version 1 cuando el usuario es asesor', async () => {
      const { service, manager } = buildService();

      const result = await service.create(
        { cliente: 'Comercial Andina', descripcion: 'Cotizacion' },
        asesor,
      );

      expect(manager.create).toHaveBeenCalledWith(
        Solicitud,
        expect.objectContaining({
          asesor: 'asesor01',
          estado: EstadoSolicitud.PENDIENTE,
          version: 1,
        }),
      );
      expect(result.asesor).toBe('asesor01');
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('crea la solicitud SIN asignacion cuando el usuario es admin', async () => {
      const { service, manager } = buildService();

      await service.create({ cliente: 'C', descripcion: 'D' }, admin);

      expect(manager.create).toHaveBeenCalledWith(
        Solicitud,
        expect.objectContaining({ asesor: null }),
      );
    });

    it('crea la solicitud SIN asignacion cuando el usuario es supervisor', async () => {
      const { service, manager } = buildService();

      await service.create({ cliente: 'C', descripcion: 'D' }, supervisor);

      expect(manager.create).toHaveBeenCalledWith(
        Solicitud,
        expect.objectContaining({ asesor: null }),
      );
    });

    it('registra el evento CREACION dentro de la transaccion', async () => {
      const { service, manager, dataSource } = buildService();

      await service.create({ cliente: 'C', descripcion: 'D' }, asesor);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.CREACION,
          estadoNuevo: EstadoSolicitud.PENDIENTE,
          usuario: 'asesor01',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('filtra por el propio asesor cuando el usuario es asesor, ignorando el filtro recibido', async () => {
      const { service, solicitudesRepository } = buildService();

      await service.findAll(buildQuery({ asesor: 'asesor02' }), asesor);

      expect(solicitudesRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ asesor: 'asesor01' }),
        }),
      );
    });

    it('aplica los filtros recibidos para admin y supervisor', async () => {
      const { service, solicitudesRepository } = buildService();

      await service.findAll(
        buildQuery({
          estado: EstadoSolicitud.EN_GESTION,
          asesor: 'asesor02',
          cliente: 'Andina',
        }),
        admin,
      );

      const argument = solicitudesRepository.findAndCount.mock
        .calls[0][0] as { where: Record<string, unknown> };
      expect(argument.where.estado).toBe(EstadoSolicitud.EN_GESTION);
      expect(argument.where.asesor).toBe('asesor02');
      expect(argument.where.cliente).toBeDefined();
    });

    it('pagina con skip/take y calcula totalPages', async () => {
      const { service, solicitudesRepository } = buildService();
      solicitudesRepository.findAndCount.mockResolvedValue([
        [createEntity({})],
        25,
      ]);

      const result = await service.findAll(
        { page: 2, limit: 10 } as QuerySolicitudesDto,
        admin,
      );

      expect(solicitudesRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(result.items).toHaveLength(1);
    });

    it('aplica rango de fechas sobre creadaEn', async () => {
      const { service, solicitudesRepository } = buildService();

      await service.findAll(
        buildQuery({
          fechaDesde: '2026-01-01T00:00:00.000Z',
          fechaHasta: '2026-12-31T00:00:00.000Z',
        }),
        admin,
      );

      const argument = solicitudesRepository.findAndCount.mock
        .calls[0][0] as { where: Record<string, unknown> };
      expect(argument.where.creadaEn).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('devuelve no encontrado cuando la solicitud no existe', async () => {
      const { service } = buildService({ solicitud: null });

      await expect(service.findOne('id', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('impide a un asesor consultar una solicitud ajena', async () => {
      const { service } = buildService({
        solicitud: createEntity({ asesor: 'asesor02' }),
      });

      await expect(service.findOne('id', asesor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('historial', () => {
    it('devuelve no encontrado cuando la solicitud no existe', async () => {
      const { service } = buildService({ solicitud: null });

      await expect(service.historial('id', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('impide a un asesor ver el historial de una solicitud ajena', async () => {
      const { service } = buildService({
        solicitud: createEntity({ asesor: 'asesor02' }),
      });

      await expect(service.historial('id', asesor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('consulta los eventos en orden cronologico', async () => {
      const { service, historialQueryBuilder } = buildService({
        solicitud: createEntity({}),
      });

      await service.historial('generated-id', admin);

      expect(historialQueryBuilder.where).toHaveBeenCalledWith(
        'historial.solicitud_id = :solicitudId',
        { solicitudId: 'generated-id' },
      );
      expect(historialQueryBuilder.orderBy).toHaveBeenCalledWith(
        'historial.fecha_evento',
        'ASC',
      );
      expect(historialQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'historial.rowid',
        'ASC',
      );
    });
  });

  describe('asignar', () => {
    it('rechaza un asesor inexistente o sin rol asesor', async () => {
      const { service, usersService } = buildService();
      usersService.isAsesor.mockReturnValue(false);

      await expect(
        service.asignar('id', { asesor: 'asesor99' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devuelve no encontrado cuando la solicitud no existe', async () => {
      const { service } = buildService({ solicitud: null });

      await expect(
        service.asignar('id', { asesor: 'asesor02' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza asignar una solicitud resuelta con conflicto', async () => {
      const { service } = buildService({
        solicitud: createEntity({ estado: EstadoSolicitud.RESUELTA }),
      });

      await expect(
        service.asignar('id', { asesor: 'asesor02' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('asigna un nuevo asesor y registra el evento ASIGNACION', async () => {
      const { service, manager } = buildService({
        solicitud: createEntity({ asesor: null }),
      });

      const result = await service.asignar(
        'generated-id',
        { asesor: 'asesor02' },
        supervisor,
      );

      expect(result.asesor).toBe('asesor02');
      expect(manager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.ASIGNACION,
          asesorAnterior: null,
          asesorNuevo: 'asesor02',
        }),
      );
    });

    it('no produce cambios cuando el asesor coincide con el actual', async () => {
      const { service, manager } = buildService({
        solicitud: createEntity({ asesor: 'asesor02' }),
      });

      await service.asignar('generated-id', { asesor: 'asesor02' }, admin);

      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.create).not.toHaveBeenCalled();
    });
  });

  describe('updateEstado', () => {
    const base = {
      estado: EstadoSolicitud.EN_GESTION,
      versionEsperada: 1,
    };

    it('persiste una transicion permitida e incrementa la version', async () => {
      const entity = createEntity({ estado: EstadoSolicitud.PENDIENTE });
      const { service, manager, queryBuilder } = buildService({
        solicitud: entity,
      });
      manager.findOne
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(
          createEntity({ estado: EstadoSolicitud.EN_GESTION, version: 2 }),
        );

      const result = await service.updateEstado('generated-id', base, asesor);

      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoSolicitud.EN_GESTION }),
      );
      expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
      expect(manager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.ESTADO,
          estadoAnterior: EstadoSolicitud.PENDIENTE,
          estadoNuevo: EstadoSolicitud.EN_GESTION,
        }),
      );
    });

    it('rechaza con conflicto una version desactualizada', async () => {
      const { service } = buildService({
        solicitud: createEntity({ estado: EstadoSolicitud.PENDIENTE, version: 3 }),
      });

      await expect(
        service.updateEstado('generated-id', base, asesor),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza con conflicto cuando la actualizacion condicional no afecta filas', async () => {
      const entity = createEntity({ estado: EstadoSolicitud.PENDIENTE });
      const { service } = buildService({ solicitud: entity, affected: 0 });

      await expect(
        service.updateEstado('generated-id', base, asesor),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza una transicion prohibida con conflicto', async () => {
      const { service } = buildService({
        solicitud: createEntity({ estado: EstadoSolicitud.PENDIENTE }),
      });

      await expect(
        service.updateEstado(
          'generated-id',
          { estado: EstadoSolicitud.RESUELTA, versionEsperada: 1 },
          asesor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve no encontrado cuando la solicitud no existe', async () => {
      const { service } = buildService({ solicitud: null });

      await expect(
        service.updateEstado('generated-id', base, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('impide a un asesor modificar una solicitud ajena', async () => {
      const { service } = buildService({
        solicitud: createEntity({ asesor: 'asesor02' }),
      });

      await expect(
        service.updateEstado('generated-id', base, asesor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
