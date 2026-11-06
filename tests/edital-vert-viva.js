/* (19.91.0) O EDITAL VERTICALIZADO VIVO
 *
 *   EVV1–EVV2  as duas abas (viva por padrão; a folha igual a antes) e a escolha guardada
 *   EVV3–EVV7  marcar estudado grava no plano; ramificações uma a uma; desmarcar pergunta e não leva as irmãs
 *   EVV8       questões e acerto do banco, na cor dos cortes; cartões
 *   EVV9–EVV10 filtros (não estudados, uma disciplina) e o resumo
 *   EVV11      a planilha (CSV)
 *   EVV12      CSS: uma rolagem, cabeçalho preso; a legenda do número vermelho na folha
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const EXATO = [
  "# Teste Vivo | prova: 2030-01-31 | horas: 10",
  "@ Português :: 10q",
  "+ Crase :: 3 :: cai sempre",
  "+ Concordância :: 5",
  "@ Direito Financeiro :: 20q",
  "+ Orçamento :: 5 :: cai muito",
  "++ PPA :: 4 :: plurianual",
  "++ LOA :: 5",
  "+ Receita :: 2",
].join("\n");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test((c && c.className) || "");
  const tx = (e) => String((e && e.textContent) || "");
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(sim === undefined ? true : sim); } catch (e) {} }
    return promessa;
  };
  const { api: a } = rodar();
  a.matIniciar(); a.edIniciar();
  a.loja.removeItem("eac_vert_opc");
  const ed = a.edCriar("Teste Vivo", EXATO);
  a.hubAbrirEdital(ed.id);
  a.evAbrir();
  const viva = () => a.$("evViva");
  const linha = (nome) => achar(viva(), (e) => cls(e, "evv-lin")).find((tr) => achar(tr, (x) => cls(x, "evv-tx"))[0] && tx(achar(tr, (x) => cls(x, "evv-tx"))[0]) === nome);
  const ck = (nome) => { const tr = linha(nome); return tr ? achar(tr, (e) => e.tagName === "INPUT")[0] : null; };
  const chave = (d, t0) => (d + "›" + t0).toLowerCase();

  /* ---- as abas ---- */
  ok(a.$("evViva").hidden === false && a.$("evPrevia").hidden === true && cls(a.$("btnEvModoViva"), "sel") && a.$("evProgressoCx").hidden === true,
    "EVV1 abre na versão viva; a folha fica na outra aba; 'já marcar o que estudei' (só da folha) some");
  ok(/Estudados 0 de 4 assuntos \(0%\)/.test(tx(achar(viva(), (e) => cls(e, "evv-resumo"))[0])) && achar(viva(), (e) => cls(e, "evv-faixa")).length === 2,
    "EVV2 o resumo e uma faixa por disciplina: " + tx(achar(viva(), (e) => cls(e, "evv-resumo"))[0]));

  /* ---- marcar ---- */
  ck("Crase").checked = true; await ck("Crase").onchange();
  ok(a.edProgressoAtual()[chave("Português", "Crase")] && a.edProgressoAtual()[chave("Português", "Crase")].e === "feito" && ck("Crase").checked === true && /Estudados 1 de 4/.test(tx(viva())),
    "EVV3 marcar 'estudado' grava no plano (edProgresso) e a linha volta marcada, com a data");
  ok(ck("Orçamento").disabled === true && ck("PPA") && ck("PPA").disabled === false, "EVV4 o assunto com ramificações não se marca direto (as ramificações sim)");
  ck("PPA").checked = true; await ck("PPA").onchange();
  const P = a.edProgressoAtual();
  ok(P[chave("Direito Financeiro", "Orçamento") + "›#ppa"] && !P[chave("Direito Financeiro", "Orçamento") + "›#loa"] && ck("Orçamento").checked === false,
    "EVV5 marcar uma ramificação marca só ela; o assunto continua aberto: " + JSON.stringify(Object.keys(P)));
  ck("LOA").checked = true; await ck("LOA").onchange();
  ok(ck("Orçamento").checked === true, "EVV6 com todas as ramificações, o assunto fica estudado");
  /* a marca no TÓPICO (as ramificações herdam): desmarcar uma não leva as irmãs */
  const k0 = chave("Direito Financeiro", "Orçamento");
  delete P[k0 + "›#ppa"]; delete P[k0 + "›#loa"]; P[k0] = { e: "feito", d: "2026-10-01" };
  a.evvPintar();
  ok(ck("PPA").checked && ck("LOA").checked, "EVV7-pre a marca do tópico aparece nas duas ramificações");
  ck("LOA").checked = false;
  await conduzir(a, ck("LOA").onchange(), true);
  const P2 = a.edProgressoAtual();
  ok(!P2[k0] && P2[k0 + "›#ppa"] && P2[k0 + "›#ppa"].e === "feito" && !P2[k0 + "›#loa"] && ck("PPA").checked && !ck("LOA").checked,
    "EVV7 desmarcar LOA (com confirmação) deixa o PPA marcado: " + JSON.stringify(P2));

  /* ---- questões e cartões ---- */
  a.qsTodas().push({ id: "qv1", tipo: "ce", enunciado: "x", gabarito: "C", comentario: "", disciplina: "Português", topico: "Crase",
    tentativas: [{ q: "2026-10-01", acertou: true }, { q: "2026-10-02", acertou: true }, { q: "2026-10-03", acertou: true }, { q: "2026-10-04", acertou: false }] });
  a.matGravarCartoes(a.matChave("Português", "Crase"), "A crase ocorre antes de? :: palavra feminina\nOutra? :: sim", { disciplina: "Português", topico: "Crase" });
  a.evvPintar();
  const q = achar(linha("Crase"), (e) => cls(e, "evv-q"))[0];
  const kc = achar(linha("Crase"), (e) => cls(e, "evv-kc"))[0];
  ok(q && tx(q) === "4 · 75%" && cls(q, "bom") && tx(kc) === "2", "EVV8 as questões do banco (4 · 75%, na cor do corte) e os cartões do tópico (2): " + tx(q) + " / " + tx(kc));

  /* ---- filtros ---- */
  a.$("evvF_pend").onclick();
  ok(!linha("Crase") && linha("Concordância") && linha("Receita"), "EVV9 'não estudados' esconde o que já foi estudado");
  a.$("evvF_todos").onclick();
  const sd = achar(viva(), (e) => e.id === "evvDisc")[0];
  sd.value = "Português"; sd.onchange();
  ok(achar(viva(), (e) => cls(e, "evv-faixa")).length === 1 && linha("Crase") && !linha("Receita"), "EVV10 uma disciplina só");
  sd.value = ""; sd.onchange();

  /* ---- a planilha ---- */
  const v = a.evMontar(a.evLerOpc());
  const linhasCsv = a.evvCsvTexto(v, [].concat(...v.disciplinas.map((d) => d.linhas.map((l) => ({ l, d, estado: "nunca", n: 0, pct: null, cart: null, dom: "", quando: "", venceu: false }))))).split("\r\n");
  ok(linhasCsv[0].replace("﻿", "") === "disciplina;n;conteudo;estudado;estudado_em;revisao;questoes;acerto_pct;cartoes;dominio" && linhasCsv.length === 7,
    "EVV11 a planilha: cabeçalho e uma linha por assunto e ramificação (4 + 2 + cabeçalho): " + linhasCsv.length);

  /* ---- a folha (outra aba) e a escolha guardada ---- */
  a.$("btnEvModoFolha").onclick();
  ok(a.$("evPrevia").hidden === false && a.$("evViva").hidden === true && a.$("evProgressoCx").hidden === false && a.evvModo() === "folha", "EVV12 a aba da folha: a folha de antes, com 'já marcar o que estudei'");
  a.evAbrir();
  ok(a.$("evPrevia").hidden === false && cls(a.$("btnEvModoFolha"), "sel"), "EVV13 a escolha fica guardada ao abrir de novo");
  ok(/Nº em vermelho: assunto dividido em ramificações/.test(tx(achar(a.$("evPrevia"), (e) => cls(e, "ev-sub"))[0])), "EVV14 a folha explica o número em vermelho");
  a.$("btnEvModoViva").onclick();
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  ok(/dialog\.ev-dlg\[open\]\{display:flex;flex-direction:column;[^}]*overflow:hidden\}/.test(html) && /\.evv-faixa\{position:sticky;top:0/.test(html) && /\.evv-tab th\{position:sticky;top:36px/.test(html) && /#evViva>\.evv-rol\{flex:1 1 auto;min-height:0;overflow:auto\}/.test(html),
    "EVV15 uma rolagem só, e a faixa e o cabeçalho presos no alto ao rolar");
  a.$("btnEvCheia").onclick();
  ok(cls(a.$("dlgEdVert"), "ev-cheia") && a.loja.getItem("eac_vert_cheia") === "1" && a.$("evResumo").hidden === true, "EVV16 tela cheia liga e fica lembrada; na viva o resumo de cima sai (a lista já tem o dela)");
  a.$("btnEvCheia").onclick();
  ok(!cls(a.$("dlgEdVert"), "ev-cheia") && a.loja.getItem("eac_vert_cheia") === "0", "EVV17 e desliga");
  a.$("dlgEdVert").close();
  a.edApagar(ed.id);
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
