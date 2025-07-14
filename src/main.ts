import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { apiReference } from '@scalar/nestjs-api-reference';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/exception-filters/http-exception.filter';
import { SerializeInterceptor } from './shared/interceptors/serialize.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '10mb' });

  app.useGlobalInterceptors(new SerializeInterceptor(app.get(Reflector)));

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      exceptionFactory(errors) {
        return new UnprocessableEntityException({
          success: false,
          errors: errors,
        });
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Agent Runtime APIs')
    .addServer(`http://localhost:${process.env.PORT || 6789}/`, "Local")
    .setDescription('Agent Runtime')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  
  app.enableCors({ origin: true, credentials: true });
  app.use('/api', apiReference({ content: document, withFastify: false }));

  await app.listen(process.env.PORT || 6789);
}

bootstrap();
