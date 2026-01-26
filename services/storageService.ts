
import { Order } from '../types';
import { MOCK_ORDERS } from '../constants';

const DB_NAME = 'NewcomPCP_DB';
const STORE_NAME = 'orders';
const DB_VERSION = 1;
const SYNC_CHANNEL_NAME = 'newcom_sync_channel';

// Canal de comunicação para simular Backend em Tempo Real (Entre abas/janelas)
const syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);

// Utilitário para abrir o banco
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadOrders = async (): Promise<Order[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const orders = request.result;
        
        // Migração Automática: Se DB vazio, tenta pegar do LocalStorage ou Mock
        if (!orders || orders.length === 0) {
            const localData = localStorage.getItem('pcp_orders');
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    // Salva no DB novo
                    saveOrders(parsed, false).then(() => { // false para não gerar loop de sync na carga inicial
                        localStorage.removeItem('pcp_orders');
                    });
                    resolve(parsed);
                    return;
                } catch (e) {
                    console.error("Erro na migração:", e);
                }
            }
            // Se não tem local, retorna Mock inicial e salva
            saveOrders(MOCK_ORDERS, false);
            resolve(MOCK_ORDERS);
        } else {
            resolve(orders);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Erro ao abrir DB:", error);
    // Fallback de emergência
    return MOCK_ORDERS;
  }
};

// Adicionado parâmetro 'notify' para controlar se deve avisar outras abas
export const saveOrders = async (orders: Order[], notify: boolean = true): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Limpa e reescreve para garantir consistência total
      store.clear().onsuccess = () => {
          orders.forEach(order => {
              store.put(order);
          });
      };

      tx.oncomplete = () => {
          if (notify) {
              // Avisa outras instâncias que houve mudança (Simulação de Socket/Backend)
              syncChannel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
          }
          resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Erro ao salvar ordens:", error);
    throw error;
  }
};

// Função para ouvir mudanças de outras abas (Backend Simulation)
export const subscribeToChanges = (callback: () => void) => {
    syncChannel.onmessage = (event) => {
        if (event.data.type === 'DATA_UPDATED') {
            console.log("Recebendo atualização remota...");
            callback();
        }
    };
};
