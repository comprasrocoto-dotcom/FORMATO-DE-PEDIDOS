// emailService.ts — Envio de correos via EmailJS
// Configurar: VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
import { Pedido } from '../types';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || '';

function buildItemsHtml(pedido: Pedido): string {
  const rows = pedido.items.map(i =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.nombre}</td>` +
          `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.unidad}</td>` +
              `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold">${i.cantidad}</td>` +
                  `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${i.subtotal.toLocaleString('es-CO')}</td></tr>`
                    ).join('');
                      return `<table style="width:100%;border-collapse:collapse;font-size:13px">
                          <thead><tr style="background:#002060;color:white">
                                <th style="padding:10px;text-align:left">Articulo</th>
                                      <th style="padding:10px;text-align:center">Unidad</th>
                                            <th style="padding:10px;text-align:center">Cant</th>
                                                  <th style="padding:10px;text-align:right">Subtotal</th>
                                                      </tr></thead>
                                                          <tbody>${rows}</tbody>
                                                              <tfoot><tr style="background:#f8f8f8;font-weight:bold">
                                                                    <td colspan="3" style="padding:10px;text-align:right">TOTAL:</td>
                                                                          <td style="padding:10px;text-align:right">$${pedido.total.toLocaleString('es-CO')}</td>
                                                                              </tr></tfoot>
                                                                                </table>`;
                                                                                }

                                                                                export async function enviarCorreoPedido(pedido: Pedido): Promise<void> {
                                                                                  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
                                                                                      console.warn('EmailJS no configurado. Agrega VITE_EMAILJS_* en .env.local');
                                                                                          return;
                                                                                            }
                                                                                              const emailjs = await import('@emailjs/browser');
                                                                                                emailjs.init(PUBLIC_KEY);
                                                                                                  await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                                                                                                      to_email:      pedido.correoResponsable,
                                                                                                          to_name:       pedido.responsable,
                                                                                                              numero_pedido: pedido.numeroPedido,
                                                                                                                  proveedor:     pedido.proveedor,
                                                                                                                      sede:          pedido.puntoDeVenta,
                                                                                                                          direccion:     pedido.direccionEntrega,
                                                                                                                              horario:       pedido.horarioRecepcion,
                                                                                                                                  fecha:         pedido.fecha,
                                                                                                                                      notas:         pedido.notas || 'Sin notas.',
                                                                                                                                          items_html:    buildItemsHtml(pedido),
                                                                                                                                              total:         `$${pedido.total.toLocaleString('es-CO')}`,
                                                                                                                                                });
                                                                                                                                                }
