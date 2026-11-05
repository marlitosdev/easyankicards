/* =====================================================================
 * RISCOS DE CORTE E O RELATÓRIO DE DIAGNÓSTICO (19.71.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  R1 o painel se chama "Acompanhamento dos riscos de corte deste edital" e diz o estado logo abaixo;
 *  R2 a discursiva entra no painel: cobertura das disciplinas dela × mínimo, treino de escrita, "só os N primeiros";
 *  R3 edital só com discursiva (sem blocos) também ganha o painel;
 *  D1 o relatório do Raio-X começa com o pedido à IA;
 *  D2 ele leva pontuação (exata/híbrida/estimada e discursiva), riscos de corte, buracos, tempo real, deixado de lado,
 *     revisões, materiais e o que ainda é estimativa.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const prova = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();
  const T = ["# Riscos | prova: " + prova + " | horas: 10",
    "# discursiva | pontos: 40 | objetiva: 90 | minimo: 50% | linhas: 25-30 | corrigida: 50 | disciplinas: Tributário",
    "& Específicos | minimo: 50%", "@ Tributário :: 5", "+ a :: 5", "+ b :: 4", "@ Administrativo :: 4", "+ c :: 4",
    "& Português | minimo: 50%", "@ Português :: 20p", "+ d :: 3", "@ Lógica :: 5p", "+ e :: 3"].join("\n");
  const r = api.lerEdital(T);
  const p = api.montarPlano(r, { horas: 10, feitos: { "tributário›a": "feito" } });

  const rd = api.edRiscoDiscursiva(p, "x");
  ok(rd && rd.pontos === 40 && rd.minPct === 50 && rd.corrigida === 50 && rd.disciplinas.join() === "Tributário", "R2a o risco da discursiva é calculado: " + JSON.stringify(rd));
  ok(rd.cobertura > 0 && rd.cobertura < 100 && rd.abaixo === (rd.cobertura < 50) && rd.semTreino === true, "R2b cobertura das disciplinas dela e treino zerado: " + rd.cobertura);

  const cx = api.edPintarBlocos(p);
  const txt = (cx && cx.textContent) || "";
  ok(/Acompanhamento dos riscos de corte deste edital/.test(txt), "R1 o painel tem o nome novo: " + txt.slice(0, 120));
  ok(/de 3 corte\(s\) acompanhados|Todos os 3 corte/.test(txt), "R1b o estado conta blocos e discursiva: " + txt.slice(0, 200));
  ok(/Discursiva/.test(txt) && /vale 31% da nota final/.test(txt) && /Nenhum treino de escrita/.test(txt) && /Só os 50 primeiros/.test(txt), "R2c a linha da discursiva no painel: " + txt.slice(-400));

  const T2 = ["# So disc | prova: " + prova + " | horas: 10", "# discursiva | pontos: 30 | objetiva: 70 | minimo: 40% | disciplinas: A", "@ A :: 5", "+ x :: 5", "@ B :: 3", "+ y :: 3"].join("\n");
  const cx2 = api.edPintarBlocos(api.montarPlano(api.lerEdital(T2), { horas: 10, feitos: {} }));
  ok(cx2 && /Discursiva/.test(cx2.textContent || ""), "R3 sem blocos, só com a discursiva, o painel aparece");

  const rel = api.plRelatorio(p, r, [], [], r.cfg);
  ok(/^PEDIDO: Voce e um orientador de estudos/.test(rel) && /o que estou deixando de lado/.test(rel), "D1 o relatório começa com o pedido à IA");
  ok(/== PONTUACAO ==/.test(rel) && /HIBRIDA/.test(rel) && /Português \| 20 pontos/.test(rel) && /discursiva: 40 pontos \(objetiva 90\)/.test(rel) && /corrigida so para os 50 primeiros/.test(rel), "D2a pontuação, híbrida e discursiva");
  ok(/== RISCOS DE CORTE/.test(rel) && /bloco Específicos \| corte 50%/.test(rel) && /- Tributário: cobertura/.test(rel) && /discursiva \| corte 50%/.test(rel), "D2b riscos de corte (blocos e discursiva)");
  ok(/== BURACOS/.test(rel) && /Tributário \| \d+% \| \d+% \| \d+%/.test(rel), "D2c buracos por disciplina");
  ok(/== TEMPO REAL/.test(rel) && /== DEIXADO DE LADO ==/.test(rel) && /ramos pulados/.test(rel) && /tirados da agenda por voce/.test(rel), "D2d tempo real e deixado de lado");
  ok(/== REVISOES ==/.test(rel) && /== MATERIAIS POR DISCIPLINA ==/.test(rel) && /== O QUE AINDA E ESTIMATIVA/.test(rel), "D2e revisões, materiais e o que é estimativa");
  ok(/== POR DISCIPLINA ==/.test(rel) && /== SEMANA 1, NA ORDEM ==/.test(rel), "D2f o que já existia continua");
  /* ---- (19.73.0) S: a tela das Discursivas e a ordem do menu ---- */
  {
    const ids = api.MODOS.map((m) => m.id);
    ok(ids.slice(0, 4).join() === "edital,cartoes,discursivas,questoes" && !!api.$("secDiscursivas"), "S1 menu: edital, cartões, discursivas, questões; a seção existe");
    const e1 = api.edCriar("Com discursiva", T);
    const e2 = api.edCriar("Sem discursiva", ["# Sem | prova: " + prova + " | horas: 5", "@ A :: 3", "+ x :: 3"].join("\n"));
    api.trocarModo("discursivas");
    const txt = String(api.$("dsLista").textContent || "");
    ok(/Com discursiva/.test(txt) && /vale 40 pontos/.test(txt) && /31% da nota final/.test(txt) && /25 a 30 linhas/.test(txt) && /corrigida só para os 50 primeiros/.test(txt), "S2 o cartão do edital mostra como a discursiva pontua: " + txt.slice(0, 300));
    ok(/Treino de escrita/.test(txt) && /Nenhum treino nas últimas 4 semanas/.test(txt), "S3 treino de escrita das últimas semanas");
    ok(/Editais sem discursiva cadastrada \(1\)/.test(txt) && /Sem discursiva/.test(txt), "S4 o edital sem discursiva aparece com o atalho para cadastrar");
    const ck = api.$("dsTreino_" + e1.id);
    ck.checked = true; ck.onchange();
    ok(/Treinou em 1 das últimas 4 semanas/.test(String(api.$("dsLista").textContent || "")), "S5 marcar o treino da semana conta");
    const pr = api.dsPromptTemas(e1, api.dsDiscursivaDe(e1).dc);
    ok(/3 temas prováveis/.test(pr) && /ESPELHO DE CORREÇÃO/.test(pr) && /25 a 30 linhas/.test(pr) && /Tributário/.test(pr), "S6 o pedido de temas à IA leva o formato desta prova");
    /* ---- (19.74.0) o registro das redações ---- */
    const dc = api.dsDiscursivaDe(e1).dc;
    ok(api.dsRedacaoAdicionar(e1.id, { tema: "", nota: 10, max: 40 }).erro && api.dsRedacaoAdicionar(e1.id, { tema: "x", nota: 50, max: 40 }).erro, "S7 sem tema ou com nota acima da máxima não grava");
    const hoje = new Date();
    const dia = (k) => { const d = new Date(hoje); d.setDate(d.getDate() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    [[30, 12, 26], [24, 16, 31], [17, 18, 28], [10, 24, 27], [3, 28, 40], [0, 30, 29]].forEach(([k, nota, lin]) => api.dsRedacaoAdicionar(e1.id, { d: dia(k), tema: "Tema " + k, nota, max: 40, linhas: lin, disc: "Tributário" }));
    const rr = api.dsRedacoesResumo(e1.id, dc);
    ok(rr.n === 6 && rr.media5 === 58 && rr.tendencia === "subindo", "S8 média das últimas 5 e tendência: " + JSON.stringify(rr));
    ok(rr.abaixo === 3 && rr.fora === 2 && rr.ultima.tema === "Tema 0", "S9 abaixo do mínimo, fora do tamanho e a última: " + JSON.stringify(rr));
    ok(JSON.parse(api.loja.getItem("eac_disc_treino") || "{}")[e1.id] && Object.keys(JSON.parse(api.loja.getItem("eac_disc_treino"))[e1.id]).length >= 5, "S10 registrar a redação marca a semana como treinada");
    api.dsRender();
    const tx2 = String(api.$("dsLista").textContent || "");
    ok(/Redações escritas \(6\)/.test(tx2) && /média das últimas 5: 58%/.test(tx2) && /3 redação\(ões\) abaixo do mínimo/.test(tx2) && /2 fora do tamanho/.test(tx2), "S11 a tela mostra o histórico e os alertas");
    api.dsRedacaoApagar(e1.id, api.dsRedacoes(e1.id)[0].id);
    ok(api.dsRedacoes(e1.id).length === 5, "S12 apagar tira do registro");
    const relD = api.plRelatorio(api.montarPlano(api.lerEdital(T), { horas: 10, feitos: {} }), api.lerEdital(T), [], [], api.lerEdital(T).cfg);
    ok(/redacoes escritas: 0|redacoes escritas:/.test(relD), "S13 o Raio-X tem a linha das redações");
    const todas = [];
    Object.keys(api.BK_CHAVES).forEach((g) => api.BK_CHAVES[g].forEach((k) => todas.push(k)));
    ok(["eac_disc_treino", "eac_disc_redacoes", "eac_ed_conferencia", "eac_ag_modo", "eac_ag_meta_min", "eac_ger_pastas"].every((k) => todas.indexOf(k) >= 0), "S14 o backup leva o treino, as redações e as decisões do plano");
    /* ---- (19.75.0) a tela completa: ordem pela prova, critérios, sugestões, propostas, estratégia, edição, agenda ---- */
    const perto = (() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); })();
    const e3 = api.edCriar("Perto", ["# Perto | prova: " + perto + " | horas: 10", "# discursiva | pontos: 20 | objetiva: 80 | disciplinas: Civil", "@ Civil :: 5", "+ contratos :: 5", "+ posse :: 2"].join("\n"));
    api.dsRender();
    const ordem = [...api.$("dsLista").querySelectorAll(".ds-card")].map((c) => c.id);
    ok(ordem[0] === "dsCard_" + e3.id && ordem.indexOf("dsCard_" + e1.id) > 0, "S15 a prova mais próxima vem primeiro: " + ordem.join());
    const tx3 = String(api.$("dsLista").textContent || "");
    ok(/Próxima discursiva: Perto, em 10 dia/.test(tx3) && /faltam 10 dia/.test(tx3), "S16 o topo e o cartão dizem quanto falta");
    ok(/Critérios e cortes deste edital/.test(tx3) && /Corte da discursiva: 50% = 20 de 40 pontos/.test(tx3) && /Específicos: mínimo 50%/.test(tx3), "S17 critérios e cortes, com o corte em pontos e o do bloco");
    ok(/Como a discursiva é corrigida/.test(tx3) && /Estratégia — Intensivo|Estratégia — Construção/.test(tx3) && /Estratégia — Reta final/.test(tx3), "S18 critérios de correção e a estratégia por fase");
    const crit = api.dsCriterios(dc).map((c) => c.k).join();
    ok(crit === "conteudo,estrutura,lingua,tamanho,zero,corte,corrigida", "S19 os critérios levam o corte e o 'só os N primeiros': " + crit);
    const cortes = api.dsCortes(api.montarPlano(r, { horas: 10, feitos: {} }), dc);
    ok(cortes.length === 1 && cortes[0].nome === "Tributário" && cortes[0].naDisc === 100 && cortes[0].bloco && cortes[0].bloco.minPct === 50, "S20 a disciplina da discursiva com o corte do bloco: " + JSON.stringify(cortes));
    /* sugestões: o peso manda; o que já foi escrito ou guardado vai para o fim */
    const plE1 = api.montarPlano(api.lerEdital(e1.texto), { horas: 10, feitos: {} });
    const sug = api.dsSugerirTemas(e1, plE1, dc, null, 6);
    ok(sug.length === 2 && sug[0].topico === "a" && sug[0].disc === "Tributário", "S21 temas sugeridos pelo peso no edital: " + JSON.stringify(sug.map((s) => s.topico)));
    const prop = api.dsPromptProposta(e1, dc, null, sug.map((s) => s.topico), 3);
    ok(/TEMA:/.test(prop) && /ENUNCIADO:/.test(prop) && /ESPELHO:/.test(prop) && /25 a 30 linhas/.test(prop) && /- a\n- b/.test(prop) && /50 primeiros/.test(prop), "S22 o pedido à IA leva o formato da prova e os temas");
    const resp = "Aqui estão:\n\n**1. TEMA:** Lançamento tributário\n**DISCIPLINA:** tributario\n**ENUNCIADO:** Disserte sobre o lançamento.\nAborde: 1) conceito; 2) modalidades.\n**ESPELHO:** conceito 20; modalidades 20.\n\nTEMA: a\nDisciplina: Tributário\nEnunciado: Explique a.\nEspelho: x 40";
    const lidas = api.dsPropostasLer(resp, dc.disciplinas);
    ok(lidas.length === 2 && lidas[0].tema === "Lançamento tributário" && lidas[0].disc === "Tributário" && /modalidades\./.test(lidas[0].enunciado) && /conceito 20/.test(lidas[0].espelho), "S23 a resposta colada vira propostas: " + JSON.stringify(lidas[0]));
    lidas.forEach((p) => api.dsPropostaAdicionar(e1.id, Object.assign({ fonte: "ia" }, p)));
    ok(api.dsPropostas(e1.id).length === 2 && !!api.dsPropostaAdicionar(e1.id, lidas[0]).erro && !!api.dsPropostaAdicionar(e1.id, { tema: "" }).erro, "S24 guarda, recusa repetida e sem tema");
    const sug2 = api.dsSugerirTemas(e1, plE1, dc, null, 6);
    ok(sug2[0].topico === "b" && sug2[1].treinado === true, "S25 o tema já guardado vai para o fim: " + JSON.stringify(sug2.map((s) => s.topico + ":" + s.treinado)));
    ok(api.dsProximoTema(e1, plE1, dc).proposta === true, "S26 o próximo tema é a proposta aberta");
    api.dsRedacaoAdicionar(e1.id, { tema: "a", nota: 30, max: 40, linhas: 27 });
    ok(api.dsPropostas(e1.id).find((p) => p.tema === "a").escrita === true && api.dsFeitasSemana(e1.id) >= 1, "S27 registrar a redação marca a proposta como escrita e conta na semana");
    /* a estratégia pela distância da prova */
    const fz = [200, 90, 40, 10, -1, null].map((d) => { const x = api.dsEstrategia(d, { n: 3, media5: 80, minPct: 50 }, {}); return x.fase + ":" + x.meta; }).join();
    ok(fz === "fundacao:1,construcao:2,intensivo:3,reta:2,passou:0,sem_data:1", "S28 fases e metas: " + fz);
    const ab = api.dsEstrategia(40, { n: 4, media5: 45, minPct: 50, fora: 1, tendencia: "caindo" }, { corrigida: 50 });
    ok(ab.meta === 4 && ab.ajustes.length === 4 && ab.passos.length === 6, "S29 abaixo do corte sobe a meta e explica: " + JSON.stringify(ab.ajustes));
    /* editar a discursiva do edital por aqui */
    ok(!!api.dsDiscursivaGravar(e2.id, { pontos: 0, disciplinas: ["A"] }).erro && !!api.dsDiscursivaGravar(e2.id, { pontos: 30, disciplinas: [] }).erro
      && !!api.dsDiscursivaGravar(e2.id, { pontos: 30, minimo: { tipo: "abs", valor: 40 }, disciplinas: ["A"] }).erro, "S30 a edição valida pontos, disciplinas e mínimo");
    const g = api.dsDiscursivaGravar(e2.id, { pontos: 30, objetiva: 70, minimo: { tipo: "pct", valor: 40 }, linhas: { min: 20, max: 30 }, corrigida: 0, disciplinas: ["A"] });
    const d2 = api.dsDiscursivaDe(e2).dc;
    ok(g.ok && d2 && d2.pontos === 30 && d2.minimo.valor === 40 && d2.linhas.max === 30 && d2.disciplinas.join() === "A" && api.lerEdital(g.novo).disciplinas[0].topicos.length === 1, "S31 gravou a linha da discursiva sem mexer nos tópicos: " + g.novo);
    const g2 = api.dsDiscursivaGravar(e2.id, { pontos: 35, minimo: { tipo: "pct", valor: 40 }, disciplinas: ["A"] });
    ok((g2.novo.match(/# discursiva/g) || []).length === 1 && /pontos: 35/.test(g2.novo), "S32 atualizar troca a linha, não duplica");
    const g3 = api.dsDiscursivaGravar(e2.id, null);
    ok(g3.ok && !/discursiva/.test(g3.novo) && !api.dsDiscursivaDe(e2).dc, "S33 tirar a discursiva");
    /* a agenda: meta da fase, próximo tema e o atalho para cá */
    try { api.hubPintarAgenda(); } catch (err) {}
    const ag = api.$("hubDiscTreino_" + e3.id) || api.$("hubDiscTreino_" + e1.id);
    ok(!ag || (/redação\(ões\) esta semana|meta da semana cumprida/.test(ag.textContent) && !!(api.$("btnHubDisc_" + e3.id) || api.$("btnHubDisc_" + e1.id))), "S34 a agenda mostra a meta e o atalho: " + (ag ? ag.textContent : "(agenda sem editais ativos no teste)"));
    const todas2 = [];
    Object.keys(api.BK_CHAVES).forEach((gk) => api.BK_CHAVES[gk].forEach((k) => todas2.push(k)));
    ok(todas2.indexOf("eac_disc_propostas") >= 0, "S35 o backup leva as propostas");
    const relE = api.plRelatorio(plE1, api.lerEdital(e1.texto), [], [], api.lerEdital(e1.texto).cfg, e1.id);
    ok(/estrategia da discursiva: fase/.test(relE) || /estrategia da discursiva/.test(api.plRelatorioDiagnostico(plE1, api.lerEdital(e1.texto), e1.id)), "S36 o Raio-X leva a estratégia e as propostas");
    api.edApagar(e1.id); api.edApagar(e2.id); api.edApagar(e3.id);
  }
  /* ---- (19.76.0) F: a discursiva em DATA PRÓPRIA (fase 2, como na SEFAZ-AL) ---- */
  {
    const em = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
    const TF = ["# Sefaz | prova: " + em(45) + " | horas: 40", "# fase 2: Discursivas | prova: " + em(66) + " | horas: 40",
      "@ Tributário :: 5", "+ ICMS :: 5 :: cai sempre !d", "+ Taxas :: 2", "@ Contabilidade :: 4", "+ Balanço :: 4 :: !d", "@ Português :: 3", "+ Crase :: 3"].join("\n");
    const ef = api.edCriar("Sefaz F2", TF);
    const x = api.dsDiscursivaDe(ef);
    ok(x.dc && x.dc.semFormato && x.dc.disciplinas.join() === "Tributário,Contabilidade" && x.dc.fase2 && x.dc.fase2.prova === em(66), "F1 a fase 2 conta como discursiva, com as disciplinas dos tópicos !d: " + JSON.stringify(x.dc));
    const sd = api.dsDiasProva(ef);
    ok(sd.dias === 66 && sd.separada && sd.diasObjetiva === 45, "F2 os dias contam até a discursiva, não até a objetiva: " + JSON.stringify(sd));
    api.dsRender();
    const txF = String(api.$("dsLista").textContent || "");
    ok(/Sefaz F2/.test(txF) && !/Editais sem discursiva cadastrada \(\d+\)[\s\S]*Sefaz F2/.test(txF) && /faltam 66 dia/.test(txF) && /a objetiva vem antes/.test(txF) && /pontos, linhas e mínimo a cadastrar/.test(txF), "F3 a tela mostra a data própria e pede o formato");
    const es = api.dsEstrategia(66, { n: 0 }, x.dc, sd);
    ok(es.fase === "construcao" && es.meta === 1 && /depois da objetiva/.test(es.ajustes[0]), "F4 com a objetiva antes, 1 redação por semana: " + JSON.stringify([es.meta, es.ajustes[0]]));
    /* gravar o formato: a linha "# discursiva" entra sem mexer na fase 2 nem nos pesos da objetiva */
    const antes = api.montarPlano(api.lerEdital(ef.texto), { horas: 40, feitos: {} });
    const g = api.dsDiscursivaGravar(ef.id, { pontos: 60, objetiva: 100, minimo: { tipo: "pct", valor: 50 }, linhas: { min: 20, max: 30 }, disciplinas: ["Tributário", "Contabilidade"] });
    const rf = api.lerEdital(g.novo);
    const depois = api.montarPlano(rf, { horas: 40, feitos: {} });
    ok(g.ok && rf.cfg.fase2 && rf.cfg.fase2.prova === em(66) && rf.cfg.discursiva.pontos === 60, "F5 o formato grava e a data da fase 2 fica: " + g.novo.split("\n").slice(0, 3).join(" / "));
    ok(JSON.stringify(antes.fatia) === JSON.stringify(depois.fatia) && !depois.discursiva, "F6 com data própria, a discursiva não mexe nos pesos da objetiva: " + JSON.stringify([antes.fatia, depois.fatia]));
    /* pedidos à IA */
    const rev = api.edPromptRevisao(g.novo, []);
    ok(/DATA PRÓPRIA/.test(rev) && new RegExp(em(66).split("-").reverse().join("/")).test(rev) && /mantenha a linha “# fase 2”/i.test(rev), "F7 a revisão com IA mantém a data própria e a linha da discursiva");
    const rev0 = api.edPromptRevisao(TF, []);
    ok(/MANTENHA a linha “# fase 2”/.test(rev0) && /SEM data/.test(rev0) && /"!d"/.test(rev0), "F8 sem o formato, a revisão pede só o formato, sem data");
    const sp = api.edPromptSoPesos(g.novo);
    ok(/# fase 2: Discursivas/.test(sp) && /DATA PRÓPRIA/.test(sp), "F9 o pedido só de pesos leva a fase 2 e a regra");
    const cria = api.edPromptEdital(false, "", { tem: false });
    ok(/escreva AS DUAS linhas/.test(cria) && /A DATA da discursiva vai SÓ nesta linha da fase 2/.test(cria), "F10 a criação com IA explica as duas linhas");
    const novo = api.hubNovoTexto({ nome: "Novo", prova: em(45), horas: 30, plano: "# Novo | prova: " + em(45) + "\n# fase 2: discursiva | prova: " + em(66) + " | horas: 30\n# discursiva | pontos: 60\n@ A :: 3\n+ x :: 3 :: !d" });
    ok(/# fase 2: discursiva \| prova: /.test(novo) && /# discursiva \| pontos: 60/.test(novo), "F11 montar o plano novo guarda a data da fase 2 que a IA achou: " + novo.split("\n").slice(0, 3).join(" / "));
    const ctxF = { e: ef, r: rf, s: { prova: em(45), dias: 45 }, cfg: rf.cfg, plano: depois };
    ok(/Discursiva em data própria/.test(api.hubRitmoPromptIA(ctxF)) && /Até a objetiva, o plano é só o da objetiva/.test(api.hubRitmoPromptIA(ctxF)), "F12 a opinião da IA sobre o ritmo sabe da data própria");
    api.edApagar(ef.id);
  }
  /* ---- (19.78.0) MP: o mapa compacto na agenda, na disciplina, nas discursivas e no Raio-X ---- */
  {
    const dia = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const diario = [
      { d: dia(1), m: 90, a: "feito", disc: "Tributário", n: "a" }, { d: dia(8), m: 30, a: "feito", disc: "Tributário", n: "b" },
      { d: dia(20), m: 240, a: "feito", disc: "Administrativo", n: "c" }, { d: dia(2), m: 50, a: "pendente", disc: "Tributário", n: "x" },
    ];
    api.diarioPor(diario);
    const M5 = api.mpMapaDoDiario(5, null, 600, 5);
    const box = api.mpMini(M5);
    const cels = box.querySelectorAll(".mp-mini-cel"), tots = box.querySelectorAll(".mp-mini-tot");
    ok(cels.length === 35 && tots.length === 5 && /%/.test(tots[1].textContent), "MP1 o mapa compacto: 5 semanas × 7 dias, total com % da meta");
    const Mt = api.mpMapaDoDiario(8, (x) => x.disc === "Tributário");
    ok(Mt.semanas.reduce((a, s) => a + s.totalMin, 0) === 120 && Mt.semanas.every((s) => s.pct === null), "MP2 filtrado por disciplina: só ela, sem meta (pendente não conta)");
    const rs = api.dscMapaResumo("Tributário", diario);
    ok(rs.ultimo === dia(1) && rs.dias === 1 && rs.min28 === 120 && api.dscMapaResumo("Português", diario).ultimo === null, "MP3 o último estudo da disciplina e as horas em 4 semanas: " + JSON.stringify(rs));
    /* discursivas: a redação aparece no dia, com a cor da nota contra o corte */
    const ed = api.edCriar("MP disc", T);
    api.dsRedacaoAdicionar(ed.id, { d: dia(0), tema: "x", nota: 18, max: 40 });
    api.dsRender();
    const card = api.$("dsCard_" + ed.id);
    const cel = [...card.querySelectorAll(".mp-mini-cel")].find((c) => c.textContent === "45%");
    ok(!!cel && /ds-mp-ruim/.test(cel.className) && /1 redação/.test(card.textContent), "MP4 nas discursivas, a redação de 45% fica vermelha (corte 50%) e a semana conta 1 redação");
    const rel = api.plRelatorio(api.montarPlano(api.lerEdital(T), { horas: 10, feitos: {} }), api.lerEdital(T), [], [], api.lerEdital(T).cfg);
    ok(/== PADRAO SEMANAL/.test(rel) && /Tributário 90/.test(rel) && /por dia da semana \(soma\)/.test(rel) && /leitura: media/.test(rel), "MP5 o Raio-X leva o padrão semanal");
    api.edApagar(ed.id);
    api.diarioPor([]);
  }
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
