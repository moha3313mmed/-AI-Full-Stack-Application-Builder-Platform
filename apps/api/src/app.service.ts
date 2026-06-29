import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { message: string; version: string } {
    return {
      message: 'Welcome to AI Builder Platform API',
      version: '0.1.0',
    };
  }
}
