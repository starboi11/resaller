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
  ModerateReviewDto,
  ModerateStoreDto,
  ModerateUserDto,
  ModerateVerificationDto,
  ResolveSecurityEventDto,
  UpdateUserRolesDto,
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
  @Get('users') @RequireRoles('SUPPORT_ADMIN', 'SECURITY_ADMIN') users() {
    return this.admin.users();
  }
  @Patch('users/:publicId/status') @RequireRoles('SECURITY_ADMIN') moderateUser(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') id: string,
    @Body() input: ModerateUserDto,
  ) {
    return this.admin.moderateUser(req.user, id, input);
  }
  @Patch('users/:publicId/roles') @RequireRoles('SUPER_ADMIN') updateUserRoles(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') id: string,
    @Body() input: UpdateUserRolesDto,
  ) {
    return this.admin.updateUserRoles(req.user, id, input);
  }
  @Get('reviews') @RequireRoles('MODERATOR') reviews() {
    return this.admin.reviews();
  }
  @Patch('reviews/:id') @RequireRoles('MODERATOR') moderateReview(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: ModerateReviewDto,
  ) {
    return this.admin.moderateReview(req.user, id, input);
  }
  @Get('security-events') @RequireRoles('SECURITY_ADMIN') securityEvents() {
    return this.admin.securityEvents();
  }
  @Patch('security-events/:id/resolve')
  @RequireRoles('SECURITY_ADMIN')
  resolveSecurityEvent(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: ResolveSecurityEventDto,
  ) {
    return this.admin.resolveSecurityEvent(req.user, id, input);
  }
}
