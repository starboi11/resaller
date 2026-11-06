import SellerCenterClient from './seller-center-client';

export default async function SellerCenterPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <SellerCenterClient storeId={storeId} />;
}
