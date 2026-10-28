import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import {
  formatCurrency,
  formatDateBR,
  getTodayDateBR
} from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Landmark,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Wallet,
  CreditCard,
  QrCode,
  BellRing,
  Barcode,
  Tag,
  UserCheck,
  NotebookPen
} from 'lucide-react';
import { getCategoryBadge } from './ExpensesValesView';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onNewClosure: () => void;
  onNewExpense: () => void;
  onNewVale: () => void;
  onNewBankTransaction: () => void;
}

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onNewClosure,
  onNewExpense,
  onNewVale,
  onNewBankTransaction,
}) => {
  const finance = useFinance() || {};
  const closures = Array.isArray(finance.closures) ? finance.closures : [];
  const expenses = Array.isArray(finance.expenses) ? finance.expenses : [];
  const vales = Array.isArray(finance.vales) ? finance.vales : [];
  const boletos = Array.isArray(finance.boletos) ? finance.boletos : [];
  const bankAccounts = Array.isArray(finance.bankAccounts) ? finance.bankAccounts : [];
  const bankTransactions = Array.isArray(finance.bankTransactions) ? finance.bankTransactions : [];
  const calendarNotes = Array.isArray(finance.calendarNotes) ? finance.calendarNotes : [];
  const notepadNotes = Array.isArray(finance.notepadNotes) ? finance.notepadNotes : [];
  const categories = Array.isArray(finance.categories) ? finance.categories : [];
  const { currentUser, isAdmin } = useAuth();

  const pendingNotepadCount = useMemo(() => {
    return notepadNotes.filter((n) => n.status === 'pendente').length;
  }, [notepadNotes]);

  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [dashboardCategoryTab, setDashboardCategoryTab] = useState<'despesas' | 'vales'>('despesas');

  // Boletos Due Date Alert for Dashboard
  const pendingBoletosAlert = useMemo(() => {
    const today = getTodayDateBR();
    const active = boletos.filter((b) => b.status === 'pendente');
    const overdue = active.filter((b) => b.dueDate < today);
    const dueToday = active.filter((b) => b.dueDate === today);
    const overdueTotal = overdue.reduce((sum, b) => sum + Number(b.amount), 0);
    const dueTodayTotal = dueToday.reduce((sum, b) => sum + Number(b.amount), 0);

    return {
      hasAlerts: overdue.length > 0 || dueToday.length > 0,
      overdueCount: overdue.length,
      overdueTotal,
      dueTodayCount: dueToday.length,
      dueTodayTotal,
      totalCount: overdue.length + dueToday.length,
    };
  }, [boletos]);

  // Compute date ranges based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayDateBR();

    if (period === 'day') {
      return { start: todayStr, end: todayStr, label: 'Hoje' };
    }
    if (period === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      const startStr = monday.toISOString().split('T')[0];
      return { start: startStr, end: todayStr, label: 'Esta Semana' };
    }
    if (period === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = firstDay.toISOString().split('T')[0];
      return { start: startStr, end: todayStr, label: 'Este Mês' };
    }
    // year
    const firstDayYear = new Date(now.getFullYear(), 0, 1);
    const startStr = firstDayYear.toISOString().split('T')[0];
    return { start: startStr, end: todayStr, label: 'Este Ano' };
  }, [period]);

  // Filter closures in period
  const periodClosures = useMemo(() => {
    return closures.filter((c) => c.date >= dateRange.start && c.date <= dateRange.end);
  }, [closures, dateRange]);

  // Filter expenses in period
  const periodExpenses = useMemo(() => {
    return expenses.filter(
      (e) => e.status !== 'cancelled' && e.date >= dateRange.start && e.date <= dateRange.end
    );
  }, [expenses, dateRange]);

  // Filter vales in period
  const periodVales = useMemo(() => {
    return vales.filter(
      (v) => v.status !== 'cancelado' && v.date >= dateRange.start && v.date <= dateRange.end
    );
  }, [vales, dateRange]);

  // Filter bank transactions in period
  const periodTransactions = useMemo(() => {
    return bankTransactions.filter(
      (t) => t.status === 'active' && t.date >= dateRange.start && t.date <= dateRange.end
    );
  }, [bankTransactions, dateRange]);

  // Financial aggregates
  const totalRecebidoPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + (Number(c?.totalSales) || 0), 0);
  }, [periodClosures]);

  const dinheiroFisicoPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + (Number(c?.cashIn) || 0), 0);
  }, [periodClosures]);

  const pixPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + (Number(c?.pixIn) || 0), 0);
  }, [periodClosures]);

  const cartoesPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + (Number(c?.creditCardIn) || 0) + (Number(c?.debitCardIn) || 0), 0);
  }, [periodClosures]);

  const outrasEntradasPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + (Number(c?.otherIn) || 0), 0);
  }, [periodClosures]);

  const totalDespesasPeriodo = useMemo(() => {
    return periodExpenses.reduce((acc, e) => acc + (Number(e?.amount) || 0), 0);
  }, [periodExpenses]);

  const totalValesPeriodo = useMemo(() => {
    return periodVales.reduce((acc, v) => acc + (Number(v?.amount) || 0), 0);
  }, [periodVales]);

  const valesPendentesTotal = useMemo(() => {
    return vales
      .filter((v) => v?.status === 'pendente')
      .reduce((acc, v) => acc + (Number(v?.amount) || 0), 0);
  }, [vales]);

  const totalSaldoBancario = useMemo(() => {
    return bankAccounts
      .filter((a) => a?.visibility !== 'private')
      .reduce((acc, a) => acc + (Number(a?.currentBalance) || 0), 0);
  }, [bankAccounts]);

  const entradasBancariasPeriodo = useMemo(() => {
    return periodTransactions
      .filter((t) => t?.visibility !== 'private' && (Number(t?.amount) || 0) > 0 && t?.type !== 'transferencia_entrada')
      .reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);
  }, [periodTransactions]);

  const saidasBancariasPeriodo = useMemo(() => {
    return periodTransactions
      .filter((t) => t?.visibility !== 'private' && (Number(t?.amount) || 0) < 0 && t?.type !== 'transferencia_saida')
      .reduce((acc, t) => acc + Math.abs(Number(t?.amount) || 0), 0);
  }, [periodTransactions]);

  // Latest closure
  const latestClosure = closures.length > 0 ? closures[0] : null;

  // Expected Cash in Drawer right now
  const saldoAtualCaixaFisico = latestClosure ? latestClosure.countedCash : 0;

  // Aggregates by Category for Expenses and Vales
  const expensesByCategory = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    for (const exp of periodExpenses) {
      const cat = exp.category?.trim() || 'Geral';
      if (!map[cat]) {
        map[cat] = { name: cat, amount: 0, count: 0 };
      }
      map[cat].amount += exp.amount;
      map[cat].count += 1;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [periodExpenses]);

  const valesByCategory = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    for (const v of periodVales) {
      const cat = v.category?.trim() || 'Adiantamento Quinzenal';
      if (!map[cat]) {
        map[cat] = { name: cat, amount: 0, count: 0 };
      }
      map[cat].amount += v.amount;
      map[cat].count += 1;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [periodVales]);

  // Upcoming Calendar Notes
  const upcomingNotes = useMemo(() => {
    const today = getTodayDateBR();
    return calendarNotes
      .filter((n) => n.status === 'pendente')
      .slice(0, 4);
  }, [calendarNotes]);

  return (
    <div className="space-y-6">
      {/* Welcome & Period Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Painel Financeiro
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {isAdmin ? 'Visão Administrador' : 'Visão Operacional'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mercadinho • Movimentações reais em tempo real
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          {(['day', 'week', 'month', 'year'] as PeriodFilter[]).map((p) => {
            const labels: Record<PeriodFilter, string> = {
              day: 'Hoje',
              week: 'Semana',
              month: 'Mês',
              year: 'Ano',
            };
            const active = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* AVISO DE VENCIMENTO DE BOLETOS NO DASHBOARD */}
      {pendingBoletosAlert.hasAlerts && (
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/10 border border-amber-300/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Aviso de Vencimento de Boletos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                  {pendingBoletosAlert.totalCount} pendência(s)
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                {pendingBoletosAlert.overdueCount > 0 && (
                  <span className="text-rose-700 font-bold mr-2">
                    🔴 {pendingBoletosAlert.overdueCount} vencido(s) ({formatCurrency(pendingBoletosAlert.overdueTotal)})
                  </span>
                )}
                {pendingBoletosAlert.dueTodayCount > 0 && (
                  <span className="text-amber-800 font-bold">
                    🟠 {pendingBoletosAlert.dueTodayCount} vence(m) hoje ({formatCurrency(pendingBoletosAlert.dueTodayTotal)})
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('despesas')}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Barcode className="w-4 h-4 text-amber-300" />
            <span>Ver Boletos</span>
          </button>
        </div>
      )}

      {/* Pending Notepad Notes Alert Banner */}
      {pendingNotepadCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950 flex items-center gap-2">
                Anotações Pendentes de Revisão
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingNotepadCount}
                </span>
              </h3>
              <p className="text-[11px] text-amber-800">
                Há anotações ou ocorrências aguardando parecer e conferência da gestão no Bloco de Notas.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('bloco_notas')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer transition shadow-2xs self-start sm:self-auto"
          >
            Abrir Bloco de Notas
          </button>
        </div>
      )}

      {/* Top Quick Actions Bar (Immediate access on mobile & desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onNewClosure}
          className="p-3 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition active:scale-[0.98] cursor-pointer border border-emerald-700/50"
        >
          <PlusCircle className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="truncate">Fechar Caixa</span>
        </button>

        <button
          onClick={onNewExpense}
          className="p-3 rounded-2xl bg-white hover:bg-slate-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs border border-rose-200/80 transition active:scale-[0.98] cursor-pointer"
        >
          <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="truncate">Nova Despesa</span>
        </button>

        <button
          onClick={onNewVale}
          className="p-3 rounded-2xl bg-white hover:bg-slate-50 text-amber-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs border border-amber-200/80 transition active:scale-[0.98] cursor-pointer"
        >
          <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">Lançar Vale</span>
        </button>

        <button
          onClick={onNewBankTransaction}
          className="p-3 rounded-2xl bg-white hover:bg-slate-50 text-blue-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs border border-blue-200/80 transition active:scale-[0.98] cursor-pointer"
        >
          <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Mov. Bancária</span>
        </button>
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo em Caixa Físico */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-5 rounded-2xl shadow-sm border border-emerald-800/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              Dinheiro Físico em Caixa
            </span>
            <div className="p-2 rounded-xl bg-emerald-800/80 text-amber-300 border border-amber-400/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {formatCurrency(saldoAtualCaixaFisico)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-200/90 pt-2 border-t border-emerald-800/60">
            <span>Última contagem</span>
            <span>{latestClosure ? formatDateBR(latestClosure.date) : 'Sem fechamento'}</span>
          </div>
        </div>

        {/* Card 2: Total Vendas / Recebido no Período */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Recebido ({dateRange.label})
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalRecebidoPeriodo)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{periodClosures.length} fechamento(s)</span>
            <span className="text-emerald-700 font-semibold">Vendas brutas</span>
          </div>
        </div>

        {/* Card 3: Despesas e Vales do Período */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Despesas & Vales ({dateRange.label})
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">
              {formatCurrency(totalDespesasPeriodo + totalValesPeriodo)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Desp: {formatCurrency(totalDespesasPeriodo)}</span>
            <span className="text-amber-700 font-semibold">Vales: {formatCurrency(totalValesPeriodo)}</span>
          </div>
        </div>

        {/* Card 4: Saldo Consolidado em Bancos */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Saldo Total Bancário
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Landmark className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalSaldoBancario)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{bankAccounts.length} conta(s) ativas</span>
            <button
              onClick={() => onNavigate('bancos')}
              className="text-blue-700 font-semibold hover:underline"
            >
              Ver contas →
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown by Payment Modality (Anti-Duplication Principle) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Detalhamento por Modalidade de Recebimento
            </h2>
            <p className="text-xs text-slate-500">
              Valores separados para evitar duplicidade entre dinheiro físico, Pix e operadoras de cartão.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            Total: {formatCurrency(totalRecebidoPeriodo)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold mb-1">
              <DollarSign className="w-4 h-4" />
              <span>Dinheiro Físico</span>
            </div>
            <div className="text-lg font-bold text-emerald-950">
              {formatCurrency(dinheiroFisicoPeriodo)}
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-1">
              {totalRecebidoPeriodo > 0
                ? `${((dinheiroFisicoPeriodo / totalRecebidoPeriodo) * 100).toFixed(1)}% do total`
                : '0%'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-100">
            <div className="flex items-center gap-2 text-teal-800 text-xs font-semibold mb-1">
              <QrCode className="w-4 h-4" />
              <span>Recebimentos Pix</span>
            </div>
            <div className="text-lg font-bold text-teal-950">
              {formatCurrency(pixPeriodo)}
            </div>
            <div className="text-[11px] text-teal-700/80 mt-1">
              {totalRecebidoPeriodo > 0
                ? `${((pixPeriodo / totalRecebidoPeriodo) * 100).toFixed(1)}% do total`
                : '0%'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
            <div className="flex items-center gap-2 text-indigo-800 text-xs font-semibold mb-1">
              <CreditCard className="w-4 h-4" />
              <span>Cartões (Crédito/Débito)</span>
            </div>
            <div className="text-lg font-bold text-indigo-950">
              {formatCurrency(cartoesPeriodo)}
            </div>
            <div className="text-[11px] text-indigo-700/80 mt-1">
              {totalRecebidoPeriodo > 0
                ? `${((cartoesPeriodo / totalRecebidoPeriodo) * 100).toFixed(1)}% do total`
                : '0%'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
              <Landmark className="w-4 h-4" />
              <span>Outras Entradas</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatCurrency(outrasEntradasPeriodo)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {totalRecebidoPeriodo > 0
                ? `${((outrasEntradasPeriodo / totalRecebidoPeriodo) * 100).toFixed(1)}% do total`
                : '0%'}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Despesas e Vales por Categoria */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-800" />
              <h2 className="text-base font-bold text-slate-900">
                Distribuição por Categoria
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de despesas e vales no período ({dateRange.label})
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Tab switch */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDashboardCategoryTab('despesas')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  dashboardCategoryTab === 'despesas'
                    ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Despesas</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-bold">
                  {expensesByCategory.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardCategoryTab('vales')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  dashboardCategoryTab === 'vales'
                    ? 'bg-white text-amber-950 shadow-xs border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Vales</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                  {valesByCategory.length}
                </span>
              </button>
            </div>

            <button
              onClick={() => onNavigate('despesas')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Abrir gerenciador de categorias"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Gerenciar</span>
            </button>
          </div>
        </div>

        {/* Content for Despesas tab */}
        {dashboardCategoryTab === 'despesas' && (
          <div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4 text-xs font-medium text-slate-700">
              <span>Total em despesas no período:</span>
              <span className="text-sm font-black text-rose-600">
                {formatCurrency(totalDespesasPeriodo)}
              </span>
            </div>

            {expensesByCategory.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  Nenhuma despesa registrada para o período selecionado ({dateRange.label}).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map((item) => {
                  const badge = getCategoryBadge(item.name, categories);
                  const pct = totalDespesasPeriodo > 0 ? (item.amount / totalDespesasPeriodo) * 100 : 0;
                  return (
                    <div key={item.name} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-50 transition">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 mr-2">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${badge.dot}`}
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content for Vales tab */}
        {dashboardCategoryTab === 'vales' && (
          <div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4 text-xs font-medium text-slate-700">
              <span>Total em vales no período:</span>
              <span className="text-sm font-black text-amber-700">
                {formatCurrency(totalValesPeriodo)}
              </span>
            </div>

            {valesByCategory.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  Nenhum vale registrado para o período selecionado ({dateRange.label}).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {valesByCategory.map((item) => {
                  const badge = getCategoryBadge(item.name, categories);
                  const pct = totalValesPeriodo > 0 ? (item.amount / totalValesPeriodo) * 100 : 0;
                  return (
                    <div key={item.name} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-50 transition">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 mr-2">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${badge.dot}`}
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column Section: Latest Closure Summary & Calendar Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: Resumo do Último Fechamento */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-800" />
                <h2 className="text-base font-bold text-slate-900">Último Fechamento Realizado</h2>
              </div>
              <button
                onClick={() => onNavigate('fechamento')}
                className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
              >
                Ver todos ({closures.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {latestClosure ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Data / Caixa</span>
                    <strong className="text-slate-800 font-semibold text-sm">
                      {formatDateBR(latestClosure.date)} — {latestClosure.cashierName}
                    </strong>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                      latestClosure.status === 'closed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {latestClosure.status === 'closed' ? 'Fechado' : 'Reaberto'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                    <span className="text-slate-400 block text-[10px]">Total de Vendas</span>
                    <strong className="text-slate-900 text-sm font-bold">
                      {formatCurrency(latestClosure.totalSales)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                    <span className="text-slate-400 block text-[10px]">Esperado em Dinheiro</span>
                    <strong className="text-slate-900 text-sm font-bold">
                      {formatCurrency(latestClosure.expectedCash)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                    <span className="text-slate-400 block text-[10px]">Contado no Caixa</span>
                    <strong className="text-slate-900 text-sm font-bold">
                      {formatCurrency(latestClosure.countedCash)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-rose-50/70 border-rose-200 text-rose-800">
                    <span className="block text-[10px] font-bold uppercase text-rose-700">
                      Saída Física
                    </span>
                    <strong className="text-sm font-bold text-rose-900">
                      {formatCurrency((latestClosure.expensesCash || 0) + (latestClosure.valesCash || 0))}
                    </strong>
                  </div>
                </div>

                {latestClosure.notes && (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    "{latestClosure.notes}"
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum fechamento registrado ainda. Clique no botão abaixo para abrir o primeiro.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            <button
              onClick={onNewClosure}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Fechamento de Caixa</span>
            </button>
          </div>
        </div>

        {/* Box 2: Próximas Anotações e Vencimentos (Calendário) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Próximos Compromissos & Contas
                </h2>
              </div>
              <button
                onClick={() => onNavigate('calendario')}
                className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
              >
                Abrir Calendário <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingNotes.length > 0 ? (
              <div className="space-y-2">
                {upcomingNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 transition"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{note.title}</h4>
                        {note.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {note.description}
                          </p>
                        )}
                        <span className="inline-block mt-1 text-[10px] text-slate-400 font-medium">
                          Data: {formatDateBR(note.date)} {note.time ? `às ${note.time}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 shrink-0">
                      {note.category}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum compromisso pendente no calendário.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Vales pendentes: <strong className="text-amber-700">{formatCurrency(valesPendentesTotal)}</strong>
            </span>
            <button
              onClick={() => onNavigate('despesas')}
              className="text-emerald-800 font-bold hover:underline"
            >
              Gerenciar Vales →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Bar for Daily Mercadinho Tasks */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-amber-300">Ações Rápidas do Dia a Dia</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Lançamentos imediatos com controle contra duplicidade de caixa e banco.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onNewExpense}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            <span>Lançar Despesa</span>
          </button>

          <button
            onClick={onNewVale}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>Lançar Vale</span>
          </button>

          <button
            onClick={onNewBankTransaction}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Landmark className="w-3.5 h-3.5 text-blue-400" />
            <span>Movimentação Bancária</span>
          </button>

          <button
            onClick={() => onNavigate('bloco_notas')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <NotebookPen className="w-3.5 h-3.5 text-amber-400" />
            <span>Bloco de Notas</span>
          </button>

          <button
            onClick={onNewClosure}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-emerald-950 font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Fechamento do Caixa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
