/* (19.88.0) O PAINEL DA DISCURSIVA: pegar pela mão e dar o ritmo.
 *
 *   PA1–PA6   o motor: alvo por disciplina, cor, conteúdo, ordem de urgência, a semana e o ritmo
 *   PP1–PP6   o passo de agora (formato → disciplina mais urgente → modelo que falta → manter → em dia)
 *   PK1–PK5   o pedido à IA num envio só e a leitura da resposta (com a RESPOSTA MODELO)
 *   PT1–PT10  a tela: o Painel na frente, as pendências que mostram o que falta, a aba com a cor, Temas sem botão por linha
 *   PG1–PG5   a agenda: o chip conta temas e pendências, a linha diz o passo, "ver o que falta" abre o Painel filtrado
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const em = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test((e && e.className) || "");
  const achar = (el, f, out) => { out = out || []; Array.from((el && el.children) || []).forEach((x) => { if (f(x)) out.push(x); achar(x, f, out); }); return out; };
  const texto = (dias, extra) => ["# ISS | prova: " + em(dias) + " | horas: 20",
    "# discursiva | pontos: 40 | objetiva: 100 | minimo: 50% | linhas: 25-30 | disciplinas: Tributário; Administrativo; Contabilidade",
    "@ Tributário :: 5", "+ Lançamento :: 5 :: !d", "+ Crédito tributário :: 4 :: !d", "+ Taxas :: 2",
    "@ Administrativo :: 4", "+ Atos administrativos :: 4 :: !d", "+ Licitações :: 4 :: !d",
    "@ Contabilidade :: 3", "+ Balanço :: 3 :: !d"].concat(extra || []).join("\n");

  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const prep = (e) => {
    const r = api.lerEdital(e.texto);
    return { r, dc: api.dsDiscursivaDe(e).dc, sit: api.dsDiasProva(e), plano: api.montarPlano(r, { horas: 20, prova: r.cfg.prova, feitos: e.progresso || {} }) };
  };

  /* ---------------- PA: o motor ---------------- */
  {
    ok(api.dsAlvoDisc(10, 3) === 2 && api.dsAlvoDisc(40, 4) === 3 && api.dsAlvoDisc(90, 5) === 5 && api.dsAlvoDisc(null, 3) === 3 && api.dsAlvoDisc(15, 5) === 3,
      "PA1 o alvo por disciplina: 2 na reta final, 3 até 60 dias, 4 antes; +1 no peso 5");
    const e = api.edCriar("Painel 40", texto(40));
    e.progresso = { [api.matChave("Tributário", "Lançamento")]: { e: "feito", d: em(-3) } };
    api.dsPropostaAdicionar(e.id, { tema: "Lançamento de ofício", disc: "Tributário", enunciado: "Disserte sobre o lançamento.", espelho: "conceito 20", fonte: "ia" });
    api.dsPropostaAdicionar(e.id, { tema: "Só o nome", disc: "Tributário", fonte: "sugestao" });
    api.dsRedacaoAdicionar(e.id, { tema: "Atos vinculados", disc: "Administrativo", nota: 30, max: 40 });
    const x = prep(e);
    const P = api.dsPainel(e, x.plano, x.dc, x.sit);
    const D = (nm) => P.discs.find((d) => d.nome === nm);
    ok(D("Tributário").alvo === 4 && D("Tributário").temas === 1 && D("Tributário").nivel === "amarelo" && D("Tributário").faltam === 3,
      "PA2 tema da IA conta (o que só tem o nome não): Tributário 1 de 4, amarelo: " + JSON.stringify(D("Tributário")));
    ok(D("Administrativo").temas === 1 && D("Administrativo").redacoes === 1 && D("Contabilidade").nivel === "vermelho",
      "PA3 redação escrita também conta; disciplina sem nada é vermelha");
    ok(D("Tributário").conteudo.total === 2 && D("Tributário").conteudo.feitos === 1, "PA4 o conteúdo conta os tópicos !d da disciplina: " + JSON.stringify(D("Tributário").conteudo));
    ok(P.discs[0].nome === "Contabilidade" && P.discs[1].nome === "Tributário", "PA5 a mais urgente primeiro (a cor, depois o peso): " + P.discs.map((d) => d.nome).join());
    ok(P.feitas === 2 && P.faltam === 3 + 2 + 3 && P.semanas === 6 && P.meta === 2 && P.cont.vermelho === 1 && P.cont.amarelo === 2,
      "PA6 a semana (2 temas) e o ritmo (8 faltando em 6 semanas = 2 por semana): " + JSON.stringify({ f: P.feitas, fa: P.faltam, s: P.semanas, m: P.meta }));
    api.edApagar(e.id);
  }

  /* ---------------- PP: o passo de agora ---------------- */
  {
    const e = api.edCriar("Passo 40", texto(40));
    let x = prep(e);
    let ps = api.dsProximoPasso(e, x.plano, x.dc, x.sit);
    ok(ps.cod === "gerar" && ps.disc === "Tributário" && ps.modo === "completos" && ps.n === 3, "PP1 tudo vermelho: a disciplina de maior peso, 3 temas completos: " + JSON.stringify({ c: ps.cod, d: ps.disc, m: ps.modo, n: ps.n }));
    ok(/Gere 3 tema\(s\) completo\(s\) de Tributário/.test(api.dsPassoTexto(ps)), "PP1b o passo numa frase: " + api.dsPassoTexto(ps));
    const ef = api.edCriar("Passo 15", texto(15));
    const xf = prep(ef);
    const pf = api.dsProximoPasso(ef, xf.plano, xf.dc, xf.sit);
    ok(pf.modo === "ideias" && pf.n === 6 && /ideias de tema de Tributário/.test(api.dsPassoTexto(pf)), "PP2 na reta final (15 dias), ideias rápidas: " + api.dsPassoTexto(pf));
    /* todas no alvo, uma sem modelo: o passo é a resposta modelo */
    ["Tributário", "Administrativo", "Contabilidade"].forEach((d) => { for (let k = 0; k < 5; k++) api.dsPropostaAdicionar(e.id, { tema: d + " " + k, disc: d, enunciado: "Enunciado " + k, modelo: "Resposta modelo longa o bastante para contar como modelo de verdade " + k }); });
    api.dsPropostaAdicionar(e.id, { tema: "Sem modelo", disc: "Contabilidade", enunciado: "Disserte." });
    x = prep(e);
    ps = api.dsProximoPasso(e, x.plano, x.dc, x.sit);
    ok(ps.cod === "modelo" && ps.p.tema === "Sem modelo", "PP3 todas no alvo e um tema sem resposta modelo: o passo é ler o modelo: " + JSON.stringify(ps.cod));
    api.dsPropostaAtualizar(e.id, ps.p.id, { modelo: "Agora com resposta modelo longa o bastante para contar.", modeloEm: em(0) });
    x = prep(e);
    ps = api.dsProximoPasso(e, x.plano, x.dc, x.sit);
    ok(ps.cod === "em_dia", "PP4 no alvo e com a semana feita: em dia (escrever fica opcional): " + ps.cod);
    const es = api.edCriar("Sem formato", ["# SF | prova: " + em(80) + " | horas: 20", "# fase 2: Discursiva | prova: " + em(100) + " | horas: 20", "@ A :: 5", "+ x :: 5 :: !d"].join("\n"));
    const xs = prep(es);
    ok(api.dsProximoPasso(es, xs.plano, xs.dc, xs.sit).cod === "formato", "PP5 sem o formato cadastrado, o primeiro passo é cadastrar");
    const Ps = api.dsPainel(es, xs.plano, xs.dc, xs.sit);
    ok(Ps.meta === 1 && Ps.depois >= 1, "PP6 data própria com a objetiva antes: 1 por semana até ela, o resto depois: " + JSON.stringify({ m: Ps.meta, d: Ps.depois }));
    api.edApagar(e.id); api.edApagar(ef.id); api.edApagar(es.id);
  }

  /* ---------------- PK: o pedido à IA e a resposta ---------------- */
  {
    const e = api.edCriar("Pedido", texto(40));
    const dc = api.dsDiscursivaDe(e).dc;
    const pc = api.dsPromptPacote(e, dc, "Tributário", "completos", 3, ["Lançamento (Tributário)"]);
    ok(/RESPOSTA MODELO:/.test(pc) && /LINHAS:/.test(pc) && /25 a 30 linhas/.test(pc) && /Disciplina\(s\): Tributário/.test(pc) && /- Lançamento \(Tributário\)/.test(pc) && /Crie 3 questão/.test(pc),
      "PK1 o pedido completo: formato, disciplina, tópicos, espelho e resposta modelo num envio só");
    const pi = api.dsPromptPacote(e, dc, "Tributário", "ideias", 6, []);
    ok(/Liste 6 temas/.test(pi) && /COMO SERÁ COBRADO/.test(pi) && !/RESPOSTA MODELO:/.test(pi), "PK2 ideias rápidas: muitos temas, como é cobrado, sem resposta modelo");
    const resp = "Seguem:\n\nTEMA: Lançamento\nDISCIPLINA: tributario\nENUNCIADO: Disserte sobre o lançamento.\nLinhas: 25 a 30.\nESPELHO: conceito 20; modalidades 20\nRESPOSTA MODELO: O lançamento é o procedimento administrativo que constitui o crédito tributário, nos termos do art. 142 do CTN.\nSegundo parágrafo da resposta.\nLINHAS: 27\n\nTEMA: Taxas\nDISCIPLINA: Tributário\nENUNCIADO: Explique as taxas.\nESPELHO: poder de polícia 20; serviço 20";
    const lidas = api.dsPropostasLer(resp, dc.disciplinas);
    ok(lidas.length === 2 && lidas[0].disc === "Tributário" && /Linhas: 25 a 30/.test(lidas[0].enunciado) && /art\. 142/.test(lidas[0].modelo) && /Segundo parágrafo/.test(lidas[0].modelo) && lidas[0].linhas === 27 && !lidas[1].modelo,
      "PK3 a resposta colada: a resposta modelo e as linhas entram; 'Linhas:' dentro do enunciado continua texto: " + JSON.stringify(lidas[0]).slice(0, 300));
    const r = api.dsLerPacote(e, dc, resp);
    const p0 = api.dsPropostas(e.id).find((p) => p.tema === "Lançamento");
    ok(r.ok === 2 && r.comModelo === 1 && p0.modelo && p0.modeloLinhas === 27 && p0.modeloEm && p0.fonte === "ia", "PK4 guardar: 2 temas, 1 com a resposta modelo (com linhas e data)");
    ok(!!api.dsLerPacote(e, dc, "sem rótulo nenhum").erro, "PK5 resposta sem os rótulos: avisa, não guarda");
    api.edApagar(e.id);
  }

  /* ---------------- PT: a tela ---------------- */
  {
    const e = api.edCriar("Tela", texto(40));
    const e2 = api.edCriar("Outra", texto(70));
    api.dsPropostaAdicionar(e2.id, { tema: "x", disc: "Tributário", enunciado: "y", modelo: "Resposta modelo longa o bastante para contar como modelo." });
    api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "geral");
    api.dsRender();
    const g = () => api.$("dsSec_" + e.id + "_geral");
    const painel = () => achar(g(), (x) => x.id === "dsPainel_" + e.id)[0];
    ok(api.$("dsAbaSec_" + e.id + "_geral").textContent === "Painel" && painel() && g().children[0] && achar(g(), (x) => cls(x, "ds-passo-card")).length === 1,
      "PT1 a primeira aba é o Painel, e ele começa pelo passo de agora");
    const linhas = achar(painel(), (x) => cls(x, "ds-pn-lin"));
    ok(linhas.length === 3 && linhas.every((l) => cls(l, "ds-pn-vermelho")) && /0\/4 temas/.test(linhas[0].textContent) && /sem tema/.test(linhas[0].textContent),
      "PT2 uma linha por disciplina, na cor (todas vermelhas, sem tema): " + linhas.map((l) => l.className).join(" | "));
    const passo = achar(g(), (x) => cls(x, "ds-passo-card"))[0];
    ok(cls(passo, "ds-passo-vermelho") && /Gere 3 tema\(s\) completo\(s\) de Tributário/.test(passo.textContent) && achar(passo, (x) => cls(x, "ds-fluxo")).length === 1,
      "PT3 o passo diz a disciplina e traz a ida à IA dentro dele");
    /* colar a resposta no passo: os temas entram e o Painel anda */
    const ta = achar(passo, (x) => x.id === "dsPassoTx_" + e.id)[0];
    ta.value = "TEMA: Lançamento\nDISCIPLINA: Tributário\nENUNCIADO: Disserte.\nESPELHO: a 40\nRESPOSTA MODELO: Texto da resposta modelo longo o bastante para contar como modelo.\nLINHAS: 26";
    achar(passo, (x) => x.id === "btnDsPassoLer_" + e.id)[0].onclick();
    const tri = achar(painel(), (x) => cls(x, "ds-pn-lin")).find((l) => /Tributário/.test(l.textContent));
    ok(tri && cls(tri, "ds-pn-amarelo") && /1\/4 temas/.test(tri.textContent), "PT4 colar no passo guarda o tema e a linha da disciplina muda de cor: " + (tri && tri.className));
    /* a pendência: clicar mostra só o que falta */
    const pend = achar(painel(), (x) => x.id === "dsPendDiscs_" + e.id)[0];
    ok(pend && /3 disciplina\(s\) pedem temas — ver quais/.test(pend.textContent), "PT5 o contador de pendências: " + (pend && pend.textContent));
    api.dsPropostaAdicionar(e.id, { tema: "C1", disc: "Contabilidade", enunciado: "a" }); api.dsPropostaAdicionar(e.id, { tema: "C2", disc: "Contabilidade", enunciado: "b" }); api.dsPropostaAdicionar(e.id, { tema: "C3", disc: "Contabilidade", enunciado: "c" });
    api.dsRender();
    achar(painel(), (x) => x.id === "dsPendDiscs_" + e.id)[0].onclick();
    const vis = achar(painel(), (x) => cls(x, "ds-pn-lin"));
    ok(vis.length === 2 && !vis.some((l) => /Contabilidade/.test(l.textContent)) && /ver todas/.test(achar(painel(), (x) => x.id === "dsPendDiscs_" + e.id)[0].textContent),
      "PT6 'ver quais' deixa só as disciplinas que pedem temas (Contabilidade, no alvo, sai): " + vis.map((l) => l.textContent.slice(0, 20)).join(" | "));
    /* sem modelo: leva às propostas filtradas */
    const sm = achar(painel(), (x) => x.id === "dsPendModelo_" + e.id)[0];
    ok(sm && /3 tema\(s\) sem resposta modelo/.test(sm.textContent), "PT7 o contador do que está sem resposta modelo: " + (sm && sm.textContent));
    sm.onclick();
    ok(api.loja.getItem("eac_ds_secao") === "propostas" && api.$("dsPropFSt_" + e.id).value === "semModelo" && !/Lançamento/.test(String(api.$("dsProps_" + e.id).textContent || "").split("◀")[0]),
      "PT7b ver → Propostas com o filtro 'sem resposta modelo'");
    /* a aba do edital diz a cor do que falta */
    const aba = api.$("dsAbaEd_" + e.id);
    ok(achar(aba, (x) => cls(x, "ds-aba-pend") && cls(x, "ds-pn-vermelho")).length === 1 && /2 pede\(m\) temas/.test(aba.textContent), "PT8 a aba do edital traz a cor (vermelha: Administrativo sem tema) e a contagem: " + aba.textContent);
    /* Temas: sem botão por linha; marcar muda o pedido */
    api.loja.setItem("eac_ds_secao", "temas");
    api.dsRender();
    const st = api.$("dsSec_" + e.id + "_temas");
    const cks = achar(st, (x) => cls(x, "ds-sug-ck"));
    ok(cks.length >= 3 && achar(st, (x) => cls(x, "ds-sug-lin")).length === 0 && !/guardar/.test(st.textContent.split("①")[0] || ""),
      "PT9 Temas: os tópicos se MARCAM; não há mais 'IA' e 'guardar' em cada linha");
    const bc = achar(st, (x) => x.id === "btnDsCriarIa_" + e.id)[0];
    const n0 = (bc.textContent.match(/\d+/) || [])[0];
    const ck0 = achar(st, (x) => x.id === "dsSugCk_" + e.id + "_0")[0];
    ck0.checked = false; ck0.onchange();
    ok(n0 === "3" && /de 2 tema/.test(bc.textContent), "PT10 desmarcar um tópico muda o pedido no botão de copiar (3 → 2): " + bc.textContent);
    api.loja.removeItem("eac_ds_secao"); api.loja.removeItem("eac_ds_edital");
    api.edApagar(e.id); api.edApagar(e2.id);
  }

  /* ---------------- PG: a agenda ---------------- */
  {
    const e = api.edCriar("Agenda D", texto(25));
    api.hubPintarAgenda();
    const topo = api.$("edAgendaTopo");
    const chip = achar(topo, (x) => x.id === "hubAviso_disc")[0];
    ok(chip && /0 de \d+ tema\(s\) esta semana · 3 disciplina\(s\) pedem temas/.test(chip.textContent) && cls(chip, "alerta"),
      "PG1 o chip conta temas e pendências, em alerta (disciplina sem tema a 25 dias): " + (chip && chip.className + " / " + chip.textContent));
    const ln = achar(topo, (x) => x.id === "hubDiscTreino_" + e.id)[0];
    ok(ln && achar(ln, (x) => cls(x, "ds-pn-dot")).length === 3 && /Agora: Gere/.test(ln.textContent), "PG2 a linha: uma bolinha por disciplina e o passo de agora: " + (ln && ln.textContent));
    const falta = achar(ln, (x) => x.id === "btnHubDiscFalta_" + e.id)[0];
    ok(falta && /ver o que falta \(3\)/.test(falta.textContent) && !/feito esta semana/.test(ln.textContent), "PG3 'ver o que falta' com a contagem; o 'feito esta semana' saiu da agenda");
    api.loja.setItem("eac_ds_secao", "texto");
    falta.onclick();
    ok(api.loja.getItem("eac_ds_edital") === String(e.id) && api.loja.getItem("eac_ds_secao") === "geral" && /ver todas/.test(String(api.$("dsPainel_" + e.id) && api.$("dsPainel_" + e.id).textContent)),
      "PG4 'ver o que falta' abre as Discursivas neste edital, no Painel, só com o que falta");
    ok(achar(topo, (x) => x.id === "btnHubDisc_" + e.id)[0].textContent === api.t("hub_disc_fazer"), "PG5 o atalho principal diz 'fazer agora'");
    api.loja.removeItem("eac_ds_secao"); api.loja.removeItem("eac_ds_edital");
    api.edApagar(e.id);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
