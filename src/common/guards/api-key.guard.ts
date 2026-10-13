import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const apiKeys = this.configService.get<string[]>('apiKeys') ?? [];

    if (apiKeys.length === 0) {
      this.logger.error(
        'No hay claves configuradas en API_KEYS. Se deniega el acceso a los endpoints funcionales.',
      );
      throw new UnauthorizedException('API Key no configurada en el servidor');
    }

    const header = request.headers['x-api-key'];
    const providedKey = Array.isArray(header) ? header[0] : header;

    if (!providedKey) {
      throw new UnauthorizedException('La API Key es requerida');
    }

    if (!apiKeys.includes(providedKey)) {
      throw new UnauthorizedException('La API Key no es valida');
    }

    return true;
  }
}
