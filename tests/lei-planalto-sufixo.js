/* =====================================================================
 * A LC 116 DO PLANALTO: "Art. 8o-A", a "Lista de serviços anexa" e a tela de conferir (19.157.0)
 *
 * O RELATO: ao incluir a LC 116/2003 (arquivo do Planalto), a revisão dizia "a numeração volta" e "o Art. 10 ficaria
 * com 29 mil caracteres". As causas: "Art. 8o-A" e "Art. 8º-B" (ordinal antes da letra) ficavam sem ordem; o Art. 9
 * parecia voltar na numeração, era lido como remissão, juntado à linha de cima — e sumia; e a "Lista de serviços anexa
 * à Lei Complementar nº 116" não era reconhecida como anexo. A tela apontava o problema sem causa nem correção.
 *
 * O QUE PRECISA SER VERDADE:
 *  P1. a ORDEM de "8o-A"/"8º-B" é a do 8-A/8-B; a IDENTIDADE (leiNumNormal) não muda — é chave de notas e marcadores;
 *  P2. a sequência 8º · 8o-A · 8º-B · 9º · 10 não tem problema, e o Art. 9 não vira remissão;
 *  P3. "Lista de serviços anexa à Lei…" (linha de título) vira anexo; "da lista anexa;" dentro de inciso, não;
 *  P4. artigo com letra sem o artigo-base antes (2º → 3º-A) é ponto grave;
 *  P5. a causa provável: a sugestão aceita que junta um "Art. N" na faixa do problema, com "É artigo — não juntar";
 *  P6. o artigo grande demais oferece "separar daqui como anexo" nas linhas com cara de título.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = "\n";
  const LEI = [
    "LEI COMPLEMENTAR Nº 116, DE 31 DE JULHO DE 2003",
    "",
    "Art. 1o O Imposto Sobre Serviços tem como fato gerador a prestação de serviços constantes da lista anexa.",
    "",
    "Art. 2o O imposto não incide sobre:",
    "I – as exportações de serviços para o exterior do País;",
    "",
    "Art. 3o O serviço considera-se prestado no local do estabelecimento prestador, exceto:",
    "III – da execução da obra, no caso dos serviços descritos no subitem 7.02 da lista anexa;",
    "",
    "Art. 4o Considera-se estabelecimento prestador o local onde o contribuinte desenvolva a atividade.",
    "",
    "Art. 5o Contribuinte é o prestador do serviço.",
    "",
    "Art. 6o Os Municípios poderão atribuir a responsabilidade pelo crédito tributário.",
    "",
    "Art. 7o A base de cálculo do imposto é o preço do serviço.",
    "",
    "Art. 8o As alíquotas máximas são as seguintes:",
    "II – demais serviços, 5% (cinco por cento).",
    "",
    "Art. 8o-A. A alíquota mínima do Imposto é de 2% (dois por cento).",
    "",
    "Art. 8º-B. Em relação aos fatos geradores de 2029 a 2032, as alíquotas serão reduzidas.",
    "§ 1º No período de que trata o caput, os benefícios serão reduzidos. (Incluído pela Lei Complementar nº 214, de 2025) Produção de efeitos",
    "",
    "Art. 9o Esta Lei Complementar entra em vigor na data de sua publicação.",
    "",
    "Art. 10. Ficam revogados os arts. 8o, 10, 11 e 12 do Decreto-Lei no 406, de 31 de dezembro de 1968.",
    "",
    "Brasília, 31 de julho de 2003; 182o da Independência e 115o da República.",
    "",
    "Lista de serviços anexa à Lei Complementar nº 116, de 31 de julho de 2003.",
    "",
    "1 – Serviços de informática e congêneres.",
    "1.01 – Análise e desenvolvimento de sistemas.",
    "1.02 – Programação.",
    "2 – Serviços de pesquisas e desenvolvimento de qualquer natureza.",
    "2.01 – Serviços de pesquisas e desenvolvimento de qualquer natureza.",
  ].join(NL);

  /* P1 */
  {
    const { api } = rodar();
    ok(api.leiNumOrdem("8o-A") === 801 && api.leiNumOrdem("8º-B") === 802 && api.leiNumOrdem("8O-A") === 801 && api.leiNumOrdem("8-A") === 801 && api.leiNumOrdem("9º") === 900,
      "P1a a ordem do 8o-A e do 8º-B é a do 8-A e do 8-B: " + [api.leiNumOrdem("8o-A"), api.leiNumOrdem("8º-B")].join(","));
    ok(api.leiNumNormal("8º-A") === "8º-A" && api.leiNumNormal("8º") === "8", "P1b a identidade do artigo não muda (é chave de notas, marcador e vínculos)");
  }

  /* P2 + P3 */
  {
    const { api } = rodar();
    const pre = api.leiPreprocessar(LEI);
    const rem = pre.mudancas.filter((m) => m.grupo === "remissao");
    ok(!rem.length, "P2a o Art. 9o não vira remissão: " + rem.map((m) => m.linhas.join("-")).join(","));
    const arts = api.leiArtigos(LEI);
    const nm = api.leiNumeracao(arts);
    ok(!nm.problemas.length, "P2b 8º · 8o-A · 8º-B · 9º · 10 em sequência: " + JSON.stringify(nm.problemas.map((p) => p.tipo + " " + p.numCru)));
    const anx = pre.mudancas.filter((m) => m.grupo === "anexo");
    ok(anx.length === 1 && /^Lista de serviços anexa à Lei Complementar nº 116/.test(anx[0].titulo) && anx[0].decisaoPadrao === "separar", "P3a a lista de serviços vira anexo: " + JSON.stringify(anx.map((m) => m.titulo)));
    const res = api.leiAplicarPreprocesso(LEI, pre.mudancas, {});
    const depois = api.leiArtigos(res.texto);
    const a10 = depois.filter((a) => a.numCru === "10")[0];
    ok(depois.length === 12 && depois.some((a) => a.numCru === "9º") && a10 && a10.texto.length < 400 && (res.anexos || []).length === 1,
      "P3b depois: 12 artigos com o 9º, o Art. 10 curto e a lista como anexo: " + depois.map((a) => a.numCru).join(" ") + " · art.10 " + (a10 && a10.texto.length));
    ok(!api.leiEhAnexoNomeado("III – da execução da obra, no caso dos serviços descritos no subitem 7.02 da lista anexa;") && api.leiEhAnexoNomeado("Tabela anexa à Lei nº 1.234, de 2001") && api.leiEhAnexoNomeado("Quadro anexo ao Decreto nº 99, de 2020."),
      "P3c 'da lista anexa' no meio de um inciso não é anexo; 'Tabela anexa à Lei…' e 'Quadro anexo ao Decreto…' são");
  }

  /* P4 */
  {
    const { api } = rodar();
    const t4 = ["Art. 1º. A.", "Art. 2º. B.", "Art. 3º-A. C.", "Art. 4º. D.", "Art. 5º. E.", "Art. 6º. F.", "Art. 7º. G.", "Art. 8º. H.", "Art. 9º. I."].join(NL);
    const nm = api.leiNumeracao(api.leiArtigos(t4));
    ok(nm.graves.some((p) => p.tipo === "sem_base" && /3º-A/.test(p.numCru)), "P4 o 3º-A sem o 3º antes é ponto grave: " + JSON.stringify(nm.problemas.map((p) => p.tipo + " " + p.numCru)));
  }

  /* P5 + P6: a tela de conferir */
  {
    const { api } = rodar();
    const tx = ["Art. 1º. A.", "Art. 2º. B.", "Art. 8º. C.", "texto (Incluído pela LC 214) Produção de efeitos", "Art. 9o Esta Lei entra em vigor.", "Art. 10. Revogam-se."].join(NL);
    const c = { texto: tx, decisoes: { r1: true }, pre: { mudancas: [{ id: "r1", grupo: "remissao", linhas: [5], antes: "", depois: "" }] } };
    const causas = api.leiPreCausasNum(c, { tipo: "volta", numCru: "10", de: "8º-B", faltam: [] });
    ok(causas.length === 1 && causas[0].num === 9 && causas[0].linha === 5, "P5a a causa provável: a sugestão que junta o 'Art. 9o' à linha de cima");
    c.decisoes.r1 = false;
    ok(!api.leiPreCausasNum(c, { tipo: "volta", numCru: "10", de: "8º-B", faltam: [] }).length, "P5b recusada ('é artigo — não juntar'), ela deixa de ser causa");
    /* a tela: com a lista colada dentro do Art. 10 (sem o título reconhecível de anexo), o "separar daqui" */
    const tx6 = LEI.replace("Lista de serviços anexa à Lei Complementar nº 116, de 31 de julho de 2003.", "TABELA DE SERVIÇOS DO IMPOSTO");
    const longo = tx6 + NL + Array.from({ length: 400 }, (_, k) => (k + 3) + ".01 – Serviço de exemplo número " + k + " com uma descrição comprida o bastante.").join(NL);
    api.leiRevisarColagemAbrir({ modo: "criar", texto: longo, pre: api.leiPreprocessar(longo), aoConfirmar: () => {} });
    const bt = api.$("btnLeiPreAnexoDaqui_0");
    ok(!!bt && /Art\. 10 ficaria com/.test(api.$("leiPreComo").textContent) && /TABELA DE SERVIÇOS/.test(api.$("leiPreComo").textContent),
      "P6a o Art. 10 grande demais oferece separar a partir de 'TABELA DE SERVIÇOS DO IMPOSTO': " + api.$("leiPreComo").textContent.slice(0, 200));
    if (bt) bt.onclick();
    const ctx = api.leiPreCtxAtual ? api.leiPreCtxAtual() : null;
    ok(!/Art\. 10 ficaria com/.test(api.$("leiPreComo").textContent) && /anexo/i.test(api.$("leiPreComo").textContent), "P6b separado: o Art. 10 deixa de ser grande demais e a lei ganha um anexo: " + api.$("leiPreComo").textContent.slice(0, 160));
    ok(!/1 para você decidir/.test(api.$("leiPreResumo").textContent), "P6c o anexo marcado à mão já nasce como 'guardar à parte' (não fica 'para você decidir'): " + api.$("leiPreResumo").textContent);
    void ctx;
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
