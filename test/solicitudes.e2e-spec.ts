import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupSwagger } from '../src/config/swagger.config.js';
import { Solicitud } from '../src/solicitudes/entities/solicitud.entity.js';
import { EstadoSolicitud } from '../src/solicitudes/enums/estado-solicitud.enum.js';

const KEY_ONE = 'clave-demo-uno';
const KEY_TWO = 'clave-demo-dos';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

let app: INestApplication;
let repository: Repository<Solicitud>;

const api = () => request(app.getHttpServer());

const postSolicitud = (
  body: Record<string, unknown>,
  user: string,
  key = KEY_ONE,
) =>
  api().post('/solicitudes').set('x-api-key', key).set('x-user', user).send(body);

const getList = (user: string, key = KEY_ONE) =>
  api().get('/solicitudes').set('x-api-key', key).set('x-user', user);

const getOne = (id: string, user: string) =>
  api()
    .get(`/solicitudes/${id}`)
    .set('x-api-key', KEY_ONE)
    .set('x-user', user);

const patchEstado = (id: string, estado: EstadoSolicitud, user: string) =>
  api()
    .patch(`/solicitudes/${id}/estado`)
    .set('x-api-key', KEY_ONE)
    .set('x-user', user)
    .send({ estado });

const seed = async (user: string, asesor?: string): Promise<Solicitud> => {
  const response = await postSolicitud(
    {
      cliente: `Cliente de ${user}`,
      descripcion: 'Seguimiento comercial',
      ...(asesor ? { asesor } : {}),
    },
    user,
  );
  return response.body.data as Solicitud;
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
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await repository.clear();
});

describe('Seguridad (RN-07 / API Key y usuario)', () => {
  it('1. rechaza una peticion sin API Key', async () => {
    const response = await api().get('/solicitudes').set('x-user', 'admin01');
    expect(response.status).toBe(401);
  });

  it('2. rechaza una peticion con API Key invalida', async () => {
    const response = await getList('admin01', 'clave-invalida');
    expect(response.status).toBe(401);
  });

  it('3. permite el acceso con dos API Keys distintas configuradas', async () => {
    expect((await getList('admin01', KEY_ONE)).status).toBe(200);
    expect((await getList('admin01', KEY_TWO)).status).toBe(200);
  });

  it('4. rechaza un usuario inexistente', async () => {
    const response = await getList('usuario-fantasma');
    expect(response.status).toBe(401);
  });
});

describe('Registro de solicitudes (RN-01)', () => {
  it('5. registra una solicitud valida con estado PENDIENTE', async () => {
    const response = await postSolicitud(
      { cliente: 'Comercial Andina', descripcion: 'Cotizacion de equipos' },
      'asesor01',
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(response.body.data.asesor).toBe('asesor01');
    expect(response.body.data.id).toBeDefined();
  });

  it('6. no permite sobrescribir campos protegidos', async () => {
    const response = await postSolicitud(
      {
        cliente: 'C',
        descripcion: 'D',
        id: UNKNOWN_UUID,
        estado: EstadoSolicitud.RESUELTA,
        creadaEn: '2000-01-01T00:00:00.000Z',
      },
      'asesor01',
    );

    expect(response.status).toBe(400);
  });

  it('obliga a indicar asesor a administradores y supervisores', async () => {
    expect(
      (await postSolicitud({ cliente: 'C', descripcion: 'D' }, 'admin01'))
        .status,
    ).toBe(400);
    expect(
      (await postSolicitud({ cliente: 'C', descripcion: 'D' }, 'supervisor01'))
        .status,
    ).toBe(400);
  });

  it('rechaza un asesor inexistente o sin rol asesor', async () => {
    const response = await postSolicitud(
      { cliente: 'C', descripcion: 'D', asesor: 'asesor99' },
      'admin01',
    );
    expect(response.status).toBe(400);
  });

  it('impide que un asesor registre a nombre de otro asesor', async () => {
    const response = await postSolicitud(
      { cliente: 'C', descripcion: 'D', asesor: 'asesor02' },
      'asesor01',
    );
    expect(response.status).toBe(403);
  });
});

describe('Consulta de solicitudes (RN-02)', () => {
  beforeEach(async () => {
    await seed('admin01', 'asesor01');
    await seed('admin01', 'asesor02');
  });

  it('7. un asesor consulta unicamente sus propias solicitudes', async () => {
    const response = await getList('asesor01');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].asesor).toBe('asesor01');
  });

  it('8. un supervisor consulta todas las solicitudes', async () => {
    const response = await getList('supervisor01');
    expect(response.body.data).toHaveLength(2);
  });

  it('9. un administrador consulta todas las solicitudes', async () => {
    const response = await getList('admin01');
    expect(response.body.data).toHaveLength(2);
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

describe('Cambio de estado (RN-04)', () => {
  it('12. persiste una transicion permitida', async () => {
    const solicitud = await seed('asesor01');

    const first = await patchEstado(
      solicitud.id,
      EstadoSolicitud.EN_GESTION,
      'asesor01',
    );
    expect(first.status).toBe(200);
    expect(first.body.data.estado).toBe(EstadoSolicitud.EN_GESTION);

    const second = await patchEstado(
      solicitud.id,
      EstadoSolicitud.RESUELTA,
      'asesor01',
    );
    expect(second.status).toBe(200);
    expect(second.body.data.estado).toBe(EstadoSolicitud.RESUELTA);

    const verify = await getOne(solicitud.id, 'asesor01');
    expect(verify.body.data.estado).toBe(EstadoSolicitud.RESUELTA);
  });

  it('13. una transicion prohibida PENDIENTE -> RESUELTA devuelve 409', async () => {
    const solicitud = await seed('asesor01');
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.RESUELTA,
      'asesor01',
    );
    expect(response.status).toBe(409);
  });

  it('rechaza EN_GESTION -> PENDIENTE con 409', async () => {
    const solicitud = await seed('asesor01');
    await patchEstado(solicitud.id, EstadoSolicitud.EN_GESTION, 'asesor01');
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.PENDIENTE,
      'asesor01',
    );
    expect(response.status).toBe(409);
  });

  it('11. un asesor no puede cambiar el estado de una solicitud ajena', async () => {
    const solicitud = await seed('admin01', 'asesor02');
    const response = await patchEstado(
      solicitud.id,
      EstadoSolicitud.EN_GESTION,
      'asesor01',
    );
    expect(response.status).toBe(403);
  });

  it('devuelve 404 al cambiar el estado de una solicitud inexistente', async () => {
    const response = await patchEstado(
      UNKNOWN_UUID,
      EstadoSolicitud.EN_GESTION,
      'admin01',
    );
    expect(response.status).toBe(404);
  });
});

describe('Validacion de datos (RN-05)', () => {
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
      .send({ estado: 'ESTADO_INVALIDO' });
    expect(response.status).toBe(400);
  });
});

describe('Formato de respuestas (RN-06)', () => {
  it('16. las respuestas exitosas usan el formato uniforme', async () => {
    const response = await getList('admin01');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: expect.any(Array) });
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
