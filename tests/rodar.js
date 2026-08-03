/* =====================================================================
 * TESTES DO EASYANKICARDS
 * =====================================================================
 * Como usar:
 *   node tests/rodar.js            roda tudo
 *   node tests/rodar.js --gravar   grava os números atuais em esperado.json
 *   (no Windows: dois cliques em tests/rodar.bat)
 *
 * COMO ADICIONAR UM CASO NOVO
 * Salve o texto problemático (o que a IA devolveu, o que veio do PDF...)
 * como tests/casos/NN-nome-curto.txt. Só isso: as INVARIANTES já passam a
 * valer para ele. Depois rode "node tests/rodar.js --gravar" para congelar
 * os números do caso — a partir daí, qualquer mudança futura que altere o
 * resultado aparece como falha.
 *
 * DOIS TIPOS DE TESTE
 * 1. INVARIANTES — regras que valem para QUALQUER texto, mesmo os que
 *    ainda não existem. Pegam o bug que ninguém imaginou.
 * 2. ESPERADO — os números de cada caso conhecido (quantos cartões, quantos
 *    avisos...). Pegam a regressão: o bug que já foi corrigido uma vez.
 *
 * MAPA DO ARQUIVO
 *   carregarApp()  - lê docs/i18n.js e docs/parser.js sem navegador
 *   CORRECOES      - as funções de "Corrigir erros" que serão testadas
 *   invariantes()  - as 5 regras que nenhum texto pode quebrar
 *   conferir()     - compara com tests/esperado.json
 *   main()         - roda, imprime e devolve código de saída
 *
 * Além dos casos de texto, roda tests/fumaca.js (o app carrega sem erro num
 * DOM mínimo), tests/tela.js (fluxo de revisão) e tests/parcial.js (prompt
 * de correção parcial e a conferência da colagem de volta).
 * ===================================================================== */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIR_CASOS = path.join(__dirname, "casos");
const ARQ_ESPERADO = path.join(__dirname, "esperado.json");
const GRAVAR = process.argv.includes("--gravar");

/* --------------------------------------------------------------------
 * Carrega os módulos do app em Node. Eles foram escritos para o
 * navegador, então damos um localStorage de mentira e avaliamos os
 * arquivos no mesmo escopo — sem empacotador, sem dependência.
 * ------------------------------------------------------------------ */
function carregarApp() {
  const escopo = {};
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.navigator = { language: "pt-BR" };
  const codigo = ["i18n.js", "parser.js"]
    .map((f) => fs.readFileSync(path.join(RAIZ, "docs", f), "utf8")).join("\n");
  const exportar = "return {parseText,cardToLine,cardToLineBase,resumoTexto,"
    + "detectoresAtivos,montarPromptCorrecao,setLanguage,t,"
    + "removerMarcadoresTexto,corrigirTagsQueSaoTexto,corrigirTituloGrudado,"
    + "corrigirOrfaosExplicacao,corrigirLacunaOpcoesLongas,corrigirMarkdown,"
    + "temTagsNaExplicacao,corrigirTagsNaExplicacao};";
  const api = new Function(codigo + "\n" + exportar)();
  api.setLanguage("pt");
  return api;
}

const app = carregarApp();

/* As correções que o botão "Corrigir erros" pode aplicar. Toda função
 * nova que mexer no texto do usuário deve entrar aqui. */
const CORRECOES = {
  removerMarcadoresTexto: app.removerMarcadoresTexto,
  corrigirTagsQueSaoTexto: app.corrigirTagsQueSaoTexto,
  corrigirTituloGrudado: app.corrigirTituloGrudado,
  corrigirOrfaosExplicacao: app.corrigirOrfaosExplicacao,
  corrigirLacunaOpcoesLongas: app.corrigirLacunaOpcoesLongas,
  corrigirMarkdown: app.corrigirMarkdown,
  corrigirTagsNaExplicacao: app.corrigirTagsNaExplicacao,
};

/* --------------------------------------------------------------------
 * INVARIANTES — valem para qualquer texto.
 * Cada uma nasceu de um bug real; a referência está no comentário.
 * ------------------------------------------------------------------ */
function invariantes(nome, texto) {
  const falhas = [];

  // I1. Ler um texto nunca pode quebrar o aplicativo.
  let base;
  try {
    base = app.resumoTexto(texto);
  } catch (e) {
    falhas.push("I1 leitura lançou erro: " + e.message);
    return falhas;
  }

  for (const [fn, corrigir] of Object.entries(CORRECOES)) {
    let saida;
    try {
      saida = corrigir(texto);
    } catch (e) {
      falhas.push("I0 " + fn + " lançou erro: " + e.message);
      continue;
    }
    const dep = app.resumoTexto(saida);

    // I2. Nenhuma correção pode apagar cartões.   (bug v8.19: "usei
    //     corrigir várias vezes e sumiram vários cartões")
    if (dep.cartoes < base.cartoes)
      falhas.push(`I2 ${fn} perdeu cartões: ${base.cartoes} -> ${dep.cartoes}`);

    // I3. Nenhuma correção pode apagar o "Saiba mais".  (bug v8.22: o
    //     botão removia o "*" das explicações e o conteúdo virava lixo)
    if (dep.saibaMais < base.saibaMais)
      falhas.push(`I3 ${fn} perdeu Saiba mais: ${base.saibaMais} -> ${dep.saibaMais}`);

    // I3b. Nenhuma correção pode apagar etiquetas.  (bug v8.23: tags com
    //      mais de 60 caracteres eram confundidas com texto e viravam "+")
    if (dep.tags < base.tags)
      falhas.push(`I6 ${fn} perdeu etiquetas: ${base.tags} -> ${dep.tags}`);

    // I4. Corrigir duas vezes tem de dar no mesmo que corrigir uma vez.
    //     Sem isso, cada clique repetido come um pedaço do texto.
    if (corrigir(saida) !== saida)
      falhas.push(`I4 ${fn} não é idempotente (2 cliques ≠ 1 clique)`);
  }

  // I5. Reescrever os cartões no formato do app e ler de novo tem de dar
  //     exatamente os mesmos cartões — o texto é a fonte única da verdade.
  const cartoes = app.parseText(texto, []).cards;
  const reescrito = cartoes.map(app.cardToLine).join("\n\n");
  const devolta = app.parseText(reescrito, []).cards;
  if (devolta.length !== cartoes.length)
    falhas.push(`I5 ida e volta mudou a quantidade: ${cartoes.length} -> ${devolta.length}`);
  else {
    const dif = cartoes.findIndex((c, i) => c.front !== devolta[i].front);
    if (dif >= 0) falhas.push(`I5 ida e volta mudou o cartão ${dif + 1}`);
  }
  return falhas;
}

/* --------------------------------------------------------------------
 * ESPERADO — números congelados de cada caso conhecido.
 * ------------------------------------------------------------------ */
function medir(texto) {
  const r = app.resumoTexto(texto);
  return {
    cartoes: r.cartoes, avisos: r.avisos, suspeitos: r.suspeitos,
    saibaMais: r.saibaMais, titulos: r.titulos, tags: r.tags,
    detectores: app.detectoresAtivos(texto),
  };
}

function conferir(atual, esperado) {
  if (!esperado) return [];
  const falhas = [];
  for (const k of Object.keys(esperado)) {
    const a = JSON.stringify(atual[k]), e = JSON.stringify(esperado[k]);
    if (a !== e) falhas.push(`${k}: esperado ${e}, obtido ${a}`);
  }
  return falhas;
}

/* ------------------------------------------------------------------ */
function main() {
  const arquivos = fs.readdirSync(DIR_CASOS).filter((f) => f.endsWith(".txt")).sort();
  const esperado = fs.existsSync(ARQ_ESPERADO)
    ? JSON.parse(fs.readFileSync(ARQ_ESPERADO, "utf8")) : {};
  const novoEsperado = {};
  let falhasTotal = 0;

  console.log("\nEasyAnkiCards — testes  (" + arquivos.length + " casos)\n");
  for (const arq of arquivos) {
    const texto = fs.readFileSync(path.join(DIR_CASOS, arq), "utf8");
    const atual = medir(texto);
    novoEsperado[arq] = atual;
    const falhas = invariantes(arq, texto).concat(conferir(atual, esperado[arq]));
    falhasTotal += falhas.length;
    const marca = falhas.length ? "FALHOU" : "ok    ";
    console.log(`  ${marca}  ${arq.padEnd(36)} ${atual.cartoes} cartões, `
      + `${atual.avisos} avisos, ${atual.suspeitos} a verificar, ${atual.saibaMais} saiba+`);
    falhas.forEach((f) => console.log("          -> " + f));
  }

  // testes de interface (DOM mínimo): carregamento do app e fluxo de revisão
  const fumaca = require("./fumaca.js").rodar().falhas;
  const tela = require("./tela.js").testes();
  const parcial = require("./parcial.js").testes();
  const extras = [["carregamento do app", fumaca], ["fluxo de revisão", tela],
                  ["prompt e colagem parcial", parcial]];
  console.log("");
  extras.forEach(([nome, fs2]) => {
    falhasTotal += fs2.length;
    console.log(`  ${fs2.length ? "FALHOU" : "ok    "}  ${nome}`);
    fs2.forEach((f) => console.log("          -> " + f));
  });

  if (GRAVAR) {
    fs.writeFileSync(ARQ_ESPERADO, JSON.stringify(novoEsperado, null, 2) + "\n");
    console.log("\nesperado.json gravado com os números atuais.");
  }

  const novos = arquivos.filter((a) => !esperado[a]);
  if (novos.length && !GRAVAR)
    console.log("\nSem números congelados (rode --gravar): " + novos.join(", "));

  console.log(falhasTotal
    ? `\n${falhasTotal} FALHA(S).\n`
    : `\nTudo certo: ${arquivos.length} casos de texto + interface, invariantes I1-I6.\n`);
  return falhasTotal ? 1 : 0;
}

process.exit(main());
