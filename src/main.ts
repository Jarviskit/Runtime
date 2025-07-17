import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { apiReference } from '@scalar/nestjs-api-reference';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/exception-filters/http-exception.filter';
import { SerializeInterceptor } from './shared/interceptors/serialize.interceptor';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

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

  // Add gRPC microservice
  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'agent_runtime',
      protoPath: join(__dirname, '../proto/agent-runtime.proto'),
      url: '0.0.0.0:50051',
    },
  });

  await grpcApp.listen();
  console.log(`gRPC server is running on port 50051`);

  await app.listen(process.env.PORT || 6789);
  console.log(`HTTP server is running on port ${process.env.PORT || 6789}`);
}

bootstrap();
