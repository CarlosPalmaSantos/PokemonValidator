// Genera dist/index.html: un único archivo HTML con CSS, JS y datos incluidos.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const need = ['data/pokeapi.json', 'data/essentials.json'];
for (const f of need) if (!fs.existsSync(path.join(root, f))) { console.error(`Falta ${f}. Ejecuta primero: npm run data`); process.exit(1); }

const data = JSON.stringify({ pokeapi: JSON.parse(read('data/pokeapi.json')), essentials: JSON.parse(read('data/essentials.json')) })
  .replace(/</g, '\\u003c');
const script = read('src/js/essentials.js') + '\n' + read('src/js/app.js');
const safeScript = script.replace(/<\/script/gi, '<\\/script');

// split/join para evitar los patrones especiales de String.replace ($&, $1…)
const html = read('src/index.html')
  .split('/*STYLE*/').join(read('src/css/style.css'))
  .split('/*DATA*/').join(data)
  .split('/*SCRIPT*/').join(safeScript);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
fs.writeFileSync(path.join(root, 'dist/.nojekyll'), '');
const spritesSource = path.join(root, 'sprites');
const spritesDest = path.join(root, 'dist/sprites');
if (fs.existsSync(spritesSource)) fs.cpSync(spritesSource, spritesDest, { recursive: true });
console.log(`dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
