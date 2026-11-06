import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { SellerCenterService } from './seller-center.service.js';
import { AdjustStockDto, CreateExpenseDto, CreateExternalOrderDto, TransitionExternalOrderDto, UpdateCustomerDto, UpdateDeliveryDto, UpdatePaymentRecordDto } from './seller-center.dto.js';
import { OwnerGuard } from '../owner/owner-access.js';

@Controller('seller-center/stores/:storeId')
// Only the owner store is managed here (OwnerGuard also checks :storeId).
@UseGuards(SessionGuard, OwnerGuard)
export class SellerCenterController {
  constructor(@Inject(SellerCenterService) private readonly center: SellerCenterService) {}

  @Get('dashboard') dashboard(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string) {
    return this.center.dashboard(req.user, storeId);
  }
  @Get('orders') orders(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string) {
    return this.center.orders(req.user, storeId);
  }
  @Post('external-orders') createOrder(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Body() input: CreateExternalOrderDto) {
    return this.center.createExternalOrder(req.user, storeId, input);
  }
  @Get('external-orders/:orderId') order(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('orderId') orderId: string) {
    return this.center.externalOrder(req.user, storeId, orderId);
  }
  @Post('external-orders/:orderId/transition') transition(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('orderId') orderId: string, @Body() input: TransitionExternalOrderDto) {
    return this.center.transition(req.user, storeId, orderId, input);
  }
  @Patch('external-orders/:orderId/delivery') delivery(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('orderId') orderId: string, @Body() input: UpdateDeliveryDto) {
    return this.center.updateDelivery(req.user, storeId, orderId, input);
  }
  @Patch('external-orders/:orderId/payment-record') paymentRecord(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('orderId') orderId: string, @Body() input: UpdatePaymentRecordDto) {
    return this.center.updatePaymentRecord(req.user, storeId, orderId, input);
  }
  @Get('inventory') inventory(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string) {
    return this.center.inventory(req.user, storeId);
  }
  @Post('inventory/adjust') adjustStock(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Body() input: AdjustStockDto) {
    return this.center.adjustStock(req.user, storeId, input);
  }
  @Get('customers') customers(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string) {
    return this.center.customers(req.user, storeId);
  }
  @Get('customers/:customerId/orders') customerOrders(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('customerId') customerId: string) {
    return this.center.customerOrders(req.user, storeId, customerId);
  }
  @Patch('customers/:customerId') customer(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Param('customerId') customerId: string, @Body() input: UpdateCustomerDto) {
    return this.center.updateCustomer(req.user, storeId, customerId, input);
  }
  @Get('finance') finance(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Query('period') period?: string) {
    if (period && !['1', '7', '30'].includes(period)) throw new BadRequestException('Period must be 1, 7 or 30 days');
    return this.center.finance(req.user, storeId, Number(period ?? 30));
  }
  @Post('expenses') expense(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string, @Body() input: CreateExpenseDto) {
    return this.center.createExpense(req.user, storeId, input);
  }
  @Get('assistant-context') assistantContext(@Req() req: FastifyRequest & { user: AuthenticatedUser }, @Param('storeId') storeId: string) {
    return this.center.assistantContext(req.user, storeId);
  }
}
