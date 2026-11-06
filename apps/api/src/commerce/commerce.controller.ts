import {
  GoneException,
  Body,
  Controller,
  Delete,
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
import { OwnerGuard } from '../owner/owner-access.js';
import { CommerceService } from './commerce.service.js';
import {
  AddStoreMemberDto,
  CreateListingDto,
  CreateStoreDto,
  CreateVariantDto,
  CreateCouponDto,
  CreatePromotionDto,
  CreateTestimonialDto,
  CreateCollectionDto,
  MediaOrderDto,
  MarketplaceQueryDto,
  SellerVerificationDto,
  StoreSettingsDto,
  UpdateListingDto,
  UpdateVariantDto,
  VacationModeDto,
} from './commerce.dto.js';

@Controller()
export class CommerceController {
  constructor(
    @Inject(CommerceService) private readonly commerce: CommerceService,
  ) {}

  @Post('seller/apply')
  @UseGuards(SessionGuard)
  apply(@Req() request: FastifyRequest & { user: AuthenticatedUser }) {
    // Closed by the owner-only decision (2026-11-03); kept as 410 so old clients get a clear answer.
    throw new GoneException('Bu imkoniyat endi mavjud emas: Resaller’da faqat do‘kon egasi sotadi');
  }

  @Post('seller/verification')
  @UseGuards(SessionGuard)
  verification(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Body() input: SellerVerificationDto,
  ) {
    // Closed by the owner-only decision (2026-11-03); kept as 410 so old clients get a clear answer.
    throw new GoneException('Bu imkoniyat endi mavjud emas: Resaller’da faqat do‘kon egasi sotadi');
  }

  @Get('seller/owner-status')
  @UseGuards(SessionGuard)
  ownerStatus(@Req() request: FastifyRequest & { user: AuthenticatedUser }) {
    return this.commerce.ownerStatus(request.user.id);
  }

  @Get('seller/onboarding')
  @UseGuards(SessionGuard, OwnerGuard)
  onboarding(@Req() request: FastifyRequest & { user: AuthenticatedUser }) {
    return this.commerce.sellerOnboarding(request.user.id);
  }

  @Post('stores')
  @UseGuards(SessionGuard)
  createStore(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Body() input: CreateStoreDto,
  ) {
    // Closed by the owner-only decision (2026-11-03); kept as 410 so old clients get a clear answer.
    throw new GoneException('Bu imkoniyat endi mavjud emas: Resaller’da faqat do‘kon egasi sotadi');
  }

  @Post('stores/:publicId/submit')
  @UseGuards(SessionGuard, OwnerGuard)
  submitStore(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.submitStore(request.user, publicId);
  }

  @Get('seller/stores')
  @UseGuards(SessionGuard, OwnerGuard)
  sellerStores(@Req() request: FastifyRequest & { user: AuthenticatedUser }) {
    return this.commerce.sellerStores(request.user.id);
  }

  @Get('stores/:username')
  store(@Param('username') username: string) {
    return this.commerce.getStore(username);
  }

  @Patch('stores/:publicId/settings')
  @UseGuards(SessionGuard, OwnerGuard)
  settings(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: StoreSettingsDto,
  ) {
    return this.commerce.updateStoreSettings(request.user, publicId, input);
  }

  @Patch('stores/:publicId/vacation')
  @UseGuards(SessionGuard, OwnerGuard)
  vacation(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: VacationModeDto,
  ) {
    return this.commerce.setVacationMode(request.user, publicId, input.enabled);
  }

  @Post('stores/:publicId/members')
  @UseGuards(SessionGuard)
  member(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: AddStoreMemberDto,
  ) {
    // Closed by the owner-only decision (2026-11-03); kept as 410 so old clients get a clear answer.
    throw new GoneException('Bu imkoniyat endi mavjud emas: Resaller’da faqat do‘kon egasi sotadi');
  }

  @Delete('stores/:publicId/members/:username')
  @UseGuards(SessionGuard)
  removeMember(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Param('username') username: string,
  ) {
    // Closed by the owner-only decision (2026-11-03); kept as 410 so old clients get a clear answer.
    throw new GoneException('Bu imkoniyat endi mavjud emas: Resaller’da faqat do‘kon egasi sotadi');
  }

  @Post('stores/:publicId/listings')
  @UseGuards(SessionGuard, OwnerGuard)
  createListing(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreateListingDto,
  ) {
    return this.commerce.createListing(request.user, publicId, input);
  }

  @Get('categories')
  categories() {
    return this.commerce.categories();
  }

  @Post('listings/:publicId/variants')
  @UseGuards(SessionGuard, OwnerGuard)
  createVariant(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreateVariantDto,
  ) {
    return this.commerce.createVariant(request.user, publicId, input);
  }

  @Patch('listings/:publicId/variants/:variantId')
  @UseGuards(SessionGuard, OwnerGuard)
  updateVariant(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateVariantDto,
  ) {
    return this.commerce.updateVariant(
      request.user,
      publicId,
      variantId,
      input,
    );
  }

  @Delete('listings/:publicId/variants/:variantId')
  @UseGuards(SessionGuard, OwnerGuard)
  removeVariant(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.commerce.removeVariant(request.user, publicId, variantId);
  }

  @Patch('listings/:publicId')
  @UseGuards(SessionGuard, OwnerGuard)
  updateListing(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: UpdateListingDto,
  ) {
    return this.commerce.updateListing(request.user, publicId, input);
  }

  @Post('listings/:publicId/submit')
  @UseGuards(SessionGuard, OwnerGuard)
  submitListing(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.submitListing(request.user, publicId);
  }
  @Patch('listings/:publicId/media-order') @UseGuards(SessionGuard, OwnerGuard) mediaOrder(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: MediaOrderDto,
  ) {
    return this.commerce.reorderMedia(request.user, publicId, input.ids);
  }
  @Post('stores/:publicId/collections') @UseGuards(SessionGuard, OwnerGuard) collection(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreateCollectionDto,
  ) {
    return this.commerce.createCollection(request.user, publicId, input);
  }

  @Get('marketplace/listings')
  marketplace(@Query() query: MarketplaceQueryDto) {
    return this.commerce.marketplace(query);
  }

  @Get('marketplace/listings/:publicId')
  listing(@Param('publicId') publicId: string) {
    return this.commerce.getListing(publicId);
  }

  @Get('favorites')
  @UseGuards(SessionGuard)
  favorites(@Req() request: FastifyRequest & { user: AuthenticatedUser }) {
    return this.commerce.favorites(request.user.id);
  }

  @Post('favorites/:listingPublicId')
  @UseGuards(SessionGuard)
  favorite(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('listingPublicId') listingPublicId: string,
  ) {
    return this.commerce.favorite(request.user.id, listingPublicId);
  }

  @Delete('favorites/:listingPublicId')
  @UseGuards(SessionGuard)
  unfavorite(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('listingPublicId') listingPublicId: string,
  ) {
    return this.commerce.unfavorite(request.user.id, listingPublicId);
  }

  @Post('stores/:publicId/follow')
  @UseGuards(SessionGuard)
  follow(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.follow(request.user.id, publicId);
  }

  @Delete('stores/:publicId/follow')
  @UseGuards(SessionGuard)
  unfollow(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.unfollow(request.user.id, publicId);
  }

  @Get('stores/:publicId/marketing')
  @UseGuards(SessionGuard, OwnerGuard)
  marketing(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.marketing(request.user, publicId);
  }

  @Post('stores/:publicId/testimonials')
  @UseGuards(SessionGuard, OwnerGuard)
  testimonial(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreateTestimonialDto,
  ) {
    return this.commerce.createTestimonial(request.user, publicId, input);
  }

  @Delete('stores/:publicId/testimonials/:id')
  @UseGuards(SessionGuard, OwnerGuard)
  removeTestimonial(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Param('id') id: string,
  ) {
    return this.commerce.removeTestimonial(request.user, publicId, id);
  }

  @Post('stores/:publicId/coupons')
  @UseGuards(SessionGuard, OwnerGuard)
  coupon(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreateCouponDto,
  ) {
    return this.commerce.createCoupon(request.user, publicId, input);
  }

  @Patch('stores/:publicId/coupons/:id/toggle')
  @UseGuards(SessionGuard, OwnerGuard)
  couponToggle(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Param('id') id: string,
  ) {
    return this.commerce.toggleCoupon(request.user, publicId, id);
  }

  @Post('stores/:publicId/promotions')
  @UseGuards(SessionGuard, OwnerGuard)
  promotion(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
    @Body() input: CreatePromotionDto,
  ) {
    return this.commerce.createPromotion(request.user, publicId, input);
  }

  @Get('stores/:publicId/analytics')
  @UseGuards(SessionGuard, OwnerGuard)
  analytics(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Param('publicId') publicId: string,
  ) {
    return this.commerce.analytics(request.user, publicId);
  }
}
