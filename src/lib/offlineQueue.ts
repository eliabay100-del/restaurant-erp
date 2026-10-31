// Offline order queue: IndexedDB write-behind for createOrder/addItemsToOrder.
// Every entry carries a clientKey; the server dedupes replays, so a queued
// order can be retried safely after the connection returns.

import { createOrder, addItemsToOrder } from '@/features/orders/actions';
import { newClientKey } from '@/lib/clientKey';

export type OfflineItem = {
  menuItemId: number;
  variantId?: number;
  quantity: number;
  note?: string;
  overridePrice?: number;
};

export type OfflineCreatePayload = {
  type: string;
  tableNumber?: string;
  note?: string;
  discount?: number;
  autoConfirm?: boolean;
  clientKey?: string;
  items: OfflineItem[];
};

export type OfflineAppendPayload = {
  orderId: number;
  clientKey?: string;
  items: OfflineItem[];
};

export type QueueEntry = {
  kind: 'create' | 'append';
  clientKey: string;
  payload: OfflineCreatePayload | OfflineAppendPayload;
  queuedAt: number;
  attempts: number;
};

const DB_NAME = 'warka-offline';
const STORE = 'orders';
const MAX_ATTEMPTS = 15;

type QueueListener = (counts: { pending: number; failed: number }) => void;
const listeners = new Set<QueueListener>();

export function onQueueChange(fn: QueueListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listQueued().then((entries) => {
    const pending = entries.filter((e) => e.attempts < MAX_ATTEMPTS).length;
    const failed = entries.length - pending;
    listeners.forEach((fn) => fn({ pending, failed }));
  }).catch(() => {});
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'clientKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueOrder(entry: QueueEntry): Promise<void> {
  await withStore('readwrite', (store) => store.put(entry));
  notify();
}

export async function listQueued(): Promise<QueueEntry[]> {
  const all = await withStore<QueueEntry[]>('readonly', (store) => store.getAll());
  return (all ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

async function removeQueued(clientKey: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(clientKey));
}

async function bumpAttempts(entry: QueueEntry): Promise<void> {
  await withStore('readwrite', (store) => store.put({ ...entry, attempts: entry.attempts + 1 }));
}

/**
 * A queued order only reaches the server when the connection returns, long
 * after the screen that created it emitted its socket event. Tell the other
 * terminals now so the kitchen and cashier lists repaint without a reload.
 */
function announceReplay(entry: QueueEntry): void {
  void import('@/lib/socket')
    .then(({ getSocket }) => {
      const socket = getSocket();
      if (!socket.connected) return;
      if (entry.kind === 'create') {
        const payload = entry.payload as OfflineCreatePayload;
        socket.emit('order:new', {
          orderType: payload.type,
          tableNumber: payload.tableNumber,
          replayed: true,
        });
      } else {
        const payload = entry.payload as OfflineAppendPayload;
        socket.emit('order:new', { orderId: payload.orderId, appended: true });
        socket.emit('order:status-update', { orderId: payload.orderId });
      }
    })
    .catch(() => {});
}

let draining = false;

export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const entries = await listQueued();
    for (const entry of entries) {
      if (entry.attempts >= MAX_ATTEMPTS) continue;
      try {
        const res =
          entry.kind === 'create'
            ? await createOrder(entry.payload as OfflineCreatePayload)
            : await addItemsToOrder(
                (entry.payload as OfflineAppendPayload).orderId,
                (entry.payload as OfflineAppendPayload).items,
                (entry.payload as OfflineAppendPayload).clientKey
              );
        if (res.success) {
          await removeQueued(entry.clientKey);
          notify();
          announceReplay(entry);
        } else {
          // Business rejection (bad auth, closed shift) — retry a few times,
          // then park the entry so it stops hammering the server.
          await bumpAttempts(entry);
          if (entry.attempts + 1 >= MAX_ATTEMPTS) notify();
        }
      } catch {
        // Network failure: keep the rest of the queue for the next retry.
        break;
      }
    }
  } finally {
    draining = false;
  }
}

let initialized = false;

export function initOfflineQueue(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    drainQueue();
  });
  window.setInterval(() => {
    if (navigator.onLine) drainQueue();
  }, 30000);
  window.setTimeout(() => {
    if (navigator.onLine) drainQueue();
  }, 1500);
}

export async function submitOfflineOrder(
  kind: 'create' | 'append',
  payload: OfflineCreatePayload | OfflineAppendPayload
): Promise<
  | { status: 'sent'; order: { id: number } & Record<string, unknown> }
  | { status: 'queued' }
  | { status: 'failed'; error: string }
> {
  const clientKey = (payload.clientKey as string | undefined) ?? newClientKey();
  const fullPayload = { ...payload, clientKey };

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const res =
        kind === 'create'
          ? await createOrder(fullPayload as OfflineCreatePayload)
          : await addItemsToOrder(
              (fullPayload as OfflineAppendPayload).orderId,
              (fullPayload as OfflineAppendPayload).items,
              (fullPayload as OfflineAppendPayload).clientKey
            );
      if (res.success && res.order) {
        drainQueue();
        return { status: 'sent', order: res.order as { id: number } & Record<string, unknown> };
      }
      return { status: 'failed', error: res.error || 'Order failed' };
    } catch {
      // Network dropped mid-request — fall through and queue it.
    }
  }

  await enqueueOrder({ kind, clientKey, payload: fullPayload, queuedAt: Date.now(), attempts: 0 });
  return { status: 'queued' };
}
