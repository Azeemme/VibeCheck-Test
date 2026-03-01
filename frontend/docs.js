/* ── VibeCheck API Docs — Interactive Logic ── */

// ── API Base URL ──
function getApiBase() {
  const el = document.getElementById('apiBaseUrl');
  return el ? el.value.trim().replace(/\/+$/, '') : 'https://vibecheck-8a86536e.aedify.ai';
}

// ── Update Swagger / ReDoc links when base URL changes ──
function updateNavLinks() {
  const base = getApiBase();
  const swaggerLink = document.getElementById('swaggerLink');
  const redocLink = document.getElementById('redocLink');
  if (swaggerLink) swaggerLink.href = base + '/docs';
  if (redocLink) redocLink.href = base + '/redoc';
}

document.addEventListener('DOMContentLoaded', () => {
  const baseInput = document.getElementById('apiBaseUrl');
  if (baseInput) {
    baseInput.addEventListener('input', updateNavLinks);
    updateNavLinks();
  }

  // ── Sidebar active state via IntersectionObserver ──
  const sections = document.querySelectorAll('.doc-section');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  if (sections.length && sidebarLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          sidebarLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
  }

  // ── Smooth scroll for sidebar links ──
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});


// ── Toggle Endpoint Card ──
function toggleCard(headerEl) {
  const card = headerEl.closest('.endpoint-card');
  if (card) card.classList.toggle('open');
}


// ── Copy Text ──
function copyText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnEl.textContent;
    btnEl.textContent = 'Copied!';
    setTimeout(() => { btnEl.textContent = orig; }, 1500);
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const orig = btnEl.textContent;
    btnEl.textContent = 'Copied!';
    setTimeout(() => { btnEl.textContent = orig; }, 1500);
  });
}


// ── Copy code block content ──
function copyCodeBlock(btn) {
  const wrapper = btn.closest('.code-block-wrapper');
  const codeEl = wrapper ? wrapper.querySelector('.code-block') : null;
  if (codeEl) copyText(codeEl.textContent, btn);
}


// ── Try Endpoint ──
async function tryEndpoint(btnEl) {
  const tryIt = btnEl.closest('.try-it');
  if (!tryIt) return;

  const method = (tryIt.dataset.method || 'GET').toUpperCase();
  let path = tryIt.dataset.path || '/';

  // Collect path parameters
  const pathParams = tryIt.querySelectorAll('.try-pathparam');
  pathParams.forEach(input => {
    const key = input.dataset.key;
    if (key && input.value.trim()) {
      path = path.replace('{' + key + '}', encodeURIComponent(input.value.trim()));
    }
  });

  // Collect query parameters
  const queryParams = tryIt.querySelectorAll('.try-param');
  const params = new URLSearchParams();
  queryParams.forEach(el => {
    const key = el.dataset.key;
    const val = el.value.trim();
    if (key && val) params.append(key, val);
  });

  let url = getApiBase() + path;
  const qs = params.toString();
  if (qs) url += '?' + qs;

  // Build fetch options
  const options = { method, headers: {} };

  if (method === 'POST') {
    const bodyEl = tryIt.querySelector('.try-body');
    if (bodyEl && bodyEl.value.trim()) {
      options.headers['Content-Type'] = 'application/json';
      options.body = bodyEl.value.trim();
    }
  }

  // UI state: loading
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Sending…';

  const resultDiv = tryIt.querySelector('.try-result');
  if (resultDiv) resultDiv.innerHTML = '';

  const t0 = performance.now();

  try {
    const res = await fetch(url, options);
    const elapsed = Math.round(performance.now() - t0);

    // Status badge class
    let statusClass = 'status-2xx';
    if (res.status >= 400 && res.status < 500) statusClass = 'status-4xx';
    else if (res.status >= 500) statusClass = 'status-5xx';

    let bodyHtml = '';
    if (res.status === 204) {
      bodyHtml = '<div class="result-body">No Content</div>';
    } else {
      try {
        const json = await res.json();
        bodyHtml = '<div class="result-body">' + escapeHtml(JSON.stringify(json, null, 2)) + '</div>';
      } catch {
        const text = await res.text();
        bodyHtml = '<div class="result-body">' + escapeHtml(text) + '</div>';
      }
    }

    if (resultDiv) {
      resultDiv.innerHTML =
        '<div class="result-meta">' +
          '<span class="status-badge ' + statusClass + '">' + res.status + ' ' + res.statusText + '</span>' +
          '<span class="result-time">' + elapsed + ' ms</span>' +
        '</div>' +
        bodyHtml;
    }
  } catch (err) {
    if (resultDiv) {
      resultDiv.innerHTML =
        '<div class="result-error">Network Error: ' + escapeHtml(err.message) + '</div>';
    }
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ── Escape HTML ──
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
