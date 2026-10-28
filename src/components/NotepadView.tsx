import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { NotepadNote, NotepadCategory, NotepadPriority, NotepadStatus } from '../types';
import {
  FileText,
  Plus,
  Search,
  Pin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Tag,
  Trash2,
  Edit3,
  Archive,
  RefreshCw,
  User,
  Calendar,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  X,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

const CATEGORY_CONFIG: Record<
  NotepadCategory,
  { label: string; bg: string; text: string; border: string; iconBg: string }
> = {
  geral: {
    label: 'Geral',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    iconBg: 'bg-slate-200',
  },
  aviso_caixa: {
    label: 'Aviso de Caixa',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
  },
  pendencia: {
    label: 'Pendência',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
  },
  lembrete: {
    label: 'Lembrete',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
  },
  revisao_gerente: {
    label: 'Revisão da Gestão',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
  },
  fornecedor: {
    label: 'Fornecedor',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
  },
  financeiro: {
    label: 'Financeiro',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
  },
  manutencao: {
    label: 'Manutenção / Loja',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
  },
};

const PRIORITY_CONFIG: Record<NotepadPriority, { label: string; badge: string; dot: string }> = {
  baixa: {
    label: 'Baixa',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  media: {
    label: 'Média',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  alta: {
    label: 'Alta Prioridade',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    dot: 'bg-rose-600',
  },
};

const STATUS_CONFIG: Record<NotepadStatus, { label: string; badge: string; icon: any }> = {
  pendente: {
    label: 'Pendente de Revisão',
    badge: 'bg-amber-500 text-white border-amber-600',
    icon: Clock,
  },
  em_analise: {
    label: 'Em Análise',
    badge: 'bg-blue-600 text-white border-blue-700',
    icon: AlertTriangle,
  },
  revisado: {
    label: 'Revisado',
    badge: 'bg-emerald-600 text-white border-emerald-700',
    icon: CheckCircle2,
  },
  arquivado: {
    label: 'Arquivado',
    badge: 'bg-slate-600 text-white border-slate-700',
    icon: Archive,
  },
};

export const NotepadView: React.FC = () => {
  const {
    notepadNotes,
    createNotepadNote,
    updateNotepadNote,
    deleteNotepadNote,
    reviewNotepadNote,
    toggleNotepadNotePin,
  } = useFinance();
  const { currentUser, isAdmin } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | NotepadStatus | 'fixadas'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [priorityFilter, setPriorityFilter] = useState<string>('todas');

  // Modal states
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NotepadNote | null>(null);
  const [reviewingNote, setReviewingNote] = useState<NotepadNote | null>(null);
  const [deletingNote, setDeletingNote] = useState<NotepadNote | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State for Create/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<NotepadCategory>('geral');
  const [formPriority, setFormPriority] = useState<NotepadPriority>('media');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formStatus, setFormStatus] = useState<NotepadStatus>('pendente');

  // Form State for Review
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [reviewStatusChoice, setReviewStatusChoice] = useState<NotepadStatus>('revisado');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('geral');
    setFormPriority('media');
    setFormTargetDate(new Date().toISOString().split('T')[0]);
    setFormIsPinned(false);
    setFormStatus('pendente');
    setIsNoteModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (note: NotepadNote) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.category);
    setFormPriority(note.priority);
    setFormTargetDate(note.targetDate || '');
    setFormIsPinned(!!note.isPinned);
    setFormStatus(note.status);
    setIsNoteModalOpen(true);
  };

  // Open Review Modal
  const handleOpenReview = (note: NotepadNote) => {
    setReviewingNote(note);
    setReviewNotesInput(note.reviewNotes || '');
    setReviewStatusChoice(note.status === 'pendente' ? 'revisado' : note.status);
  };

  // Save Note (Create or Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    if (!formContent.trim()) return;

    setSubmitting(true);
    try {
      if (editingNote) {
        await updateNotepadNote(editingNote.id, {
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          priority: formPriority,
          targetDate: formTargetDate,
          isPinned: formIsPinned,
          status: formStatus,
        });
      } else {
        await createNotepadNote({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          priority: formPriority,
          targetDate: formTargetDate,
          isPinned: formIsPinned,
          status: formStatus,
        });
      }
      setIsNoteModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar anotação:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingNote) return;

    setSubmitting(true);
    try {
      await reviewNotepadNote(reviewingNote.id, reviewNotesInput, reviewStatusChoice);
      setReviewingNote(null);
    } catch (err) {
      console.error('Erro ao salvar revisão:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    setSubmitting(true);
    try {
      await deleteNotepadNote(deletingNote.id, deleteReason);
      setDeletingNote(null);
      setDeleteReason('');
    } catch (err) {
      console.error('Erro ao excluir anotação:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Reopen (Toggle back to pending)
  const handleQuickReopen = async (note: NotepadNote) => {
    try {
      await reviewNotepadNote(note.id, '', 'pendente');
    } catch (err) {
      console.error('Erro ao reabrir anotação:', err);
    }
  };

  // Quick Archive / Unarchive
  const handleToggleArchive = async (note: NotepadNote) => {
    try {
      const nextStatus = note.status === 'arquivado' ? 'revisado' : 'arquivado';
      await updateNotepadNote(note.id, { status: nextStatus });
    } catch (err) {
      console.error('Erro ao arquivar/desarquivar:', err);
    }
  };

  // Statistics counters
  const stats = useMemo(() => {
    const total = notepadNotes.length;
    const pendentes = notepadNotes.filter((n) => n.status === 'pendente').length;
    const emAnalise = notepadNotes.filter((n) => n.status === 'em_analise').length;
    const revisadas = notepadNotes.filter((n) => n.status === 'revisado').length;
    const fixadas = notepadNotes.filter((n) => n.isPinned).length;
    const altaPrioridadePendentes = notepadNotes.filter(
      (n) => n.priority === 'alta' && n.status !== 'revisado' && n.status !== 'arquivado'
    ).length;
    return { total, pendentes, emAnalise, revisadas, fixadas, altaPrioridadePendentes };
  }, [notepadNotes]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notepadNotes.filter((note) => {
      // Status tab filter
      if (statusFilter === 'fixadas') {
        if (!note.isPinned) return false;
      } else if (statusFilter !== 'todos') {
        if (note.status !== statusFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'todas' && note.category !== categoryFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'todas' && note.priority !== priorityFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inTitle = note.title.toLowerCase().includes(query);
        const inContent = note.content.toLowerCase().includes(query);
        const inAuthor = (note.authorName || '').toLowerCase().includes(query);
        const inReviewer = (note.reviewedByName || '').toLowerCase().includes(query);
        const inReviewNotes = (note.reviewNotes || '').toLowerCase().includes(query);
        if (!inTitle && !inContent && !inAuthor && !inReviewer && !inReviewNotes) {
          return false;
        }
      }

      return true;
    });
  }, [notepadNotes, statusFilter, categoryFilter, priorityFilter, searchTerm]);

  // Separate pinned and regular from the filtered view
  const pinnedList = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const regularList = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                Bloco de Notas & Revisão
                {stats.pendentes > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                    {stats.pendentes} pendente{stats.pendentes > 1 ? 's' : ''}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Registre anotações operacionais, ocorrências de turno e acompanhe revisões da gestão
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova Anotação</span>
          </button>
        </div>
      </div>

      {/* Metrics / Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setStatusFilter('todos')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'todos'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider block opacity-75">
            Total Registradas
          </span>
          <span className="text-2xl sm:text-3xl font-black mt-1 block">{stats.total}</span>
          <span className="text-[11px] font-medium opacity-80 mt-1 block">Anotações no sistema</span>
        </button>

        <button
          onClick={() => setStatusFilter('pendente')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'pendente'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200/80 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider block">
              Pendentes de Revisão
            </span>
            {stats.pendentes > 0 && <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <span className="text-2xl sm:text-3xl font-black mt-1 block">{stats.pendentes}</span>
          <span className="text-[11px] font-medium mt-1 block">
            {stats.altaPrioridadePendentes > 0
              ? `${stats.altaPrioridadePendentes} com prioridade alta`
              : 'Aguardando parecer'}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('em_analise')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'em_analise'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-blue-50/60 hover:bg-blue-100/60 border-blue-200/80 text-blue-900'
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider block">
            Em Análise
          </span>
          <span className="text-2xl sm:text-3xl font-black mt-1 block">{stats.emAnalise}</span>
          <span className="text-[11px] font-medium mt-1 block">Em apuração pela gerência</span>
        </button>

        <button
          onClick={() => setStatusFilter('revisado')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'revisado'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-200/80 text-emerald-900'
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider block">
            Revisadas & Concluídas
          </span>
          <span className="text-2xl sm:text-3xl font-black mt-1 block">{stats.revisadas}</span>
          <span className="text-[11px] font-medium mt-1 block">Com parecer emitido</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, texto da anotação, autor ou responsável pela revisão..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Buttons & Dropdown Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/60 text-xs">
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('pendente')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'pendente'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Pendentes ({stats.pendentes})
            </button>
            <button
              onClick={() => setStatusFilter('em_analise')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'em_analise'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              Em Análise ({stats.emAnalise})
            </button>
            <button
              onClick={() => setStatusFilter('revisado')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'revisado'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Revisadas ({stats.revisadas})
            </button>
            <button
              onClick={() => setStatusFilter('fixadas')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'fixadas'
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Pin className="w-3 h-3 text-amber-400" />
              <span>Fixadas ({stats.fixadas})</span>
            </button>
            <button
              onClick={() => setStatusFilter('arquivado')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'arquivado'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Arquivadas
            </button>
          </div>

          {/* Category & Priority Dropdowns */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="todas">Todas as Categorias</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="todas">Todas as Prioridades</option>
              <option value="alta">Alta Prioridade</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredNotes.length === 0 && (
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-1">Nenhuma anotação encontrada</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'todos' || categoryFilter !== 'todas'
              ? 'Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os termos de busca.'
              : 'O bloco de notas está vazio. Comece registrando uma nova anotação ou ocorrência de turno para revisão posterior.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeira Anotação</span>
          </button>
        </div>
      )}

      {/* Pinned Notes Section */}
      {pinnedList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Anotações Fixadas no Topo ({pinnedList.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedList.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isAdmin={isAdmin}
                currentUserId={currentUser?.id}
                onEdit={() => handleOpenEdit(note)}
                onReview={() => handleOpenReview(note)}
                onQuickReopen={() => handleQuickReopen(note)}
                onTogglePin={() => toggleNotepadNotePin(note.id)}
                onToggleArchive={() => handleToggleArchive(note)}
                onDelete={() => setDeletingNote(note)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Notes Section */}
      {regularList.length > 0 && (
        <div className="space-y-3">
          {pinnedList.length > 0 && (
            <div className="flex items-center gap-2 px-1 pt-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
                Outras Anotações ({regularList.length})
              </h2>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regularList.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isAdmin={isAdmin}
                currentUserId={currentUser?.id}
                onEdit={() => handleOpenEdit(note)}
                onReview={() => handleOpenReview(note)}
                onQuickReopen={() => handleQuickReopen(note)}
                onTogglePin={() => toggleNotepadNotePin(note.id)}
                onToggleArchive={() => handleToggleArchive(note)}
                onDelete={() => setDeletingNote(note)}
              />
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Nova / Editar Anotação */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 to-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingNote ? 'Editar Anotação' : 'Nova Anotação para Bloco & Revisão'}
                  </h3>
                  <p className="text-[10px] text-amber-300 font-medium">
                    {editingNote ? 'Atualize as informações registradas' : 'Registre notas, pendências ou ocorrências'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-emerald-900/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNote} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Título da Anotação *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Diferença de R$ 15 no caixa da tarde / Fornecedor de pão atrasou entrega"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              {/* Category and Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as NotepadCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Prioridade *
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['baixa', 'media', 'alta'] as NotepadPriority[]).map((p) => {
                      const cfg = PRIORITY_CONFIG[p];
                      const active = formPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormPriority(p)}
                          className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1 ${
                            active
                              ? p === 'alta'
                                ? 'bg-rose-600 text-white border-rose-700'
                                : p === 'media'
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-slate-700 text-white border-slate-800'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : cfg.dot}`}
                          />
                          <span>{cfg.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Target Date and Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Data Limite / Alvo de Revisão (Opcional)
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status Inicial
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as NotepadStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="pendente">Pendente de Revisão</option>
                    <option value="em_analise">Em Análise</option>
                    <option value="revisado">Já Revisado / Resolvido</option>
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Conteúdo & Detalhes da Anotação *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formContent.length} caracteres
                  </span>
                </div>
                <textarea
                  required
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Escreva com detalhes o que aconteceu, o que precisa ser verificado pelo gestor, instruções para o próximo operador ou lembrete para conferência posterior..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              {/* Pin checkbox */}
              <label className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-900 block flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-amber-600" />
                    Fixar no topo do Bloco de Notas
                  </span>
                  <span className="text-[11px] text-amber-700/80 block">
                    Mantém esta anotação em destaque na parte superior para acesso imediato.
                  </span>
                </div>
              </label>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingNote ? 'Atualizar Anotação' : 'Salvar Anotação'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Revisão da Gestão */}
      {reviewingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 to-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Revisão Posterior da Gestão</h3>
                  <p className="text-[10px] text-amber-300 font-medium">
                    Emitir parecer e atualizar status da anotação
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewingNote(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-emerald-900/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Review Form */}
            <form onSubmit={handleSubmitReview} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Note summary box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Anotação Original
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Registrado por {reviewingNote.authorName}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{reviewingNote.title}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {reviewingNote.content}
                </p>
              </div>

              {/* Status Choice */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Novo Status da Revisão *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('revisado')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer flex flex-col items-center gap-1 ${
                      reviewStatusChoice === 'revisado'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Revisado / Ok</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('em_analise')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer flex flex-col items-center gap-1 ${
                      reviewStatusChoice === 'em_analise'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Em Análise</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('pendente')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer flex flex-col items-center gap-1 ${
                      reviewStatusChoice === 'pendente'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Reabrir</span>
                  </button>
                </div>
              </div>

              {/* Reviewer Notes / Feedback */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Parecer do Revisor / Observações da Gestão
                </label>
                <textarea
                  rows={4}
                  value={reviewNotesInput}
                  onChange={(e) => setReviewNotesInput(e.target.value)}
                  placeholder="Ex: Verificado no fechamento do caixa físico. A diferença foi ajustada no relatório do turno / Fornecedor avisado para próxima entrega..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              {/* Revisor signature preview */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 flex items-center gap-2 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Revisão será assinada por <strong>{currentUser?.displayName || currentUser?.username}</strong> ({isAdmin ? 'Administrador' : 'Gestor'}).
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewingNote(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Parecer de Revisão</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Exclusão Segura */}
      {deletingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Excluir Anotação?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação removerá a anotação do sistema. O evento será registrado no log de auditoria.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700">
                <span className="font-bold text-slate-900 block truncate">{deletingNote.title}</span>
                <span className="text-[11px] text-slate-500 block">
                  Criada em {new Date(deletingNote.createdAt).toLocaleDateString('pt-BR')} por {deletingNote.authorName}
                </span>
              </div>

              <div>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Motivo da exclusão (opcional)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingNote(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmDelete}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: NoteCard
interface NoteCardProps {
  note: NotepadNote;
  isAdmin: boolean;
  currentUserId?: string;
  onEdit: () => void;
  onReview: () => void;
  onQuickReopen: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isAdmin,
  currentUserId,
  onEdit,
  onReview,
  onQuickReopen,
  onTogglePin,
  onToggleArchive,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.geral;
  const pri = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.media;
  const sta = STATUS_CONFIG[note.status] || STATUS_CONFIG.pendente;
  const StatusIcon = sta.icon;

  const isAuthor = currentUserId === note.authorUid;
  const canModify = isAdmin || isAuthor;

  const formattedCreated = new Date(note.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedReviewed = note.reviewedAt
    ? new Date(note.reviewedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`bg-white rounded-3xl border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
        note.isPinned
          ? 'border-amber-400/80 bg-gradient-to-b from-amber-50/20 to-white ring-1 ring-amber-400/30'
          : note.status === 'pendente' && note.priority === 'alta'
          ? 'border-rose-300 bg-gradient-to-b from-rose-50/20 to-white'
          : 'border-slate-200/80'
      }`}
    >
      <div className="p-5 space-y-3">
        {/* Top Badges & Pin Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Category */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cat.bg} ${cat.text} ${cat.border}`}
            >
              {cat.label}
            </span>

            {/* Priority */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${pri.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
              <span>{pri.label}</span>
            </span>

            {/* Status */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${sta.badge}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{sta.label}</span>
            </span>
          </div>

          {/* Pin toggle button */}
          <button
            onClick={onTogglePin}
            title={note.isPinned ? 'Desafixar' : 'Fixar no topo'}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              note.isPinned
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-amber-600 text-amber-600' : ''}`} />
          </button>
        </div>

        {/* Note Title */}
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
            {note.title}
          </h3>
          {note.targetDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Data alvo para revisão:{' '}
                <strong>{new Date(note.targetDate + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Note Content */}
        <div className="text-xs text-slate-700 leading-relaxed font-normal">
          <p
            className={`whitespace-pre-wrap ${
              !isExpanded && note.content.length > 220 ? 'line-clamp-4' : ''
            }`}
          >
            {note.content}
          </p>
          {note.content.length > 220 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 mt-1 cursor-pointer block"
            >
              {isExpanded ? 'Mostrar menos' : 'Ler texto completo...'}
            </button>
          )}
        </div>

        {/* Review Box (if reviewed or in analysis with notes) */}
        {(note.reviewedAt || note.reviewNotes) && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-950 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Parecer da Revisão
              </span>
              {formattedReviewed && (
                <span className="text-[10px] text-emerald-800/80">{formattedReviewed}</span>
              )}
            </div>
            {note.reviewNotes && (
              <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">
                "{note.reviewNotes}"
              </p>
            )}
            <div className="text-[10px] text-emerald-700 font-medium pt-0.5">
              Revisado por: <strong>{note.reviewedByName || 'Gestão'}</strong>
            </div>
          </div>
        )}

        {/* Author & Timestamp Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              Por <strong>{note.authorName}</strong> ({note.authorRole === 'admin' ? 'Admin' : 'Operador'})
            </span>
          </div>
          <span className="shrink-0 text-[10px]">{formattedCreated}</span>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Left: Review Action */}
        <div>
          {note.status === 'pendente' || note.status === 'em_analise' ? (
            <button
              onClick={onReview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Revisar Anotação</span>
            </button>
          ) : (
            <button
              onClick={onQuickReopen}
              title="Voltar para status pendente para nova análise"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-slate-600" />
              <span>Reabrir</span>
            </button>
          )}
        </div>

        {/* Right: Auxiliary Actions (Edit, Archive, Delete) */}
        <div className="flex items-center gap-1">
          {canModify && (
            <button
              onClick={onEdit}
              title="Editar Anotação"
              className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onToggleArchive}
            title={note.status === 'arquivado' ? 'Desarquivar anotação' : 'Arquivar anotação'}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
          >
            <Archive className="w-4 h-4" />
          </button>

          {canModify && (
            <button
              onClick={onDelete}
              title="Excluir Anotação"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
