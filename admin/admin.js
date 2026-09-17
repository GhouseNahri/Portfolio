// Portfolio Admin — UI logic. No frameworks, no build step.
// Talks only to the local server (127.0.0.1) started by `npm run admin`.

let state = null; // { site, about, skills, projects, education }
let dirty = false;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- toasts
let toastTimer;
function toast(msg, kind = "ok") {
  const el = $("toast");
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

// ---------------------------------------------------------------- helpers
function val(id) {
  return $(id).value.trim();
}
function setVal(id, v) {
  $(id).value = v ?? "";
}
function markDirty() {
  if (!dirty) {
    dirty = true;
    document.title = "Portfolio Admin — unsaved changes";
  }
}

// Bind a simple input/textarea to a getter/setter pair.
function bindInput(id, get, set) {
  const el = $(id);
  el.value = get() ?? "";
  el.addEventListener("input", () => {
    set(el.value);
    markDirty();
    if (id === "f-seo-description") updateSeoPreview();
  });
}

// ---------------------------------------------------------------- state load
async function load() {
  const res = await fetch("/api/state");
  const data = await res.json();
  state = data.state;
  renderMeta(data.meta);
  renderAll();
  updateSeoPreview();
  if (state._draftError) {
    toast(`⚠ Draft file has an error — showing last published version. (${state._draftError})`, "err");
  } else if (data.meta.draft && data.meta.git.dirty) {
    toast("A saved draft was found — it is not published yet.", "warn");
  }
}

function renderMeta(meta) {
  const g = meta.git || {};
  const bits = [];
  bits.push(`branch: ${g.branch || "?"}`);
  if (g.dirty) bits.push("● unsaved draft on disk");
  if (g.ahead > 0) bits.push(`${g.ahead} unpublished commit${g.ahead > 1 ? "s" : ""} — press Publish`);
  $("git-status").textContent = bits.join(" · ");
  if (meta.draft?.savedAt) {
    $("publish-status").innerHTML =
      `<b>Draft saved</b> at ${new Date(meta.draft.savedAt).toLocaleString()}` +
      (g.dirty ? " — not published yet." : "");
  } else {
    $("publish-status").innerHTML = "No draft — everything is published.";
  }
  const hist = $("publish-history");
  hist.innerHTML = "";
  for (const h of meta.history || []) {
    const li = document.createElement("li");
    li.innerHTML = `<code>${h.hash}</code> <span>${h.date}</span> — ${escapeHtml(h.message)}`;
    hist.appendChild(li);
  }
  if (!hist.children.length) hist.innerHTML = "<li>No content commits yet.</li>";
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

// ---------------------------------------------------------------- boot helpers
function renderAll() {
  renderProfile();
  renderAbout();
  renderSkills();
  renderProjects();
  renderEducation();
}

// ---------------------------------------------------------------- profile
function renderProfile() {
  const s = state.site;
  bindInput("f-name", () => s.name, (v) => (s.name = v));
  bindInput("f-firstName", () => s.firstName, (v) => (s.firstName = v));
  bindInput("f-role", () => s.role, (v) => (s.role = v));
  bindInput("f-availability", () => s.availability, (v) => (s.availability = v));
  bindInput("f-tagline", () => s.tagline, (v) => (s.tagline = v));
  bindInput("f-github", () => s.github, (v) => (s.github = v));
  bindInput("f-linkedin", () => s.linkedin, (v) => (s.linkedin = v));
  bindInput("f-email", () => s.email, (v) => (s.email = v));
  bindInput("f-seo-description", () => s.seo?.description, (v) => (s.seo = { description: v }));
}

// ---------------------------------------------------------------- about
function renderAbout() {
  const box = $("about-paragraphs");
  box.innerHTML = "";
  state.about.paragraphs.forEach((p, i) => {
    box.appendChild(
      listRow({
        value: p,
        placeholder: "A paragraph of your story…",
        rows: 4,
        onChange: (v) => (state.about.paragraphs[i] = v),
        onRemove: () => {
          if (!confirm("Remove this paragraph? It disappears when you save.")) return;
          state.about.paragraphs.splice(i, 1);
          renderAbout();
          markDirty();
        },
        onUp: i > 0 ? () => move(state.about.paragraphs, i, -1, renderAbout) : null,
      })
    );
  });
  const learn = $("about-learning");
  learn.innerHTML = "";
  state.about.currentlyLearning.forEach((item, i) => {
    learn.appendChild(
      listRow({
        value: item,
        placeholder: "e.g. Data structures",
        onChange: (v) => (state.about.currentlyLearning[i] = v),
        onRemove: () => {
          state.about.currentlyLearning.splice(i, 1);
          renderAbout();
          markDirty();
        },
        onUp: i > 0 ? () => move(state.about.currentlyLearning, i, -1, renderAbout) : null,
      })
    );
  });
  $("btn-add-paragraph").onclick = () => {
    state.about.paragraphs.push("");
    renderAbout();
    markDirty();
  };
  $("btn-add-learning").onclick = () => {
    state.about.currentlyLearning.push("");
    renderAbout();
    markDirty();
  };
}

// ---------------------------------------------------------------- skills
function renderSkills() {
  const box = $("skills-groups");
  box.innerHTML = "";
  state.skills.groups.forEach((g, gi) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <input class="group-label" value="${escapeAttr(g.label)}" placeholder="Group name (e.g. Languages)" />
        <span class="spacer"></span>
        <button class="btn btn-mini" data-act="up" type="button" ${gi === 0 ? "disabled" : ""}>↑</button>
        <button class="btn btn-mini btn-danger" data-act="del" type="button">Delete group</button>
      </div>
      <div class="items"></div>
      <button class="btn btn-ghost btn-mini" data-act="add-item" type="button">+ Add skill</button>`;
    const labelInput = card.querySelector(".group-label");
    labelInput.addEventListener("input", () => {
      state.skills.groups[gi].label = labelInput.value;
      markDirty();
    });
    const itemsBox = card.querySelector(".items");
    (g.items || []).forEach((item, ii) => {
      itemsBox.appendChild(
        listRow({
          value: item,
          placeholder: "e.g. Python",
          onChange: (v) => (state.skills.groups[gi].items[ii] = v),
          onRemove: () => {
            state.skills.groups[gi].items.splice(ii, 1);
            renderSkills();
            markDirty();
          },
          onUp: ii > 0 ? () => move(state.skills.groups[gi].items, ii, -1, renderSkills) : null,
        })
      );
    });
    card.querySelector('[data-act="add-item"]').onclick = () => {
      state.skills.groups[gi].items.push("");
      renderSkills();
      markDirty();
    };
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm(`Delete the whole “${g.label}” group and its ${g.items.length} skills?`)) return;
      state.skills.groups.splice(gi, 1);
      renderSkills();
      markDirty();
    };
    card.querySelector('[data-act="up"]').onclick = () => move(state.skills.groups, gi, -1, renderSkills);
    box.appendChild(card);
  });
  $("btn-add-group").onclick = () => {
    state.skills.groups.push({ label: "New group", items: [] });
    renderSkills();
    markDirty();
  };
  bindInput("f-skills-footnote", () => state.skills.footnote, (v) => (state.skills.footnote = v));
}

// ---------------------------------------------------------------- projects
function renderProjects() {
  const box = $("projects-list");
  box.innerHTML = "";
  state.projects.items.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <strong class="proj-title">${escapeHtml(p.title) || "Untitled project"} ${i === 0 ? '<span class="feat">featured</span>' : ""}</strong>
        <span class="spacer"></span>
        <button class="btn btn-mini" data-act="up" type="button" ${i === 0 ? "disabled" : ""}>↑ Move up</button>
        <button class="btn btn-mini btn-danger" data-act="del" type="button">Delete</button>
      </div>
      <div class="grid2">
        <label class="span2">Title <input data-f="title" /></label>
        <label class="span2">Description <textarea data-f="description" rows="3"></textarea></label>
        <label>Technologies <span class="q" data-help="Comma-separated, e.g. Astro, TypeScript, Tailwind CSS.">?</span><input data-f="tech-csv" /></label>
        <label>Status <select data-f="status">
          <option value="live">Live</option>
          <option value="in-progress">In progress</option>
          <option value="archived">Archived</option>
        </select></label>
        <label>GitHub URL <input data-f="github" type="url" /></label>
        <label>Live demo URL <input data-f="demo" type="url" /></label>
      </div>`;
    card.querySelector('[data-f="title"]').value = p.title;
    card.querySelector('[data-f="description"]').value = p.description;
    card.querySelector('[data-f="tech-csv"]').value = (p.tech || []).join(", ");
    card.querySelector('[data-f="status"]').value = p.status;
    card.querySelector('[data-f="github"]').value = p.github;
    card.querySelector('[data-f="demo"]').value = p.demo;

    card.querySelectorAll("[data-f]").forEach((el) => {
      el.addEventListener("input", () => {
        const f = el.dataset.f;
        if (f === "tech-csv") {
          state.projects.items[i].tech = el.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else {
          state.projects.items[i][f] = el.value;
        }
        if (f === "title") {
          card.querySelector(".proj-title").innerHTML =
            `${escapeHtml(el.value) || "Untitled project"} ${i === 0 ? '<span class="feat">featured</span>' : ""}`;
        }
        markDirty();
      });
    });
    card.querySelector('[data-act="up"]').onclick = () => move(state.projects.items, i, -1, renderProjects);
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm(`Delete “${p.title}” permanently? (Its content is recoverable from git history until you publish.)`)) return;
      state.projects.items.splice(i, 1);
      renderProjects();
      markDirty();
    };
    box.appendChild(card);
  });
  $("btn-add-project").onclick = () => {
    state.projects.items.push({
      title: "New project",
      description: "",
      tech: [],
      status: "in-progress",
      github: "",
      demo: "",
    });
    renderProjects();
    markDirty();
    box.lastChild.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

// ---------------------------------------------------------------- education
function renderEducation() {
  const box = $("education-list");
  box.innerHTML = "";
  state.education.entries.forEach((e, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <strong>${escapeHtml(e.degree) || "Untitled"} ${i === 0 ? '<span class="feat">search-profile</span>' : ""}</strong>
        <span class="spacer"></span>
        <button class="btn btn-mini" data-act="up" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="btn btn-mini btn-danger" data-act="del" type="button">Delete</button>
      </div>
      <div class="grid2">
        <label>Degree <input data-f="degree" /></label>
        <label>Institution <input data-f="institution" /></label>
        <label>Period <input data-f="period" placeholder="2025 — 2029" /></label>
        <label>Note <span class="q" data-help="Optional line: relevant coursework, honours, activities.">?</span><input data-f="note" /></label>
      </div>`;
    card.querySelectorAll("[data-f]").forEach((el) => {
      el.value = e[el.dataset.f] ?? "";
      el.addEventListener("input", () => {
        state.education.entries[i][el.dataset.f] = el.value;
        markDirty();
      });
    });
    card.querySelector('[data-act="up"]').onclick = () => move(state.education.entries, i, -1, renderEducation);
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm(`Delete “${e.degree}”?`)) return;
      state.education.entries.splice(i, 1);
      renderEducation();
      markDirty();
    };
    box.appendChild(card);
  });
  $("btn-add-education").onclick = () => {
    state.education.entries.push({ degree: "", institution: "", period: "", note: "" });
    renderEducation();
    markDirty();
  };
}

// ---------------------------------------------------------------- row helper
function listRow({ value, placeholder, rows, onChange, onRemove, onUp }) {
  const row = document.createElement("div");
  row.className = "listrow";
  const field = rows
    ? `<textarea rows="${rows}" placeholder="${escapeAttr(placeholder || "")}"></textarea>`
    : `<input placeholder="${escapeAttr(placeholder || "")}" />`;
  row.innerHTML = `
    ${field}
    <span class="rowbtns">
      ${onUp ? '<button class="btn btn-mini" data-act="up" type="button" title="Move up">↑</button>' : ""}
      <button class="btn btn-mini btn-danger" data-act="del" type="button" title="Remove">✕</button>
    </span>`;
  const input = row.querySelector("input,textarea");
  input.value = value ?? "";
  input.addEventListener("input", () => {
    onChange(input.value);
    markDirty();
  });
  if (onUp) row.querySelector('[data-act="up"]').onclick = onUp;
  row.querySelector('[data-act="del"]').onclick = onRemove;
  return row;
}

function move(arr, i, delta, rerender) {
  const j = i + delta;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  rerender();
  markDirty();
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ---------------------------------------------------------------- seo preview
function updateSeoPreview() {
  $("seo-preview-title").textContent = `${val("f-name") || "Name"} — ${val("f-role") || "Title"}`;
  $("seo-preview-desc").textContent = val("f-seo-description") || "(no description set)";
}

// ---------------------------------------------------------------- actions
function collectState() {
  // state is already the live object — inputs mutate it directly.
  return state;
}

async function save() {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectState()),
  });
  const data = await res.json();
  if (!res.ok) {
    toast(`✗ ${data.error}`, "err");
    return false;
  }
  dirty = false;
  document.title = "Portfolio Admin";
  toast(data.changed ? "✓ Draft saved to src/data/site.ts (not published yet)" : "Nothing changed — draft matches the published version.");
  const meta = await (await fetch("/api/state")).json();
  renderMeta(meta.meta);
  return true;
}

async function discard() {
  if (!confirm("Discard ALL unsaved changes and restore the last published content?")) return;
  await fetch("/api/discard", { method: "POST" });
  dirty = false;
  document.title = "Portfolio Admin";
  toast("Draft discarded — restored published content.");
  await load();
}

async function publish() {
  if (dirty) {
    const ok = await save();
    if (!ok) return;
  }
  const message = val("f-publish-message") || "Update portfolio content via admin";
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (data.error) {
    toast(`✗ ${data.error}`, "err");
    return;
  }
  if (data.noop) {
    toast("Nothing to publish — the site is already up to date.");
    return;
  }
  if (data.pushed) {
    toast("🚀 Published! Vercel is rebuilding — your site updates in ~30 seconds.");
  } else {
    toast("Committed, but the push may not have completed — check the Publish tab.", "warn");
  }
  const meta = await (await fetch("/api/state")).json();
  renderMeta(meta.meta);
}

// ---------------------------------------------------------------- nav
function wireNav() {
  document.querySelectorAll(".navlink").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".navlink").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${btn.dataset.view}`));
    });
  });
}

// ---------------------------------------------------------------- help tooltips
function wireHelp() {
  document.addEventListener("mouseover", (e) => {
    const q = e.target.closest(".q");
    if (!q) return;
    let tip = document.getElementById("tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "tooltip";
      document.body.appendChild(tip);
    }
    tip.textContent = q.dataset.help;
    const r = q.getBoundingClientRect();
    tip.style.left = Math.min(r.left, window.innerWidth - 320) + "px";
    tip.style.top = r.bottom + 6 + "px";
    tip.classList.add("show");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(".q")) document.getElementById("tooltip")?.classList.remove("show");
  });
}

// ---------------------------------------------------------------- boot
wireNav();
wireHelp();
$("btn-save").addEventListener("click", save);
$("btn-discard").addEventListener("click", discard);
$("btn-publish").addEventListener("click", publish);
$("btn-publish-2").addEventListener("click", publish);
window.addEventListener("beforeunload", (e) => {
  if (dirty) e.preventDefault();
});
load();
