/* (19.89.0) CARTÕES DE UMA LEI E A BANCADA EM PASSOS
 *
 *   CL1–CL6   a estratégia: tópicos do edital ligados, artigos citados pelo edital e pelas questões, pré-seleção, lotes
 *   CL7–CL8   o pedido de um lote (regras do "virar cartões", etiqueta de cada artigo, tópico e subtópicos do edital)
 *   CL9–CL10  o resumo de cada lei (com cartão, caem sem cartão, tópico ativo) e a ordem da lista
 *   CL11–CL16 o diálogo, o começo pela bancada (tópico-alvo com a lei), o próximo lote e o salvar
 *   CB1–CB5   a bancada em passos: ① de onde vêm → ② cole → ③ confira → ④ guarde; ferramentas numa gaveta
 */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test((e && e.className) || "");
  const em = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(sim === undefined ? true : sim); } catch (e) {} }
    return promessa;
  };

  const arts = ["LEI Nº 9.000, DE 2020", "CAPÍTULO I", "Dos Tributos", "Art. 1º Primeiro texto sobre tributos.", "Art. 2º Segundo texto.", "Art. 3º Terceiro texto.",
    "CAPÍTULO II", "Das Taxas", "Art. 4º Quarto texto sobre taxas.", "Art. 5º (Revogado).", "Art. 6º Sexto texto."];
  arts.push("CAPÍTULO III", "Das Disposições Finais");
  for (let k = 7; k <= 20; k++) arts.push("Art. " + k + ". Texto do artigo " + k + " com conteúdo suficiente.");
  const LEI = arts.join("\n");
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar(); a.leiIniciar(); a.qsUiIniciar();
    const ed = a.edCriar("ISS", ["# ISS | prova: " + em(30) + " | horas: 20", "@ Direito Tributário :: 5", "+ Tributo :: 5", "++ Taxas :: 4 :: Art. 6º da Lei 9.000/2020", "+ Outro :: 2"].join("\n"));
    const ch = a.matChave("Direito Tributário", "Tributo");
    const l = a.leiGuardar({ id: "lei_x", nome: "Lei 9.000/2020", especie: "Lei", numero: "9000", ano: "2020", texto: LEI, topicos: [ch] });
    [["q2", 2, false], ["q2b", 2, false], ["q3", 3, true]].forEach(([id, num, ac]) => a.qsTodas().push({ id, tipo: "ce", enunciado: "Art. " + num + "º da Lei 9.000/2020.", gabarito: "C", comentario: "", chave: ch, disciplina: "Direito Tributário", topico: "Tributo", tentativas: [{ q: "2026-10-01", acertou: ac }] }));
    a.matGravarCartoes(ch, "O que diz o primeiro? :: art. 1º da Lei 9.000/2020 :: lei9000-art1", { disciplina: "Direito Tributário", topico: "Tributo" });
    return { a, ed, ch, l };
  };

  /* ---------------- CL: a estratégia ---------------- */
  {
    const { a, l } = montar();
    const tops = a.clTopicosDaLei(l);
    ok(tops.length === 1 && tops[0].topico === "Tributo" && tops[0].peso === 5 && tops[0].dias === 30 && /Taxas/.test(tops[0].ramos.join()), "CL1 o tópico do edital ligado à lei, com o peso, os dias e os subtópicos: " + JSON.stringify(tops.map((x) => [x.topico, x.peso, x.dias])));
    const cit = a.clArtigosCitados(tops[0].foco, l);
    ok(cit.has("6") && cit.size === 1, "CL2 o artigo que o EDITAL cita no subtópico (Art. 6º): " + JSON.stringify([...cit]));
    const A = a.clArtigos(l, tops[0]);
    const art = (nm) => A.find((x) => String(x.num) === nm);
    ok(art("2").questoes === 2 && art("2").erros === 2 && art("3").questoes === 1 && art("6").citado && art("1").nCart === 1 && art("5").rev,
      "CL3 cada artigo sabe o que as questões, o edital e os cartões dizem dele: " + JSON.stringify(["2", "3", "6", "1", "5"].map((k) => { const x = art(k); return [k, x.questoes, x.erros, x.citado, x.nCart, x.rev]; })));
    ok(art("4").tema === true && art("2").tema === true && art("7").tema === false, "CL4 os capítulos cujo título bate com o tópico (Dos Tributos) e o subtópico (Das Taxas) entram como do assunto; as disposições finais não");
    const sel = a.clPreSelecao(A);
    ok(sel.has("2") && sel.has("3") && sel.has("6") && sel.has("4") && !sel.has("1") && !sel.has("5") && !sel.has("7"),
      "CL5 a pré-seleção: com motivo e sem cartão; fora o que já tem cartão, o revogado e o que não tem motivo: " + JSON.stringify([...sel]));
    const todos = new Set(A.filter((x) => !x.rev && !x.nCart).map((x) => x.num));
    const lotes = a.clLotes(A, todos);
    ok(lotes.length === 3 && lotes[0].length === 8 && lotes.reduce((s, x) => s + x.length, 0) === todos.size && lotes[0].indexOf("6") >= 0 && lotes[0].indexOf("2") >= 0,
      "CL6 lotes de até 8, os mais importantes no primeiro: " + JSON.stringify(lotes));
    const pr = a.clPrompt(l, tops[0], lotes[0]);
    ok(/TÓPICO DO EDITAL: Direito Tributário › Tributo/.test(pr) && /SUBTÓPICOS DO EDITAL: Taxas/.test(pr) && /### Art\. 6º — etiqueta: 9000-art6/.test(pr) && /\{\{c1::termo\}\}/.test(pr) && /TODOS os artigos da lista/.test(pr),
      "CL7 o pedido do lote: o assunto do edital, a etiqueta de cada artigo e as regras de lacuna: " + pr.slice(0, 200));
    const R = a.clResumoLei(l);
    ok(R.vig === 19 && R.comCart === 1 && R.semCartCaem === 2 && R.ativo && R.ativo.topico === "Tributo" && R.prioridade > 0,
      "CL9 o resumo da lei: em vigor, com cartão, caem sem cartão e o tópico ativo: " + JSON.stringify({ v: R.vig, c: R.comCart, s: R.semCartCaem }));
    const l2 = a.leiGuardar({ id: "lei_y", nome: "Lei 1/2000", especie: "Lei", numero: "1", ano: "2000", texto: "Art. 1º Um.\nArt. 2º Dois.", topicos: [] });
    ok(a.clResumoLei(l2).prioridade < R.prioridade, "CL10 a lei sem tópico nem questões vem depois na estratégia");
  }

  /* ---------------- CL: o diálogo e a bancada ---------------- */
  {
    const { a, l } = montar();
    a.trocarModo("cartoes");
    a.clAbrir();
    ok(a.$("dlgLeiCartoes").open === true, "CL11 o botão abre o diálogo das leis");
    const lista = achar(a.$("clCorpo"), (x) => cls(x, "cl-lei"));
    ok(lista.length === 1 && cls(lista[0], "cl-lei-top") && /comece por aqui/.test(lista[0].textContent) && /1\/19 artigos com cartão/.test(lista[0].textContent) && /2 caem nas suas questões sem cartão/.test(lista[0].textContent),
      "CL12 a lista: a lei sugerida primeiro, com o que tem e o que falta: " + (lista[0] && lista[0].textContent));
    lista[0].onclick();
    const cks = achar(a.$("clCorpo"), (x) => x.tagName === "INPUT" && /^clArt_/.test(x.id || ""));
    ok(cks.length === 19 && cks.filter((c) => c.checked).length === 4 && /4 artigo\(s\) marcado\(s\) → 1 lote/.test(a.$("clCorpo").textContent),
      "CL13 os artigos em vigor, com os sugeridos já marcados: " + cks.filter((c) => c.checked).map((c) => c.id).join());
    const ir = achar(a.$("clCorpo"), (x) => x.id === "btnClComecar")[0];
    ir.onclick();
    const alvo = a.bancAlvoAtual();
    ok(a.$("dlgLeiCartoes").open === false && alvo && alvo.topico === "Tributo" && alvo.lei && alvo.lei.lotes.length === 1 && a.$("bancAlvoBox").hidden === false && a.$("bancAlvoLei").hidden === false && /lote 1 de 1/.test(a.$("bancAlvoLei").textContent),
      "CL14 começar: a bancada aponta para o tópico com a lei e mostra o lote: " + a.$("bancAlvoLei").textContent);
    ok(/### Art\. 2º/.test(a.$("bancAlvoPromptTxt").value) && /etiqueta: 9000-art2/.test(a.$("bancAlvoPromptTxt").value), "CL15 o pedido copiado é o do lote (não o do resumo do tópico)");
    /* dois lotes: o próximo limpa a bancada e troca o pedido */
    alvo.lei.lotes = [["2", "3"], ["4", "6"]]; alvo.lei.k = 0;
    a.$("editor").value = "{{c1::Segundo}} texto. :: :: 9000-art2";
    a.clIrLote(1);
    ok(a.bancAlvoAtual().lei.k === 1 && a.$("editor").value === "" && /### Art\. 4º/.test(a.$("bancAlvoPromptTxt").value) && /lote 2 de 2/.test(a.$("bancAlvoLei").textContent),
      "CL16 próximo lote: limpa a bancada, avança e copia o novo pedido");
    /* salvar no tópico pela bancada, com o lote */
    const antes = a.matContarCartoes(a.matChave("Direito Tributário", "Tributo"));
    a.$("editor").value = "O art. 4º trata de {{c1::taxas}}. :: :: 9000-art4";
    try { a.preview(); } catch (e) {}
    await conduzir(a, a.bancAlvoSalvar(), true);
    ok(a.matContarCartoes(a.matChave("Direito Tributário", "Tributo")) === antes + 1, "CL17 salvar neste tópico grava o cartão do lote no tópico: " + antes + " → " + a.matContarCartoes(a.matChave("Direito Tributário", "Tributo")));
    a.bancAlvoSair();
  }

  /* ---------------- CF: filtro, tela cheia e o ✖ (19.89.1) ---------------- */
  {
    const { a } = montar();
    a.leiGuardar({ id: "lei_y", nome: "Lei 1/2000 Ação Popular", especie: "Lei", numero: "1", ano: "2000", texto: "Art. 1º Um.\nArt. 2º Dois.", topicos: [] });
    a.trocarModo("cartoes");
    a.clAbrir();
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const dlgHtml = html.slice(html.indexOf('<dialog id="dlgLeiCartoes"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgLeiCartoes"')));
    ok(/id="btnClX"/.test(dlgHtml) && /id="btnClCheia"/.test(dlgHtml) && !/id="btnClFechar"/.test(dlgHtml) && dlgHtml.indexOf('id="btnClX"') < dlgHtml.indexOf('id="clCorpo"'),
      "CF1 o ✖ e a tela cheia no cabeçalho; o 'Fechar' de baixo saiu");
    const nomes = () => achar(a.$("clCorpo"), (x) => cls(x, "cl-lei")).map((b) => b.id.replace("clLei_", ""));
    ok(nomes().join() === "lei_x,lei_y", "CF2 sem filtro, as duas leis (a sugerida primeiro): " + nomes().join());
    const q = achar(a.$("clCorpo"), (x) => x.id === "clBusca")[0];
    q.value = "9000"; q.oninput();
    ok(nomes().join() === "lei_x" && achar(a.$("clCorpo"), (x) => x.id === "clBusca")[0] === q, "CF3 a busca acha '9000' em 'Lei 9.000/2020' e a caixa de busca continua a mesma (não perde o foco)");
    q.value = "ação popular"; q.oninput();
    ok(nomes().join() === "lei_y", "CF4 a busca pelo nome, com acento: " + nomes().join());
    q.value = "tributo"; q.oninput();
    ok(nomes().join() === "lei_x", "CF5 a busca pelo TÓPICO do edital ligado à lei");
    q.value = "nada disso"; q.oninput();
    ok(nomes().length === 0 && /Nenhuma lei com esse filtro/.test(a.$("clCorpo").textContent), "CF6 sem resultado, diz que não há");
    q.value = ""; q.oninput();
    const chip = (f) => achar(a.$("clCorpo"), (x) => x.id === "clF_" + f)[0];
    ok(/todas \(2\)/.test(chip("todas").textContent) && /ligadas ao edital \(1\)/.test(chip("edital").textContent) && /sem cartão \(1\)/.test(chip("caem").textContent),
      "CF7 os recortes dizem quantas leis têm: " + ["todas", "edital", "caem"].map((f) => chip(f).textContent).join(" | "));
    chip("edital").onclick();
    ok(nomes().join() === "lei_x" && chip("edital").getAttribute("aria-pressed") === "true", "CF8 'ligadas ao edital' deixa só a lei com tópico");
    chip("todas").onclick();
    /* tela cheia: liga, lembra e o ✖ fecha */
    a.$("btnClCheia").onclick();
    ok(cls(a.$("dlgLeiCartoes"), "cl-cheia") && a.$("btnClCheia").getAttribute("aria-pressed") === "true" && a.loja.getItem("eac_cl_cheia") === "1", "CF9 tela cheia liga e fica lembrada");
    a.$("btnClCheia").onclick();
    ok(!cls(a.$("dlgLeiCartoes"), "cl-cheia") && a.loja.getItem("eac_cl_cheia") === "0", "CF10 e desliga");
    /* a busca de artigos esconde sem desmarcar */
    achar(a.$("clCorpo"), (x) => x.id === "clLei_lei_x")[0].onclick();
    const marcadosAntes = achar(a.$("clCorpo"), (x) => x.tagName === "INPUT" && /^clArt_/.test(x.id || "") && x.checked).length;
    const qa = achar(a.$("clCorpo"), (x) => x.id === "clArtBusca")[0];
    qa.value = "taxas"; qa.oninput();
    const visiveis = achar(a.$("clCorpo"), (x) => cls(x, "cl-art") && !x.hidden);
    ok(visiveis.length === 1 && /Art\. 4º/.test(visiveis[0].textContent) && achar(a.$("clCorpo"), (x) => x.tagName === "INPUT" && /^clArt_/.test(x.id || "") && x.checked).length === marcadosAntes,
      "CF11 procurar artigo esconde o que não casa e mantém o que estava marcado: " + visiveis.map((v) => v.textContent.slice(0, 20)).join(" | "));
    a.$("btnClX").onclick();
    ok(a.$("dlgLeiCartoes").open === false, "CF12 o ✖ fecha");
    ok(/dialog\.cl-modal\[open\]\{display:flex;flex-direction:column;[^}]*overflow:hidden\}/.test(html) && /\.cl-leis,dialog\.cl-modal #clCorpo>\.cl-arts\{flex:1 1 auto;[^}]*max-height:none;overflow:auto/.test(html),
      "CF13 uma rolagem só: o diálogo não rola, a lista sim");
  }

  /* ---------------- CB: a bancada em passos ---------------- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sec = html.slice(html.indexOf('<section id="secCartoes"'), html.indexOf("</section>", html.indexOf('<section id="secCartoes"')));
    const pos = (id) => sec.indexOf('id="' + id + '"');
    ok(pos("btnPromptIA") > 0 && pos("btnPromptIA") < pos("editor") && pos("btnLeiCartoes") < pos("editor") && pos("btnNovoCartao") < pos("editor"),
      "CB1 ① de onde vêm os cartões vem ANTES da caixa de colar (antes, o botão do pedido ficava no pé da coluna)");
    const ferr = sec.slice(sec.indexOf('id="bancFerramentas"'), sec.indexOf("</details>", sec.indexOf('id="bancFerramentas"')));
    ok(/id="btnApagarTudo"/.test(ferr) && /id="btnSelecionarTudo"/.test(ferr) && pos("btnApagarTudo") > pos("editor") && !/style="background:#b91c1c"/.test(sec),
      "CB2 'Apagar tudo' mora na gaveta de ferramentas, debaixo da caixa, sem o vermelho de ação");
    ok(pos("btnBancaGer") < pos("painelEsquerdo") && pos("bancAparencia") > 0 && pos("tituloGeral") > pos("bancAparencia"),
      "CB3 a Biblioteca (cartões já salvos) fica fora do caminho de criar; a aparência da prévia numa gaveta");
    const rod = html.slice(html.indexOf('id="rodapeExportar"'), html.indexOf("</div>", html.indexOf('id="rodapeExportar"')));
    ok(rod.indexOf('id="btnSalvarMaterial"') < rod.indexOf('id="btnApkg"') && rod.indexOf('id="btnApkg"') < rod.indexOf('id="btnTxt"') && /banc-passo-n">4</.test(rod),
      "CB4 ④ guarde: salvar no material primeiro, depois .apkg e .txt");
    const { a } = montar();
    ok(typeof a.$("btnLeiCartoes").onclick === "function" && /^\d|Pedir/.test(a.t("prompt_main_btn").replace("🤖 ", "")) && (sec.match(/class="banc-passo-n"/g) || []).length === 3,
      "CB5 os três passos numerados na tela (o quarto no rodapé) e o botão da lei ligado");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
