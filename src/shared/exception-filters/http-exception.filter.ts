import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(Error)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    let data = exception instanceof HttpException ? (exception.getResponse() as any).data : null
    let customCode = 'UNKNOWN_ERROR';
    if (exception instanceof UnprocessableEntityException) {
      customCode = 'VALIDATION_ERROR';
      data = (exception.getResponse() as any).errors.map((error: any) => ({ ...error, target: undefined }));
    }

    if (exception instanceof HttpException) {
      customCode = exception.name;
    }

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    response.status(status).json({
      success: false,
      code: customCode,
      message: exception.message,
      data,
    });
  }
}
