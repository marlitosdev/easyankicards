/* (19.94.0) A ABA EDITAL SEM REPETIÇÕES — fase 2
 *
 *   SR1–SR3  a linha da agenda: só "▶ Estudar" e "⋯"; o material em texto; o estado ("✓ estudado") em selo
 *   SR4–SR6  o "⋯": registrar, tirar, por que agora, ver a disciplina; um menu aberto por vez; fecha com Esc
 *   SR7      "▶ Estudar" abre a ficha do tópico já no ramo da vez
 *   SR8      os ramos: o resumo abre e fecha os chips (fechados por padrão)
 *   SR9–SR11 o topo da aba: um seletor de edital, as ferramentas do escolhido, o "⋯" com renomear e novo edital
 *   SR12     na agenda: o selo do edital é texto, abrir o edital está no "⋯"; os editais da agenda moram nos ajustes
 *   SR13     a bancada: uma fileira de ações nos dois estados; "Pontuação e cortes" uma vez só na página
 *   SR14     o modo por disciplina lista só as de modo próprio, e um seletor traz mais uma
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test((e && e.className) || "");
  const de = (el, c) => todos(el).filter((f) => cls(f, c));
  const tx = (e) => String((e && e.textContent) || "");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const ev = { stopPropagation() {} };

  /* ---- a linha ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "Tópico A");
    api.matGravar(ch, "Resumo.", { disciplina: "D", topico: "Tópico A" });
    const li = api.edLinhaAgendaTeste({ disciplina: "D", nome: "Tópico A", chave: ch, minutos: 60, faixa: "alta", disciplinaPeso: 5, peso: 5 });
    const fora = todos(li).filter((f) => f.tag === "button" && !todos(de(li, "ed-item-meio")[0]).includes(f));
    ok(fora.length === 2 && /Estudar/.test(tx(fora[0])) && tx(fora[1]) === "⋯", "SR1 a linha tem só '▶ Estudar' e '⋯': " + fora.map(tx).join(" | "));
    ok(!de(li, "ed-reg").length && !de(li, "ed-fora").length && !de(li, "ed-materiais").length && !de(li, "ed-st-item").length && !de(li, "ed-rev").length,
      "SR1b saíram da linha: '+', '⤳', '📚 materiais', as etiquetas de material e o '↺'");
    ok(/^tem: resumo$/.test(tx(de(li, "ed-item-tem")[0])) && cls(de(li, "ed-item-disc")[0], "ed-item-disc") && de(li, "ed-item-disc")[0].tag !== "button",
      "SR2 o material é texto ('tem: resumo') e a disciplina também: " + tx(de(li, "ed-item-tem")[0]));
    const liF = api.edLinhaAgendaTeste({ disciplina: "D", nome: "Tópico A", chave: ch, minutos: 60, feito: true });
    ok(/✓ estudado/.test(tx(de(liF, "ed-selo-feito")[0])) && !de(li, "ed-selo-feito").length, "SR3 o estado vira selo: '✓ estudado' só no que foi registrado");

    /* o menu */
    const bm = de(li, "ed-mais-bt")[0];
    ok(bm.getAttribute("aria-haspopup") === "menu" && bm.getAttribute("aria-expanded") === "false" && /Tópico A/.test(bm.getAttribute("aria-label") || ""),
      "SR4 o '⋯' se anuncia como menu, fechado, com o nome do tópico");
    bm.onclick(ev);
    const itens = de(li, "ed-menu-item");
    const ordem = itens.map((b) => (b.className.split(/\s+/).filter((c) => /^ed-menu-/.test(c) && c !== "ed-menu-item")[0] || "?"));
    ok(JSON.stringify(ordem) === JSON.stringify(["ed-menu-reg", "ed-menu-fora", "ed-menu-porque", "ed-menu-disc"]) && bm.getAttribute("aria-expanded") === "true"
      && itens.every((b) => b.getAttribute("role") === "menuitem"), "SR4b o '⋯' traz registrar, tirar da agenda, por que agora e ver a disciplina: " + ordem.join(","));
    bm.onclick(ev);
    ok(de(li, "ed-menu")[0].hidden === true && bm.getAttribute("aria-expanded") === "false", "SR5 tocar de novo no '⋯' fecha o menu");
    bm.onclick(ev);
    const bm2 = de(liF, "ed-mais-bt")[0];
    bm2.onclick(ev);
    ok(de(li, "ed-menu")[0].hidden === true && de(liF, "ed-menu")[0].hidden === false && de(liF, "ed-menu-desfazer").length === 1 && /Registrar outra sessão/.test(tx(de(liF, "ed-menu-reg")[0])),
      "SR5b um menu aberto por vez; o do tópico estudado oferece 'outra sessão' e 'desfazer'");
    api.edMenuFechar();
    ok(de(liF, "ed-menu")[0].hidden === true && api.edMenuAtualTeste() === null, "SR5c fechar zera o menu aberto");
    bm.onclick(ev);
    de(li, "ed-menu-porque")[0].onclick(ev);
    ok(api.dicaAberta() === true && /prioridade/i.test(api.dicaTexto()) && de(li, "ed-menu")[0].hidden === true, "SR6 'por que agora' fecha o menu e abre o balão com o motivo e a cor: " + api.dicaTexto().slice(0, 60));
    api.dicaFechar();
    bm.onclick(ev);
    de(li, "ed-menu-reg")[0].onclick(ev);
    ok(api.$("dlgRegistro").open === true, "SR6b 'registrar' abre o registro do estudo");
    api.$("dlgRegistro").close();
  }

  /* ---- ▶ Estudar no ramo da vez, e os chips dos ramos ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const NL = "\n";
    const r = api.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + "++ Primeiro :: 5" + NL + "++ Segundo :: 3");
    const it = api.montarPlano(r, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null }).itens[0];
    const li = api.edLinhaAgendaTeste(it);
    const vez = (it.ramos || []).find((x) => (it.sessao || []).indexOf(x.id) >= 0);
    de(li, "ed-estudar")[0].onclick(ev);
    ok(api.$("dlgMatFicha").open === true && !!vez && api.matFichaEscopoAtual() === vez.id && de(api.$("matFichaRodape"), "mat-ficha-reg").length === 1,
      "SR7 '▶ Estudar' abre a ficha já no ramo da vez, com o registro no rodapé: " + api.matFichaEscopoAtual());
    api.$("dlgMatFicha").close();
    const res = de(li, "ed-ramos-resumo")[0], det = de(li, "ed-ramos-det")[0];
    ok(det.hidden === true && / ▾$/.test(tx(res)) && res.getAttribute("aria-expanded") === "false" && de(li, "ed-ramo").length === 2, "SR8 os chips dos ramos nascem fechados (o resumo já diz o da vez)");
    res.onclick(ev);
    const li2 = api.edLinhaAgendaTeste(it);
    ok(det.hidden === false && / ▴$/.test(tx(res)) && de(li2, "ed-ramos-det")[0].hidden === false, "SR8b o resumo abre os chips, e a escolha vale na próxima pintura");
    de(li2, "ed-ramos-resumo")[0].onclick(ev);
  }

  /* ---- o topo da aba ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.hubIniciar();
    (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
    const e1 = api.edCriar("Prova A", "# Prova A | prova: " + d(60) + " | horas: 10\n@ Financeiro :: 5\n+ Receita :: 5\n+ Despesa :: 4");
    const e2 = api.edCriar("Prova B", "# Prova B | prova: " + d(90) + " | horas: 10\n@ Auditoria :: 4\n+ NBASP :: 5");
    api.hubVoltar();
    const sel = api.$("edSel");
    const ops = Array.from(sel.children || []);
    ok(ops.length === 3 && ops[0].value === "" && /Todos os editais \(2\)/.test(tx(ops[0])) && sel.value === "" && api.$("edTopoFerr").hidden === true && !api.$("edHub").hidden,
      "SR9 o seletor: 'Todos os editais (2)' e um por edital; em 'todos', a lista aparece e as ferramentas do edital não: " + ops.map(tx).join(" | "));
    sel.value = e2.id; sel.onchange();
    ok(api.edAberto() && api.edAberto().id === e2.id && api.$("edTopoFerr").hidden === false && !api.$("edBancada").hidden && api.$("edSel").value === e2.id,
      "SR10 escolher um edital abre o plano dele e mostra Domínio, Horas e Verticalizado no topo");
    ok(!/id="btnEdVoltar"|id="edNomeAberto"|class="ed-voltar-linha"/.test(html) && html.indexOf('id="edTopo"') < html.indexOf('id="edAgendaTopo"')
      && html.indexOf('id="btnEdDominio"') < html.indexOf('id="edAgendaTopo"'), "SR10b o topo vem antes da agenda, e '← todos os editais' saiu");
    const tm = api.$("btnEdTopoMais");
    tm.onclick(ev);
    const its = de(api.$("edTopoMenu"), "ed-menu-item");
    ok(its.some((b) => b.id === "btnEdRenomear") && its.some((b) => b.id === "btnEdTopoNovo") && api.$("edTopoMenu").hidden === false, "SR11 o '⋯' do topo tem renomear e novo edital: " + its.map(tx).join(" | "));
    api.edMenuFechar();
    /* ---- SR12: a agenda ---- */
    api.hubVoltar();
    api.hubPintarAgenda();
    const box = api.$("edAgendaTopo");
    const gav = api.$("hubAjustes");
    ok(de(box, "ed-ag-editais").length === 1 && todos(gav).includes(de(box, "ed-ag-editais")[0]), "SR12 os editais da agenda (✓ A / ✓ B) moram em '⚙ Ajustes da agenda'");
    const linha = de(box, "ed-item")[0];
    const selo = de(linha, "ed-selo-cc")[0];
    ok(selo && selo.tag !== "button" && cls(selo.parentNode, "ed-item-selos"), "SR12b o selo do edital é texto, na fileira de selos");
    de(linha, "ed-mais-bt")[0].onclick(ev);
    const abrir = de(linha, "ed-menu-edital")[0];
    ok(abrir && /Abrir o edital Prova/.test(tx(abrir)), "SR12c abrir o edital da linha está no '⋯': " + tx(abrir));
    abrir.onclick(ev);
    ok(api.edAberto() && /Prova/.test(api.edAberto().nome) && api.$("edSel").value === api.edAberto().id, "SR12d e abrir pelo '⋯' acompanha o seletor do topo");
    api.edApagar(e1.id); api.edApagar(e2.id);
  }

  /* ---- a bancada e os riscos de corte ---- */
  {
    const ui = fs.readFileSync(path.join(__dirname, "..", "docs", "edital-ui.js"), "utf8");
    ok(/<div class="ed-banc-acoes" id="edBancAcoes">/.test(html) && (html.match(/data-i18n="ep_btn"/g) || []).length === 1 && ui.indexOf('"btnEdMinEditar"') < 0,
      "SR13 'Pontuação e cortes' existe uma vez só, na fileira da bancada");
    const { api } = rodar();
    api.edIniciar();
    const plano = { blocos: [{ nome: "Bloco", minPct: 50, fatia: 50, abaixo: true, apertado: false, discs: [] }] };
    let cx = null;
    try { cx = api.edPintarBlocos(plano); } catch (e) { cx = null; }
    ok(!cx || !todos(cx).some((f) => f.id === "btnEdMinEditar"), "SR13b o painel dos riscos de corte não repete o botão");
  }

  /* ---- o modo por disciplina ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.hubIniciar();
    (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
    api.edCriar("Prova M", "# Prova M | prova: " + d(60) + " | horas: 10\n@ Alfa :: 5\n+ A1 :: 5\n@ Beta :: 4\n+ B1 :: 5\n@ Gama :: 3\n+ G1 :: 5");
    api.hubModoDefinir("Beta", "consolidar");
    api.hubVoltar();
    const lins = () => de(api.$("hubModoDisc"), "hub-modo-lin").filter((l) => !cls(l, "hub-modo-mais"));
    ok(lins().length === 1 && /Beta/.test(tx(lins()[0])), "SR14 só a disciplina com modo próprio aparece: " + lins().map(tx).join(" | "));
    const mais = api.$("hubModoDiscMais");
    ok(mais && Array.from(mais.children).map((o) => o.value).join(",") === ",Alfa,Gama", "SR14b um seletor traz as outras");
    mais.value = "Gama"; mais.onchange();
    ok(lins().length === 2 && lins().some((l) => /Gama/.test(tx(l))), "SR14c escolher uma a traz para a lista, com 'como o geral' até mudar");
    api.hubModoDefinir("Beta", "geral");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
