import React, { useState, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { BankAccount, BankTransaction, BankTransactionType, BankAccountType } from '../types';
import {
  formatCurrency,
  formatDateBR,
  getTodayDateBR,
  parseCurrencyInput,
  computeBankAccountBalance
} from '../utils/formatters';
import {
  generateBankStatementPDF,
  downloadOrSharePDF,
  printPDF
} from '../services/pdfReportService';
import {
  Landmark,
  PlusCircle,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Printer,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Edit2,
  Search,
  RotateCcw,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';

interface BankAccountsViewProps {
  initialOpenModal?: boolean;
}

export const BankAccountsView: React.FC<BankAccountsViewProps> = ({
  initialOpenModal = false,
}) => {
  const {
    bankAccounts,
    bankTransactions,
    receivables,
    boletos,
    activeBankAccount,
    setActiveBankAccount,
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
  } = useFinance();
  const { currentUser, isAdmin, permissions } = useAuth();
  const canManageBanks = isAdmin || permissions?.canManageBankAccounts;
  const canDeleteOrDeactivateAccount = isAdmin || currentUser?.role === 'admin';

  const extratoSectionRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'extrato' | 'recebiveis'>('extrato');

  // Account Status Filter
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(initialOpenModal);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [creditingReceivableId, setCreditingReceivableId] = useState<string | null>(null);
  const [creditDate, setCreditDate] = useState(getTodayDateBR());

  // Account Delete / Deactivate Modal State
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [deleteAccountReason, setDeleteAccountReason] = useState('');
  const [deleteAccountErrorMsg, setDeleteAccountErrorMsg] = useState('');
  const [isSubmittingDeleteAccount, setIsSubmittingDeleteAccount] = useState(false);

  // Statement Delete & Clear Modals State
  const [transactionToDelete, setTransactionToDelete] = useState<BankTransaction | null>(null);
  const [isDeletingTrans, setIsDeletingTrans] = useState(false);

  // Cancellation / Estorno Modal State
  const [transactionToCancel, setTransactionToCancel] = useState<BankTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingTrans, setIsCancellingTrans] = useState(false);

  const [isClearStatementModalOpen, setIsClearStatementModalOpen] = useState(false);
  const [clearStatementType, setClearStatementType] = useState<'all' | 'range'>('all');
  const [clearStatementStartDate, setClearStatementStartDate] = useState('');
  const [clearStatementEndDate, setClearStatementEndDate] = useState('');
  const [clearStatementConfirmationInput, setClearStatementConfirmationInput] = useState('');
  const [isClearingStatement, setIsClearingStatement] = useState(false);

  // Modal Error & Submitting States
  const [accountErrorMsg, setAccountErrorMsg] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [editAccountErrorMsg, setEditAccountErrorMsg] = useState('');
  const [isSubmittingEditAccount, setIsSubmittingEditAccount] = useState(false);
  const [transErrorMsg, setTransErrorMsg] = useState('');
  const [isSubmittingTrans, setIsSubmittingTrans] = useState(false);
  const [transferErrorMsg, setTransferErrorMsg] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Selected Account (fallback to first account)
  const currentAccount = useMemo(() => {
    if (activeBankAccount && bankAccounts.some((a) => a.id === activeBankAccount.id)) {
      return bankAccounts.find((a) => a.id === activeBankAccount.id) || bankAccounts[0];
    }
    return bankAccounts[0] || null;
  }, [activeBankAccount, bankAccounts]);

  // Consolidated Bank Balance State & Calculation (Contas Compartilhadas)
  const [isConsolidatedCardExpanded, setIsConsolidatedCardExpanded] = useState(false);
  const [isPrivateCardExpanded, setIsPrivateCardExpanded] = useState(false);

  // Separação rigorosa: Contas Compartilhadas vs Contas Privadas
  const sharedBankAccounts = useMemo(() => {
    return bankAccounts.filter((a) => a.visibility !== 'private');
  }, [bankAccounts]);

  const privateBankAccounts = useMemo(() => {
    return bankAccounts.filter((a) => a.visibility === 'private' && a.ownerUid === currentUser?.id);
  }, [bankAccounts, currentUser]);

  // O Saldo Total Bancário Consolidado soma ESTRITAMENTE as contas compartilhadas da empresa
  const totalConsolidatedBankBalance = useMemo(() => {
    return sharedBankAccounts.reduce((acc, a) => {
      const details = computeBankAccountBalance(a, bankTransactions);
      return acc + details.currentBalance;
    }, 0);
  }, [sharedBankAccounts, bankTransactions]);

  // Saldo exclusivo das contas privadas do usuário autenticado
  const totalPrivateBankBalance = useMemo(() => {
    return privateBankAccounts.reduce((acc, a) => {
      const details = computeBankAccountBalance(a, bankTransactions);
      return acc + details.currentBalance;
    }, 0);
  }, [privateBankAccounts, bankTransactions]);

  const displayedBankAccounts = useMemo(() => {
    if (accountStatusFilter === 'active') return bankAccounts.filter((a) => a.status === 'active');
    if (accountStatusFilter === 'inactive') return bankAccounts.filter((a) => a.status === 'inactive');
    return bankAccounts;
  }, [bankAccounts, accountStatusFilter]);

  // Account creation state
  const [accName, setAccName] = useState('');
  const [accBankName, setAccBankName] = useState('Banco do Brasil');
  const [accType, setAccType] = useState<BankAccountType>('corrente');
  const [accVisibility, setAccVisibility] = useState<'shared' | 'private'>('shared');
  const [accAgency, setAccAgency] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accInitialBalanceStr, setAccInitialBalanceStr] = useState('0,00');
  const [accInitialDate, setAccInitialDate] = useState(getTodayDateBR());
  const [accNotes, setAccNotes] = useState('');

  // Account edit state
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccBankName, setEditAccBankName] = useState('');
  const [editAccType, setEditAccType] = useState<BankAccountType>('corrente');
  const [editAccAgency, setEditAccAgency] = useState('');
  const [editAccNumber, setEditAccNumber] = useState('');
  const [editAccInitialBalanceStr, setEditAccInitialBalanceStr] = useState('0,00');
  const [editAccInitialDate, setEditAccInitialDate] = useState(getTodayDateBR());
  const [editAccNotes, setEditAccNotes] = useState('');

  // Transaction state
  const [transAccountId, setTransAccountId] = useState(currentAccount?.id || '');
  const [transDirection, setTransDirection] = useState<'entrada' | 'saida'>('entrada');
  const [transType, setTransType] = useState<BankTransactionType>('deposito');
  const [transAmountStr, setTransAmountStr] = useState('');
  const [transDate, setTransDate] = useState(getTodayDateBR());
  const [transDesc, setTransDesc] = useState('');
  const [transCategory, setTransCategory] = useState('Depósito Bancário');
  const [transDocNumber, setTransDocNumber] = useState('');
  const [transNotes, setTransNotes] = useState('');

  // Transfer state
  const [trfFromId, setTrfFromId] = useState(currentAccount?.id || '');
  const [trfToId, setTrfToId] = useState('');
  const [trfAmountStr, setTrfAmountStr] = useState('');
  const [trfDate, setTrfDate] = useState(getTodayDateBR());
  const [trfDesc, setTrfDesc] = useState('Transferência entre contas');
  const [trfDocNumber, setTrfDocNumber] = useState('');
  const [trfNotes, setTrfNotes] = useState('');

  // Extrato Filters
  const [stmtStartDate, setStmtStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [stmtEndDate, setStmtEndDate] = useState(getTodayDateBR());
  const [stmtTypeFilter, setStmtTypeFilter] = useState<'all' | 'entrada' | 'saida' | 'transferencia'>('all');
  const [stmtCategoryFilter, setStmtCategoryFilter] = useState('all');
  const [stmtSearchTerm, setStmtSearchTerm] = useState('');

  // Active transactions for current account
  const accountActiveTransactions = useMemo(() => {
    if (!currentAccount) return [];
    return bankTransactions.filter(
      (t) =>
        t.accountId === currentAccount.id &&
        t.status === 'active' &&
        !t.relatedClosureId &&
        t.category !== 'Saldo de Abertura' &&
        !t.id?.startsWith('bt_init_')
    );
  }, [bankTransactions, currentAccount]);

  // Available categories for extrato filter
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    accountActiveTransactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [accountActiveTransactions]);

  // Balance prior to selected period
  const periodPriorBalance = useMemo(() => {
    if (!currentAccount) return 0;
    const priorTrans = accountActiveTransactions.filter((t) => t.date < stmtStartDate);
    const sumPrior = priorTrans.reduce((acc, t) => acc + t.amount, 0);
    return currentAccount.initialBalance + sumPrior;
  }, [currentAccount, accountActiveTransactions, stmtStartDate]);

  // Filtered in-period transactions with progressive balance calculation
  const statementItems = useMemo(() => {
    if (!currentAccount) return [];

    let filtered = accountActiveTransactions.filter(
      (t) => t.date >= stmtStartDate && t.date <= stmtEndDate
    );

    if (stmtTypeFilter === 'entrada') {
      filtered = filtered.filter((t) => t.amount > 0 && !t.type.includes('transferencia'));
    } else if (stmtTypeFilter === 'saida') {
      filtered = filtered.filter((t) => t.amount < 0 && !t.type.includes('transferencia'));
    } else if (stmtTypeFilter === 'transferencia') {
      filtered = filtered.filter((t) => t.type.includes('transferencia') || Boolean(t.relatedTransferId));
    }

    if (stmtCategoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === stmtCategoryFilter);
    }

    if (stmtSearchTerm.trim()) {
      const q = stmtSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
          (t.responsibleName && t.responsibleName.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Chronological sort
    filtered.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let running = periodPriorBalance;
    return filtered.map((tx) => {
      running += tx.amount;
      return {
        ...tx,
        balanceAfter: running,
      };
    });
  }, [
    currentAccount,
    accountActiveTransactions,
    stmtStartDate,
    stmtEndDate,
    stmtTypeFilter,
    stmtCategoryFilter,
    stmtSearchTerm,
    periodPriorBalance,
  ]);

  // Totals for the period
  const periodTotals = useMemo(() => {
    const totalEntradas = statementItems.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const totalSaidas = statementItems.filter((t) => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const finalBalance = periodPriorBalance + totalEntradas - totalSaidas;

    return {
      initialBalance: periodPriorBalance,
      totalEntradas,
      totalSaidas,
      finalBalance,
      count: statementItems.length,
    };
  }, [statementItems, periodPriorBalance]);

  // Transactions matching clear statement filter
  const statementTransactionsToClear = useMemo(() => {
    if (!currentAccount) return [];
    if (clearStatementType === 'all') {
      return accountActiveTransactions;
    }
    if (clearStatementType === 'range') {
      return accountActiveTransactions.filter((t) => {
        const matchStart = !clearStatementStartDate || t.date >= clearStatementStartDate;
        const matchEnd = !clearStatementEndDate || t.date <= clearStatementEndDate;
        return matchStart && matchEnd;
      });
    }
    return [];
  }, [currentAccount, accountActiveTransactions, clearStatementType, clearStatementStartDate, clearStatementEndDate]);

  // Pending card receivables
  const pendingReceivables = useMemo(() => {
    return receivables.filter((r) => r.status === 'pendente');
  }, [receivables]);

  // Open Edit Modal for a specific account
  const handleOpenEditAccount = (acc: BankAccount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingAccount(acc);
    setEditAccName(acc.name);
    setEditAccBankName(acc.bankName);
    setEditAccType(acc.accountType);
    setEditAccAgency(acc.agency || '');
    setEditAccNumber(acc.accountNumberMasked || '');
    setEditAccInitialBalanceStr(acc.initialBalance.toFixed(2).replace('.', ','));
    setEditAccInitialDate(acc.initialBalanceDate || getTodayDateBR());
    setEditAccNotes(acc.notes || '');
    setEditAccountErrorMsg('');
    setIsEditAccountModalOpen(true);
  };

  // Open New Transaction Modal for a specific account (ensures active account)
  const handleOpenNewTransaction = (accId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const activeList = bankAccounts.filter((a) => a.status === 'active');
    const targetId = accId || (currentAccount?.status === 'active' ? currentAccount.id : activeList[0]?.id) || '';
    setTransAccountId(targetId);
    setTransDirection('entrada');
    setTransType('deposito');
    setTransAmountStr('');
    setTransDate(getTodayDateBR());
    setTransCategory('Depósito Bancário');
    setTransDesc('');
    setTransDocNumber('');
    setTransNotes('');
    setTransErrorMsg('');
    setIsTransactionModalOpen(true);
  };

  // Open Transfer Modal with specific origin account (ensures active accounts)
  const handleOpenTransfer = (originId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const activeList = bankAccounts.filter((a) => a.status === 'active');
    const from = originId || (currentAccount?.status === 'active' ? currentAccount.id : activeList[0]?.id) || '';
    setTrfFromId(from);
    const destination = activeList.find((a) => a.id !== from);
    setTrfToId(destination ? destination.id : '');
    setTrfAmountStr('');
    setTrfDate(getTodayDateBR());
    setTrfDesc('Transferência entre contas');
    setTrfDocNumber('');
    setTrfNotes('');
    setTransferErrorMsg('');
    setIsTransferModalOpen(true);
  };

  // Select account and scroll to statement
  const handleViewStatement = (acc: BankAccount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveBankAccount(acc);
    setActiveTab('extrato');
    setTimeout(() => {
      extratoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Open Delete / Deactivate Account Modal
  const handleOpenDeleteAccountModal = (acc: BankAccount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAccountToDelete(acc);
    setDeleteAccountReason('');
    setDeleteAccountErrorMsg('');
  };

  // Confirm Delete or Deactivate Account
  const handleConfirmDeleteOrDeactivate = async () => {
    if (!accountToDelete) return;
    setIsSubmittingDeleteAccount(true);
    setDeleteAccountErrorMsg('');

    try {
      const relatedTxs = bankTransactions.filter(
        (t) => t.accountId === accountToDelete.id || t.relatedAccountId === accountToDelete.id
      );
      const hasInitialBalance = (accountToDelete.initialBalance || 0) > 0;
      const hasHistory = relatedTxs.length > 0 || hasInitialBalance;

      if (hasHistory) {
        await deactivateBankAccount(accountToDelete.id, deleteAccountReason.trim() || undefined);
        showToast(`Conta "${accountToDelete.name}" desativada com sucesso. Histórico e extrato preservados!`);
      } else {
        await deleteBankAccount(accountToDelete.id, deleteAccountReason.trim() || undefined);
        showToast(`Conta "${accountToDelete.name}" excluída definitivamente.`);
      }

      setAccountToDelete(null);
    } catch (err: any) {
      console.error('Erro na exclusão/desativação da conta:', err);
      setDeleteAccountErrorMsg(err.message || 'Erro ao processar a solicitação.');
    } finally {
      setIsSubmittingDeleteAccount(false);
    }
  };

  // Reactivate Account
  const handleReactivateAccount = async (acc: BankAccount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await reactivateBankAccount(acc.id);
      showToast(`Conta "${acc.name}" reativada com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao reativar conta:', err);
      showToast(err.message || 'Erro ao reativar conta.', 'error');
    }
  };

  // Handle Save New Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAccountErrorMsg('');

    if (!accName.trim()) {
      setAccountErrorMsg('Informe o nome identificador da conta.');
      return;
    }
    if (!accBankName.trim()) {
      setAccountErrorMsg('Informe o nome da instituição bancária.');
      return;
    }

    const initBalance = parseCurrencyInput(accInitialBalanceStr);
    setIsSubmittingAccount(true);

    try {
      await createBankAccount({
        name: accName.trim(),
        bankName: accBankName.trim(),
        accountType: accType,
        agency: accAgency.trim() || '',
        accountNumberMasked: accNumber.trim() || 'Sem número',
        initialBalance: initBalance,
        initialBalanceDate: accInitialDate,
        status: 'active',
        visibility: accVisibility,
        notes: accNotes.trim() || '',
      });

      showToast(
        `Conta bancária ${accVisibility === 'private' ? 'privada ' : ''}"${accName.trim()}" cadastrada com sucesso!`
      );
      setIsAccountModalOpen(false);
      setAccName('');
      setAccBankName('Banco do Brasil');
      setAccType('corrente');
      setAccVisibility('shared');
      setAccAgency('');
      setAccNumber('');
      setAccInitialBalanceStr('0,00');
      setAccNotes('');
    } catch (err: any) {
      console.error('Erro ao cadastrar conta bancária:', err);
      setAccountErrorMsg(err.message || 'Erro ao cadastrar conta bancária.');
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  // Handle Save Edit Account
  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingAccount) return;
    setEditAccountErrorMsg('');

    if (!editAccName.trim()) {
      setEditAccountErrorMsg('Informe o nome da conta.');
      return;
    }
    if (!editAccBankName.trim()) {
      setEditAccountErrorMsg('Informe o nome da instituição financeira.');
      return;
    }

    const newInitBalance = parseCurrencyInput(editAccInitialBalanceStr);
    setIsSubmittingEditAccount(true);

    try {
      await updateBankAccount(editingAccount.id, {
        name: editAccName.trim(),
        bankName: editAccBankName.trim(),
        accountType: editAccType,
        agency: editAccAgency.trim() || '',
        accountNumberMasked: editAccNumber.trim() || 'Sem número',
        initialBalance: newInitBalance,
        initialBalanceDate: editAccInitialDate,
        notes: editAccNotes.trim() || '',
      });

      showToast(`Conta "${editAccName.trim()}" atualizada com sucesso!`);
      setIsEditAccountModalOpen(false);
      setEditingAccount(null);
    } catch (err: any) {
      console.error('Erro ao atualizar conta bancária:', err);
      setEditAccountErrorMsg(err.message || 'Erro ao atualizar conta bancária.');
    } finally {
      setIsSubmittingEditAccount(false);
    }
  };

  // Handle Create Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTransErrorMsg('');

    const targetAcc = bankAccounts.find((a) => a.id === transAccountId);
    if (!targetAcc) {
      setTransErrorMsg('Selecione uma conta bancária válida.');
      return;
    }

    const val = parseCurrencyInput(transAmountStr);
    if (val <= 0) {
      setTransErrorMsg('Informe um valor válido maior que zero (R$).');
      return;
    }

    if (!transDesc.trim()) {
      setTransErrorMsg('Informe uma descrição para a movimentação.');
      return;
    }

    const effectiveAmount = transDirection === 'entrada' ? val : -val;

    setIsSubmittingTrans(true);
    try {
      const responsible = currentUser?.displayName || currentUser?.username || 'Responsável';

      await createBankTransaction({
        accountId: targetAcc.id,
        date: transDate,
        description: transDesc.trim(),
        category: transCategory.trim() || (transDirection === 'entrada' ? 'Entrada Diversa' : 'Saída Diversa'),
        amount: effectiveAmount,
        type: transType,
        documentNumber: transDocNumber.trim() || '',
        responsibleName: responsible,
        notes: transNotes.trim() || '',
        status: 'active',
      });

      showToast(`Movimentação de ${formatCurrency(val)} lançada na conta "${targetAcc.name}" com sucesso!`);
      setIsTransactionModalOpen(false);
      setTransAmountStr('');
      setTransDesc('');
      setTransDocNumber('');
      setTransNotes('');
    } catch (err: any) {
      console.error('Erro ao registrar movimentação bancária:', err);
      setTransErrorMsg(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setIsSubmittingTrans(false);
    }
  };

  // Handle Transfer Between Accounts
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTransferErrorMsg('');

    if (!trfFromId || !trfToId) {
      setTransferErrorMsg('Selecione a conta de origem e a conta de destino.');
      return;
    }
    if (trfFromId === trfToId) {
      setTransferErrorMsg('A conta de origem não pode ser igual à conta de destino.');
      return;
    }

    const val = parseCurrencyInput(trfAmountStr);
    if (val <= 0) {
      setTransferErrorMsg('Informe um valor válido maior que zero (R$).');
      return;
    }

    const fromAcc = bankAccounts.find((a) => a.id === trfFromId);
    if (fromAcc) {
      const fromDetails = computeBankAccountBalance(fromAcc, bankTransactions);
      if (fromDetails.currentBalance < val) {
        setTransferErrorMsg(
          `Saldo insuficiente na conta "${fromAcc.name}". Disponível: ${formatCurrency(
            fromDetails.currentBalance
          )}, solicitado: ${formatCurrency(val)}.`
        );
        return;
      }
    }

    setIsSubmittingTransfer(true);
    try {
      await transferBetweenAccounts(
        trfFromId,
        trfToId,
        val,
        trfDate,
        trfDesc.trim() || 'Transferência entre contas',
        trfNotes.trim() || '',
        trfDocNumber.trim() || ''
      );

      showToast(`Transferência de ${formatCurrency(val)} concluída com sucesso!`);
      setIsTransferModalOpen(false);
      setTrfAmountStr('');
      setTrfDesc('Transferência entre contas');
      setTrfDocNumber('');
      setTrfNotes('');
    } catch (err: any) {
      console.error('Erro ao transferir entre contas:', err);
      setTransferErrorMsg(err.message || 'Erro ao transferir entre contas.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Handle Confirm Cancellation / Estorno
  const handleConfirmCancelTransaction = async () => {
    if (!transactionToCancel) return;
    if (!cancelReason.trim()) {
      showToast('Informe a justificativa do estorno.', 'error');
      return;
    }

    setIsCancellingTrans(true);
    try {
      await cancelBankTransaction(transactionToCancel.id, cancelReason.trim());
      showToast(`Movimentação "${transactionToCancel.description}" estornada com sucesso!`);
      setTransactionToCancel(null);
      setCancelReason('');
    } catch (err: any) {
      console.error('Erro ao estornar movimentação:', err);
      showToast(err.message || 'Erro ao estornar movimentação.', 'error');
    } finally {
      setIsCancellingTrans(false);
    }
  };

  // Handle Confirm Delete Single Transaction
  const handleConfirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingTrans(true);
    try {
      await deleteBankTransaction(transactionToDelete.id, 'Exclusão individual pelo extrato bancário');
      showToast(`Movimentação "${transactionToDelete.description}" excluída com sucesso!`);
      setTransactionToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir movimentação:', err);
      showToast(err.message || 'Erro ao excluir movimentação.', 'error');
    } finally {
      setIsDeletingTrans(false);
    }
  };

  // Handle Confirm Clear Account Statement
  const handleConfirmClearStatement = async () => {
    if (!currentAccount || statementTransactionsToClear.length === 0) return;
    if (clearStatementConfirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Digite EXCLUIR para confirmar a exclusão do extrato.', 'error');
      return;
    }
    setIsClearingStatement(true);
    try {
      const ids = statementTransactionsToClear.map((t) => t.id);
      await deleteAccountStatement(
        currentAccount.id,
        ids,
        `Limpeza de extrato: ${ids.length} lançamentos excluídos pelo usuário`
      );
      showToast(`${ids.length} lançamento(s) excluído(s) do extrato com sucesso.`);
      setIsClearStatementModalOpen(false);
      setClearStatementConfirmationInput('');
    } catch (err: any) {
      console.error('Erro ao excluir extrato:', err);
      showToast(err.message || 'Erro ao excluir extrato.', 'error');
    } finally {
      setIsClearingStatement(false);
    }
  };

  // Handle Card Receivable Credit
  const handleConfirmReceivable = async (rId: string) => {
    if (!currentAccount) return;
    try {
      await confirmReceivableCredit(rId, currentAccount.id, creditDate);
      showToast('Valor de cartão creditado na conta com sucesso!');
      setCreditingReceivableId(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao creditar recebível.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4 ${
            toastType === 'error'
              ? 'bg-red-700 text-white border border-red-800'
              : 'bg-emerald-800 text-white'
          }`}
        >
          {toastType === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-200" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Controle Bancário Profissional
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {bankAccounts.length} conta(s) ativa(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão transparente de contas bancárias, transferências internas atômicas e extrato cronológico auditável.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenTransfer()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>Transferir Dinheiro</span>
          </button>

          <button
            onClick={() => handleOpenNewTransaction()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>Nova Movimentação</span>
          </button>

          {canManageBanks && (
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-amber-300" />
              <span>Nova Conta Bancária</span>
            </button>
          )}
        </div>
      </div>

      {/* CARTÃO DE SALDO BANCÁRIO CONSOLIDADO (RESPONSIVO COM EXPANSÃO/RECOLHIMENTO) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200">
        {/* Header clicável do Cartão Consolidado */}
        <button
          type="button"
          onClick={() => setIsConsolidatedCardExpanded((prev) => !prev)}
          className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer select-none"
          aria-expanded={isConsolidatedCardExpanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
              <Landmark className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Saldo Total Bancário
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {sharedBankAccounts.length} conta{sharedBankAccounts.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
                {formatCurrency(totalConsolidatedBankBalance)}
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                {isConsolidatedCardExpanded ? (
                  <>
                    <span>Toque para recolher os detalhes</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Toque para ver os saldos por conta</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Ícone de toggle expansão à direita */}
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 self-center">
            {isConsolidatedCardExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </button>

        {/* Área expansível com a lista dos saldos individuais de cada banco compartilhado */}
        {isConsolidatedCardExpanded && (
          <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 pt-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Discriminação por Conta Bancária
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {sharedBankAccounts.length} conta{sharedBankAccounts.length === 1 ? '' : 's'} cadastrada{sharedBankAccounts.length === 1 ? '' : 's'}
              </span>
            </div>

            {sharedBankAccounts.length > 0 ? (
              <div className="space-y-2">
                {sharedBankAccounts.map((acc) => {
                  const accDetails = computeBankAccountBalance(acc, bankTransactions);
                  const isCurrent = currentAccount?.id === acc.id;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleViewStatement(acc)}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-white border-emerald-600/70 shadow-xs ring-1 ring-emerald-600/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      title="Toque para ver o extrato desta conta"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs border border-emerald-100">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {acc.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                              {acc.bankName}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              • {acc.accountType}
                            </span>
                          </div>
                          {(acc.agency || acc.accountNumberMasked) && (
                            <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                              {acc.agency ? `Agência: ${acc.agency} ` : ''}
                              {acc.accountNumberMasked && acc.accountNumberMasked !== 'Sem número'
                                ? `| Conta: ${acc.accountNumberMasked}`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block sm:hidden">Saldo atual:</span>
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {formatCurrency(accDetails.currentBalance)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleViewStatement(acc, e)}
                          className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline px-2 py-1 rounded hover:bg-emerald-50 transition"
                        >
                          Ver extrato →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Nenhuma conta bancária cadastrada no momento.
              </div>
            )}

            {/* Rodapé da seção expandida */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
              <span>Soma conferida: <strong>{formatCurrency(totalConsolidatedBankBalance)}</strong></span>
              <button
                type="button"
                onClick={() => setIsConsolidatedCardExpanded(false)}
                className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer flex items-center gap-1"
              >
                <span>Recolher</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CARTÃO DE SALDO DAS CONTAS PRIVADAS (EXCLUSIVO DO PROPRIETÁRIO) */}
      {privateBankAccounts.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50/70 to-indigo-50/70 rounded-2xl border border-purple-200 shadow-xs overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setIsPrivateCardExpanded((prev) => !prev)}
            className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-purple-100/40 transition cursor-pointer select-none"
            aria-expanded={isPrivateCardExpanded}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-purple-900">
                    Minhas Contas Privadas
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900 border border-purple-300 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> PRIVADA ({privateBankAccounts.length})
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-purple-950 tracking-tight mt-0.5 truncate">
                  {formatCurrency(totalPrivateBankBalance)}
                </div>
                <p className="text-[11px] sm:text-xs font-medium text-purple-700 flex items-center gap-1 mt-0.5">
                  {isPrivateCardExpanded ? (
                    <>
                      <span>Toque para recolher os detalhes</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Toque para ver os saldos privados por conta</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-purple-100/80 text-purple-700 shrink-0 self-center">
              {isPrivateCardExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {isPrivateCardExpanded && (
            <div className="border-t border-purple-200/80 bg-white/80 p-4 sm:p-5 pt-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">
                  Discriminação das Contas Privadas (Isolamento Real)
                </span>
                <span className="text-[11px] text-purple-800 font-medium">
                  {privateBankAccounts.length} conta{privateBankAccounts.length === 1 ? '' : 's'} privada{privateBankAccounts.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {privateBankAccounts.map((acc) => {
                  const accDetails = computeBankAccountBalance(acc, bankTransactions);
                  const isCurrent = currentAccount?.id === acc.id;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleViewStatement(acc)}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-purple-50/70 border-purple-500 shadow-xs ring-1 ring-purple-500/20'
                          : 'bg-white border-purple-200 hover:border-purple-300'
                      }`}
                      title="Toque para ver o extrato privado desta conta"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 font-bold text-xs border border-purple-200">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {acc.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> PRIVADA
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                              {acc.bankName}
                            </span>
                          </div>
                          {(acc.agency || acc.accountNumberMasked) && (
                            <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                              {acc.agency ? `Agência: ${acc.agency} ` : ''}
                              {acc.accountNumberMasked && acc.accountNumberMasked !== 'Sem número'
                                ? `| Conta: ${acc.accountNumberMasked}`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-purple-100">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block sm:hidden">Saldo atual:</span>
                          <span className="font-black text-purple-950 text-sm sm:text-base">
                            {formatCurrency(accDetails.currentBalance)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleViewStatement(acc, e)}
                          className="text-[11px] font-bold text-purple-800 hover:text-purple-950 underline px-2 py-1 rounded hover:bg-purple-100 transition"
                        >
                          Ver extrato →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-2.5 border-t border-purple-200/80 flex items-center justify-between text-[11px] text-purple-800">
                <span>Soma das contas privadas: <strong>{formatCurrency(totalPrivateBankBalance)}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsPrivateCardExpanded(false)}
                  className="text-purple-700 hover:text-purple-950 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <span>Recolher</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. CARDS PRINCIPAIS DE CONTAS BANCÁRIAS */}
      {/* Filtro de Status das Contas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit text-xs">
          <button
            type="button"
            onClick={() => setAccountStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              accountStatusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({bankAccounts.length})
          </button>
          <button
            type="button"
            onClick={() => setAccountStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              accountStatusFilter === 'active'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ativas ({bankAccounts.filter((a) => a.status === 'active').length})
          </button>
          {bankAccounts.some((a) => a.status === 'inactive') && (
            <button
              type="button"
              onClick={() => setAccountStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                accountStatusFilter === 'inactive'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Desativadas ({bankAccounts.filter((a) => a.status === 'inactive').length})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedBankAccounts.length > 0 ? (
          displayedBankAccounts.map((acc) => {
            const isSelected = currentAccount?.id === acc.id;
            const accDetails = computeBankAccountBalance(acc, bankTransactions);

            // Últimas 3 movimentações desta conta
            const latestTransactions = bankTransactions
              .filter(
                (t) =>
                  t.accountId === acc.id &&
                  t.status === 'active' &&
                  !t.relatedClosureId &&
                  t.category !== 'Saldo de Abertura' &&
                  !t.id?.startsWith('bt_init_')
              )
              .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
              .slice(0, 3);

            return (
              <div
                key={acc.id}
                className={`rounded-2xl border transition overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white border-emerald-700 shadow-md ring-2 ring-emerald-800/15'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                } ${acc.status === 'inactive' ? 'opacity-90 bg-slate-50/50' : ''}`}
              >
                {/* Header do Card */}
                <div className="p-5 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {acc.visibility === 'private' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1 text-purple-800 bg-purple-100 border border-purple-300">
                            <Lock className="w-3 h-3 text-purple-700" />
                            PRIVADA
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block ${
                            acc.status === 'inactive'
                              ? 'text-rose-700 bg-rose-50 border border-rose-200'
                              : acc.visibility === 'private'
                              ? 'text-purple-900 bg-purple-50'
                              : 'text-emerald-800 bg-emerald-50'
                          }`}
                        >
                          {acc.status === 'inactive'
                            ? 'Conta Desativada'
                            : `${acc.bankName} • ${acc.accountType.toUpperCase()}`}
                        </span>
                        {acc.status === 'inactive' && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {acc.bankName} • {acc.accountType.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{acc.name}</h3>
                      <p className="text-[11px] text-slate-500">
                        Agência: {acc.agency || '-'} | Conta: {acc.accountNumberMasked}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 text-emerald-900">
                      <Landmark className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Saldo Atual */}
                  <div className="mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500 block">Saldo Atual Disponível</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                      {formatCurrency(accDetails.currentBalance)}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Abertura: {formatCurrency(acc.initialBalance)}</span>
                      <span>Data: {formatDateBR(acc.initialBalanceDate)}</span>
                    </div>
                  </div>

                  {/* Histórico Resumido das Últimas Movimentações */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Últimas Movimentações:
                    </span>
                    {latestTransactions.length > 0 ? (
                      latestTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <div className="truncate max-w-[170px]">
                            <span className="text-slate-400 font-mono text-[10px] mr-1">
                              {formatDateBR(tx.date).slice(0, 5)}
                            </span>
                            <span className="text-slate-700 font-medium truncate">{tx.description}</span>
                          </div>
                          <span
                            className={`font-bold whitespace-nowrap ${
                              tx.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-400 italic py-1">Nenhuma movimentação registrada.</p>
                    )}
                  </div>
                </div>

                {/* Botões de Ação do Card */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleViewStatement(acc, e)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold transition shadow-2xs cursor-pointer"
                      title="Ver extrato completo desta conta"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Ver Extrato</span>
                    </button>

                    {acc.status === 'active' ? (
                      <button
                        type="button"
                        onClick={(e) => handleOpenNewTransaction(acc.id, e)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-2xs cursor-pointer"
                        title="Lançar entrada ou saída nesta conta"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                        <span>Movimentar</span>
                      </button>
                    ) : canDeleteOrDeactivateAccount ? (
                      <button
                        type="button"
                        onClick={(e) => handleReactivateAccount(acc, e)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold transition shadow-2xs cursor-pointer"
                        title="Reativar esta conta bancária para novas movimentações"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Reativar</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center py-2 px-2 rounded-xl bg-slate-100 text-slate-400 font-semibold text-[11px]">
                        Inativa
                      </div>
                    )}

                    {acc.status === 'active' && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenTransfer(acc.id, e)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-blue-700 font-bold transition shadow-2xs cursor-pointer"
                        title="Transferir dinheiro desta conta para outra"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                        <span>Transferir</span>
                      </button>
                    )}

                    {canManageBanks && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditAccount(acc, e)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-slate-700 font-bold transition shadow-2xs cursor-pointer ${
                          acc.status === 'inactive' ? 'col-span-2' : ''
                        }`}
                        title="Editar informações cadastrais desta conta"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Editar Conta</span>
                      </button>
                    )}

                    {canDeleteOrDeactivateAccount && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteAccountModal(acc, e)}
                        className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-700 font-bold transition shadow-2xs cursor-pointer"
                        title="Excluir ou desativar esta conta bancária"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Excluir Conta</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-8 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Nenhuma conta bancária encontrada no filtro selecionado.
          </div>
        )}
      </div>

      {/* 2. ÁREA DE EXTRATO DETALHADO DO BANCO SELECIONADO */}
      {currentAccount && (
        <div ref={extratoSectionRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
          {/* Top Bar da Conta Selecionada */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Extrato: {currentAccount.name} ({currentAccount.bankName})
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  Saldo Atual: {formatCurrency(currentAccount.currentBalance)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Conta: {currentAccount.accountNumberMasked} | Agência: {currentAccount.agency || '-'} | Abertura:{' '}
                {formatDateBR(currentAccount.initialBalanceDate)} ({formatCurrency(currentAccount.initialBalance)})
              </p>
            </div>

            {/* Ações do Extrato */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenNewTransaction(currentAccount.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Nova Movimentação</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const doc = generateBankStatementPDF(
                    currentAccount,
                    bankTransactions,
                    stmtStartDate,
                    stmtEndDate,
                    stmtTypeFilter,
                    stmtCategoryFilter,
                    stmtSearchTerm
                  );
                  await downloadOrSharePDF(
                    doc,
                    `Extrato_${currentAccount.name.replace(/\s+/g, '_')}_${stmtStartDate}_a_${stmtEndDate}.pdf`,
                    `Extrato Bancário - ${currentAccount.name}`
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                title="Exportar Extrato com filtros em PDF"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const doc = generateBankStatementPDF(
                    currentAccount,
                    bankTransactions,
                    stmtStartDate,
                    stmtEndDate,
                    stmtTypeFilter,
                    stmtCategoryFilter,
                    stmtSearchTerm
                  );
                  printPDF(doc);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                title="Imprimir Extrato"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Seletor de Conta Rápido & Tabs (Extrato / Recebíveis) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 pl-2">Trocar Conta:</span>
              <select
                value={currentAccount.id}
                onChange={(e) => {
                  const acc = bankAccounts.find((a) => a.id === e.target.value);
                  if (acc) setActiveBankAccount(acc);
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs"
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.bankName}){a.status === 'inactive' ? ' [Inativa]' : ''} — {formatCurrency(a.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-slate-200/70 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('extrato')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'extrato'
                    ? 'bg-white text-emerald-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Extrato Cronológico ({accountActiveTransactions.length})
              </button>
              <button
                onClick={() => setActiveTab('recebiveis')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'recebiveis'
                    ? 'bg-white text-emerald-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Cartões a Receber</span>
                {pendingReceivables.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {pendingReceivables.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* FILTROS DO EXTRATO BANCÁRIO */}
          {activeTab === 'extrato' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50/70 border border-slate-200/90 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* Data Inicial */}
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={stmtStartDate}
                    onChange={(e) => setStmtStartDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                {/* Data Final */}
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={stmtEndDate}
                    onChange={(e) => setStmtEndDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                {/* Tipo de Movimentação */}
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Tipo</label>
                  <select
                    value={stmtTypeFilter}
                    onChange={(e) => setStmtTypeFilter(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="all">Todas as Movimentações</option>
                    <option value="entrada">Apenas Entradas (+)</option>
                    <option value="saida">Apenas Saídas (-)</option>
                    <option value="transferencia">Apenas Transferências</option>
                  </select>
                </div>

                {/* Categoria */}
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Categoria</label>
                  <select
                    value={stmtCategoryFilter}
                    onChange={(e) => setStmtCategoryFilter(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="all">Todas as Categorias</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Busca Textual */}
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Pesquisar</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={stmtSearchTerm}
                      onChange={(e) => setStmtSearchTerm(e.target.value)}
                      placeholder="Descrição, doc, responsável..."
                      className="w-full p-2 pl-7 rounded-xl border border-slate-200 bg-white text-slate-800"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
                  </div>
                </div>
              </div>

              {/* CABEÇALHO DE TOTAIS DO PERÍODO */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Anterior</span>
                  <div className="text-base font-black text-slate-800 mt-0.5">
                    {formatCurrency(periodTotals.initialBalance)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Antes de {formatDateBR(stmtStartDate)}</span>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Entradas (+)</span>
                  <div className="text-base font-black text-emerald-800 mt-0.5">
                    +{formatCurrency(periodTotals.totalEntradas)}
                  </div>
                  <span className="text-[10px] text-emerald-600 block">Créditos no período</span>
                </div>

                <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Saídas (-)</span>
                  <div className="text-base font-black text-rose-800 mt-0.5">
                    -{formatCurrency(periodTotals.totalSaidas)}
                  </div>
                  <span className="text-[10px] text-rose-600 block">Débitos no período</span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-white">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block">Saldo Final do Período</span>
                  <div className="text-base font-black text-white mt-0.5">
                    {formatCurrency(periodTotals.finalBalance)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Em {formatDateBR(stmtEndDate)}</span>
                </div>

                <div className="col-span-2 md:col-span-1 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Movimentações</span>
                  <div className="text-base font-black text-slate-800 mt-0.5">
                    {periodTotals.count} registro(s)
                  </div>
                  {accountActiveTransactions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setClearStatementType('all');
                        setClearStatementStartDate('');
                        setClearStatementEndDate('');
                        setClearStatementConfirmationInput('');
                        setIsClearStatementModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline self-start cursor-pointer mt-1"
                    >
                      Limpar Extrato
                    </button>
                  )}
                </div>
              </div>

              {/* TABELA DO EXTRATO BANCÁRIO */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Data</th>
                      <th className="py-3 px-3.5">Descrição</th>
                      <th className="py-3 px-3.5">Categoria</th>
                      <th className="py-3 px-3.5">Operação</th>
                      <th className="py-3 px-3.5 text-right text-emerald-800">Entrada (+)</th>
                      <th className="py-3 px-3.5 text-right text-rose-700">Saída (-)</th>
                      <th className="py-3 px-3.5 text-right">Saldo Acumulado</th>
                      <th className="py-3 px-3.5">Responsável / Doc</th>
                      <th className="py-3 px-3.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {statementItems.length > 0 ? (
                      statementItems.map((tx) => {
                        const isCredit = tx.amount >= 0;
                        const isTransfer = tx.type.includes('transferencia') || Boolean(tx.relatedTransferId);

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                              {formatDateBR(tx.date)}
                            </td>
                            <td className="py-3 px-3.5 font-medium text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{tx.description}</span>
                                {isTransfer && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                                    Transferência
                                  </span>
                                )}
                              </div>
                              {tx.notes && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  {tx.notes}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-600">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                                {tx.category}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 capitalize">
                              {tx.type.replace('_', ' ')}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold whitespace-nowrap text-emerald-700">
                              {isCredit ? `+ ${formatCurrency(tx.amount)}` : '-'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold whitespace-nowrap text-rose-600">
                              {!isCredit ? formatCurrency(Math.abs(tx.amount)) : '-'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-black whitespace-nowrap text-slate-900 bg-slate-50/50">
                              {formatCurrency(tx.balanceAfter)}
                            </td>
                            <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                              <div>{tx.responsibleName || 'Sistema'}</div>
                              {tx.documentNumber && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Doc: {tx.documentNumber}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransactionToCancel(tx);
                                    setCancelReason('');
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 transition cursor-pointer"
                                  title="Estornar lançamento (gera lançamento inverso auditável)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTransactionToDelete(tx)}
                                  className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                                  title="Excluir lançamento do extrato"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                          <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-600">Nenhuma movimentação localizada para o período selecionado.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Saldo inicial do período: {formatCurrency(periodTotals.initialBalance)}. Ajuste as datas ou lance uma nova movimentação.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 2: CARTÕES A RECEBER */}
          {activeTab === 'recebiveis' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <strong>Liquidação de Cartões:</strong> Quando a operadora de cartão depositar os valores na sua conta, clique em <strong>Creditar na Conta</strong> para transferir do valor a receber para o saldo da conta selecionada.
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Data Venda</th>
                      <th className="py-3 px-4">Cartão</th>
                      <th className="py-3 px-4 text-right">Valor Bruto</th>
                      <th className="py-3 px-4 text-right">Taxa (%)</th>
                      <th className="py-3 px-4 text-right">Valor Líquido</th>
                      <th className="py-3 px-4 text-center">Situação</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {receivables.length > 0 ? (
                      receivables.map((rec) => {
                        const isCredited = rec.status === 'creditado';
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {formatDateBR(rec.date)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[11px] font-bold">
                                {rec.cardType.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {formatCurrency(rec.grossAmount)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500">
                              {rec.feePercentage}% ({formatCurrency(rec.feeAmount)})
                            </td>
                            <td className="py-3 px-4 text-right font-bold whitespace-nowrap text-emerald-700">
                              {formatCurrency(rec.netAmount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCredited
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isCredited ? 'Creditado no Banco' : 'Pendente de Crédito'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {!isCredited ? (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmReceivable(rec.id)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                                >
                                  Creditar no Banco
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  Creditado em {rec.creditedDate ? formatDateBR(rec.creditedDate) : '-'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum recebível de cartão registrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CADASTRAR NOVA CONTA BANCÁRIA */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  Cadastrar Conta Bancária
                </h3>
                <p className="text-[11px] sm:text-xs text-emerald-200 mt-0.5">
                  Adicione conta corrente, poupança ou carteira de pagamentos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4 overscroll-contain">
                {accountErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{accountErrorMsg}</span>
                  </div>
                )}

                {/* Modalidade da Conta: Compartilhada ou Privada */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700">
                    Modalidade da Conta *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccVisibility('shared')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        accVisibility === 'shared'
                          ? 'bg-blue-50/80 border-blue-600 text-blue-950 ring-2 ring-blue-500/20 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">Compartilhada</span>
                        <Landmark className={`w-3.5 h-3.5 ${accVisibility === 'shared' ? 'text-blue-700' : 'text-slate-400'}`} />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block leading-tight">
                        Padrão da empresa. Visível para autorizados e soma no saldo geral.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccVisibility('private')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        accVisibility === 'private'
                          ? 'bg-purple-50/80 border-purple-600 text-purple-950 ring-2 ring-purple-500/20 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs flex items-center gap-1 text-purple-950">
                          <Lock className="w-3 h-3 text-purple-700" />
                          Privada
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-200 text-purple-900">
                          Exclusiva
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block leading-tight">
                        Visível exclusivamente por você. Totalmente isolada do saldo da empresa.
                      </span>
                    </button>
                  </div>

                  {accVisibility === 'private' && (
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 flex items-start gap-2 animate-in fade-in">
                      <Lock className="w-3.5 h-3.5 shrink-0 text-purple-700 mt-0.5" />
                      <div>
                        <strong>Privacidade Real:</strong> Esta conta será vinculada ao seu usuário ({currentUser?.displayName || currentUser?.username}). Nenhum outro usuário ou administrador terá acesso ao saldo ou extrato desta conta.
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome Identificador da Conta *
                  </label>
                  <input
                    type="text"
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex: Conta Corrente Principal, Pix Mercadinho"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Instituição / Banco *</label>
                    <input
                      type="text"
                      required
                      value={accBankName}
                      onChange={(e) => setAccBankName(e.target.value)}
                      placeholder="Ex: Banco do Brasil, Nubank, Itaú..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tipo de Conta *</label>
                    <select
                      value={accType}
                      onChange={(e) => setAccType(e.target.value as BankAccountType)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white text-xs"
                    >
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                      <option value="pagamento">Conta de Pagamento</option>
                      <option value="investimento">Investimento / Reserva</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agência (Opcional)</label>
                    <input
                      type="text"
                      value={accAgency}
                      onChange={(e) => setAccAgency(e.target.value)}
                      placeholder="Ex: 1234"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Número da Conta</label>
                    <input
                      type="text"
                      value={accNumber}
                      onChange={(e) => setAccNumber(e.target.value)}
                      placeholder="Ex: 98765-4"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">Saldo Inicial de Abertura</span>
                  <p className="text-[11px] text-slate-500">
                    O saldo inicial é registrado apenas como abertura, sem afetar receitas ou fechamentos.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Saldo Inicial (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={accInitialBalanceStr}
                        onChange={(e) => setAccInitialBalanceStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Data da Abertura</label>
                      <input
                        type="date"
                        value={accInitialDate}
                        onChange={(e) => setAccInitialDate(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observações (Opcional)</label>
                  <input
                    type="text"
                    value={accNotes}
                    onChange={(e) => setAccNotes(e.target.value)}
                    placeholder="Ex: Usada para receber pagamentos de fornecedores..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingAccount}
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAccount}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingAccount ? 'Salvando...' : 'Salvar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR CONTA BANCÁRIA */}
      {isEditAccountModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-amber-700 to-amber-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  Editar Conta Bancária
                </h3>
                <p className="text-[11px] sm:text-xs text-amber-200 mt-0.5">
                  Atualize nome, agência, conta ou saldo inicial cadastrado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAccountModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4 overscroll-contain">
                {editAccountErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{editAccountErrorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome Identificador da Conta *
                  </label>
                  <input
                    type="text"
                    required
                    value={editAccName}
                    onChange={(e) => setEditAccName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Instituição / Banco *</label>
                    <input
                      type="text"
                      required
                      value={editAccBankName}
                      onChange={(e) => setEditAccBankName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tipo de Conta *</label>
                    <select
                      value={editAccType}
                      onChange={(e) => setEditAccType(e.target.value as BankAccountType)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white text-xs"
                    >
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                      <option value="pagamento">Conta de Pagamento</option>
                      <option value="investimento">Investimento / Reserva</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agência</label>
                    <input
                      type="text"
                      value={editAccAgency}
                      onChange={(e) => setEditAccAgency(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Número da Conta</label>
                    <input
                      type="text"
                      value={editAccNumber}
                      onChange={(e) => setEditAccNumber(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">Saldo Inicial de Abertura</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Saldo Inicial (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editAccInitialBalanceStr}
                        onChange={(e) => setEditAccInitialBalanceStr(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Data da Abertura</label>
                      <input
                        type="date"
                        value={editAccInitialDate}
                        onChange={(e) => setEditAccInitialDate(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                  <input
                    type="text"
                    value={editAccNotes}
                    onChange={(e) => setEditAccNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingEditAccount}
                  onClick={() => setIsEditAccountModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditAccount}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingEditAccount ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NOVA MOVIMENTAÇÃO BANCÁRIA (ENTRADA / SAÍDA) */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  Nova Movimentação Bancária
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                  Lançamento direto de entrada ou saída com cálculo consistente do saldo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransactionModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4 overscroll-contain">
                {transErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{transErrorMsg}</span>
                  </div>
                )}

                {/* Botões de Tipo: Entrada ou Saída */}
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Tipo de Lançamento *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransDirection('entrada');
                        setTransType('deposito');
                        setTransCategory('Depósito Bancário');
                      }}
                      className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer text-xs ${
                        transDirection === 'entrada'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-amber-300" />
                      <span>Entrada (+)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransDirection('saida');
                        setTransType('pagamento');
                        setTransCategory('Pagamento / Saída');
                      }}
                      className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer text-xs ${
                        transDirection === 'saida'
                          ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-white" />
                      <span>Saída (-)</span>
                    </button>
                  </div>
                </div>

                {/* Conta Bancária */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {transDirection === 'saida'
                      ? 'De qual conta será retirado o dinheiro? (Saída) *'
                      : 'Para qual conta o dinheiro entrará? (Entrada) *'}
                  </label>
                  <select
                    value={transAccountId}
                    onChange={(e) => setTransAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 text-xs"
                  >
                    {bankAccounts
                      .filter((a) => a.status === 'active')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.bankName}) — Saldo Atual: {formatCurrency(a.currentBalance)}
                        </option>
                      ))}
                  </select>

                  {/* Informação explícita de onde sai ou entra o dinheiro */}
                  {(() => {
                    const acc = bankAccounts.find((a) => a.id === transAccountId);
                    if (!acc) return null;
                    const bal = computeBankAccountBalance(acc, bankTransactions).currentBalance;
                    return (
                      <div
                        className={`mt-1.5 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                          transDirection === 'saida'
                            ? 'bg-rose-50 text-rose-800 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                        }`}
                      >
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {transDirection === 'saida' ? 'Retirado da conta:' : 'Destino:'}{' '}
                          <strong>{acc.name} ({acc.bankName})</strong> — Saldo disponível:{' '}
                          <strong>{formatCurrency(bal)}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Valor e Data - 1 coluna no celular, 2 em telas maiores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Valor em Reais (R$) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={transAmountStr}
                      onChange={(e) => setTransAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Data da Movimentação *</label>
                    <input
                      type="date"
                      required
                      value={transDate}
                      onChange={(e) => setTransDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Categoria e Operação - 1 coluna no celular, 2 em telas maiores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                    <input
                      type="text"
                      required
                      value={transCategory}
                      onChange={(e) => setTransCategory(e.target.value)}
                      placeholder="Ex: Aporte, Tarifa, Fornecedor..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Classificação *</label>
                    <select
                      value={transType}
                      onChange={(e) => setTransType(e.target.value as BankTransactionType)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs"
                    >
                      {transDirection === 'entrada' ? (
                        <>
                          <option value="deposito">Depósito em Conta (+)</option>
                          <option value="recebimento">Recebimento de Cliente (+)</option>
                          <option value="ajuste">Ajuste de Saldo Positivo (+)</option>
                        </>
                      ) : (
                        <>
                          <option value="saque">Saque em Espécie (-)</option>
                          <option value="pagamento">Pagamento / Transferência (-)</option>
                          <option value="tarifa">Tarifa / Taxa Bancária (-)</option>
                          <option value="ajuste">Ajuste de Saldo Negativo (-)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Descrição Obrigatória */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descrição / Histórico *</label>
                  <input
                    type="text"
                    required
                    value={transDesc}
                    onChange={(e) => setTransDesc(e.target.value)}
                    placeholder="Ex: Aporte de sócios, pagamento fornecedor laticínios..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>

                {/* Documento e Observações - 1 coluna no celular, 2 em telas maiores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nº Documento / Ref. (Opcional)</label>
                    <input
                      type="text"
                      value={transDocNumber}
                      onChange={(e) => setTransDocNumber(e.target.value)}
                      placeholder="Ex: DOC 4892, Pix E2E..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Observações (Opcional)</label>
                    <input
                      type="text"
                      value={transNotes}
                      onChange={(e) => setTransNotes(e.target.value)}
                      placeholder="Ex: Anotações adicionais..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Informação do Responsável Automático */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Responsável registrado automaticamente:</span>
                  <span className="font-bold text-slate-800">
                    {currentUser?.displayName || currentUser?.username || 'Administrador'}
                  </span>
                </div>
              </div>

              {/* Rodapé fixo / acessível sem sobreposição de barras */}
              <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingTrans}
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTrans}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer ${
                    transDirection === 'entrada'
                      ? 'bg-emerald-800 hover:bg-emerald-900'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmittingTrans ? 'Lançando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: TRANSFERÊNCIA ENTRE CONTAS (ATÔMICA) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  Transferência Entre Contas Bancárias
                </h3>
                <p className="text-[11px] sm:text-xs text-blue-200 mt-0.5">
                  Operação atômica entre contas cadastradas sem alteração contábil de receitas ou despesas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4 overscroll-contain">
                {transferErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{transferErrorMsg}</span>
                  </div>
                )}

                {/* Conta de Origem */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conta de Origem (Saída) *</label>
                  <select
                    value={trfFromId}
                    onChange={(e) => {
                      const newFromId = e.target.value;
                      setTrfFromId(newFromId);
                      const fromAcc = bankAccounts.find((a) => a.id === newFromId);
                      const isPriv = fromAcc?.visibility === 'private';
                      const validDests = bankAccounts.filter(
                        (a) =>
                          a.status === 'active' &&
                          a.id !== newFromId &&
                          (isPriv ? a.visibility === 'private' && a.ownerUid === currentUser?.id : a.visibility !== 'private')
                      );
                      setTrfToId(validDests[0]?.id || '');
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs"
                  >
                    {bankAccounts
                      .filter((a) => a.status === 'active')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.visibility === 'private' ? '[PRIVADA] ' : ''}{a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                        </option>
                      ))}
                  </select>

                  {/* Exibição do Saldo Disponível para Validação */}
                  {(() => {
                    const srcAcc = bankAccounts.find((a) => a.id === trfFromId);
                    const bal = srcAcc ? computeBankAccountBalance(srcAcc, bankTransactions).currentBalance : 0;
                    return (
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>
                          {srcAcc?.visibility === 'private' ? (
                            <span className="text-purple-700 font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Conta Privada
                            </span>
                          ) : (
                            <span>Conta Compartilhada da Loja</span>
                          )}
                        </span>
                        <span>Saldo disponível: <strong className="text-slate-800">{formatCurrency(bal)}</strong></span>
                      </div>
                    );
                  })()}
                </div>

                {/* Conta de Destino */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conta de Destino (Entrada) *</label>
                  {(() => {
                    const srcAcc = bankAccounts.find((a) => a.id === trfFromId);
                    const isPriv = srcAcc?.visibility === 'private';
                    const eligibleDestinations = bankAccounts.filter(
                      (a) =>
                        a.status === 'active' &&
                        a.id !== trfFromId &&
                        (isPriv ? a.visibility === 'private' && a.ownerUid === currentUser?.id : a.visibility !== 'private')
                    );

                    return (
                      <>
                        <select
                          value={trfToId}
                          onChange={(e) => setTrfToId(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs"
                        >
                          <option value="">-- Selecione a conta de destino --</option>
                          {eligibleDestinations.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.visibility === 'private' ? '[PRIVADA] ' : ''}{a.name} ({a.bankName}) — Saldo Atual: {formatCurrency(a.currentBalance)}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {isPriv
                            ? 'Transferências de contas privadas são permitidas exclusivamente para outras contas privadas de sua titularidade.'
                            : 'Transferência entre contas compartilhadas da empresa.'}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Valor e Data - 1 coluna no celular, 2 em telas maiores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={trfAmountStr}
                      onChange={(e) => setTrfAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={trfDate}
                      onChange={(e) => setTrfDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Descrição e Nº Documento */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descrição / Motivo</label>
                  <input
                    type="text"
                    value={trfDesc}
                    onChange={(e) => setTrfDesc(e.target.value)}
                    placeholder="Ex: Transferência de saldo, reforço de caixa..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                  />
                </div>

                {/* Nº Comprovante e Observações - 1 coluna no celular, 2 em telas maiores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nº Comprovante / Doc</label>
                    <input
                      type="text"
                      value={trfDocNumber}
                      onChange={(e) => setTrfDocNumber(e.target.value)}
                      placeholder="Ex: TRF-9021"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                    <input
                      type="text"
                      value={trfNotes}
                      onChange={(e) => setTrfNotes(e.target.value)}
                      placeholder="Opcional..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                  <strong>Garantia Atômica:</strong> Ambas as movimentações (saída e entrada) são vinculadas ao mesmo identificador e gravadas em lote atômico. Se um lado falhar, nenhuma alteração é feita no banco.
                </div>
              </div>

              {/* Rodapé fixo / acessível sem sobreposição de barras */}
              <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingTransfer}
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingTransfer ? 'Transferindo...' : 'Executar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ESTORNO DE LANÇAMENTO (AUDITÁVEL) */}
      {transactionToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-200 p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Estornar Movimentação Bancária</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Operação auditável que reverte o saldo sem apagar histórico</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Descrição:</span>
                <span className="font-bold text-slate-800">{transactionToCancel.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data:</span>
                <span className="font-semibold text-slate-800">{formatDateBR(transactionToCancel.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor a Reverter:</span>
                <span className={`font-black ${transactionToCancel.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(Math.abs(transactionToCancel.amount))} ({transactionToCancel.amount >= 0 ? 'Entrada' : 'Saída'})
                </span>
              </div>
              {transactionToCancel.relatedTransferId && (
                <div className="text-[11px] text-blue-700 bg-blue-50 p-2 rounded-lg mt-1 font-medium">
                  Atenção: Esta movimentação faz parte de uma transferência. O estorno reverterá ambas as pontas automaticamente.
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa do Estorno *
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Lançamento duplicado pelo caixa, valor digitado incorretamente..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isCancellingTrans}
                onClick={() => {
                  setTransactionToCancel(null);
                  setCancelReason('');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCancellingTrans || !cancelReason.trim()}
                onClick={handleConfirmCancelTransaction}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isCancellingTrans ? 'Estornando...' : 'Confirmar Estorno'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EXCLUIR LANÇAMENTO INDIVIDUAL */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-rose-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Excluir Lançamento do Extrato</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Remove o lançamento e atualiza o saldo bancário</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Descrição:</span>
                <span className="font-bold text-slate-800">{transactionToDelete.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data:</span>
                <span className="font-semibold text-slate-800">{formatDateBR(transactionToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor:</span>
                <span className={`font-black ${transactionToDelete.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(Math.abs(transactionToDelete.amount))}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingTrans}
                onClick={() => setTransactionToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTrans}
                onClick={handleConfirmDeleteTransaction}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingTrans ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: LIMPAR EXTRATO DA CONTA */}
      {isClearStatementModalOpen && currentAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-rose-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Excluir Extrato da Conta</h3>
                  <p className="text-xs text-slate-500">Conta: {currentAccount.name} ({currentAccount.bankName})</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsClearStatementModalOpen(false);
                  setClearStatementConfirmationInput('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Selecione o critério para exclusão:</label>
              <div className="space-y-2">
                <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${clearStatementType === 'all' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="clearStatementType"
                    checked={clearStatementType === 'all'}
                    onChange={() => setClearStatementType('all')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Excluir Todos os Lançamentos</span>
                    <span className="text-[11px] text-slate-500">Apaga todo o histórico de movimentações desta conta ({accountActiveTransactions.length} registros)</span>
                  </div>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${clearStatementType === 'range' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="clearStatementType"
                    checked={clearStatementType === 'range'}
                    onChange={() => setClearStatementType('range')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div className="w-full">
                    <span className="text-xs font-bold text-slate-800 block">Excluir por Intervalo de Datas</span>
                    {clearStatementType === 'range' && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <input
                          type="date"
                          value={clearStatementStartDate}
                          onChange={(e) => setClearStatementStartDate(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                        />
                        <input
                          type="date"
                          value={clearStatementEndDate}
                          onChange={(e) => setClearStatementEndDate(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between">
              <span>Lançamentos selecionados para exclusão:</span>
              <span className="font-bold text-sm bg-rose-200/80 px-2.5 py-0.5 rounded-lg">
                {statementTransactionsToClear.length} registro(s)
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Digite <span className="text-rose-700 font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={clearStatementConfirmationInput}
                onChange={(e) => setClearStatementConfirmationInput(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearingStatement}
                onClick={() => {
                  setIsClearStatementModalOpen(false);
                  setClearStatementConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingStatement || statementTransactionsToClear.length === 0 || clearStatementConfirmationInput.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleConfirmClearStatement}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingStatement ? 'Excluindo...' : `Excluir ${statementTransactionsToClear.length} Lançamento(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR / DESATIVAR CONTA BANCÁRIA */}
      {accountToDelete && (() => {
        const currentBalance = computeBankAccountBalance(accountToDelete, bankTransactions).currentBalance;
        const hasNonZeroBalance = Math.abs(currentBalance) > 0.009;
        const relatedTxs = bankTransactions.filter(
          (t) => t.accountId === accountToDelete.id || t.relatedAccountId === accountToDelete.id
        );
        const hasInitialBalance = (accountToDelete.initialBalance || 0) > 0;
        const hasHistory = relatedTxs.length > 0 || hasInitialBalance;
        const pendingReceivables = receivables.filter(
          (r) => r.targetAccountId === accountToDelete.id && r.status === 'pendente'
        );
        const pendingBoletos = (boletos || []).filter(
          (b) => b.bankAccountId === accountToDelete.id && b.status === 'pendente'
        );
        const hasPendingOperations = pendingReceivables.length > 0 || pendingBoletos.length > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
            <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
              {/* Header */}
              <div
                className={`p-4 sm:p-5 text-white flex items-center justify-between shrink-0 ${
                  hasNonZeroBalance || hasPendingOperations
                    ? 'bg-gradient-to-r from-amber-700 to-amber-900'
                    : hasHistory
                    ? 'bg-gradient-to-r from-slate-800 to-slate-950'
                    : 'bg-gradient-to-r from-rose-700 to-rose-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/10 shrink-0">
                    {hasNonZeroBalance || hasPendingOperations ? (
                      <AlertCircle className="w-5 h-5 text-amber-200" />
                    ) : hasHistory ? (
                      <Landmark className="w-5 h-5 text-amber-300" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-rose-200" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold">
                      {hasNonZeroBalance || hasPendingOperations
                        ? 'Regularização Necessária'
                        : hasHistory
                        ? 'Desativar Conta Bancária'
                        : 'Excluir Conta Bancária'}
                    </h3>
                    <p className="text-[11px] text-white/80">
                      {hasHistory ? 'Histórico contábil protegido' : 'Exclusão definitiva de cadastro'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmittingDeleteAccount}
                  onClick={() => setAccountToDelete(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs overscroll-contain">
                {deleteAccountErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{deleteAccountErrorMsg}</span>
                  </div>
                )}

                {/* Dados da Conta */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Instituição / Banco</span>
                    <span className="font-bold text-slate-800">{accountToDelete.bankName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Nome da Conta</span>
                    <span className="font-bold text-slate-900">{accountToDelete.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Identificação</span>
                    <span className="font-mono text-slate-700">
                      {accountToDelete.agency ? `Ag. ${accountToDelete.agency} | ` : ''}
                      {accountToDelete.accountNumberMasked}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Saldo Atual</span>
                    <span
                      className={`text-sm font-black ${
                        hasNonZeroBalance ? 'text-amber-700' : 'text-slate-800'
                      }`}
                    >
                      {formatCurrency(currentBalance)}
                    </span>
                  </div>
                </div>

                {/* Cenário 1: Saldo Diferente de Zero (Ação bloqueada + Atalho de transferência) */}
                {hasNonZeroBalance && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Bloqueio de Segurança: Saldo não zerado</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Esta conta possui saldo atual de <strong>{formatCurrency(currentBalance)}</strong>. Por segurança e conformidade contábil, nenhuma conta com saldo pode ser excluída ou desativada, pois recursos financeiros jamais podem ser descartados.
                    </p>
                    <p className="text-[11px] font-medium text-amber-800">
                      Transfira ou regularize o saldo para R$ 0,00 antes de prosseguir.
                    </p>
                  </div>
                )}

                {/* Cenário 2: Operações Financeiras Pendentes */}
                {!hasNonZeroBalance && hasPendingOperations && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Operações Pendentes Vinculadas</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Esta conta possui operações financeiras em andamento:{' '}
                      {pendingReceivables.length > 0 && (
                        <strong>{pendingReceivables.length} recebível(is) aguardando crédito</strong>
                      )}
                      {pendingReceivables.length > 0 && pendingBoletos.length > 0 && ' e '}
                      {pendingBoletos.length > 0 && (
                        <strong>{pendingBoletos.length} boleto(s) com pagamento pendente</strong>
                      )}
                      .
                    </p>
                    <p className="text-[11px] font-medium text-amber-800">
                      Conclua ou reatribua essas operações antes de desativar ou excluir a conta.
                    </p>
                  </div>
                )}

                {/* Cenário 3: Saldo Zero + Possui Histórico -> Opção: Desativar Conta Bancária */}
                {!hasNonZeroBalance && !hasPendingOperations && hasHistory && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <Landmark className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span>Proteção do Histórico Financeiro</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Esta conta possui <strong>{relatedTxs.length} lançamento(s)</strong> no histórico bancário.
                        Para proteger a auditoria contábil, os relatórios e os fechamentos diários, os registros contábeis não serão apagados.
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        A conta será <strong>desativada</strong>: ela deixará de ficar disponível para novas movimentações e transferências, mas todo o seu extrato e histórico permanecerão seguros e acessíveis para consultas futuras.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Motivo da desativação (opcional)
                      </label>
                      <input
                        type="text"
                        value={deleteAccountReason}
                        onChange={(e) => setDeleteAccountReason(e.target.value)}
                        placeholder="Ex: Conta encerrada no banco, migração de agência..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Cenário 4: Saldo Zero + NENHUM Histórico -> Exclusão Definitiva */}
                {!hasNonZeroBalance && !hasPendingOperations && !hasHistory && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                        <span>Confirmação de Exclusão Definitiva</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-rose-800">
                        Esta conta bancária não possui nenhuma movimentação financeira vinculada e seu saldo é R$ 0,00.
                      </p>
                      <p className="text-[11px] leading-relaxed text-rose-800">
                        A operação removerá definitivamente o cadastro da conta. Esta ação não poderá ser desfeita após a confirmação.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Motivo da exclusão (opcional)
                      </label>
                      <input
                        type="text"
                        value={deleteAccountReason}
                        onChange={(e) => setDeleteAccountReason(e.target.value)}
                        placeholder="Ex: Cadastro criado por engano..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingDeleteAccount}
                  onClick={() => setAccountToDelete(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>

                {hasNonZeroBalance ? (
                  <button
                    type="button"
                    onClick={() => {
                      const accId = accountToDelete.id;
                      setAccountToDelete(null);
                      handleOpenTransfer(accId);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transferir Saldo</span>
                  </button>
                ) : hasPendingOperations ? (
                  <button
                    type="button"
                    disabled
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs cursor-not-allowed opacity-70"
                  >
                    Operações Pendentes
                  </button>
                ) : hasHistory ? (
                  <button
                    type="button"
                    disabled={isSubmittingDeleteAccount}
                    onClick={handleConfirmDeleteOrDeactivate}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Landmark className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isSubmittingDeleteAccount ? 'Desativando...' : 'Confirmar Desativação'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmittingDeleteAccount}
                    onClick={handleConfirmDeleteOrDeactivate}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isSubmittingDeleteAccount ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
