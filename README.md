# API REST de Solicitudes Comerciales (NestJS + TypeORM + SQLite)

API REST interna para administrar **solicitudes de seguimiento comercial** realizadas por asesores. Permite registrar solicitudes, consultarlas segun el rol y gestionar su estado respetando reglas de negocio y transiciones controladas.

La proteccion de los endpoints se realiza con el encabezado `x-api-key` y la identificacion academica con `x-user`, resuelto contra un catalogo de usuarios de prueba en memoria. **No** se implementa JWT, contrasenas, frontend ni integraciones externas.

---

## 1. Objetivo de la prueba

Disenar e implementar una API REST funcional, segura dentro del alcance academico, mantenible y documentada, aplicando NestJS, TypeScript, TypeORM, SQLite, DTO con validacion, guards, decoradores personalizados, interceptor, exception filter, Swagger y pruebas automatizadas con Jest.

Se prioriza la **correccion de las reglas de negocio, la autorizacion, la persistencia real y las pruebas**.

---

## 2. Tecnologias utilizadas

| Tecnologia | Version | Uso |
| --- | --- | --- |
| Node.js | >= 20 (probado en 24.19.0) | Entorno de ejecucion |
| NestJS | 12.1.x | Framework backend (modular) |
| TypeScript | 6.0.x | Lenguaje |
| TypeORM | 1.1.2 | ORM / persistencia |
| better-sqlite3 | 12.11.x | Driver SQLite (usado por TypeORM 1.x) |
| class-validator / class-transformer | 0.15.x / 0.5.x | Validacion y transformacion de DTO |
| @nestjs/swagger | 12.0.x | Documentacion OpenAPI |
| Jest / ts-jest | 30.x / 29.4.x | Pruebas unitarias y e2e |
| supertest | 7.x | Peticiones HTTP en pruebas e2e |

> **Nota de compatibilidad:** NestJS 12 se publica como **ESM** (`"type": "module"`). Por eso el proyecto usa `module`/`moduleResolution` `node16`, los imports relativos terminan en `.js`, y Jest se ejecuta en modo ESM (`--experimental-vm-modules`) con `ts-jest` (`useESM: true`). No se mezclan configuraciones CommonJS y ESM.

---

## 3. Requisitos previos

- Node.js 20 o superior (se verifico con Node 24.19.0).
- npm 10 o superior.
- No se requiere una base de datos externa: SQLite se crea como archivo local.

---

## 4. Instalacion

```bash
npm install
```

`better-sqlite3` es un modulo nativo; npm descarga un binario precompilado para Node 20/22/24. Si no estuviera disponible para tu plataforma, requerira herramientas de compilacion (Python + Visual Studio Build Tools en Windows, `build-essential` en Linux).

---

## 5. Configuracion de variables de entorno

1. Copia el archivo de ejemplo:

```powershell
Copy-Item .env.example .env
```

En Linux/macOS:

```bash
cp .env.example .env
```

2. Contenido de `.env.example`:

```dotenv
PORT=3000
NODE_ENV=development
API_KEYS=clave-demo-uno,clave-demo-dos
DATABASE_PATH=data/solicitudes.sqlite
```

| Variable | Descripcion |
| --- | --- |
| `PORT` | Puerto HTTP (por defecto `3000`). |
| `NODE_ENV` | Entorno. En `production` la sincronizacion automatica del esquema se desactiva. |
| `API_KEYS` | Claves validas separadas por comas. Se recortan espacios y se ignoran valores vacios. **Obligatoria**: sin claves, los endpoints funcionales quedan cerrados. |
| `DATABASE_PATH` | Ruta del archivo SQLite (por defecto `data/solicitudes.sqlite`). |

El archivo `.env` real **no** se versiona (ver `.gitignore`). Las claves de ejemplo son ficticias y solo sirven para pruebas locales.

---

## 6. Inicializacion de la base de datos

En desarrollo, TypeORM crea/actualiza el esquema automaticamente (`synchronize: true`) al arrancar, usando el archivo indicado en `DATABASE_PATH`. El directorio `data/` se crea automaticamente o existe en el proyecto.

En `NODE_ENV=production` la sincronizacion automatica se **desactiva** (requisito de seguridad). Para entornos reales se recomienda usar migraciones de TypeORM.

Las pruebas usan una base **en memoria** (`:memory:`), por lo que **no** tocan los datos locales de desarrollo.

---

## 7. Comandos de desarrollo y produccion

```bash
# Desarrollo con recarga en caliente
npm run start:dev

# Compilar a dist/
npm run build

# Ejecutar la version compilada
npm run start:prod

# Formateo
npm run format

# Lint
npm run lint
```

---

## 8. Estructura del proyecto

```
src/
├── main.ts                        # Bootstrap: Swagger y arranque
├── app.module.ts                  # Modulo raiz: config, TypeORM, pipe/interceptor/filter globales
├── config/
│   ├── configuration.ts           # Lectura centralizada de variables de entorno
│   └── swagger.config.ts          # Configuracion reutilizable de Swagger
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts     # @Roles(...)
│   │   └── current-user.decorator.ts  # @CurrentUser()
│   ├── guards/
│   │   ├── api-key.guard.ts       # Valida x-api-key
│   │   ├── user.guard.ts          # Resuelve x-user contra el catalogo
│   │   └── roles.guard.ts         # Autoriza por rol
│   ├── interceptors/
│   │   └── response.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interfaces/
│   │   ├── authenticated-user.interface.ts
│   │   └── pagination.interface.ts
│   ├── utils/
│   │   └── normalize-text.ts      # Normalizacion de texto (RN-11)
│   └── types/
│       └── user-role.type.ts
├── users/
│   ├── users.module.ts
│   └── users.service.ts           # Catalogo de usuarios de prueba
└── solicitudes/
    ├── solicitudes.module.ts
    ├── solicitudes.controller.ts
    ├── solicitudes.service.ts
    ├── entities/
    │   ├── solicitud.entity.ts
    │   └── solicitud-historial.entity.ts  # Auditoria persistente (RN-09)
    ├── enums/
    │   ├── estado-solicitud.enum.ts
    │   └── tipo-evento-historial.enum.ts
    └── dto/
        ├── create-solicitud.dto.ts
        ├── update-solicitud-status.dto.ts
        ├── asignar-solicitud.dto.ts
        └── query-solicitudes.dto.ts
test/
├── jest-e2e.json
├── setup-env.ts
└── solicitudes.e2e-spec.ts
```

---

## 9. Endpoints disponibles

Todos los endpoints funcionales exigen `x-api-key` y `x-user`.

| Metodo | Ruta | Descripcion | Roles |
| --- | --- | --- | --- |
| `POST` | `/solicitudes` | Registrar una solicitud | `admin`, `supervisor`, `asesor` |
| `GET` | `/solicitudes` | Consultar solicitudes (filtros + paginacion) | `admin`, `supervisor`, `asesor` |
| `GET` | `/solicitudes/:id` | Consultar una solicitud | `admin`, `supervisor`, `asesor` |
| `GET` | `/solicitudes/:id/historial` | Consultar el historial de auditoria | `admin`, `supervisor`, `asesor` |
| `PATCH` | `/solicitudes/:id/asignacion` | Asignar / reasignar asesor | `admin`, `supervisor` |
| `PATCH` | `/solicitudes/:id/estado` | Cambiar el estado (con version) | `admin`, `supervisor`, `asesor` |
| `GET` | `/api/docs` | Documentacion Swagger (ruta **deliberadamente no protegida**) | publica |

La unica ruta excluida de los guards es `/api/docs`, para que el evaluador pueda consultar la documentacion. La excepcion se limita estrictamente a esa ruta.

Parametros de consulta de `GET /solicitudes` (todos opcionales):

| Parametro | Descripcion |
| --- | --- |
| `estado` | Filtra por estado exacto (`PENDIENTE`, `EN_GESTION`, `RESUELTA`). |
| `asesor` | Filtra por asesor. Un `asesor` autenticado siempre queda restringido a su propio identificador. |
| `cliente` | Coincidencia parcial (case-insensitive) sobre el nombre del cliente. |
| `fechaDesde` / `fechaHasta` | Rango (ISO 8601) sobre `creadaEn`. |
| `page` | Numero de pagina (desde 1). Por defecto `1`. |
| `limit` | Registros por pagina (1 a 100). Por defecto `10`. |

La respuesta paginada usa el formato `{ items, pagination: { page, limit, total, totalPages } }`.

---

## 10. Reglas de negocio

### RN-01. Registro (`POST /solicitudes`)
- Cualquier usuario identificado puede registrar.
- El estado inicial es **siempre** `PENDIENTE` (aunque el cliente intente otro).
- Si el usuario es `asesor`, la solicitud se asigna **automaticamente** a su propio identificador.
- Si el usuario es `admin`/`supervisor`, la solicitud se crea **SIN asignacion** (`asesor: null`); su asignacion se realiza despues con `PATCH /solicitudes/:id/asignacion` (RN-07).
- El campo `asesor` **no** se acepta en el cuerpo del registro (el DTO lo rechaza con HTTP 400).
- El DTO no permite `id`, `estado`, `version`, `creadaEn` ni `actualizadaEn`; propiedades adicionales producen HTTP 400.

### RN-02. Consulta de solicitudes (`GET /solicitudes`)
- `admin` y `supervisor`: todas las solicitudes.
- `asesor`: solo las propias, con filtro aplicado **en la consulta TypeORM** (`where: { asesor }`), nunca filtrando en memoria.
- Devuelve una estructura paginada `{ items, pagination }`.

### RN-03. Consulta individual (`GET /solicitudes/:id`)
- `admin` y `supervisor`: cualquier solicitud.
- `asesor`: solo las propias; si es ajena, HTTP 403 **sin revelar datos**.
- Si no existe, HTTP 404.

### RN-04. Cambio de estado (`PATCH /solicitudes/:id/estado`)
- `admin` y `supervisor`: cualquier solicitud.
- `asesor`: solo las propias (HTTP 403 si es ajena).
- El cuerpo contiene `estado` y `versionEsperada` (ver RN-10).
- Transiciones permitidas:
  - `PENDIENTE` -> `EN_GESTION`
  - `EN_GESTION` -> `RESUELTA`
- Prohibidas (HTTP 409): `PENDIENTE -> RESUELTA`, `EN_GESTION -> PENDIENTE`, cualquier origen desde `RESUELTA` y cualquier transicion no listada.
- La transicion se valida en el **servicio** antes de persistir.

### RN-05. Validacion
- `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- `cliente` y `descripcion`: obligatorios, texto no vacio, se recortan y no se aceptan solo espacios.
- `asesor` (en RN-07): obligatorio, string.
- `estado`: debe pertenecer al enum permitido.
- `versionEsperada`: entero >= 1 y obligatorio en el cambio de estado.
- `page`/`limit`: enteros, `page >= 1`, `1 <= limit <= 100`.
- Errores de validacion => HTTP 400 con mensajes comprensibles.

### RN-06. Respuestas
Exito uniforme:

```json
{ "success": true, "data": {} }
```

Error uniforme:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Descripcion del error",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes"
}
```

Codigos: 400 validacion, 401 API Key/usuario, 403 permisos, 404 inexistente, 409 transicion invalida o conflicto de version, 500 error interno. No se exponen trazas ni secretos.

### RN-07. Asignacion y reasignacion (`PATCH /solicitudes/:id/asignacion`)
- Solo `admin` y `supervisor` (un `asesor` recibe HTTP 403).
- Cuerpo: `{ "asesor": "<id>" }`. El asesor debe existir con rol `asesor` (si no, HTTP 400).
- Si la solicitud no existe, HTTP 404.
- Si la solicitud esta `RESUELTA`, HTTP 409.
- Si el asesor enviado coincide con el actual, la operacion no produce cambios ni evento de historial.
- Cada asignacion efectiva registra un evento `ASIGNACION` en el historial (RN-09).

### RN-08. Filtros y paginacion (`GET /solicitudes`)
- Filtros opcionales combinables: `estado`, `asesor`, `cliente` (parcial), `fechaDesde`, `fechaHasta`.
- Paginacion con `page` (desde 1) y `limit` (1 a 100); por defecto `page=1`, `limit=10`.
- `total` y `totalPages` se calculan sobre el conjunto filtrado.
- Un `asesor` autenticado ve **solo** sus solicitudes: el filtro `asesor` del cliente no puede ampliar su visibilidad.

### RN-09. Historial de auditoria (`GET /solicitudes/:id/historial`)
- Cada operacion relevante registra un evento **persistido** en la tabla `solicitud_historial`:
  - `CREACION` al registrar,
  - `ASIGNACION` al asignar/reasignar,
  - `ESTADO` al cambiar de estado.
- Cada evento guarda estado anterior/nuevo, asesor anterior/nuevo, usuario que ejecuto la accion, detalle y fecha.
- La escritura del historial ocurre en la **misma transaccion** que la operacion: si falla, todo se revierte.
- `admin` y `supervisor` consultan el historial de cualquier solicitud; `asesor` solo el de las propias (HTTP 403 si es ajena); HTTP 404 si la solicitud no existe.
- Los eventos se devuelven en orden cronologico.

### RN-10. Concurrencia optimista (`PATCH /solicitudes/:id/estado`)
- La solicitud expone un entero `version` que inicia en `1`.
- El cliente envia `versionEsperada` con la version que observo.
- La actualizacion se realiza con una sentencia **condicional** (`WHERE id = :id AND version = :versionEsperada`) y luego incrementa `version` en 1.
- Si la version no coincide (o la fila ya cambio entre la lectura y la escritura), devuelve HTTP 409 sin modificar datos.
- Cambiar de estado es la unica operacion que incrementa `version`.

### RN-11. Integridad y normalizacion
- `cliente`, `descripcion`, `asesor` y los filtros de texto se **normalizan** (se colapsan espacios internos y se recortan los extremos) antes de persistir o consultar.
- La asignacion valida la existencia del asesor contra el catalogo (integridad referencial a nivel de aplicacion).
- El historial referencia la solicitud con clave foranea `ON DELETE CASCADE`.

---

## 11. Roles y permisos

| Rol | Registrar | Asignar / reasignar | Ver todas | Ver propias | Ver historial | Cambiar estado (cualquiera) | Cambiar estado (propias) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `admin` | Si (sin asignar) | Si | Si | Si | Si | Si | Si |
| `supervisor` | Si (sin asignar) | Si | Si | Si | Si | Si | Si |
| `asesor` | Si (a si mismo) | No | No | Si | Solo propias | No | Si |

El rol **nunca** se acepta desde el cliente: siempre proviene del catalogo interno resuelto por `x-user`.

---

## 12. Usuarios de prueba

Catalogo en memoria (`UsersService`):

| `x-user` | Rol |
| --- | --- |
| `admin01` | `admin` |
| `supervisor01` | `supervisor` |
| `asesor01` | `asesor` |
| `asesor02` | `asesor` |

Claves de API de ejemplo (`API_KEYS`): `clave-demo-uno`, `clave-demo-dos`.

---

## 13. Ejemplos de peticiones con curl

Registrar una solicitud como asesor (la solicitud se asigna solo):

```bash
curl -X POST http://localhost:3000/solicitudes \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: asesor01" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Andina S.A.","descripcion":"Seguimiento de cotizacion"}'
```

Registrar como administrador (queda SIN asignacion):

```bash
curl -X POST http://localhost:3000/solicitudes \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: admin01" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Distribuidora Sur","descripcion":"Renovacion de contrato"}'
```

Asignar la solicitud a un asesor (RN-07):

```bash
curl -X PATCH http://localhost:3000/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/asignacion \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: admin01" \
  -H "Content-Type: application/json" \
  -d '{"asesor":"asesor02"}'
```

Listar solicitudes con filtros y paginacion (RN-08):

```bash
curl "http://localhost:3000/solicitudes?estado=PENDIENTE&asesor=asesor02&page=1&limit=10" \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: supervisor01"
```

Consultar el historial de auditoria (RN-09):

```bash
curl http://localhost:3000/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/historial \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: admin01"
```

Consultar una solicitud por id:

```bash
curl http://localhost:3000/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: asesor01"
```

Cambiar el estado (transicion permitida, con version actual = 1):

```bash
curl -X PATCH http://localhost:3000/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/estado \
  -H "x-api-key: clave-demo-uno" \
  -H "x-user: asesor01" \
  -H "Content-Type: application/json" \
  -d '{"estado":"EN_GESTION","versionEsperada":1}'
```

Reintentar con una version obsoleta devuelve HTTP 409 (concurrencia optimista, RN-10).

---

## 14. Ejemplos de respuestas exitosas

`POST /solicitudes` (HTTP 201):

```json
{
  "success": true,
  "data": {
    "id": "35758f92-0f9b-41cf-9627-b3737573bfef",
    "cliente": "Comercial Andina S.A.",
    "descripcion": "Seguimiento de cotizacion",
    "asesor": "asesor01",
    "estado": "PENDIENTE",
    "version": 1,
    "creadaEn": "2026-10-13T20:48:07.000Z",
    "actualizadaEn": "2026-10-13T20:48:07.000Z"
  }
}
```

`GET /solicitudes` (HTTP 200, formato paginado):

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "35758f92-0f9b-41cf-9627-b3737573bfef",
        "cliente": "Comercial Andina S.A.",
        "descripcion": "Seguimiento de cotizacion",
        "asesor": "asesor01",
        "estado": "PENDIENTE",
        "version": 1,
        "creadaEn": "2026-10-13T20:48:07.000Z",
        "actualizadaEn": "2026-10-13T20:48:07.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

`GET /solicitudes/:id/historial` (HTTP 200):

```json
{
  "success": true,
  "data": [
    {
      "id": "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "solicitudId": "35758f92-0f9b-41cf-9627-b3737573bfef",
      "tipoEvento": "CREACION",
      "estadoAnterior": null,
      "estadoNuevo": "PENDIENTE",
      "asesorAnterior": null,
      "asesorNuevo": "asesor01",
      "usuario": "asesor01",
      "detalle": "Solicitud registrada",
      "fechaEvento": "2026-10-13T20:48:07.000Z"
    }
  ]
}
```

---

## 15. Ejemplos de errores

Sin API Key (HTTP 401):

```json
{
  "success": false,
  "statusCode": 401,
  "message": "La API Key es requerida",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes"
}
```

Validacion (HTTP 400):

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["cliente es obligatorio y no puede estar vacio"],
  "error": "Bad Request",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes"
}
```

Solicitud ajena para un asesor (HTTP 403):

```json
{
  "success": false,
  "statusCode": 403,
  "message": "No tiene permisos para acceder a esta solicitud",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
}
```

Transicion invalida (HTTP 409):

```json
{
  "success": false,
  "statusCode": 409,
  "message": "Transicion de estado no permitida: PENDIENTE -> RESUELTA",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/estado"
}
```

Conflicto de version (HTTP 409, concurrencia optimista):

```json
{
  "success": false,
  "statusCode": 409,
  "message": "La solicitud fue modificada por otro usuario. Consulte la version actual.",
  "timestamp": "2026-10-13T20:48:07.000Z",
  "path": "/solicitudes/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/estado"
}
```

---

## 16. Acceso a Swagger

Con el servidor en marcha:

- UI: http://localhost:3000/api/docs
- JSON OpenAPI: http://localhost:3000/api/docs-json

Swagger documenta todos los endpoints, los DTO, el encabezado `x-api-key` (esquema de seguridad API Key), el encabezado `x-user`, los estados y las respuestas relevantes. La ruta `/api/docs` es la unica excepcion no protegida por los guards.

---

## 17. Ejecucion de las pruebas

```bash
# Pruebas unitarias (lógica de negocio y guards)
npm test

# Pruebas e2e (endpoints, base de datos en memoria)
npm run test:e2e
```

Las pruebas e2e usan SQLite `:memory:` (ver `test/setup-env.ts`), por lo que quedan aisladas de los datos de desarrollo. No dependen del orden de ejecucion. Cubren, entre otros: API Key ausente/invalida/valida, usuario inexistente, registro con `PENDIENTE`, campos protegidos, visibilidad por rol, 403/404/409, validacion de DTO, formato uniforme de respuestas y disponibilidad de Swagger.

Para la Parte 2 se anadieron pruebas de: asignacion/reasignacion (RN-07), filtros y paginacion (RN-08), historial de auditoria persistente (RN-09), concurrencia optimista por version (RN-10) y normalizacion de texto (RN-11). Incluye una prueba de **rollback** que verifica que si falla el registro del historial, la transicion de estado se revierte por completo (transaccion de TypeORM).

---

## 18. Limitaciones de seguridad del mecanismo `x-user`

- `x-user` es un **mecanismo academico de identificacion**, no una autenticacion real. Cualquiera puede enviar el identificador de otro usuario.
- El **rol** jamas se toma del cliente; siempre proviene del catalogo interno. Aun asi, la identidad no esta verificada criptograficamente.
- `x-api-key` es una clave compartida estatica, no un esquema de autenticacion por usuario.
- **No usar este esquema en produccion.** Un sistema real deberia emplear JWT/OAuth con credenciales, rotacion de secretos, HTTPS y control de acceso centralizado.

---

## 19. Decisiones tecnicas relevantes

1. **ESM obligatorio:** NestJS 12 es ESM-only. Se adopto `"type": "module"`, `module`/`moduleResolution` `node16` e imports relativos con extension `.js`. Jest se configura en modo ESM (`--experimental-vm-modules` + `ts-jest` `useESM`), sin mezclar CommonJS.
2. **SQLite con better-sqlite3:** TypeORM 1.x sustituyo el driver `sqlite3` por `better-sqlite3`. Se eligio `better-sqlite3` 12.x (compatible con Node 24).
3. **Persistencia real:** entidad `Solicitud` en SQLite con `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn` y `@UpdateDateColumn`; `synchronize` solo fuera de produccion. No se usan arreglos en memoria como almacenamiento de solicitudes.
4. **Validacion DRY:** `ValidationPipe` global registrado con `APP_PIPE` en `AppModule`, de modo que las pruebas e2e heredan la misma configuracion que produccion.
5. **Orden de guards explicito:** `@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)` garantiza que la identidad se resuelve antes de evaluar roles.
6. **Autorizacion en la consulta:** el filtro del asesor se aplica en el `where` de TypeORM, no en memoria.
7. **Respuestas uniformes:** interceptor global (`APP_INTERCEPTOR`) para exitos y exception filter global (`APP_FILTER`) para errores, preservando el codigo HTTP original.
8. **Seguridad:** las API Keys provienen exclusivamente de `API_KEYS`; nunca se escriben claves en el codigo ni se registran en logs. Sin claves configuradas, el acceso se deniega.
9. **Transacciones:** las operaciones que escriben (crear, asignar, cambiar estado) junto con su evento de historial se ejecutan dentro de `dataSource.transaction`. Si el historial falla, la operacion completa se revierte.
10. **Concurrencia optimista:** el cambio de estado usa una actualizacion condicional (`WHERE version = :versionEsperada`) y luego incrementa `version`, evitando sobrescrituras silenciosas entre usuarios concurrentes.
11. **Auditoria persistente:** el historial es una entidad real (`solicitud_historial`), no un log en memoria, con clave foranea a la solicitud y borrado en cascada.
12. **Indices:** se indexan `estado`, `asesor` y `creadaEn` en `solicitudes`, y `(solicitudId, fechaEvento)` en el historial, para las consultas filtradas y el orden cronologico.

---

## 20. Verificacion del proyecto

Comandos ejecutados y resultado real:

```bash
npm install          # OK (se descargo el binario nativo de better-sqlite3)
npm run build        # OK (sin errores de compilacion)
npm run lint         # OK (oxlint sin errores ni advertencias)
npm test             # OK (3 suites, 32 pruebas)
npm run test:e2e     # OK (1 suite, 48 pruebas)
```

Arranque de humo de la version compilada (`node dist/main`) contra SQLite:

- `GET /solicitudes` sin API Key -> 401
- `GET /solicitudes` con API Key invalida -> 401
- `GET /solicitudes` con usuario inexistente -> 401
- `GET /api/docs` -> 200
- `GET /api/docs-json` -> 200
- `GET /solicitudes` como `admin01` -> 200 `{"success":true,"data":{"items":[],"pagination":{...}}}`
- `POST /solicitudes` como `asesor01` -> 201 con `estado: "PENDIENTE"`, `version: 1` y `asesor` propio
- `POST /solicitudes` como `admin01` -> 201 con `asesor: null` (sin asignacion)
- `PATCH /solicitudes/:id/asignacion` como `admin01` -> 200 con `asesor` actualizado
- `GET /solicitudes/:id/historial` -> 200 con eventos `CREACION`/`ASIGNACION`
- `PATCH /solicitudes/:id/estado` con `versionEsperada` correcta -> 200 con `version` incrementada
- `PATCH /solicitudes/:id/estado` con `versionEsperada` obsoleta -> 409
