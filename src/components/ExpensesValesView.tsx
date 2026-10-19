import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Expense, Vale, ExpenseType, PaymentMethod, MoneySource } from '../types';
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
  Landmark
} from 'lucide-react';

interface ExpensesValesViewProps {
  initialTab?: 'despesas' | 'vales';
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

export const ExpensesValesView: React.FC<ExpensesValesViewProps> = ({
  initialTab = 'despesas',
  initialOpenModal = false,
}) => {
  const {
    expenses,
    vales,
    bankAccounts,
    createExpense,
    cancelExpense,
    createVale,
    settleVale,
    cancelVale,
  } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'despesas' | 'vales'>(initialTab);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(
    initialOpenModal && initialTab === 'despesas'
  );
  const [isValeModalOpen, setIsValeModalOpen] = useState(
    initialOpenModal && initialTab === 'vales'
  );

  // Settlement & Cancellation Modals
  const [settlingVale, setSettlingVale] = useState<Vale | null>(null);
  const [settleMethod, setSettleMethod] = useState('Desconto no Pagamento/Folha');
  const [settleNotes, setSettleNotes] = useState('');

  const [cancellingExpense, setCancellingExpense] = useState<Expense | null>(null);
  const [cancellingVale, setCancellingVale] = useState<Vale | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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

  // Totals
  const totalDespesasAtivas = useMemo(() => {
    return expenses
      .filter((e) => e.status !== 'cancelled')
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const totalValesPendentes = useMemo(() => {
    return vales
      .filter((v) => v.status === 'pendente')
      .reduce((acc, v) => acc + v.amount, 0);
  }, [vales]);

  const totalValesQuitados = useMemo(() => {
    return vales
      .filter((v) => v.status === 'quitado')
      .reduce((acc, v) => acc + v.amount, 0);
  }, [vales]);

  // Submit Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyInput(expAmountStr);
    if (amount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }
    if (!expDescription.trim()) {
      alert('Informe a descrição da despesa.');
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
        status: 'pendente', // NEVER automatically settled on creation
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
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Saídas: Despesas & Vales de Funcionários
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de contas pagas, compras de mercadorias, adiantamentos e quitação de vales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'despesas' ? (
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

      {/* Tabs and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start">
            <button
              onClick={() => setActiveTab('despesas')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'despesas'
                  ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Despesas Operacionais ({expenses.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('vales')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'vales'
                  ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Vales de Funcionários ({vales.length})</span>
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
                placeholder="Pesquisar por nome, descrição..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: DESPESAS OPERACIONAIS */}
        {activeTab === 'despesas' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Fornecedor / Pessoa</th>
                  <th className="py-3 px-4">Origem do Recurso</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50/80 transition ${
                        exp.status === 'cancelled' ? 'opacity-60 bg-slate-50/40 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatDateBR(exp.date)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {exp.description}
                        {exp.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Obs: {exp.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {exp.entityName || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <span className="capitalize font-medium">
                          {exp.moneySource === 'caixa' ? 'Dinheiro do Caixa' : exp.bankAccountName || 'Conta Bancária'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {exp.status === 'active' ? 'Ativa' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {exp.status === 'active' && (
                          <button
                            onClick={() => {
                              setCancellingExpense(exp);
                              setCancellationReason('');
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-800 transition"
                            title="Cancelar/Estornar Despesa"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Nenhuma despesa encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: VALES DE FUNCIONÁRIOS */}
        {activeTab === 'vales' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4">Quitação</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVales.length > 0 ? (
                  filteredVales.map((vale) => (
                    <tr
                      key={vale.id}
                      className={`hover:bg-slate-50/80 transition ${
                        vale.status === 'cancelado' ? 'opacity-60 bg-slate-50/40 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatDateBR(vale.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {vale.employeeName}
                        {vale.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Obs: {vale.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {vale.moneySource === 'caixa' ? 'Dinheiro do Caixa' : vale.bankAccountName || 'Banco'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-700 whitespace-nowrap">
                        {formatCurrency(vale.amount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            vale.status === 'quitado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : vale.status === 'pendente'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {vale.status === 'quitado'
                            ? 'Quitado'
                            : vale.status === 'pendente'
                            ? 'Pendente'
                            : 'Cancelado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {vale.status === 'quitado' ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {formatDateBR(vale.settledDate)}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {vale.settledMethod || 'Acertado'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-700 italic font-medium">Aguardando acerto</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {vale.status === 'pendente' && (
                            <button
                              onClick={() => {
                                setSettlingVale(vale);
                                setSettleNotes('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                              title="Marcar vale como Quitado / Acertado"
                            >
                              <Check className="w-3 h-3 text-amber-300" />
                              <span>Quitar</span>
                            </button>
                          )}

                          {vale.status === 'pendente' && (
                            <button
                              onClick={() => {
                                setCancellingVale(vale);
                                setCancellationReason('');
                              }}
                              className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition"
                              title="Cancelar Vale"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum vale encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NOVA DESPESA */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                  Registrar Saída / Despesa Operacional
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Informe a categoria e a origem real do dinheiro para integridade contábil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="text"
                    required
                    value={expAmountStr}
                    onChange={(e) => setExpAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-rose-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ex: Compra de sacolas plásticas, conta de luz, fornecedor refrigerante..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  >
                    {CATEGORIAS_DESPESAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fornecedor / Pessoa (Opcional)
                  </label>
                  <input
                    type="text"
                    value={expEntityName}
                    onChange={(e) => setExpEntityName(e.target.value)}
                    placeholder="Ex: Ambev, Distribuidora XYZ, Sabesp..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-900 block">Origem do Dinheiro e Forma de Pagamento</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">De onde saiu o dinheiro? *</label>
                    <select
                      value={expMoneySource}
                      onChange={(e) => setExpMoneySource(e.target.value as MoneySource)}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                    >
                      <option value="caixa">Dinheiro do Caixa (Físico)</option>
                      <option value="banco">Conta Bancária</option>
                      <option value="outro">Outra Origem</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Forma de Pagamento</label>
                    <select
                      value={expPaymentMethod}
                      onChange={(e) => setExpPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                    >
                      <option value="dinheiro">Dinheiro Físico</option>
                      <option value="pix">Pix</option>
                      <option value="debito">Cartão de Débito</option>
                      <option value="transferencia">Transferência Bancária</option>
                      <option value="boleto">Boleto Bancário</option>
                      <option value="credito">Cartão de Crédito</option>
                    </select>
                  </div>
                </div>

                {expMoneySource === 'banco' && bankAccounts.length > 0 && (
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">
                      Selecione a Conta Bancária debitada:
                    </label>
                    <select
                      value={expBankAccountId}
                      onChange={(e) => setExpBankAccountId(e.target.value)}
                      className="w-full p-2 rounded-xl border border-blue-200 bg-white text-slate-800 font-medium"
                    >
                      {bankAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.bankName}) — Saldo: {formatCurrency(a.currentBalance)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-blue-800 mt-1">
                      O saldo desta conta será atualizado automaticamente no módulo bancário, sem duplicar no caixa.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações (Opcional)</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Ex: Nota fiscal nº 1234, pago à vista com desconto..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO VALE */}
      {isValeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Lançar Vale de Funcionário
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Adiantamento financeiro com quitação separada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsValeModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVale} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do Funcionário *
                </label>
                <input
                  type="text"
                  required
                  value={valeEmployeeName}
                  onChange={(e) => setValeEmployeeName(e.target.value)}
                  placeholder="Ex: João Silva, Repositor Carlos..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={valeDate}
                    onChange={(e) => setValeDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor do Vale (R$) *</label>
                  <input
                    type="text"
                    required
                    value={valeAmountStr}
                    onChange={(e) => setValeAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-amber-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Origem do Dinheiro *</label>
                <select
                  value={valeMoneySource}
                  onChange={(e) => setValeMoneySource(e.target.value as MoneySource)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                >
                  <option value="caixa">Dinheiro Retirado do Caixa</option>
                  <option value="banco">Pix / Transferência Bancária</option>
                </select>
              </div>

              {valeMoneySource === 'banco' && bankAccounts.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conta Bancária</label>
                  <select
                    value={valeBankAccountId}
                    onChange={(e) => setValeBankAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-slate-800 font-medium"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações (Opcional)</label>
                <input
                  type="text"
                  value={valeNotes}
                  onChange={(e) => setValeNotes(e.target.value)}
                  placeholder="Ex: Adiantamento semanal, autorização da gerência..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Regra Contábil:</strong> O vale será gravado como <em>Pendente</em>. Ele não é considerado quitado automaticamente. A quitação é registrada apenas após acerto na folha de pagamento ou devolução.
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsValeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Registrar Vale
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
              <Check className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Quitar / Acertar Vale</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está quitando o vale de <strong>{settlingVale.employeeName}</strong> no valor de{' '}
              <strong className="text-emerald-800 font-bold">{formatCurrency(settlingVale.amount)}</strong>.
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
