import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { OperationsService } from './operations.service.js';
import { AddCartItemDto, AnswerDto, CancellationRequestDto, CheckoutDto, MessageDto, QuestionDto, ReviewDto, TransitionOrderDto } from './operations.dto.js';
import type { OrderState } from '../orders/order-policy.js';

@Controller()
@UseGuards(SessionGuard)
export class OperationsController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}
  @Get('cart') cart(@Req() req: FastifyRequest & { user: AuthenticatedUser }) { return this.operations.cart(req.user.id); }
  @Post('cart/items') add(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Body() input: AddCartItemDto) { return this.operations.addCartItem(req.user.id, input); }
  @Post('checkout') checkout(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Body() input: CheckoutDto) { return this.operations.checkout(req.user, input); }
  @Get('orders') orders(@Req() req: FastifyRequest & { user: AuthenticatedUser }) { return this.operations.buyerOrders(req.user.id); }
  @Get('seller/orders') sellerOrders(@Req() req: FastifyRequest & { user: AuthenticatedUser }) { return this.operations.sellerOrders(req.user.id); }
  @Post('orders/:publicId/transition') transition(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') id: string, @Body() input: TransitionOrderDto) { return this.operations.transition(req.user, id, input.to as OrderState, input.reason); }
  @Post('orders/:publicId/cancellation-request') cancellationRequest(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') id: string, @Body() input: CancellationRequestDto) { return this.operations.requestCancellation(req.user, id, input.reason); }
  @Post('orders/:publicId/messages') message(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') id: string, @Body() input: MessageDto) { return this.operations.message(req.user, id, input.body); }
  @Get('orders/:publicId/messages') messages(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') id: string) { return this.operations.messages(req.user, id); }
  @Post('questions') question(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Body() input: QuestionDto) { return this.operations.question(req.user.id, input); }
  @Post('questions/:id/answer') answer(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('id') id: string, @Body() input: AnswerDto) { return this.operations.answer(req.user, id, input.body); }
  @Post('orders/:publicId/review') review(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('publicId') id: string, @Body() input: ReviewDto) { return this.operations.review(req.user.id, id, input); }
  @Get('seller/dashboard') dashboard(@Req() req: FastifyRequest & { user: AuthenticatedUser }) { return this.operations.dashboard(req.user.id); }
}
