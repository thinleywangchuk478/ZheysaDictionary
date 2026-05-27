/* ============================================================
   Dzongkha Honorific Dictionary — app.js
   Features: bilingual search, autocomplete, word of the day,
   favorites, recent searches, browse all, quiz, contribute,
   copy, share, dark/light mode
   ============================================================ */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vRcJ7vn1GNZw2fIj7GEnNDDhcjqv2LMZtKvN-wT0cfLwsLAUDs1R_BMizZXm2UXmPK9JFZticYLZxvk" +
  "/pub?output=csv";

// ── Replace with your Google Apps Script Web App URL ─────────
// See SETUP.md for instructions on how to create this
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz22Ucr7Vc93OuUBm2jkrq4LaA7wN6kLmMRJQj-kz6z_ja_5dq2IHU6EzLW8VD26DDT/exec";

// ── DOM references ───────────────────────────────────────────
const wordInput      = document.getElementById("wordInput");
const clearBtn       = document.getElementById("clearBtn");
const output         = document.getElementById("output");
const statusDot      = document.getElementById("statusDot");
const statusText     = document.getElementById("statusText");
const suggestions    = document.getElementById("suggestions");
const themeToggle    = document.getElementById("themeToggle");
const toggleLabel    = document.getElementById("toggleLabel");
const recentWrap     = document.getElementById("recentWrap");
const recentList     = document.getElementById("recentList");
const recentClearBtn = document.getElementById("recentClearBtn");
const browseBtn      = document.getElementById("browseBtn");
const quizBtn        = document.getElementById("quizBtn");
const contributeBtn  = document.getElementById("contributeBtn");
const wotdWord       = document.getElementById("wotdWord");
const wotdEnglish    = document.getElementById("wotdEnglish");
const wotdHonorific  = document.getElementById("wotdHonorific");
const wotdSearchBtn  = document.getElementById("wotdSearchBtn");
const favoritesSection = document.getElementById("favoritesSection");
const favoritesList  = document.getElementById("favoritesList");
const favCloseBtn    = document.getElementById("favCloseBtn");

// ── Theme ────────────────────────────────────────────────────
const savedTheme = localStorage.getItem("dzongkha-theme") || "light";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("dzongkha-theme", next);
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  toggleLabel.textContent = theme === "dark" ? "Dark" : "Light";
}

// ── Favorites ────────────────────────────────────────────────
let favorites = JSON.parse(localStorage.getItem("dzongkha-favorites") || "[]");

function saveFavorites() {
  localStorage.setItem("dzongkha-favorites", JSON.stringify(favorites));
}

function isFavorited(word) { return favorites.includes(word); }

function toggleFavorite(word) {
  if (isFavorited(word)) {
    favorites = favorites.filter(w => w !== word);
  } else {
    favorites.unshift(word);
    if (favorites.length > 20) favorites.pop();
  }
  saveFavorites();
}

function renderFavorites(honorifics) {
  if (!favorites.length) {
    favoritesSection.style.display = "none";
    return;
  }
  favoritesSection.style.display = "block";
  favoritesList.innerHTML = favorites.map(word => `
    <div class="fav-chip" data-word="${escapeHTML(word)}">
      <span>${escapeHTML(word)}</span>
      <button class="fav-remove" data-word="${escapeHTML(word)}" title="Remove">×</button>
    </div>`).join("");

  favoritesList.querySelectorAll(".fav-chip").forEach(chip => {
    chip.addEventListener("click", e => {
      if (e.target.classList.contains("fav-remove")) return;
      const w = chip.dataset.word;
      wordInput.value = w;
      clearBtn.style.display = "flex";
      if (honorifics[w]) renderResult(w, honorifics[w], "dzongkha", honorifics);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  favoritesList.querySelectorAll(".fav-remove").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.word);
      renderFavorites(honorifics);
    });
  });
}

favCloseBtn.addEventListener("click", () => {
  favoritesSection.style.display = "none";
});

// ── Recent Searches ──────────────────────────────────────────
let recentSearches = JSON.parse(localStorage.getItem("dzongkha-recent") || "[]");

function addRecent(word) {
  recentSearches = [word, ...recentSearches.filter(w => w !== word)].slice(0, 8);
  localStorage.setItem("dzongkha-recent", JSON.stringify(recentSearches));
}

function renderRecent(honorifics) {
  if (!recentSearches.length) { recentWrap.style.display = "none"; return; }
  recentWrap.style.display = "block";
  recentList.innerHTML = recentSearches.map(w =>
    `<button class="recent-chip" data-word="${escapeHTML(w)}">${escapeHTML(w)}</button>`
  ).join("");
  recentList.querySelectorAll(".recent-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      wordInput.value = chip.dataset.word;
      clearBtn.style.display = "flex";
      hideSuggestions();
      recentWrap.style.display = "none";
      const result = honorifics[chip.dataset.word];
      if (result) renderResult(chip.dataset.word, result, "dzongkha", honorifics);
      else renderNotFound(chip.dataset.word);
    });
  });
}

recentClearBtn.addEventListener("click", () => {
  recentSearches = [];
  localStorage.setItem("dzongkha-recent", "[]");
  recentWrap.style.display = "none";
});

// ── Word of the Day ──────────────────────────────────────────
function setWordOfDay(honorifics) {
  const words = Object.keys(honorifics);
  if (!words.length) return;
  // Use date as seed so it changes daily but is consistent all day
  const seed = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const idx = parseInt(seed) % words.length;
  const word = words[idx];
  const entry = honorifics[word];
  wotdWord.textContent = word;
  wotdEnglish.textContent = entry.english || "";
  wotdHonorific.textContent = entry.honorific ? `→ ${entry.honorific}` : "";
  wotdSearchBtn.onclick = () => {
    wordInput.value = word;
    clearBtn.style.display = "flex";
    renderResult(word, entry, "dzongkha", honorifics);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

// ── Load Sheet Data ──────────────────────────────────────────
async function loadSheetData() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("Network response was not ok");
  const text = await response.text();
  const rows = text.split("\n").map(line => parseCSVRow(line));
  const honorifics = {};
  rows.slice(1).forEach(row => {
    const [word, english, honorific, meaning, example] = row;
    if (word && word.trim()) {
      honorifics[word.trim()] = {
        english:   (english   || "").trim(),
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

// ── Language detect ──────────────────────────────────────────
function isEnglish(str) { return /^[\x00-\x7F\s]+$/.test(str); }

// ── Search ───────────────────────────────────────────────────
function findMatches(query, honorifics) {
  const q = query.toLowerCase().trim();
  const allWords = Object.keys(honorifics);
  if (isEnglish(query)) {
    return allWords
      .filter(w => honorifics[w].english.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = honorifics[a].english.toLowerCase().startsWith(q);
        const bS = honorifics[b].english.toLowerCase().startsWith(q);
        return aS && !bS ? -1 : !aS && bS ? 1 : a.localeCompare(b);
      }).slice(0, 8);
  } else {
    return allWords
      .filter(w => w.includes(query))
      .sort((a, b) => {
        const aS = a.startsWith(query), bS = b.startsWith(query);
        return aS && !bS ? -1 : !aS && bS ? 1 : a.localeCompare(b);
      }).slice(0, 8);
  }
}

function findExact(query, honorifics) {
  const q = query.trim();
  if (honorifics[q]) return { key: q, entry: honorifics[q], matchedBy: "dzongkha" };
  if (isEnglish(q)) {
    const ql = q.toLowerCase();
    const key = Object.keys(honorifics).find(w => honorifics[w].english.toLowerCase() === ql);
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
      <p class="empty-sub">Type a Dzongkha word <strong>or</strong> an English word to find the honorific form.</p>
    </div>`;
}

function renderResult(key, entry, matchedBy, honorifics) {
  const langBadge = matchedBy === "english"
    ? `<span class="lang-badge english"><i class="bi bi-alphabet"></i> English match</span>`
    : `<span class="lang-badge dzongkha"><i class="bi bi-globe-asia-australia"></i> Dzongkha match</span>`;

  const englishTag = entry.english
    ? `<span class="english-tag">${escapeHTML(entry.english)}</span>` : "";

  const bookmarkIcon = isFavorited(key) ? "bi-bookmark-heart-fill" : "bi-bookmark-heart";
  const bookmarkClass = isFavorited(key) ? "saved" : "";

  output.innerHTML = `
    <div class="result-header">
      <div class="result-header-left">
        <div class="result-word-row">
          <span class="result-word">${escapeHTML(key)}</span>
          ${englishTag}
        </div>
        ${langBadge}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <button class="bookmark-btn ${bookmarkClass}" id="bookmarkBtn" title="Save word">
          <i class="bi ${bookmarkIcon}"></i>
        </button>
        <span class="found-pill">Honorific found</span>
      </div>
    </div>
    <div class="result-body">
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-award"></i></div>
        <div class="row-content" style="flex:1;">
          <div class="row-label">Honorific form</div>
          <div class="row-value">${escapeHTML(entry.honorific) || "—"}</div>
        </div>
        <button class="copy-btn" data-copy="${escapeHTML(entry.honorific)}">
          <i class="bi bi-copy"></i> Copy
        </button>
      </div>
      <div class="result-row">
        <div class="row-icon"><i class="bi bi-journal-text"></i></div>
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
    </div>
    <div class="result-actions">
      <button class="copy-btn" id="copyAllBtn">
        <i class="bi bi-clipboard"></i> Copy all
      </button>
      <button class="share-btn" id="shareBtn">
        <i class="bi bi-share"></i> Share
      </button>
    </div>`;

  // Bookmark
  document.getElementById("bookmarkBtn").addEventListener("click", function () {
    toggleFavorite(key);
    const saved = isFavorited(key);
    this.classList.toggle("saved", saved);
    this.innerHTML = `<i class="bi ${saved ? "bi-bookmark-heart-fill" : "bi-bookmark-heart"}"></i>`;
    renderFavorites(honorifics);
  });

  // Copy honorific
  output.querySelectorAll(".copy-btn[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => copyText(btn.dataset.copy, btn));
  });

  // Copy all
  document.getElementById("copyAllBtn").addEventListener("click", function () {
    const all = `${key} (${entry.english})\nHonorific: ${entry.honorific}\nMeaning: ${entry.meaning}\nExample: ${entry.example}`;
    copyText(all, this);
  });

  // Share
  document.getElementById("shareBtn").addEventListener("click", () => {
    const url = `${location.origin}${location.pathname}?word=${encodeURIComponent(key)}`;
    if (navigator.share) {
      navigator.share({ title: `${key} — Dzongkha Honorific`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        document.getElementById("shareBtn").innerHTML = `<i class="bi bi-check"></i> Copied link!`;
        setTimeout(() => {
          document.getElementById("shareBtn").innerHTML = `<i class="bi bi-share"></i> Share`;
        }, 2000);
      });
    }
  });

  // Add to recent
  addRecent(key);
}

function renderMultipleResults(matches, honorifics) {
  const cards = matches.map(key => `
    <div class="result-row multi-row" data-word="${escapeHTML(key)}" style="cursor:pointer;">
      <div class="row-icon"><i class="bi bi-award"></i></div>
      <div class="row-content">
        <div class="row-label">${escapeHTML(honorifics[key].english)}</div>
        <div class="row-value">${escapeHTML(key)}
          <span class="honorific-inline">→ ${escapeHTML(honorifics[key].honorific)}</span>
        </div>
      </div>
      <i class="bi bi-chevron-right" style="margin-left:auto;color:var(--text-faint);font-size:13px;"></i>
    </div>`).join("");

  output.innerHTML = `
    <div class="result-header">
      <span class="result-word" style="font-size:16px;">Multiple matches</span>
      <span class="found-pill">${matches.length} results</span>
    </div>
    <div class="result-body">${cards}</div>`;

  output.querySelectorAll(".multi-row").forEach(row => {
    row.addEventListener("click", () => {
      const word = row.dataset.word;
      wordInput.value = word;
      clearBtn.style.display = "flex";
      selectWord(word, honorifics);
    });
  });
}

function renderNotFound(query) {
  const hint = isEnglish(query)
    ? "Try a different English word, or type the Dzongkha word directly."
    : "Try another Dzongkha word, or type the English word instead.";
  output.innerHTML = `
    <div class="notfound-state">
      <div class="empty-icon"><i class="bi bi-question-lg"></i></div>
      <p class="notfound-word">${escapeHTML(query)}</p>
      <p class="notfound-sub">${hint}</p>
    </div>`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHTML(text);
  return escapeHTML(text.slice(0,idx))+"<mark>"+escapeHTML(text.slice(idx,idx+query.length))+"</mark>"+escapeHTML(text.slice(idx+query.length));
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.classList.add("copied");
    btn.innerHTML = `<i class="bi bi-check"></i> Copied!`;
    setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = orig; }, 2000);
  });
}

// ── Suggestions ──────────────────────────────────────────────
let activeIndex = -1;

function showSuggestions(matches, query, honorifics) {
  if (!matches.length) { hideSuggestions(); return; }
  activeIndex = -1;
  const english = isEnglish(query);
  suggestions.innerHTML = matches.map((word, i) => {
    const main = english ? escapeHTML(word) : highlightMatch(word, query);
    const hint = english
      ? highlightMatch(honorifics[word].english, query)
      : escapeHTML(honorifics[word].english || honorifics[word].honorific || "");
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

// ── Browse All ───────────────────────────────────────────────
function initBrowse(honorifics) {
  const modal     = document.getElementById("browseModal");
  const closeBtn  = document.getElementById("browseClose");
  const searchBox = document.getElementById("browseSearch");
  const list      = document.getElementById("browseList");
  const allWords  = Object.keys(honorifics).sort((a,b) => a.localeCompare(b));

  function renderBrowse(words) {
    list.innerHTML = words.map(word => `
      <div class="browse-item" data-word="${escapeHTML(word)}">
        <div>
          <div class="browse-dzo">${escapeHTML(word)}</div>
          <div class="browse-eng">${escapeHTML(honorifics[word].english)}</div>
        </div>
        <div class="browse-honorific">${escapeHTML(honorifics[word].honorific)}</div>
      </div>`).join("");

    list.querySelectorAll(".browse-item").forEach(item => {
      item.addEventListener("click", () => {
        const w = item.dataset.word;
        wordInput.value = w;
        clearBtn.style.display = "flex";
        renderResult(w, honorifics[w], "dzongkha", honorifics);
        modal.classList.remove("open");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  browseBtn.addEventListener("click", () => {
    modal.classList.add("open");
    searchBox.value = "";
    renderBrowse(allWords);
  });

  searchBox.addEventListener("input", function () {
    const q = this.value.toLowerCase();
    const filtered = allWords.filter(w =>
      w.includes(q) || honorifics[w].english.toLowerCase().includes(q)
    );
    renderBrowse(filtered);
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
}

// ── Quiz Mode ────────────────────────────────────────────────
function initQuiz(honorifics) {
  const modal    = document.getElementById("quizModal");
  const closeBtn = document.getElementById("quizClose");
  const body     = document.getElementById("quizBody");
  const allWords = Object.keys(honorifics).filter(w => honorifics[w].honorific);
  let score = 0, total = 0;

  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

  function nextQuestion() {
    if (allWords.length < 4) {
      body.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-family:var(--font-english);padding:2rem;">Not enough words for quiz. Add more entries!</p>`;
      return;
    }
    const correct = allWords[Math.floor(Math.random() * allWords.length)];
    const others  = shuffle(allWords.filter(w => w !== correct)).slice(0, 3);
    const options  = shuffle([correct, ...others]);
    const entry    = honorifics[correct];

    body.innerHTML = `
      <div class="quiz-score">Score: ${score} / ${total}</div>
      <div class="quiz-question">${escapeHTML(correct)}</div>
      <div class="quiz-english">${escapeHTML(entry.english)}</div>
      <div class="quiz-prompt">Choose the correct honorific form:</div>
      <div class="quiz-options">
        ${options.map(w => `
          <button class="quiz-option" data-word="${escapeHTML(w)}" data-correct="${w === correct}">
            ${escapeHTML(honorifics[w].honorific || w)}
          </button>`).join("")}
      </div>
      <div class="quiz-feedback" id="quizFeedback"></div>
      <button class="quiz-next-btn" id="quizNextBtn" style="display:none;">Next Question →</button>`;

    body.querySelectorAll(".quiz-option").forEach(btn => {
      btn.addEventListener("click", function () {
        body.querySelectorAll(".quiz-option").forEach(b => b.style.pointerEvents = "none");
        total++;
        const isCorrect = this.dataset.correct === "true";
        if (isCorrect) {
          this.classList.add("correct");
          score++;
          document.getElementById("quizFeedback").textContent = "✓ Correct!";
          document.getElementById("quizFeedback").className = "quiz-feedback correct";
        } else {
          this.classList.add("wrong");
          body.querySelector(`[data-correct="true"]`).classList.add("correct");
          document.getElementById("quizFeedback").textContent = "✗ Wrong — see the correct answer above.";
          document.getElementById("quizFeedback").className = "quiz-feedback wrong";
        }
        document.getElementById("quizNextBtn").style.display = "block";
      });
    });

    document.getElementById("quizNextBtn").addEventListener("click", nextQuestion);
  }

  quizBtn.addEventListener("click", () => {
    score = 0; total = 0;
    modal.classList.add("open");
    nextQuestion();
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
}

// ── Contribute ───────────────────────────────────────────────
function initContribute() {
  const modal      = document.getElementById("contributeModal");
  const closeBtn   = document.getElementById("contributeClose");
  const submitBtn  = document.getElementById("submitContribution");
  const statusEl   = document.getElementById("contributeStatus");

  contributeBtn.addEventListener("click", () => modal.classList.add("open"));
  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });

  submitBtn.addEventListener("click", async () => {
    const name     = document.getElementById("cName").value.trim();
    const email    = document.getElementById("cEmail").value.trim();
    const word     = document.getElementById("cWord").value.trim();
    const english  = document.getElementById("cEnglish").value.trim();
    const honorific = document.getElementById("cHonorific").value.trim();
    const meaning  = document.getElementById("cMeaning").value.trim();
    const example  = document.getElementById("cExample").value.trim();

    if (!name || !email || !word || !honorific) {
      statusEl.textContent = "Please fill in Name, Email, Dzongkha Word and Honorific at minimum.";
      statusEl.className = "contribute-status error";
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusEl.textContent = "Please enter a valid email address.";
      statusEl.className = "contribute-status error";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> Submitting…`;
    statusEl.textContent = "";

    // If Apps Script URL is set, send to it; otherwise show instructions
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, word, english, honorific, meaning, example, submittedAt: new Date().toISOString() })
        });
        statusEl.textContent = "✓ Submitted successfully! You will receive a confirmation email once approved.";
        statusEl.className = "contribute-status success";
        ["cName","cEmail","cWord","cEnglish","cHonorific","cMeaning","cExample"].forEach(id => {
          document.getElementById(id).value = "";
        });
      } catch {
        statusEl.textContent = "Submission failed. Please try again.";
        statusEl.className = "contribute-status error";
      }
    } else {
      // Fallback: open email to data manager
      const subject = encodeURIComponent(`Dzongkha Dictionary Contribution: ${word}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nWord: ${word}\nEnglish: ${english}\nHonorific: ${honorific}\nMeaning: ${meaning}\nExample: ${example}`
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      statusEl.textContent = "✓ Opening your email app to send the contribution.";
      statusEl.className = "contribute-status success";
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="bi bi-send"></i> Submit for Review`;
  });
}

// ── Share via URL param ──────────────────────────────────────
function checkURLParam(honorifics) {
  const params = new URLSearchParams(location.search);
  const word = params.get("word");
  if (word && honorifics[word]) {
    wordInput.value = word;
    clearBtn.style.display = "flex";
    renderResult(word, honorifics[word], "dzongkha", honorifics);
  }
}

// ── Search interaction ───────────────────────────────────────
function initSearch(honorifics) {
  wordInput.addEventListener("focus", () => {
    if (!wordInput.value.trim()) renderRecent(honorifics);
  });

  wordInput.addEventListener("input", function () {
    const query = this.value.trim();
    clearBtn.style.display = query ? "flex" : "none";
    recentWrap.style.display = "none";

    if (!query) { hideSuggestions(); renderEmpty(); return; }

    const matches = findMatches(query, honorifics);
    const exact   = findExact(query, honorifics);

    if (exact) {
      renderResult(exact.key, exact.entry, exact.matchedBy, honorifics);
    } else if (matches.length > 1 && isEnglish(query)) {
      renderMultipleResults(matches, honorifics);
    } else {
      renderNotFound(query);
    }

    showSuggestions(matches, query, honorifics);
  });

  wordInput.addEventListener("keydown", function (e) {
    const items = suggestions.querySelectorAll(".suggestion-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex+1, items.length-1); setActive(items, activeIndex); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); setActive(items, activeIndex); }
    else if (e.key === "Enter" && activeIndex >= 0) selectWord(items[activeIndex].dataset.word, honorifics);
    else if (e.key === "Escape") hideSuggestions();
  });

  suggestions.addEventListener("mousedown", e => {
    const item = e.target.closest(".suggestion-item");
    if (item) { e.preventDefault(); selectWord(item.dataset.word, honorifics); }
  });

  wordInput.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  clearBtn.addEventListener("click", () => {
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
  if (honorifics[word]) renderResult(word, honorifics[word], "dzongkha", honorifics);
  else renderNotFound(word);
  wordInput.focus();
}

// ── Bootstrap ────────────────────────────────────────────────
loadSheetData()
  .then(honorifics => {
    const count = Object.keys(honorifics).length;
    statusDot.classList.remove("loading");
    statusText.textContent = `${count} entries loaded · Search in Dzongkha or English`;

    setWordOfDay(honorifics);
    renderFavorites(honorifics);
    renderRecent(honorifics);
    initSearch(honorifics);
    initBrowse(honorifics);
    initQuiz(honorifics);
    initContribute();
    checkURLParam(honorifics);
  })
  .catch(err => {
    console.error("Dictionary load error:", err);
    statusDot.classList.remove("loading");
    statusDot.classList.add("error");
    statusText.textContent = "Failed to load dictionary. Check your connection.";
  });
