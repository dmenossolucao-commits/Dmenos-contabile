import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator as CalcIcon,
  X,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  RotateCcw,
  Percent,
  Delete
} from 'lucide-react';

export const FloatingCalculator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [displayValue, setDisplayValue] = useState('0');
  const [expression, setExpression] = useState('');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [copied, setCopied] = useState(false);

  // Position state for dragging
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Format a number for display in Brazilian format (comma for decimals, dot for thousands)
  const formatDisplay = (valStr: string) => {
    if (!valStr || valStr === 'Erro') return valStr;
    const parts = valStr.split(',');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : null;

    // Format integer part with thousands dots
    const isNegative = integerPart.startsWith('-');
    const cleanInt = integerPart.replace('-', '');
    const formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return (isNegative ? '-' : '') + formattedInt + (decimalPart !== null ? `,${decimalPart}` : '');
  };

  const handleDigit = (digit: string) => {
    if (displayValue === 'Erro') {
      setDisplayValue(digit);
      setExpression('');
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(false);
      return;
    }

    if (waitingForOperand) {
      setDisplayValue(digit);
      setWaitingForOperand(false);
    } else {
      if (displayValue === '0' && digit !== ',') {
        setDisplayValue(digit);
      } else {
        // limit digits to prevent display overflow
        if (displayValue.replace(/[,-]/g, '').length < 14) {
          setDisplayValue(displayValue + digit);
        }
      }
    }
  };

  const handleComma = () => {
    if (displayValue === 'Erro') {
      setDisplayValue('0,');
      setWaitingForOperand(false);
      return;
    }
    if (waitingForOperand) {
      setDisplayValue('0,');
      setWaitingForOperand(false);
      return;
    }
    if (!displayValue.includes(',')) {
      setDisplayValue(displayValue + ',');
    }
  };

  const handleClear = () => {
    setDisplayValue('0');
    setExpression('');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    if (displayValue === 'Erro' || waitingForOperand) {
      setDisplayValue('0');
      return;
    }
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1));
    } else {
      setDisplayValue('0');
    }
  };

  const parseInternal = (valStr: string): number => {
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const formatNumberResult = (num: number): string => {
    if (isNaN(num) || !isFinite(num)) return 'Erro';
    // Round to 8 decimal places to eliminate float errors
    const rounded = Math.round(num * 100000000) / 100000000;
    const str = rounded.toString();
    return str.replace('.', ',');
  };

  const performCalculation = (op: string, a: number, b: number): number => {
    switch (op) {
      case '+':
        return a + b;
      case '−':
      case '-':
        return a - b;
      case '×':
      case '*':
        return a * b;
      case '÷':
      case '/':
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const handleOperator = (nextOp: string) => {
    const inputValue = parseInternal(displayValue);

    if (previousValue === null) {
      setPreviousValue(inputValue);
      setExpression(`${formatDisplay(displayValue)} ${nextOp}`);
    } else if (operator) {
      if (waitingForOperand) {
        // Change operator
        setOperator(nextOp);
        setExpression(`${formatDisplay(formatNumberResult(previousValue))} ${nextOp}`);
        return;
      }
      const result = performCalculation(operator, previousValue, inputValue);
      if (isNaN(result) || !isFinite(result)) {
        setDisplayValue('Erro');
        setPreviousValue(null);
        setOperator(null);
        setExpression('');
        return;
      }
      const formattedResult = formatNumberResult(result);
      setDisplayValue(formattedResult);
      setPreviousValue(result);
      setExpression(`${formatDisplay(formattedResult)} ${nextOp}`);
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const handlePercentage = () => {
    const current = parseInternal(displayValue);
    if (previousValue !== null && operator) {
      // e.g. 500 + 10% = 500 + 50
      const percentVal = (previousValue * current) / 100;
      setDisplayValue(formatNumberResult(percentVal));
    } else {
      // 50% = 0.5
      setDisplayValue(formatNumberResult(current / 100));
    }
  };

  const handleEquals = () => {
    if (previousValue === null || !operator) return;
    const inputValue = parseInternal(displayValue);
    const result = performCalculation(operator, previousValue, inputValue);

    if (isNaN(result) || !isFinite(result)) {
      setDisplayValue('Erro');
    } else {
      const formatted = formatNumberResult(result);
      setDisplayValue(formatted);
      setExpression(`${formatDisplay(formatNumberResult(previousValue))} ${operator} ${formatDisplay(displayValue)} =`);
    }
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handleCopyResult = async () => {
    if (displayValue === 'Erro') return;
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Keyboard navigation when calculator is open
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing into an input or textarea elsewhere
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === ',' || e.key === '.') {
        e.preventDefault();
        handleComma();
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('−');
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === '%' ) {
        e.preventDefault();
        handlePercentage();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (displayValue !== '0') {
          handleClear();
        } else {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, displayValue, previousValue, operator, waitingForOperand]);

  // Mouse & Touch Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: rect ? rect.left : 0,
      posY: rect ? rect.top : 0,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    const rect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      posX: rect ? rect.left : 0,
      posY: rect ? rect.top : 0,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 380, dragRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 280, dragRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 350, dragRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <>
      {/* Botão Flutuante Discreto na Tela (Canto Inferior Direito) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-16 md:bottom-6 right-4 sm:right-6 z-40 p-3.5 bg-gradient-to-tr from-emerald-900 to-emerald-800 text-white hover:from-emerald-800 hover:to-emerald-700 rounded-2xl shadow-xl border border-emerald-600/40 flex items-center gap-2 group transition active:scale-95 cursor-pointer"
          title="Abrir Calculadora de Apoio Administrativo"
          aria-label="Abrir Calculadora"
        >
          <div className="relative">
            <CalcIcon className="w-5 h-5 text-amber-300 transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <span className="text-xs font-bold hidden sm:inline text-amber-100">
            Calculadora
          </span>
        </button>
      )}

      {/* Janela Flutuante da Calculadora */}
      {isOpen && (
        <div
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px`, position: 'fixed' }
              : undefined
          }
          className={`${
            position ? '' : 'fixed bottom-16 md:bottom-6 right-3 sm:right-6'
          } z-50 w-72 sm:w-80 bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden transition-all duration-150 select-none`}
        >
          {/* Header Arrastável */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="p-3 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b border-slate-800 flex items-center justify-between cursor-move shrink-0"
            title="Arraste para reposicionar a calculadora"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CalcIcon className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-100">Calculadora</span>
                <span className="block text-[9px] text-emerald-400 font-semibold tracking-wider uppercase">
                  Uso Administrativo
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Se Minimizada, exibe apenas visor compacto */}
          {isMinimized ? (
            <div className="p-3 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-300">
                  {formatDisplay(displayValue)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="p-1 text-slate-400 hover:text-emerald-400 rounded transition cursor-pointer"
                  title="Copiar resultado"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Visor da Calculadora */}
              <div className="p-3.5 bg-slate-950 border-b border-slate-800/80 space-y-1">
                {/* Expressão / Histórico */}
                <div className="h-4 text-[11px] text-slate-400 font-mono text-right truncate">
                  {expression || '\u00A0'}
                </div>
                {/* Visor Principal */}
                <div className="text-right text-2xl sm:text-3xl font-black font-mono tracking-tight text-white overflow-x-auto whitespace-nowrap scrollbar-none py-1">
                  {formatDisplay(displayValue)}
                </div>
                {/* Barra de Ação Rápida: Copiar Resultado */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-medium">
                    Apoio financeiro autônomo
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 px-2 py-0.5 rounded-md transition cursor-pointer"
                    title="Copiar resultado para colar em qualquer campo"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar resultado</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Teclado da Calculadora */}
              <div className="p-3 bg-slate-900 grid grid-cols-4 gap-1.5 text-xs font-bold">
                {/* Linha 1 */}
                <button
                  type="button"
                  onClick={handleClear}
                  className="py-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 transition active:scale-95 cursor-pointer"
                  title="Limpar tudo (AC)"
                >
                  AC
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Apagar último dígito"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePercentage}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Porcentagem (%)"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('÷')}
                  className="py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-amber-300 border border-emerald-700/40 text-base font-black transition active:scale-95 cursor-pointer"
                  title="Dividir"
                >
                  ÷
                </button>

                {/* Linha 2 */}
                <button
                  type="button"
                  onClick={() => handleDigit('7')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('8')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('9')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('×')}
                  className="py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-amber-300 border border-emerald-700/40 text-base font-black transition active:scale-95 cursor-pointer"
                  title="Multiplicar"
                >
                  ×
                </button>

                {/* Linha 3 */}
                <button
                  type="button"
                  onClick={() => handleDigit('4')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('5')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('6')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('−')}
                  className="py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-amber-300 border border-emerald-700/40 text-base font-black transition active:scale-95 cursor-pointer"
                  title="Subtrair"
                >
                  −
                </button>

                {/* Linha 4 */}
                <button
                  type="button"
                  onClick={() => handleDigit('1')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('2')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('3')}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('+')}
                  className="py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-amber-300 border border-emerald-700/40 text-base font-black transition active:scale-95 cursor-pointer"
                  title="Somar"
                >
                  +
                </button>

                {/* Linha 5 */}
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="col-span-2 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm transition active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleComma}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-sm font-black transition active:scale-95 cursor-pointer"
                  title="Vírgula decimal"
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={handleEquals}
                  className="py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-base font-black shadow-md transition active:scale-95 cursor-pointer"
                  title="Calcular resultado (=)"
                >
                  =
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
