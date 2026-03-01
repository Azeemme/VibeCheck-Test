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

// ── Escape HTML ──
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ══════════════════════════════════════════════
//  JSON SYNTAX HIGHLIGHTING
// ══════════════════════════════════════════════
function highlightJson(jsonStr) {
  return jsonStr.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    '<span class="json-key">$1</span><span class="json-punct">:</span>'
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    ': <span class="json-string">$1</span>'
  ).replace(
    /:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    ': <span class="json-number">$1</span>'
  ).replace(
    /:\s*(true|false)/g,
    ': <span class="json-bool">$1</span>'
  ).replace(
    /:\s*(null)/g,
    ': <span class="json-null">$1</span>'
  ).replace(
    /([{}[\],])/g,
    '<span class="json-punct">$1</span>'
  );
}

// A standalone version for JSON values that aren't after a colon (array items etc.)
function highlightJsonFull(jsonStr) {
  // First pass: escape HTML
  let s = escapeHtml(jsonStr);
  // Then highlight tokens
  // Keys (before colon)
  s = s.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)\s*:/g, '<span class="json-key">$1</span><span class="json-punct">:</span>');
  // Strings (after colon or in arrays)
  s = s.replace(/(:\s*)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '$1<span class="json-string">$2</span>');
  // Numbers
  s = s.replace(/(:\s*)(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, '$1<span class="json-number">$2</span>');
  // Booleans + null
  s = s.replace(/(:\s*)(true|false|null)\b/g, '$1<span class="json-bool">$2</span>');
  // Punctuation
  s = s.replace(/([{}[\],])/g, '<span class="json-punct">$1</span>');
  return s;
}

// ══════════════════════════════════════════════
//  FORMAT RESPONSE SIZE
// ══════════════════════════════════════════════
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ══════════════════════════════════════════════
//  COLLAPSIBLE RESPONSE
// ══════════════════════════════════════════════
function buildResponseBody(jsonStr, highlighted) {
  const lines = jsonStr.split('\n');
  const MAX_VISIBLE = 20;
  const COLLAPSE_AT = 15;

  if (lines.length <= MAX_VISIBLE) {
    return '<div class="result-body">' + highlighted + '</div>';
  }

  const visibleLines = lines.slice(0, COLLAPSE_AT);
  const visibleHighlighted = highlightJsonFull(visibleLines.join('\n'));
  const totalLines = lines.length;

  return '<div class="result-body response-collapsed" data-full-html="' + escapeHtml(highlighted) + '" data-collapsed-html="' + escapeHtml(visibleHighlighted) + '" data-is-collapsed="true">' +
    visibleHighlighted + '</div>' +
    '<button class="response-toggle-btn" onclick="toggleResponseCollapse(this)">▼ Show full response (' + totalLines + ' lines)</button>';
}

function toggleResponseCollapse(btn) {
  const body = btn.previousElementSibling;
  if (!body) return;
  const isCollapsed = body.getAttribute('data-is-collapsed') === 'true';
  if (isCollapsed) {
    body.innerHTML = body.getAttribute('data-full-html');
    body.setAttribute('data-is-collapsed', 'false');
    body.style.maxHeight = 'none';
    btn.textContent = '▲ Collapse response';
  } else {
    body.innerHTML = body.getAttribute('data-collapsed-html');
    body.setAttribute('data-is-collapsed', 'true');
    body.style.maxHeight = '';
    btn.textContent = '▼ Show full response';
  }
}

// ══════════════════════════════════════════════
//  CURL GENERATION
// ══════════════════════════════════════════════
function generateCurl(tryItEl) {
  const method = (tryItEl.dataset.method || 'GET').toUpperCase();
  let path = tryItEl.dataset.path || '/';

  tryItEl.querySelectorAll('.try-pathparam').forEach(input => {
    const key = input.dataset.key;
    if (key && input.value.trim()) {
      path = path.replace('{' + key + '}', encodeURIComponent(input.value.trim()));
    }
  });

  const params = new URLSearchParams();
  tryItEl.querySelectorAll('.try-param').forEach(el => {
    const key = el.dataset.key;
    const val = el.value.trim();
    if (key && val) params.append(key, val);
  });

  let url = getApiBase() + path;
  const qs = params.toString();
  if (qs) url += '?' + qs;

  let parts = ['curl'];
  if (method !== 'GET') parts.push('-X ' + method);
  parts.push("'" + url + "'");

  if (method === 'POST') {
    const bodyEl = tryItEl.querySelector('.try-body');
    if (bodyEl && bodyEl.value.trim()) {
      parts.push("-H 'Content-Type: application/json'");
      parts.push("-d '" + bodyEl.value.trim() + "'");
    }
  }

  return parts.join(' \\\n  ');
}

function toggleCurl(btn) {
  const tryIt = btn.closest('.try-it');
  if (!tryIt) return;
  let display = tryIt.querySelector('.curl-display');

  if (!display) {
    display = document.createElement('div');
    display.className = 'curl-display';
    display.innerHTML = '<button class="copy-btn" onclick="copyText(this.nextElementSibling.textContent, this)">Copy</button><pre></pre>';
    btn.closest('.try-btn-row').after(display);
  }

  display.classList.toggle('show');
  if (display.classList.contains('show')) {
    display.querySelector('pre').textContent = generateCurl(tryIt);
    btn.textContent = '⌃ Hide cURL';
  } else {
    btn.textContent = '⌄ Show as cURL';
  }
}

// ══════════════════════════════════════════════
//  ID PICKERS
// ══════════════════════════════════════════════
let activePickerDropdown = null;

function closeAllPickers() {
  if (activePickerDropdown) {
    activePickerDropdown.remove();
    activePickerDropdown = null;
  }
}

async function loadAssessmentPicker(btn) {
  const input = btn.closest('.try-field-row').querySelector('input');
  if (!input) return;

  closeAllPickers();
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch(getApiBase() + '/v1/assessments?per_page=10&sort=-created_at');
    const payload = await res.json();
    const items = payload.data || [];

    const dropdown = document.createElement('div');
    dropdown.className = 'id-picker-dropdown';

    if (!items.length) {
      dropdown.innerHTML = '<div class="id-picker-empty">No assessments found.<br><a href="#ep-create-assessment" onclick="closeAllPickers()">Create one first →</a></div>';
    } else {
      items.forEach(a => {
        const item = document.createElement('div');
        item.className = 'id-picker-item';
        item.innerHTML = '<span class="picker-id">' + escapeHtml(a.id) + '</span>' +
          '<span class="picker-meta">' + escapeHtml(a.mode) + ' · ' + escapeHtml(a.status) + ' · ' +
          (a.finding_counts?.total || 0) + ' findings</span>';
        item.addEventListener('click', () => {
          input.value = a.id;
          closeAllPickers();
          input.dispatchEvent(new Event('change'));
        });
        dropdown.appendChild(item);
      });
    }

    const rect = btn.closest('.try-field').getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    document.body.appendChild(dropdown);
    activePickerDropdown = dropdown;

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closePicker(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
          closeAllPickers();
          document.removeEventListener('click', closePicker);
        }
      });
    }, 50);

  } catch (e) {
    console.error('Failed to load assessments:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load';
  }
}

async function loadFindingPicker(btn) {
  const input = btn.closest('.try-field-row').querySelector('input');
  if (!input) return;

  // Find the assessment ID in the same try-it panel
  const tryIt = btn.closest('.try-it');
  const asmInput = tryIt.querySelector('.try-pathparam[data-key="id"]');
  const asmId = asmInput ? asmInput.value.trim() : '';
  if (!asmId) {
    alert('Fill in the Assessment ID first');
    return;
  }

  closeAllPickers();
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch(getApiBase() + '/v1/assessments/' + encodeURIComponent(asmId) + '/findings?per_page=10');
    const payload = await res.json();
    const items = payload.data || [];

    const dropdown = document.createElement('div');
    dropdown.className = 'id-picker-dropdown';

    if (!items.length) {
      dropdown.innerHTML = '<div class="id-picker-empty">No findings for this assessment.</div>';
    } else {
      items.forEach(f => {
        const item = document.createElement('div');
        item.className = 'id-picker-item';
        item.innerHTML = '<span class="finding-severity severity-' + escapeHtml(f.severity) + '">' + escapeHtml(f.severity) + '</span>' +
          '<span class="picker-id">' + escapeHtml(f.id) + '</span>' +
          '<span class="picker-meta" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(f.title || f.category) + '</span>';
        item.addEventListener('click', () => {
          input.value = f.id;
          closeAllPickers();
        });
        dropdown.appendChild(item);
      });
    }

    const rect = btn.closest('.try-field').getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    document.body.appendChild(dropdown);
    activePickerDropdown = dropdown;

    setTimeout(() => {
      document.addEventListener('click', function closePicker(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
          closeAllPickers();
          document.removeEventListener('click', closePicker);
        }
      });
    }, 50);

  } catch (e) {
    console.error('Failed to load findings:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load';
  }
}

// ══════════════════════════════════════════════
//  TOGGLE ENDPOINT CARD
// ══════════════════════════════════════════════
function toggleCard(headerEl) {
  const card = headerEl.closest('.endpoint-card');
  if (!card) return;
  card.classList.toggle('open');

  // Deep linking: update hash
  const section = card.closest('.doc-section');
  if (section && card.classList.contains('open')) {
    history.replaceState(null, '', '#' + section.id);
  }

  // Persist state
  saveOpenCards();

  // Lazy load: render body content on first open
  const body = card.querySelector('.endpoint-body-inner');
  if (body && body.dataset.lazy) {
    body.innerHTML = body.dataset.lazy;
    delete body.dataset.lazy;
  }
}

// ══════════════════════════════════════════════
//  COPY TEXT
// ══════════════════════════════════════════════
function copyText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnEl.textContent;
    btnEl.textContent = 'Copied!';
    setTimeout(() => { btnEl.textContent = orig; }, 1500);
  }).catch(() => {
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

function copyCodeBlock(btn) {
  const wrapper = btn.closest('.code-block-wrapper');
  const codeEl = wrapper ? wrapper.querySelector('.code-block') : null;
  if (codeEl) copyText(codeEl.textContent, btn);
}

// ══════════════════════════════════════════════
//  TRY ENDPOINT
// ══════════════════════════════════════════════
async function tryEndpoint(btnEl) {
  const tryIt = btnEl.closest('.try-it');
  if (!tryIt) return;

  const method = (tryIt.dataset.method || 'GET').toUpperCase();
  let path = tryIt.dataset.path || '/';

  // Collect path parameters
  tryIt.querySelectorAll('.try-pathparam').forEach(input => {
    const key = input.dataset.key;
    if (key && input.value.trim()) {
      path = path.replace('{' + key + '}', encodeURIComponent(input.value.trim()));
    }
  });

  // Collect query parameters
  const params = new URLSearchParams();
  tryIt.querySelectorAll('.try-param').forEach(el => {
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

    // Display URL truncated
    const displayUrl = method + ' ' + url;

    let bodyHtml = '';
    let responseSize = 0;

    if (res.status === 204) {
      bodyHtml = '<div class="result-body">No Content</div>';
    } else {
      try {
        const json = await res.json();
        const jsonStr = JSON.stringify(json, null, 2);
        responseSize = jsonStr.length;
        const highlighted = highlightJsonFull(jsonStr);
        bodyHtml = buildResponseBody(jsonStr, highlighted);

        // Error card for 4xx/5xx
        if (res.status >= 400) {
          const errMsg = json?.error?.message || json?.detail || JSON.stringify(json);
          const errType = json?.error?.type || json?.error?.code || res.status;
          let hint = '';
          if (res.status === 404 && (path.includes('/assessments/') || path.includes('/findings/'))) {
            hint = '<div class="error-hint">💡 Make sure you\'ve created an assessment first using the <a href="#ep-create-assessment">Create Assessment</a> endpoint above.</div>';
          }
          bodyHtml = '<div class="result-error">' +
            '<div class="error-header"><span class="error-type">' + escapeHtml(String(errType)) + '</span></div>' +
            '<div class="error-message">' + escapeHtml(errMsg) + '</div>' +
            hint + '</div>';
        }
      } catch {
        const text = await res.text();
        responseSize = text.length;
        bodyHtml = '<div class="result-body">' + escapeHtml(text) + '</div>';
      }
    }

    if (resultDiv) {
      resultDiv.innerHTML =
        '<div class="result-meta">' +
        '<span class="result-url" title="' + escapeHtml(displayUrl) + '">' + escapeHtml(displayUrl) + '</span>' +
        '<span class="status-badge ' + statusClass + '">' + res.status + ' ' + res.statusText + '</span>' +
        '<span class="result-time">' + elapsed + ' ms</span>' +
        '<span class="result-size">' + formatSize(responseSize) + '</span>' +
        '</div>' +
        bodyHtml;
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    if (resultDiv) {
      resultDiv.innerHTML =
        '<div class="result-error">' +
        '<div class="error-header"><span class="error-type">NETWORK ERROR</span></div>' +
        '<div class="error-message">' + escapeHtml(err.message) + '</div>' +
        '<div class="error-hint">💡 Check that the API Base URL is correct and the server is running. CORS may block requests from different origins.</div>' +
        '</div>';
    }
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}

// ══════════════════════════════════════════════
//  GUIDED DEMO ("Run Full Demo")
// ══════════════════════════════════════════════
let demoRunning = false;

async function runFullDemo() {
  if (demoRunning) return;
  demoRunning = true;

  const btn = document.getElementById('runDemoBtn');
  const container = document.getElementById('demoContainer');
  if (!btn || !container) return;

  btn.disabled = true;
  container.classList.remove('hidden');
  container.innerHTML = buildDemoSteps();

  const steps = container.querySelectorAll('.demo-step');
  const base = getApiBase();

  try {
    // Step 1: Create Assessment
    activateStep(steps[0]);
    setStepStatus(steps[0], '<span class="demo-spinner"></span> Creating assessment...');

    const createRes = await fetch(base + '/v1/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'lightweight',
        repo_url: 'https://github.com/vulnerable-apps/damn-vulnerable-MCP-server'
      })
    });

    if (!createRes.ok) throw new Error('Create failed: ' + createRes.status);
    const assessment = await createRes.json();
    const asmId = assessment.id;

    completeStep(steps[0]);
    setStepStatus(steps[0], '✓ Assessment created: <code>' + escapeHtml(asmId) + '</code>');

    // Step 2: Poll for completion
    activateStep(steps[1]);
    let status = assessment.status;
    let pollCount = 0;
    const maxPolls = 60; // 3 minutes max

    while (!['complete', 'failed'].includes(status) && pollCount < maxPolls) {
      setStepStatus(steps[1], '<span class="demo-spinner"></span> Status: <strong>' + escapeHtml(status) + '</strong>...');
      await sleep(3000);
      pollCount++;

      const pollRes = await fetch(base + '/v1/assessments/' + encodeURIComponent(asmId));
      if (!pollRes.ok) throw new Error('Poll failed: ' + pollRes.status);
      const pollData = await pollRes.json();
      status = pollData.status;
    }

    if (status === 'failed') {
      errorStep(steps[1]);
      setStepStatus(steps[1], '✗ Scan failed. Try again or check the API.');
      throw new Error('Assessment failed');
    }

    completeStep(steps[1]);
    setStepStatus(steps[1], '✓ Scan complete!');

    // Step 3: Fetch findings
    activateStep(steps[2]);
    setStepStatus(steps[2], '<span class="demo-spinner"></span> Fetching findings...');

    const findingsRes = await fetch(base + '/v1/assessments/' + encodeURIComponent(asmId) + '/findings?per_page=5&sort=severity');
    if (!findingsRes.ok) throw new Error('Findings fetch failed: ' + findingsRes.status);
    const findingsPayload = await findingsRes.json();
    const findings = findingsPayload.data || [];

    completeStep(steps[2]);
    setStepStatus(steps[2], '✓ Found <strong>' + findings.length + '</strong> findings (showing top 5)');

    // Step 4: Display findings
    activateStep(steps[3]);
    let findingsHtml = '<div class="demo-findings-grid">';
    findings.forEach(f => {
      findingsHtml += '<div class="demo-finding-card">' +
        '<span class="finding-severity severity-' + escapeHtml(f.severity) + '">' + escapeHtml(f.severity) + '</span>' +
        '<div class="finding-title">' + escapeHtml(f.title) + '</div>' +
        '<div class="finding-meta">' + escapeHtml(f.category || '') + ' · ' + escapeHtml(f.agent || '') + '</div>' +
        '</div>';
    });
    findingsHtml += '</div>';
    findingsHtml += '<a class="demo-view-all" href="#ep-list-findings" onclick="prefillAllTryInputs(\'' + escapeHtml(asmId) + '\')">View all findings →</a>';

    completeStep(steps[3]);
    setStepStatus(steps[3], findingsHtml);

    // Auto-fill all Try It panels with the real assessment ID
    prefillAllTryInputs(asmId);

    if (findings.length > 0) {
      // Also fill finding ID fields with first finding
      document.querySelectorAll('.try-pathparam[data-key="finding_id"]').forEach(input => {
        input.value = findings[0].id;
      });
    }

  } catch (e) {
    console.error('Demo failed:', e);
  } finally {
    btn.disabled = false;
    demoRunning = false;
  }
}

function prefillAllTryInputs(asmId) {
  document.querySelectorAll('.try-pathparam[data-key="id"]').forEach(input => {
    input.value = asmId;
  });
}

function buildDemoSteps() {
  return '<div class="demo-steps">' +
    '<div class="demo-step" id="demo-step-1"><div class="demo-step-num">1</div><div class="demo-step-content"><div class="demo-step-title">Create Assessment</div><div class="demo-step-status">Waiting...</div></div></div>' +
    '<div class="demo-step" id="demo-step-2"><div class="demo-step-num">2</div><div class="demo-step-content"><div class="demo-step-title">Poll Scan Status</div><div class="demo-step-status">Waiting...</div></div></div>' +
    '<div class="demo-step" id="demo-step-3"><div class="demo-step-num">3</div><div class="demo-step-content"><div class="demo-step-title">Fetch Findings</div><div class="demo-step-status">Waiting...</div></div></div>' +
    '<div class="demo-step" id="demo-step-4"><div class="demo-step-num">4</div><div class="demo-step-content"><div class="demo-step-title">View Results</div><div class="demo-step-status">Waiting...</div></div></div>' +
    '</div>';
}

function activateStep(el) { el.classList.add('step-active'); el.classList.remove('step-done', 'step-error'); }
function completeStep(el) { el.classList.add('step-done'); el.classList.remove('step-active', 'step-error'); }
function errorStep(el) { el.classList.add('step-error'); el.classList.remove('step-active', 'step-done'); }
function setStepStatus(el, html) {
  const statusEl = el.querySelector('.demo-step-status');
  if (statusEl) statusEl.innerHTML = html;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════
//  QUICK FILL BUTTONS
// ══════════════════════════════════════════════
function quickFillRepo() {
  const ta = document.querySelector('#ep-create-assessment .try-body');
  if (ta) ta.value = JSON.stringify({
    mode: "lightweight",
    repo_url: "https://github.com/vulnerable-apps/damn-vulnerable-MCP-server"
  }, null, 2);
}

function quickFillFiles() {
  const ta = document.querySelector('#ep-create-assessment .try-body');
  if (ta) ta.value = JSON.stringify({
    mode: "lightweight",
    files: [{
      path: "app.py",
      content: "import os\nJWT_SECRET = \"supersecret123\"\ndb.execute(f\"SELECT * FROM users WHERE id = {id}\")\nos.system(\"rm -rf \" + user_input)\napp.run(debug=True)"
    }]
  }, null, 2);
}

// ══════════════════════════════════════════════
//  SIDEBAR SEARCH / FILTER
// ══════════════════════════════════════════════
function filterSidebar(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.sidebar-link').forEach(link => {
    if (!q) {
      link.classList.remove('hidden-by-search');
      return;
    }
    const text = link.textContent.toLowerCase();
    link.classList.toggle('hidden-by-search', !text.includes(q));
  });
}

// ══════════════════════════════════════════════
//  MOBILE SIDEBAR
// ══════════════════════════════════════════════
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.doc-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open');
  if (backdrop) backdrop.classList.toggle('show', !isOpen);
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.doc-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('show');
}

// ══════════════════════════════════════════════
//  BACK TO TOP
// ══════════════════════════════════════════════
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ══════════════════════════════════════════════
//  PERSIST OPEN CARDS (sessionStorage)
// ══════════════════════════════════════════════
function saveOpenCards() {
  const openIds = [];
  document.querySelectorAll('.endpoint-card.open').forEach(card => {
    const section = card.closest('.doc-section');
    if (section) openIds.push(section.id);
  });
  try { sessionStorage.setItem('vc-docs-open-cards', JSON.stringify(openIds)); } catch { }
}

function restoreOpenCards() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('vc-docs-open-cards') || '[]');
    saved.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        const card = section.querySelector('.endpoint-card');
        if (card) card.classList.add('open');
      }
    });
  } catch { }
}

// ══════════════════════════════════════════════
//  DEEP LINKING
// ══════════════════════════════════════════════
function handleDeepLink() {
  const hash = window.location.hash?.slice(1);
  if (!hash) return;

  const target = document.getElementById(hash);
  if (!target) return;

  // If it's an endpoint section, open the card
  const card = target.querySelector('.endpoint-card');
  if (card && !card.classList.contains('open')) {
    card.classList.add('open');
  }

  // Scroll to it
  setTimeout(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

// ══════════════════════════════════════════════
//  DOMContentLoaded — Init all features
// ══════════════════════════════════════════════
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
        closeMobileSidebar();
      }
    });
  });

  // ── Sidebar search ──
  const sidebarSearchInput = document.getElementById('sidebarSearch');
  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => filterSidebar(e.target.value));
  }

  // ── Mobile sidebar ──
  const hamburger = document.getElementById('hamburgerBtn');
  if (hamburger) {
    hamburger.addEventListener('click', toggleMobileSidebar);
  }
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }

  // ── Keyboard navigation ──
  document.addEventListener('keydown', (e) => {
    // "/" focuses sidebar search
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      const searchInput = document.getElementById('sidebarSearch');
      if (searchInput) searchInput.focus();
    }

    // Escape: close mobile sidebar + open cards + picker dropdowns
    if (e.key === 'Escape') {
      closeMobileSidebar();
      closeAllPickers();
    }
  });

  // ── Endpoint header keyboard accessibility ──
  document.querySelectorAll('.endpoint-header').forEach(header => {
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCard(header);
      }
    });
  });

  // ── Back to Top ──
  initBackToTop();

  // ── Restore previously open cards ──
  restoreOpenCards();

  // ── Deep linking ──
  handleDeepLink();
  window.addEventListener('hashchange', handleDeepLink);

  // ══════════════════════════════════════════════
  //  AUTO-ENHANCE: Card classes, Load buttons,
  //  curl toggles, quick-fill buttons
  // ══════════════════════════════════════════════

  // 1) Add card-method classes for hover accent
  document.querySelectorAll('.endpoint-card').forEach(card => {
    const badge = card.querySelector('.method-badge');
    if (!badge) return;
    const text = badge.textContent.trim().toLowerCase();
    if (text === 'get') card.classList.add('card-get');
    else if (text === 'post') card.classList.add('card-post');
    else if (text === 'del' || text === 'delete') card.classList.add('card-delete');
    else if (text === 'ws') card.classList.add('card-ws');
  });

  // 2) Wrap each Try It Send button in a try-btn-row with a cURL toggle
  document.querySelectorAll('.try-it .try-send-btn').forEach(btn => {
    // Skip if already wrapped
    if (btn.parentElement.classList.contains('try-btn-row')) return;

    const row = document.createElement('div');
    row.className = 'try-btn-row';
    btn.parentNode.insertBefore(row, btn);
    row.appendChild(btn);

    const curlBtn = document.createElement('button');
    curlBtn.className = 'curl-toggle-btn';
    curlBtn.textContent = '⌄ Show as cURL';
    curlBtn.onclick = function () { toggleCurl(this); };
    row.appendChild(curlBtn);
  });

  // 3) Add Load buttons next to assessment ID and finding ID inputs
  document.querySelectorAll('.try-pathparam[data-key="id"]').forEach(input => {
    // Skip if already has load button
    if (input.parentElement.classList.contains('try-field-row')) return;

    const field = input.closest('.try-field');
    if (!field) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'try-field-row';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-ids-btn';
    loadBtn.textContent = 'Load';
    loadBtn.type = 'button';
    loadBtn.onclick = function () { loadAssessmentPicker(this); };
    wrapper.appendChild(loadBtn);
  });

  document.querySelectorAll('.try-pathparam[data-key="finding_id"]').forEach(input => {
    if (input.parentElement.classList.contains('try-field-row')) return;

    const field = input.closest('.try-field');
    if (!field) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'try-field-row';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-ids-btn';
    loadBtn.textContent = 'Load';
    loadBtn.type = 'button';
    loadBtn.onclick = function () { loadFindingPicker(this); };
    wrapper.appendChild(loadBtn);
  });

  // 4) Add quick-fill buttons above the POST assessment textarea
  const createSection = document.getElementById('ep-create-assessment');
  if (createSection) {
    const tryBody = createSection.querySelector('.try-body');
    if (tryBody) {
      const row = document.createElement('div');
      row.className = 'quick-fill-row';
      row.innerHTML = '<button class="quick-fill-btn" type="button" onclick="quickFillRepo()">📦 Scan Repo</button>' +
        '<button class="quick-fill-btn" type="button" onclick="quickFillFiles()">📄 Inline Files</button>';
      tryBody.parentNode.insertBefore(row, tryBody);
    }
  }
});
