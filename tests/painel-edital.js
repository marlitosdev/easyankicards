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
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^| )" + c + "( |$)").test(e.className || "");
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
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
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
