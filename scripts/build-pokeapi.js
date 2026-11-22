// Descarga los datos de PokeAPI (mirror oficial PokeAPI/api-data en GitHub) y genera data/pokeapi.json
// Uso: node scripts/build-pokeapi.js
// (Si estás detrás de un proxy: NODE_USE_ENV_PROXY=1 node scripts/build-pokeapi.js)
const fs = require('fs');
const path = require('path');

const BASE = process.env.POKEAPI_BASE ||
  'https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2';
const CONCURRENCY = 16;

// Juegos principales. `merge` une las Pokédex de los DLC a su juego base.
const GAMES = [
  { id: 'red-blue',    name: 'Rojo / Azul' },
  { id: 'yellow',      name: 'Amarillo' },
  { id: 'gold-silver', name: 'Oro / Plata' },
  { id: 'crystal',     name: 'Cristal' },
  { id: 'ruby-sapphire', name: 'Rubí / Zafiro' },
  { id: 'emerald',     name: 'Esmeralda' },
  { id: 'firered-leafgreen', name: 'Rojo Fuego / Verde Hoja' },
  { id: 'diamond-pearl', name: 'Diamante / Perla' },
  { id: 'platinum',    name: 'Platino' },
  { id: 'heartgold-soulsilver', name: 'HeartGold / SoulSilver' },
  { id: 'black-white', name: 'Negro / Blanco' },
  { id: 'black-2-white-2', name: 'Negro 2 / Blanco 2' },
  { id: 'x-y',         name: 'X / Y' },
  { id: 'omega-ruby-alpha-sapphire', name: 'Rubí Omega / Zafiro Alfa' },
  { id: 'sun-moon',    name: 'Sol / Luna' },
  { id: 'ultra-sun-ultra-moon', name: 'Ultrasol / Ultraluna' },
  { id: 'lets-go-pikachu-lets-go-eevee', name: "Let's Go Pikachu / Eevee" },
  { id: 'sword-shield', name: 'Espada / Escudo', merge: ['the-isle-of-armor', 'the-crown-tundra'] },
  { id: 'brilliant-diamond-shining-pearl', name: 'Diamante Brillante / Perla Reluciente' },
  { id: 'legends-arceus', name: 'Leyendas Pokémon: Arceus' },
  { id: 'scarlet-violet', name: 'Escarlata / Púrpura', merge: ['the-teal-mask', 'the-indigo-disk'] },
  { id: 'legends-za',  name: 'Leyendas Pokémon: Z-A', merge: ['mega-dimension'] }
];

// Formas regionales: región -> juegos donde aparecen
const REGION_GAMES = {
  alola:  ['sun-moon', 'ultra-sun-ultra-moon', 'lets-go-pikachu-lets-go-eevee', 'scarlet-violet'],
  galar:  ['sword-shield', 'legends-arceus', 'scarlet-violet'],
  hisui:  ['legends-arceus', 'scarlet-violet'],
  paldea: ['scarlet-violet']
};
const REGION_ES = { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' };
// Evoluciones que parten de una forma regional concreta y no de la especie base
const FORM_PARENT = {
  perrserker: 'meowth-galar', obstagoon: 'linoone-galar', cursola: 'corsola-galar',
  sirfetchd: 'farfetchd-galar', 'mr-rime': 'mr-mime-galar', runerigus: 'yamask-galar',
  overqwil: 'qwilfish-hisui', sneasler: 'sneasel-hisui', clodsire: 'wooper-paldea'
};
const STAT_IDX = { hp: 0, attack: 1, defense: 2, 'special-attack': 3, 'special-defense': 4, speed: 5, special: 'sp' };
const GEN_NUM = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const genNum = name => GEN_NUM[name.replace('generation-', '')];

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (e) { /* reintenta */ }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  throw new Error('No se pudo descargar ' + url);
}
async function pool(items, fn) {
  const res = new Array(items.length); let n = 0, done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (n < items.length) {
      const i = n++; res[i] = await fn(items[i], i);
      if (++done % 100 === 0) process.stdout.write(`  ${done}/${items.length}\r`);
    }
  }));
  process.stdout.write('\n');
  return res;
}
const spanish = (names) => {
  const f = l => (names.find(n => n.language.name === l) || {}).name;
  return { es: f('es') || f('en'), en: f('en') };
};
const idFromUrl = u => Number(u.split('/').filter(Boolean).pop());

async function main() {
  console.log('Listando especies…');
  const list = await get(`${BASE}/pokemon-species/index.json`);
  const count = list.count;
  const speciesIds = Array.from({ length: count }, (_, i) => i + 1);
  console.log(`Descargando ${count} especies…`);
  const species = await pool(speciesIds, id => get(`${BASE}/pokemon-species/${id}/index.json`));

  // Variedades: la por defecto + todas las formas alternativas conocidas
  const wanted = []; // {speciesIdx, pokeName, region}
  species.forEach((s, i) => {
    for (const v of s.varieties) {
      const nm = v.pokemon.name;
      if (v.is_default) { wanted.push({ s, pokeId: idFromUrl(v.pokemon.url), region: null, formType: null, formLabel: null }); continue; }
      const regionMatch = nm.match(/-(alola|galar|hisui|paldea)(-(combat|blaze|aqua)-breed)?$/);
      const gimmick = /-(mega(?:-[xy])?|gmax|gigantamax|primal|eternamax|ash|complete|origin|sky|zen|crowned|roaming|dusk-mane|dawn-wings|ultra|school|busted|blade|shield|hangry|rider|ice|shadow)$/.test(nm);
      const suffix = nm.startsWith(s.name + '-') ? nm.slice(s.name.length + 1) : nm;
      const FORM_LABELS = {
        attack: 'Ataque', defense: 'Defensa', speed: 'Velocidad', normal: 'Normal',
        'wellspring-mask': 'Máscara Fuente', 'hearthflame-mask': 'Máscara Candente', 'cornerstone-mask': 'Máscara Cimiento',
        'mega-x': 'Mega X', 'mega-y': 'Mega Y', mega: 'Mega',
        gmax: 'Gigamax', gigantamax: 'Gigamax', primal: 'Primigenia', eternamax: 'Eternamax',
        origin: 'Forma Origen', sky: 'Forma Celeste', zen: 'Modo Zen', 'dusk-mane': 'Melena Crepuscular',
        'dawn-wings': 'Alas del Alba', crowned: 'Forma Recorona', roaming: 'Forma Caminante',
        ultra: 'Forma Ultra', school: 'Forma Banco', busted: 'Forma Desatada', blade: 'Forma Filo',
        shield: 'Forma Escudo', hangry: 'Modo Voraz', rider: 'Forma Jinete',
        'low-key': 'Forma Baja', 'midnight': 'Forma Nocturna', 'dusk': 'Forma Crepuscular'
      };
      const formLabel = FORM_LABELS[suffix] || suffix.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      wanted.push({
        s,
        pokeId: idFromUrl(v.pokemon.url),
        region: regionMatch ? regionMatch[1] : null,
        formType: regionMatch ? 'regional' : (gimmick ? 'gimmick' : 'object'),
        formLabel: regionMatch ? null : (formLabel ? formLabel.replace(/\b\w/g, c => c.toUpperCase()) : 'Forma alternativa')
      });
    }
  });
  console.log(`Descargando ${wanted.length} Pokémon (incluye formas regionales)…`);
  const pokes = await pool(wanted, w => get(`${BASE}/pokemon/${w.pokeId}/index.json`));

  const pokemon = wanted.map((w, i) => {
    const p = pokes[i];
    const stats = [0, 0, 0, 0, 0, 0];
    p.stats.forEach(s => { stats[STAT_IDX[s.stat.name]] = s.base_stat; });
    // past_stats: [{generation, stats:[{stat, base_stat}]}] -> [gen, {idx: valor}]
    const past = (p.past_stats || []).map(ps => {
      const ch = {};
      ps.stats.forEach(s => { ch[STAT_IDX[s.stat.name]] = s.base_stat; });
      return [genNum(ps.generation.name), ch];
    }).sort((a, b) => b[0] - a[0]);
    const nm = spanish(w.s.names);
    const slug = p.name;
    const formLabelEs = w.formLabel ? w.formLabel
      .replace(/\bAttack\b/i, 'Ataque')
      .replace(/\bDefense\b/i, 'Defensa')
      .replace(/\bSpeed\b/i, 'Velocidad')
      .replace(/MáS[cC]ara/g, 'Máscara')
      .replace(/\bMega ([xy])\b/i, 'Mega $1')
      : null;
    const alternativeName = w.formType === 'gimmick'
      ? `${nm.es} (${w.formLabel || 'Forma gimmick'})`
      : w.formType === 'object'
        ? `${nm.es} (${formLabelEs || w.formLabel || 'Forma alternativa'})`
        : nm.es;
    const mechanic = /mega/i.test(slug)
      ? 'Mega'
      : /(gmax|gigantamax)/i.test(slug)
        ? 'Gigamax'
        : (w.s.name === 'terapagos' && slug === 'terapagos-stellar')
          ? 'Tera'
          : null;
    return {
      key: slug, id: p.id, dex: w.s.id, species: w.s.name,
      name: w.region ? `${nm.es} (${REGION_ES[w.region]})` : alternativeName,
      nameEn: nm.en, region: w.region, formType: w.formType, mechanic,
      formLabel: w.region ? REGION_ES[w.region] : (w.formType === 'gimmick' ? (w.formLabel || 'Gimmick') : formLabelEs),
      types: p.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
      pastTypes: (p.past_types || []).map(pt => [genNum(pt.generation.name), pt.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name)]).sort((a, b) => b[0] - a[0]),
      stats, past, from: null,
      _chain: w.s.evolution_chain ? idFromUrl(w.s.evolution_chain.url) : null,
      _parent: w.s.evolves_from_species ? w.s.evolves_from_species.name : null
    };
  });

  // Resolver `from` (clave del Pokémon del que evoluciona)
  const bySlug = new Map(pokemon.map(p => [p.key, p]));
  const defaultOf = new Map(pokemon.filter(p => !p.region).map(p => [p.species, p]));
  for (const p of pokemon) {
    if (p.formType && p.formType !== 'regional') continue;
    if (!p._parent) continue;
    let parent = defaultOf.get(p._parent);
    if (p.region) {
      const regional = pokemon.find(q => q.species === p._parent && q.region === p.region);
      if (regional) parent = regional;
    } else if (FORM_PARENT[p.species] && bySlug.get(FORM_PARENT[p.species])) {
      parent = bySlug.get(FORM_PARENT[p.species]);
    }
    p.from = parent ? parent.key : null;
  }
  pokemon.forEach(p => delete p._parent);

  // Métodos de evolución (cadenas evolutivas)
  console.log('Descargando cadenas evolutivas…');
  const chainIds = [...new Set(pokemon.map(p => p._chain).filter(Boolean))];
  const chains = await pool(chainIds, id => get(`${BASE}/evolution-chain/${id}/index.json`));
  const need = { item: new Set(), move: new Set(), location: new Set() };
  const walk = (node, fn) => node.evolves_to.forEach(c => { fn(c); walk(c, fn); });
  chains.forEach(ch => walk(ch.chain, c => c.evolution_details.forEach(d => {
    if (d.item) need.item.add(d.item.name);
    if (d.held_item) need.item.add(d.held_item.name);
    if (d.known_move) need.move.add(d.known_move.name);
    if (d.used_move) need.move.add(d.used_move.name);
    if (d.location) need.location.add(d.location.name);
  })));
  const nameMap = { item: {}, move: {}, location: {} };
  for (const kind of Object.keys(need)) {
    const idx = await get(`${BASE}/${kind}/index.json`);
    const ids = Object.fromEntries(idx.results.map(r => [r.name, idFromUrl(r.url)]));
    await pool([...need[kind]], async n => {
      const d = ids[n] ? await get(`${BASE}/${kind}/${ids[n]}/index.json`) : null;
      const es = d && d.names && d.names.find(x => x.language.name === 'es');
      nameMap[kind][n] = es ? es.name : n.replace(/-/g, ' ');
    });
  }
  const speciesEs = Object.fromEntries(species.map(sp => [sp.name, spanish(sp.names).es]));
  const TYPE_ES = { normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada' };
  const TRIGGER_ES = {
    shed: 'Nivel 20 con un hueco libre en el equipo y una Poké Ball en la mochila', spin: 'Girar sobre sí mismo sosteniendo un dulce',
    'tower-of-darkness': 'Entrenar en la Torre Oscura', 'tower-of-waters': 'Entrenar en la Torre Agua',
    'three-critical-hits': 'Asestar 3 golpes críticos en un mismo combate', 'take-damage': 'Recibir 49+ de daño y pasar bajo el arco de roca',
    'recoil-damage': 'Acumular 294 de daño de retroceso', 'agile-style-move': 'Usar el movimiento en estilo ágil 20 veces',
    'strong-style-move': 'Usar el movimiento en estilo fuerte 20 veces', 'use-move': 'Usar un movimiento 20 veces',
    'gimmighoul-coins': 'Llevar 999 monedas Gimmighoul y subir de nivel', other: 'Condición especial'
  };
  const evoText = d => {
    const t = d.trigger.name; const parts = [];
    if (t === 'spin') return 'Girar sobre sí mismo sosteniendo un dulce (el Confite y la hora determinan la forma)';
    const nm = (k, o) => nameMap[k][o.name] || o.name;
    if (TRIGGER_ES[t]) { parts.push(TRIGGER_ES[t]); if (d.used_move) parts.push(`(${nm('move', d.used_move)})`); }
    else if (t === 'use-item') parts.push(`Usar ${d.item ? nm('item', d.item) : 'un objeto'}`);
    else if (t === 'trade') parts.push('Intercambio');
    else if (t === 'level-up') parts.push(d.min_level ? `Nivel ${d.min_level}` : 'Subir de nivel');
    else parts.push('Condición especial');
    if (t === 'trade' && d.trade_species) parts.push(`por ${speciesEs[d.trade_species.name] || d.trade_species.name}`);
    if (d.held_item) parts.push(`sosteniendo ${nm('item', d.held_item)}`);
    if (d.min_happiness) parts.push(`con felicidad ≥ ${d.min_happiness}`);
    if (d.min_affection) parts.push(`con afecto ≥ ${d.min_affection}`);
    if (d.min_beauty) parts.push(`con belleza ≥ ${d.min_beauty}`);
    if (d.known_move) parts.push(`sabiendo ${nm('move', d.known_move)}`);
    if (d.known_move_type) parts.push(`sabiendo un movimiento de tipo ${TYPE_ES[d.known_move_type.name] || d.known_move_type.name}`);
    if (d.time_of_day) parts.push(d.time_of_day === 'day' ? 'de día' : d.time_of_day === 'night' ? 'de noche' : 'al atardecer');
    if (d.location) parts.push(`en ${nm('location', d.location)}`);
    if (d.gender === 1) parts.push('(hembra)'); if (d.gender === 2) parts.push('(macho)');
    if (d.relative_physical_stats === 1) parts.push('con Ataque > Defensa');
    if (d.relative_physical_stats === -1) parts.push('con Ataque < Defensa');
    if (d.relative_physical_stats === 0) parts.push('con Ataque = Defensa');
    if (d.party_species) parts.push(`con ${speciesEs[d.party_species.name] || d.party_species.name} en el equipo`);
    if (d.party_type) parts.push(`con un Pokémon de tipo ${TYPE_ES[d.party_type.name] || d.party_type.name} en el equipo`);
    if (d.needs_overworld_rain) parts.push('bajo la lluvia');
    if (d.turn_upside_down) parts.push('con la consola boca abajo');
    if (d.min_move_count) parts.push(`tras usar el movimiento ${d.min_move_count} veces`);
    if (d.min_steps) parts.push(`tras ${d.min_steps} pasos`);
    if (d.min_damage_taken) parts.push(`tras recibir ${d.min_damage_taken} de daño`);
    return parts.join(' ');
  };
  const howBySpecies = {};
  chains.forEach(ch => walk(ch.chain, c => {
    // Si existe una vía por objeto (juegos actuales), se prefiere a las vías por lugar antiguas
    let det = c.evolution_details;
    if (det.some(d => d.trigger.name === 'use-item') && det.some(d => d.location)) det = det.filter(d => !d.location);
    const txt = [...new Set(det.map(evoText))];
    howBySpecies[c.species.name] = txt.slice(0, 2).join(' · ') + (txt.length > 2 ? ' · …' : '');
  }));
  pokemon.forEach(p => { p.how = p.from ? (howBySpecies[p.species] || null) : null; delete p._chain; });

  // Juegos
  console.log('Descargando juegos y Pokédex…');
  const vgNames = [...new Set(GAMES.flatMap(g => [g.id, ...(g.merge || [])]))];
  const vgList = await get(`${BASE}/version-group/index.json`);
  const vgId = Object.fromEntries(vgList.results.map(r => [r.name, idFromUrl(r.url)]));
  const vgs = {};
  await pool(vgNames, async n => { vgs[n] = vgId[n] ? await get(`${BASE}/version-group/${vgId[n]}/index.json`) : null; });
  const dexNames = [...new Set(Object.values(vgs).filter(Boolean).flatMap(v => v.pokedexes.map(d => d.name)))];
  const dexList = await get(`${BASE}/pokedex/index.json`);
  const dexId = Object.fromEntries(dexList.results.map(r => [r.name, idFromUrl(r.url)]));
  const dexes = {};
  await pool(dexNames, async n => {
    const d = dexId[n] ? await get(`${BASE}/pokedex/${dexId[n]}/index.json`) : null;
    dexes[n] = d ? d.pokemon_entries.map(e => e.pokemon_species.name) : [];
  });

  const games = GAMES.map(g => {
    const main = vgs[g.id];
    const ids = [g.id, ...(g.merge || [])];
    const set = new Set();
    ids.forEach(id => vgs[id] && vgs[id].pokedexes.forEach(d => dexes[d.name].forEach(s => set.add(s))));
    const gen = main ? genNum(main.generation.name) : 9;
    const regionsOk = r => !r || (REGION_GAMES[r] || []).includes(g.id);
    const megaXY = new Set([
      'venusaur', 'charizard', 'blastoise', 'beedrill', 'pidgeot', 'alakazam', 'slowbro', 'gengar',
      'kangaskhan', 'pinsir', 'gyarados', 'aerodactyl', 'mewtwo', 'ampharos', 'steelix', 'scizor',
      'heracross', 'houndoom', 'tyranitar', 'sceptile', 'blaziken', 'swampert', 'gardevoir', 'mawile',
      'aggron', 'medicham', 'manectric', 'banette', 'absol', 'garchomp', 'lucario', 'abomasnow'
    ]);
    const megaORAS = new Set([
      ...megaXY,
      'sableye', 'sharpedo', 'camerupt', 'altaria', 'glalie', 'salamence', 'metagross',
      'latias', 'latios', 'rayquaza', 'lopunny', 'gallade', 'audino', 'diancie'
    ]);
    const keys = pokemon.filter(p => {
      if (!set.has(p.species)) return false;
      if (p.region) return regionsOk(p.region);
      if (p.mechanic === 'Mega') {
        if (g.id === 'x-y') return megaXY.has(p.species);
        if (g.id === 'omega-ruby-alpha-sapphire') return megaORAS.has(p.species);
        if (g.id === 'legends-za') return true;
        return false;
      }
      if (p.mechanic === 'Gigamax') return g.id === 'sword-shield';
      if (p.mechanic === 'Tera') return g.id === 'scarlet-violet';
      if (p.formType === 'gimmick') return false;
      return true;
    }).map(p => p.key);
    return { id: g.id, name: g.name, gen, pokedexes: ids.flatMap(id => vgs[id] ? vgs[id].pokedexes.map(d => d.name) : []), available: keys };
  });
  games.forEach(g => console.log(`  ${g.name}: gen ${g.gen}, ${g.available.length} Pokémon`));

  const result = { generatedAt: new Date().toISOString().slice(0, 10), source: 'PokeAPI (PokeAPI/api-data)', games, pokemon };
  fs.writeFileSync(path.join(__dirname, '../data/pokeapi.json'), JSON.stringify(result));
  console.log('OK -> data/pokeapi.json');
}
main().catch(e => { console.error(e); process.exit(1); });
