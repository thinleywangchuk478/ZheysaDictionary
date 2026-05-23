/* ============================================================
   Dzongkha Honorific Dictionary — app.js
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

// ── Render helpers ───────────────────────────────────────────
function renderEmpty() {
  output.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><i class="bi bi-translate"></i></div>
      <p class="empty-title">Search to begin</p>
      <p class="empty-sub">Enter a Dzongkha word to find its honorific form, meaning, and example usage.</p>
    </div>`;
}

function renderResult(word, result) {
  output.innerHTML = `
    <div class="result-header">
      <span class="result-word">${escapeHTML(word)}</span>
      <span class="found-pill">Honorific found</span>
    </div>
    <div class="result-body">
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-award"></i></div>
        <div class="row-content">
          <div class="row-label">Honorific form</div>
          <div class="row-value">${escapeHTML(result.honorific) || "—"}</div>
        </div>
      </div>
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-alphabet"></i></div>
        <div class="row-content">
          <div class="row-label">Meaning</div>
          <div class="row-value">${escapeHTML(result.meaning) || "—"}</div>
        </div>
      </div>
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-chat-quote"></i></div>
        <div class="row-content">
          <div class="row-label">Example</div>
          <div class="row-value">${escapeHTML(result.example) || "—"}</div>
        </div>
      </div>
    </div>`;
}

function renderNotFound(word) {
  output.innerHTML = `
    <div class="notfound-state">
      <div class="empty-icon"><i class="bi bi-question-lg"></i></div>
      <p class="notfound-word">${escapeHTML(word)}</p>
      <p class="notfound-sub">No honorific found. Try another word.</p>
    </div>`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlightMatch(word, query) {
  const idx = word.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHTML(word);
  return (
    escapeHTML(word.slice(0, idx)) +
    "<mark>" + escapeHTML(word.slice(idx, idx + query.length)) + "</mark>" +
    escapeHTML(word.slice(idx + query.length))
  );
}

// ── Suggestions ──────────────────────────────────────────────
let activeIndex = -1;

function showSuggestions(matches, query, honorifics) {
  if (!matches.length) { hideSuggestions(); return; }
  activeIndex = -1;
  suggestions.innerHTML = matches.map((word, i) => {
    const hint = honorifics[word].honorific || honorifics[word].meaning || "";
    return `
      <li class="suggestion-item" role="option" data-word="${escapeHTML(word)}" data-index="${i}">
        <i class="bi bi-arrow-return-right"></i>
        <span class="suggestion-main">${highlightMatch(word, query)}</span>
        ${hint ? `<span class="suggestion-hint">${escapeHTML(hint)}</span>` : ""}
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
  const allWords = Object.keys(honorifics);

  wordInput.addEventListener("input", function () {
    const query = this.value.trim();
    clearBtn.style.display = query ? "flex" : "none";
    if (!query) { hideSuggestions(); renderEmpty(); return; }

    const matches = allWords
      .filter(w => w.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const aS = a.toLowerCase().startsWith(query.toLowerCase());
        const bS = b.toLowerCase().startsWith(query.toLowerCase());
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 8);

    if (honorifics[query]) {
      renderResult(query, honorifics[query]);
    } else {
      renderNotFound(query);
    }
    showSuggestions(matches, query, honorifics);
  });

  wordInput.addEventListener("keydown", function (e) {
    const items = suggestions.querySelectorAll(".suggestion-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); setActive(items, activeIndex); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); setActive(items, activeIndex); }
    else if (e.key === "Enter" && activeIndex >= 0) { selectWord(items[activeIndex].dataset.word, honorifics); }
    else if (e.key === "Escape") { hideSuggestions(); }
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
  if (honorifics[word]) renderResult(word, honorifics[word]);
  else renderNotFound(word);
  wordInput.focus();
}

// ── Bootstrap ────────────────────────────────────────────────
loadSheetData()
  .then(honorifics => {
    const count = Object.keys(honorifics).length;
    statusDot.classList.remove("loading");
    statusText.textContent = `${count} entries loaded`;
    initSearch(honorifics);
  })
  .catch(err => {
    console.error("Dictionary load error:", err);
    statusDot.classList.remove("loading");
    statusDot.classList.add("error");
    statusText.textContent = "Failed to load dictionary. Check your connection.";
  });
