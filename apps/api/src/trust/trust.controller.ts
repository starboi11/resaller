import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { RequireRoles } from '../auth/roles.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { TrustService } from './trust.service.js';

@Controller('admin/trust')
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles('SECURITY_ADMIN', 'SUPER_ADMIN')
export class TrustController {
  constructor(@Inject(TrustService) private readonly trust: TrustService) {}
  @Post('recalculate') recalculate() {
    return this.trust.recalculate();
  }
}
