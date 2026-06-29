import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';

import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.sub, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.apiKeysService.findAllByUser(user.sub);
  }

  @Delete(':id')
  async revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.apiKeysService.revoke(user.sub, id);
    return { message: 'API key revoked successfully' };
  }
}
