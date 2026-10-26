/* =====================================================================
 * A REVISÃO DA COLAGEM: O QUE PRECISA DO SEU OLHO E COMO A LEI VAI FICAR (v19.24.0)
 *
 * O PEDIDO: "ideias de como tornar a interface mais simples e com destaque visual mais claro das divergências
 * apontadas no registro" — e "prosseguir" com as escolhidas: (1) o resumo no topo com o que precisa de conferência,
 * (2) cores por gravidade (vermelho apaga linhas · amarelo muda a estrutura · cinza limpeza segura), na tela e no
 * relatório, (5) o painel "como a lei vai ficar" com as conferências do resultado.
 *
 * O QUE PRECISA SER VERDADE:
 *  C1 leiComoVaiFicar acha artigo GIGANTE, anexo REPETIDO e FALTANDO, linhas de letras espaçadas;
 *  T1 cada grupo tem a cor e a etiqueta da sua gravidade; os atalhos no topo, um por grupo, na mesma cor;
 *  T2 os grupos que precisam de conferência vêm primeiro; as limpezas seguras num bloco RECOLHIDO; o atalho de uma
 *     limpeza segura abre o bloco;
 *  T3 o painel "como a lei vai ficar": artigos, divisões, anexos; e, se a pessoa mantiver um anexo dentro do último
 *     artigo, o aviso GRAVE do artigo gigante aparece na hora;
 *  T4 sem nada para conferir, a ordem de sempre (sem bloco recolhido);
 *  R1 o relatório começa por "PONTOS PARA CONFERIR" e marca cada grupo com a gravidade.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const RODAPE = "Prefeitura de Caruaru - Praça Sen. Teotônio Vilela, S/N°, Centro, Caruaru/Pernambuco - CEP 55.004-901";
  /* a miniatura da LC 15/2009: rodapé e número por página, a lista de LIVROs, um anexo de título espaçado e GRANDE */
  const linhas = [];
  let pagina = 0;
  const fim = () => { pagina++; linhas.push(RODAPE, String(pagina)); };
  linhas.push("LEI COMPLEMENTAR 015, DE 05 DE JANEIRO DE 2009", "LIVRO I", "DAS NORMAS GERAIS",
    "Art. 1º. Este Código regula os direitos e obrigações tributárias.",
    "Art. 2º. O Código é constituído de 2 (dois) Livros, assim distribuída:",
    "LIVRO I - Estabelece Normas Gerais de Direito Tributário;",
    "LIVRO II - Regula o Sistema Tributário Municipal.");
  fim();
  for (let p = 0; p < 6; p++) {
    for (let q = 0; q < 3; q++) linhas.push("Art. " + (3 + p * 3 + q) + ". Texto do artigo " + (3 + p * 3 + q) + " com a redação completa da norma municipal.");
    fim();
  }
  linhas.push("A N E X O I", "TABELA DE SERVIÇOS");
  for (let q = 1; q <= 700; q++) linhas.push(q + " - Serviço de número " + q + " prestado no território do Município de Caruaru");
  fim();
  linhas.push("ANEXO III", "TABELA DE TAXAS", "1 - Taxa de licença", "ANEXO III", "TABELA REPETIDA", "1 - Outra taxa");
  fim();
  const texto = linhas.join("\n\n");

  /* ---- C1: o motor ---- */
  {
    const { api } = rodar();
    const pre = api.leiPreprocessar(texto);
    const ap = api.leiAplicarPreprocesso(texto, pre.mudancas, {});
    const como = api.leiComoVaiFicar(ap.texto, ap.anexos);
    ok(como.artigos === 20 && como.ultimo === "20" && como.divisoes.livro === 1, "C1 a estrutura: 20 artigos, até o Art. 20, 1 livro: " + JSON.stringify({ a: como.artigos, u: como.ultimo, d: como.divisoes }));
    ok(como.anexos.length === 3 && !como.conferir.some((p) => p.tipo === "gigante"), "C1a com o anexo separado, nenhum artigo gigante");
    ok(como.conferir.some((p) => p.tipo === "anexo_repetido" && p.rom === "III" && p.n === 2) && como.conferir.some((p) => p.tipo === "anexo_faltando" && p.lista.join() === "II"),
      "C1b o Anexo III repetido e o II faltando: " + JSON.stringify(como.conferir));
    /* mantendo o anexo DENTRO do último artigo: o artigo vira gigante */
    const dec = {};
    pre.mudancas.filter((m) => m.grupo === "anexo").forEach((m) => { dec[m.id] = "manter"; });
    const ap2 = api.leiAplicarPreprocesso(texto, pre.mudancas, dec);
    const como2 = api.leiComoVaiFicar(ap2.texto, ap2.anexos);
    ok(como2.conferir[0] && como2.conferir[0].tipo === "gigante" && como2.conferir[0].gravidade === "grave" && como2.conferir[0].num === "20", "C1c anexo mantido no artigo: o Art. 20 gigante, GRAVE e em primeiro: " + JSON.stringify(como2.conferir[0]));
    ok(api.leiComoVaiFicar("Art. 1º. A B C\nA N E X O I I\nR e d a ç ã o d a d a").conferir.some((p) => p.tipo === "espacado" && p.n === 2), "C1d linhas de letras espaçadas contadas");
    /* longo, mas não absurdo (o Art. 518 da LC 15/2009, 16 mil com a tabela de multas que é dele): AVISO, não GRAVE */
    const curtos = []; for (let k = 1; k <= 10; k++) curtos.push("Art. " + k + ". Texto curto do artigo " + k + ".");
    const longo = "Art. 11. Multas:" + Array.from({ length: 300 }, (_, k) => "\n" + (k + 1) + ". multa de " + k + " UFM por infração ao dispositivo correspondente").join("");
    const cl = api.leiComoVaiFicar(curtos.join("\n") + "\n" + longo);
    ok(cl.conferir.length === 1 && cl.conferir[0].tipo === "longo" && cl.conferir[0].gravidade === "aviso" && cl.conferir[0].num === "11",
      "C1f artigo longo (" + longo.length + " car.) é AVISO, não grave: " + JSON.stringify(cl.conferir));
    api.setLanguage("pt");
    ok(/Art\. 11 ficaria com \d+ mil caracteres — bem acima/.test(api.leiComoTexto(cl.conferir[0])), "C1g e tem texto próprio");
    ok(api.leiRomanoInt("XVII") === 17 && api.leiRomanoInt("XIV") === 14 && api.leiRomanoInt("XL") === 40 && api.leiIntRomano(14) === "XIV", "C1e romanos");
  }

  /* ---- T1–T3 e R1: a tela ---- */
  {
    const { api } = rodar();
    const pre = api.leiPreprocessar(texto);
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre, aoConfirmar: () => {} });
    const lista = api.$("leiPreLista");
    const grupo = (g) => api.$("leiPreGrupo_" + g);
    ok(/lei-pre-grav-apaga/.test(grupo("cabecalho").className) && /lei-pre-grav-estrutura/.test(grupo("remissao").className) && /lei-pre-grav-estrutura/.test(grupo("anexo").className) && /lei-pre-grav-segura/.test(grupo("pagina").className),
      "T1 cada grupo com a cor da gravidade");
    ok(/apaga linhas/.test(grupo("cabecalho").textContent) && /muda a estrutura/.test(grupo("anexo").textContent) && /limpeza segura/.test(grupo("grafia").textContent), "T1a e a etiqueta escrita");
    const chips = achar(api.$("leiPreChips"), (c) => /lei-pre-chip/.test(c.className || ""));
    ok(!api.$("leiPreChips").hidden && chips.length >= 5 && /apaga/.test(api.$("btnLeiPreChip_cabecalho").className) && /^Anexos \d/.test(api.$("btnLeiPreChip_anexo").textContent),
      "T1b os atalhos no topo, na cor do grupo: " + chips.map((c) => c.textContent).join(" | "));
    ok(/para conferir/.test(api.$("leiPreResumo").textContent), "T1c o resumo diz quantos precisam de conferência: " + api.$("leiPreResumo").textContent);
    const filhos = Array.from(lista.children).map((c) => c.id);
    ok(filhos.indexOf("leiPreGrupo_cabecalho") < filhos.indexOf("leiPreSeguras") && filhos.indexOf("leiPreGrupo_anexo") < filhos.indexOf("leiPreSeguras"),
      "T2 o que precisa do seu olho vem antes das limpezas seguras: " + filhos.join(","));
    const seg = api.$("leiPreSeguras");
    ok(seg && seg.open === false && achar(seg, (c) => c.id === "leiPreGrupo_grafia").length === 1 && /Limpezas seguras/.test(seg.textContent), "T2a as limpezas seguras num bloco recolhido");
    api.$("btnLeiPreChip_grafia").onclick();
    ok(api.$("leiPreSeguras").open === true, "T2b o atalho de uma limpeza segura abre o bloco");
    api.leiPrePintar();
    ok(api.$("leiPreSeguras").open === true, "T2c e o bloco continua aberto ao repintar");
    const como = api.$("leiPreComo");
    ok(!como.hidden && /Como a lei vai ficar/.test(como.textContent) && /20 artigos/.test(como.textContent) && /3 anexo/.test(como.textContent), "T3 o painel mostra a estrutura: " + como.textContent.slice(0, 160));
    ok(/Anexo III aparece 2 vezes/.test(como.textContent) && /lei-pre-como aviso/.test(como.className), "T3a e a conferência do anexo repetido, em amarelo");
    /* a pessoa decide manter o Anexo I dentro do último artigo: o grave aparece na hora */
    const ctx = api.leiPreCtxAtual();
    ctx.pre.mudancas.filter((m) => m.grupo === "anexo").forEach((m) => { ctx.decisoes[m.id] = "manter"; });
    api.leiPrePintar();
    ok(/lei-pre-como grave/.test(api.$("leiPreComo").className) && /Art\. 20 ficaria com \d+ mil caracteres/.test(api.$("leiPreComo").textContent),
      "T3b anexo mantido no artigo: o painel fica vermelho e diz qual artigo: " + api.$("leiPreComo").textContent.slice(0, 220));
    /* R1: o relatório */
    const rel = api.leiRelatorioFluxo("revisar a colagem");
    const iPontos = rel.indexOf("PONTOS PARA CONFERIR"), iGrupos = rel.indexOf("[APAGA LINHAS] cabecalho");
    ok(iPontos > 0 && iGrupos > iPontos && /✖ GRAVE — O Art\. 20 ficaria com/.test(rel) && /\[MUDA A ESTRUTURA\] anexo/.test(rel) && /\[limpeza segura\] tachado|\[limpeza segura\] pagina/.test(rel),
      "R1 o relatório começa pelos pontos para conferir e marca cada grupo: " + rel.slice(iPontos, iPontos + 260));
    /* R2 (pedido: "se o registro precisar de mais alguma informação relevante, pode incluir") */
    ok(/texto colado: \d+ caracteres · \d+ linhas · 20 artigos antes da limpeza/.test(rel), "R2 o tamanho da colagem");
    ok(/maiores artigos: Art\. 20 \d+ car\./.test(rel), "R2a os maiores artigos (o que engoliu o anexo vem primeiro)");
    ok(/ANEXO I · linhas \d+-\d+ · \d+ car\. · escolha: manter/.test(rel) && /ANEXO III · linhas/.test(rel), "R2b cada anexo com a escolha");
    ok(/lista linha\(s\) \d+,\d+ \[divisao,divisao_ultimo\] aceitas 2\/2  =>  Art\. 2º.*LIVRO I - .*LIVRO II - /.test(rel), "R2c a lista num item só, com o artigo como vai ficar");
    ok(/recusadas por você: nenhuma/.test(rel), "R2d sem recusa, dito");
    const ctxR = api.leiPreCtxAtual();
    const cab1 = ctxR.pre.mudancas.filter((m) => m.grupo === "cabecalho")[0];
    ctxR.decisoes[cab1.id] = false;
    const rel2 = api.leiRelatorioFluxo("revisar a colagem");
    ok(/recusadas por você: 1\n\s+cabecalho linha\(s\) [\d,]+ · Prefeitura de Caruaru/.test(rel2), "R2e o que foi recusado, listado: " + rel2.slice(rel2.indexOf("recusadas"), rel2.indexOf("recusadas") + 160));
    ok(rel.indexOf("[APAGA LINHAS]") < rel.indexOf("[limpeza segura]") &&rel.indexOf("[MUDA A ESTRUTURA] anexo") < rel.indexOf("[limpeza segura] pagina"), "R1a no relatório, os grupos que precisam de conferência vêm antes das limpezas seguras");
  }

  /* ---- K: os itens de uma mesma lista num cartão só (o print da LC 15/2009: LIVRO I, II, III, IV em 4 cartões, e o
   * "ficará" de cada um mostrando só um pedaço) ---- */
  {
    const { api } = rodar();
    const pre = api.leiPreprocessar(texto);
    const rem = pre.mudancas.filter((m) => m.grupo === "remissao");
    ok(rem.length === 2 && rem[1].ancora === rem[0].linhas[0] && rem[0].ancora > 0, "K0 a remissão sabe a que linha se une: " + JSON.stringify(rem.map((m) => [m.linhas[0], m.ancora, m.motivo])));
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre, aoConfirmar: () => {} });
    const g = () => api.$("leiPreGrupo_remissao");
    const cartoes = () => achar(g(), (c) => /(^| )lei-pre-item( |$)/.test(c.className || "") && !/lei-pre-alt-item/.test(c.className));
    const cad = () => api.$("leiPreCadeia_" + rem[0].id);
    const depois = () => achar(cad(), (c) => c.className === "lei-pre-depois").map((c) => c.textContent);
    ok(cartoes().length === 1 && cad() && !api.$("leiPreItem_" + rem[1].id), "K1 a lista vira UM cartão: " + cartoes().map((c) => c.id).join(","));
    ok(depois().length === 1 && /^Art\. 2º.*distribuída: LIVRO I - .*; LIVRO II - Regula/.test(depois()[0]), "K2 o 'ficará' mostra o artigo inteiro como vai ficar: " + JSON.stringify(depois()));
    ok(achar(cad(), (c) => c.className === "lei-pre-antes").length === 2 && /linhas \d+ a \d+ — 2 itens de uma lista/.test(cad().textContent), "K2a as duas linhas que sobem, e o título da lista");
    const caixa = () => achar(cad(), (c) => c.type === "checkbox" && !/^leiPreUm_/.test(c.id || ""))[0];
    ok(caixa().checked === true && caixa().indeterminate === false, "K2b começa aceito");
    caixa().checked = false; caixa().onchange();
    const ctx = api.leiPreCtxAtual();
    ok(ctx.decisoes[rem[0].id] === false && ctx.decisoes[rem[1].id] === false && depois().length === 3 && /off/.test(cad().className), "K3 a caixa decide a lista toda; recusada, o 'ficará' mostra as 3 linhas separadas");
    caixa().checked = true; caixa().onchange();
    /* item a item: recusar só o último */
    const det = () => achar(cad(), (c) => c.className === "lei-pre-cadeia-itens")[0];
    ok(det().open === false && /2 de 2 aceitos/.test(det().textContent), "K4 'escolher item a item' recolhido, com a conta");
    det().open = true; det().ontoggle();
    const um = api.$("leiPreUm_" + rem[1].id);
    um.checked = false; um.onchange();
    ok(ctx.decisoes[rem[0].id] === true && ctx.decisoes[rem[1].id] === false, "K4a recusar só um item");
    ok(caixa().indeterminate === true && depois().length === 2 && /LIVRO I - /.test(depois()[0]) && /^LIVRO II - /.test(depois()[1]) && det().open === true,
      "K4b caixa em meio-termo, o 'ficará' com o recusado à parte, e o item a item continua aberto: " + JSON.stringify(depois()));
    const ap = api.leiAplicarPreprocesso(texto, pre.mudancas, ctx.decisoes);
    ok(/LIVRO I - Estabelece/.test(api.leiArtigo(ap.texto, "2").texto) && !/LIVRO II/.test(api.leiArtigo(ap.texto, "2").texto), "K5 a tela diz o mesmo que o texto aplicado");
    /* remissão sozinha (não é lista) continua com o cartão de sempre */
    const { api: a2 } = rodar();
    const tx = "Art. 1º. Texto do primeiro artigo que remete ao\nart. 5º desta Lei, conforme previsto.\nArt. 2º. Segundo.";
    const p2 = a2.leiPreprocessar(tx);
    a2.leiRevisarColagemAbrir({ modo: "criar", texto: tx, pre: p2, aoConfirmar: () => {} });
    /* duas remissões em artigos diferentes NÃO são uma lista: dois cartões */
    const { api: a3 } = rodar();
    const tx3 = ["Art. 1º. Texto do primeiro artigo que remete ao", "art. 5º desta Lei, conforme previsto.",
      "Art. 2º. Segundo artigo que remete ao", "art. 7º desta Lei, também.", "Art. 3º. Fim."].join("\n");
    const p3 = a3.leiPreprocessar(tx3);
    a3.leiRevisarColagemAbrir({ modo: "criar", texto: tx3, pre: p3, aoConfirmar: () => {} });
    ok(p3.mudancas.filter((m) => m.grupo === "remissao").length === 2 && a3.$("leiPreItem_rem:2") && a3.$("leiPreItem_rem:4"), "K6a remissões de artigos diferentes ficam em cartões separados");
    ok(a2.$("leiPreItem_rem:2") && !achar(a2.$("leiPreGrupo_remissao"), (c) => /lei-pre-cadeia/.test(c.className || "")).length, "K6 remissão sozinha: o cartão de sempre");
  }

  /* ---- V: artigo inteiro riscado, com o número dentro do risco (o relato: "faltam 72, 73, 74 … 486 a 491") ---- */
  {
    const { api } = rodar();
    const aplicar = (tx, dec) => { const p = api.leiPreprocessar(tx); return { p, r: api.leiAplicarPreprocesso(tx, p.mudancas, dec || {}) }; };
    const nums = (tx) => api.leiArtigos(tx).map((a) => a.num).join(",");
    const base = ["Art. 70. Primeiro.", "Art. 71. Segundo.",
      "~~Art. 72. Será sempre de trinta dias o prazo, se outro prazo não for estipulado em~~",
      "~~Lei Complementar. (~~Revogado pela lei complementar nº 018 de 2009)",
      "~~Art. 73. A notificação de lançamento conterá: (~~Revogado pela lei complementar nº 018 de 2009)",
      "~~I - o endereço do imóvel tributado;~~",
      "Art. 74. Texto vivo do setenta e quatro.",
      "~~Art. 75. Redação antiga do setenta e cinco.~~", "Art. 75. Redação nova do setenta e cinco.", "Art. 76. Fim."].join("\n");
    const { p, r } = aplicar(base);
    ok(nums(r.texto) === "70,71,72,73,74,75,76" && !api.leiNumeracao(api.leiArtigos(r.texto)).problemas.length, "V1 o revogado fica com o número: sem buraco na numeração: " + nums(r.texto));
    ok(api.leiArtigo(r.texto, "72").texto === "Art. 72. (Revogado pela lei complementar nº 018 de 2009)", "V2 a nota da linha de baixo entra no cabeçalho, com o parêntese: " + JSON.stringify(api.leiArtigo(r.texto, "72").texto));
    ok(api.leiArtigo(r.texto, "73").texto === "Art. 73. (Revogado pela lei complementar nº 018 de 2009)", "V2a a nota na mesma linha: " + JSON.stringify(api.leiArtigo(r.texto, "73").texto));
    ok(api.leiArtigos(r.texto).filter((a) => a.num === "75").length === 1 && /Redação nova/.test(api.leiArtigo(r.texto, "75").texto) && !/antiga|Revogado/.test(r.texto.split("Art. 75")[1] || ""),
      "V3 redação ANTIGA riscada de um artigo que continua: sai inteira (sem 'Art. 75. (Revogado)' duplicado)");
    const tch = p.mudancas.filter((m) => m.grupo === "tachado")[0];
    ok(/^Art\. 72\. \(Revogado\)/.test(tch.depois), "V4 o 'ficará' da revisão mostra o cabeçalho que fica: " + tch.depois);
    const dec = {}; p.mudancas.filter((m) => m.grupo === "tachado").forEach((m) => { dec[m.id] = false; });
    const { r: r2 } = aplicar(base, dec);
    ok(/Art\. 72\. Será sempre de trinta dias/.test(r2.texto) && !/\(Revogado\)/.test(r2.texto), "V5 recusar a limpeza: o texto fica como veio, sem '(Revogado)'");
    /* fora de ordem: o subtítulo inteiro riscado (478–491) ANTES da redação nova de 478–485 */
    const lin = ["Art. 477. Antes."];
    for (let n = 478; n <= 491; n++) lin.push("~~Art. " + n + ". Redação riscada do " + n + ".~~");
    for (let n = 478; n <= 485; n++) lin.push("Art. " + n + ". Redação nova do " + n + ".");
    lin.push("Art. 492. Depois.");
    const { r: r3 } = aplicar(lin.join("\n"));
    const seq = []; for (let n = 477; n <= 492; n++) seq.push(String(n));
    ok(nums(r3.texto) === seq.join(","), "V6 os revogados fora de ordem vão para o lugar certo, em ordem: " + nums(r3.texto));
    ok(/^Art\. 486\. \(Revogado\)$/.test(api.leiArtigo(r3.texto, "486").texto) && /Redação nova/.test(api.leiArtigo(r3.texto, "478").texto), "V6a o 486 revogado e o 478 com a redação nova");
  }

  /* ---- T4: só limpezas seguras — a ordem de sempre ---- */
  {
    const { api } = rodar();
    const tx = ["Art . 1º. Texto do primeiro artigo da lei de teste.", "Art. 2º. Texto do segundo artigo."].join("\n");
    const pre = api.leiPreprocessar(tx);
    api.leiRevisarColagemAbrir({ modo: "criar", texto: tx, pre, aoConfirmar: () => {} });
    ok(!api.$("leiPreSeguras") && api.$("leiPreGrupo_grafia"), "T4 sem nada para conferir, sem bloco recolhido: os grupos à vista");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["lei_pre_grav_apaga", "lei_pre_grav_estrutura", "lei_pre_grav_segura", "lei_pre_resumo_rever", "lei_pre_seguras", "lei_pre_curto_tachado", "lei_pre_curto_invisiveis",
      "lei_pre_curto_cabecalho", "lei_pre_curto_pagina", "lei_pre_curto_grafia", "lei_pre_curto_remissao", "lei_pre_curto_anexo", "lei_como_tit", "lei_como_ok", "lei_como_n",
      "lei_como_artigos", "lei_como_livros", "lei_como_titulos", "lei_como_capitulos", "lei_como_secoes", "lei_como_anexos", "lei_como_gigante", "lei_como_longo", "lei_como_anexo_rep",
      "lei_como_anexo_falta", "lei_como_espacado", "lei_como_num"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
