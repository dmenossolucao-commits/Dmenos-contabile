import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  WifiOff,
  Server,
  Database,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';

interface AuthModalProps {
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const {
    login,
    setupInitialAdmin,
    resetAdminPassword,
    needsInitialSetup,
    connectionError,
    retryConnection,
    authDiagnostic,
    isVercelOrClientMode
  } = useAuth();

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [isResetMode, setIsResetMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryConnection();
    } finally {
      setRetrying(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Por favor, informe seu nome de usuário e sua senha.');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('Informe o nome de usuário desejado para o administrador.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setLoading(true);
    try {
      await setupInitialAdmin(username.trim(), password, displayName.trim());
      setSuccessMsg('Administrador configurado com sucesso! Entrando no sistema...');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao configurar administrador.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('Informe o nome de usuário do Administrador.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A nova senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('A confirmação da senha não confere com a nova senha digitada.');
      return;
    }

    setLoading(true);
    try {
      await resetAdminPassword(username.trim(), password);
      setSuccessMsg('Senha do Administrador redefinida com sucesso! Entrando no sistema...');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir senha do administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-900/10 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Dark Green & Gold Branding */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-xl" />

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-800/80 border border-amber-400/40 text-amber-300 shadow-inner mb-3">
            {connectionError ? <WifiOff className="w-9 h-9 text-rose-300" /> : <ShieldCheck className="w-9 h-9" />}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">DMENOS CONTRO</h1>
          <p className="text-xs text-amber-300 font-semibold tracking-wider uppercase mt-1">
            Sistema de Controle Financeiro
          </p>
          <p className="text-xs text-slate-300 mt-2">
            {connectionError
              ? 'Problema de Conexão com o Banco de Dados'
              : needsInitialSetup
              ? 'Primeiro Acesso — Configuração Inicial do Administrador'
              : isResetMode
              ? 'Redefinir Acesso do Administrador'
              : 'Acesso autenticado por Usuário e Senha'}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {/* Connection Warning Banner */}
          {connectionError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block font-bold text-amber-950 mb-0.5">
                    Aviso de Conexão com o Banco
                  </strong>
                  <span>{connectionError}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="py-1.5 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Reconectando...' : 'Reconectar'}</span>
                </button>
                <span className="text-[10px] text-amber-800">
                  Você ainda pode preencher seus dados e tentar o acesso.
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 flex flex-col gap-1.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              {!isResetMode && !needsInitialSetup && (
                <p className="text-[11px] text-slate-600 pl-6 mt-1">
                  Se você precisa redefinir suas credenciais de administrador, clique em{' '}
                  <strong
                    onClick={() => {
                      setIsResetMode(true);
                      setErrorMsg('');
                    }}
                    className="text-emerald-800 underline cursor-pointer hover:text-emerald-950"
                  >
                    Redefinir Senha do Administrador
                  </strong>
                  .
                </p>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <>
              {needsInitialSetup ? (
                /* INITIAL ADMIN SETUP FORM */
                <form onSubmit={handleSetupSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                    <strong className="block font-bold mb-0.5 text-amber-950">
                      Configuração Única do Administrador
                    </strong>
                    Nenhum administrador está cadastrado no banco compartilhado. Cadastre o usuário e a senha principais agora. Esta etapa é executada uma única vez.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome do Administrador
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ex: Gerente Geral / Administrador"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome de Usuário (Login) *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ex: admin"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800 lowercase"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Utilize letras e números sem espaços.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senha do Administrador *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                        title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white font-bold text-sm transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-amber-300" />
                        <span>Criar Administrador e Iniciar</span>
                      </>
                    )}
                  </button>
                </form>
              ) : isResetMode ? (
                /* RESET ADMIN PASSWORD FORM */
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs leading-relaxed">
                    <strong className="block font-bold text-emerald-900 mb-0.5">
                      Redefinição Segura de Administrador
                    </strong>
                    Defina um novo usuário e senha para o Administrador principal. O registro será gravado no banco compartilhado e você entrará diretamente no sistema.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Usuário do Administrador *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ex: admin"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800 lowercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nova Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmar Nova Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                        title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setErrorMsg('');
                      }}
                      className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                          <span>Salvar e Entrar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* STANDARD LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nome de Usuário
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Seu usuário (ex: admin)"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800 lowercase"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">Senha</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showPassword ? 'Ocultar senha' : 'Ver senha'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-slate-800"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white font-bold text-sm transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Entrar no Sistema</span>
                        <ArrowRight className="w-4 h-4 text-amber-300" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setErrorMsg('');
                      }}
                      className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Esqueceu ou precisa redefinir a senha do Administrador?</span>
                    </button>
                  </div>

                  <div className="mt-4 text-center text-xs text-slate-500 pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-slate-600 font-medium">
                      Acesso compartilhado: AI Studio, Vercel, celular e computador.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Novos funcionários são cadastrados pelo administrador no menu "Usuários e Acessos".
                    </p>
                  </div>
                </form>
              )}
            </>

          {/* Safe Production & Connection Diagnostic Panel */}
          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-700 py-1 cursor-pointer transition"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Diagnóstico do Banco e Ambiente (Produção)</span>
              </span>
              {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDiagnostics && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Ambiente:</span>
                  <span className="font-semibold text-slate-800">
                    {isVercelOrClientMode ? 'Vercel / SPA Web' : 'AI Studio / Servidor Node'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Projeto Firebase:</span>
                  <span className="font-mono text-[10px] text-slate-700">{authDiagnostic.projectId}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Banco Firestore:</span>
                  <span className="font-mono text-[10px] text-slate-700 truncate max-w-[200px]" title={authDiagnostic.databaseId}>
                    {authDiagnostic.databaseId}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Status da Conexão:</span>
                  <span className={`font-semibold flex items-center gap-1 ${authDiagnostic.status === 'connected' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${authDiagnostic.status === 'connected' ? 'bg-emerald-600' : 'bg-rose-500'}`} />
                    {authDiagnostic.status === 'connected' ? 'Conectado' : 'Falha na conexão'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Administrador Detectado:</span>
                  <span className="font-semibold text-slate-800">
                    {authDiagnostic.hasAdmin ? `Sim (${authDiagnostic.adminUsernames.join(', ')})` : 'Não localizado'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Última Verificação:</span>
                  <span className="text-slate-600">{authDiagnostic.lastCheckedAt}</span>
                </div>

                {authDiagnostic.errorMessage && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-100/70 text-rose-900 text-[10px] leading-tight">
                    <strong>Diagnóstico:</strong> {authDiagnostic.errorMessage}
                    {authDiagnostic.suggestion && <div className="mt-0.5 text-rose-800">{authDiagnostic.suggestion}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
