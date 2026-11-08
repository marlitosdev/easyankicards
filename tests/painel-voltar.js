/* (19.103.0) HORAS POR ASSUNTO E DOMÍNIO — um número só, a meta do período, tela cheia e voltar ao painel
 *
 *   PV1  "vale X% da prova" é a MESMA fatia do plano nas horas, no Domínio e na cobertura (híbrida: parte do edital, parte
 *        estimada) — antes eram três contas
 *   PV2  com um período (7 dias), a meta é a do período (horas por semana × semanas × fatia) e as linhas de corte saem
 *   PV3  abrir o estudo a partir das horas e fechar: as horas voltam, na mesma disciplina
 *   PV4  se a pessoa foi para outra tela do app, o painel não volta por cima: aparece "↩ Voltar para …", que reabre
 *   PV5  o Domínio volta com o mesmo filtro e a mesma visão
 *   PV6  abrir o painel pelo botão dele desarma a volta; "dispensar" também
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^| )" + c + "( |$)").test(e.className || "");
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  const TXT = ["# Fiscal | prova: " + d(40) + " | horas: 20",
    "@ Português :: 20q", "+ Crase :: 3", "+ Regência :: 3",
    "@ Tributário :: 5", "+ ISS :: 5", "+ ICMS :: 5", "+ Obrigação :: 4",
    "@ Informática :: 2", "+ Redes :: 2"].join("\n");
  const ed = api.edCriar("Fiscal", TXT);
  api.hubAbrirEdital(ed.id);
  api.edRender();
  const plano = api.horDoAberto().plano;

  /* ---- PV1 ---- */
  const ff = plano.fatiaFina || {};
  const h = api.horMapa(plano, [], {});
  const dm = api.domDoEdital({ texto: api.$("editalTexto").value, progresso: {} }, { fase: 1 });
  const cv = api.covDoEdital({ texto: api.$("editalTexto").value }, [], { fase: 1 });
  const igual = (a, b) => Math.abs(a - b) < 0.01;
  const nomes = ["Português", "Tributário", "Informática"];
  ok(nomes.every((k) => ff[k] > 0) && Math.abs(nomes.reduce((a, k) => a + ff[k], 0) - 100) < 0.01, "PV1 o plano tem a fatia sem arredondar (soma 100): " + JSON.stringify(ff));
  ok(nomes.every((k) => igual(h.disciplinas.find((x) => x.nome === k).pesoPct, ff[k])), "PV1b as horas usam a fatia do plano: " + h.disciplinas.map((x) => x.nome + "=" + x.pesoPct.toFixed(1)).join(", "));
  ok(nomes.every((k) => igual(dm.disciplinas.find((x) => x.nome === k).pesoPct, ff[k])) && dm.base === "plano", "PV1c o Domínio usa a mesma: " + dm.disciplinas.map((x) => x.nome + "=" + x.pesoPct.toFixed(1)).join(", ") + " (" + dm.base + ")");
  ok(nomes.every((k) => igual(cv.disciplinas.find((x) => x.nome === k).pesoPct, ff[k])), "PV1d a cobertura de cartões também");
  ok(Math.abs(dm.folhas.reduce((a, f) => a + f.pesoPct, 0) - 100) < 0.01, "PV1e e as folhas do Domínio continuam somando 100%");
  ok(api.pctProva(44.04) === "44" && api.pctProva(4.84) === "4,8" && api.t("cov_vale", { p: "44" }) === "vale 44% da prova", "PV1f o rótulo: 'vale 44% da prova', uma casa abaixo de 10%");

  /* ---- PV2 ---- */
  const h7 = api.horMapa(plano, [], { dias: 7, minSemana: 20 * 60, desde: d(-7) });
  const pt = h7.disciplinas.find((x) => x.nome === "Português");
  ok(pt.periodo === true && igual(pt.planejadoMin, 20 * 60 * ff["Português"] / 100) && pt.corteMin === null, "PV2 em 7 dias, a meta é 20h × a fatia: " + Math.round(pt.planejadoMin) + " min");
  api.$("btnEdHoras").onclick();
  api.$("horPeriodo").value = "7"; api.$("horPeriodo").onchange();
  const topo = todos(api.$("horCorpo")).filter((e) => cls(e, "hor-topo-de")).map((e) => e.textContent);
  ok(topo.length === 3 && topo.every((x) => /previstas em 7 dias/.test(x)), "PV2b o rótulo diz que a meta é do período: " + topo[0]);
  ok(todos(api.$("horCorpo")).filter((e) => cls(e, "hor-pesop")).every((e) => /^vale [\d,]+% da prova$/.test(e.textContent)), "PV2c cada coluna diz quanto vale na prova");
  api.$("horPeriodo").value = "tudo"; api.$("horPeriodo").onchange();

  /* ---- PV3 ---- */
  todos(api.$("horCorpo")).filter((e) => cls(e, "hor-col"))[0].onclick();
  const aberta = api.horDiscAbertaAtual();
  const estudar = todos(api.$("horCorpo")).filter((e) => cls(e, "hor-det")).length
    ? todos(todos(api.$("horCorpo")).filter((e) => cls(e, "hor-det"))[0]).find((e) => e.tag === "button" && /começar|estudar|materiais/i.test(e.textContent)) : null;
  ok(!!aberta && !!estudar, "PV3 achou a disciplina aberta e o botão de estudo: " + aberta);
  estudar.onclick({ stopPropagation() {} });
  const v = api.voltarAtual();
  ok(api.$("dlgHoras").open === false && v && v.painel === "dlgHoras" && v.vigia && v.vigia.open, "PV3b as horas fecharam e a janela aberta ficou vigiada: " + (v && v.vigia && v.vigia.id));
  const alvo = v.vigia;
  alvo.close();
  api.voltarDialogoFechou(alvo);
  ok(api.$("dlgHoras").open === true && api.horDiscAbertaAtual() === aberta && !api.voltarAtual(), "PV3c fechar o que foi aberto traz as horas de volta, na mesma disciplina");

  /* ---- PV4 ---- */
  api.horFechar();
  api.abrirModal("dlgCobertura");
  api.trocarModo(api.modoAtualTeste() === "cartoes" ? "edital" : "cartoes");
  api.$("dlgCobertura").close();
  api.voltarDialogoFechou(api.$("dlgCobertura"));
  ok(api.$("dlgHoras").open === false && api.$("voltarChip").hidden === false && /Voltar para Horas por assunto/.test(api.$("btnVoltarPainel").textContent),
    "PV4 foi para outra tela: o painel não volta por cima, aparece o botão: " + api.$("btnVoltarPainel").textContent);
  api.$("btnVoltarPainel").onclick();
  ok(api.$("dlgHoras").open === true && api.$("voltarChip").hidden === true && !api.voltarAtual(), "PV4b o botão reabre o painel e some");
  api.$("dlgHoras").close();

  /* ---- PV5 ---- */
  api.domAbrir(ed.id);
  api.domFiltroForcar("cinza");
  api.domAbaDefinir && api.domAbaDefinir("disc");
  const abaAntes = api.domAbaAtual ? api.domAbaAtual() : null;
  api.domFechar();
  api.abrirModal("dlgCobertura");
  api.$("dlgCobertura").close();
  api.voltarDialogoFechou(api.$("dlgCobertura"));
  ok(api.$("dlgDominio").open === true && api.domFiltroAtual() === "cinza" && (abaAntes === null || api.domAbaAtual() === abaAntes), "PV5 o Domínio volta com o mesmo filtro e a mesma visão: " + api.domFiltroAtual());
  api.$("dlgDominio").close();

  /* ---- PV6 ---- */
  api.horFechar();
  ok(!!api.voltarAtual(), "PV6 armado");
  api.$("btnEdHoras").onclick();
  ok(!api.voltarAtual(), "PV6b abrir as horas pelo botão desarma a volta");
  api.horFechar();
  api.$("btnVoltarFechar").onclick();
  ok(!api.voltarAtual() && api.$("voltarChip").hidden === true, "PV6c dispensar desarma e esconde o botão");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
