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
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { computeBankAccountBalance } from '../utils/formatters';
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
  UserRole
} from '../types';

interface FinanceContextType {
  closures: DailyClosure[];
  expenses: Expense[];
  vales: Vale[];
  boletos: Boleto[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  receivables: Receivable[];
  calendarNotes: CalendarNote[];
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
  
  createExpense: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  cancelExpense: (expenseId: string, reason: string) => Promise<void>;

  createVale: (data: Omit<Vale, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  settleVale: (valeId: string, method: string, notes?: string) => Promise<void>;
  cancelVale: (valeId: string, reason: string) => Promise<void>;

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
  createBankTransaction: (data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy' | 'balanceAfter'>) => Promise<string>;
  cancelBankTransaction: (transactionId: string, reason: string) => Promise<void>;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number, date: string, description: string, notes?: string) => Promise<void>;
  confirmReceivableCredit: (receivableId: string, accountId: string, creditDate: string, notes?: string) => Promise<void>;

  createCalendarNote: (data: Omit<CalendarNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  toggleCalendarNoteStatus: (id: string) => Promise<void>;
  deleteCalendarNote: (id: string) => Promise<void>;

  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();

  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBankAccount, setActiveBankAccount] = useState<BankAccount | null>(null);

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
        await setDoc(doc(db, 'audit_logs', logId), logData);
      } catch (err) {
        console.warn('Audit log write warning:', err);
      }
    },
    [currentUser]
  );

  // Initial Seed for fresh database (bank accounts & welcome note)
  const seedDefaultsIfEmpty = useCallback(async () => {
    if (!currentUser) return;
    try {
      const bankAccountsSnap = await getDocs(collection(db, 'bank_accounts'));
      if (bankAccountsSnap.empty) {
        // Seed default Banco Principal
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

        // Seed default Calendar Note
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
    } catch (e) {
      console.warn('Seeding note:', e);
    }
  }, [currentUser]);

  // Firestore real-time listeners when user is authenticated
  useEffect(() => {
    if (!currentUser) {
      setClosures([]);
      setExpenses([]);
      setVales([]);
      setBankAccounts([]);
      setBankTransactions([]);
      setReceivables([]);
      setCalendarNotes([]);
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

    const unsubAccounts = onSnapshot(
      collection(db, 'bank_accounts'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as BankAccount);
        setBankAccounts(items);
        if (items.length > 0 && !activeBankAccount) {
          setActiveBankAccount(items[0]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'bank_accounts')
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'bank_transactions'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as BankTransaction);
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
      unsubExpenses();
      unsubVales();
      unsubBoletos();
      unsubAccounts();
      unsubTransactions();
      unsubReceivables();
      unsubCalendar();
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

  // 1. SAVE CLOSURE
  // O módulo Fechamento Diário é exclusivamente para controle interno do mercadinho e geração de relatórios.
  // Tudo o que for lançado no fechamento diário permanece estritamente restrito a esse módulo.
  // Não altera saldo de nenhuma conta, não gera movimentações no extrato bancário, não alimenta cartão de saldo e não cria receitas/despesas automáticas.
  const saveClosure = async (
    data: Omit<DailyClosure, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string> => {
    const id = 'cls_' + Date.now();
    const now = new Date().toISOString();

    // Calculations enforced by financial rules
    const totalSales =
      Number(data.cashIn || 0) +
      Number(data.pixIn || 0) +
      Number(data.creditCardIn || 0) +
      Number(data.debitCardIn || 0) +
      Number(data.otherIn || 0);

    const expectedCash =
      Number(data.initialCash || 0) +
      Number(data.cashIn || 0) -
      Number(data.expensesCash || 0) -
      Number(data.valesCash || 0);

    const cashDifference = Number(data.countedCash || 0) - expectedCash;

    const newClosure: DailyClosure = {
      ...data,
      id,
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
      await setDoc(doc(db, 'closures', id), newClosure);

      await logAudit(
        'create',
        'closure',
        id,
        `Fechamento de caixa registrado para ${data.date} (Caixa: ${data.cashierName}). Vendas totais: R$ ${totalSales.toFixed(2)}, Diferença em dinheiro: R$ ${cashDifference.toFixed(2)}. (Controle interno exclusivo do fechamento)`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `closures/${id}`);
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
      await setDoc(doc(db, 'expenses', id), newExpense);

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
        await setDoc(doc(db, 'bank_transactions', transId), trans);
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
      await setDoc(doc(db, 'vales', id), newVale);

      if (data.moneySource === 'banco' && data.bankAccountId && data.amount > 0) {
        const transId = 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const trans: BankTransaction = {
          id: transId,
          accountId: data.bankAccountId,
          date: data.date,
          description: `Vale Funcionário: ${data.employeeName}`,
          category: 'Vale de funcionário',
          amount: -Math.abs(data.amount),
          type: 'pagamento',
          status: 'active',
          createdBy: currentUser?.id || '',
          createdAt: now,
        };
        await setDoc(doc(db, 'bank_transactions', transId), trans);
        await syncAccountBalance(data.bankAccountId);
      }

      await logAudit(
        'create',
        'vale',
        id,
        `Vale registrado para ${data.employeeName} no valor de R$ ${data.amount.toFixed(2)} (Status: ${data.status})`
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
      await setDoc(doc(db, 'boletos', id), newBoleto);
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

    const newAccount: BankAccount = {
      ...data,
      id,
      initialBalance,
      currentBalance: initialBalance,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'bank_accounts', id), newAccount);

      await logAudit(
        'create',
        'bank_account',
        id,
        `Conta bancária "${data.name}" (${data.bankName}) cadastrada com saldo inicial de R$ ${initialBalance.toFixed(2)}`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_accounts/${id}`);
    }
  };

  // 10. UPDATE BANK ACCOUNT
  const updateBankAccount = async (id: string, data: Partial<BankAccount>): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const accRef = doc(db, 'bank_accounts', id);
      await updateDoc(accRef, {
        ...data,
        updatedAt: now,
      });
      await logAudit('update', 'bank_account', id, `Conta bancária ${id} atualizada.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_accounts/${id}`);
    }
  };

  // 11. CREATE BANK TRANSACTION (Deposit, withdrawal, manual adjustment, etc.)
  const createBankTransaction = async (
    data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy' | 'balanceAfter'>
  ): Promise<string> => {
    const id = 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();

    const newTrans: BankTransaction = {
      ...data,
      id,
      status: 'active',
      createdBy: currentUser?.id || '',
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'bank_transactions', id), newTrans);
      await syncAccountBalance(data.accountId);

      await logAudit(
        'create',
        'bank_transaction',
        id,
        `Movimentação bancária registrada na conta ${data.accountId}: "${data.description}" - R$ ${data.amount.toFixed(2)} (${data.type})`
      );

      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_transactions/${id}`);
    }
  };

  // CANCEL / ESTORNAR MOVIMENTAÇÃO BANCÁRIA
  const cancelBankTransaction = async (transactionId: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      const transRef = doc(db, 'bank_transactions', transactionId);
      const transSnap = await getDoc(transRef);
      if (!transSnap.exists()) throw new Error('Movimentação bancária não encontrada.');
      const transData = transSnap.data() as BankTransaction;

      await updateDoc(transRef, {
        status: 'cancelled',
        cancellationReason: reason,
        updatedAt: now,
      });

      // Se fazia parte de transferência entre contas, cancela a contrapartida também
      if (transData.relatedTransferId) {
        const pairedQuery = query(
          collection(db, 'bank_transactions'),
          where('relatedTransferId', '==', transData.relatedTransferId),
          where('status', '==', 'active')
        );
        const pairedSnap = await getDocs(pairedQuery);
        for (const pDoc of pairedSnap.docs) {
          if (pDoc.id !== transactionId) {
            await updateDoc(doc(db, 'bank_transactions', pDoc.id), {
              status: 'cancelled',
              cancellationReason: `Estorno de transferência: ${reason}`,
              updatedAt: now,
            });
            const pData = pDoc.data() as BankTransaction;
            await syncAccountBalance(pData.accountId);
          }
        }
      }

      await syncAccountBalance(transData.accountId);

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

  // 12. TRANSFER BETWEEN ACCOUNTS (DEBIT ORIGIN, CREDIT DESTINATION, ZERO REVENUE/EXPENSE IMPACT)
  const transferBetweenAccounts = async (
    fromId: string,
    toId: string,
    amount: number,
    date: string,
    description: string,
    notes?: string
  ): Promise<void> => {
    if (fromId === toId) {
      throw new Error('A conta de origem não pode ser igual à conta de destino.');
    }
    if (amount <= 0) {
      throw new Error('O valor da transferência deve ser maior que zero.');
    }

    const transferId = 'trf_' + Date.now();
    const now = new Date().toISOString();

    const fromAcc = bankAccounts.find((a) => a.id === fromId);
    const toAcc = bankAccounts.find((a) => a.id === toId);

    const fromName = fromAcc ? fromAcc.name : 'Conta Origem';
    const toName = toAcc ? toAcc.name : 'Conta Destino';

    try {
      // 1. Debit from source account
      const debitTransId = 'bt_trf_out_' + Date.now();
      const debitTrans: BankTransaction = {
        id: debitTransId,
        accountId: fromId,
        date,
        description: `Transferência enviada para ${toName}: ${description}`,
        category: 'Transferência entre contas',
        amount: -Math.abs(amount),
        type: 'transferencia_saida',
        relatedAccountId: toId,
        relatedAccountName: toName,
        relatedTransferId: transferId,
        status: 'active',
        notes: notes || '',
        createdBy: currentUser?.id || '',
        createdAt: now,
      };
      await setDoc(doc(db, 'bank_transactions', debitTransId), debitTrans);

      // 2. Credit to destination account
      const creditTransId = 'bt_trf_in_' + Date.now();
      const creditTrans: BankTransaction = {
        id: creditTransId,
        accountId: toId,
        date,
        description: `Transferência recebida de ${fromName}: ${description}`,
        category: 'Transferência entre contas',
        amount: Math.abs(amount),
        type: 'transferencia_entrada',
        relatedAccountId: fromId,
        relatedAccountName: fromName,
        relatedTransferId: transferId,
        status: 'active',
        notes: notes || '',
        createdBy: currentUser?.id || '',
        createdAt: now,
      };
      await setDoc(doc(db, 'bank_transactions', creditTransId), creditTrans);

      // Update both balances
      await syncAccountBalance(fromId);
      await syncAccountBalance(toId);

      await logAudit(
        'create',
        'bank_transaction',
        transferId,
        `Transferência de R$ ${amount.toFixed(2)} efetuada de "${fromName}" para "${toName}". (Não classificada como receita ou despesa)`
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
      await setDoc(doc(db, 'calendar_notes', id), newNote);
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

  // 15. USER ROLE MANAGEMENT (ADMIN ONLY)
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
        expenses,
        vales,
        boletos,
        bankAccounts: computedBankAccounts,
        bankTransactions,
        receivables,
        calendarNotes,
        auditLogs,
        systemUsers,
        loading,
        activeBankAccount: computedActiveBankAccount,
        setActiveBankAccount,
        saveClosure,
        reopenClosure,
        updateClosure,
        deleteClosure,
        deleteClosuresBatch,
        createExpense,
        cancelExpense,
        createVale,
        settleVale,
        cancelVale,
        createBoleto,
        payBoleto,
        cancelBoleto,
        deleteBoleto,
        createBankAccount,
        updateBankAccount,
        createBankTransaction,
        cancelBankTransaction,
        deleteBankTransaction,
        deleteAccountStatement,
        transferBetweenAccounts,
        confirmReceivableCredit,
        createCalendarNote,
        toggleCalendarNoteStatus,
        deleteCalendarNote,
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
