import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { RequireRoles } from '../auth/roles.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminService } from './admin.service.js';
import {
  DecideDisputeDto,
  ModerateListingDto,
  ModerateQuestionReportDto,
  ModerateStoreDto,
  ModerateVerificationDto,
} from './admin.dto.js';

@Controller('admin')
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles('MODERATOR', 'VERIFICATION_ADMIN')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get('queue') queue() {
    return this.admin.queue();
  }
  @Patch('stores/:publicId/status') store(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') id: string,
    @Body() input: ModerateStoreDto,
  ) {
    return this.admin.moderateStore(req.user, id, input);
  }
  @Patch('listings/:publicId/status') listing(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') id: string,
    @Body() input: ModerateListingDto,
  ) {
    return this.admin.moderateListing(req.user, id, input);
  }
  @Patch('verifications/:id/status')
  @RequireRoles('VERIFICATION_ADMIN')
  verification(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: ModerateVerificationDto,
  ) {
    return this.admin.moderateVerification(req.user, id, input);
  }
  @Get('audit') @RequireRoles('SUPER_ADMIN', 'SECURITY_ADMIN') audit() {
    return this.admin.audit();
  }
  @Get('question-reports') @RequireRoles('MODERATOR') questionReports() {
    return this.admin.questionReports();
  }
  @Patch('question-reports/:id')
  @RequireRoles('MODERATOR')
  moderateQuestionReport(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: ModerateQuestionReportDto,
  ) {
    return this.admin.moderateQuestionReport(req.user, id, input);
  }
  @Get('disputes') @RequireRoles('DISPUTE_ADMIN') disputes() {
    return this.admin.disputes();
  }
  @Patch('disputes/:id/decision') @RequireRoles('DISPUTE_ADMIN') decideDispute(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: DecideDisputeDto,
  ) {
    return this.admin.decideDispute(req.user, id, input);
  }
}
