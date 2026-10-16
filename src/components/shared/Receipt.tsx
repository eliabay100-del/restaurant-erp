'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatDateTime, formatPrice, getLocaleName } from '@/lib/utils';
import { TAX_RATE } from '@/lib/money';
import Icon from '@/components/shared/Icon';

export interface ReceiptLine {
  nameEn: string;
  nameAm: string | null;
  qty: number;
  unitPrice: number;
  total: number;
  note?: string | null;
}

export interface ReceiptData {
  orderNumber: string;
  type: string;
  tableNumber: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  note?: string | null;
  createdAt: string;
  staffName: string;
  staffNameAm: string | null;
  lines: ReceiptLine[];
  payment?: {
    method: string;
    amountPaid: number;
    amountDue: number;
    changeGiven: number;
    reference?: string | null;
  } | null;
}

const METHOD_LABELS: Record<string, { en: string; am: string }> = {
  CASH: { en: 'Cash', am: 'ጥሩ ገንዘብ' },
  CARD: { en: 'Card', am: 'ካርድ' },
  MOBILE: { en: 'Mobile', am: 'ሞባይል' },
};

/**
 * Printable receipt. Rendered both on screen and (via `@media print`) on paper.
 * Keep the layout narrow so it looks right on a 80 mm thermal printer.
 */
export function Receipt({ data }: { data: ReceiptData }) {
  const locale = useLocale();
  const t = useTranslations('payment');
  const tc = useTranslations('common');
  const am = locale === 'am';
  const taxRate = TAX_RATE * 100;
  const method = data.payment
    ? (METHOD_LABELS[data.payment.method] ?? { en: data.payment.method, am: data.payment.method })
    : null;

  return (
    <div className="receipt" id="print-area">
      <div className="receipt-header">
        <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{tc('appName')}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tc('tagline')}</div>
      </div>

      <div className="receipt-meta">
        <div><span>{t('receipt')}:</span> {t('receiptNumber', { number: data.orderNumber })}</div>
        <div><span>{t('dateTime')}:</span> {formatDateTime(data.createdAt, locale)}</div>
        <div><span>{t('cashier')}:</span> {getLocaleName(data.staffName, data.staffNameAm, locale)}</div>
        <div>
          <span>{am ? 'ዓይነት' : 'Type'}:</span>{' '}
          {am ? (data.type === 'DINE_IN' ? 'እዚህ መብላት' : 'ለመውሰድ') : data.type === 'DINE_IN' ? 'Dine In' : 'Takeout'}
          {data.tableNumber ? ` · T${data.tableNumber}` : ''}
        </div>
      </div>

      <div className="receipt-divider" />

      <table className="receipt-table">
        <thead>
          <tr>
            <th></th>
            <th style={{ textAlign: 'right' }}>{am ? 'ብዛት' : 'Qty'}</th>
            <th style={{ textAlign: 'right' }}>{am ? 'ዋጋ' : 'Price'}</th>
            <th style={{ textAlign: 'right' }}>{am ? 'ጠቅላላ' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={i}>
              <td className="receipt-item-name">
                {getLocaleName(line.nameEn, line.nameAm, locale)}
                {line.note && <span className="receipt-item-note">{line.note}</span>}
              </td>
              <td style={{ textAlign: 'right' }}>{line.qty}</td>
              <td style={{ textAlign: 'right' }}>{formatPrice(line.unitPrice, locale)}</td>
              <td style={{ textAlign: 'right' }}>{formatPrice(line.total, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      <div className="receipt-totals">
        <div><span>{am ? 'ንዑስ ጠቅላላ' : 'Subtotal'}</span><span>{formatPrice(data.subtotal, locale)}</span></div>
        {data.discount > 0 && (
          <div><span>{am ? 'ቅናሽ' : 'Discount'}</span><span>−{formatPrice(data.discount, locale)}</span></div>
        )}
        <div><span>{am ? `ግብር (${taxRate}%)` : `VAT (${taxRate}%)`}</span><span>{formatPrice(data.taxAmount, locale)}</span></div>
        <div className="receipt-grand"><span>{am ? 'ጠቅላላ' : 'TOTAL'}</span><span>{formatPrice(data.total, locale)}</span></div>
      </div>

      {data.payment && method && (
        <>
          <div className="receipt-divider" />
          <div className="receipt-totals">
            <div>
              <span>{am ? 'የተከፈለ' : 'Paid'} ({am ? method.am : method.en})</span>
              <span>{formatPrice(data.payment.amountPaid, locale)}</span>
            </div>            {data.payment.changeGiven > 0 && (
              <div><span>{am ? 'ትእምር' : 'Change'}</span><span>{formatPrice(data.payment.changeGiven, locale)}</span></div>
            )}
            {data.payment.reference && (
              <div><span>{am ? 'ማራገጫ' : 'Ref'}</span><span>{data.payment.reference}</span></div>
            )}
          </div>
        </>
      )}

      <div className="receipt-divider" />
      <div className="receipt-thanks">{t('thankYou')}</div>
    </div>
  );
}

export function ReceiptModal({
  data,
  onClose,
}: {
  data: ReceiptData;
  onClose: () => void;
}) {
  const t = useTranslations('payment');
  const tc = useTranslations('common');

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-popIn" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.125rem' }}>{t('paymentComplete')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc('close')}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">
          <Receipt data={data} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="monitor" size={16} /> {t('printReceipt')}
          </button>
          <button className="btn btn-primary btn-lg" onClick={onClose} style={{ flex: 1 }}>
            {tc('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
