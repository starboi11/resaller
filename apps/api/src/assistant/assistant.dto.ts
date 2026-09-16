import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AssistantRequestDto {
  @IsIn(['DISCOVER', 'COMPARE', 'ORDER_HELP', 'SELLER_FORM'])
  mode!: 'DISCOVER' | 'COMPARE' | 'ORDER_HELP' | 'SELLER_FORM';

  @IsString()
  @MaxLength(600)
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityIds?: string[];
}
