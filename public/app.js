const CLASSIFICATION_META = {
  'Class I': { dotClass: 'class-i', cardClass: 'class-i' },
  'Class II': { dotClass: 'class-ii', cardClass: 'class-ii' },
  'Class III': { dotClass: 'class-iii', cardClass: 'class-iii' },
};

function classificationMeta(classification) {
  return CLASSIFICATION_META[classification] ?? { dotClass: 'class-iii', cardClass: 'class-iii' };
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status}`);
  }
  return response.json();
}

function renderKpis(stats, ongoingCount) {
  const el = document.getElementById('kpis');
  el.innerHTML = '';

  const tiles = [
    { value: stats.total, label: 'Recalls tracked' },
    { value: ongoingCount, label: 'Currently ongoing' },
    { value: stats.most_recent_date ?? 'n/a', label: 'Most recent report' },
  ];

  for (const tile of tiles) {
    const div = document.createElement('div');
    div.className = 'kpi-tile';
    div.innerHTML = '<span class="kpi-value"></span><span class="kpi-label"></span>';
    div.querySelector('.kpi-value').textContent = tile.value;
    div.querySelector('.kpi-label').textContent = tile.label;
    el.appendChild(div);
  }
}

function renderSeverity(byClassification) {
  const el = document.getElementById('severity');
  el.innerHTML = '';

  for (const row of byClassification) {
    const meta = classificationMeta(row.classification);
    const chip = document.createElement('span');
    chip.className = 'severity-chip';
    chip.innerHTML = '<span class="severity-dot"></span><span class="severity-label"></span>';
    chip.querySelector('.severity-dot').classList.add(meta.dotClass);
    chip.querySelector('.severity-label').textContent = `${row.classification ?? 'Unclassified'}: ${row.count}`;
    el.appendChild(chip);
  }
}

function renderStateChart(byState) {
  const el = document.getElementById('state-chart');
  el.innerHTML = '';

  const rows = byState
    .filter((row) => row.state && row.state.trim() && row.state !== 'N/A')
    .sort((a, b) => Number(b.count) - Number(a.count));

  if (rows.length === 0) {
    return;
  }

  const heading = document.createElement('h2');
  heading.textContent = "Recalls by firm's home state";
  el.appendChild(heading);

  const subtitle = document.createElement('p');
  subtitle.className = 'chart-subtitle';
  subtitle.textContent = 'Where the recalling company is based — not where an outbreak occurred.';
  el.appendChild(subtitle);

  const maxCount = Math.max(...rows.map((row) => Number(row.count)));

  for (const row of rows) {
    const count = Number(row.count);
    const barRow = document.createElement('div');
    barRow.className = 'state-bar-row';
    barRow.innerHTML =
      '<span class="state-bar-label"></span>' +
      '<span class="state-bar-track"><span class="state-bar-fill"></span></span>' +
      '<span class="state-bar-value"></span>';
    barRow.querySelector('.state-bar-label').textContent = row.state;
    barRow.querySelector('.state-bar-fill').style.width = `${(count / maxCount) * 100}%`;
    barRow.querySelector('.state-bar-value').textContent = count;
    el.appendChild(barRow);
  }
}

function sourceRecordUrl(recallNumber) {
  const search = `recall_number:"${recallNumber}"`;
  return `https://api.fda.gov/food/enforcement.json?search=${encodeURIComponent(search)}`;
}

function renderRecallCard(recall) {
  const meta = classificationMeta(recall.classification);
  const card = document.createElement('article');
  card.className = `recall-card ${meta.cardClass}`;
  card.innerHTML =
    '<span class="badge"></span>' +
    '<span class="status-tag"></span>' +
    '<h2></h2>' +
    '<p class="product"></p>' +
    '<p class="reason"></p>' +
    '<p class="distribution"></p>' +
    '<p class="dates"></p>' +
    '<a class="source-link" target="_blank" rel="noopener">View source record (openFDA)</a>';

  card.querySelector('.badge').textContent = recall.classification ?? 'Unclassified';
  card.querySelector('.status-tag').textContent = recall.status ?? '';
  card.querySelector('h2').textContent = recall.firm ?? 'Unknown firm';
  card.querySelector('.product').textContent = recall.brand ?? recall.product ?? 'Unnamed product';
  card.querySelector('.reason').textContent = recall.reason ?? '';
  card.querySelector('.distribution').textContent = `Distribution: ${recall.distribution ?? 'Unknown'}`;
  card.querySelector('.dates').textContent =
    `Initiated: ${recall.initiation_date ?? 'n/a'} · Reported: ${recall.report_date ?? 'n/a'}`;
  card.querySelector('.source-link').href = sourceRecordUrl(recall.recall_number);

  return card;
}

function renderRecalls(recalls) {
  const container = document.getElementById('recalls');
  container.innerHTML = '';

  if (recalls.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No active Cyclospora recalls right now — check back during peak season, May–August.';
    container.appendChild(empty);
    return;
  }

  for (const recall of recalls) {
    container.appendChild(renderRecallCard(recall));
  }
}

async function init() {
  const [stats, recallsData] = await Promise.all([
    fetchJSON('/api/stats'),
    fetchJSON('/api/recalls'),
  ]);

  const ongoingCount = recallsData.results.filter((r) => r.status === 'Ongoing').length;

  renderKpis(stats, ongoingCount);
  renderSeverity(stats.by_classification);
  renderStateChart(stats.by_state);
  renderRecalls(recallsData.results);
}

init().catch((err) => {
  console.error('Failed to load recall data:', err);
  const container = document.getElementById('recalls');
  container.innerHTML = '';
  const error = document.createElement('p');
  error.className = 'error-state';
  error.textContent = 'Could not load recall data. Please try again later.';
  container.appendChild(error);
});
