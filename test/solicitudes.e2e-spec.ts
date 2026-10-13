import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupSwagger } from '../src/config/swagger.config.js';
import { SolicitudHistorial } from '../src/solicitudes/entities/solicitud-historial.entity.js';
import { Solicitud } from '../src/solicitudes/entities/solicitud.entity.js';
import { EstadoSolicitud } from '../src/solicitudes/enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from '../src/solicitudes/enums/tipo-evento-historial.enum.js';
import { SolicitudesService } from '../src/solicitudes/solicitudes.service.js';

const KEY_ONE = 'clave-demo-uno';
const KEY_TWO = 'clave-demo-dos';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

let app: INestApplication;
let repository: Repository<Solicitud>;
let historialRepository: Repository<SolicitudHistorial>;
let solicitudesService: SolicitudesService;

const api = () => request(app.getHttpServer());

const postSolicitud = (
  body: Record<string, unknown>,
  user: string,
  key = KEY_ONE,
) =>
  api().post('/solicitudes').set('x-api-key', key).set('x-user', user).send(body);

const getList = (user: string, query = '', key = KEY_ONE) =>
  api().get(`/solicitudes${query}`).set('x-api-key', key).set('x-user', user);

const getOne = (id: string, user: string, key = KEY_ONE) =>
  api().get(`/solicitudes/${id}`).set('x-api-key', key).set('x-user', user);

const getHistorial = (id: string, user: string, key = KEY_ONE) =>
  api()
    .get(`/solicitudes/${id}/historial`)
    .set('x-api-key', key)
    .set('x-user', user);

const patchEstado = (
  id: string,
  estado: EstadoSolicitud,
  user: string,
  versionEsperada: number,
  key = KEY_ONE,
) =>
  api()
    .patch(`/solicitudes/${id}/estado`)
    .set('x-api-key', key)
    .set('x-user', user)
    .send({ estado, versionEsperada });

const patchAsignacion = (
  id: string,
  asesor: string,
  user: string,
  key = KEY_ONE,
) =>
  api()
    .patch(`/solicitudes/${id}/asignacion`)
    .set('x-api-key', key)
    .set('x-user', user)
    .send({ asesor });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const seed = async (user: string, asesor?: string): Promise<Solicitud> => {
  const created = await postSolicitud(
    { cliente: `Cliente de ${user}`, descripcion: 'Seguimiento comercial' },
    user,
  );
  let solicitud = created.body.data as Solicitud;

  if (asesor && solicitud.asesor !== asesor) {
    const assigned = await patchAsignacion(solicitud.id, asesor, user);
    solicitud = assigned.body.data as Solicitud;
  }

  return solicitud;
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  setupSwagger(app);
  await app.init();

  repository = moduleRef.get<Repository<Solicitud>>(
    getRepositoryToken(Solicitud),
  );
  historialRepository = moduleRef.get<Repository<SolicitudHistorial>>(
    getRepositoryToken(SolicitudHistorial),
  );
  solicitudesService = moduleRef.get(SolicitudesService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await historialRepository.clear();
  await repository.clear();
});

describe('Seguridad (RN-07 / API Key y usuario)', () => {
  it('1. rechaza una peticion sin API Key', async () => {
    const response = await api().get('/solicitudes').set('x-user', 'admin01');
    expect(response.status).toBe(401);
  });

  it('2. rechaza una peticion con API Key invalida', async () => {
    const response = await getList('admin01', '', 'clave-invalida');
    expect(response.status).toBe(401);
  });

  it('3. permite el acceso con dos API Keys distintas configuradas', async () => {
    expect((await getList('admin01', '', KEY_ONE)).status).toBe(200);
    expect((await getList('admin01', '', KEY_TWO)).status).toBe(200);
  });

  it('4. rechaza un usuario inexistente', async () => {
    const response = await getList('usuario-fantasma');
    expect(response.status).toBe(401);
  });
});

describe('Registro de solicitudes (RN-01 / RN-09)', () => {
  it('5. un asesor registra y la solicitud queda asignada a si mismo', async () => {
    const response = await postSolicitud(
      { cliente: 'Comercial Andina', descripcion: 'Cotizacion de equipos' },
      'asesor01',
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(response.body.data.asesor).toBe('asesor01');
    expect(response.body.data.version).toBe(1);
    expect(response.body.data.id).toBeDefined();
  });

  it('5b. un admin registra SIN asignacion', async () => {
    const response = await postSolicitud(
      { cliente: 'C', descripcion: 'D' },
      'admin01',
    );
    expect(response.status).toBe(201);
    expect(response.body.data.asesor).toBeNull();
  });

  it('5c. un supervisor registra SIN asignacion', async () => {
    const response = await postSolicitud(
      { cliente: 'C', descripcion: 'D' },
      'supervisor01',
    );
    expect(response.status).toBe(201);
    expect(response.body.data.asesor).toBeNull();
  });

  it('6. no permite sobrescribir campos protegidos', async () => {
    const response = await postSolicitud(
      {
        cliente: 'C',
        descripcion: 'D',
        id: UNKNOWN_UUID,
        estado: EstadoSolicitud.RESUELTA,
        version: 99,
        creadaEn: '2000-01-01T00:00:00.000Z',
      },
      'asesor01',
    );

    expect(response.status).toBe(400);
  });

  it('6b. rechaza el campo asesor en el registro (la asignacion es via RN-07)', async () => {
    const response = await postSolicitud(
      { cliente: 'C', descripcion: 'D', asesor: 'asesor02' },
      'asesor01',
    );
    expect(response.status).toBe(400);
  });
});

describe('Consulta de solicitudes (RN-02 / RN-08)', () => {
  beforeEach(async () => {
    await seed('admin01', 'asesor01');
    await seed('admin01', 'asesor02');
  });

  it('7. un asesor consulta unicamente sus propias solicitudes', async () => {
    const response = await getList('asesor01');
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].asesor).toBe('asesor01');
  });

  it('8. un supervisor consulta todas las solicitudes', async () => {
    const response = await getList('supervisor01');
    expect(response.body.data.items).toHaveLength(2);
  });

  it('9. un administrador consulta todas las solicitudes', async () => {
    const response = await getList('admin01');
    expect(response.body.data.items).toHaveLength(2);
  });

  it('9b. devuelve el formato paginado con metadatos', async () => {
    const response = await getList('admin01', '?page=1&limit=10');
    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('RN-08: filtra por estado', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    await patchEstado(solicitud.id, EstadoSolicitud.EN_GESTION, 'admin01', 1);

    const response = await getList(
      'admin01',
      `?estado=${EstadoSolicitud.EN_GESTION}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].estado).toBe(
      EstadoSolicitud.EN_GESTION,
    );
  });

  it('RN-08: filtra por asesor', async () => {
    const response = await getList(
      'admin01',
      '?asesor=asesor02',
    );
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].asesor).toBe('asesor02');
  });

  it('RN-08: filtra por coincidencia parcial de cliente', async () => {
    const response = await getList('admin01', '?cliente=Cliente%20de%20admin01');
    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('RN-08: pagina los resultados', async () => {
    const response = await getList('admin01', '?page=2&limit=1');
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('RN-08: un asesor no puede ampliar su visibilidad con el filtro asesor', async () => {
    const response = await getList('asesor01', '?asesor=asesor02');
    expect(response.status).toBe(200);
    expect(
      response.body.data.items.every(
        (item: Solicitud) => item.asesor === 'asesor01',
      ),
    ).toBe(true);
  });

  it('RN-08: rechaza page invalido', async () => {
    expect((await getList('admin01', '?page=0')).status).toBe(400);
    expect((await getList('admin01', '?limit=101')).status).toBe(400);
  });
});

describe('Consulta individual (RN-03)', () => {
  it('10. un asesor no puede consultar una solicitud ajena', async () => {
    const solicitud = await seed('admin01', 'asesor02');
    const response = await getOne(solicitud.id, 'asesor01');
    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
  });

  it('14. una solicitud inexistente devuelve 404', async () => {
    const response = await getOne(UNKNOWN_UUID, 'admin01');
    expect(response.status).toBe(404);
  });

  it('administradores y supervisores consultan cualquier solicitud', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    expect((await getOne(solicitud.id, 'admin01')).status).toBe(200);
    expect((await getOne(solicitud.id, 'supervisor01')).status).toBe(200);
  });
});

describe('Asignacion y reasignacion (RN-07)', () => {
  it('19. un admin asigna una solicitud sin asignacion', async () => {
    const created = await postSolicitud(
      { cliente: 'C', descripcion: 'D' },
      'admin01',
    );
    const response = await patchAsignacion(
      created.body.data.id,
      'asesor02',
      'admin01',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.asesor).toBe('asesor02');
  });

  it('20. un supervisor reasigna a otro asesor', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    const response = await patchAsignacion(
      solicitud.id,
      'asesor02',
      'supervisor01',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.asesor).toBe('asesor02');
  });

  it('21. un asesor no puede asignar (403)', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    const response = await patchAsignacion(
      solicitud.id,
      'asesor02',
      'asesor01',
    );
    expect(response.status).toBe(403);
  });

  it('22. rechaza un asesor inexistente', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    const response = await patchAsignacion(
      solicitud.id,
      'asesor99',
      'admin01',
    );
    expect(response.status).toBe(400);
  });

  it('23. una solicitud inexistente devuelve 404', async () => {
    const response = await patchAsignacion(
      UNKNOWN_UUID,
      'asesor02',
      'admin01',
    );
    expect(response.status).toBe(404);
  });

  it('24. no permite asignar una solicitud resuelta (409)', async () => {
    const solicitud = await seed('asesor01');
    await patchEstado(solicitud.id, EstadoSolicitud.EN_GESTION, 'asesor01', 1);
    await patchEstado(solicitud.id, EstadoSolicitud.RESUELTA, 'asesor01', 2);

    const response = await patchAsignacion(
      solicitud.id,
      'asesor02',
      'admin01',
    );
    expect(response.status).toBe(409);
  });

  it('25. asignar al mismo asesor no produce cambios ni historial', async () => {
    const solicitud = await seed('admin01', 'asesor01');
    const before = await getHistorial(solicitud.id, 'admin01');

    const response = await patchAsignacion(
      solicitud.id,
      'asesor01',
      'admin01',
    );
    expect(response.status).toBe(200);

    const after = await getHistorial(solicitud.id, 'admin01');
    expect(after.body.data).toHaveLength(before.body.data.length);
  });
});

describe('Cambio de estado (RN-04 / RN-10)', () => {
  it('12. persiste una transicion permitida e incrementa la version', async () => {
    const solicitud = await seed('asesor01');
    expect(solicitud.version).toBe(1);

    const first = await patchEstado(
      solicitud.id,
      EstadoSolicitud.EN_GESTION,
      'asesor01',
      1,
    );
    expect(first.status).toBe(200);
    expect(first.body.data.estado).toBe(EstadoSolicitud.EN_GESTION);
    expect(first.body.data.version).toBe(2);

    const second = await patchEstado(
      solicitud.id,
      EstadoSolicitud.RESUELTA,
      'asesor01',
      2,
    );
    expect(second.status).toBe(200);
    expect(second.body.data.estado).toBe(EstadoSolicitud.RESUELTA);
    expect(second.body.data.version).toBe(3);
  });

  it('13. una transicion prohibida PENDIENTE -> RESUELTA devuelve 409', async () => {
    const solicitud = await seed('asesor01');
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.RESUELTA,
      'asesor01',
      1,
    );
    expect(response.status).toBe(409);
  });

  it('rechaza EN_GESTION -> PENDIENTE con 409', async () => {
    const solicitud = await seed('asesor01');
    await patchEstado(solicitud.id, EstadoSolicitud.EN_GESTION, 'asesor01', 1);
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.PENDIENTE,
      'asesor01',
      2,
    );
    expect(response.status).toBe(409);
  });

  it('11. un asesor no puede cambiar el estado de una solicitud ajena', async () => {
    const solicitud = await seed('admin01', 'asesor02');
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.EN_GESTION,
      'asesor01',
      1,
    );
    expect(response.status).toBe(403);
  });

  it('devuelve 404 al cambiar el estado de una solicitud inexistente', async () => {
    const response = await patchEstado(
      UNKNOWN_UUID,
      EstadoSolicitud.EN_GESTION,
      'admin01',
      1,
    );
    expect(response.status).toBe(404);
  });

  it('RN-10: rechaza una versionEsperada desactualizada con 409', async () => {
    const solicitud = await seed('asesor01');
    await patchEstado(solicitud.id, EstadoSolicitud.EN_GESTION, 'asesor01', 1);

    const stale = await patchEstado(
      solicitud.id,
      EstadoSolicitud.RESUELTA,
      'asesor01',
      1,
    );
    expect(stale.status).toBe(409);

    const verify = await getOne(solicitud.id, 'asesor01');
    expect(verify.body.data.estado).toBe(EstadoSolicitud.EN_GESTION);
    expect(verify.body.data.version).toBe(2);
  });

  it('RN-10: exige versionEsperada en el cuerpo', async () => {
    const solicitud = await seed('asesor01');
    const response = await api()
      .patch(`/solicitudes/${solicitud.id}/estado`)
      .set('x-api-key', KEY_ONE)
      .set('x-user', 'asesor01')
      .send({ estado: EstadoSolicitud.EN_GESTION });
    expect(response.status).toBe(400);
  });
});

describe('Historial de auditoria (RN-09)', () => {
  it('26. registra el evento CREACION', async () => {
    const solicitud = await seed('asesor01');
    const response = await getHistorial(solicitud.id, 'asesor01');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].tipoEvento).toBe(
      TipoEventoHistorial.CREACION,
    );
    expect(response.body.data[0].estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
    expect(response.body.data[0].usuario).toBe('asesor01');
  });

  it('27. acumula CREACION, ASIGNACION y ESTADO en orden cronologico', async () => {
    const created = await postSolicitud(
      { cliente: 'C', descripcion: 'D' },
      'admin01',
    );
    const id = created.body.data.id as string;

    await delay(5);
    await patchAsignacion(id, 'asesor01', 'admin01');
    await delay(5);
    await patchEstado(id, EstadoSolicitud.EN_GESTION, 'asesor01', 1);

    const response = await getHistorial(id, 'admin01');
    expect(response.status).toBe(200);
    expect(
      response.body.data.map(
        (evento: SolicitudHistorial) => evento.tipoEvento,
      ),
    ).toEqual([
      TipoEventoHistorial.CREACION,
      TipoEventoHistorial.ASIGNACION,
      TipoEventoHistorial.ESTADO,
    ]);
  });

  it('28. un asesor no puede ver el historial de una solicitud ajena', async () => {
    const solicitud = await seed('admin01', 'asesor02');
    const response = await getHistorial(solicitud.id, 'asesor01');
    expect(response.status).toBe(403);
  });

  it('29. una solicitud inexistente devuelve 404', async () => {
    const response = await getHistorial(UNKNOWN_UUID, 'admin01');
    expect(response.status).toBe(404);
  });

  it('30. revierte la transicion si falla el registro del historial', async () => {
    const solicitud = await seed('asesor01');

    const spy = jest.spyOn(
      solicitudesService as unknown as {
        registrarHistorial: (...args: unknown[]) => Promise<unknown>;
      },
      'registrarHistorial',
    );
    spy.mockRejectedValueOnce(new Error('fallo de auditoria'));

    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.EN_GESTION,
      'asesor01',
      1,
    );
    expect(response.status).toBe(500);

    spy.mockRestore();

    const verify = await getOne(solicitud.id, 'asesor01');
    expect(verify.body.data.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(verify.body.data.version).toBe(1);

    const historial = await getHistorial(solicitud.id, 'asesor01');
    const tipos = historial.body.data.map(
      (evento: SolicitudHistorial) => evento.tipoEvento,
    );
    expect(tipos).not.toContain(TipoEventoHistorial.ESTADO);
  });
});

describe('Validacion de datos (RN-05 / RN-11)', () => {
  it('15a. rechaza cliente vacio o con solo espacios', async () => {
    const response = await postSolicitud(
      { cliente: '   ', descripcion: 'D' },
      'asesor01',
    );
    expect(response.status).toBe(400);
  });

  it('15b. rechaza la descripcion ausente', async () => {
    const response = await postSolicitud({ cliente: 'C' }, 'asesor01');
    expect(response.status).toBe(400);
  });

  it('15c. rechaza un estado invalido en la actualizacion', async () => {
    const solicitud = await seed('asesor01');
    const response = await api()
      .patch(`/solicitudes/${solicitud.id}/estado`)
      .set('x-api-key', KEY_ONE)
      .set('x-user', 'asesor01')
      .send({ estado: 'ESTADO_INVALIDO', versionEsperada: 1 });
    expect(response.status).toBe(400);
  });

  it('RN-11: normaliza el cliente recortando y colapsando espacios', async () => {
    const response = await postSolicitud(
      { cliente: '  Comercial    Andina   S.A.  ', descripcion: '  D  ' },
      'asesor01',
    );

    expect(response.status).toBe(201);
    expect(response.body.data.cliente).toBe('Comercial Andina S.A.');
    expect(response.body.data.descripcion).toBe('D');
  });
});

describe('Formato de respuestas (RN-06)', () => {
  it('16. las respuestas exitosas usan el formato uniforme', async () => {
    const response = await getList('admin01');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual(expect.any(Array));
    expect(response.body.data.pagination).toEqual(expect.any(Object));
  });

  it('17. los errores conservan el codigo HTTP y el formato normalizado', async () => {
    const response = await getList('usuario-fantasma');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, statusCode: 401 });
    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body.path).toBe('/solicitudes');
  });
});

describe('Swagger', () => {
  it('18. esta disponible y describe los encabezados requeridos', async () => {
    const ui = await api().get('/api/docs');
    expect(ui.status).toBe(200);

    const document = await api().get('/api/docs-json');
    expect(document.status).toBe(200);
    expect(document.body.components.securitySchemes['x-api-key']).toMatchObject({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    });
    expect(JSON.stringify(document.body)).toContain('x-user');
  });
});
