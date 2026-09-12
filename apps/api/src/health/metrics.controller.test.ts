import { describe, expect, it, vi } from 'vitest';
import { MetricsController } from './metrics.controller.js';

describe('MetricsController', () => {
  it('exports operational gauges without exposing record data', async () => {
    const count = vi.fn().mockResolvedValue(2);
    const prisma = { order: { count }, dispute: { count }, securityEvent: { count }, notificationDelivery: { count } };
    const controller = new MetricsController(prisma as never, { health: async () => ({ scheduled: 3, processing: 1 }) } as never);
    const output = await controller.metrics({ headers: {} } as never);
    expect(output).toContain('resaller_notification_queue_scheduled 3');
    expect(output).toContain('resaller_orders_acceptance_overdue 2');
  });
});
