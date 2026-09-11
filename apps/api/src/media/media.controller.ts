import { Controller, Get, Inject, Param, Post, Req, Res, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { MediaService } from './media.service.js';

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}
  @Post('listings/:publicId/images')
  @UseGuards(SessionGuard)
  async upload(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string) {
    const file = await request.file();
    if (!file) throw new UnsupportedMediaTypeException('Image file is required');
    return this.media.uploadListingImage(request.user.id, publicId, await file.toBuffer());
  }
  @Get(':storageKey')
  async image(@Param('storageKey') storageKey: string, @Res() reply: FastifyReply) {
    const image = await this.media.publicImage(storageKey);
    return reply.header('cache-control', 'public, max-age=86400, immutable').type(image.mimeType).send(image.bytes);
  }
}
