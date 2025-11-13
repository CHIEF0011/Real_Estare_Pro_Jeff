import dayjs from 'dayjs';
import { load, save, getSettings } from './storage.js';
import { uid } from './utils.js';

export function list(collection) { return load()[collection] || []; }
export function add(collection, item) { const d=load(); (d[collection] ||= []).push(item); save(d); return item; }
export function update(collection, id, patch) {
  const d=load(); const arr=d[collection]; const i=arr.findIndex(x=>x.id===id);
  if (i>-1) { arr[i] = {...arr[i], ...patch}; save(d); return arr[i]; }
  return null;
}
export function remove(collection, id) {
  const d=load(); d[collection] = d[collection].filter(x=>x.id!==id); save(d);
}

export function occupancy() {
  const units = list('units');
  const occupied = units.filter(u=>u.status==='occupied').length;
  return { occupied, total: units.length, vacant: units.length - occupied };
}

export function monthlyFigures() {
  const invoices = list('invoices'); const payments=list('payments');
  const map = new Map();
  const months = Array.from({length:6}).map((_,i)=>dayjs().subtract(5-i,'month').format('YYYY-MM'));
  for (const m of months) map.set(m, { month:m, due:0, collected:0 });
  invoices.forEach(inv=>{ const m=dayjs(inv.dueDate).format('YYYY-MM'); if(map.has(m)) map.get(m).due += Number(inv.total); });
  payments.forEach(p=>{ const m=dayjs(p.date).format('YYYY-MM'); if(map.has(m)) map.get(m).collected += Number(p.amount); });
  return Array.from(map.values());
}

export function generateMonthlyInvoices() {
  const d = load();
  const settings = getSettings();
  const leases = d.leases || [];
  const month = dayjs().format('YYYY-MM');
  const targetDue = dayjs(`${month}-${String(settings.dueDay).padStart(2,'0')}`);
  const created = [];
  for (const lease of leases) {
    const startM = dayjs(lease.start).format('YYYY-MM');
    const endM = dayjs(lease.end).format('YYYY-MM');
    if (month < startM || month > endM) continue;
    const already = (d.invoices||[]).some(inv => inv.leaseId===lease.id && inv.month===month);
    if (already) continue;
    const inv = {
      id: uid('inv'),
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      month,
      issueDate: dayjs().toISOString(),
      dueDate: targetDue.toISOString(),
      items: [{ label:'Monthly Rent', qty:1, price: lease.rent }],
      total: lease.rent,
      status: 'unpaid'
    };
    d.invoices.push(inv);
    created.push(inv);
  }
  save(d);
  return created;
}

export function recordPayment({ invoiceId, amount, method='MPesa', ref='' }) {
  const d = load();
  const inv = d.invoices.find(i=>i.id===invoiceId);
  if (!inv) throw new Error('Invoice not found');
  const pay = { id: uid('pay'), invoiceId, tenantId: inv.tenantId, date: new Date().toISOString(), amount: Number(amount), method, ref };
  (d.payments ||= []).push(pay);
  const paid = (d.payments.filter(p=>p.invoiceId===invoiceId).reduce((a,b)=>a+b.amount,0));
  if (paid >= inv.total) inv.status='paid';
  save(d);
  return pay;
}

