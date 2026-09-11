import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  password!: string;
}

export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @MaxLength(30)
  username!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

export class RequestPasswordResetDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString() @MinLength(3) @MaxLength(32) username!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(32) @MaxLength(200) token!: string;
  @IsString() @MinLength(12) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) newPassword!: string;
}

export class VerifyTwoFactorDto {
  @IsString() @MinLength(32) @MaxLength(200) challengeToken!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
