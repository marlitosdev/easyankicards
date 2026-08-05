/* =====================================================================
 * ESTRUTURA DO HTML
 * Uma tag fechada a mais ou a menos não quebra nada visivelmente: o
 * navegador conserta à sua maneira, e o resultado é um pedaço da tela
 * aparecendo na coluna errada. Foi o que aconteceu na v8.31 — um
 * "</div>" sobrando fechou a coluna direita cedo, e a prévia dos cartões
 * foi parar embaixo do painel esquerdo.
 * Nem o "node --check" nem o teste de fumaça pegam isso: o app carrega
 * normalmente. Só a contagem das tags pega.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const VAZIAS = new Set(["br", "hr", "img", "input", "meta", "link", "source",
  "area", "base", "col", "embed", "track", "wbr", "path", "circle", "rect"]);

/* Elementos que precisam existir e ficar DENTRO do painel certo.
 * (id do filho, id/classe do ancestral esperado) */
const NINHOS = [
  ["cartoes", "grupo"],
  ["resumo", "grupo"],
  ["barraRevisao", "grupo"],
  ["editor", "grupo"],
  ["sugestoes", "grupo"],
];

function tags(html) {
  // só o <body>: o <head> tem CSS com ">" solto, que confundiria a leitura
  const corpo = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>") + 7);
  const desloc = html.slice(0, html.indexOf("<body")).split("\n").length - 1;
  const lista = [];
  for (const m of corpo.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, fecha, nome, attrs, auto] = m;
    const tag = nome.toLowerCase();
    if (VAZIAS.has(tag) || auto) continue;
    lista.push({
      fecha: !!fecha, tag, attrs,
      linha: corpo.slice(0, m.index).split("\n").length + desloc,
    });
  }
  return lista;
}

function testes() {
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const falhas = [];
  const pilha = [];
  const caminhos = {};        // id -> lista de ancestrais (ids e classes)

  for (const it of tags(html)) {
    if (!it.fecha) {
      const id = (it.attrs.match(/id="([^"]+)"/) || [])[1];
      const cls = (it.attrs.match(/class="([^"]+)"/) || [])[1] || "";
      if (id) caminhos[id] = pilha.map((p) => p.marca).filter(Boolean);
      pilha.push({ tag: it.tag, linha: it.linha, marca: id || cls.split(" ")[0] });
    } else {
      if (!pilha.length) {
        falhas.push(`E1 linha ${it.linha}: </${it.tag}> sem abertura correspondente`);
        continue;
      }
      const topo = pilha.pop();
      if (topo.tag !== it.tag) {
        falhas.push(`E1 linha ${it.linha}: </${it.tag}> está fechando `
          + `<${topo.tag}> aberta na linha ${topo.linha} — falta ou sobra uma tag`);
      }
    }
  }
  pilha.forEach((p) =>
    falhas.push(`E2 <${p.tag}> aberta na linha ${p.linha} nunca foi fechada`));

  // E3: cada elemento continua dentro do painel a que pertence
  NINHOS.forEach(([id, ancestral]) => {
    if (!(id in caminhos)) { falhas.push(`E3 elemento #${id} sumiu do HTML`); return; }
    if (!caminhos[id].includes(ancestral))
      falhas.push(`E3 #${id} saiu de dentro de "${ancestral}" `
        + `(está em: ${caminhos[id].slice(-3).join(" > ") || "raiz"})`);
  });

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const falhas = testes();
  falhas.forEach((f) => console.log("  FALHA  " + f));
  console.log(falhas.length
    ? `\nestrutura: ${falhas.length} FALHA(S)\n`
    : "\nestrutura: HTML balanceado, painéis no lugar\n");
  process.exit(falhas.length ? 1 : 0);
}
