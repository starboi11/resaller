-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustEvent" ADD CONSTRAINT "TrustEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_legalVersionId_fkey" FOREIGN KEY ("legalVersionId") REFERENCES "LegalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicySnapshot" ADD CONSTRAINT "PolicySnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants enforced by PostgreSQL, not only application code.
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_priceMinor_nonnegative" CHECK ("priceMinor" >= 0);
ALTER TABLE "ListingVariant" ADD CONSTRAINT "ListingVariant_priceOverrideMinor_nonnegative" CHECK ("priceOverrideMinor" IS NULL OR "priceOverrideMinor" >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_quantities_nonnegative" CHECK ("available" >= 0 AND "reserved" >= 0 AND "version" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalMinor_nonnegative" CHECK ("totalMinor" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_acceptance_after_creation" CHECK ("sellerAcceptBy" > "createdAt");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values_positive" CHECK ("quantity" > 0 AND "unitPriceMinor" >= 0);
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_nonnegative" CHECK ("valueMinor" >= 0 AND ("minimumMinor" IS NULL OR "minimumMinor" >= 0) AND ("maximumDiscountMinor" IS NULL OR "maximumDiscountMinor" >= 0));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_schedule_valid" CHECK ("endsAt" > "startsAt");
