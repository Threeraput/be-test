import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

type ExceptionResponse = {
  errors?: string[];
  message?: string | string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const errors = this.getErrors(exception);

    response.status(status).json({ errors });
  }

  private getErrors(exception: unknown): string[] {
    if (!(exception instanceof HttpException)) {
      return ['เกิดข้อผิดพลาดภายในระบบ'];
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return [exceptionResponse];
    }

    const response = exceptionResponse as ExceptionResponse;

    if (response.errors) {
      return response.errors;
    }

    if (Array.isArray(response.message)) {
      return response.message;
    }

    return [response.message ?? 'เกิดข้อผิดพลาดภายในระบบ'];
  }
}