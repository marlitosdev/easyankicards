/* =====================================================================
 * REVISÃO DA RETA FINAL (19.172.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  G. só os grifos: o leitor esconde o bloco sem marca, mantém títulos e o cabeçalho da tabela; sem grifo, sem botão;
 *     nada muda no texto do resumo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);

  /* ---------------- G: só os grifos ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["## Conectivos", "", "Texto sem marca nenhuma.", "", "Aqui tem ==!o que importa== no meio.", "",
      "- item comum", "- item com ==?dúvida==", "", "| A | B |", "|---|---|", "| 1 | 2 |", "| ==3== | 4 |"].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    const b = api.$("btnMatSoGrifos");
    ok(b && !b.hidden && /só grifos \(3\)/.test(b.textContent), "G1 o botão diz quantos grifos há: " + (b && b.textContent));
    api.matSoGrifosAlternar(true);
    const L = api.$("matLeitura");
    const visiveis = (sel) => L.querySelectorAll(sel).filter((el) => !/mat-sg-fora/.test(el.className || "")).map((el) => el.textContent.trim());
    ok(/mat-so-grifos/.test(L.className), "G2 a leitura entra no modo só grifos");
    ok(visiveis("p").join("|") === "Aqui tem o que importa no meio.", "G3 só o parágrafo com marca fica: " + visiveis("p").join("|"));
    ok(visiveis("li").join("|") === "item com dúvida", "G4 só o item com marca fica: " + visiveis("li").join("|"));
    ok(visiveis("tr").length === 2 && /A/.test(visiveis("tr")[0]), "G5 a linha marcada fica, com o cabeçalho da tabela: " + visiveis("tr").join("|"));
    ok(L.querySelectorAll("h1, h2, h3, h4, h5").some((h) => /Conectivos/.test(h.textContent) && !/mat-sg-fora/.test(h.className || "")), "G6 o título fica");
    ok(/mostrar tudo/.test(api.$("btnMatSoGrifos").textContent) && api.$("btnMatSoGrifos").getAttribute("aria-pressed") === "true", "G7 o botão vira 'mostrar tudo'");
    ok(api.matObter(ch).texto === TXT, "G8 o texto do resumo não muda");
    api.matSoGrifosAlternar(false);
    ok(!/mat-so-grifos/.test(L.className) && L.querySelectorAll("p").every((el) => !/mat-sg-fora/.test(el.className || "")), "G9 desligado, tudo volta");
    const ch2 = api.matChave("Português", "Sem marca");
    api.matGravar(ch2, "Só texto." + NL + NL + "Mais texto.", { disciplina: "Português", topico: "Sem marca" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Sem marca" }, "ler");
    ok(api.$("btnMatSoGrifos").hidden, "G10 sem grifo nenhum, sem botão");
    ["mat_sg", "mat_sg_on", "mat_sg_tip"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "G11 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- C: caderno de erros e chutes ---------------- */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const T = (d, acertou, chute) => Object.assign({ q: "2026-11-" + d + "T10:00:00Z", resp: "C", acertou }, chute ? { chute: true } : {});
    api.qsBancoPor([
      { id: "e1", enunciado: "Errou e nunca mais respondeu", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T1", chave: "d›t1", tentativas: [T("01", false)], dica: "Prazo é de 5 dias, não 10." },
      { id: "c1", enunciado: "Acertou no chute", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T1", chave: "d›t1", tentativas: [T("01", true, true)] },
      { id: "u1", enunciado: "Errou e acertou uma vez", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T2", chave: "d›t2", tentativas: [T("01", false), T("02", true)], dica: "Imunidade não é isenção." },
      { id: "d2", enunciado: "Errou e acertou duas vezes", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T2", chave: "d›t2", tentativas: [T("01", false), T("02", true), T("03", true)] },
      { id: "k1", enunciado: "Sempre certa", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T2", chave: "d›t2", tentativas: [T("01", true)] },
    ]);
    const est = (id) => api.qsCadernoEstado(api.qsTodas().filter((q) => q.id === id)[0]);
    ok(est("e1").dentro && est("e1").errou && est("c1").dentro && est("c1").chute && est("u1").dentro && est("u1").seguidos === 1,
      "C1 entra quem errou ou chutou; um acerto só depois ainda não basta");
    ok(!est("d2").dentro && est("d2").motivo === "dominada" && !est("k1").dentro && est("k1").motivo === "nunca", "C2 dois acertos seguidos sem chute: dominada; quem nunca errou, nunca entrou");
    ok(api.qsFiltrar({ caderno: true }).map((q) => q.id).join() === "e1,c1,u1", "C3 o filtro do caderno");
    api.qsCadernoTirar("u1");
    ok(!est("u1").dentro && est("u1").motivo === "tirada", "C4 tirar à mão");
    api.qsTodas().filter((q) => q.id === "u1")[0].tentativas.push({ q: "2099-01-01T10:00:00Z", resp: "E", acertou: false });
    ok(est("u1").dentro, "C5 errou de novo depois de tirar: volta");
    const g = api.qsBizu(api.qsFiltrar({ caderno: true }));
    ok(g.length === 2 && g[0].topico === "T1" && g[0].itens[0].dica === "Prazo é de 5 dias, não 10." && /Imunidade/.test(api.qsBizuTexto(g)), "C6 o bizu: só as dicas, por tópico: " + JSON.stringify(g.map((x) => [x.topico, x.itens.length])));
    /* a aba */
    api.qsUiRender();
    ok(!api.$("qsCaderno").hidden && /caderno de erros e chutes \(3\)/.test(api.$("btnQsCaderno").textContent), "C7 o atalho com a contagem: " + api.$("btnQsCaderno").textContent);
    ok(!api.$("btnQsBizu").hidden && /bizu \(2\)/.test(api.$("btnQsBizu").textContent), "C8 o bizu com quantas dicas: " + api.$("btnQsBizu").textContent);
    api.qsUiCadernoAbrir();
    ok(api.qsUiFiltroAtual().caderno && api.$("qsFCaderno").checked && /3/.test(api.$("qsResumo").textContent.split(" ")[0] || api.$("qsResumo").textContent), "C9 o atalho liga o filtro (e a caixa do painel): " + api.$("qsResumo").textContent);
    ok(api.$("btnQsCadTirar_e1") && /tirar do caderno/.test(api.$("btnQsCadTirar_e1").textContent), "C10 na lista do caderno, cada uma com 'tirar do caderno'");
    api.$("btnQsCadTirar_e1").onclick();
    ok(!est("e1").dentro && !api.$("qsLista").querySelectorAll("button").some((b) => b.id === "btnQsCadTirar_e1"), "C11 tirar pela lista");
    api.qsUiBizuAlternar();
    ok(!api.$("qsBizu").hidden && /Imunidade/.test(api.$("qsBizu").textContent) && !/Prazo/.test(api.$("qsBizu").textContent), "C12 o bizu aberto, só do que está no caderno: " + api.$("qsBizu").textContent.slice(0, 160));
    api.qsUiCadernoAbrir();
    ok(!api.qsUiFiltroAtual().caderno, "C13 o mesmo atalho desliga");
    /* o gabarito */
    const qc = api.qsTodas().filter((q) => q.id === "c1")[0];
    api.qsUiResponderAbrir([qc], "aba", "cad-1");
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(api.$("btnQsCadTirarGab") && est("c1").dentro, "C14 acertou limpo uma do caderno: oferece 'tirar do caderno'");
    /* o segundo acerto limpo seguido (outra questão já com um acerto limpo depois do chute) */
    api.qsTodas().push({ id: "c2", enunciado: "Chutou e depois acertou uma vez", gabarito: "C", tipo: "ce", disciplina: "D", topico: "T1", chave: "d›t1", tentativas: [T("01", true, true), T("02", true)] });
    const qc2 = api.qsTodas().filter((q) => q.id === "c2")[0];
    api.qsUiResponderAbrir([qc2], "aba", "cad-2");
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(api.$("qsCadDominada") && /dominada/.test(api.$("qsCadDominada").textContent) && !est("c2").dentro, "C15 o segundo acerto limpo seguido: dominada, saiu");
    const qk = api.qsTodas().filter((q) => q.id === "k1")[0];
    api.qsUiResponderAbrir([qk], "aba", "cad-3");
    api.qsResponder("E"); api.qsUiPintarSessao();
    ok(api.$("qsCadEntrou") && est("k1").dentro, "C16 errou: avisa que foi para o caderno");
    ["qs_so_caderno", "qs_cad_btn", "qs_cad_btn_on", "qs_cad_tirar", "qs_cad_dominada", "qs_cad_entrou", "qs_bizu_btn", "qs_bizu_copiar", "qs_cad_seguidos"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "C17 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- M: a marca que atravessa itens de lista (o "consertar marcação" falso) ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const L0 = "* **Teste da Conjunção Integrante:** substitui-se toda a oração por **ISSO** (*Espero que você passe* → *Espero ISSO*).";
    const L1 = "* **Teste do Pronome Relativo:** substitui-se o vocábulo *que* por **o qual** (*O livro que li* → *O livro o qual li*).";
    const T = ["Intro.", "", L0, L1].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, T, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.$("matTexto").value = T;
    api.matPorSelecao("(Espero que você passe → Espero ISSO)." + NL + "Teste do Pronome Relativo: substitui-se o vocábulo que por o qual (O livro que li → O livro o qual li).");
    api.matMarcarSelecao("d");
    const l2 = api.$("matTexto").value.split(NL)[3];
    ok(/^\* == \*\*Teste do Pronome/.test(l2) && !api.matLinhaTorta(l2), "M1 a seleção que atravessa itens põe a marca DEPOIS do '* ': " + l2.slice(0, 40));
    const torta = "== * **Exceções:** Nem todo *que* é pronome; o *que* é **conjunção integrante**.==";
    const cs = api.matConsertarLinha(torta);
    ok(api.matLinhaTorta(torta) && cs.nova === "* == **Exceções:** Nem todo *que* é pronome; o *que* é **conjunção integrante**.==" && /marca_depois_da_lista/.test(cs.motivo) && !api.matLinhaTorta(cs.nova),
      "M2 o conserto da linha já gravada assim: só a marca muda de lugar, o negrito fica: " + cs.nova);
    ok(!api.matLinhaTorta("==* **1. (FGV) Pergunta?** A) Sim.==") && api.matConsertarLinha("==~ - item com pegadinha==").nova === "- ==~ item com pegadinha==",
      "M3 a marca de prova sobre negrito não é lista; a marca de pegadinha antes do '- ' vai para depois");
  }

  /* ---------------- L: lei, ler só os que caem / só onde erro ---------------- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const LEI = ["TÍTULO I — Disposições Gerais", "Art. 1º Preâmbulo.", "Art. 2º O sistema é regido pela Constituição.",
      "Art. 3º Tributo é prestação compulsória.", "CAPÍTULO I — Da Receita", "Art. 4º A natureza jurídica do tributo.",
      "Art. 5º A receita pública.", "Art. 6º A despesa pública."].join(NL);
    const ch = api.matChave("Direito Tributário", "Sistema tributário");
    api.matGravar(ch, "Resumo.", { disciplina: "Direito Tributário", topico: "Sistema tributário" });
    const l = api.leiGuardar({ id: "lei_v", nome: "Lei V", texto: LEI });
    api.leiAbrir("Direito Tributário", "Sistema tributário", l.id);
    api.leiTrocarModo("ler");
    ok(api.$("leiVer").hidden, "L1 sem questão citando a lei, sem o seletor");
    api.qsAplicar([
      { tipo: "ce", enunciado: "Nos termos do art. 4º, o tributo se define pela destinação.", gabarito: "C", comentario: "", chave: ch },
      { tipo: "ce", enunciado: "O art. 4º trata da natureza do tributo.", gabarito: "E", comentario: "", chave: ch },
      { tipo: "ce", enunciado: "Segundo o art. 5º, a receita pública é ingresso.", gabarito: "C", comentario: "", chave: ch },
    ]);
    api.qsTodas().slice(0, 2).forEach((q) => { q.tentativas = [{ acertou: false }]; });
    api.qsTodas()[2].tentativas = [{ acertou: true }];
    api.leiPintarLeitura();
    ok(!api.$("leiVer").hidden && /só os que caem \(2\)/.test(api.$("btnLeiVerCaem").textContent) && /só onde erro \(1\)/.test(api.$("btnLeiVerErro").textContent),
      "L2 o seletor com as contagens: " + api.$("btnLeiVerCaem").textContent + " | " + api.$("btnLeiVerErro").textContent);
    const L = api.$("leiLeitura");
    const arts = () => L.querySelectorAll(".lei-art");
    const comCl = (re) => arts().filter((a) => re.test(a.className)).length;
    ok(comCl(/lei-art-q/) === 2 && comCl(/lei-art-erro/) === 1, "L3 cada artigo sabe se cai e se você erra");
    api.$("btnLeiVerCaem").onclick();
    ok(api.leiVerAtual() === "caem" && /lei-ver-caem/.test(L.className) && api.$("btnLeiVerCaem").getAttribute("aria-pressed") === "true", "L4 só os que caem: a leitura muda de classe (o CSS esconde os outros)");
    const tits = L.querySelectorAll(".lei-div");
    const fica = tits.filter((h) => /lei-ver-tit/.test(h.className)).map((h) => h.textContent);
    ok(fica.length === 1 && /CAPÍTULO I/.test(fica[0]), "L5 fica o título que encabeça um artigo mostrado; o vazio some: " + fica.join("|"));
    api.$("btnLeiVerErro").onclick();
    ok(/lei-ver-erro/.test(L.className) && !/lei-ver-caem/.test(L.className), "L6 só onde erro");
    api.leiPintarLeitura();
    ok(/lei-ver-erro/.test(L.className), "L7 repintar a leitura mantém o filtro");
    api.$("btnLeiVerTudo").onclick();
    ok(!/lei-ver-/.test(L.className), "L8 lei inteira");
    api.leiTrocarModo("editar");
    ok(api.$("leiVer").hidden, "L9 no modo editar, o seletor some");
    ["lei_ver_tudo", "lei_ver_caem", "lei_ver_erro", "lei_ver_tip"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "L10 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- R: Revisão 360° ---------------- */
  {
    const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    const texto = (dias) => ["# Reta | prova: " + daqui(dias) + " | horas: 10",
      "& Bloco | minimo: 50%",
      "@ A :: 5", "+ Tema um :: 5", "+ Tema dois :: 5", "+ Tema quatro :: 4", "+ Tema cinco :: 4",
      "@ B :: 2", "+ Tema três :: 3", "+ Tema seis :: 2"].join(NL);
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    const e = api.edCriar("Reta", texto(11));
    ok(api.rvElegivel(e).ok && api.rvElegivel(e).dias === 11 && !api.rvElegivel(api.edCriar("Longe", texto(20))).ok, "R1 a 15 dias ou menos, sim; a 20, não");
    /* o estudado (Tema um), difícil por você; material: resumo com grifo no Tema um, questões no Tema dois */
    const pl0 = api.montarPlano(api.lerEdital(e.texto), { horas: 10, prova: daqui(11), feitos: {} });
    const it = (nome) => pl0.itens.filter((i) => i.nome === nome)[0];
    e.progresso = {}; e.progresso[it("Tema um").chave] = { e: "feito", d: daqui(-5) };
    api.edSalvarLista();
    api.difDefinir("A", "Tema um", "alta", "declarada");
    api.matGravar(api.matChave("A", "Tema um"), "Texto com ==!o ponto== e mais.", { disciplina: "A", topico: "Tema um" });
    api.qsBancoPor([{ id: "q1", enunciado: "x", gabarito: "C", tipo: "ce", disciplina: "A", topico: "Tema dois", chave: api.matChave("A", "Tema dois") }]);
    const p = api.rvMontar(e, { minDia: 120 });
    const todos = [];
    p.dias.forEach((d) => d.blocos.forEach((b) => todos.push(b)));
    const itens = [];
    todos.forEach((b) => b.itens.forEach((x) => itens.push(x)));
    const um = itens.filter((x) => x.topico === "Tema um");
    ok(p && p.vespera === daqui(10) && p.dias.every((d) => d.data < p.vespera), "R2 os blocos vão até a antevéspera; a véspera é leve: " + p.vespera);
    ok(um.length === 2 && um[0].tipo === "rev" && um[0].dificil && um.some((x) => x.passada === 2) && um[0].grifos === 1, "R3 o estudado difícil: revisão com 🔥 e segunda passada, sabendo dos grifos: " + JSON.stringify(um.map((x) => [x.tipo, x.passada, x.dificil])));
    const dois = itens.filter((x) => x.topico === "Tema dois")[0], tres = itens.filter((x) => x.topico === "Tema três")[0];
    ok(dois && dois.tipo === "novo" && dois.qs === 1 && tres && tres.tipo === "fonte", "R4 lacuna com questão: primeiro contato; sem material: estude pela fonte");
    ok(todos.every((b) => b.itens.every((x) => x.disciplina === b.disciplina)) && todos.every((b) => b.minutos <= 95 || b.itens.length === 1), "R5 cada bloco é UMA disciplina, de até ~1h30");
    ok(p.resumo.revisoes === 1 && p.resumo.pctDepois > p.resumo.pctAntes && p.resumo.dificeis === 1 && p.discs.A.dificeis === 1, "R6 o resumo: revisões, difíceis e a cobertura antes → depois: " + JSON.stringify(p.resumo));
    /* orçamento curto: o piso das disciplinas abaixo do mínimo entra antes do peso */
    const curta = api.edCriar("Curta", texto(3));
    const pc = api.rvMontar(curta, { minDia: 60 });
    const novosC = []; pc.dias.forEach((d) => d.blocos.forEach((b) => b.itens.forEach((x) => { if (x.tipo !== "rev") novosC.push(x); })));
    ok(novosC.some((x) => x.topico === "Tema seis" && x.piso) && pc.fora.some((x) => x.topico === "Tema quatro") && pc.fora.every((x) => x.topico),
      "R7 tempo curto: o piso vai em rodadas (A, depois B) antes do peso; o resto fica de fora, por nome: " + JSON.stringify(novosC.map((x) => [x.disciplina, x.topico, !!x.piso])) + " fora " + pc.fora.length);
    api.edApagar(curta.id);
    /* gravar, marcar e o estado */
    api.rvCriar(e, { minDia: 120 });
    const g = api.rvDoEdital(e.id);
    ok(g && g.criado && api.BK_CHAVES.edital.indexOf("eac_rv360") >= 0, "R8 gravado, e no backup");
    const rev1 = g.dias[0].blocos.reduce((a, b) => a.concat(b.itens), []).concat(...g.dias.map((d) => d.blocos.reduce((a, b) => a.concat(b.itens), []))).filter((x) => x.topico === "Tema um" && x.passada === 1)[0];
    ok(rev1 && !api.rvItemFeito(g, rev1, api.edDiarioAtual()), "R9 antes de marcar, não feito");
    ok(api.rvMarcarFeito(g, rev1) && api.rvItemFeito(g, rev1, api.edDiarioAtual()), "R10 '✓ revisei' é o registro da agenda (diário) e conta como feito");
    const rev2 = Object.assign({}, rev1, { passada: 2 });
    ok(!api.rvItemFeito(g, rev2, api.edDiarioAtual()), "R11 a segunda passada pede o segundo registro");
    const st = api.rvEstado(g);
    ok(st.total >= 2 && st.hoje.length >= 1 && st.atrasados.length === 0, "R12 o estado: blocos de hoje, nenhum atrasado");
    /* a agenda e a janela */
    api.hubPintarAgenda();
    ok(api.$("rvAviso") && /Revisão 360°/.test(api.$("rvAviso").textContent) && /abrir os blocos/.test(api.$("btnRvAbrir").textContent), "R13 na agenda: o andamento e 'abrir os blocos'");
    api.rvApagar(e.id);
    api.hubPintarAgenda();
    ok(/Montar Revisão 360°/.test(api.$("btnRvAbrir").textContent), "R14 sem plano: 'Montar Revisão 360°'");
    api.$("btnRvAbrir").onclick();
    ok(api.$("dlgRv360").open && /blocos/.test(api.$("rvResumo").textContent) && api.$("btnRvConfirmar"), "R15 a janela abre com a prévia e o resumo, antes de gravar");
    ok(!api.rvDoEdital(e.id), "R16 a prévia não grava nada");
    api.$("btnRvConfirmar").onclick();
    ok(api.rvDoEdital(e.id) && api.$("rvBloco_R1") && api.$("rvVespera") && api.$("rvEstado"), "R17 confirmar grava e mostra os blocos, a véspera e o estado");
    ok(api.$("rvCorpo").textContent.indexOf("🔥 difícil") >= 0, "R18 o difícil aparece sinalizado");
    ["rv_titulo", "rv_aviso_novo", "rv_aviso_em_curso", "rv_montar", "rv_resumo", "rv_selo_dificil", "rv_selo_piso", "rv_vespera", "rv_fora_tit", "rv_bt_revisei", "rv_outros_pausar"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "R19 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- F: fuga rápida ---------------- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
    let semente = 7;
    const rnd = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    const C = (d, i, p) => ({ tipo: "cartao", disciplina: d, topico: "T", frente: "frente " + i, verso: "verso " + i, peso: p });
    const M = (tipo, d, i) => ({ tipo, disciplina: d, topico: "T", texto: tipo + " " + i + " de " + d });
    const fontes = {
      cartoes: [C("Português", 1, 9), C("Tributário", 2, 8), C("Administrativo", 3, 7), C("Tributário", 4, 6)],
      marcas: [M("pegadinha", "Português", 1), M("pegadinha", "Constitucional", 2), M("pegadinha", "Contabilidade", 3), M("importante", "Informática", 4)],
      prazos: [{ tipo: "prazo", lei: "CTN", rotulo: "Art. 160", texto: "Art. 160. O prazo é de 30 (trinta) dias." }],
      dicas: [{ tipo: "dica", disciplina: "Português", topico: "T", texto: "dica pt" }, { tipo: "dica", disciplina: "Lógica", topico: "T", texto: "dica lógica" }],
    };
    const r = api.fugaSortear({ disc: "Português", rnd, fontes });
    const tipos = r.itens.map((x) => x.tipo);
    ok(r.itens.length === 5 && tipos.filter((x) => x === "cartao").length === 2 && tipos.filter((x) => x === "pegadinha").length === 2 && tipos.indexOf("prazo") >= 0,
      "F1 cinco itens: 2 cartões difíceis, 2 pegadinhas, 1 prazo: " + tipos.join());
    ok(r.itens.every((x) => x.disciplina !== "Português"), "F2 nada da disciplina de agora");
    const discCart = r.itens.filter((x) => x.tipo === "cartao").map((x) => x.disciplina);
    ok(discCart[0] !== discCart[1], "F3 os cartões vêm de disciplinas diferentes enquanto há: " + discCart.join());
    const pouco = api.fugaSortear({ disc: "Português", rnd, fontes: { cartoes: [], marcas: [M("importante", "Informática", 4)], prazos: [], dicas: fontes.dicas } });
    ok(pouco.itens.map((x) => x.tipo).join() === "importante,dica", "F4 sem pegadinha, vale o 'importante'; o que falta sai das suas dicas (fora da disciplina de agora): " + pouco.itens.map((x) => x.tipo + ":" + x.disciplina).join());
    /* as fontes reais */
    api.matGravar(api.matChave("Constitucional", "Direitos"), "Texto ==~não confunda prazo com decadência aqui== e ==!o ponto principal da aula==." + NL + "==~* **Regra:** o item marcado com a lista junto==", { disciplina: "Constitucional", topico: "Direitos" });
    const mk = api.fugaMarcas();
    ok(mk.some((x) => x.tipo === "pegadinha" && x.texto === "não confunda prazo com decadência aqui" && x.disciplina === "Constitucional") && mk.some((x) => x.tipo === "importante")
      && mk.some((x) => x.texto === "Regra: o item marcado com a lista junto"), "F5 as marcas de pegadinha e importante dos resumos, sem o '* ' e o '**': " + mk.map((x) => x.texto).join(" | "));
    api.leiGuardar({ id: "lei_f", nome: "Lei F", texto: ["Art. 1º Disposição geral.", "", "Art. 2º O recurso tem prazo de 15 (quinze) dias.", "", "Art. 3º (Revogado) O prazo de 10 dias."].join(NL) });
    const pz = api.fugaPrazos(rnd);
    ok(pz.length === 1 && /Art\. 2º/.test(pz[0].rotulo) && pz[0].lei === "Lei F", "F6 só o artigo com prazo, e não o revogado: " + JSON.stringify(pz.map((x) => x.rotulo)));
    /* a janela */
    api.fugaPintar(r);
    ok(api.$("fugaItem_0") && api.$("fugaItem_4") && !api.$("fugaItem_5"), "F7 a janela com os 5");
    const iC = r.itens.findIndex((x) => x.tipo === "cartao");
    const verso = api.$("fugaItem_" + iC).querySelectorAll("div").filter((d) => /fuga-verso/.test(d.className))[0];
    ok(verso && verso.hidden, "F8 o verso do cartão começa escondido");
    api.$("btnFugaVer_" + iC).onclick();
    ok(!verso.hidden, "F9 'ver a resposta' mostra");
    api.fugaAbrir();
    ok(api.$("dlgFuga").open && /⏱ 3:00|⏱ 2:5\d/.test(api.$("fugaRelogio").textContent), "F10 abre com o relógio de 3 minutos: " + api.$("fugaRelogio").textContent);
    api.fugaFechar();
    ok(!api.$("dlgFuga").open, "F11 voltar ao estudo fecha");
    api.fugaPintar({ itens: [] });
    ok(api.$("fugaVazia"), "F12 sem material, diz de onde ele vem");
    ["fuga_btn", "fuga_titulo", "fuga_tip", "fuga_vazia", "fuga_tipo_cartao", "fuga_tipo_prazo", "fuga_outros", "fuga_voltar", "fuga_acabou"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "F13 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- MM: o mapa do resumo ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["Os conectivos ligam termos e orações.", "",
      "## Ramo — Conjunções Coordenativas", "",
      "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, ==!contudo==.", "  - **Exceção:** ==~\"e\" com valor adversativo==", "",
      "### Testes práticos", "", "1. **Teste da Conjunção Integrante:** troca por ISSO.", "",
      "## Ramo — Conjunções Subordinadas", "", "Texto corrido do ramo, sem negrito, que é bem mais comprido do que o limite de noventa caracteres para caber no galho do mapa.", "",
      "| A | B |", "|---|---|", "| 1 | 2 |"].join(NL);
    const A = api.mmMontar(TXT, { titulo: "Conectivos", ramos: [{ nome: "Conjunções Coordenativas", peso: 5 }, { nome: "Conjunções Subordinadas", peso: 2 }] });
    const R = A.raiz;
    ok(R.label === "Conectivos" && R.filhos.length === 3 && A.ramos === 2, "MM1 a raiz é o tópico; o parágrafo de abertura e os dois ramos são os primeiros galhos: " + R.filhos.map((x) => x.label).join(" | "));
    const coord = R.filhos[1];
    ok(coord.ramo && coord.label === "Conjunções Coordenativas" && coord.peso === 5, "MM2 o ramo com o nome limpo e o peso do edital");
    ok(coord.filhos.map((x) => x.label).join("|") === "Aditivas|Adversativas|Testes práticos", "MM3 os itens viram galhos pelo termo em negrito; o subtítulo também: " + coord.filhos.map((x) => x.label).join("|"));
    const adv = coord.filhos[1];
    ok(adv.det === "mas, porém, contudo." && adv.marcas.join() === "importante" && adv.filhos[0].label === "Exceção" && adv.filhos[0].marcas.join() === "pegadinha",
      "MM4 o detalhe sem sinais, as marcas pelo tipo e o item recuado como filho: " + JSON.stringify([adv.det, adv.marcas, adv.filhos[0].label, adv.filhos[0].marcas]));
    ok(coord.filhos[2].filhos[0].label === "Teste da Conjunção Integrante" && coord.filhos[2].filhos[0].linha === 10, "MM5 a lista numerada dentro do subtítulo, com a linha de origem");
    const sub = R.filhos[2];
    ok(sub.filhos.length === 1 && /…$/.test(sub.filhos[0].label) && sub.filhos[0].det.length > 0, "MM6 o parágrafo longo vira galho curto com o resto no detalhe; a tabela fica de fora: " + sub.filhos.map((x) => x.label).join("|"));
    ok(api.mmMarcasDe("==!a== e ==b== e ==*c== e ==**d**==").join() === "importante,destaque,prova", "MM7 marcas pelo tipo, sem confundir o fechamento: " + api.mmMarcasDe("==!a== e ==b== e ==*c== e ==**d**==").join());
    /* a tela */
    api.edIniciar();
    api.edCriar("Ed MM", ["# Ed MM | prova: 2099-12-01 | horas: 10", "@ Português :: 5", "+ Conectivos :: 5", "++ Conjunções Coordenativas :: 5", "++ Conjunções Subordinadas :: 2"].join(NL));
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    const b = api.$("btnMatMapa");
    ok(b && !b.hidden && /mapa/.test(b.textContent), "MM8 o botão '🗺 mapa' aparece na leitura");
    api.matMapaAlternar(true);
    ok(api.matMapaAtual() && !api.$("matMapa").hidden && api.$("matLeitura").hidden && /texto/.test(api.$("btnMatMapa").textContent), "MM9 ligado: o mapa no lugar da leitura; o botão vira '📄 texto'");
    ok(api.$("mmNo_raiz") && api.$("mmNo_l2") && /2 ramo/.test(api.$("mmResumo").textContent), "MM10 a árvore desenhada, com o resumo da contagem");
    const noPeso = api.$("mmNo_l2");
    ok(/mm-peso-alto/.test(noPeso.className) && /peso 5/.test(noPeso.textContent), "MM11 o ramo de peso 5 em destaque");
    api.$("mmTg_l2").onclick();
    ok(/mm-fechado/.test(api.$("mmNo_l2").className) && /\+3/.test(api.$("mmNo_l2").textContent), "MM12 recolher o ramo (mostra quantos galhos ficaram dentro)");
    api.$("btnMmAbrirTudo").onclick();
    ok(!/mm-fechado/.test(api.$("mmNo_l2").className), "MM13 abrir tudo");
    api.matMapaIr(5);
    ok(!api.matMapaAtual() && !api.$("matLeitura").hidden && api.$("matMapa").hidden, "MM14 tocar num galho volta ao texto");
    api.matTrocarModo("editar");
    ok(api.$("btnMatMapa").hidden, "MM15 editando, sem o botão");
    ["mm_btn", "mm_btn_on", "mm_tip", "mm_resumo", "mm_abrir_tudo", "mm_so_ramos", "mm_peso", "mm_vazio", "mm_ir_tip", "mm_marca_pegadinha"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MM16 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
