/* =====================================================================
 * DISCURSIVAS — LER OS TEMAS (19.156.0)
 *
 * O RELATO (recomendações recebidas, conferidas no código e nos 14 temas guardados): a lista de temas tinha rolagem
 * própria e o leitor ficava longe dela; não havia como marcar um tema como lido (só "por escrever" e "escrita"); e 12 de
 * 13 respostas modelo vieram num bloco só.
 *
 * O QUE PRECISA SER VERDADE:
 *  L1. parágrafos: separados por linha em branco (ou quebra simples); frases sem cortar em "art.", "nº";
 *  L2. dividir um bloco em k parágrafos (k = itens do espelho), preferindo cortar onde começa assunto novo; com desfazer;
 *  L3. três estados: ○ não lido · ◐ lido · ✓ escrito; marcar leva ao próximo; o filtro "não lidas";
 *  L4. o Painel conta os lidos e o passo 3 da trilha só fica verde com todos lidos;
 *  L5. a faixa da agenda ganha "Ler os temas (lidos/total)", com 10 min por tema que falta (até 6) na reserva;
 *  L6. o pedido à IA exige os parágrafos separados por linha em branco; a tela mostra um <p> por parágrafo.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const BLOCO = "A receita orçamentária é reconhecida no momento da arrecadação, conforme o art. 35, inciso I, da Lei nº 4.320/1964. "
    + "Esse regime orçamentário convive com o regime patrimonial. "
    + "Quanto ao segundo comando, o crédito tributário é registrado pela competência. "
    + "O lançamento contábil usa as classes 1 e 4 do PCASP. "
    + "Por fim, o controle da disponibilidade por destinação de recursos acompanha a arrecadação. "
    + "Assim se garante a transparência exigida pela LRF.";
  const ESPELHO = "Item 1 (10 pontos): regime orçamentário.\nItem 2 (10 pontos): regime patrimonial.\nItem 3 (10 pontos): PCASP.";

  /* L1 + L2 */
  {
    const { api } = rodar();
    ok(api.dsParagrafos("um\n\ndois").length === 2 && api.dsParagrafos("um\ndois").length === 2 && api.dsParagrafos("um só bloco").length === 1, "L1a parágrafos por linha em branco ou quebra simples");
    const fr = api.dsFrases(BLOCO);
    ok(fr.length === 6 && /art\. 35, inciso I, da Lei nº 4\.320\/1964\.$/.test(fr[0]), "L1b frases sem cortar em 'art.' e 'nº': " + fr.length + " · " + fr[0].slice(-40));
    ok(api.dsItensDoEspelho(ESPELHO) === 3 && api.dsItensDoEspelho("") === 3 && api.dsItensDoEspelho("1. a\n2. b\n3. c\n4. d\n5. e\n6. f") === 5, "L2a os itens do espelho dizem quantos parágrafos (2 a 5)");
    const ps = api.dsDividirEmParagrafos(BLOCO, 3);
    ok(ps.length === 3 && /^Quanto ao segundo/.test(ps[1]) && /^Por fim/.test(ps[2]) && ps.join(" ") === api.dsFrases(BLOCO).join(" "),
      "L2b dividir em 3 corta onde começa 'Quanto…' e 'Por fim…', sem perder texto: " + ps.map((x) => x.slice(0, 20)).join(" | "));
  }

  /* L3 + L4 + L5 + L6: com um edital de discursiva */
  {
    const { api, janela } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Disc L", ["# Disc L | prova: " + daqui(15) + " | horas: 10", "# discursiva | pontos: 30 | objetiva: 70 | linhas: 20-30 | disciplinas: A", "@ A :: 5", "+ Tema um :: 5"].join("\n"));
    const p1 = api.dsPropostaAdicionar(e.id, { tema: "Receita", disc: "A", enunciado: "Disserte.", espelho: ESPELHO, modelo: BLOCO, fonte: "ia" });
    const p2 = api.dsPropostaAdicionar(e.id, { tema: "Despesa", disc: "A", enunciado: "Disserte 2.", espelho: "x", modelo: "Primeiro parágrafo da resposta.\n\nSegundo parágrafo da resposta.", fonte: "ia" });
    const p3 = api.dsPropostaAdicionar(e.id, { tema: "Dívida", disc: "A", enunciado: "Disserte 3.", espelho: "y", fonte: "ia" });
    const dc = api.dsDiscursivaDe(e).dc, sit = api.dsDiasProva(e);
    let P = api.dsPainel(e, null, dc, sit);
    ok(P.lidas === 0 && P.paraLer.length === 3, "L4a o Painel conta os temas a ler");
    const trilha = () => api.dsTrilhaEstado(dc, api.dsPainel(e, null, dc, sit), 0);
    ok(trilha()[2].feito === false && trilha()[2].parcial === true, "L4b com tema por ler, o passo 3 fica parcial");
    /* a faixa da agenda */
    const S0 = api.dagSemana(e, null);
    const ler0 = S0.etapas.filter((s) => s.tipo === "ler")[0];
    ok(ler0 && ler0.n === 3 && ler0.feitos === 0 && ler0.min === 30 && S0.reservaMin === api.dagReservaMin(e), "L5a a faixa tem 'Ler os temas (0/3)', 30 min, e a reserva da agenda inclui");
    /* a tela */
    api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "propostas");
    api.dsRender();
    const item1 = api.$("dsPropIt_" + p1.id);
    ok(item1 && /^○ /.test(item1.textContent), "L3a a lista começa com ○ (não lido)");
    const mod = api.$("dsModeloTxt_" + p1.id) || api.$("dsModeloTxt_" + p2.id) || api.$("dsModeloTxt_" + p3.id);
    const leitorP = [p1, p2, p3].filter((p) => api.$("dsModeloTxt_" + p.id))[0];
    ok(!!mod && achar(mod, (x) => /ds-mod-par/.test(x.className || "")).length >= 1, "L6a a resposta modelo vira parágrafos (<p>)");
    /* marcar como lido leva ao próximo */
    const lido = api.$("dsPropLida_" + leitorP.id);
    ok(!!lido, "L3b o botão de marcar como lido no leitor");
    lido.onclick();
    const depois = api.dsPropostas(e.id).filter((p) => p.id === leitorP.id)[0];
    ok(!!depois.lida && /^◐ /.test(api.$("dsPropIt_" + leitorP.id).textContent), "L3c marcado: a data fica no tema e a lista mostra ◐");
    P = api.dsPainel(e, null, dc, sit);
    ok(P.lidas === 1 && P.paraLer.length === 2, "L4c o Painel conta o lido");
    /* dividir o bloco de p1 */
    api.dsModeloDividir(e.id, p1.id);
    const pm = api.dsPropostas(e.id).filter((p) => p.id === p1.id)[0];
    ok(api.dsParagrafos(pm.modelo).length === 3, "L2c o modelo de um bloco só é guardado em 3 parágrafos (os itens do espelho)");
    /* todos lidos: o passo 3 fica verde e a etapa da faixa feita */
    [p1, p2, p3].forEach((p) => api.dsPropMarcarLida(e.id, p.id, true));
    ok(trilha()[2].parcial === false && (trilha()[2].feito === true || api.dsPainel(e, null, dc, sit).semModelo.length > 0), "L4d todos lidos: o passo 3 só depende do modelo que falta (modo completo)");
    const S1 = api.dagSemana(e, null);
    const ler1 = S1.etapas.filter((s) => s.tipo === "ler")[0];
    ok(ler1.feito === true && ler1.feitos === 3 && ler1.min === 0, "L5b todos lidos: a etapa fica feita e não reserva mais tempo");
    /* desmarcar */
    api.dsPropMarcarLida(e.id, p2.id, false);
    ok(!api.dsPropostas(e.id).filter((p) => p.id === p2.id)[0].lida && api.dagSemana(e, null).etapas.filter((s) => s.tipo === "ler")[0].feitos === 2, "L3d desmarcar volta a não lido");
    /* o pedido à IA pede os parágrafos */
    ok(/SEPARADOS POR UMA LINHA EM BRANCO/.test(api.t("ds_prompt_completos")) && /linha em branco/.test(api.t("ds_prompt_modelo")), "L6b os pedidos exigem os parágrafos separados");
    /* A−/A+ da leitura */
    api.dsRender();
    api.$("dsLerMais").onclick(); api.$("dsLerMais").onclick();
    ok(api.lojaLer("eac_ds_fonte") === "19" && api.$("secDiscursivas").getAttribute("data-ds-ler") === "19", "L8c A+ aumenta a letra de leitura e fica guardada");
    api.$("dsLerMenos").onclick();
    ok(api.lojaLer("eac_ds_fonte") === "18", "L8d A− diminui");
    void janela;
  }
  /* o layout lado a lado */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/@media \(min-width:960px\)\{\.ds-pl-corpo\{display:grid/.test(html) && /\.ds-pl-corpo \.ds-prop-lista\{[^}]*position:sticky/.test(html), "L7 na tela larga, lista e leitor lado a lado (a lista presa)");
    /* a letra: o módulo em escala, a leitura do tema com A−/A+ */
    const semEscala = (html.match(/\.ds-[a-z0-9-]+[^{}]*\{[^{}]*font-size:\s*[0-9.]+px/g) || []);
    ok(/#secDiscursivas\{--ds-esc:1\.15\}/.test(html) && !semEscala.length, "L8a toda letra das regras .ds-* passa pela escala do módulo (+15%): " + semEscala.slice(0, 2).join(" | "));
    ok(/#secDiscursivas \.ds-leitor \.ds-prop-enun,#secDiscursivas \.ds-leitor \.ds-modelo\{font-size:var\(--ds-ler,17px\)/.test(html), "L8b a leitura do tema tem letra própria (17 px)");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
