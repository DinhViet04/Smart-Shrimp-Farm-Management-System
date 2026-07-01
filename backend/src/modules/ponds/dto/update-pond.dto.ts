import { PartialType } from '@nestjs/mapped-types';
import { CreatePondDto } from './create-pond.dto.js';
import { IsOptional, IsEnum } from 'class-validator';

export class UpdatePondDto extends PartialType(CreatePondDto) {}
