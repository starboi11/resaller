import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// A thrown HttpException carries a message the domain wrote for the caller
// ("Store is in vacation mode", "Stock changed; review cart"). Replacing all of
// them with "Request failed" leaves a buyer unable to tell a sold-out item from
// a closed store, so those messages are passed through. Anything that is not an
// HttpException is unplanned and may carry internal detail, so it stays masked.
function clientMessage(error: unknown, status: number): string {
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) return 'Unexpected server error';
  if (!(error instanceof HttpException)) return 'Request failed';
  const response = error.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const { message } = response as { message: unknown };
    if (typeof message === 'string') return message;
    // ValidationPipe reports one entry per rejected field.
    if (Array.isArray(message) && message.every((entry) => typeof entry === 'string'))
      return message.join('; ');
  }
  return error.message || 'Request failed';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const reply = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const fastifyStatus =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;
    const status = error instanceof HttpException
      ? error.getStatus()
      : fastifyStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const code = status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`;
    if (status === 500) this.logger.error(error instanceof Error ? error.stack : String(error));
    reply.status(status).send({ code, message: clientMessage(error, status), requestId: request.id });
  }
}
