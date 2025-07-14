import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getIndex(): string {
    return `Emerald Agent Runtime - v0.0.1`;
  }
}
