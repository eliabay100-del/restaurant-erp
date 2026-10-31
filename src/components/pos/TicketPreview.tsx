'use client';

import { useLocale } from 'next-intl';
import { useRef } from 'react';

interface TicketItem { quantity: number; itemNameEn: string; itemNameAm?: string | null; note?: string | null; }
interface TicketData { orderNumber: string; tableNumber?: string | null; channel: string; createdAt: string; items: TicketItem[]; }

export default function TicketPreview({ ticket }: { ticket: TicketData }) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  const print = () => {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write('<html><head><title>Ticket</title><style>' +
      'body{font-family:monospace;font-size:12px;margin:0;padding:8px;width:80mm}' +
      '.c{text-align:center}.b{font-weight:bold}.dashed{border-top:1px dashed #000;margin:6px 0}' +
      'table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}' +
      '</style></head><body>' + (ref.current?.innerHTML || '') + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  return (
    <div>
      <div ref={ref} className="ticket-print" style={{ fontFamily: 'monospace', fontSize: 12, width: '80mm', padding: 8, background: '#fff', color: '#000' }}>
        <div className="c b">BUNA DINE</div>
        <div className="c">Order Ticket</div>
        <div className="dashed" />
        <div>Order: {ticket.orderNumber}</div>
        {ticket.tableNumber && <div>Table: {ticket.tableNumber}</div>}
        <div>Channel: {ticket.channel}</div>
        <div>Time: {new Date(ticket.createdAt).toLocaleString()}</div>
        <div className="dashed" />
        <table>
          <tbody>
            {ticket.items.map((it, i) => (
              <tr key={i}>
                <td style={{ width: 30 }}>{it.quantity}x</td>
                <td>{locale === 'am' ? (it.itemNameAm || it.itemNameEn) : it.itemNameEn}{it.note ? ` (${it.note})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dashed" />
        <div className="c">--- Thank you ---</div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={print} style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: 6 }}>Print (Thermal)</button>
      </div>
    </div>
  );
}
