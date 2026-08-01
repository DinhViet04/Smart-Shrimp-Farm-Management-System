import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReopenIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
