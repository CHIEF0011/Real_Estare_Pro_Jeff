import dayjs from 'dayjs';
import { fmtKES, setActiveMenu, formToObj, toCSV, download } from './utils.js';
import { load, save, reset, getSettings, setSettings } from './storage.js';
import { list, add, update, remove, occupancy, monthlyFigures, generateMonthlyInvoices, recordPayment } from './data.js';
import { renderCollectionChart, renderOccupancyChart } from './charts.js';
import { getAssetURL, setAsset } from './storage.js';

/* Router */
const view = document.getElementById('view');
const routeTitle = document.getElementById('routeTitle');
const sidebar = document.querySelector('.sidebar');
document.getElementById('mobileMenu').addEventListener('click', ()=> {
  sidebar.classList.toggle('open');
  const handler = (e)=>{ if (!sidebar.contains(e.target) && e.target.id!=='mobileMenu') { sidebar.classList.remove('open'); document.removeEventListener('click', handler); } };
  if (sidebar.classList.contains('open')) setTimeout(()=>document.addEventListener('click', handler),0);
});
document.querySelectorAll('.menu-item').forEach(btn => btn.addEventListener('click', ()=> navigate(btn.dataset.route)));
function navigate(route) {
  window.location.hash = route;
  setActiveMenu(route);
  routeTitle.textContent = route[0].toUpperCase()+route.slice(1);
  sidebar.classList.remove('open');
  render(route);
}
window.addEventListener('hashchange', ()=> render(location.hash.replace('#','') || 'dashboard'));

/* Rendering */
function render(route='dashboard') {
  const tpl = document.getElementById(`tpl-${route}`);
  if (!tpl) return;
  view.innerHTML = '';
  view.append(tpl.content.cloneNode(true));
  attachActions(route);
  if (route==='dashboard') renderDashboard();
  if (route==='properties') renderProperties();
  if (route==='units') renderUnits();
  if (route==='tenants') renderTenants();
  if (route==='leases') renderLeases();
  if (route==='invoices') renderInvoices();
  if (route==='payments') renderPayments();
  if (route==='maintenance') renderMaintenance();
  if (route==='reports') renderReports();
  if (route==='documents') renderDocuments();
  if (route==='messages') renderMessages();
  if (route==='users') renderUsers();
  if (route==='settings') renderSettings();
}

/* Dashboard */
function renderDashboard() {
  const k = occupancy();
  document.getElementById('kpi-occupancy').textContent = `${k.total?Math.round((k.occupied/k.total)*100):0}%`;
  const months = monthlyFigures();
  const due = months[months.length-1]?.due || 0;
  const collected = months[months.length-1]?.collected || 0;
  document.getElementById('kpi-due').textContent = fmtKES(due);
  document.getElementById('kpi-collected').textContent = fmtKES(collected);
  document.getElementById('kpi-arrears').textContent = fmtKES(Math.max(due-collected,0));

  const c1 = document.getElementById('chartCollections').getContext('2d');
  const c2 = document.getElementById('chartOccupancy').getContext('2d');
  document.querySelector('#chartCollections').height = 220;
  document.querySelector('#chartOccupancy').height = 220;
  renderCollectionChart(c1, months);
  renderOccupancyChart(c2, k.occupied, k.vacant);

  const d = load();
  const upcoming = (d.invoices||[])
    .filter(i=>i.status!=='paid')
    .sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))
    .slice(0,8)
    .map(i=>`<div class="row"><strong>${dayjs(i.dueDate).format('DD MMM')}</strong> • ${i.month} • ${fmtKES(i.total)} <button class="btn btn-light" data-view-invoice="${i.id}">View</button></div>`)
    .join('') || '<div class="muted">No upcoming invoices.</div>';
  document.getElementById('upcomingInvoices').innerHTML = upcoming;

  const openM = (d.maintenance||[]).filter(m=>m.status!=='closed');
  document.getElementById('openMaintenance').innerHTML = openM.map(m=>`<div class="row">${m.title} • <span class="muted">${dayjs(m.created).fromNow?.()||dayjs(m.created).format('DD MMM')}</span></div>`).join('') || '<div class="muted">No open tickets.</div>';
}

/* Tables */
function table(headers, rows) {
  const thead = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

/* Properties */
function renderProperties() {
  const props = list('properties');
  const rows = props.map(p=>[
    p.name, p.address || '-', 
    `<button class="btn btn-light" data-view-prop="${p.id}" title="View">👁️</button>
     <button class="btn btn-light" data-edit-prop="${p.id}" title="Edit">✏️</button>
     <button class="btn btn-light" data-del-prop="${p.id}" title="Delete">🗑️</button>`]);
  document.getElementById('propertiesTable').innerHTML = table(['Name','Address',''], rows);
}

/* Units */
function renderUnits() {
  const units = list('units'); const props=list('properties');
  const rows = units.map(u=>[
    u.name,
    props.find(p=>p.id===u.propertyId)?.name || '-',
    `${u.bedrooms} bed / ${u.bathrooms} bath`,
    u.size? `${u.size} m²` : '-',
    u.status,
    `<button class="btn btn-light" data-view-unit="${u.id}" title="View">👁️</button>
     <button class="btn btn-light" data-edit-unit="${u.id}" title="Edit">✏️</button>
     <button class="btn btn-light" data-del-unit="${u.id}" title="Delete">🗑️</button>`]);
  document.getElementById('unitsTable').innerHTML = table(['Unit','Property','Specs','Size','Status',''], rows);
}

/* Tenants */
function renderTenants() {
  const tenants = list('tenants');
  const rows = tenants.map(t=>[
    t.name, t.email||'-', t.phone||'-',
    `<button class="btn btn-light" data-view-tenant="${t.id}" title="View">👁️</button>
     <button class="btn btn-light" data-edit-tenant="${t.id}" title="Edit">✏️</button>
     <button class="btn btn-light" data-del-tenant="${t.id}" title="Delete">🗑️</button>`]);
  document.getElementById('tenantsTable').innerHTML = table(['Name','Email','Phone',''], rows);
}

/* Leases */
function renderLeases() {
  const leases = list('leases'); const units=list('units'); const tenants=list('tenants');
  const rows = leases.map(l=>{
    const u = units.find(x=>x.id===l.unitId); const t = tenants.find(x=>x.id===l.tenantId);
    return [
      u?.name||'-', t?.name||'-',
      `${dayjs(l.start).format('DD MMM YYYY')} → ${dayjs(l.end).format('DD MMM YYYY')}`,
      fmtKES(l.rent),
      `<button class="btn btn-light" data-view-lease="${l.id}" title="View">👁️</button>
       <button class="btn btn-light" data-edit-lease="${l.id}" title="Edit">✏️</button>
       <button class="btn btn-light" data-del-lease="${l.id}" title="Delete">🗑️</button>`
    ];
  });
  document.getElementById('leasesTable').innerHTML = table(['Unit','Tenant','Term','Rent',''], rows);
}

/* Invoices */
function renderInvoices() {
  const inv = list('invoices'); const tenants = list('tenants'); const pays=list('payments');
  const rows = inv.map(i=>{
    const latestPay = pays.filter(p=>p.invoiceId===i.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    return [
      i.month,
      tenants.find(t=>t.id===i.tenantId)?.name || '-',
      dayjs(i.dueDate).format('DD MMM YYYY'),
      fmtKES(i.total),
      i.status,
      `<button class="btn btn-light" data-view-invoice="${i.id}" title="View">👁️</button>
       ${latestPay?`<button class="btn btn-light" data-view-receipt="${latestPay.id}" title="Receipt">🧾</button>`:''}
       <button class="btn btn-light" data-edit-invoice="${i.id}" title="Edit">✏️</button>
       <button class="btn btn-light" data-del-invoice="${i.id}" title="Delete">🗑️</button>`
    ];
  });
  document.getElementById('invoicesTable').innerHTML = table(['Month','Tenant','Due Date','Total','Status',''], rows);
}

/* Payments */
function renderPayments() {
  const pays = list('payments'); const invs=list('invoices'); const tenants=list('tenants');
  const rows = pays.map(p=>{
    const inv = invs.find(i=>i.id===p.invoiceId);
    const tenant = tenants.find(t=>t.id===p.tenantId);
    return [
      dayjs(p.date).format('DD MMM YYYY'),
      tenant?.name || '-',
      inv?.month || '-',
      fmtKES(p.amount),
      p.method,
      `<button class="btn btn-light" data-view-payment="${p.id}" title="View">👁️</button>
       <button class="btn btn-light" data-view-receipt="${p.id}" title="Receipt">🧾</button>
       <button class="btn btn-light" data-edit-payment="${p.id}" title="Edit">✏️</button>
       <button class="btn btn-light" data-del-payment="${p.id}" title="Delete">🗑️</button>`];
  });
  document.getElementById('paymentsTable').innerHTML = table(['Date','Tenant','Month','Amount','Method',''], rows);
}

/* Maintenance */
function renderMaintenance() {
  const tickets = list('maintenance'); const units=list('units');
  const rows = tickets.map(m=>[
    m.title, units.find(u=>u.id===m.unitId)?.name || '-', m.status,
    `<button class="btn btn-light" data-view-maint="${m.id}" title="View">👁️</button>
     <button class="btn btn-light" data-edit-maint="${m.id}" title="Edit">✏️</button>
     <button class="btn btn-light" data-del-maint="${m.id}" title="Delete">🗑️</button>`]);
  document.getElementById('maintenanceTable').innerHTML = table(['Title','Unit','Status',''], rows);
}

/* Reports */
function renderReports() {
  const wrap = document.getElementById('reportsContent');
  const months = monthlyFigures();
  const rows = months.map(m=>`<tr><td>${dayjs(m.month+'-01').format('MMM YYYY')}</td><td>${fmtKES(m.due)}</td><td>${fmtKES(m.collected)}</td><td>${fmtKES(Math.max((m.due - m.collected),0))}</td></tr>`).join('');
  wrap.innerHTML = `<div class="card"><h3>Last 6 Months</h3>${months.length?`<div class="table"><table><thead><tr><th>Month</th><th>Due</th><th>Collected</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="muted">No data</div>'}</div>`;
}

/* Documents */
function renderDocuments() {
  const docs = list('documents');
  const rows = docs.map(d=>[
    d.name, d.type||'-', dayjs(d.created).format('DD MMM YYYY'),
    `<a class="btn btn-light" href="${d.url}" target="_blank" title="Open">🔗</a>
     <button class="btn btn-light" data-del-doc="${d.id}" title="Delete">🗑️</button>`]);
  document.getElementById('documentsList').innerHTML = table(['Name','Type','Date',''], rows);
}

/* Messages */
function renderMessages() {
  const msgs = list('messages');
  const container = document.getElementById('messagesThread');
  container.innerHTML = msgs.map(m=>`<div class="message"><strong>${m.from}</strong><div class="muted">${dayjs(m.date).format('DD MMM, HH:mm')}</div><div>${m.text}</div></div>`).join('') || '<div class="muted">No messages.</div>';
}

/* Users */
function renderUsers() {
  const users = list('users');
  const rows = users.map(u=>[
    u.email, u.role,
    `<button class="btn btn-light" data-del-user="${u.id}" title="Delete">🗑️</button>`]);
  document.getElementById('usersTable').innerHTML = table(['Email','Role',''], rows);
}

/* Settings */
function renderSettings() {
  const form = document.getElementById('settingsForm');
  const s = getSettings();
  form.dueDay.value = s.dueDay;
  form.lateFee.value = s.lateFee;
  form.companyName.value = s.companyName || '';
  form.receiptNote.value = s.receiptNote || '';
  form.logoUrl.value = s.logoUrl || '';
  form.address.value = s.address || '';
  form.contact.value = s.contact || '';
  form.landlordName.value = s.landlordName || '';
  form.theme.value = s.theme || 'light';
  form.primaryColor.value = s.primaryColor || '#111111';
  form.secondaryColor.value = s.secondaryColor || '#f2f2f2';
  // Previews for local assets
  getAssetURL('logo').then(url=>{ const img=form.querySelector('#logoPreview'); if(url){ img.src=url; img.style.display='inline-block'; }});
  getAssetURL('signature').then(url=>{ const img=form.querySelector('#signaturePreview'); if(url){ img.src=url; img.style.display='inline-block'; }});
  // Handle uploads
  form.logoFile.onchange = async (e)=>{ const f=e.target.files?.[0]; if(f){ await setAsset('logo', f); const url=await getAssetURL('logo'); const img=form.querySelector('#logoPreview'); img.src=url; img.style.display='inline-block'; } };
  form.signatureFile.onchange = async (e)=>{ const f=e.target.files?.[0]; if(f){ await setAsset('signature', f); const url=await getAssetURL('signature'); const img=form.querySelector('#signaturePreview'); img.src=url; img.style.display='inline-block'; } };
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const vals = formToObj(form);
    setSettings(vals);
    applyTheme(getSettings());
    alert('Settings saved');
  });

  /* NEW JSON DATA MANAGEMENT */
  form.querySelector('[data-action="export-json"]').onclick = () => {
    const data = load();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = form.querySelector('#importFile');
  const importConfirm = form.querySelector('#importConfirm');
  importFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importConfirm.style.display = 'block';
    form.querySelector('[data-action="import-json"]').onclick = async () => {
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        save(data);
        alert('Data imported successfully');
        location.reload();
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
  };
}

/* Actions & Modals */
function attachActions(route) {
  // Update action buttons with professional color classes
  view.querySelectorAll('[data-action="add-property"], [data-action="add-unit"], [data-action="add-tenant"], [data-action="add-lease"], [data-action="add-payment"], [data-action="add-user"]').forEach(b=>{
    b.classList.add('btn-success');
    b.onclick = () => {
      if (!protectAdminAction()) return;
      if (b.dataset.action === 'add-property') modalProperty();
      else if (b.dataset.action === 'add-unit') modalUnit();
      else if (b.dataset.action === 'add-tenant') modalTenant();
      else if (b.dataset.action === 'add-lease') modalLease();
      else if (b.dataset.action === 'add-payment') modalPayment();
      else if (b.dataset.action === 'add-user') modalUser();
    };
  });

  view.querySelectorAll('[data-action="generate-invoices"], [data-action="new-maintenance"], [data-action="new-message"], [data-action="upload-doc"]').forEach(b=>{
    b.classList.add('btn-info');
    b.onclick = () => {
      if (!protectAdminAction()) return;
      if (b.dataset.action === 'generate-invoices') { generateMonthlyInvoices(); render('invoices'); }
      else if (b.dataset.action === 'new-maintenance') modalMaintenance();
      else if (b.dataset.action === 'new-message') modalMessage();
      else if (b.dataset.action === 'upload-doc') modalUpload();
    };
  });

  view.querySelectorAll('[data-action="export-invoices"], [data-action="print-table"]').forEach(b=>{
    b.classList.add('btn-light');
    b.onclick = () => {
      if (b.dataset.action === 'export-invoices') exportInvoices();
      else if (b.dataset.action === 'print-table') printCurrentTable();
    };
  });

  // Keep existing individual button handlers with admin protection
  view.querySelectorAll('[data-edit-prop], [data-edit-unit], [data-edit-tenant], [data-edit-lease], [data-edit-invoice], [data-edit-payment], [data-edit-maint]').forEach(b=>{
    b.classList.add('btn-light');
    b.onclick = (e) => {
      if (!protectAdminAction()) return;
      // Existing edit logic here
    };
  });

  view.querySelectorAll('[data-del-prop], [data-del-unit], [data-del-tenant], [data-del-lease], [data-del-invoice], [data-del-payment], [data-del-maint], [data-del-user], [data-del-doc]').forEach(b=>{
    b.classList.add('btn-danger');
    b.onclick = (e) => {
      if (!protectAdminAction()) return;
      const dataset = e.target.dataset;
      if (dataset.delProp) { if(confirm('Delete property?')){ remove('properties', dataset.delProp); render('properties'); } }
      else if (dataset.delUnit) { if(confirm('Delete unit?')){ remove('units', dataset.delUnit); render('units'); } }
      else if (dataset.delTenant) { if(confirm('Delete tenant?')){ remove('tenants', dataset.delTenant); render('tenants'); } }
      else if (dataset.delLease) { if(confirm('Delete lease?')){ remove('leases', dataset.delLease); render('leases'); } }
      else if (dataset.delInvoice) { if(confirm('Delete invoice?')){ remove('invoices', dataset.delInvoice); render('invoices'); } }
      else if (dataset.delPayment) { if(confirm('Delete payment?')){ remove('payments', dataset.delPayment); render('payments'); render('invoices'); } }
      else if (dataset.delMaint) { if(confirm('Delete ticket?')){ remove('maintenance', dataset.delMaint); render('maintenance'); } }
      else if (dataset.delUser) { if(confirm('Delete user?')){ remove('users', dataset.delUser); render('users'); } }
      else if (dataset.delDoc) { if(confirm('Delete document?')){ remove('documents', dataset.delDoc); render('documents'); } }
    };
  });

  view.querySelectorAll('[data-view-prop], [data-view-unit], [data-view-tenant], [data-view-lease], [data-view-invoice], [data-view-payment], [data-view-maint], [data-view-receipt]').forEach(b=>{
    b.classList.add('btn-light');
  });

  view.querySelectorAll('[data-action="add-property"]').forEach(b=>b.onclick=()=>modalProperty());
  view.querySelectorAll('[data-edit-prop]').forEach(b=>b.onclick=()=>modalProperty(b.dataset.editProp));
  view.querySelectorAll('[data-del-prop]').forEach(b=>b.onclick=()=>{ if(confirm('Delete property?')){ remove('properties', b.dataset.delProp); render('properties'); } });
  view.querySelectorAll('[data-view-prop]').forEach(b=>b.onclick=()=>modalViewProperty(b.dataset.viewProp));

  view.querySelectorAll('[data-action="add-unit"]').forEach(b=>b.onclick=()=>modalUnit());
  view.querySelectorAll('[data-edit-unit]').forEach(b=>b.onclick=()=>modalUnit(b.dataset.editUnit));
  view.querySelectorAll('[data-del-unit]').forEach(b=>b.onclick=()=>{ if(confirm('Delete unit?')){ remove('units', b.dataset.delUnit); render('units'); } });
  view.querySelectorAll('[data-view-unit]').forEach(b=>b.onclick=()=>modalViewUnit(b.dataset.viewUnit));

  view.querySelectorAll('[data-action="add-tenant"]').forEach(b=>b.onclick=()=>modalTenant());
  view.querySelectorAll('[data-edit-tenant]').forEach(b=>b.onclick=()=>modalTenant(b.dataset.editTenant));
  view.querySelectorAll('[data-del-tenant]').forEach(b=>b.onclick=()=>{ if(confirm('Delete tenant?')){ remove('tenants', b.dataset.delTenant); render('tenants'); } });
  view.querySelectorAll('[data-view-tenant]').forEach(b=>b.onclick=()=>modalViewTenant(b.dataset.viewTenant));

  view.querySelectorAll('[data-action="add-lease"]').forEach(b=>b.onclick=()=>modalLease());
  view.querySelectorAll('[data-edit-lease]').forEach(b=>b.onclick=()=>modalLease(b.dataset.editLease));
  view.querySelectorAll('[data-del-lease]').forEach(b=>b.onclick=()=>{ if(confirm('Delete lease?')){ remove('leases', b.dataset.delLease); render('leases'); } });
  view.querySelectorAll('[data-view-lease]').forEach(b=>b.onclick=()=>modalViewLease(b.dataset.viewLease));

  view.querySelectorAll('[data-action="generate-invoices"]').forEach(b=>b.onclick=()=>{ generateMonthlyInvoices(); render('invoices'); });
  view.querySelectorAll('[data-edit-invoice]').forEach(b=>b.onclick=()=>modalInvoiceEdit(b.dataset.editInvoice));
  view.querySelectorAll('[data-del-invoice]').forEach(b=>b.onclick=()=>{ if(confirm('Delete invoice?')){ remove('invoices', b.dataset.delInvoice); render('invoices'); } });
  view.querySelectorAll('[data-view-invoice]').forEach(b=>b.onclick=()=>modalInvoice(b.dataset.viewInvoice));

  view.querySelectorAll('[data-action="add-payment"]').forEach(b=>b.onclick=()=>modalPayment());
  view.querySelectorAll('[data-view-receipt]').forEach(b=>b.onclick=()=>modalReceipt(b.dataset.viewReceipt));
  view.querySelectorAll('[data-edit-payment]').forEach(b=>b.onclick=()=>modalPayment(null, b.dataset.editPayment));
  view.querySelectorAll('[data-del-payment]').forEach(b=>b.onclick=()=>{ if(confirm('Delete payment?')){ remove('payments', b.dataset.delPayment); render('payments'); render('invoices'); } });
  view.querySelectorAll('[data-view-payment]').forEach(b=>b.onclick=()=>modalViewPayment(b.dataset.viewPayment));

  view.querySelectorAll('[data-action="new-maintenance"]').forEach(b=>b.onclick=()=>modalMaintenance());
  view.querySelectorAll('[data-edit-maint]').forEach(b=>b.onclick=()=>modalMaintenance(b.dataset.editMaint));
  view.querySelectorAll('[data-del-maint]').forEach(b=>b.onclick=()=>{ if(confirm('Delete ticket?')){ remove('maintenance', b.dataset.delMaint); render('maintenance'); } });
  view.querySelectorAll('[data-view-maint]').forEach(b=>b.onclick=()=>modalViewMaintenance(b.dataset.viewMaint));

  view.querySelectorAll('[data-action="export-invoices"]').forEach(b=>b.onclick=()=>exportInvoices());

  view.querySelectorAll('[data-action="report-cashflow"]').forEach(b=>b.onclick=()=>reportCashflow());
  view.querySelectorAll('[data-action="report-arrears"]').forEach(b=>b.onclick=()=>reportArrears());
  view.querySelectorAll('[data-action="report-occupancy"]').forEach(b=>b.onclick=()=>reportOccupancy());

  view.querySelectorAll('[data-action="upload-doc"]').forEach(b=>b.onclick=()=>modalUpload());

  view.querySelectorAll('[data-action="new-message"]').forEach(b=>b.onclick=()=>modalMessage());

  view.querySelectorAll('[data-action="add-user"]').forEach(b=>b.onclick=()=>modalUser());
  view.querySelectorAll('[data-del-user]').forEach(b=>b.onclick=()=>{ if(confirm('Delete user?')){ remove('users', b.dataset.delUser); render('users'); } });

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.querySelector('[data-action="seed-demo"]').onclick = ()=>{ const d = load(); save(d); alert('Demo data seeded'); };
    settingsForm.querySelector('[data-action="clear-data"]').onclick = ()=>{ if (confirm('Clear all data?')) { reset(); location.reload(); } };
  }

  view.querySelectorAll('[data-action="print-table"]').forEach(b=>b.onclick=()=>printCurrentTable());
  // Delegated fallback to ensure action buttons always respond
  view.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-view-receipt],[data-view-prop],[data-edit-prop],[data-del-prop],[data-view-unit],[data-edit-unit],[data-del-unit],[data-view-tenant],[data-edit-tenant],[data-del-tenant],[data-view-lease],[data-edit-lease],[data-del-lease],[data-view-invoice],[data-edit-invoice],[data-del-invoice],[data-view-payment],[data-edit-payment],[data-del-payment],[data-view-maint],[data-edit-maint],[data-del-maint]');
    if (!t) return;
    if (t.dataset.viewReceipt) return modalReceipt(t.dataset.viewReceipt);
    const ds = t.dataset;
    if (ds.viewProp) return modalViewProperty(ds.viewProp);
    if (ds.editProp) return modalProperty(ds.editProp);
    if (ds.delProp) { if(confirm('Delete property?')){ remove('properties', ds.delProp); render('properties'); } return; }
    if (ds.viewUnit) return modalViewUnit(ds.viewUnit);
    if (ds.editUnit) return modalUnit(ds.editUnit);
    if (ds.delUnit) { if(confirm('Delete unit?')){ remove('units', ds.delUnit); render('units'); } return; }
    if (ds.viewTenant) return modalViewTenant(ds.viewTenant);
    if (ds.editTenant) return modalTenant(ds.editTenant);
    if (ds.delTenant) { if(confirm('Delete tenant?')){ remove('tenants', ds.delTenant); render('tenants'); } return; }
    if (ds.viewLease) return modalViewLease(ds.viewLease);
    if (ds.editLease) return modalLease(ds.editLease);
    if (ds.delLease) { if(confirm('Delete lease?')){ remove('leases', ds.delLease); render('leases'); } return; }
    if (ds.viewInvoice) return modalInvoice(ds.viewInvoice);
    if (ds.editInvoice) return modalInvoiceEdit(ds.editInvoice);
    if (ds.delInvoice) { if(confirm('Delete invoice?')){ remove('invoices', ds.delInvoice); render('invoices'); } return; }
    if (ds.viewPayment) return modalViewPayment(ds.viewPayment);
    if (ds.editPayment) return modalPayment(null, ds.editPayment);
    if (ds.delPayment) { if(confirm('Delete payment?')){ remove('payments', ds.delPayment); render('payments'); render('invoices'); } return; }
    if (ds.viewMaint) return modalViewMaintenance(ds.viewMaint);
    if (ds.editMaint) return modalMaintenance(ds.editMaint);
    if (ds.delMaint) { if(confirm('Delete ticket?')){ remove('maintenance', ds.delMaint); render('maintenance'); } return; }
  });
}

/* Modals base */
function openModal(title, bodyHTML) {
  const tpl = document.getElementById('tpl-modal');
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector('.modal-backdrop');
  node.querySelector('.modal-title').textContent = title;
  node.querySelector('.modal-body').innerHTML = bodyHTML;
  
  // Ensure close button works with single click
  const closeBtn = node.querySelector('[data-close]');
  closeBtn.addEventListener('click', () => root.remove());
  
  root.addEventListener('click', (e) => {
    if (e.target.matches('.modal-backdrop')) root.remove();
  });
  
  document.body.append(root);
  return root.querySelector('.modal-body');
}

/* Modal forms */
function modalProperty(id=null) {
  const props = list('properties');
  const data = id ? props.find(p=>p.id===id) : {};
  const body = openModal(id?'Edit Property':'Add Property', `
    <form class="form" id="propForm">
      <label>Name<input name="name" required value="${data?.name||''}"/></label>
      <label>Address<input name="address" value="${data?.address||''}"/></label>
      <div class="actions-row">
        <button class="btn" type="submit">${id?'Save':'Add'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  const form = body.querySelector('#propForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(form);
    if (id) update('properties', id, val); else add('properties', { id: crypto.randomUUID(), ...val });
    document.querySelector('.modal-backdrop').remove();
    render('properties');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalUnit(id=null) {
  const props = list('properties'); const units=list('units');
  const data = id ? units.find(p=>p.id===id) : {};
  const body = openModal(id?'Edit Unit':'Add Unit', `
    <form class="form" id="unitForm">
      <label>Property<select name="propertyId" required>${props.map(p=>`<option value="${p.id}" ${p.id===data?.propertyId?'selected':''}>${p.name}</option>`).join('')}</select></label>
      <label>Unit Name/Number<input name="name" required value="${data?.name||''}"/></label>
      <label>Bedrooms<input type="number" name="bedrooms" value="${data?.bedrooms||1}"/></label>
      <label>Bathrooms<input type="number" name="bathrooms" value="${data?.bathrooms||1}"/></label>
      <label>Size (m²)<input type="number" name="size" value="${data?.size||''}"/></label>
      <label>Status<select name="status"><option ${data?.status==='vacant'?'selected':''} value="vacant">Vacant</option><option ${data?.status==='occupied'?'selected':''} value="occupied">Occupied</option></select></label>
      <div class="actions-row">
        <button class="btn" type="submit">${id?'Save':'Add'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#unitForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    val.bedrooms = Number(val.bedrooms); val.bathrooms = Number(val.bathrooms); val.size = Number(val.size||0);
    if (id) update('units', id, val); else add('units', { id: crypto.randomUUID(), ...val });
    document.querySelector('.modal-backdrop').remove();
    render('units');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalTenant(id=null) {
  const tenants = list('tenants');
  const data = id ? tenants.find(t=>t.id===id) : {};
  const body = openModal(id?'Edit Tenant':'Add Tenant', `
    <form class="form" id="tenantForm">
      <label>Name<input name="name" required value="${data?.name||''}"/></label>
      <label>Email<input name="email" type="email" value="${data?.email||''}"/></label>
      <label>Phone<input name="phone" value="${data?.phone||''}"/></label>
      <div class="actions-row">
        <button class="btn" type="submit">${id?'Save':'Add'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#tenantForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    if (id) update('tenants', id, val); else add('tenants', { id: crypto.randomUUID(), ...val });
    document.querySelector('.modal-backdrop').remove();
    render('tenants');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalLease(id=null) {
  const leases = list('leases'); const units=list('units'); const tenants=list('tenants');
  const data = id ? leases.find(l=>l.id===id) : {};
  const body = openModal(id?'Edit Lease':'Add Lease', `
    <form class="form" id="leaseForm">
      <label>Unit<select name="unitId" required>${units.map(u=>`<option value="${u.id}" ${u.id===data?.unitId?'selected':''}>${u.name}</option>`).join('')}</select></label>
      <label>Tenant<select name="tenantId" required>${tenants.map(t=>`<option value="${t.id}" ${t.id===data?.tenantId?'selected':''}>${t.name}</option>`).join('')}</select></label>
      <label>Start<input type="date" name="start" required value="${data?.start||''}"/></label>
      <label>End<input type="date" name="end" required value="${data?.end||''}"/></label>
      <label>Monthly Rent (KES)<input type="number" name="rent" required value="${data?.rent||''}"/></label>
      <label>Deposit (KES)<input type="number" name="deposit" value="${data?.deposit||0}"/></label>
      <div class="actions-row">
        <button class="btn" type="submit">${id?'Save':'Add'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#leaseForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    val.rent = Number(val.rent); val.deposit = Number(val.deposit||0);
    if (id) {
      update('leases', id, val);
    } else {
      add('leases', { id: crypto.randomUUID(), frequency:'monthly', ...val });
      update('units', val.unitId, { status:'occupied' });
    }
    document.querySelector('.modal-backdrop').remove();
    render('leases');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalInvoice(id) {
  const d = load();
  const inv = d.invoices.find(i=>i.id===id);
  const tenant = d.tenants.find(t=>t.id===inv.tenantId);
  const settings = d.settings;
  const body = openModal(`Invoice • ${inv.month}`, `
    <div class="printable" id="invoicePrint">
      <div class="header receipt-header">
        <img class="brand-logo" data-logo alt="Logo" style="display:none;">
        <div class="brand-block">
          <h2>${settings.companyName||'Company'}</h2>
          <div class="meta">${settings.address||''}${settings.address&&settings.contact?' • ':''}${settings.contact||''}</div>
          <div class="meta">Invoice #${inv.id}</div>
        </div>
      </div>
      <div class="line"></div>
      <div class="bill-to"><strong>Bill To:</strong> ${tenant?.name||'-'} • Due: ${dayjs(inv.dueDate).format('DD MMM YYYY')}</div>
      <table class="print-table">
        <thead><tr><th>Item</th><th class="ar">Qty</th><th class="ar">Price</th><th class="ar">Total</th></tr></thead>
        <tbody>
          ${inv.items.map(it=>`<tr><td>${it.label}</td><td class="ar">${it.qty}</td><td class="ar">${fmtKES(it.price)}</td><td class="ar">${fmtKES(it.qty*it.price)}</td></tr>`).join('')}
          <tr class="sum"><td colspan="3" class="ar"><strong>Total</strong></td><td class="ar"><strong>${fmtKES(inv.total)}</strong></td></tr>
        </tbody>
      </table>
      <div class="line"></div>
      <div>Status: ${inv.status.toUpperCase()}</div>
      <div class="receipt-footer">${settings.receiptNote||''}</div>
      <div class="actions-row" style="margin-top:10px;">
        <button class="btn" data-pay="${inv.id}">Record Payment</button>
        <button class="btn btn-light" onclick="window.print()">Print</button>
        <button class="btn btn-light" data-close-modal>Close</button>
      </div>
    </div>
  `);
  (async()=>{
    const localLogo = await getAssetURL('logo');
    const img = body.querySelector('[data-logo]');
    const url = localLogo || (settings.logoUrl||'');
    if (url) { img.src=url; img.style.display='inline-block'; }
  })();
  body.querySelector(`[data-pay="${inv.id}"]`)?.addEventListener('click', ()=>{ document.querySelector('.modal-backdrop')?.remove(); modalPayment(inv.id); });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalPayment(invoiceId=null, paymentId=null) {
  const invs = list('invoices');
  const tenants = list('tenants');
  const existing = paymentId ? list('payments').find(x=>x.id===paymentId) : null;
  
  // Create invoice options with tenant names
  const invoiceOptions = invs.map(i=>{
    const tenant = tenants.find(t=>t.id===i.tenantId);
    const tenantName = tenant?.name || 'Unknown Tenant';
    return `<option value="${i.id}" ${(existing?.invoiceId||invoiceId)===i.id?'selected':''}>${i.month} • ${tenantName} • ${fmtKES(i.total)} • ${i.status}</option>`;
  }).join('');
  
  const body = openModal(existing?'Edit Payment':'Record Payment', `
    <form class="form" id="payForm">
      <label>Invoice<select name="invoiceId" required>${invoiceOptions}</select></label>
      <label>Amount (KES)<input type="number" name="amount" required min="1" value="${existing?.amount||''}"/></label>
      <label>Method<select name="method"><option ${existing?.method==='MPesa'?'selected':''} value="MPesa">MPesa</option><option ${existing?.method==='Bank'?'selected':''} value="Bank">Bank</option><option ${existing?.method==='Cash'?'selected':''} value="Cash">Cash</option></select></label>
      <label>Reference<input name="ref" placeholder="Txn ref" value="${existing?.ref||''}"/></label>
      <div class="actions-row">
        <button class="btn" type="submit">${existing?'Save Changes':'Save Payment'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#payForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    val.amount = Number(val.amount);
    if (existing) {
      update('payments', existing.id, {...existing, ...val});
      document.querySelector('.modal-backdrop')?.remove();
    } else {
      const pay = recordPayment(val);
      document.querySelector('.modal-backdrop')?.remove();
      modalReceipt(pay.id);
    }
    render('payments'); render('invoices');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}
function modalReceipt(paymentId) {
  const d = load();
  const p = d.payments.find(x=>x.id===paymentId);
  const inv = d.invoices.find(i=>i.id===p.invoiceId);
  const tenant = d.tenants.find(t=>t.id===p.tenantId);
  const settings = d.settings;
  const paidToDate = d.payments.filter(x=>x.invoiceId===inv.id).reduce((a,b)=>a+b.amount,0);
  const body = openModal('Receipt', `
    <div class="printable receipt thermal" id="receiptPrint">
      <table class="header-table">
        <tr>
          <td style="width:42px;"><img class="brand-logo" data-logo alt="Logo" style="display:none;height:36px;"/></td>
          <td>
            <div style="font-weight:700">RECEIPT</div>
            <div class="meta">${settings.companyName||'Company'}</div>
            <div class="meta">${settings.address||''}${settings.address&&settings.contact?' • ':''}${settings.contact||''}</div>
          </td>
        </tr>
      </table>
      <div class="line dotted"></div>
      <table class="body-table">
        <thead>
          <tr><th colspan="2">Payment Details</th></tr>
        </thead>
        <tbody>
          <tr><td>Date</td><td>${dayjs(p.date).format('DD MMM YYYY')}</td></tr>
          <tr><td>Receipt #</td><td>${p.id}</td></tr>
          <tr><td>Invoice # / Month</td><td>${inv.id} • ${inv.month}</td></tr>
          <tr><td>Tenant</td><td>${tenant?.name||'-'}</td></tr>
          <tr><td>Method / Ref</td><td>${p.method}${p.ref?` • ${p.ref}`:''}</td></tr>
          <tr><td>Amount</td><td><strong>${fmtKES(p.amount)}</strong></td></tr>
          <tr><td>Paid to Date</td><td>${fmtKES(paidToDate)} / ${fmtKES(inv.total)}</td></tr>
        </tbody>
      </table>
      <div class="line dotted"></div>
      <div class="sign-row">
        <div>
          <div class="meta">Landlord Signature</div>
          <img data-signature alt="Signature" style="max-height:40px; display:none;"/>
          <div class="sign-line"></div>
          <div class="meta">Printed Name: ${settings.landlordName||''}</div>
        </div>
      </div>
      <div class="barcode-wrap"><svg id="receiptBarcode"></svg></div>
      <div class="receipt-footer">${settings.receiptNote||''}</div>
      <div class="actions-row" style="margin-top:10px;">
        <button class="btn btn-light" onclick="window.print()">Print</button>
        <button class="btn btn-light" data-close-modal>Close</button>
      </div>
    </div>
  `);
  (async()=>{
    const localLogo = await getAssetURL('logo');
    const logoEl = body.querySelector('[data-logo]');
    const logoUrl = localLogo || (settings.logoUrl||'');
    if (logoUrl) { logoEl.src = logoUrl; logoEl.style.display='inline-block'; }
    const sigUrl = await getAssetURL('signature');
    const sigEl = body.querySelector('[data-signature]');
    if (sigUrl) { sigEl.src = sigUrl; sigEl.style.display='inline-block'; }
    // Barcode (Code128) for receipt id
    try {
      const { default: JsBarcode } = await import('https://esm.sh/jsbarcode@3.11.6');
      const svg = body.querySelector('#receiptBarcode');
      if (svg) {
        JsBarcode(svg, p.id, { 
          format:'CODE128', 
          displayValue:true, 
          font:'Space Mono', 
          fontSize:10, 
          height:32, 
          width:1.0, 
          margin:0, 
          textMargin:1,
          textPosition:'bottom',
          marginTop:4,
          marginBottom:4
        });
      }
    } catch (e) {
      console.warn('Barcode failed:', e);
    }
  })();
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}

/* Maintenance */
function modalMaintenance(id=null) {
  const listM = list('maintenance'); const units=list('units');
  const data = id ? listM.find(m=>m.id===id) : {};
  const body = openModal(id?'Edit Ticket':'New Maintenance', `
    <form class="form" id="mForm">
      <label>Unit<select name="unitId" required>${units.map(u=>`<option value="${u.id}" ${u.id===data?.unitId?'selected':''}>${u.name}</option>`).join('')}</select></label>
      <label>Title<input name="title" required value="${data?.title||''}"/></label>
      <label>Status<select name="status"><option value="open" ${data?.status==='open'?'selected':''}>Open</option><option value="in-progress" ${data?.status==='in-progress'?'selected':''}>In Progress</option><option value="closed" ${data?.status==='closed'?'selected':''}>Closed</option></select></label>
      <div class="actions-row">
        <button class="btn" type="submit">${id?'Save':'Create'}</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#mForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    if (id) update('maintenance', id, val); else add('maintenance', { id: crypto.randomUUID(), created: new Date().toISOString(), ...val });
    document.querySelector('.modal-backdrop').remove();
    render('maintenance');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}

/* Documents */
function modalUpload() {
  const body = openModal('Upload Document', `
    <form class="form" id="docForm">
      <label>Name<input name="name" required /></label>
      <label>Type<select name="type"><option>Lease</option><option>Receipt</option><option>Invoice</option><option>Other</option></select></label>
      <label>URL<input name="url" type="url" required placeholder="https://..."/></label>
      <div class="actions-row">
        <button class="btn" type="submit">Save</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#docForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    add('documents', { id: crypto.randomUUID(), created:new Date().toISOString(), ...formToObj(e.target) });
    document.querySelector('.modal-backdrop').remove();
    render('documents');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}

/* Messages */
function modalMessage() {
  const body = openModal('New Message', `
    <form class="form" id="msgForm">
      <label>From<input name="from" required placeholder="Admin / Landlord / Tenant"/></label>
      <label>Message<textarea name="text" required rows="4"></textarea></label>
      <div class="actions-row">
        <button class="btn" type="submit">Send</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#msgForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    add('messages', { id: crypto.randomUUID(), date: new Date().toISOString(), ...val });
    document.querySelector('.modal-backdrop').remove();
    render('messages');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}

/* Users */
function modalUser() {
  const body = openModal('Add User', `
    <form class="form" id="userForm">
      <label>Email<input name="email" type="email" required /></label>
      <label>Role<select name="role"><option value="admin">Admin</option><option value="landlord">Landlord</option><option value="tenant">Tenant</option></select></label>
      <div class="actions-row">
        <button class="btn" type="submit">Add</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#userForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    add('users', { id: crypto.randomUUID(), ...formToObj(e.target) });
    document.querySelector('.modal-backdrop').remove();
    render('users');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}

/* Exports/Reports */
function exportInvoices() {
  const invs = list('invoices');
  const csv = toCSV(invs.map(i=>({
    id:i.id, month:i.month, tenantId:i.tenantId, dueDate:i.dueDate, total:i.total, status:i.status
  })));
  download(`invoices_${dayjs().format('YYYYMMDD')}.csv`, csv);
}
function reportCashflow() {
  const months = monthlyFigures();
  const csv = toCSV(months);
  download(`cashflow_${dayjs().format('YYYYMMDD')}.csv`, csv);
}
function reportArrears() {
  const d = load();
  const rows = (d.invoices||[]).filter(i=>i.status!=='paid').map(i=>({
    invoice:i.id, tenant:i.tenantId, month:i.month, dueDate:i.dueDate, amount:i.total
  }));
  download(`arrears_${dayjs().format('YYYYMMDD')}.csv`, toCSV(rows));
}
function reportOccupancy() {
  const k = occupancy();
  download(`occupancy_${dayjs().format('YYYYMMDD')}.txt`, `Occupied: ${k.occupied}\nVacant: ${k.vacant}\nTotal: ${k.total}`);
}

function applyTheme(s) {
  const r = document.documentElement;
  const dark = s.theme === 'dark';
  r.style.setProperty('--bg', dark ? '#0b0b0c' : '#ffffff');
  r.style.setProperty('--text', dark ? '#f4f4f5' : '#111111');
  r.style.setProperty('--muted', dark ? '#a1a1aa' : '#666666');
  r.style.setProperty('--border', dark ? '#26272b' : '#e5e5e5');
  r.style.setProperty('--primary', s.primaryColor || '#111111');
  r.style.setProperty('--secondary', s.secondaryColor || '#f2f2f2');
}

async function printCurrentTable() {
  const d = load().settings || {};
  const table = view.querySelector('.table table');
  if (!table) return alert('Nothing to print');
  const logo = await getAssetURL('logo');
  const logoUrl = logo || (d.logoUrl||'');
  const html = `
    <html>
      <head>
        <title>${d.companyName||'Company'} - Table</title>
        <style>
          body{font-family:"Noto Sans",Arial,sans-serif;color:#111;}
          .head{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
          .head img{height:40px;}
          .meta{color:#666;font-size:12px;}
          table{width:100%;border-collapse:collapse;margin-top:10px;}
          th,td{border:1px solid #e5e5e5;padding:8px;text-align:left;font-size:12px;}
          th{background:#fafafa;text-transform:uppercase;letter-spacing:.04em;}
          .foot{margin-top:16px;color:#666;font-size:12px;border-top:1px solid #e5e5e5;padding-top:8px;}
          @media print { @page{size:auto;margin:14mm;} }
        </style>
      </head>
      <body>
        <div class="head">
          ${logoUrl?`<img src="${logoUrl}" alt="Logo">`:''}
          <div>
            <div><strong>${d.companyName||'Company'}</strong></div>
            <div class="meta">${d.address||''}${d.address&&d.contact?' • ':''}${d.contact||''}</div>
          </div>
        </div>
        ${table.outerHTML}
        <div class="foot">${d.companyName||'Company'} • ${d.address||''}${d.address&&d.contact?' • ':''}${d.contact||''}</div>
        <script>window.print();</script>
      </body>
    </html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

/* Session Management */
const ADMIN_CREDENTIALS = { username: 'admin', password: 'jeff001' };
let currentSession = null;

function checkAuth() {
  const stored = localStorage.getItem('repro.session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.username === ADMIN_CREDENTIALS.username) {
        currentSession = parsed;
        return true;
      }
    } catch {}
  }
  return false;
}

function login(username, password) {
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    currentSession = { username, loginTime: new Date().toISOString() };
    localStorage.setItem('repro.session', JSON.stringify(currentSession));
    return true;
  }
  return false;
}

function logout() {
  currentSession = null;
  localStorage.removeItem('repro.session');
  // Clear view to prevent access to app content and show login
  view.innerHTML = '';
  showLogin();
}

function showLogin() {
  const modal = document.getElementById('loginModal');
  modal.style.display = 'flex';
  // Ensure main view is cleared so protected UI isn't visible
  view.innerHTML = '';
  const form = document.getElementById('loginForm');
  form.querySelector('[name="username"]').value = ADMIN_CREDENTIALS.username;
  form.querySelector('[name="password"]').value = '';
  form.querySelector('[name="password"]').focus();

  // Hook up close button to hide login modal (single click)
  const closeBtn = document.getElementById('loginCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
}

function hideLogin() {
  document.getElementById('loginModal').style.display = 'none';
}

// Function to check if user is admin
function isAdmin() {
  return currentSession && currentSession.username === ADMIN_CREDENTIALS.username;
}

// Function to protect admin-only actions
function protectAdminAction(action) {
  if (!isAdmin()) {
    alert('Access denied. Admin login required.');
    showLogin();
    return false;
  }
  return true;
}

/* Init with auth check */
if (!checkAuth()) {
  showLogin();
} else {
  hideLogin();
  if (!location.hash) location.hash = 'dashboard';
  applyTheme(getSettings());
  render(location.hash.replace('#','') || 'dashboard');
}

/* Login form handler */
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = e.target.username.value.trim();
  const password = e.target.password.value.trim();
  if (login(username, password)) {
    hideLogin();
    if (!location.hash) location.hash = 'dashboard';
    applyTheme(getSettings());
    render(location.hash.replace('#','') || 'dashboard');
  } else {
    alert('Invalid credentials');
    e.target.password.value = '';
    e.target.password.focus();
  }
});

/* Add logout button to topbar */
const topbarRight = document.querySelector('.topbar .right');
const logoutBtn = document.createElement('button');
logoutBtn.className = 'btn btn-danger';
logoutBtn.textContent = 'Logout';
logoutBtn.style.marginLeft = '12px';
logoutBtn.onclick = (e) => {
  e.preventDefault();
  logout();
};
topbarRight.appendChild(logoutBtn);

function modalViewProperty(id) {
  const p = list('properties').find(x=>x.id===id);
  openModal('Property', `<div><strong>${p.name}</strong><div class="muted">${p.address||'-'}</div></div>`);
}
function modalViewUnit(id) {
  const u = list('units').find(x=>x.id===id); const prop=list('properties').find(p=>p.id===u.propertyId);
  openModal('Unit', `<div><strong>${u.name}</strong><div class="muted">${prop?.name||'-'}</div><div>${u.bedrooms} bed • ${u.bathrooms} bath • ${u.size||'-'}.m² • ${u.status}</div></div>`);
}
function modalViewTenant(id) {
  const t = list('tenants').find(x=>x.id===id);
  openModal('Tenant', `<div><strong>${t.name}</strong><div class="muted">${t.email||'-'} • ${t.phone||'-'}</div></div>`);
}
function modalViewLease(id) {
  const l = list('leases').find(x=>x.id===id); const u=list('units').find(x=>x.id===l.unitId); const t=list('tenants').find(x=>x.id===l.tenantId);
  openModal('Lease', `<div><div><strong>${u?.name||'-'}</strong> • ${t?.name||'-'}</div><div class="muted">${dayjs(l.start).format('DD MMM YYYY')} → ${dayjs(l.end).format('DD MMM YYYY')}</div><div>Rent: ${fmtKES(l.rent)} • Deposit: ${fmtKES(l.deposit||0)}</div></div>`);
}
function modalViewPayment(id) {
  const p = list('payments').find(x=>x.id===id); const inv=list('invoices').find(i=>i.id===p.invoiceId); const t=list('tenants').find(x=>x.id===p.tenantId);
  openModal('Payment', `<div><div><strong>${fmtKES(p.amount)}</strong> • ${p.method}${p.ref?` • ${p.ref}`:''}</div><div class="muted">${dayjs(p.date).format('DD MMM YYYY')} • ${t?.name||'-'} • Inv ${inv?.month||'-'}</div><div class="actions-row"><button class="btn btn-light" data-open-receipt="${p.id}">Open Receipt</button></div></div>`);
  document.querySelector('[data-open-receipt]')?.addEventListener('click', ()=>{ document.querySelector('.modal-backdrop')?.remove(); modalReceipt(id); });
}
function modalViewMaintenance(id) {
  const m = list('maintenance').find(x=>x.id===id); const u=list('units').find(x=>x.id===m.unitId);
  openModal('Maintenance', `<div><strong>${m.title}</strong><div class="muted">Unit: ${u?.name||'-'} • Status: ${m.status}</div></div>`);
}

function modalInvoiceEdit(id) {
  const d = load();
  const inv = d.invoices.find(i=>i.id===id);
  const body = openModal('Edit Invoice', `
    <form class="form" id="invEditForm">
      <label>Due Date<input type="date" name="dueDate" required value="${inv.dueDate.slice(0,10)}"/></label>
      <label>Status<select name="status"><option ${inv.status==='unpaid'?'selected':''} value="unpaid">Unpaid</option><option ${inv.status==='paid'?'selected':''} value="paid">Paid</option></select></label>
      <label>Total (KES)<input type="number" name="total" required min="0" value="${inv.total}"/></label>
      <div class="actions-row">
        <button class="btn" type="submit">Save</button>
        <button class="btn btn-light" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `);
  body.querySelector('#invEditForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = formToObj(e.target);
    update('invoices', id, { dueDate: new Date(val.dueDate).toISOString(), status: val.status, total: Number(val.total) });
    document.querySelector('.modal-backdrop').remove();
    render('invoices');
  });
  body.querySelector('[data-close-modal]').addEventListener('click', ()=> document.querySelector('.modal-backdrop').remove());
}