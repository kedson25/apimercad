import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GeminiPhotoScanner } from './components/GeminiPhotoScanner';
import { CsvMatcherTab } from './components/CsvMatcherTab';
import { CsvUploadTab } from './components/CsvUploadTab';
import { KitSearchTab } from './components/KitSearchTab';
import { CsvItem } from './types/csvMatcher';
import { fetchInitialConfig } from './services/mlApi';
import { loadAllItemsFromDesti } from './services/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [csvItems, setCsvItems] = useState<CsvItem[]>([]);

  useEffect(() => {
    fetchInitialConfig().catch(() => {});
    loadAllItemsFromDesti()
      .then((fbItems) => {
        if (Array.isArray(fbItems) && fbItems.length > 0) {
          setCsvItems(fbItems);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        csvCount={csvItems.length}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'scanner' && <GeminiPhotoScanner csvItems={csvItems} />}

        {activeTab === 'csv' && (
          <CsvMatcherTab
            items={csvItems}
            onItemsChange={setCsvItems}
            onOpenUploadTab={() => setActiveTab('upload')}
          />
        )}

        {activeTab === 'upload' && (
          <CsvUploadTab items={csvItems} onItemsChange={setCsvItems} />
        )}

        {activeTab === 'kit' && (
          <KitSearchTab csvItems={csvItems} />
        )}
      </main>
    </div>
  );
}
