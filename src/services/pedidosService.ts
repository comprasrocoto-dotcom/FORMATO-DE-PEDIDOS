import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Pedido } from '../types';

const PEDIDOS_COL = 'pedidos';

export async function guardarPedido(pedido: Omit<Pedido, 'id' | 'creadoEn'>): Promise<string> {
  const docRef = await addDoc(collection(db, PEDIDOS_COL), {
      ...pedido,
          creadoEn: Timestamp.now(),
            });
              return docRef.id;
              }

              export function subscribeToPedidos(callback: (pedidos: Pedido[]) => void) {
                const q = query(collection(db, PEDIDOS_COL), orderBy('creadoEn', 'desc'));
                  return onSnapshot(q, (snap) => {
                      const pedidos = snap.docs.map(d => ({
                            id: d.id,
                                  ...d.data(),
                                        creadoEn: (d.data().creadoEn as Timestamp)?.toDate().toISOString() ?? '',
                                            })) as Pedido[];
                                                callback(pedidos);
                                                  });
                                                  }

                                                  export async function getNextNumeroPedido(): Promise<string> {
                                                    const ref = doc(db, 'config', 'global');
                                                      try {
                                                          const next = await runTransaction(db, async (tx) => {
                                                                const snap = await tx.get(ref);
                                                                      const data = snap.exists() ? snap.data() : {};
                                                                            const current = data.consecutivoGlobal ?? 0;
                                                                                  const nextNum = current + 1;
                                                                                        tx.set(ref, { ...data, consecutivoGlobal: nextNum }, { merge: true });
                                                                                              return nextNum;
                                                                                                  });
                                                                                                      return `OC-${String(next).padStart(4, '0')}`;
                                                                                                        } catch {
                                                                                                            return `OC-${Date.now()}`;
                                                                                                              }
                                                                                                              }
