import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALL_ROLES, type AppRole } from '../auth/roles.js';

export class ModerateStoreDto {
  @IsIn(['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED']) status!:
    'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'CLOSED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ModerateListingDto {
  @IsIn(['ACTIVE', 'REJECTED', 'RESTRICTED', 'ARCHIVED']) status!:
    'ACTIVE' | 'REJECTED' | 'RESTRICTED' | 'ARCHIVED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ModerateVerificationDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ViewSellerPrivateDetailsDto {
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
export class ModerateQuestionReportDto {
  @IsIn(['ACTIONED', 'DISMISSED']) status!: 'ACTIONED' | 'DISMISSED';
  @IsString() @MinLength(3) @MaxLength(500) resolution!: string;
}
export class DecideDisputeDto {
  @IsIn(['BUYER', 'SELLER', 'PARTIAL', 'NO_ACTION']) outcome!:
    'BUYER' | 'SELLER' | 'PARTIAL' | 'NO_ACTION';
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
}
export class ModerateUserDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'CLOSED']) status!:
    'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class UpdateUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(ALL_ROLES, { each: true })
  roles!: AppRole[];
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class ModerateReviewDto {
  @IsIn(['VISIBLE', 'HIDDEN']) status!: 'VISIBLE' | 'HIDDEN';
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class ResolveSecurityEventDto {
  @IsString() @MinLength(5) @MaxLength(1000) resolution!: string;
}
