/* ============================================================
   Dzongkha Honorific Dictionary — app.js
   ============================================================ */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vRcJ7vn1GNZw2fIj7GEnNDDhcjqv2LMZtKvN-wT0cfLwsLAUDs1R_BMizZXm2UXmPK9JFZticYLZxvk" +
  "/pub?output=csv";

// ── DOM references ──────────────────────────────────────────
const wordInput  = document.getElementById("wordInput");
const clearBtn   = document.getElementById("clearBtn");
const output     = document.getElementById("output");
const statusDot  = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

// ── Load data from Google Sheets CSV ────────────────────────
async function loadSheetData() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("Network response was not ok");

  const text = await response.text();

  // Parse CSV (handles basic quoted fields)
  const rows = text
    .split("\n")
    .map(line => parseCSVRow(line));

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

// Basic CSV row parser that respects quoted fields
function parseCSVRow(line) {
  const result = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Set up search interaction ────────────────────────────────
function initSearch(honorifics) {
  wordInput.addEventListener("input", function () {
    const word = this.value.trim();

    // Show/hide clear button
    clearBtn.style.display = word ? "flex" : "none";

    if (!word) {
      renderEmpty();
      return;
    }

    const result = honorifics[word];
    if (result) {
      renderResult(word, result);
    } else {
      renderNotFound(word);
    }
  });

  clearBtn.addEventListener("click", function () {
    wordInput.value = "";
    wordInput.focus();
    clearBtn.style.display = "none";
    renderEmpty();
  });
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
