# Pokédex BST para Lockes

Web estática (un único `index.html`) para comprobar si un Pokémon se puede capturar en tu locke según su BST (suma de estadísticas base), usando **las estadísticas del juego que estés jugando**.

## Secciones
- **Validador**: busca un Pokémon y comprueba si cumple tu regla de BST.
- **Pokédex**: todos los Pokémon del juego elegido, con tipos (por generación), filtro por tipo, por capturable y orden.
- **Ficha**: stats, tipos, veredicto y árbol evolutivo con el método de cada evolución.
- **Mi equipo**: capturas, BST total y tipos del equipo.
- **Reglas**: BST máximo/mínimo, modo de comparación, presupuesto, y carga de `pokemon.txt` propio.

## Qué hace
- **Selector de juego**: 22 juegos oficiales (Rojo/Azul → Escarlata/Púrpura, Leyendas Z-A…) con los stats de su generación (p. ej. Butterfree 305 en Gen I, 385 en Gen III–V, 395 desde Gen VI). En Gen I el Especial cuenta una sola vez.
- **Fan games** a partir de su `pokemon.txt` de Pokémon Essentials. Incluido: **Pokémon Añil** (con fakemon). También puedes cargar tu propio `pokemon.txt` desde la propia web (se guarda en tu navegador).
- **Reglas**: BST máximo, BST mínimo opcional, comparar el Pokémon tal cual o su evolución más fuerte, y presupuesto de BST del equipo opcional.
- Veredicto inmediato, línea evolutiva, lista filtrable (capturables / no capturables) y seguimiento del equipo.

## Datos
- **PokeAPI** vía su mirror oficial [PokeAPI/api-data](https://github.com/PokeAPI/api-data): stats actuales + `past_stats` (cambios por generación), Pokédex de cada juego, nombres en español y formas regionales (Alola, Galar, Hisui, Paldea).
- **Essentials**: se lee `BaseStats`, `Types`, `Name` y `Evolutions` del `pokemon.txt`.
- **Formas de Essentials**: el archivo `formsFile` definido en `games.config.json` añade formas regionales, por objeto/cambio y gimmick al juego.

## Uso
```bash
npm run data      # (opcional) regenera data/*.json desde PokeAPI y essentials/*.txt
npm run build     # genera dist/index.html (autocontenido: CSS + JS + datos)
```
Abre `dist/index.html` directamente en el navegador. No hay dependencias npm (solo Node ≥ 18).

## Publicar en GitHub Pages
1. Sube el repo a GitHub (rama `main`).
2. En *Settings → Pages* elige **Source: GitHub Actions**.
3. El workflow `.github/workflows/pages.yml` ejecuta `npm run build` y publica `dist/` en cada push.

## Añadir otro fan game de Essentials
1. Copia su `pokemon.txt` a `essentials/mijuego.txt`.
2. Añade una entrada en `games.config.json` (`id`, `name`, `file`; `nationalLimit` = nº de Pokémon que siguen el orden de la Pokédex nacional, para los sprites; el resto se muestran como fakemon).
3. `npm run data:essentials && npm run build`.
   Puedes colocar el icono del juego en `sprites/<id>/_icon.png`; el generador lo copiará a `dist/sprites/<id>/_icon.png`.
   Para los Pokémon sin sprite oficial, coloca `sprites/<id>/<nameid>.png`. Si debe reutilizar un sprite de PokeAPI, crea `sprites/<id>/<nameid>.redir.txt` con el nombre o ID numérico de PokeAPI.
   Para las formas que ya existen en PokeAPI, su sprite se selecciona automáticamente por especie y forma (por ejemplo, Mega Charizard X/Y, Gigamax o formas regionales). El `.png` local tiene prioridad sobre la redirección y ambas tienen prioridad sobre el sprite automático.

## Notas
- Las Pokédex de los juegos son las regionales de PokeAPI; si en tu partida consigues Pokémon fuera de ella, activa «Mostrar también Pokémon fuera de la Pokédex del juego».
- Los sprites se cargan desde `PokeAPI/sprites`; si no hay conexión se muestra un «?».
