import { RedisModuleOptions } from "@liaoliaots/nestjs-redis";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export default () => ({
  port: parseInt(process.env.PORT, 10) || 6789,
  database: {
    type: 'postgres',
    url: process.env.POSTGRES_CONNECTION_STRING,
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    synchronize: true,
    ssl: false,
  } as TypeOrmModuleOptions,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    config: { db: parseInt(process.env.REDIS_DB, 10) || 0 }
  } as RedisModuleOptions,
});