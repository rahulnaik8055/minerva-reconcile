import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../../interfaces';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;

        if (Array.isArray(body['message'])) {
          message = (body['message'] as string[]).join(', ');
        } else if (typeof body['message'] === 'string') {
          message = body['message'];
        } else if (typeof body['error'] === 'string') {
          message = body['error'];
        } else {
          message = 'Request failed';
        }
      }
    }

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const errorResponse: ApiResponse = {
      success: false,
      error: message,
    };

    response.status(status).json(errorResponse);
  }
}
