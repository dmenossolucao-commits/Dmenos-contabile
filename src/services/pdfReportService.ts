import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DailyClosure,
  Expense,
  Vale,
  BankAccount,
  BankTransaction,
  Receivable
} from '../types';
import { formatCurrency, formatDateBR, formatDateTimeBR } from '../utils/formatters';

// Base PDF setup with Dmenos Contro branding
function createBaseDoc(title: string, subtitle: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark Green Header Bar
  doc.setFillColor(6, 78, 59); // #064e3b
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Gold accent line
  doc.setFillColor(245, 158, 11); // #f59e0b
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DMENOS CONTRO', 14, 13);

  // System tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(254, 240, 138); // light gold
  doc.text('Sistema Profissional de Controle Financeiro Diário', 14, 20);

  // Title and emission date on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth - 14, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em: ${formatDateTimeBR(new Date())}`, pageWidth - 14, 20, { align: 'right' });

  // Subtitle / Filter banner
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(subtitle, 14, 37);

  return doc;
}

// Add footer to PDF
function addFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Dmenos Contro — Gestão e Integridade Financeira', 14, pageHeight - 6);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }
}

// 1. Relatório de Fechamento Diário Individual
export function generateClosurePDF(closure: DailyClosure) {
  const doc = createBaseDoc(
    'FECHAMENTO DE CAIXA',
    `Data do Fechamento: ${formatDateBR(closure.date)} | Operador: ${closure.cashierName}`
  );

  autoTable(doc, {
    startY: 42,
    head: [['Item / Modalidade', 'Tipo', 'Valor (R$)']],
    body: [
      ['Saldo Inicial de Dinheiro no Caixa', 'Abertura', formatCurrency(closure.initialCash)],
      ['Entradas em Dinheiro Físico', 'Recebimento', formatCurrency(closure.cashIn)],
      ['Saídas Pagas em Dinheiro', 'Saída Dinheiro', `(${formatCurrency(closure.expensesCash || 0)})`],
      ['Saldo Líquido em Dinheiro', 'Líquido Dinheiro', formatCurrency((closure.cashIn || 0) - (closure.expensesCash || 0))],
      ['Recebimentos via Pix', 'Eletrônico', formatCurrency(closure.pixIn)],
      ['Saídas Pagas via Pix', 'Saída Pix', `(${formatCurrency(closure.expensesPix || 0)})`],
      ['Saldo Líquido via Pix', 'Líquido Pix', formatCurrency((closure.pixIn || 0) - (closure.expensesPix || 0))],
      ['Recebimentos Cartão de Crédito', 'Operadora', formatCurrency(closure.creditCardIn)],
      ['Recebimentos Cartão de Débito', 'Operadora', formatCurrency(closure.debitCardIn)],
      [
        closure.otherInDescription ? `Outras Entradas: ${closure.otherInDescription}` : 'Outras Entradas',
        'Recebimento',
        formatCurrency(closure.otherIn),
      ],
      ['Total Geral de Vendas / Faturamento', 'TOTAL VENDAS', formatCurrency(closure.totalSales)],
      ['Vales Pagos do Caixa', 'Saída Dinheiro', `(${formatCurrency(closure.valesCash || 0)})`],
      [
        'Total Geral de Saídas (Dinheiro + Pix + Vales)',
        'TOTAL SAÍDAS',
        formatCurrency((closure.expensesCash || 0) + (closure.expensesPix || 0) + (closure.valesCash || 0)),
      ],
      [
        'Movimento Líquido Total',
        'LÍQUIDO GERAL',
        formatCurrency(
          closure.totalSales -
            ((closure.expensesCash || 0) + (closure.expensesPix || 0) + (closure.valesCash || 0))
        ),
      ],
      ['Saldo Esperado em Dinheiro no Caixa', 'Cálculo Oficial', formatCurrency(closure.expectedCash)],
      ['Dinheiro Físico Contado no Caixa', 'Contagem Final', formatCurrency(closure.countedCash)],
      [
        'Diferença de Caixa (Contado - Esperado)',
        closure.cashDifference >= 0 ? 'Sobra de Caixa' : 'Falta de Caixa',
        formatCurrency(closure.cashDifference),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 40 },
      2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight total vendas (row 10), total saídas (row 12), líquido geral (row 13)
      if (data.row.index === 10) {
        data.cell.styles.fillColor = [240, 253, 244]; // emerald light
        data.cell.styles.textColor = [6, 95, 70];
      }
      if (data.row.index === 12) {
        data.cell.styles.fillColor = [254, 242, 242]; // red light
        data.cell.styles.textColor = [185, 28, 28];
      }
      if (data.row.index === 13) {
        data.cell.styles.fillColor = [238, 242, 255]; // indigo light
        data.cell.styles.textColor = [55, 48, 163];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (closure.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Observações do Caixa:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(closure.notes, 14, finalY + 6, { maxWidth: 180 });
  }

  // Signature lines
  const sigY = finalY + (closure.notes ? 30 : 20);
  doc.setDrawColor(148, 163, 184);
  doc.line(20, sigY, 90, sigY);
  doc.line(115, sigY, 185, sigY);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Responsável: ${closure.cashierName}`, 55, sigY + 5, { align: 'center' });
  doc.text('Gerência / Conferência', 150, sigY + 5, { align: 'center' });

  addFooter(doc);
  return doc;
}

// 2. Relatório de Fechamentos por Período
export function generateClosuresReportPDF(closures: DailyClosure[], startDate: string, endDate: string) {
  const doc = createBaseDoc(
    'RELATÓRIO DE FECHAMENTOS',
    `Período: ${formatDateBR(startDate)} até ${formatDateBR(endDate)} | Total: ${closures.length} fechamentos`
  );

  const totalVendas = closures.reduce((acc, c) => acc + c.totalSales, 0);
  const totalDinheiro = closures.reduce((acc, c) => acc + c.cashIn, 0);
  const totalPix = closures.reduce((acc, c) => acc + c.pixIn, 0);
  const totalCartao = closures.reduce((acc, c) => acc + c.creditCardIn + c.debitCardIn, 0);
  const totalSaidaFisica = closures.reduce((acc, c) => acc + (c.expensesCash || 0) + (c.valesCash || 0), 0);

  const rows = closures.map((c) => [
    formatDateBR(c.date),
    c.cashierName,
    formatCurrency(c.cashIn),
    formatCurrency(c.pixIn),
    formatCurrency(c.creditCardIn + c.debitCardIn),
    formatCurrency(c.totalSales),
    formatCurrency(c.countedCash),
    formatCurrency((c.expensesCash || 0) + (c.valesCash || 0)),
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Data', 'Caixa', 'Dinheiro', 'Pix', 'Cartões', 'Total Vendas', 'Contado', 'Saída Física']],
    body: rows,
    foot: [
      [
        'TOTAIS',
        '',
        formatCurrency(totalDinheiro),
        formatCurrency(totalPix),
        formatCurrency(totalCartao),
        formatCurrency(totalVendas),
        '',
        formatCurrency(totalSaidaFisica),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
  });

  addFooter(doc);
  return doc;
}

// 3. Relatório de Despesas e Vales
export function generateExpensesReportPDF(expenses: Expense[], vales: Vale[], startDate: string, endDate: string) {
  const doc = createBaseDoc(
    'RELATÓRIO DE DESPESAS E VALES',
    `Período: ${formatDateBR(startDate)} até ${formatDateBR(endDate)}`
  );

  const activeExpenses = expenses.filter((e) => e.status !== 'cancelled');
  const totalExpenses = activeExpenses.reduce((acc, e) => acc + e.amount, 0);

  const activeVales = vales.filter((v) => v.status !== 'cancelado');
  const totalVales = activeVales.reduce((acc, v) => acc + v.amount, 0);
  const valesPendentes = activeVales.filter((v) => v.status === 'pendente').reduce((acc, v) => acc + v.amount, 0);
  const valesQuitados = activeVales.filter((v) => v.status === 'quitado').reduce((acc, v) => acc + v.amount, 0);

  // Section 1: Despesas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.text(`1. Despesas Operacionais (Total: ${formatCurrency(totalExpenses)})`, 14, 45);

  const expenseRows = activeExpenses.map((e) => [
    formatDateBR(e.date),
    e.description,
    e.category,
    e.entityName || '-',
    e.moneySource.toUpperCase(),
    formatCurrency(e.amount),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Data', 'Descrição', 'Categoria', 'Fornecedor/Pessoa', 'Origem', 'Valor']],
    body: expenseRows.length > 0 ? expenseRows : [['Nenhuma despesa no período.', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  const nextY = (doc as any).lastAutoTable.finalY + 10;

  // Section 2: Vales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.text(
    `2. Vales de Funcionários (Total: ${formatCurrency(totalVales)} | Pendentes: ${formatCurrency(valesPendentes)} | Quitados: ${formatCurrency(valesQuitados)})`,
    14,
    nextY
  );

  const valeRows = activeVales.map((v) => [
    formatDateBR(v.date),
    v.employeeName,
    v.category || 'Adiantamento',
    v.moneySource.toUpperCase(),
    v.status.toUpperCase(),
    v.settledDate ? formatDateBR(v.settledDate) : '-',
    formatCurrency(v.amount),
  ]);

  autoTable(doc, {
    startY: nextY + 5,
    head: [['Data', 'Funcionário', 'Categoria', 'Origem', 'Situação', 'Data Quitação', 'Valor']],
    body: valeRows.length > 0 ? valeRows : [['Nenhum vale no período.', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  addFooter(doc);
  return doc;
}

// 4. Extrato Individual de Conta Bancária
export function generateBankStatementPDF(
  account: BankAccount,
  transactions: BankTransaction[],
  startDate: string,
  endDate: string,
  typeFilter: string = 'all',
  categoryFilter: string = 'all',
  searchTerm: string = ''
) {
  const doc = createBaseDoc(
    `EXTRATO BANCÁRIO — ${account.name.toUpperCase()}`,
    `Banco: ${account.bankName} | Ag: ${account.agency || '-'} | Conta: ${account.accountNumberMasked} | Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`
  );

  const validTrans = transactions.filter(
    (t) =>
      t.accountId === account.id &&
      t.status === 'active' &&
      !t.relatedClosureId &&
      t.category !== 'Saldo de Abertura' &&
      !t.id?.startsWith('bt_init_')
  );

  // Saldo imediatamente anterior ao período
  const priorTrans = validTrans.filter((t) => t.date < startDate);
  const initialPeriodBalance = account.initialBalance + priorTrans.reduce((acc, t) => acc + t.amount, 0);

  // Transações no período
  let inPeriodTrans = validTrans.filter((t) => t.date >= startDate && t.date <= endDate);

  if (typeFilter === 'entrada') inPeriodTrans = inPeriodTrans.filter((t) => t.amount > 0 && !t.type.includes('transferencia'));
  else if (typeFilter === 'saida') inPeriodTrans = inPeriodTrans.filter((t) => t.amount < 0 && !t.type.includes('transferencia'));
  else if (typeFilter === 'transferencia') inPeriodTrans = inPeriodTrans.filter((t) => t.type.includes('transferencia') || Boolean(t.relatedTransferId));

  if (categoryFilter && categoryFilter !== 'all') {
    inPeriodTrans = inPeriodTrans.filter((t) => t.category === categoryFilter);
  }

  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.toLowerCase().trim();
    inPeriodTrans = inPeriodTrans.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
        (t.responsibleName && t.responsibleName.toLowerCase().includes(q))
    );
  }

  inPeriodTrans.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const totalEntradas = inPeriodTrans.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalSaidas = inPeriodTrans.filter((t) => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const finalPeriodBalance = initialPeriodBalance + totalEntradas - totalSaidas;

  let runningBalance = initialPeriodBalance;
  const rows = inPeriodTrans.map((t) => {
    runningBalance += t.amount;
    return [
      formatDateBR(t.date),
      t.description + (t.documentNumber ? ` (Doc: ${t.documentNumber})` : ''),
      t.category,
      t.type.replace('_', ' ').toUpperCase(),
      t.amount >= 0 ? formatCurrency(t.amount) : '-',
      t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-',
      formatCurrency(runningBalance),
      t.responsibleName || 'Sistema',
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [['Data', 'Descrição / Documento', 'Categoria', 'Operação', 'Entrada (+)', 'Saída (-)', 'Saldo Acumulado', 'Responsável']],
    body: rows.length > 0 ? rows : [['Nenhuma movimentação localizada com os filtros selecionados.', '', '', '', '', '', formatCurrency(initialPeriodBalance), '']],
    foot: [
      [
        'TOTAIS DO PERÍODO',
        `Qtd: ${inPeriodTrans.length}`,
        `Saldo Inicial: ${formatCurrency(initialPeriodBalance)}`,
        '',
        `+ ${formatCurrency(totalEntradas)}`,
        `- ${formatCurrency(totalSaidas)}`,
        `Saldo Final: ${formatCurrency(finalPeriodBalance)}`,
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
  });

  addFooter(doc);
  return doc;
}

// 4b. Extrato Consolidado de Todos os Bancos
export function generateConsolidatedBankStatementPDF(
  accounts: BankAccount[],
  transactions: BankTransaction[],
  startDate: string,
  endDate: string,
  typeFilter: string = 'all',
  searchTerm: string = ''
) {
  const doc = createBaseDoc(
    'EXTRATO BANCÁRIO CONSOLIDADO — TODOS OS BANCOS',
    `Contas: ${accounts.map((a) => a.name).join(', ')} | Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`
  );

  const validTrans = transactions.filter(
    (t) =>
      t.status === 'active' &&
      !t.relatedClosureId &&
      t.category !== 'Saldo de Abertura' &&
      !t.id?.startsWith('bt_init_')
  );

  let totalInitialBalance = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const priorTrans = validTrans.filter((t) => t.date < startDate);
  totalInitialBalance += priorTrans.reduce((acc, t) => acc + t.amount, 0);

  let inPeriodTrans = validTrans.filter((t) => t.date >= startDate && t.date <= endDate);

  if (typeFilter === 'entrada') inPeriodTrans = inPeriodTrans.filter((t) => t.amount > 0 && !t.type.includes('transferencia'));
  else if (typeFilter === 'saida') inPeriodTrans = inPeriodTrans.filter((t) => t.amount < 0 && !t.type.includes('transferencia'));
  else if (typeFilter === 'transferencia') inPeriodTrans = inPeriodTrans.filter((t) => t.type.includes('transferencia') || Boolean(t.relatedTransferId));

  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.toLowerCase().trim();
    inPeriodTrans = inPeriodTrans.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.documentNumber && t.documentNumber.toLowerCase().includes(q))
    );
  }

  inPeriodTrans.sort((a, b) => a.date.localeCompare(b.date));

  // External operations (excluding internal transfers)
  const externalEntradas = inPeriodTrans
    .filter((t) => t.amount > 0 && !t.type.includes('transferencia') && !t.relatedTransferId)
    .reduce((acc, t) => acc + t.amount, 0);

  const externalSaidas = inPeriodTrans
    .filter((t) => t.amount < 0 && !t.type.includes('transferencia') && !t.relatedTransferId)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  const totalTransferencias = inPeriodTrans
    .filter((t) => t.amount > 0 && (t.type.includes('transferencia') || Boolean(t.relatedTransferId)))
    .reduce((acc, t) => acc + t.amount, 0);

  const finalConsolidatedBalance = totalInitialBalance + externalEntradas - externalSaidas;

  const rows = inPeriodTrans.map((t) => {
    const acc = accounts.find((a) => a.id === t.accountId);
    const isInternal = t.type.includes('transferencia') || Boolean(t.relatedTransferId);
    return [
      formatDateBR(t.date),
      acc ? acc.name : 'Conta',
      t.description,
      t.category,
      isInternal ? 'Transf. Interna' : t.amount >= 0 ? 'Entrada' : 'Saída',
      t.amount >= 0 ? formatCurrency(t.amount) : '-',
      t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-',
      t.responsibleName || 'Sistema',
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [['Data', 'Conta', 'Descrição', 'Categoria', 'Tipo', 'Entrada (+)', 'Saída (-)', 'Responsável']],
    body: rows.length > 0 ? rows : [['Nenhuma movimentação bancária no período.', '', '', '', '', '', '', '']],
    foot: [
      [
        'TOTAIS CONSOLIDADOS',
        `Saldo Inicial: ${formatCurrency(totalInitialBalance)}`,
        `Transf. Internas: ${formatCurrency(totalTransferencias)}`,
        '',
        '',
        `+ ${formatCurrency(externalEntradas)}`,
        `- ${formatCurrency(externalSaidas)}`,
        `Saldo Final: ${formatCurrency(finalConsolidatedBalance)}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
  });

  addFooter(doc);
  return doc;
}

// 5. Relatório de Taxas e Cartões a Receber
export function generateReceivablesReportPDF(receivables: Receivable[], startDate: string, endDate: string) {
  const doc = createBaseDoc(
    'RELATÓRIO DE CARTÕES E RECEBÍVEIS',
    `Período: ${formatDateBR(startDate)} até ${formatDateBR(endDate)}`
  );

  const totalBruto = receivables.reduce((acc, r) => acc + r.grossAmount, 0);
  const totalTaxas = receivables.reduce((acc, r) => acc + r.feeAmount, 0);
  const totalLiquido = receivables.reduce((acc, r) => acc + r.netAmount, 0);
  const totalPendentes = receivables.filter((r) => r.status === 'pendente').reduce((acc, r) => acc + r.netAmount, 0);
  const totalCreditados = receivables.filter((r) => r.status === 'creditado').reduce((acc, r) => acc + r.netAmount, 0);

  const rows = receivables.map((r) => [
    formatDateBR(r.date),
    r.cardType.toUpperCase(),
    formatCurrency(r.grossAmount),
    `${r.feePercentage}% (${formatCurrency(r.feeAmount)})`,
    formatCurrency(r.netAmount),
    r.expectedCreditDate ? formatDateBR(r.expectedCreditDate) : '-',
    r.status.toUpperCase(),
    r.targetAccountName || 'Conta Padrão',
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Data Venda', 'Cartão', 'Bruto', 'Taxa Operadora', 'Líquido', 'Previsão Crédito', 'Situação', 'Conta Destino']],
    body: rows.length > 0 ? rows : [['Nenhum registro de cartão encontrado.', '', '', '', '', '', '', '']],
    foot: [
      [
        'TOTAIS',
        '',
        formatCurrency(totalBruto),
        formatCurrency(totalTaxas),
        formatCurrency(totalLiquido),
        `Pend: ${formatCurrency(totalPendentes)}`,
        `Cred: ${formatCurrency(totalCreditados)}`,
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
  });

  addFooter(doc);
  return doc;
}

// 6. Relatório Consolidado Mensal / Anual
export function generateConsolidatedReportPDF(
  periodName: string,
  closures: DailyClosure[],
  expenses: Expense[],
  vales: Vale[],
  accounts: BankAccount[]
) {
  const doc = createBaseDoc(
    `RELATÓRIO CONSOLIDADO — ${periodName.toUpperCase()}`,
    `Visão Geral de Desempenho e Saldos Financeiros`
  );

  const totalVendas = closures.reduce((acc, c) => acc + c.totalSales, 0);
  const totalDinheiro = closures.reduce((acc, c) => acc + c.cashIn, 0);
  const totalPix = closures.reduce((acc, c) => acc + c.pixIn, 0);
  const totalCartoes = closures.reduce((acc, c) => acc + c.creditCardIn + c.debitCardIn, 0);
  const totalOutros = closures.reduce((acc, c) => acc + c.otherIn, 0);

  const totalDespesas = expenses.filter((e) => e.status !== 'cancelled').reduce((acc, e) => acc + e.amount, 0);
  const totalVales = vales.filter((v) => v.status !== 'cancelado').reduce((acc, v) => acc + v.amount, 0);

  const totalBancos = accounts.reduce((acc, a) => acc + a.currentBalance, 0);
  const resultadoOperacional = totalVendas - totalDespesas - totalVales;

  autoTable(doc, {
    startY: 44,
    head: [['Indicador Financeiro', 'Classificação', 'Total Consolidado']],
    body: [
      ['Total de Vendas no Período', 'Receita Operacional Bruta', formatCurrency(totalVendas)],
      ['Recebimentos em Dinheiro', 'Entrada Caixa', formatCurrency(totalDinheiro)],
      ['Recebimentos via Pix', 'Transferência Imediata', formatCurrency(totalPix)],
      ['Recebimentos Cartões Crédito/Débito', 'Operadoras', formatCurrency(totalCartoes)],
      ['Outras Entradas', 'Diversos', formatCurrency(totalOutros)],
      ['Total de Despesas Operacionais', 'Saídas', `(${formatCurrency(totalDespesas)})`],
      ['Total de Vales Funcionários', 'Adiantamentos', `(${formatCurrency(totalVales)})`],
      ['Resultado Operacional Líquido Estimado', 'Superávit / Déficit', formatCurrency(resultadoOperacional)],
      ['Saldo Consolidado em Todas as Contas Bancárias', 'Ativo Bancário', formatCurrency(totalBancos)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 45 },
      2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === 7) {
        data.cell.styles.fillColor = resultadoOperacional >= 0 ? [240, 253, 244] : [254, 242, 242];
        data.cell.styles.textColor = resultadoOperacional >= 0 ? [6, 95, 70] : [185, 28, 28];
      }
    },
  });

  addFooter(doc);
  return doc;
}

// Download, Print & Native Share helpers
export async function downloadOrSharePDF(doc: jsPDF, filename: string, title: string) {
  const pdfBlob = doc.output('blob');
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  // Native share if supported
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: `Relatório ${title} gerado pelo Dmenos Contro.`,
      });
      return { shared: true };
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        doc.save(filename);
        return { downloaded: true };
      }
      return { cancelled: true };
    }
  } else {
    // Direct download
    doc.save(filename);
    return { downloaded: true };
  }
}

export function printPDF(doc: jsPDF) {
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl.toString(), '_blank');
}
