import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      statusCode: status,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || exception.message,
      error:
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as Record<string, unknown>).error
          : undefined,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`HTTP ${status}: ${JSON.stringify(errorBody.message)}`);
    response.status(status).json(errorBody);
  }
}
