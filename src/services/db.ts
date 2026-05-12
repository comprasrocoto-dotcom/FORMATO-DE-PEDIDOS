import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  setDoc,
  query,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Insumo, Proveedor } from '../types';

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  horario: string;
}

export const dbService = {
  // Subscribe to Insumos
  subscribeToInsumos: (callback: (insumos: Insumo[]) => void) => {
    const q = query(collection(db, 'insumos'));
    return onSnapshot(q, (snapshot) => {
      const insumos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insumo));
      callback(insumos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'insumos');
    });
  },

  // Subscribe to Proveedores
  subscribeToProveedores: (callback: (proveedores: Proveedor[]) => void) => {
    const q = query(collection(db, 'proveedores'));
    return onSnapshot(q, (snapshot) => {
      const proveedores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Proveedor));
      callback(proveedores);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'proveedores');
    });
  },

  // Subscribe to Sedes
  subscribeToSedes: (callback: (sedes: Sede[]) => void) => {
    const q = query(collection(db, 'sedes'));
    return onSnapshot(q, (snapshot) => {
      const sedes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      callback(sedes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sedes');
    });
  },

  // Get and Increment Global Consecutive
  getNextGlobalConsecutive: async (): Promise<number> => {
    const configRef = doc(db, 'config', 'global');
    try {
      return await runTransaction(db, async (transaction) => {
        const configDoc = await transaction.get(configRef);
        if (!configDoc.exists()) {
          transaction.set(configRef, { consecutivoGlobal: 14 }); // Initialized to 14 as per request
          return 14;
        }
        const next = (configDoc.data().consecutivoGlobal || 0) + 1;
        transaction.update(configRef, { consecutivoGlobal: next });
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/global');
      return 0;
    }
  },

  // Set Global Consecutive
  setGlobalConsecutive: async (value: number) => {
    const configRef = doc(db, 'config', 'global');
    try {
      await updateDoc(configRef, { consecutivoGlobal: value });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/global');
    }
  },

  // Get and Increment Provider Consecutive
  getNextProviderConsecutive: async (proveedorId: string): Promise<number> => {
    const configRef = doc(db, 'config', 'global'); // We can store them all in the same config doc or separate ones
    try {
      return await runTransaction(db, async (transaction) => {
        const configDoc = await transaction.get(configRef);
        const data = configDoc.exists() ? configDoc.data() : {};
        const currentByProvider = data.consecutivoPorProveedor || {};
        const current = currentByProvider[proveedorId] || 0;
        const next = current + 1;
        
        transaction.set(configRef, {
          ...data,
          consecutivoPorProveedor: {
            ...currentByProvider,
            [proveedorId]: next
          }
        }, { merge: true });
        
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/global');
      return 0;
    }
  },

  // Initialize DB if empty
  initializeIfEmpty: async (mockInsumos: any[], mockProveedores: any[], mockSedes: any[]) => {
    try {
      const configRef = doc(db, 'config', 'global');
      const configSnap = await getDoc(configRef);
      
      if (!configSnap.exists()) {
        console.log("Initializing database with mock data...");
        // This is a simplified initialization
        for (const p of mockProveedores) {
          await setDoc(doc(db, 'proveedores', p.id), p);
        }
        for (const i of mockInsumos) {
          await setDoc(doc(db, 'insumos', i.id), i);
        }
        for (const s of mockSedes) {
          await setDoc(doc(db, 'sedes', s.id), {
            nombre: s.nombre,
            direccion: s.direccion,
            horario: s.horario
          });
        }
        await setDoc(configRef, { consecutivoGlobal: 13 });
      }
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }
};
