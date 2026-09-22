/* =====================================================================
 * O QUE O PRÓPRIO TEXTO DIZ QUE ESTÁ REVOGADO, VETADO OU SUPRIMIDO (etapa 1 da estratégia de revogados)
 *
 * A LC 214 compilada traz 34 "(Revogado…)" e 31 "(VETADO)" — em artigo, parágrafo, inciso, alínea e no título de
 * anexo ("ANEXO XIV" seguido de "(Revogado pela Lei Complementar nº 227, de 2026)"). O app os guardava e mostrava
 * como texto comum: um anexo revogado entrava na lei como qualquer outro.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Só conta a linha que é SÓ a marca (número do dispositivo + "(Revogado…)"/"(VETADO)" + notas editoriais).
 *     "Fica revogado o art. 5º", "(Revogado) e depois texto", "§ 1º Texto (Redação dada…)" NÃO contam.
 *  2. O ARTIGO consta como revogado quando o cabeçalho é a marca e o resto são só marcas ou notas. Um artigo com o
 *     caput normal e um § revogado NÃO é revogado. A faixa "Arts. 12 a 15 (Revogados…)" conta.
 *  3. O § / inciso / alínea revogado fica esmaecido no leitor (classe na linha), sem sumir.
 *  4. O anexo cujo corpo é só a marca vem marcado na revisão da colagem e, ao ser separado, guardado como REVOGADO
 *     (mesmo formato que uma lei alteradora usa) — nada se perde. Anexo com tabela não é revogado.
 *  5. O leitor mostra o selo "revogado (consta no texto)" no artigo; a camada de alteração, quando existe, manda.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
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
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const p = iniciar();

  /* ---- 1: a linha ---- */
  {
    const sim = [
      ["§ 8º (Revogado).      (Redação dada pela Lei Complementar nº 227, de 2026)", "revogado", "Lei Complementar nº 227, de 2026"],
      ["III - (VETADO);", "vetado", ""],
      ["Art. 495. (VETADO).     Produção de efeitos", "vetado", ""],
      ["Art. 5º (Revogado pela Lei nº 9, de 2010)", "revogado", "Lei nº 9, de 2010"],
      ["Art. 217. (Revogado pela Lei Complementar nº 227, de 2026)", "revogado", "Lei Complementar nº 227, de 2026"],
      ["Arts. 12 a 15 (Revogados pela LC 9/2010)", "revogado", "LC 9/2010"],
      ["Artigos 3 a 4 (Revogados)", "revogado", ""],
      ["a) (Revogada)", "revogado", ""],
      ["1. (Revogado)", "revogado", ""],
      ["Parágrafo único. (Revogado)", "revogado", ""],
      ["§ 2º a 4º (Revogados)", "revogado", ""],
      ["IV - (Suprimido)", "suprimido", ""],
      ["Art. 5º-A. (VETADO)", "vetado", ""],
      ["ANEXO XIV (Revogado pela Lei Complementar nº 227, de 2026)", "revogado", "Lei Complementar nº 227, de 2026"],
    ];
    sim.forEach(([s, tipo, fonte]) => {
      const r = p.leiRevogacaoDaLinha(s);
      ok(r && r.tipo === tipo && r.fonte === fonte, "L1 devia ser '" + tipo + "' (" + fonte + "): " + s + " -> " + JSON.stringify(r));
    });
    [
      "§ 8º O prazo será revogado quando cumprido.", "Art. 3º Fica revogado o art. 5º.", "§ 1º Texto normal (Redação dada pela LC 1)",
      "III - (Revogado) e depois texto normal que voltou", "Art. 5º (Revogado pela Lei nº 9) Texto novo do artigo que voltou a vigorar",
      "Art. 7º Os débitos revogados serão pagos.", "(Revogado pela Lei nº 9)", "", "II - antigo texto (Vetado o parágrafo único)",
    ].forEach((s) => ok(p.leiRevogacaoDaLinha(s) === null, "L2 NAO devia constar como revogado: " + s));
  }

  /* ---- 2: o artigo ---- */
  const TEXTO = ["Art. 1º Texto um normal do artigo.",
    "Art. 2º (Revogado pela Lei nº 9, de 2010)",
    "Art. 3º Texto normal do três, com parágrafos:",
    "§ 1º (Revogado).      (Redação dada pela Lei Complementar nº 227, de 2026)",
    "§ 2º Texto do dois do artigo três.",
    "Art. 4º (VETADO).     Produção de efeitos",
    "Art. 5º (Revogado)",
    "§ 1º (Revogado)",
    "Arts. 6 a 8 (Revogados pela LC 9/2010)",
    "Art. 9º Fica revogado o art. 5º desta Lei.",
    "Art. 10. Texto normal do dez.",
    "III - (VETADO);"].join("\n");
  const arts = p.leiArtigos(TEXTO);
  const por = (num) => arts.filter((a) => a.num === num)[0];
  {
    ok(por("1").revogacao === null && por("3").revogacao === null && por("9").revogacao === null && por("10").revogacao === null, "A1 artigo com texto NAO consta como revogado (nem o que tem um § revogado, nem o que ordena revogar)");
    ok(por("2").revogacao && por("2").revogacao.tipo === "revogado" && por("2").revogacao.fonte === "Lei nº 9, de 2010", "A2 'Art. 2º (Revogado pela …)': " + JSON.stringify(por("2").revogacao));
    ok(por("4").revogacao && por("4").revogacao.tipo === "vetado", "A3 'Art. 4º (VETADO)' com 'Produção de efeitos': " + JSON.stringify(por("4").revogacao));
    ok(por("5").revogacao && por("5").revogacao.tipo === "revogado", "A4 o artigo e todos os seus § revogados: revogado");
    ok(por("6").revogacao && por("6").faixaFim === 8 && por("6").revogacao.fonte === "LC 9/2010", "A5 a faixa 'Arts. 6 a 8 (Revogados…)': " + JSON.stringify(por("6") && por("6").revogacao));
    ok(por("10").revogacao === null, "A6 o inciso solto no fim (III - (VETADO);) nao vira artigo revogado nem contamina o 10");
    ok(p.leiArtigos("Art. 1º (Revogado)\nTexto que sobrou depois da marca, e que vale.\nArt. 2º Dois.")[0].revogacao === null, "A7 cabecalho revogado mas com TEXTO depois: nao consta como revogado (o texto e' lei)");
  }

  /* ---- 3: a linha esmaecida ---- */
  {
    const h = p.leiCorpoHtml(por("3"), null);
    const rev = h.match(/<p class="lei-linha-rev">[^<]*<\/p>/g) || [];
    ok(rev.length === 1 && /§ 1º \(Revogado\)/.test(rev[0]), "B1 so' o § revogado ganha a classe (caput e § 2º ficam normais): " + JSON.stringify(rev));
    ok(/<p>§ 2º Texto do dois/.test(h) && /<p>Art\. 3º Texto normal/.test(h), "B2 as outras linhas saem como sempre");
    ok(/Revogado/.test(rev[0]), "B3 o texto do § revogado continua na tela (esmaecido, nao apagado)");
    /* o artigo que tem um bloco citado: as pecas de texto entre os blocos tambem esmaecem */
    const T20 = ["Art. 19. Normal.", "Art. 20. A Lei nº 123, de 2006, passa a vigorar com as seguintes alterações:", "“Art. 13. Texto do treze.” (NR)", "§ 3º (Revogado).", "Art. 21. Normal."].join("\n");
    const a20 = p.leiArtigos(T20).filter((a) => a.num === "20")[0];
    const cit = p.leiLerCitacoes(T20.split("\n"), {});
    const h20 = p.leiCorpoHtml(a20, cit);
    ok(cit.blocos.length === 1 && /lei-citacao/.test(h20) && /<p class="lei-linha-rev">§ 3º \(Revogado\)\.<\/p>/.test(h20), "B4 no artigo com bloco citado, o § revogado fora do bloco tambem esmaece: " + h20.slice(0, 300));
  }

  /* ---- 4: o leitor: selo e esmaecido; a camada manda ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2020", texto: TEXTO });
    api.leiAbrir("Direito", "T", l.id);
    const leitura = api.$("leiLeitura");
    const bloco = (num) => achar(leitura, (c) => c.id === "leiArt_" + num)[0];
    const selos = (num) => achar(bloco(num), (c) => cls(c, "lei-selo-txt"));
    ok(selos("2").length === 1 && /^revogado \(consta no texto\) · Lei nº 9, de 2010$/.test(selos("2")[0].textContent) && cls(bloco("2"), "lei-art-rev"),
      "S1 o art. 2º tem o selo 'revogado (consta no texto) · fonte' e o bloco esmaecido: " + (selos("2")[0] && selos("2")[0].textContent));
    ok(selos("4").length === 1 && /^vetado \(consta no texto\)$/.test(selos("4")[0].textContent), "S2 o art. 4º tem o selo 'vetado'");
    ok(selos("1").length === 0 && selos("3").length === 0 && !cls(bloco("3"), "lei-art-rev") && selos("10").length === 0, "S3 artigo com texto (mesmo com § revogado) NAO ganha selo");
    ok(/Continua guardado/.test(selos("2")[0].title || "") && /nada foi apagado/.test(selos("2")[0].title || ""), "S4 o selo diz que nada foi apagado");
    /* a camada de alteracao manda */
    const api2 = iniciar();
    const l2 = api2.leiGuardar({ nome: "Lei 2/2020", texto: TEXTO, alteracoes: { "2": { texto: "", fonteAlteracao: "LC 77/2024", data: "2026-01-01", revogado: true } } });
    api2.leiAbrir("Direito", "T", l2.id);
    const b2 = achar(api2.$("leiLeitura"), (c) => c.id === "leiArt_2")[0];
    ok(achar(b2, (c) => cls(c, "lei-selo-txt")).length === 0 && achar(b2, (c) => cls(c, "lei-selo-revogado")).length === 1, "S5 com a camada de alteracao (LC 77/2024) o selo e' o da camada, sem duplicar");
  }

  /* ---- 5: o anexo ---- */
  const AX = ["Art. 1º Um.", "Art. 2º Dois.",
    "ANEXO XIV", "(Revogado pela Lei Complementar nº 227, de 2026)",
    "ANEXO XV (Revogado pela Lei nº 9, de 2010)",
    "ANEXO XVI", "TABELA DE ALÍQUOTAS", "Produto A 10%",
    "ANEXO XVII", "TABELA REVOGADA EM PARTE", "Produto B 12%", "(Revogado pela Lei nº 9)",
    "ANEXO XVIII", "DISPOSITIVOS DIVERSOS", "(Revogado pela Lei Complementar nº 227, de 2026)", "Produção de efeitos"].join("\n");
  {
    const pre = p.leiPreprocessar(AX);
    const ax = pre.mudancas.filter((m) => m.grupo === "anexo");
    const de = (rom) => ax.filter((m) => m.titulo.indexOf("ANEXO " + rom) === 0)[0];
    ok(ax.length === 5, "X0 (5 anexos na colagem de teste): " + ax.map((m) => m.titulo));
    ok(de("XIV").revogado && de("XIV").revogado.tipo === "revogado" && de("XIV").revogado.fonte === "Lei Complementar nº 227, de 2026", "X1 'ANEXO XIV' + '(Revogado pela …)': " + JSON.stringify(de("XIV").revogado));
    ok(de("XV").revogado && de("XV").revogado.fonte === "Lei nº 9, de 2010", "X2 a marca no proprio titulo (corpo vazio): " + JSON.stringify(de("XV").revogado));
    ok(!de("XVI").revogado && !de("XVII").revogado, "X3 anexo com TABELA nao e' revogado (nem o que tem a nota no fim, depois do conteudo)");
    ok(de("XVIII").revogado && de("XVIII").revogado.fonte === "Lei Complementar nº 227, de 2026", "X4 um subtitulo em maiusculas + a marca + 'Producao de efeitos': " + JSON.stringify(de("XVIII").revogado));
    /* aplicar */
    const dec = {}; pre.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "separar" : true; });
    const res = p.leiAplicarPreprocesso(AX, pre.mudancas, dec);
    const rv = res.anexos.filter((a) => a.revogado);
    ok(res.anexos.length === 5 && rv.length === 3 && res.resumo.anexosRevogados === 3, "X5 os 5 anexos sao separados (nada se perde) e 3 saem marcados como revogados: " + JSON.stringify([res.anexos.length, rv.length, res.resumo.anexosRevogados]));
    const xiv = res.anexos.filter((a) => /^ANEXO XIV/.test(a.titulo))[0];
    ok(xiv.revogado === true && xiv.fonteAlteracao === "Lei Complementar nº 227, de 2026" && xiv.historico.length === 1 && xiv.historico[0].tipo === "anexo_rev" && xiv.historico[0].fonte === "Lei Complementar nº 227, de 2026" && /Revogado pela/.test(xiv.texto),
      "X6 no mesmo formato de uma lei alteradora (historico 'anexo_rev' + fonte), com o texto original guardado: " + JSON.stringify(xiv));
    ok(res.anexos.filter((a) => /^ANEXO XVI\b/.test(a.titulo))[0].revogado === undefined, "X7 o anexo comum sai como sempre (sem 'revogado')");
    /* descartar o revogado */
    const dec2 = Object.assign({}, dec); dec2[de("XIV").id] = "descartar";
    const r2 = p.leiAplicarPreprocesso(AX, pre.mudancas, dec2);
    ok(r2.anexos.filter((a) => /XIV/.test(a.titulo)).length === 0 && r2.resumo.anexosRevogados === 2 && r2.resumo.anexosDescartados === 1, "X8 descartar o revogado: sai da lei e nao e' contado como guardado: " + JSON.stringify(r2.resumo));
    /* um texto sem revogados nao ganha o campo no resumo */
    const sem = p.leiPreprocessar(["Art. 1º Um.", "ANEXO I", "TABELA", "Produto A 10%"].join("\n"));
    ok(p.leiAplicarPreprocesso("Art. 1º Um.\nANEXO I\nTABELA\nProduto A 10%", sem.mudancas, {}).resumo.anexosRevogados === undefined, "X9 sem anexo revogado o resumo continua como era");
  }
  {
    /* a tela da revisao mostra o aviso, so' nos revogados */
    const api = iniciar();
    const pre = api.leiPreprocessar(AX);
    api.leiRevisarColagemAbrir({ modo: "criar", texto: AX, pre, aoConfirmar() {} });
    const chips = achar(api.$("leiPreGrupo_anexo"), (c) => cls(c, "lei-pre-anexo-rev"));
    ok(chips.length === 3 && /REVOGADO no próprio texto \(Lei Complementar nº 227, de 2026\)/.test(chips[0].textContent) && /nada se perde/.test(chips[0].textContent), "R1 o aviso aparece nos 3 anexos revogados, com a fonte e dizendo que nada se perde: " + chips.map((c) => c.textContent.slice(0, 60)));
    const itens = achar(api.$("leiPreGrupo_anexo"), (c) => cls(c, "lei-pre-item"));
    ok(itens.length === 5 && itens.filter((it) => achar(it, (c) => cls(c, "lei-pre-anexo-rev")).length).length === 3, "R2 e so' neles");
    ok(achar(itens[0], (c) => c.type === "radio").filter((r) => r.checked)[0].value === "separar", "R3 a escolha padrao continua 'separar' (nada e' descartado sozinho)");
    /* salvar e ver */
    const res = api.leiAplicarPreprocesso(AX, pre.mudancas, {});
    const l = api.leiGuardar({ nome: "Lei 3/2020", texto: res.texto, anexos: res.anexos });
    api.leiAbrir("Direito", "T", l.id);
    api.leiPintarAnexos();
    const sms = achar(api.$("leiAnexos"), (c) => String(c.tag || c.tagName).toLowerCase() === "summary").map((c) => c.textContent);
    ok(sms.filter((s) => /revogado por Lei Complementar nº 227, de 2026/.test(s)).length === 2 && sms.filter((s) => /revogado por Lei nº 9, de 2010/.test(s)).length === 1, "R4 o leitor de anexos diz 'revogado por …' nos 3: " + JSON.stringify(sms));
  }

  /* ---- 6: os textos e o estilo ---- */
  {
    const chaves = ["lei_selo_txt_revogado", "lei_selo_txt_vetado", "lei_selo_txt_suprimido", "lei_selo_txt_ajuda", "lei_pre_anx_rev"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I1 as frases existem em portugues e em ingles, com os mesmos campos");
    ok(/\.lei-linha-rev\{[^}]*opacity/.test(html) && /\.lei-art-rev\{[^}]*opacity/.test(html) && /\.lei-pre-anexo-rev\{/.test(html), "I2 o esmaecido tem estilo, e nao some (so' opacity)");
    ok(!/\.lei-linha-rev\{[^}]*display:none/.test(html) && !/\.lei-art-rev\{[^}]*display:none/.test(html), "I3 o revogado nunca e' escondido");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
