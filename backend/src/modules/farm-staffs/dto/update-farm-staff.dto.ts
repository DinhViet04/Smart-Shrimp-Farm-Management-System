import { PartialType } from '@nestjs/mapped-types';
import { CreateFarmStaffDto } from './create-farm-staff.dto.js';

export class UpdateFarmStaffDto extends PartialType(CreateFarmStaffDto) {}
