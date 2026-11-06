/**
 * Buyer-facing listing filter. Only the owner sells on Resaller (owner
 * decision 2026-11-03): buyers see the owner's own listings and nothing else,
 * never another store's, a supplier's, or a former resale listing.
 *
 * OWNER_STORE_USERNAME names that store. It is read on every call because the
 * environment file is loaded after modules are imported. When it is unset
 * (local development before the owner store exists) no store filter applies.
 */
export const ownerStoreUsername = (): string | undefined => process.env.OWNER_STORE_USERNAME || undefined;

export const isOwnerStore = (store: { username: string }): boolean => {
  const owner = ownerStoreUsername();
  return !owner || store.username === owner;
};

export const buyerVisibleListing = () => {
  const owner = ownerStoreUsername();
  return {
    deletedAt: null,
    sourceListingId: null,
    // AND keeps this condition even when a call site sets its own `store` filter.
    AND: owner ? [{ store: { username: owner } }] : [],
  };
};
