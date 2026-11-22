/*
 * Parser del formato PBS de Pokémon Essentials (pokemon.txt).
 * Funciona en navegador (window.Essentials) y en Node (module.exports).
 *
 * Orden de BaseStats en Essentials: HP, Ataque, Defensa, Velocidad, At.Esp, Def.Esp.
 * Internamente usamos: HP, Atq, Def, AtqEsp, DefEsp, Vel.
 */
(function (root) {
  'use strict';

  const ITEMS = {
    FIRESTONE: 'Piedra Fuego', WATERSTONE: 'Piedra Agua', THUNDERSTONE: 'Piedra Trueno', LEAFSTONE: 'Piedra Hoja',
    MOONSTONE: 'Piedra Lunar', SUNSTONE: 'Piedra Solar', SHINYSTONE: 'Piedra Día', DUSKSTONE: 'Piedra Noche',
    DAWNSTONE: 'Piedra Alba', ICESTONE: 'Piedra Hielo', METALCOAT: 'Revestimiento Metálico', KINGSROCK: 'Roca del Rey',
    DEEPSEATOOTH: 'Diente Marino', DEEPSEASCALE: 'Escama Marina', DRAGONSCALE: 'Escama Dragón', UPGRADE: 'Mejora',
    DUBIOUSDISC: 'Disco Extraño', PROTECTOR: 'Protector', ELECTIRIZER: 'Electrizador', MAGMARIZER: 'Magmatizador',
    REAPERCLOTH: 'Tela Terrible', RAZORCLAW: 'Garra Afilada', RAZORFANG: 'Colmillo Agudo', PRISMSCALE: 'Escama Bella',
    SACHET: 'Saquito Fragante', WHIPPEDDREAM: 'Nata Montada', BLACKAUGURITE: 'Mineral Negro', PEATBLOCK: 'Bloque de Turba',
    OVALSTONE: 'Piedra Oval', LINKINGCORD: 'Cable Unión', CRACKEDPOT: 'Tetera Rota', CHIPPEDPOT: 'Tetera Rota',
    TARTAPPLE: 'Manzana Ácida', SWEETAPPLE: 'Manzana Dulce', GALARICACUFF: 'Brazal Galanuez', GALARICAWREATH: 'Corona Galanuez',
    AUSPICIOUSARMOR: 'Armadura Auspiciosa', MALICIOUSARMOR: 'Armadura Maldita', SCROLLOFDARKNESS: 'Rollo Sombras', SCROLLOFWATERS: 'Rollo Aguas'
  };
  const item = s => ITEMS[(s || '').toUpperCase()] || (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'un objeto');
  const name = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const regionSuffixes = ['alola', 'galar', 'hisui', 'paldea'];
  const gimmickSuffixes = ['mega', 'megax', 'megay', 'gmax', 'gigantamax', 'primal', 'eternamax', 'origin', 'sky', 'zen', 'crowned', 'roaming'];
  const prettify = s => s
    ? s.replace(/[_-]+/g, ' ').trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : '';

  function formInfo(key, props, baseKeys) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    let base = null;
    let baseNormalized = null;
    for (const candidate of baseKeys) {
      const candidateNormalized = String(candidate).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized !== candidateNormalized && (normalized.startsWith(candidateNormalized) || normalized.endsWith(candidateNormalized))) {
        if (!baseNormalized || candidateNormalized.length > baseNormalized.length) {
          base = candidate;
          baseNormalized = candidateNormalized;
        }
      }
    }
    if (!baseNormalized) {
      const region = regionSuffixes.find(r => normalized.endsWith(r));
      if (region) return {
        base: key.slice(0, -region.length),
        formType: 'regional',
        formLabel: region.charAt(0).toUpperCase() + region.slice(1)
      };
      const gimmick = gimmickSuffixes.find(g => normalized.endsWith(g));
      if (gimmick) return {
        base: key.slice(0, -gimmick.length),
        formType: 'gimmick',
        formLabel: prettify(props.FormName || props['FormName0'] || gimmick)
      };
      return { base: null, formType: null, formLabel: null };
    }
    const suffix = normalized.slice(normalized.indexOf(baseNormalized) + baseNormalized.length);
    const lowerSuffix = suffix.toLowerCase();
    const region = regionSuffixes.find(r => lowerSuffix === r || lowerSuffix.includes(r));
    if (region) return { base, formType: 'regional', formLabel: region.charAt(0).toUpperCase() + region.slice(1) };
    const gimmick = gimmickSuffixes.find(g => lowerSuffix.includes(g));
    if (gimmick) return { base, formType: 'gimmick', formLabel: prettify(props.FormName || props['FormName0'] || lowerSuffix) };
    return { base, formType: 'object', formLabel: prettify(props.FormName || props['FormName0'] || lowerSuffix) };
  }

  function evoText(method, param, nameOf) {
    switch (method) {
      case 'Level': return `Nivel ${param}`;
      case 'LevelMale': return `Nivel ${param} (macho)`;
      case 'LevelFemale': return `Nivel ${param} (hembra)`;
      case 'Item': return `Usar ${item(param)}`;
      case 'ItemFemale': return `Usar ${item(param)} (hembra)`;
      case 'ItemMale': return `Usar ${item(param)} (macho)`;
      case 'Trade': return 'Intercambio';
      case 'TradeItem': return `Intercambio sosteniendo ${item(param)}`;
      case 'TradeSpecies': return `Intercambio por ${nameOf(param)}`;
      case 'Happiness': return 'Subir de nivel con mucha felicidad';
      case 'HappinessDay': return 'Subir de nivel con mucha felicidad de día';
      case 'HappinessNight': return 'Subir de nivel con mucha felicidad de noche';
      case 'LevelNight': return `Nivel ${param} por la noche`;
      case 'DayHoldItem': return `Subir de nivel de día sosteniendo ${item(param)}`;
      case 'NightHoldItem': return `Subir de nivel de noche sosteniendo ${item(param)}`;
      case 'HoldItem': return `Subir de nivel sosteniendo ${item(param)}`;
      case 'AttackGreater': return `Nivel ${param} con Ataque > Defensa`;
      case 'DefenseGreater': return `Nivel ${param} con Ataque < Defensa`;
      case 'AtkDefEqual': return `Nivel ${param} con Ataque = Defensa`;
      case 'Silcoon': case 'Cascoon': return `Nivel ${param} (según su personalidad)`;
      case 'Ninjask': return `Nivel ${param}`;
      case 'Shedinja': return `Nivel ${param} con hueco en el equipo y una Poké Ball`;
      default: return param ? `${method} ${param}` : method;
    }
  }

  function parse(text, opts) {
    opts = opts || {};
    const nationalLimit = opts.nationalLimit === undefined ? 1025 : opts.nationalLimit;
    const parseSections = source => {
      const entries = [];
      let cur = null;
      for (const raw of (source || '').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line[0] === '#') continue;
        const sec = line.match(/^\[(.+)\]$/);
        if (sec) { cur = { key: sec[1], props: {} }; entries.push(cur); continue; }
        if (!cur) continue;
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        cur.props[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      return entries;
    };
    const entries = parseSections(text);
    const formEntries = parseSections(opts.formsText);

    const out = [];
    const baseKeys = entries.map(e => e.key);
    entries.forEach((e, i) => {
      const p = e.props;
      if (!p.BaseStats) return;
      const b = p.BaseStats.split(',').map(Number);
      if (b.length !== 6 || b.some(isNaN)) return;
      const [hp, atk, def, spe, spa, spd] = b;
      const evos = [];
      if (p.Evolutions) {
        const t = p.Evolutions.split(',');
        for (let k = 0; k + 1 < t.length; k += 3) evos.push({ to: t[k].trim().toLowerCase(), method: (t[k + 1] || '').trim(), param: (t[k + 2] || '').trim() });
      }
      const fi = formInfo(e.key, p, baseKeys);
      const baseEntry = fi.base ? entries.find(x => String(x.key).toLowerCase() === String(fi.base).toLowerCase()) : null;
      const baseIndex = baseEntry ? entries.indexOf(baseEntry) : i;
      const formLabel = fi.formType ? (p.FormName || p['FormName0'] || fi.formLabel) : null;
      out.push({
        key: e.key.toLowerCase(),
        dex: baseIndex + 1,
        name: fi.formType ? `${p.Name || e.key} (${prettify(formLabel)})` : (p.Name || e.key),
        types: (p.Types || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        stats: [hp, atk, def, spa, spd, spe],
        evolvesTo: evos,
        // Los primeros N de la lista siguen el orden de la Pokédex nacional, el resto son fakemon.
        spriteId: baseIndex < nationalLimit ? baseIndex + 1 : null,
        gen: p.Generation ? Number(p.Generation) : null,
        formType: fi.formType,
        formLabel: fi.formType ? prettify(formLabel) : null
      });
    });

    const byBaseKey = new Map(out.map(x => [x.key, x]));
    formEntries.forEach(e => {
      const match = e.key.match(/^(.+),(\d+)$/);
      if (!match) return;
      const speciesKey = match[1].trim().toLowerCase();
      const formIndex = match[2];
      const base = byBaseKey.get(speciesKey);
      if (!base) return;
      const p = e.props;
      const region = p.Region ? p.Region.trim().toLowerCase() : null;
      const gimmick = !!p.MegaStone || /\b(mega|gigamax|gigantamax|primal|eternamax|crowned|zen|origin|ash)\b/i.test(p.FormName || '');
      const formType = region ? 'regional' : (gimmick ? 'gimmick' : 'object');
      const mechanicText = `${p.FormName || ''} ${p.MegaStone || ''}`;
      const mechanic = /\bMega\b/i.test(mechanicText)
        ? 'Mega'
        : /\b(Gigamax|Gigantamax)\b/i.test(mechanicText)
          ? 'Gigamax'
          : (speciesKey === 'terapagos' && formIndex === '2')
            ? 'Tera'
            : null;
      const formLabel = region
        ? (p.FormName || `Forma ${p.Region}`).replace(/^Forma\s+/i, '') || p.Region
        : (p.FormName || `Forma alternativa ${formIndex}`);
      const types = p.Types
        ? p.Types.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : base.types;
      let stats = base.stats;
      if (p.BaseStats) {
        const b = p.BaseStats.split(',').map(Number);
        if (b.length === 6 && !b.some(isNaN)) {
          const [hp, atk, def, spe, spa, spd] = b;
          stats = [hp, atk, def, spa, spd, spe];
        }
      }
      const evos = [];
      if (p.Evolutions) {
        const t = p.Evolutions.split(',');
        for (let k = 0; k + 1 < t.length; k += 3) {
          evos.push({ to: t[k].trim().toLowerCase(), method: (t[k + 1] || '').trim(), param: (t[k + 2] || '').trim() });
        }
      } else if (formType === 'regional' && base.evolvesTo) {
        evos.push(...base.evolvesTo);
      }
      out.push({
        key: `${speciesKey}-form-${formIndex}`,
        dex: base.dex,
        name: `${base.name} (${prettify(formLabel)})`,
        types,
        stats,
        evolvesTo: evos,
        spriteId: base.spriteId,
        gen: p.Generation ? Number(p.Generation) : base.gen,
        formType,
        formLabel: prettify(formLabel),
        mechanic,
        region,
        species: speciesKey,
        from: null,
        how: null
      });
    });

    // Invertimos evolvesTo -> from
    const byKey = new Map(out.map(x => [x.key, x]));
    out.forEach(x => { x.from = null; });
    const nameOf = k => { const m = byKey.get(String(k).toLowerCase()); return m ? m.name : name(k); };
    out.forEach(x => { x.how = null; });
    out.forEach(x => x.evolvesTo.forEach(e => {
      if (x.formType && x.formType !== 'regional') return;
      let ch = byKey.get(e.to);
      if (x.formType === 'regional' && x.region) {
        ch = [...byKey.values()].find(p =>
          p.formType === 'regional' &&
          p.region === x.region &&
          (p.species || p.key) === e.to
        ) || ch;
      }
      if (ch) {
        ch.from = x.key;
        ch.how = evoText(e.method, e.param, nameOf);
      }
    }));
    out.forEach(x => { delete x.evolvesTo; });
    return out;
  }

  const api = { parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Essentials = api;
})(typeof window !== 'undefined' ? window : globalThis);
