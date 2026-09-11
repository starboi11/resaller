import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class NotificationPreferenceDto {
  @IsIn(['IN_APP', 'PUSH', 'TELEGRAM', 'EMAIL']) channel!: 'IN_APP' | 'PUSH' | 'TELEGRAM' | 'EMAIL';
  @IsString() @MinLength(2) @MaxLength(80) eventType!: string;
  @IsBoolean() enabled!: boolean;
}
