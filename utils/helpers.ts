import { ExpiryStatus, Currency } from '../types.ts';

export const formatCurrency = (amount: number, currency: Currency = 'INR') => {
  const locale = currency === 'NPR' ? 'ne-NP' : 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const getExpiryStatus = (expiryDateStr: string): ExpiryStatus => {
  if (!expiryDateStr) return ExpiryStatus.ACTIVE;
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  const diffInDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) return ExpiryStatus.EXPIRED;
  if (diffInDays <= 30) return ExpiryStatus.EXPIRING;
  return ExpiryStatus.ACTIVE;
};

export const getStatusColor = (status: ExpiryStatus) => {
  switch (status) {
    case ExpiryStatus.EXPIRED: return 'bg-red-100 text-red-700 border-red-200';
    case ExpiryStatus.EXPIRING: return 'bg-amber-100 text-amber-700 border-amber-200';
    case ExpiryStatus.ACTIVE: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
};

export const encrypt = (text: string): string => btoa(text);
export const decrypt = (text: string): string => atob(text);

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getDaysRemaining = (date: string) => {
  if (!date) return 0;
  const diff = new Date(date).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};