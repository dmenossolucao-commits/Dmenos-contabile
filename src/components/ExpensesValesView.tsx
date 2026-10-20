import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Expense, Vale, Boleto, BoletoStatus, ExpenseType, PaymentMethod, MoneySource } from '../types';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  getTodayDateBR,
  parseCurrencyInput
} from '../utils/formatters';
import {
  TrendingDown,
  UserCheck,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Building,
  CreditCard,
  Ban,
  Clock,
  Check,
  Landmark,
  Barcode,
  Copy,
  Trash2,
  BellRing,
  AlertCircle
} from 'lucide-react';

interface ExpensesValesViewProps {
  initialTab?: 'despesas' | 'vales' | 'boletos';
  initialOpenModal?: boolean;
}

const CATEGORIAS_DESPESAS = [
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

// Helper to compute due date status & urgency for Boletos
export function getBoletoDueInfo(dueDate: string, status: string): {
  diffDays: number;
  label: string;
  badgeClass: string;
  isUrgent: boolean;
  statusType: 'overdue' | 'today' | 'upcoming' | 'later' | 'paid' | 'cancelled';
} {
  if (status === 'pago') {
    return {
      diffDays: 0,
      label: 'Pago',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      isUrgent: false,
      statusType: 'paid',
    };
  }
  if (status === 'cancelado') {
    return {
      diffDays: 0,
      label: 'Cancelado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      isUrgent: false,
      statusType: 'cancelled',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dueDate.split('-').map(Number);
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      diffDays,
      label: `Vencido há ${overdueDays} dia${overdueDays > 1 ? 's' : ''}!`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      isUrgent: true,
      statusType: 'overdue',
    };
  }
  if (diffDays === 0) {
    return {
      diffDays: 0,
      label: 'VENCE HOJE!',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-black ring-2 ring-amber-400/50',
      isUrgent: true,
      statusType: 'today',
    };
  }
  if (diffDays <= 3) {
    return {
      diffDays,
      label: `Vence em ${diffDays} dia${diffDays > 1 ? 's' : ''}`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      isUrgent: false,
      statusType: 'upcoming',
    };
  }
  return {
    diffDays,
    label: `Vence em ${diffDays} dias`,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    isUrgent: false,
    statusType: 'later',
  };
}

export const ExpensesValesView: React.FC<ExpensesValesViewProps> = ({
  initialTab = 'despesas',
  initialOpenModal = false,
}) => {
  const {
    expenses,
    vales,
    boletos = [],
    bankAccounts,
    createExpense,
    cancelExpense,
    createVale,
    settleVale,
    cancelVale,
    createBoleto,
    payBoleto,
    cancelBoleto,
    deleteBoleto,
  } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'despesas' | 'vales' | 'boletos'>(initialTab);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(
    initialOpenModal && initialTab === 'despesas'
  );
  const [isValeModalOpen, setIsValeModalOpen] = useState(
    initialOpenModal && initialTab === 'vales'
  );
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(
    initialOpenModal && initialTab === 'boletos'
  );

  // Settlement & Cancellation Modals
  const [settlingVale, setSettlingVale] = useState<Vale | null>(null);
  const [settleMethod, setSettleMethod] = useState('Desconto no Pagamento/Folha');
  const [settleNotes, setSettleNotes] = useState('');

  const [cancellingExpense, setCancellingExpense] = useState<Expense | null>(null);
  const [cancellingVale, setCancellingVale] = useState<Vale | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Boleto Modals State
  const [payingBoleto, setPayingBoleto] = useState<Boleto | null>(null);
  const [payVia, setPayVia] = useState<'banco' | 'caixa'>('banco');
  const [payBankAccountId, setPayBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [payDate, setPayDate] = useState(getTodayDateBR());
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [cancellingBoleto, setCancellingBoleto] = useState<Boleto | null>(null);
  const [boletoCancelReason, setBoletoCancelReason] = useState('');

  const [deletingBoleto, setDeletingBoleto] = useState<Boleto | null>(null);
  const [boletoDeleteReason, setBoletoDeleteReason] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [boletoFilter, setBoletoFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'paid' | 'cancelled'>('all');

  // New Expense Form State
  const [expDate, setExpDate] = useState(getTodayDateBR());
  const [expDescription, setExpDescription] = useState('');
  const [expCategory, setExpCategory] = useState(CATEGORIAS_DESPESAS[0]);
  const [expAmountStr, setExpAmountStr] = useState('');
  const [expEntityName, setExpEntityName] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [expMoneySource, setExpMoneySource] = useState<MoneySource>('caixa');
  const [expBankAccountId, setExpBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [expNotes, setExpNotes] = useState('');

  // New Vale Form State
  const [valeEmployeeName, setValeEmployeeName] = useState('');
  const [valeAmountStr, setValeAmountStr] = useState('');
  const [valeDate, setValeDate] = useState(getTodayDateBR());
  const [valeMoneySource, setValeMoneySource] = useState<MoneySource>('caixa');
  const [valeBankAccountId, setValeBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [valeNotes, setValeNotes] = useState('');

  // New Boleto Form State
  const [bolDueDate, setBolDueDate] = useState(getTodayDateBR());
  const [bolBeneficiary, setBolBeneficiary] = useState('');
  const [bolDescription, setBolDescription] = useState('');
  const [bolCategory, setBolCategory] = useState(CATEGORIAS_DESPESAS[1] || 'Fornecedor');
  const [bolAmountStr, setBolAmountStr] = useState('');
  const [bolBarcode, setBolBarcode] = useState('');
  const [bolBankAccountId, setBolBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [bolNotes, setBolNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.entityName && e.entityName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [expenses, searchTerm, categoryFilter, statusFilter]);

  // Filtered Vales
  const filteredVales = useMemo(() => {
    return vales.filter((v) => {
      const matchSearch =
        v.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || v.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [vales, searchTerm, statusFilter]);

  // Boletos Breakdown & Alerts
  const boletosDueAnalysis = useMemo(() => {
    let overdueCount = 0;
    let overdueTotal = 0;
    let todayCount = 0;
    let todayTotal = 0;
    let upcomingCount = 0;
    let upcomingTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;

    boletos.forEach((b) => {
      const info = getBoletoDueInfo(b.dueDate, b.status);
      if (b.status === 'pago') {
        paidCount++;
        paidTotal += Number(b.paidAmount || b.amount);
      } else if (b.status === 'pendente') {
        if (info.statusType === 'overdue') {
          overdueCount++;
          overdueTotal += Number(b.amount);
        } else if (info.statusType === 'today') {
          todayCount++;
          todayTotal += Number(b.amount);
        } else if (info.statusType === 'upcoming') {
          upcomingCount++;
          upcomingTotal += Number(b.amount);
        }
      }
    });

    return {
      overdueCount,
      overdueTotal,
      todayCount,
      todayTotal,
      upcomingCount,
      upcomingTotal,
      paidCount,
      paidTotal,
      totalPendingAlerts: overdueCount + todayCount + upcomingCount,
    };
  }, [boletos]);

  // Filtered Boletos
  const filteredBoletos = useMemo(() => {
    return boletos.filter((b) => {
      const matchSearch =
        b.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.barcode && b.barcode.includes(searchTerm));

      const info = getBoletoDueInfo(b.dueDate, b.status);

      let matchFilter = true;
      if (boletoFilter === 'overdue') matchFilter = b.status === 'pendente' && info.statusType === 'overdue';
      else if (boletoFilter === 'today') matchFilter = b.status === 'pendente' && info.statusType === 'today';
      else if (boletoFilter === 'upcoming') matchFilter = b.status === 'pendente' && info.statusType === 'upcoming';
      else if (boletoFilter === 'paid') matchFilter = b.status === 'pago';
      else if (boletoFilter === 'cancelled') matchFilter = b.status === 'cancelado';

      return matchSearch && matchFilter;
    });
  }, [boletos, searchTerm, boletoFilter]);

  // Totals
  const totalDespesasAtivas = useMemo(() => {
    return expenses
      .filter((e) => e.status !== 'cancelled')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const totalValesPendentes = useMemo(() => {
    return vales
      .filter((v) => v.status === 'pendente')
      .reduce((sum, v) => sum + v.amount, 0);
  }, [vales]);

  const totalValesQuitados = useMemo(() => {
    return vales
      .filter((v) => v.status === 'quitado')
      .reduce((sum, v) => sum + v.amount, 0);
  }, [vales]);

  // Submit Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyInput(expAmountStr);
    if (amount <= 0) {
      alert('Informe um valor válido para a despesa.');
      return;
    }
    if (!expDescription.trim()) {
      alert('Informe uma descrição clara para a despesa.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedAcc = bankAccounts.find((a) => a.id === expBankAccountId);
      await createExpense({
        date: expDate,
        type: 'despesa',
        description: expDescription.trim(),
        category: expCategory,
        amount,
        entityName: expEntityName.trim() || undefined,
        paymentMethod: expPaymentMethod,
        moneySource: expMoneySource,
        bankAccountId: expMoneySource === 'banco' ? expBankAccountId : undefined,
        bankAccountName: expMoneySource === 'banco' && selectedAcc ? selectedAcc.name : undefined,
        notes: expNotes.trim() || undefined,
        status: 'active',
      });

      showToast('Despesa registrada com sucesso!');
      setIsExpenseModalOpen(false);
      setExpDescription('');
      setExpAmountStr('');
      setExpEntityName('');
      setExpNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Vale
  const handleCreateVale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyInput(valeAmountStr);
    if (amount <= 0) {
      alert('Informe um valor válido para o vale.');
      return;
    }
    if (!valeEmployeeName.trim()) {
      alert('Informe o nome do funcionário beneficiário.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedAcc = bankAccounts.find((a) => a.id === valeBankAccountId);
      await createVale({
        employeeName: valeEmployeeName.trim(),
        amount,
        date: valeDate,
        moneySource: valeMoneySource,
        bankAccountId: valeMoneySource === 'banco' ? valeBankAccountId : undefined,
        bankAccountName: valeMoneySource === 'banco' && selectedAcc ? selectedAcc.name : undefined,
        status: 'pendente',
        notes: valeNotes.trim() || undefined,
      });

      showToast('Vale registrado como PENDENTE com sucesso!');
      setIsValeModalOpen(false);
      setValeEmployeeName('');
      setValeAmountStr('');
      setValeNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar vale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Boleto
  const handleCreateBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyInput(bolAmountStr);
    if (amount <= 0) {
      alert('Informe um valor válido para o boleto.');
      return;
    }
    if (!bolBeneficiary.trim()) {
      alert('Informe o fornecedor ou beneficiário do boleto.');
      return;
    }
    if (!bolDescription.trim()) {
      alert('Informe a descrição do boleto.');
      return;
    }
    if (!bolDueDate) {
      alert('Informe a data de vencimento do boleto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedAcc = bankAccounts.find((a) => a.id === bolBankAccountId);
      await createBoleto({
        dueDate: bolDueDate,
        beneficiary: bolBeneficiary.trim(),
        description: bolDescription.trim(),
        amount,
        category: bolCategory,
        barcode: bolBarcode.trim() || undefined,
        bankAccountId: bolBankAccountId || undefined,
        bankAccountName: selectedAcc ? selectedAcc.name : undefined,
        notes: bolNotes.trim() || undefined,
      });

      showToast('Boleto lançado com aviso de vencimento ativado!');
      setIsBoletoModalOpen(false);
      setBolBeneficiary('');
      setBolDescription('');
      setBolAmountStr('');
      setBolBarcode('');
      setBolNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar boleto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Boleto Payment
  const handleConfirmPayBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBoleto) return;
    const amount = parseCurrencyInput(payAmountStr) || payingBoleto.amount;
    if (amount <= 0) {
      alert('Informe o valor pago.');
      return;
    }
    if (payVia === 'banco' && !payBankAccountId) {
      alert('Selecione a conta bancária de saída.');
      return;
    }

    setIsSubmitting(true);
    try {
      await payBoleto(payingBoleto.id, {
        paidDate: payDate,
        paidAmount: amount,
        paidVia: payVia,
        paidBankAccountId: payVia === 'banco' ? payBankAccountId : undefined,
        notes: payNotes.trim() || undefined,
      });

      showToast(`Boleto de ${payingBoleto.beneficiary} quitado com sucesso!`);
      setPayingBoleto(null);
      setPayNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar pagamento do boleto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Cancel Boleto
  const handleConfirmCancelBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBoleto) return;
    if (!boletoCancelReason.trim()) {
      alert('Informe o motivo do cancelamento do boleto.');
      return;
    }

    try {
      await cancelBoleto(cancellingBoleto.id, boletoCancelReason.trim());
      showToast('Boleto cancelado com sucesso.');
      setCancellingBoleto(null);
      setBoletoCancelReason('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar boleto.');
    }
  };

  // Confirm Delete Boleto
  const handleConfirmDeleteBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingBoleto) return;

    try {
      await deleteBoleto(deletingBoleto.id, boletoDeleteReason.trim() || undefined);
      showToast('Boleto excluído com sucesso.');
      setDeletingBoleto(null);
      setBoletoDeleteReason('');
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir boleto.');
    }
  };

  // Copy Barcode Helper
  const handleCopyBarcode = (code: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      showToast('Código de barras copiado para a área de transferência!');
    }
  };

  // Confirm Settle Vale
  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingVale) return;
    try {
      await settleVale(settlingVale.id, settleMethod, settleNotes.trim());
      showToast(`Vale de ${settlingVale.employeeName} marcado como quitado!`);
      setSettlingVale(null);
      setSettleNotes('');
    } catch (err: any) {
      alert(err.message || 'Erro ao quitar vale.');
    }
  };

  // Confirm Cancel Expense
  const handleConfirmCancelExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingExpense) return;
    if (!cancellationReason.trim()) {
      alert('Por favor, informe a justificativa do cancelamento/estorno.');
      return;
    }
    try {
      await cancelExpense(cancellingExpense.id, cancellationReason.trim());
      showToast('Despesa cancelada e estornada com sucesso.');
      setCancellingExpense(null);
      setCancellationReason('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar despesa.');
    }
  };

  // Confirm Cancel Vale
  const handleConfirmCancelVale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingVale) return;
    if (!cancellationReason.trim()) {
      alert('Por favor, informe a justificativa do cancelamento.');
      return;
    }
    try {
      await cancelVale(cancellingVale.id, cancellationReason.trim());
      showToast('Vale cancelado com sucesso.');
      setCancellingVale(null);
      setCancellationReason('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar vale.');
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

      {/* Top Banner and Summary Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Saídas: Despesas, Vales & Boletos
            </h1>
            {boletosDueAnalysis.totalPendingAlerts > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                <BellRing className="w-3 h-3 text-rose-600 animate-bounce" />
                {boletosDueAnalysis.totalPendingAlerts} boleto(s) em alerta
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de despesas operacionais, adiantamentos de funcionários e boletos bancários com aviso de vencimento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'boletos' ? (
            <button
              onClick={() => setIsBoletoModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Lançar Novo Boleto</span>
            </button>
          ) : activeTab === 'despesas' ? (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Registrar Despesa</span>
            </button>
          ) : (
            <button
              onClick={() => setIsValeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Lançar Novo Vale</span>
            </button>
          )}
        </div>
      </div>

      {/* Highlights Grid */}
      {activeTab === 'boletos' ? (
        /* BOLETOS HIGHLIGHTS & AVISOS DE VENCIMENTO */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vencidos */}
          <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-rose-700 block uppercase tracking-wider">
                  🔴 Boletos Vencidos
                </span>
                <div className="text-xl font-black text-rose-600 mt-1">
                  {formatCurrency(boletosDueAnalysis.overdueTotal)}
                </div>
                <span className="text-[11px] text-rose-600/80 mt-0.5 block font-semibold">
                  {boletosDueAnalysis.overdueCount} boleto(s) em atraso
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Vence Hoje */}
          <div className="p-4 rounded-2xl bg-white border border-amber-300 shadow-xs relative overflow-hidden ring-2 ring-amber-400/20">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-amber-800 block uppercase tracking-wider">
                  🟠 Vence Hoje
                </span>
                <div className="text-xl font-black text-amber-900 mt-1">
                  {formatCurrency(boletosDueAnalysis.todayTotal)}
                </div>
                <span className="text-[11px] text-amber-800/90 mt-0.5 block font-semibold">
                  {boletosDueAnalysis.todayCount} boleto(s) vencendo hoje
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <BellRing className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Vencem em até 3 Dias */}
          <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-blue-700 block uppercase tracking-wider">
                  🟡 Próximos 3 Dias
                </span>
                <div className="text-xl font-black text-blue-800 mt-1">
                  {formatCurrency(boletosDueAnalysis.upcomingTotal)}
                </div>
                <span className="text-[11px] text-blue-600 mt-0.5 block font-semibold">
                  {boletosDueAnalysis.upcomingCount} a vencer em breve
                </span>
              </div>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Pagos */}
          <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-emerald-800 block uppercase tracking-wider">
                  🟢 Boletos Pagos
                </span>
                <div className="text-xl font-black text-emerald-800 mt-1">
                  {formatCurrency(boletosDueAnalysis.paidTotal)}
                </div>
                <span className="text-[11px] text-emerald-700 mt-0.5 block font-semibold">
                  {boletosDueAnalysis.paidCount} boleto(s) liquidados
                </span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD DESPESAS / VALES HIGHLIGHTS */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 block">Total de Despesas Ativas</span>
            <div className="text-xl font-black text-rose-600 mt-1">
              {formatCurrency(totalDespesasAtivas)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {expenses.filter((e) => e.status !== 'cancelled').length} pagamentos registrados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs">
            <span className="text-xs font-semibold text-amber-700 block">Vales Pendentes de Quitação</span>
            <div className="text-xl font-black text-amber-600 mt-1">
              {formatCurrency(totalValesPendentes)}
            </div>
            <span className="text-[11px] text-amber-600/80 mt-1 block">
              {vales.filter((v) => v.status === 'pendente').length} vales aguardando acerto
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 block">Vales Já Quitados</span>
            <div className="text-xl font-black text-emerald-800 mt-1">
              {formatCurrency(totalValesQuitados)}
            </div>
            <span className="text-[11px] text-emerald-700/80 mt-1 block">
              {vales.filter((v) => v.status === 'quitado').length} vales quitados e acertados
            </span>
          </div>
        </div>
      )}

      {/* Tabs and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* 3 Tabs: Despesas, Vales, Boletos */}
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl self-start gap-1">
            <button
              onClick={() => setActiveTab('despesas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'despesas'
                  ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Despesas ({expenses.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('vales')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'vales'
                  ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Vales ({vales.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('boletos')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'boletos'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="w-3.5 h-3.5 text-amber-300" />
              <span>Boletos & Vencimentos ({boletos.length})</span>
              {boletosDueAnalysis.totalPendingAlerts > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {boletosDueAnalysis.totalPendingAlerts}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por fornecedor, descrição..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="p-2 text-slate-400 hover:text-slate-600"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {activeTab === 'boletos' ? (
            /* BOLETOS SUB-FILTERS */
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium mr-1">Filtrar por Vencimento:</span>
              <button
                onClick={() => setBoletoFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  boletoFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({boletos.length})
              </button>
              <button
                onClick={() => setBoletoFilter('overdue')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                  boletoFilter === 'overdue'
                    ? 'bg-rose-700 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <span>🔴 Vencidos ({boletosDueAnalysis.overdueCount})</span>
              </button>
              <button
                onClick={() => setBoletoFilter('today')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                  boletoFilter === 'today'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>🟠 Vence Hoje ({boletosDueAnalysis.todayCount})</span>
              </button>
              <button
                onClick={() => setBoletoFilter('upcoming')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                  boletoFilter === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <span>🟡 Próximos 3 Dias ({boletosDueAnalysis.upcomingCount})</span>
              </button>
              <button
                onClick={() => setBoletoFilter('paid')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                  boletoFilter === 'paid'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span>🟢 Pagos ({boletosDueAnalysis.paidCount})</span>
              </button>
            </div>
          ) : (
            /* DESPESAS / VALES FILTERS */
            <>
              {activeTab === 'despesas' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Categoria:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="p-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="all">Todas as Categorias</option>
                    {CATEGORIAS_DESPESAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Situação:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="all">Todas as Situações</option>
                  {activeTab === 'despesas' ? (
                    <>
                      <option value="active">Ativo (Confirmado)</option>
                      <option value="cancelled">Cancelado (Estornado)</option>
                    </>
                  ) : (
                    <>
                      <option value="pendente">Pendente de Quitação</option>
                      <option value="quitado">Quitado</option>
                      <option value="cancelado">Cancelado</option>
                    </>
                  )}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* VIEW 1: DESPESAS OPERACIONAIS */}
      {activeTab === 'despesas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Registros de Despesas ({filteredExpenses.length})
              </h2>
              <span className="text-xs text-slate-400">
                Pagamentos operacionais, compras de fornecedores e contas fixas
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Fornecedor / Favorecido</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Forma / Origem</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => {
                    const isCancelled = exp.status === 'cancelled';
                    return (
                      <tr
                        key={exp.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isCancelled ? 'opacity-60 bg-slate-50 line-through' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatDateBR(exp.date)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {exp.description}
                          {exp.notes && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {exp.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {exp.entityName || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          <span className="capitalize">{exp.paymentMethod}</span>
                          <span className="block text-[10px] text-slate-400">
                            {exp.moneySource === 'caixa'
                              ? 'Caixa Físico'
                              : exp.bankAccountName
                              ? `Conta: ${exp.bankAccountName}`
                              : 'Banco'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCancelled
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isCancelled ? 'Cancelado' : 'Confirmado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {!isCancelled && (
                            <button
                              onClick={() => {
                                setCancellingExpense(exp);
                                setCancellationReason('');
                              }}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                              title="Cancelar ou estornar despesa"
                            >
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Nenhuma despesa localizada com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: VALES DE FUNCIONÁRIOS */}
      {activeTab === 'vales' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Controle de Vales e Adiantamentos ({filteredVales.length})
              </h2>
              <span className="text-xs text-slate-400">
                Todo vale nasce como PENDENTE e só é liquidado quando você registrar a quitação
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Data Lançamento</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4 text-right">Valor do Vale</th>
                  <th className="py-3 px-4">Origem do Dinheiro</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4">Detalhes da Quitação</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVales.length > 0 ? (
                  filteredVales.map((vale) => {
                    const isPending = vale.status === 'pendente';
                    const isSettled = vale.status === 'quitado';
                    const isCancelled = vale.status === 'cancelado';

                    return (
                      <tr
                        key={vale.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isCancelled ? 'opacity-60 bg-slate-50 line-through' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatDateBR(vale.date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {vale.employeeName}
                          {vale.notes && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {vale.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                          {formatCurrency(vale.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {vale.moneySource === 'caixa'
                            ? 'Caixa Físico'
                            : vale.bankAccountName
                            ? `Conta: ${vale.bankAccountName}`
                            : 'Conta Bancária'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isSettled
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isPending ? 'Pendente' : isSettled ? 'Quitado' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {isSettled ? (
                            <div>
                              <span className="font-semibold text-slate-700 block">
                                {vale.settledMethod || 'Quitado'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {vale.settledDate && formatDateBR(vale.settledDate)}
                                {vale.settledBy && ` por ${vale.settledBy}`}
                              </span>
                            </div>
                          ) : isCancelled ? (
                            <span className="text-rose-600 italic">
                              Cancelado: {vale.cancellationReason || '—'}
                            </span>
                          ) : (
                            <span className="text-amber-700 italic">Aguardando acerto na folha</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPending && (
                              <button
                                onClick={() => {
                                  setSettlingVale(vale);
                                  setSettleMethod('Desconto no Pagamento/Folha');
                                  setSettleNotes('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 text-amber-300" />
                                <span>Quitar Vale</span>
                              </button>
                            )}

                            {!isCancelled && (
                              <button
                                onClick={() => {
                                  setCancellingVale(vale);
                                  setCancellationReason('');
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                                title="Cancelar vale"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum vale localizado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: BOLETOS BANCÁRIOS & AVISOS DE VENCIMENTO */}
      {activeTab === 'boletos' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Lançamento de Boletos com Aviso de Vencimento ({filteredBoletos.length})
              </h2>
              <span className="text-xs text-slate-400">
                Acompanhe prazos de contas a pagar, linhas digitáveis e avise com antecedência antes do vencimento
              </span>
            </div>

            <button
              onClick={() => setIsBoletoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
              <span>Novo Boleto</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-center">Aviso de Vencimento</th>
                  <th className="py-3 px-4">Fornecedor / Favorecido</th>
                  <th className="py-3 px-4">Descrição do Boleto</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Valor (R$)</th>
                  <th className="py-3 px-4">Linha Digitável / Código</th>
                  <th className="py-3 px-4">Previsão Conta</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBoletos.length > 0 ? (
                  filteredBoletos.map((bol) => {
                    const info = getBoletoDueInfo(bol.dueDate, bol.status);
                    const isPending = bol.status === 'pendente';
                    const isPaid = bol.status === 'pago';
                    const isCancelled = bol.status === 'cancelado';

                    return (
                      <tr
                        key={bol.id}
                        className={`hover:bg-slate-50/80 transition ${
                          info.isUrgent && isPending ? 'bg-amber-50/40' : ''
                        } ${isCancelled ? 'opacity-60 bg-slate-50 line-through' : ''}`}
                      >
                        {/* Data Vencimento */}
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {formatDateBR(bol.dueDate)}
                        </td>

                        {/* Aviso de Vencimento Visual Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] border ${info.badgeClass}`}
                          >
                            {info.label}
                          </span>
                        </td>

                        {/* Fornecedor */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {bol.beneficiary}
                        </td>

                        {/* Descrição */}
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {bol.description}
                          {bol.notes && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {bol.notes}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {bol.category}
                          </span>
                        </td>

                        {/* Valor */}
                        <td className="py-3 px-4 text-right font-black text-rose-600 whitespace-nowrap">
                          {formatCurrency(bol.amount)}
                        </td>

                        {/* Código de Barras / Linha Digitável */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {bol.barcode ? (
                            <div className="flex items-center gap-1.5">
                              <span className="max-w-[130px] truncate" title={bol.barcode}>
                                {bol.barcode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyBarcode(bol.barcode!)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                title="Copiar código do boleto"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Não informado</span>
                          )}
                        </td>

                        {/* Previsão Conta */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {bol.bankAccountName || 'A definir'}
                        </td>

                        {/* Situação */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isPaid
                              ? `Pago ${bol.paidDate ? formatDateBR(bol.paidDate) : ''}`
                              : isPending
                              ? 'Aguardando Pagamento'
                              : 'Cancelado'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Pagar Boleto */}
                            {isPending && (
                              <button
                                onClick={() => {
                                  setPayingBoleto(bol);
                                  setPayDate(getTodayDateBR());
                                  setPayAmountStr(bol.amount.toFixed(2));
                                  setPayVia('banco');
                                  setPayBankAccountId(bol.bankAccountId || bankAccounts[0]?.id || '');
                                  setPayNotes('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                                title="Registrar quitação deste boleto"
                              >
                                <Check className="w-3 h-3 text-amber-300" />
                                <span>Pagar Boleto</span>
                              </button>
                            )}

                            {/* Cancelar Boleto */}
                            {!isCancelled && !isPaid && (
                              <button
                                onClick={() => {
                                  setCancellingBoleto(bol);
                                  setBoletoCancelReason('');
                                }}
                                className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition cursor-pointer"
                                title="Cancelar boleto"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Excluir Boleto */}
                            <button
                              onClick={() => {
                                setDeletingBoleto(bol);
                                setBoletoDeleteReason('');
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                              title="Excluir este boleto"
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
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum boleto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NOVO BOLETO COM AVISO DE VENCIMENTO */}
      {isBoletoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900">
                  <Barcode className="w-5 h-5 text-emerald-800" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Lançar Boleto com Aviso de Vencimento
                  </h3>
                  <span className="text-xs text-slate-500">
                    O sistema avisará automaticamente no dia e na proximidade do vencimento
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsBoletoModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBoleto} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Data de Vencimento */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data de Vencimento *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      required
                      value={bolDueDate}
                      onChange={(e) => setBolDueDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-semibold text-slate-900"
                    />
                  </div>
                </div>

                {/* Valor */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor do Boleto (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={bolAmountStr}
                      onChange={(e) => setBolAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-black text-rose-600"
                    />
                  </div>
                </div>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fornecedor / Cedente / Beneficiário *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={bolBeneficiary}
                    onChange={(e) => setBolBeneficiary(e.target.value)}
                    placeholder="Ex: Ambev, Sabesp, Enel, Atacadão..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição da Conta / Produto *
                </label>
                <input
                  type="text"
                  required
                  value={bolDescription}
                  onChange={(e) => setBolDescription(e.target.value)}
                  placeholder="Ex: Compra de bebidas ref. NF 49102"
                  className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Categoria */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={bolCategory}
                    onChange={(e) => setBolCategory(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    {CATEGORIAS_DESPESAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Previsão de Conta Bancária */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Conta Prevista para Pagamento
                  </label>
                  <select
                    value={bolBankAccountId}
                    onChange={(e) => setBolBankAccountId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="">A definir na quitação</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha Digitável / Código de Barras */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Linha Digitável / Código de Barras (Opcional)
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={bolBarcode}
                    onChange={(e) => setBolBarcode(e.target.value)}
                    placeholder="Cole aqui o código de barras ou linha digitável (47 ou 48 dígitos)"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Permite copiar o código com 1 clique para pagar diretamente no aplicativo do banco.
                </span>
              </div>

              {/* Observações */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={bolNotes}
                  onChange={(e) => setBolNotes(e.target.value)}
                  placeholder="Informações adicionais, número de pedido ou instruções de pagamento..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBoletoModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Lançar Boleto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAGAR BOLETO */}
      {payingBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900">
                  <Check className="w-5 h-5 text-emerald-800" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Registrar Pagamento de Boleto
                  </h3>
                  <span className="text-xs text-slate-500">
                    {payingBoleto.beneficiary} — {payingBoleto.description}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPayingBoleto(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayBoleto} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Valor Original
                  </span>
                  <span className="text-lg font-black text-emerald-950">
                    {formatCurrency(payingBoleto.amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Vencimento
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {formatDateBR(payingBoleto.dueDate)}
                  </span>
                </div>
              </div>

              {/* Forma de Saída */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Origem do Pagamento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayVia('banco')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      payVia === 'banco'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Conta Bancária</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayVia('caixa')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      payVia === 'caixa'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Caixa Físico</span>
                  </button>
                </div>
              </div>

              {/* Conta Bancária (se banco) */}
              {payVia === 'banco' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Selecione a Conta Bancária de Saída *
                  </label>
                  <select
                    required
                    value={payBankAccountId}
                    onChange={(e) => setPayBankAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    O valor será debitado automaticamente no extrato bancário desta conta.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Data do Pagamento */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>

                {/* Valor Efetivamente Pago */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor Pago (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={payAmountStr}
                    onChange={(e) => setPayAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-rose-600"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações / Autenticação Bancária (Opcional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Ex: Comprovante 182749, pago via Pix / Internet Banking"
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingBoleto(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Confirmando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR BOLETO */}
      {cancellingBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Cancelar Boleto</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está cancelando o boleto de <strong>{cancellingBoleto.beneficiary}</strong> no valor de{' '}
              <strong>{formatCurrency(cancellingBoleto.amount)}</strong>.
            </p>

            <form onSubmit={handleConfirmCancelBoleto} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  required
                  rows={2}
                  value={boletoCancelReason}
                  onChange={(e) => setBoletoCancelReason(e.target.value)}
                  placeholder="Ex: Pedido cancelado, boleto reemitido..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingBoleto(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm cursor-pointer"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR BOLETO */}
      {deletingBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Excluir Boleto</h3>
            </div>
            <p className="text-xs text-slate-600">
              Tem certeza que deseja excluir permanentemente o boleto de{' '}
              <strong>{deletingBoleto.beneficiary}</strong> ({formatCurrency(deletingBoleto.amount)})?
              Esta ação removerá o registro do sistema.
            </p>

            <form onSubmit={handleConfirmDeleteBoleto} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo da Exclusão (Opcional)
                </label>
                <input
                  type="text"
                  value={boletoDeleteReason}
                  onChange={(e) => setBoletoDeleteReason(e.target.value)}
                  placeholder="Ex: Registro lançado incorretamente..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingBoleto(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA DESPESA */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Nova Despesa</h3>
                  <span className="text-xs text-slate-500">
                    Lançamento de contas pagas e compras de mercadorias
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data do Pagamento *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor Pago (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={expAmountStr}
                      onChange={(e) => setExpAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-bold text-rose-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ex: Compra de carne para reposição, Conta de Luz..."
                  className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fornecedor / Favorecido (Opcional)
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={expEntityName}
                      onChange={(e) => setExpEntityName(e.target.value)}
                      placeholder="Ex: Frigorífico Central"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    {CATEGORIAS_DESPESAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Origem do Dinheiro *
                  </label>
                  <select
                    value={expMoneySource}
                    onChange={(e) => setExpMoneySource(e.target.value as MoneySource)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="caixa">Caixa Físico (Dinheiro em Espécie)</option>
                    <option value="banco">Conta Bancária (Debita no Banco)</option>
                    <option value="outro">Outra Fonte</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="dinheiro">Dinheiro Físico</option>
                    <option value="pix">Pix</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="boleto">Boleto Bancário</option>
                  </select>
                </div>
              </div>

              {expMoneySource === 'banco' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Conta Bancária de Saída *
                  </label>
                  <select
                    required
                    value={expBankAccountId}
                    onChange={(e) => setExpBankAccountId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Número de nota fiscal, recibo ou detalhes..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO VALE */}
      {isValeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Lançar Novo Vale</h3>
                  <span className="text-xs text-slate-500">
                    Adiantamento concedido a funcionário (nasce PENDENTE)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsValeModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVale} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome do Funcionário *
                  </label>
                  <input
                    type="text"
                    required
                    value={valeEmployeeName}
                    onChange={(e) => setValeEmployeeName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor do Vale (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={valeAmountStr}
                      onChange={(e) => setValeAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-black text-amber-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data do Adiantamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={valeDate}
                    onChange={(e) => setValeDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Origem do Dinheiro *
                  </label>
                  <select
                    value={valeMoneySource}
                    onChange={(e) => setValeMoneySource(e.target.value as MoneySource)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="caixa">Caixa Físico</option>
                    <option value="banco">Conta Bancária (Pix/Transferência)</option>
                  </select>
                </div>
              </div>

              {valeMoneySource === 'banco' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Conta Bancária de Saída *
                  </label>
                  <select
                    required
                    value={valeBankAccountId}
                    onChange={(e) => setValeBankAccountId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={valeNotes}
                  onChange={(e) => setValeNotes(e.target.value)}
                  placeholder="Motivo do adiantamento ou previsão de acerto..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsValeModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Lançar Vale Pendente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUITAR VALE */}
      {settlingVale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <Check className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Quitar Vale de Funcionário</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está liquidando o vale de <strong>{settlingVale.employeeName}</strong> no valor de{' '}
              <strong>{formatCurrency(settlingVale.amount)}</strong>.
            </p>

            <form onSubmit={handleConfirmSettle} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Forma de Quitação / Acerto *
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="Desconto no Pagamento/Folha">Desconto no Pagamento / Salário</option>
                  <option value="Devolução em Dinheiro Físico">Devolução em Dinheiro Físico</option>
                  <option value="Devolução via Pix">Devolução via Pix</option>
                  <option value="Outro Acerto">Outro Acerto Autorizado</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações da Quitação (Opcional)
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Ex: Descontado no pagamento da primeira quinzena..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingVale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm"
                >
                  Confirmar Quitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR/ESTORNAR DESPESA */}
      {cancellingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Cancelar / Estornar Despesa</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está cancelando a despesa "{cancellingExpense.description}" no valor de{' '}
              <strong>{formatCurrency(cancellingExpense.amount)}</strong>. Se ela tiver debitado uma conta bancária, o valor será estornado na conta.
            </p>

            <form onSubmit={handleConfirmCancelExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ex: Lançamento duplicado, valor digitado errado..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingExpense(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm"
                >
                  Confirmar Estorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR VALE */}
      {cancellingVale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Cancelar Vale</h3>
            </div>
            <p className="text-xs text-slate-600">
              Informe a justificativa para o cancelamento do vale de{' '}
              <strong>{cancellingVale.employeeName}</strong>.
            </p>

            <form onSubmit={handleConfirmCancelVale} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ex: Registro incorreto..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingVale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
