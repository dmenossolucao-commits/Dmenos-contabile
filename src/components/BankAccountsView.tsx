import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { BankAccount, BankTransaction, BankTransactionType, BankAccountType } from '../types';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  getTodayDateBR,
  parseCurrencyInput,
  maskAccount,
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
  Share2,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Check,
  Trash2
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
    activeBankAccount,
    setActiveBankAccount,
    createBankAccount,
    createBankTransaction,
    deleteBankTransaction,
    deleteAccountStatement,
    transferBetweenAccounts,
    confirmReceivableCredit,
  } = useFinance();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'extrato' | 'transferencia' | 'recebiveis'>('extrato');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(initialOpenModal);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [creditingReceivableId, setCreditingReceivableId] = useState<string | null>(null);
  const [creditDate, setCreditDate] = useState(getTodayDateBR());

  // Statement Delete & Clear Modals State
  const [transactionToDelete, setTransactionToDelete] = useState<BankTransaction | null>(null);
  const [isDeletingTrans, setIsDeletingTrans] = useState(false);

  const [isClearStatementModalOpen, setIsClearStatementModalOpen] = useState(false);
  const [clearStatementType, setClearStatementType] = useState<'all' | 'range'>('all');
  const [clearStatementStartDate, setClearStatementStartDate] = useState('');
  const [clearStatementEndDate, setClearStatementEndDate] = useState('');
  const [clearStatementConfirmationInput, setClearStatementConfirmationInput] = useState('');
  const [isClearingStatement, setIsClearingStatement] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Selected Account (fallback to first account)
  const currentAccount = useMemo(() => {
    if (activeBankAccount && bankAccounts.some((a) => a.id === activeBankAccount.id)) {
      return bankAccounts.find((a) => a.id === activeBankAccount.id) || bankAccounts[0];
    }
    return bankAccounts[0] || null;
  }, [activeBankAccount, bankAccounts]);

  // Compute breakdown strictly by formula:
  // Saldo bancário atual = saldo inicial + entradas confirmadas - saídas confirmadas
  const currentAccountBalanceDetails = useMemo(() => {
    if (!currentAccount) return null;
    return computeBankAccountBalance(currentAccount, bankTransactions);
  }, [currentAccount, bankTransactions]);

  // Account creation state
  const [accName, setAccName] = useState('');
  const [accBankName, setAccBankName] = useState('Banco do Brasil');
  const [accType, setAccType] = useState<BankAccountType>('corrente');
  const [accAgency, setAccAgency] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accInitialBalanceStr, setAccInitialBalanceStr] = useState('0,00');
  const [accInitialDate, setAccInitialDate] = useState(getTodayDateBR());
  const [accNotes, setAccNotes] = useState('');

  // Transaction state
  const [transDate, setTransDate] = useState(getTodayDateBR());
  const [transType, setTransType] = useState<BankTransactionType>('deposito');
  const [transAmountStr, setTransAmountStr] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [transCategory, setTransCategory] = useState('Aporte de Capital');
  const [transNotes, setTransNotes] = useState('');

  // Transfer state
  const [trfFromId, setTrfFromId] = useState(currentAccount?.id || '');
  const [trfToId, setTrfToId] = useState('');
  const [trfAmountStr, setTrfAmountStr] = useState('');
  const [trfDate, setTrfDate] = useState(getTodayDateBR());
  const [trfDesc, setTrfDesc] = useState('Transferência entre contas');
  const [trfNotes, setTrfNotes] = useState('');

  // Filtered transactions for current account
  const accountTransactions = useMemo(() => {
    if (!currentAccount) return [];
    return bankTransactions.filter(
      (t) => t.accountId === currentAccount.id && t.status === 'active'
    );
  }, [bankTransactions, currentAccount]);

  // Transactions matching clear statement filter
  const statementTransactionsToClear = useMemo(() => {
    if (!currentAccount) return [];
    if (clearStatementType === 'all') {
      return accountTransactions;
    }
    if (clearStatementType === 'range') {
      return accountTransactions.filter((t) => {
        const matchStart = !clearStatementStartDate || t.date >= clearStatementStartDate;
        const matchEnd = !clearStatementEndDate || t.date <= clearStatementEndDate;
        return matchStart && matchEnd;
      });
    }
    return [];
  }, [currentAccount, accountTransactions, clearStatementType, clearStatementStartDate, clearStatementEndDate]);

  // Handle Confirm Delete Single Transaction
  const handleConfirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingTrans(true);
    try {
      await deleteBankTransaction(transactionToDelete.id, 'Exclusão individual pelo extrato bancário');
      showToast(`Movimentação "${transactionToDelete.description}" excluída do extrato com sucesso!`);
      setTransactionToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir movimentação.');
    } finally {
      setIsDeletingTrans(false);
    }
  };

  // Handle Confirm Clear Account Statement
  const handleConfirmClearStatement = async () => {
    if (!currentAccount || statementTransactionsToClear.length === 0) return;
    if (clearStatementConfirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      alert('Digite EXCLUIR para confirmar a exclusão do extrato.');
      return;
    }
    setIsClearingStatement(true);
    try {
      const ids = statementTransactionsToClear.map((t) => t.id);
      await deleteAccountStatement(currentAccount.id, ids, `Exclusão de extrato da conta ${currentAccount.name}`);
      showToast(`${ids.length} lançamento(s) do extrato excluído(s) com sucesso! Saldo recalculado.`);
      setIsClearStatementModalOpen(false);
      setClearStatementConfirmationInput('');
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir extrato.');
    } finally {
      setIsClearingStatement(false);
    }
  };

  // Pending card receivables
  const pendingReceivables = useMemo(() => {
    return receivables.filter((r) => r.status === 'pendente');
  }, [receivables]);

  // Handle Account Create
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim() || !accBankName.trim()) {
      alert('Preencha o nome da conta e o banco.');
      return;
    }

    const initBal = parseCurrencyInput(accInitialBalanceStr);
    try {
      const id = await createBankAccount({
        name: accName.trim(),
        bankName: accBankName.trim(),
        accountType: accType,
        agency: accAgency.trim() || undefined,
        accountNumberMasked: maskAccount(accNumber),
        initialBalance: initBal,
        initialBalanceDate: accInitialDate,
        status: 'active',
        notes: accNotes.trim() || undefined,
      });

      showToast(`Conta "${accName}" cadastrada com sucesso!`);
      setIsAccountModalOpen(false);
      setAccName('');
      setAccAgency('');
      setAccNumber('');
      setAccInitialBalanceStr('0,00');
      setAccNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar conta.');
    }
  };

  // Handle Transaction Create
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    const rawAmount = parseCurrencyInput(transAmountStr);
    if (rawAmount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    // Determine if debit or credit based on type
    const isDebit =
      transType === 'saque' ||
      transType === 'pagamento' ||
      transType === 'tarifa' ||
      transType === 'transferencia_saida';

    const finalAmount = isDebit ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    try {
      await createBankTransaction({
        accountId: currentAccount.id,
        date: transDate,
        description: transDesc.trim(),
        category: transCategory,
        amount: finalAmount,
        type: transType,
        notes: transNotes.trim() || undefined,
        status: 'active',
      });

      showToast('Movimentação bancária lançada com sucesso!');
      setIsTransactionModalOpen(false);
      setTransAmountStr('');
      setTransDesc('');
      setTransNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao lançar movimentação.');
    }
  };

  // Handle Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyInput(trfAmountStr);
    if (amount <= 0) {
      alert('Informe um valor maior que zero para a transferência.');
      return;
    }
    if (!trfFromId || !trfToId || trfFromId === trfToId) {
      alert('Selecione contas de origem e destino diferentes.');
      return;
    }

    try {
      await transferBetweenAccounts(
        trfFromId,
        trfToId,
        amount,
        trfDate,
        trfDesc.trim(),
        trfNotes.trim() || undefined
      );

      showToast(`Transferência de ${formatCurrency(amount)} realizada com sucesso!`);
      setIsTransferModalOpen(false);
      setTrfAmountStr('');
      setTrfNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro na transferência.');
    }
  };

  // Handle Card Settlement
  const handleSettleReceivable = async (receivableId: string) => {
    if (!currentAccount) {
      alert('Selecione a conta bancária para receber o crédito.');
      return;
    }

    try {
      await confirmReceivableCredit(receivableId, currentAccount.id, creditDate);
      showToast('Valor de cartão creditado na conta com sucesso!');
      setCreditingReceivableId(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao creditar recebível.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-800 text-white shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Controle Bancário & Operadoras
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {bankAccounts.length} conta(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão transparente de contas bancárias, transferências internas e liquidação de cartões.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>Transferir Entre Contas</span>
          </button>

          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>Nova Conta Bancária</span>
          </button>
        </div>
      </div>

      {/* Bank Accounts List Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.map((acc) => {
          const isSelected = currentAccount?.id === acc.id;
          const accDetails = computeBankAccountBalance(acc, bankTransactions);
          return (
            <div
              key={acc.id}
              onClick={() => setActiveBankAccount(acc)}
              className={`p-5 rounded-2xl border transition cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white border-amber-400/40 shadow-md ring-2 ring-emerald-800/20'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isSelected ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {acc.bankName} • {acc.accountType.toUpperCase()}
                    </span>
                    <h3 className="text-base font-bold mt-0.5">{acc.name}</h3>
                  </div>
                  <div
                    className={`p-2 rounded-xl ${
                      isSelected ? 'bg-emerald-800 text-amber-300' : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3">
                  <span
                    className={`text-[11px] block font-medium ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Saldo Atual Disponível
                  </span>
                  <div
                    className={`text-2xl font-black tracking-tight ${
                      isSelected ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(accDetails.currentBalance)}
                  </div>
                  {/* Real-time breakdown according to official formula */}
                  <div
                    className={`text-[10px] mt-1.5 flex flex-wrap items-center gap-1.5 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    <span>Inicial: {formatCurrency(accDetails.initialBalance)}</span>
                    <span>•</span>
                    <span className={isSelected ? 'text-emerald-300 font-semibold' : 'text-emerald-700 font-semibold'}>
                      +{formatCurrency(accDetails.totalEntradas)}
                    </span>
                    <span>•</span>
                    <span className={isSelected ? 'text-rose-300 font-semibold' : 'text-rose-600 font-semibold'}>
                      -{formatCurrency(accDetails.totalSaidas)}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`mt-4 pt-3 border-t text-[11px] flex justify-between items-center ${
                  isSelected ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                }`}
              >
                <span>Ag: {acc.agency || '-'} | Conta: {acc.accountNumberMasked}</span>
                <span className="font-semibold text-emerald-600">
                  {isSelected ? '✓ Selecionada' : 'Selecionar'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Account Work Area: Extrato & Recebíveis de Cartão */}
      {currentAccount && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {currentAccount.name} ({currentAccount.bankName})
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  Saldo: {formatCurrency(currentAccount.currentBalance)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Saldo inicial de abertura em {formatDateBR(currentAccount.initialBalanceDate)}:{' '}
                {formatCurrency(currentAccount.initialBalance)}
              </p>
            </div>

            {/* Actions for Current Account */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsTransactionModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Nova Movimentação</span>
              </button>

              <button
                onClick={async () => {
                  const doc = generateBankStatementPDF(
                    currentAccount,
                    bankTransactions,
                    '2026-01-01',
                    getTodayDateBR()
                  );
                  await downloadOrSharePDF(
                    doc,
                    `Extrato_${currentAccount.name.replace(/\s+/g, '_')}.pdf`,
                    `Extrato Bancário - ${currentAccount.name}`
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                title="Baixar Extrato em PDF"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                <span>Extrato PDF</span>
              </button>
            </div>
          </div>

          {/* Cartão Visual de Saldo da Conta Selecionada */}
          {currentAccountBalanceDetails && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-800 text-amber-300 rounded-lg">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Cartão de Saldo Bancário Oficial
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Fórmula: Saldo Atual = Saldo Inicial + Entradas Confirmadas - Saídas Confirmadas
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Isolado do Fechamento Diário
                </span>
              </div>

              {/* 4 Blocos da Fórmula */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    1. Saldo Inicial
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
                    {formatCurrency(currentAccountBalanceDetails.initialBalance)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Data: {formatDateBR(currentAccount.initialBalanceDate)}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3" />
                    2. Entradas (+)
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                    +{formatCurrency(currentAccountBalanceDetails.totalEntradas)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Depósitos / Aportes
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    3. Saídas (-)
                  </span>
                  <div className="text-base sm:text-lg font-black text-rose-600 mt-0.5">
                    -{formatCurrency(currentAccountBalanceDetails.totalSaidas)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Pagamentos / Saques
                  </span>
                </div>

                <div className="bg-emerald-950 p-3 rounded-xl border border-emerald-800 shadow-xs text-white">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block">
                    = Saldo Atual em Conta
                  </span>
                  <div className="text-base sm:text-lg font-black text-white mt-0.5">
                    {formatCurrency(currentAccountBalanceDetails.currentBalance)}
                  </div>
                  <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                    Disponível em tempo real
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Subtabs: Extrato vs Recebíveis & Ação Excluir Extrato */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex bg-slate-100 p-1 rounded-xl self-start">
              <button
                onClick={() => setActiveTab('extrato')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'extrato'
                    ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Extrato da Conta ({accountTransactions.length})
              </button>
              <button
                onClick={() => setActiveTab('recebiveis')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'recebiveis'
                    ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Valores a Receber de Cartões</span>
                {pendingReceivables.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {pendingReceivables.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'extrato' && accountTransactions.length > 0 && (
              <button
                onClick={() => {
                  setClearStatementType('all');
                  setClearStatementStartDate('');
                  setClearStatementEndDate('');
                  setClearStatementConfirmationInput('');
                  setIsClearStatementModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                title="Excluir lançamentos do extrato desta conta"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Excluir Extrato da Conta</span>
              </button>
            )}
          </div>

          {/* SUBTAB 1: EXTRATO BANCÁRIO */}
          {activeTab === 'extrato' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {accountTransactions.length > 0 ? (
                    accountTransactions.map((tx) => {
                      const isCredit = tx.amount >= 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {formatDateBR(tx.date)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {tx.description}
                            {tx.notes && (
                              <span className="block text-[11px] text-slate-400 font-normal">
                                {tx.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 capitalize">
                            {tx.type.replace('_', ' ')}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                              isCredit ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {isCredit ? `+ ${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Confirmado
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setTransactionToDelete(tx)}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                              title="Excluir este lançamento do extrato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Nenhuma movimentação registrada nesta conta ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SUBTAB 2: VALORES A RECEBER (CARTÕES) */}
          {activeTab === 'recebiveis' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Controle de Operadoras:</strong> As vendas em cartão de crédito e débito ficam registradas como <em>Valores a Receber</em> com suas respectivas taxas descontadas. Quando o dinheiro efetivamente entrar na conta, clique em <strong>Liquidar no Banco</strong> para creditar na conta selecionada sem duplicidade.
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Data Venda</th>
                      <th className="py-3 px-4">Modalidade</th>
                      <th className="py-3 px-4 text-right">Valor Bruto</th>
                      <th className="py-3 px-4 text-right">Taxa Operadora</th>
                      <th className="py-3 px-4 text-right">Valor Líquido</th>
                      <th className="py-3 px-4">Previsão Crédito</th>
                      <th className="py-3 px-4 text-center">Situação</th>
                      <th className="py-3 px-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {receivables.length > 0 ? (
                      receivables.map((rec) => {
                        const isPending = rec.status === 'pendente';
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {formatDateBR(rec.date)}
                            </td>
                            <td className="py-3 px-4 font-bold uppercase text-slate-800">
                              {rec.cardType}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-600 whitespace-nowrap">
                              {formatCurrency(rec.grossAmount)}
                            </td>
                            <td className="py-3 px-4 text-right text-rose-600 whitespace-nowrap">
                              - {rec.feePercentage}% ({formatCurrency(rec.feeAmount)})
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-800 whitespace-nowrap">
                              {formatCurrency(rec.netAmount)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                              {formatDateBR(rec.expectedCreditDate)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isPending ? 'Aguardando Crédito' : 'Creditado no Banco'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {isPending ? (
                                <button
                                  onClick={() => handleSettleReceivable(rec.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1 mx-auto"
                                  title={`Creditar na conta ${currentAccount.name}`}
                                >
                                  <Check className="w-3.5 h-3.5 text-amber-300" />
                                  <span>Liquidar no Banco</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {formatDateBR(rec.creditedDate)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum valor de cartão registrado para recebimento.
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

      {/* MODAL: NOVA CONTA BANCÁRIA */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-300" />
                  Cadastrar Conta Bancária
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Adicione conta corrente, poupança ou carteira de pagamentos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Identificador da Conta *
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ex: Conta Corrente Principal, Caixa Econômica, Mercado Pago"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Instituição / Banco *
                  </label>
                  <input
                    type="text"
                    required
                    value={accBankName}
                    onChange={(e) => setAccBankName(e.target.value)}
                    placeholder="Ex: Banco do Brasil, Itaú, Bradesco, Nubank..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Conta *</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as BankAccountType)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="pagamento">Conta de Pagamento</option>
                    <option value="investimento">Investimento / Reserva</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Agência (Opcional)
                  </label>
                  <input
                    type="text"
                    value={accAgency}
                    onChange={(e) => setAccAgency(e.target.value)}
                    placeholder="Ex: 1234"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Número da Conta (com dígito)
                  </label>
                  <input
                    type="text"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    placeholder="Ex: 98765-4"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block">Saldo de Abertura / Inicial</span>
                <p className="text-[11px] text-slate-500">
                  O saldo inicial é registrado estritamente como saldo de abertura, não afetando receitas operacionais.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Saldo Inicial (R$)</label>
                    <input
                      type="text"
                      value={accInitialBalanceStr}
                      onChange={(e) => setAccInitialBalanceStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Data do Saldo Inicial</label>
                    <input
                      type="date"
                      value={accInitialDate}
                      onChange={(e) => setAccInitialDate(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                <input
                  type="text"
                  value={accNotes}
                  onChange={(e) => setAccNotes(e.target.value)}
                  placeholder="Ex: Conta usada para receber Pix das vendas do mercadinho..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MOVIMENTAÇÃO BANCÁRIA */}
      {isTransactionModalOpen && currentAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-300" />
                  Movimentação na Conta: {currentAccount.name}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Lançamento de depósito, saque, tarifa bancária ou ajuste de saldo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransactionModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Operação *</label>
                  <select
                    value={transType}
                    onChange={(e) => setTransType(e.target.value as BankTransactionType)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="deposito">Depósito em Conta (+)</option>
                    <option value="saque">Saque / Retirada (-)</option>
                    <option value="recebimento">Outro Recebimento (+)</option>
                    <option value="pagamento">Pagamento Avulso (-)</option>
                    <option value="tarifa">Tarifa / Taxa Bancária (-)</option>
                    <option value="ajuste">Ajuste de Saldo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="text"
                    required
                    value={transAmountStr}
                    onChange={(e) => setTransAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={transDate}
                    onChange={(e) => setTransDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <input
                    type="text"
                    required
                    value={transCategory}
                    onChange={(e) => setTransCategory(e.target.value)}
                    placeholder="Ex: Tarifa mensal, Depósito em dinheiro..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição detalhada *</label>
                <input
                  type="text"
                  required
                  value={transDesc}
                  onChange={(e) => setTransDesc(e.target.value)}
                  placeholder="Ex: Depósito em dinheiro do caixa, pagamento boleto internet..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações (Opcional)</label>
                <input
                  type="text"
                  value={transNotes}
                  onChange={(e) => setTransNotes(e.target.value)}
                  placeholder="Comprovante, observações adicionais..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-sm"
                >
                  Confirmar Movimentação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERÊNCIA ENTRE CONTAS (REGRA FINANCEIRA CRUCIAL) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-amber-300" />
                  Transferência Entre Contas
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  Movimentação interna sem impacto em receitas ou despesas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                <strong>Regra Financeira:</strong> O valor será debitado da conta de origem e creditado na conta de destino sem gerar receita ou despesa contábil.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Conta de Origem (Debitar) *</label>
                <select
                  value={trfFromId}
                  onChange={(e) => setTrfFromId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Conta de Destino (Creditar) *</label>
                <select
                  value={trfToId}
                  onChange={(e) => setTrfToId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="">-- Selecione a conta de destino --</option>
                  {bankAccounts
                    .filter((a) => a.id !== trfFromId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor da Transferência *</label>
                  <input
                    type="text"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição / Finalidade</label>
                <input
                  type="text"
                  value={trfDesc}
                  onChange={(e) => setTrfDesc(e.target.value)}
                  placeholder="Ex: Transferência para reserva, repasse operacional..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold transition shadow-sm"
                >
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR LANÇAMENTO DO EXTRATO */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Lançamento do Extrato</h3>
                <p className="text-xs text-slate-500">Remover movimentação da conta {currentAccount?.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Data:</span>
                <span className="font-bold text-slate-800">{formatDateBR(transactionToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Descrição:</span>
                <span className="font-semibold text-slate-800">{transactionToDelete.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Categoria:</span>
                <span className="text-slate-700">{transactionToDelete.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor:</span>
                <span className={`font-bold ${transactionToDelete.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {transactionToDelete.amount >= 0 ? `+ ${formatCurrency(transactionToDelete.amount)}` : formatCurrency(transactionToDelete.amount)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <strong>Recálculo Automático:</strong> Ao excluir este lançamento, o saldo bancário desta conta será recalculado imediatamente pela fórmula oficial: <em>Saldo Inicial + Total Entradas - Total Saídas</em>.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingTrans}
                onClick={() => setTransactionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTrans}
                onClick={handleConfirmDeleteTransaction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingTrans ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR EXTRATO DA CONTA */}
      {isClearStatementModalOpen && currentAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Excluir Extrato da Conta</h3>
                  <p className="text-xs text-slate-500">
                    Conta: <strong>{currentAccount.name}</strong> ({currentAccount.bankName})
                  </p>
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
                    <span className="text-xs font-bold text-slate-800 block">Excluir Todo o Extrato Desta Conta</span>
                    <span className="text-[11px] text-slate-500">
                      Remove todos os {accountTransactions.length} lançamentos desta conta. O saldo inicial (R$ {formatCurrency(currentAccount.initialBalance)}) permanece preservado.
                    </span>
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
                    <span className="text-[11px] text-slate-500 block mb-2">Remove os lançamentos entre as datas especificadas</span>
                    {clearStatementType === 'range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={clearStatementStartDate}
                          onChange={(e) => setClearStatementStartDate(e.target.value)}
                          placeholder="Data inicial"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                        />
                        <input
                          type="date"
                          value={clearStatementEndDate}
                          onChange={(e) => setClearStatementEndDate(e.target.value)}
                          placeholder="Data final"
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
                {statementTransactionsToClear.length} lançamento(s)
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
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isClearingStatement ||
                  statementTransactionsToClear.length === 0 ||
                  clearStatementConfirmationInput.trim().toUpperCase() !== 'EXCLUIR'
                }
                onClick={handleConfirmClearStatement}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isClearingStatement
                    ? 'Excluindo...'
                    : `Excluir ${statementTransactionsToClear.length} Lançamento(s)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
