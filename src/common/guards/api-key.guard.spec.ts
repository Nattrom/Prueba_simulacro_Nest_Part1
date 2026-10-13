import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { ApiKeyGuard } from './api-key.guard.js';

const createContext = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

const createGuard = (apiKeys: string[] | undefined): ApiKeyGuard => {
  const configService = {
    get: jest.fn().mockReturnValue(apiKeys),
  } as unknown as ConfigService;
  return new ApiKeyGuard(configService);
};

describe('ApiKeyGuard', () => {
  it('deniega el acceso cuando no hay claves configuradas', () => {
    const guard = createGuard([]);
    expect(() => guard.canActivate(createContext({ 'x-api-key': 'x' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('deniega el acceso cuando no se envia el encabezado', () => {
    const guard = createGuard(['clave-demo-uno']);
    expect(() => guard.canActivate(createContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('deniega el acceso cuando la clave es invalida', () => {
    const guard = createGuard(['clave-demo-uno']);
    expect(() =>
      guard.canActivate(createContext({ 'x-api-key': 'incorrecta' })),
    ).toThrow(UnauthorizedException);
  });

  it('permite el acceso cuando la clave coincide', () => {
    const guard = createGuard(['clave-demo-uno', 'clave-demo-dos']);
    expect(
      guard.canActivate(createContext({ 'x-api-key': 'clave-demo-dos' })),
    ).toBe(true);
  });
});
