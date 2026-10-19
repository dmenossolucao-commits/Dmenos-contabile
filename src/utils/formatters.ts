// Formatting helpers for Brazilian currency (BRL) and dates (DD/MM/AAAA)

export function formatCurrency(value: number | null | undefined): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function parseCurrencyInput(valueStr: string): number {
  if (!valueStr) return 0;
  // Remove R$, spaces, dots (thousands) and replace comma with dot
  const clean = valueStr
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDateBR(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '-';
  try {
    let dateObj: Date;
    if (typeof dateInput === 'string') {
      // Check YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, d] = dateInput.split('-').map(Number);
        dateObj = new Date(y, m - 1, d);
      } else {
        dateObj = new Date(dateInput);
      }
    } else {
      dateObj = dateInput;
    }
    if (isNaN(dateObj.getTime())) return String(dateInput);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

export function formatDateTimeBR(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '-';
  try {
    const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(dateObj.getTime())) return String(dateInput);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${mins}`;
  } catch {
    return String(dateInput);
  }
}

export function getTodayDateBR(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function maskAccount(accountNumber: string): string {
  if (!accountNumber) return '';
  const clean = accountNumber.trim();
  if (clean.length <= 4) return clean;
  const visible = clean.slice(-4);
  return '•••• ' + visible;
}

export interface BankBalanceDetails {
  initialBalance: number;
  totalEntradas: number;
  totalSaidas: number;
  currentBalance: number;
}

/**
 * Calculates bank account balance strictly based on:
 * Saldo bancário atual = saldo inicial da conta + total de entradas bancárias confirmadas - total de saídas bancárias confirmadas.
 * - Completely excludes daily closures and closure-related entries.
 * - Transfers sent reduce source account; transfers received increase destination account.
 * - Opening balance is never duplicated.
 */
export function computeBankAccountBalance(
  account: { id: string; initialBalance: number },
  transactions: Array<{
    id?: string;
    accountId: string;
    amount: number;
    status: string;
    relatedClosureId?: string;
    category?: string;
  }>
): BankBalanceDetails {
  const initialBalance = Number(account?.initialBalance) || 0;

  if (!transactions || !Array.isArray(transactions)) {
    return {
      initialBalance,
      totalEntradas: 0,
      totalSaidas: 0,
      currentBalance: initialBalance,
    };
  }

  // Filter active transactions strictly belonging to this account
  // EXCLUDE any closure contamination or duplicate opening balance
  const accountTrans = transactions.filter(
    (t) =>
      t.accountId === account.id &&
      t.status === 'active' &&
      !t.relatedClosureId &&
      t.category !== 'Saldo de Abertura' &&
      !t.id?.startsWith('bt_init_')
  );

  let totalEntradas = 0;
  let totalSaidas = 0;

  for (const t of accountTrans) {
    const amt = Number(t.amount) || 0;
    if (amt > 0) {
      totalEntradas += amt;
    } else if (amt < 0) {
      totalSaidas += Math.abs(amt);
    }
  }

  const currentBalance = initialBalance + totalEntradas - totalSaidas;

  return {
    initialBalance,
    totalEntradas,
    totalSaidas,
    currentBalance,
  };
}

