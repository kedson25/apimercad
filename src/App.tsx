import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GeminiPhotoScanner } from './components/GeminiPhotoScanner';
import { CsvMatcherTab } from './components/CsvMatcherTab';
import { CsvUploadTab } from './components/CsvUploadTab';
import { KitSearchTab } from './components/KitSearchTab';
import { CsvItem } from './types/csvMatcher';
import { fetchInitialConfig } from './services/mlApi';
import { loadAllItemsFromDesti, saveAllCsvItemsToDesti } from './services/firebase';

const DEFAULT_CSV_ITEMS: CsvItem[] = [
  { id: '2000011394670471', itens: 'Kit 10 Anilhas De Latão Para Compressão P/tubo De 1/8', valorUsd: '9.86', valorReal: '49.99', qtdItens: '1', cepBuyer: '95076000', mlb: 'MLB3849102931', mlbId: 'MLB3849102931' },
  { id: '2000014933997280', itens: 'Conector De Porcelana Bipolar 10mm2 50a - Kit Com 10 Peças', valorUsd: '14.53', valorReal: '73.50', qtdItens: '1', cepBuyer: '68515000', mlb: 'MLB3910293847', mlbId: 'MLB3910293847' },
  { id: '2000015022645874', itens: 'Multivitamínico Gnc Para Megaenergia E Metabolismo P/ Homens Sem Sabor', valorUsd: '67.42', valorReal: '340.76', qtdItens: '1', cepBuyer: '88066000', mlb: 'MLB4019283746', mlbId: 'MLB4019283746' },
  { id: '2000015111037864', itens: 'Lixeira Basculante 12 Litros Banheiro Escritorio Pia Cozinha + Kit 2 Lixeira Cesto Cozinha Banheiro 09l Inox Tampa Click', valorUsd: '17.42', valorReal: '89.70', qtdItens: '3', cepBuyer: '12051823', mlb: 'MLB4129384756, MLB4129384799', mlbId: 'MLB4129384756' },
  { id: '2000015183075034', itens: 'Pulseira Masculina Feminina De Bolinha Pedra Vulcânica 8mm', valorUsd: '3.82', valorReal: '19.89', qtdItens: '1', cepBuyer: '11717295', mlb: 'MLB3748291023', mlbId: 'MLB3748291023' },
  { id: '2000015226758032', itens: 'Maquina De Cortar Cabelo Masculino Faz Pezinho E Desenho Cor Prateado', valorUsd: '4.41', valorReal: '22.97', qtdItens: '1', cepBuyer: '26551090', mlb: 'MLB3659182734', mlbId: 'MLB3659182734' },
  { id: '2000015381629086', itens: 'Controle Joystick Sem Fio Nintendo Switch Nintendo Ns2 Pro Controller + Stand The Legend Of Zelda 40th Anniversary Edition Verde Preto Dourado', valorUsd: '197.27', valorReal: '997.06', qtdItens: '1', cepBuyer: '13214659', mlb: 'MLB4291827364', mlbId: 'MLB4291827364' },
  { id: '2000015385271502', itens: 'Cabo Coaxial Fina Flexível 8 Metros Rosca P/ Tv Digital E Mas', valorUsd: '7.52', valorReal: '37.99', qtdItens: '1', cepBuyer: '03289000', mlb: 'MLB3581920384', mlbId: 'MLB3581920384' },
  { id: '2000015403287496', itens: 'Cuba Inox Gourmet Cozinha Quadrada 60x40 Com Cesto Drenagem Preto', valorUsd: '47.55', valorReal: '248.99', qtdItens: '1', cepBuyer: '87303230', mlb: 'MLB4381920345', mlbId: 'MLB4381920345' },
  { id: '2000015405593014', itens: 'Fone De Ouvido Kz Edx Pro Retorno De Palco S/ Microfone', valorUsd: '8.77', valorReal: '45.90', qtdItens: '1', cepBuyer: '18552218', mlb: 'MLB3491827365', mlbId: 'MLB3491827365' },
  { id: '2000015423966052', itens: 'Kit Com 6 Pares De Meia Cano Longo Algodão Confortável Cinza 39-43', valorUsd: '5.55', valorReal: '28.99', qtdItens: '1', cepBuyer: '25946500', mlb: 'MLB3391827361', mlbId: 'MLB3391827361' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [csvItems, setCsvItems] = useState<CsvItem[]>(DEFAULT_CSV_ITEMS);

  useEffect(() => {
    fetchInitialConfig().catch(() => {});
    loadAllItemsFromDesti()
      .then((fbItems) => {
        if (fbItems.length > 0) {
          setCsvItems(fbItems);
        } else {
          saveAllCsvItemsToDesti(DEFAULT_CSV_ITEMS).catch(() => {});
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
