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

export function parseCurrencyInput(valueStr: string | number | null | undefined): number {
  if (valueStr === undefined || valueStr === null || valueStr === '') return 0;
  if (typeof valueStr === 'number') return isNaN(valueStr) ? 0 : valueStr;

  let str = String(valueStr).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;

  // Case 1: Both dot and comma exist: "1.250,50" or "1,250.50"
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Standard BR: 1.250,50 -> remove dots, replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US style: 1,250.50 -> remove commas
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma: "10,50" -> "10.50"
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Only dot: e.g. "10.50" or "1.000.000"
    const dotParts = str.split('.');
    if (dotParts.length === 2) {
      // Exactly one dot. If decimals part is 2 digits or not 3 digits, it's definitely a decimal point.
      // E.g. "10.50" -> 10.50, "10.5" -> 10.5
      // Even if 3 digits, on modern mobile numeric keyboards decimal dot is typed for cents.
      str = dotParts[0] + '.' + dotParts[1];
    } else {
      // Multiple dots: "1.000.000" -> thousands separators
      str = str.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(str);
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

