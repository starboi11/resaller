import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ModerateStoreDto {
  @IsIn(['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED']) status!: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'CLOSED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ModerateListingDto {
  @IsIn(['ACTIVE', 'REJECTED', 'RESTRICTED', 'ARCHIVED']) status!: 'ACTIVE' | 'REJECTED' | 'RESTRICTED' | 'ARCHIVED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ModerateVerificationDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
