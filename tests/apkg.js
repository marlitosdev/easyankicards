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

/* Um sql.js e um JSZip de mentira, so' para o leitor de .apkg (lerApkg): devolvem o que
 * o banco do Anki devolveria, dependendo do cenario (formato antigo ou novo). */
let CENARIO = "antigo";
class FakeDb {
  exec(sql) {
    const notas = [[1, 100, "Q1?\x1fR1", " t1 "], [2, 100, "Q2?\x1fR2", ""], [3, 100, "Q3?\x1fR3", ""]];
    if (CENARIO === "config") {
      /* pacote novo: nomes dos campos na tabela "fields"; o tipo so' na "config" (que traz a palavra
       * "cloze" ate' no CSS do modelo Basico) */
      if (/SELECT models FROM col|SELECT decks FROM col/.test(sql)) throw new Error("formato novo");
      if (/FROM fields/.test(sql)) return [{ values: [[100, 0, "Frente"], [100, 1, "Verso"], [100, 2, "Saiba mais"], [100, 3, "Título"], [200, 0, "Texto"], [200, 1, "Extra"]] }];
      if (/FROM notetypes/.test(sql)) return [{ values: [[100, new TextEncoder().encode("css .card{} .cloze{color:blue}")], [200, new TextEncoder().encode("cloze model")]] }];
      if (/SELECT id, name FROM decks/.test(sql)) return [{ values: [[1, "Default"], [11, "Raiz\x1fTrib"]] }];
      if (/SELECT id, mid, flds, tags FROM notes/.test(sql)) return [{ values: [[1, 100, "Q1?\x1fR1 resposta\x1fExtra 1\x1fTitulo 1", " t1 "], [2, 200, "O prazo é {{c1::30 dias}}\x1fobs", ""]] }];
      if (/SELECT nid, did FROM cards/.test(sql)) return [{ values: [[1, 11], [2, 11]] }];
      throw new Error("sql inesperado: " + sql);
    }
    if (/SELECT models FROM col/.test(sql)) return [{ values: [[JSON.stringify({ 100: { type: 0, flds: [{ name: "Frente" }, { name: "Verso" }] } })]] }];
    if (/SELECT decks FROM col/.test(sql)) {
      if (CENARIO === "novo") throw new Error("no such column: decks");
      return [{ values: [[JSON.stringify({ 1: { name: "Default" }, 11: { name: "Raiz::Trib::ISS" }, 12: { name: "Raiz::Const" } })]] }];
    }
    if (/SELECT id, name FROM decks/.test(sql)) return [{ values: [[1, "Default"], [11, "Raiz\x1fTrib\x1fISS"], [12, "Raiz\x1fConst"]] }];
    if (/SELECT id, mid, flds, tags FROM notes/.test(sql)) return [{ values: notas }];
    if (/SELECT nid, did FROM cards/.test(sql)) return [{ values: [[1, 11], [1, 12], [2, 12], [3, 1]] }];
    throw new Error("sql inesperado: " + sql);
  }
  close() {}
}
const FakeJSZip = { loadAsync: async () => ({ file: (n) => (n === "collection.anki2" ? { async: async () => new Uint8Array([1]) } : null) }) };

function carregar() {
  /* anki.js usa itensDaLista, que mora no parser — carrega os dois juntos,
   * que e' como o navegador tambem os enxerga */
  const src = fs.readFileSync(path.join(__dirname, "..", "docs", "parser.js"), "utf8")
    + fs.readFileSync(path.join(__dirname, "..", "docs", "anki.js"), "utf8");
  return new Function("window", "JSZip", src +
    "; return {modelosParaEstilo,maisEmBlocos,linhasEmBlocos,guidDoCartao,ESTILOS," +
    "apkgAgruparDecks,stableDeckId,exportTxtString,lerApkg};")({ __sqlPromise: Promise.resolve({ Database: FakeDb }) }, FakeJSZip);
}

async function testes() {
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

  /* F — c.deck: um subbaralho por PASTA do gerenciador, sem mexer na manchete do cartao */
  {
    const cs = [
      { kind: "basic", front: "a", back: "b", tags: [], deck: "Tributário::ISS", titulo: "Trilha X" },
      { kind: "basic", front: "c", back: "d", tags: [], deck: "Tributário::IPTU" },
      { kind: "basic", front: "e", back: "f", tags: [], deck: "Tributário::ISS" },
      { kind: "basic", front: "g", back: "h", tags: [] },
    ];
    const g = A.apkgAgruparDecks(cs, "Meu Pacote", "");
    const nome = (i) => g.decks[String(g.idPorCartao[i])].name;
    ok(nome(0) === "Meu Pacote::Tributário::ISS" && nome(1) === "Meu Pacote::Tributário::IPTU" && nome(3) === "Meu Pacote", `F1 deck por cartao: ${[0, 1, 3].map(nome)}`);
    ok(g.idPorCartao[0] === g.idPorCartao[2] && Object.keys(g.decks).length === 3, "F2 cartoes da mesma pasta dividem o baralho; 3 baralhos no total");
    ok(nome(0) !== "Meu Pacote::Trilha X", "F3 o deck tem precedencia sobre o titulo (que continua so' a manchete)");
    ok(g.idPorCartao[0] === A.stableDeckId("Meu Pacote::Tributário::ISS"), "F4 o id do baralho continua estavel por nome");
    const txt = A.exportTxtString({ cards: cs }, "Meu Pacote").split("\n");
    ok(txt[6].split("\t")[1] === "Meu Pacote::Tributário::ISS" && txt[8].split("\t")[1] === "Meu Pacote::Tributário::ISS" && txt[9].split("\t")[1] === "Meu Pacote", `F5 o .txt tambem leva o baralho de cada cartao: ${txt.slice(6, 10).map((l) => l.split("\t")[1])}`);
  }

  /* G — lerApkg devolve o baralho de cada cartao (o que o import para uma pasta usa) */
  {
    CENARIO = "antigo";
    const r = await A.lerApkg(new ArrayBuffer(1));
    const decks = r.cards.map((c) => c.deck);
    ok(r.cards.length === 3 && decks[0] === "Raiz::Trib::ISS" && decks[1] === "Raiz::Const" && decks[2] === "", `G1 baralho de cada nota (a nota 1 tem cartoes em 2 baralhos: vale o primeiro; 'Default' vira vazio): ${JSON.stringify(decks)}`);
    ok(r.deck === "Raiz::Trib::ISS" && r.cards[0].tags.join() === "t1", "G2 o nome do pacote e as etiquetas continuam como antes");
    CENARIO = "novo";
    const r2 = await A.lerApkg(new ArrayBuffer(1));
    ok(r2.cards.map((c) => c.deck).join("|") === "Raiz::Trib::ISS|Raiz::Const|", `G3 formato novo (tabela decks, nomes com separador de campo): ${r2.cards.map((c) => c.deck)}`);
    CENARIO = "config";
    const r3 = await A.lerApkg(new ArrayBuffer(1));
    ok(r3.cards.length === 2 && r3.cards[0].kind === "basic" && r3.cards[0].back === "R1 resposta", `G4 modelo Basico com a palavra 'cloze' na config continua BASICO e guarda o VERSO: ${JSON.stringify(r3.cards[0])}`);
    ok(r3.cards[0].more === "Extra 1" && r3.cards[0].titulo === "Titulo 1" && r3.cards[0].deck === "Raiz::Trib", "G5 explicacao, titulo e baralho do Basico tambem");
    ok(r3.cards[1].kind === "cloze" && /\{\{c1::30 dias\}\}/.test(r3.cards[1].front) && r3.cards[1].more === "obs", "G6 e a nota que tem lacuna continua sendo lacuna");
    CENARIO = "antigo";
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
