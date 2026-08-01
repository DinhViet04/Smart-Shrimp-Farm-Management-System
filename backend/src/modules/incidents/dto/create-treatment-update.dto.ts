import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTreatmentUpdateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  treatment: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  result?: string;
}
