import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Fatal: elemento #root não encontrado no DOM.');
} else {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (err: any) {
    console.error('Fatal initialization error:', err);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #022c22; color: white; padding: 20px; font-family: system-ui, sans-serif;">
        <div style="background: #064e3b; border: 1px solid rgba(251, 191, 36, 0.4); border-radius: 24px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: #022c22; border: 1px solid rgba(251, 191, 36, 0.4); color: #fcd34d; font-weight: 900; font-size: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">D</div>
          <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 6px; letter-spacing: -0.02em;">DMENOS CONTRO</h2>
          <p style="font-size: 13px; color: #a7f3d0; margin: 0 0 20px;">Falha ao carregar a interface inicial.</p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; font-size: 12px; font-family: monospace; color: #fca5a5; margin-bottom: 20px; text-align: left; word-break: break-all;">
            ${err?.message || 'Erro inesperado na inicialização.'}
          </div>
          <button onclick="window.location.reload()" style="background: #fcd34d; color: #022c22; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer; width: 100%;">
            Recarregar Sistema
          </button>
        </div>
      </div>
    `;
  }
}
