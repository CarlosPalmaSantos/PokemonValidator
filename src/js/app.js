(function () {
  'use strict';

  const DATA = JSON.parse(document.getElementById('app-data').textContent);
  const $ = (s, r) => (r || document).querySelector(s);
  const SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  const STORE = 'bstlocke.v1';

  const TYPES = {
    normal: ['Normal', '#a8a77a', '#1d1b19'], fire: ['Fuego', '#ee8130', '#1d1b19'], water: ['Agua', '#6390f0', '#fff'],
    electric: ['Eléctrico', '#f7d02c', '#1d1b19'], grass: ['Planta', '#7ac74c', '#1d1b19'], ice: ['Hielo', '#96d9d6', '#1d1b19'],
    fighting: ['Lucha', '#c22e28', '#fff'], poison: ['Veneno', '#a33ea1', '#fff'], ground: ['Tierra', '#e2bf65', '#1d1b19'],
    flying: ['Volador', '#a98ff3', '#1d1b19'], psychic: ['Psíquico', '#f95587', '#1d1b19'], bug: ['Bicho', '#a6b91a', '#1d1b19'],
    rock: ['Roca', '#b6a136', '#1d1b19'], ghost: ['Fantasma', '#735797', '#fff'], dragon: ['Dragón', '#6f35fc', '#fff'],
    dark: ['Siniestro', '#705746', '#fff'], steel: ['Acero', '#b7b7ce', '#1d1b19'], fairy: ['Hada', '#d685ad', '#1d1b19'],
    stellar: ['Astral', '#40b5a5', '#1d1b19'], shadow: ['Sombra', '#4a3a5c', '#fff']
  };
  const TYPE_ORDER = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
  const STAT_NAMES = ['PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'];
  const PRESETS = [350, 400, 450, 500, 550, 600];
  const GEN_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const GEN_MAX_DEX = [0, 151, 251, 386, 493, 649, 721, 809, 905, 1025];
  const PAGE = 120;

  // ---------- estado ----------
  const defaults = { gameId: 'scarlet-violet', max: 450, min: null, mode: 'self', showAll: true, budget: null, team: {}, custom: {}, theme: null };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { /* sin almacenamiento */ }
  const state = Object.assign({}, defaults, saved);
  const ui = { q: '', selected: null, gameQ: '', dq: '', dtype: null, dfilter: 'all', dsort: 'dex', shown: PAGE };
  function persist() {
    try {
      const { gameId, max, min, mode, showAll, budget, team, custom, theme } = state;
      localStorage.setItem(STORE, JSON.stringify({ gameId, max, min, mode, showAll, budget, team, custom, theme }));
    } catch (e) { /* ignorar */ }
  }

  // ---------- juegos ----------
  const genOfDex = d => { for (let g = 1; g <= 9; g++) if (d <= GEN_MAX_DEX[g]) return g; return 9; };
  function allGames() {
    const out = DATA.pokeapi.games.map(g => ({ id: g.id, name: g.name, gen: g.gen, source: 'pokeapi', ref: g }));
    Object.values(DATA.essentials || {}).forEach(g => out.push({ id: g.id, name: g.name, source: 'essentials', note: g.note, ref: g }));
    Object.values(state.custom).forEach(g => out.push({ id: g.id, name: g.name, source: 'custom', note: 'Cargado desde tu archivo pokemon.txt.', ref: g }));
    return out;
  }
  const getGame = id => allGames().find(g => g.id === id) || allGames()[0];

  function statsFor(p, gen) {
    const s = p.stats.slice(); let special = false;
    for (const [g, ch] of p.past) { // de más nuevo a más antiguo
      if (g < gen) continue;
      for (const k in ch) { if (k === 'sp') { s[3] = s[4] = ch[k]; special = true; } else s[+k] = ch[k]; }
    }
    return { s, special: special && gen === 1 };
  }
  function typesFor(p, gen) {
    let t = p.types;
    for (const [g, ts] of (p.pastTypes || [])) if (g >= gen) t = ts;
    return t;
  }
  const sumBst = (s, special) => special ? s[0] + s[1] + s[2] + s[3] + s[5] : s.reduce((a, b) => a + b, 0);

  let dexCache = null;
  function buildDex(game) {
    const cacheKey = game.id + '|' + state.showAll;
    if (dexCache && dexCache.key === cacheKey) return dexCache;
    let list;
    if (game.source === 'pokeapi') {
      const avail = new Set(game.ref.available);
      list = DATA.pokeapi.pokemon.filter(p => avail.has(p.key) || (state.showAll && !p.region && !p.formType && genOfDex(p.dex) <= game.gen)).map(p => {
        const { s, special } = statsFor(p, game.gen);
        return { key: p.key, dex: p.dex, name: p.name, nameEn: p.nameEn, types: typesFor(p, game.gen), stats: s, special, bst: sumBst(s, special), sprite: p.id, from: p.from, how: p.how, formType: p.formType || null, formLabel: p.formLabel || null, mechanic: p.mechanic || null, species: p.species || p.key };
      });
    } else {
      list = game.ref.pokemon.map(p => ({ key: p.key, dex: p.dex, name: p.name, nameEn: '', types: p.types, stats: p.stats, special: false, bst: sumBst(p.stats, false), sprite: p.spriteRedirectId || p.spriteId, spriteSrc: p.spriteSrc || null, spriteRedirectId: p.spriteRedirectId || null, from: p.from, how: p.how, fakemon: p.spriteId == null && p.spriteSrc == null && p.spriteRedirectId == null, formType: p.formType || null, formLabel: p.formLabel || null, mechanic: p.mechanic || null, species: p.species || p.key, region: p.region || null }));
    }
    const byKey = new Map(list.map(m => [m.key, m]));
    const children = new Map();
    list.forEach(m => {
      if (m.from && byKey.has(m.from)) { if (!children.has(m.from)) children.set(m.from, []); children.get(m.from).push(m.key); } else { m.from = null; m.how = null; }
    });
    children.forEach(arr => arr.sort((a, b) => byKey.get(a).dex - byKey.get(b).dex));
    const descendants = key => {
      const seen = new Set([key]); const stack = [key];
      while (stack.length) (children.get(stack.pop()) || []).forEach(c => { if (!seen.has(c)) { seen.add(c); stack.push(c); } });
      return [...seen].map(k => byKey.get(k));
    };
    const root = key => { let m = byKey.get(key), n = 0; while (m.from && n++ < 10) m = byKey.get(m.from); return m.key; };
    dexCache = { key: cacheKey, list, byKey, children, descendants, root, bestCache: new Map() };
    return dexCache;
  }
  const bestOf = (dex, m) => {
    if (!dex.bestCache.has(m.key)) dex.bestCache.set(m.key, dex.descendants(m.key).reduce((a, b) => b.bst > a.bst ? b : a));
    return dex.bestCache.get(m.key);
  };
  const curDex = () => buildDex(getGame(state.gameId));

  // ---------- reglas ----------
  const teamKeys = () => state.team[state.gameId] || (state.team[state.gameId] = []);
  const teamTotal = dex => teamKeys().reduce((a, k) => a + ((dex.byKey.get(k) || {}).bst || 0), 0);
  function evaluate(dex, m, total) {
    const ref = state.mode === 'final' ? bestOf(dex, m) : m;
    const v = ref.bst; const reasons = []; let ok = true;
    if (state.max != null && v > state.max) { ok = false; reasons.push(`Supera el máximo en ${v - state.max} puntos`); }
    if (state.min != null && v < state.min) { ok = false; reasons.push(`Está ${state.min - v} puntos por debajo del mínimo`); }
    if (state.budget != null && total + m.bst > state.budget && !teamKeys().includes(m.key)) { ok = false; reasons.push(`Superaría el presupuesto de equipo (${total + m.bst}/${state.budget})`); }
    return { ok, v, ref, reasons };
  }
  function ruleSummary() {
    const p = [];
    if (state.max != null) p.push(`BST ≤ ${state.max}`);
    if (state.min != null) p.push(`BST ≥ ${state.min}`);
    p.push(state.mode === 'final' ? 'se mide la evolución más fuerte' : 'se mide el Pokémon encontrado');
    if (state.budget != null) p.push(`equipo ≤ ${state.budget}`);
    return p.join(' · ');
  }

  // ---------- util ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gameIcon = g => {
    const gameId = encodeURIComponent(g.id);
    return `<img class="game-icon" src="sprites/${gameId}/_icon.png" alt="" width="32" height="32" data-fallback="${esc(g.name.slice(0, 2).toUpperCase())}">`;
  };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = n => String(n).padStart(3, '0');
  const numLabel = m => m.fakemon ? 'Fakemon' : '#' + pad(m.dex);
  const typeTags = types => `<div class="types">${types.map(t => { const d = TYPES[t] || [t, '#888', '#fff']; return `<span class="t" style="background:${d[1]};color:${d[2]}">${esc(d[0])}</span>`; }).join('')}</div>`;
  const mechanicLabel = m => {
    if (m.mechanic) return m.mechanic;
    if (m.formType === 'regional') return m.formLabel || null;
    return null;
  };
  const formBadge = m => {
    const label = mechanicLabel(m);
    if (!label) return '';
    const mechanicClass = m.mechanic ? ` mechanic-${esc(m.mechanic.toLowerCase())}` : ` ${esc(m.formType || '')}`;
    return `<span class="form-tag${mechanicClass}">${esc(label)}</span>`;
  };
  const spr = m => {
    const game = getGame(state.gameId);
    if (m.spriteSrc) {
      return `<img class="pokemon-sprite" src="${esc(m.spriteSrc)}" alt="" loading="lazy" width="96" height="96" data-poke-sprite="${m.sprite ? esc(m.sprite) : ''}" data-redir="sprites/${encodeURIComponent(game.id)}/${encodeURIComponent(m.key)}.redir.txt">`;
    }
    if (m.spriteRedirectId) {
      return `<img class="pokemon-sprite" src="${SPRITE}${m.spriteRedirectId}.png" alt="" loading="lazy" width="96" height="96" data-poke-sprite="${esc(m.spriteRedirectId)}">`;
    }
    if (game.source !== 'pokeapi') {
      const nameId = encodeURIComponent(m.key);
      return `<img class="pokemon-sprite" src="sprites/${encodeURIComponent(game.id)}/${nameId}.png" alt="" loading="lazy" width="96" height="96" data-redir="sprites/${encodeURIComponent(game.id)}/${nameId}.redir.txt"${m.sprite ? ` data-poke-sprite="${esc(m.sprite)}"` : ''}>`;
    }
    if (m.sprite) {
      return `<img class="pokemon-sprite" src="${SPRITE}${m.sprite}.png" alt="" loading="lazy" width="96" height="96" data-redir="sprites/${encodeURIComponent(game.id)}/${encodeURIComponent(m.key)}.redir.txt" data-poke-sprite="${esc(m.sprite)}">`;
    }
    return `<img class="pokemon-sprite" src="sprites/${encodeURIComponent(game.id)}/${encodeURIComponent(m.key)}.png" alt="" loading="lazy" width="96" height="96" data-redir="sprites/${encodeURIComponent(game.id)}/${encodeURIComponent(m.key)}.redir.txt">`;
  };
  const barColor = v => v >= 130 ? '#2f9e6b' : v >= 90 ? '#7ac74c' : v >= 60 ? '#f2b705' : '#e8743b';
  const numOrNull = v => { v = String(v).trim(); return v === '' || isNaN(+v) ? null : Math.max(0, Math.round(+v)); };
  function matches(m, q) {
    q = norm(q.trim()); if (!q) return true;
    if (/^#?\d+$/.test(q)) return m.dex === parseInt(q.replace('#', ''), 10);
    return norm(m.name).includes(q) || norm(m.nameEn).includes(q) || m.types.some(t => norm((TYPES[t] || [t])[0]).includes(q));
  }
  const monLink = (m, ev) => `<a class="mon" href="#/pokemon/${encodeURIComponent(m.key)}">${monInner(m, ev)}</a>`;
  function monInner(m, ev) {
    return `${spr(m)}<span><span class="n">${esc(m.name)}</span><small>${numLabel(m)} ${formBadge(m)}</small>${typeTags(m.types)}</span>
      <span class="r"><b>${state.mode === 'final' && ev.ref.key !== m.key ? ev.v + '*' : m.bst}</b><span class="tag ${ev.ok ? 'ok' : 'no'}">${ev.ok ? '✔ Sí' : '✘ No'}</span></span>`;
  }

  // ---------- ficha de Pokémon ----------
  function evoTree(dex, m, total) {
    const rootKey = dex.root(m.key);
    const node = k => {
      const x = dex.byKey.get(k); const e = evaluate(dex, x, total);
      const kids = dex.children.get(k) || [];
      return `<div class="evo-node"><a class="evo-card ${k === m.key ? 'cur' : ''}" href="#/pokemon/${encodeURIComponent(k)}">${spr(x)}
        <b>${esc(x.name)}</b>${formBadge(x)}${typeTags(x.types)}<small><span class="dot ${e.ok ? 'ok' : 'no'}"></span>BST ${x.bst}</small></a>
        ${kids.length ? `<div class="evo-kids">${kids.map(c => `<div class="evo-branch"><span class="how">${esc(dex.byKey.get(c).how || 'Evoluciona')}</span>${node(c)}</div>`).join('')}</div>` : ''}</div>`;
    };
    return node(rootKey);
  }
  function entryHtml(dex, m, full) {
    const total = teamTotal(dex);
    const ev = evaluate(dex, m, total);
    const labels = m.special ? ['PS', 'Ataque', 'Defensa', 'Especial', null, 'Velocidad'] : STAT_NAMES;
    const rows = labels.map((l, i) => l ? `<div class="st"><i>${l}</i><b>${m.stats[i]}</b><div class="bar"><u style="width:${Math.min(100, m.stats[i] / 255 * 100)}%;background:${barColor(m.stats[i])}"></u></div></div>` : '').join('');
    const cmp = state.mode === 'final' ? (ev.ref.key !== m.key ? `Se compara con su evolución más fuerte: ${esc(ev.ref.name)} (${ev.v}).` : 'Es su evolución más fuerte.') : '';
    const detail = ev.ok ? (state.max != null ? `BST ${ev.v} ≤ ${state.max}${state.max - ev.v ? ` · te sobran ${state.max - ev.v}` : ''}` : 'Cumple todas las reglas.') : ev.reasons.join(' · ');
    const inTeam = teamKeys().includes(m.key);
    let rel = '';
    if (full) {
      const parent = m.from && dex.byKey.get(m.from);
      const kids = (dex.children.get(m.key) || []).map(k => dex.byKey.get(k));
      const bits = [];
      if (parent) bits.push(`Evoluciona de <a href="#/pokemon/${encodeURIComponent(parent.key)}">${esc(parent.name)}</a>: <b>${esc(m.how || 'método desconocido')}</b>.`);
      if (kids.length && kids.length <= 2) bits.push('Evoluciona a ' + kids.map(k => `<a href="#/pokemon/${encodeURIComponent(k.key)}">${esc(k.name)}</a> (${esc(k.how || '?')})`).join(', ') + '.');
      if (kids.length > 2) bits.push(`Tiene ${kids.length} evoluciones (ver el árbol).`);
      if (!parent && !kids.length) bits.push('No evoluciona.');
      rel = `<div class="sect"><h4>Evolución</h4><p class="rel">${bits.join(' ')}</p>${parent || kids.length ? `<div class="evo-wrap">${evoTree(dex, m, total)}</div>` : ''}</div>`;

      const species = m.species || m.key;
      const alternatives = dex.list.filter(x =>
        x.key !== m.key &&
        (x.species || x.key) === species
      );
      if (alternatives.length) {
        rel += `<div class="sect"><h4>Formas alternativas</h4><div class="form-grid">${alternatives.map(x => {
          const xe = evaluate(dex, x, total);
          const cardMechanic = x.mechanic ? ` mechanic-${esc(x.mechanic.toLowerCase())}` : (x.formType ? ` ${esc(x.formType)}` : '');
          return `<a class="form-card${cardMechanic}" href="#/pokemon/${encodeURIComponent(x.key)}">
            ${spr(x)}
            <span><b>${esc(x.name)}</b>${formBadge(x)}<small>BST ${x.bst}</small></span>
            <span class="tag ${xe.ok ? 'ok' : 'no'}">${xe.ok ? '✔ Sí' : '✘ No'}</span>
          </a>`;
        }).join('')}</div></div>`;
      }
    }
    return `<article class="card">
      <div class="art">${spr(m)}<small>${numLabel(m)}</small></div>
      <div>
        <h3>${esc(m.name)} ${formBadge(m)}</h3>
        <p class="sub">${m.nameEn && m.nameEn !== m.name ? esc(m.nameEn) + ' · ' : ''}${numLabel(m)}${m.formLabel ? ' · ' + esc(m.formLabel) : ''}</p>
        ${typeTags(m.types)}
        <div class="verdict ${ev.ok ? 'ok' : 'no'}" role="status">
          <span class="ic" aria-hidden="true">${ev.ok ? '✔' : '✘'}</span>
          <div><strong>${ev.ok ? 'SE PUEDE CAPTURAR' : 'NO SE PUEDE CAPTURAR'}</strong><span>${esc(detail)}${cmp ? '<br>' + cmp : ''}</span></div>
        </div>
        <div class="stats">${rows}</div>
        <div class="bst"><span>BST total${m.special ? ' (Especial una vez)' : ''}</span><b>${m.bst}</b></div>
        <div class="actions">
          <button type="button" class="primary" data-add="${esc(m.key)}" ${inTeam ? 'disabled' : ''}>${inTeam ? 'Ya está en tu equipo' : 'Añadir a mi equipo'}</button>
          ${full ? '' : `<a class="btn" href="#/pokemon/${encodeURIComponent(m.key)}">Ver ficha completa →</a>`}
        </div>
        ${rel}
      </div>
    </article>`;
  }

  // ---------- vistas ----------
  const view = $('#view');
  const views = {};

  views.validador = {
    html: () => `
      <div class="panel searchbar"><label class="field"><span class="sr">Buscar Pokémon</span>
        <input id="q" type="search" placeholder="¿Qué Pokémon te ha salido? Nombre o número…" autocomplete="off" spellcheck="false"></label></div>
      <div class="rulechip">Regla activa: <b id="ruleTxt"></b> <a href="#/reglas">Cambiar</a></div>
      <div id="vResult"></div>
      <div id="vSuggest"></div>`,
    mount() { $('#q').value = ui.q; this.update(); },
    update() {
      const dex = curDex();
      $('#ruleTxt').textContent = ruleSummary();
      const m = ui.selected && dex.byKey.get(ui.selected);
      $('#vResult').innerHTML = m ? entryHtml(dex, m, false) : '<div class="placeholder">Escribe el nombre de un Pokémon para ver si puedes capturarlo en tu locke.</div>';
      const q = ui.q.trim(); const box = $('#vSuggest');
      if (!q) { box.innerHTML = ''; return; }
      const total = teamTotal(dex);
      const rows = dex.list.filter(x => matches(x, q)).slice(0, 30);
      box.innerHTML = `<div class="panel"><h2>${rows.length ? 'Resultados' : 'Sin resultados'}</h2><div class="grid">${rows.map(x => {
        const ev = evaluate(dex, x, total);
        return `<button type="button" class="mon ${x.key === ui.selected ? 'sel' : ''}" data-select="${esc(x.key)}">${monInner(x, ev)}</button>`;
      }).join('')}</div>${!rows.length && getGame(state.gameId).source === 'pokeapi' && !state.showAll ? '<p class="empty-list">Puede que no esté en la Pokédex de este juego. Activa «Mostrar también Pokémon fuera de la Pokédex» en Reglas y juego.</p>' : ''}</div>`;
    },
    input(e) {
      if (e.target.id === 'q') { ui.q = e.target.value; const dex = curDex(); const f = dex.list.filter(x => matches(x, ui.q)); if (ui.q.trim() && f.length === 1) ui.selected = f[0].key; this.update(); }
    },
    keydown(e) {
      if (e.target.id === 'q' && e.key === 'Enter') { const f = curDex().list.filter(x => matches(x, ui.q)); if (f.length) { ui.selected = f[0].key; this.update(); } }
    },
    click(e) {
      const s = e.target.closest('[data-select]'); if (s) { ui.selected = s.dataset.select; this.update(); $('#vResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
  };

  views.pokedex = {
    html: () => `
      <div class="view-head"><h2 id="dTitle">Pokédex</h2></div>
      <div class="panel">
        <div class="two" style="margin-bottom:0">
          <label class="field"><span class="sr">Buscar</span><input id="dq" type="search" placeholder="Buscar por nombre, número o tipo…" autocomplete="off" spellcheck="false"></label>
          <div class="controls">
            <div class="seg" id="dFilter" role="group" aria-label="Filtrar por captura">
              <button type="button" data-f="all">Todos</button><button type="button" data-f="ok">Capturables</button><button type="button" data-f="no">No capturables</button>
            </div>
            <select id="dSort" aria-label="Ordenar">
              <option value="dex">Nº Pokédex</option><option value="bst-desc">BST ↓</option><option value="bst-asc">BST ↑</option><option value="name">Nombre</option>
            </select>
          </div>
        </div>
        <div class="tfilter" id="dTypes" role="group" aria-label="Filtrar por tipo"></div>
        <div id="dGrid" class="grid"></div>
        <div class="more"><button id="dMore" type="button" class="ghost" hidden></button></div>
      </div>`,
    mount() {
      $('#dq').value = ui.dq; $('#dSort').value = ui.dsort;
      this.update();
    },
    update() {
      const dex = curDex(); const total = teamTotal(dex);
      const present = new Set(); dex.list.forEach(m => m.types.forEach(t => present.add(t)));
      const types = TYPE_ORDER.filter(t => present.has(t)).concat([...present].filter(t => !TYPE_ORDER.includes(t)));
      if (ui.dtype && !present.has(ui.dtype)) ui.dtype = null;
      $('#dTypes').innerHTML = `<button type="button" class="all ${ui.dtype ? '' : 'on'}" data-type="">Todos los tipos</button>` +
        types.map(t => { const d = TYPES[t] || [t, '#888', '#fff']; return `<button type="button" data-type="${t}" class="${ui.dtype === t ? 'on' : ''}" style="background:${d[1]};color:${d[2]}">${esc(d[0])}</button>`; }).join('');
      document.querySelectorAll('#dFilter button').forEach(b => b.classList.toggle('on', b.dataset.f === ui.dfilter));
      let rows = dex.list.filter(m => matches(m, ui.dq) &&
        (!ui.dtype || m.types.includes(ui.dtype))
      ).map(m => ({ m, ev: evaluate(dex, m, total) }));
      if (ui.dfilter === 'ok') rows = rows.filter(r => r.ev.ok);
      if (ui.dfilter === 'no') rows = rows.filter(r => !r.ev.ok);
      rows.sort({
        dex: (a, b) => a.m.dex - b.m.dex || a.m.key.localeCompare(b.m.key),
        'bst-desc': (a, b) => b.m.bst - a.m.bst || a.m.dex - b.m.dex,
        'bst-asc': (a, b) => a.m.bst - b.m.bst || a.m.dex - b.m.dex,
        name: (a, b) => a.m.name.localeCompare(b.m.name, 'es')
      }[ui.dsort]);
      const game = getGame(state.gameId);
      $('#dTitle').textContent = `Pokédex · ${game.name}`;
      $('#dGrid').innerHTML = rows.length ? rows.slice(0, ui.shown).map(r => monLink(r.m, r.ev)).join('') : '<p class="empty-list">Ningún Pokémon coincide.</p>';
      const more = $('#dMore'); more.hidden = rows.length <= ui.shown; more.textContent = `Mostrar más (${rows.length - ui.shown} restantes)`;
      this.count = rows.length;
      $('#dTitle').textContent += ` · ${rows.length} Pokémon, ${rows.filter(r => r.ev.ok).length} capturables`;
    },
    input(e) {
      if (e.target.id === 'dq') { ui.dq = e.target.value; ui.shown = PAGE; this.update(); }
    },
    change(e) {
      if (e.target.id === 'dSort') { ui.dsort = e.target.value; ui.shown = PAGE; this.update(); }
    },
    click(e) {
      const t = e.target.closest('[data-type]'); if (t) { ui.dtype = t.dataset.type || null; ui.shown = PAGE; return this.update(); }
      const f = e.target.closest('#dFilter [data-f]'); if (f) { ui.dfilter = f.dataset.f; ui.shown = PAGE; return this.update(); }
      if (e.target.id === 'dMore') { ui.shown += PAGE * 2; this.update(); }
    }
  };

  views.pokemon = {
    html: key => {
      const dex = curDex(); const m = dex.byKey.get(key);
      if (!m) return `<a class="back" href="#/pokedex">← Pokédex</a><div class="placeholder">Ese Pokémon no está en la Pokédex de «${esc(getGame(state.gameId).name)}».</div>`;
      return `<a class="back" href="#/pokedex">← Volver a la Pokédex</a>${entryHtml(dex, m, true)}`;
    },
    update() { route(true); }
  };

  views.equipo = {
    html: () => {
      const dex = curDex(); const keys = teamKeys().filter(k => dex.byKey.has(k));
      if (!keys.length) return '<div class="view-head"><h2>Mi equipo</h2></div><div class="placeholder">Aún no has añadido capturas en este juego. Búscalas en el <a href="#/validador">Validador</a> o la <a href="#/pokedex">Pokédex</a> y pulsa «Añadir a mi equipo».</div>';
      const total = keys.reduce((a, k) => a + dex.byKey.get(k).bst, 0);
      const over = state.budget != null && total > state.budget;
      const types = {}; keys.forEach(k => dex.byKey.get(k).types.forEach(t => { types[t] = (types[t] || 0) + 1; }));
      return `<div class="view-head"><h2>Mi equipo · ${esc(getGame(state.gameId).name)}</h2></div>
        <div class="panel two">
          <div><h2>BST total</h2><div class="bignum" style="${over ? 'color:var(--no)' : ''}">${total}${state.budget != null ? ` <small style="font-size:1rem;color:var(--muted)">/ ${state.budget}</small>` : ''}</div>
            <p class="hint">${keys.length} Pokémon · media ${Math.round(total / keys.length)}${over ? ' · ⚠ por encima del presupuesto' : ''}</p></div>
          <div><h2>Tipos del equipo</h2><div class="types">${Object.entries(types).map(([t, n]) => { const d = TYPES[t] || [t, '#888', '#fff']; return `<span class="t" style="background:${d[1]};color:${d[2]}">${esc(d[0])}${n > 1 ? ' ×' + n : ''}</span>`; }).join('')}</div></div>
        </div>
        <div class="teamgrid">${keys.map(k => { const m = dex.byKey.get(k); return `<div class="tcard">${spr(m)}<div><a href="#/pokemon/${encodeURIComponent(k)}">${esc(m.name)}</a>${typeTags(m.types)}<small>BST ${m.bst}</small></div><button class="x" type="button" data-rm="${esc(k)}" aria-label="Quitar ${esc(m.name)}">×</button></div>`; }).join('')}</div>
        <div><button type="button" class="ghost small danger" data-clear>Vaciar equipo</button></div>`;
    },
    click(e) {
      const rm = e.target.closest('[data-rm]');
      if (rm) { state.team[state.gameId] = teamKeys().filter(k => k !== rm.dataset.rm); persist(); route(true); }
      if (e.target.closest('[data-clear]') && confirm('¿Vaciar el equipo de este juego?')) { state.team[state.gameId] = []; persist(); route(true); }
    }
  };

  views.reglas = {
    html: () => {
      const game = getGame(state.gameId); const dex = curDex();
      return `<div class="view-head"><h2>Reglas y juego</h2></div>
      <div class="two">
        <section class="panel">
          <h2>Reglas del locke</h2>
          <div class="field"><span>BST máximo permitido</span>
            <div class="stepper">
              <button type="button" data-step="-50">−50</button><button type="button" data-step="-10">−10</button>
              <input id="maxIn" type="number" inputmode="numeric" min="0" max="800" step="5" aria-label="BST máximo">
              <button type="button" data-step="10">+10</button><button type="button" data-step="50">+50</button>
            </div>
            <div class="chips" id="presets">${PRESETS.map(p => `<button type="button" data-p="${p}">${p}</button>`).join('')}</div>
          </div>
          <label class="field"><span>BST mínimo <small>(opcional)</small></span><input id="minIn" type="number" inputmode="numeric" min="0" max="800" placeholder="Sin mínimo"></label>
          <fieldset class="field"><legend>Qué BST se compara con el límite</legend>
            <label class="radio"><input type="radio" name="mode" value="self"><span>El del Pokémon tal cual lo encuentras</span></label>
            <label class="radio"><input type="radio" name="mode" value="final"><span>El de su evolución más fuerte</span></label>
          </fieldset>
          <label class="field"><span>Presupuesto BST del equipo <small>(opcional, suma de capturas)</small></span><input id="budgetIn" type="number" inputmode="numeric" min="0" placeholder="Sin presupuesto"></label>
        </section>
        <section class="panel">
          <h2>Juego</h2>
          <p><b>${esc(game.name)}</b></p>
          <p class="hint" style="margin-top:4px">${game.source === 'pokeapi' ? `Estadísticas y tipos de la generación ${GEN_ROMAN[game.gen]}${game.gen === 1 ? ' (Especial único)' : ''}.` : esc(game.note || '')} ${dex.list.length} Pokémon disponibles.</p>
          ${game.source === 'pokeapi' ? '<label class="check"><input type="checkbox" id="showAll"><span>Mostrar también Pokémon fuera de la Pokédex del juego <small>(intercambios, Pokédex nacional…)</small></span></label>' : ''}
          <div class="row">
            <label class="btn ghost small" for="fileIn">Cargar pokemon.txt propio</label>
            <input id="fileIn" type="file" accept=".txt,text/plain" hidden>
            ${game.source === 'custom' ? '<button id="delCustom" class="ghost small danger" type="button">Eliminar este juego</button>' : ''}
          </div>
          <p class="hint" style="margin-top:12px">Los juegos de Pokémon Essentials (como Añil) se leen de su <code>pokemon.txt</code>; el archivo cargado se guarda solo en tu navegador.</p>
        </section>
      </div>`;
    },
    mount() { this.sync(); },
    sync() {
      $('#maxIn').value = state.max == null ? '' : state.max;
      $('#minIn').value = state.min == null ? '' : state.min;
      $('#budgetIn').value = state.budget == null ? '' : state.budget;
      const sa = $('#showAll'); if (sa) sa.checked = state.showAll;
      document.querySelectorAll('input[name=mode]').forEach(r => { r.checked = r.value === state.mode; });
      document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', +b.dataset.p === state.max));
    },
    input(e) {
      if (e.target.id === 'maxIn') state.max = numOrNull(e.target.value);
      else if (e.target.id === 'minIn') state.min = numOrNull(e.target.value);
      else if (e.target.id === 'budgetIn') state.budget = numOrNull(e.target.value);
      else return;
      persist(); document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', +b.dataset.p === state.max));
    },
    change(e) {
      if (e.target.name === 'mode') { state.mode = e.target.value; dexCache && dexCache.bestCache.clear(); persist(); }
      else if (e.target.id === 'showAll') { state.showAll = e.target.checked; dexCache = null; ui.selected = null; persist(); route(true); }
      else if (e.target.id === 'fileIn') this.upload(e.target);
    },
    click(e) {
      const st = e.target.closest('[data-step]'); if (st) { state.max = Math.max(0, (state.max || 0) + (+st.dataset.step)); persist(); this.sync(); }
      const pr = e.target.closest('[data-p]'); if (pr) { state.max = +pr.dataset.p; persist(); this.sync(); }
      if (e.target.id === 'delCustom') {
        const g = getGame(state.gameId);
        if (g.source === 'custom' && confirm(`¿Eliminar «${g.name}» de tu navegador?`)) {
          delete state.custom[g.id]; delete state.team[g.id]; state.gameId = defaults.gameId; dexCache = null; ui.selected = null; persist(); renderGameSelect(); route(true);
        }
      }
    },
    async upload(input) {
      const f = input.files[0]; input.value = ''; if (!f) return;
      const pokemon = window.Essentials.parse(await f.text());
      if (!pokemon.length) { alert('No se encontraron Pokémon con BaseStats en ese archivo. ¿Es un pokemon.txt de Pokémon Essentials?'); return; }
      const name = (prompt('Nombre para este juego:', f.name.replace(/\.[^.]+$/, '')) || '').trim(); if (!name) return;
      const id = 'custom-' + Date.now().toString(36);
      state.custom[id] = { id, name, pokemon }; state.gameId = id; ui.selected = null; dexCache = null;
      persist(); renderGameSelect(); route(true);
    }
  };

  // ---------- router ----------
  let current = null;
  function parseHash() {
    const h = decodeURIComponent((location.hash || '#/validador').replace(/^#\/?/, ''));
    const [name, ...rest] = h.split('/');
    return { name: views[name] ? name : 'validador', arg: rest.join('/') };
  }
  function route(keepScroll) {
    const { name, arg } = parseHash();
    const v = views[name]; current = v;
    view.innerHTML = v.html(arg);
    if (v.mount) v.mount(arg);
    const tab = name === 'pokemon' ? 'pokedex' : name;
    document.querySelectorAll('#tabs a').forEach(a => a.toggleAttribute('aria-current', false) || (a.dataset.tab === tab && a.setAttribute('aria-current', 'page')));
    const n = teamKeys().length; $('#teamCount').textContent = n ? String(n) : '';
    const m = { validador: 'Validador', pokedex: 'Pokédex', pokemon: 'Ficha', equipo: 'Equipo', reglas: 'Reglas' }[name];
    document.title = `${m} · Pokédex BST para Lockes`;
    if (!keepScroll) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => route());

  // delegación de eventos en la vista
  ['input', 'change', 'click', 'keydown'].forEach(type => view.addEventListener(type, e => {
    if (type === 'click') {
      const add = e.target.closest('[data-add]');
      if (add && !add.disabled) {
        const t = teamKeys(); if (!t.includes(add.dataset.add)) t.push(add.dataset.add); persist();
        if (current === views.validador) { views.validador.update(); $('#teamCount').textContent = String(t.length); } else route(true);
        return;
      }
    }
    if (current && current[type]) current[type](e);
  }));

  // ---------- cabecera ----------
  function renderGameSelect() {
    const button = $('#gameSel');
    const menu = $('#gameMenu');
    const games = allGames();
    const selected = getGame(state.gameId);
    button.innerHTML = `${gameIcon(selected)}<span>${esc(selected.name)}</span><b aria-hidden="true">⌄</b>`;
    const query = norm(ui.gameQ.trim());
    const filtered = games.filter(g => !query || norm(g.name).includes(query) || norm(g.id).includes(query));
    let html = '';
    for (let g = 1; g <= 9; g++) {
      const items = filtered.filter(x => x.source === 'pokeapi' && x.gen === g);
      if (items.length) html += `<div class="game-group-label">Generación ${GEN_ROMAN[g]}</div>${items.map(x => `<button type="button" role="option" class="game-option ${x.id === selected.id ? 'selected' : ''}" aria-selected="${x.id === selected.id}" data-game="${esc(x.id)}">${gameIcon(x)}<span>${esc(x.name)}</span></button>`).join('')}`;
    }
    const fan = filtered.filter(x => x.source === 'essentials');
    if (fan.length) html += `<div class="game-group-label">Fan games (Essentials)</div>${fan.map(x => `<button type="button" role="option" class="game-option ${x.id === selected.id ? 'selected' : ''}" aria-selected="${x.id === selected.id}" data-game="${esc(x.id)}">${gameIcon(x)}<span>${esc(x.name)}</span></button>`).join('')}`;
    const cu = filtered.filter(x => x.source === 'custom');
    if (cu.length) html += `<div class="game-group-label">Mis juegos cargados</div>${cu.map(x => `<button type="button" role="option" class="game-option ${x.id === selected.id ? 'selected' : ''}" aria-selected="${x.id === selected.id}" data-game="${esc(x.id)}">${gameIcon(x)}<span>${esc(x.name)}</span></button>`).join('')}`;
    menu.innerHTML = `<label class="game-search"><span class="sr">Buscar juego</span><input id="gameSearch" type="search" placeholder="Buscar juego…" autocomplete="off" value="${esc(ui.gameQ)}"></label>${html || '<p class="game-empty">No se encontraron juegos.</p>'}`;
  }
  function chooseGame(id) {
    state.gameId = id; ui.gameQ = ''; ui.selected = null; ui.shown = PAGE; ui.dtype = null; dexCache = null; persist();
    $('#gameMenu').hidden = true; $('#gameSel').setAttribute('aria-expanded', 'false');
    renderGameSelect();
    if (parseHash().name === 'pokemon') { const k = parseHash().arg; if (!curDex().byKey.has(k)) location.hash = '#/pokedex'; else route(true); } else route(true);
  }
  $('#gameSel').addEventListener('click', () => {
    const menu = $('#gameMenu');
    menu.hidden = !menu.hidden;
    $('#gameSel').setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) {
      const search = $('#gameSearch');
      search.focus();
      search.select();
    }
  });
  $('#gameMenu').addEventListener('input', e => {
    if (e.target.id !== 'gameSearch') return;
    ui.gameQ = e.target.value;
    renderGameSelect();
    const search = $('#gameSearch');
    search.focus();
    search.setSelectionRange(ui.gameQ.length, ui.gameQ.length);
  });
  $('#gameMenu').addEventListener('click', e => {
    const option = e.target.closest('[data-game]');
    if (option) chooseGame(option.dataset.game);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.gamepick')) {
      $('#gameMenu').hidden = true;
      $('#gameSel').setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('error', e => { // sprite no disponible -> "?"
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('pokemon-sprite') && !t.dataset.spriteHandled) {
      t.dataset.spriteHandled = '1';
      const redir = t.dataset.redir;
      fetch(redir).then(r => r.ok ? r.text() : '').then(text => {
        const target = text.trim();
        let id = /^\d+$/.test(target) ? target : null;
        if (!id && target) {
          const normalized = target.toLowerCase().replace(/[^a-z0-9]+/g, '');
          const p = DATA.pokeapi.pokemon.find(x => x.key === target.toLowerCase())
            || DATA.pokeapi.pokemon.find(x => x.key.replace(/[^a-z0-9]+/g, '') === normalized);
          if (p) id = String(p.id);
        }
        if (id) {
          t.src = `${SPRITE}${id}.png`;
        } else if (t.dataset.pokeSprite) {
          t.src = `${SPRITE}${t.dataset.pokeSprite}.png`;
        } else {
          const s = document.createElement('span');
          s.className = 'nospr';
          s.textContent = '?';
          s.setAttribute('aria-hidden', 'true');
          t.replaceWith(s);
        }
      }).catch(() => {
        if (t.dataset.pokeSprite) {
          t.src = `${SPRITE}${t.dataset.pokeSprite}.png`;
        } else {
          const s = document.createElement('span');
          s.className = 'nospr';
          s.textContent = '?';
          s.setAttribute('aria-hidden', 'true');
          t.replaceWith(s);
        }
      });
      return;
    }
    if (t && t.tagName === 'IMG') {
      const s = document.createElement('span');
      s.className = t.classList.contains('game-icon') ? 'game-icon-fallback' : 'nospr';
      s.textContent = t.dataset.fallback || '?';
      s.setAttribute('aria-hidden', 'true');
      t.replaceWith(s);
    }
  }, true);

  function applyTheme() { if (state.theme) document.documentElement.dataset.theme = state.theme; else delete document.documentElement.dataset.theme; }
  $('#themeBtn').addEventListener('click', () => {
    const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = dark ? 'light' : 'dark'; applyTheme(); persist();
  });

  applyTheme();
  renderGameSelect();
  route();
})();
