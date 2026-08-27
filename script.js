const TARGET_WEEKLY=200000000;
const TARGET_OVERALL=1000000000;
let rows=[];

const IDR=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
const money=n=>IDR.format(Number(n)||0);
const shortMoney=n=>{
 n=Number(n)||0;
 if(n>=1e9)return 'Rp'+(n/1e9).toFixed(2).replace('.',',')+' M';
 if(n>=1e6)return 'Rp'+(n/1e6).toFixed(1).replace('.',',')+' Jt';
 if(n>=1e3)return 'Rp'+Math.round(n/1e3)+' Rb';
 return money(n);
};
const pct=n=>((Number(n)||0)*100).toFixed(((Number(n)||0)*100)%1?1:0).replace('.',',')+'%';

const $=id=>document.getElementById(id);
function setStatus(ok,text){
 $('statusDot').style.background=ok===true?'#222':ok===false?'#b42318':'#999';
 $('statusText').textContent=text;
}

function normalizeReff(v){
 const s=String(v??'').trim().toUpperCase();
 if(['BSI QRIS','QRIS BSI','QRIS'].includes(s))return 'BSI QRIS';
 if(['CASH','TUNAI'].includes(s))return 'CASH';
 return s||'LAINNYA';
}
function parseDate(v){
 if(v instanceof Date)return v;
 const s=String(v??'').trim();
 if(!s)return null;
 let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if(m)return new Date(+m[3],+m[2]-1,+m[1]);
 m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
 if(m)return new Date(+m[1],+m[2]-1,+m[3]);
 const d=new Date(s); return isNaN(d)?null:d;
}
function dateKey(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''}
function displayDate(d){return d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:''}

function parseCSV(text){
 const lines=[]; let row=[], cell='', quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i], n=text[i+1];
  if(c==='"' && quoted && n==='"'){cell+='"';i++;continue}
  if(c==='"'){quoted=!quoted;continue}
  if((c===','||c===';')&&!quoted){row.push(cell.trim());cell='';continue}
  if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&n==='\n')i++;
   row.push(cell.trim());cell='';
   if(row.some(x=>x!==''))lines.push(row);
   row=[];continue;
  }
  cell+=c;
 }
 if(cell!==''||row.length){row.push(cell.trim());lines.push(row)}
 return lines;
}

function buildData(matrix){
 if(!matrix.length)throw new Error('File kosong.');
 const header=matrix[0].map(x=>String(x).trim().toUpperCase());
 const idx={}; header.forEach((h,i)=>idx[h]=i);
 const required=['NO','TANGGAL','WAKTU','NAMA DONATUR','REFF','KREDIT','PIC','JENIS DONASI'];
 const missing=required.filter(h=>idx[h]===undefined);
 if(missing.length)throw new Error('Kolom belum lengkap: '+missing.join(', '));

 rows=[];
 for(let i=1;i<matrix.length;i++){
  const r=matrix[i];
  if(!String(r[idx.NO]??'').trim())continue;
  const d=parseDate(r[idx.TANGGAL]);
  const amount=Number(String(r[idx.KREDIT]??'').replace(/[^\d,-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  const time=String(r[idx.WAKTU]??'').trim();
  rows.push({
   no:Number(r[idx.NO])||i,
   date:d,
   tanggal:dateKey(d),
   waktu:time,
   nama:String(r[idx['NAMA DONATUR']]??'').trim(),
   reff:normalizeReff(r[idx.REFF]),
   nominal:amount,
   pic:String(r[idx.PIC]??'').trim(),
   jenis:String(r[idx['JENIS DONASI']]??'').trim().toUpperCase()||'LAINNYA'
  });
 }
 rows.sort((a,b)=>(b.tanggal+' '+b.waktu).localeCompare(a.tanggal+' '+a.waktu));
 render();
 localStorage.setItem('satuAmalNttRows',JSON.stringify(rows.map(r=>({...r,date:r.date?r.date.toISOString():null}))));
 setStatus(true,`${rows.length} transaksi • Offline`);
}

function aggregate(field){
 const map={};
 rows.forEach(r=>{
  const k=r[field]||'Tidak diisi';
  if(!map[k])map[k]={label:k,nominal:0,transaksi:0};
  map[k].nominal+=r.nominal;map[k].transaksi++;
 });
 return Object.values(map).sort((a,b)=>b.nominal-a.nominal);
}

function render(){
 const total=rows.reduce((s,r)=>s+r.nominal,0);
 const donors=new Set(rows.map(r=>r.nama.toLowerCase()).filter(Boolean)).size;
 const todayKey=dateKey(new Date());
 const today=rows.filter(r=>r.tanggal===todayKey).reduce((s,r)=>s+r.nominal,0);
 $('total').textContent=money(total);
 $('transactions').textContent=rows.length.toLocaleString('id-ID');
 $('donors').textContent=donors.toLocaleString('id-ID');
 $('today').textContent=money(today);

 const wp=Math.min(total/TARGET_WEEKLY,1), op=Math.min(total/TARGET_OVERALL,1);
 $('weeklyText').textContent=shortMoney(total)+' / Rp200 Juta';
 $('weeklyPct').textContent=pct(wp);$('weeklyBar').style.width=(wp*100)+'%';
 $('weeklyRemaining').textContent=total<TARGET_WEEKLY?'Sisa '+money(TARGET_WEEKLY-total):'Target tercapai';
 $('overallText').textContent=shortMoney(total)+' / Rp1 Miliar';
 $('overallPct').textContent=pct(op);$('overallBar').style.width=(op*100)+'%';
 $('overallRemaining').textContent=total<TARGET_OVERALL?'Sisa '+money(TARGET_OVERALL-total):'Target tercapai';

 renderBars(aggregate('reff'));
 renderDonut(aggregate('jenis'));
 renderTrend();
 renderRecent();
 $('updated').textContent='Update: '+new Date().toLocaleString('id-ID');
}

function renderBars(items){
 const el=$('channelChart'); if(!items.length){el.className='bar-chart empty';el.textContent='Belum ada data';return}
 el.className='bar-chart';
 const max=items[0].nominal||1;
 el.innerHTML=items.slice(0,8).map(x=>`<div class="bar-item"><div class="bar-label"><span>${esc(x.label)}</span><b>${money(x.nominal)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${x.nominal/max*100}%"></div></div></div>`).join('');
}
function renderDonut(items){
 const el=$('typeChart'); if(!items.length){el.className='donut-wrap empty';el.textContent='Belum ada data';return}
 const total=items.reduce((s,x)=>s+x.nominal,0)||1;
 let acc=0;
 const stops=items.map((x,i)=>{const start=acc/total*100;acc+=x.nominal;return `${['#111827','#475467','#98A2B3','#D0D5DD','#667085'][i%5]} ${start}% ${acc/total*100}%`}).join(',');
 el.className='donut-wrap';
 el.innerHTML=`<div class="donut" style="background:conic-gradient(${stops})"></div><div class="legend">${items.slice(0,6).map((x,i)=>`<div class="legend-row"><i class="legend-dot" style="background:${['#111827','#475467','#98A2B3','#D0D5DD','#667085'][i%5]}"></i><span>${esc(x.label)} — ${pct(x.nominal/total)}</span></div>`).join('')}</div>`;
}
function renderTrend(){
 const el=$('trendChart'); if(!rows.length){el.className='trend empty';el.textContent='Belum ada data';return}
 const map={}; rows.forEach(r=>{if(r.tanggal)map[r.tanggal]=(map[r.tanggal]||0)+r.nominal});
 const items=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);
 const vals=items.map(x=>x[1]), max=Math.max(...vals,1), w=760,h=125,p=25;
 const pts=items.map((x,i)=>`${p+i*((w-2*p)/Math.max(items.length-1,1))},${h-p-(x[1]/max)*(h-2*p)}`).join(' ');
 const circles=items.map((x,i)=>{const cx=p+i*((w-2*p)/Math.max(items.length-1,1));const cy=h-p-(x[1]/max)*(h-2*p);return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#111827"><title>${displayDate(new Date(x[0]+'T00:00:00'))}: ${money(x[1])}</title></circle>`}).join('');
 const labels=items.filter((_,i)=>i===0||i===items.length-1||i%Math.ceil(items.length/5)===0).map((x)=>{
   const i=items.indexOf(x),cx=p+i*((w-2*p)/Math.max(items.length-1,1));return `<text x="${cx}" y="${h+2}" text-anchor="middle" class="trend-label">${x[0].slice(5).replace('-','/')}</text>`;
 }).join('');
 el.className='trend';
 el.innerHTML=`<svg viewBox="0 0 ${w} ${h+15}" preserveAspectRatio="none"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#e4e7eb"/><polyline points="${pts}" fill="none" stroke="#111827" stroke-width="2"/>${circles}${labels}</svg>`;
}
function renderRecent(){
 $('recent').innerHTML=rows.slice(0,25).map(r=>`<tr><td>${esc(r.tanggal?displayDate(r.date)+' '+r.waktu:r.waktu)}</td><td>${esc(r.nama)}</td><td>${money(r.nominal)}</td><td>${esc(r.reff)}</td><td>${esc(r.jenis)}</td><td>${esc(r.pic)}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Belum ada data yang dapat ditampilkan.</td></tr>';
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  setStatus(null,'Membaca file...');
  const text=await file.text();
  buildData(parseCSV(text));
 }catch(err){console.error(err);setStatus(false,err.message||'File tidak dapat dibaca')}
 e.target.value='';
};
$('clearBtn').onclick=()=>{
 rows=[];localStorage.removeItem('satuAmalNttRows');render();setStatus(null,'Data dikosongkan');
};

try{
 const saved=JSON.parse(localStorage.getItem('satuAmalNttRows')||'[]');
 if(saved.length){
  rows=saved.map(r=>({...r,date:r.date?new Date(r.date):null}));
  render();setStatus(true,`${rows.length} transaksi • Offline`);
 }else{render();setStatus(null,'Siap • Import Excel/CSV')}
}catch(e){render();setStatus(false,'Data lokal rusak — Reset')}

setInterval(()=>{if(rows.length){$('updated').textContent='Update: '+new Date().toLocaleString('id-ID')}},60000);
