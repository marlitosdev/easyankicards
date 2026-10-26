/* =====================================================================
 * A REVISÃO DA COLAGEM NA LC 15/2009 DE CARUARU (v19.23.0)
 *
 * O RELATO: "tentei incluir o código tributário municipal de Caruaru, mas ainda teve algumas impropriedades". O PDF
 * real (296 páginas) reproduzido no navegador mostrou:
 *  · 102 "cabeçalhos" para apagar, só 1 de verdade (o rodapé "Prefeitura de Caruaru…"): os outros eram títulos de
 *    seção ("DAS DISPOSIÇÕES GERAIS" ×16), pedaços de nota partida ("Complementar nº 018, de 09 de outubro de 2009)"),
 *    frases que a lei repete e linhas das tabelas;
 *  · os Anexos I a IX com o título de letras espaçadas ("A N E X O I I"): não reconhecidos, ~11 mil linhas de tabela
 *    iam para dentro do último artigo;
 *  · "LIVRO IV – … Finais." (último item da lista do Art. 2º, termina em ponto) não marcado: virava um LIVRO.
 *
 * Este texto imita as armadilhas, em miniatura: páginas com rodapé e número, títulos repetidos, notas partidas,
 * a lista de LIVROs, anexos espaçados com tabela numerada e números de página no meio.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const RODAPE = "Prefeitura de Caruaru - Praça Sen. Teotônio Vilela, S/N°, Centro, Caruaru/Pernambuco - CEP 55.004-901";
  const CAB_ANEXO = "LEI COMPLEMENTAR Nº 015, 05 DE JANEIRO DE 2009";

  /* o texto em páginas: cada página termina com o rodapé e o número (como no PDF) */
  const linhas = [];
  let pagina = 0;
  const fimDePagina = (cab) => { pagina++; linhas.push(RODAPE, String(pagina)); if (cab) linhas.push(cab); };
  linhas.push("LEI COMPLEMENTAR 015, DE 05 DE JANEIRO DE 2009",
    "Art. 1º. Este Código regula os direitos e obrigações que emanam das relações jurídicas tributárias.",
    "Art. 2º. O Código é constituído de 4 (quatro) Livros, com a matéria, assim distribuída:",
    "LIVRO I - Estabelece Normas Gerais de Direito Tributário aplicáveis ao Município;",
    "LIVRO II - Regula o Sistema Tributário Municipal;",
    "LIVRO III - Regula o Regime Contratual dos Preços Públicos Municipais;",
    "LIVRO IV - Estabelece as Disposições Gerais, Transitórias e Finais.");
  fimDePagina();
  let art = 3;
  for (let p = 0; p < 8; p++) {
    linhas.push("CAPÍTULO " + ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][p], "DAS DISPOSIÇÕES GERAIS");
    linhas.push("Art. " + (art++) + ". A multa será aplicada conforme o regulamento e a tabela própria. (Redação dada pela Lei",
      "Complementar nº 018, de 09 de outubro de 2009)");
    linhas.push("Art. " + (art++) + ". O contribuinte deverá cumprir as obrigações acessórias fixadas em Lei, regulamento ou outro ato.",
      "Parágrafo único. O pagamento será feito na forma estabelecida pela Secretaria Municipal de Finanças.");
    linhas.push("Art. " + (art++) + ". O lançamento será revisto de ofício quando houver erro. (Incluído pela Lei Complementar nº 018, de",
      "09 de outubro de 2009)");
    fimDePagina();
  }
  linhas.push("Art. " + (art++) + ". Esta Lei entra em vigor na data de sua publicação.", "JOSÉ QUEIROZ DE LIMA", "Prefeito");
  fimDePagina(CAB_ANEXO);
  /* os anexos: título espaçado, tabela com itens numerados (1, 2, 3… em linhas próprias) e quebras de página no meio */
  [["I", "LISTA DE SERVIÇOS:"], ["I I", "PENALIDADE (UFMS)"], ["I I I", "TABELA DE ALÍQUOTAS"]].forEach(([rom, tit]) => {
    linhas.push("A N E X O " + rom, tit);
    /* cada anexo ocupa 4 páginas: como no PDF real, boa parte das páginas (e dos rodapés) fica nas tabelas */
    for (let pg = 0; pg < 4; pg++) {
      for (let q = 1; q <= 6; q++) { linhas.push(String(q), "Fabricação de máquinas e equipamentos para", "uso industrial específico, item " + q); }
      fimDePagina(CAB_ANEXO);
    }
  });
  const texto = linhas.join("\n\n");
  const L = texto.split("\n");
  const ln = (s) => L.map((x, i) => (x === s ? i + 1 : 0)).filter(Boolean);

  const { api } = rodar();
  const pre = api.leiPreprocessar(texto);
  const de = (g) => pre.mudancas.filter((m) => m.grupo === g);
  const cab = de("cabecalho");

  /* cabeçalho: só o rodapé e o cabeçalho das páginas de anexo */
  ok(cab.length === 2 && cab.some((m) => m.antes === RODAPE) && cab.some((m) => m.antes === CAB_ANEXO),
    "K1 'cabeçalho' só o que é de página (rodapé e o cabeçalho das páginas de anexo): " + cab.map((m) => m.ocorrencias + "× " + m.antes.slice(0, 40)).join(" | "));
  const rod = cab.find((m) => m.antes === RODAPE);
  ok(rod && rod.ocorrencias === pagina, "K1a o rodapé sai em TODAS as páginas, também nas dos anexos: " + (rod && rod.ocorrencias) + " de " + pagina);
  ok(!cab.some((m) => /DISPOSIÇÕES GERAIS/.test(m.antes)), "K2 o título de seção repetido ('DAS DISPOSIÇÕES GERAIS' ×8) NÃO é cabeçalho");
  ok(!cab.some((m) => /de outubro de 2009\)|Complementar nº 018/.test(m.antes)), "K3 pedaço de nota partida ('Complementar nº 018, de 09 de outubro de 2009)') NÃO é cabeçalho");
  ok(!cab.some((m) => /Secretaria Municipal|obrigações acessórias/.test(m.antes)), "K4 frase que a lei repete NÃO é cabeçalho");
  ok(!cab.some((m) => /Fabricação de máquinas/.test(m.antes)), "K5 linha de tabela de anexo NÃO é cabeçalho");

  /* números de página: todos, também os que caem dentro dos anexos; os itens 1, 2, 3… da tabela ficam */
  const pag = de("pagina")[0];
  ok(pag && pag.ocorrencias === pagina, "P1 todos os " + pagina + " números de página (também dentro dos anexos): " + (pag && pag.ocorrencias));
  const itens = ln("3");
  ok(itens.some((x) => !pag.linhas.includes(x)), "P2 o item 3 das tabelas não é número de página");

  /* LIVROs: os quatro itens da lista, inclusive o último (termina em ponto) */
  const rem = de("remissao");
  ok(["LIVRO I ", "LIVRO II ", "LIVRO III ", "LIVRO IV "].every((p) => rem.some((m) => m.antes.indexOf(p) === 0)), "R1 os 4 LIVROs da lista do Art. 2º são itens, não divisões: " + rem.map((m) => m.antes.slice(0, 10)).join(" | "));
  const r4 = rem.find((m) => /^LIVRO IV /.test(m.antes));
  ok(r4 && r4.motivo === "divisao_ultimo", "R1a o último (em ponto) com motivo próprio: " + (r4 && r4.motivo));
  ok(!rem.some((m) => /^CAPÍTULO/.test(m.antes)), "R2 os CAPÍTULOS de verdade continuam divisões");

  /* anexos: os de título espaçado reconhecidos, e o título corrigido */
  const anx = de("anexo");
  ok(anx.length === 3 && anx.map((m) => m.titulo.split(" —")[0]).join() === "ANEXO I,ANEXO II,ANEXO III", "A1 os anexos de título espaçado reconhecidos: " + anx.map((m) => m.titulo).join(" | "));
  ok(de("grafia").filter((m) => /^A N E X O/.test(m.antes)).length === 3, "A2 a grafia 'A N E X O I I' → 'ANEXO II' aparece como sugestão");

  /* aplicado (tudo aceito): o último artigo termina onde termina, os anexos separados, sem rodapé nem número */
  const ap = api.leiAplicarPreprocesso(texto, pre.mudancas, {});
  ok(ap.anexos.length === 3 && /Fabricação de máquinas/.test(ap.anexos[0].texto) && !/Prefeitura de Caruaru/.test(ap.anexos[0].texto) && !/^\s*\d+\s*$/m.test(ap.anexos[0].texto.replace(/^\d+$/gm, (x) => (Number(x) <= 6 ? "" : x))),
    "A3 aplicado: 3 anexos à parte, com a tabela e sem o rodapé de página");
  ok(!/Fabricação/.test(ap.texto) && /Art\. \d+\. Esta Lei entra em vigor/.test(ap.texto), "A4 o último artigo não engole as tabelas");
  ok(/DAS DISPOSIÇÕES GERAIS/.test(ap.texto) && /Complementar nº 018, de 09 de outubro de 2009\)/.test(ap.texto), "A5 os títulos de seção e as notas continuam no texto");
  ok(!/Prefeitura de Caruaru/.test(ap.texto), "A6 o rodapé saiu do texto");
  ok(/assim distribuída: LIVRO I .*LIVRO IV - Estabelece as Disposições Gerais, Transitórias e Finais\./.test(ap.texto.replace(/\n+/g, " ")), "A7 a lista do Art. 2º fica dentro dele, até o LIVRO IV");

  /* sem números de página no texto, a regra antiga com espaçamento regular continua achando o cabeçalho */
  {
    const sem = [];
    for (let p = 0; p < 6; p++) { sem.push("Diário Oficial do Município de Exemplo — Edição Especial"); for (let q = 0; q < 12; q++) sem.push("Art. " + (p * 12 + q + 1) + ". Texto do artigo número " + (p * 12 + q + 1) + "."); }
    const p2 = api.leiPreprocessar(sem.join("\n\n"));
    ok(p2.mudancas.some((m) => m.grupo === "cabecalho" && /Diário Oficial/.test(m.antes)), "S1 sem números de página: o cabeçalho regular continua achado");
  }
  /* a numeração de uma tabela que chega ao número da página não "rouba" a sequência das páginas */
  {
    const t = [];
    for (let p = 1; p <= 8; p++) {
      for (let q = 0; q < 8; q++) t.push("Art. " + (p * 10 + q) + ". Texto do artigo " + (p * 10 + q) + " desta lei, completo.");
      t.push(String(p));
      if (p === 4) { t.push("ANEXO I", "TABELA"); for (let q = 1; q <= 6; q++) t.push(String(q), "Item da tabela número " + q); }
    }
    const p3 = api.leiPreprocessar(t.join("\n\n"));
    const pg = p3.mudancas.find((m) => m.grupo === "pagina");
    const L3 = t.join("\n\n").split("\n");
    const nums = pg ? pg.linhas.map((x) => L3[x - 1]).join(",") : "";
    const linhasPag = L3.map((x, i) => (/^Art. 4[0-9]/.test(L3[i - 2] || "") || /^Art. d+/.test(L3[i - 2] || "")) && /^d+$/.test(x) ? i + 1 : 0).filter(Boolean);
    ok(nums === "1,2,3,4,5,6,7,8" && pg.linhas.every((x) => /^Art./.test(L3[x - 3] || "")), "P3 só os 8 números de página (as linhas certas), nenhum item da tabela: " + nums);
  }
  /* sem números de página, uma frase repetida ao acaso pelo texto NÃO é cabeçalho (espaçamento irregular) */
  {
    const t = [];
    for (let q = 1; q <= 80; q++) {
      t.push("Art. " + q + ". Texto do artigo " + q + ".");
      if ([3, 4, 40, 77].includes(q)) t.push("O pagamento será feito na forma estabelecida pela Secretaria Municipal de Finanças");
    }
    const p4 = api.leiPreprocessar(t.join("\n\n"));
    ok(!p4.mudancas.some((m) => m.grupo === "cabecalho"), "S2 sem números de página: frase repetida ao acaso não é cabeçalho");
  }
  /* todo motivo de remissão tem texto (a tela mostrava a chave crua "lei_pre_rem_divisao_ultimo") */
  ["pt", "en"].forEach((l) => { api.setLanguage(l); rem.forEach((m) => ok(api.t("lei_pre_rem_" + m.motivo) !== "lei_pre_rem_" + m.motivo, "X falta lei_pre_rem_" + m.motivo + " em " + l)); });
  api.setLanguage("pt");
  /* o pedaço de frase (puro) */
  ok(api.leiPedacoDeFrase("de 09 de outubro de 2009)") && api.leiPedacoDeFrase("018, de 09 de outubro de 2009).") && api.leiPedacoDeFrase("Complementar nº 018, de 09 de outubro de 2009)")
    && !api.leiPedacoDeFrase(RODAPE) && !api.leiPedacoDeFrase("(Redação dada pela LC 018/09)"), "F1 pedaço de frase reconhecido; rodapé e nota inteira não");
  return falhas;
}

module.exports = { testes };
