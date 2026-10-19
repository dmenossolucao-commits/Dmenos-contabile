import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CalendarNote, CalendarCategory } from '../types';
import { formatDateBR, getTodayDateBR } from '../utils/formatters';
import {
  Calendar as CalendarIcon,
  PlusCircle,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tag,
  AlertCircle,
  X
} from 'lucide-react';

const CATEGORIES: { key: CalendarCategory; label: string; color: string }[] = [
  { key: 'fornecedor', label: 'Pagar Fornecedor', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'conta', label: 'Vencimento de Conta', color: 'bg-rose-100 text-rose-800' },
  { key: 'extrato', label: 'Conferir Extrato', color: 'bg-blue-100 text-blue-800' },
  { key: 'fechamento', label: 'Fazer Fechamento', color: 'bg-amber-100 text-amber-800' },
  { key: 'mercadoria', label: 'Buscar Mercadoria', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'compromisso', label: 'Compromisso', color: 'bg-teal-100 text-teal-800' },
  { key: 'outro', label: 'Outro', color: 'bg-slate-100 text-slate-800' },
];

export const CalendarView: React.FC = () => {
  const { calendarNotes, createCalendarNote, toggleCalendarNoteStatus, deleteCalendarNote } = useFinance();

  const todayStr = getTodayDateBR();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

  // New Note Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [noteDate, setNoteDate] = useState(todayStr);
  const [noteTime, setNoteTime] = useState('');
  const [category, setCategory] = useState<CalendarCategory>('conta');
  const [reminder, setReminder] = useState(true);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Group notes by date
  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarNote[]>();
    calendarNotes.forEach((n) => {
      const existing = map.get(n.date) || [];
      existing.push(n);
      map.set(n.date, existing);
    });
    return map;
  }, [calendarNotes]);

  // Notes for selected day
  const selectedDayNotes = useMemo(() => {
    return notesByDate.get(selectedDateStr) || [];
  }, [notesByDate, selectedDateStr]);

  const handleOpenNewNote = (dStr?: string) => {
    setNoteDate(dStr || selectedDateStr);
    setTitle('');
    setDescription('');
    setNoteTime('');
    setCategory('conta');
    setReminder(true);
    setIsModalOpen(true);
  };

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Informe o título do compromisso.');
      return;
    }

    try {
      await createCalendarNote({
        title: title.trim(),
        description: description.trim() || undefined,
        date: noteDate,
        time: noteTime || undefined,
        category,
        reminder,
        status: 'pendente',
      });
      setIsModalOpen(false);
      setSelectedDateStr(noteDate);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar anotação.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Calendário Financeiro & Lembretes
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {calendarNotes.filter((n) => n.status === 'pendente').length} pendente(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Planejamento de pagamentos a fornecedores, contas de consumo e conferências do mercadinho.
          </p>
        </div>

        <button
          onClick={() => handleOpenNewNote()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-amber-300" />
          <span>Nova Anotação / Lembrete</span>
        </button>
      </div>

      {/* Main Calendar & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          {/* Calendar Header with Nav */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-800" />
              <h2 className="text-base font-bold text-slate-900">
                {monthNames[month]} de {year}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                Hoje
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty boxes for days before month start */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 sm:h-20 p-1 bg-slate-50/50 rounded-xl" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayNotes = notesByDate.get(dStr) || [];
              const isSelected = selectedDateStr === dStr;
              const isToday = todayStr === dStr;

              return (
                <div
                  key={dStr}
                  onClick={() => setSelectedDateStr(dStr)}
                  className={`h-16 sm:h-20 p-1.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-50/40 shadow-xs'
                      : isToday
                      ? 'border-amber-400 bg-amber-50/30'
                      : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? 'bg-amber-500 text-white'
                          : isSelected
                          ? 'bg-emerald-800 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayNotes.length > 0 && (
                      <span className="text-[10px] font-bold px-1 rounded-full bg-emerald-100 text-emerald-800">
                        {dayNotes.length}
                      </span>
                    )}
                  </div>

                  {/* Note tags snippet */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayNotes.slice(0, 2).map((n) => (
                      <div
                        key={n.id}
                        className={`text-[9px] truncate px-1 rounded-sm font-medium ${
                          n.status === 'concluida'
                            ? 'line-through text-slate-400 bg-slate-100'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {n.title}
                      </div>
                    ))}
                    {dayNotes.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-semibold pl-1">
                        +{dayNotes.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-400 block">Anotações do Dia</span>
                <h3 className="text-sm font-bold text-slate-900">{formatDateBR(selectedDateStr)}</h3>
              </div>
              <button
                onClick={() => handleOpenNewNote(selectedDateStr)}
                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition"
                title="Adicionar anotação para este dia"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>

            {/* List of notes for selected day */}
            <div className="space-y-3 mt-4">
              {selectedDayNotes.length > 0 ? (
                selectedDayNotes.map((note) => {
                  const isDone = note.status === 'concluida';
                  return (
                    <div
                      key={note.id}
                      className={`p-3 rounded-xl border transition flex items-start justify-between gap-2.5 ${
                        isDone
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <button
                        onClick={() => toggleCalendarNoteStatus(note.id)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-700 transition"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4
                            className={`font-bold text-slate-900 ${
                              isDone ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {note.title}
                          </h4>
                          {note.time && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({note.time})
                            </span>
                          )}
                        </div>

                        {note.description && (
                          <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                            {note.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            {note.category}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteCalendarNote(note.id)}
                        className="text-slate-300 hover:text-rose-600 transition p-1"
                        title="Remover anotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum compromisso agendado para {formatDateBR(selectedDateStr)}.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleOpenNewNote(selectedDateStr)}
            className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <PlusCircle className="w-4 h-4 text-emerald-700" />
            <span>Adicionar Compromisso</span>
          </button>
        </div>
      </div>

      {/* MODAL: NOVA ANOTAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-amber-300" />
                  Novo Compromisso Financeiro
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Lembrete salvo permanentemente no sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNote} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Título do Compromisso *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Pagar fornecedor de laticínios, vencimento conta de luz..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Horário (Opcional)
                  </label>
                  <input
                    type="time"
                    value={noteTime}
                    onChange={(e) => setNoteTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CalendarCategory)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição detalhada (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Valor previsto R$ 450,00, chave pix no boleto..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm"
                >
                  Salvar Lembrete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
