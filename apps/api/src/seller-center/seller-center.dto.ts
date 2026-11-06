import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const money = /^(0|[1-9]\d{0,11})$/;

export class ExternalOrderItemDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(10_000) quantity!: number;
  @IsString() @Matches(money) unitPriceMinor!: string;
  @IsString() @Matches(money) unitCostMinor!: string;
}

export class CreateExternalOrderDto {
  @IsIn(['INSTAGRAM', 'TELEGRAM', 'OFFLINE', 'OTHER']) source!: string;
  @IsString() @MinLength(1) @MaxLength(100) customerName!: string;
  @IsOptional() @IsString() @Matches(/^\+998\d{9}$/) customerPhone?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ExternalOrderItemDto) items!: ExternalOrderItemDto[];
  @IsString() @Matches(money) discountMinor!: string;
  @IsString() @Matches(money) deliveryCostMinor!: string;
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey!: string;
}

export class TransitionExternalOrderDto {
  @IsIn(['NEW', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']) status!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateDeliveryDto {
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) courierName?: string;
  @IsOptional() @IsString() @MaxLength(100) trackingNumber?: string;
}

export class UpdatePaymentRecordDto {
  @IsIn(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']) status!: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class AdjustStockDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(-1_000_000) @Max(1_000_000) delta!: number;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @Matches(/^\+998\d{9}$/) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
}

export class CreateExpenseDto {
  @IsString() @Matches(/^[1-9]\d{0,11}$/) amountMinor!: string;
  @IsIn(['RENT', 'MARKETING', 'SALARY', 'PACKAGING', 'OTHER']) category!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn?: string;
}
