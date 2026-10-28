import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
  generateClosurePDF,
  generateClosuresReportPDF,
  generateExpensesReportPDF,
  generateBankStatementPDF,
  generateReceivablesReportPDF,
  generateConsolidatedReportPDF,
  downloadOrSharePDF,
  printPDF
} from '../services/pdfReportService';
import {
  formatCurrency,
  formatDateBR,
  getTodayDateBR
} from '../utils/formatters';
import {
  FileText,
  Printer,
  Share2,
  Download,
  Calendar,
  Landmark,
  TrendingDown,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare
} from 'lucide-react';

type ReportType =
  | 'fechamento_individual'
  | 'fechamentos_periodo'
  | 'despesas_vales'
  | 'extrato_bancario'
  | 'cartoes_recebiveis'
  | 'consolidado';

export const ReportsView: React.FC = () => {
  const { closures, expenses, vales, bankAccounts, bankTransactions, receivables, expenseCategories = [], valeCategories = [] } = useFinance();

  const [reportType, setReportType] = useState<ReportType>('fechamentos_periodo');
  const [selectedClosureId, setSelectedClosureId] = useState(closures[0]?.id || '');
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dates
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(getTodayDateBR());
  const [periodTitle, setPeriodTitle] = useState('Outubro / 2026');

  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Generate the active doc instance
  const getActiveDoc = () => {
    if (reportType === 'fechamento_individual') {
      const cls = closures.find((c) => c.id === selectedClosureId) || closures[0];
      if (!cls) throw new Error('Selecione um fechamento válido.');
      return {
        doc: generateClosurePDF(cls),
        filename: `Fechamento_${cls.date}.pdf`,
        title: `Fechamento de Caixa - ${formatDateBR(cls.date)}`,
      };
    }

    if (reportType === 'fechamentos_periodo') {
      const list = closures.filter((c) => c.date >= startDate && c.date <= endDate);
      return {
        doc: generateClosuresReportPDF(list, startDate, endDate),
        filename: `Relatorio_Fechamentos_${startDate}_a_${endDate}.pdf`,
        title: `Relatório de Fechamentos (${formatDateBR(startDate)} a ${formatDateBR(endDate)})`,
      };
    }

    if (reportType === 'despesas_vales') {
      let filteredExp = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
      let filteredVales = vales.filter((v) => v.date >= startDate && v.date <= endDate);
      if (categoryFilter !== 'all') {
        filteredExp = filteredExp.filter((e) => (e.category || '').toLowerCase() === categoryFilter.toLowerCase());
        filteredVales = filteredVales.filter((v) => (v.category || '').toLowerCase() === categoryFilter.toLowerCase());
      }
      return {
        doc: generateExpensesReportPDF(filteredExp, filteredVales, startDate, endDate),
        filename: `Relatorio_Despesas_Vales_${categoryFilter !== 'all' ? categoryFilter.replace(/\s+/g, '_') + '_' : ''}${startDate}_a_${endDate}.pdf`,
        title: `Relatório de Despesas e Vales (${formatDateBR(startDate)} a ${formatDateBR(endDate)})`,
      };
    }

    if (reportType === 'extrato_bancario') {
      const acc = bankAccounts.find((a) => a.id === selectedBankId) || bankAccounts[0];
      if (!acc) throw new Error('Selecione uma conta bancária cadastrada.');
      return {
        doc: generateBankStatementPDF(acc, bankTransactions, startDate, endDate),
        filename: `Extrato_${acc.name.replace(/\s+/g, '_')}_${startDate}_a_${endDate}.pdf`,
        title: `Extrato Bancário - ${acc.name}`,
      };
    }

    if (reportType === 'cartoes_recebiveis') {
      const filteredRec = receivables.filter((r) => r.date >= startDate && r.date <= endDate);
      return {
        doc: generateReceivablesReportPDF(filteredRec, startDate, endDate),
        filename: `Relatorio_Cartoes_${startDate}_a_${endDate}.pdf`,
        title: `Relatório de Cartões e Recebíveis`,
      };
    }

    // Consolidado da empresa (apenas contas compartilhadas)
    const filteredCls = closures.filter((c) => c.date >= startDate && c.date <= endDate);
    const filteredExp = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
    const filteredVales = vales.filter((v) => v.date >= startDate && v.date <= endDate);
    const sharedAccountsOnly = bankAccounts.filter((a) => a.visibility !== 'private');

    return {
      doc: generateConsolidatedReportPDF(periodTitle, filteredCls, filteredExp, filteredVales, sharedAccountsOnly),
      filename: `Relatorio_Consolidado_${periodTitle.replace(/\s+/g, '_')}.pdf`,
      title: `Relatório Consolidado - ${periodTitle}`,
    };
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const { doc, filename, title } = getActiveDoc();
      doc.save(filename);
      showToast('Relatório baixado em formato PDF!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar PDF.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    try {
      const { doc } = getActiveDoc();
      printPDF(doc);
    } catch (err: any) {
      showToast(err.message || 'Erro ao imprimir PDF.', 'error');
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const { doc, filename, title } = getActiveDoc();
      const res = await downloadOrSharePDF(doc, filename, title);
      if (res.shared) {
        showToast('Relatório compartilhado com sucesso!', 'success');
      } else if (res.downloaded) {
        showToast('Relatório salvo em PDF.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao compartilhar.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsAppShare = () => {
    // Generate WhatsApp text summary
    const totalVendas = closures
      .filter((c) => c.date >= startDate && c.date <= endDate)
      .reduce((acc, c) => acc + c.totalSales, 0);

    const totalDesp = expenses
      .filter((e) => e.status !== 'cancelled' && e.date >= startDate && e.date <= endDate)
      .reduce((acc, e) => acc + e.amount, 0);

    const text = encodeURIComponent(
      `*Dmenos Contro — Resumo Financeiro*\n` +
      `📅 Período: ${formatDateBR(startDate)} até ${formatDateBR(endDate)}\n` +
      `💰 Vendas do Período: ${formatCurrency(totalVendas)}\n` +
      `📉 Despesas Pagas: ${formatCurrency(totalDesp)}\n` +
      `🏦 Saldo em Contas: ${formatCurrency(bankAccounts.reduce((a, b) => a + b.currentBalance, 0))}\n\n` +
      `_Gerado pelo sistema Dmenos Contro._`
    );

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Central de Relatórios & Exportação PDF
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Emita documentos em PDF com tabelas vetorizadas, cabeçalho oficial do Dmenos Contro e assinatura.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Report Options Form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            1. Selecione o Tipo de Relatório
          </h2>

          <div className="space-y-2">
            {[
              {
                id: 'fechamentos_periodo',
                title: 'Relatório de Fechamentos por Período',
                desc: 'Consolidado de vendas, dinheiro contado e diferenças',
                icon: FileSpreadsheet,
              },
              {
                id: 'fechamento_individual',
                title: 'Comprovante de Fechamento Individual',
                desc: 'Espelho completo do caixa com assinatura e observações',
                icon: FileText,
              },
              {
                id: 'despesas_vales',
                title: 'Relatório de Despesas & Vales',
                desc: 'Discriminação por categoria, fornecedor e status de vales',
                icon: TrendingDown,
              },
              {
                id: 'extrato_bancario',
                title: 'Extrato Bancário Individual',
                desc: 'Entradas, saídas e saldo acumulado de uma conta',
                icon: Landmark,
              },
              {
                id: 'cartoes_recebiveis',
                title: 'Taxas & Cartões a Receber',
                desc: 'Taxas de operadoras, valor bruto e líquido a creditar',
                icon: CreditCard,
              },
              {
                id: 'consolidado',
                title: 'Relatório Mensal / Anual Consolidado',
                desc: 'DRE simplificado do mercadinho com resultado operacional',
                icon: FileSpreadsheet,
              },
            ].map((item) => {
              const active = reportType === item.id;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setReportType(item.id as ReportType)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'bg-emerald-50/70 border-emerald-700 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      active ? 'bg-emerald-800 text-amber-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
            2. Configuração dos Parâmetros
          </h2>

          {/* Individual Closure Selector */}
          {reportType === 'fechamento_individual' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Selecione o Fechamento de Caixa:
              </label>
              <select
                value={selectedClosureId}
                onChange={(e) => setSelectedClosureId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                {closures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatDateBR(c.date)} — {c.cashierName} (Total: {formatCurrency(c.totalSales)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bank Account Selector */}
          {reportType === 'extrato_bancario' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Selecione a Conta Bancária:
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.visibility === 'private' ? '[PRIVADA] ' : ''}{a.name} ({a.bankName}){a.status === 'inactive' ? ' [Inativa]' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'despesas_vales' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Filtrar por Categoria (Opcional):
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="all">Todas as Categorias (Consolidado)</option>
                {expenseCategories.length > 0 && (
                  <optgroup label="Categorias de Despesas">
                    {expenseCategories.map((catName) => (
                      <option key={`exp_${catName}`} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {valeCategories.length > 0 && (
                  <optgroup label="Categorias de Vales">
                    {valeCategories.map((catName) => (
                      <option key={`vale_${catName}`} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Date range for period reports */}
          {reportType !== 'fechamento_individual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              {reportType === 'consolidado' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Título do Período</label>
                  <input
                    type="text"
                    value={periodTitle}
                    onChange={(e) => setPeriodTitle(e.target.value)}
                    placeholder="Ex: Outubro / 2026, Ano 2026..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: PDF Actions & Live Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ações de Emissão do Documento</h3>
                <p className="text-xs text-slate-500">
                  Pronto para imprimir, baixar em PDF ou enviar via WhatsApp.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-emerald-700" />
                  <span>Compartilhar</span>
                </button>

                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
                  title="Enviar resumo por WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50/50">
              {/* PDF Header representation */}
              <div className="bg-emerald-950 p-4 text-white flex justify-between items-center border-b-2 border-amber-500">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-800 text-amber-300 flex items-center justify-center font-black text-xs">
                    D
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight">DMENOS CONTRO</h4>
                    <p className="text-[10px] text-amber-200">Sistema de Controle Financeiro</p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-300">
                  <span className="font-bold text-white block uppercase">
                    {reportType.replace('_', ' ')}
                  </span>
                  <span>Período: {formatDateBR(startDate)} a {formatDateBR(endDate)}</span>
                </div>
              </div>

              {/* Body Summary */}
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Vendas no Período</span>
                    <strong className="text-sm font-bold text-emerald-800">
                      {formatCurrency(
                        closures
                          .filter((c) => c.date >= startDate && c.date <= endDate)
                          .reduce((a, b) => a + b.totalSales, 0)
                      )}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Despesas Ativas</span>
                    <strong className="text-sm font-bold text-rose-600">
                      {formatCurrency(
                        expenses
                          .filter((e) => e.status !== 'cancelled' && e.date >= startDate && e.date <= endDate)
                          .reduce((a, b) => a + b.amount, 0)
                      )}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Vales no Período</span>
                    <strong className="text-sm font-bold text-amber-700">
                      {formatCurrency(
                        vales
                          .filter((v) => v.status !== 'cancelado' && v.date >= startDate && v.date <= endDate)
                          .reduce((a, b) => a + b.amount, 0)
                      )}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Saldos em Contas</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {formatCurrency(bankAccounts.reduce((a, b) => a + b.currentBalance, 0))}
                    </strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs leading-relaxed">
                  <strong>Padrão de Emissão:</strong> O arquivo PDF conterá todas as linhas discriminadas, identificação fiscal, quebra de página automática, rodapé com numeração e campos para conferência de gerência e operador.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Dmenos Contro • Relatórios oficiais</span>
            <span>Sem simulação: dados reais do Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
