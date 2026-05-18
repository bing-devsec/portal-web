// IndexedDB 原语与常量
// 对外暴露 openJsonToolDb / idbGet / idbPut / idbCount / idbDelete / idbGetAll，
// 以及数据库/对象仓库名、Tab 心跳记录类型等常量。
// 模块级 idbOpenPromise 单例保证整个应用只打开一次数据库连接。

export const IDB_DB_NAME = 'json-tool-db';
export const IDB_DB_VERSION = 2;
export const IDB_STORE_ARCHIVES = 'archivesByTab';
export const IDB_STORE_DIFF_DRAFTS = 'diffDraftByTab';
export const IDB_STORE_TAB_HEARTBEATS = 'tabHeartbeats';

// 大小/数量限制（被归档与 diff 草稿模块复用）
export const MAX_SINGLE_ARCHIVE_SIZE = 30 * 1024 * 1024; // 30MB（硬限制）
export const MAX_DIFF_SIDE_SIZE = 30 * 1024 * 1024; // 30MB（硬限制）
export const MAX_DIFF_TAB_COUNT = 30; // Diff 草稿最多保留 30 个标签页（tabId）

export interface TabHeartbeatRecord {
    tabId: string;
    updatedAt: number;
}

let idbOpenPromise: Promise<IDBDatabase> | null = null;

export const openJsonToolDb = (): Promise<IDBDatabase> => {
    if (typeof window === 'undefined') return Promise.reject(new Error('IndexedDB not available'));
    if (idbOpenPromise) return idbOpenPromise;
    idbOpenPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE_ARCHIVES)) {
                db.createObjectStore(IDB_STORE_ARCHIVES, { keyPath: 'tabId' });
            }
            if (!db.objectStoreNames.contains(IDB_STORE_DIFF_DRAFTS)) {
                db.createObjectStore(IDB_STORE_DIFF_DRAFTS, { keyPath: 'tabId' });
            }
            if (!db.objectStoreNames.contains(IDB_STORE_TAB_HEARTBEATS)) {
                db.createObjectStore(IDB_STORE_TAB_HEARTBEATS, { keyPath: 'tabId' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });
    return idbOpenPromise;
};

export const idbGet = async <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const db = await openJsonToolDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
    });
};

export const idbPut = async (storeName: string, value: any): Promise<void> => {
    const db = await openJsonToolDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB put failed'));
    });
};

export const idbCount = async (storeName: string): Promise<number> => {
    const db = await openJsonToolDb();
    return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB count failed'));
    });
};

export const idbDelete = async (storeName: string, key: IDBValidKey): Promise<void> => {
    const db = await openJsonToolDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'));
    });
};

export const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await openJsonToolDb();
    return await new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result ?? []) as T[]);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
    });
};
