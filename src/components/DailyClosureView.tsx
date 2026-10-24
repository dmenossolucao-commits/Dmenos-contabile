import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { DailyClosure, BankAllocation } from '../types';
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
  Trash2
} from 'lucide-react';

interface DailyClosureViewProps {
  initialOpenModal?: boolean;
  onCloseModal?: () => void;
}

export const DailyClosureView: React.FC<DailyClosureViewProps> = ({
  initialOpenModal = false,
  onCloseModal,
}) => {
  const { closures, bankAccounts, saveClosure, reopenClosure, updateClosure, deleteClosure, deleteClosuresBatch } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
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

  // Form Fields
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

  // Calculations
  const totalSales = useMemo(() => {
    return cashIn + pixIn + creditCardIn + debitCardIn + otherIn;
  }, [cashIn, pixIn, creditCardIn, debitCardIn, otherIn]);

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

  const resetForm = () => {
    setDate(getTodayDateBR());
    setCashierName(currentUser?.displayName || currentUser?.username || 'Caixa 1');
    setInitialCashStr('100,00');
    setCashInStr('');
    setPixInStr('');
    setCreditCardInStr('');
    setDebitCardInStr('');
    setOtherInStr('');
    setOtherInDescription('');
    setExpensesCashStr('');
    setValesCashStr('');
    setCountedCashStr('');
    setNotes('');
    setErrorMessage('');
  };

  const handleOpenNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleSubmitClosure = async (e: React.FormEvent) => {
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
        valesCash,
        countedCash,
        expectedCash,
        cashDifference,
        totalSales,
        status: 'closed',
        notes: notes.trim(),
        bankAllocations: allocations,
      });

      showToast('Fechamento de caixa gravado com sucesso no sistema!', 'success');
      setIsModalOpen(false);
      if (onCloseModal) onCloseModal();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao registrar fechamento.');
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
              {closures.length} registro(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle exato de dinheiro contado, saldo esperado, Pix e cartões por turno ou dia.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-amber-300" />
          <span>Registrar Novo Fechamento</span>
        </button>
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

      {/* MODAL: REGISTRAR NOVO FECHAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-300" />
                  Fechamento Diário de Caixa
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Informe as entradas e saídas físicas para cálculo automatizado de sobras/faltas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseModal) onCloseModal();
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClosure} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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

              {/* Saídas Pagas pelo Caixa Físico */}
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-3">
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                  Saídas Físicas Retiradas Diretamente do Caixa
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">
                      Despesas Pagas do Caixa (Gás, pão, frete, etc.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
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
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Conferência Automática em Tempo Real</span>
                  <span className="text-[11px] text-slate-400 lowercase">cálculos instantâneos</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Total Vendas</span>
                    <strong className="text-sm font-bold text-emerald-400">
                      {formatCurrency(totalSales)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Saldo Esperado</span>
                    <strong className="text-sm font-bold text-white">
                      {formatCurrency(expectedCash)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="block text-[10px] text-slate-400">Contado</span>
                    <strong className="text-sm font-bold text-amber-300">
                      {formatCurrency(countedCash)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl border bg-rose-950/80 border-rose-500/60 text-rose-300 shadow-xs">
                    <span className="block text-[10px] font-bold uppercase text-rose-200">
                      Saída Física
                    </span>
                    <strong className="text-sm font-black text-rose-300">
                      {formatCurrency(saidaFisica)}
                    </strong>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  • Saldo Esperado = R$ {initialCash.toFixed(2)} (inicial) + R$ {cashIn.toFixed(2)} (dinheiro) - R$ {expensesCash.toFixed(2)} (despesas) - R$ {valesCash.toFixed(2)} (vales). • Saída Física = R$ {saidaFisica.toFixed(2)} (despesas + vales pagos em dinheiro físico).
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

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-amber-300" />
                      <span>Salvar e Concluir Fechamento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES COMPLETOS DO FECHAMENTO */}
      {selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  Detalhes do Fechamento — {formatDateBR(selectedClosure.date)}
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Responsável: {selectedClosure.cashierName}
                </p>
              </div>
              <button
                onClick={() => setSelectedClosure(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1 text-rose-800">
                <div className="flex justify-between">
                  <span>Despesas pagas em dinheiro:</span>
                  <strong>- {formatCurrency(selectedClosure.expensesCash)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Vales pagos em dinheiro:</span>
                  <strong>- {formatCurrency(selectedClosure.valesCash)}</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Saldo Esperado em Dinheiro:</span>
                  <strong className="text-white text-sm">{formatCurrency(selectedClosure.expectedCash)}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Dinheiro Contado no Caixa:</span>
                  <strong className="text-amber-300 text-sm">{formatCurrency(selectedClosure.countedCash)}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold">
                  <span className="text-rose-400">
                    Saída Física (Despesas + Vales):
                  </span>
                  <span className="text-rose-400 text-sm">
                    {formatCurrency((selectedClosure.expensesCash || 0) + (selectedClosure.valesCash || 0))}
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

              {/* Botões do Modal de Detalhes */}
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
        </div>
      )}

      {/* MODAL: REABERTURA DE FECHAMENTO (ADMIN ONLY) */}
      {reopenModalClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-4">
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
