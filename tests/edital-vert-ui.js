/* =====================================================================
 * EDITAL VERTICALIZADO (V3) — a tela: botão, diálogo, prévia e impressão.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. A folha tem uma faixa por disciplina (na ordem escolhida) e, embaixo, a tabela
 *     Nº | CONTEÚDO | TEORIA | QUESTÕES | ACERTOS | REV. 1 | REV. 2 — com ACERTOS em branco.
 *  2. Cada opção do diálogo muda a folha na hora e fica guardada para a próxima vez.
 *  3. Imprimir leva SÓ a folha (a prévia e a impressão são o mesmo desenho), liga a classe que o CSS
 *     de impressão usa e desliga depois; sem disciplinas não imprime.
 *  4. Nome de disciplina com "<...>" aparece como texto, nunca como HTML.
 *  5. O CSS de impressão existe (esconde o resto, mantém as cores da faixa) — string estática, porque o
 *     simulador não tem folha de estilo e ninguém mais enxerga isso.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const EXATO = [
  "# Teste Verticalizado | prova: 2030-01-31 | horas: 10",
  "& Básicos | minimo: 50%",
  "@ Português :: 10q",
  "+ Crase :: 3 :: cai sempre",
  "+ Concordância :: 5",
  "& Específicos | minimo: 60%",
  "@ Direito Financeiro :: 20q",
  "+ Orçamento :: 5 :: cai muito !d",
  "++ PPA :: 4 :: plurianual",
  "++ LOA :: 5",
  "+ Receita :: 2",
  "@ Contabilidade :: 15q",
  "+ Balanço :: 4 :: !d3",
].join("\n");

function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const tx = (e) => String(e.textContent || "");
  const secoes = (a) => achar(a.$("evPrevia"), (e) => cls(e, "ev-disc"));
  const nomes = (a) => secoes(a).map((s) => tx(achar(s, (e) => cls(e, "ev-faixa-nome"))[0]));
  const linhas = (sec) => achar(sec, (e) => cls(e, "ev-lin"));
  const montar = (texto) => {
    const { api, janela } = rodar();
    api.$("editalTexto").value = texto === undefined ? EXATO : texto;
    api.evAbrir();
    return { api, janela };
  };
  const mexer = (a, id, valor) => { const el = a.$(id); if (typeof valor === "boolean") el.checked = valor; else el.value = valor; el.onchange(); };

  /* ---- VU1: o botão, o diálogo e a folha ---- */
  {
    const { api: a } = montar();
    ok(a.$("btnEdVert") && typeof a.$("btnEdVert").onclick === "function" && a.$("dlgEdVert") && a.$("edVertImpressao"), "VU1a o botao, o dialogo e a area de impressao existem e o botao esta ligado");
    ok(nomes(a).join(",") === "Direito Financeiro,Contabilidade,Português", "VU1b as faixas saem por questoes: " + nomes(a));
    ok(/Teste Verticalizado/.test(tx(achar(a.$("evPrevia"), (e) => cls(e, "ev-tit"))[0])) && /31\/01\/2030/.test(tx(achar(a.$("evPrevia"), (e) => cls(e, "ev-sub"))[0])), "VU1c o titulo e a data da prova (dd/mm/aaaa) vem do cabecalho");
    ok(/3 disciplina\(s\), 5 tópico\(s\), 2 ramo\(s\)/.test(a.$("evResumo").textContent), "VU1d o resumo conta disciplinas, topicos e ramos: " + a.$("evResumo").textContent);
    ok(a.$("btnEdVertImprimir").disabled === false, "VU1e com disciplinas o botao de imprimir fica ligado");
    ok(String(a.$("btnEdVert").getAttribute("aria-description") || "").length > 10 && String(a.$("btnEdVertImprimir").getAttribute("aria-description") || "").length > 10, "VU1f os botoes novos tem dica");
  }

  /* ---- VU2: as colunas ---- */
  {
    const { api: a } = montar();
    const sec = secoes(a)[0];
    const ths = achar(sec, (e) => e.tagName === "TH" || /^th$/i.test(e.tagName || "")).map(tx);
    ok(ths.join("|") === ["vert_col_n", "vert_col_conteudo", "vert_col_teoria", "vert_col_questoes", "vert_col_acertos", "vert_col_rev1", "vert_col_rev2"].map((k) => a.t(k)).join("|"), "VU2a o cabecalho tem as 7 colunas na ordem do modelo: " + ths.join("|"));
    ok(ths.join("|") === "Nº|Conteúdo|Teoria|Questões|Acertos|Rev. 1|Rev. 2", "VU2a2 e os nomes sao os do modelo: " + ths.join("|"));
    const tds = (l) => Array.from(l.children);
    const l0 = linhas(sec)[0];
    ok(tds(l0).length === 7 && tx(tds(l0)[0]) === "1" && tx(tds(l0)[1]) === "Orçamento", "VU2b cada linha tem 7 celulas: numero, conteudo e 5 colunas");
    ok(achar(tds(l0)[4], (e) => cls(e, "ev-cx")).length === 0 && [2, 3, 5, 6].every((i) => achar(tds(l0)[i], (e) => cls(e, "ev-cx")).length === 1), "VU2c ACERTOS fica em branco (sem caixinha) e as outras 4 colunas tem caixinha");
    ok(achar(sec, (e) => cls(e, "ev-cx-ok")).length === 0, "VU2d sem 'ja marcar o que estudei' todas as caixinhas saem vazias");
  }

  /* ---- VU3: a faixa ---- */
  {
    const { api: a } = montar();
    const tag = (i) => tx(achar(secoes(a)[i], (e) => cls(e, "ev-faixa-tag"))[0]);
    ok(tag(0) === "Específicos (mín. 60%) · 20 questões · 44% da prova", "VU3a a faixa leva grupo, minimo, questoes e fatia: " + tag(0));
    ok(tag(2) === "Básicos (mín. 50%) · 10 questões · 22% da prova", "VU3b " + tag(2));
    mexer(a, "evFaixa", false);
    ok(tag(0) === "Específicos (mín. 60%)", "VU3c sem 'faixa' fica so' o grupo: " + tag(0));
    const { api: b } = montar("# E\n@ Alfa :: 2\n+ a :: 3\n@ Beta :: 5\n+ b :: 3");
    ok(tx(achar(secoes(b)[0], (e) => cls(e, "ev-faixa-tag"))[0]) === "peso 5 · " + b.t("vert_fatia", { n: 71 }), "VU3d sem questoes a faixa mostra o peso: " + tx(achar(secoes(b)[0], (e) => cls(e, "ev-faixa-tag"))[0]));
  }

  /* ---- VU4: as opcoes mexem na folha ---- */
  {
    const { api: a } = montar();
    const df = () => secoes(a)[0];
    ok(linhas(df()).map((l) => tx(l.children[0])).join(",") === "1,1.1,1.2,2" && cls(linhas(df())[0], "ev-pai") && cls(linhas(df())[1], "ev-ramo"), "VU4a com ramos: 1, 1.1, 1.2, 2; o topico com ramos e' 'pai'");
    mexer(a, "evRamos", false);
    ok(linhas(df()).map((l) => tx(l.children[0])).join(",") === "1,2" && achar(a.$("evPrevia"), (e) => cls(e, "ev-ramo")).length === 0, "VU4b sem ramos: so' 1 e 2");
    ok(/0 ramo\(s\)|3 disciplina\(s\), 5 tópico\(s\), 0 ramo/.test(a.$("evResumo").textContent), "VU4b2 o resumo acompanha: " + a.$("evResumo").textContent);
    mexer(a, "evMotivo", true);
    ok(tx(achar(df(), (e) => cls(e, "ev-motivo"))[0]) === "cai muito", "VU4c com 'motivo' a nota do peso aparece embaixo do assunto");
    mexer(a, "evOrdem", "edital");
    ok(nomes(a).join(",") === "Português,Direito Financeiro,Contabilidade", "VU4d ordem do edital: " + nomes(a));
  }

  /* ---- VU5: as caixinhas refletem o progresso ---- */
  {
    const { api: a } = montar();
    a.edProgressoPor({ "português›crase": { e: "revisado", d: "2026-09-01" }, "português›concordância": { e: "feito", d: "2026-09-02" }, "direito financeiro›receita": { e: "pulado" } });
    mexer(a, "evProgresso", true);
    const pt = secoes(a).find((s) => tx(achar(s, (e) => cls(e, "ev-faixa-nome"))[0]) === "Português");
    const L = linhas(pt);
    const oks = (l) => Array.from(l.children).map((td) => achar(td, (e) => cls(e, "ev-cx-ok")).length);
    ok(oks(L[0]).slice(2).join(",") === "1,0,0,1,0", "VU5a 'revisado': Teoria e Rev. 1 marcados: " + oks(L[0]).slice(2));
    ok(oks(L[1]).slice(2).join(",") === "1,0,0,0,0", "VU5b 'feito': so' Teoria: " + oks(L[1]).slice(2));
    const df = secoes(a).find((s) => tx(achar(s, (e) => cls(e, "ev-faixa-nome"))[0]) === "Direito Financeiro");
    const rec = linhas(df).find((l) => tx(l.children[1]) === "Receita");
    ok(cls(rec, "ev-pulado") && tx(rec.children[2]) === "—", "VU5c 'pulado' vira linha apagada com tracos no lugar das caixinhas");
    mexer(a, "evProgresso", false);
    ok(achar(a.$("evPrevia"), (e) => cls(e, "ev-cx-ok")).length === 0, "VU5d desligar volta tudo em branco");
  }

  /* ---- VU6: 2a fase ---- */
  {
    const { api: a } = montar();
    ok(a.$("evFase2Cx").hidden === false, "VU6a com topicos na 2a fase a opcao aparece");
    mexer(a, "evFase2", true);
    ok(nomes(a).join(",") === "Direito Financeiro,Contabilidade" && /2ª fase/.test(tx(achar(a.$("evPrevia"), (e) => cls(e, "ev-sub"))[0])), "VU6b so' a 2a fase (e o subtitulo diz): " + nomes(a));
    ok(linhas(secoes(a)[1])[0].children[1].textContent === "Balanço", "VU6c");
    const { api: b } = montar("# E\n@ A :: 5\n+ x :: 3");
    ok(b.$("evFase2Cx").hidden === true, "VU6d sem topico na 2a fase a opcao nao aparece");
    b.$("evFase2").checked = true;
    b.$("evFase2").onchange();
    ok(nomes(b).join(",") === "A", "VU6e (marcada mas escondida) a opcao nao esvazia a folha");
  }

  /* ---- VU7: opcoes lembradas ---- */
  {
    const { api: a, janela } = montar();
    mexer(a, "evOrdem", "edital"); mexer(a, "evRamos", false); mexer(a, "evMotivo", true); mexer(a, "evFaixa", false);
    const salvo = JSON.parse(janela.localStorage.getItem("eac_vert_opc") || "{}");
    ok(salvo.ordem === "edital" && salvo.ramos === false && salvo.motivo === true && salvo.faixa === false, "VU7a as opcoes ficam guardadas: " + JSON.stringify(salvo));
    a.$("evOrdem").value = "peso"; a.$("evRamos").checked = true; a.$("evMotivo").checked = false; a.$("evFaixa").checked = true;
    a.evAbrir();
    ok(a.$("evOrdem").value === "edital" && a.$("evRamos").checked === false && a.$("evMotivo").checked === true && a.$("evFaixa").checked === false, "VU7b abrir de novo restaura as opcoes");
    janela.localStorage.setItem("eac_vert_opc", "{isso nao e json");
    a.evAbrir();
    ok(a.$("evOrdem").value === "peso" && a.$("evRamos").checked === true, "VU7c opcao guardada estragada volta ao padrao, sem quebrar");
  }

  /* ---- VU8: sem edital ---- */
  {
    const { api: a, janela } = montar("");
    ok(secoes(a).length === 0 && a.$("btnEdVertImprimir").disabled === true && a.$("evResumo").textContent === a.t("vert_vazio"), "VU8a sem disciplinas: aviso, folha vazia e imprimir desligado");
    ok(a.evImprimir() === false && !janela.document.body.classList.contains("eac-imprimindo"), "VU8b imprimir sem disciplinas nao faz nada");
  }

  /* ---- VU9: imprimir ---- */
  {
    const { api: a, janela } = montar();
    let durante = null; const ouv = {};
    janela.print = () => { durante = { classe: janela.document.body.classList.contains("eac-imprimindo"), folha: achar(a.$("edVertImpressao"), (e) => cls(e, "ev-folha")).length, secoes: achar(a.$("edVertImpressao"), (e) => cls(e, "ev-disc")).length }; };
    janela.addEventListener = (tipo, fn) => { ouv[tipo] = fn; };
    janela.removeEventListener = (tipo) => { delete ouv[tipo]; };
    ok(a.evImprimir() === true, "VU9a imprimir devolve true");
    ok(durante && durante.classe === true && durante.folha === 1 && durante.secoes === 3, "VU9b na hora de imprimir: a classe do CSS esta ligada e a folha completa esta na area de impressao: " + JSON.stringify(durante));
    ok(typeof ouv.afterprint === "function", "VU9c a limpeza fica esperando o 'afterprint'");
    ouv.afterprint();
    ok(!janela.document.body.classList.contains("eac-imprimindo") && a.$("edVertImpressao").children.length === 0 && !ouv.afterprint, "VU9d depois da impressao a classe sai, a area esvazia e o ouvinte e' tirado");
    /* o que a pessoa escolheu vale na impressao */
    mexer(a, "evOrdem", "edital"); mexer(a, "evRamos", false);
    a.evImprimir();
    const nomesImp = achar(a.$("edVertImpressao"), (e) => cls(e, "ev-faixa-nome")).map(tx);
    ok(nomesImp.join(",") === "Português,Direito Financeiro,Contabilidade" && achar(a.$("edVertImpressao"), (e) => cls(e, "ev-ramo")).length === 0, "VU9e a impressao usa as opcoes escolhidas: " + nomesImp);
    ouv.afterprint();
    /* sem window.print (navegador sem suporte): limpa na hora, nao deixa a pagina travada em modo de impressao */
    delete janela.print;
    a.evImprimir();
    ok(!janela.document.body.classList.contains("eac-imprimindo") && a.$("edVertImpressao").children.length === 0, "VU9f sem window.print nao deixa a classe nem a folha penduradas");
  }

  /* ---- VU10: texto, nao HTML ---- */
  {
    const { api: a } = montar("# X\n@ <b>Negrito</b> <img src=x onerror=1> :: 5q\n+ <i>t</i> :: 3");
    ok(nomes(a)[0] === "<b>Negrito</b> <img src=x onerror=1>" && achar(a.$("evPrevia"), (e) => /^(img|b|i)$/i.test(e.tagName || "")).length === 0, "VU10 nomes com <...> saem como texto: " + nomes(a));
  }

  /* ---- VU11: o CSS de impressao (estatico) ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/@media print\s*\{[^}]*body\.eac-imprimindo > \*:not\(#edVertImpressao\)\{display:none!important\}/.test(html), "VU11a em impressao tudo some, menos #edVertImpressao");
    ok(/#edVertImpressao\{display:none\}/.test(html) && /body\.eac-imprimindo #edVertImpressao\{display:block\}/.test(html), "VU11b a area de impressao e' escondida na tela e so' aparece imprimindo");
    ok(/\.ev-folha \*\{-webkit-print-color-adjust:exact;print-color-adjust:exact\}|\.ev-folha,\.ev-folha \*\{-webkit-print-color-adjust:exact;print-color-adjust:exact\}/.test(html), "VU11c as cores (faixa preta, zebra) saem na impressao");
    ok(/\.ev-faixa\{[^}]*background:#000;color:#fff[^}]*break-after:avoid/.test(html) && /\.ev-lin\{break-inside:avoid\}/.test(html), "VU11d a faixa e' preta com letra branca, nao fica sozinha no fim da pagina e a linha nao e' cortada");
    ok(/html\.tem-modal\{overflow:visible!important\}/.test(html), "VU11e o travamento de rolagem do modal nao corta a folha em uma pagina so'");
    ok(/dialog\.ev-dlg\{[^}]*width:min\(980px,96vw\)[^}]*max-width:min\(980px,96vw\)/.test(html), "VU11g o dialogo e' largo (o .ui-modal limita em 440px e a folha precisa de espaco)");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/"edital-vert\.js"/.test(sw) && /"edital-vert-ui\.js"/.test(sw) && /<script src="edital-vert\.js">/.test(html) && /<script src="edital-vert-ui\.js">/.test(html), "VU11f os dois arquivos novos estao no HTML e no cache offline");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
