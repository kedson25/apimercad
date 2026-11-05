import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GeminiPhotoScanner } from './components/GeminiPhotoScanner';
import { CsvMatcherTab } from './components/CsvMatcherTab';
import { KitSearchTab } from './components/KitSearchTab';
import { CsvItem } from './types/csvMatcher';
import { fetchInitialConfig } from './services/mlApi';

export default function App() {
  // Default tab when refreshing/opening the app: 'scanner' (Busca por Foto)
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [csvItems, setCsvItems] = useState<CsvItem[]>([]);

  // Sync initial config from server quietly in background without changing active tab
  useEffect(() => {
    fetchInitialConfig().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Header with Busca por Foto, Busca por Nome and Pesquisa por Kit */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scanner' && <GeminiPhotoScanner />}

        {activeTab === 'csv' && (
          <CsvMatcherTab items={csvItems} onItemsChange={setCsvItems} />
        )}

        {activeTab === 'kit' && (
          <KitSearchTab csvItems={csvItems} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Mercado Livre Hub
          </span>
          <span className="text-[11px] text-slate-400">
            Sistema de Busca Inteligente
          </span>
        </div>
      </footer>
    </div>
  );
}
