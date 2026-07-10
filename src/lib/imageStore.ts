import type { GenerationResult } from "@/lib/types";

const DB_NAME = "line-manga-image-store";
const DB_VERSION = 1;
const STORE_NAME = "images";
const RECORD_KEY = "current";

export type StoredImagePayload = {
  generation: GenerationResult | null;
  generationByPatternId: Record<string, GenerationResult>;
  revisedGeneration: GenerationResult | null;
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB を開けませんでした。"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

const runStoreRequest = <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) =>
  openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作に失敗しました。"));
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB トランザクションに失敗しました。"));
        };
      })
  );

export const saveImagePayload = async (payload: StoredImagePayload) => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  try {
    await runStoreRequest("readwrite", (store) => store.put(payload, RECORD_KEY));
  } catch {
    // ignore quota/storage errors
  }
};

export const loadImagePayload = async (): Promise<StoredImagePayload | null> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return null;
  }
  try {
    const result = await runStoreRequest<StoredImagePayload | undefined>("readonly", (store) =>
      store.get(RECORD_KEY)
    );
    if (!result) {
      return null;
    }
    return {
      generation: result.generation ?? null,
      generationByPatternId: result.generationByPatternId ?? {},
      revisedGeneration: result.revisedGeneration ?? null
    };
  } catch {
    return null;
  }
};

export const clearImagePayload = async () => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  try {
    await runStoreRequest("readwrite", (store) => store.delete(RECORD_KEY));
  } catch {
    // ignore storage errors
  }
};
