const DEFAULT_AUTH_API_BASE = 'https://uncandid-overmighty-jodie.ngrok-free.dev';

export function getWhatsAppAuthBase() {
  return (
    process.env.WHATSAPP_AUTH_API_BASE ||
    process.env.NEXT_PUBLIC_WHATSAPP_AUTH_API_BASE ||
    DEFAULT_AUTH_API_BASE
  );
}

export function getWhatsAppAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  };
}

export function normalizePhone(input = '') {
  const trimmed = String(input).trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `${hasPlus ? '+' : ''}${digits}`;
}

export function phoneKey(phone = '') {
  return normalizePhone(phone).replace(/\D/g, '');
}
