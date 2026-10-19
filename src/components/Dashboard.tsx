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
  QrCode
} from 'lucide-react';

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
  const { closures, expenses, vales, bankAccounts, bankTransactions, calendarNotes } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  const [period, setPeriod] = useState<PeriodFilter>('month');

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
    return periodClosures.reduce((acc, c) => acc + c.totalSales, 0);
  }, [periodClosures]);

  const dinheiroFisicoPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + c.cashIn, 0);
  }, [periodClosures]);

  const pixPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + c.pixIn, 0);
  }, [periodClosures]);

  const cartoesPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + c.creditCardIn + c.debitCardIn, 0);
  }, [periodClosures]);

  const outrasEntradasPeriodo = useMemo(() => {
    return periodClosures.reduce((acc, c) => acc + c.otherIn, 0);
  }, [periodClosures]);

  const totalDespesasPeriodo = useMemo(() => {
    return periodExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [periodExpenses]);

  const totalValesPeriodo = useMemo(() => {
    return periodVales.reduce((acc, v) => acc + v.amount, 0);
  }, [periodVales]);

  const valesPendentesTotal = useMemo(() => {
    return vales
      .filter((v) => v.status === 'pendente')
      .reduce((acc, v) => acc + v.amount, 0);
  }, [vales]);

  const totalSaldoBancario = useMemo(() => {
    return bankAccounts.reduce((acc, a) => acc + a.currentBalance, 0);
  }, [bankAccounts]);

  const entradasBancariasPeriodo = useMemo(() => {
    return periodTransactions
      .filter((t) => t.amount > 0 && t.type !== 'transferencia_entrada')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [periodTransactions]);

  const saidasBancariasPeriodo = useMemo(() => {
    return periodTransactions
      .filter((t) => t.amount < 0 && t.type !== 'transferencia_saida')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [periodTransactions]);

  // Latest closure
  const latestClosure = closures.length > 0 ? closures[0] : null;

  // Expected Cash in Drawer right now
  const saldoAtualCaixaFisico = latestClosure ? latestClosure.countedCash : 0;

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
