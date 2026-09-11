import {
  IsBoolean,
  IsInt,
  IsObject,
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
export class CheckoutDto {
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey!: string;
  @IsObject() delivery!: Record<string, unknown>;
  @IsOptional() @IsObject() couponCodes?: Record<string, string>;
}
export class TransitionOrderDto {
  @IsString() to!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CancellationRequestDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class CancellationDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class ReturnRequestDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
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
