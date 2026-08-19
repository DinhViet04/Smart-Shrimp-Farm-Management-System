import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WeatherService } from './weather.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('weather')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @Roles('TECHNICIAN', 'FARMER', 'FARM_MANAGER', 'ADMIN')
  async getWeather(
    @Query('farmId') farmId?: string,
    @Query('address') address?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ) {
    const latNum = lat ? parseFloat(lat) : undefined;
    const lonNum = lon ? parseFloat(lon) : undefined;
    return this.weatherService.getWeather({
      farmId,
      address,
      lat: isNaN(latNum as number) ? undefined : latNum,
      lon: isNaN(lonNum as number) ? undefined : lonNum,
    });
  }
}
