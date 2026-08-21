export const C = {
  bg: '#070B14',
  surface: '#0E1524',
  surface2: '#161F33',
  surface3: '#1D2942',
  border: 'rgba(148,163,184,0.10)',
  border2: 'rgba(148,163,184,0.20)',
  text: '#F1F5F9',
  sub: '#9AA7BD',
  faint: '#5E6B85',
  amber: '#FFB454',
  amber2: '#F59E0B',
  green: '#34D399',
  red: '#FB7185',
  violet: '#A78BFA',
  blue: '#60A5FA',
  teal: '#2DD4BF',
  pink: '#F472B6',
};

export const S = { xs: 4, s: 8, m: 12, l: 16, xl: 22, xxl: 28 };
export const R = { m: 12, l: 16, xl: 20, xxl: 26, pill: 999 };

export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

export function inr(n: number): string {
  const v = Math.round(n);
  try {
    return '₹' + v.toLocaleString('en-IN');
  } catch {
    return '₹' + String(v);
  }
}
