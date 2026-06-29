import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { TriggerScanDto } from './dto/trigger-scan.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { SecurityService } from './security.service';

@ApiTags('security')
@Controller()
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Post('security/scan')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a security scan' })
  @ApiResponse({ status: 201, description: 'Security scan triggered successfully.' })
  async triggerScan(@Body() dto: TriggerScanDto) {
    return this.securityService.triggerScan(dto);
  }

  @Get('security/scans/:projectId')
  @ApiOperation({ summary: 'List security scans for a project' })
  @ApiResponse({ status: 200, description: 'List of security scans.' })
  async getScansByProject(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.securityService.getScansByProject(
      projectId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('security/scans/:projectId/:scanId')
  @ApiOperation({ summary: 'Get security scan details' })
  @ApiResponse({ status: 200, description: 'Security scan details.' })
  async getScanById(
    @Param('projectId') projectId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.securityService.getScanById(projectId, scanId);
  }

  @Get('security/score/:projectId')
  @ApiOperation({ summary: 'Get current security score for a project' })
  @ApiResponse({ status: 200, description: 'Security score.' })
  async getSecurityScore(@Param('projectId') projectId: string) {
    return this.securityService.getSecurityScore(projectId);
  }

  @Get('security/rules')
  @ApiOperation({ summary: 'List security rules' })
  @ApiResponse({ status: 200, description: 'List of security rules.' })
  async getRules(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.securityService.getRules(
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Patch('security/rules/:id')
  @ApiOperation({ summary: 'Update a security rule' })
  @ApiResponse({ status: 200, description: 'Security rule updated.' })
  async updateRule(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.securityService.updateRule(id, dto);
  }
}
