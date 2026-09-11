import { Controller, Get } from '@nestjs/common';
import { PLATFORM_BUSINESS_RULES } from '@resaller/types';

const modules = [
  'auth', 'users', 'sellers', 'stores', 'listings', 'inventory', 'marketplace',
  'cart', 'orders', 'chat', 'questions', 'reviews', 'trust', 'risk', 'coupons',
  'promotions', 'notifications', 'search', 'disputes', 'admin', 'audit', 'security',
] as const;

@Controller('platform')
export class PlatformController {
  @Get('capabilities')
  capabilities() {
    return {
      architecture: 'modular-monolith',
      apiVersion: 1,
      settlement: 'deferred',
      sellerAcceptanceMinutes: PLATFORM_BUSINESS_RULES.sellerAcceptanceMinutes,
      businessRules: PLATFORM_BUSINESS_RULES,
      modules,
    };
  }
}
