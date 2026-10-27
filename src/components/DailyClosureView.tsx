import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { DailyClosure, BankAllocation, CashWithdrawal } from '../types';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  getTodayDateBR,
  parseCurrencyInput
} from '../utils/formatters';
import {
  generateClosurePDF,
  downloadOrSharePDF,
  printPDF
} from '../services/pdfReportService';
import {
  FileSpreadsheet,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  Share2,
  Eye,
  X,
  CreditCard,
  DollarSign,
  QrCode,
  Landmark,
  FileText,
  Calendar,
  AlertCircle,
  Trash2,
  Receipt,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowDownRight
} from 'lucide-react';

interface DailyClosureViewProps {
  initialOpenModal?: boolean;
  onCloseModal?: () => void;
}

export const DailyClosureView: React.FC<DailyClosureViewProps> = ({
  initialOpenModal = false,
  onCloseModal,
}) => {
  const {
    closures,
    cashWithdrawals,
    bankAccounts,
    saveClosure,
    reopenClosure,
    updateClosure,
    deleteClosure,
    deleteClosuresBatch,
    createCashWithdrawal,
    cancelCashWithdrawal
  } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [isConfirmClosureModalOpen, setIsConfirmClosureModalOpen] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<DailyClosure | null>(null);
  const [reopenModalClosure, setReopenModalClosure] = useState<DailyClosure | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setSuccessToast(msg);
    setToastType(type);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Delete Single Closure State
  const [closureToDelete, setClosureToDelete] = useState<DailyClosure | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear History Modal State
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [historyDeleteType, setHistoryDeleteType] = useState<'all' | 'beforeDate' | 'range'>('all');
  const [historyBeforeDate, setHistoryBeforeDate] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyConfirmationInput, setHistoryConfirmationInput] = useState('');
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Cash Withdrawal Registration Modal State
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalAmountStr, setWithdrawalAmountStr] = useState('');
  const [withdrawalPaymentMethod, setWithdrawalPaymentMethod] = useState<'dinheiro' | 'pix'>('dinheiro');
  const [withdrawalCashier, setWithdrawalCashier] = useState(
    currentUser?.displayName || currentUser?.username || 'Caixa 1'
  );
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');

  // Cash Withdrawal Cancellation Modal State
  const [withdrawalToCancel, setWithdrawalToCancel] = useState<CashWithdrawal | null>(null);
  const [cancelWithdrawalReason, setCancelWithdrawalReason] = useState('');
  const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState(false);

  // Cash Withdrawals Section Filter & Collapse State
  const [withdrawalFilterDate, setWithdrawalFilterDate] = useState(getTodayDateBR());
  const [withdrawalFilterMethod, setWithdrawalFilterMethod] = useState<'all' | 'dinheiro' | 'pix'>('all');
  const [isWithdrawalsSectionExpanded, setIsWithdrawalsSectionExpanded] = useState(true);

  // Form Fields for Daily Closure
  const [date, setDate] = useState(getTodayDateBR());
  const [cashierName, setCashierName] = useState(
    currentUser?.displayName || currentUser?.username || 'Caixa 1'
  );
  const [initialCashStr, setInitialCashStr] = useState('100,00');
  const [cashInStr, setCashInStr] = useState('');
  const [pixInStr, setPixInStr] = useState('');
  const [creditCardInStr, setCreditCardInStr] = useState('');
  const [debitCardInStr, setDebitCardInStr] = useState('');
  const [otherInStr, setOtherInStr] = useState('');
  const [otherInDescription, setOtherInDescription] = useState('');
  const [expensesCashStr, setExpensesCashStr] = useState('');
  const [valesCashStr, setValesCashStr] = useState('');
  const [countedCashStr, setCountedCashStr] = useState('');
  const [notes, setNotes] = useState('');

  // Bank Allocations for non-cash proceeds
  const [pixTargetAccountId, setPixTargetAccountId] = useState(bankAccounts[0]?.id || '');
  const [creditTargetAccountId, setCreditTargetAccountId] = useState(bankAccounts[0]?.id || '');
  const [creditFeeRate, setCreditFeeRate] = useState('3.5'); // 3.5%
  const [debitTargetAccountId, setDebitTargetAccountId] = useState(bankAccounts[0]?.id || '');
  const [debitFeeRate, setDebitFeeRate] = useState('1.5'); // 1.5%

  // Parsed Numerical Values
  const initialCash = useMemo(() => parseCurrencyInput(initialCashStr), [initialCashStr]);
  const cashIn = useMemo(() => parseCurrencyInput(cashInStr), [cashInStr]);
  const pixIn = useMemo(() => parseCurrencyInput(pixInStr), [pixInStr]);
  const creditCardIn = useMemo(() => parseCurrencyInput(creditCardInStr), [creditCardInStr]);
  const debitCardIn = useMemo(() => parseCurrencyInput(debitCardInStr), [debitCardInStr]);
  const otherIn = useMemo(() => parseCurrencyInput(otherInStr), [otherInStr]);
  const expensesCash = useMemo(() => parseCurrencyInput(expensesCashStr), [expensesCashStr]);
  const valesCash = useMemo(() => parseCurrencyInput(valesCashStr), [valesCashStr]);
  const countedCash = useMemo(() => parseCurrencyInput(countedCashStr), [countedCashStr]);

  // Active withdrawals for selected closure form (date + cashier)
  const activeWithdrawalsForCurrentForm = useMemo(() => {
    return cashWithdrawals.filter(
      (w) =>
        w.status === 'active' &&
        w.date === date &&
        w.cashierName.trim().toLowerCase() === cashierName.trim().toLowerCase()
    );
  }, [cashWithdrawals, date, cashierName]);

  const activeCashWithdrawalsSum = useMemo(() => {
    return activeWithdrawalsForCurrentForm
      .filter((w) => w.paymentMethod === 'dinheiro')
      .reduce((sum, w) => sum + w.amount, 0);
  }, [activeWithdrawalsForCurrentForm]);

  const activePixWithdrawalsSum = useMemo(() => {
    return activeWithdrawalsForCurrentForm
      .filter((w) => w.paymentMethod === 'pix')
      .reduce((sum, w) => sum + w.amount, 0);
  }, [activeWithdrawalsForCurrentForm]);

  // Calculations enforced by financial rules
  const totalSales = useMemo(() => {
    return cashIn + pixIn + creditCardIn + debitCardIn + otherIn;
  }, [cashIn, pixIn, creditCardIn, debitCardIn, otherIn]);

  // Regra 1: Saldo em dinheiro = Total de entradas em dinheiro − saídas em dinheiro
  const saldoLiquidoDinheiro = useMemo(() => {
    return cashIn - expensesCash;
  }, [cashIn, expensesCash]);

  // Regra 2: Saldo via Pix = Total de entradas via Pix − saídas via Pix
  const saldoLiquidoPix = useMemo(() => {
    return pixIn - activePixWithdrawalsSum;
  }, [pixIn, activePixWithdrawalsSum]);

  // Regra 3: Total geral das saídas = saídas em dinheiro + saídas via Pix + vales pagos em dinheiro
  const totalGeralSaidas = useMemo(() => {
    return expensesCash + activePixWithdrawalsSum + valesCash;
  }, [expensesCash, activePixWithdrawalsSum, valesCash]);

  // Regra 4: Movimento líquido total = Total de entradas − total de saídas
  const movimentoLiquidoTotal = useMemo(() => {
    return totalSales - totalGeralSaidas;
  }, [totalSales, totalGeralSaidas]);

  // Dinheiro esperado no caixa físico = Saldo inicial + Vendas em dinheiro - Saídas em dinheiro - Vales
  const expectedCash = useMemo(() => {
    return initialCash + cashIn - expensesCash - valesCash;
  }, [initialCash, cashIn, expensesCash, valesCash]);

  const saidaFisica = useMemo(() => {
    return expensesCash + valesCash;
  }, [expensesCash, valesCash]);

  const cashDifference = useMemo(() => {
    return countedCash - expectedCash;
  }, [countedCash, expectedCash]);

  // Check duplicate closure warning
  const duplicateWarning = useMemo(() => {
    if (!date || !cashierName) return false;
    return closures.some(
      (c) => c.date === date && c.cashierName.trim().toLowerCase() === cashierName.trim().toLowerCase()
    );
  }, [closures, date, cashierName]);

  // Check if today's cashier is closed
  const isTodayCashierClosed = useMemo(() => {
    const today = getTodayDateBR();
    return closures.some((c) => c.date === today && c.status === 'closed');
  }, [closures]);

  // Filtered withdrawals list for the dashboard section
  const filteredWithdrawals = useMemo(() => {
    return cashWithdrawals.filter((w) => {
      const matchDate = !withdrawalFilterDate || w.date === withdrawalFilterDate;
      const matchMethod = withdrawalFilterMethod === 'all' || w.paymentMethod === withdrawalFilterMethod;
      return matchDate && matchMethod;
    });
  }, [cashWithdrawals, withdrawalFilterDate, withdrawalFilterMethod]);

  const totalFilteredCashWithdrawals = useMemo(() => {
    return filteredWithdrawals
      .filter((w) => w.status === 'active' && w.paymentMethod === 'dinheiro')
      .reduce((acc, w) => acc + w.amount, 0);
  }, [filteredWithdrawals]);

  const totalFilteredPixWithdrawals = useMemo(() => {
    return filteredWithdrawals
      .filter((w) => w.status === 'active' && w.paymentMethod === 'pix')
      .reduce((acc, w) => acc + w.amount, 0);
  }, [filteredWithdrawals]);

  const totalFilteredWithdrawalsAll = useMemo(() => {
    return totalFilteredCashWithdrawals + totalFilteredPixWithdrawals;
  }, [totalFilteredCashWithdrawals, totalFilteredPixWithdrawals]);

  const resetForm = () => {
    const today = getTodayDateBR();
    const cName = currentUser?.displayName || currentUser?.username || 'Caixa 1';
    setDate(today);
    setCashierName(cName);
    setInitialCashStr('100,00');
    setCashInStr('');
    setPixInStr('');
    setCreditCardInStr('');
    setDebitCardInStr('');
    setOtherInStr('');
    setOtherInDescription('');

    // Preload active cash withdrawals sum if any exist
    const activeCashSum = cashWithdrawals
      .filter((w) => w.status === 'active' && w.date === today && w.cashierName.trim().toLowerCase() === cName.trim().toLowerCase() && w.paymentMethod === 'dinheiro')
      .reduce((s, w) => s + w.amount, 0);
    setExpensesCashStr(activeCashSum > 0 ? activeCashSum.toFixed(2).replace('.', ',') : '');

    setValesCashStr('');
    setCountedCashStr('');
    setNotes('');
    setErrorMessage('');
  };

  const handleOpenNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Handler for creating a cash withdrawal
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawalError('');

    if (!withdrawalReason.trim()) {
      setWithdrawalError('Por favor, informe o motivo ou descrição da saída de caixa.');
      return;
    }

    const amount = parseCurrencyInput(withdrawalAmountStr);
    if (amount <= 0) {
      setWithdrawalError('Por favor, informe um valor válido maior que zero (R$).');
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR');
      const dateStr = getTodayDateBR();
      const dateTimeStr = now.toISOString();

      await createCashWithdrawal({
        date: dateStr,
        time: timeStr,
        dateTime: dateTimeStr,
        cashierName: withdrawalCashier.trim() || 'Caixa 1',
        reason: withdrawalReason.trim(),
        amount,
        paymentMethod: withdrawalPaymentMethod,
        responsibleUid: currentUser?.id || 'anon',
        responsibleName: currentUser?.displayName || currentUser?.username || 'Operador',
      });

      showToast(
        `Saída de R$ ${amount.toFixed(2)} (${withdrawalPaymentMethod === 'dinheiro' ? 'Dinheiro Físico' : 'Pix'}) registrada com sucesso!`,
        'success'
      );
      setIsWithdrawalModalOpen(false);
      setWithdrawalReason('');
      setWithdrawalAmountStr('');
      setWithdrawalPaymentMethod('dinheiro');
    } catch (err: any) {
      setWithdrawalError(err.message || 'Erro ao registrar saída de caixa.');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  // Handler for cancelling a cash withdrawal
  const handleConfirmCancelWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalToCancel) return;
    if (!cancelWithdrawalReason.trim()) {
      showToast('Por favor, informe a justificativa do cancelamento.', 'error');
      return;
    }

    setIsCancellingWithdrawal(true);
    try {
      await cancelCashWithdrawal(withdrawalToCancel.id, cancelWithdrawalReason.trim());
      showToast('Saída de caixa cancelada com sucesso. Valores recalculados!', 'success');
      setWithdrawalToCancel(null);
      setCancelWithdrawalReason('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao cancelar saída de caixa.', 'error');
    } finally {
      setIsCancellingWithdrawal(false);
    }
  };

  // Step 1: Pre-submit validation -> Open confirmation modal with full summary
  const handlePreSubmitClosure = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!date) {
      setErrorMessage('Por favor, selecione a data do fechamento.');
      return;
    }
    if (!cashierName.trim()) {
      setErrorMessage('Por favor, informe o nome do responsável ou caixa.');
      return;
    }
    if (!countedCashStr.trim()) {
      setErrorMessage('Por favor, informe o valor contado no caixa ao final do expediente.');
      return;
    }

    // Open confirmation modal displaying complete summary of all movements
    setIsConfirmClosureModalOpen(true);
  };

  // Step 2: Final confirmation commit -> Persist closure to database and lock cashier
  const handleExecuteFinalClosure = async () => {
    setIsSubmitting(true);
    try {
      const allocations: BankAllocation[] = [];
      if (pixIn > 0) {
        allocations.push({
          method: 'pix',
          label: 'Pix Mercadinho',
          grossAmount: pixIn,
          feePercentage: 0,
          feeAmount: 0,
          netAmount: pixIn,
          targetAccountId: '',
          targetAccountName: 'Controle Interno Fechamento',
          destinationType: 'caixa_fisico',
          status: 'confirmado',
        });
      }
      if (creditCardIn > 0) {
        allocations.push({
          method: 'cartao_credito',
          label: 'Cartão de Crédito',
          grossAmount: creditCardIn,
          feePercentage: 0,
          feeAmount: 0,
          netAmount: creditCardIn,
          targetAccountId: '',
          targetAccountName: 'Controle Interno Fechamento',
          destinationType: 'valor_a_receber',
          status: 'confirmado',
        });
      }
      if (debitCardIn > 0) {
        allocations.push({
          method: 'cartao_debito',
          label: 'Cartão de Débito',
          grossAmount: debitCardIn,
          feePercentage: 0,
          feeAmount: 0,
          netAmount: debitCardIn,
          targetAccountId: '',
          targetAccountName: 'Controle Interno Fechamento',
          destinationType: 'valor_a_receber',
          status: 'confirmado',
        });
      }

      await saveClosure({
        date,
        cashierName: cashierName.trim(),
        responsibleUid: currentUser?.id || 'anon',
        responsibleUsername: currentUser?.username,
        initialCash,
        cashIn,
        pixIn,
        creditCardIn,
        debitCardIn,
        otherIn,
        otherInDescription: otherInDescription.trim(),
        expensesCash,
        expensesPix: activePixWithdrawalsSum,
        valesCash,
        countedCash,
        expectedCash,
        cashDifference,
        totalSales,
        status: 'closed',
        notes: notes.trim(),
        bankAllocations: allocations,
      });

      showToast('Fechamento de caixa concluído e gravado com sucesso no sistema!', 'success');
      setIsConfirmClosureModalOpen(false);
      setIsModalOpen(false);
      if (onCloseModal) onCloseModal();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao registrar fechamento.');
      setIsConfirmClosureModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenModalClosure) return;
    if (!reopenReason.trim()) {
      showToast('Informe a justificativa para a reabertura do fechamento.', 'error');
      return;
    }

    try {
      await reopenClosure(reopenModalClosure.id, reopenReason.trim());
      showToast(`Fechamento de ${formatDateBR(reopenModalClosure.date)} reaberto.`, 'success');
      setReopenModalClosure(null);
      setReopenReason('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao reabrir fechamento.', 'error');
    }
  };

  // Closures matching history clear filter
  const closuresToClear = useMemo(() => {
    if (historyDeleteType === 'all') {
      return closures;
    }
    if (historyDeleteType === 'beforeDate') {
      if (!historyBeforeDate) return [];
      return closures.filter((c) => c.date <= historyBeforeDate);
    }
    if (historyDeleteType === 'range') {
      return closures.filter((c) => {
        const matchStart = !historyStartDate || c.date >= historyStartDate;
        const matchEnd = !historyEndDate || c.date <= historyEndDate;
        return matchStart && matchEnd;
      });
    }
    return [];
  }, [closures, historyDeleteType, historyBeforeDate, historyStartDate, historyEndDate]);

  // Handler for deleting single closure
  const handleConfirmDeleteSingle = async () => {
    if (!closureToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClosure(closureToDelete.id, deleteReason.trim() || 'Excluído pelo usuário');
      showToast(`Fechamento do dia ${formatDateBR(closureToDelete.date)} excluído com sucesso.`, 'success');
      setClosureToDelete(null);
      setDeleteReason('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir fechamento.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler for clearing closure history
  const handleConfirmClearHistory = async () => {
    if (closuresToClear.length === 0) return;
    if (historyConfirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Digite EXCLUIR para confirmar a exclusão do histórico.', 'error');
      return;
    }
    setIsClearingHistory(true);
    try {
      const ids = closuresToClear.map((c) => c.id);
      await deleteClosuresBatch(ids, `Limpeza de histórico: ${ids.length} fechamentos excluídos`);
      showToast(`${ids.length} fechamento(s) excluído(s) do histórico com sucesso.`, 'success');
      setIsClearHistoryModalOpen(false);
      setHistoryConfirmationInput('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir histórico de fechamentos.', 'error');
    } finally {
      setIsClearingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4 ${
          toastType === 'error' ? 'bg-red-700 text-white border border-red-800' : 'bg-emerald-800 text-white'
        }`}>
          {toastType === 'error' ? <AlertCircle className="w-5 h-5 text-red-200" /> : <CheckCircle2 className="w-5 h-5 text-amber-300" />}
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Fechamento Diário de Caixa
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {closures.length} fechamento(s)
            </span>
            {isTodayCashierClosed && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-700" />
                Caixa Fechado (Hoje)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle exato de vendas, saídas físicas/Pix, dinheiro contado e conferência do expediente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setWithdrawalReason('');
              setWithdrawalAmountStr('');
              setWithdrawalPaymentMethod('dinheiro');
              setWithdrawalCashier(currentUser?.displayName || currentUser?.username || 'Caixa 1');
              setWithdrawalError('');
              setIsWithdrawalModalOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            title="Lançar retirada ou despesa antes do fechamento definitivo"
          >
            <MinusCircle className="w-4 h-4 text-rose-200" />
            <span>Registrar Saída de Caixa</span>
          </button>

          <button
            onClick={handleOpenNew}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs transition shadow-md hover:shadow-lg cursor-pointer ring-1 ring-emerald-500/40 active:scale-95"
            title="Iniciar conferência e fechar o caixa do expediente"
          >
            <Lock className="w-4 h-4 text-amber-300" />
            <span>Fechar Caixa</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO: SAÍDAS DE CAIXA DO EXPEDIENTE (DINHEIRO & PIX) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header da Seção de Saídas */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-rose-50/40 via-amber-50/20 to-white">
          <div className="flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Saídas de Caixa do Expediente
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    {filteredWithdrawals.filter((w) => w.status === 'active').length} ativa(s)
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Lançamento ilimitado de despesas durante o dia com separação independente de Dinheiro e Pix
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsWithdrawalsSectionExpanded(!isWithdrawalsSectionExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer md:hidden"
              title={isWithdrawalsSectionExpanded ? 'Recolher seção' : 'Expandir seção'}
            >
              {isWithdrawalsSectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setIsWithdrawalsSectionExpanded(!isWithdrawalsSectionExpanded)}
              className="hidden md:flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <span>{isWithdrawalsSectionExpanded ? 'Recolher' : 'Expandir'}</span>
              {isWithdrawalsSectionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Resumo Rápido dos Totais de Saídas (Dinheiro vs Pix vs Total) */}
        <div className="p-4 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card Saídas Dinheiro */}
          <div className="p-3.5 rounded-xl bg-white border border-emerald-100 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saídas em Dinheiro</span>
              </div>
              <div className="text-lg font-black text-emerald-900 mt-0.5">
                {formatCurrency(totalFilteredCashWithdrawals)}
              </div>
              <span className="text-[10px] text-slate-400">Descontadas do caixa físico</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              R$
            </div>
          </div>

          {/* Card Saídas Pix */}
          <div className="p-3.5 rounded-xl bg-white border border-teal-100 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                <QrCode className="w-3.5 h-3.5 text-teal-600" />
                <span>Saídas via Pix</span>
              </div>
              <div className="text-lg font-black text-teal-900 mt-0.5">
                {formatCurrency(totalFilteredPixWithdrawals)}
              </div>
              <span className="text-[10px] text-slate-400">Descontadas das vendas Pix</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              PIX
            </div>
          </div>

          {/* Card Total Geral de Saídas */}
          <div className="p-3.5 rounded-xl bg-white border border-rose-100 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                <span>Total Geral de Saídas</span>
              </div>
              <div className="text-lg font-black text-rose-700 mt-0.5">
                {formatCurrency(totalFilteredWithdrawalsAll)}
              </div>
              <span className="text-[10px] text-slate-400">Dinheiro + Pix do filtro</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs">
              TOTAL
            </div>
          </div>
        </div>

        {/* Conteúdo Expansível: Barra de Filtros e Listagem */}
        {isWithdrawalsSectionExpanded && (
          <div className="p-4 space-y-4">
            {/* Barra de Filtro de Saídas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filtrar por data:
                </span>
                <input
                  type="date"
                  value={withdrawalFilterDate}
                  onChange={(e) => setWithdrawalFilterDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                {withdrawalFilterDate !== getTodayDateBR() && (
                  <button
                    onClick={() => setWithdrawalFilterDate(getTodayDateBR())}
                    className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                  >
                    Hoje
                  </button>
                )}
                {withdrawalFilterDate && (
                  <button
                    onClick={() => setWithdrawalFilterDate('')}
                    className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 text-[11px] font-medium transition cursor-pointer"
                  >
                    Todas as datas
                  </button>
                )}
              </div>

              {/* Filtro por Forma de Pagamento */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Forma:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  <button
                    onClick={() => setWithdrawalFilterMethod('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      withdrawalFilterMethod === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setWithdrawalFilterMethod('dinheiro')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      withdrawalFilterMethod === 'dinheiro'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dinheiro
                  </button>
                  <button
                    onClick={() => setWithdrawalFilterMethod('pix')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      withdrawalFilterMethod === 'pix'
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pix
                  </button>
                </div>
              </div>
            </div>

            {/* Listagem de Saídas de Caixa */}
            {filteredWithdrawals.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Nenhuma saída de caixa registrada</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                  {withdrawalFilterDate
                    ? `Não foram encontrados lançamentos de saída para ${formatDateBR(withdrawalFilterDate)}.`
                    : 'Não há registros de saída no momento.'}{' '}
                  Use o botão acima para lançar retiradas avulsas.
                </p>
              </div>
            ) : (
              <>
                {/* Visualização em Lista / Cards para Celular */}
                <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                  {filteredWithdrawals.map((w) => {
                    const isCancelled = w.status === 'cancelled';
                    return (
                      <div
                        key={w.id}
                        className={`p-3 rounded-xl border transition ${
                          isCancelled
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  w.paymentMethod === 'dinheiro'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                                }`}
                              >
                                {w.paymentMethod === 'dinheiro' ? (
                                  <>
                                    <DollarSign className="w-2.5 h-2.5" /> Dinheiro Físico
                                  </>
                                ) : (
                                  <>
                                    <QrCode className="w-2.5 h-2.5" /> Pix
                                  </>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {w.time || formatDateTimeBR(w.dateTime || w.createdAt).split(' ')[1]}
                              </span>
                            </div>

                            <p className="font-semibold text-slate-900 text-xs mt-1.5">
                              {w.reason}
                            </p>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                              <span className="flex items-center gap-0.5">
                                <User className="w-2.5 h-2.5" /> {w.responsibleName}
                              </span>
                              <span>•</span>
                              <span>{w.cashierName}</span>
                            </div>

                            {isCancelled && w.cancellationReason && (
                              <p className="text-[10px] text-rose-600 mt-1 italic">
                                Cancelado por {w.cancelledBy || 'admin'}: "{w.cancellationReason}"
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-sm font-black ${
                                isCancelled ? 'text-slate-400 line-through' : 'text-rose-700'
                              }`}
                            >
                              - {formatCurrency(w.amount)}
                            </span>

                            {!isCancelled && (
                              <div className="mt-1">
                                <button
                                  onClick={() => {
                                    setWithdrawalToCancel(w);
                                    setCancelWithdrawalReason('');
                                  }}
                                  className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                                  title="Cancelar saída"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tabela para Telas Médias e Computador */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Data & Horário</th>
                        <th className="py-2.5 px-3">Motivo / Descrição</th>
                        <th className="py-2.5 px-3 text-center">Forma de Pagamento</th>
                        <th className="py-2.5 px-3">Caixa / Responsável</th>
                        <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredWithdrawals.map((w) => {
                        const isCancelled = w.status === 'cancelled';
                        return (
                          <tr
                            key={w.id}
                            className={`hover:bg-slate-50/80 transition ${
                              isCancelled ? 'opacity-50 bg-slate-50/40' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                              <div>{formatDateBR(w.date)}</div>
                              <div className="text-[10px] text-slate-400">
                                {w.time || formatDateTimeBR(w.dateTime || w.createdAt).split(' ')[1]}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{w.reason}</div>
                              {isCancelled && w.cancellationReason && (
                                <div className="text-[10px] text-rose-600 italic">
                                  Justificativa do cancelamento: "{w.cancellationReason}"
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  w.paymentMethod === 'dinheiro'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                                }`}
                              >
                                {w.paymentMethod === 'dinheiro' ? (
                                  <>
                                    <DollarSign className="w-2.5 h-2.5" /> Dinheiro Físico
                                  </>
                                ) : (
                                  <>
                                    <QrCode className="w-2.5 h-2.5" /> Pix
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              <div className="font-medium text-slate-800">{w.responsibleName}</div>
                              <div className="text-[10px] text-slate-400">{w.cashierName}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-black">
                              <span className={isCancelled ? 'text-slate-400 line-through' : 'text-rose-700'}>
                                - {formatCurrency(w.amount)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCancelled
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isCancelled ? 'Cancelado' : 'Ativo'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {!isCancelled ? (
                                <button
                                  onClick={() => {
                                    setWithdrawalToCancel(w);
                                    setCancelWithdrawalReason('');
                                  }}
                                  className="px-2 py-1 rounded-lg text-rose-700 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                                  title="Cancelar saída de caixa"
                                >
                                  Cancelar
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Estornado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* List of Closures Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Histórico de Fechamentos Realizados</h2>
            <span className="text-xs text-slate-400">Ordenados do mais recente para o mais antigo</span>
          </div>
          {closures.length > 0 && (
            <button
              onClick={() => {
                setHistoryDeleteType('all');
                setHistoryConfirmationInput('');
                setIsClearHistoryModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              title="Excluir histórico de fechamentos"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Excluir Histórico</span>
            </button>
          )}
        </div>

        {closures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Caixa / Responsável</th>
                  <th className="py-3 px-4 text-right">Total Vendas</th>
                  <th className="py-3 px-4 text-right">Dinheiro Físico</th>
                  <th className="py-3 px-4 text-right">Pix</th>
                  <th className="py-3 px-4 text-right">Cartões</th>
                  <th className="py-3 px-4 text-right">Esperado</th>
                  <th className="py-3 px-4 text-right">Contado</th>
                  <th className="py-3 px-4 text-right">Saída Física</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {closures.map((cls) => {
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatDateBR(cls.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {cls.cashierName}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800 whitespace-nowrap">
                        {formatCurrency(cls.totalSales)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {formatCurrency(cls.cashIn)}
                      </td>
                      <td className="py-3 px-4 text-right text-teal-700 whitespace-nowrap">
                        {formatCurrency(cls.pixIn)}
                      </td>
                      <td className="py-3 px-4 text-right text-indigo-700 whitespace-nowrap">
                        {formatCurrency(cls.creditCardIn + cls.debitCardIn)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                        {formatCurrency(cls.expectedCash)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(cls.countedCash)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-100 text-rose-800">
                          {formatCurrency((cls.expensesCash || 0) + (cls.valesCash || 0))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cls.status === 'closed'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {cls.status === 'closed' ? (
                            <>
                              <Lock className="w-2.5 h-2.5" /> Fechado
                            </>
                          ) : (
                            <>
                              <Unlock className="w-2.5 h-2.5" /> Reaberto
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Detalhes */}
                          <button
                            onClick={() => setSelectedClosure(cls)}
                            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Ver detalhes completos do fechamento"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* PDF */}
                          <button
                            onClick={async () => {
                              const doc = generateClosurePDF(cls);
                              await downloadOrSharePDF(
                                doc,
                                `Fechamento_${cls.date}_${cls.cashierName.replace(/\s+/g, '_')}.pdf`,
                                `Fechamento de Caixa - ${formatDateBR(cls.date)}`
                              );
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 hover:text-emerald-800 transition cursor-pointer"
                            title="Baixar / Compartilhar Relatório em PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Reabertura (Admin only) */}
                          {isAdmin && cls.status === 'closed' && (
                            <button
                              onClick={() => {
                                setReopenModalClosure(cls);
                                setReopenReason('');
                              }}
                              className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition cursor-pointer"
                              title="Reabrir Fechamento (Apenas Administrador)"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}

                          {/* Excluir Fechamento */}
                          <button
                            onClick={() => {
                              setClosureToDelete(cls);
                              setDeleteReason('');
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                            title="Excluir este fechamento de caixa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhum fechamento registrado no sistema. Clique em "Registrar Novo Fechamento" acima.
          </div>
        )}
      </div>

      {/* MODAL: FECHAR CAIXA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  Fechar Caixa — Expediente Diário
                </h3>
                <p className="text-[11px] sm:text-xs text-emerald-200 mt-0.5">
                  Informe as entradas e saídas físicas para conferência e fechamento do caixa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseModal) onCloseModal();
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePreSubmitClosure} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain pb-16 sm:pb-6">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {duplicateWarning && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="block font-semibold">Aviso de Fechamento Existente</strong>
                    Já existe um fechamento registrado para este caixa nesta data. Se você for o administrador registrando um segundo turno, pode prosseguir normalmente.
                  </div>
                </div>
              )}

              {/* Data e Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data do Fechamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Caixa / Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="Ex: Caixa 1, Maria, Turno Manhã"
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              {/* Saldo Inicial e Entradas */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  Entradas e Meios de Recebimento
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Saldo Inicial em Dinheiro (Abertura de Caixa)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={initialCashStr}
                        onChange={(e) => setInitialCashStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Total Recebido em Dinheiro Físico *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cashInStr}
                        onChange={(e) => setCashInStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Total Recebido via Pix
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pixInStr}
                        onChange={(e) => setPixInStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-teal-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Cartão de Crédito
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={creditCardInStr}
                        onChange={(e) => setCreditCardInStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-indigo-800 focus:ring-2 focus:ring-indigo-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Cartão de Débito
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={debitCardInStr}
                        onChange={(e) => setDebitCardInStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-indigo-800 focus:ring-2 focus:ring-indigo-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Outras Entradas
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={otherInStr}
                        onChange={(e) => setOtherInStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-700 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {otherIn > 0 && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Descrição de Outras Entradas
                    </label>
                    <input
                      type="text"
                      value={otherInDescription}
                      onChange={(e) => setOtherInDescription(e.target.value)}
                      placeholder="Ex: Recarga de celular, venda de vasilhame"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Saídas Pagas pelo Caixa Físico e Pix */}
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-rose-600" />
                    Saídas e Despesas Vinculadas ao Caixa
                  </h4>
                  {activeWithdrawalsForCurrentForm.length > 0 && (
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                      {activeWithdrawalsForCurrentForm.length} saída(s) detectada(s)
                    </span>
                  )}
                </div>

                {activeWithdrawalsForCurrentForm.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-700">
                      <span>Saídas em Dinheiro registradas hoje:</span>
                      <strong className="text-emerald-800">{formatCurrency(activeCashWithdrawalsSum)}</strong>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Saídas via Pix registradas hoje:</span>
                      <strong className="text-teal-800">{formatCurrency(activePixWithdrawalsSum)}</strong>
                    </div>
                    {expensesCash !== activeCashWithdrawalsSum && (
                      <button
                        type="button"
                        onClick={() => setExpensesCashStr(activeCashWithdrawalsSum.toFixed(2).replace('.', ','))}
                        className="text-[10px] text-rose-700 font-bold underline cursor-pointer mt-1"
                      >
                        Sincronizar campo com saídas em dinheiro (R$ {activeCashWithdrawalsSum.toFixed(2)})
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Despesas Pagas do Caixa em Dinheiro (Gás, pão, entregador, etc.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={expensesCashStr}
                        onChange={(e) => setExpensesCashStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-rose-200 bg-white text-xs font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Vales Pagos em Dinheiro pelo Caixa
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valesCashStr}
                        onChange={(e) => setValesCashStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-rose-200 bg-white text-xs font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informativo de Isolamento Financeiro */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Isolamento e Controle Interno do Caixa</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Os valores declarados neste fechamento diário (Dinheiro, Pix, Cartões de Crédito e Débito, Despesas e Vales) são estritamente para conferência interna do mercadinho e emissão de relatórios de fechamento. <strong>Nenhum saldo ou extrato bancário é alterado automaticamente por este formulário.</strong>
                </p>
              </div>

              {/* Contagem Final do Caixa (Obrigatório) */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Dinheiro Físico Contado no Caixa ao Final do Expediente *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-black text-amber-700">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={countedCashStr}
                    onChange={(e) => setCountedCashStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-amber-400 bg-white text-sm font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-amber-800">
                  Conte notas e moedas presentes na gaveta para conferência final do dinheiro físico no caixa.
                </p>
              </div>

              {/* LIVE AUDIT & CALCULATION SUMMARY BOX */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3.5">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    Resumo do Fechamento e Conferência de Caixa
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal lowercase">regras integradas</span>
                </div>

                {/* Sub-tabela de separação Dinheiro vs Pix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Bloco Dinheiro */}
                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-700/80 pb-1">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Dinheiro Físico
                      </span>
                      <span>{formatCurrency(cashIn)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Saídas em Dinheiro:</span>
                      <span className="text-rose-400 font-semibold">- {formatCurrency(expensesCash)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Vales em Dinheiro:</span>
                      <span className="text-rose-400 font-semibold">- {formatCurrency(valesCash)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-700 font-bold text-white">
                      <span>Saldo Líquido em Dinheiro:</span>
                      <span className="text-emerald-300">{formatCurrency(saldoLiquidoDinheiro)}</span>
                    </div>
                  </div>

                  {/* Bloco Pix */}
                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-teal-400 font-bold border-b border-slate-700/80 pb-1">
                      <span className="flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> Vendas via Pix
                      </span>
                      <span>{formatCurrency(pixIn)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Saídas via Pix:</span>
                      <span className="text-rose-400 font-semibold">- {formatCurrency(activePixWithdrawalsSum)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-700 font-bold text-white">
                      <span>Saldo Líquido via Pix:</span>
                      <span className="text-teal-300">{formatCurrency(saldoLiquidoPix)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumo Consolidado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Total Vendas</span>
                    <strong className="text-sm font-bold text-emerald-400">
                      {formatCurrency(totalSales)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Total Saídas (Geral)</span>
                    <strong className="text-sm font-bold text-rose-400">
                      {formatCurrency(totalGeralSaidas)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Movimento Líquido</span>
                    <strong className="text-sm font-bold text-indigo-300">
                      {formatCurrency(movimentoLiquidoTotal)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Esperado Gaveta</span>
                    <strong className="text-sm font-bold text-white">
                      {formatCurrency(expectedCash)}
                    </strong>
                  </div>
                </div>

                {/* Contagem e Diferença */}
                <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Dinheiro Contado:</span>
                    <strong className="text-amber-300 text-sm">{formatCurrency(countedCash)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Diferença de Caixa:</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                        cashDifference === 0
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                          : cashDifference > 0
                          ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                          : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {cashDifference === 0
                        ? 'Caixa Exato (R$ 0,00)'
                        : cashDifference > 0
                        ? `Sobra de ${formatCurrency(cashDifference)}`
                        : `Falta de ${formatCurrency(Math.abs(cashDifference))}`}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed pt-0.5 border-t border-slate-800">
                  • Saldo Dinheiro = Vendas ({formatCurrency(cashIn)}) − Saídas ({formatCurrency(expensesCash)}) = {formatCurrency(saldoLiquidoDinheiro)}. • Saldo Pix = Vendas ({formatCurrency(pixIn)}) − Saídas ({formatCurrency(activePixWithdrawalsSum)}) = {formatCurrency(saldoLiquidoPix)}. • Movimento Líquido = Vendas ({formatCurrency(totalSales)}) − Saídas Totais ({formatCurrency(totalGeralSaidas)}) = {formatCurrency(movimentoLiquidoTotal)}.
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações do Fechamento (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Diferença de R$ 2,00 por troco arredondado, cliente pagou a mais..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none text-slate-800"
                />
              </div>

              </div>

              {/* Action Buttons - Docked at bottom, keyboard-safe */}
              <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 active:scale-95 text-white font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Avançar para Fechamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE FECHAMENTO DE CAIXA (PRÉ-FECHAMENTO COM RESUMO COMPLETO) */}
      {isConfirmClosureModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-emerald-900/20 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Confirmar Fechamento de Caixa
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Revise o resumo completo das movimentações antes de concluir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmClosureModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain text-xs">
              {/* Metadados: Data, Horário e Responsável */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">DATA DO CAIXA</span>
                  <strong className="text-slate-800 text-xs">{formatDateBR(date)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">HORÁRIO</span>
                  <strong className="text-slate-800 text-xs">{new Date().toLocaleTimeString('pt-BR')}</strong>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block font-semibold">RESPONSÁVEL / CAIXA</span>
                  <strong className="text-emerald-900 text-xs truncate block">{cashierName}</strong>
                </div>
              </div>

              {/* Resumo Consolidado das Entradas e Vendas */}
              <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                <h4 className="font-bold text-emerald-950 flex items-center justify-between text-xs border-b border-emerald-200/60 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    Entradas e Vendas do Expediente
                  </span>
                  <span className="text-sm font-black text-emerald-900">{formatCurrency(totalSales)}</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span>Dinheiro Físico:</span>
                    <strong className="text-slate-900">{formatCurrency(cashIn)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Recebido via Pix:</span>
                    <strong className="text-teal-800">{formatCurrency(pixIn)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cartão de Crédito:</span>
                    <strong className="text-indigo-800">{formatCurrency(creditCardIn)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cartão de Débito:</span>
                    <strong className="text-indigo-800">{formatCurrency(debitCardIn)}</strong>
                  </div>
                  {otherIn > 0 && (
                    <div className="flex justify-between col-span-2 border-t border-emerald-100 pt-1">
                      <span>Outras Entradas ({otherInDescription || 'Diversos'}):</span>
                      <strong className="text-slate-900">{formatCurrency(otherIn)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumo das Saídas Separadas (Dinheiro vs Pix) */}
              <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-2">
                <h4 className="font-bold text-rose-950 flex items-center justify-between text-xs border-b border-rose-200/60 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-rose-700" />
                    Saídas e Despesas por Forma de Pagamento
                  </span>
                  <span className="text-sm font-black text-rose-700">- {formatCurrency(totalGeralSaidas)}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white border border-rose-200/80 space-y-1">
                    <div className="flex justify-between font-bold text-emerald-900">
                      <span>Saídas em Dinheiro:</span>
                      <span className="text-rose-700">- {formatCurrency(expensesCash + valesCash)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Despesas ({formatCurrency(expensesCash)}) + Vales ({formatCurrency(valesCash)})
                    </span>
                    <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                      <span>Saldo Líquido Dinheiro:</span>
                      <span className="text-emerald-800">{formatCurrency(saldoLiquidoDinheiro)}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-teal-200/80 space-y-1">
                    <div className="flex justify-between font-bold text-teal-900">
                      <span>Saídas via Pix:</span>
                      <span className="text-rose-700">- {formatCurrency(activePixWithdrawalsSum)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {activeWithdrawalsForCurrentForm.filter((w) => w.paymentMethod === 'pix').length} saída(s) via Pix
                    </span>
                    <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                      <span>Saldo Líquido Pix:</span>
                      <span className="text-teal-800">{formatCurrency(saldoLiquidoPix)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conferência da Gaveta (Dinheiro Físico) */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span>Conferência da Gaveta (Dinheiro Físico)</span>
                  <span className="text-[10px] text-slate-400 font-normal">notas e moedas</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-400">Fundo Inicial / Troco:</span>
                    <strong className="text-white block">{formatCurrency(initialCash)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Dinheiro Esperado:</span>
                    <strong className="text-white block">{formatCurrency(expectedCash)}</strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">DINHEIRO CONTADO</span>
                    <strong className="text-amber-300 text-base">{formatCurrency(countedCash)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">DIFERENÇA DE CAIXA</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black ${
                        cashDifference === 0
                          ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                          : cashDifference > 0
                          ? 'bg-blue-900 text-blue-300 border border-blue-700'
                          : 'bg-rose-900 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {cashDifference === 0
                        ? 'Caixa Exato (R$ 0,00)'
                        : cashDifference > 0
                        ? `Sobra de ${formatCurrency(cashDifference)}`
                        : `Falta de ${formatCurrency(Math.abs(cashDifference))}`}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between font-semibold">
                  <span>Movimento Líquido Geral:</span>
                  <span className="text-amber-300">{formatCurrency(movimentoLiquidoTotal)}</span>
                </div>
              </div>

              {/* Alerta de Confirmação Definitiva */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção:</strong> Ao confirmar, o caixa deste turno será encerrado no banco de dados e protegido contra alterações acidentais. Para novos lançamentos neste caixa, será necessária autorização administrativa para reabertura.
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmClosureModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
              >
                Voltar e Revisar
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteFinalClosure}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 active:scale-95 text-white font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Confirmar e Fechar Caixa Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES COMPLETOS DO FECHAMENTO */}
      {selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold">
                  Detalhes do Fechamento — {formatDateBR(selectedClosure.date)}
                </h3>
                <p className="text-[11px] sm:text-xs text-emerald-200 mt-0.5">
                  Responsável: {selectedClosure.cashierName}
                </p>
              </div>
              <button
                onClick={() => setSelectedClosure(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Saldo Inicial Caixa</span>
                  <strong className="text-slate-900 font-bold text-sm">
                    {formatCurrency(selectedClosure.initialCash)}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-emerald-700 block text-[10px]">Total Geral Vendas</span>
                  <strong className="text-emerald-900 font-bold text-sm">
                    {formatCurrency(selectedClosure.totalSales)}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800">Discriminação das Vendas:</h4>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>Dinheiro Físico:</span>
                  <strong className="text-slate-900">{formatCurrency(selectedClosure.cashIn)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>Pix Recebido:</span>
                  <strong className="text-teal-700">{formatCurrency(selectedClosure.pixIn)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>Cartão de Crédito:</span>
                  <strong className="text-indigo-700">{formatCurrency(selectedClosure.creditCardIn)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>Cartão de Débito:</span>
                  <strong className="text-indigo-700">{formatCurrency(selectedClosure.debitCardIn)}</strong>
                </div>
                {selectedClosure.otherIn > 0 && (
                  <div className="flex justify-between py-1">
                    <span>Outras ({selectedClosure.otherInDescription || 'Diversos'}):</span>
                    <strong className="text-slate-900">{formatCurrency(selectedClosure.otherIn)}</strong>
                  </div>
                )}
              </div>

              {/* Discriminação de Saídas e Saldos Líquidos (Dinheiro & Pix) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Movimentação e Saldos Líquidos:</span>
                  <span className="text-[10px] text-slate-500 font-normal">regras integradas</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Bloco Dinheiro */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <div className="flex justify-between font-bold text-emerald-900">
                      <span>Vendas em Dinheiro:</span>
                      <span>{formatCurrency(selectedClosure.cashIn)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 text-[11px]">
                      <span>Saídas em Dinheiro:</span>
                      <span>- {formatCurrency(selectedClosure.expensesCash || 0)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 text-[11px]">
                      <span>Vales em Dinheiro:</span>
                      <span>- {formatCurrency(selectedClosure.valesCash || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-emerald-200 font-bold text-emerald-950">
                      <span>Saldo Líquido Dinheiro:</span>
                      <span>
                        {formatCurrency(
                          selectedClosure.netCash !== undefined
                            ? selectedClosure.netCash
                            : (selectedClosure.cashIn || 0) - (selectedClosure.expensesCash || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Bloco Pix */}
                  <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 space-y-1">
                    <div className="flex justify-between font-bold text-teal-900">
                      <span>Vendas via Pix:</span>
                      <span>{formatCurrency(selectedClosure.pixIn)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 text-[11px]">
                      <span>Saídas via Pix:</span>
                      <span>- {formatCurrency(selectedClosure.expensesPix || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-teal-200 font-bold text-teal-950">
                      <span>Saldo Líquido Pix:</span>
                      <span>
                        {formatCurrency(
                          selectedClosure.netPix !== undefined
                            ? selectedClosure.netPix
                            : (selectedClosure.pixIn || 0) - (selectedClosure.expensesPix || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-rose-800">
                    <span>Total Geral de Saídas (Dinheiro + Pix + Vales):</span>
                    <span>
                      - {formatCurrency(
                        (selectedClosure.expensesCash || 0) +
                        (selectedClosure.expensesPix || 0) +
                        (selectedClosure.valesCash || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-indigo-900">
                    <span>Movimento Líquido Total:</span>
                    <span>
                      {formatCurrency(
                        selectedClosure.netTotal !== undefined
                          ? selectedClosure.netTotal
                          : selectedClosure.totalSales -
                            ((selectedClosure.expensesCash || 0) +
                             (selectedClosure.expensesPix || 0) +
                             (selectedClosure.valesCash || 0))
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Saídas de Caixa Registradas deste Expediente */}
              {cashWithdrawals.filter(
                (w) =>
                  w.date === selectedClosure.date &&
                  w.cashierName.trim().toLowerCase() === selectedClosure.cashierName.trim().toLowerCase()
              ).length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center justify-between text-[11px]">
                    <span>Saídas Registradas neste Caixa / Data:</span>
                    <span className="text-[10px] text-slate-500">
                      {
                        cashWithdrawals.filter(
                          (w) =>
                            w.date === selectedClosure.date &&
                            w.cashierName.trim().toLowerCase() === selectedClosure.cashierName.trim().toLowerCase()
                        ).length
                      }{' '}
                      lançamento(s)
                    </span>
                  </h4>
                  <div className="divide-y divide-slate-200/60 max-h-36 overflow-y-auto pr-1">
                    {cashWithdrawals
                      .filter(
                        (w) =>
                          w.date === selectedClosure.date &&
                          w.cashierName.trim().toLowerCase() === selectedClosure.cashierName.trim().toLowerCase()
                      )
                      .map((w) => (
                        <div key={w.id} className="py-1.5 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-800">{w.reason}</span>
                            <span className="text-slate-400 text-[10px] ml-2">
                              {w.time} ({w.paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Pix'})
                            </span>
                          </div>
                          <span className={`font-bold ${w.status === 'cancelled' ? 'line-through text-slate-400' : 'text-rose-700'}`}>
                            {formatCurrency(w.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Saldo Esperado em Dinheiro no Caixa:</span>
                  <strong className="text-white text-sm">{formatCurrency(selectedClosure.expectedCash)}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Dinheiro Contado na Gaveta:</span>
                  <strong className="text-amber-300 text-sm">{formatCurrency(selectedClosure.countedCash)}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold">
                  <span>Diferença de Caixa:</span>
                  <span
                    className={`text-sm ${
                      selectedClosure.cashDifference === 0
                        ? 'text-emerald-400'
                        : selectedClosure.cashDifference > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {selectedClosure.cashDifference === 0
                      ? 'Exato (R$ 0,00)'
                      : selectedClosure.cashDifference > 0
                      ? `Sobra de ${formatCurrency(selectedClosure.cashDifference)}`
                      : `Falta de ${formatCurrency(Math.abs(selectedClosure.cashDifference))}`}
                  </span>
                </div>
              </div>

              {selectedClosure.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 italic">
                  "{selectedClosure.notes}"
                </div>
              )}

              {selectedClosure.reopenedReason && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                  <strong>Histórico de Reabertura:</strong> Reaberto por {selectedClosure.reopenedBy} em{' '}
                  {formatDateTimeBR(selectedClosure.reopenedAt)} com motivo: "{selectedClosure.reopenedReason}"
                </div>
              )}

            </div>

            {/* Botões do Modal de Detalhes - Docked Footer */}
            <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const doc = generateClosurePDF(selectedClosure);
                    printPDF(doc);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 flex items-center gap-1.5 transition text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Comprovante</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const toDelete = selectedClosure;
                    setSelectedClosure(null);
                    setClosureToDelete(toDelete);
                    setDeleteReason('');
                  }}
                  className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-rose-700 flex items-center gap-1.5 transition text-xs cursor-pointer"
                  title="Excluir este fechamento de caixa"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Excluir Fechamento</span>
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const doc = generateClosurePDF(selectedClosure);
                  await downloadOrSharePDF(
                    doc,
                    `Fechamento_${selectedClosure.date}.pdf`,
                    `Fechamento ${formatDateBR(selectedClosure.date)}`
                  );
                }}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold flex items-center gap-1.5 transition text-xs cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Baixar / Compartilhar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR SAÍDA DE CAIXA (NOVA OPÇÃO ILIMITADA) */}
      {isWithdrawalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-800 to-rose-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-rose-200" />
                  Registrar Saída de Caixa
                </h3>
                <p className="text-[11px] sm:text-xs text-rose-200 mt-0.5">
                  Lançamento de despesa ou retirada durante o expediente
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawalModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain pb-16 sm:pb-6">
                {isTodayCashierClosed && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <strong className="block font-semibold">Caixa de Hoje Fechado</strong>
                      O caixa desta data já foi encerrado. Novos lançamentos só devem ser feitos após reabertura administrativa autorizada.
                    </div>
                  </div>
                )}

                {withdrawalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{withdrawalError}</span>
                  </div>
                )}

                {/* Motivo da Saída (Obrigatório) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Motivo da Saída *
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    placeholder="Ex: Pagamento de entregador, gelo, pão, frete, material de limpeza..."
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none text-slate-900"
                  />
                </div>

                {/* Valor (R$) Obrigatório */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor da Saída (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-black text-rose-700">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={withdrawalAmountStr}
                      onChange={(e) => setWithdrawalAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Forma de Pagamento: Dinheiro ou Pix */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Forma de Pagamento da Saída *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setWithdrawalPaymentMethod('dinheiro')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                        withdrawalPaymentMethod === 'dinheiro'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <DollarSign className={`w-4 h-4 ${withdrawalPaymentMethod === 'dinheiro' ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <div>Dinheiro Físico</div>
                        <span className="text-[10px] font-normal text-slate-500 block">Desconta do caixa</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawalPaymentMethod('pix')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                        withdrawalPaymentMethod === 'pix'
                          ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <QrCode className={`w-4 h-4 ${withdrawalPaymentMethod === 'pix' ? 'text-teal-700' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <div>Via Pix</div>
                        <span className="text-[10px] font-normal text-slate-500 block">Desconta do Pix</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Informações Automáticas de Sistema */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Data e Horário:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatDateBR(getTodayDateBR())} (preenchido no envio)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1 text-[11px]">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Responsável pelo Lançamento:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {currentUser?.displayName || currentUser?.username || 'Usuário Atual'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-[11px]">Caixa / Operador:</span>
                    <span className="font-semibold text-slate-800">
                      {withdrawalCashier}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <strong>Controle Independente:</strong> As saídas em dinheiro são abatidas do dinheiro físico da gaveta. As saídas via Pix são abatidas do faturamento de Pix. Ambas serão somadas automaticamente no fechamento diário do caixa.
                </div>
              </div>

              {/* Botões do Formulário - Docked at bottom, keyboard-safe */}
              <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsWithdrawalModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingWithdrawal}
                  className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:scale-95 text-white font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWithdrawal ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-rose-200" />
                      <span>Salvar Saída</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR SAÍDA DE CAIXA (COM JUSTIFICATIVA) */}
      {withdrawalToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-rose-100 p-5 sm:p-6 space-y-4 overflow-y-auto my-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancelar Saída de Caixa</h3>
                <p className="text-xs text-slate-500">Esta ação estorna a despesa e recalcula os valores</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Motivo:</span>
                <span className="font-bold text-slate-800">{withdrawalToCancel.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor:</span>
                <span className="font-bold text-rose-700">{formatCurrency(withdrawalToCancel.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <span className="font-semibold text-slate-800">
                  {withdrawalToCancel.paymentMethod === 'dinheiro' ? 'Dinheiro Físico' : 'Pix'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data e Horário:</span>
                <span className="text-slate-700">{formatDateBR(withdrawalToCancel.date)} às {withdrawalToCancel.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registrado por:</span>
                <span className="text-slate-700">{withdrawalToCancel.responsibleName}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmCancelWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Justificativa do Cancelamento *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelWithdrawalReason}
                  onChange={(e) => setCancelWithdrawalReason(e.target.value)}
                  placeholder="Ex: Lançamento duplicado por engano, valor digitado incorretamente..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWithdrawalToCancel(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isCancellingWithdrawal}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCancellingWithdrawal ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REABERTURA DE FECHAMENTO (ADMIN ONLY) */}
      {reopenModalClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 overflow-y-auto my-auto">
            <div className="flex items-center gap-2 text-amber-600">
              <Unlock className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Reabrir Fechamento</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está reabrindo o fechamento de <strong>{formatDateBR(reopenModalClosure.date)}</strong> ({reopenModalClosure.cashierName}). Por segurança contábil, é obrigatório registrar a justificativa.
            </p>

            <form onSubmit={handleReopen} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Justificativa da Reabertura *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Ex: Correção de lançamento de dinheiro físico contado incorretamente..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReopenModalClosure(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Confirmar Reabertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR FECHAMENTO INDIVIDUAL */}
      {closureToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-rose-100 p-5 sm:p-6 space-y-4 overflow-y-auto my-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Fechamento de Caixa</h3>
                <p className="text-xs text-slate-500">Esta ação remove o fechamento do sistema</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Data do Fechamento:</span>
                <span className="font-bold text-slate-800">{formatDateBR(closureToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável / Caixa:</span>
                <span className="font-semibold text-slate-800">{closureToDelete.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total de Vendas:</span>
                <span className="font-bold text-emerald-700">{formatCurrency(closureToDelete.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dinheiro Físico Contado:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(closureToDelete.countedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Saída Física (Despesas/Vales):</span>
                <span className="font-semibold text-rose-700">
                  {formatCurrency((closureToDelete.expensesCash || 0) + (closureToDelete.valesCash || 0))}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <strong>Atenção:</strong> O fechamento será excluído dos relatórios. Por integridade do sistema, seus saldos bancários cadastrados permanecerão intactos e independentes.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo da Exclusão (Opcional)
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex: Registro duplicado, erro de digitação de caixa..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setClosureToDelete(null);
                  setDeleteReason('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR HISTÓRICO DE FECHAMENTOS */}
      {isClearHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-rose-100 p-5 sm:p-6 space-y-4 overflow-y-auto my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Excluir Histórico de Fechamentos</h3>
                  <p className="text-xs text-slate-500">Limpeza seletiva ou total de registros de fechamento</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsClearHistoryModalOpen(false);
                  setHistoryConfirmationInput('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Selecione o critério para exclusão:</label>
              
              <div className="space-y-2">
                <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${historyDeleteType === 'all' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="historyDeleteType"
                    checked={historyDeleteType === 'all'}
                    onChange={() => setHistoryDeleteType('all')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Excluir Todos os Fechamentos</span>
                    <span className="text-[11px] text-slate-500">Remove todos os {closures.length} fechamentos cadastrados</span>
                  </div>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${historyDeleteType === 'beforeDate' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="historyDeleteType"
                    checked={historyDeleteType === 'beforeDate'}
                    onChange={() => setHistoryDeleteType('beforeDate')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div className="w-full">
                    <span className="text-xs font-bold text-slate-800 block">Excluir Fechamentos Anteriores ou Iguais a uma Data</span>
                    <span className="text-[11px] text-slate-500 block mb-2">Apaga fechamentos históricos até a data informada</span>
                    {historyDeleteType === 'beforeDate' && (
                      <input
                        type="date"
                        value={historyBeforeDate}
                        onChange={(e) => setHistoryBeforeDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                      />
                    )}
                  </div>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${historyDeleteType === 'range' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="historyDeleteType"
                    checked={historyDeleteType === 'range'}
                    onChange={() => setHistoryDeleteType('range')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div className="w-full">
                    <span className="text-xs font-bold text-slate-800 block">Excluir por Intervalo de Datas</span>
                    <span className="text-[11px] text-slate-500 block mb-2">Define data inicial e data final</span>
                    {historyDeleteType === 'range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          placeholder="Data inicial"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                        />
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
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
              <span>Fechamentos selecionados para exclusão:</span>
              <span className="font-bold text-sm bg-rose-200/80 px-2.5 py-0.5 rounded-lg">
                {closuresToClear.length} registro(s)
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Digite <span className="text-rose-700 font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={historyConfirmationInput}
                onChange={(e) => setHistoryConfirmationInput(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={() => {
                  setIsClearHistoryModalOpen(false);
                  setHistoryConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingHistory || closuresToClear.length === 0 || historyConfirmationInput.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleConfirmClearHistory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingHistory ? 'Excluindo...' : `Excluir ${closuresToClear.length} Fechamento(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
