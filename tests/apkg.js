/* =====================================================================
 * TESTES DO ARQUIVO EXPORTADO (.apkg)
 * O que sai daqui e' o que o AnkiDroid mostra. Cobrem tres coisas que
 * so' apareciam depois de importar no celular:
 *   A — o alinhamento vai declarado, nao herdado
 *   B — conceitos e paragrafos saem separados
 *   C — o guid nao depende da apresentacao (reimportar atualiza)
 * ===================================================================== */
const fs = require("fs");
const path = require("path");

function carregar() {
  /* anki.js usa itensDaLista, que mora no parser — carrega os dois juntos,
   * que e' como o navegador tambem os enxerga */
  const src = fs.readFileSync(path.join(__dirname, "..", "docs", "parser.js"), "utf8")
    + fs.readFileSync(path.join(__dirname, "..", "docs", "anki.js"), "utf8");
  return new Function("window", src +
    "; return {modelosParaEstilo,maisEmBlocos,linhasEmBlocos,guidDoCartao,ESTILOS," +
    "apkgAgruparDecks,stableDeckId};")({});
}

function testes() {
  const A = carregar();
  const f = [];
  const ok = (c, m) => { if (!c) f.push(m); };

  for (const est of Object.keys(A.ESTILOS)) {
    const m = A.modelosParaEstilo(est, "justify");
    /* sem os comentarios: o proprio comentario que EXPLICA a regra cita
     * ".card{text-align:center}" e faria o teste acusar falha sozinho */
    const css = (m[Object.keys(m)[0]].css || "").replace(/\/\*[\s\S]*?\*\//g, "");
    ok(/\.card,\.eac\{text-align:left\}/.test(css),
       `A1 ${est}: o CSS nao declara o alinhamento do invólucro`);
    ok(!/\.card\s*\{[^}]*text-align:\s*center/.test(css),
       `A2 ${est}: ".card" ainda centraliza tudo`);
  }

  const mais = A.maisEmBlocos("Achado — constatado<br>Criterio — devido<br>---<br>Dica — prova");
  ok((mais.match(/mais-item/g) || []).length === 3, "B1 conceitos nao viraram 3 blocos");
  ok(/<hr class="mais-sep">/.test(mais), 'B2 o "+ ---" nao virou traço forte');
  ok(/<b>Achado<\/b>/.test(mais), "B3 o termo nao ficou em negrito");
  const cssE = A.modelosParaEstilo("esquema", "justify");
  const css = cssE[Object.keys(cssE)[0]].css;
  ok(/\.mais-item \+ \.mais-item\{border-top/.test(css),
     "B4 falta a linha fina entre um conceito e o seguinte");
  ok(/\.par \+ \.par\{border-top/.test(css),
     "B5 falta a separacao entre paragrafos da resposta");

  ok(A.linhasEmBlocos("uma linha") === "uma linha",
     "B6 linha unica nao devia virar bloco");
  ok((A.linhasEmBlocos("a<br>b<br>c").match(/class="par"/g) || []).length === 3,
     "B7 tres linhas deviam virar tres paragrafos");

  /* C — a regressao cara: reimportar duplicando o baralho inteiro */
  const c = { front: "P", back: "R", more: "T — x", tags: [] };
  ok(A.guidDoCartao(c) === A.guidDoCartao({ front: "P", back: "R", more: "T — x" }),
     "C1 mesmo conteudo devia dar o mesmo guid");
  ok(A.guidDoCartao(c) !== A.guidDoCartao({ front: "P", back: "OUTRA", more: "T — x" }),
     "C2 conteudo diferente devia dar guid diferente");
  ok(!/</.test(JSON.stringify([c.front, c.back, c.more])),
     "C3 o guid tem de sair do texto do usuario, sem HTML");

  /* D — lista escrita com " / " vira lista desenhada, e o que NAO e' lista
   * continua inteiro. O segundo caso e' o que protege "R$ 40 / mes". */
  const lista = A.linhasEmBlocos("I - o achado / II - o criterio / III - a prova");
  ok((lista.match(/class="item"/g) || []).length === 3,
     "D1 a enumeracao nao virou tres itens");
  ok(A.linhasEmBlocos("R$ 40 / mes") === "R$ 40 / mes", "D2 quebrou um preco por mes");
  ok(A.linhasEmBlocos("entrada / saida") === "entrada / saida", "D3 quebrou um par de palavras");
  ok(/\.item \+ \.item\{border-top/.test(css), "D4 falta a regua entre itens da lista");

  /* E — apkgAgruparDecks: um subbaralho por titulo, dentro do mesmo pacote.
   * O RELATO REAL: exportar um lote com cartoes de disciplinas diferentes
   * gerava sempre UM baralho so, achatado — mesmo cada cartao ja levando
   * seu proprio titulo (a "manchete" que aparece no verso, no Anki). */
  {
    const semTitulo = [
      { front: "a", back: "1", tags: [] },
      { front: "b", back: "2", tags: [] },
    ];
    const g1 = A.apkgAgruparDecks(semTitulo, "Meu Baralho", "");
    ok(Object.keys(g1.decks).length === 1,
       "E1 sem titulo nenhum, virou mais de um baralho: "
       + JSON.stringify(Object.keys(g1.decks)));
    ok(g1.decks[String(g1.idPorCartao[0])].name === "Meu Baralho",
       "E1b sem titulo, o baralho nao ficou com o nome puro: "
       + g1.decks[String(g1.idPorCartao[0])].name);
    ok(g1.idPorCartao[0] === g1.idPorCartao[1],
       "E1c dois cartoes sem titulo foram parar em baralhos diferentes");

    const doisTitulos = [
      { front: "a", back: "1", tags: [], titulo: "Direito Tributário — Princípios" },
      { front: "b", back: "2", tags: [], titulo: "Direito Constitucional — Controle" },
      { front: "c", back: "3", tags: [], titulo: "Direito Tributário — Princípios" },
    ];
    const g2 = A.apkgAgruparDecks(doisTitulos, "ISS Caruaru 2026", "");
    const nomes = Object.values(g2.decks).map((d) => d.name).sort();
    ok(nomes.length === 2, "E2 dois titulos deviam virar dois baralhos: " + nomes.join(" | "));
    ok(nomes.indexOf("ISS Caruaru 2026::Direito Tributário — Princípios") >= 0,
       "E2b o subbaralho de tributário não ficou sob o baralho guarda-chuva: "
       + nomes.join(" | "));
    ok(nomes.indexOf("ISS Caruaru 2026::Direito Constitucional — Controle") >= 0,
       "E2c o subbaralho de constitucional não ficou sob o baralho guarda-chuva: "
       + nomes.join(" | "));
    ok(g2.idPorCartao[0] === g2.idPorCartao[2],
       "E2d os dois cartões de tributário foram parar em baralhos diferentes");
    ok(g2.idPorCartao[0] !== g2.idPorCartao[1],
       "E2e cartões de títulos diferentes foram parar no MESMO baralho");

    /* titulo com "::" embutido: fica com um nivel a mais, sem codigo novo */
    const aninhado = [{ front: "a", back: "1", tags: [],
      titulo: "Direito Tributário::Princípios" }];
    const g3 = A.apkgAgruparDecks(aninhado, "ISS Caruaru 2026", "");
    const nome3 = g3.decks[String(g3.idPorCartao[0])].name;
    ok(nome3 === "ISS Caruaru 2026::Direito Tributário::Princípios",
       "E3 titulo com :: embutido nao virou 3 niveis: " + nome3);

    /* mesmo nome de baralho, gerado de novo, tem de dar o MESMO id — e
     * o mesmo id que stableDeckId(nome) sozinho daria — senao reexportar
     * duplica o baralho no Anki em vez de atualizar */
    const g4 = A.apkgAgruparDecks(doisTitulos, "ISS Caruaru 2026", "");
    ok(g4.idPorCartao[0] === g2.idPorCartao[0],
       "E4 reagrupar o mesmo lote deu um id de baralho diferente — "
       + "reexportar duplicaria em vez de atualizar");
    ok(g4.idPorCartao[0] === A.stableDeckId("ISS Caruaru 2026::Direito Tributário — Princípios"),
       "E4b o id do subbaralho não bate com stableDeckId do mesmo nome");

    /* sem titulo no cartao, mas com "titulo geral" — usa o geral, do
     * mesmo jeito que buildApkg ja usa "c.titulo || titulo" para a
     * manchete do cartao */
    const g5 = A.apkgAgruparDecks(semTitulo, "Meu Baralho", "Geral X");
    ok(g5.decks[String(g5.idPorCartao[0])].name === "Meu Baralho::Geral X",
       "E5 o titulo geral nao foi usado como subbaralho quando o cartao "
       + "nao tem titulo proprio: " + g5.decks[String(g5.idPorCartao[0])].name);
  }

  return f;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "apkg", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\napkg: ${f.length} FALHA(S)\n`
    : "\napkg: alinhamento, blocos e identidade do cartão ok\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
