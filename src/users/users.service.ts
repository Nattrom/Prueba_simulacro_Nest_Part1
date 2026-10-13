import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { UserRole } from '../common/types/user-role.type.js';

interface CatalogUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  private readonly users: readonly CatalogUser[] = Object.freeze([
    { id: 'admin01', role: 'admin' },
    { id: 'supervisor01', role: 'supervisor' },
    { id: 'asesor01', role: 'asesor' },
    { id: 'asesor02', role: 'asesor' },
  ]);

  findById(id: string): AuthenticatedUser | undefined {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? { id: user.id, role: user.role } : undefined;
  }

  isAsesor(id: string): boolean {
    return this.users.some(
      (candidate) => candidate.id === id && candidate.role === 'asesor',
    );
  }

  findAsesores(): AuthenticatedUser[] {
    return this.users
      .filter((user) => user.role === 'asesor')
      .map((user) => ({ id: user.id, role: user.role }));
  }
}
