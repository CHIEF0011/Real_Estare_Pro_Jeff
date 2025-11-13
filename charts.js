import { fmtKES } from './utils.js';
import dayjs from 'dayjs';
import Chart from 'chart.js/auto';

export function renderCollectionChart(ctx, monthly) {
  const labels = monthly.map(m=>dayjs(m.month+'-01').format('MMM YY'));
  const data = {
    labels,
    datasets: [
      { label:'Due', data: monthly.map(m=>m.due), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.12)', tension:.3 },
      { label:'Collected', data: monthly.map(m=>m.collected), borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,0.12)', tension:.3 }
    ]
  };
  return new Chart(ctx, { type:'line', data, options:{
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{ tooltip:{ callbacks:{ label:(ctx)=>`${ctx.dataset.label}: ${fmtKES(ctx.parsed.y)}` } } },
    scales:{ y:{ ticks:{ callback:(v)=>fmtKES(v) } } }
  }});
}

export function renderOccupancyChart(ctx, occupied, vacant) {
  return new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Occupied','Vacant'], datasets:[{ data:[occupied, vacant], backgroundColor:['#16a34a','#94a3b8'] }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
  });
}