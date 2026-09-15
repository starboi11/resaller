import {
  IsBoolean,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddCartItemDto {
  @IsString() listingPublicId!: string;
  @IsString() variantId!: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}
export class UpdateCartItemDto {
  @IsInt() @Min(1) @Max(99) quantity!: number;
}
export class CheckoutDto {
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey!: string;
  @IsObject() delivery!: Record<string, unknown>;
  @IsOptional() @IsObject() couponCodes?: Record<string, string>;
  @IsOptional() @IsBoolean() saveAddress?: boolean;
  @IsOptional() @IsString() @MaxLength(40) addressLabel?: string;
}
export class SavedAddressDto {
  @IsString() @MinLength(2) @MaxLength(40) label!: string;
  @IsString() @MinLength(3) @MaxLength(100) fullName!: string;
  @IsString() @MinLength(7) @MaxLength(30) phone!: string;
  @IsString() @MinLength(2) @MaxLength(100) region!: string;
  @IsString() @MinLength(5) @MaxLength(500) address!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class TransitionOrderDto {
  @IsString() to!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CancellationRequestDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class OrderChangeRequestDto {
  @IsString() @MinLength(3) @MaxLength(1000) request!: string;
}
export class OrderChangeDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CancellationDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class ReturnRequestDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ReturnDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class QuestionReportDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class OpenDisputeDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}
export class MessageDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
}
export class LocationMessageDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
}
export class AnswerDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}
export class QuestionDto {
  @IsString() storePublicId!: string;
  @IsOptional() @IsString() listingPublicId?: string;
  @IsString() @MinLength(3) @MaxLength(1000) body!: string;
}
export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
}
