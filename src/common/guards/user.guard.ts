import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class UserGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers['x-user'];
    const userId = Array.isArray(header) ? header[0] : header;

    if (!userId) {
      throw new UnauthorizedException('El encabezado x-user es obligatorio');
    }

    const user = this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('El usuario no existe');
    }

    request.user = user;

    return true;
  }
}
