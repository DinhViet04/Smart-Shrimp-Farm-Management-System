import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeedingLogsService } from './feeding-logs.service';
import { CreateDailyFeedingLogDto } from './dto/create-feeding-log.dto';
import { GetFeedingLogsQueryDto } from './dto/get-feeding-logs.dto';

@Controller('feeding-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedingLogsController {
  private readonly logger = new Logger(FeedingLogsController.name);

  constructor(private readonly feedingLogsService: FeedingLogsService) {}

  @Post()
  @Roles('FARMER', 'ADMIN', 'FARM_MANAGER')
  async createOrUpdate(@Req() req: any, @Body() dto: CreateDailyFeedingLogDto) {
    const user = { userId: req.user.userId, role: req.user.role };
    this.logger.log(`POST /feeding-logs - user: ${user.userId}, farm: ${dto.farmId}, pond: ${dto.pondId}, sessions: ${dto.sessions?.length}`);
    try {
      return await this.feedingLogsService.createOrUpdateDailyLog(user, dto);
    } catch (err) {
      this.logger.error(`POST /feeding-logs ERROR: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Get()
  async findAll(@Req() req: any, @Query() query: GetFeedingLogsQueryDto) {
    const user = { userId: req.user.userId, role: req.user.role };
    this.logger.log(`GET /feeding-logs - user: ${user.userId}, query: ${JSON.stringify(query)}`);
    try {
      return await this.feedingLogsService.findAllGrouped(user, query);
    } catch (err) {
      this.logger.error(`GET /feeding-logs ERROR: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Get('details')
  async getDetails(
    @Req() req: any,
    @Query('pondId') pondId: string,
    @Query('date') date: string,
  ) {
    const user = { userId: req.user.userId, role: req.user.role };
    try {
      return await this.feedingLogsService.getDailyDetails(user, pondId, date);
    } catch (err) {
      this.logger.error(`GET /feeding-logs/details ERROR: ${err.message}`, err.stack);
      throw err;
    }
  }
}
