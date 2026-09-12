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
 * DOM mínimo), tests/tela.js (fluxo de revisão), tests/parcial.js (prompt de
 * correção parcial e a colagem de volta) e tests/estrutura.js (as tags do
 * HTML fecham na ordem certa e cada painel continua no seu lugar).
 * ===================================================================== */

const fs = require("fs");
const path = require("path");
const { comVigia } = require("./vigia.js");

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
    + "temTagsNaExplicacao,corrigirTagsNaExplicacao,"
    + "temClozeRepetida,corrigirClozeRepetida,"
    + "temEspacosRuins,corrigirEspacos,"
    + "temPromptVazado,corrigirPromptVazado,temMaisRepetido,corrigirMaisRepetido,"
    + "temMaisJunto,corrigirMaisJunto,marcasUnidas};";
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
  corrigirClozeRepetida: app.corrigirClozeRepetida,
  corrigirEspacos: app.corrigirEspacos,
  corrigirMaisJunto: app.corrigirMaisJunto,
  // as duas de LIMPEZA saem das invariantes I2/I3/I6 de propósito:
  // elas existem para remover lixo, então reduzir contagem é o esperado

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
async function main() {
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
  const parcial = await comVigia(Promise.resolve(require("./parcial.js").testes()), "parcial");
  const estrutura = await comVigia(Promise.resolve(require("./estrutura.js").testes()), "estrutura");
  const apkg = await comVigia(Promise.resolve(require("./apkg.js").testes()), "apkg");
  const edital = await comVigia(Promise.resolve(require("./edital.js").testes()), "edital");
  const colagem = await comVigia(Promise.resolve(require("./colagem.js").testes()), "colagem");
  const editais = await comVigia(Promise.resolve(require("./editais.js").testes()), "editais");
  const vinc = await comVigia(Promise.resolve(require("./vinculos.js").testes()), "vinculos");
  const preEd = await comVigia(Promise.resolve(require("./pre-edital.js").testes()), "pre-edital");
  const cartMat = await comVigia(Promise.resolve(require("./cartoes-material.js").testes()), "cartoes-material");
  const marcasP = await comVigia(Promise.resolve(require("./material-marcas.js").testes()), "material-marcas");
  const regP = await comVigia(Promise.resolve(require("./registro.js").testes()), "registro");
  const dqP = await comVigia(Promise.resolve(require("./material-dicas-questoes.js").testes()), "material-dicas-questoes");
  const qsP = await comVigia(Promise.resolve(require("./questoes.js").testes()), "questoes");
  const quP = await comVigia(Promise.resolve(require("./questoes-ui.js").testes()), "questoes-ui");
  const rsP = await comVigia(Promise.resolve(require("./rascunho.js").testes()), "rascunho");
  const faP = await comVigia(Promise.resolve(require("./fora-da-agenda.js").testes()), "fora-da-agenda");
  const cmP = await comVigia(Promise.resolve(require("./cartao-melhorar.js").testes()), "cartao-melhorar");
  const lsP = await comVigia(Promise.resolve(require("./lei-seca.js").testes()), "lei-seca");
  const luP = await comVigia(Promise.resolve(require("./lei-ui.js").testes()), "lei-ui");
  const teP = await comVigia(Promise.resolve(require("./tempo-excedido.js").testes()), "tempo-excedido");
  const vrP = await comVigia(Promise.resolve(require("./virada.js").testes()), "virada");
  const dfP = await comVigia(Promise.resolve(require("./duas-fases.js").testes()), "duas-fases");
  const mnP = await comVigia(Promise.resolve(require("./minimos.js").testes()), "minimos");
  const rgP = await comVigia(Promise.resolve(require("./registrar.js").testes()), "registrar");
  const arP = await comVigia(Promise.resolve(require("./arrumacao.js").testes()), "arrumacao");
  const qhP = await comVigia(Promise.resolve(require("./questoes-hist.js").testes()), "questoes-hist");
  const glP = await comVigia(Promise.resolve(require("./geracao-log.js").testes()), "geracao-log");
  const etP = await comVigia(Promise.resolve(require("./enxugar-tela.js").testes()), "enxugar-tela");
  const mkP = await comVigia(Promise.resolve(require("./marcas-cores.js").testes()), "marcas-cores");
  const bgP = await comVigia(Promise.resolve(require("./borracha-grifo-fim.js").testes()), "borracha-grifo-fim");
  const ecP = await comVigia(Promise.resolve(require("./etiquetas-e-conserto.js").testes()), "etiquetas-e-conserto");
  const escP = await comVigia(Promise.resolve(require("./estudo-cartoes.js").testes()), "estudo-cartoes");
  const rpP = await comVigia(Promise.resolve(require("./rascunho-painel.js").testes()), "rascunho-painel");
  const rvP = await comVigia(Promise.resolve(require("./revisao-vencida.js").testes()), "revisao-vencida");
  const enP = await comVigia(Promise.resolve(require("./edital-novo.js").testes()), "edital-novo");
  const rxP = await comVigia(Promise.resolve(require("./plano-log.js").testes()), "plano-log");
  const dfcP = await comVigia(Promise.resolve(require("./dificuldade.js").testes()), "dificuldade");
  const bqP = await comVigia(Promise.resolve(require("./blocos-risco.js").testes()), "blocos-risco");
  const cpP = await comVigia(Promise.resolve(require("./colar-plano.js").testes()), "colar-plano");
  const apP = await comVigia(Promise.resolve(require("./aproveitar.js").testes()), "aproveitar");
  const d2P = await comVigia(Promise.resolve(require("./dois-editais.js").testes()), "dois-editais");
  const baP = await comVigia(Promise.resolve(require("./bancada-acoes.js").testes()), "bancada-acoes");
  const vzP = await comVigia(Promise.resolve(require("./vizinhos.js").testes()), "vizinhos");
  const rxTP = await comVigia(Promise.resolve(require("./raiox-tela.js").testes()), "raiox-tela");
  const vrP2 = await comVigia(Promise.resolve(require("./vinculo-ruido.js").testes()), "vinculo-ruido");
  const clP = await comVigia(Promise.resolve(require("./chave-e-log.js").testes()), "chave-e-log");
  const mzP = await comVigia(Promise.resolve(require("./matriz-reuso.js").testes()), "matriz-reuso");
  const urP = await comVigia(Promise.resolve(require("./vinculo-uso-real.js").testes()), "vinculo-uso-real");
  const juP = await comVigia(Promise.resolve(require("./juris.js").testes()), "juris");
  const dbP = await comVigia(Promise.resolve(require("./dica-e-botoes.js").testes()), "dica-e-botoes");
  const aqP = await comVigia(Promise.resolve(require("./arquivar.js").testes()), "arquivar");
  const cqP = await comVigia(Promise.resolve(require("./caixa-questao.js").testes()), "caixa-questao");
  const grP = await comVigia(Promise.resolve(require("./grifo.js").testes()), "grifo");
  const bkqP = await comVigia(Promise.resolve(require("./backup-quando.js").testes()), "backup-quando");
  const entP = await comVigia(Promise.resolve(require("./edital-nao-troca.js").testes()), "edital-nao-troca");
  const rtP = await comVigia(Promise.resolve(require("./registro-tudo.js").testes()), "registro-tudo");
  const ctP = await comVigia(Promise.resolve(require("./cede-tempo.js").testes()), "cede-tempo");
  const atzP = await comVigia(Promise.resolve(require("./atualizacao.js").testes()), "atualizacao");
  const jmP = await comVigia(Promise.resolve(require("./juris-material.js").testes()), "juris-material");
  const mfP = await comVigia(Promise.resolve(require("./menu-fora-do-recorte.js").testes()), "menu-fora-do-recorte");
  const ldlP = await comVigia(Promise.resolve(require("./leitor-de-lei.js").testes()), "leitor-de-lei");
  const rnsP = await comVigia(Promise.resolve(require("./rodada-nao-some.js").testes()), "rodada-nao-some");
  const cvlP = await comVigia(Promise.resolve(require("./citacao-vai-a-lei.js").testes()), "citacao-vai-a-lei");
  const mnlP = await comVigia(Promise.resolve(require("./marca-na-lei.js").testes()), "marca-na-lei");
  return Promise.all([require("./tela.js").testes(), marcasP, regP, dqP, qsP, quP, rsP, faP, cmP, lsP, luP, teP, vrP, dfP, mnP, rgP, arP, qhP, glP, etP, mkP, bgP, ecP, escP, rpP, rvP, enP, rxP, dfcP, bqP, cpP, apP, d2P, baP, vzP, rxTP, vrP2, clP, mzP, urP, juP, dbP, aqP, cqP, grP, bkqP, entP, rtP, ctP, atzP, jmP, mfP, ldlP, rnsP, cvlP, mnlP]).then(([tela,marcas, registroT, dqT, qsT, quT, rsT, faT, cmT, lsT, luT, teT, vrT, dfT, mnT, rgT, arT, qhT, glT, etT, mkT, bgT, ecT, escT, rpT, rvT, enT, rxT, dfcT, bqT, cpT, apT, d2T, baT, vzT, rxTT, vrT2, clT, mzT, urT, juT, dbT, aqT, cqT, grT, bkqT, entT, rtT, ctT, atzT, jmT, mfT, ldlT, rnsT, cvlT, mnlT]) => {
    const extras = [["estrutura do HTML", estrutura],
                    ["carregamento do app", fumaca], ["prompt e colagem parcial", parcial],
                    ["tela: revisão, correção e registro", tela],
                    ["arquivo .apkg: alinhamento, blocos e identidade", apkg],
                    ["edital: leitura, pesos, prioridade e horas", edital],
                    ["editais: migração, grupos e agenda multi-edital", editais],
                    ["vínculos: triagem, faixas de tempo e idempotência", vinc],
                    ["pré-edital: janela, confiança e registro que sobrevive", preEd],
                    ["cartões no material: etiquetas, IA e ida-e-volta", cartMat],
                    ["marcas: seleção, rascunho e fechar-que-pergunta", marcas],
                    ["dicas e questões: texto vivo e abrir-onde-está", dqT],
                    ["questões: formato, banco e sessão de resposta", qsT],
                    ["questões na tela: criar, responder e a aba", quT],
                    ["rascunho: o papel de lado da questão", rsT],
                    ["fora da agenda: adiar, dispensar e filtrar", faT],
                    ["cartões: apagar sem estrago e corrigir com prévia", cmT],
                    ["lei seca: artigos, biblioteca e onde parei", lsT],
                    ["lei na tela: capítulos, recitar, cloze e ranking", luT],
                    ["tempo: o que passou do previsto aparece", teT],
                    ["virada: o dia seguinte à prova", vrT],
                    ["duas fases: objetiva em dezembro, discursiva em janeiro", dfT],
                    ["mínimos por bloco, peso em questões e filtro por edital", mnT],
                    ["registrar: um gesto só, e a agenda repinta sozinha", rgT],
                    ["arrumação: barra de modos, gavetas da lei e filtros de questão", arT],
                    ["histórico dos blocos de questões: filtro salvo e refazer", qhT],
                    ["geração: o motivo do aviso e o registro de cartões e questões", glT],
                    ["enxugar a tela: grifo, rodapé fixo, menu ⋮ e colunas", etT],
                    ["marcas: as seis cores, trocar e tirar", mkT],
                    ["borracha por tamanho, grifo neon e o fim da rodada", bgT],
                    ["etiquetas com espaço e o botão de consertar", ecT],
                    ["estudo dos cartões: etiquetas, layout e onde parei", escT],
                    ["rascunho sobreposto: gatilhos, grupos, selo e teclado", rpT],
                    ["revisão vencida: a linha não pode parecer feita", rvT],
                    ["edital de duas datas: ler, reescrever e criar", enT],
                    ["raio-X da recomendacao e armazenamento", rxT],
                    ["dificuldade declarada: ordena sem mexer na prova", dfcT],
                    ["blocos: cobertura x acerto e a trava com teto", bqT],
                    ["colar plano: dividir nao e perder", cpT],
                    ["aproveitar: vincular nao e marcar como estudado", apT],
                    ["dois editais ao mesmo tempo: avisar antes de estudar", d2T],
                    ["bancada: nomes pelo que fazem e reacao a cada gesto", baT],
                    ["triagem semantica: ordena e encurta, nao decide", vzT],
                    ["raio-X cabendo na tela do telefone", rxTT],
                    ["vinculos: nada de estudo que nao houve", vrT2],
                    ["chave num lugar so, registro e medida que ordena", clT],
                    ["matriz de reuso: cobertura, escala e o encerrado", mzT],
                    ["quatro defeitos que so o uso real mostrou", urT],
                    ["jurisprudencia: o quinto material do topico", juT],
                    ["tres botoes viram dois, e o (?) vira balao", dbT],
                    ["arquivar em vez de apagar, e as abas da faxina", aqT],
                    ["copiar a questao na dica, e o tamanho da caixa", cqT],
                    ["grifo por selecao: posicao de caractere, nao pixel", grT],
                    ["de quando e a base carregada, e os dois botoes", bkqT],
                    ["um edital nao e gravado por cima de outro", entT],
                    ["todos os registros numa linha do tempo so", rtT],
                    ["quando uma disciplina ja pode ceder tempo", ctT],
                    ["quando a atualizacao nao chega", atzT],
                    ["o julgado vira material, e volta para a questao", jmT],
                    ["o menu ⋮ sai do recorte da caixa", mfT],
                    ["leitor de lei: registro, lacuna e grade de artigos", ldlT],
                    ["a rodada terminada nao some antes de registrada", rnsT],
                    ["a citacao do comentario leva a lei certa", cvlT],
                    ["a marca cai onde voce apontou, e da para tirar", mnlT],
                    ["registro: gravação recusada e eventos do edital", registroT],
                    [colagem.pulado ? "colagem de HTML (PULADO: sem jsdom)"
                                    : "colagem: HTML vira marcação do app", colagem.falhas]];
    console.log("");
    extras.forEach(([nome, fs2]) => {
      falhasTotal += fs2.length;
      console.log(`  ${fs2.length ? "FALHOU" : "ok    "}  ${nome}`);
      fs2.forEach((f) => console.log("          -> " + f));
    });
    return fim();
  });

  function fim() {

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
}

Promise.resolve(main())
  .then((c) => process.exit(c))
  /* sem este catch, uma suíte que TRAVA saía com código 0 e sem imprimir
   * nada — o vigia levanta a mão, mas alguém precisa escutá-lo */
  .catch((e) => { console.log("\n  " + (e && e.stack ? e.stack : e.message) + "\n"); process.exit(1); });
