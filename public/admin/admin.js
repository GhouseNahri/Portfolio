// ==========================================================================
// ADMIN DASHBOARD — client logic. No frameworks, no build step.
// Talks only to the session-protected /api/admin/* routes. Authorization
// is enforced server-side on every call — this file only renders state.
// ==========================================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let state = null; // the SiteState from the server
let dirty = false;
let currentUser = "";

// ------------------------------------------------------------------ api

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  // Expired session anywhere → back to the login view.
  if (res.status === 401 && path !== "/api/admin/login" && path !== "/api/admin/session") {
    showLogin();
    throw new Error(data?.error || "Please sign in again.");
  }
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), {
      status: res.status,
      data,
    });
  }
  return data;
}

// ----------------------------------------------------------------- toast

let toastTimer;
function toast(message, kind = "ok") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4500);
}

// ------------------------------------------------------------- view swap

function showLogin() {
  $("#view-dashboard").hidden = true;
  $("#view-login").hidden = false;
  $("#login-error").hidden = true;
  $("#login-user").focus();
}

function showDashboard() {
  $("#view-login").hidden = true;
  $("#view-dashboard").hidden = false;
  $("#who").textContent = currentUser ? `Signed in as ${currentUser}` : "";
}

// ------------------------------------------------------------------ tabs

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    $$(".panel").forEach((p) => (p.hidden = p.id !== `tab-${tab.dataset.tab}`));
  });
});

// ------------------------------------------------------------- dirty flag

function markDirty() {
  dirty = true;
  updateDirtyUi();
}
function markClean() {
  dirty = false;
  updateDirtyUi();
}
function updateDirtyUi() {
  $("#dirty-indicator").dataset.state = dirty ? "dirty" : "clean";
  $("#publish-btn").disabled = !dirty;
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// --------------------------------------------------------------- helpers

function get(path) {
  return path.split(".").reduce((obj, key) => (obj == null ? obj : obj[key]), state);
}
function set(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((obj, key) => obj[key], state);
  target[last] = value;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cardHead(title, onUp, onDown, onDelete, name) {
  const head = el("div", "card-head");
  head.append(el("h3", null, title));
  const mk = (label, fn, cls) => {
    const b = el("button", `icon-btn ${cls || ""}`, label);
    b.type = "button";
    b.setAttribute("aria-label", `${label} ${name || title}`);
    b.addEventListener("click", () => {
      if (label === "🗑" && !confirm(`Delete “${name || title}”? This publishes only when you press Publish.`)) return;
      fn();
    });
    return b;
  };
  if (onUp) head.append(mk("↑", onUp, "up"));
  if (onDown) head.append(mk("↓", onDown, "down"));
  if (onDelete) head.append(mk("🗑", onDelete, "danger"));
  return head;
}

function labeled(labelText, hint, inputEl) {
  const label = el("label", "field");
  const span = el("span");
  span.textContent = labelText;
  if (hint) {
    const em = el("em", null, ` ${hint}`);
    span.append(em);
  }
  label.append(span, inputEl);
  return label;
}

function input(value, onInput, type = "text") {
  const i = document.createElement("input");
  i.type = type;
  i.value = value ?? "";
  i.addEventListener("input", () => onInput(i.value));
  return i;
}

function textarea(value, onInput, rows = 3) {
  const t = document.createElement("textarea");
  t.rows = rows;
  t.value = value ?? "";
  t.addEventListener("input", () => onInput(t.value));
  return t;
}

const listItems = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- render

function renderAll() {
  renderProfile();
  renderAbout();
  renderSkills();
  renderProjects();
  renderEducation();
}

function renderProfile() {
  $$("[data-k]").forEach((inputEl) => {
    inputEl.value = get(inputEl.dataset.k) ?? "";
    inputEl.addEventListener("input", () => {
      set(inputEl.dataset.k, inputEl.value);
      markDirty();
      if (inputEl.dataset.k.startsWith("site.name") || inputEl.dataset.k.startsWith("site.role"))
        renderSeoPreview();
      if (inputEl.dataset.k === "site.seo.description") renderSeoPreview();
    });
  });
  renderSeoPreview();
}

function renderSeoPreview() {
  $("#seo-p-title").textContent = `${state.site.name} — ${state.site.role}`;
  $("#seo-p-desc").textContent = state.site.seo.description || "(empty description)";
}

function renderAbout() {
  $("#about-paragraphs").value = state.about.paragraphs.join("\n\n");
  $("#about-chips").value = state.about.currentlyLearning.join(", ");
  $("#about-paragraphs").oninput = (e) => {
    state.about.paragraphs = e.target.value
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    markDirty();
  };
  $("#about-chips").oninput = (e) => {
    state.about.currentlyLearning = listItems(e.target.value);
    markDirty();
  };
}

function renderSkills() {
  const wrap = $("#skills-groups");
  wrap.replaceChildren();
  state.skills.groups.forEach((group, gi) => {
    const card = el("div", "card");
    card.append(
      cardHead(
        group.label || `Group ${gi + 1}`,
        gi > 0 ? swapSkill(gi, gi - 1) : null,
        gi < state.skills.groups.length - 1 ? swapSkill(gi, gi + 1) : null,
        () => {
          state.skills.groups.splice(gi, 1);
          markDirty();
          renderSkills();
        },
        group.label
      )
    );
    card.append(
      labeled("Group label", "column heading", input(group.label, (v) => {
        group.label = v;
        markDirty();
      }))
    );
    card.append(
      labeled("Items", "comma-separated chips", input(group.items.join(", "), (v) => {
        group.items = listItems(v);
        markDirty();
      }))
    );
    wrap.append(card);
  });
}
const swapSkill = (a, b) => () => {
  [state.skills.groups[a], state.skills.groups[b]] = [state.skills.groups[b], state.skills.groups[a]];
  markDirty();
  renderSkills();
};

function renderProjects() {
  const wrap = $("#projects-list");
  wrap.replaceChildren();
  state.projects.items.forEach((project, pi) => {
    const card = el("div", "card");
    card.append(
      cardHead(
        project.title || `Project ${pi + 1}`,
        pi > 0 ? swapProject(pi, pi - 1) : null,
        pi < state.projects.items.length - 1 ? swapProject(pi, pi + 1) : null,
        () => {
          state.projects.items.splice(pi, 1);
          markDirty();
          renderProjects();
        },
        project.title
      )
    );
    if (pi === 0) {
      const badge = el("span", "badge", "featured");
      card.firstElementChild.append(badge);
    }
    card.append(labeled("Title", null, input(project.title, (v) => {
      project.title = v;
      markDirty();
    })));
    card.append(labeled("Description", null, textarea(project.description, (v) => {
      project.description = v;
      markDirty();
    }, 4)));
    card.append(labeled("Technologies", "comma-separated", input(project.tech.join(", "), (v) => {
      project.tech = listItems(v);
      markDirty();
    })));
    const status = document.createElement("select");
    ["in-progress", "live", "archived"].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if (project.status === s) opt.selected = true;
      status.append(opt);
    });
    status.addEventListener("change", () => {
      project.status = status.value;
      markDirty();
    });
    card.append(labeled("Status", null, status));
    card.append(labeled("GitHub URL", null, input(project.github, (v) => {
      project.github = v.trim();
      markDirty();
    }, "url")));
    card.append(labeled("Live demo URL", "empty if none", input(project.demo, (v) => {
      project.demo = v.trim();
      markDirty();
    }, "url")));
    wrap.append(card);
  });
}
const swapProject = (a, b) => () => {
  [state.projects.items[a], state.projects.items[b]] = [state.projects.items[b], state.projects.items[a]];
  markDirty();
  renderProjects();
};

function renderEducation() {
  const wrap = $("#education-list");
  wrap.replaceChildren();
  state.education.entries.forEach((entry, ei) => {
    const card = el("div", "card");
    card.append(
      cardHead(
        entry.degree || `Education ${ei + 1}`,
        ei > 0 ? swapEdu(ei, ei - 1) : null,
        ei < state.education.entries.length - 1 ? swapEdu(ei, ei + 1) : null,
        () => {
          state.education.entries.splice(ei, 1);
          markDirty();
          renderEducation();
        },
        entry.degree
      )
    );
    card.append(labeled("Degree", null, input(entry.degree, (v) => {
      entry.degree = v;
      markDirty();
    })));
    card.append(labeled("Institution", null, input(entry.institution, (v) => {
      entry.institution = v;
      markDirty();
    })));
    card.append(labeled("Period", "e.g. 2025 — 2029", input(entry.period, (v) => {
      entry.period = v;
      markDirty();
    })));
    card.append(labeled("Note", "optional", textarea(entry.note, (v) => {
      entry.note = v;
      markDirty();
    }, 2)));
    wrap.append(card);
  });
}
const swapEdu = (a, b) => () => {
  [state.education.entries[a], state.education.entries[b]] = [state.education.entries[b], state.education.entries[a]];
  markDirty();
  renderEducation();
};

// ------------------------------------------------------------ data load

async function loadContent() {
  const data = await api("/api/admin/content");
  state = data.state;
  markClean();
  renderAll();
}

// -------------------------------------------------------------- publish

$("#publish-btn").addEventListener("click", async () => {
  const btn = $("#publish-btn");
  if (!dirty) return;
  btn.disabled = true;
  $("#dirty-indicator").dataset.state = "saving";
  try {
    const result = await api("/api/admin/publish", {
      method: "POST",
      body: JSON.stringify({ state, message: $("#publish-message").value }),
    });
    if (result.noop) {
      toast("Content is unchanged — nothing to publish.");
    } else {
      markClean();
      $("#publish-message").value = "";
      toast(result.deployHint || "Published. The live site updates in about 30–60 seconds.");
      refreshHistory();
    }
  } catch (e) {
    toast(e.message, "err");
  } finally {
    updateDirtyUi();
  }
});

// --------------------------------------------------------------- history

async function refreshHistory() {
  const note = $("#history-note");
  try {
    const data = await api("/api/admin/history");
    const list = $("#history-list");
    list.replaceChildren();
    note.hidden = !data.unavailable;
    note.textContent = data.unavailable || "";
    data.history.forEach((item, index) => {
      const li = el("li");
      li.append(el("code", null, item.sha));
      li.append(el("span", "h-msg", item.message));
      if (item.date) li.append(el("time", null, new Date(item.date).toLocaleString()));
      if (index > 0) {
        const btn = el("button", "btn ghost small", "Revert");
        btn.type = "button";
        btn.addEventListener("click", () => revertTo(item));
        li.append(btn);
      } else {
        li.append(el("span", "badge", "current"));
      }
      list.append(li);
    });
  } catch (e) {
    note.hidden = false;
    note.textContent = e.message;
  }
}

async function revertTo(item) {
  if (!confirm(`Restore content from “${item.message}” (${item.sha})?\nThe live site will show it after Vercel rebuilds (~30–60s).`)) return;
  try {
    const result = await api("/api/admin/revert", {
      method: "POST",
      body: JSON.stringify({ sha: item.sha }),
    });
    toast(result.deployHint || "Revert published.");
    refreshHistory();
  } catch (e) {
    toast(e.message, "err");
  }
}

$("#refresh-history").addEventListener("click", refreshHistory);

// ------------------------------------------------------- reload / logout

$("#reload-btn").addEventListener("click", async () => {
  if (dirty && !confirm("Discard unsaved edits and reload published content?")) return;
  try {
    await loadContent();
    toast("Loaded current content.");
  } catch (e) {
    toast(e.message, "err");
  }
});

$("#logout-btn").addEventListener("click", async () => {
  if (dirty && !confirm("You have unsaved edits. Log out anyway?")) return;
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch {
    /* logging out always succeeds visually */
  }
  showLogin();
});

// ----------------------------------------------------------------- login

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("#login-error");
  error.hidden = true;
  const btn = $("#login-submit");
  btn.disabled = true;
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#login-user").value,
        password: $("#login-pass").value,
      }),
    });
    const session = await api("/api/admin/session");
    currentUser = session.username || $("#login-user").value;
    $("#login-pass").value = "";
    showDashboard();
    await loadContent();
    refreshHistory();
  } catch (err) {
    error.textContent = err.message || "Sign-in failed.";
    error.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

// ------------------------------------------------------------------ init

(async function init() {
  try {
    const session = await api("/api/admin/session");
    currentUser = session.username || "";
    showDashboard();
    await loadContent();
    refreshHistory();
  } catch {
    showLogin();
  }
})();
