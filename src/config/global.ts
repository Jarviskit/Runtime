import { RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default () => ({
  port: parseInt(process.env.PORT, 10) || 6789,
  database: {
    type: 'postgres',
    url: process.env.JARVIS_KIT_POSTGRES_URI,
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    synchronize: true,
    ssl: false,
  } as TypeOrmModuleOptions,
  redis: {
    url: process.env.JARVIS_KIT_REDIS_URI,
  } as RedisModuleOptions,
});
