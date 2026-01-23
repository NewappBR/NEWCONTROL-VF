
import { Order } from '../types';
import { MOCK_ORDERS } from '../constants';

const DB_NAME = 'NewcomPCP_DB';
const STORE_NAME = 'orders';
const DB_VERSION = 1;

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
                    saveOrders(parsed).then(() => {
                        // Limpa LocalStorage antigo para liberar memória
                        localStorage.removeItem('pcp_orders');
                    });
                    resolve(parsed);
                    return;
                } catch (e) {
                    console.error("Erro na migração:", e);
                }
            }
            // Se não tem local, retorna Mock inicial e salva
            saveOrders(MOCK_ORDERS);
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

export const saveOrders = async (orders: Order[]): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Limpa e reescreve é a estratégia mais segura para garantir sincronia com o React State neste modelo simples
      // Para apps maiores, faríamos updates pontuais.
      store.clear().onsuccess = () => {
          orders.forEach(order => {
              store.put(order);
          });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Erro ao salvar ordens:", error);
    throw error;
  }
};
