const CLASSIFICATION_META = {
  'Class I': { dotClass: 'class-i', cardClass: 'class-i' },
  'Class II': { dotClass: 'class-ii', cardClass: 'class-ii' },
  'Class III': { dotClass: 'class-iii', cardClass: 'class-iii' },
};

function classificationMeta(classification) {
  return CLASSIFICATION_META[classification] ?? { dotClass: 'class-iii', cardClass: 'class-iii' };
}

function formatDate(dateStr) {
  if (!dateStr) {
    return 'n/a';
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;

      for (const btn of buttons) {
        const isActive = btn === button;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      }

      for (const panel of panels) {
        panel.hidden = panel.id !== `tab-${target}`;
      }
    });
  }
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
    { value: formatDate(stats.most_recent_date), label: 'Most recent recall' },
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

function formatPublishedDate(isoString) {
  if (!isoString) {
    return 'n/a';
  }
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderNewsCard(article) {
  const card = document.createElement('a');
  card.className = 'news-card';
  card.target = '_blank';
  card.rel = 'noopener';
  card.href = article.url;
  card.innerHTML =
    '<div class="news-card-image-wrap"><img class="news-card-image" alt="" /></div>' +
    '<div class="news-card-body">' +
    '<h2 class="news-card-title"></h2>' +
    '<p class="news-card-description"></p>' +
    '<p class="news-card-content"></p>' +
    '<p class="news-card-meta"></p>' +
    '</div>';

  const img = card.querySelector('.news-card-image');
  const useFallback = () => {
    img.onerror = null;
    img.src = '/og-image.png';
    img.classList.add('is-fallback');
  };
  if (article.url_to_image) {
    img.src = article.url_to_image;
    img.onerror = useFallback;
  } else {
    useFallback();
  }

  card.querySelector('.news-card-title').textContent = article.title ?? 'Untitled article';
  card.querySelector('.news-card-description').textContent = article.description ?? '';
  card.querySelector('.news-card-content').textContent = article.content ?? '';
  card.querySelector('.news-card-meta').textContent =
    `${article.source_name ?? 'Unknown source'} · ${formatPublishedDate(article.published_at)}`;

  return card;
}

function renderPagination(pagination, onPageChange) {
  const nav = document.getElementById('news-pagination');
  nav.innerHTML = '';

  if (pagination.totalPages <= 1) {
    return;
  }

  const prevButton = document.createElement('button');
  prevButton.className = 'pagination-button';
  prevButton.type = 'button';
  prevButton.textContent = '‹ Previous';
  prevButton.disabled = pagination.page <= 1;
  prevButton.addEventListener('click', () => onPageChange(pagination.page - 1));

  const status = document.createElement('span');
  status.className = 'pagination-status';
  status.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;

  const nextButton = document.createElement('button');
  nextButton.className = 'pagination-button';
  nextButton.type = 'button';
  nextButton.textContent = 'Next ›';
  nextButton.disabled = pagination.page >= pagination.totalPages;
  nextButton.addEventListener('click', () => onPageChange(pagination.page + 1));

  nav.appendChild(prevButton);
  nav.appendChild(status);
  nav.appendChild(nextButton);
}

function renderNewsFeed(articles) {
  const container = document.getElementById('news-feed');
  container.innerHTML = '';

  if (articles.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No recent news articles found.';
    container.appendChild(empty);
    return;
  }

  for (const article of articles) {
    container.appendChild(renderNewsCard(article));
  }
}

async function loadNewsPage(page) {
  try {
    const newsData = await fetchJSON(`/api/news?page=${page}`);
    renderNewsFeed(newsData.results);
    renderPagination(newsData.pagination, loadNewsPage);
  } catch (err) {
    console.error('Failed to load news data:', err);
    const container = document.getElementById('news-feed');
    container.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'error-state';
    error.textContent = 'Could not load news articles. Please try again later.';
    container.appendChild(error);
    document.getElementById('news-pagination').innerHTML = '';
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
    '<h2 class="firm-heading"><img class="firm-logo" alt="" /><span class="firm-name"></span></h2>' +
    '<p class="product"></p>' +
    '<p class="reason"></p>' +
    '<p class="distribution"></p>' +
    '<p class="dates"></p>' +
    '<a class="source-link" target="_blank" rel="noopener">View source record (openFDA)</a>';

  card.querySelector('.badge').textContent = recall.classification ?? 'Unclassified';
  card.querySelector('.status-tag').textContent = recall.status ?? '';
  card.querySelector('.firm-name').textContent = recall.firm ?? 'Unknown firm';

  const logo = card.querySelector('.firm-logo');
  if (recall.firm) {
    logo.src = `/api/logo?firm=${encodeURIComponent(recall.firm)}`;
    logo.onerror = () => {
      logo.style.display = 'none';
    };
  } else {
    logo.style.display = 'none';
  }

  card.querySelector('.product').textContent = recall.brand ?? recall.product ?? 'Unnamed product';
  card.querySelector('.reason').textContent = recall.reason ?? '';
  card.querySelector('.distribution').textContent = `Distribution: ${recall.distribution ?? 'Unknown'}`;
  card.querySelector('.dates').textContent =
    `Initiated: ${formatDate(recall.initiation_date)} · Reported: ${formatDate(recall.report_date)}`;
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
  initTabs();

  try {
    const [stats, recallsData] = await Promise.all([
      fetchJSON('/api/stats'),
      fetchJSON('/api/recalls'),
    ]);
    const ongoingCount = recallsData.results.filter((r) => r.status === 'Ongoing').length;
    renderKpis(stats, ongoingCount);
    renderSeverity(stats.by_classification);
    renderStateChart(stats.by_state);
    renderRecalls(recallsData.results);
  } catch (err) {
    console.error('Failed to load recall data:', err);
    const container = document.getElementById('recalls');
    container.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'error-state';
    error.textContent = 'Could not load recall data. Please try again later.';
    container.appendChild(error);
  }

  await loadNewsPage(1);
}

init();
