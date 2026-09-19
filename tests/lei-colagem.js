/* =====================================================================
 * COLAR UM PDF DE LEI (Ctrl+A): limpar, criticar a numeração e ajudar a
 * decidir — sem gravar nada antes de a pessoa aprovar
 *
 * O CASO REAL. O PDF do Código Tributário de Caruaru (296 páginas), copiado
 * inteiro, trazia o cabeçalho da prefeitura a cada página, Anexos depois do
 * último artigo, "Art . 382", "Art. 356. A -", remissões partidas pela quebra
 * de linha ("… previstas no / artigo 16 desta Lei") e a redação velha ao
 * lado da nova DENTRO do mesmo artigo. Na ATUALIZAÇÃO, colar a lei que
 * ALTERA (LC 145: "“ Art. 162 […]") gerava "Art. 1º mudou" e centenas de
 * "revogado" — e aceitar isso corromperia a lei.
 *
 * OS TIPOS DE ERRO, um bloco de testes para cada (ver lei-seca.js):
 *   P  texto que não é lei        cabeçalho, página, invisíveis, anexos
 *   G  cabeçalho não reconhecido   "Art . 382", "356. A -", “ Art.
 *   R  cabeçalho FALSO             remissão e divisão partidas pela quebra
 *   H  repetição dentro do artigo  § velho e § novo
 *   N  numeração fora de sequência a crítica que aponta o leitor errando
 *   C  comparação                  formatação, alertas, ausentes
 *   V  conferência da versão nova  outra lei, lei que ALTERA, colagem incompleta
 *   U  a tela                      ver, recusar item a item, nada gravado antes
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const HDR = "Prefeitura de Caruaru Praça Sen. Teotônio Vilela, S/N°, Centro, Caruaru/Pernambuco CEP 55.004-901";
const ANOT = "(Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009)";

/* uma "página" de PDF: cabeçalho + três artigos, o último atravessando a página */
const pagina = (n) => [
  HDR,
  "Art. " + (n * 3 + 1) + ". Texto do artigo " + (n * 3 + 1) + " que segue por bastante tempo para ocupar a linha.",
  "Parágrafo único. Não se aplica o disposto neste artigo quando houver previsão em contrário.",
  "Art. " + (n * 3 + 2) + ". Segundo artigo da página " + n + " com texto suficiente para não parecer curto demais.",
  "I. primeiro inciso do artigo com texto de tamanho razoável;",
  "II. segundo inciso do artigo com texto de tamanho razoável.",
  "Art. " + (n * 3 + 3) + ". Terceiro artigo da página, cuja continuação vem na página seguinte e que segue com",
  "mais texto da página " + n + " para que a frase atravesse a quebra de linha do PDF sem terminar.",
  ANOT,
  "CAPÍTULO I DAS DISPOSIÇÕES GERAIS",
].join("\n");
const PDF6 = [0, 1, 2, 3, 4, 5].map(pagina).join("\n");

const doze = () => Array.from({ length: 12 }, (_, i) =>
  "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + " com redação própria e completa da lei.").join("\n");

const LC145 = [
  "LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024",
  "Altera a Lei Complementar nº 15, de 05 de janeiro de 2009 e dá outras providências.",
  "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
  "“ Art. 5 [...]",
  "§4º O contribuinte que não realizar movimentação econômica terá sua inscrição suspensa. (AC)",
  "[...]",
  "Art. 9 [...]",
  "I. [...] f) companhias aéreas ou seus representantes; (NR) g) empresas de plano de saúde; (NR)",
  "Art. 2º Ficam substituídos os Anexos VI, VII e XV da Lei Complementar nº 15/2009.",
  "Art. 3º Fica revogado o Anexo XI da Lei Complementar nº 15/2009.",
  "Art. 4º Esta Lei Complementar entra em vigor na data de sua publicação.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const semRuido = (s) => String(s).replace(/\s+/g, " ").trim();

  const { api } = rodar();
  const pre = (t) => api.leiPreprocessar(t);
  const grupo = (r, g) => r.mudancas.filter((m) => m.grupo === g);
  const aplicar = (t, dec) => { const r = pre(t); return api.leiAplicarPreprocesso(t, r.mudancas, dec || {}); };

  /* ==============================================================
   * P: TEXTO QUE NÃO É LEI
   * ============================================================== */
  {
    const r = pre(PDF6);
    const cab = grupo(r, "cabecalho");
    ok(cab.length === 1 && cab[0].ocorrencias === 6 && /Prefeitura de Caruaru/.test(cab[0].antes),
       "P1 o cabeçalho que se repete a cada página nao foi achado (1 grupo, 6 ocorrencias): " + JSON.stringify(cab.map((c) => c.ocorrencias)));
    const limpo = api.leiAplicarPreprocesso(PDF6, r.mudancas, {}).texto;
    ok(limpo.indexOf("Prefeitura de Caruaru") < 0, "P1a o cabeçalho continuou no texto depois de aceitar");
    ok(api.leiArtigos(limpo).length === 18, "P1b a limpeza mexeu na contagem de artigos: " + api.leiArtigos(limpo).length);
    /* o artigo que atravessa a página fica inteiro, sem o cabeçalho no meio */
    const a3 = api.leiArtigo(limpo, "3");
    ok(a3 && /atravesse a quebra/.test(a3.texto) && !/Prefeitura/.test(a3.texto),
       "P1c o artigo que atravessa a pagina nao ficou inteiro e limpo");
  }

  /* P2: o que se repete mas NÃO é cabeçalho de página fica onde está */
  {
    const t = [
      "Art. 1º. Um artigo qualquer com texto suficiente para ocupar espaço.",
      "Parágrafo único. Não se aplica.", ANOT, "200.0", "200.0",
      "Art. 2º. Outro artigo qualquer com texto suficiente para ocupar espaço.",
      "Parágrafo único. Não se aplica.", ANOT, "200.0",
      "Art. 3º. Mais um artigo qualquer com texto suficiente para ocupar espaço.",
      "Parágrafo único. Não se aplica.", ANOT, "200.0",
      "CAPÍTULO I DAS DISPOSIÇÕES GERAIS", "Art. 4º. Quarto artigo qualquer com texto suficiente para ocupar espaço.",
      "CAPÍTULO I DAS DISPOSIÇÕES GERAIS", "Art. 5º. Quinto artigo qualquer com texto suficiente para ocupar espaço.",
      "CAPÍTULO I DAS DISPOSIÇÕES GERAIS",
    ].join("\n");
    ok(grupo(pre(t), "cabecalho").length === 0,
       "P2 tomou por cabeçalho de página uma linha legitima repetida: " + JSON.stringify(grupo(pre(t), "cabecalho").map((c) => c.antes)));
    /* a mesma linha três vezes, encostada (linha de tabela), também não */
    const tab = ["Art. 1º. Um.", "Serviço de vigilância patrimonial prestado", "Serviço de vigilância patrimonial prestado",
      "Serviço de vigilância patrimonial prestado", "Art. 2º. Dois."].join("\n");
    ok(grupo(pre(tab), "cabecalho").length === 0, "P2a linha repetida encostada (tabela) virou cabeçalho de pagina");
  }

  /* P3: número de página */
  {
    const t = ["Art. 1º. Um artigo com texto.", "Página 3 de 296", "Art. 2º. Dois.", "12 / 296", "Art. 3º. Tres."].join("\n");
    const p = grupo(pre(t), "pagina");
    ok(p.length === 1 && p[0].linhas.join(",") === "2,4", "P3 'Página 3 de 296' e '12 / 296' nao foram achados: " + JSON.stringify(p.map((x) => x.linhas)));
    const seq = ["Art. 1º. Um.", "1", "Art. 2º. Dois.", "2", "3", "4", "5", "6", "Art. 3º. Tres."].join("\n");
    ok(grupo(pre(seq), "pagina").length === 1 && grupo(pre(seq), "pagina")[0].linhas.length === 6,
       "P3a a sequencia 1..6 solta nao foi tomada por numeros de pagina: " + JSON.stringify(grupo(pre(seq), "pagina").map((x) => x.linhas)));
    ok(grupo(pre("Art. 1º. Um.\n5\nArt. 2º. Dois.\n9"), "pagina").length === 0, "P3b um numero solto isolado virou numero de pagina");
    ok(grupo(pre("Art. 1º. Um.\n1\n2\n3\nArt. 2º. Dois."), "pagina").length === 0, "P3c sequencia curta demais (3) virou numero de pagina");
  }

  /* P4: caracteres invisíveis */
  {
    const t = "Art. 1º. Tribu­tário e obri​gação.\nArt. 2º. Normal.";
    const g = grupo(pre(t), "invisiveis");
    ok(g.length === 1 && g[0].ocorrencias === 1, "P4 hifen opcional / espaco de largura zero nao foram achados");
    ok(aplicar(t).texto === "Art. 1º. Tributário e obrigação.\nArt. 2º. Normal.", "P4a a limpeza dos invisiveis mexeu no que nao devia: " + JSON.stringify(aplicar(t).texto));
  }

  /* P5: anexos */
  {
    const t = [
      "Art. 521. Penúltimo artigo com texto.", "Art. 522. Esta Lei entra em vigor na data de sua publicação.",
      "LEI COMPLEMENTAR Nº 015, 05 DE JANEIRO DE 2009",
      "ANEXO X", "TABELA PARA COBRANÇA DO IMPOSTO SOBRE SERVIÇOS", "1. Acupunturista ......", "2. Advogado ......", "200.0", "200.0",
      "ANEXO XI", "Outro anexo com tabela.", "3. Item.",
    ].join("\n");
    const r = pre(t);
    const ax = grupo(r, "anexo");
    ok(ax.length === 2 && /ANEXO X — TABELA/.test(ax[0].titulo) && ax[0].tamanho > 30 && /ANEXO XI/.test(ax[1].titulo),
       "P5 os anexos nao foram achados com titulo e tamanho: " + JSON.stringify(ax.map((a) => [a.titulo, a.tamanho])));
    const ap = api.leiAplicarPreprocesso(t, r.mudancas, {});
    ok(ap.anexos.length === 2 && /Acupunturista/.test(ap.anexos[0].texto) && /Outro anexo/.test(ap.anexos[1].texto),
       "P5a separar nao guardou o texto de cada anexo");
    ok(!/Acupunturista|ANEXO/.test(ap.texto) && api.leiArtigo(ap.texto, "522").texto.indexOf("Acupunturista") < 0,
       "P5b o anexo continuou dentro do ultimo artigo depois de separar");
    const man = api.leiAplicarPreprocesso(t, r.mudancas, { [ax[0].id]: "manter", [ax[1].id]: "manter" });
    ok(man.texto === t && man.anexos.length === 0, "P5c 'manter' devia deixar o texto exatamente como veio");
    const des = api.leiAplicarPreprocesso(t, r.mudancas, { [ax[0].id]: "descartar", [ax[1].id]: "separar" });
    ok(des.anexos.length === 1 && /Outro anexo/.test(des.anexos[0].texto) && !/Acupunturista/.test(des.texto),
       "P5d 'descartar' um anexo e separar o outro nao funcionou por anexo");
    /* o anexo termina no próximo artigo: o que vem depois continua artigo */
    const meio = ["Art. 1º. Um.", "ANEXO I", "tabela", "Art. 2º. Dois depois do anexo.", "Art. 3º. Tres."].join("\n");
    const am = api.leiAplicarPreprocesso(meio, pre(meio).mudancas, {});
    ok(api.leiArtigos(am.texto).map((a) => a.num).join(",") === "1,2,3" && am.anexos.length === 1 && !/tabela/.test(am.texto),
       "P5e o anexo no meio da lei engoliu os artigos que vem depois dele");
    /* menção a "Anexo" no meio da frase não é anexo */
    const men = ["Art. 1º. Conforme o", "Anexo I desta Lei, aplica-se a alíquota.", "anexo IV desta Lei", "Art. 2º. Dois."].join("\n");
    ok(grupo(pre(men), "anexo").length === 0, "P5f mencao a 'Anexo I desta Lei' no meio de uma frase virou anexo");
  }

  /* ==============================================================
   * G: CABEÇALHO DE ARTIGO QUE O LEITOR NÃO RECONHECE
   * ============================================================== */
  {
    const t = ["Art. 355. Anterior.", "Art . 382 Texto com espaço antes do ponto.", "Art. 356. A - Dispositivo acrescentado ao 356.",
      "“ Art. 162 [...]", "Parágra único. Texto.", "Art. 357. Seguinte."].join("\n");
    const g = grupo(pre(t), "grafia");
    ok(g.length === 4, "G1 os quatro cabecalhos mal escritos nao foram achados: " + JSON.stringify(g.map((x) => x.antes)));
    const limpo = aplicar(t).texto.split("\n");
    ok(limpo[1] === "Art. 382 Texto com espaço antes do ponto.", "G1a 'Art . 382' virou: " + limpo[1]);
    ok(limpo[2] === "Art. 356-A. Dispositivo acrescentado ao 356.", "G1b 'Art. 356. A -' virou: " + limpo[2]);
    ok(limpo[3] === "Art. 162 [...]", "G1c aspas de citacao viraram: " + limpo[3]);
    ok(limpo[4] === "Parágrafo único. Texto.", "G1d 'Parágra único' virou: " + limpo[4]);
    /* antes o leitor NÃO via o 382 nem o 356-A; depois vê */
    ok(api.leiArtigos(t).map((a) => a.num).indexOf("382") < 0, "G1e (controle) o leitor ja via o 382 sem corrigir");
    ok(api.leiArtigos(limpo.join("\n")).map((a) => a.num).join(",") === "355,382,356-A,162,357", "G1f depois de corrigir o leitor nao ve os artigos: " + api.leiArtigos(limpo.join("\n")).map((a) => a.num));
  }
  {
    /* o que já está certo NÃO é tocado */
    const certo = ["Art. 3º. A Lei estabelece o prazo.", "Art. 8º-A - Texto acrescentado.", "Art. 9º A - regra", "Art. 10. O prazo é de trinta dias."].join("\n");
    const g = grupo(pre(certo), "grafia");
    ok(g.length === 1 && g[0].linhas[0] === 3, "G2 tocou em cabecalho que ja estava certo: " + JSON.stringify(g.map((x) => x.antes)));
  }

  /* ==============================================================
   * R: CABEÇALHO FALSO — remissão e divisão partidas pela quebra de linha
   * ============================================================== */
  {
    const t = ["Art. 44. Texto do artigo quarenta e quatro que termina bem.",
      "Art. 45. Na falta de eleição de domicílio, considera-se o local da sede, observado o disposto no",
      "artigo 16 desta Lei, e o previsto no artigo 9º deste Código.", "Art. 46. Sem prejuízo do disposto neste capítulo."].join("\n");
    ok(api.leiArtigos(t).map((a) => a.num).join(",") === "44,45,16,46", "R1 (controle) sem limpar, o leitor cria o 'Art. 16' falso: " + api.leiArtigos(t).map((a) => a.num));
    const r = pre(t);
    const rem = grupo(r, "remissao");
    ok(rem.length === 1 && rem[0].motivo === "minuscula" && rem[0].linhas[0] === 3,
       "R1a a remissao partida nao foi apontada: " + JSON.stringify(rem.map((x) => [x.linhas, x.motivo])));
    const limpo = api.leiAplicarPreprocesso(t, r.mudancas, {}).texto;
    ok(api.leiArtigos(limpo).map((a) => a.num).join(",") === "44,45,46", "R1b depois de unir, o 'Art. 16' falso continuou: " + api.leiArtigos(limpo).map((a) => a.num));
    ok(/no artigo 16 desta Lei, e o previsto/.test(semRuido(api.leiArtigo(limpo, "45").texto)),
       "R1c a remissao nao ficou colada a frase de cima: " + api.leiArtigo(limpo, "45").texto);
  }
  {
    /* divisão falsa dentro de um artigo: "LIVRO II Regula…;" */
    const t = ["Art. 1º. Este Código regula os direitos.",
      "Art. 2º. O Código é constituído de 4 Livros: LIVRO I Estabelece Normas Gerais aplicáveis ao Município;",
      "LIVRO II Regula o Sistema Tributário Municipal;", "LIVRO III Regula o Regime Contratual dos Preços Públicos;",
      "Art. 3º. O Código é subordinado à Constituição."].join("\n");
    const rem = grupo(pre(t), "remissao");
    ok(rem.length === 2 && rem.every((x) => x.motivo === "divisao"), "R2 as 'divisoes' partidas nao foram apontadas: " + JSON.stringify(rem.map((x) => x.motivo)));
    const limpo = aplicar(t).texto;
    ok(/LIVRO II Regula/.test(api.leiArtigo(limpo, "2").texto) && /LIVRO III Regula/.test(api.leiArtigo(limpo, "2").texto),
       "R2a o Art. 2 continuou cortado no meio");
    /* capítulo de verdade (sem ; no fim) NÃO é apontado */
    ok(grupo(pre("Art. 1º. Um.\nCAPÍTULO II DA RECEITA\nArt. 2º. Dois."), "remissao").length === 0, "R2b um capitulo de verdade foi apontado como partido");
  }
  {
    /* não pode acusar o que é lei: cabeçalho capitalizado, capítulo em duas linhas, recorte com saltos */
    const t = ["Art. 1º. Um artigo completo.", "", "CAPÍTULO II", "Da Receita", "", "Art. 9º. Tributo é a receita derivada.",
      "Art. 11. Outro.", "Art. 12-A. Acrescentado.", "Art. 35. Mais um.", "Art. 115. Vigência."].join("\n");
    ok(grupo(pre(t), "remissao").length === 0, "R3 acusou de remissao um recorte legitimo (capitulo em duas linhas + saltos): " + JSON.stringify(grupo(pre(t), "remissao").map((x) => [x.linhas, x.motivo])));
    /* capitalizado que VOLTA depois de frase inacabada: suspeito */
    const v = ["Art. 40. Texto do quarenta que menciona o", "Art. 9º desta Lei no começo da linha.", "Art. 41. Seguinte."].join("\n");
    const rv = grupo(pre(v), "remissao");
    ok(rv.length === 1 && rv[0].motivo === "sequencia", "R3a numero que volta depois de frase inacabada nao foi apontado: " + JSON.stringify(rv.map((x) => x.motivo)));
    /* um salto PARA FRENTE depois de frase inacabada não é acusado */
    const f = ["Art. 40. Texto do quarenta que menciona o", "Art. 90 desta Lei no começo da linha.", "Art. 41. Seguinte."].join("\n");
    ok(grupo(pre(f), "remissao").length === 0, "R3b salto para frente foi acusado (recorte tem saltos de proposito)");
  }
  {
    /* uma lei já limpa não tem o que sugerir (e depois de limpar, também não) */
    const CARU = ["Art. 1º. Este Código regula os direitos.", "Art. 2º. O Código é constituído de 4 Livros.", "Art. 3º O Código é subordinado:", "I - à Constituição Federal;", "II - ao CTN.", "Art. 4º. Outro artigo comum."].join("\n");
    ok(pre(CARU).mudancas.length === 0, "R4 texto limpo recebeu sugestao de limpeza: " + JSON.stringify(pre(CARU).mudancas.map((m) => m.id)));
    const depois = aplicar(PDF6).texto;
    ok(pre(depois).mudancas.filter((m) => m.grupo !== "cabecalho").length === 0,
       "R4a depois de limpar, a segunda passada ainda acha coisa (nao e' idempotente): " + JSON.stringify(pre(depois).mudancas.map((m) => m.id)));
  }

  /* ==============================================================
   * A APLICAÇÃO: recusar devolve o texto intacto; cada item é independente
   * ============================================================== */
  {
    const t = PDF6 + "\nArt . 30. Espaço.\nArt. 31. Fim.\nANEXO I\nTabela\n";
    const r = pre(t);
    const dec = {};
    r.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "manter" : false; });
    ok(api.leiAplicarPreprocesso(t, r.mudancas, dec).texto === t.replace(/\r\n?/g, "\n"),
       "A1 recusando TUDO o texto nao voltou exatamente como veio");
    ok(api.leiAplicarPreprocesso(t.replace(/\n/g, "\r\n"), r.mudancas, dec).texto === t,
       "A1a texto com CRLF nao foi normalizado");
    /* um item de grafia recusado, o resto aceito */
    const g = grupo(r, "grafia");
    const d2 = {};
    g.forEach((m) => { d2[m.id] = false; });
    const ap = api.leiAplicarPreprocesso(t, r.mudancas, d2);
    ok(/Art \. 30\./.test(ap.texto) && ap.texto.indexOf("Prefeitura") < 0,
       "A2 recusar so o item de grafia devia manter 'Art . 30' e ainda tirar o cabecalho");
  }

  /* ==============================================================
   * H: REPETIÇÃO DENTRO DO MESMO ARTIGO
   * ============================================================== */
  {
    const t = ["Art. 8º. Um artigo qualquer com texto.",
      "Art. 9º. Sem prejuízo de outras garantias, é vedado ao Município:",
      "§4º. A Lei determinará medidas gerais.",
      "§5º. A Lei determinará medidas para que os consumidores sejam esclarecidos acerca dos impostos.",
      "§5º. A Lei determinará medidas para que os consumidores sejam esclarecidos acerca dos tributos municipais. " + ANOT,
      "§6º. Qualquer subsídio ou isenção só poderá ser concedido mediante Lei federal, estadual ou municipal.",
      "§6º. Qualquer subsídio ou isenção só poderão ser concedidos mediante Lei específica. " + ANOT,
      "Art. 10. O disposto no artigo 9º é subordinado a requisitos.",
      "Parágrafo Único. Na falta de cumprimento, a autoridade suspenderá o benefício.",
      "§1º. Na falta de cumprimento, a autoridade suspenderá o benefício. (Renumerado do parágrafo único pela Lei Complementar nº 018, de 09 de outubro de 2009)",
      "§2º. Os serviços a que se refere a alínea c são os diretamente relacionados. (Incluído pela Lei Complementar nº 018)",
      "Art. 11. A imunidade não exclui obrigações acessórias."].join("\n");
    const g = api.leiDuplicados(t);
    ok(g.length === 3 && g.map((x) => x.num).join(",") === "9#P5,9#P6,10#PU",
       "H1 os paragrafos repetidos dentro do artigo nao foram achados: " + JSON.stringify(g.map((x) => x.num)));
    ok(g.every((x) => x.intra === true && x.confianca === "forte"), "H1a os grupos de paragrafo deviam ser 'intra' com sugestao segura");
    const p5 = g[0];
    const sug = p5.candidatos.filter((c) => c.indice === p5.sugerido)[0];
    ok(/tributos municipais/.test(sug.texto) && p5.motivo === "redacao", "H1b a sugestao do §5 nao foi a redacao nova: " + sug.texto);
    const pu = g[2];
    const sugPu = pu.candidatos.filter((c) => c.indice === pu.sugerido)[0];
    ok(/^§1º/.test(sugPu.texto) && pu.motivo === "renumerado", "H2 o 'Parágrafo Único' antigo devia perder para o '§1º Renumerado': " + sugPu.texto + " / " + pu.motivo);
    /* aplicar as sugestões */
    const dec = {};
    g.forEach((x) => { dec[x.num] = { manter: x.sugerido, original: true }; });
    const res = api.leiAplicarDuplicados(t, g, dec);
    ok(Object.keys(res.alteracoes).length === 0, "H3 redacao substituida de PARAGRAFO virou 'alteracao' (so existe por artigo inteiro): " + JSON.stringify(Object.keys(res.alteracoes)));
    ok(!/acerca dos impostos\./.test(res.texto) && /tributos municipais/.test(res.texto) && !/Parágrafo Único\./.test(res.texto)
       && /§1º\. Na falta/.test(res.texto) && /§4º\. A Lei determinará medidas gerais/.test(res.texto) && /§2º\. Os serviços/.test(res.texto),
       "H3a o texto resolvido perdeu o que nao devia ou manteve a redacao velha: " + res.texto);
    ok(api.leiDuplicados(res.texto).length === 0, "H3b resolvido, ainda restam repetidos");
    /* "conferidos" silencia */
    ok(api.leiDuplicados(t, ["9#P5", "9#P6", "10#PU"]).length === 0, "H4 numeros ja conferidos (repetidosOk) continuam sendo apontados");
    /* o que não é parágrafo repetido */
    const legit = ["Art. 1º. Um.", "§1º. Primeiro.", "§2º. Segundo.", "§3º. Terceiro.", "Parágrafo único. Outro.",
      "Art. 2º. Dois.", "§1º. Primeiro do dois.", "Art. 3º. Tres."].join("\n");
    ok(api.leiDuplicados(legit).length === 0, "H5 paragrafos distintos (ou o §1º de outro artigo) foram apontados como repetidos");
    const rem = ["Art. 1º. Um artigo.", "§1º. Primeiro parágrafo com texto.", "§ 4º do artigo 9º desta Lei aplica-se ao caso.", "§2º. Segundo."].join("\n");
    ok(api.leiDuplicados(rem).length === 0, "H5a remissao '§ 4º do artigo…' no comeco da linha virou paragrafo");
  }

  /* ==============================================================
   * N: A NUMERAÇÃO TEM DE SER UMA SEQUÊNCIA — e a crítica aponta o leitor errando
   * ============================================================== */
  {
    const arts = (nums) => api.leiArtigos(nums.map((x) => "Art. " + x + ". Texto do artigo.").join("\n"));
    const ate = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
    ok(api.leiNumeracao(arts(ate(1, 20))).problemas.length === 0, "N1 sequencia limpa recebeu critica");
    ok(api.leiNumeracao(arts(["5", "5-A", "6", "7"])).problemas.length === 0, "N1a sufixo (5-A) ou repetido lado a lado recebeu critica");
    ok(api.leiNumeracao(arts([1, 2, 3, 3, 4, 5])).problemas.length === 0, "N1b artigo antigo e novo lado a lado (3,3) recebeu critica");
    const iso = api.leiNumeracao(arts([...ate(1, 10), 16, ...ate(11, 20)]));
    ok(iso.graves.length === 1 && iso.graves[0].tipo === "isolado" && iso.graves[0].numCru === "16",
       "N2 um numero isolado no meio da sequencia (a remissao lida como artigo) nao foi criticado: " + JSON.stringify(iso.problemas.map((p) => [p.tipo, p.numCru])));
    const vol = api.leiNumeracao(arts([...ate(1, 15), 9, 10, ...ate(16, 20)]));
    ok(vol.graves.some((p) => p.tipo === "volta"), "N3 a numeracao que volta nao foi criticada: " + JSON.stringify(vol.problemas.map((p) => [p.tipo, p.numCru])));
    const salto = api.leiNumeracao(arts([...ate(1, 20), ...ate(26, 40)]));
    ok(salto.graves.length === 1 && salto.graves[0].tipo === "salto" && salto.graves[0].nFaltam === 5 && salto.graves[0].faltam.join(",") === "21,22,23,24,25",
       "N4 o salto de 5 artigos numa lei quase continua nao foi criticado como grave: " + JSON.stringify(salto.problemas));
    const pouco = api.leiNumeracao(arts([...ate(1, 20), 23, ...ate(24, 40)]));
    ok(pouco.problemas.length === 1 && pouco.graves.length === 0, "N4a faltar 1 ou 2 numeros devia ser aviso LEVE: " + JSON.stringify(pouco.problemas.map((p) => [p.tipo, p.gravidade])));
    const rec = api.leiNumeracao(arts([1, 2, 3, 9, 11, 35, 115]));
    ok(rec.recorte === true && rec.graves.length === 0 && rec.problemas.length > 0, "N5 um RECORTE (so os artigos que interessam) recebeu critica grave: " + JSON.stringify(rec.graves));
    const adct = api.leiNumeracao(arts([...ate(1, 30), 1, 2, 3, 4, 5]));
    ok(adct.graves.length === 0 && adct.problemas.some((p) => p.tipo === "recomeco"), "N6 o ADCT que recomeca em 1 devia ser aviso leve 'recomeco': " + JSON.stringify(adct.problemas.map((p) => [p.tipo, p.gravidade])));
    const linhas = api.leiNumeracaoLinhas(iso.problemas);
    ok(/Art\. 16/.test(linhas[0].texto) && /isolado/.test(linhas[0].texto), "N7 a frase da critica nao diz qual artigo e por que: " + linhas[0].texto);
  }

  /* ==============================================================
   * C: A COMPARAÇÃO — formatação não é mudança; cada mudança leva ajuda
   * ============================================================== */
  {
    ok(api.leiNormalizaComparacao("Art. 5º “Texto” — do § 1° e 2ª") === api.leiNormalizaComparacao('Art. 5º "Texto" - do §1º e 2º'),
       "C1 aspas curvas, travessao, grau e espaco no § nao foram tratados como formatacao: " + api.leiNormalizaComparacao("Art. 5º “Texto” — do § 1° e 2ª"));
    const antigo = ["Art. 1º. O prazo é de trinta dias — contados da ciência.", "Art. 2º. Segundo artigo do texto.",
      "Art. 3º. O contribuinte pagará a multa de 10 por cento sobre o valor devido ao Município de Caruaru na forma desta Lei.",
      "Art. 4º. Quarto artigo do texto com redação antiga, que traz uma regra longa o bastante para que o texto novo, se vier cortado, pareça bem menor do que ele.", "Art. 5º. Quinto."].join("\n");
    const novo = ["Art. 1º. O prazo é de trinta dias - contados da ciência.", "Art. 2º. Segundo artigo do texto. " + ANOT,
      "Art. 3º. O contribuinte pagará a multa de 20 por cento sobre o valor devido ao Município de Caruaru na forma desta Lei.",
      "Art. 4º. [...]", "Art. 5º. Quinto."].join("\n");
    const cmp = api.leiCompararVersoes(antigo, novo, {});
    ok(cmp.soFormatacao.join(",") === "1", "C2 o travessao trocado devia contar como so formatacao (Art. 1): " + JSON.stringify(cmp.soFormatacao));
    const porNum = {};
    cmp.itens.forEach((i) => { porNum[i.num] = i; });
    ok(!porNum["1"], "C2a o artigo so com formatacao diferente foi listado como mudanca");
    ok(porNum["2"].alertas.some((a) => a.k === "so_anotacao"), "C3 mudou so a nota de vigencia e o app nao avisou: " + JSON.stringify(porNum["2"].alertas));
    const al3 = porNum["3"].alertas.filter((a) => a.k === "numeros")[0];
    ok(al3 && al3.de === "10" && al3.para === "20", "C4 o prazo/valor que mudou (10 -> 20) nao foi destacado: " + JSON.stringify(porNum["3"].alertas));
    ok(porNum["4"].alertas.some((a) => a.k === "omitido") && porNum["4"].alertas.some((a) => a.k === "menor"),
       "C5 '[...]' num artigo devia gerar alerta de omitido e de texto menor: " + JSON.stringify(porNum["4"].alertas));
  }
  {
    /* ausentes: o modo seguro nao inventa revogacao */
    const base = doze();
    const parcial = ["Art. 1º Texto do artigo 1 com redação própria e completa da lei.", "Art. 2º Texto novo do artigo dois inteiro."].join("\n");
    const rev = api.leiCompararVersoes(base, parcial, { ausentes: "revogar" });
    ok(rev.itens.filter((i) => i.tipo === "revogado").length === 10, "C6 no modo 'lei inteira' os 10 ausentes deviam aparecer como possivelmente revogados");
    ok(rev.itens.filter((i) => i.tipo === "revogado").every((i) => i.alertas.some((a) => a.k === "ausente_incompleto")),
       "C6a artigo 'revogado' por ausencia num texto incompleto nao trouxe o alerta de texto incompleto");
    const pres = api.leiCompararVersoes(base, parcial, { ausentes: "presentes" });
    ok(pres.itens.length === 1 && pres.itens[0].tipo === "mudou" && pres.itens[0].num === "2",
       "C7 no modo 'so os presentes' nada podia virar revogado: " + JSON.stringify(pres.itens.map((i) => [i.num, i.tipo])));
    /* números que a lei gravada repete de verdade não são comparados */
    const ign = api.leiCompararVersoes("Art. 1º Um.\nArt. 2º Dois.\nArt. 1º ADCT um.", "Art. 1º Outro.\nArt. 2º Dois.", { ignorar: ["1"] });
    ok(ign.naoComparados.indexOf("1") >= 0 && !ign.itens.some((i) => i.num === "1"), "C8 numero repetido de proposito (corpo/ADCT) foi comparado: " + JSON.stringify(ign));
    /* número isolado num texto novo é sinalizado */
    const seq = doze() + "\n" + Array.from({ length: 6 }, (_, i) => "Art. " + (13 + i) + "º Texto " + (13 + i)).join("\n");
    const comIso = seq.replace("Art. 15º Texto 15", "Art. 15º Texto 15\nArt. 90º Artigo falso isolado no meio.");
    const ci = api.leiCompararVersoes(doze(), comIso, { ausentes: "presentes" });
    const fals = ci.itens.filter((i) => i.num === "90")[0];
    ok(fals && fals.alertas.some((a) => a.k === "fora_sequencia"), "C9 artigo novo isolado fora da sequencia nao foi alertado: " + JSON.stringify(fals));
  }

  /* ==============================================================
   * V: ANTES DE COMPARAR — é desta lei? é a lei inteira? só as alterações?
   * ============================================================== */
  {
    const alt = api.leiPareceAlteradora(LC145);
    ok(alt.sim === true && alt.sinais.indexOf("passa_a_vigorar") >= 0, "V1 a LC 145 (lei que altera) nao foi reconhecida como alteradora: " + JSON.stringify(alt));
    ok(api.leiPareceAlteradora(doze()).sim === false, "V1a uma lei consolidada foi tomada por alteradora");
    ok(api.leiPareceAlteradora("Art. 1º Um.\n[...]\nArt. 2º Dois. [...]").sim === true, "V1b dois '[...]' devia bastar");
    const l = { nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009" };
    ok(api.leiConfereIdentidade(l, LC145).conflito === true, "V2 o texto da LC 145 contra a LC 15 nao foi apontado como outra lei");
    ok(api.leiConfereIdentidade(l, "LEI COMPLEMENTAR 015, DE 05 DE JANEIRO DE 2009\nArt. 1º Um.").conflito === false,
       "V2a '015' e '15' (mesma lei) foram tomados por leis diferentes");
    ok(api.leiConfereIdentidade({ nome: "Sem numero", numero: "" }, LC145).conflito === false, "V2b lei gravada sem numero nao tem como conflitar");
    const cob = api.leiCoberturaDaAtualizacao(api.leiArtigos(doze()), api.leiArtigos("Art. 1º Um.\nArt. 2º Dois.\nArt. 99º Novo."));
    ok(cob.total === 12 && cob.presentes === 2 && cob.ausentes.length === 10 && cob.pct < 0.2, "V3 a cobertura nao contou 2 de 12: " + JSON.stringify(cob));
  }

  /* ==============================================================
   * U: A TELA — o que a pessoa vê, o que ela recusa, e que nada é gravado antes
   * ============================================================== */
  const iniciar = () => {
    const r = rodar();
    r.api.matIniciar(); r.api.leiIniciar();
    return r.api;
  };
  const marcadores = (a, prefixo) => achar(a.$("leiPreLista"), (c) => c.type === "checkbox");

  /* U1: criação — o texto de PDF abre a revisão, e NADA é criado antes do finalizar */
  {
    const a = iniciar();
    a.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    a.$("leiTexto").value = PDF6;
    const r = a.leiGravar();
    ok(r === "pendente" && a.$("dlgLeiPre").open === true, "U1 o texto de PDF nao abriu a revisao da colagem: " + r);
    ok(a.leisLista().length === 0, "U1a a lei foi criada ANTES de a pessoa aprovar a limpeza");
    ok(/Revisar o texto colado/.test(a.$("leiPreTitulo").textContent || ""), "U1b titulo da revisao: " + a.$("leiPreTitulo").textContent);
    ok(achar(a.$("leiPreLista"), (c) => /lei-pre-grupo/.test(c.className || "")).length >= 1, "U1c a revisao nao mostrou os grupos");
    ok(/Prefeitura de Caruaru/.test(achar(a.$("leiPreLista"), (c) => /lei-pre-antes/.test(c.className || "")).map((c) => c.textContent).join(" ")),
       "U1d a revisao nao mostra o texto que sairia (o cabecalho da prefeitura)");
    ok(/6 linha\(s\) de cabeçalho/.test(a.$("leiPreFim").textContent || "") && /Nada foi gravado/.test(a.$("leiPreFim").textContent || ""),
       "U1e o resumo nao diz o que vai acontecer nem que nada foi gravado: " + a.$("leiPreFim").textContent);
    a.$("btnLeiPreConfirmar").onclick();
    const l = a.leisLista()[0];
    ok(a.$("dlgLeiPre").open === false && !!l && l.texto.indexOf("Prefeitura") < 0 && a.leiArtigos(l.texto).length === 18,
       "U1f depois de finalizar a lei devia ser criada sem o cabecalho e com os 18 artigos: " + (l ? a.leiArtigos(l.texto).length : "sem lei"));
    ok(a.$("dlgLeiPre").open === false && a.leiPreCtxAtual() === null, "U1g a revisao reabriu ou o contexto sobrou");
  }

  /* U2: recusar o grupo → o texto fica como veio */
  {
    const a = iniciar();
    a.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    a.$("leiTexto").value = PDF6;
    a.leiGravar();
    const btn = achar(a.$("leiPreLista"), (c) => c.id === "btnLeiPreNenhum_cabecalho")[0];
    ok(!!btn, "U2 nao ha botao 'recusar todos' no grupo do cabecalho");
    btn.onclick();
    ok(achar(a.$("leiPreLista"), (c) => /lei-pre-consequencia/.test(c.className || "")).some((c) => /cabeçalho fica/.test(c.textContent)),
       "U2a recusar o grupo nao explicou a consequencia");
    a.$("btnLeiPreConfirmar").onclick();
    ok(a.leisLista()[0].texto.indexOf("Prefeitura de Caruaru") >= 0, "U2b recusei a limpeza e o cabecalho saiu mesmo assim");
  }

  /* U3: recusar UM item; "usar o texto original"; voltar */
  {
    const a = iniciar();
    a.leiAbrir("Direito", "T");
    a.$("leiTexto").value = ["Art. 1º. Um.", "Art . 2 Dois.", "Art. 3. A - Tres.", "Art. 4º. Quatro."].join("\n");
    a.leiGravar();
    const cbs = marcadores(a);
    ok(cbs.length === 2, "U3 devia haver 2 itens de grafia com caixa de escolha: " + cbs.length);
    cbs[0].checked = false; cbs[0].onchange();
    a.$("btnLeiPreConfirmar").onclick();
    const t = a.leisLista()[0].texto.split("\n");
    ok(t[1] === "Art . 2 Dois." && t[2] === "Art. 3-A. Tres.", "U3a recusar um item so devia manter aquela linha: " + JSON.stringify(t));
  }
  {
    const a = iniciar();
    a.leiAbrir("Direito", "T");
    const bruto = PDF6;
    a.$("leiTexto").value = bruto;
    a.leiGravar();
    a.$("btnLeiPreOriginal").onclick();
    ok(a.leisLista().length === 1 && a.leisLista()[0].texto === bruto && a.$("dlgLeiDup").open !== true,
       "U3b 'usar o texto original' nao criou a lei com o texto como veio (ou reabriu perguntas)");
  }
  {
    const a = iniciar();
    a.leiAbrir("Direito", "T");
    a.$("leiTexto").value = PDF6;
    a.leiGravar();
    a.$("btnLeiPreVoltar").onclick();
    ok(a.$("dlgLeiPre").open === false && a.leisLista().length === 0 && a.$("leiTexto").value === PDF6 && a.leiPreCtxAtual() === null,
       "U3c voltar devia fechar sem criar nada e sem mexer no texto");
  }

  /* U4: os anexos separados ficam guardados na lei e aparecem sob o texto */
  {
    const a = iniciar();
    a.leiAbrir("Direito Tributário", "CTM");
    a.$("leiTexto").value = [doze(), "ANEXO X", "TABELA PARA COBRANÇA", "1. Acupunturista ......", "200.0"].join("\n");
    a.leiGravar();
    a.$("btnLeiPreConfirmar").onclick();
    const l = a.leisLista()[0];
    ok(l && l.anexos && l.anexos.length === 1 && /Acupunturista/.test(l.anexos[0].texto) && l.texto.indexOf("Acupunturista") < 0,
       "U4 o anexo nao foi guardado a parte da lei: " + JSON.stringify(l && l.anexos));
    ok(a.$("leiAnexos").hidden === false && achar(a.$("leiAnexos"), (c) => /lei-anexo-txt/.test(c.className || "")).some((c) => /Acupunturista/.test(c.textContent)),
       "U4a o anexo nao aparece sob o texto da lei");
    ok(a.leiArtigo(l.texto, "12").texto.indexOf("Acupunturista") < 0, "U4b o anexo continuou dentro do ultimo artigo");
  }

  /* U5: limpeza + repetidos, na ordem certa e sem perguntar duas vezes; anexos sobrevivem */
  {
    const a = iniciar();
    a.leiAbrir("Direito Tributário", "CTM");
    const t = [HDR, "Art. 1º. Um.", "Art. 2º. Dois.", "Art. 3º. Antigo três do código.",
      "Art. 3º. Novo três do código mudado. " + ANOT, "Art. 4º. Quatro.", HDR, "Art. 5º. Cinco.", "Art. 6º. Seis.",
      "Art. 7º. Sete.", "Art. 8º. Oito.", "Art. 9º. Nove.", HDR, "Art. 10. Dez.", "Art. 11. Onze.", "Art. 12. Doze.",
      "Art. 13. Treze.", "Art. 14. Catorze.", HDR, "Art. 15. Quinze.", "ANEXO I", "tabela do anexo"].join("\n");
    a.$("leiTexto").value = t;
    ok(a.leiGravar() === "pendente" && a.$("dlgLeiPre").open === true, "U5 a limpeza devia vir primeiro");
    a.$("btnLeiPreConfirmar").onclick();
    ok(a.$("dlgLeiDup").open === true && a.$("dlgLeiPre").open === false, "U5a depois da limpeza devia abrir a conferencia dos repetidos");
    a.$("btnLeiDupConfirmar").onclick();
    const l = a.leisLista()[0];
    ok(!!l && a.$("dlgLeiPre").open === false && a.$("dlgLeiDup").open === false, "U5b perguntou de novo depois de confirmar tudo");
    ok(l.anexos && l.anexos.length === 1 && l.texto.indexOf("Prefeitura") < 0 && a.leiArtigos(l.texto).filter((x) => x.num === "3").length === 1,
       "U5c a lei nao ficou limpa, sem repetido e com o anexo guardado: " + JSON.stringify(l && l.anexos));
  }

  /* U6: só a numeração fora de sequência (nada a limpar) também abre — e é crítica, não trava */
  {
    const a = iniciar();
    a.leiAbrir("Direito", "T");
    const seq = [];
    for (let i = 1; i <= 10; i++) seq.push("Art. " + i + "º. Texto do artigo " + i + " com o conteúdo completo.");
    seq.splice(5, 0, "Art. 90º. Este artigo isolado é uma remissão lida como artigo.");
    a.$("leiTexto").value = seq.join("\n");
    const r = a.leiGravar();
    ok(r === "pendente" && a.$("dlgLeiPre").open === true, "U6 numeracao com numero isolado nao abriu a revisao: " + r);
    ok(/Conferir a numeração/.test(a.$("leiPreTitulo").textContent || "") && a.$("btnLeiPreOriginal").hidden === true,
       "U6a a revisao so de numeracao devia ter titulo proprio e nao oferecer 'usar o texto original'");
    ok(a.$("leiPreNumeracao").hidden === false && /NÃO está em sequência/.test(achar(a.$("leiPreNumeracao"), () => true).concat([a.$("leiPreNumeracao")]).map((c) => c.textContent).join(" ")),
       "U6b a critica da numeracao nao apareceu");
    ok(achar(a.$("leiPreNumeracao"), (c) => c.className === "grave").some((c) => /Art\. 90/.test(c.textContent)),
       "U6c a critica nao aponta o Art. 90 como isolado");
    a.$("btnLeiPreConfirmar").onclick();
    ok(a.leisLista().length === 1 && a.$("dlgLeiPre").open === false, "U6d a critica nao pode TRAVAR: 'continuar' devia criar a lei");
  }

  /* U7: um recorte (só alguns artigos) não é incomodado */
  {
    const a = iniciar();
    a.leiAbrir("Direito", "T");
    a.$("leiTexto").value = ["Art. 1º. Um.", "Art. 2º. Dois.", "Art. 3º. Tres.", "Art. 9º. Nove.", "Art. 11. Onze.", "Art. 35. Trinta e cinco.", "Art. 100. Cem.", "Art. 115. Cento e quinze."].join("\n");
    ok(a.leiGravar() !== "pendente" && a.leisLista().length === 1, "U7 um recorte legitimo (saltos de proposito) foi interrompido pela critica");
  }

  /* U8: lei já guardada com numeração fora de sequência ganha o aviso */
  {
    const a = iniciar();
    const seq = [];
    for (let i = 1; i <= 10; i++) seq.push("Art. " + i + "º. Texto do artigo " + i + " com o conteúdo completo.");
    seq.splice(5, 0, "Art. 90º. Isolado.");
    const l = a.leiGuardar({ nome: "Lei 9/2000", texto: seq.join("\n") });
    a.leiAbrir("Direito", "T", l.id);
    ok(achar(a.$("leiProc"), (c) => c.id === "btnLeiNumeracao").length === 1, "U8 a lei guardada com numero isolado nao ganhou o aviso de numeracao");
    const limpa = a.leiGuardar({ nome: "Lei 10/2000", texto: seq.filter((x) => !/Art\. 90/.test(x)).join("\n") });
    a.leiAbrir("Direito", "T2", limpa.id);
    ok(achar(a.$("leiProc"), (c) => c.id === "btnLeiNumeracao").length === 0, "U8a lei em sequencia recebeu o aviso");
  }

  /* U9: ATUALIZAÇÃO — o texto de PDF passa pela revisao antes de comparar, e o cabeçalho não vira "mudou" */
  {
    const a = iniciar();
    const base = [];
    for (let i = 1; i <= 15; i++) base.push("Art. " + i + "º. Texto do artigo " + i + " que segue por bastante tempo para ocupar a linha.");
    const l = a.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: base.join("\n") });
    a.leiAbrir("Direito Tributário", "CTM", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "PDF consolidado";
    const novo = base.slice();
    novo[3] = "Art. 4º. Texto do artigo 4 que segue por bastante tempo para ocupar a linha e agora tem um prazo maior.";
    const comHdr = [HDR];
    novo.forEach((x, i) => { comHdr.push(x); if (i % 5 === 4) comHdr.push(HDR); });
    a.$("leiUpdTexto").value = comHdr.join("\n");
    const r = a.leiAtualizarComparar();
    ok(r === false && a.$("dlgLeiPre").open === true && a.leiPreCtxAtual().modo === "atualizar",
       "U9 a versao nova com cabecalhos nao passou pela revisao da colagem");
    ok(/versão nova/i.test(a.$("leiPreTitulo").textContent || "") && /comparar/i.test(a.$("btnLeiPreConfirmar").textContent || ""),
       "U9a a revisao da atualizacao nao diz que e' a versao nova / comparar: " + a.$("leiPreTitulo").textContent);
    ok(a.$("leiUpdPasso2").hidden === true, "U9b a comparacao abriu antes de a pessoa aprovar a limpeza");
    a.$("btnLeiPreConfirmar").onclick();
    const it = a.leiUpdComparoAtual() || [];
    ok(a.$("leiUpdPasso2").hidden === false && it.length === 1 && it[0].num === "4",
       "U9c depois de limpar so o artigo 4 devia diferir: " + JSON.stringify(it.map((x) => x.num)));
    ok(a.leisLista()[0].texto === base.join("\n"), "U9d a atualizacao mexeu no texto-base antes de finalizar");
  }

  /* U10: ATUALIZAÇÃO com a lei que ALTERA — conferência antes de comparar, com opção segura */
  {
    const a = iniciar();
    const vinte = Array.from({ length: 20 }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + " com redação própria e completa da lei.").join("\n");
    const l = a.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: vinte });
    a.leiAbrir("Direito Tributário", "CTM", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "LC 145/2024";
    a.$("leiUpdTexto").value = LC145;
    a.leiAtualizarComparar();
    ok(a.$("dlgLeiPre").open === true, "U10 (o “ Art. 5 [...] devia passar antes pela limpeza de grafia)");
    a.$("btnLeiPreConfirmar").onclick();
    ok(a.$("dlgLeiCob").open === true && a.$("leiUpdPasso2").hidden === true, "U10a a conferencia da versao nova nao abriu antes da comparacao");
    const av = achar(a.$("leiCobAvisos"), (c) => /lei-upd-al/.test(c.className || "")).map((c) => c.textContent).join(" | ");
    ok(/Complementar 145/i.test(av) || /LC 145/i.test(av), "U10b nao avisou que o texto se apresenta como outra lei: " + av);
    ok(/ALTERA/.test(av), "U10c nao avisou que e' uma lei que altera outra: " + av);
    ok(/só \d+ dos 20/.test(av), "U10d nao avisou que tem so uma fração dos artigos: " + av);
    ok(a.$("btnLeiCobConfirmar").disabled === true, "U10e 'continuar' devia esperar a escolha da pessoa");
    const ops = achar(a.$("leiCobOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops.join(",") === "alteracoes,presentes", "U10f para lei que ALTERA so as opcoes seguras (ler como alteradora / so os presentes), nunca 'revogar': " + ops);
    achar(a.$("leiCobOpcoes"), (c) => c.value === "presentes")[0].onchange();
    ok(a.$("btnLeiCobConfirmar").disabled === false, "U10g escolhida a opcao, 'continuar' devia liberar");
    a.$("btnLeiCobConfirmar").onclick();
    const it = a.leiUpdComparoAtual() || [];
    ok(a.$("leiUpdPasso2").hidden === false && a.leiUpdModoAusentesAtual() === "presentes" && !it.some((x) => x.tipo === "revogado"),
       "U10h no modo seguro nenhum artigo podia virar revogado: " + JSON.stringify(it.map((x) => [x.num, x.tipo])));
    const i5 = it.filter((x) => x.num === "5")[0];
    ok(i5 && i5.alertas.some((x) => x.k === "omitido"), "U10i o artigo com '[...]' nao veio com o alerta de trecho omitido: " + JSON.stringify(i5));
    /* a tela mostra os alertas ANTES de decidir, e recusar é uma decisão */
    a.leiUpdMover(4);
    a.leiUpdMostrar();
    const idx = a.leiUpdIdxAtual();
    const alt = achar(a.$("leiUpdItem"), (c) => /lei-upd-al/.test(c.className || "")).map((c) => c.textContent).join(" | ");
    ok(a.leiUpdComparoAtual()[idx].alertas.length === 0 || alt.length > 0, "U10j os alertas do item nao aparecem na tela");
    a.leiUpdAceitar();
    a.leiUpdPular();
    const ac = a.leiUpdComparoAtual();
    ok(ac[idx].aceito === false && ac[idx].recusado === true && /1 recusada/.test(a.$("leiUpdResumo").textContent || ""),
       "U10k 'recusar' nao virou uma decisao registrada: " + a.$("leiUpdResumo").textContent);
    a.leiUpdMover(-1);
    a.leiUpdAceitar();
    a.leiAtualizarAplicar();
    const alv = a.leisLista()[0].alteracoes || {};
    ok(Object.keys(alv).length === 1, "U10l so o item aceito devia entrar na lei (nao os recusados nem os sem decisao): " + JSON.stringify(Object.keys(alv)));
  }

  /* U11: a mesma colagem incompleta de uma lei do MESMO número: o app não decide, pergunta */
  {
    const a = iniciar();
    const l = a.leiGuardar({ nome: "Lei 8/2000", especie: "Lei", numero: "8", ano: "2000", texto: doze() });
    a.leiAbrir("Direito", "T", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "Site";
    a.$("leiUpdTexto").value = "LEI Nº 8, DE 10 DE JANEIRO DE 2000\nArt. 1º Texto do artigo 1 com redação própria e completa da lei.\nArt. 2º Texto novo do artigo dois inteiro.";
    a.leiAtualizarComparar();
    ok(a.$("dlgLeiCob").open === true, "U11 colagem com 2 de 12 artigos nao abriu a conferencia");
    const ops = achar(a.$("leiCobOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops.join(",") === "presentes,revogar", "U11a as opcoes devem ser 'so os presentes' e 'lei inteira': " + ops);
    achar(a.$("leiCobOpcoes"), (c) => c.value === "revogar")[0].onchange();
    a.$("btnLeiCobConfirmar").onclick();
    const it = a.leiUpdComparoAtual();
    ok(it.filter((x) => x.tipo === "revogado").length === 10 && a.leiUpdModoAusentesAtual() === "revogar",
       "U11b escolhida 'lei inteira', os 10 ausentes deviam aparecer como possivelmente revogados");
    /* voltar: nada muda */
    const b = iniciar();
    const l2 = b.leiGuardar({ nome: "Lei 8/2000", especie: "Lei", numero: "8", ano: "2000", texto: doze() });
    b.leiAbrir("Direito", "T", l2.id);
    b.leiAtualizarAbrir();
    b.$("leiUpdFonte").value = "Site";
    b.$("leiUpdTexto").value = "Art. 1º Um.\nArt. 2º Dois.";
    b.leiAtualizarComparar();
    b.$("btnLeiCobVoltar").onclick();
    ok(b.$("dlgLeiCob").open === false && b.$("leiUpdPasso2").hidden === true && b.leiCobCtxAtual() === null && b.$("leiUpdTexto").value === "Art. 1º Um.\nArt. 2º Dois.",
       "U11c voltar da conferencia devia fechar sem comparar e sem mexer no texto");
  }

  /* U12: texto novo completo e da mesma lei segue direto, como sempre */
  {
    const a = iniciar();
    const l = a.leiGuardar({ nome: "Lei 8/2000", especie: "Lei", numero: "8", ano: "2000", texto: doze() });
    a.leiAbrir("Direito", "T", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "Site";
    a.$("leiUpdTexto").value = doze().replace("artigo 3 com", "artigo 3 modificado com");
    ok(a.leiAtualizarComparar() === true && a.$("dlgLeiCob").open !== true && a.$("dlgLeiPre").open !== true,
       "U12 texto completo e da mesma lei foi interrompido por conferencia");
    ok(a.leiUpdComparoAtual().length === 1, "U12a devia haver 1 diferenca: " + a.leiUpdComparoAtual().length);
    /* e o item mostra o texto INTEIRO e as palavras que mudaram marcadas */
    const marc = achar(a.$("leiUpdItem"), (c) => /lei-upd-marca/.test(c.className || "")).map((c) => c.textContent);
    ok(marc.indexOf("modificado") >= 0, "U12b a palavra que mudou nao veio marcada: " + JSON.stringify(marc));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
