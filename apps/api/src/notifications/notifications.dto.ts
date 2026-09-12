import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class NotificationPreferenceDto {
  @IsIn(['IN_APP', 'PUSH', 'TELEGRAM', 'EMAIL']) channel!: 'IN_APP' | 'PUSH' | 'TELEGRAM' | 'EMAIL';
  @IsString() @MinLength(2) @MaxLength(80) eventType!: string;
  @IsBoolean() enabled!: boolean;
}

export class NotificationEndpointDto {
  @IsIn(['PUSH', 'TELEGRAM', 'EMAIL']) channel!: 'PUSH' | 'TELEGRAM' | 'EMAIL';
  @IsString() @MinLength(3) @MaxLength(2048) value!: string;
}
