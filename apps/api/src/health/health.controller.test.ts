import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
describe('HealthController', () => {
  it('reports a healthy API', () => {
    const dependency = { ping: async () => true };
    expect(
      new HealthController(
        dependency as never,
        dependency as never,
        { health: async () => ({ status: 'up' }) } as never,
        { healthy: async () => true } as never,
      ).health(),
    ).toMatchObject({ status: 'ok', service: 'resaller-api' });
  });
});
