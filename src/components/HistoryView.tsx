import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  getTodayDateBR,
} from '../utils/formatters';
import {
  History,
  FileSpreadsheet,
  Landmark,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Trash2,
  CheckCircle2,
  Printer,
  Share2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { DailyClosure, BankTransaction } from '../types';
import {
  generateClosurePDF,
  generateBankStatementPDF,
  generateConsolidatedBankStatementPDF,
  downloadOrSharePDF,
  printPDF
} from '../services/pdfReportService';

export const HistoryView: React.FC = () => {
  const {
    closures,
    expenses,
    vales,
    bankAccounts,
    bankTransactions,
    auditLogs,
    deleteClosure,
    deleteClosuresBatch,
    deleteBankTransaction,
    clearAuditHistory
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'fechamentos' | 'bancario' | 'auditoria'>('fechamentos');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal States
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [selectedClosure, setSelectedClosure] = useState<DailyClosure | null>(null);
  const [closureToDelete, setClosureToDelete] = useState<DailyClosure | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingClosure, setIsDeletingClosure] = useState(false);

  const [transactionToDelete, setTransactionToDelete] = useState<BankTransaction | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);

  // Clear History Modals
  const [isClearClosuresModalOpen, setIsClearClosuresModalOpen] = useState(false);
  const [closuresClearType, setClosuresClearType] = useState<'filtered' | 'all'>('filtered');

  const [isClearAuditModalOpen, setIsClearAuditModalOpen] = useState(false);
  const [auditClearType, setAuditClearType] = useState<'filtered' | 'all'>('filtered');

  const [confirmationInput, setConfirmationInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Filtered Closures
  const filteredClosures = useMemo(() => {
    return closures.filter((c) => {
      const matchSearch =
        c.cashierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStart = !startDate || c.date >= startDate;
      const matchEnd = !endDate || c.date <= endDate;
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchSearch && matchStart && matchEnd && matchStatus;
    });
  }, [closures, searchTerm, startDate, endDate, statusFilter]);

  // Bank Statement Filter States
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('all');
  const [bankTransTypeFilter, setBankTransTypeFilter] = useState<'all' | 'entrada' | 'saida' | 'transferencia'>('all');

  // Filtered Bank Transactions
  const filteredBankHistory = useMemo(() => {
    let list = bankTransactions.filter((t) => {
      const matchAccount = selectedBankAccountId === 'all' || t.accountId === selectedBankAccountId;
      const matchSearch =
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.documentNumber && t.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.responsibleName && t.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStart = !startDate || t.date >= startDate;
      const matchEnd = !endDate || t.date <= endDate;
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchAccount && matchSearch && matchStart && matchEnd && matchStatus;
    });

    if (bankTransTypeFilter === 'entrada') {
      list = list.filter((t) => t.amount > 0 && !t.type.includes('transferencia'));
    } else if (bankTransTypeFilter === 'saida') {
      list = list.filter((t) => t.amount < 0 && !t.type.includes('transferencia'));
    } else if (bankTransTypeFilter === 'transferencia') {
      list = list.filter((t) => t.type.includes('transferencia') || Boolean(t.relatedTransferId));
    }

    list.sort((a, b) => {
      const c = a.date.localeCompare(b.date);
      if (c !== 0) return c;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    return list;
  }, [bankTransactions, selectedBankAccountId, searchTerm, startDate, endDate, statusFilter, bankTransTypeFilter]);

  // Totals for bank statement view
  const bankHistoryTotals = useMemo(() => {
    const isSingleAccount = selectedBankAccountId !== 'all';
    const activeTrans = bankTransactions.filter(
      (t) =>
        t.status === 'active' &&
        !t.relatedClosureId &&
        t.category !== 'Saldo de Abertura' &&
        !t.id?.startsWith('bt_init_') &&
        (isSingleAccount ? t.accountId === selectedBankAccountId : true)
    );

    let initialBalance = 0;
    if (isSingleAccount) {
      const acc = bankAccounts.find((a) => a.id === selectedBankAccountId);
      const prior = activeTrans.filter((t) => startDate && t.date < startDate);
      initialBalance = (acc?.initialBalance || 0) + prior.reduce((a, b) => a + b.amount, 0);
    } else {
      const totalAccInitial = bankAccounts.reduce((a, b) => a + b.initialBalance, 0);
      const prior = activeTrans.filter((t) => startDate && t.date < startDate);
      initialBalance = totalAccInitial + prior.reduce((a, b) => a + b.amount, 0);
    }

    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalTransf = 0;

    filteredBankHistory.forEach((t) => {
      if (t.status !== 'active') return;
      const isInternal = t.type.includes('transferencia') || Boolean(t.relatedTransferId);

      if (!isSingleAccount && isInternal) {
        if (t.amount > 0) totalTransf += t.amount;
      } else {
        if (t.amount > 0) totalEntradas += t.amount;
        else if (t.amount < 0) totalSaidas += Math.abs(t.amount);
      }
    });

    const finalBalance = initialBalance + totalEntradas - totalSaidas;

    return {
      initialBalance,
      totalEntradas,
      totalSaidas,
      totalTransf,
      finalBalance,
      isSingleAccount,
    };
  }, [bankTransactions, bankAccounts, selectedBankAccountId, startDate, filteredBankHistory]);

  const filteredTransactions = filteredBankHistory;

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      const matchSearch =
        l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.userUsername || l.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.entityType.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStart = !startDate || l.createdAt.slice(0, 10) >= startDate;
      const matchEnd = !endDate || l.createdAt.slice(0, 10) <= endDate;

      return matchSearch && matchStart && matchEnd;
    });
  }, [auditLogs, searchTerm, startDate, endDate]);

  // Handler: Delete Single Closure
  const handleDeleteSingleClosure = async () => {
    if (!closureToDelete) return;
    setIsDeletingClosure(true);
    try {
      await deleteClosure(closureToDelete.id, deleteReason.trim() || 'Excluído no histórico');
      showToast(`Fechamento do dia ${formatDateBR(closureToDelete.date)} excluído com sucesso.`, 'success');
      setClosureToDelete(null);
      setDeleteReason('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir fechamento.', 'error');
    } finally {
      setIsDeletingClosure(false);
    }
  };

  // Handler: Batch Delete Closures
  const handleClearClosuresBatch = async () => {
    const list = closuresClearType === 'all' ? closures : filteredClosures;
    if (list.length === 0) return;
    if (confirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Digite EXCLUIR para confirmar a exclusão do histórico.', 'error');
      return;
    }
    setIsClearing(true);
    try {
      const ids = list.map((c) => c.id);
      await deleteClosuresBatch(ids, `Limpeza de histórico: ${ids.length} fechamentos excluídos`);
      showToast(`${ids.length} fechamento(s) excluído(s) do histórico.`, 'success');
      setIsClearClosuresModalOpen(false);
      setConfirmationInput('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir histórico de fechamentos.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Handler: Delete Bank Transaction
  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingTransaction(true);
    try {
      await deleteBankTransaction(transactionToDelete.id, 'Exclusão pelo usuário no extrato');
      showToast(`Movimentação "${transactionToDelete.description}" excluída.`, 'success');
      setTransactionToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir movimentação bancária.', 'error');
    } finally {
      setIsDeletingTransaction(false);
    }
  };

  // Handler: Clear Audit History
  const handleClearAuditHistory = async () => {
    const list = auditClearType === 'all' ? auditLogs : filteredAuditLogs;
    if (list.length === 0) return;
    if (confirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Digite EXCLUIR para confirmar a limpeza do histórico.', 'error');
      return;
    }
    setIsClearing(true);
    try {
      const ids = list.map((l) => l.id);
      await clearAuditHistory(ids);
      showToast(`Histórico de auditoria limpo (${ids.length} logs removidos).`, 'success');
      setIsClearAuditModalOpen(false);
      setConfirmationInput('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao limpar histórico de auditoria.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4 ${
          toastType === 'error' ? 'bg-red-700 text-white border border-red-800' : 'bg-emerald-800 text-white'
        }`}>
          {toastType === 'error' ? <AlertCircle className="w-5 h-5 text-red-200" /> : <CheckCircle2 className="w-5 h-5 text-amber-300" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Histórico Financeiro & Auditoria
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Rastreabilidade Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consulta detalhada de todos os fechamentos, extratos bancários e logs de operações.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('fechamentos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'fechamentos'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Fechamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('bancario')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bancario'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Extrato Bancário</span>
          </button>

          <button
            onClick={() => setActiveTab('auditoria')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auditoria'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rastreabilidade & Auditoria</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por palavra-chave..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
          />
        </div>

        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Data Inicial"
            className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-700"
          />
        </div>

        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Data Final"
            className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-700"
          />
        </div>

        <div className="flex gap-2">
          {activeTab !== 'auditoria' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-700 bg-white"
            >
              <option value="all">Todas as Situações</option>
              {activeTab === 'fechamentos' ? (
                <>
                  <option value="closed">Fechado</option>
                  <option value="reopened">Reaberto</option>
                </>
              ) : (
                <>
                  <option value="active">Ativo / Confirmado</option>
                  <option value="cancelled">Cancelado / Estornado</option>
                </>
              )}
            </select>
          )}

          {(searchTerm || startDate || endDate || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setStatusFilter('all');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-xs whitespace-nowrap"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* VIEW A: HISTÓRICO DE FECHAMENTOS */}
      {activeTab === 'fechamentos' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Visão A: Fechamentos de Caixa ({filteredClosures.length})
              </h2>
              <p className="text-xs text-slate-500">Histórico de conferência de caixas e controle interno</p>
            </div>
            {filteredClosures.length > 0 && (
              <button
                onClick={() => {
                  setClosuresClearType('filtered');
                  setConfirmationInput('');
                  setIsClearClosuresModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                title="Excluir histórico de fechamentos"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Excluir Histórico de Fechamentos</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Caixa</th>
                  <th className="py-3 px-4 text-right">Dinheiro Físico</th>
                  <th className="py-3 px-4 text-right">Pix</th>
                  <th className="py-3 px-4 text-right">Cartões</th>
                  <th className="py-3 px-4 text-right">Total Vendas</th>
                  <th className="py-3 px-4 text-right">Esperado</th>
                  <th className="py-3 px-4 text-right">Contado</th>
                  <th className="py-3 px-4 text-right">Saída Física</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Observações</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredClosures.length > 0 ? (
                  filteredClosures.map((cls) => {
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatDateBR(cls.date)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                          {cls.cashierName}
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
                        <td className="py-3 px-4 text-right font-bold text-emerald-800 whitespace-nowrap">
                          {formatCurrency(cls.totalSales)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                          {formatCurrency(cls.expectedCash)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(cls.countedCash)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap font-bold">
                          <span className="text-rose-600">
                            {formatCurrency((cls.expensesCash || 0) + (cls.valesCash || 0))}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cls.status === 'closed'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {cls.status === 'closed' ? 'Fechado' : 'Reaberto'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {cls.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Ver Detalhes */}
                            <button
                              onClick={() => setSelectedClosure(cls)}
                              className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                              title="Ver detalhes completos do fechamento"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Gerar PDF */}
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
                              title="Baixar PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Excluir Fechamento */}
                            <button
                              onClick={() => {
                                setClosureToDelete(cls);
                                setDeleteReason('');
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                              title="Excluir este fechamento"
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
                    <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum fechamento localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: HISTÓRICO BANCÁRIO AMPLIADO */}
      {activeTab === 'bancario' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header e Controles da Aba Bancária */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Extrato e Histórico Bancário
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {selectedBankAccountId === 'all'
                    ? 'Consolidado (Todos os Bancos)'
                    : bankAccounts.find((a) => a.id === selectedBankAccountId)?.name || 'Conta Específica'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedBankAccountId === 'all'
                  ? 'Visão consolidada de todas as contas. Transferências internas são tratadas neutralmente para não inflar receitas nem despesas.'
                  : 'Extrato estrito da conta selecionada com saldo e movimentações auditáveis.'}
              </p>
            </div>

            {/* Ações de Impressão e PDF */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const start = startDate || '2026-01-01';
                  const end = endDate || getTodayDateBR();

                  if (selectedBankAccountId === 'all') {
                    const doc = generateConsolidatedBankStatementPDF(
                      bankAccounts,
                      bankTransactions,
                      start,
                      end,
                      bankTransTypeFilter,
                      searchTerm
                    );
                    await downloadOrSharePDF(
                      doc,
                      `Extrato_Consolidado_Bancos_${start}_a_${end}.pdf`,
                      'Extrato Bancário Consolidado'
                    );
                  } else {
                    const acc = bankAccounts.find((a) => a.id === selectedBankAccountId) || bankAccounts[0];
                    if (!acc) return;
                    const doc = generateBankStatementPDF(
                      acc,
                      bankTransactions,
                      start,
                      end,
                      bankTransTypeFilter,
                      'all',
                      searchTerm
                    );
                    await downloadOrSharePDF(
                      doc,
                      `Extrato_${acc.name.replace(/\s+/g, '_')}_${start}_a_${end}.pdf`,
                      `Extrato Bancário - ${acc.name}`
                    );
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                title="Exportar extrato selecionado em PDF"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const start = startDate || '2026-01-01';
                  const end = endDate || getTodayDateBR();

                  if (selectedBankAccountId === 'all') {
                    const doc = generateConsolidatedBankStatementPDF(
                      bankAccounts,
                      bankTransactions,
                      start,
                      end,
                      bankTransTypeFilter,
                      searchTerm
                    );
                    printPDF(doc);
                  } else {
                    const acc = bankAccounts.find((a) => a.id === selectedBankAccountId) || bankAccounts[0];
                    if (!acc) return;
                    const doc = generateBankStatementPDF(
                      acc,
                      bankTransactions,
                      start,
                      end,
                      bankTransTypeFilter,
                      'all',
                      searchTerm
                    );
                    printPDF(doc);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                title="Imprimir extrato"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Filtros Bancários Específicos */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Seletor de Banco */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Selecionar Banco / Conta</label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 shadow-2xs"
              >
                <option value="all">Todos os Bancos (Consolidado)</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.bankName}){a.status === 'inactive' ? ' [Inativa]' : ''} — Saldo: {formatCurrency(a.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Tipo de Operação */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Tipo de Movimentação</label>
              <select
                value={bankTransTypeFilter}
                onChange={(e) => setBankTransTypeFilter(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
              >
                <option value="all">Todas (Entradas, Saídas e Transf.)</option>
                <option value="entrada">Apenas Entradas (+)</option>
                <option value="saida">Apenas Saídas (-)</option>
                <option value="transferencia">Apenas Transferências</option>
              </select>
            </div>

            {/* Período Informativo */}
            <div className="sm:col-span-2 flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Filtro de Período Geral Ativo</span>
                <span className="text-xs font-semibold text-slate-800">
                  {startDate ? formatDateBR(startDate) : 'Início dos registros'} até{' '}
                  {endDate ? formatDateBR(endDate) : 'Data atual'}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {filteredBankHistory.length} movimentação(ões)
              </span>
            </div>
          </div>

          {/* Cards de Métricas e Saldos do Extrato */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Anterior</span>
              <div className="text-base font-black text-slate-800 mt-0.5">
                {formatCurrency(bankHistoryTotals.initialBalance)}
              </div>
              <span className="text-[10px] text-slate-400 block">
                {startDate ? `Antes de ${formatDateBR(startDate)}` : 'Saldo de Abertura'}
              </span>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Entradas (+)</span>
              <div className="text-base font-black text-emerald-800 mt-0.5">
                +{formatCurrency(bankHistoryTotals.totalEntradas)}
              </div>
              <span className="text-[10px] text-emerald-600 block">
                {bankHistoryTotals.isSingleAccount ? 'Créditos na conta' : 'Receitas externas reais'}
              </span>
            </div>

            <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-800 block">Saídas (-)</span>
              <div className="text-base font-black text-rose-700 mt-0.5">
                -{formatCurrency(bankHistoryTotals.totalSaidas)}
              </div>
              <span className="text-[10px] text-rose-600 block">
                {bankHistoryTotals.isSingleAccount ? 'Débitos na conta' : 'Despesas externas reais'}
              </span>
            </div>

            {!bankHistoryTotals.isSingleAccount && (
              <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Transf. Internas</span>
                <div className="text-base font-black text-blue-900 mt-0.5">
                  {formatCurrency(bankHistoryTotals.totalTransf)}
                </div>
                <span className="text-[10px] text-blue-600 block">Sem duplicidade de faturamento</span>
              </div>
            )}

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-white col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Saldo Final</span>
              <div className="text-base font-black text-white mt-0.5">
                {formatCurrency(bankHistoryTotals.finalBalance)}
              </div>
              <span className="text-[10px] text-slate-400 block">
                {endDate ? `Em ${formatDateBR(endDate)}` : 'Disponível atual'}
              </span>
            </div>
          </div>

          {/* Tabela do Histórico Bancário */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4">Responsável / Doc</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBankHistory.length > 0 ? (
                  filteredBankHistory.map((tx) => {
                    const acc = bankAccounts.find((a) => a.id === tx.accountId);
                    const isCredit = tx.amount >= 0;
                    const isTransfer = tx.type.includes('transferencia') || Boolean(tx.relatedTransferId);

                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50/80 transition ${
                          tx.status === 'cancelled' ? 'opacity-60 bg-slate-50 line-through' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatDateBR(tx.date)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                          {acc ? acc.name : 'Conta'}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{tx.description}</span>
                            {isTransfer && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                                Transf. Interna
                              </span>
                            )}
                          </div>
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
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {tx.status === 'active' ? 'Ativo' : 'Cancelado/Estornado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          <div>{tx.responsibleName || 'Sistema'}</div>
                          {tx.documentNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Doc: {tx.documentNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setTransactionToDelete(tx)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 hover:text-rose-900 transition cursor-pointer"
                            title="Excluir movimentação bancária"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      Nenhuma movimentação bancária localizada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW C: RASTREABILIDADE & AUDITORIA */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Visão C: Trilha de Auditoria Geral ({filteredAuditLogs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Registros operacionais de quem criou, editou, cancelou ou reabriu cada operação financeira.
              </p>
            </div>
            {filteredAuditLogs.length > 0 && (
              <button
                onClick={() => {
                  setAuditClearType('filtered');
                  setConfirmationInput('');
                  setIsClearAuditModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                title="Limpar histórico de auditoria"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Limpar Histórico de Auditoria</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data e Hora</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Módulo</th>
                  <th className="py-3 px-4">Usuário Responsável</th>
                  <th className="py-3 px-4">Detalhamento da Operação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAuditLogs.length > 0 ? (
                  filteredAuditLogs.map((log) => {
                    const actionBadgeColor: Record<string, string> = {
                      create: 'bg-emerald-100 text-emerald-800',
                      update: 'bg-blue-100 text-blue-800',
                      cancel: 'bg-rose-100 text-rose-800',
                      reopen: 'bg-amber-100 text-amber-800',
                      settle: 'bg-teal-100 text-teal-800',
                      delete: 'bg-slate-100 text-slate-700',
                    };

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatDateTimeBR(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              actionBadgeColor[log.action] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 capitalize whitespace-nowrap">
                          {log.entityType.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {log.userUsername || log.userEmail || log.userUid}
                        </td>
                        <td className="py-3 px-4 text-slate-600 leading-relaxed">
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum registro de auditoria no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR FECHAMENTO INDIVIDUAL */}
      {closureToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Fechamento</h3>
                <p className="text-xs text-slate-500">Esta ação remove o fechamento do sistema</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Data:</span>
                <span className="font-bold text-slate-800">{formatDateBR(closureToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Caixa:</span>
                <span className="font-semibold text-slate-800">{closureToDelete.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Vendas:</span>
                <span className="font-bold text-emerald-700">{formatCurrency(closureToDelete.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contado:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(closureToDelete.countedCash)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <strong>Nota:</strong> O fechamento será excluído. As contas bancárias cadastradas permanecerão inalteradas e seguras.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo da Exclusão (Opcional)
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex: Lançamento teste / erro operacional"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingClosure}
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
                disabled={isDeletingClosure}
                onClick={handleDeleteSingleClosure}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingClosure ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR HISTÓRICO DE FECHAMENTOS (BATCH) */}
      {isClearClosuresModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Excluir Histórico de Fechamentos</h3>
                  <p className="text-xs text-slate-500">Exclusão em lote do histórico de fechamentos</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsClearClosuresModalOpen(false);
                  setConfirmationInput('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Selecione o escopo da exclusão:</label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${closuresClearType === 'filtered' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="closuresClearType"
                  checked={closuresClearType === 'filtered'}
                  onChange={() => setClosuresClearType('filtered')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Excluir Fechamentos Filtrados na Tela</span>
                  <span className="text-[11px] text-slate-500">Remove os {filteredClosures.length} fechamentos visíveis com base nos filtros atuais</span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${closuresClearType === 'all' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="closuresClearType"
                  checked={closuresClearType === 'all'}
                  onChange={() => setClosuresClearType('all')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Excluir Todos os Fechamentos do Sistema</span>
                  <span className="text-[11px] text-slate-500">Apaga completamente os {closures.length} fechamentos registrados</span>
                </div>
              </label>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Digite <span className="text-rose-700 font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => {
                  setIsClearClosuresModalOpen(false);
                  setConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isClearing ||
                  confirmationInput.trim().toUpperCase() !== 'EXCLUIR' ||
                  (closuresClearType === 'filtered' ? filteredClosures.length === 0 : closures.length === 0)
                }
                onClick={handleClearClosuresBatch}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isClearing
                    ? 'Excluindo...'
                    : `Excluir ${closuresClearType === 'all' ? closures.length : filteredClosures.length} Fechamento(s)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR MOVIMENTAÇÃO BANCÁRIA */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Movimentação Bancária</h3>
                <p className="text-xs text-slate-500">Remoção definitiva do extrato da conta</p>
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
                <span className="text-slate-500">Valor:</span>
                <span className={`font-bold ${transactionToDelete.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(transactionToDelete.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Categoria:</span>
                <span className="text-slate-700">{transactionToDelete.category}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <strong>Atenção:</strong> Ao excluir esta movimentação, o saldo da respectiva conta bancária será recalculado automaticamente pela fórmula oficial.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingTransaction}
                onClick={() => setTransactionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTransaction}
                onClick={handleDeleteTransaction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingTransaction ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIMPAR HISTÓRICO DE AUDITORIA */}
      {isClearAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Limpar Histórico de Auditoria</h3>
                  <p className="text-xs text-slate-500">Exclusão de registros de log do sistema</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsClearAuditModalOpen(false);
                  setConfirmationInput('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Selecione o escopo da limpeza:</label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${auditClearType === 'filtered' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="auditClearType"
                  checked={auditClearType === 'filtered'}
                  onChange={() => setAuditClearType('filtered')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Limpar Logs Filtrados na Tela</span>
                  <span className="text-[11px] text-slate-500">Remove os {filteredAuditLogs.length} logs visíveis</span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${auditClearType === 'all' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="auditClearType"
                  checked={auditClearType === 'all'}
                  onChange={() => setAuditClearType('all')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Limpar Todo o Histórico de Auditoria</span>
                  <span className="text-[11px] text-slate-500">Apaga todos os {auditLogs.length} registros</span>
                </div>
              </label>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Digite <span className="text-rose-700 font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => {
                  setIsClearAuditModalOpen(false);
                  setConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isClearing ||
                  confirmationInput.trim().toUpperCase() !== 'EXCLUIR' ||
                  (auditClearType === 'filtered' ? filteredAuditLogs.length === 0 : auditLogs.length === 0)
                }
                onClick={handleClearAuditHistory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isClearing
                    ? 'Limpando...'
                    : `Limpar ${auditClearType === 'all' ? auditLogs.length : filteredAuditLogs.length} Log(s)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES COMPLETOS DO FECHAMENTO */}
      {selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-300" />
                  <span>Fechamento de Caixa — {formatDateBR(selectedClosure.date)}</span>
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Operador(a): {selectedClosure.cashierName} • Registrado em {formatDateTimeBR(selectedClosure.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedClosure(null)}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Total Vendas</span>
                  <strong className="text-base font-black text-emerald-700">
                    {formatCurrency(selectedClosure.totalSales)}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Dinheiro Contado</span>
                  <strong className="text-base font-black text-slate-900">
                    {formatCurrency(selectedClosure.countedCash)}
                  </strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dinheiro Físico:</span>
                  <strong className="text-slate-800">{formatCurrency(selectedClosure.cashIn)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-700 font-medium">Pix Recebido:</span>
                  <strong className="text-teal-800">{formatCurrency(selectedClosure.pixIn)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-700 font-medium">Cartão de Crédito:</span>
                  <strong className="text-indigo-800">{formatCurrency(selectedClosure.creditCardIn)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-700 font-medium">Cartão de Débito:</span>
                  <strong className="text-indigo-800">{formatCurrency(selectedClosure.debitCardIn)}</strong>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200">
                  <span className="text-rose-600 font-bold">Saída Física (Despesas + Vales):</span>
                  <strong className="text-rose-600">
                    {formatCurrency((selectedClosure.expensesCash || 0) + (selectedClosure.valesCash || 0))}
                  </strong>
                </div>
              </div>

              {selectedClosure.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 italic">
                  "{selectedClosure.notes}"
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const doc = generateClosurePDF(selectedClosure);
                      printPDF(doc);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-1.5 transition text-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
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
                    title="Excluir este fechamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                  <span>Baixar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
