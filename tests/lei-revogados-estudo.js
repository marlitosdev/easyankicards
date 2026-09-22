/* =====================================================================
 * O QUE CONSTA COMO REVOGADO FICA FORA DO ESTUDO (etapa 3 da estratégia de revogados)
 *
 * A etapa 1 reconhece "(Revogado…)"/"(VETADO)" no artigo, no § / inciso / alínea e no anexo. Aqui isso passa a
 * valer onde a pessoa estuda:
 *
 *  1. A UNIDADE (§, inciso, alínea) que consta como revogada é identificada (u.revogacao), e o artigo sabe
 *     quantos dispositivos seus constam como revogados (dispRevogados) — o cabeçalho não conta.
 *  2. O PROGRESSO não conta revogado: nem no total, nem como lido, e o "próximo artigo" pula por cima.
 *  3. RECITAR não lista artigo revogado (e diz quantos ficaram de fora). A GRADE de artigos e a lista de
 *     parágrafos e incisos mostram o revogado esmaecido.
 *  4. CARTÃO (cloze): o artigo revogado pede confirmação; os § / incisos revogados de um artigo vigente ficam de
 *     fora do que a IA vê, e a pessoa é avisada.
 *  5. A CITAÇÃO de uma questão para um trecho revogado avisa ANTES do texto.
 * Nada é apagado: só esmaece, para de contar e avisa.
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
  const pausa = () => new Promise((r) => setImmediate(r));

  /* uma lei com artigos vigentes, artigos revogados/vetados e artigos com dispositivos revogados */
  const TEXTO = ["Art. 1º Texto um vigente.",
    "Art. 2º (Revogado pela Lei nº 9, de 2010)",
    "Art. 3º Texto do três vigente, com parágrafos:",
    "I - texto do inciso um;",
    "II - (VETADO);",
    "III - texto do inciso três.",
    "§ 1º Texto do parágrafo um.",
    "§ 2º (Revogado).      (Redação dada pela Lei Complementar nº 227, de 2026)",
    "§ 3º Texto do parágrafo três:",
    "a) texto da alínea a;",
    "b) (Revogada)",
    "Art. 4º Texto do quatro vigente.",
    "Art. 5º (VETADO).     Produção de efeitos",
    "Art. 6º Texto do seis vigente.",
    "Art. 7º Texto do sete vigente."].join("\n");

  /* ---- 1: a unidade e a contagem ---- */
  {
    const arts = p.leiArtigos(TEXTO);
    const a3 = arts.filter((a) => a.num === "3")[0];
    const est = p.leiEstruturaArtigo(a3.texto);
    const de = (rot) => est.unidades.filter((u) => String(u.rotulo).replace(/\s+/g, "").replace(/[-–]$/, "") === rot)[0];
    ok(est.unidades.length === 8, "U0 (8 unidades no art. 3º): " + est.unidades.map((u) => u.rotulo));
    ok(de("II").revogacao && de("II").revogacao.tipo === "vetado", "U1 o inciso II (VETADO): " + JSON.stringify(de("II") && de("II").revogacao));
    ok(de("§2º") && de("§2º").revogacao && de("§2º").revogacao.tipo === "revogado" && de("§2º").revogacao.fonte === "Lei Complementar nº 227, de 2026", "U2 o § 2º (Revogado…): " + JSON.stringify(de("§2º") && de("§2º").revogacao));
    ok(est.unidades.filter((u) => u.revogacao).length === 3 && est.unidades.filter((u) => u.tipo === "alinea" && u.revogacao).length === 1, "U3 exatamente 3 unidades constam como revogadas (II, § 2º, alínea b): " + est.unidades.filter((u) => u.revogacao).map((u) => u.rotulo));
    ok(de("I").revogacao === null && de("§1º").revogacao === null && de("§3º").revogacao === null, "U4 a unidade com texto NAO e' revogada (nem o § 3º, que tem uma alinea revogada)");
    ok(a3.dispRevogados === 3 && a3.revogacao === null, "U5 o artigo conta 3 dispositivos revogados e nao e' revogado: " + a3.dispRevogados);
    ok(arts.filter((a) => a.num === "2")[0].dispRevogados === 0 && arts.filter((a) => a.num === "2")[0].revogacao, "U6 o artigo revogado por inteiro nao conta o proprio cabecalho");
    ok(p.leiContarRevogados(["Art. 1º X", "§ 1º (Revogado)", "§ 2º texto", "§ 3º (Revogado)"]) === 2 && p.leiContarRevogados([]) === 0, "U7 leiContarRevogados");
    const f = p.leiEstruturaArtigo("Art. 8º Caput:\n§ 1º Texto.\n§§ 2º a 4º (Revogados).\n§ 5º Texto.");
    ok(f.unidades.some((u) => u.revogacao), "U8 a faixa '§§ 2º a 4º (Revogados)' consta como revogada: " + JSON.stringify(f.unidades.map((u) => [u.rotulo, !!u.revogacao])));
    /* limpar o texto para cartao */
    const lim = p.leiSemDispositivosRevogados(a3.texto);
    ok(lim.n === 3 && !/VETADO|Revogad/.test(lim.texto) && /Art\. 3º Texto do três/.test(lim.texto) && /§ 3º Texto do parágrafo três/.test(lim.texto) && /a\) texto da alínea a/.test(lim.texto), "U9 sem os 3 revogados; o resto intacto: " + JSON.stringify(lim));
    const lim2 = p.leiSemDispositivosRevogados("Art. 2º (Revogado pela Lei nº 9)\n§ 1º (Revogado)");
    ok(lim2.texto === "Art. 2º (Revogado pela Lei nº 9)" && lim2.n === 1, "U10 o cabecalho (1ª linha) nunca e' tirado: " + JSON.stringify(lim2));
    ok(p.leiSemDispositivosRevogados("Art. 1º Um.\n§ 1º Dois.").texto === "Art. 1º Um.\n§ 1º Dois." && p.leiSemDispositivosRevogados("").texto === "", "U11 sem revogados nada muda");
    ok(p.leiArtigoRevogado({ revogado: true }) && p.leiArtigoRevogado({ revogacao: { tipo: "vetado" } }) && !p.leiArtigoRevogado({}) && !p.leiArtigoRevogado(null), "U12 revogado pela camada OU pelo texto");
  }

  /* ---- 2: o progresso ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2020", texto: TEXTO, parei: "4", pareiIndice: 3 });
    const pg = api.leiProgresso(l.id);
    /* 7 artigos, 2 revogados/vetados (2 e 5) -> 5 vivos; ate o 4º (indice 3): 1, 3, 4 lidos */
    ok(pg.total === 5 && pg.revogados === 2 && pg.lidos === 3 && pg.pct === 60, "P1 5 vivos, 3 lidos (1, 3 e 4), 60%: " + JSON.stringify([pg.total, pg.revogados, pg.lidos, pg.pct]));
    ok(pg.proximo && pg.proximo.num === "6", "P2 o proximo pula o art. 5º (vetado): " + (pg.proximo && pg.proximo.num));
    const l2 = api.leiGuardar({ nome: "Lei 2/2020", texto: TEXTO, parei: "1", pareiIndice: 0 });
    ok(api.leiProgresso(l2.id).proximo.num === "3", "P3 do art. 1º o proximo pula o art. 2º (revogado): " + api.leiProgresso(l2.id).proximo.num);
    const l3 = api.leiGuardar({ nome: "Lei 3/2020", texto: TEXTO });
    ok(api.leiProgresso(l3.id).lidos === 0 && api.leiProgresso(l3.id).proximo.num === "1" && api.leiProgresso(l3.id).total === 5, "P4 sem marcador: 0 lidos e o proximo e' o 1º");
    /* a camada de alteracao tambem */
    const l4 = api.leiGuardar({ nome: "Lei 4/2020", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres.", alteracoes: { "2": { texto: "", fonteAlteracao: "LC 1", data: "2026-01-01", revogado: true } }, parei: "1", pareiIndice: 0 });
    ok(api.leiProgresso(l4.id).total === 2 && api.leiProgresso(l4.id).proximo.num === "3", "P5 artigo revogado pela CAMADA de alteracao tambem sai do progresso: " + JSON.stringify([api.leiProgresso(l4.id).total, api.leiProgresso(l4.id).proximo && api.leiProgresso(l4.id).proximo.num]));
    /* sem revogados: como sempre */
    const l5 = api.leiGuardar({ nome: "Lei 5/2020", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres.\nArt. 4º Quatro.", parei: "2", pareiIndice: 1 });
    const p5 = api.leiProgresso(l5.id);
    ok(p5.total === 4 && p5.lidos === 2 && p5.pct === 50 && p5.proximo.num === "3" && p5.revogados === 0, "P6 lei sem revogados: 2 de 4, 50%, proximo o 3º: " + JSON.stringify([p5.total, p5.lidos, p5.pct]));
    const l6 = api.leiGuardar({ nome: "Lei 6/2020", texto: "Art. 1º (Revogado)\nArt. 2º (VETADO)" });
    ok(api.leiProgresso(l6.id).total === 0 && api.leiProgresso(l6.id).pct === 0 && api.leiProgresso(l6.id).proximo === null, "P7 lei so' de revogados: total 0, sem divisao por zero, sem proximo");
    const l7 = api.leiGuardar({ nome: "Lei 7/2020", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º (Revogado)", parei: "2", pareiIndice: 1 });
    ok(api.leiProgresso(l7.id).proximo === null && api.leiProgresso(l7.id).lidos === 2, "P8 o que resta depois do marcador e' so' revogado: sem proximo");
  }

  /* ---- 3: o leitor, a grade e recitar ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2020", texto: TEXTO });
    api.leiAbrir("Direito", "T", l.id);
    const leitura = api.$("leiLeitura");
    const bloco = (num) => achar(leitura, (c) => c.id === "leiArt_" + num)[0];
    const chip = (num) => achar(bloco(num), (c) => cls(c, "lei-art-disp-rev"));
    ok(chip("3").length === 1 && chip("3")[0].textContent === "3 revogado(s)/vetado(s) aqui" && /3 parágrafo\(s\), inciso\(s\) ou alínea\(s\)/.test(chip("3")[0].title), "L1 o art. 3º mostra quantos dispositivos seus constam como revogados: " + (chip("3")[0] && chip("3")[0].textContent));
    ok(chip("1").length === 0 && chip("2").length === 0 && chip("5").length === 0, "L2 o artigo limpo e o revogado por inteiro (que tem o selo) nao ganham a etiqueta");
    /* o artigo revogado por inteiro que tem um § revogado dentro: o selo basta, a etiqueta nao repete */
    const TR = "Art. 1º (Revogado pela Lei nº 9, de 2010)\n§ 1º (Revogado).\nArt. 2º Vigente.";
    const lr = api.leiGuardar({ nome: "Lei 9/2020", texto: TR });
    ok(p.leiArtigos(TR)[0].dispRevogados === 1 && p.leiArtigos(TR)[0].revogacao, "L2b (o artigo 1º da lei de teste consta revogado e tem 1 dispositivo revogado)");
    api.leiAbrir("Direito", "T", lr.id);
    const b1 = achar(api.$("leiLeitura"), (c) => c.id === "leiArt_1")[0];
    ok(achar(b1, (c) => cls(c, "lei-art-disp-rev")).length === 0 && achar(b1, (c) => cls(c, "lei-selo-txt")).length === 1, "L2c o artigo revogado por inteiro mostra o selo e NAO a etiqueta de dispositivos");
    api.leiAbrir("Direito", "T", l.id);
    /* a grade */
    const d = { ranking: {}, alertas: {}, pareiIdx: -1, efetivos: p.leiArtigos(TEXTO) };
    const arts = p.leiArtigos(TEXTO);
    const cel = (num) => api.leiIrChipEl(d, arts.filter((a) => a.num === num)[0]);
    ok(cls(cel("2"), "lei-ir-cel-rev") && cls(cel("5"), "lei-ir-cel-rev") && !cls(cel("1"), "lei-ir-cel-rev") && !cls(cel("3"), "lei-ir-cel-rev"), "G1 a grade esmaece so' os artigos revogados/vetados por inteiro");
    ok(/revogado ou vetado no texto \(fora do estudo\)/.test(achar(cel("2"), (c) => String(c.tag || c.tagName).toLowerCase() === "button")[0].title), "G2 o aviso na dica do numero");
    const painel = api.leiIrUnidadesEl(d, arts.filter((a) => a.num === "3")[0], null);
    const bts = achar(painel, (c) => cls(c, "lei-ir-u"));
    ok(bts.length === 8 && bts.filter((b) => cls(b, "lei-ir-u-rev")).length === 3 && /fora do estudo/.test(bts.filter((b) => cls(b, "lei-ir-u-rev"))[0].title), "G3 na lista de § e incisos, os 3 revogados esmaecem e explicam: " + bts.filter((b) => cls(b, "lei-ir-u-rev")).length);
    /* recitar */
    api.$("leiTexto").value = TEXTO;
    api.leiPintarRecitar();
    const cab = achar(api.$("leiRecitar"), (c) => cls(c, "lei-rec-cab")).map((c) => c.textContent);
    ok(cab.length === 5 && !cab.some((x) => /Art\. 2º|Art\. 5º/.test(x)), "R1 recitar lista so' os 5 vigentes: " + cab.join(" | "));
    ok(achar(api.$("leiRecitar"), (c) => cls(c, "lei-rec-rev"))[0] && /2 artigo\(s\) que constam como revogados ou vetados ficam de fora\./.test(api.$("leiRecitar").textContent), "R2 diz quantos ficaram de fora");
    ok(/\b5\b/.test(api.$("leiRecitar").textContent.split("\n")[0] || api.$("leiRecitar").textContent), "R3 a contagem do cabecalho e' a dos vigentes");
    api.$("leiTexto").value = "Art. 1º Um.\nArt. 2º Dois.";
    api.leiPintarRecitar();
    ok(achar(api.$("leiRecitar"), (c) => cls(c, "lei-rec-rev")).length === 0, "R4 sem revogados, sem aviso");
  }

  /* ---- 4: cartao (cloze) ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2020", texto: TEXTO });
    api.leiAbrir("Direito", "T", l.id);
    const arts = api.leiArtigos(TEXTO);
    const a = (num) => arts.filter((x) => x.num === num)[0];
    /* artigo vigente com dispositivos revogados: sai do prompt */
    api.leiClozeAbrir(a("3"));
    const pr = api.$("leiClozePrompt").value;
    ok(api.$("dlgLeiCloze").open === true && /Art\. 3º Texto do três/.test(pr) && /§ 1º Texto do parágrafo um/.test(pr) && !/VETADO|\(Revogad/.test(pr), "C1 os 3 dispositivos revogados ficam FORA do prompt; o resto entra: " + pr.slice(-260));
    ok(/3 dispositivo\(s\) revogado\(s\) ou vetado\(s\) ficaram fora do que a IA vê\./.test(api.$("toast").textContent), "C2 a pessoa e' avisada: " + api.$("toast").textContent);
    api.$("dlgLeiCloze").close();
    /* artigo limpo: prompt como sempre e sem aviso */
    api.$("toast").textContent = "";
    api.leiClozeAbrir(a("1"));
    ok(api.$("dlgLeiCloze").open === true && /Texto um vigente/.test(api.$("leiClozePrompt").value) && api.$("toast").textContent === "", "C3 artigo limpo: sem pergunta, sem aviso");
    api.$("dlgLeiCloze").close();
    /* artigo revogado por inteiro: pergunta antes */
    api.leiClozeAbrir(a("2"));
    ok(api.$("dlgLeiCloze").open !== true && /O Art\. 2º consta como revogado ou vetado no próprio texto\. Criar cartões dele mesmo assim\?/.test(api.$("uiModalMsg").textContent), "C4 o artigo revogado pergunta ANTES de abrir: " + api.$("uiModalMsg").textContent);
    api._uiFechar(false);
    await pausa();
    ok(api.$("dlgLeiCloze").open !== true, "C5 respondendo 'nao', nao abre");
    api.leiClozeAbrir(a("5"));
    api._uiFechar(true);
    await pausa(); await pausa();
    ok(api.$("dlgLeiCloze").open === true && /Art\. 5º/.test(api.$("leiClozePrompt").value) && /VETADO/.test(api.$("leiClozePrompt").value), "C6 respondendo 'sim', abre com o texto inteiro do artigo (a pessoa escolheu): " + api.$("leiClozePrompt").value.slice(-120));
    api.$("dlgLeiCloze").close();
    /* o artigo revogado por inteiro, confirmado, vai COMPLETO (a pessoa escolheu): nada e' tirado do prompt */
    const TR = "Art. 1º (Revogado pela Lei nº 9, de 2010)\n§ 1º (Revogado).\nArt. 2º Vigente.";
    const lr = api.leiGuardar({ nome: "Lei 9/2020", texto: TR });
    api.leiAbrir("Direito", "T", lr.id);
    api.$("toast").textContent = "";
    api.leiClozeAbrir(api.leiArtigos(TR)[0]);
    api._uiFechar(true);
    await pausa(); await pausa();
    ok(api.$("dlgLeiCloze").open === true && /§ 1º \(Revogado\)\./.test(api.$("leiClozePrompt").value) && api.$("toast").textContent === "", "C7 o artigo revogado confirmado vai completo (com o § revogado) e sem o aviso de 'ficaram fora': " + api.$("leiClozePrompt").value.slice(-100));
  }

  /* ---- 5: a citacao de uma questao ---- */
  {
    const api = iniciar();
    api.leiGuardar({ id: "lei_cf", nome: "Constituição Federal de 1988", apelido: "CF/88", especie: "Constituição", numero: "",
      texto: ["Art. 152. Texto.", "Art. 153. Compete à União instituir impostos sobre:", "I - importação;", "II - (VETADO);", "III - renda;", "§ 1º Texto.", "§ 2º (Revogado).", "Art. 154. (Revogado pela EC 9)"].join("\n") });
    const prev = (txt) => { const c0 = api.leiCitacoesNoTexto(txt)[0]; api.leiCitacaoPreviewAbrir(c0, ""); return { t: api.$("leiCitaPreviewTexto").textContent || "", a: api.$("leiCitaPreviewArtigo").textContent || "" }; };
    const r1 = prev("art. 153, II, da CF/88");
    ok(/Trecho citado/.test(r1.t) && /⚠ Este trecho consta como revogado, vetado ou suprimido no próprio texto\./.test(r1.t) && r1.t.indexOf("⚠") < r1.t.indexOf("inciso II"), "Q1 o inciso citado e' vetado: o aviso vem ANTES do texto do trecho: " + r1.t.slice(-200));
    const r2 = prev("art. 153, III, da CF/88");
    ok(/Trecho citado/.test(r2.t) && r2.t.indexOf("⚠") < 0, "Q2 o inciso citado vigente: sem aviso");
    const r3 = prev("art. 153, § 2º, da CF/88");
    ok(r3.t.indexOf("⚠") >= 0, "Q3 o § citado revogado: aviso");
    const r4 = prev("art. 154 da CF/88");
    ok(/revogado \(consta no texto\) · EC 9/.test(r4.a), "Q4 o artigo citado revogado por inteiro: o titulo do preview diz: " + r4.a);
    const r5 = prev("art. 152 da CF/88");
    ok(r5.a.indexOf("consta no texto") < 0 && r5.t.indexOf("⚠") < 0, "Q5 artigo vigente: como sempre");
  }

  /* ---- 6: os textos e o estilo ---- */
  {
    const chaves = ["lei_ir_u_rev", "lei_ir_dica_rev", "lei_art_disp_rev", "lei_art_disp_rev_ajuda", "lei_cita_trecho_rev", "lei_rec_rev_fora", "lei_cloze_rev_conf", "lei_cloze_rev_fora"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I1 as frases existem em portugues e em ingles, com os mesmos campos");
    ok(/\.lei-ir-cel-rev\{[^}]*opacity/.test(html) && /\.lei-ir-u-rev\{[^}]*opacity/.test(html) && /\.lei-art-disp-rev\{/.test(html), "I2 o esmaecido tem estilo");
    ok(!/\.lei-ir-cel-rev\{[^}]*display:none/.test(html) && !/\.lei-ir-u-rev\{[^}]*display:none/.test(html), "I3 nada e' escondido");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
