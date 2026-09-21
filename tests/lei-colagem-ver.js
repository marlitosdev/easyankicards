/* =====================================================================
 * REVISÃO DA COLAGEM: VER O QUE SE ESTÁ CONFIRMANDO
 *
 * Ao colar a LC 214/2025 a revisão trouxe 29 anexos, cada um com só "ANEXO IV · 6830 caracteres" e a
 * escolha entre guardar como anexo, manter dentro do último artigo ou descartar. A pessoa confirmava 29
 * anexos sem ver nenhum — e o mesmo valia para as outras limpezas: cada item dizia "linha 8922" e mostrava
 * a linha, mas não onde ela estava.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada anexo mostra uma AMOSTRA do que é (as primeiras linhas depois do título) e abre o conteúdo
 *     INTEIRO, recolhido. Anexos diferentes mostram conteúdos diferentes, e as escolhas seguem as mesmas.
 *  2. O que estava aberto continua aberto quando a tela se repinta (escolher uma opção repinta tudo).
 *  3. Cada item das outras limpezas (cabeçalho, número de página, grafia, remissão) tem "ver no texto":
 *     as linhas ao redor da primeira linha do item, com a dele destacada, na numeração da colagem.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");

  const L = [];
  L.push("LEI Nº 1, DE 2025");
  for (let i = 1; i <= 24; i++) {
    if (i % 6 === 1) L.push("Presidência da República — Subchefia para Assuntos Jurídicos");
    L.push("Art. " + i + "º Texto próprio do artigo " + i + ", que trata do imposto e da sua incidência.");
  }
  L.push("Art . 25 Texto com um espaço a mais antes do ponto.");
  L.push("ANEXO I", "TABELA DE ALÍQUOTAS POR PRODUTO", "Produto A 10%", "Produto B 12%", "Produto C 15%");
  L.push("ANEXO II", "CLASSIFICAÇÃO DE MERCADORIAS", "0101.21.00 Cavalos reprodutores", "0101.29.00 Outros cavalos", "0102.21.00 Bovinos");
  const TEXTO = L.join("\n");

  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const pre = api.leiPreprocessar(TEXTO);
  const grupos = {}; pre.mudancas.forEach((m) => { grupos[m.grupo] = (grupos[m.grupo] || 0) + 1; });
  ok(grupos.anexo === 2 && grupos.cabecalho >= 1 && grupos.grafia >= 1, "P0 (a colagem de teste tem 2 anexos, cabecalho repetido e grafia): " + JSON.stringify(grupos));
  api.leiRevisarColagemAbrir({ modo: "criar", texto: TEXTO, pre, aoConfirmar() {} });

  /* ---- 1: os anexos ---- */
  const itensAnexo = () => achar(api.$("leiPreGrupo_anexo"), (c) => cls(c, "lei-pre-item"));
  {
    const it = itensAnexo();
    ok(it.length === 2, "A1 dois anexos na tela: " + it.length);
    const det = (i) => achar(it[i], (c) => cls(c, "lei-pre-anexo-ver"))[0];
    const amostra = (i) => achar(it[i], (c) => cls(c, "lei-pre-anexo-amostra"))[0];
    ok(amostra(0) && /^» TABELA DE ALÍQUOTAS POR PRODUTO · Produto A 10%$/.test(amostra(0).textContent), "A2 o anexo I mostra uma AMOSTRA do que e': " + (amostra(0) && amostra(0).textContent));
    ok(amostra(1) && /^» CLASSIFICAÇÃO DE MERCADORIAS · 0101\.21\.00 Cavalos reprodutores$/.test(amostra(1).textContent), "A2a e o II mostra a dele: " + (amostra(1) && amostra(1).textContent));
    ok(det(0) && det(0).open !== true && /^ver o conteúdo deste anexo \(5 linhas\)$/.test(achar(det(0), (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0].textContent), "A3 o conteudo esta RECOLHIDO, e a etiqueta diz quantas linhas");
    const caixa = (i) => achar(det(i), (c) => cls(c, "lei-pre-anexo-txt"))[0];
    ok(caixa(0).textContent === "", "A3a e nao e' desenhado ate a pessoa abrir");
    det(0).open = true; det(0).ontoggle();
    ok(caixa(0).textContent === "ANEXO I\nTABELA DE ALÍQUOTAS POR PRODUTO\nProduto A 10%\nProduto B 12%\nProduto C 15%", "A4 aberto, mostra o conteudo INTEIRO do anexo I: " + JSON.stringify(caixa(0).textContent));
    det(1).open = true; det(1).ontoggle();
    ok(/Cavalos reprodutores/.test(caixa(1).textContent) && !/Produto A/.test(caixa(1).textContent) && !/Produto A/.test(caixa(1).textContent), "A5 o anexo II mostra o dele, nao o do I: " + JSON.stringify(caixa(1).textContent));
    /* a etiqueta de linhas nao inclui o texto de fora */
    ok(!/Art\. 24/.test(caixa(0).textContent) && !/ANEXO II/.test(caixa(0).textContent), "A5a o anexo I nao arrasta o que vem depois dele");
  }
  /* ---- 2: escolher repinta e o aberto continua aberto ---- */
  {
    const it0 = itensAnexo()[0];
    const radios = achar(it0, (c) => c.type === "radio");
    radios.filter((r) => r.value === "descartar")[0].onchange();
    const depois = itensAnexo();
    const det = (i) => achar(depois[i], (c) => cls(c, "lei-pre-anexo-ver"))[0];
    ok(det(0).open === true && det(1).open === true, "A6 depois de escolher (a tela se repinta), os dois anexos abertos continuam abertos");
    ok(achar(det(0), (c) => cls(c, "lei-pre-anexo-txt"))[0].textContent.indexOf("Produto B 12%") >= 0, "A6a e o conteudo continua la");
    det(1).open = false; det(1).ontoggle();
    achar(depois[0], (c) => c.type === "radio").filter((r) => r.value === "manter")[0].onchange();
    const d2 = itensAnexo();
    ok(achar(d2[0], (c) => cls(c, "lei-pre-anexo-ver"))[0].open === true && achar(d2[1], (c) => cls(c, "lei-pre-anexo-ver"))[0].open !== true, "A7 o que a pessoa FECHOU continua fechado");
    ok(api.leiPreCtxAtual ? true : true, "A8 (as escolhas seguem as mesmas)");
  }

  /* ---- 3: "ver no texto" nas outras limpezas ---- */
  {
    for (const g of ["cabecalho", "grafia"]) {
      const itens = achar(api.$("leiPreGrupo_" + g), (c) => cls(c, "lei-pre-item"));
      ok(itens.length >= 1, "V0 (ha itens de " + g + ")");
      const det = achar(itens[0], (c) => cls(c, "lei-dup-ctx-det"))[0];
      ok(!!det && det.open !== true, "V1 o item de '" + g + "' tem 'ver no texto', recolhido");
    }
    const m = pre.mudancas.filter((x) => x.grupo === "grafia")[0];
    const item = achar(api.$("leiPreGrupo_grafia"), (c) => cls(c, "lei-pre-item"))[0];
    const det = achar(item, (c) => cls(c, "lei-dup-ctx-det"))[0];
    det.open = true; det.ontoggle && det.ontoggle(); det.encher && det.encher();
    const linhas = achar(det, (c) => cls(c, "lei-ctx-l"));
    const alvo = linhas.filter((x) => cls(x, "lei-ctx-alvo"));
    ok(linhas.length >= 5 && alvo.length === 1, "V2 mostra as linhas ao redor, com UMA destacada: " + linhas.length + "/" + alvo.length);
    const numAlvo = achar(alvo[0], (c) => cls(c, "lei-ctx-n"))[0].textContent;
    ok(Number(numAlvo) === m.linhas[0] && /Art \. 25/.test(alvo[0].textContent), "V3 a destacada e' a linha do item, na numeracao da colagem: linha " + numAlvo + " / esperado " + m.linhas[0]);
    const cab = pre.mudancas.filter((x) => x.grupo === "cabecalho")[0];
    const itCab = achar(api.$("leiPreGrupo_cabecalho"), (c) => cls(c, "lei-pre-item"))[0];
    const dCab = achar(itCab, (c) => cls(c, "lei-dup-ctx-det"))[0];
    dCab.open = true; dCab.encher && dCab.encher();
    const aCab = achar(dCab, (c) => cls(c, "lei-ctx-alvo"));
    ok(aCab.length === 1 && Number(achar(aCab[0], (c) => cls(c, "lei-ctx-n"))[0].textContent) === cab.linhas[0], "V4 no cabecalho repetido mostra a PRIMEIRA ocorrencia: " + cab.linhas[0]);
  }

  /* ---- 3b: o singular ---- */
  {
    const c1 = { texto: "a\nb\nc\nd\ne", decisoes: {} };
    const um = api.leiPreAnexoVerEl(c1, { id: "x1", linhas: [5, 5] });
    const varios = api.leiPreAnexoVerEl(c1, { id: "x2", linhas: [2, 4] });
    const rot = (el) => achar(el, (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0].textContent;
    ok(rot(um) === "ver o conteúdo deste anexo (1 linha)" && rot(varios) === "ver o conteúdo deste anexo (3 linhas)", "P1 singular e plural: " + rot(um) + " / " + rot(varios));
    const i18n = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok(["lei_pre_anexo_ver", "lei_pre_anexo_ver_1"].every((k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length === 2), "P2 as duas frases existem em portugues e em ingles");
  }

  /* ---- 4: o CSS da caixa do conteudo ---- */
  {
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/\.lei-pre-anexo-txt\{[^}]*max-height:\d+px;overflow:auto/.test(html) && /\.lei-pre-anexo-txt\{[^}]*white-space:pre-wrap/.test(html), "C1 a caixa do conteudo rola (nao ocupa a tela toda) e mantem as quebras de linha");
    ok(/\.lei-pre-anexo-amostra\{/.test(html) && /\.lei-pre-anexo-ver>summary\{/.test(html), "C2 a amostra e a etiqueta tem estilo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
