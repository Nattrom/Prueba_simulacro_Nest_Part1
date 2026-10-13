import type { TransformFnParams } from 'class-transformer';

export const normalizeText = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;
