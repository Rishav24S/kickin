(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORE_REG = "kickin.registrations", STORE_THEME = "kickin.theme";

  // ---------- Storage helpers (safe) ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ---------- Data prep ----------
  const events = EVENTS.map(e => {
    const d = new Date(); d.setDate(d.getDate() + e.days);
    const [h, m] = e.time.split(":").map(Number); d.setHours(h, m, 0, 0);
    return { ...e, date: d };
  });
  let registrations = load(STORE_REG, []);
  const state = { q: "", cat: "All", sort: "date" };

  // ---------- Formatting ----------
  const fmtDate = d => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtTime = d => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const fmtPrice = p => p === 0 ? "Free" : "₹" + p.toLocaleString("en-IN");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const seatsLeft = e => Math.max(0, e.seats - registrations.filter(r => r.eventId === e.id).reduce((n, r) => n + r.tickets, 0));
  const isRegistered = e => registrations.some(r => r.eventId === e.id);

  const imgTag = e => `<img class="photo" src="${e.img}" alt="${esc(e.name)}" loading="lazy" onerror="this.remove()">`;

  // ---------- Cards ----------
  function cardHTML(e, delay = 0) {
    const left = seatsLeft(e);
    return `
    <article class="card" tabindex="0" role="button" aria-label="${esc(e.name)} – view details" data-id="${e.id}" style="animation-delay:${delay}ms">
      <div class="art" style="--c1:${e.colors[0]};--c2:${e.colors[1]}"><span>${e.emoji}</span>${imgTag(e)}<b class="price-tag">${fmtPrice(e.price)}</b></div>
      <div class="card__body">
        <span class="tag">${esc(e.category)}</span>
        <h3>${esc(e.name)}</h3>
        <p>${esc(e.short)}</p>
        <div class="card__meta"><span>📅 ${fmtDate(e.date)} · ${fmtTime(e.date)}</span><span>📍 ${esc(e.venue)}</span></div>
        <div class="card__foot">
          <span class="seats ${left < 20 ? "low" : ""}">${left === 0 ? "Sold out" : left + " seats left"}</span>
          ${isRegistered(e) ? '<span class="registered">✓ Registered</span>' : '<span class="link">View details →</span>'}
        </div>
      </div>
    </article>`;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return events
      .filter(e => state.cat === "All" || e.category === state.cat)
      .filter(e => !q || [e.name, e.venue, e.short, e.category, e.description].join(" ").toLowerCase().includes(q))
      .sort((a, b) => state.sort === "price" ? a.price - b.price : state.sort === "name" ? a.name.localeCompare(b.name) : a.date - b.date);
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.map((e, i) => cardHTML(e, i * 50)).join("");
    $("#empty").hidden = list.length > 0;
    $("#resultCount").textContent = `Showing ${list.length} of ${events.length} events`;
    $("#featuredGrid").innerHTML = events.filter(e => e.featured).map((e, i) => cardHTML(e, i * 80)).join("");
    $("#regCount").textContent = registrations.length;
    $("#statEvents").textContent = events.length;
    $("#statSeats").textContent = events.reduce((n, e) => n + seatsLeft(e), 0).toLocaleString("en-IN");
  }

  function renderChips() {
    $("#chips").innerHTML = ["All", ...CATEGORIES].map(c =>
      `<button class="chip ${c === state.cat ? "active" : ""}" data-cat="${c}" aria-pressed="${c === state.cat}">${c}</button>`).join("");
  }

  // ---------- Modal ----------
  let current = null, timer = null, lastFocus = null;
  const modal = $("#eventModal");

  function openEvent(id) {
    current = events.find(e => e.id === id); if (!current) return;
    const e = current, left = seatsLeft(e);
    lastFocus = document.activeElement;
    const art = $("#mArt");
    art.className = "art detail__art"; art.style.cssText = `--c1:${e.colors[0]};--c2:${e.colors[1]}`;
    art.innerHTML = `<span>${e.emoji}</span>${imgTag(e)}`;
    $("#mCat").textContent = e.category;
    $("#mTitle").textContent = e.name;
    $("#mMeta").innerHTML = `
      <li>📅 <b>${fmtDate(e.date)}</b> at <b>${fmtTime(e.date)}</b></li>
      <li>📍 <b>${esc(e.venue)}</b></li>
      <li>🎟️ <b>${fmtPrice(e.price)}</b> per ticket · ${left} of ${e.seats} seats left</li>`;
    $("#mDesc").textContent = e.description;
    $("#mAgenda").innerHTML = e.agenda.map(a => `<li>${esc(a)}</li>`).join("");

    // form setup
    $("#fEvent").innerHTML = events.map(x => `<option value="${x.id}" ${x.id === e.id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
    updateTicketOptions();
    $("#regForm").reset(); $("#fEvent").value = e.id; updateTicketOptions();
    $$(".field", $("#regForm")).forEach(f => f.classList.remove("valid", "invalid"));
    $("#formWrap").hidden = false; $("#successWrap").hidden = true;

    modal.hidden = false; document.body.classList.add("modal-open");
    $(".modal__panel", modal).scrollTop = 0;
    startCountdown(e);
    setTimeout(() => $("#fName").focus({ preventScroll: true }), 50);
  }

  function closeModal() {
    modal.hidden = true; document.body.classList.remove("modal-open");
    clearInterval(timer); current = null;
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  function updateTicketOptions() {
    const e = events.find(x => x.id === +$("#fEvent").value) || current;
    const max = Math.min(5, seatsLeft(e));
    $("#fTickets").innerHTML = max ? Array.from({ length: max }, (_, i) => `<option>${i + 1}</option>`).join("") : "<option value='0'>Sold out</option>";
    $("#submitBtn").disabled = max === 0;
    $("#submitBtn").textContent = max === 0 ? "Sold out" : "Confirm registration";
  }

  function startCountdown(e) {
    const el = $("#mCountdown");
    const tick = () => {
      let s = Math.floor((e.date - Date.now()) / 1000);
      if (s <= 0) { el.innerHTML = "<b>This event has started!</b>"; clearInterval(timer); return; }
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); s %= 60;
      const p = n => String(n).padStart(2, "0");
      el.innerHTML = [["Days", d], ["Hours", p(h)], ["Mins", p(m)], ["Secs", p(s)]].map(([l, v]) => `<div class="cd"><b>${v}</b><small>${l}</small></div>`).join("");
    };
    clearInterval(timer); tick(); timer = setInterval(tick, 1000);
  }

  // ---------- Validation ----------
  const rules = {
    name: v => !v.trim() ? "Please enter your name." : !/^[A-Za-z][A-Za-z .'-]{1,49}$/.test(v.trim()) ? "Use 2–50 letters only (no digits or symbols)." : "",
    email: v => !v.trim() ? "Please enter your email." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "Enter a valid email like name@example.com." : "",
    phone: v => { const d = v.replace(/[\s()-]/g, ""); return !v.trim() ? "Please enter your phone number." : !/^(\+?\d{1,3})?\d{10}$/.test(d) ? "Enter a valid 10-digit phone number." : ""; },
    event: v => v ? "" : "Please select an event."
  };
  function validateField(input) {
    const msg = rules[input.name](input.value);
    const wrap = input.closest(".field");
    wrap.classList.toggle("invalid", !!msg); wrap.classList.toggle("valid", !msg);
    $(".err", wrap).textContent = msg;
    input.setAttribute("aria-invalid", !!msg);
    return !msg;
  }

  function submitForm(ev) {
    ev.preventDefault();
    const inputs = ["fName", "fEmail", "fPhone", "fEvent"].map(id => $("#" + id));
    const results = inputs.map(validateField);
    if (results.includes(false)) { inputs[results.indexOf(false)].focus(); return; }

    const eventId = +$("#fEvent").value, e = events.find(x => x.id === eventId), tickets = +$("#fTickets").value;
    const email = $("#fEmail").value.trim().toLowerCase();
    if (registrations.some(r => r.eventId === eventId && r.email === email)) {
      const f = $("#fEmail").closest(".field"); f.classList.add("invalid"); f.classList.remove("valid");
      $(".err", f).textContent = "This email is already registered for this event."; $("#fEmail").focus(); return;
    }
    if (tickets < 1 || tickets > seatsLeft(e)) { toast("Not enough seats available."); return; }

    const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Processing…";
    setTimeout(() => {
      const reg = { id: "EVT-" + Math.random().toString(36).slice(2, 8).toUpperCase(), eventId, name: $("#fName").value.trim(), email, phone: $("#fPhone").value.trim(), tickets, at: new Date().toISOString() };
      registrations.push(reg); save(STORE_REG, registrations);
      $("#successMsg").textContent = `Thanks ${reg.name.split(" ")[0]}! ${tickets} ticket${tickets > 1 ? "s" : ""} for ${e.name} confirmed. Your booking is saved in this browser under ${reg.email}.`;
      $("#successId").textContent = reg.id;
      $("#formWrap").hidden = true; $("#successWrap").hidden = false;
      btn.disabled = false; render(); renderDrawer();
    }, 700);
  }

  // ---------- Drawer ----------
  const drawer = $("#drawer");
  function renderDrawer() {
    const box = $("#regList");
    if (!registrations.length) { box.innerHTML = '<p class="muted-msg">You haven\'t registered for any events yet.</p>'; return; }
    box.innerHTML = registrations.slice().reverse().map(r => {
      const e = events.find(x => x.id === r.eventId);
      return `<div class="reg"><h4>${e.emoji} ${esc(e.name)}</h4><small>${fmtDate(e.date)} · ${fmtTime(e.date)}</small>
        <span>${esc(r.name)} · ${r.tickets} ticket${r.tickets > 1 ? "s" : ""}</span><small>ID: ${r.id}</small>
        <button data-cancel="${r.id}">Cancel registration</button></div>`;
    }).join("");
  }

  // ---------- Misc ----------
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2800); }
  function setTheme(t) { document.documentElement.dataset.theme = t; save(STORE_THEME, t); }

  // ---------- Events wiring ----------
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  $("#search").addEventListener("input", debounce(e => { state.q = e.target.value; render(); }, 150));
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; state.cat = b.dataset.cat; renderChips(); render(); });
  $("#resetFilters").addEventListener("click", () => { state.q = ""; state.cat = "All"; $("#search").value = ""; renderChips(); render(); });

  const openFromCard = e => { const c = e.target.closest(".card"); if (c) openEvent(+c.dataset.id); };
  $("#grid").addEventListener("click", openFromCard);
  $("#featuredGrid").addEventListener("click", openFromCard);
  [$("#grid"), $("#featuredGrid")].forEach(g => g.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) { e.preventDefault(); openFromCard(e); } }));

  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  $("#fEvent").addEventListener("change", () => { current = events.find(x => x.id === +$("#fEvent").value); updateTicketOptions(); validateField($("#fEvent")); });
  $("#regForm").addEventListener("submit", submitForm);
  ["fName", "fEmail", "fPhone"].forEach(id => { const i = $("#" + id); i.addEventListener("blur", () => validateField(i)); i.addEventListener("input", () => i.closest(".field").classList.contains("invalid") && validateField(i)); });

  $("#myRegBtn").addEventListener("click", () => { renderDrawer(); drawer.hidden = false; $("#navLinks").classList.remove("open"); });
  drawer.addEventListener("click", e => {
    if (e.target.closest("[data-close-drawer]")) drawer.hidden = true;
    const c = e.target.closest("[data-cancel]");
    if (c) { registrations = registrations.filter(r => r.id !== c.dataset.cancel); save(STORE_REG, registrations); render(); renderDrawer(); toast("Registration cancelled."); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!modal.hidden) closeModal(); else if (!drawer.hidden) drawer.hidden = true; } });

  $("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#menuBtn").addEventListener("click", () => { const o = $("#navLinks").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", o); });
  $("#navLinks").addEventListener("click", e => e.target.closest("a") && $("#navLinks").classList.remove("open"));
  window.addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 8), { passive: true });

  // Scroll reveal
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: .12 }) : null;
  $$(".reveal").forEach(el => io ? io.observe(el) : el.classList.add("in"));

  // ---------- Init ----------
  const savedTheme = load(STORE_THEME, null);
  setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#year").textContent = new Date().getFullYear();
  renderChips(); render(); renderDrawer();
})();
