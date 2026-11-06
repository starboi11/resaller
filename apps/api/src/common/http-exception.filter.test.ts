import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

function run(error: unknown) {
  const sent: unknown[] = [];
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn((body: unknown) => sent.push(body)) };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ id: 'req-1' }),
    }),
  };
  new HttpExceptionFilter().catch(error, host as never);
  return { status: reply.status.mock.calls[0]?.[0], body: sent[0] as { code: string; message: string } };
}

describe('HttpExceptionFilter', () => {
  it('passes a domain conflict message through so the buyer learns why checkout failed', () => {
    const { status, body } = run(new ConflictException('Store is in vacation mode'));
    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'HTTP_409', message: 'Store is in vacation mode' });
  });

  it('keeps not-found and bad-request messages', () => {
    expect(run(new NotFoundException('External order not found')).body.message).toBe('External order not found');
    expect(run(new BadRequestException('Discount exceeds subtotal')).body.message).toBe('Discount exceeds subtotal');
  });

  it('joins the per-field messages ValidationPipe produces', () => {
    const { body } = run(new BadRequestException(['quantity must not be less than 1', 'variantId must be a UUID']));
    expect(body.message).toBe('quantity must not be less than 1; variantId must be a UUID');
  });

  it('never leaks an unplanned error, which may carry internal detail', () => {
    const { status, body } = run(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(status).toBe(500);
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Unexpected server error', requestId: 'req-1' });
  });

  it('masks a non-HttpException that carries its own status code', () => {
    const { status, body } = run(Object.assign(new Error('Reply payload too large'), { statusCode: 413 }));
    expect(status).toBe(413);
    expect(body.message).toBe('Request failed');
  });
});
