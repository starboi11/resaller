import { PLATFORM_BUSINESS_RULES } from '@resaller/types';

export const SELLER_ACCEPTANCE_MINUTES = PLATFORM_BUSINESS_RULES.sellerAcceptanceMinutes;

export type OrderState =
  | 'WAITING_SELLER' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SHIPPED'
  | 'DELIVERED' | 'COMPLETED' | 'REJECTED' | 'TIMEOUT' | 'CANCELLED'
  | 'RETURN_REQUESTED' | 'DISPUTED';

const transitions: Readonly<Record<OrderState, readonly OrderState[]>> = {
  WAITING_SELLER: ['ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED', 'DISPUTED'],
  PREPARING: ['READY', 'CANCELLED', 'DISPUTED'],
  READY: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'DISPUTED'],
  SHIPPED: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'RETURN_REQUESTED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],
  RETURN_REQUESTED: ['DISPUTED', 'COMPLETED'],
  REJECTED: [], TIMEOUT: [], CANCELLED: [], DISPUTED: [],
};

export const sellerAcceptBy = (createdAt: Date): Date =>
  new Date(createdAt.getTime() + SELLER_ACCEPTANCE_MINUTES * 60_000);

export const canTransitionOrder = (from: OrderState, to: OrderState): boolean =>
  transitions[from].includes(to);

export const buyerCanCancelDirectly = (state: OrderState): boolean => state === 'WAITING_SELLER';
