/* =====================================================================
 * CORRIGIR O TEMPO DE UM REGISTRO NO DIÁRIO (v18.59.0)
 *
 * O registro de 3h40 que foi 1h (o planejado dos 7 ramos entrou no campo
 * — consertado na 18.58.0) precisava de conserto sem apagar e refazer:
 * "✎ tempo" em cada registro, com o tempo dos ramos repartido de novo,
 * a marca de "corrigido (era 3h40)" e uma faixa com desfazer.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, valor) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) {
      await Promise.resolve();
      try { if (valor !== undefined && api.$("uiPromptInput")) api.$("uiPromptInput").value = valor; api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };

  /* ---- ler o tempo digitado ---- */
  {
    const { api } = rodar();
    const L = api.diarioLerTempo;
    ok(L("1h") === 60 && L("1h30") === 90 && L("3h40") === 220 && L("45min") === 45 && L("45 min") === 45 && L("90") === 90 && L("1:30") === 90 && L("2h05") === 125,
       "L1 lê 1h, 1h30, 3h40, 45min, 90 e 1:30");
    ok(L("") === null && L("abc") === null && L("1,5h") === null && L("-30") === null, "L2 o que não é tempo não vira número");
  }

  /* ---- corrigir: o caso de 3h40 em 7 ramos ---- */
  const EDITAL = "# ISS | prova: 2027-06-01 | horas: 20\n@ STB :: 5\n+ Tributos :: 5\n++ Conceito :: 5\n++ Impostos :: 3\n++ Taxas :: 2";
  const montar = async () => {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.edCriar("ISS", EDITAL);
    api.$("editalTexto").value = EDITAL; api.$("edProva").value = "2027-06-01"; api.$("edHoras").value = "20";
    api.edProgressoPor({});
    api.abrirRegistro(api.edItemDoPlano("STB", "Tributos"));
    api.$("btnRegRamosTodos").onclick();
    api.$("btnRegUsarPlano").onclick();          /* o planejado no campo: era o que acontecia antes da 18.58.0 */
    await api.$("btnRegEstudo").onclick();
    return api;
  };
  {
    const api = await montar();
    const idx = api.edDiarioAtual().length - 1;
    const x = api.edDiarioAtual()[idx];
    const antes = x.m;
    ok(antes > 60 && (x.rm || []).length === 3 && x.mo === "plano", "C0 premissa: um registro com o tempo planejado, em 3 ramos: " + JSON.stringify([x.m, (x.rm || []).map((r) => r.m), x.mo]));
    api.abrirDiario();
    const li = api.$("diarioLista").children.find((c) => /diario-item/.test(c.className || ""));
    const bTempo = li.children.find((c) => c.className === "di-acoes").children.find((b) => /di-bt-tempo/.test(b.className || ""));
    ok(bTempo && bTempo.textContent === "✎ tempo", "C1 cada registro tem '✎ tempo'");
    await conduzir(api, api.diarioCorrigirTempoPerguntar(idx), "1h");
    const y = api.edDiarioAtual()[idx];
    const somaRm = y.rm.reduce((s, r) => s + r.m, 0);
    ok(y.m === 60 && somaRm === 60 && y.rm.every((r) => r.m > 0), "C2 o registro passa a 1h e os ramos são repartidos de novo, fechando em 1h: " + JSON.stringify(y.rm.map((r) => r.m)));
    ok(y.mo === "voce" && y.mc && y.mc.de === antes, "C3 o tempo vira 'seu', e o registro lembra de quanto era: " + JSON.stringify(y.mc));
    ok(api.diarioTotais(api.edDiarioAtual().map((x2) => ({ x: x2 }))).minutos === 60, "C4 os totais do diário já usam 1h");
    const li2 = api.$("diarioLista").children.find((c) => /diario-item/.test(c.className || ""));
    const tempo = li2.children[0].children.find((c) => /di-tempo/.test(c.className || ""));
    ok(tempo.textContent === "1h ✎" && /era/.test(tempo.title), "C5 a linha mostra '1h ✎' e o balão diz quanto era: " + tempo.textContent + " | " + tempo.title);
    ok(api.$("diarioCorrecao").hidden === false && /Tempo corrigido em «Tributos»: .+ → 1h/.test(api.$("diarioCorrecaoTxt").textContent), "C6 a faixa confirma a correção: " + api.$("diarioCorrecaoTxt").textContent);
    api.$("btnDiarioTempoDesfazer").onclick();
    const z = api.edDiarioAtual()[idx];
    ok(z.m === antes && z.mo === "plano" && z.mc === undefined && z.rm.reduce((s, r) => s + r.m, 0) === antes, "C7 desfazer volta tudo (tempo, ramos e origem)");
    ok(api.$("diarioCorrecao").hidden === true, "C7a e a faixa some");
  }
  {
    const api = await montar();
    const idx = api.edDiarioAtual().length - 1;
    const antes = api.edDiarioAtual()[idx].m;
    await conduzir(api, api.diarioCorrigirTempoPerguntar(idx), "uma hora");
    ok(api.edDiarioAtual()[idx].m === antes && /Não entendi "uma hora"/.test(api.$("uiModalMsg").textContent), "C8 tempo que não dá para ler: avisa e não mexe: " + api.$("uiModalMsg").textContent);
    await conduzir(api, api.diarioCorrigirTempoPerguntar(idx), "20h");
    ok(api.edDiarioAtual()[idx].m === antes, "C8a mais de 15h numa sessão: recusa");
    /* cancelar não muda nada (e não reclama de nada) */
    api.$("uiModalMsg").textContent = "";
    const p = api.diarioCorrigirTempoPerguntar(idx);
    await Promise.resolve();
    api._uiFechar(false);
    for (let i = 0; i < 4; i++) await Promise.resolve();
    ok(api.edDiarioAtual()[idx].m === antes && !/Não entendi/.test(api.$("uiModalMsg").textContent), "C9 cancelar não muda nada e não mostra aviso: " + api.$("uiModalMsg").textContent);
    api._uiFechar(false);
    await p;
    /* a soma dos ramos fecha SEMPRE no total, qualquer que seja o arredondamento */
    const xs = api.edDiarioAtual()[idx];
    const somasOk = [59, 61, 67, 71, 101, 137].every((v) => { api.diarioTempoCorrigir(xs, v); return xs.rm.reduce((s, r) => s + r.m, 0) === v; });
    ok(somasOk, "C9a o tempo dos ramos fecha sempre no total corrigido (o último leva o resto)");
    api.diarioTempoDesfazer();
    /* duas correções seguidas: 'era' continua o valor original */
    api.diarioTempoCorrigir(api.edDiarioAtual()[idx], 90);
    api.diarioTempoCorrigir(api.edDiarioAtual()[idx], 60);
    ok(api.edDiarioAtual()[idx].mc.de === antes, "C10 corrigir de novo mantém 'era' = o valor original");
    ok(api.diarioTempoCorrigir({ esp: "x", m: 0 }, 30) === null, "C11 linha de espelho (outro edital, tempo zero) não se corrige");
  }
  /* ---- (v18.60.0) o diário mostra de onde veio cada tempo ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const hoje = api.hojeISO();
    const D = api.edDiarioAtual();
    D.push({ d: hoje, c: "stb›tributos", n: "Tributos", disc: "STB", m: 220, a: "feito", mo: "plano", cc: "ISS" });
    D.push({ d: hoje, c: "stb›limitacoes", n: "Limitações", disc: "STB", m: 12, a: "feito", mo: "medido", cc: "ISS" });
    D.push({ d: hoje, c: "stb›outro", n: "Outro", disc: "STB", m: 60, a: "revisado", mo: "voce", cc: "ISS" });
    D.push({ d: hoje, c: "stb›outro", n: "Outro", disc: "STB", m: 40, a: "revisado", mo: "plano", cc: "ISS" });
    api.abrirDiario();
    const linhas = () => api.$("diarioLista").children.filter((c) => /diario-item/.test(c.className || ""));
    const tempoDe = (nome) => { const li = linhas().find((l) => l.children[0].children[0].textContent === nome); return li && li.children[0].children.find((c) => /di-tempo/.test(c.className || "")); };
    const tp = tempoDe("Tributos");
    ok(tp && tp.textContent === "≈ 3h40" && /di-tempo-plano/.test(tp.className) && /sem você conferir/.test(tp.title), "O1 tempo que veio do sugerido aparece com ≈ e o balão diz: " + (tp && tp.textContent + " | " + tp.title));
    ok(/medido/.test(tempoDe("Limitações").title) && tempoDe("Limitações").textContent === "12min", "O2 tempo medido: sem ≈, e o balão diz que foi medido");
    const grupo = linhas().find((l) => /di-grupo/.test(l.className || ""));
    ok(grupo && /2 sessões: (?:1h \+ ≈40min|≈40min \+ 1h)/.test(grupo.textContent) && /^≈ 1h40$/.test(grupo.children[0].children[1].textContent), "O3 sessões juntas mostram as partes da soma (≈ na que veio do sugerido): " + (grupo && grupo.textContent));
    const chip = api.$("diarioResumo").children.find((c) => /di-res-plano/.test(c.className || ""));
    ok(chip && /≈ 4h20 disso veio do tempo sugerido, sem conferir/.test(chip.textContent), "O4 o resumo do topo diz quanto do total veio do sugerido sem conferir: " + (chip && chip.textContent));
    const tc = api.diarioTextoCopia(api.diarioFiltrar(D, { dias: 7 }), "T");
    ok(/3h40 · estudou Tributos .*tempo sugerido, não conferido/.test(tc) && /2 sessões: (?:1h \+ ≈40min|≈40min \+ 1h)/.test(tc), "O5 o Copiar leva a mesma informação: " + tc);
    /* corrigido, deixa de ser sugerido: some o ≈ e o aviso do topo diminui */
    api.diarioTempoCorrigir(D[0], 60);
    api.abrirDiario();
    const chip2 = api.$("diarioResumo").children.find((c) => /di-res-plano/.test(c.className || ""));
    ok(tempoDe("Tributos").textContent === "1h ✎" && chip2 && /≈ 40min disso/.test(chip2.textContent), "O6 corrigido, o tempo vira seu (✎) e o aviso do topo só conta o que resta: " + (chip2 && chip2.textContent));
    D[3].mo = "voce"; api.abrirDiario();
    ok(!api.$("diarioResumo").children.some((c) => /di-res-plano/.test(c.className || "")), "O7 sem tempo sugerido no período, sem aviso no topo");
  }
  {
    const { api } = rodar();
    ["ed_diario_corrigir_tempo", "ed_diario_tempo_pergunta", "ed_diario_tempo_invalido", "ed_diario_tempo_feito", "ed_diario_tempo_desfazer", "ed_diario_tempo_corrigido_tip", "ed_diario_res_plano", "ed_diario_tempo_plano_tip", "ed_diario_tempo_medido_tip", "ed_diario_n_sessoes_partes", "ed_diario_copia_plano"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "C12 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
