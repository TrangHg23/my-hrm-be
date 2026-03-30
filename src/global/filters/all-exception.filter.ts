import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    // Log the full exception for debugging (critical for Render/Production)
    console.error(`[AllExceptionFilter] Error at ${req.method} ${req.url}:`, {
      status: exception instanceof HttpException ? exception.getStatus() : 500,
      message: exception instanceof Error ? exception.message : exception,
      stack: exception instanceof Error ? exception.stack : null,
    });

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorRes: any = exception.getResponse();
      message = errorRes.message || errorRes;
    }

    res.status(status).json({
      data: null,
      message,
    });
  }
}
