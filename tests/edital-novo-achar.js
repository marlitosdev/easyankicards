/* (19.99.0) ACHAR O "NOVO EDITAL" — e não criar outro quando é a virada de um previsto
 *
 *   NA1  o botão "＋ Novo edital" está no topo da aba (fora do ⋯), à vista em qualquer aba, e abre a caixa
 *   NA2  o seletor termina em "＋ Novo edital…": escolher abre a caixa e o seletor volta ao que estava
 *   NA3  sem nenhum edital, o botão continua à vista (o seletor some)
 *   NA4  o previsto aparece "(previsto)" no seletor e, na agenda, com a janela e "Saiu o edital → fazer a virada"
 *   NA5  o botão da agenda abre o previsto e a virada
 *   NA6  na caixa do novo edital, dizer que o edital saiu oferece a virada nos previstos (o de nome parecido primeiro);
 *        no modo pré-edital, não
 *   NA7  "fazer a virada" leva a data e o plano colado para a caixa da virada, e não cria edital
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const ano = new Date().getFullYear() + 1;

  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  api.hubRender();

  /* ---- sem editais ---- */
  ok(api.$("btnEdNovoTopo") && api.$("edTopoSel").hidden === true, "NA3 sem edital, o seletor some e o botão fica");
  const topo = html.slice(html.indexOf('id="edTopo"'), html.indexOf('id="edAbas"'));
  ok(/id="btnEdNovoTopo"/.test(topo) && topo.indexOf('id="btnEdNovoTopo"') < topo.indexOf('id="edTopoMenu"') && !/edsel-ferr[^>]*>[^]*btnEdNovoTopo[^]*<\/div>\s*<div class="edsel-fim"/.test(topo),
    "NA1 o botão mora no topo da aba, fora do ⋯ e fora das ferramentas do edital aberto");
  api.$("btnEdNovoTopo").onclick();
  ok(api.$("dlgEdNovo").open === true && /id="btnEdNovoTopo" data-i18n="ed_sel_novo_bt"/.test(topo) && api.t("ed_sel_novo_bt") === "＋ Novo edital", "NA1b o botão abre a caixa do novo edital");
  api.$("dlgEdNovo").close();

  /* ---- um publicado e um previsto ---- */
  const pub = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + ano + "-05-10 | horas: 20\n@ Contabilidade :: 5\n+ PCASP :: 5");
  const prev = api.edCriar("ISS Recife — Auditor", "# ISS Recife | previsto: " + ano + "-03.." + ano + "-06 | horas: 15\n@ Tributário :: 5\n+ ISS :: 5\n@ Contabilidade :: 4\n+ PCASP :: 4");
  const outro = api.edCriar("TCE-PE previsto", "# TCE-PE | previsto: " + ano + "-09 | horas: 10\n@ Controle Externo :: 5\n+ Fiscalização :: 5");
  api.hubVoltar(); api.hubRender();

  const sel = api.$("edSel");
  const ops = Array.from(sel.children || []);
  const ult = ops[ops.length - 1];
  ok(ult.value === "__novo__" && ult.textContent === "＋ Novo edital…" && ops.some((o) => o.value === String(prev.id) && /\(previsto\)$/.test(o.textContent))
    && !ops.some((o) => o.value === String(pub.id) && /previsto/.test(o.textContent)),
    "NA2/NA4 o seletor marca o previsto e termina em '＋ Novo edital…': " + ops.map((o) => o.textContent).join(" | "));
  sel.value = "__novo__"; sel.onchange();
  ok(api.$("dlgEdNovo").open === true && sel.value === "" && !api.edAberto(), "NA2b escolher '＋ Novo edital…' abre a caixa e o seletor volta a 'Todos'");
  api.$("dlgEdNovo").close();

  /* ---- a agenda ---- */
  api.hubPintarAgenda();
  const av = api.$("edPrevAviso_" + prev.id);
  ok(av && new RegExp("ISS Recife — Auditor ainda é pré-edital \\(prova esperada para mar/" + ano + " – jun/" + ano + "\\)").test(av.textContent) && api.$("btnEdPrevVirada_" + prev.id) && !api.$("edPrevAviso_" + pub.id),
    "NA4b a agenda diz que o previsto é previsto, com a janela: " + (av && av.textContent));
  api.$("btnEdPrevVirada_" + prev.id).onclick();
  ok(api.edAberto() && api.edAberto().id === prev.id && api.$("dlgVirada").open === true && api.edAbaAtualTeste() === "plano", "NA5 o botão abre o previsto e a virada");
  api.$("dlgVirada").close();
  api.hubVoltar();

  /* ---- a caixa do novo edital ---- */
  const set = (id, v) => { api.$(id).value = v; if (api.$(id).oninput) api.$(id).oninput(); };
  const modo = (qual) => { const id = { data: "edNovoModoData", sem: "edNovoModoSem", pre: "edNovoModoPre" }[qual]; api.$(id).checked = true; api.$(id).onchange(); };
  api.hubNovo();
  set("edNovoNome", "Prefeitura do Recife — Auditor do ISS");
  ok(api.$("edNovoVirada").hidden === true, "NA6 antes de dizer em que pé está, a caixa não oferece nada");
  modo("pre");
  ok(api.$("edNovoVirada").hidden === true, "NA6b pré-edital: não oferece a virada");
  modo("data");
  set("edNovoProva", ano + "-04-20");
  const bts = todos(api.$("edNovoVirada")).filter((x) => x.tag === "button");
  ok(api.$("edNovoVirada").hidden === false && bts.length === 2 && bts[0].id === "btnEdNovoVirada_" + prev.id && /btn-min-ok/.test(bts[0].className)
    && bts[1].id === "btnEdNovoVirada_" + outro.id && !/btn-min-ok/.test(bts[1].className),
    "NA6c 'tenho a data': oferece a virada nos previstos, o de nome parecido primeiro: " + bts.map((b) => b.textContent).join(" | "));
  modo("sem");
  ok(api.$("edNovoVirada").hidden === false, "NA6d 'saiu, sem data' também oferece");
  modo("data");
  set("edNovoPlano", "@ Direito Tributário :: 20q\n+ ISS :: 5\n@ Contabilidade :: 10q\n+ PCASP :: 4");
  const antes = api.editaisLista().length;
  api.$("btnEdNovoVirada_" + prev.id).onclick();
  const vt = api.$("vrTexto").value;
  ok(api.$("dlgEdNovo").open === false && api.$("dlgVirada").open === true && api.edAberto().id === prev.id && api.editaisLista().length === antes
    && new RegExp("prova: " + ano + "-04-20").test(vt) && /horas: 15/.test(vt) && /@ Direito Tributário :: 20q/.test(vt),
    "NA7 a virada abre com a data e o plano colado (sem criar edital): " + vt.split("\n")[0]);
  ok(/vr-resumo/.test(api.$("vrAviso").innerHTML || "") || api.$("vrAviso").hidden === false, "NA7b e a comparação já aparece");
  api.$("dlgVirada").close();
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
