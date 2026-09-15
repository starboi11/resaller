import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { RequireRoles } from '../auth/roles.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { MediaService } from './media.service.js';

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}
  @Post('listings/:publicId/images')
  @UseGuards(SessionGuard)
  async upload(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    const file = await request.file();
    if (!file)
      throw new UnsupportedMediaTypeException('Image file is required');
    const variantField = file.fields.variantId;
    const variantId = variantField && !Array.isArray(variantField) && 'value' in variantField
      ? String(variantField.value)
      : undefined;
    return this.media.uploadListingImage(
      request.user.id,
      publicId,
      await file.toBuffer(),
      variantId,
    );
  }
  @Post('verification/document')
  @UseGuards(SessionGuard)
  async uploadVerification(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
  ) {
    const file = await request.file();
    if (!file)
      throw new UnsupportedMediaTypeException(
        'Verification document is required',
      );
    return this.media.uploadVerificationDocument(
      request.user.id,
      await file.toBuffer(),
    );
  }
  @Post('messages/:messageId/attachment')
  @UseGuards(SessionGuard)
  async uploadMessageAttachment(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('messageId') messageId: string,
  ) {
    const file = await request.file();
    if (!file)
      throw new UnsupportedMediaTypeException('Attachment file is required');
    return this.media.uploadMessageAttachment(
      request.user,
      messageId,
      await file.toBuffer(),
      file.filename,
    );
  }
  @Get('private/attachments/:id')
  @UseGuards(SessionGuard)
  async messageAttachment(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.media.messageAttachment(request.user, id);
    return reply
      .header('cache-control', 'private, no-store')
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      )
      .type(file.mimeType)
      .send(file.bytes);
  }
  @Post('disputes/:disputeId/evidence')
  @UseGuards(SessionGuard)
  async uploadDisputeEvidence(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('disputeId') disputeId: string,
  ) {
    const file = await request.file();
    if (!file)
      throw new UnsupportedMediaTypeException('Evidence file is required');
    return this.media.uploadDisputeEvidence(
      request.user,
      disputeId,
      await file.toBuffer(),
      file.filename,
    );
  }
  @Get('private/dispute-evidence/:id')
  @UseGuards(SessionGuard)
  async disputeEvidence(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.media.disputeEvidence(request.user, id);
    return reply
      .header('cache-control', 'private, no-store')
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      )
      .type(file.mimeType)
      .send(file.bytes);
  }
  @Get('private/verifications/:id/document')
  @UseGuards(SessionGuard, RolesGuard)
  @RequireRoles('VERIFICATION_ADMIN')
  async verificationDocument(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const document = await this.media.verificationDocument(request.user.id, id);
    return reply
      .header('cache-control', 'private, no-store')
      .header('content-disposition', 'inline')
      .type(document.mimeType)
      .send(document.bytes);
  }
  @Get(':storageKey')
  async image(
    @Param('storageKey') storageKey: string,
    @Res() reply: FastifyReply,
  ) {
    const image = await this.media.publicImage(storageKey);
    return reply
      .header('cache-control', 'public, max-age=86400, immutable')
      .type(image.mimeType)
      .send(image.bytes);
  }
}
