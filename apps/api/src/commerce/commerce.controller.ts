import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { CommerceService } from './commerce.service.js';
import { AddStoreMemberDto, CreateListingDto, CreateStoreDto, MarketplaceQueryDto, SellerVerificationDto, StoreSettingsDto, UpdateListingDto, VacationModeDto } from './commerce.dto.js';

@Controller()
export class CommerceController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  @Post('seller/apply') @UseGuards(SessionGuard)
  apply(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.commerce.applySeller(request.user); }

  @Post('seller/verification') @UseGuards(SessionGuard)
  verification(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Body() input: SellerVerificationDto) { return this.commerce.submitVerification(request.user.id, input); }

  @Post('stores') @UseGuards(SessionGuard)
  createStore(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Body() input: CreateStoreDto) { return this.commerce.createStore(request.user, input); }

  @Get('stores/:username')
  store(@Param('username') username: string) { return this.commerce.getStore(username); }

  @Patch('stores/:publicId/settings') @UseGuards(SessionGuard)
  settings(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Body() input: StoreSettingsDto) { return this.commerce.updateStoreSettings(request.user, publicId, input); }

  @Patch('stores/:publicId/vacation') @UseGuards(SessionGuard)
  vacation(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Body() input: VacationModeDto) { return this.commerce.setVacationMode(request.user, publicId, input.enabled); }

  @Post('stores/:publicId/members') @UseGuards(SessionGuard)
  member(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Body() input: AddStoreMemberDto) { return this.commerce.addStoreMember(request.user, publicId, input); }

  @Delete('stores/:publicId/members/:username') @UseGuards(SessionGuard)
  removeMember(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Param('username') username: string) { return this.commerce.removeStoreMember(request.user, publicId, username); }

  @Post('stores/:publicId/listings') @UseGuards(SessionGuard)
  createListing(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Body() input: CreateListingDto) { return this.commerce.createListing(request.user, publicId, input); }

  @Patch('listings/:publicId') @UseGuards(SessionGuard)
  updateListing(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string, @Body() input: UpdateListingDto) { return this.commerce.updateListing(request.user, publicId, input); }

  @Post('listings/:publicId/submit') @UseGuards(SessionGuard)
  submitListing(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string) { return this.commerce.submitListing(request.user, publicId); }

  @Get('marketplace/listings')
  marketplace(@Query() query: MarketplaceQueryDto) { return this.commerce.marketplace(query); }

  @Get('marketplace/listings/:publicId')
  listing(@Param('publicId') publicId: string) { return this.commerce.getListing(publicId); }

  @Get('favorites') @UseGuards(SessionGuard)
  favorites(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.commerce.favorites(request.user.id); }

  @Post('favorites/:listingPublicId') @UseGuards(SessionGuard)
  favorite(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('listingPublicId') listingPublicId: string) { return this.commerce.favorite(request.user.id, listingPublicId); }

  @Delete('favorites/:listingPublicId') @UseGuards(SessionGuard)
  unfavorite(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('listingPublicId') listingPublicId: string) { return this.commerce.unfavorite(request.user.id, listingPublicId); }

  @Post('stores/:publicId/follow') @UseGuards(SessionGuard)
  follow(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string) { return this.commerce.follow(request.user.id, publicId); }

  @Delete('stores/:publicId/follow') @UseGuards(SessionGuard)
  unfollow(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') publicId: string) { return this.commerce.unfollow(request.user.id, publicId); }
}
