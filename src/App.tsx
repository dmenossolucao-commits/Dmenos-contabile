/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { testConnection } from './firebase';

import { Dashboard } from './components/Dashboard';
import { DailyClosureView } from './components/DailyClosureView';
import { ExpensesValesView } from './components/ExpensesValesView';
import { BankAccountsView } from './components/BankAccountsView';
import { HistoryView } from './components/HistoryView';
import { CalendarView } from './components/CalendarView';
import { ReportsView } from './components/ReportsView';
import { UsersSecurityView } from './components/UsersSecurityView';
import { AuthModal } from './components/AuthModal';
import { PWAInstallButton } from './components/PWAInstallButton';

import {
  LayoutDashboard,
  FileSpreadsheet,
  TrendingDown,
  Landmark,
  History,
  Calendar,
  FileText,
  Users,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  WifiOff
} from 'lucide-react';

function MainLayout() {
  const { currentUser, role, isAdmin, permissions, loading, signOutApp } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Quick Action Modal Triggers from Dashboard
  const [openClosureModal, setOpenClosureModal] = useState(false);
  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [openValeModal, setOpenValeModal] = useState(false);
  const [openBankTransModal, setOpenBankTransModal] = useState(false);

  useEffect(() => {
    testConnection();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filter navigation items by role and permissions
  const navItems = useMemo(() => {
    const list = [];

    if (permissions.canViewDashboard) {
      list.push({ id: 'dashboard', label: 'Painel Principal', icon: LayoutDashboard });
    }
    if (permissions.canManageClosures) {
      list.push({ id: 'fechamento', label: 'Fechamento Diário', icon: FileSpreadsheet });
    }
    if (permissions.canManageExpenses || permissions.canManageVales) {
      list.push({ id: 'despesas', label: 'Saídas: Despesas, Vales & Boletos', icon: TrendingDown });
    }
    if (permissions.canManageBankAccounts) {
      list.push({ id: 'bancos', label: 'Contas Bancárias', icon: Landmark });
    }
    if (permissions.canViewHistory) {
      list.push({ id: 'historico', label: 'Histórico & Extratos', icon: History });
    }
    if (permissions.canManageCalendar) {
      list.push({ id: 'calendario', label: 'Calendário & Lembretes', icon: Calendar });
    }
    if (permissions.canViewReports) {
      list.push({ id: 'relatorios', label: 'Relatórios & PDF', icon: FileText });
    }
    if (isAdmin) {
      list.push({ id: 'usuarios', label: 'Usuários e Acessos', icon: Users });
    }

    return list;
  }, [permissions, isAdmin]);

  // Ensure user cannot stay on an unauthorized tab
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 border border-amber-400/40 text-amber-300 flex items-center justify-center font-black text-2xl shadow-2xl animate-pulse mb-4">
          D
        </div>
        <h2 className="text-xl font-black tracking-tight text-white">DMENOS CONTRO</h2>
        <p className="text-xs text-amber-300 font-medium tracking-wider uppercase mt-1">
          Carregando ambiente seguro...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      {/* Offline Toast */}
      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-emerald-950 font-bold text-xs shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>Modo Offline — Dados locais em uso.</span>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-emerald-950 text-white shrink-0 border-r border-emerald-900/60 shadow-xl">
        {/* Brand Header */}
        <div className="p-5 border-b border-emerald-900/60 bg-gradient-to-b from-emerald-900 to-emerald-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 border border-amber-400/50 text-amber-300 flex items-center justify-center font-black text-xl shadow-inner">
              D
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                DMENOS CONTRO
              </h1>
              <p className="text-[10px] text-amber-300 font-semibold tracking-wider uppercase">
                Controle Financeiro
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-emerald-800 text-amber-300 shadow-sm border border-emerald-700/60'
                    : 'text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-emerald-300/70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Sign Out at bottom */}
        <div className="p-3 border-t border-emerald-900/60 bg-emerald-950/80">
          <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-800/40 flex items-center justify-between mb-2">
            <div className="truncate">
              <span className="block text-xs font-bold text-white truncate">
                {currentUser.displayName}
              </span>
              <span className="text-[10px] text-emerald-300 font-mono block">
                @{currentUser.username}
              </span>
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider block mt-0.5">
                {isAdmin ? 'Administrador' : 'Funcionário'}
              </span>
            </div>
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
          </div>

          <button
            onClick={() => signOutApp()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Abrir Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-950 text-amber-300 flex items-center justify-center font-bold text-sm">
                D
              </div>
              <span className="font-black text-sm tracking-tight text-slate-900">
                DMENOS CONTRO
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Mercadinho • Gestão Financeira Diária
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* User status badge on top */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700">
                {currentUser.displayName} (@{currentUser.username})
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded">
                {isAdmin ? 'Admin' : 'Operador'}
              </span>
            </div>

            <button
              onClick={() => signOutApp()}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:text-rose-600 transition"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex">
            <div className="w-72 bg-emerald-950 text-white h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-emerald-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-sm">
                    D
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">DMENOS CONTRO</h3>
                    <p className="text-[10px] text-amber-300 uppercase">
                      {isAdmin ? 'Administrador' : 'Operador'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const active = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition ${
                        active
                          ? 'bg-emerald-800 text-amber-300'
                          : 'text-slate-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-emerald-900">
                <div className="px-2 py-1 mb-2 text-xs text-slate-300">
                  <span className="font-bold text-white block">{currentUser.displayName}</span>
                  <span className="text-[11px] text-emerald-300">@{currentUser.username}</span>
                </div>
                <button
                  onClick={() => signOutApp()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-900/80 text-rose-300 font-semibold text-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {activeTab === 'dashboard' && permissions.canViewDashboard && (
            <Dashboard
              onNavigate={(tab) => setActiveTab(tab)}
              onNewClosure={() => {
                setActiveTab('fechamento');
                setOpenClosureModal(true);
              }}
              onNewExpense={() => {
                setActiveTab('despesas');
                setOpenExpenseModal(true);
              }}
              onNewVale={() => {
                setActiveTab('despesas');
                setOpenValeModal(true);
              }}
              onNewBankTransaction={() => {
                setActiveTab('bancos');
                setOpenBankTransModal(true);
              }}
            />
          )}

          {activeTab === 'fechamento' && permissions.canManageClosures && (
            <DailyClosureView
              initialOpenModal={openClosureModal}
              onCloseModal={() => setOpenClosureModal(false)}
            />
          )}

          {activeTab === 'despesas' && (permissions.canManageExpenses || permissions.canManageVales) && (
            <ExpensesValesView
              initialTab={openValeModal ? 'vales' : 'despesas'}
              initialOpenModal={openExpenseModal || openValeModal}
            />
          )}

          {activeTab === 'bancos' && permissions.canManageBankAccounts && (
            <BankAccountsView initialOpenModal={openBankTransModal} />
          )}

          {activeTab === 'historico' && permissions.canViewHistory && (
            <HistoryView />
          )}

          {activeTab === 'calendario' && permissions.canManageCalendar && (
            <CalendarView />
          )}

          {activeTab === 'relatorios' && permissions.canViewReports && (
            <ReportsView />
          )}

          {activeTab === 'usuarios' && isAdmin && (
            <UsersSecurityView />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-emerald-950/95 backdrop-blur-md border-t border-emerald-900/60 px-2 py-1.5 flex items-center justify-around z-40 text-[10px]">
          {navItems.slice(0, 5).map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 p-1 ${
                  active ? 'text-amber-300 font-bold' : 'text-emerald-200/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainLayout />
      </FinanceProvider>
    </AuthProvider>
  );
}
