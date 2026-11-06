import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
  ViewSellerPrivateDetailsDto,
} from './admin.dto.js';

@Controller('admin')
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles('MODERATOR', 'VERIFICATION_ADMIN')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get('queue') queue() {
    return this.admin.queue();
  }
  @Get('overview') @RequireRoles('SUPER_ADMIN') overview() {
    return this.admin.overview();
  }
  @Get('seller-login-history') @RequireRoles('SUPER_ADMIN') sellerLoginHistory(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
  ) {
    return this.admin.sellerLoginHistory(req.user);
  }
  @Post('sellers/:publicId/private-details') @RequireRoles('SUPER_ADMIN') sellerPrivateDetails(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') id: string,
    @Body() input: ViewSellerPrivateDetailsDto,
  ) {
    return this.admin.sellerPrivateDetails(req.user, id, input.reason);
  }
  @Get('listings') @RequireRoles('SUPER_ADMIN', 'MODERATOR') listings(@Query('page') rawPage?: string) {
    const page = Number(rawPage ?? 1);
    return this.admin.allListings(Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1);
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
  @Get('orders') @RequireRoles('SUPER_ADMIN', 'SUPPORT_ADMIN', 'DISPUTE_ADMIN') orders() {
    return this.admin.orders();
  }
  @Get('risk-events') @RequireRoles('SUPER_ADMIN', 'SECURITY_ADMIN') riskEvents() {
    return this.admin.riskEvents();
  }
  @Patch('risk-events/:id/review') @RequireRoles('SUPER_ADMIN', 'SECURITY_ADMIN') reviewRisk(
    @Req() req: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() input: ResolveSecurityEventDto,
  ) {
    return this.admin.reviewRisk(req.user, id, input.resolution);
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
