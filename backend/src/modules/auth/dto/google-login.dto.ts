import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Token Google không được để trống' })
  credential: string;

  @IsString()
  @IsOptional()
  inviteToken?: string;
}

