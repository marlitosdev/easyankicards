/* =====================================================================
 * O TEMPO DO REGISTRO É O QUE A PESSOA ESTUDOU (v18.58.0)
 *
 * O relato: "registrei 1 hora de estudo mas contou como 3:40 hrs... gera a
 * sensação falsa de que estudei mais". Duas causas: (1) marcar ramos
 * ("Todos") reescrevia o campo com a soma do tempo PLANEJADO dos ramos, por
 * cima do que foi digitado; (2) o "registrar" da rodada de questões punha o
 * RELÓGIO desde o começo da rodada (até 4 h), com pausas e tudo. Agora: o
 * campo nasce vazio, o planejado é sugestão a um toque, nada reescreve o
 * que a pessoa pôs, a rodada mede o tempo ATIVO, e o diário guarda a origem.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const EDITAL = "# ISS | prova: 2027-06-01 | horas: 20\n@ Licitações :: 5\n+ Lei 14.133 :: 5\n++ Modalidades :: 5\n++ Fase preparatória\n++ Contratos :: 3";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.edCriar("ISS", EDITAL);
    api.$("editalTexto").value = EDITAL; api.$("edProva").value = "2027-06-01"; api.$("edHoras").value = "20";
    api.edProgressoPor({});
    return api;
  };
  const digitar = (api, v) => { api.$("regMinutos").value = String(v); ((api.$("regMinutos")._ouv || {}).input || []).forEach((fn) => fn()); };

  /* ---- o caso do relato: 1h digitada, depois "Todos" ---- */
  {
    const api = montar();
    const it = api.edItemDoPlano("Licitações", "Lei 14.133");
    api.abrirRegistro(it);
    ok(api.$("regMinutos").value === "", "T1 o campo de tempo nasce vazio");
    digitar(api, 60);
    api.$("btnRegRamosTodos").onclick();
    ok(api.$("regMinutos").value === "60" && api.regTempoPlanejadoAtual() > 60, "T2 marcar 'Todos' NÃO reescreve a 1h digitada; o planejado dos ramos fica como referência: " + api.$("regMinutos").value + " | " + api.regTempoPlanejadoAtual());
    ok(/planejado|reservou/.test(api.$("regMinFmt").textContent) && /usar o sugerido/.test(api.$("btnRegUsarPlano").textContent), "T2a o planejado aparece ao lado, a um toque: " + api.$("regMinFmt").textContent);
    const ck = api.$("regRamos").children[1].children[0];
    ck.checked = false; ck.onchange();
    ok(api.$("regMinutos").value === "60", "T3 desmarcar um ramo também não mexe no tempo digitado");
    api.regTipoTrocar(); api.regTipoTrocar();
    ok(api.$("regMinutos").value === "60", "T4 trocar estudo/revisão (e voltar) não mexe no tempo digitado");
    await api.$("btnRegEstudo").onclick();
    const d = api.edDiarioAtual()[api.edDiarioAtual().length - 1];
    ok(d.m === 60 && d.mo === "voce" && (d.rm || []).reduce((s, x) => s + (x.m || 0), 0) === 60, "T5 o diário grava 1h (origem 'você'), repartida entre os ramos sem inflar: " + JSON.stringify([d.m, d.mo, (d.rm || []).map((x) => x.m)]));
  }
  {
    /* sem tempo: não grava; 'usar o sugerido' grava com origem 'plano' */
    const api = montar();
    const it = api.edItemDoPlano("Licitações", "Lei 14.133");
    api.abrirRegistro(it);
    const n0 = api.edDiarioAtual().length;
    await api.$("btnRegEstudo").onclick();
    ok(api.edDiarioAtual().length === n0 && /reg-tempo-falta/.test(api.$("regMinFmt").className || ""), "T6 sem tempo, nada é gravado e o campo é apontado");
    api.$("btnRegUsarPlano").onclick();
    await api.$("btnRegEstudo").onclick();
    const d = api.edDiarioAtual()[api.edDiarioAtual().length - 1];
    ok(api.edDiarioAtual().length === n0 + 1 && d.mo === "plano" && d.m === it.minutosSessao, "T7 com 'usar o sugerido', grava o planejado — marcado como origem 'plano': " + JSON.stringify([d.m, d.mo]));
    /* atalho é da pessoa */
    api.abrirRegistro(api.edItemDoPlano("Licitações", "Lei 14.133"));
    Array.from(api.$("regAtalhos").children).find((b) => b.textContent === "+30m").onclick();
    ok(api.$("regMinutos").value === "30" && api.regTempoOrigemAtual() === "voce", "T8 os atalhos somam a partir de vazio e o tempo é 'seu'");
    api.$("btnRegUsarPlano").onclick();
    digitar(api, 45);
    ok(api.regTempoOrigemAtual() === "voce", "T8a mexer no sugerido o torna 'seu'");
  }

  /* ---- o tempo ATIVO da rodada de questões ---- */
  {
    const { api } = rodar();
    const t0 = Date.parse("2026-10-15T10:00:00Z");
    const s = { comecou: new Date(t0).toISOString(), respondidas: [
      { id: "a", em: t0 + 2 * 60000 }, { id: "b", em: t0 + 5 * 60000 }, { id: "c", em: t0 + 125 * 60000 } ] };
    const r = api.qsTempoAtivo(s, t0 + 127 * 60000);
    ok(r.medido === true && r.min === 2 + 3 + 8 + 2, "Q1 tempo ativo = intervalos entre respostas, com a pausa de 2h contando só o teto de 8 min: " + JSON.stringify(r));
    const leg = api.qsTempoAtivo({ comecou: new Date(t0).toISOString(), respondidas: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] }, t0 + 220 * 60000);
    ok(leg.medido === false && leg.min === 10, "Q2 rodada antiga (sem hora por resposta): estimativa (4 × 2,5 min), marcada como não medida: " + JSON.stringify(leg));
    const curto = api.qsTempoAtivo({ comecou: new Date(t0).toISOString(), respondidas: [{ id: "a" }, { id: "b" }] }, t0 + 3 * 60000);
    ok(curto.min === 3, "Q2a a estimativa não passa do relógio");
    ok(api.qsTempoAtivo({ comecou: new Date(t0).toISOString(), respondidas: [] }).min === 0, "Q2b sem resposta, zero");
  }
  {
    /* o registro da rodada: medido entra no campo; estimado fica como sugestão */
    const api = montar();
    const ch = api.matChave("Licitações", "Lei 14.133");
    api.qsAplicar([{ tipo: "ce", enunciado: "Q1", gabarito: "C", disciplina: "Licitações", topico: "Lei 14.133", chave: ch },
      { tipo: "ce", enunciado: "Q2", gabarito: "E", disciplina: "Licitações", topico: "Lei 14.133", chave: ch }]);
    api.qsSessaoIniciar(api.qsTodas());
    api.qsResponder("C"); api.qsAndar(1); api.qsResponder("E");
    const s = api.qsSessaoAtual();
    ok(s.respondidas.every((x) => typeof x.em === "number"), "Q3 cada resposta guarda a hora (para medir o tempo ativo)");
    s.comecou = new Date(Date.now() - 300 * 60000).toISOString();   /* rodada começada há 5 h */
    s.respondidas[0].em = Date.now() - 4 * 60000; s.respondidas[1].em = Date.now() - 1 * 60000;
    api.qsUiRegistrarEstudo();
    const m = Number(api.$("regMinutos").value);
    ok(api.$("dlgRegistro").open === true && m <= 8 + 3 + 1 && m >= 10 && api.regTempoOrigemAtual() === "medido", "Q4 o registro da rodada traz o tempo ATIVO (≈12 min), não as 5 h de relógio: " + m);
    ok(/medido/.test(api.$("regMinFmt").textContent), "Q4a e diz que foi medido: " + api.$("regMinFmt").textContent);
    s.respondidas.forEach((x) => { delete x.em; });
    api.$("dlgRegistro").close();
    api.qsUiRegistrarEstudo();
    ok(api.$("regMinutos").value === "" && api.regTempoPlanejadoAtual() === 5, "Q5 rodada antiga: a estimativa fica como sugestão, o campo vazio: " + api.$("regMinutos").value + " | " + api.regTempoPlanejadoAtual());
  }
  {
    const { api } = rodar();
    ["ed_reg_min_vazio", "ed_reg_min_medido", "ed_reg_min_do_plano", "ed_reg_usar_plano", "ed_reg_min_falta"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "T9 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
