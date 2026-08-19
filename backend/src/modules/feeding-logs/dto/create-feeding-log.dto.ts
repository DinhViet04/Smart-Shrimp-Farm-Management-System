import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Min,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeedingSession, FeedingMethod, FeedingStatus } from '@prisma/client';

export class SingleSessionFeedingLogDto {
  @IsEnum(FeedingSession)
  @IsNotEmpty()
  feedingSession: FeedingSession;

  @IsString()
  @IsNotEmpty()
  feedingTime: string;

  @IsUUID()
  @IsNotEmpty()
  feedProductId: string;

  @IsNumber()
  @Min(0, { message: 'Feed amount must be greater than or equal to zero' })
  feedAmount: number;

  @IsEnum(FeedingMethod)
  @IsNotEmpty()
  feedingMethod: FeedingMethod;

  @IsEnum(FeedingStatus)
  @IsNotEmpty()
  feedingStatus: FeedingStatus;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;
}

export class CreateDailyFeedingLogDto {
  @IsUUID()
  @IsNotEmpty()
  farmId: string;

  @IsUUID()
  @IsNotEmpty()
  pondId: string;

  @IsUUID()
  @IsNotEmpty()
  cropId: string;

  @IsDateString()
  @IsNotEmpty()
  feedingDate: string;

  @ValidateNested({ each: true })
  @Type(() => SingleSessionFeedingLogDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  sessions: SingleSessionFeedingLogDto[];
}
