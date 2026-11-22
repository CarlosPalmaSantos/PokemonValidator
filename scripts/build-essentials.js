// Genera data/essentials.json a partir de los pokemon.txt listados en games.config.json
const fs = require('fs');
const path = require('path');
const { parse } = require('../src/js/essentials.js');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'games.config.json'), 'utf8'));
const pokeapi = JSON.parse(fs.readFileSync(path.join(root, 'data/pokeapi.json'), 'utf8'));
const pokeByKey = new Map(pokeapi.pokemon.map(p => [p.key, p]));
const normalizeNameId = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const pokeByNormalizedKey = new Map(pokeapi.pokemon.map(p => [normalizeNameId(p.key), p]));
const findPokeForm = p => {
  if (!p.species) return null;
  const species = normalizeNameId(p.species);
  const candidates = pokeapi.pokemon.filter(x => normalizeNameId(x.species || '') === species);
  if (!candidates.length) return null;

  const exactCandidates = [
    p.key,
    p.region ? `${p.species}-${p.region}` : null,
    p.mechanic ? `${p.species}-${p.mechanic.toLowerCase()}` : null,
    p.mechanic === 'Gigamax' ? `${p.species}-gmax` : null,
    p.mechanic === 'Mega' ? `${p.species}-mega` : null,
    p.mechanic === 'Mega' && /[ -]x(?:$|[^a-z])/i.test(p.formLabel || p.name || '') ? `${p.species}-mega-x` : null,
    p.mechanic === 'Mega' && /[ -]y(?:$|[^a-z])/i.test(p.formLabel || p.name || '') ? `${p.species}-mega-y` : null
  ].filter(Boolean);
  for (const candidate of exactCandidates) {
    const exact = pokeByKey.get(candidate) || pokeByNormalizedKey.get(normalizeNameId(candidate));
    if (exact) return exact;
  }

  if (p.region) {
    const regional = candidates.find(x => normalizeNameId(x.region || '') === normalizeNameId(p.region));
    if (regional) return regional;
  }

  if (p.mechanic) {
    const mechanic = normalizeNameId(p.mechanic);
    const mechanicMatches = candidates.filter(x => normalizeNameId(x.mechanic || '') === mechanic);
    if (mechanicMatches.length === 1) return mechanicMatches[0];
    if (mechanicMatches.length > 1) {
      const label = normalizeNameId(p.formLabel || p.name || '');
      const labelMatch = mechanicMatches.find(x => {
        const xKey = normalizeNameId(x.key);
        const suffix = xKey.slice(species.length);
        return label.includes(normalizeNameId(suffix)) || label.includes(normalizeNameId(x.formLabel || ''));
      });
      if (labelMatch) return labelMatch;
    }
  }

  return null;
};
const out = {};
for (const g of cfg.essentials) {
  const txt = fs.readFileSync(path.join(root, g.file), 'utf8');
  const formsText = g.formsFile ? fs.readFileSync(path.join(root, g.formsFile), 'utf8') : null;
  const pokemon = parse(txt, { nationalLimit: g.nationalLimit, formsText });
  const spritesDir = path.join(root, 'sprites', g.id);
  const spriteFiles = new Map();
  if (fs.existsSync(spritesDir)) {
    fs.readdirSync(spritesDir).forEach(file => {
      const match = file.match(/^(.+)\.(png|redir\.txt)$/i);
      if (!match) return;
      const id = normalizeNameId(match[1]);
      const kind = /^redir/i.test(match[2]) ? 'redir' : 'png';
      const current = spriteFiles.get(id);
      if (!current || kind === 'png') spriteFiles.set(id, { file, kind });
    });
  }
  pokemon.forEach(p => {
    const nameIds = [p.key, p.species].filter(Boolean).map(normalizeNameId);
    const entry = nameIds.map(id => spriteFiles.get(id)).find(Boolean);
    if (entry && entry.kind === 'png') {
      p.spriteSrc = `sprites/${encodeURIComponent(g.id)}/${encodeURIComponent(entry.file)}`;
      return;
    }
    if (entry && entry.kind === 'redir') {
      const redir = fs.readFileSync(path.join(spritesDir, entry.file), 'utf8').trim();
      if (/^\d+$/.test(redir)) {
        p.spriteId = Number(redir);
        p.spriteRedirectId = Number(redir);
      } else {
        const target = pokeByKey.get(redir.toLowerCase()) || pokeByNormalizedKey.get(normalizeNameId(redir));
        if (target) {
          p.spriteId = target.id;
          p.spriteRedirectId = target.id;
        }
      }
      if (p.spriteRedirectId) return;
    }
    const form = findPokeForm(p);
    if (form) {
      p.spriteId = form.id;
      p.spriteRedirectId = form.id;
    }
  });
  out[g.id] = { id: g.id, name: g.name, note: g.note || '', pokemon };
  console.log(`${g.name}: ${pokemon.length} Pokémon`);
}
fs.writeFileSync(path.join(root, 'data/essentials.json'), JSON.stringify(out));
