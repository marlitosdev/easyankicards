/* (19.104.0) O PAINEL DO EDITAL — horas por assunto + domínio numa tela
 *
 *   PE1  um botão só no topo ("📊 Painel do edital"); "Domínio" e "Horas" saem do topo e ficam no cabeçalho do painel
 *   PE2  a linha da prova e as urgências: corte (bloco abaixo do mínimo), tempo fora do peso, nunca estudado
 *   PE3  os filtros dizem quantos tópicos e quanto da prova; filtrar mostra só as disciplinas com tópicos naquele estado
 *   PE4  a ordem: quanto vale (padrão), mais urgente, tempo abaixo do peso, menos dominada — e fica lembrada
 *   PE5  cada linha: vale X%, o domínio pelo peso, os assuntos e o tempo × peso ("+X pt acima do peso")
 *   PE6  a disciplina abre NA MESMA TELA, com "← Todas as disciplinas"; os tópicos na ordem do que é mais urgente
 *   PE7  estudar a partir do painel deixa a volta armada; o mapa do domínio e as colunas também
 *   PE8  o termômetro do topo abre o painel; tela cheia é o padrão
 *
 * (19.105.0) A FILA "O QUE ESTUDAR AGORA"
 *   PE9  um item por tópico a reforçar, em ordem de pontos; a conta fecha e está no balão; todo item diz quanto vale
 *   PE10 o bloco com cobertura abaixo do mínimo põe o que falta estudar dele na frente (e só ele)
 *   PE11 o tempo: a disciplina que já passa do peso × 0,8; a sem nenhuma hora × 1,25 — com o selo do porquê
 *   PE12 a ação que mais ajuda (medir / o material), fechando o painel com a volta armada
 *   PE13 o vermelho com erradas: "Refazer as erradas", e o acerto como porquê
 *   PE14 o filtro vale para a fila
 *   PE15 num edital feito para isso: o bloco pequeno abaixo do mínimo passa à frente; "mostrar mais"; o empurrão some
 *        quando o bloco passa do mínimo
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^| )" + c + "( |$)").test(e.className || "");
  /* a data LOCAL (toISOString é UTC: depois das 21h no Brasil já era o dia seguinte e a conta dava 41 dias) */
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  api.loja.removeItem("eac_pe_pref");
  const TXT = ["# Fiscal | prova: " + d(40) + " | horas: 20",
    "& Básicos | minimo: 50%", "@ Português :: 20q", "+ Crase :: 3", "+ Regência :: 3",
    "& Específicos | minimo: 50%", "@ Tributário :: 5", "+ ISS :: 5", "+ ICMS :: 5", "+ Obrigação :: 4",
    "@ Informática :: 2", "+ Redes :: 2"].join("\n");
  const ed = api.edCriar("Fiscal", TXT);
  api.hubAbrirEdital(ed.id);
  api.edRender();
  /* estudo e tempo: Tributário estudado e com quase todo o tempo; Português um pouco; Informática nada */
  const its = api.horDoAberto().plano.itens;
  const ch = (t) => its.find((i) => i.nome === t).chave;
  api.edProgresso[ch("ISS")] = { e: "feito", d: d(-3) };
  api.edProgresso[ch("ICMS")] = { e: "feito", d: d(-2) };
  api.diarioPor([
    { d: d(-3), c: ch("ISS"), n: "ISS", disc: "Tributário", a: "feito", m: 300, cc: "Fiscal" },
    { d: d(-2), c: ch("ICMS"), n: "ICMS", disc: "Tributário", a: "feito", m: 200, cc: "Fiscal" },
    { d: d(-1), c: ch("Crase"), n: "Crase", disc: "Português", a: "feito", m: 20, cc: "Fiscal" },
  ]);
  api.edRender();

  /* ---- PE1 ---- */
  const topo = html.slice(html.indexOf('id="edTopo"'), html.indexOf('id="edAbas"'));
  ok(/id="btnEdPainel"/.test(topo) && /id="btnEdDominio"[^>]*hidden/.test(topo) && /id="btnEdHoras"[^>]*hidden/.test(topo), "PE1 um botão só no topo (os antigos ficam escondidos)");
  ok(/id="btnPeMapa"/.test(html) && /id="btnPeColunas"/.test(html) && /<script src="painel-edital.js">/.test(html), "PE1b o mapa do domínio e as colunas moram no cabeçalho do painel");
  api.$("btnEdPainel").onclick();
  ok(api.$("dlgPainel").open === true && api.peEstado().cheia === true && api.$("dlgPainel").classList.contains("pe-cheia"), "PE1c o botão abre o painel, em tela cheia (o padrão)");

  /* ---- PE2 ---- */
  const dd = api.peUltimoTeste();
  const kpi = todos(api.$("peCorpo")).find((e) => cls(e, "pe-kpi"));
  ok(kpi && /prova em 40 dias/.test(kpi.textContent) && /20h por semana/.test(kpi.textContent) && /registrado \(últimos 14 dias\): 8h40/.test(kpi.textContent), "PE2 a linha da prova: " + (kpi && kpi.textContent));
  const tipos = dd.urgencias.map((u) => u.tipo);
  ok(tipos.indexOf("corte") === 0 && tipos.indexOf("tempo") > 0 && tipos.indexOf("nunca") > 0, "PE2b as urgências, o corte primeiro: " + tipos.join(","));
  const uTempo = api.$("peU_tempo");
  ok(uTempo && /das suas horas \(últimos 14 dias\) foram para Tributário/.test(uTempo.textContent) && /Sem tempo: .*Português/.test(uTempo.textContent), "PE2c o tempo fora do peso diz para onde foi e o que ficou sem: " + (uTempo && uTempo.textContent));
  ok(/Risco de corte em 1 bloco/.test(api.$("peU_corte").textContent) && /Básicos: \d+% estudado, mínimo 50%/.test(api.$("peU_corte").textContent), "PE2d o corte diz o bloco, o estudado e o mínimo: " + api.$("peU_corte").textContent);

  /* ---- PE3 ---- */
  const fNunca = api.$("peF_nunca");
  ok(/^Nunca estudado · \d+ · [\d,]+%$/.test(fNunca.textContent) && /^Todos · 6$/.test(api.$("peF_todos").textContent), "PE3 os filtros com tópicos e % da prova: " + fNunca.textContent);
  api.$("peU_nunca").onclick();
  ok(api.peEstado().filtro === "nunca" && todos(api.$("peLista")).filter((e) => cls(e, "pe-aqui")).length >= 1, "PE3b tocar em 'nunca estudado' filtra");
  api.$("peF_naomedido").onclick();
  const linhasNM = todos(api.$("peLista")).filter((e) => cls(e, "pe-lin"));
  ok(linhasNM.length === 1 && /Tributário/.test(linhasNM[0].textContent), "PE3c 'não medido' mostra só a disciplina com tópico estudado e sem medida");
  api.$("peF_todos").onclick();

  /* ---- PE4 / PE5 ---- */
  const nomes = () => todos(api.$("peLista")).filter((e) => cls(e, "pe-lin")).map((e) => todos(e).find((x) => x.tag === "b").textContent);
  ok(nomes()[0] === "Tributário" && api.$("peOrdem").value === "peso", "PE4 a ordem padrão é quanto vale: " + nomes().join(","));
  api.$("peOrdem").value = "tempo"; api.$("peOrdem").onchange();
  ok(nomes()[nomes().length - 1] === "Tributário" && nomes()[0] !== "Tributário", "PE4b 'tempo abaixo do peso': quem vale mais do que recebe vem primeiro: " + nomes().join(","));
  ok(JSON.parse(api.loja.getItem("eac_pe_pref")).ordem === "tempo", "PE4c a ordem fica lembrada");
  api.$("peOrdem").value = "urgencia"; api.$("peOrdem").onchange();
  ok(nomes().length === 3, "PE4d 'mais urgente' ordena todas: " + nomes().join(","));
  api.$("peOrdem").value = "peso"; api.$("peOrdem").onchange();
  const lin0 = api.$("peLin_0");
  const txt0 = lin0.textContent;
  ok(/\d+%/.test(todos(lin0).find((e) => cls(e, "pe-c-vale")).textContent) && todos(lin0).some((e) => cls(e, "dom-seg")) && /\d+\/\d+/.test(todos(lin0).find((e) => cls(e, "pe-c-un")).textContent) && /pt acima do peso/.test(txt0),
    "PE5 a linha: vale, domínio, assuntos e o tempo × peso: " + txt0);
  const linPt = todos(api.$("peLista")).filter((e) => cls(e, "pe-lin")).find((e) => /Português/.test(e.textContent));
  ok(linPt && /abaixo do mínimo: 0% de 50%/.test(linPt.textContent) && !/abaixo do mínimo/.test(txt0), "PE5b o bloco abaixo do mínimo aparece na linha dele (e só nela)");

  /* ---- PE6 ---- */
  lin0.onclick();
  ok(api.peEstado().disc === "Tributário" && api.$("btnPeVoltar") && /vale [\d,]+% da prova · \d+\/\d+ assuntos/.test(api.$("peCorpo").textContent), "PE6 a disciplina abre na mesma tela, com o resumo dela");
  const tops = todos(api.$("peTops")).filter((e) => cls(e, "pe-top")).map((e) => todos(e).find((x) => cls(x, "pe-top-nome")).textContent);
  ok(tops[0] === "Obrigação" && tops.length === 3, "PE6b os tópicos: o não estudado de peso primeiro: " + tops.join(","));
  api.$("peTop_edital").onclick();
  const tops2 = todos(api.$("peTops")).filter((e) => cls(e, "pe-top")).map((e) => todos(e).find((x) => cls(x, "pe-top-nome")).textContent);
  ok(tops2.join(",") === "ISS,ICMS,Obrigação", "PE6c ou na ordem do edital: " + tops2.join(","));

  /* ---- PE7 ---- */
  const est = todos(api.$("peTops")).find((e) => e.tag === "button" && /estudar|começar/i.test(e.textContent));
  ok(!!est, "PE7 cada tópico tem o estudar da agenda");
  est.onclick({ stopPropagation() {} });
  const v = api.voltarAtual();
  ok(api.$("dlgPainel").open === false && v && v.painel === "dlgPainel", "PE7b estudar fecha o painel e deixa a volta armada");
  if (v && v.vigia) { v.vigia.close(); api.voltarDialogoFechou(v.vigia); }
  ok(api.$("dlgPainel").open === true && api.peEstado().disc === "Tributário", "PE7c fechar o estudo traz o painel de volta, na mesma disciplina");
  api.$("btnPeVoltar").onclick();
  ok(api.peEstado().disc === "" && !!api.$("peLista"), "PE7d '← Todas as disciplinas' volta à lista");
  api.$("btnPeMapa").onclick();
  ok(api.$("dlgDominio").open === true && api.voltarAtual() && api.voltarAtual().painel === "dlgPainel", "PE7e o mapa do domínio abre com a volta para o painel armada");
  api.$("dlgDominio").close(); api.voltarDialogoFechou(api.$("dlgDominio"));
  ok(api.$("dlgPainel").open === true, "PE7f fechar o mapa traz o painel");
  api.$("btnPeColunas").onclick();
  ok(api.$("dlgHoras").open === true && api.voltarAtual() && api.voltarAtual().painel === "dlgPainel", "PE7g as horas em colunas também");
  api.$("dlgHoras").close(); api.voltarDialogoFechou(api.$("dlgHoras"));

  /* ---- PE8 ---- */
  api.$("dlgPainel").close();
  api.domTermoPintar(ed.id);
  const termo = api.$("edDomTermo");
  if (!termo.hidden) {
    termo.onclick();
    ok(api.$("dlgPainel").open === true, "PE8 o termômetro abre o painel");
    api.$("dlgPainel").close();
  } else ok(true, "PE8 (sem termômetro neste edital)");
  api.$("btnEdPainel").onclick();
  api.$("btnPeCheia").onclick();
  ok(api.peEstado().cheia === false && JSON.parse(api.loja.getItem("eac_pe_pref")).cheia === false, "PE8b sair da tela cheia fica lembrado");
  api.$("dlgPainel").close();

  /* ======== (19.105.0) A FILA "O QUE ESTUDAR AGORA" ======== */
  const itensFila = () => todos(api.$("peFilaLista")).filter((e) => cls(e, "pe-fila-it"));
  const itemDe = (nome) => itensFila().find((e) => todos(e).some((x) => x.tag === "b" && x.textContent === nome));
  const motDe = (el) => todos(el).filter((x) => cls(x, "pe-mot")).map((x) => x.textContent);
  const filaDe = (dd, nome) => dd.fila.find((x) => x.tp.nome === nome);
  api.$("btnEdPainel").onclick();
  let df = api.peUltimoTeste();

  /* ---- PE9 a fila, na ordem da conta ---- */
  ok(!!api.$("peFila") && itensFila().length === df.fila.length && df.fila.length === 6, "PE9 a fila aparece abaixo da lista, um item por tópico a reforçar: " + df.fila.length);
  const pts = df.fila.map((x) => x.tp.urgencia);
  ok(pts.every((v, i) => i === 0 || pts[i - 1] >= v) && /^1$/.test(todos(api.$("peFi_0")).find((e) => cls(e, "pe-fila-n")).textContent), "PE9b em ordem de pontos, numerada: " + pts.map((v) => v.toFixed(1)).join(","));
  const contaOk = df.fila.every((x) => { const p = x.tp.partes; return Math.abs((p.base * p.acMult + p.corte) * p.tempoMult - x.tp.urgencia) < 1e-9; })
    && df.disciplinas.every((d) => Math.abs(d.urgencia - d.topicos.reduce((a, tp) => a + tp.urgencia, 0)) < 1e-9);
  ok(contaOk, "PE9c a conta do item fecha, e 'mais urgente' da disciplina é a soma dos tópicos dela");
  ok(/^Conta: \(?peso × cor [\d,]+.* = [\d,]+ pontos/.test(api.$("peFi_0").title || ""), "PE9d a conta por extenso no balão: " + api.$("peFi_0").title);
  /* com o corte e o tempo, os parênteses dizem a ordem: (peso × cor + corte) × tempo */
  const comTudo = df.fila.find((x) => x.tp.partes.corte > 0 && x.tp.partes.tempoMult !== 1);
  ok(comTudo && /^Conta: \(peso × cor [\d,]+ \+ corte [\d,]+\) × tempo 1,25 = [\d,]+ pontos$/.test(api.peFilaConta(comTudo.tp)), "PE9f os parênteses na conta: " + (comTudo && api.peFilaConta(comTudo.tp)));
  ok(itensFila().every((e) => motDe(e).some((m) => /^vale [\d,]+% da prova$/.test(m))), "PE9e todo item diz quanto vale");

  /* ---- PE10 o corte: o bloco abaixo do mínimo põe o que falta estudar dele na frente ---- */
  const fCrase = filaDe(df, "Crase"), fObr = filaDe(df, "Obrigação");
  ok(fCrase && fCrase.tp.partes.corte > 0 && motDe(itemDe("Crase")).some((m) => /^Básicos abaixo do mínimo \(0% de 50%\)$/.test(m)), "PE10 o tópico do bloco abaixo do mínimo leva o corte: " + motDe(itemDe("Crase")).join(" | "));
  ok(fObr && fObr.tp.partes.corte === 0 && !motDe(itemDe("Obrigação")).some((m) => /abaixo do mínimo/.test(m)), "PE10b o bloco acima do mínimo não leva");
  ok(motDe(itemDe("Crase"))[0] === "nunca estudado" && /acerto|sem medida/.test(motDe(itemDe("ISS"))[0] || "sem medida"), "PE10c o primeiro selo é o porquê da cor: " + motDe(itemDe("ISS")).join(" | "));

  /* ---- PE11 o equilíbrio de tempo ---- */
  const dTrib = df.disciplinas.find((d) => d.nome === "Tributário"), dInf = df.disciplinas.find((d) => d.nome === "Informática");
  ok(dTrib.tempoMult === 0.8 && motDe(itemDe("Obrigação")).some((m) => /^já recebe \d+% das horas \(vale [\d,]+%\)$/.test(m)), "PE11 a disciplina que já passa do peso perde um pouco: " + motDe(itemDe("Obrigação")).join(" | "));
  ok(dInf.tempoMult === 1.25 && motDe(itemDe("Redes")).indexOf("nenhuma hora no período") >= 0, "PE11b a que não recebeu nenhuma hora ganha: " + motDe(itemDe("Redes")).join(" | "));

  /* ---- PE12 a ação que mais ajuda, com a volta armada ---- */
  const botoes = (el) => todos(el).filter((x) => x.tag === "button");
  ok(/Criar questões|Medir com questões/.test(botoes(itemDe("ISS"))[0].textContent) && botoes(itemDe("ISS")).length === 2, "PE12 estudado e sem medida: medir (e o material ao lado): " + botoes(itemDe("ISS")).map((b) => b.textContent).join(" | "));
  const bCrase = botoes(itemDe("Crase"));
  ok(/Começar pelo material|Preparar o material/.test(bCrase[0].textContent) && bCrase.length === 1, "PE12b nunca estudado: o material: " + bCrase[0].textContent);
  bCrase[0].onclick({ stopPropagation() {} });
  const v2 = api.voltarAtual();
  ok(api.$("dlgPainel").open === false && v2 && v2.painel === "dlgPainel", "PE12c a ação fecha o painel com a volta armada");
  if (v2 && v2.vigia) { v2.vigia.close(); api.voltarDialogoFechou(v2.vigia); }
  ok(api.$("dlgPainel").open === true && !!api.$("peFila"), "PE12d fechar traz o painel de volta, com a fila");

  /* ---- PE13 errou: refazer as erradas ---- */
  const chIcms = filaDe(df, "ICMS").tp.chave;
  for (let k = 0; k < 5; k++) {
    api.qsTodas().push({ id: "peq" + k, tipo: "ce", enunciado: "x" + k, gabarito: "C", comentario: "", disciplina: "Tributário", topico: "ICMS", chave: chIcms,
      tentativas: [{ q: d(-1), acertou: false }] });
  }
  api.peRender();
  df = api.peUltimoTeste();
  const bIcms = botoes(itemDe("ICMS"));
  ok(filaDe(df, "ICMS").tp.nivel === "vermelho" && /Refazer as erradas \(5\)/.test(bIcms[0].textContent) && bIcms.length === 2, "PE13 o vermelho com erradas: refazer as erradas: " + bIcms.map((b) => b.textContent).join(" | "));
  ok(/^acerto 0% \(5 questões\)$/.test(motDe(itemDe("ICMS"))[0]), "PE13b o porquê: o acerto: " + motDe(itemDe("ICMS")).join(" | "));
  ok(df.fila[0].tp.nome === "ICMS", "PE13c o vermelho de peso sobe para o topo: " + df.fila.map((x) => x.tp.nome).join(","));

  /* ---- PE14 o filtro vale para a fila ---- */
  api.peDefinir({ filtro: "nunca" });
  ok(itensFila().length > 0 && itensFila().every((e) => todos(e).some((x) => cls(x, "dom-n-cinza"))) && /Só os tópicos em “nunca estudado”/.test(api.$("peFila").textContent), "PE14 'nunca estudado' filtra a fila também");
  api.peDefinir({ filtro: "dominado" });
  ok(itensFila().length === 0 && /Nenhum tópico deste filtro para reforçar/.test(api.$("peFila").textContent), "PE14b 'dominado' não tem o que reforçar");
  api.peDefinir({ filtro: "todos" });
  api.$("dlgPainel").close();

  /* ---- PE15 a conta do corte num edital feito para isso ---- */
  const L = ["# Corte | prova: " + d(60) + " | horas: 10", "& A | minimo: 50%", "@ Grande :: 10"];
  for (let k = 1; k <= 20; k++) L.push("+ G" + k + " :: 1");
  L.push("& B | minimo: 40%", "@ Pequena :: 2", "+ P1 :: 1", "+ P2 :: 1");
  const ed2 = api.edCriar("Corte", L.join("\n"));
  api.hubAbrirEdital(ed2.id);
  api.edRender();
  const its2 = api.horDoAberto().plano.itens;
  const ch2 = (nm) => its2.find((i) => i.nome === nm).chave;
  for (let k = 1; k <= 10; k++) api.edProgresso[ch2("G" + k)] = { e: "feito", d: d(-5) };
  api.edRender();
  api.$("btnEdPainel").onclick();
  df = api.peUltimoTeste();
  const pos = (nm) => df.fila.findIndex((x) => x.tp.nome === nm);
  ok(pos("P1") >= 0 && pos("P1") < pos("G11") && pos("P2") < pos("G11") && filaDe(df, "G11").tp.partes.corte === 0, "PE15 o bloco pequeno abaixo do mínimo passa à frente do grande que já passou: " + df.fila.slice(0, 4).map((x) => x.tp.nome).join(","));
  ok(filaDe(df, "P1").tp.partes.corte === 10, "PE15b cada tópico do bloco pequeno cobre todo o que falta: o corte inteiro (" + filaDe(df, "P1").tp.partes.corte + ")");
  /* os 10 estudados (sem medida) também estão na fila: 22 itens */
  ok(itensFila().length === 8 && /Mostrar mais 8 \(de 22\)/.test(api.$("btnPeFilaMais").textContent), "PE15c a fila mostra 8 e oferece o resto: " + (api.$("btnPeFilaMais") || {}).textContent);
  api.$("btnPeFilaMais").onclick();
  ok(itensFila().length === 16 && /Mostrar mais 6 \(de 22\)/.test(api.$("btnPeFilaMais").textContent), "PE15d 'mostrar mais' traz mais 8");
  api.$("btnPeFilaMais").onclick();
  ok(itensFila().length === 22 && !todos(api.$("peFila")).some((e) => e.id === "btnPeFilaMais"), "PE15d2 até acabar");
  api.$("dlgPainel").close();
  api.edProgresso[ch2("P1")] = { e: "feito", d: d(-1) };
  api.edRender();
  api.$("btnEdPainel").onclick();
  df = api.peUltimoTeste();
  ok(filaDe(df, "P2").tp.partes.corte === 0 && !df.urgencias.some((u) => u.tipo === "corte"), "PE15e o bloco passou do mínimo: o empurrão some");
  api.$("dlgPainel").close();
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
