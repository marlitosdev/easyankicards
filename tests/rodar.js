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
  const cdlP = await comVigia(Promise.resolve(require("./citacao-dentro-da-lei.js").testes()), "citacao-dentro-da-lei"); const lcgP = await comVigia(Promise.resolve(require("./lei-colagem.js").testes()), "lei-colagem"); const lbbP = await comVigia(Promise.resolve(require("./lei-biblioteca.js").testes()), "lei-biblioteca"); const lclP = await comVigia(Promise.resolve(require("./lei-citacoes-lista.js").testes()), "lei-citacoes-lista"); const lalP = await comVigia(Promise.resolve(require("./lei-alteradora.js").testes()), "lei-alteradora"); const lanP = await comVigia(Promise.resolve(require("./lei-anexos.js").testes()), "lei-anexos"); const lesP = await comVigia(Promise.resolve(require("./lei-estrutura.js").testes()), "lei-estrutura"); const lmpP = await comVigia(Promise.resolve(require("./lei-mapa.js").testes()), "lei-mapa"); const lcpP = await comVigia(Promise.resolve(require("./lei-compacto.js").testes()), "lei-compacto"); const lexP = await comVigia(Promise.resolve(require("./lei-exibicao.js").testes()), "lei-exibicao"); const lmcP = await comVigia(Promise.resolve(require("./lei-marcador.js").testes()), "lei-marcador"); const lrtP = await comVigia(Promise.resolve(require("./lei-retomar.js").testes()), "lei-retomar"); const lcfP = await comVigia(Promise.resolve(require("./lei-cf.js").testes()), "lei-cf"); const decP = await comVigia(Promise.resolve(require("./decisoes.js").testes()), "decisoes"); const ajsP = await comVigia(Promise.resolve(require("./lei-ajustes.js").testes()), "lei-ajustes"); const lixP = await comVigia(Promise.resolve(require("./lixeira.js").testes()), "lixeira"); const emdP = await comVigia(Promise.resolve(require("./lei-emenda.js").testes()), "lei-emenda"); const cverP = await comVigia(Promise.resolve(require("./lei-colagem-ver.js").testes()), "lei-colagem-ver"); const citP = await comVigia(Promise.resolve(require("./lei-citacoes.js").testes()), "lei-citacoes"); const bfbP = await comVigia(Promise.resolve(require("./botoes-feedback.js").testes()), "botoes-feedback"); const lrcP = await comVigia(Promise.resolve(require("./lei-repetidos-citados.js").testes()), "lei-repetidos-citados"); const lrvP = await comVigia(Promise.resolve(require("./lei-revogados-texto.js").testes()), "lei-revogados-texto"); const ltcP = await comVigia(Promise.resolve(require("./lei-tachado.js").testes()), "lei-tachado"); const lreP = await comVigia(Promise.resolve(require("./lei-revogados-estudo.js").testes()), "lei-revogados-estudo"); const lahP = await comVigia(Promise.resolve(require("./lei-arquivo-html.js").testes()), "lei-arquivo-html"); const larP = await comVigia(Promise.resolve(require("./lei-atualizar-revogados.js").testes()), "lei-atualizar-revogados"); const lasP = await comVigia(Promise.resolve(require("./lei-atualizar-seguros.js").testes()), "lei-atualizar-seguros"); const lldP = await comVigia(Promise.resolve(require("./lei-lado-a-lado.js").testes()), "lei-lado-a-lado"); const pcaP = await comVigia(Promise.resolve(require("./prompts-cartao.js").testes()), "prompts-cartao"); const cqlP = await comVigia(Promise.resolve(require("./cartao-qualidade.js").testes()), "cartao-qualidade"); const celP = await comVigia(Promise.resolve(require("./cartao-elevar.js").testes()), "cartao-elevar"); const gerP = await comVigia(Promise.resolve(require("./gerenciador.js").testes()), "gerenciador"); const pacP = await comVigia(Promise.resolve(require("./pacote.js").testes()), "pacote"); const lxiP = await comVigia(Promise.resolve(require("./lixo-ia.js").testes()), "lixo-ia"); const banP = await comVigia(Promise.resolve(require("./bancada.js").testes()), "bancada"); const lotP = await comVigia(Promise.resolve(require("./cartao-lote.js").testes()), "cartao-lote"); const ramP = await comVigia(Promise.resolve(require("./ramos.js").testes()), "ramos");
  const vtP = await comVigia(Promise.resolve(require("./edital-vert.js").testes()), "edital-vert");
  const vuP = await comVigia(Promise.resolve(require("./edital-vert-ui.js").testes()), "edital-vert-ui");
  const wgP = await comVigia(Promise.resolve(require("./edital-guarda.js").testes()), "edital-guarda");
  const wdP = await comVigia(Promise.resolve(require("./edital-novo-dados.js").testes()), "edital-novo-dados");
  const wlP = await comVigia(Promise.resolve(require("./edital-leitura.js").testes()), "edital-leitura");
  const dcP = await comVigia(Promise.resolve(require("./diario-conserto.js").testes()), "diario-conserto");
  const rcP = await comVigia(Promise.resolve(require("./resumo-citacoes.js").testes()), "resumo-citacoes");
  const rbP = await comVigia(Promise.resolve(require("./resumo-barra.js").testes()), "resumo-barra");
  const jcP = await comVigia(Promise.resolve(require("./julgado-citado.js").testes()), "julgado-citado");
  const bcP = await comVigia(Promise.resolve(require("./biblioteca-criar.js").testes()), "biblioteca-criar");
  const mcoP = await comVigia(Promise.resolve(require("./material-contas.js").testes()), "material-contas");
  const jgvP = await comVigia(Promise.resolve(require("./juris-gaveta.js").testes()), "juris-gaveta");
  const jbbP = await comVigia(Promise.resolve(require("./juris-bib.js").testes()), "juris-bib");
  const jatP = await comVigia(Promise.resolve(require("./juris-atual.js").testes()), "juris-atual");
  const jinP = await comVigia(Promise.resolve(require("./juris-informativo.js").testes()), "juris-informativo");
  const jidP = await comVigia(Promise.resolve(require("./juris-idb.js").testes()), "juris-idb");
  const mprP = await comVigia(Promise.resolve(require("./material-pratico.js").testes()), "material-pratico");
  const mlaP = await comVigia(Promise.resolve(require("./material-lacunas.js").testes()), "material-lacunas");
  const llvP = await comVigia(Promise.resolve(require("./lei-leitor-vinc.js").testes()), "lei-leitor-vinc");
  const mhiP = await comVigia(Promise.resolve(require("./material-hierarquia.js").testes()), "material-hierarquia");
  const vfbP = await comVigia(Promise.resolve(require("./vinculo-feedback.js").testes()), "vinculo-feedback");
  const vmnP = await comVigia(Promise.resolve(require("./vinculo-menu.js").testes()), "vinculo-menu");
  const jprP = await comVigia(Promise.resolve(require("./juris-parecido.js").testes()), "juris-parecido");
  const vatP = await comVigia(Promise.resolve(require("./vinculo-atravessa.js").testes()), "vinculo-atravessa");
  const qteP = await comVigia(Promise.resolve(require("./questoes-tela.js").testes()), "questoes-tela");
  const qmvP = await comVigia(Promise.resolve(require("./questoes-mover.js").testes()), "questoes-mover");
  const qcaP = await comVigia(Promise.resolve(require("./questoes-cartoes.js").testes()), "questoes-cartoes");
  const rtpP = await comVigia(Promise.resolve(require("./registro-tempo.js").testes()), "registro-tempo");
  const dtpP = await comVigia(Promise.resolve(require("./diario-tempo.js").testes()), "diario-tempo");
  const jamP = await comVigia(Promise.resolve(require("./juris-ambiguo.js").testes()), "juris-ambiguo");
  const jcoP = await comVigia(Promise.resolve(require("./juris-corrigir.js").testes()), "juris-corrigir");
  const ldxP = await comVigia(Promise.resolve(require("./lei-docx.js").testes()), "lei-docx");
  const lscP = await comVigia(Promise.resolve(require("./lei-separar-conferir.js").testes()), "lei-separar-conferir");
  const lapP = await comVigia(Promise.resolve(require("./lei-alteradora-pdf.js").testes()), "lei-alteradora-pdf");
  const lfxP = await comVigia(Promise.resolve(require("./lei-fluxo-registro.js").testes()), "lei-fluxo-registro");
  const lafP = await comVigia(Promise.resolve(require("./lei-altfila.js").testes()), "lei-altfila");
  const gmtP = await comVigia(Promise.resolve(require("./ger-mover-toque.js").testes()), "ger-mover-toque");
  const cobLP = await comVigia(Promise.resolve(require("./cobertura-lei.js").testes()), "cobertura-lei");
  const rleP = await comVigia(Promise.resolve(require("./resumo-leitor.js").testes()), "resumo-leitor");
  const calP = await comVigia(Promise.resolve(require("./citacao-alteradora.js").testes()), "citacao-alteradora");
  const chuP = await comVigia(Promise.resolve(require("./questoes-chute.js").testes()), "questoes-chute");
  const irmP = await comVigia(Promise.resolve(require("./questoes-irma.js").testes()), "questoes-irma");
  const lmsP = await comVigia(Promise.resolve(require("./lei-mapa-sinais.js").testes()), "lei-mapa-sinais");
  const lnvP = await comVigia(Promise.resolve(require("./lei-nunca-vistos.js").testes()), "lei-nunca-vistos");
  const qcrP = await comVigia(Promise.resolve(require("./questoes-criar-ramos.js").testes()), "questoes-criar-ramos");
  const dtlP = await comVigia(Promise.resolve(require("./dominio-tela.js").testes()), "dominio-tela");
  const lctP = await comVigia(Promise.resolve(require("./lei-cartoes.js").testes()), "lei-cartoes");
  const p91P = await comVigia(Promise.resolve(require("./pendencias-18-91.js").testes()), "pendencias-18-91");
  const rlsP = await comVigia(Promise.resolve(require("./ramos-lista.js").testes()), "ramos-lista");
  const rcoP = await comVigia(Promise.resolve(require("./ramos-corrigir.js").testes()), "ramos-corrigir");
  const jiqP = await comVigia(Promise.resolve(require("./juris-identidade.js").testes()), "juris-identidade");
  const jctP = await comVigia(Promise.resolve(require("./juris-catalogo.js").testes()), "juris-catalogo");
  const jb6P = await comVigia(Promise.resolve(require("./juris-biblioteca96.js").testes()), "juris-biblioteca96");
  const jiaP = await comVigia(Promise.resolve(require("./juris-ia.js").testes()), "juris-ia");
  const lsdP = await comVigia(Promise.resolve(require("./lei-sufixo-duplo.js").testes()), "lei-sufixo-duplo");
  return Promise.all([require("./tela.js").testes(), marcasP, regP, dqP, qsP, quP, rsP, faP, cmP, lsP, luP, teP, vrP, dfP, mnP, rgP, arP, qhP, glP, etP, mkP, bgP, ecP, escP, rpP, rvP, enP, rxP, dfcP, bqP, cpP, apP, d2P, baP, vzP, rxTP, vrP2, clP, mzP, urP, juP, dbP, aqP, cqP, grP, bkqP, entP, rtP, ctP, atzP, jmP, mfP, ldlP, rnsP, cvlP, mnlP, cdlP, lcgP, lbbP, lclP, lalP, lanP, lesP, lmpP, lcpP, lexP, lmcP, lrtP, lcfP, decP, ajsP, lixP, emdP, cverP, citP, bfbP, lrcP, lrvP, ltcP, lreP, lahP, larP, lasP, lldP, pcaP, cqlP, celP, gerP, pacP, lxiP, banP, lotP, ramP, vtP, vuP, wgP, wdP, wlP, dcP, rcP, rbP, jcP, bcP, mcoP, jgvP, jbbP, jatP, jinP, jidP, mprP, mlaP, llvP, mhiP, vfbP, vmnP, jprP, vatP, qteP, qmvP, qcaP, rtpP, dtpP, jamP, jcoP, ldxP, lscP, lapP, lfxP, lafP, gmtP, cobLP, rleP, calP, chuP, irmP, lmsP, lnvP, qcrP, dtlP, lctP, p91P, rlsP, rcoP, jiqP, jctP, jb6P, jiaP, lsdP]).then(([tela,marcas, registroT, dqT, qsT, quT, rsT, faT, cmT, lsT, luT, teT, vrT, dfT, mnT, rgT, arT, qhT, glT, etT, mkT, bgT, ecT, escT, rpT, rvT, enT, rxT, dfcT, bqT, cpT, apT, d2T, baT, vzT, rxTT, vrT2, clT, mzT, urT, juT, dbT, aqT, cqT, grT, bkqT, entT, rtT, ctT, atzT, jmT, mfT, ldlT, rnsT, cvlT, mnlT, cdlT, lcgT, lbbT, lclT, lalT, lanT, lesT, lmpT, lcpT, lexT, lmcT, lrtT, lcfT, decT, ajsT, lixT, emdT, cverT, citT, bfbT, lrcT, lrvT, ltcT, lreT, lahT, larT, lasT, lldT, pcaT, cqlT, celT, gerT, pacT, lxiT, banT, lotT, ramT, vtT, vuT, wgT, wdT, wlT, dcT, rcT, rbT, jcT, bcT, mcoT, jgvT, jbbT, jatT, jinT, jidT, mprT, mlaT, llvT, mhiT, vfbT, vmnT, jprT, vatT, qteT, qmvT, qcaT, rtpT, dtpT, jamT, jcoT, ldxT, lscT, lapT, lfxT, lafT, gmtT, cobLT, rleT, calT, chuT, irmT, lmsT, lnvT, qcrT, dtlT, lctT, p91T, rlsT, rcoT, jiqT, jctT, jb6T, jiaT, lsdT]) => {
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
                    ["citacao dentro da lei abre um preview do artigo", cdlT],
                    ["colar um PDF de lei: limpar, criticar a numeração e ajudar a decidir", lcgT],
                    ["a lei existe uma vez so: identidade, biblioteca e mesclagem", lbbT],
                    ["citação em lista, estrutura do artigo, vínculo permanente e relatório", lclT],
                    ["atualizar com a lei que altera: ler, mesclar no artigo e decidir", lalT],
                    ["anexos: tabela substituída ou revogada por outra lei, e o PDF consolidado", lanT],
                    ["estrutura da lei: divisões em árvore, artigos bem lidos, mapa e capítulo lido único", lesT],
                    ["ir para…: o mapa da lei (árvore, parágrafos e incisos, mais caem, capítulos, busca)", lmpT],
                    ["leitor compacto: fila que recolhe, menu de procedência e nenhum botão perdido", lcpT],
                    ["exibição flutuante (fecha fora, com Esc, ao ampliar) e marcas em pontos coloridos", lexT],
                    ["parei aqui: bandeirinha, botão flutuante, faixa clara, desfazer e sem perder a rolagem", lmcT],
                    ["retomar: a lei abre no marcador, o marcador sabe qual ocorrência, continuar na Biblioteca e no registro", lrtT],
                    ["conferência sem falso alarme: o ADCT como divisão, nome depois da nota, numeração por trecho e tela quieta", lcfT],
                    ["decisões: o histórico do que o app sugeriu tirar e do que a pessoa decidiu, com a tela para julgar", decT],
                    ["o que o app ajustou ao ler: mostrar, manter o original, e registrar a decisão", ajsT],
                    ["lixeira: apagar não é para sempre — cartão, questão, dica e nota voltam do mesmo lugar, com o risco à vista", lixT],
                    ["a emenda não tem parágrafos repetidos: a EC 132/2023 dava 22 grupos falsos, e a lei consolidada segue conferida", emdT],
                    ["revisão da colagem: ver o conteúdo de cada anexo e o trecho de cada item, antes de confirmar", cverT],
                    ["blocos de alteração (LC 214): as limpezas poupam o texto citado, e o leitor diz qual artigo de qual lei muda", citT],
                    ["botões: cada clique mostra que foi apertado e diz o que fez (aviso acima das janelas, frase fixa na revisão da colagem)", bfbT],
                    ["repetidos: as linhas citadas não contam, item de lista não é cabeçalho, e só se decide onde há indício", lrcT],
                    ["revogados no texto: artigo, § / inciso, anexo — identificados, esmaecidos e guardados como revogados, sem apagar nada", lrvT],
                    ["colar com formatação: o tachado do Planalto vira um grupo da revisão (aceitar sai da lei, recusar fica), sem guardar nenhuma marca", ltcT],
                    ["revogados fora do estudo: progresso, recitar, cartões, grade e citação — e o § / inciso revogado identificado", lreT],
                    ["abrir o arquivo .htm salvo da página: charset, texto, tachado, cursor e aviso", lahT],
                    ["atualizar versão: artigo que consta como revogado no texto novo entra sem os alarmes de 'mudou' e é gravado como revogado", larT],
                    ["atualizar versão: 'aceitar os sem risco' de uma vez, calibrado pela severidade dos alertas", lasT],
                    ["conferir lado a lado: texto gravado × colado, linha a linha, com o que mudou em destaque (ou a explicação de que são iguais)", lldT],
                    ["prompts de cartão: um padrão só — nunca encurtar, tamanho em números, cartão rico com título e literalidade, e sem repetir o que o tópico já tem", pcaT],
                    ["radar de repetição: paráfrases e lacunas repetidas agrupadas entre tópicos, o mais completo sugerido, mesclar sem duplicar, lixeira e a tela", cqlT],
                    ["elevar ao padrão: nota do cartão, prompt em lote com fonte, conferência da resposta (encolheu, perdeu, continua fraco), trocar e desfazer sem pisar em ninguém", celT],
                    ["gerenciador de cartões: pastas, busca, filtros, prévia, mover, apagar, editar, melhorar em lote e desfazer a última ação", gerT],
                    ["montar pacote .apkg e importar para uma pasta: um baralho por pasta, sem repetidos, .txt, importação sem perder a lacuna nem o baralho", pacT],
                    ["sobras da IA: citações [n], “Exato!”, listas com * e (Fonte: …) — limpar sem perder a fonte", lxiT],
                    ["a bancada também é uma pasta: radar, elevar e gerenciador leem e gravam no editor, com foto no histórico e lixeira", banT],
                    ["resolver repetidos em lote sem travar: mesmo resultado, uma gravação por pasta, barra de progresso, 1500 cartões em segundos e desfazer o lote", lotT],
                    ["ramificações do tópico: ++ Ramo no edital, ida e volta do texto, plano idêntico sem ramos e edição dos ramos de um tópico", ramT],
                    ["edital verticalizado (motor): disciplinas por questões ou peso, numeração 1/1.1, ramos, 2ª fase, progresso nas caixas e fatia igual à do plano", vtT],
                    ["edital verticalizado (tela): faixas e colunas do modelo, opções que mexem na folha e ficam guardadas, caixinhas do progresso, imprimir só a folha e o CSS de impressão", vuT],
                    ["texto errado não vira edital: o prompt colado gera zero disciplinas, nomes de exemplo e texto cru são avisados, e o Novo edital tem semáforo, chips do que foi entendido e 'antes de criar'", wgT],
                    ["Novo edital: nome obrigatório, três respostas para a data (tenho / ainda não saiu / pré-edital com janela), erros em vermelho debaixo do campo, avisos numa pergunta só, 2ª fase depois da primeira e horas de 1 a 80", wdT],
                    ["confiança no que foi lido: contagem única de disciplinas, repetidas e sem tópico avisadas, \"unir as repetidas\" sem perder tópico e a faixa de números provisórios na bancada e no Raio-X", wlT],
                    ["diário: registros automáticos de ramo (retirar e desfazer), sessões iguais agrupadas, cor do acerto, dias com estudo, balão do mapa e o Copiar", dcT],
                    ["resumo: citações de lei viram links (prévia do artigo, abrir a lei e voltar, sem lei pergunta, vínculo permanente, texto intacto)", rcT],
                    ["resumo: a barra (bolha da seleção com marcas, ligar à lei, julgado e questões; vale na tela cheia)", rbT],
                    ["julgados citados: súmula, tema e processo viram link (prévia, criar agora, achar sozinho), no resumo, na questão e no cartão", jcT],
                    ["criar cartões sem sair da Biblioteca (pedido, colar, conferir, guardar marcados, desfazer) e a volta da bancada à Biblioteca", bcT],
                    ["material de estudo: as abas contam itens (julgados, cartões, leis, questões) e dizem em quantos tópicos; edital de largura inteira; aba e botão das questões", mcoT],
                    ["gaveta de julgados: um selo de situação que abre o porquê, à vista só 🃏 e ⋯ (ações com nome, ramo, excluir) e os três jeitos de começar", jgvT],
                    ["biblioteca de julgados: todos, com busca, filtros e grupos; abrir no tópico, ligar a outro, cartões das teses em lote e estudar as teses", jbbT],
                    ["a jurisprudência continua valendo? pedido à IA, conferir antes/depois, aplicar com desfazer, 'nao_sei' não grava; selos na gaveta, na biblioteca e na citação", jatT],
                    ["informativo: cada julgado do lote com 'Guardar em', sugerido pelo assunto entre os tópicos do edital; citados ficam no tópico do resumo", jinT],
                    ["julgados no IndexedDB: cache (cópia a cada leitura), backup e restauração pelo caminho certo, armazenamento medido, carregamento antes de juris.js", jidT],
                    ["material de estudo: continuar de onde parei, tópicos do edital ainda sem material e o estado do estudo na linha", mprT],
                    ["lacunas quebradas pela versão antiga ({{c1 — …}}) consertadas no arranque, sem mexer na data do tópico", mlaT],
                    ["leitor de lei: 'alínea b' na citação, vínculos manuais e bolha de seleção, letra do modo editar e '＋ Nova lei' sem tópico", llvT],
                    ["material: disciplina como faixa, tópicos com linha-guia e ramos recolhidos (cada um abre a ficha no ramo)", mhiT],
                    ["vínculo feito à mão se mostra: aviso ao guardar, link destacado, 🔗 e balão, linha na prévia, desligar confirma", vfbT],
                    ["escolher a lei no menu guarda o vínculo (resumo e questões), atalho para as outras sem lei; a lei do fim da enumeração vale para todos", vmnT],
                    ["julgados: criar ao ligar a outro, e checagem de igual/parecido antes de criar (gaveta, prévia, lote)", jprT],
                    ["vínculo à mão que atravessa negrito/grifo vira link (resumo, julgado, leitor da lei); aviso confere a tela; leis que chegam depois", vatT],
                    ["responder questões: teclado, tela inteira, ferramentas no cabeçalho, balão de andar e balão do grifo", qteT],
                    ["mover a questão para outro tópico (e ramo), com desfazer, na resolução e na lista", qmvT],
                    ["cartões criados a partir de uma questão: etiqueta, contagem, 'ver os N', selo na lista e Biblioteca filtrada", qcaT],
                    ["tempo do registro: nasce vazio, ramos não reescrevem, sugerido a um toque, tempo ativo da rodada, origem no diário", rtpT],
                    ["diário: corrigir o tempo de um registro (formatos, ramos repartidos, 'era', faixa e desfazer)", dtpT],
                    ["julgado citado: quem É o tema vence quem só o menciona; na dúvida, onde as teses se separam e por que casou", jamT],
                    ["corrigir julgados com pendência pela IA: texto oficial, antes × depois, selo de memória fica, unir repetidos", jcoT],
                    ["lei em PDF: abrir o .docx do Word/Google Documentos (parágrafo por linha, riscado) e a dica curta", ldxT],
                    ["texto numa linha só: avisa, separa e mostra para conferir (pontos a conferir, juntar ao anterior, ir ao art., páginas)", lscT],
                    ["leis que alteram o CTM coladas do PDF: art. próprio perdido não contamina, 'Art. 356. A -' = 356-A, aspa de fechar", lapT],
                    ["registro da inclusão da lei: resumo por etapa, linha do tempo, consultar e copiar em cada tela, fluxo único criar+atualizar", lfxT],
                    ["a lei e as leis que a alteram num fluxo único: fila em ordem de data, aplica uma por uma, pular, parar e continuar depois", lafT],
                    ["biblioteca de cartões: mover com o dedo (segurar, deslizar, soltar na pasta) e pela prévia, com confirmação", gmtT],
                    ["cobertura de uma lei por cartões, artigo a artigo: etiqueta ou citação, peso das questões, criar cartões do artigo", cobLT],
                    ["leitor de resumos: cada ramo guarda onde você parou (o parágrafo), o que nunca foi lido começa do início", rleT],
                    ["citação que nomeia a lei alteradora vai para a lei alterada; 'N°' lido; o mapa da lei conta só as questões daquela lei", calT],
                    ["marcador de chute: antes do gabarito (tecla ?), 'foi chute' depois; volta nas erradas; vale 1/4 no domínio, no tópico e no mapa", chuT],
                    ["questão irmã: depois de errar ou chutar, outra do mesmo artigo (ou ramo) 5 questões adiante, com selo e desfazer", irmT],
                    ["mapa da lei com três sinais: fundo = domínio real, barrinha = o quanto cai, 🎲 = chute; bancas no balão", lmsT],
                    ["artigos que você nunca viu: três camadas (caem, vizinhos, resto), 'já vi' e a fila dos 5 prioritários", lnvT],
                    ["virar texto em questões: dois passos, ramos no pedido (marcar, o que cobrar, RAMO: de cada uma), criar os sugeridos, tela cheia", qcrT],
                    ["domínio dos assuntos: três visões (prioridades, disciplinas, evolução), topo preso, '?', manchete sem falso alarme, ganho dos 5 primeiros", dtlT],
                    ["cartões de cada artigo: selo no leitor da lei, filtro 'sem cartão' no mapa e estudar o artigo/capítulo na Cobertura", lctT],
                    ["optativa não escolhida fora da Cobertura e do Domínio; chutes no histórico; o próximo passo do Domínio na ficha do tópico", p91T],
                    ["ramos que sumiam: a vez na fila (0,999…), a parte da semana, o resumo aberto vê os ramos salvos, a pergunta ao chegar uma lista", rlsT],
                    ["ramos com problema (repetidos, em outro tópico) e o pedido de correção à IA", rcoT],
                    ["jurisprudência: tópicos preservados ao editar, súmula sem relator, tema × processo que o fixou", jiqT],
                    ["jurisprudência: catálogo oficial, tema × processo, selo de qualidade, auditoria passo a passo com desfazer", jctT],
                    ["biblioteca de julgados: tela cheia, filtros por assunto e etiqueta, estudo das teses refeito (frente/verso, editar e voltar)", jb6T],
                    ["Gemini direto na jurisprudência: opcional, erros com nome, resposta na caixa de sempre, nada gravado sozinho", jiaT],
                    ["lei: artigo com dois sufixos (Art. 359-M-A do Código Penal) não vira 'repetido'", lsdT],
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
