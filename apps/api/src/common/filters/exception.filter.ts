import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[];
    if (exception instanceof HttpException) {
      const exResponse = exception.getResponse() as Record<string, any>;
      message = typeof exResponse === 'object' && exResponse['message']
        ? exResponse['message']
        : exception.message;
    } else {
      // Don't leak internal error details in production
      message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : exception.message || 'Internal server error';
    }

    response.status(status).json({
      success: false,
      error: message,
    });
  }
}
