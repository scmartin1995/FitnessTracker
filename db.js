// Simple IndexedDB wrapper for Fitness App
const DB_NAME = 'fitness_app_db';
const DB_VERSION = 1;

// Entities:
// programs: {id, name, notes, createdAt}
// weeks: {id, programId, label, order}
// days: {id, weekId, label, order, exerciseIds: []}
// exercises: {id, name, notes}
// sessions: {id, dateISO, programId, weekId, dayId}
// sets: {id, sessionId, exerciseId, reps, weight, rpe, timestamp}

// also track lastWeight per exercise: {exerciseId -> number}
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains('programs')) {
          db.createObjectStore('programs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('weeks')) {
          const store = db.createObjectStore('weeks', { keyPath: 'id' });
          store.createIndex('by_program', 'programId');
        }
        if (!db.objectStoreNames.contains('days')) {
          const store = db.createObjectStore('days', { keyPath: 'id' });
          store.createIndex('by_week', 'weekId');
        }
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by_day', 'dayId');
        }
        if (!db.objectStoreNames.contains('sets')) {
          const store = db.createObjectStore('sets', { keyPath: 'id' });
          store.createIndex('by_session', 'sessionId');
          store.createIndex('by_exercise', 'exerciseId');
        }
        if (!db.objectStoreNames.contains('lastWeight')) {
          db.createObjectStore('lastWeight', { keyPath: 'exerciseId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(storeNames, mode='readonly') {
  const db = await openDB();
  return db.transaction(storeNames, mode);
}

function uid(prefix='id') {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export const DB = {
  async add(store, value) {
    const t = await tx([store], 'readwrite'); 
    const s = t.objectStore(store);
    return new Promise((res, rej) => {
      s.add(value);
      t.oncomplete = () => res(value);
      t.onerror = () => rej(t.error);
    });
  },
  async put(store, value) {
    const t = await tx([store], 'readwrite'); 
    const s = t.objectStore(store);
    return new Promise((res, rej) => {
      s.put(value);
      t.oncomplete = () => res(value);
      t.onerror = () => rej(t.error);
    });
  },
  async del(store, key) {
    const t = await tx([store], 'readwrite'); 
    const s = t.objectStore(store);
    return new Promise((res, rej) => {
      s.delete(key);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  },
  async get(store, key) {
    const t = await tx([store]); 
    const s = t.objectStore(store);
    return new Promise((res, rej) => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async all(store) {
    const t = await tx([store]); 
    const s = t.objectStore(store);
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  async indexGetAll(store, indexName, key) {
    const t = await tx([store]); 
    const s = t.objectStore(store);
    const idx = s.index(indexName);
    return new Promise((res, rej) => {
      const r = idx.getAll(key);
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  uid,
  async exportAll() {
    const stores = ['programs','weeks','days','exercises','sessions','sets','lastWeight'];
    const out = {};
    for (const st of stores) {
      out[st] = await this.all(st);
    }
    return out;
  },
  async importAll(json) {
    const stores = ['programs','weeks','days','exercises','sessions','sets','lastWeight'];
    const t = await tx(stores, 'readwrite');
    return new Promise((res, rej) => {
      for (const st of stores) {
        const s = t.objectStore(st);
        (json[st] || []).forEach(item => s.put(item));
      }
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
    });
  }
};
