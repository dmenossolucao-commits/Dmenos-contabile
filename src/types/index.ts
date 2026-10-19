export type UserRole = 'admin' | 'employee';

export interface UserPermissions {
  canViewDashboard: boolean;
  canManageClosures: boolean; // registrar e consultar fechamentos
  canManageExpenses: boolean; // registrar despesas
  canManageVales: boolean; // registrar e quitar vales
  canManageBankAccounts: boolean; // visualizar e movimentar bancos
  canViewHistory: boolean; // consultar histórico geral
  canManageCalendar: boolean; // criar e gerenciar anotações
  canViewReports: boolean; // emitir e compartilhar relatórios
}

export function getDefaultPermissions(role: UserRole): UserPermissions {
  if (role === 'admin') {
    return {
      canViewDashboard: true,
      canManageClosures: true,
      canManageExpenses: true,
      canManageVales: true,
      canManageBankAccounts: true,
      canViewHistory: true,
      canManageCalendar: true,
      canViewReports: true,
    };
  }
  return {
    canViewDashboard: true,
    canManageClosures: true,
    canManageExpenses: true,
    canManageVales: true,
    canManageBankAccounts: false,
    canViewHistory: false,
    canManageCalendar: true,
    canViewReports: false,
  };
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'blocked';
  permissions: UserPermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAllocation {
  method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'outros';
  label: string;
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  targetAccountId: string;
  targetAccountName: string;
  destinationType: 'banco_imediato' | 'valor_a_receber' | 'caixa_fisico';
  status: 'confirmado' | 'pendente_liquidacao';
}

export interface DailyClosure {
  id: string;
  date: string; // YYYY-MM-DD
  cashierName: string;
  responsibleUid: string;
  responsibleUsername?: string;
  initialCash: number;
  cashIn: number;
  pixIn: number;
  creditCardIn: number;
  debitCardIn: number;
  otherIn: number;
  otherInDescription?: string;
  expensesCash: number;
  valesCash: number;
  countedCash: number;
  expectedCash: number;
  cashDifference: number; // countedCash - expectedCash (positive = sobra, negative = falta)
  totalSales: number; // cashIn + pixIn + creditCardIn + debitCardIn + otherIn
  status: 'closed' | 'reopened';
  notes?: string;
  bankAllocations?: BankAllocation[];
  reopenedReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseType = 'despesa' | 'vale';
export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'transferencia' | 'boleto';
export type MoneySource = 'caixa' | 'banco' | 'outro';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  type: ExpenseType;
  description: string;
  category: string;
  amount: number;
  entityName?: string;
  paymentMethod: PaymentMethod;
  moneySource: MoneySource;
  bankAccountId?: string;
  bankAccountName?: string;
  closureId?: string;
  notes?: string;
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vale {
  id: string;
  employeeName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  moneySource: MoneySource;
  bankAccountId?: string;
  bankAccountName?: string;
  status: 'pendente' | 'quitado' | 'cancelado';
  settledDate?: string;
  settledMethod?: string;
  settledNotes?: string;
  settledBy?: string;
  notes?: string;
  closureId?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BankAccountType = 'corrente' | 'poupanca' | 'pagamento' | 'investimento';

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountType: BankAccountType;
  agency?: string;
  accountNumberMasked: string;
  initialBalance: number;
  initialBalanceDate: string;
  currentBalance: number;
  status: 'active' | 'inactive';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BankTransactionType = 
  | 'deposito' 
  | 'saque' 
  | 'transferencia_saida' 
  | 'transferencia_entrada' 
  | 'recebimento' 
  | 'pagamento' 
  | 'tarifa' 
  | 'ajuste';

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  category: string;
  amount: number; // positive for inflows, negative for outflows
  type: BankTransactionType;
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedTransferId?: string;
  relatedClosureId?: string;
  relatedExpenseId?: string;
  status: 'active' | 'cancelled';
  balanceAfter?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface Receivable {
  id: string;
  closureId: string;
  date: string;
  cardType: 'credito' | 'debito';
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  targetAccountId: string;
  targetAccountName: string;
  expectedCreditDate: string;
  status: 'pendente' | 'creditado' | 'cancelado';
  creditedDate?: string;
  creditedTransactionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarCategory = 
  | 'fornecedor' 
  | 'conta' 
  | 'extrato' 
  | 'fechamento' 
  | 'mercadoria' 
  | 'compromisso' 
  | 'outro';

export interface CalendarNote {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category: CalendarCategory;
  reminder: boolean;
  status: 'pendente' | 'concluida';
  completedAt?: string;
  completedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'cancel' | 'reopen' | 'settle' | 'delete' | 'login' | 'password_reset';
  entityType: 'closure' | 'expense' | 'vale' | 'bank_account' | 'bank_transaction' | 'receivable' | 'calendar_note' | 'user' | 'auth' | 'audit_log';
  entityId: string;
  details: string;
  userUid: string;
  userUsername?: string;
  userEmail?: string;
  createdAt: string;
}
