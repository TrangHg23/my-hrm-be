declare const module: any;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionFilter } from 'src/global/filters/all-exception.filter';
import { ValidationPipe } from '@nestjs/common/pipes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new AllExceptionFilter());

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
