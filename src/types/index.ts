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

export type CashWithdrawalPaymentMethod = 'dinheiro' | 'pix';

export interface CashWithdrawal {
  id: string;
  closureId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  dateTime: string; // ISO string
  cashierName: string;
  reason: string;
  amount: number;
  paymentMethod: CashWithdrawalPaymentMethod;
  responsibleUid: string;
  responsibleName: string;
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  debitFromBankAccount?: boolean;
  bankAccountId?: string;
  bankAccountName?: string;
  bankTransactionId?: string;
  linkedOperationId?: string;
  createdAt: string;
  updatedAt: string;
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
  expensesPix?: number; // Total de saídas pagas via Pix
  valesCash: number;
  countedCash: number;
  expectedCash: number;
  cashDifference: number; // countedCash - expectedCash (positive = sobra, negative = falta)
  totalSales: number; // cashIn + pixIn + creditCardIn + debitCardIn + otherIn
  netCash?: number; // Total entradas dinheiro - saídas dinheiro
  netPix?: number; // Total entradas Pix - saídas Pix
  totalExpenses?: number; // Total geral de saídas (expensesCash + expensesPix + valesCash)
  netTotal?: number; // Movimento líquido total (totalSales - totalExpenses)
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

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'despesa' | 'vale';
  color?: string;
  description?: string;
  isDefault?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vale {
  id: string;
  employeeName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string; // Categoria do vale (ex: Adiantamento Salarial, Transporte, etc.)
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

export type BoletoStatus = 'pendente' | 'pago' | 'cancelado';

export interface Boleto {
  id: string;
  dueDate: string; // YYYY-MM-DD Data de vencimento
  beneficiary: string; // Fornecedor / Cedente
  description: string; // Descrição do boleto/serviço
  amount: number; // Valor R$
  category: string; // Categoria
  barcode?: string; // Código de barras / Linha digitável
  status: BoletoStatus;
  notes?: string;
  bankAccountId?: string; // Conta bancária prevista para pagamento
  bankAccountName?: string;
  paidDate?: string;
  paidAmount?: number;
  paidVia?: 'caixa' | 'banco';
  paidBankAccountId?: string;
  paidBankAccountName?: string;
  relatedExpenseId?: string;
  relatedTransactionId?: string;
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
  visibility?: 'shared' | 'private';
  ownerUid?: string;
  ownerUsername?: string;
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
  visibility?: 'shared' | 'private';
  ownerUid?: string;
  cashWithdrawalId?: string;
  linkedOperationId?: string;
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedTransferId?: string;
  relatedClosureId?: string;
  relatedExpenseId?: string;
  status: 'active' | 'cancelled';
  balanceAfter?: number;
  notes?: string;
  documentNumber?: string;
  responsibleName?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
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
  action: 'create' | 'update' | 'cancel' | 'reopen' | 'settle' | 'delete' | 'login' | 'password_reset' | 'review';
  entityType: 'closure' | 'expense' | 'vale' | 'boleto' | 'bank_account' | 'bank_transaction' | 'receivable' | 'calendar_note' | 'notepad_note' | 'user' | 'auth' | 'audit_log' | 'category';
  entityId: string;
  details: string;
  userUid: string;
  userUsername?: string;
  userEmail?: string;
  createdAt: string;
}

export type NotepadCategory = 
  | 'geral' 
  | 'aviso_caixa' 
  | 'pendencia' 
  | 'lembrete' 
  | 'revisao_gerente' 
  | 'fornecedor' 
  | 'financeiro' 
  | 'manutencao';

export type NotepadPriority = 'baixa' | 'media' | 'alta';

export type NotepadStatus = 'pendente' | 'em_analise' | 'revisado' | 'arquivado';

export interface NotepadNote {
  id: string;
  title: string;
  content: string;
  category: NotepadCategory;
  priority: NotepadPriority;
  status: NotepadStatus;
  isPinned?: boolean;
  targetDate?: string; // YYYY-MM-DD (data para revisão)
  authorUid: string;
  authorName: string;
  authorRole?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}
