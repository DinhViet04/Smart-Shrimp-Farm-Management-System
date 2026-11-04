import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard-stats')
  getDashboardStats(@Query('days') days?: string) {
    return this.adminService.getDashboardStats(days === '30' ? 30 : 7);
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: GetAuditLogsQueryDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('system-health')
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('saas-metrics')
  getSaasMetrics() {
    return this.adminService.getSaasMetrics();
  }

  @Get('alerts')
  getAlerts() {
    return this.adminService.getSystemAlerts();
  }

  @Get('report')
  getReport(@Query('year') value?: string) {
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    return this.adminService.getReport(
      Number.isInteger(year) && year >= 2000 && year <= currentYear
        ? year
        : currentYear,
    );
  }
}
