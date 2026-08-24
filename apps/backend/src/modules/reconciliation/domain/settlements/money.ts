export function formatMoney(amountCents: number): string {
  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  const cents = absolute % 100;
  const units = (absolute - cents) / 100;
  const grouped = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${sign}$${grouped}.${String(cents).padStart(2, '0')}`;
}
