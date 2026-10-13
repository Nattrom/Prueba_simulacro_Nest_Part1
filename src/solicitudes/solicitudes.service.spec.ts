import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { UsersService } from '../users/users.service.js';
import { Solicitud } from './entities/solicitud.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { SolicitudesService } from './solicitudes.service.js';

interface MockRepository {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
}

const createEntity = (partial: Partial<Solicitud>): Solicitud =>
  ({
    id: 'generated-id',
    cliente: 'Cliente',
    descripcion: 'Descripcion',
    asesor: 'asesor01',
    estado: EstadoSolicitud.PENDIENTE,
    creadaEn: new Date(),
    actualizadaEn: new Date(),
    ...partial,
  }) as Solicitud;

const buildService = (overrides: Partial<MockRepository> = {}) => {
  const repository: MockRepository = {
    create: jest.fn((input: Partial<Solicitud>) => input as Solicitud),
    save: jest.fn((entity: Solicitud) => Promise.resolve(entity)),
    find: jest.fn(() => Promise.resolve([] as Solicitud[])),
    findOne: jest.fn(() => Promise.resolve(null as Solicitud | null)),
    ...overrides,
  };

  const usersService = {
    findById: jest.fn(),
    findAsesores: jest.fn(() => []),
    isAsesor: jest.fn(() => true),
  };

  const service = new SolicitudesService(
    repository as unknown as Repository<Solicitud>,
    usersService as unknown as UsersService,
  );

  return { service, repository, usersService };
};

describe('SolicitudesService', () => {
  const asesor: AuthenticatedUser = { id: 'asesor01', role: 'asesor' };
  const admin: AuthenticatedUser = { id: 'admin01', role: 'admin' };

  describe('create', () => {
    it('asigna el propio asesor y estado PENDIENTE cuando el usuario es asesor', async () => {
      const { service, repository } = buildService();

      const result = await service.create(
        { cliente: 'Comercial Andina', descripcion: 'Cotizacion' },
        asesor,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          asesor: 'asesor01',
          estado: EstadoSolicitud.PENDIENTE,
        }),
      );
      expect(result.asesor).toBe('asesor01');
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('rechaza cuando un asesor intenta registrar para otro asesor', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          { cliente: 'C', descripcion: 'D', asesor: 'asesor02' },
          asesor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exige el campo asesor a administradores y supervisores', async () => {
      const { service } = buildService();

      await expect(
        service.create({ cliente: 'C', descripcion: 'D' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un asesor inexistente para administradores', async () => {
      const { service, usersService } = buildService();
      usersService.isAsesor.mockReturnValue(false);

      await expect(
        service.create(
          { cliente: 'C', descripcion: 'D', asesor: 'asesor99' },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('permite a un administrador asignar un asesor valido', async () => {
      const { service, repository } = buildService();

      await service.create(
        { cliente: 'C', descripcion: 'D', asesor: 'asesor02' },
        admin,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ asesor: 'asesor02' }),
      );
    });
  });

  describe('findAll', () => {
    it('filtra por asesor en la consulta cuando el usuario es asesor', async () => {
      const { service, repository } = buildService();

      await service.findAll(asesor);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { asesor: 'asesor01' } }),
      );
    });

    it('no filtra por asesor para supervisores y administradores', async () => {
      const { service, repository } = buildService();

      await service.findAll({ id: 'supervisor01', role: 'supervisor' });

      const argument = repository.find.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(argument).not.toHaveProperty('where');
    });
  });

  describe('updateEstado', () => {
    it('persiste una transicion permitida PENDIENTE -> EN_GESTION', async () => {
      const { service, repository } = buildService({
        findOne: jest.fn(() =>
          Promise.resolve(createEntity({ estado: EstadoSolicitud.PENDIENTE })),
        ),
      });

      const result = await service.updateEstado(
        'id',
        { estado: EstadoSolicitud.EN_GESTION },
        asesor,
      );

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
    });

    it('rechaza PENDIENTE -> RESUELTA con conflicto', async () => {
      const { service } = buildService({
        findOne: jest.fn(() =>
          Promise.resolve(createEntity({ estado: EstadoSolicitud.PENDIENTE })),
        ),
      });

      await expect(
        service.updateEstado(
          'id',
          { estado: EstadoSolicitud.RESUELTA },
          asesor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza cualquier transicion desde RESUELTA', async () => {
      const { service } = buildService({
        findOne: jest.fn(() =>
          Promise.resolve(createEntity({ estado: EstadoSolicitud.RESUELTA })),
        ),
      });

      await expect(
        service.updateEstado(
          'id',
          { estado: EstadoSolicitud.EN_GESTION },
          asesor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve no encontrado cuando la solicitud no existe', async () => {
      const { service } = buildService({
        findOne: jest.fn(() => Promise.resolve(null)),
      });

      await expect(
        service.updateEstado(
          'id',
          { estado: EstadoSolicitud.EN_GESTION },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('impide a un asesor modificar el estado de una solicitud ajena', async () => {
      const { service } = buildService({
        findOne: jest.fn(() =>
          Promise.resolve(createEntity({ asesor: 'asesor02' })),
        ),
      });

      await expect(
        service.updateEstado(
          'id',
          { estado: EstadoSolicitud.EN_GESTION },
          asesor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
