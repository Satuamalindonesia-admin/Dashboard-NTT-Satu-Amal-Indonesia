const DATA_URL = './Untitled%20spreadsheet%20(1).csv';

const TARGET_WEEKLY = 200000000;
const TARGET_OVERALL = 1000000000;

let rows = [];

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

function money(n) {
  return IDR.format(Number(n) || 0);
}

function shortMoney(n) {
  n = Number(n) || 0;

  if (n >= 1e9)
    return 'Rp' + (n / 1e9).toFixed(2).replace('.', ',') + ' M';

  if (n >= 1e6)
    return 'Rp' + (n / 1e6).toFixed(1).replace('.', ',') + ' Jt';

  if (n >= 1e3)
    return 'Rp' + Math.round(n / 1e3) + ' Rb';

  return money(n);
}

function pct(n) {
  n = Number(n) || 0;
  const p = n * 100;

  return p.toFixed(p % 1 ? 1 : 0).replace('.', ',') + '%';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function setStatus(ok, text) {
  const dot = document.getElementById('statusDot');
  const status = document.getElementById('statusText');

  if (dot) {
    dot.style.background =
      ok === true ? '#222' :
      ok === false ? '#b42318' :
      '#999';
  }

  if (status) status.textContent = text;
}

function normalizeReff(v) {
  const s = String(v ?? '').trim().toUpperCase();

  if (['BSI QRIS', 'QRIS BSI', 'QRIS'].includes(s))
    return 'BSI QRIS';

  if (['CASH', 'TUNAI'].includes(s))
    return 'CASH';

  return s || 'LAINNYA';
}

function parseDate(v) {
  const s = String(v ?? '').trim();

  if (!s) return null;

  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

  if (m)
    return new Date(+m[3], +m[2] - 1, +m[1]);

  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);

  if (m)
    return new Date(+m[1], +m[2] - 1, +m[3]);

  const d = new Date(s);

  return isNaN(d) ? null : d;
}

function dateKey(d) {
  if (!d) return '';

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function displayDate(d) {
  if (!d) return '';

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseCSV(text) {

  const lines = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {

    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && quoted && n === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if ((c === ',' || c === ';') && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((c === '\n' || c === '\r') && !quoted) {

      if (c === '\r' && n === '\n') i++;

      row.push(cell.trim());
      cell = '';

      if (row.some(x => x !== ''))
        lines.push(row);

      row = [];
      continue;
    }

    cell += c;
  }

  if (cell !== '' || row.length) {
    row.push(cell.trim());
    lines.push(row);
  }

  return lines;
}

function buildData(matrix) {

  if (!matrix.length)
    throw new Error('CSV kosong.');

  const header = matrix[0]
    .map(x => String(x).trim().toUpperCase());

  const idx = {};

  header.forEach((h, i) => {
    idx[h] = i;
  });

  const required = [
    'NO',
    'TANGGAL',
    'WAKTU',
    'NAMA DONATUR',
    'REFF',
    'KREDIT',
    'PIC',
    'JENIS DONASI'
  ];

  const missing = required.filter(h => idx[h] === undefined);

  if (missing.length)
    throw new Error(
      'Kolom belum lengkap: ' +
      missing.join(', ')
    );

  rows = [];

  for (let i = 1; i < matrix.length; i++) {

    const r = matrix[i];

    if (!String(r[idx['NO']] ?? '').trim())
      continue;

    const d = parseDate(r[idx['TANGGAL']]);

    const amount =
      Number(
        String(r[idx['KREDIT']] ?? '')
          .replace(/[^\d,-]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0;

    rows.push({

      no:
        Number(r[idx['NO']]) || i,

      date:
        d,

      tanggal:
        dateKey(d),

      waktu:
        String(r[idx['WAKTU']] ?? '').trim(),

      nama:
        String(
          r[idx['NAMA DONATUR']] ?? ''
        ).trim(),

      reff:
        normalizeReff(
          r[idx['REFF']]
        ),

      nominal:
        amount,

      pic:
        String(
          r[idx['PIC']] ?? ''
        ).trim(),

      jenis:
        String(
          r[idx['JENIS DONASI']] ?? ''
        )
        .trim()
        .toUpperCase() || 'LAINNYA'
    });
  }

  rows.sort((a, b) =>
    (b.tanggal + ' ' + b.waktu)
      .localeCompare(
        a.tanggal + ' ' + a.waktu
      )
  );

  render();

  setStatus(
    true,
    `${rows.length} transaksi • Offline`
  );
}

async function loadData() {

  setStatus(
    null,
    'Memuat data...'
  );

  try {

    const response =
      await fetch(
        DATA_URL + '?v=' + Date.now()
      );

    if (!response.ok)
      throw new Error(
        'CSV tidak dapat dibaca.'
      );

    const text =
      await response.text();

    buildData(
      parseCSV(text)
    );

  } catch (error) {

    console.error(error);

    setStatus(
      false,
      'Gagal membaca CSV'
    );
  }
}

function aggregate(field) {

  const map = {};

  rows.forEach(r => {

    const key =
      r[field] || 'Tidak diisi';

    if (!map[key]) {

      map[key] = {
        label: key,
        nominal: 0,
        transaksi: 0
      };
    }

    map[key].nominal += r.nominal;
    map[key].transaksi++;
  });

  return Object.values(map)
    .sort(
      (a, b) =>
        b.nominal - a.nominal
    );
}

function render() {

  const total =
    rows.reduce(
      (s, r) =>
        s + r.nominal,
      0
    );

  const donors =
    new Set(
      rows
        .map(r =>
          r.nama.toLowerCase()
        )
        .filter(Boolean)
    ).size;

  const todayKey =
    dateKey(new Date());

  const today =
    rows
      .filter(
        r =>
          r.tanggal === todayKey
      )
      .reduce(
        (s, r) =>
          s + r.nominal,
        0
      );

  document.getElementById('total')
    .textContent = money(total);

  document.getElementById('transactions')
    .textContent =
      rows.length.toLocaleString('id-ID');

  document.getElementById('donors')
    .textContent =
      donors.toLocaleString('id-ID');

  document.getElementById('today')
    .textContent = money(today);

  const wp =
    Math.min(
      total / TARGET_WEEKLY,
      1
    );

  const op =
    Math.min(
      total / TARGET_OVERALL,
      1
    );

  document.getElementById('weeklyText')
    .textContent =
      shortMoney(total) +
      ' / Rp200 Juta';

  document.getElementById('weeklyPct')
    .textContent =
      pct(wp);

  document.getElementById('weeklyBar')
    .style.width =
      (wp * 100) + '%';

  document.getElementById('weeklyRemaining')
    .textContent =
      total < TARGET_WEEKLY
        ? 'Sisa ' +
          money(
            TARGET_WEEKLY - total
          )
        : 'Target tercapai';

  document.getElementById('overallText')
    .textContent =
      shortMoney(total) +
      ' / Rp1 Miliar';

  document.getElementById('overallPct')
    .textContent =
      pct(op);

  document.getElementById('overallBar')
    .style.width =
      (op * 100) + '%';

  document.getElementById('overallRemaining')
    .textContent =
      total < TARGET_OVERALL
        ? 'Sisa ' +
          money(
            TARGET_OVERALL - total
          )
        : 'Target tercapai';

  renderBars(
    aggregate('reff')
  );

  renderDonut(
    aggregate('jenis')
  );

  renderTrend();

  renderRecent();

  document.getElementById('updated')
    .textContent =
      'Update: ' +
      new Date()
        .toLocaleString('id-ID');
}

function renderBars(items) {

  const el =
    document.getElementById(
      'channelChart'
    );

  if (!items.length) {

    el.className =
      'bar-chart empty';

    el.textContent =
      'Belum ada data';

    return;
  }

  el.className =
    'bar-chart';

  const max =
    items[0].nominal || 1;

  el.innerHTML =
    items
      .slice(0, 8)
      .map(x => `

        <div class="bar-item">

          <div class="bar-label">

            <span>
              ${esc(x.label)}
            </span>

            <b>
              ${money(x.nominal)}
            </b>

          </div>

          <div class="bar-track">

            <div
              class="bar-fill"
              style="width:${x.nominal / max * 100}%">
            </div>

          </div>

        </div>

      `)
      .join('');
}

function renderDonut(items) {

  const el =
    document.getElementById(
      'typeChart'
    );

  if (!items.length) {

    el.className =
      'donut-wrap empty';

    el.textContent =
      'Belum ada data';

    return;
  }

  const total =
    items.reduce(
      (s, x) =>
        s + x.nominal,
      0
    ) || 1;

  let acc = 0;

  const colors = [
    '#111827',
    '#475467',
    '#98A2B3',
    '#D0D5DD',
    '#667085'
  ];

  const stops =
    items
      .map((x, i) => {

        const start =
          acc / total * 100;

        acc += x.nominal;

        return `${colors[i % colors.length]} ${start}% ${acc / total * 100}%`;

      })
      .join(',');

  el.className =
    'donut-wrap';

  el.innerHTML = `

    <div
      class="donut"
      style="background:conic-gradient(${stops})">
    </div>

    <div class="legend">

      ${items
        .slice(0, 6)
        .map((x, i) => `

          <div class="legend-row">

            <i
              class="legend-dot"
              style="background:${colors[i % colors.length]}">
            </i>

            <span>
              ${esc(x.label)}
              —
              ${pct(x.nominal / total)}
            </span>

          </div>

        `)
        .join('')}

    </div>

  `;
}

function renderTrend() {

  const el =
    document.getElementById(
      'trendChart'
    );

  if (!rows.length) {

    el.className =
      'trend empty';

    el.textContent =
      'Belum ada data';

    return;
  }

  const map = {};

  rows.forEach(r => {

    if (r.tanggal)
      map[r.tanggal] =
        (map[r.tanggal] || 0) +
        r.nominal;

  });

  const items =
    Object.entries(map)
      .sort((a, b) =>
        a[0].localeCompare(b[0])
      )
      .slice(-30);

  const vals =
    items.map(x => x[1]);

  const max =
    Math.max(...vals, 1);

  const w = 760;
  const h = 125;
  const p = 25;

  const pts =
    items
      .map((x, i) => {

        const cx =
          p +
          i *
          ((w - 2 * p) /
          Math.max(
            items.length - 1,
            1
          ));

        const cy =
          h - p -
          (x[1] / max) *
          (h - 2 * p);

        return `${cx},${cy}`;

      })
      .join(' ');

  el.className =
    'trend';

  el.innerHTML = `

    <svg
      viewBox="0 0 ${w} ${h}"
      preserveAspectRatio="none">

      <line
        x1="${p}"
        y1="${h-p}"
        x2="${w-p}"
        y2="${h-p}"
        stroke="#e4e7eb"/>

      <polyline
        points="${pts}"
        fill="none"
        stroke="#111827"
        stroke-width="2"/>

    </svg>

  `;
}

function renderRecent() {

  const el =
    document.getElementById(
      'recent'
    );

  el.innerHTML =
    rows
      .slice(0, 25)
      .map(r => `

        <tr>

          <td>
            ${esc(
              r.tanggal
                ? displayDate(r.date) +
                  ' ' +
                  r.waktu
                : r.waktu
            )}
          </td>

          <td>
            ${esc(r.nama)}
          </td>

          <td>
            <b>
              ${money(r.nominal)}
            </b>
          </td>

          <td>
            ${esc(r.reff)}
          </td>

          <td>
            ${esc(r.jenis)}
          </td>

          <td>
            ${esc(r.pic)}
          </td>

        </tr>

      `)
      .join('') ||

    '<tr><td colspan="6" class="muted">Belum ada data yang dapat ditampilkan.</td></tr>';
}

loadData();

setInterval(
  loadData,
  60000
);
