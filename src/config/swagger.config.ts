import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

export const X_API_KEY_SCHEME = 'x-api-key';

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API de Solicitudes Comerciales')
    .setDescription(
      [
        'API REST interna para administrar solicitudes de seguimiento comercial.',
        '',
        'Seguridad (alcance academico):',
        '- Todas las rutas funcionales exigen el encabezado `x-api-key` con una clave valida configurada en la variable de entorno API_KEYS.',
        '- La identidad se resuelve con el encabezado `x-user` contra un catalogo de usuarios de prueba en memoria. El rol NUNCA se acepta desde el cliente.',
        '- `x-user` es un mecanismo academico de identificacion y NO es una autenticacion apta para produccion.',
        '',
        'La documentacion Swagger (' +
          SWAGGER_PATH +
          ') es la unica ruta deliberadamente NO protegida, para que el evaluador pueda consultarla.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header' },
      X_API_KEY_SCHEME,
    )
    .addGlobalParameters({
      name: 'x-user',
      in: 'header',
      required: true,
      description:
        'Identificador del usuario que realiza la peticion. Valores de prueba: admin01, supervisor01, asesor01, asesor02.',
      schema: { type: 'string', example: 'asesor01' },
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  return document;
}
