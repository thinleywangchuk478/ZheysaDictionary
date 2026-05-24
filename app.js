/* ============================================================
   Dzongkha Honorific Dictionary — app.js
   Bilingual search: Dzongkha word OR English meaning
   ============================================================ */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vRcJ7vn1GNZw2fIj7GEnNDDhcjqv2LMZtKvN-wT0cfLwsLAUDs1R_BMizZXm2UXmPK9JFZticYLZxvk" +
  "/pub?output=csv";

// ── DOM references ──────────────────────────────────────────
const wordInput   = document.getElementById("wordInput");
const clearBtn    = document.getElementById("clearBtn");
const output      = document.getElementById("output");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");
const suggestions = document.getElementById("suggestions");
const themeToggle = document.getElementById("themeToggle");
const toggleLabel = document.getElementById("toggleLabel");

// ── Theme toggle ─────────────────────────────────────────────
const savedTheme = localStorage.getItem("dzongkha-theme") || "light";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("dzongkha-theme", next);
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  toggleLabel.textContent = theme === "dark" ? "Dark" : "Light";
}

// ── Load data from Google Sheets CSV ────────────────────────
async function loadSheetData() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("Network response was not ok");
  const text = await response.text();
  const rows = text.split("\n").map(line => parseCSVRow(line));

  // honorifics: keyed by Dzongkha word
  const honorifics = {};

  rows.slice(1).forEach(row => {
    const [word, honorific, meaning, example] = row;
    if (word && word.trim()) {
      honorifics[word.trim()] = {
        honorific: (honorific || "").trim(),
        meaning:   (meaning   || "").trim(),
        example:   (example   || "").trim(),
      };
    }
  });

  return honorifics;
}

function parseCSVRow(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ── Detect if query is English or Dzongkha ───────────────────
// Dzongkha uses Tibetan Unicode block: U+0F00–U+0FFF
function isEnglish(str) {
  return /^[\x00-\x7F\s]+$/.test(str);
}

// ── Search logic — returns array of matching Dzongkha keys ───
function findMatches(query, honorifics) {
  const q = query.toLowerCase().trim();
  const allWords = Object.keys(honorifics);

  if (isEnglish(query)) {
    // Search by English meaning
    return allWords
      .filter(word => honorifics[word].meaning.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = honorifics[a].meaning.toLowerCase().startsWith(q);
        const bStarts = honorifics[b].meaning.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 8);
  } else {
    // Search by Dzongkha word
    return allWords
      .filter(word => word.includes(query))
      .sort((a, b) => {
        const aStarts = a.startsWith(query);
        const bStarts = b.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 8);
  }
}

// Find exact match — by word or by meaning
function findExact(query, honorifics) {
  const q = query.trim();

  // Exact Dzongkha word match
  if (honorifics[q]) {
    return { key: q, entry: honorifics[q], matchedBy: "dzongkha" };
  }

  // Exact English meaning match (first result)
  if (isEnglish(q)) {
    const ql = q.toLowerCase();
    const key = Object.keys(honorifics).find(
      word => honorifics[word].meaning.toLowerCase() === ql
    );
    if (key) return { key, entry: honorifics[key], matchedBy: "english" };
  }

  return null;
}

// ── Render helpers ───────────────────────────────────────────
function renderEmpty() {
  output.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><i class="bi bi-translate"></i></div>
      <p class="empty-title">Search to begin</p>
      <p class="empty-sub">Type a Dzongkha word <strong>or</strong> an English meaning to find the honorific form.</p>
    </div>`;
}

function renderResult(key, entry, matchedBy) {
  const langBadge = matchedBy === "english"
    ? `<span class="lang-badge english"><i class="bi bi-alphabet"></i> English match</span>`
    : `<span class="lang-badge dzongkha"><i class="bi bi-globe-asia-australia"></i> Dzongkha match</span>`;

  output.innerHTML = `
    <div class="result-header">
      <div class="result-header-left">
        <span class="result-word">${escapeHTML(key)}</span>
        ${langBadge}
      </div>
      <span class="found-pill">Honorific found</span>
    </div>
    <div class="result-body">
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-award"></i></div>
        <div class="row-content">
          <div class="row-label">Honorific form</div>
          <div class="row-value">${escapeHTML(entry.honorific) || "—"}</div>
        </div>
      </div>
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-alphabet"></i></div>
        <div class="row-content">
          <div class="row-label">Meaning</div>
          <div class="row-value">${escapeHTML(entry.meaning) || "—"}</div>
        </div>
      </div>
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-chat-quote"></i></div>
        <div class="row-content">
          <div class="row-label">Example</div>
          <div class="row-value">${escapeHTML(entry.example) || "—"}</div>
        </div>
      </div>
    </div>`;
}

function renderMultipleResults(matches, honorifics) {
  // When typing English and multiple results match, show all as cards
  const cards = matches.map(key => `
    <div class="result-row multi-row" data-word="${escapeHTML(key)}" style="cursor:pointer;">
      <div class="row-icon"><i class="bi bi-award"></i></div>
      <div class="row-content">
        <div class="row-label">${escapeHTML(honorifics[key].meaning)}</div>
        <div class="row-value">${escapeHTML(key)}
          <span class="honorific-inline">→ ${escapeHTML(honorifics[key].honorific)}</span>
        </div>
      </div>
      <i class="bi bi-chevron-right" style="margin-left:auto; color:var(--text-faint); font-size:13px;"></i>
    </div>`).join("");

  output.innerHTML = `
    <div class="result-header">
      <span class="result-word" style="font-size:16px;">Multiple matches found</span>
      <span class="found-pill">${matches.length} results</span>
    </div>
    <div class="result-body">${cards}</div>`;

  // Make each row clickable
  output.querySelectorAll(".multi-row").forEach(row => {
    row.addEventListener("click", () => {
      const word = row.dataset.word;
      selectWord(word, honorifics);
      wordInput.value = word;
      clearBtn.style.display = "flex";
    });
  });
}

function renderNotFound(query) {
  const hint = isEnglish(query)
    ? "Try a different English word, or type a Dzongkha word directly."
    : "Try another Dzongkha word, or type the English meaning instead.";
  output.innerHTML = `
    <div class="notfound-state">
      <div class="empty-icon"><i class="bi bi-question-lg"></i></div>
      <p class="notfound-word">${escapeHTML(query)}</p>
      <p class="notfound-sub">${hint}</p>
    </div>`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHTML(text);
  return (
    escapeHTML(text.slice(0, idx)) +
    "<mark>" + escapeHTML(text.slice(idx, idx + query.length)) + "</mark>" +
    escapeHTML(text.slice(idx + query.length))
  );
}

// ── Suggestions dropdown ─────────────────────────────────────
let activeIndex = -1;

function showSuggestions(matches, query, honorifics) {
  if (!matches.length) { hideSuggestions(); return; }
  activeIndex = -1;
  const english = isEnglish(query);

  suggestions.innerHTML = matches.map((word, i) => {
    // If searching by English, show Dzongkha word as main, meaning highlighted
    // If searching by Dzongkha, show Dzongkha word highlighted, meaning as hint
    const main   = english ? escapeHTML(word) : highlightMatch(word, query);
    const hint   = english
      ? highlightMatch(honorifics[word].meaning, query)
      : escapeHTML(honorifics[word].meaning || honorifics[word].honorific || "");

    return `
      <li class="suggestion-item" role="option" data-word="${escapeHTML(word)}" data-index="${i}">
        <i class="bi bi-arrow-return-right"></i>
        <span class="suggestion-main">${main}</span>
        ${hint ? `<span class="suggestion-hint">${hint}</span>` : ""}
      </li>`;
  }).join("");

  suggestions.classList.add("open");
}

function hideSuggestions() {
  suggestions.classList.remove("open");
  suggestions.innerHTML = "";
  activeIndex = -1;
}

function setActive(items, index) {
  items.forEach(el => el.classList.remove("active"));
  if (index >= 0 && index < items.length) {
    items[index].classList.add("active");
    items[index].scrollIntoView({ block: "nearest" });
  }
}

// ── Search interaction ───────────────────────────────────────
function initSearch(honorifics) {

  wordInput.addEventListener("input", function () {
    const query = this.value.trim();
    clearBtn.style.display = query ? "flex" : "none";
    if (!query) { hideSuggestions(); renderEmpty(); return; }

    const matches = findMatches(query, honorifics);
    const exact   = findExact(query, honorifics);

    if (exact) {
      renderResult(exact.key, exact.entry, exact.matchedBy);
    } else if (matches.length > 1 && isEnglish(query)) {
      renderMultipleResults(matches, honorifics);
    } else if (matches.length === 0) {
      renderNotFound(query);
    } else {
      renderNotFound(query);
    }

    showSuggestions(matches, query, honorifics);
  });

  // Keyboard navigation
  wordInput.addEventListener("keydown", function (e) {
    const items = suggestions.querySelectorAll(".suggestion-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      setActive(items, activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      setActive(items, activeIndex);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      selectWord(items[activeIndex].dataset.word, honorifics);
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  suggestions.addEventListener("mousedown", function (e) {
    const item = e.target.closest(".suggestion-item");
    if (item) { e.preventDefault(); selectWord(item.dataset.word, honorifics); }
  });

  wordInput.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  clearBtn.addEventListener("click", function () {
    wordInput.value = "";
    wordInput.focus();
    clearBtn.style.display = "none";
    hideSuggestions();
    renderEmpty();
  });
}

function selectWord(word, honorifics) {
  wordInput.value = word;
  clearBtn.style.display = "flex";
  hideSuggestions();
  if (honorifics[word]) renderResult(word, honorifics[word], "dzongkha");
  else renderNotFound(word);
  wordInput.focus();
}

// ── Bootstrap ────────────────────────────────────────────────
loadSheetData()
  .then(honorifics => {
    const count = Object.keys(honorifics).length;
    statusDot.classList.remove("loading");
    statusText.textContent = `${count} entries loaded · Search in Dzongkha or English`;
    initSearch(honorifics);
  })
  .catch(err => {
    console.error("Dictionary load error:", err);
    statusDot.classList.remove("loading");
    statusDot.classList.add("error");
    statusText.textContent = "Failed to load dictionary. Check your connection.";
  });
