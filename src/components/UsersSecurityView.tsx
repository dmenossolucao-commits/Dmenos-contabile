import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, UserProfile, UserPermissions, getDefaultPermissions } from '../types';
import {
  ShieldCheck,
  UserCheck,
  UserPlus,
  Lock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  Info,
  Edit2,
  Trash2,
  UserX,
  X,
  Eye,
  EyeOff,
  Sliders,
  Check
} from 'lucide-react';
import { formatDateBR } from '../utils/formatters';

export const UsersSecurityView: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    systemUsers,
    createUser,
    updateUser,
    deleteUserAccount,
  } = useAuth();

  // Modals state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserProfile | null>(null);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(getDefaultPermissions('employee'));

  // Edit User Form State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editStatus, setEditStatus] = useState<'active' | 'blocked'>('active');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(getDefaultPermissions('employee'));

  // Reset Password State
  const [resetPassValue, setResetPassValue] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);

  // Feedback State
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Open Edit User Modal
  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPermissions(user.permissions || getDefaultPermissions(user.role));
    setErrorMsg('');
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user: UserProfile) => {
    setResettingPasswordUser(user);
    setResetPassValue('');
    setErrorMsg('');
  };

  // Submit New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newUsername.trim() || !newPassword || !newDisplayName.trim()) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('A senha inicial deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoadingAction(true);
    try {
      await createUser({
        username: newUsername.trim().toLowerCase(),
        displayName: newDisplayName.trim(),
        initialPassword: newPassword,
        role: newRole,
        permissions: newRole === 'admin' ? getDefaultPermissions('admin') : newPermissions,
      });

      showToast(`Usuário "${newUsername.trim()}" cadastrado com sucesso!`);
      setIsNewUserModalOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('employee');
      setNewPermissions(getDefaultPermissions('employee'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar usuário.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Submit Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg('');

    setLoadingAction(true);
    try {
      await updateUser(editingUser.id, {
        displayName: editDisplayName.trim(),
        role: editRole,
        status: editStatus,
        permissions: editRole === 'admin' ? getDefaultPermissions('admin') : editPermissions,
      });

      showToast(`Usuário "${editingUser.username}" atualizado com sucesso!`);
      setEditingUser(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar usuário.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Submit Password Reset
  const handleSavePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordUser) return;
    setErrorMsg('');

    if (resetPassValue.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoadingAction(true);
    try {
      await updateUser(resettingPasswordUser.id, {
        newPassword: resetPassValue,
      });

      showToast(`Senha de "${resettingPasswordUser.username}" redefinida com sucesso!`);
      setResettingPasswordUser(null);
      setResetPassValue('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Toggle user blocked / active
  const handleToggleBlock = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      alert('Você não pode bloquear seu próprio usuário de administrador.');
      return;
    }

    const nextStatus = user.status === 'active' ? 'blocked' : 'active';
    const actionLabel = nextStatus === 'blocked' ? 'bloquear' : 'desbloquear';

    if (!confirm(`Deseja realmente ${actionLabel} o acesso do usuário "${user.username}"?`)) {
      return;
    }

    try {
      await updateUser(user.id, { status: nextStatus });
      showToast(`Usuário "${user.username}" ${nextStatus === 'blocked' ? 'bloqueado' : 'desbloqueado'}!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar situação do usuário.');
    }
  };

  // Delete User
  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      alert('Você não pode excluir sua própria conta.');
      return;
    }

    if (!confirm(`Tem certeza de que deseja excluir permanentemente o acesso de "${user.username}"?`)) {
      return;
    }

    try {
      await deleteUserAccount(user.id);
      showToast(`Usuário "${user.username}" excluído.`);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir usuário.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 shadow-xs">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Acesso Restrito ao Administrador</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Apenas administradores do sistema podem visualizar, cadastrar e configurar permissões de usuários e acessos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-800 text-white shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-amber-300" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Usuários e Acessos
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Gerenciamento de Operadores
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle seguro de contas, senhas criptografadas e permissões por módulo financeiro.
          </p>
        </div>

        <button
          onClick={() => {
            setIsNewUserModalOpen(true);
            setErrorMsg('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-amber-300" />
          <span>Cadastrar Novo Usuário</span>
        </button>
      </div>

      {/* Security Principles & Role Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-800 text-amber-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-sm">Perfil Administrador</h3>
            <p className="text-emerald-800/80 mt-1 leading-relaxed">
              Acesso total: gerencia usuários e senhas, reabre fechamentos de caixa, visualiza todos os módulos bancários, extratos, relatórios completos e trilha de auditoria.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-800 text-slate-200 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Perfil Funcionário / Operador</h3>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Acesso personalizado: o administrador define individualmente quais módulos cada funcionário pode acessar (fechamento de caixa, despesas, vales, calendário, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Usuários Cadastrados ({systemUsers.length})
          </h2>
          <span className="text-xs text-slate-400">
            Senhas protegidas por criptografia PBKDF2 com Salt exclusivo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Usuário (Login)</th>
                <th className="py-3 px-4">Nome de Exibição</th>
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Módulos Liberados</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {systemUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                const isBlocked = u.status === 'blocked';
                const p = u.permissions || getDefaultPermissions(u.role);

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isBlocked ? 'bg-rose-50/40 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {u.username}
                      {isCurrent && (
                        <span className="ml-2 px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-sans font-semibold">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {u.displayName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role === 'admin' ? 'Administrador' : 'Funcionário'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isBlocked
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isBlocked ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'admin' ? (
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Todos os Módulos (Acesso Total)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.canManageClosures && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              Fechamento
                            </span>
                          )}
                          {p.canManageExpenses && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              Despesas
                            </span>
                          )}
                          {p.canManageVales && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              Vales
                            </span>
                          )}
                          {p.canManageBankAccounts && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                              Bancos
                            </span>
                          )}
                          {p.canViewHistory && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              Histórico
                            </span>
                          )}
                          {p.canManageCalendar && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              Agenda
                            </span>
                          )}
                          {p.canViewReports && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                              Relatórios
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Editar / Permissões */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition"
                          title="Editar dados e permissões"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Redefinir Senha */}
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition"
                          title="Redefinir Senha"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Bloquear / Desbloquear */}
                        {!isCurrent && (
                          <button
                            onClick={() => handleToggleBlock(u)}
                            className={`p-1.5 rounded-lg transition ${
                              isBlocked
                                ? 'hover:bg-emerald-100 text-emerald-700'
                                : 'hover:bg-rose-100 text-rose-600'
                            }`}
                            title={isBlocked ? 'Desbloquear usuário' : 'Bloquear acesso'}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Excluir (Não permite excluir a si mesmo) */}
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-700 transition"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CADASTRAR NOVO USUÁRIO */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-300" />
                  Cadastrar Novo Usuário
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Defina o nome de usuário único, senha inicial e permissões.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ex: joao, caixa2, repositor"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 lowercase font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Sem espaços, letras e números.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome Completo / Identificação *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Ex: João da Silva (Caixa Tarde)"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Senha Inicial *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full p-2.5 pr-9 rounded-xl border border-slate-200 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perfil de Acesso *</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setNewRole(r);
                      setNewPermissions(getDefaultPermissions(r));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white font-medium"
                  >
                    <option value="employee">Funcionário / Operador</option>
                    <option value="admin">Administrador (Acesso Total)</option>
                  </select>
                </div>
              </div>

              {/* Modular Permissions checkboxes (for employee) */}
              {newRole === 'employee' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-800" />
                    Permissões Individuais do Funcionário:
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Marque os módulos autorizados para este operador:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canManageClosures}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canManageClosures: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Fechamento Diário de Caixa</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canManageExpenses}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canManageExpenses: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Registrar Despesas</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canManageVales}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canManageVales: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Registrar / Quitar Vales</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canManageCalendar}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canManageCalendar: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Agenda & Lembretes</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canManageBankAccounts}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canManageBankAccounts: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Contas Bancárias & Cartões</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.canViewHistory}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canViewHistory: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Consultar Histórico Geral</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={newPermissions.canViewReports}
                        onChange={(e) =>
                          setNewPermissions({ ...newPermissions, canViewReports: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Emitir e Compartilhar Relatórios em PDF</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loadingAction ? 'Salvando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUÁRIO & PERMISSÕES */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-300" />
                  Editar Usuário: {editingUser.username}
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Ajuste de permissões por módulo e perfil de acesso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Completo / Exibição *
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perfil</label>
                  <select
                    value={editRole}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setEditRole(r);
                      setEditPermissions(getDefaultPermissions(r));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="employee">Funcionário / Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Situação da Conta</label>
                  <select
                    value={editStatus}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'blocked')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="active">Ativo (Acesso Permitido)</option>
                    <option value="blocked">Bloqueado (Acesso Negado)</option>
                  </select>
                </div>
              </div>

              {/* Permissions checkboxes */}
              {editRole === 'employee' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800">Módulos Liberados para este Funcionário:</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canManageClosures}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canManageClosures: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Fechamento Diário de Caixa</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canManageExpenses}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canManageExpenses: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Registrar Despesas</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canManageVales}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canManageVales: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Registrar / Quitar Vales</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canManageCalendar}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canManageCalendar: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Agenda & Lembretes</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canManageBankAccounts}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canManageBankAccounts: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Contas Bancárias & Cartões</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions.canViewHistory}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canViewHistory: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Consultar Histórico Geral</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={editPermissions.canViewReports}
                        onChange={(e) =>
                          setEditPermissions({ ...editPermissions, canViewReports: e.target.checked })
                        }
                        className="rounded text-emerald-700"
                      />
                      <span>Emitir e Compartilhar Relatórios em PDF</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REDEFINIR SENHA */}
      {resettingPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-amber-700">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">
                Redefinir Senha: {resettingPasswordUser.username}
              </h3>
            </div>
            <p className="text-slate-600">
              Defina a nova senha para o operador <strong>{resettingPasswordUser.displayName}</strong>.
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePasswordReset} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nova Senha *</label>
                <div className="relative">
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    value={resetPassValue}
                    onChange={(e) => setResetPassValue(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full p-2.5 pr-9 rounded-xl border border-slate-200 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingPasswordUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loadingAction ? 'Salvando...' : 'Confirmar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
