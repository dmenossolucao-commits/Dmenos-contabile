import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase';
import { useAuth } from './AuthContext';
import { computeBankAccountBalance, formatCurrency } from '../utils/formatters';
import {
  DailyClosure,
  Expense,
  Vale,
  Boleto,
  BankAccount,
  BankTransaction,
  Receivable,
  CalendarNote,
  AuditLog,
  UserProfile,
  UserRole,
  FinancialCategory,
  CashWithdrawal,
  NotepadNote,
  NotepadCategory,
  NotepadPriority,
  NotepadStatus
} from '../types';

interface FinanceContextType {
  closures: DailyClosure[];
  cashWithdrawals: CashWithdrawal[];
  expenses: Expense[];
  vales: Vale[];
  boletos: Boleto[];
  categories: FinancialCategory[];
  expenseCategories: string[];
  valeCategories: string[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  receivables: Receivable[];
  calendarNotes: CalendarNote[];
  notepadNotes: NotepadNote[];
  auditLogs: AuditLog[];
  systemUsers: UserProfile[];
  loading: boolean;
  activeBankAccount: BankAccount | null;
  setActiveBankAccount: (acc: BankAccount | null) => void;

  // Actions
  saveClosure: (data: Omit<DailyClosure, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  reopenClosure: (closureId: string, reason: string) => Promise<void>;
  updateClosure: (closureId: string, data: Partial<DailyClosure>) => Promise<void>;
  deleteClosure: (closureId: string, reason?: string) => Promise<void>;
  deleteClosuresBatch: (closureIds: string[], reason?: string) => Promise<void>;
  deleteBankTransaction: (transactionId: string, reason?: string) => Promise<void>;
  deleteAccountStatement: (accountId: string, transactionIds?: string[], reason?: string) => Promise<void>;
  clearAuditHistory: (logIds?: string[]) => Promise<void>;
  
  // Cash Withdrawals (Saídas de Caixa no Fechamento)
  createCashWithdrawal: (data: Omit<CashWithdrawal, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<string>;
  cancelCashWithdrawal: (id: string, reason: string) => Promise<void>;
  
  createExpense: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  cancelExpense: (expenseId: string, reason: string) => Promise<void>;

  createVale: (data: Omit<Vale, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  settleVale: (valeId: string, method: string, notes?: string) => Promise<void>;
  cancelVale: (valeId: string, reason: string) => Promise<void>;

  // Category Actions
  createCategory: (data: { name: string; type: 'despesa' | 'vale'; color?: string; description?: string }) => Promise<string>;
  updateCategory: (id: string, data: Partial<FinancialCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  createBoleto: (data: Omit<Boleto, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status'>) => Promise<string>;
  payBoleto: (
    boletoId: string,
    payment: {
      paidDate: string;
      paidAmount: number;
      paidVia: 'caixa' | 'banco';
      paidBankAccountId?: string;
      notes?: string;
    }
  ) => Promise<void>;
  cancelBoleto: (boletoId: string, reason: string) => Promise<void>;
  deleteBoleto: (boletoId: string, reason?: string) => Promise<void>;

  createBankAccount: (data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt' | 'currentBalance'>) => Promise<string>;
  updateBankAccount: (id: string, data: Partial<BankAccount>) => Promise<void>;
  deleteBankAccount: (id: string, reason?: string) => Promise<void>;
  deactivateBankAccount: (id: string, reason?: string) => Promise<void>;
  reactivateBankAccount: (id: string) => Promise<void>;
  createBankTransaction: (data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy' | 'balanceAfter'>) => Promise<string>;
  cancelBankTransaction: (transactionId: string, reason: string) => Promise<void>;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number, date: string, description: string, notes?: string, documentNumber?: string) => Promise<void>;
  confirmReceivableCredit: (receivableId: string, accountId: string, creditDate: string, notes?: string) => Promise<void>;

  createCalendarNote: (data: Omit<CalendarNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  toggleCalendarNoteStatus: (id: string) => Promise<void>;
  deleteCalendarNote: (id: string) => Promise<void>;

  // Notepad Notes (Bloco de Notas & Revisão Posterior)
  createNotepadNote: (data: {
    title: string;
    content: string;
    category: NotepadCategory;
    priority: NotepadPriority;
    targetDate?: string;
    isPinned?: boolean;
    status?: NotepadStatus;
  }) => Promise<string>;
  updateNotepadNote: (id: string, data: Partial<NotepadNote>) => Promise<void>;
  deleteNotepadNote: (id: string, reason?: string) => Promise<void>;
  reviewNotepadNote: (id: string, reviewNotes?: string, newStatus?: NotepadStatus) => Promise<void>;
  toggleNotepadNotePin: (id: string) => Promise<void>;

  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();

  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [cashWithdrawals, setCashWithdrawals] = useState<CashWithdrawal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [notepadNotes, setNotepadNotes] = useState<NotepadNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBankAccount, setActiveBankAccount] = useState<BankAccount | null>(null);

  // Derived category lists with built-in fallbacks
  const expenseCategories = useMemo(() => {
    const list = categories.filter((c) => c.type === 'despesa').map((c) => c.name);
    if (list.length === 0) {
      return [
        'Compra de mercadorias',
        'Fornecedor',
        'Água',
        'Energia',
        'Internet',
        'Aluguel',
        'Transporte',
        'Manutenção',
        'Embalagens',
        'Limpeza',
        'Outras despesas',
      ];
    }
    return list;
  }, [categories]);

  const valeCategories = useMemo(() => {
    const list = categories.filter((c) => c.type === 'vale').map((c) => c.name);
    if (list.length === 0) {
      return [
        'Adiantamento Salarial',
        'Alimentação / Refeição',
        'Transporte / Combustível',
        'Emergência / Saúde',
        'Comissão / Bônus',
        'Outro Vale',
      ];
    }
    return list;
  }, [categories]);

  // Helper to log audit events
  const logAudit = useCallback(
    async (
      action: AuditLog['action'],
      entityType: AuditLog['entityType'],
      entityId: string,
      details: string
    ) => {
      try {
        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const logData: AuditLog = {
          id: logId,
          action,
          entityType,
          entityId,
          details,
          userUid: currentUser?.id || 'anon',
          userUsername: currentUser?.username || currentUser?.displayName || 'desconhecido',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'audit_logs', logId), sanitizeForFirestore(logData));
      } catch (err) {
        console.warn('Audit log write warning:', err);
      }
    },
    [currentUser]
  );

  // Initial Seed for fresh database (bank accounts, categories & welcome note)
  const seedDefaultsIfEmpty = useCallback(async () => {
    if (!currentUser) return;
    try {
      // 1. Bank Accounts
      const bankAccountsSnap = await getDocs(collection(db, 'bank_accounts'));
      if (bankAccountsSnap.empty) {
        const defaultBankId = 'acc_principal';
        const defaultBank: BankAccount = {
          id: defaultBankId,
          name: 'Conta Corrente Principal',
          bankName: 'Banco do Brasil',
          accountType: 'corrente',
          agency: '1234',
          accountNumberMasked: '•••• 5678',
          initialBalance: 0,
          initialBalanceDate: new Date().toISOString().split('T')[0],
          currentBalance: 0,
          status: 'active',
          notes: 'Conta bancária cadastrada para movimentações do mercadinho',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'bank_accounts', defaultBankId), defaultBank);

        const noteId = 'note_boas_vindas';
        const welcomeNote: CalendarNote = {
          id: noteId,
          title: 'Conferir saldo inicial e fechamento',
          description: 'Bem-vindo ao Dmenos Contro! Configure os caixas e contas bancárias.',
          date: new Date().toISOString().split('T')[0],
          category: 'fechamento',
          reminder: true,
          status: 'pendente',
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'calendar_notes', noteId), welcomeNote);
      }

      // 2. Categories
      const categoriesSnap = await getDocs(collection(db, 'categories'));
      if (categoriesSnap.empty) {
        const defaultExp = [
          'Compra de mercadorias',
          'Fornecedor',
          'Água',
          'Energia',
          'Internet',
          'Aluguel',
          'Transporte',
          'Manutenção',
          'Embalagens',
          'Limpeza',
          'Outras despesas',
        ];
        const defaultVales = [
          'Adiantamento Salarial',
          'Alimentação / Refeição',
          'Transporte / Combustível',
          'Emergência / Saúde',
          'Comissão / Bônus',
          'Outro Vale',
        ];

        const batch = writeBatch(db);
        const now = new Date().toISOString();
        defaultExp.forEach((name, i) => {
          const id = 'cat_exp_' + i;
          batch.set(doc(db, 'categories', id), {
            id,
            name,
            type: 'despesa',
            color: 'emerald',
            isDefault: true,
            createdAt: now,
            updatedAt: now,
          });
        });
        defaultVales.forEach((name, i) => {
          const id = 'cat_vale_' + i;
          batch.set(doc(db, 'categories', id), {
            id,
            name,
            type: 'vale',
            color: 'amber',
            isDefault: true,
            createdAt: now,
            updatedAt: now,
          });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Seeding note:', e);
    }
  }, [currentUser]);

  // Firestore real-time listeners when user is authenticated
  useEffect(() => {
    if (!currentUser) {
      setClosures([]);
      setCashWithdrawals([]);
      setExpenses([]);
      setVales([]);
      setBoletos([]);
      setCategories([]);
      setBankAccounts([]);
      setBankTransactions([]);
      setReceivables([]);
      setCalendarNotes([]);
      setNotepadNotes([]);
      setAuditLogs([]);
      setSystemUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    seedDefaultsIfEmpty();

    const unsubClosures = onSnapshot(
      collection(db, 'closures'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as DailyClosure);
        items.sort((a, b) => b.date.localeCompare(a.date));
        setClosures(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'closures')
    );

    const unsubWithdrawals = onSnapshot(
      collection(db, 'cash_withdrawals'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as CashWithdrawal);
        items.sort((a, b) => (b.dateTime || b.createdAt).localeCompare(a.dateTime || a.createdAt));
        setCashWithdrawals(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cash_withdrawals')
    );

    const unsubExpenses = onSnapshot(
      collection(db, 'expenses'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as Expense);
        items.sort((a, b) => b.date.localeCompare(a.date));
        setExpenses(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'expenses')
    );

    const unsubVales = onSnapshot(
      collection(db, 'vales'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as Vale);
        items.sort((a, b) => b.date.localeCompare(a.date));
        setVales(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'vales')
    );

    const unsubBoletos = onSnapshot(
      collection(db, 'boletos'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as Boleto);
        items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setBoletos(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'boletos')
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as FinancialCategory);
        items.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'categories')
    );

    const unsubAccounts = onSnapshot(
      collection(db, 'bank_accounts'),
      (snapshot) => {
        const rawItems = snapshot.docs.map((d) => d.data() as BankAccount);
        // Isolamento de privacidade real: contas privadas são visíveis exclusivamente ao proprietário
        const items = rawItems.filter(
          (a) => a.visibility !== 'private' || a.ownerUid === currentUser?.id
        );
        setBankAccounts(items);
        if (items.length > 0 && (!activeBankAccount || !items.some((a) => a.id === activeBankAccount.id))) {
          // Prefere primeira conta compartilhada como padrão, se existir
          const defaultShared = items.find((a) => a.visibility !== 'private');
          setActiveBankAccount(defaultShared || items[0]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'bank_accounts')
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'bank_transactions'),
      (snapshot) => {
        const rawItems = snapshot.docs.map((d) => d.data() as BankTransaction);
        // Isolamento de privacidade real: movimentações privadas pertencem exclusivamente ao proprietário
        const items = rawItems.filter(
          (t) => t.visibility !== 'private' || t.ownerUid === currentUser?.id
        );
        items.sort((a, b) => b.date.localeCompare(a.date));
        setBankTransactions(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'bank_transactions')
    );

    const unsubReceivables = onSnapshot(
      collection(db, 'receivables'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as Receivable);
        items.sort((a, b) => b.date.localeCompare(a.date));
        setReceivables(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'receivables')
    );

    const unsubCalendar = onSnapshot(
      collection(db, 'calendar_notes'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as CalendarNote);
        items.sort((a, b) => a.date.localeCompare(b.date));
        setCalendarNotes(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'calendar_notes')
    );

    const unsubNotepad = onSnapshot(
      collection(db, 'notepad_notes'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as NotepadNote);
        // Sort: pinned first, then by createdAt descending
        items.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setNotepadNotes(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'notepad_notes')
    );

    const unsubAudit = onSnapshot(
      collection(db, 'audit_logs'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as AuditLog);
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAuditLogs(items);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'audit_logs')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as UserProfile);
        setSystemUsers(items);
        setLoading(false);
      },
      (error) => {
        console.warn('Users listener:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubClosures();
      unsubWithdrawals();
      unsubExpenses();
      unsubVales();
      unsubBoletos();
      unsubCategories();
      unsubAccounts();
      unsubTransactions();
      unsubReceivables();
      unsubCalendar();
      unsubNotepad();
      unsubAudit();
      unsubUsers();
    };
  }, [currentUser, seedDefaultsIfEmpty]);

  // Recalculate balance for an account helper strictly based on:
  // Saldo bancário atual = saldo inicial da conta + total de entradas bancárias confirmadas - total de saídas bancárias confirmadas.
  // Completely isolated from daily closures.
  const syncAccountBalance = async (accountId: string) => {
    try {
      const accRef = doc(db, 'bank_accounts', accountId);
      const accSnap = await getDoc(accRef);
      if (!accSnap.exists()) return;
      const accData = accSnap.data() as BankAccount;

      // Query active transactions for this account
      const transQuery = query(
        collection(db, 'bank_transactions'),
        where('accountId', '==', accountId),
        where('status', '==', 'active')
      );
      const transSnap = await getDocs(transQuery);
      const transList: BankTransaction[] = [];
      transSnap.forEach((d) => transList.push(d.data() as BankTransaction));

      const { currentBalance } = computeBankAccountBalance(accData, transList);

      await updateDoc(accRef, {
        currentBalance,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error syncing account balance:', e);
    }
  };

  // 1. CASH WITHDRAWALS (Saídas de Caixa no Fechamento de Caixa)
  const createCashWithdrawal = async (
    data: Omit<CashWithdrawal, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<string> => {
    // Verificar se o caixa do dia e operador já foi fechado definitivamente
    const existingClosure = closures.find(
      (c) => c.date === data.date && c.cashierName.trim().toLowerCase() === data.cashierName.trim().toLowerCase()
    );
    if (existingClosure && existingClosure.status === 'closed' && !isAdmin) {
      throw new Error(
        'Este caixa já foi encerrado definitivamente para este dia. Solicite a reabertura por um administrador para lançar saídas.'
      );
    }

    const id = 'cwith_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();

    let linkedBankTransactionId: string | undefined;
    let linkedOpId: string | undefined;
    let targetBankAccount: BankAccount | undefined;

    // Se o usuário optou por debitar a saída via Pix de uma conta bancária
    if (data.debitFromBankAccount && data.paymentMethod === 'pix') {
      if (!data.bankAccountId) {
        throw new Error('Por favor, selecione a conta bancária para debitar a saída via Pix.');
      }
      targetBankAccount = bankAccounts.find((a) => a.id === data.bankAccountId);
      if (!targetBankAccount) {
        throw new Error('Conta bancária selecionada não foi encontrada.');
      }
      if (targetBankAccount.status === 'inactive') {
        throw new Error('A conta bancária selecionada está inativa e não pode receber débitos.');
      }
      if (targetBankAccount.visibility === 'private') {
        throw new Error('Não é permitido debitar saídas de caixa de contas bancárias privadas.');
      }

      // Validação de saldo disponível
      const accActiveTxs = bankTransactions.filter(
        (t) => t.accountId === targetBankAccount!.id && t.status === 'active'
      );
      const { currentBalance } = computeBankAccountBalance(targetBankAccount, accActiveTxs);
      if (currentBalance < data.amount) {
        throw new Error(
          `Saldo insuficiente na conta "${targetBankAccount.name}". Saldo atual: ${formatCurrency(
            currentBalance
          )}, valor do Pix: ${formatCurrency(data.amount)}.`
        );
      }

      linkedOpId = 'op_pix_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      linkedBankTransactionId = 'bt_pix_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }

    const newWithdrawal: CashWithdrawal = {
      ...data,
      id,
      status: 'active',
      debitFromBankAccount: !!data.debitFromBankAccount && data.paymentMethod === 'pix',
      bankAccountId: targetBankAccount?.id || data.bankAccountId,
      bankAccountName: targetBankAccount?.name || data.bankAccountName,
      bankTransactionId: linkedBankTransactionId,
      linkedOperationId: linkedOpId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // 1. Salvar documento de saída de caixa
      await setDoc(doc(db, 'cash_withdrawals', id), sanitizeForFirestore(newWithdrawal));

      // 2. Se debitado de conta bancária, criar transação bancária vinculada e atualizar saldo
      if (linkedBankTransactionId && targetBankAccount) {
        const bankTx: BankTransaction = {
          id: linkedBankTransactionId,
          accountId: targetBankAccount.id,
          date: data.date,
          description: `Saída de Caixa (Pix): ${data.reason.trim()}`,
          category: 'Saída de Caixa - Fechamento',
          amount: -Math.abs(data.amount),
          type: 'pagamento',
          visibility: 'shared',
          cashWithdrawalId: id,
          linkedOperationId: linkedOpId,
          status: 'active',
          responsibleName: data.responsibleName || currentUser?.displayName || currentUser?.username || 'Responsável',
          notes: `Débito automático vinculado à saída de caixa (${data.cashierName}) - Motivo: ${data.reason.trim()}`,
          createdBy: currentUser?.id || '',
          createdAt: now,
        };

        await setDoc(doc(db, 'bank_transactions', linkedBankTransactionId), sanitizeForFirestore(bankTx));
        await syncAccountBalance(targetBankAccount.id);
      }

      await logAudit(
        'create',
        'closure',
        id,
        `Saída de caixa registrada: R$ ${data.amount.toFixed(2)} (${
          data.paymentMethod === 'dinheiro' ? 'Dinheiro Físico' : 'Pix'
        }${targetBankAccount ? ` - Debitado de: ${targetBankAccount.name}` : ''}) - Motivo: "${data.reason}" (Caixa: ${
          data.cashierName
        }, Responsável: ${data.responsibleName})`
      );
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `cash_withdrawals/${id}`);
      throw err;
    }
  };

  const cancelCashWithdrawal = async (id: string, reason: string): Promise<void> => {
    const item = cashWithdrawals.find((w) => w.id === id);
    if (!item) throw new Error('Lançamento de saída não encontrado.');

    const existingClosure = closures.find(
      (c) => c.date === item.date && c.cashierName.trim().toLowerCase() === item.cashierName.trim().toLowerCase()
    );
    if (existingClosure && existingClosure.status === 'closed' && !isAdmin) {
      throw new Error(
        'O caixa vinculado a esta saída já está encerrado definitivamente. Solicite a reabertura por um administrador para efetuar cancelamentos ou correções.'
      );
    }

    const now = new Date().toISOString();
    try {
      // 1. Cancelar a saída de caixa
      await updateDoc(doc(db, 'cash_withdrawals', id), {
        status: 'cancelled',
        cancellationReason: reason.trim(),
        cancelledBy: currentUser?.displayName || currentUser?.username || 'admin',
        cancelledAt: now,
        updatedAt: now,
      });

      // 2. Se possuía débito bancário vinculado, estornar a transação bancária automaticamente
      if (item.debitFromBankAccount && item.bankTransactionId) {
        try {
          await updateDoc(doc(db, 'bank_transactions', item.bankTransactionId), {
            status: 'cancelled',
            cancellationReason: `Estorno por cancelamento de saída de caixa: ${reason.trim()}`,
            cancelledBy: currentUser?.displayName || currentUser?.username || 'admin',
            cancelledAt: now,
            updatedAt: now,
          });

          if (item.bankAccountId) {
            await syncAccountBalance(item.bankAccountId);
          }
        } catch (txErr) {
          console.warn('Aviso ao estornar transação bancária vinculada:', txErr);
        }
      }

      await logAudit(
        'cancel',
        'closure',
        id,
        `Cancelamento de saída de caixa: R$ ${item.amount.toFixed(2)} (${item.paymentMethod.toUpperCase()}${
          item.debitFromBankAccount ? ' com estorno bancário' : ''
        }) - Motivo: "${reason.trim()}" (Responsável: ${currentUser?.displayName || currentUser?.username})`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cash_withdrawals/${id}`);
      throw err;
    }
  };

  // 2. SAVE CLOSURE
  // O módulo Fechamento Diário é exclusivamente para controle interno do mercadinho e geração de relatórios.
  // Tudo o que for lançado no fechamento diário permanece estritamente restrito a esse módulo.
  // Não altera saldo de nenhuma conta, não gera movimentações no extrato bancário, não alimenta cartão de saldo e não cria receitas/despesas automáticas.
  const saveClosure = async (
    data: Omit<DailyClosure, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string> => {
    const id = 'cls_' + Date.now();
    const now = new Date().toISOString();

    // Active withdrawals for this date and cashier
    const dateCashierWithdrawals = cashWithdrawals.filter(
      (w) =>
        w.date === data.date &&
        w.cashierName.trim().toLowerCase() === data.cashierName.trim().toLowerCase() &&
        w.status === 'active'
    );
    const pixWithdrawalsSum = dateCashierWithdrawals
      .filter((w) => w.paymentMethod === 'pix')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const expensesPix = data.expensesPix !== undefined ? Number(data.expensesPix) : pixWithdrawalsSum;
    const expensesCash = Number(data.expensesCash || 0);
    const valesCash = Number(data.valesCash || 0);
    const cashIn = Number(data.cashIn || 0);
    const pixIn = Number(data.pixIn || 0);

    // Calculations enforced by financial rules
    const totalSales =
      cashIn +
      pixIn +
      Number(data.creditCardIn || 0) +
      Number(data.debitCardIn || 0) +
      Number(data.otherIn || 0);

    const netCash = cashIn - expensesCash;
    const netPix = pixIn - expensesPix;
    const totalExpenses = expensesCash + expensesPix + valesCash;
    const netTotal = totalSales - totalExpenses;

    const expectedCash =
      Number(data.initialCash || 0) +
      cashIn -
      expensesCash -
      valesCash;

    const cashDifference = Number(data.countedCash || 0) - expectedCash;

    const newClosure: DailyClosure = {
      ...data,
      id,
      expensesCash,
      expensesPix,
      netCash,
      netPix,
      totalExpenses,
      netTotal,
      totalSales,
      expectedCash,
      cashDifference,
      status: 'closed',
      createdBy: currentUser?.id || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Save closure document strictly into 'closures'
      await setDoc(doc(db, 'closures', id), sanitizeForFirestore(newClosure));

      // Link any active withdrawals of this cashier/day to this closure
      if (dateCashierWithdrawals.length > 0) {
        const batch = writeBatch(db);
        dateCashierWithdrawals.forEach((w) => {
          batch.update(doc(db, 'cash_withdrawals', w.id), {
            closureId: id,
            updatedAt: now,
          });
        });
        await batch.commit();
      }

      await logAudit(
        'create',
        'closure',
        id,
        `Fechamento de caixa registrado para ${data.date} (Caixa: ${data.cashierName}). Vendas totais: R$ ${totalSales.toFixed(2)}, Líquido Dinheiro: R$ ${netCash.toFixed(2)}, Líquido Pix: R$ ${netPix.toFixed(2)}, Diferença em dinheiro: R$ ${cashDifference.toFixed(2)}. (Controle interno exclusivo do fechamento)`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `closures/${id}`);
      throw error;
    }
  };

  // 2. REOPEN CLOSURE
  const reopenClosure = async (closureId: string, reason: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Somente administradores têm permissão para reabrir fechamentos concluídos.');
    }
    const now = new Date().toISOString();
    try {
      const clsRef = doc(db, 'closures', closureId);
      await updateDoc(clsRef, {
        status: 'reopened',
        reopenedReason: reason,
        reopenedBy: currentUser?.displayName || currentUser?.username || 'Administrador',
        reopenedAt: now,
        updatedAt: now,
      });

      await logAudit(
        'reopen',
        'closure',
        closureId,
        `Fechamento ${closureId} reaberto pelo administrador com motivo: "${reason}"`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `closures/${closureId}`);
    }
  };

  // 3. UPDATE CLOSURE (when reopened)
  const updateClosure = async (closureId: string, data: Partial<DailyClosure>): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const clsRef = doc(db, 'closures', closureId);
      await updateDoc(clsRef, {
        ...data,
        updatedAt: now,
      });
      await logAudit('update', 'closure', closureId, `Fechamento ${closureId} atualizado.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `closures/${closureId}`);
    }
  };

  // 3b. DELETE CLOSURE (EXCLUIR FECHAMENTO INDIVIDUAL)
  const deleteClosure = async (closureId: string, reason?: string): Promise<void> => {
    try {
      const cls = closures.find((c) => c.id === closureId);
      await deleteDoc(doc(db, 'closures', closureId));

      // Remove any linked receivables (e.g. from older closures)
      const linkedReceivables = receivables.filter((r) => r.closureId === closureId);
      for (const rec of linkedReceivables) {
        try {
          await deleteDoc(doc(db, 'receivables', rec.id));
        } catch (e) {
          console.warn('Erro ao excluir recebível vinculado:', e);
        }
      }

      setClosures((prev) => prev.filter((c) => c.id !== closureId));

      await logAudit(
        'delete',
        'closure',
        closureId,
        `Fechamento de caixa ${closureId} (Data: ${cls?.date || 'N/A'}, Caixa: ${cls?.cashierName || 'N/A'}) excluído. Motivo: ${reason || 'Exclusão solicitada pelo usuário'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `closures/${closureId}`);
    }
  };

  // 3c. DELETE CLOSURES IN BATCH (EXCLUIR HISTÓRICO DE FECHAMENTOS)
  const deleteClosuresBatch = async (closureIds: string[], reason?: string): Promise<void> => {
    if (!closureIds || closureIds.length === 0) return;
    try {
      const chunkSize = 400;
      for (let i = 0; i < closureIds.length; i += chunkSize) {
        const chunk = closureIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'closures', id));
        });
        await batch.commit();
      }

      // Also clean any receivables linked to these closures
      const linkedReceivables = receivables.filter(
        (r) => r.closureId && closureIds.includes(r.closureId)
      );
      if (linkedReceivables.length > 0) {
        const batchRec = writeBatch(db);
        linkedReceivables.forEach((rec) => {
          batchRec.delete(doc(db, 'receivables', rec.id));
        });
        await batchRec.commit();
      }

      setClosures((prev) => prev.filter((c) => !closureIds.includes(c.id)));

      await logAudit(
        'delete',
        'closure',
        'batch_closures',
        `Exclusão em massa de ${closureIds.length} fechamento(s) do histórico. Motivo: ${reason || 'Limpeza de histórico solicitada pelo usuário'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'closures/batch');
    }
  };

  // 4. CREATE EXPENSE
  const createExpense = async (
    data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string> => {
    const id = 'exp_' + Date.now();
    const now = new Date().toISOString();

    const newExpense: Expense = {
      ...data,
      id,
      createdBy: currentUser?.id || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'expenses', id), sanitizeForFirestore(newExpense));

      // If money source is bank, create a bank transaction debit
      if (data.moneySource === 'banco' && data.bankAccountId && data.amount > 0) {
        const transId = 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const trans: BankTransaction = {
          id: transId,
          accountId: data.bankAccountId,
          date: data.date,
          description: `Despesa: ${data.description}${data.entityName ? ` (${data.entityName})` : ''}`,
          category: data.category,
          amount: -Math.abs(data.amount), // negative for debit
          type: 'pagamento',
          relatedExpenseId: id,
          status: 'active',
          createdBy: currentUser?.id || '',
          createdAt: now,
        };
        await setDoc(doc(db, 'bank_transactions', transId), sanitizeForFirestore(trans));
        await syncAccountBalance(data.bankAccountId);
      }

      await logAudit(
        'create',
        'expense',
        id,
        `Despesa cadastrada: "${data.description}" - R$ ${data.amount.toFixed(2)} (Origem: ${data.moneySource})`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `expenses/${id}`);
    }
  };

  // 5. CANCEL EXPENSE
  const cancelExpense = async (expenseId: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const expRef = doc(db, 'expenses', expenseId);
      const expSnap = await getDoc(expRef);
      if (!expSnap.exists()) throw new Error('Despesa não encontrada.');
      const expData = expSnap.data() as Expense;

      await updateDoc(expRef, {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: currentUser?.displayName || currentUser?.username || 'Usuário',
        cancelledAt: now,
        updatedAt: now,
      });

      // If had a bank transaction, cancel it as well to restore bank balance
      const transQuery = query(
        collection(db, 'bank_transactions'),
        where('relatedExpenseId', '==', expenseId),
        where('status', '==', 'active')
      );
      const transSnap = await getDocs(transQuery);
      for (const tDoc of transSnap.docs) {
        await updateDoc(doc(db, 'bank_transactions', tDoc.id), {
          status: 'cancelled',
          cancellationReason: `Estornado pelo cancelamento da despesa: ${reason}`,
        });
        if (expData.bankAccountId) {
          await syncAccountBalance(expData.bankAccountId);
        }
      }

      await logAudit(
        'cancel',
        'expense',
        expenseId,
        `Despesa "${expData.description}" cancelada/estornada por motivo: "${reason}"`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `expenses/${expenseId}`);
    }
  };

  // 6. CREATE VALE
  const createVale = async (
    data: Omit<Vale, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string> => {
    const id = 'vale_' + Date.now();
    const now = new Date().toISOString();

    const newVale: Vale = {
      ...data,
      id,
      createdBy: currentUser?.id || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'vales', id), sanitizeForFirestore(newVale));

      if (data.moneySource === 'banco' && data.bankAccountId && data.amount > 0) {
        const transId = 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const trans: BankTransaction = {
          id: transId,
          accountId: data.bankAccountId,
          date: data.date,
          description: `Vale Funcionário: ${data.employeeName}${data.category ? ` (${data.category})` : ''}`,
          category: data.category || 'Vale de funcionário',
          amount: -Math.abs(data.amount),
          type: 'pagamento',
          status: 'active',
          createdBy: currentUser?.id || '',
          createdAt: now,
        };
        await setDoc(doc(db, 'bank_transactions', transId), sanitizeForFirestore(trans));
        await syncAccountBalance(data.bankAccountId);
      }

      await logAudit(
        'create',
        'vale',
        id,
        `Vale registrado para ${data.employeeName}${data.category ? ` [${data.category}]` : ''} no valor de R$ ${data.amount.toFixed(2)} (Status: ${data.status})`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vales/${id}`);
    }
  };

  // 7. SETTLE VALE
  const settleVale = async (valeId: string, method: string, notes?: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const valeRef = doc(db, 'vales', valeId);
      await updateDoc(valeRef, {
        status: 'quitado',
        settledDate: new Date().toISOString().split('T')[0],
        settledMethod: method,
        settledNotes: notes || '',
        settledBy: currentUser?.displayName || currentUser?.username || 'Responsável',
        updatedAt: now,
      });

      await logAudit(
        'settle',
        'vale',
        valeId,
        `Vale ${valeId} marcado como quitado via "${method}". Observações: ${notes || 'nenhuma'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vales/${valeId}`);
    }
  };

  // 8. CANCEL VALE
  const cancelVale = async (valeId: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const valeRef = doc(db, 'vales', valeId);
      await updateDoc(valeRef, {
        status: 'cancelado',
        cancellationReason: reason,
        updatedAt: now,
      });
      await logAudit('cancel', 'vale', valeId, `Vale ${valeId} cancelado. Motivo: ${reason}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vales/${valeId}`);
    }
  };

  // 8c. CATEGORY MANAGEMENT (DESPESAS E VALES)
  const createCategory = async (data: {
    name: string;
    type: 'despesa' | 'vale';
    color?: string;
    description?: string;
  }): Promise<string> => {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('O nome da categoria é obrigatório.');

    const exists = categories.some(
      (c) => c.type === data.type && c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      throw new Error(`Já existe uma categoria de ${data.type} com o nome "${cleanName}".`);
    }

    const id = `cat_${data.type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const newCategory: FinancialCategory = {
      id,
      name: cleanName,
      type: data.type,
      color: data.color || (data.type === 'despesa' ? 'emerald' : 'amber'),
      description: data.description?.trim() || '',
      isDefault: false,
      createdBy: currentUser?.id || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'categories', id), sanitizeForFirestore(newCategory));
      await logAudit(
        'create',
        'category',
        id,
        `Categoria de ${data.type} criada: "${cleanName}"`
      );
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `categories/${id}`);
      throw error;
    }
  };

  const updateCategory = async (
    id: string,
    data: Partial<FinancialCategory>
  ): Promise<void> => {
    try {
      const catRef = doc(db, 'categories', id);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) throw new Error('Categoria não encontrada.');
      const oldCat = catSnap.data() as FinancialCategory;
      const now = new Date().toISOString();

      const newName = data.name ? data.name.trim() : oldCat.name;
      if (!newName) throw new Error('O nome da categoria não pode ser vazio.');

      if (newName.toLowerCase() !== oldCat.name.toLowerCase()) {
        const exists = categories.some(
          (c) => c.id !== id && c.type === oldCat.type && c.name.toLowerCase() === newName.toLowerCase()
        );
        if (exists) {
          throw new Error(`Já existe uma categoria de ${oldCat.type} chamada "${newName}".`);
        }
      }

      const updatePayload: Partial<FinancialCategory> = {
        ...data,
        name: newName,
        updatedAt: now,
      };

      await updateDoc(catRef, sanitizeForFirestore(updatePayload));

      // Propaga a atualização do nome para despesas ou vales existentes
      if (newName !== oldCat.name) {
        if (oldCat.type === 'despesa') {
          const matchingExpenses = expenses.filter((e) => e.category === oldCat.name);
          if (matchingExpenses.length > 0) {
            const batch = writeBatch(db);
            matchingExpenses.forEach((exp) => {
              batch.update(doc(db, 'expenses', exp.id), { category: newName, updatedAt: now });
            });
            await batch.commit();
          }
        } else if (oldCat.type === 'vale') {
          const matchingVales = vales.filter((v) => v.category === oldCat.name);
          if (matchingVales.length > 0) {
            const batch = writeBatch(db);
            matchingVales.forEach((vale) => {
              batch.update(doc(db, 'vales', vale.id), { category: newName, updatedAt: now });
            });
            await batch.commit();
          }
        }
      }

      await logAudit(
        'update',
        'category',
        id,
        `Categoria de ${oldCat.type} alterada de "${oldCat.name}" para "${newName}"`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
      throw error;
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    try {
      const catRef = doc(db, 'categories', id);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) return;
      const cat = catSnap.data() as FinancialCategory;

      await deleteDoc(catRef);

      await logAudit(
        'delete',
        'category',
        id,
        `Categoria de ${cat.type} "${cat.name}" excluída.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      throw error;
    }
  };

  // 8b. BOLETOS COM AVISO DE VENCIMENTO
  const createBoleto = async (
    data: Omit<Boleto, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status'>
  ): Promise<string> => {
    const id = `bol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    try {
      const newBoleto: Boleto = {
        ...data,
        id,
        status: 'pendente',
        createdBy: currentUser?.displayName || currentUser?.username || 'Responsável',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'boletos', id), sanitizeForFirestore(newBoleto));
      await logAudit(
        'create',
        'boleto',
        id,
        `Boleto lançado: "${data.description}" (${data.beneficiary}) - R$ ${Number(data.amount).toFixed(2)}, vencimento ${data.dueDate}`
      );
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `boletos/${id}`);
    }
  };

  const payBoleto = async (
    boletoId: string,
    payment: {
      paidDate: string;
      paidAmount: number;
      paidVia: 'caixa' | 'banco';
      paidBankAccountId?: string;
      notes?: string;
    }
  ): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const bolDoc = await getDoc(doc(db, 'boletos', boletoId));
      if (!bolDoc.exists()) throw new Error('Boleto não encontrado');
      const bolData = bolDoc.data() as Boleto;

      let relatedTransactionId: string | undefined;
      let relatedExpenseId: string | undefined;
      let bankAccName = '';

      if (payment.paidVia === 'banco' && payment.paidBankAccountId) {
        const acc = bankAccounts.find((a) => a.id === payment.paidBankAccountId);
        bankAccName = acc?.name || '';
        relatedTransactionId = `btx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const trans: BankTransaction = {
          id: relatedTransactionId,
          accountId: payment.paidBankAccountId,
          date: payment.paidDate,
          description: `Pagamento Boleto: ${bolData.beneficiary} - ${bolData.description}`,
          category: bolData.category || 'Boleto / Fornecedor',
          amount: -Math.abs(payment.paidAmount),
          type: 'pagamento',
          status: 'active',
          notes: payment.notes || `Boleto ${bolData.barcode ? `Código: ${bolData.barcode}` : ''}`,
          createdBy: currentUser?.id || '',
          createdAt: now,
        };
        await setDoc(doc(db, 'bank_transactions', relatedTransactionId), trans);
        await syncAccountBalance(payment.paidBankAccountId);
      } else {
        // Caixa físico
        relatedExpenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newExpense: Expense = {
          id: relatedExpenseId,
          date: payment.paidDate,
          type: 'despesa',
          description: `Boleto: ${bolData.beneficiary} - ${bolData.description}`,
          category: bolData.category || 'Boleto / Fornecedor',
          amount: payment.paidAmount,
          entityName: bolData.beneficiary,
          paymentMethod: 'boleto',
          moneySource: 'caixa',
          notes: payment.notes || `Boleto ${boletoId} pago via caixa`,
          status: 'active',
          createdBy: currentUser?.displayName || currentUser?.username || 'Responsável',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'expenses', relatedExpenseId), newExpense);
      }

      await updateDoc(doc(db, 'boletos', boletoId), {
        status: 'pago',
        paidDate: payment.paidDate,
        paidAmount: payment.paidAmount,
        paidVia: payment.paidVia,
        paidBankAccountId: payment.paidBankAccountId || null,
        paidBankAccountName: bankAccName || null,
        relatedTransactionId: relatedTransactionId || null,
        relatedExpenseId: relatedExpenseId || null,
        notes: payment.notes ? `${bolData.notes || ''} [Pagamento: ${payment.notes}]`.trim() : bolData.notes || null,
        updatedAt: now,
      });

      await logAudit(
        'settle',
        'boleto',
        boletoId,
        `Boleto "${bolData.description}" (${bolData.beneficiary}) de R$ ${payment.paidAmount.toFixed(2)} liquidado via ${
          payment.paidVia === 'banco' ? `Banco (${bankAccName})` : 'Caixa Físico'
        }.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `boletos/${boletoId}`);
    }
  };

  const cancelBoleto = async (boletoId: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'boletos', boletoId), {
        status: 'cancelado',
        cancellationReason: reason,
        updatedAt: now,
      });
      await logAudit('cancel', 'boleto', boletoId, `Boleto ${boletoId} cancelado. Motivo: ${reason}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `boletos/${boletoId}`);
    }
  };

  const deleteBoleto = async (boletoId: string, reason?: string): Promise<void> => {
    try {
      const bolDoc = await getDoc(doc(db, 'boletos', boletoId));
      const bolData = bolDoc.exists() ? (bolDoc.data() as Boleto) : null;
      await deleteDoc(doc(db, 'boletos', boletoId));
      setBoletos((prev) => prev.filter((b) => b.id !== boletoId));
      await logAudit(
        'delete',
        'boleto',
        boletoId,
        `Boleto ${bolData ? `"${bolData.description}" (${bolData.beneficiary})` : boletoId} excluído.${
          reason ? ` Motivo: ${reason}` : ''
        }`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `boletos/${boletoId}`);
    }
  };

  // 9. CREATE BANK ACCOUNT
  const createBankAccount = async (
    data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt' | 'currentBalance'>
  ): Promise<string> => {
    const id = 'acc_' + Date.now();
    const now = new Date().toISOString();
    const initialBalance = Number(data.initialBalance || 0);
    const isPrivate = data.visibility === 'private';

    const newAccount: BankAccount = {
      ...data,
      id,
      initialBalance,
      currentBalance: initialBalance,
      visibility: isPrivate ? 'private' : 'shared',
      ownerUid: currentUser?.id || 'anon',
      ownerUsername: currentUser?.username || currentUser?.displayName || 'Proprietário',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'bank_accounts', id), sanitizeForFirestore(newAccount));

      await logAudit(
        'create',
        'bank_account',
        id,
        `Conta bancária ${isPrivate ? 'PRIVADA' : 'compartilhada'} "${data.name}" (${data.bankName}) cadastrada com saldo inicial de R$ ${initialBalance.toFixed(2)}${
          isPrivate ? ` (Proprietário: ${currentUser?.displayName || currentUser?.username})` : ''
        }`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_accounts/${id}`);
    }
  };

  // 10. UPDATE BANK ACCOUNT
  const updateBankAccount = async (id: string, data: Partial<BankAccount>): Promise<void> => {
    const now = new Date().toISOString();
    const existing = bankAccounts.find((a) => a.id === id);
    if (existing?.visibility === 'private' && existing.ownerUid !== currentUser?.id) {
      throw new Error('Acesso negado: esta conta bancária privada pertence exclusivamente a outro usuário.');
    }

    try {
      const accRef = doc(db, 'bank_accounts', id);
      await updateDoc(accRef, sanitizeForFirestore({
        ...data,
        updatedAt: now,
      }));
      await syncAccountBalance(id);
      await logAudit('update', 'bank_account', id, `Conta bancária ${id} atualizada.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_accounts/${id}`);
    }
  };

  // 10b. DEACTIVATE BANK ACCOUNT (PRESERVES HISTORICAL TRANSACTIONS, AUDIT AND STATEMENTS)
  const deactivateBankAccount = async (id: string, reason?: string): Promise<void> => {
    const acc = bankAccounts.find((a) => a.id === id);
    if (!acc) throw new Error('Conta bancária não encontrada.');

    // Proteção de privacidade: conta privada só pode ser gerenciada pelo proprietário
    if (acc.visibility === 'private') {
      if (acc.ownerUid !== currentUser?.id) {
        throw new Error('Acesso negado: você não tem permissão para desativar a conta privada de outro usuário.');
      }
    } else {
      const hasAdminPermission = isAdmin || currentUser?.role === 'admin';
      if (!hasAdminPermission) {
        throw new Error('Apenas administradores têm permissão para desativar contas bancárias compartilhadas.');
      }
    }

    // 1. Balance must be exactly zero before deactivation
    const { currentBalance } = computeBankAccountBalance(acc, bankTransactions);
    if (Math.abs(currentBalance) > 0.009) {
      throw new Error(
        `Não é permitido desativar uma conta com saldo diferente de zero (Saldo atual: ${formatCurrency(
          currentBalance
        )}). Transfira ou regularize o saldo para R$ 0,00 antes de desativar.`
      );
    }

    // 2. Cannot deactivate if pending receivables or boletos linked to this account
    const hasPendingReceivables = receivables.some(
      (r) => r.targetAccountId === id && r.status === 'pendente'
    );
    if (hasPendingReceivables) {
      throw new Error('A conta possui recebíveis pendentes de liquidação. Confirme ou altere a conta dos recebíveis antes de desativar.');
    }

    const hasPendingBoletos = boletos.some(
      (b) => b.bankAccountId === id && b.status === 'pendente'
    );
    if (hasPendingBoletos) {
      throw new Error('A conta possui boletos agendados com pagamento pendente. Altere a conta prevista dos boletos antes de desativar.');
    }

    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'bank_accounts', id), sanitizeForFirestore({
        status: 'inactive',
        updatedAt: now,
      }));

      setBankAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'inactive', updatedAt: now } : a))
      );

      if (activeBankAccount?.id === id) {
        const nextActive = bankAccounts.find((a) => a.id !== id && a.status === 'active');
        setActiveBankAccount(nextActive || null);
      }

      await logAudit(
        'update',
        'bank_account',
        id,
        `Conta bancária ${acc.visibility === 'private' ? 'PRIVADA ' : ''}"${acc.name}" (${acc.bankName} - ${acc.accountNumberMasked}) desativada com sucesso. Extrato e histórico financeiro preservados.${
          reason ? ` Motivo: ${reason}` : ''
        }`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_accounts/${id}`);
    }
  };

  // 10c. REACTIVATE BANK ACCOUNT
  const reactivateBankAccount = async (id: string): Promise<void> => {
    const acc = bankAccounts.find((a) => a.id === id);
    if (!acc) throw new Error('Conta bancária não encontrada.');

    if (acc.visibility === 'private') {
      if (acc.ownerUid !== currentUser?.id) {
        throw new Error('Acesso negado: você não tem permissão para reativar a conta privada de outro usuário.');
      }
    } else {
      const hasAdminPermission = isAdmin || currentUser?.role === 'admin';
      if (!hasAdminPermission) {
        throw new Error('Apenas administradores têm permissão para reativar contas bancárias compartilhadas.');
      }
    }

    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'bank_accounts', id), sanitizeForFirestore({
        status: 'active',
        updatedAt: now,
      }));

      setBankAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'active', updatedAt: now } : a))
      );

      await logAudit(
        'update',
        'bank_account',
        id,
        `Conta bancária ${acc.visibility === 'private' ? 'PRIVADA ' : ''}"${acc.name}" (${acc.bankName} - ${acc.accountNumberMasked}) reativada com sucesso.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_accounts/${id}`);
    }
  };

  // 10d. DELETE BANK ACCOUNT (ONLY ALLOWED IF NO TRANSACTIONS AND ZERO BALANCE)
  const deleteBankAccount = async (id: string, reason?: string): Promise<void> => {
    const acc = bankAccounts.find((a) => a.id === id);
    if (!acc) throw new Error('Conta bancária não encontrada.');

    if (acc.visibility === 'private') {
      if (acc.ownerUid !== currentUser?.id) {
        throw new Error('Acesso negado: você não tem permissão para excluir a conta privada de outro usuário.');
      }
    } else {
      const hasAdminPermission = isAdmin || currentUser?.role === 'admin';
      if (!hasAdminPermission) {
        throw new Error('Apenas administradores têm permissão para excluir contas bancárias compartilhadas.');
      }
    }

    // 1. Balance must be zero
    const { currentBalance } = computeBankAccountBalance(acc, bankTransactions);
    if (Math.abs(currentBalance) > 0.009) {
      throw new Error(
        `Não é permitido excluir uma conta com saldo diferente de zero (Saldo atual: ${formatCurrency(
          currentBalance
        )}). Regularize ou transfira o saldo para R$ 0,00 antes de prosseguir.`
      );
    }

    // 2. Must not have any historical transactions or opening balance
    const relatedTxs = bankTransactions.filter(
      (t) => t.accountId === id || t.relatedAccountId === id
    );
    const hasInitialBalance = (acc.initialBalance || 0) > 0;
    if (relatedTxs.length > 0 || hasInitialBalance) {
      throw new Error(
        'Esta conta possui movimentações financeiras registradas. Para proteger a integridade da auditoria contábil e do histórico, utilize a opção "Desativar conta bancária".'
      );
    }

    // 3. Must not have pending items
    const hasPendingReceivables = receivables.some(
      (r) => r.targetAccountId === id && r.status === 'pendente'
    );
    if (hasPendingReceivables) {
      throw new Error('A conta possui recebíveis pendentes de liquidação. Regularize os recebíveis antes de excluir.');
    }

    const hasPendingBoletos = boletos.some(
      (b) => b.bankAccountId === id && b.status === 'pendente'
    );
    if (hasPendingBoletos) {
      throw new Error('A conta está vinculada a boletos pendentes. Regularize os boletos antes de excluir.');
    }

    try {
      await deleteDoc(doc(db, 'bank_accounts', id));
      setBankAccounts((prev) => prev.filter((a) => a.id !== id));

      if (activeBankAccount?.id === id) {
        const nextActive = bankAccounts.find((a) => a.id !== id && a.status === 'active');
        setActiveBankAccount(nextActive || null);
      }

      await logAudit(
        'delete',
        'bank_account',
        id,
        `Conta bancária ${acc.visibility === 'private' ? 'PRIVADA ' : ''}"${acc.name}" (${acc.bankName} - ${acc.accountNumberMasked}) excluída definitivamente.${
          reason ? ` Motivo: ${reason}` : ''
        }`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bank_accounts/${id}`);
    }
  };

  // 11. CREATE BANK TRANSACTION (Deposit, withdrawal, manual adjustment, etc.)
  const createBankTransaction = async (
    data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy' | 'balanceAfter'>
  ): Promise<string> => {
    if (!data.amount || data.amount === 0) {
      throw new Error('O valor da movimentação deve ser maior que zero.');
    }

    const acc = bankAccounts.find((a) => a.id === data.accountId);
    if (!acc) throw new Error('Conta bancária não encontrada.');

    const isAccPrivate = acc.visibility === 'private';
    if (isAccPrivate && acc.ownerUid !== currentUser?.id) {
      throw new Error('Acesso negado: movimentação em conta privada de outro usuário não é permitida.');
    }

    const id = 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();
    const responsible = currentUser?.displayName || currentUser?.username || 'Responsável';

    const newTrans: BankTransaction = {
      ...data,
      id,
      visibility: isAccPrivate ? 'private' : 'shared',
      ownerUid: isAccPrivate ? acc.ownerUid : undefined,
      status: 'active',
      responsibleName: data.responsibleName || responsible,
      createdBy: currentUser?.id || '',
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'bank_transactions', id), sanitizeForFirestore(newTrans));
      await syncAccountBalance(data.accountId);

      await logAudit(
        'create',
        'bank_transaction',
        id,
        `Movimentação bancária registrada na conta ${data.accountId}: "${data.description}" - R$ ${Math.abs(data.amount).toFixed(2)} (${data.type})`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_transactions/${id}`);
    }
  };

  // CANCEL / ESTORNAR MOVIMENTAÇÃO BANCÁRIA
  const cancelBankTransaction = async (transactionId: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    const cancelledByName = currentUser?.displayName || currentUser?.username || 'Usuário';

    try {
      const transRef = doc(db, 'bank_transactions', transactionId);
      const transSnap = await getDoc(transRef);
      if (!transSnap.exists()) throw new Error('Movimentação bancária não encontrada.');
      const transData = transSnap.data() as BankTransaction;

      // Se fazia parte de transferência entre contas, cancela ambas as pontas atomicamente
      if (transData.relatedTransferId) {
        const pairedQuery = query(
          collection(db, 'bank_transactions'),
          where('relatedTransferId', '==', transData.relatedTransferId),
          where('status', '==', 'active')
        );
        const pairedSnap = await getDocs(pairedQuery);
        const batch = writeBatch(db);
        const accountsToSync = new Set<string>();

        pairedSnap.docs.forEach((pDoc) => {
          const pData = pDoc.data() as BankTransaction;
          accountsToSync.add(pData.accountId);
          batch.update(doc(db, 'bank_transactions', pDoc.id), {
            status: 'cancelled',
            cancellationReason: `Estorno de transferência: ${reason}`,
            cancelledBy: cancelledByName,
            cancelledAt: now,
            updatedAt: now,
          });
        });

        await batch.commit();

        for (const accId of accountsToSync) {
          await syncAccountBalance(accId);
        }
      } else {
        await updateDoc(transRef, {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledBy: cancelledByName,
          cancelledAt: now,
          updatedAt: now,
        });
        await syncAccountBalance(transData.accountId);
      }

      await logAudit(
        'cancel',
        'bank_transaction',
        transactionId,
        `Movimentação bancária "${transData.description}" (R$ ${transData.amount.toFixed(2)}) estornada. Motivo: ${reason}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_transactions/${transactionId}`);
    }
  };

  // DELETE BANK TRANSACTION (EXCLUIR MOVIMENTAÇÃO BANCÁRIA DO HISTÓRICO)
  const deleteBankTransaction = async (transactionId: string, reason?: string): Promise<void> => {
    try {
      const trans = bankTransactions.find((t) => t.id === transactionId);
      await deleteDoc(doc(db, 'bank_transactions', transactionId));

      // Se fazia parte de transferência entre contas, exclui a contrapartida também
      if (trans?.relatedTransferId) {
        const paired = bankTransactions.filter(
          (t) => t.relatedTransferId === trans.relatedTransferId && t.id !== transactionId
        );
        for (const p of paired) {
          try {
            await deleteDoc(doc(db, 'bank_transactions', p.id));
            await syncAccountBalance(p.accountId);
          } catch (e) {
            console.warn('Erro ao excluir contrapartida de transferência:', e);
          }
        }
      }

      if (trans?.accountId) {
        await syncAccountBalance(trans.accountId);
      }

      setBankTransactions((prev) => prev.filter((t) => t.id !== transactionId));

      await logAudit(
        'delete',
        'bank_transaction',
        transactionId,
        `Movimentação bancária "${trans?.description || transactionId}" excluída definitivamente. Motivo: ${reason || 'Ação do usuário'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bank_transactions/${transactionId}`);
    }
  };

  // DELETE / CLEAR ACCOUNT STATEMENT (EXCLUIR EXTRATO DE CONTA BANCÁRIA)
  const deleteAccountStatement = async (
    accountId: string,
    transactionIds?: string[],
    reason?: string
  ): Promise<void> => {
    try {
      const targetTrans = bankTransactions.filter(
        (t) => t.accountId === accountId && (!transactionIds || transactionIds.includes(t.id))
      );
      if (targetTrans.length === 0) return;

      const idsToDelete = new Set(targetTrans.map((t) => t.id));
      const affectedAccounts = new Set<string>([accountId]);

      // Check if any transfer counterpart needs deletion
      targetTrans.forEach((t) => {
        if (t.relatedTransferId) {
          const counterpart = bankTransactions.find(
            (other) => other.relatedTransferId === t.relatedTransferId && other.id !== t.id
          );
          if (counterpart) {
            idsToDelete.add(counterpart.id);
            affectedAccounts.add(counterpart.accountId);
          }
        }
      });

      const allIdsArray = Array.from(idsToDelete);
      const chunkSize = 400;
      for (let i = 0; i < allIdsArray.length; i += chunkSize) {
        const chunk = allIdsArray.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'bank_transactions', id));
        });
        await batch.commit();
      }

      // Sync balance for all affected accounts
      for (const accId of affectedAccounts) {
        await syncAccountBalance(accId);
      }

      setBankTransactions((prev) => prev.filter((t) => !idsToDelete.has(t.id)));

      const acc = bankAccounts.find((a) => a.id === accountId);
      await logAudit(
        'delete',
        'bank_transaction',
        `stmt_${accountId}`,
        `Extrato da conta "${acc?.name || accountId}" excluído (${targetTrans.length} lançamentos removidos). Motivo: ${reason || 'Limpeza de extrato pelo usuário'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bank_transactions/account_${accountId}`);
    }
  };

  // CLEAR AUDIT HISTORY (LIMPAR HISTÓRICO DE AUDITORIA)
  const clearAuditHistory = async (logIds?: string[]): Promise<void> => {
    try {
      const idsToDelete = logIds && logIds.length > 0 ? logIds : auditLogs.map((l) => l.id);
      if (idsToDelete.length === 0) return;

      const chunkSize = 400;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'audit_logs', id));
        });
        await batch.commit();
      }

      setAuditLogs((prev) => prev.filter((l) => !idsToDelete.includes(l.id)));

      await logAudit(
        'delete',
        'audit_log',
        'batch_audit_logs',
        `Histórico de auditoria limpo (${idsToDelete.length} registros removidos).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'audit_logs/batch');
    }
  };

  // 12. TRANSFER BETWEEN ACCOUNTS (ATOMIC BATCH: DEBIT ORIGIN, CREDIT DESTINATION, ZERO REVENUE/EXPENSE IMPACT)
  const transferBetweenAccounts = async (
    fromId: string,
    toId: string,
    amount: number,
    date: string,
    description: string,
    notes?: string,
    documentNumber?: string
  ): Promise<void> => {
    if (fromId === toId) {
      throw new Error('A conta de origem não pode ser igual à conta de destino.');
    }
    if (amount <= 0) {
      throw new Error('O valor da transferência deve ser maior que zero.');
    }

    const fromAcc = bankAccounts.find((a) => a.id === fromId);
    const toAcc = bankAccounts.find((a) => a.id === toId);

    if (!fromAcc) {
      throw new Error('Conta bancária de origem não encontrada.');
    }
    if (!toAcc) {
      throw new Error('Conta bancária de destino não encontrada.');
    }

    const fromIsPrivate = fromAcc.visibility === 'private';
    const toIsPrivate = toAcc.visibility === 'private';

    if (fromIsPrivate && fromAcc.ownerUid !== currentUser?.id) {
      throw new Error('Acesso negado: a conta privada de origem pertence a outro usuário.');
    }
    if (toIsPrivate && toAcc.ownerUid !== currentUser?.id) {
      throw new Error('Acesso negado: a conta privada de destino pertence a outro usuário.');
    }
    if (fromIsPrivate && !toIsPrivate) {
      throw new Error('Não é permitida a transferência entre contas privadas e contas compartilhadas da empresa.');
    }
    if (!fromIsPrivate && toIsPrivate) {
      throw new Error('Não é permitida a transferência entre contas compartilhadas da empresa e contas privadas.');
    }

    const isPrivateTransfer = fromIsPrivate && toIsPrivate;

    // Validate available balance to prevent negative balance
    const fromBalanceDetails = computeBankAccountBalance(fromAcc, bankTransactions);
    if (fromBalanceDetails.currentBalance < amount) {
      throw new Error(
        `Saldo insuficiente na conta "${fromAcc.name}". Saldo disponível: ${formatCurrency(
          fromBalanceDetails.currentBalance
        )}, valor solicitado: ${formatCurrency(amount)}.`
      );
    }

    const transferId = 'trf_' + Date.now();
    const now = new Date().toISOString();
    const responsible = currentUser?.displayName || currentUser?.username || 'Responsável';

    const fromName = fromAcc.name;
    const toName = toAcc.name;

    try {
      const debitTransId = 'bt_trf_out_' + Date.now() + '_1';
      const debitTrans: BankTransaction = {
        id: debitTransId,
        accountId: fromId,
        date,
        description: `Transferência para ${toName}: ${description.trim() || 'Transferência entre contas'}`,
        category: 'Transferência entre contas',
        amount: -Math.abs(amount),
        type: 'transferencia_saida',
        visibility: isPrivateTransfer ? 'private' : 'shared',
        ownerUid: isPrivateTransfer ? currentUser?.id : undefined,
        relatedAccountId: toId,
        relatedAccountName: toName,
        relatedTransferId: transferId,
        status: 'active',
        documentNumber: documentNumber?.trim() || '',
        responsibleName: responsible,
        notes: notes?.trim() || '',
        createdBy: currentUser?.id || '',
        createdAt: now,
      };

      const creditTransId = 'bt_trf_in_' + Date.now() + '_2';
      const creditTrans: BankTransaction = {
        id: creditTransId,
        accountId: toId,
        date,
        description: `Transferência de ${fromName}: ${description.trim() || 'Transferência entre contas'}`,
        category: 'Transferência entre contas',
        amount: Math.abs(amount),
        type: 'transferencia_entrada',
        visibility: isPrivateTransfer ? 'private' : 'shared',
        ownerUid: isPrivateTransfer ? currentUser?.id : undefined,
        relatedAccountId: fromId,
        relatedAccountName: fromName,
        relatedTransferId: transferId,
        status: 'active',
        documentNumber: documentNumber?.trim() || '',
        responsibleName: responsible,
        notes: notes?.trim() || '',
        createdBy: currentUser?.id || '',
        createdAt: now,
      };

      // Atomic commit: both debit and credit succeed or neither does
      const batch = writeBatch(db);
      batch.set(doc(db, 'bank_transactions', debitTransId), sanitizeForFirestore(debitTrans));
      batch.set(doc(db, 'bank_transactions', creditTransId), sanitizeForFirestore(creditTrans));
      await batch.commit();

      // Update both balances
      await syncAccountBalance(fromId);
      await syncAccountBalance(toId);

      await logAudit(
        'create',
        'bank_transaction',
        transferId,
        `Transferência atômica de R$ ${amount.toFixed(2)} efetuada de "${fromName}" para "${toName}". Identificador: ${transferId}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_transactions/${transferId}`);
    }
  };

  // 13. CONFIRM RECEIVABLE CREDIT (Card operator funds deposited into bank)
  const confirmReceivableCredit = async (
    receivableId: string,
    accountId: string,
    creditDate: string,
    notes?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const recRef = doc(db, 'receivables', receivableId);
      const recSnap = await getDoc(recRef);
      if (!recSnap.exists()) throw new Error('Registro a receber não encontrado.');
      const rec = recSnap.data() as Receivable;

      const transId = 'bt_card_' + Date.now();
      const trans: BankTransaction = {
        id: transId,
        accountId,
        date: creditDate,
        description: `Liquidação de Cartão (${rec.cardType.toUpperCase()}) - Fechamento ${rec.closureId}`,
        category: 'Crédito de Cartões / Operadora',
        amount: rec.netAmount,
        type: 'recebimento',
        status: 'active',
        notes: `Valor Bruto: R$ ${rec.grossAmount.toFixed(2)} | Taxa: ${rec.feePercentage}% (R$ ${rec.feeAmount.toFixed(2)}) | Líquido: R$ ${rec.netAmount.toFixed(2)}. ${notes || ''}`,
        createdBy: currentUser?.id || '',
        createdAt: now,
      };
      await setDoc(doc(db, 'bank_transactions', transId), trans);
      await syncAccountBalance(accountId);

      await updateDoc(recRef, {
        status: 'creditado',
        creditedDate: creditDate,
        creditedTransactionId: transId,
        targetAccountId: accountId,
        updatedAt: now,
      });

      await logAudit(
        'settle',
        'receivable',
        receivableId,
        `Cartão liquidado na conta ${accountId}. Valor líquido creditado: R$ ${rec.netAmount.toFixed(2)} (Taxa descontada: R$ ${rec.feeAmount.toFixed(2)})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receivables/${receivableId}`);
    }
  };

  // 14. CALENDAR NOTES
  const createCalendarNote = async (
    data: Omit<CalendarNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string> => {
    const id = 'note_' + Date.now();
    const now = new Date().toISOString();

    const newNote: CalendarNote = {
      ...data,
      id,
      createdBy: currentUser?.id || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'calendar_notes', id), sanitizeForFirestore(newNote));
      await logAudit('create', 'calendar_note', id, `Anotação no calendário adicionada: "${data.title}" para ${data.date}`);
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `calendar_notes/${id}`);
    }
  };

  const toggleCalendarNoteStatus = async (id: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const noteRef = doc(db, 'calendar_notes', id);
      const noteSnap = await getDoc(noteRef);
      if (!noteSnap.exists()) return;
      const note = noteSnap.data() as CalendarNote;
      const newStatus = note.status === 'pendente' ? 'concluida' : 'pendente';

      await updateDoc(noteRef, {
        status: newStatus,
        completedAt: newStatus === 'concluida' ? now : null,
        completedBy: newStatus === 'concluida' ? (currentUser?.displayName || currentUser?.username) : null,
        updatedAt: now,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calendar_notes/${id}`);
    }
  };

  const deleteCalendarNote = async (id: string): Promise<void> => {
    try {
      const noteRef = doc(db, 'calendar_notes', id);
      await updateDoc(noteRef, { status: 'concluida' }); // Soft complete or deletion
      await logAudit('delete', 'calendar_note', id, `Anotação ${id} concluída/removida.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `calendar_notes/${id}`);
    }
  };

  // 15. NOTEPAD NOTES (BLOCO DE NOTAS & REVISÃO POSTERIOR)
  const createNotepadNote = async (data: {
    title: string;
    content: string;
    category: NotepadCategory;
    priority: NotepadPriority;
    targetDate?: string;
    isPinned?: boolean;
    status?: NotepadStatus;
  }): Promise<string> => {
    const id = 'np_' + Date.now();
    const now = new Date().toISOString();

    const newNote: NotepadNote = {
      id,
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category || 'geral',
      priority: data.priority || 'media',
      status: data.status || 'pendente',
      isPinned: !!data.isPinned,
      targetDate: data.targetDate || '',
      authorUid: currentUser?.id || '',
      authorName: currentUser?.displayName || currentUser?.username || 'Usuário',
      authorRole: currentUser?.role || 'employee',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'notepad_notes', id), sanitizeForFirestore(newNote));
      await logAudit(
        'create',
        'notepad_note',
        id,
        `Nova anotação no bloco de notas: "${newNote.title}" (${newNote.category.toUpperCase()} / Prioridade: ${newNote.priority})`
      );
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notepad_notes/${id}`);
      throw error;
    }
  };

  const updateNotepadNote = async (id: string, data: Partial<NotepadNote>): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const noteRef = doc(db, 'notepad_notes', id);
      const cleanData = sanitizeForFirestore({
        ...data,
        updatedAt: now,
      });
      await updateDoc(noteRef, cleanData);
      await logAudit('update', 'notepad_note', id, `Anotação "${id}" atualizada no bloco de notas.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notepad_notes/${id}`);
      throw error;
    }
  };

  const deleteNotepadNote = async (id: string, reason?: string): Promise<void> => {
    try {
      const noteRef = doc(db, 'notepad_notes', id);
      await deleteDoc(noteRef);
      await logAudit(
        'delete',
        'notepad_note',
        id,
        `Anotação "${id}" excluída do bloco de notas. ${reason ? `Motivo: ${reason}` : ''}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notepad_notes/${id}`);
      throw error;
    }
  };

  const reviewNotepadNote = async (
    id: string,
    reviewNotes?: string,
    newStatus: NotepadStatus = 'revisado'
  ): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const noteRef = doc(db, 'notepad_notes', id);
      const isPending = newStatus === 'pendente';
      const updateData = {
        status: newStatus,
        reviewedAt: isPending ? null : now,
        reviewedByUid: isPending ? null : (currentUser?.id || ''),
        reviewedByName: isPending ? null : (currentUser?.displayName || currentUser?.username || 'Gestor'),
        reviewNotes: isPending ? '' : (reviewNotes?.trim() || 'Anotação revisada e verificada.'),
        updatedAt: now,
      };

      await updateDoc(noteRef, sanitizeForFirestore(updateData));
      await logAudit(
        'review',
        'notepad_note',
        id,
        `Anotação "${id}" marcada como ${newStatus.toUpperCase()} por ${currentUser?.displayName || currentUser?.username}. Parecer: ${reviewNotes || 'Sem observações adicionais'}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notepad_notes/${id}`);
      throw error;
    }
  };

  const toggleNotepadNotePin = async (id: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const noteRef = doc(db, 'notepad_notes', id);
      const snap = await getDoc(noteRef);
      if (!snap.exists()) return;
      const current = snap.data() as NotepadNote;
      const nextPinned = !current.isPinned;

      await updateDoc(noteRef, {
        isPinned: nextPinned,
        updatedAt: now,
      });
      await logAudit(
        'update',
        'notepad_note',
        id,
        `Anotação "${id}" ${nextPinned ? 'fixada no topo' : 'desafixada'} do bloco de notas.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notepad_notes/${id}`);
      throw error;
    }
  };

  // 16. USER ROLE MANAGEMENT (ADMIN ONLY)
  const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
    if (!isAdmin) throw new Error('Apenas administradores podem alterar permissões de usuários.');
    const now = new Date().toISOString();
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role, updatedAt: now });
      await logAudit('update', 'user', userId, `Papel de acesso do usuário ${userId} alterado para ${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 300);
  };

  // Dynamically compute bank account balances strictly according to the formula:
  // Saldo bancário atual = saldo inicial da conta + total de entradas bancárias confirmadas - total de saídas bancárias confirmadas
  // Excludes any closure contamination or duplicate opening balance
  const computedBankAccounts = useMemo(() => {
    return bankAccounts.map((acc) => {
      const { currentBalance } = computeBankAccountBalance(acc, bankTransactions);
      return {
        ...acc,
        currentBalance,
      };
    });
  }, [bankAccounts, bankTransactions]);

  const computedActiveBankAccount = useMemo(() => {
    if (!activeBankAccount) {
      return computedBankAccounts[0] || null;
    }
    const found = computedBankAccounts.find((a: BankAccount) => a.id === activeBankAccount.id);
    return found || computedBankAccounts[0] || null;
  }, [activeBankAccount, computedBankAccounts]);

  // Auto-healing: ensure stored currentBalance in Firestore matches the exact calculation
  useEffect(() => {
    if (bankAccounts.length > 0) {
      bankAccounts.forEach(async (acc) => {
        const { currentBalance } = computeBankAccountBalance(acc, bankTransactions);
        if (acc.currentBalance !== currentBalance) {
          try {
            await updateDoc(doc(db, 'bank_accounts', acc.id), {
              currentBalance,
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Auto-sync account balance warning:', e);
          }
        }
      });
    }
  }, [bankAccounts, bankTransactions]);

  return (
    <FinanceContext.Provider
      value={{
        closures,
        cashWithdrawals,
        expenses,
        vales,
        boletos,
        categories,
        expenseCategories,
        valeCategories,
        bankAccounts: computedBankAccounts,
        bankTransactions,
        receivables,
        calendarNotes,
        notepadNotes,
        auditLogs,
        systemUsers,
        loading,
        activeBankAccount: computedActiveBankAccount,
        setActiveBankAccount,
        saveClosure,
        createCashWithdrawal,
        cancelCashWithdrawal,
        reopenClosure,
        updateClosure,
        deleteClosure,
        deleteClosuresBatch,
        createExpense,
        cancelExpense,
        createVale,
        settleVale,
        cancelVale,
        createCategory,
        updateCategory,
        deleteCategory,
        createBoleto,
        payBoleto,
        cancelBoleto,
        deleteBoleto,
        createBankAccount,
        updateBankAccount,
        deleteBankAccount,
        deactivateBankAccount,
        reactivateBankAccount,
        createBankTransaction,
        cancelBankTransaction,
        deleteBankTransaction,
        deleteAccountStatement,
        transferBetweenAccounts,
        confirmReceivableCredit,
        createCalendarNote,
        toggleCalendarNoteStatus,
        deleteCalendarNote,
        createNotepadNote,
        updateNotepadNote,
        deleteNotepadNote,
        reviewNotepadNote,
        toggleNotepadNotePin,
        clearAuditHistory,
        updateUserRole,
        refreshAll,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
