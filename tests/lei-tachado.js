/* =====================================================================
 * COLAR COM FORMATAÇÃO: O TACHADO DO PLANALTO (etapa 2 da estratégia de revogados)
 *
 * O Planalto marca o texto substituído/revogado SÓ com o risco (607 trechos na LC 214: 9 tabelas de anexo e 49
 * trechos de prosa). Colando texto puro, o risco se perde: o texto antigo aparece ao lado do novo (e vira "artigo
 * repetido") e as tabelas revogadas entram como se valessem.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O HTML da área de transferência diz QUAIS letras estão riscadas (<strike>, <s>, <del>, text-decoration:
 *     line-through, também aninhado). O texto puro continua sendo a base: só recebe ~~ em volta do riscado, sem
 *     mudar nenhuma outra letra nem o número de linhas. Se as duas versões não têm as mesmas letras na mesma
 *     ordem, NADA é marcado (nunca no lugar errado).
 *  2. A revisão da colagem ganha um grupo "tachado": cada corrida de linhas é um item, com o motivo (tabela,
 *     redação antiga, revogado). As outras limpezas analisam o texto COMO FICARIA sem o riscado.
 *  3. Aceitar = o trecho sai (a linha some se era só ele); recusar = fica como texto comum. Nenhuma marca ~~ é
 *     guardada: nem confirmando, nem "usar o texto original", nem por outro caminho de gravação.
 *  4. A decisão é registrada no histórico. Um anexo cuja tabela era só riscado e que traz "(Revogado…)" passa a
 *     ser reconhecido como revogado (etapa 1).
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
  const p = iniciar();
  const semMarcas = (s) => s.replace(/~~/g, "");

  /* ---- 1: o HTML: o que está riscado ---- */
  {
    const riscado = (html) => p.leiSegmentosDoHtml(html).filter((x) => x.s).map((x) => x.t).join("|");
    const normal = (html) => p.leiSegmentosDoHtml(html).filter((x) => !x.s).map((x) => x.t).join("|");
    ok(riscado("a <strike>b</strike> c") === "b" && riscado("a <s>b</s>") === "b" && riscado("a <del>b</del>") === "b", "H1 <strike>, <s> e <del>");
    ok(riscado('a <span style="font-family:Arial; text-decoration:line-through">b</span> c') === "b", "H2 span com text-decoration:line-through (o do Planalto)");
    ok(riscado('<span style="text-decoration-line: line-through">b</span>') === "b" && riscado('<span style="text-decoration: underline">b</span>') === "", "H3 text-decoration-line; sublinhado nao e' riscado");
    ok(riscado('<span style="text-decoration:line-through"><font size="2">II - texto <i>caput</i> fim</font></span> <b>fora</b>') === "II - texto |caput| fim" && normal('<span style="text-decoration:line-through">x</span> <b>fora</b>') === " |fora", "H4 riscado ANINHADO (font, i dentro do span); o de fora nao");
    ok(riscado("a &nbsp;<s>&ordm; &amp; &#186; &lt;b&gt;</s>").replace(/ /g, " ") === "º & º <b>", "H5 entidades decodificadas: " + JSON.stringify(riscado("<s>&ordm; &amp; &#186;</s>")));
    ok(riscado("<style>.x{text-decoration:line-through}</style><script>var s='<s>x</s>'</script><!-- <s>y</s> --><s>z</s>") === "z", "H6 style, script e comentario sao ignorados");
    ok(riscado("<p>a<br><s>b</s><p>c</s>") === "b", "H7 HTML mal fechado nao vaza o riscado para o resto: " + JSON.stringify(riscado("<p>a<br><s>b</s><p>c</s>")));
    ok(p.leiSegmentosDoHtml("a<br>b").map((x) => x.t).join("") === "a\nb", "H8 <br> vira quebra de linha");
  }

  /* ---- 2: marcar o texto puro ---- */
  const HT = '<p><span style="font-family:Arial; text-decoration:line-through"><font size="2">II \n\t\t- na hipótese do inciso II do <i>caput</i> do art. 149 desta Lei \n\t\tComplementar, em intervalos não inferiores a 4 (quatro) anos.</font></span></p>'
    + '<p><font size="2">II - na hipótese do inciso II do <i>caput</i> do art. 149 desta Lei Complementar, em intervalos não inferiores a 3 (três) anos. <span>(Redação dada pela Lei Complementar nº 227, de 2026)</span></font></p>';
  const PL = "II - na hipótese do inciso II do caput do art. 149 desta Lei Complementar, em intervalos não inferiores a 4 (quatro) anos.\n\nII - na hipótese do inciso II do caput do art. 149 desta Lei Complementar, em intervalos não inferiores a 3 (três) anos.        (Redação dada pela Lei Complementar nº 227, de 2026)";
  {
    const r = p.leiMarcarTachado(PL, HT);
    const ls = r.texto.split("\n");
    ok(r.n === 1 && /^~~II - na hipótese .* 4 \(quatro\) anos\.~~$/.test(ls[0]) && ls[1] === "" && ls[2].indexOf("~~") < 0, "M1 so' o inciso antigo (a linha do art. 152) ganha a marca; o novo, nao: " + JSON.stringify(r.texto.slice(0, 80)));
    ok(semMarcas(r.texto) === PL && r.texto.split("\n").length === PL.split("\n").length, "M2 tirando as marcas volta EXATAMENTE ao texto puro, com o mesmo numero de linhas");
    const parcial = p.leiMarcarTachado("Art. 217. Texto velho texto novo (Redação dada pela LC 1)", "Art. 217. <s>Texto velho</s> texto novo (Redação dada pela LC 1)");
    ok(parcial.texto === "Art. 217. ~~Texto velho~~ texto novo (Redação dada pela LC 1)" && parcial.n === 1, "M3 riscado no MEIO da linha: " + parcial.texto);
    const linhaTab = p.leiMarcarTachado("Faixa\n3,50%\t15,60%\nfim", "<table><tr><td>Faixa</td></tr><tr><td><s>3,50%</s></td><td><s>15,60%</s></td></tr></table>fim");
    ok(linhaTab.texto === "Faixa\n~~3,50%\t15,60%~~\nfim" && linhaTab.n === 1, "M4 celulas riscadas da mesma linha viram UM trecho: " + JSON.stringify(linhaTab.texto));
    const semRisco = p.leiMarcarTachado("Texto normal", "<p>Texto <b>normal</b></p>");
    ok(semRisco.n === 0 && semRisco.texto === "Texto normal" && semRisco.motivo === "sem_tachado", "M5 sem riscado no HTML: nada muda");
    const naoBate = p.leiMarcarTachado("Texto puro diferente do html", "<s>Outro texto</s> completamente");
    ok(naoBate.n === 0 && naoBate.texto === "Texto puro diferente do html" && naoBate.motivo === "nao_alinhou", "M6 as letras nao batem: NAO marca nada (nunca no lugar errado), e diz por que: " + JSON.stringify(naoBate));
    const mesmoTam = p.leiMarcarTachado("wxyz k", "<s>abcd</s> k");
    ok(mesmoTam.n === 0 && mesmoTam.texto === "wxyz k" && mesmoTam.motivo === "nao_alinhou", "M6b o MESMO numero de letras, mas letras diferentes: tambem nao marca: " + JSON.stringify(mesmoTam));
    const soPontos = p.leiMarcarTachado("-- y x", "<s>--</s> y <s>x</s>");
    ok(soPontos.texto === "-- y ~~x~~" && soPontos.n === 1, "M6c riscado so' de pontuacao nao vira trecho (so' o que tem letra): " + JSON.stringify(soPontos));
    const soPont = p.leiMarcarTachado('Art. 5º "Texto" velho', "Art. 5º <s>“Texto”</s> velho");
    ok(soPont.n === 1 && semMarcas(soPont.texto) === 'Art. 5º "Texto" velho', "M7 diferenca so' de pontuacao (aspas retas x curvas): ainda alinha, sem alterar nenhuma letra: " + JSON.stringify(soPont));
    const caixa = p.leiMarcarTachado("CAPÍTULO II DO IBS ~x", "<span style=\"text-transform:uppercase\">Capítulo II do IBS</span> <s>~x</s>");
    ok(caixa.n === 0, "M7b (controle: o trecho com '~' segue sem marca)");
    const caixa2 = p.leiMarcarTachado("CAPÍTULO II DO IBS velho fim", "<span style=\"text-transform:uppercase\">Capítulo II do IBS</span> <s>velho</s> fim");
    ok(caixa2.n === 1 && caixa2.texto === "CAPÍTULO II DO IBS ~~velho~~ fim", "M7c so' a CAIXA das letras difere (o CSS do Planalto poe titulos em maiuscula): ainda alinha e o texto puro fica intacto: " + JSON.stringify(caixa2));
    const vazio = p.leiMarcarTachado("a  b", "a <s> </s> b");
    ok(vazio.n === 0, "M8 riscado so' de espaco nao vira trecho");
    const tilde = p.leiMarcarTachado("x ~ y", "<s>x ~ y</s>");
    ok(tilde.n === 0 && tilde.texto === "x ~ y", "M9 trecho que ja tem '~' nao e' marcado (a marca ficaria ambigua)");
    /* invariante em varios casos */
    [["A b c d", "A <s>b c</s> d"], ["l1\nl2\nl3", "<s>l1</s><br><s>l2</s><br>l3"], ["x\n\n\ny z", "<s>x</s>\n\n<s>y</s> z"]].forEach(([pl, ht], k) => {
      const r = p.leiMarcarTachado(pl, ht);
      ok(semMarcas(r.texto) === pl && r.texto.split("\n").length === pl.split("\n").length, "M10." + k + " invariante: so' entram marcas, nenhuma letra/linha muda: " + JSON.stringify(r.texto));
    });
  }

  /* ---- 3: tirar e achar ---- */
  {
    ok(p.leiTirarTachado("Art. 217. ~~Texto velho~~ texto novo", true) === "Art. 217. texto novo", "R1 remover no meio: um espaco so'");
    ok(p.leiTirarTachado("~~Texto velho~~ texto novo", true) === "texto novo" && p.leiTirarTachado("Texto ok ~~lixo~~", true) === "Texto ok", "R2 no comeco e no fim: sem sobra de espaco");
    ok(p.leiTirarTachado("  ~~so' isto~~  ", true) === "", "R3 a linha que era so' o trecho fica vazia");
    ok(p.leiTirarTachado("a ~~b~~ c ~~d~~", false) === "a b c d" && p.leiTirarMarcasTachado("a ~~b~~ c") === "a b c", "R4 sem remover: so' as marcas saem");
    const L = ["Art. 1º Texto.", "~~II - antigo~~", "", "II - novo (Redação dada pela LC 1)", "Art. 2º Dois.", "~~1,0%~~", "~~2,0%~~", "Art. 3º Tres."];
    const it = p.leiAcharTachados(L);
    ok(it.length === 2 && it[0].linhas.join() === "2" && it[0].tipo === "substituido" && it[1].linhas.join() === "6,7" && it[1].tipo === "outro", "R5 corridas e tipos: " + JSON.stringify(it.map((x) => [x.id, x.linhas, x.tipo])));
    ok(it[0].antes === "II - antigo" && it[0].depois === "" && it[1].ocorrencias === 2, "R6 antes (sem marca) e depois (sem o riscado)");
    /* linha longa: a previa mostra o trecho riscado (nao so' o comeco da linha) */
    const longa = "Art. 467. " + "Fica concedido o credito presumido conforme a regra geral. ".repeat(6) + "~~O TRECHO ANTIGO QUE SAI~~ " + "E depois vem o resto do dispositivo. ".repeat(4);
    const il = p.leiAcharTachados([longa])[0];
    ok(/O TRECHO ANTIGO QUE SAI/.test(il.antes) && !/O TRECHO ANTIGO QUE SAI/.test(il.depois) && il.antes.length <= 162 && il.depois.length <= 162 && /^…/.test(il.antes), "R6b linha longa: a previa e' centrada no trecho riscado (antes tem o trecho, depois nao): " + il.antes.slice(0, 80));
    const tab = []; for (let i = 0; i < 10; i++) tab.push("~~" + i + ",50%\t1" + i + ",60%~~");
    ok(p.leiAcharTachados(["ANEXO XIV"].concat(tab)).length === 1 && p.leiAcharTachados(["ANEXO XIV"].concat(tab))[0].tipo === "tabela" && p.leiAcharTachados(tab)[0].linhas.length === 10, "R7 10 linhas seguidas so' de riscado: UMA tabela");
    /* as celulas de uma tabela riscada do Planalto vem separadas por VARIAS linhas em branco / so' com espaco e tab */
    const celulas = []; for (let i = 0; i < 9; i++) celulas.push("~~" + i + ",00%~~", "", "\t", " ", "", "\t");
    const corr = p.leiAcharTachados(["ANEXO XIV"].concat(celulas));
    ok(corr.length === 1 && corr[0].tipo === "tabela" && corr[0].linhas.length === 9, "R7b celulas separadas por varias linhas em branco continuam UMA tabela: " + JSON.stringify(corr.map((x) => [x.linhas.length, x.tipo])));
    ok(p.leiAcharTachados(["~~a~~", "texto no meio", "~~b~~"]).length === 2, "R7c mas um texto no meio separa as corridas");
    ok(p.leiAcharTachados(["~~Art. 5º Texto antigo do artigo cinco~~ (Revogado pela Lei nº 9)"])[0].tipo === "revogado", "R8 texto riscado + (Revogado…): tipo 'revogado'");
    /* so' o IDENTIFICADOR riscado + a nota ao lado (como o Planalto mostra um dispositivo revogado): mantido */
    ["~~Art. 217.~~ (Revogado pela Lei Complementar nº 227, de 2026)", "~~§ 5º~~ (Revogado pela LC 1)", "~~I -~~ (VETADO);", "~~c)~~ (Revogado)", "~~ANEXO XIV~~\n(Revogado pela Lei Complementar nº 227, de 2026)", "~~Parágrafo único.~~ (Revogado)", "~~Art. 5º-A.~~ (Suprimido)"].forEach((s) => {
      const it = p.leiAcharTachados(s.split("\n"));
      ok(it.length === 1 && it[0].tipo === "identificador" && it[0].mantido === true, "R9 so' o identificador riscado com a nota de revogacao: 'identificador', padrao MANTER: " + s + " -> " + JSON.stringify(it.map((x) => [x.tipo, x.mantido])));
    });
    ["~~Art. 217.~~ Texto normal que segue", "~~Art. 217. Texto antigo~~ (Revogado)", "~~§ 5º~~", "~~ANEXO XIV~~\nTABELA DE ALÍQUOTAS", "~~II - antigo~~\nII - novo (Redação dada pela LC 1)"].forEach((s) => {
      const it = p.leiAcharTachados(s.split("\n"));
      ok(it.length === 1 && it[0].tipo !== "identificador" && it[0].mantido === false, "R10 NAO e' so' o identificador (sem a nota, ou com texto riscado junto): " + s.replace(/\n/g, " / ") + " -> " + JSON.stringify(it.map((x) => [x.tipo, x.mantido])));
    });
  }

  /* ---- 4: a revisao da colagem ---- */
  const CR = ["Art. 1º Um.", "Art. 2º Dois artigo.", "~~II - antigo texto~~", "II - novo texto (Redação dada pela LC 1)", "Art. 3º Tres ~~texto velho~~ texto novo.",
    "Presidência da República — Subchefia para Assuntos Jurídicos", "Art. 4º Quatro artigo do texto.", "Art. 5º Cinco artigo do texto.", "Art. 6º Seis artigo do texto.", "Art. 7º Sete artigo do texto.",
    "~~Presidência da República — Subchefia para Assuntos Jurídicos~~", "Art. 8º Oito artigo do texto.", "Art. 9º Nove artigo do texto.", "Art. 10. Dez artigo do texto.", "Art. 11. Onze artigo do texto.",
    "~~Presidência da República — Subchefia para Assuntos Jurídicos~~", "Art. 12. Doze artigo do texto.", "Art . 13 Treze com espaco a mais."].join("\n");
  {
    const pre = p.leiPreprocessar(CR);
    const g = {}; pre.mudancas.forEach((m) => { g[m.grupo] = (g[m.grupo] || 0) + 1; });
    ok(g.tachado === 4 && pre.mudancas[0].grupo === "tachado", "P1 o grupo 'tachado' vem primeiro (4 corridas): " + JSON.stringify(g));
    ok(!g.cabecalho, "P2 as outras limpezas analisam o texto SEM o riscado: o cabecalho riscado nao e' 'cabecalho repetido': " + JSON.stringify(g));
    ok(g.grafia === 1, "P3 (e as outras limpezas continuam: 'Art . 13')");
    /* aplicar: aceitar */
    const dec = {}; pre.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "separar" : true; });
    const res = p.leiAplicarPreprocesso(CR, pre.mudancas, dec);
    ok(res.texto.indexOf("~~") < 0 && !/antigo texto|texto velho/.test(res.texto) && (res.texto.match(/Presidência/g) || []).length === 1 && /Art\. 3º Tres texto novo\./.test(res.texto) && /II - novo texto/.test(res.texto), "A1 aceitar: o riscado sai, o resto fica (e nenhuma marca sobra): " + JSON.stringify(res.texto.split("\n").slice(2, 5)));
    ok(res.resumo.tachado === 4 && /Art\. 13 Treze/.test(res.texto) && res.texto.split("\n").length === CR.split("\n").length - 3 && res.texto.split("\n").filter((x) => !x).length === 0, "A2 as 3 linhas que eram so' riscado somem; conta 4; a grafia foi corrigida no mesmo passo: " + JSON.stringify(res.resumo) + " / " + res.texto.split("\n").length);
    /* recusar */
    const dec2 = Object.assign({}, dec); pre.mudancas.filter((m) => m.grupo === "tachado").forEach((m) => { dec2[m.id] = false; });
    const r2 = p.leiAplicarPreprocesso(CR, pre.mudancas, dec2);
    ok(r2.texto.indexOf("~~") < 0 && /II - antigo texto/.test(r2.texto) && /Tres texto velho texto novo\./.test(r2.texto) && r2.resumo.tachado === undefined, "A3 recusar: o texto fica como texto comum, SEM as marcas: " + JSON.stringify(r2.texto.split("\n").slice(2, 5)));
    /* um texto sem marcas nao muda */
    const semM = "Art. 1º Um.\nArt. 2º Dois.";
    ok(p.leiPreprocessar(semM).mudancas.length === 0 && p.leiAplicarPreprocesso(semM, [], {}).texto === semM && p.leiAplicarPreprocesso(semM, [], {}).resumo.tachado === undefined, "A4 sem marcas: nada muda");
    /* uma marca solta (sem item) nunca sai guardada */
    ok(p.leiAplicarPreprocesso("Art. 1º Um ~~solto~~.", [], {}).texto === "Art. 1º Um solto.", "A5 uma marca que nenhum item cobre tambem e' tirada");
  }

  /* ---- 5: a tela, o historico e os caminhos de saida ---- */
  {
    const api = iniciar();
    let res = null;
    const pre = api.leiPreprocessar(CR);
    api.leiRevisarColagemAbrir({ modo: "criar", texto: CR, pre, aoConfirmar(r) { res = r; } });
    const grupo = api.$("leiPreGrupo_tachado");
    const itens = achar(grupo, (c) => cls(c, "lei-pre-item"));
    ok(!!grupo && itens.length === 4 && Array.from(api.$("leiPreLista").children)[0].id === "leiPreGrupo_tachado", "U1 o grupo aparece primeiro, com 4 itens");
    ok(/Trechos tachados no original/.test(grupo.textContent) && /Aceitando, saem da lei/.test(grupo.textContent), "U2 a tela explica o que e' e o que aceitar faz");
    ok(/1 trecho\(s\) tachado\(s\) · linhas 3 — tachado e seguido de “Redação dada…”: é a redação antiga/.test(itens[0].textContent) && /\(a linha inteira sai\)/.test(itens[0].textContent), "U3 o item diz o que e' e que a linha inteira sai: " + itens[0].textContent.slice(0, 200));
    ok(/Art\. 3º Tres texto novo\./.test(itens[1].textContent) && /Art\. 3º Tres texto velho texto novo\./.test(itens[1].textContent), "U4 o item parcial mostra antes e depois");
    ok(achar(grupo, (c) => c.id === "btnLeiPreTodos_tachado").length === 1, "U5 tem 'aceitar todos' / 'recusar todos'");
    /* recusar UM item pela tela e confirmar */
    achar(itens[1], (c) => c.type === "checkbox")[0].checked = false;
    achar(itens[1], (c) => c.type === "checkbox")[0].onchange();
    api.leiPreConfirmar();
    ok(res && res.texto.indexOf("~~") < 0 && /Tres texto velho texto novo\./.test(res.texto) && !/antigo texto/.test(res.texto), "U6 confirmar: aceitou uns, recusou outro, nenhuma marca sobra");
    const r = api.decLer().filter((x) => x.regra === "colagem.tachado");
    ok(r.length === 4 && r.filter((x) => x.decisao === "recusou").length === 1 && r.filter((x) => x.decisao === "aceitou").length === 3 && r[0].risco === "medio" && r[0].proposta.acao === "remover", "U7 as 4 decisoes ficam no historico (3 aceitas, 1 recusada, risco medio): " + JSON.stringify(r.map((x) => [x.decisao, x.risco])));
    ok(r.filter((x) => x.decisao === "aceitou")[0].proposta.linhas.some((x) => /~~/.test(x.texto)), "U8 o historico guarda o texto riscado que saiu (com a marca), para dar para restaurar");
    /* usar o texto original */
    const api2 = iniciar();
    let res2 = null;
    api2.leiRevisarColagemAbrir({ modo: "criar", texto: CR, pre: api2.leiPreprocessar(CR), aoConfirmar(x) { res2 = x; } });
    api2.leiPreOriginal();
    ok(res2 && res2.texto.indexOf("~~") < 0 && /II - antigo texto/.test(res2.texto) && /texto velho texto novo/.test(res2.texto), "U9 'usar o texto original': fica tudo, mas as marcas nao");
    /* guardar direto */
    const l = api2.leiGuardar({ nome: "Lei 7/2020", texto: "Art. 1º Um ~~velho~~ novo." });
    ok(api2.leiDe(l.id).texto === "Art. 1º Um velho novo.", "U10 nenhum caminho de gravacao guarda a marca ~~: " + api2.leiDe(l.id).texto);
  }

  /* ---- 5b: o dispositivo revogado do Planalto: so' o numero riscado ---- */
  {
    const T = ["Art. 1º Um.", "Art. 2º Dois.", "ANEXO XIII", "Tabela do treze", "Produto A 10%", "~~ANEXO XIV~~", "(Revogado pela Lei Complementar nº 227, de 2026)", "ANEXO XV", "Tabela do quinze", "Produto B 12%",
      "Art. 3º Tres.", "~~Art. 217.~~ (Revogado pela Lei Complementar nº 227, de 2026)", "~~§ 9º Texto antigo do nove~~", "§ 9º Texto novo do nove. (Redação dada pela LC 1)"].join("\n");
    const pre = p.leiPreprocessar(T);
    const tch = pre.mudancas.filter((m) => m.grupo === "tachado");
    /* OS IDENTIFICADORES NUNCA ENTRAM EM mudancas — não são decisão, não podem ser marcados */
    ok(tch.length === 1 && !tch[0].mantido, "K1 so' o texto antigo (que sai) fica em mudancas; os 2 identificadores NAO: " + JSON.stringify(tch.map((m) => [m.id, m.tipo, m.mantido])));
    ok((pre.identificadores || []).length === 2 && pre.identificadores.every((m) => m.mantido), "K1a os 2 identificadores ficam à parte, em 'identificadores', informativos: " + JSON.stringify(pre.identificadores.map((m) => [m.id, m.tipo])));
    const ax = pre.mudancas.filter((m) => m.grupo === "anexo");
    ok(ax.length === 3 && ax.filter((m) => /^ANEXO XIV/.test(m.titulo))[0] && ax.filter((m) => /^ANEXO XIV/.test(m.titulo))[0].revogado, "K2 as outras limpezas veem o titulo do anexo XIV (nao riscado no que ficara): 3 anexos, o XIV revogado: " + JSON.stringify(ax.map((m) => [m.titulo, !!m.revogado])));
    const res = p.leiAplicarPreprocesso(T, pre.mudancas, {});
    ok(res.texto.indexOf("~~") < 0 && res.anexos.length === 3 && res.anexos.filter((a) => /^ANEXO XIV/.test(a.titulo))[0].revogado === true && /ANEXO XIV/.test(res.anexos.filter((a) => /^ANEXO XIV/.test(a.titulo))[0].texto), "K3 padrao: o numero do anexo XIV FICA (com a nota) e o anexo e' guardado como revogado; o XIII nao ganha a nota solta: " + JSON.stringify(res.anexos.map((a) => [a.titulo, a.revogado, a.texto.slice(0, 60)])));
    ok(/Art\. 217\. \(Revogado pela Lei Complementar nº 227, de 2026\)/.test(res.texto) && !/Texto antigo do nove/.test(res.texto) && /§ 9º Texto novo do nove/.test(res.texto), "K4 'Art. 217. (Revogado…)' fica como veio; o § 9º antigo sai e o novo fica: " + JSON.stringify(res.texto.split("\n").slice(-4)));
    ok(res.resumo.tachado === 1, "K5 so' o que saiu de verdade e' contado: " + JSON.stringify(res.resumo));
    ok(p.leiArtigos(res.texto).some((a) => a.num === "217"), "K5a o Art. 217 continua existindo como artigo (o padrao nao apaga a identidade dele): " + p.leiArtigos(res.texto).map((a) => a.num).join(","));
    const XIII = res.anexos.filter((a) => /^ANEXO XIII/.test(a.titulo))[0];
    ok(!/Revogado/.test(XIII.texto), "K6 a nota de revogacao nao para no anexo anterior: " + JSON.stringify(XIII.texto));
    /* mesmo que ALGUEM force dec[id]=true para o id de um identificador, nao tem efeito: o item nao esta em mudancas,
     * entao o laco que aplica as decisoes nunca o encontra — a protecao nao depende de a pessoa "nao marcar a caixa" */
    const idsIdent = pre.identificadores.map((m) => m.id);
    const d2 = {}; idsIdent.forEach((id) => { d2[id] = true; }); pre.mudancas.forEach((m) => { d2[m.id] = true; });
    const r2 = p.leiAplicarPreprocesso(T, pre.mudancas, d2);
    ok(r2.texto.indexOf("~~") < 0 && /Art\. 217\./.test(r2.texto) && /ANEXO XIV/.test(r2.texto) && !/Texto antigo do nove/.test(r2.texto),
      "K7 forcar dec[id]=true para os identificadores NAO tira o numero (nao ha caminho para removê-los); o texto antigo (que esta em mudancas de verdade) sai normalmente: " + r2.texto.split("\n").slice(-6).join(" | "));
    /* na tela: nao ha caixa nenhuma para os identificadores */
    const api = iniciar();
    api.leiRevisarColagemAbrir({ modo: "criar", texto: T, pre: api.leiPreprocessar(T), aoConfirmar() {} });
    const itensDecisao = achar(api.$("leiPreGrupo_tachado"), (c) => cls(c, "lei-pre-item"));
    ok(itensDecisao.length === 1 && achar(itensDecisao[0], (c) => c.type === "checkbox").length === 1, "K8 so' 1 item COM caixa de decisao no grupo tachado (o texto antigo): " + itensDecisao.length);
    const blocoIdent = api.$("leiPreGrupo_identificador");
    ok(!!blocoIdent && /Identificadores revogados mantidos \(2\)/.test(blocoIdent.textContent) && achar(blocoIdent, (c) => c.type === "checkbox").length === 0,
      "K8a os 2 identificadores aparecem num bloco SEPARADO, so' informativo, SEM nenhuma caixa: " + (blocoIdent && blocoIdent.textContent.slice(0, 60)));
    ok(/Tirar o número apagaria QUAL dispositivo foi revogado/.test(blocoIdent.textContent), "K8b o bloco explica por que ficam de fora da decisao");
    ok(/linha 12: Art\. 217\./.test(blocoIdent.textContent), "K8c o item do bloco mostra a linha e o texto: " + blocoIdent.textContent.match(/linha \d+: [^\n]{0,40}/g));
    ok(/revisão da colagem aberta — \d+ mudanças sugeridas: tachado \d+ · anexo \d+ · 2 identificador\(es\) revogado\(s\) mantido\(s\) \(informativo, sem decisão\)/.test(api.leiRelatorioFluxo("revisar a colagem")),
      "K8d o registro (linha gravada ao abrir a revisao) soma os identificadores mantidos: " + api.leiRelatorioFluxo("revisar a colagem").split("\n").filter((l) => /revisão da colagem aberta/.test(l)));
    ok(/identificadores revogados mantidos \(informativo, sem decisão — nunca são removidos\): 2/.test(api.leiRelatorioFluxo("revisar a colagem")),
      "K8e com a tela AINDA ABERTA, o resumo por grupo do relatorio tambem lista os identificadores: " + api.leiRelatorioFluxo("revisar a colagem").split("\n").filter((l) => /identificador/.test(l)));
    achar(itensDecisao[0], (c) => c.type === "checkbox")[0].checked = false; achar(itensDecisao[0], (c) => c.type === "checkbox")[0].onchange();
    api.leiPreConfirmar();
    const dr = api.decLer().filter((x) => x.regra === "colagem.tachado");
    ok(dr.length === 1, "K9 so' o item que ERA decisao entra no historico (os identificadores, que nunca foram decisao, nao entram): " + dr.length);
    ok(/2 identificador\(es\) revogado\(s\) mantido\(s\) \(informativo, sem decisão\)/.test(api.leiRelatorioFluxo("revisar a colagem")),
      "K9a mesmo com a tela ja fechada, a LINHA DE REGISTRO gravada ao abrir continua no relatorio do fluxo: " + api.leiRelatorioFluxo("revisar a colagem").slice(-250));
  }
  {
    /* sem nenhum identificador: o bloco nao aparece de jeito nenhum */
    const api = iniciar();
    const T2 = "Art. 1º Um ~~texto velho~~ novo.";
    api.leiRevisarColagemAbrir({ modo: "criar", texto: T2, pre: api.leiPreprocessar(T2), aoConfirmar() {} });
    ok(!api.$("leiPreGrupo_identificador"), "K10 sem identificadores, o bloco informativo nem existe na tela");
  }

  /* ---- 6: o anexo revogado (etapa 1) ---- */
  {
    const tab = []; for (let i = 0; i < 10; i++) tab.push("~~" + i + ",50%\t1" + i + ",60%~~");
    const T = ["Art. 1º Um.", "Art. 2º Dois.", "ANEXO XIV", "(Revogado pela Lei Complementar nº 227, de 2026)"].concat(tab).join("\n");
    const pre = p.leiPreprocessar(T);
    const ax = pre.mudancas.filter((m) => m.grupo === "anexo")[0];
    ok(pre.mudancas.filter((m) => m.grupo === "tachado")[0].tipo === "tabela" && ax && ax.revogado && ax.revogado.fonte === "Lei Complementar nº 227, de 2026" && ax.tamanho < 120, "V1 a tabela riscada + '(Revogado pela …)': o anexo e' reconhecido como revogado: " + JSON.stringify(ax && [ax.revogado, ax.tamanho]));
    const dec = {}; pre.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "separar" : true; });
    const res = p.leiAplicarPreprocesso(T, pre.mudancas, dec);
    ok(res.anexos.length === 1 && res.anexos[0].revogado === true && res.anexos[0].texto.indexOf("~~") < 0 && !/50%/.test(res.anexos[0].texto), "V2 guardado como anexo REVOGADO, sem a tabela revogada (so' o titulo e a nota): " + JSON.stringify(res.anexos[0]));
  }

  /* ---- 7: o colar ---- */
  {
    const api = iniciar();
    api.leiAbrir("Direito", "T");
    const ta = api.$("leiTexto");
    const evento = (html, plain) => { let prevenido = false; return { clipboardData: { getData: (k) => (k === "text/html" ? html : k === "text/plain" ? plain : "") }, target: ta, preventDefault() { prevenido = true; }, get prevenido() { return prevenido; } }; };
    ta.value = "ANTES|DEPOIS"; ta.selectionStart = ta.selectionEnd = 6;
    const e1 = evento(HT, PL);
    ok(api.leiColarComTachado(e1) === true && e1.prevenido, "C1 com riscado no HTML: o colar e' tratado (o normal e' impedido)");
    ok(ta.value === "ANTES|" + p.leiMarcarTachado(PL, HT).texto + "DEPOIS" && ta.selectionStart === ta.selectionEnd && ta.selectionStart === 6 + p.leiMarcarTachado(PL, HT).texto.length, "C2 entra na posicao do cursor, mantem o resto do campo e deixa o cursor depois");
    ok(/Colado com formatação: 1 trecho\(s\) tachado\(s\) identificado\(s\)\. Você decide o que fazer com eles na revisão\./.test(api.$("toast").textContent), "C3 avisa quantos trechos e que a decisao e' na revisao: " + api.$("toast").textContent);
    ok(/colagem com tachado: 1 trecho\(s\) riscado\(s\) identificado\(s\)/.test(api.leiRelatorioFluxo("revisar a colagem")), "C4 fica no registro do fluxo");
    ta.value = "";
    const e1b = evento(HT, PL); e1b.defaultPrevented = true;
    ok(api.leiColarComTachado(e1b) === false && ta.value === "", "C1b um evento que ja foi tratado por outro ouvinte nao e' tratado de novo (nao cola em dobro)");
    const e2 = evento("<p>Texto <b>normal</b></p>", "Texto normal");
    ok(api.leiColarComTachado(e2) === false && !e2.prevenido && ta.value === "", "C5 sem riscado: nao mexe em nada (o colar segue como sempre)");
    const e3 = evento("<s>Outro texto</s> completamente", "Texto puro diferente");
    ok(api.leiColarComTachado(e3) === false && !e3.prevenido && /não foi possível localizá-los/.test(api.$("toast").textContent), "C6 riscado que nao alinha: cola como veio e AVISA (nunca marca errado): " + api.$("toast").textContent);
    /* o colar esta LIGADO nos dois campos de texto da lei (criar/editar e atualizar) */
    ta.value = "";
    const ouv = (id) => ((api.$(id)._ouv || {}).paste || []);
    ok(ouv("leiTexto").length === 1 && ouv("leiUpdTexto").length === 1, "C0 o evento 'paste' esta ligado em leiTexto e em leiUpdTexto: " + [ouv("leiTexto").length, ouv("leiUpdTexto").length]);
    const e0 = evento(HT, PL);
    ouv("leiTexto")[0](e0);
    ok(e0.prevenido && /^~~II - na hipótese/.test(ta.value), "C0a o ouvinte ligado faz o trabalho: " + ta.value.slice(0, 40));
    ta.value = "";
    ok(api.leiColarComTachado({ clipboardData: null, target: ta }) === false && api.leiColarComTachado(evento("", "x")) === false && api.leiColarComTachado(evento("<s>x</s>", "")) === false, "C7 sem area de transferencia, sem HTML ou sem texto puro: nao faz nada");
  }

  /* ---- 7b: NENHUMA chave crua na tela: cada texto do grupo existe e foi usado ---- */
  {
    const api = iniciar();
    const T = ["Art. 1º Um.", "~~ANEXO XIV~~", "(Revogado pela Lei Complementar nº 227, de 2026)", "~~1,0%~~", "~~2,0%~~", "Art. 2º Dois ~~velho~~ novo."].join("\n");
    api.leiRevisarColagemAbrir({ modo: "criar", texto: T, pre: api.leiPreprocessar(T), aoConfirmar() {} });
    const texto = api.$("leiPreLista").textContent;
    ok(!/lei_[a-z]+_[a-z_0-9]+/.test(texto) && !/lei_pre_[a-z_]+/.test(api.$("leiPreGrupo_tachado").textContent) && !/lei_pre_[a-z_]+/.test(api.$("leiPreGrupo_identificador").textContent),
      "T1 a tela do grupo (e a do bloco de identificadores) nao mostra nenhuma chave de traducao crua: " + (texto.match(/lei_[a-z_0-9]+/g) || []).join(","));
    /* recusar o unico item do grupo (o texto antigo) para a frase de consequencia aparecer */
    achar(api.$("leiPreGrupo_tachado"), (c) => c.type === "checkbox")[0].checked = false;
    achar(api.$("leiPreGrupo_tachado"), (c) => c.type === "checkbox")[0].onchange();
    ok(/Recusando, o trecho tachado fica no texto como texto comum/.test(api.$("leiPreGrupo_tachado").textContent), "T2 a consequencia de recusar aparece no grupo");
  }

  /* ---- 8: os textos ---- */
  {
    const chaves = ["lei_pre_g_tachado", "lei_pre_h_tachado", "lei_pre_c_tachado", "lei_pre_tch_identificador", "lei_pre_tch_item", "lei_pre_tch_tabela", "lei_pre_tch_substituido", "lei_pre_tch_revogado", "lei_pre_tch_outro", "lei_pre_tch_vazio", "lei_col_tch_ok", "lei_col_tch_nao",
      "lei_pre_ident_titulo", "lei_pre_ident_ajuda", "lei_pre_ident_item"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I1 as frases existem em portugues e em ingles, com os mesmos campos");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
