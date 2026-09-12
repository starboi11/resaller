import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsDateString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStoreDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;
  @IsString() @MinLength(2) @MaxLength(80) nameUz!: string;
  @IsOptional() @IsString() @MaxLength(80) nameRu?: string;
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  @Matches(/^[A-Z0-9]+$/)
  orderPrefix!: string;
}

export class CreateListingDto {
  @IsString() @MinLength(2) @MaxLength(160) nameUz!: string;
  @IsOptional() @IsString() @MaxLength(160) nameRu?: string;
  @IsString() @MinLength(10) @MaxLength(5000) descriptionUz!: string;
  @IsInt() @Min(0) @Max(9_000_000_000_000) priceMinor!: number;
  @IsString() @MinLength(2) @MaxLength(40) sku!: string;
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
  @IsOptional() @IsString() @MaxLength(80) categorySlug?: string;
  @IsOptional() @IsObject() attributeValues?: Record<string, unknown>;
}

export class MarketplaceQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  minPrice?: number;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  maxPrice?: number;
  @IsOptional()
  @IsIn(['IDENTITY_VERIFIED', 'TRUSTED', 'TOP_SELLER'])
  trust?: 'IDENTITY_VERIFIED' | 'TRUSTED' | 'TOP_SELLER';
  @IsOptional()
  @IsIn(['relevance', 'new', 'price-asc', 'price-desc'])
  sort?: 'relevance' | 'new' | 'price-asc' | 'price-desc';
}

export class SellerVerificationDto {
  @IsString() @MinLength(3) @MaxLength(160) legalName!: string;
  @IsIn(['PASSPORT', 'ID_CARD', 'BUSINESS_REGISTRATION']) documentType!: string;
  @IsString() @MinLength(4) @MaxLength(80) documentNumber!: string;
}

export class StoreSettingsDto {
  @IsObject() workingHours!: Record<string, unknown>;
  @IsObject() deliverySettings!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(300) vacationMessageUz?: string;
  @IsOptional() @IsString() @MaxLength(300) vacationMessageRu?: string;
}

export class AddStoreMemberDto {
  @IsString() @MinLength(3) @MaxLength(32) username!: string;
  @IsIn(['STORE_MANAGER', 'ORDER_OPERATOR']) role!:
    'STORE_MANAGER' | 'ORDER_OPERATOR';
}

export class UpdateListingDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) nameUz?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  descriptionUz?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9_000_000_000_000) priceMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) stock?: number;
  @IsOptional() @IsObject() attributeValues?: Record<string, unknown>;
}

export class CreateVariantDto {
  @IsString() @MinLength(2) @MaxLength(40) sku!: string;
  @IsObject() options!: Record<string, string>;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_000_000_000_000)
  priceOverrideMinor?: number;
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
}

export class UpdateVariantDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) sku?: string;
  @IsOptional() @IsObject() options?: Record<string, string>;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_000_000_000_000)
  priceOverrideMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) stock?: number;
}

export class VacationModeDto {
  @IsIn([true, false]) enabled!: boolean;
}

export class CreateCouponDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,24}$/)
  code!: string;
  @IsIn(['FIXED', 'PERCENT']) kind!: 'FIXED' | 'PERCENT';
  @IsInt() @Min(1) @Max(9_000_000_000_000) valueMinor!: number;
  @IsOptional() @IsInt() @Min(0) minimumMinor?: number;
  @IsOptional() @IsInt() @Min(1) maximumDiscountMinor?: number;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) buyerLimit?: number;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}

export class CreatePromotionDto {
  @IsString() @MinLength(2) @MaxLength(40) type!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsObject() metadata!: Record<string, unknown>;
}

export class CreateTestimonialDto {
  @IsString() @MinLength(2) @MaxLength(80) sourceLabel!: string;
  @IsString() @MinLength(2) @MaxLength(80) authorLabel!: string;
  @IsString() @MinLength(3) @MaxLength(1000) body!: string;
}
