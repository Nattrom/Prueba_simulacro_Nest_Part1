import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';
import type { UserRole } from '../types/user-role.type.js';
import { RolesGuard } from './roles.guard.js';

const createContext = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const createGuard = (roles?: UserRole[]): RolesGuard => {
  const reflector = {
    getAllAndOverride: jest.fn(() => roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard', () => {
  it('permite el acceso cuando no hay roles declarados', () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('permite el acceso cuando el rol esta autorizado', () => {
    const guard = createGuard(['admin', 'supervisor']);
    expect(
      guard.canActivate(createContext({ id: 'admin01', role: 'admin' })),
    ).toBe(true);
  });

  it('rechaza el acceso cuando el rol no esta autorizado', () => {
    const guard = createGuard(['admin']);
    expect(() =>
      guard.canActivate(createContext({ id: 'asesor01', role: 'asesor' })),
    ).toThrow(ForbiddenException);
  });

  it('rechaza el acceso cuando no hay usuario en la peticion', () => {
    const guard = createGuard(['admin']);
    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });
});
