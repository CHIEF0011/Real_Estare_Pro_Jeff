const KEY = 'repro.data.v1';
const defaultSettings = { dueDay: 5, lateFee: 0, companyName: 'Real Estate Pro', receiptNote: 'Thank you for your payment', logoUrl:'', address:'Kilimani Rd, Nairobi, Kenya', contact:'+254 700 000000 • info@estate.pro', landlordName: '', theme:'light', primaryColor:'#111111', secondaryColor:'#f2f2f2' };
const seed = {
  settings: defaultSettings,
  users: [{ id:'u_admin', email:'demo@estate.pro', role:'admin' }, { id:'u_land', email:'landlord@estate.pro', role:'landlord' }, { id:'u_tenant', email:'tenant@estate.pro', role:'tenant' }],
  properties: [{ id:'p1', name:'Kilimani Heights', address:'Kilimani Rd, Nairobi' }],
  units: [{ id:'u1', propertyId:'p1', name:'A-101', bedrooms:2, bathrooms:1, size:70, status:'occupied' }, { id:'u2', propertyId:'p1', name:'A-102', bedrooms:1, bathrooms:1, size:45, status:'vacant' }],
  tenants: [{ id:'t1', name:'Jane Doe', email:'jane@example.com', phone:'+254700000001' }],
  leases: [{ id:'l1', unitId:'u1', tenantId:'t1', start:'2024-01-01', end:'2024-12-31', rent: 65000, deposit: 65000, frequency:'monthly' }],
  invoices: [],
  payments: [],
  maintenance: [{ id:'m1', propertyId:'p1', unitId:'u1', title:'Leaking sink', status:'open', created: new Date().toISOString() }],
  documents: [],
  messages: []
};
export function load() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : structuredClone(seed);
}
export function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function reset() { localStorage.removeItem(KEY); }
export function getSettings() { return load().settings || structuredClone(defaultSettings); }
export function setSettings(s) { const d = load(); d.settings = {...d.settings, ...s}; save(d); }

// IndexedDB asset store (blobs without base64)
const ASSET_DB = 'repro.assets.v1';
let _dbPromise;
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(ASSET_DB, 1);
    req.onupgradeneeded = ()=> req.result.createObjectStore('files');
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return _dbPromise;
}
export async function setAsset(key, fileOrBlob) {
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('files','readwrite');
    tx.objectStore('files').put(fileOrBlob, key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
export async function getAsset(key) {
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('files','readonly');
    const req = tx.objectStore('files').get(key);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}
export async function getAssetURL(key) {
  const blob = await getAsset(key);
  return blob ? URL.createObjectURL(blob) : null;
}
export async function deleteAsset(key) {
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('files','readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}