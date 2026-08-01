import { IsUUID } from 'class-validator';

export class AssignIncidentDto {
  @IsUUID('4')
  assignedToId: string;
}
