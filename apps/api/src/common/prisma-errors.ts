import { ConflictException } from '@nestjs/common';

export const UNIQUE_VIOLATION = 'P2002';
export const SERIALIZATION_FAILURE = 'P2034';

export function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

export const isUniqueViolation = (error: unknown): boolean => prismaErrorCode(error) === UNIQUE_VIOLATION;
export const isSerializationFailure = (error: unknown): boolean => prismaErrorCode(error) === SERIALIZATION_FAILURE;

// A Serializable transaction that loses a write conflict is a normal outcome
// under concurrency, not a server fault. Surfacing it as 409 lets the client
// retry instead of seeing a 500.
export function mapSerializationFailure(error: unknown): never {
  if (isSerializationFailure(error)) throw new ConflictException('Concurrent update; reload and retry');
  throw error;
}
