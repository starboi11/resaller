import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const reply = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`;
    if (status === 500) this.logger.error(error instanceof Error ? error.stack : String(error));
    reply.status(status).send({ code, message: status === 500 ? 'Unexpected server error' : 'Request failed', requestId: request.id });
  }
}
