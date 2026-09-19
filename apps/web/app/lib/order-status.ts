const labels: Record<string, string> = {
  WAITING_SELLER: 'Sotuvchi javobi kutilmoqda',
  ACCEPTED: 'Qabul qilindi',
  PREPARING: 'Tayyorlanmoqda',
  READY: 'Jo‘natishga tayyor',
  SHIPPED: 'Jo‘natildi',
  DELIVERED: 'Yetkazildi',
  COMPLETED: 'Yakunlandi',
  CANCELLED: 'Bekor qilindi',
  REJECTED: 'Rad etildi',
  TIMEOUT: 'Javob muddati tugadi',
  RETURN_REQUESTED: 'Qaytarish so‘raldi',
  RETURN_APPROVED: 'Qaytarish tasdiqlandi',
  RETURN_REJECTED: 'Qaytarish rad etildi',
  DISPUTED: 'Nizo ko‘rib chiqilmoqda',
};

export function orderStatusLabel(status: string): string {
  return (
    labels[status] ?? status.replaceAll('_', ' ').toLocaleLowerCase('uz-UZ')
  );
}
