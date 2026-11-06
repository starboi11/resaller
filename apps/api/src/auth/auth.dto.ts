import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Uzbek mobile numbers in any common spelling ("+998 90 123-45-67",
 * "998901234567", "90 123 45 67") become +998XXXXXXXXX; anything else is left
 * as typed so validation rejects it.
 */
export const normalizeUzPhone = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return value.trim();
};

// Customer passwords: at least 6 characters, digits alone are allowed (owner
// decision 2026-11-04). Online guessing is held back by the login limits.
export const PASSWORD_MIN = 6;

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[^\d<>{}]+$/, { message: 'Ismda raqam yoki maxsus belgilar bo‘lmasin' })
  fullName!: string;

  @Transform(({ value }) => normalizeUzPhone(value))
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin' })
  phone!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, { message: 'Parol kamida 6 belgidan iborat bo‘lsin' })
  @MaxLength(128)
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
  @IsString() @MinLength(PASSWORD_MIN, { message: 'Parol kamida 6 belgidan iborat bo‘lsin' }) @MaxLength(128) newPassword!: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(PASSWORD_MIN, { message: 'Parol kamida 6 belgidan iborat bo‘lsin' }) @MaxLength(128) newPassword!: string;
}

export class VerifyTwoFactorDto {
  @IsString() @MinLength(32) @MaxLength(200) challengeToken!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
