export const KES = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });
export const fmtKES = (n) => KES.format(Math.round(Number(n||0)));
export const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}`;
export const todayISO = () => new Date().toISOString().slice(0,10);
export const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
export const toCSV = (rows) => {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v??'').replace(/"/g,'""')}"`;
  const body = rows.map(r=>headers.map(h=>escape(r[h])).join(',')).join('\n');
  return headers.join(',')+'\n'+body;
};
export const download = (filename, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
export const formToObj = (form) => Object.fromEntries(new FormData(form).entries());
export const setActiveMenu = (route) => {
  document.querySelectorAll('.menu-item').forEach(b=>b.classList.toggle('active', b.dataset.route===route));
  document.getElementById('routeTitle').textContent = route[0].toUpperCase()+route.slice(1);
};

