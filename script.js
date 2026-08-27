/* =====================================================
   SATU AMAL INDONESIA
   NTT RESPONSE COMMAND CENTER
   OFFLINE CSV DASHBOARD
===================================================== */

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const charts = {};

/* =====================================================
   FORMAT
===================================================== */

function money(n) {
  return IDR.format(Number(n) || 0);
}

function shortMoney(n) {
  n = Number(n) || 0;

  if (n >= 1000000000) {
    return 'Rp' + (n / 1000000000).toFixed(2).replace('.', ',') + ' M';
  }

  if (n >= 1000000) {
    return 'Rp' + (n / 1000000).toFixed(1).replace('.', ',') + ' Jt';
  }

  return money(n);
}

function pct(n) {
  n = Number(n) || 0;

  return (
    (n * 100)
      .toFixed((n * 100) % 1 ? 1 : 0)
      .replace('.', ',') + '%'
  );
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

/* =====================================================
   STATUS
===================================================== */

function setStatus(ok, text) {

  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (dot) {
    dot.style.background =
      ok === true ? '#222' :
      ok === false ? '#b42318' :
      '#999';
  }

  if (statusText) {
    statusText.textContent = text;
  }
}

/* =====================================================
   CSV PARSER
===================================================== */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    // Handle escaped quote ""
    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    // Toggle quote state
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    // Comma delimiter
    if (char === ',' && !insideQuotes) {
      row.push(value.trim());
      value = '';
      continue;
    }

    // New line
    if (
      (char === '\n' || char === '\r') &&
      !insideQuotes
    ) {
      if (char === '\r' && next === '\n') {
        i++;
      }

      row.push(value.trim());

      if (row.some(v => v !== '')) {
        rows.push(row);
      }

      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  // Last value
  if (value || row.length) {
    row.push(value.trim());

    if (row.some(v => v !== '')) {
      rows.push(row);
    }
  }

  /*
   * FIX WPS CSV
   * Jika seluruh baris terbaca sebagai 1 kolom,
   * pecah kembali berdasarkan koma.
   */
  if (
    rows.length &&
    rows[0].length === 1 &&
    String(rows[0][0]).includes(',')
  ) {
    return rows.map(function (r) {
      return splitCSVLine(r[0]);
    });
  }

  return rows;
}


/*
 * Membaca satu baris CSV dengan aman.
 * Mendukung koma di dalam tanda kutip.
 */
function splitCSVLine(line) {
  const result = [];
  let value = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      result.push(value.trim());
      value = '';
      continue;
    }

    value += char;
  }

  result.push(value.trim());

  return result;
}

/* =====================================================
   NORMALIZE
===================================================== */

function normalizeReff(v) {

  const s = String(v || '')
    .trim()
    .toUpperCase();

  if (
    s === 'BSI QRIS' ||
    s === 'QRIS BSI' ||
    s === 'QRIS'
  ) {
    return 'BSI QRIS';
  }

  if (
    s === 'CASH' ||
    s === 'TUNAI'
  ) {
    return 'CASH';
  }

  return s || 'LAINNYA';
}

function parseAmount(v) {

  if (typeof v === 'number') {
    return v;
  }

  let s = String(v || '')
    .replace(/Rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '');

  return Number(s) || 0;
}

/* =====================================================
   CONVERT CSV DATA
===================================================== */

function csvToData(csvRows) {

  if (!csvRows.length) {
    throw new Error('CSV kosong.');
  }

  const headers = csvRows[0].map(h =>
    String(h)
      .trim()
      .toUpperCase()
  );

  function findHeader(names) {

    for (const name of names) {
      const index = headers.indexOf(name);

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  const idx = {

    no: findHeader(['NO']),

    tanggal: findHeader(['TANGGAL', 'DATE']),

    waktu: findHeader(['WAKTU', 'TIME']),

    nama: findHeader([
      'NAMA DONATUR',
      'NAMA',
      'DONATUR'
    ]),

    reff: findHeader([
      'REFF',
      'KANAL',
      'CHANNEL'
    ]),

    kredit: findHeader([
      'KREDIT',
      'NOMINAL',
      'JUMLAH',
      'DONASI'
    ]),

    pic: findHeader(['PIC']),

    jenis: findHeader([
      'JENIS DONASI',
      'JENIS'
    ])
  };

  if (idx.kredit === -1) {
    throw new Error(
      'Kolom KREDIT/NOMINAL tidak ditemukan.'
    );
  }

  const data = [];

  for (let i = 1; i < csvRows.length; i++) {

    const r = csvRows[i];

    if (!r.length) continue;

    const nominal =
      parseAmount(r[idx.kredit]);

    if (!nominal) continue;

    data.push({

      no:
        idx.no >= 0
          ? Number(r[idx.no]) || i
          : i,

      tanggal:
        idx.tanggal >= 0
          ? String(r[idx.tanggal] || '').trim()
          : '',

      waktu:
        idx.waktu >= 0
          ? String(r[idx.waktu] || '').trim()
          : '',

      nama:
        idx.nama >= 0
          ? String(r[idx.nama] || '').trim()
          : '',

      reff:
        idx.reff >= 0
          ? normalizeReff(r[idx.reff])
          : 'LAINNYA',

      nominal,

      pic:
        idx.pic >= 0
          ? String(r[idx.pic] || '').trim()
          : '',

      jenis:
        idx.jenis >= 0
          ? String(r[idx.jenis] || '')
              .trim()
              .toUpperCase()
          : 'LAINNYA'
    });
  }

  return data;
}

/* =====================================================
   AGGREGATE
===================================================== */

function aggregate(rows, field) {

  const map = {};

  rows.forEach(r => {

    const key = r[field] || 'Tidak diisi';

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
    .sort((a, b) => b.nominal - a.nominal);
}

/* =====================================================
   BUILD DASHBOARD DATA
===================================================== */

function buildDashboard(rows) {

  const total = rows.reduce(
    (sum, r) => sum + r.nominal,
    0
  );

  const uniqueDonors =
    new Set(
      rows
        .map(r => r.nama.toLowerCase())
        .filter(Boolean)
    ).size;

  const today = new Date();

  const todayString =
    today.toLocaleDateString('id-ID');

  const todayTotal =
    rows
      .filter(r => {

        if (!r.tanggal) return false;

        return (
          r.tanggal === todayString ||
          r.tanggal ===
            today.toISOString().slice(0, 10)
        );
      })
      .reduce(
        (sum, r) => sum + r.nominal,
        0
      );

  const byDate = aggregate(rows, 'tanggal');

  return {

    summary: {

      total,

      transactions:
        rows.length,

      uniqueDonors,

      todayTotal,

      weeklyProgress:
        Math.min(total / 200000000, 1),

      overallProgress:
        Math.min(total / 1000000000, 1),

      weeklyRemaining:
        Math.max(
          200000000 - total,
          0
        ),

      overallRemaining:
        Math.max(
          1000000000 - total,
          0
        )
    },

    byReff:
      aggregate(rows, 'reff'),

    byJenis:
      aggregate(rows, 'jenis'),

    byDate,

    recent:
      rows.slice()
        .reverse()
        .slice(0, 25)
  };
}

/* =====================================================
   RENDER
===================================================== */

function render(d) {

  const s = d.summary;

  document.getElementById('total').textContent =
    money(s.total);

  document.getElementById('transactions').textContent =
    Number(s.transactions || 0)
      .toLocaleString('id-ID');

  document.getElementById('donors').textContent =
    Number(s.uniqueDonors || 0)
      .toLocaleString('id-ID');

  document.getElementById('today').textContent =
    money(s.todayTotal);

  /* TARGET 1 MINGGU */

  document.getElementById('weeklyText').textContent =
    shortMoney(s.total) +
    ' / Rp200 Juta';

  document.getElementById('weeklyPct').textContent =
    pct(s.weeklyProgress);

  document.getElementById('weeklyBar').style.width =
    Math.min(
      s.weeklyProgress * 100,
      100
    ) + '%';

  document.getElementById('weeklyRemaining').textContent =
    s.weeklyRemaining > 0
      ? 'Sisa ' + money(s.weeklyRemaining)
      : 'Target tercapai';

  /* TARGET 1 MILIAR */

  document.getElementById('overallText').textContent =
    shortMoney(s.total) +
    ' / Rp1 Miliar';

  document.getElementById('overallPct').textContent =
    pct(s.overallProgress);

  document.getElementById('overallBar').style.width =
    Math.min(
      s.overallProgress * 100,
      100
    ) + '%';

  document.getElementById('overallRemaining').textContent =
    s.overallRemaining > 0
      ? 'Sisa ' + money(s.overallRemaining)
      : 'Target tercapai';

  /* CHART */

 renderChart(
  'channelChart',
  'bar',
  (d.byReff || []).slice().reverse()
);

renderChart(
  'typeChart',
  'doughnut',
  d.byJenis || []
);

renderChart(
  'trendChart',
  'line',
  (d.byDate || []).slice().reverse()
);

  /* RECENT */

  const recent =
    document.getElementById('recent');

  if (recent) {

    recent.innerHTML =
      (d.recent || [])
        .map(function (r) {

          return `
            <tr>
              <td>
                ${esc(
                  (r.tanggal || '') +
                  ' ' +
                  (r.waktu || '')
                )}
              </td>

              <td>
                ${esc(r.nama)}
              </td>

              <td>
                <b>${money(r.nominal)}</b>
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
          `;

        })
        .join('');
  }

  const updated =
    document.getElementById('updated');

  if (updated) {

    updated.textContent =
      'Update: ' +
      new Date().toLocaleString('id-ID');
  }

  setStatus(
    true,
    'Offline • Data berhasil dimuat'
  );
}

/* =====================================================
   CHART
===================================================== */

function renderChart(id, type, items) {

  const canvas =
    document.getElementById(id);

  if (!canvas) return;

  if (charts[id]) {
    charts[id].destroy();
  }

  if (!items.length) {
    return;
  }

  charts[id] =
    new Chart(
      canvas,
      {

        type,

        data: {

          labels:
            items.map(x => x.label),

          datasets: [

            {

              label: 'Nominal',

              data:
                items.map(
                  x => x.nominal
                ),

              borderWidth: 2,

              tension: 0.25
            }
          ]
        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          plugins: {

            legend: {

              display:
                type === 'doughnut'
            }
          },

          scales:
            type === 'doughnut'
              ? {}
              : {

                  y: {

                    beginAtZero: true,

                    ticks: {

                      callback:
                        value =>
                          shortMoney(value)
                    }
                  },

                  x: {

                    ticks: {

                      maxRotation: 0
                    }
                  }
                }
        }
      }
    );
}

/* =====================================================
   IMPORT CSV
===================================================== */

function importCSV() {

  const input =
    document.createElement('input');

  input.type = 'file';

  input.accept =
    '.csv,text/csv';

  input.style.display = 'none';

  document.body.appendChild(input);

  input.addEventListener(
    'change',
    function () {

      const file =
        input.files[0];

      if (!file) {
        input.remove();
        return;
      }

      setStatus(
        null,
        'Membaca CSV...'
      );

      const reader =
        new FileReader();

      reader.onload =
        function (event) {

          try {

            const text =
              event.target.result;

            const csv =
              parseCSV(text);

            const rows =
              csvToData(csv);

            if (!rows.length) {
              throw new Error(
                'Tidak ada transaksi yang ditemukan.'
              );
            }

            const dashboard =
              buildDashboard(rows);

            render(dashboard);

            localStorage.setItem(
              'satuAmalNTTData',
              JSON.stringify(rows)
            );

            setStatus(
              true,
              rows.length +
              ' transaksi berhasil dimuat'
            );

          }

          catch (error) {

            console.error(error);

            setStatus(
              false,
              error.message
            );

            alert(
              'CSV tidak dapat dibaca.\n\n' +
              error.message
            );
          }

          input.remove();
        };

      reader.onerror =
        function () {

          setStatus(
            false,
            'Gagal membaca file CSV'
          );

          input.remove();
        };

      reader.readAsText(
        file,
        'UTF-8'
      );
    }
  );

  input.click();
}

/* =====================================================
   LOAD DATA TERSIMPAN
===================================================== */

function loadSavedData() {

  try {

    const saved =
      localStorage.getItem(
        'satuAmalNTTData'
      );

    if (!saved) {

      setStatus(
        null,
        'Belum ada data • Import CSV'
      );

      return;
    }

    const rows =
      JSON.parse(saved);

    const dashboard =
      buildDashboard(rows);

    render(dashboard);

  }

  catch (error) {

    console.error(error);

    setStatus(
      false,
      'Data tersimpan rusak'
    );
  }
}

/* =====================================================
   RESET
===================================================== */

function resetData() {

  if (
    !confirm(
      'Hapus semua data dashboard?'
    )
  ) {
    return;
  }

  localStorage.removeItem(
    'satuAmalNTTData'
  );

  location.reload();
}

/* =====================================================
   BUTTON
===================================================== */

document.addEventListener(
  'DOMContentLoaded',
  function () {

    /*
      Cari tombol Import Excel/CSV
      berdasarkan ID atau teks tombol.
    */

    const buttons =
      document.querySelectorAll(
        'button, input[type="button"], input[type="submit"]'
      );

    buttons.forEach(function (button) {

      const text =
        (
          button.textContent ||
          button.value ||
          ''
        )
          .trim()
          .toLowerCase();

      if (
        text.includes('import') ||
        text.includes('excel') ||
        text.includes('csv')
      ) {

        button.addEventListener(
          'click',
          importCSV
        );
      }

      if (
        text.includes('reset')
      ) {

        button.addEventListener(
          'click',
          resetData
        );
      }
    });

    loadSavedData();

  }
);
