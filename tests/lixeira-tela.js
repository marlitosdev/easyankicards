/* (19.92.0) A TELA DA LIXEIRA
 *
 *   LT1–LT3   o cartão como cartão (frente, verso, lacunas em destaque, etiquetas, caminho; o original numa gaveta)
 *   LT4–LT5   "hoje / ontem / há N dias" e os grupos por dia; o selo de risco só para médio e alto
 *   LT6       "restaurar em …" diz para onde volta
 *   LT7–LT8   o lote (o que saiu de uma vez) junto, com "restaurar o lote"
 *   LT9–LT11  a seleção de vários: restaurar e apagar de vez
 *   LT12      o plano B quando o lugar de origem não existe (o cartão volta para a bancada)
 *   LT13–LT14 a busca; um só fechar e o "esvaziar" sozinho no rodapé
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const tick = () => new Promise((r) => setImmediate(r));
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test((e && e.className) || "");
  const tx = (e) => String((e && e.textContent) || "");
  const novo = () => { const { api } = rodar(); api.matIniciar(); api.edIniciar(); api.qsUiIniciar(); api.leiIniciar(); return api; };

  /* ---- o cartão como cartão ---- */
  {
    const api = novo();
    const B = "@ CTM Caruaru > Imunidade > Retenção na Fonte\nA imunidade impede a responsabilização pela retenção? {{c1::Não}}, a imunidade não afasta a {{c2::retenção na fonte::qual?}}. ::  :: imunidade retencao_fonte\n+ Esquema — Autonomia das figuras";
    const p = api.lixCartaoPartes(B);
    ok(p.caminho === "CTM Caruaru > Imunidade > Retenção na Fonte" && /\{\{c1::Não\}\}/.test(p.frente) && p.verso === "" && p.tags.join() === "imunidade,retencao_fonte" && /Esquema/.test(p.extra),
      "LT1 o cartão em partes: caminho, frente (com a lacuna), verso, etiquetas e o extra: " + JSON.stringify(p));
    ok(api.lixDividir("a {{c1::x::y}} b :: c").length === 2, "LT2 o '::' dentro da lacuna não divide o cartão");
    ok(api.lixCartaoPartes("P :: R :: imunidade, obrigacao_acessoria, concurso_X").tags.join("|") === "imunidade|obrigacao_acessoria|concurso_X", "LT2b etiquetas separadas por vírgula também viram selos limpos");
    api.lixJogar({ tipo: "cartao", via: "material", rotulo: "A imunidade impede", onde: "Sistema Tributário Brasileiro · Limitações ao poder de tributar", dados: { bloco: B, chave: "x›y" } });
    api.lixAbrir();
    const it = achar(api.$("lixLista"), (e) => cls(e, "lix-item"))[0];
    const lac = achar(it, (e) => cls(e, "lix-lac")).map(tx);
    ok(achar(it, (e) => cls(e, "lix-cartao")).length === 1 && lac.join("|") === "Não|retenção na fonte" && achar(it, (e) => cls(e, "lix-tag")).length === 2
      && /CTM Caruaru > Imunidade/.test(tx(achar(it, (e) => cls(e, "lix-caminho"))[0])) && achar(it, (e) => cls(e, "lix-orig")).length === 1 && tx(it).indexOf("{{c1::Não}}") >= 0,
      "LT3 aparece como cartão: as lacunas em destaque, as etiquetas, o caminho; o texto cru fica só na gaveta 'texto original': " + lac.join("|"));
    /* datas e grupos */
    ok(/^hoje · \d\d\/\d\d \d\d:\d\d$/.test(api.lixQuando(new Date().toISOString())) && /^há 3 dias/.test(api.lixQuando(new Date(Date.now() - 3 * 86400000).toISOString()))
      && api.lixGrupoDia(new Date(Date.now() - 86400000).toISOString()) === "ontem" && api.lixGrupoDia(new Date(Date.now() - 40 * 86400000).toISOString()) === "antes",
      "LT4 'hoje / ontem / há N dias' e os grupos por dia");
    ok(/Hoje/.test(tx(achar(api.$("lixLista"), (e) => cls(e, "lix-dia"))[0])) && achar(it, (e) => cls(e, "dec-risco")).length === 0, "LT5 a lista agrupa por dia; 'risco baixo' não ganha selo");
    const br = achar(it, (e) => cls(e, "lix-restaurar"))[0];
    ok(tx(br) === "restaurar em Limitações ao poder de tributar", "LT6 o botão diz para onde volta: " + tx(br));
  }

  /* ---- o lote ---- */
  {
    const api = novo();
    api.$("editor").value = "";
    const lista = [1, 2, 3].map((k) => ({ tipo: "cartao", via: "editor", rotulo: "c" + k, onde: "bancada", dados: { bloco: "Frente " + k + " :: Verso " + k, linha: 1 } }));
    api.lixJogarLote(lista, "repetidos");
    api.lixJogar({ tipo: "nota", via: "artigo", rotulo: "solta", onde: "Lei X", dados: { lei: "nao_tem", num: "1", texto: "nota solta" } });
    api.lixAbrir();
    const lotes = achar(api.$("lixLista"), (e) => cls(e, "lix-lote"));
    ok(lotes.length === 1 && /3 itens apagados de uma vez — Cartões repetidos/.test(tx(lotes[0])) && achar(api.$("lixLista"), (e) => cls(e, "lix-item")).length === 4,
      "LT7 o que saiu de uma vez aparece junto, dizendo de onde: " + tx(lotes[0]).slice(0, 80));
    achar(lotes[0], (e) => cls(e, "lix-lote-rest"))[0].onclick();
    ok(api.lixLer().length === 1 && /Frente 1/.test(api.$("editor").value) && /Frente 3/.test(api.$("editor").value), "LT8 'restaurar o lote' devolve os três de uma vez");
  }

  /* ---- a seleção ---- */
  {
    const api = novo();
    ["a", "b", "c"].forEach((k) => api.lixJogar({ tipo: "cartao", via: "editor", rotulo: k, onde: "bancada", dados: { bloco: k.toUpperCase() + " :: " + k, linha: 1 } }));
    api.lixAbrir();
    const cks = achar(api.$("lixLista"), (e) => cls(e, "lix-ck"));
    cks[0].checked = true; cks[0].onchange(); cks[1].checked = true; cks[1].onchange();
    ok(/2 selecionado/.test(tx(api.$("lixSelBar"))) && api.$("btnLixSelRest") && api.$("btnLixSelVez"), "LT9 marcar dois mostra a barra da seleção: " + tx(api.$("lixSelBar")));
    api.$("btnLixSelRest").onclick();
    ok(api.lixLer().length === 1 && api.lixLer()[0].rotulo === "a", "LT10 'restaurar os selecionados' devolve os dois (o mais novo primeiro na lista: c e b)");
    api.lixJogar({ tipo: "cartao", via: "editor", rotulo: "d", onde: "bancada", dados: { bloco: "D :: d", linha: 1 } });
    const p = api.lixApagarVariosDeVez(api.lixLer().map((x) => x.id));
    await tick();
    ok(/Apagar de vez 2 item/.test(api.$("uiModalMsg").textContent), "LT11 apagar de vez vários pergunta antes, com quantos: " + api.$("uiModalMsg").textContent.replace(/\n/g, "|"));
    api.uiModalResponder(true);
    ok((await p) === true && api.lixLer().length === 0, "LT11b e apaga");
  }

  /* ---- o plano B ---- */
  {
    const api = novo();
    api.$("editor").value = "";
    api.lixJogar({ tipo: "cartao", via: "lugar_que_sumiu", rotulo: "orfão", onde: "Tópico apagado", dados: { bloco: "Órfão :: volta para a bancada" } });
    const id = api.lixLer()[0].id;
    api.lixRestaurarUi(id);
    await tick();
    ok(/Não foi possível restaurar/.test(api.$("uiModalMsg").textContent) && /continua na lixeira até você escolher/.test(api.$("uiModalMsg").textContent), "LT12 sem lugar para voltar: oferece o plano B e diz que nada se perde");
    api.uiModalResponder("bancada");
    await tick();
    ok(/Órfão :: volta para a bancada/.test(api.$("editor").value) && api.lixLer().length === 0, "LT12b 'restaurar na bancada': o cartão volta para o editor e sai da lixeira");
  }

  /* ---- a busca e o rodapé ---- */
  {
    const api = novo();
    api.lixJogar({ tipo: "nota", via: "artigo", rotulo: "prazo", onde: "Lei A", dados: { lei: "x", num: "1", texto: "prazo de trinta dias" } });
    api.lixJogar({ tipo: "nota", via: "artigo", rotulo: "outra", onde: "Lei B", dados: { lei: "x", num: "2", texto: "competência da União" } });
    api.lixAbrir();
    api.$("lixBusca").value = "trinta"; api.$("lixBusca").oninput();
    const its = achar(api.$("lixLista"), (e) => cls(e, "lix-item"));
    ok(its.length === 1 && /trinta/.test(tx(its[0])), "LT13 a busca acha pelo texto apagado");
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const dlg = html.slice(html.indexOf('<dialog id="dlgLixeira"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgLixeira"')));
    ok(!/id="btnLixFechar"/.test(dlg) && /id="btnLixX"/.test(dlg) && /<div class="dlg-rodape lix-rodape">\s*<button class="btn-min btn-min-perigo" id="btnLixEsvaziar"[^>]*><\/button>\s*<\/div>/.test(dlg)
      && /dialog\.lix-dlg #lixLista\{flex:1 1 auto;min-height:0;max-height:none;overflow:auto/.test(html),
      "LT14 um só fechar (o ✖), 'esvaziar' sozinho no rodapé, e uma rolagem (a lista)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
