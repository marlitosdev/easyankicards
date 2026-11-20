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
    /* (19.178.0) os atalhos para o mapa: o resumo curto não tem mapa; com estrutura, o "🗺 mapa" aparece no bloco e na véspera */
    const btsRv = () => api.$("rvCorpo").querySelectorAll("button").map((b) => b.id);
    const chUm = api.matChave("A", "Tema um");
    ok(!api.mmTemMapa(chUm) && !btsRv().some((id) => /^btnRvMapa_/.test(id)) && !api.$("rvCorpo").querySelectorAll("details").some((d) => d.id === "rvVesperaMapas"),
      "MS1 o resumo de uma linha não tem mapa: nem botão no bloco, nem na véspera");
    api.matGravar(chUm, ["## Ramo — Primeiro", "- **Ponto:** ==!o ponto==", "- **Outro:** mais", "## Ramo — Segundo", "- **Último:** fim"].join(NL), { disciplina: "A", topico: "Tema um" });
    ok(api.mmTemMapa(chUm) && !api.mmTemMapa(api.matChave("A", "Tema dois")), "MS2 com estrutura, tem mapa; sem resumo, não");
    api.rvPintar();
    const idMapa = btsRv().filter((id) => /^btnRvMapa_/.test(id));
    ok(idMapa.length >= 1 && api.rvTopicosComMapa(api.rvDoEdital(e.id)).map((x) => x.topico).join() === "Tema um", "MS3 o '🗺 mapa' no item do bloco; a véspera lista o tópico uma vez só: " + idMapa.join());
    const vesp = api.$("rvCorpo").querySelectorAll("details").find((d) => d.id === "rvVesperaMapas");
    ok(vesp && /os mapas dos tópicos \(1\)/.test(vesp.textContent) && /🗺 Tema um/.test(vesp.textContent), "MS4 na véspera, os mapas dos tópicos do plano");
    ok(api.$("rvCorpo").querySelectorAll("button").some((b) => b.id === "btnRvVespImprimir" && /imprimir todos \(1\)/.test(b.textContent)), "MS4b e o '🖨 imprimir todos' deles");
    api.$("rvCorpo").querySelectorAll("button").find((b) => b.id === idMapa[0]).onclick();
    ok(!api.$("dlgRv360").open && api.matMapaAtual() && api.mmUltimoAtual().arvore.ramos === 2, "MS5 tocar fecha a revisão e abre o resumo JÁ no mapa");
    api.matMapaAlternar(false);
    api.$("btnRvAbrir").onclick();
    api.$("rvCorpo").querySelectorAll("button").find((b) => b.id === "btnRvVespMapa_0").onclick();
    ok(!api.$("dlgRv360").open && api.matMapaAtual(), "MS6 o mapa da véspera também abre direto");
    api.matMapaAlternar(false);
    /* a ficha do tópico */
    api.matAbrirFicha(Object.assign({ chave: chUm }, api.matObter(chUm)));
    const bFicha = api.$("matFichaLista").querySelectorAll("button").find((b) => b.id === "btnMatFichaMapa");
    ok(bFicha && /mapa/.test(bFicha.textContent), "MS7 o '🗺 mapa' na linha do resumo da ficha");
    bFicha.onclick();
    ok(!api.$("dlgMatFicha").open && api.matMapaAtual(), "MS8 tocar fecha a ficha e abre o mapa");
    api.matMapaAlternar(false);
    api.matGravar(api.matChave("A", "Tema dois"), "Uma linha só.", { disciplina: "A", topico: "Tema dois" });
    api.matAbrirFicha(Object.assign({ chave: api.matChave("A", "Tema dois") }, api.matObter(api.matChave("A", "Tema dois"))));
    ok(!api.$("matFichaLista").querySelectorAll("button").some((b) => b.id === "btnMatFichaMapa"), "MS9 resumo sem estrutura: a ficha não oferece mapa");
    try { api.$("dlgMatFicha").close(); } catch (x) {}
    ["mm_atalho", "mm_atalho_tip", "rv_vespera_mapas"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MS10 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    ["rv_titulo", "rv_aviso_novo", "rv_aviso_em_curso", "rv_montar", "rv_resumo", "rv_selo_dificil", "rv_selo_piso", "rv_vespera", "rv_fora_tit", "rv_bt_revisei", "rv_outros_pausar"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "R19 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- F: fuga rápida — (19.185.0) refeita; os testes moraram para tests/fuga.js ---------------- */

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
    /* (19.175.0) tentar lembrar */
    api.matMapaAlternar(true);
    api.$("btnMmTreino").onclick();
    ok(api.mmTreinoAtual() && /sair do treino/.test(api.$("btnMmTreino").textContent), "MT1 o treino liga pelo botão da barra");
    const ram = () => api.$("mmNo_l2");
    ok(/mm-fechado/.test(ram().className) && api.$("mmOc_l2") && !/Aditivas/.test(ram().textContent), "MT2 no treino o ramo aparece só pelo nome: o que há dentro fica escondido");
    api.$("mmOc_l2").onclick();
    ok(/Aditivas/.test(ram().textContent) && api.$("mmSim_l2") && api.$("mmNao_l2"), "MT3 revelar mostra os galhos de baixo e 'lembrei / não lembrei'");
    ok(api.$("mmOc_l5") && !/mas, porém/.test(api.$("mmNo_l5").textContent), "MT4 os de baixo também começam escondidos (o detalhe só depois de revelar)");
    api.$("mmOc_l5").onclick();
    ok(/mas, porém, contudo/.test(api.$("mmNo_l5").textContent), "MT5 revelado, aparece o detalhe");
    api.$("mmNao_l5").onclick();
    api.$("mmSim_l2").onclick();
    const R0 = api.mmResultados();
    const kN = Object.keys(R0).filter((k) => R0[k].v === "n"), kS = Object.keys(R0).filter((k) => R0[k].v === "s");
    ok(kN.length === 1 && /adversativas/.test(kN[0]) && /conjuncoes coordenativas/.test(kN[0]) && kS.length === 1, "MT6 o resultado guardado pelo CAMINHO do galho: " + JSON.stringify(R0));
    ok(/lembrou 1 · não lembrou 1/.test(api.$("mmPlacar").textContent) && /mm-esqueci/.test(api.$("mmNo_l5").className), "MT7 o placar e o galho não lembrado em destaque");
    ok(api.BK_CHAVES.material.indexOf("eac_mm_treino") >= 0, "MT8 o treino entra no backup");
    const esq = api.mmEsquecidos(api.mmUltimoAtual().arvore);
    const lin = api.mmCartaoLinha(esq[0].no, esq[0].pai);
    ok(lin === "Conjunções Coordenativas › Adversativas — o que é / o que diz? :: mas, porém, contudo.", "MT9 a linha do cartão leva o galho de cima: " + lin);
    api.$("btnMmTreino").onclick();
    ok(!api.mmTreinoAtual() && /mm-esqueci/.test(api.$("mmNo_l5").className) && /não lembrei/.test(api.$("mmNo_l5").textContent), "MT10 fora do treino, o não lembrado continua marcado no mapa");
    ok(api.$("btnMmCartoes") && /\(1\)/.test(api.$("btnMmCartoes").textContent), "MT11 o botão de virar cartões com a contagem");
    api.$("btnMmCartoes").onclick();
    ok(/Adversativas — o que é/.test(api.$("mcTexto").value), "MT12 o painel de cartões abre já preenchido: " + api.$("mcTexto").value.slice(0, 80));
    try { api.$("dlgMatCartoes") && api.$("dlgMatCartoes").close && api.$("dlgMatCartoes").close(); } catch (e) {}
    api.mmTreinoAlternar(true);
    api.$("btnMmRecomecar").onclick();
    ok(!Object.keys(api.mmResultados()).length, "MT13 recomeçar limpa o treino deste resumo");
    api.mmTreinoAlternar(false);
    ["mm_treino", "mm_treino_sair", "mm_oculto", "mm_lembrei", "mm_nao_lembrei", "mm_placar", "mm_cartoes", "mm_selo_esqueci", "mm_recomecar"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MT14 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    /* (19.176.0) a interface do mapa */
    ok(api.mmSemantica("Exceções constitucionais") === "peg" && api.mmSemantica("Pegadinhas comuns") === "peg" && api.mmSemantica("Como costuma cair em prova") === "prova" && api.mmSemantica("Regra") === "",
      "MI1 o tipo pelo nome: exceção/pegadinha ⚠, cai em prova 🎯; regra sem cor");
    const pr = api.mmPartirRotulo("Conjunções Subordinativas Adverbiais (Conformidade, Comparação, Finalidade)");
    ok(pr.prin === "Conjunções Subordinativas Adverbiais" && pr.par === "(Conformidade, Comparação, Finalidade)" && api.mmPartirRotulo("Regra (CF88)").par === "",
      "MI2 o parêntese do nome comprido vai menor, sem virar galho; o curto fica: " + JSON.stringify(pr));
    const RG = api.mmMontar(["# Resumo geral", "", "Um parágrafo de abertura bem comprido que explica o assunto inteiro antes dos ramos e passa dos noventa caracteres.", "", "## Ramo — Um", "- **A:** a", "", "## Ramo — Dois", "- **B:** b"].join(NL), { titulo: "Tópico" }).raiz;
    ok(RG.filhos.length === 3 && RG.filhos[0].nota && RG.filhos[1].ramo && RG.filhos[1].cor === 0 && RG.filhos[2].cor === 1,
      "MI0 '# Resumo geral' não vira galho: a abertura é nota da raiz e os ramos saem direto dela, cada um com a sua cor: " + RG.filhos.map((x) => x.label.slice(0, 20)).join(" | "));
    ok(sub.filhos[0].nota && !R.filhos[0].nota && !coord.filhos[0].nota && R.filhos[1].cor === 0 && R.filhos[2].cor === 1,
      "MI3 o parágrafo LONGO sem negrito é nota (o curto e o item com negrito, não); cada galho de primeiro nível tem a sua cor");
    api.matMapaAlternar(true);
    ok(/mm-on/.test(api.$("dlgMaterial").className), "MI4 no modo mapa, a barra de ramos sai (classe mm-on no resumo)");
    ok(/mm-nota/.test(api.$("mmNo_l14").className) && /^📝/.test(api.$("mmNo_l14").textContent) && /mm-cor-0/.test(api.$("mmNo_l2").className), "MI5 a nota discreta e a cor do ramo no desenho");
    ok(/mm-mkb-importante/.test(api.$("mmNo_l5").className), "MI6 a faixa da marca no galho marcado");
    api.$("btnMmCompacto").onclick();
    ok(api.mmCompactoAtual() && !/mas, porém/.test(api.$("mmNo_l5").textContent), "MI7 só palavras-chave: o detalhe some");
    api.$("btnMmCompacto").onclick();
    ok(api.$("btnMmSoGrifos") && /\(2\)/.test(api.$("btnMmSoGrifos").textContent), "MI8 o filtro dos grifados com a contagem: " + (api.$("btnMmSoGrifos") || {}).textContent);
    api.$("btnMmSoGrifos").onclick();
    const vis = api.$("matMapa").querySelectorAll("li").filter((x) => /mm-no/.test(x.className)).map((x) => x.id);
    ok(vis.indexOf("mmNo_l5") >= 0 && vis.indexOf("mmNo_l6") >= 0 && vis.indexOf("mmNo_l4") < 0 && vis.indexOf("mmNo_l2") >= 0, "MI9 só grifados: os marcados e o caminho até eles: " + vis.join());
    api.$("btnMmSoGrifos").onclick();
    ["mm_sem_peg", "mm_sem_prova", "mm_lido", "mm_compacto", "mm_f_grifos", "mm_f_esqueci"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MI10 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
    ok(!/mm-on/.test(api.$("dlgMaterial").className), "MI11 fora do mapa, a barra de ramos volta");
    api.matTrocarModo("editar");
    ok(api.$("btnMatMapa").hidden, "MM15 editando, sem o botão");
    ["mm_btn", "mm_btn_on", "mm_tip", "mm_resumo", "mm_abrir_tudo", "mm_so_ramos", "mm_peso", "mm_vazio", "mm_ir_tip", "mm_marca_pegadinha"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MM16 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ---------------- MA: (19.177.0) o mapa da IA, conferido no resumo e guardado com ele ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["Os conectivos ligam termos e orações.", "",
      "## Ramo — Conjunções Coordenativas", "",
      "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, ==!contudo==.", "  - **Exceção:** ==~\"e\" com valor adversativo==", "",
      "### Testes práticos", "", "1. **Teste da Conjunção Integrante:** troca por ISSO.", "",
      "## Ramo — Conjunções Subordinadas", "", "Texto corrido do ramo."].join(NL);
    const RESP = ["Claro! Aqui está o mapa:", "", "```markdown",
      "- **Conjunções Coordenativas** — ligam orações independentes",
      "  - **Aditivas** — e, nem",
      "  - **Adversativas** — mas, porém, contudo",
      "    - **Exceção:** \"e\" adversativo",
      "- **Conjunções Subordinadas**",
      "  - **Integrante** — troca por ISSO",
      "  - **Causais** — porque, visto que, em 30 dias",
      "```", "", "Espero ter ajudado!"].join(NL);
    const ped = api.mmIaPedido(TXT, "Conectivos");
    ok(/"Conectivos"/.test(ped) && /lista recuada/.test(ped) && /mas, porém, contudo\./.test(ped) && !/==/.test(ped) && /Não acrescente/.test(ped),
      "MA1 o pedido: o tópico, as regras (lista recuada, nada de fora) e o resumo sem os sinais das marcas");
    const limpo = api.mmIaLimparResposta(RESP);
    ok(limpo.split(NL).length === 7 && /^- \*\*Conjunções Coordenativas/.test(limpo) && !/Claro|Espero|```/.test(limpo),
      "MA2 da resposta fica só a lista (introdução, cerca de código e fecho saem): " + limpo.split(NL).length);
    const A = api.mmIaMontar(RESP, TXT, "Conectivos");
    const [co, su] = A.raiz.filhos;
    ok(A.nos === 7 && A.ramos === 2 && co.cor === 0 && su.cor === 1 && A.raiz.label === "Conectivos", "MA3 a árvore da lista recuada, com a cor de cada ramo: " + A.nos + "/" + A.ramos);
    const adv = co.filhos[1], exc = adv.filhos[0];
    ok(co.conferido && co.linha === 2 && adv.linha === 5 && adv.marcas.join() === "importante" && exc.linha === 6 && exc.marcas.join() === "pegadinha",
      "MA4 cada galho conferido leva à linha do resumo de onde saiu, com as SUAS marcas dela: " + JSON.stringify([co.linha, adv.linha, adv.marcas, exc.linha, exc.marcas]));
    const integ = su.filhos[0], caus = su.filhos[1];
    ok(integ.conferido && integ.linha === 10, "MA5 a palavra do galho dentro da linha também confere (Integrante → linha 10)");
    ok(caus.foraDoResumo && caus.linha === -1 && caus.numFora && caus.numFora.join() === "30", "MA6 o galho que não está no resumo fica marcado; o número que o resumo não tem também");
    ok(A.conf.total === 7 && A.conf.ok === 6 && A.conf.fora === 1 && A.conf.num === 1, "MA7 a conta da conferência: " + JSON.stringify(A.conf));
    ok(api.mmIaAchar("Adversativo", [" mas porem adversativos "]).ok && !api.mmIaAchar("Causais", [" e nem "]).ok, "MA8 plural e gênero passam; palavra ausente não");
    /* a tela */
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.matMapaAlternar(true);
    const vista = () => api.$("matMapa").querySelectorAll("button").map((b) => b.id);
    ok(vista().indexOf("btnMmIa") >= 0 && vista().indexOf("btnMmFonteIa") < 0 && /mapa com IA/.test(api.$("btnMmIa").textContent), "MA9 sem mapa da IA: só o botão de pedir; nada de alternar");
    api.$("btnMmIa").onclick();
    ok(/Cole a resposta/.test(api.$("mmIaConf").textContent) && api.$("btnMmIaUsar").disabled && api.$("btnMmIaApagar").hidden, "MA10 o diálogo abre vazio, sem poder usar");
    ok(api.$("mmIaGm_config") || api.$("mmIaGm_bt"), "MA11 o Gemini direto (ou o caminho para configurar) ao lado do copiar");
    api.$("mmIaResp").value = "Não sei fazer isso.";
    api.$("mmIaResp").oninput();
    ok(/Não achei a lista/.test(api.$("mmIaConf").textContent) && api.$("btnMmIaUsar").disabled, "MA12 resposta sem lista: avisa e não deixa usar");
    api.$("mmIaResp").value = RESP;
    api.$("mmIaResp").oninput();
    const cf = api.$("mmIaConf").textContent;
    ok(/7 galhos em 2 ramos/.test(cf) && /6 achados/.test(cf) && /1 não encontrados/.test(cf) && /1 com número/.test(cf) && !api.$("btnMmIaUsar").disabled, "MA13 a conferência antes de gravar: " + cf);
    ok(api.$("mmIaForaLista").querySelectorAll("li").map((x) => x.textContent).join("|") === "Causais", "MA14 a lista do que não se achou");
    api.$("btnMmIaUsar").onclick();
    const g = api.matObter(ch).mapaIA;
    ok(g && g.texto.split(NL).length === 7 && /^\d{4}-/.test(g.em), "MA15 o mapa fica no registro do resumo");
    ok(JSON.parse(api.matParaBackup())[ch].mapaIA, "MA16 e vai no backup");
    ok(api.mmFonteAtual() === "ia" && api.matMapaAtual() && /\|ia$/.test(api.mmChave()) && /\|ia$/.test(api.mmChaveResumo()), "MA17 usar liga o mapa da IA, com chave própria (treino e recolhidos separados)");
    const noEl = (id) => api.$("matMapa").querySelectorAll("li").find((x) => x.id === id);
    const cfM = api.$("matMapa").querySelectorAll(".mm-ia-conf")[0];
    ok(/condensado pela IA/.test(api.$("matMapa").querySelectorAll(".nota").map((x) => x.textContent).join("|")), "MA18b a contagem do topo diz que o mapa é da IA");
    ok(cfM && /6 de 7 galhos/.test(cfM.textContent) && /mm-ia-alerta/.test(cfM.className), "MA18 a conferência na barra do mapa: " + (cfM && cfM.textContent));
    const nC = noEl("mmNo_l6");
    ok(nC && /mm-ia-fora/.test(nC.className) && /não está no resumo/.test(nC.textContent), "MA19 o galho de fora tracejado, com o selo");
    ok(/mm-mkb-importante/.test(noEl("mmNo_l2").className) && /mm-cor-0/.test(noEl("mmNo_l0").className), "MA20 as marcas do resumo e a cor do ramo no mapa da IA");
    const nos = api.mmUltimoAtual().arvore;
    api.mmMarcarResultado(nos.raiz.filhos[0].filhos[1], "n");
    ok(Object.keys(api.mmResultados()).length === 1, "MA21 o treino do mapa da IA");
    api.$("btnMmFonteTexto").onclick();
    ok(api.mmFonteAtual() === "texto" && !api.$("matMapa").querySelectorAll(".mm-ia-conf").length && /\|\*$/.test(api.mmChave()) && !Object.keys(api.mmResultados()).length,
      "MA22 '📄 do resumo' volta ao mapa do texto, com o treino dele (separado)");
    ok(/refazer/.test(api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmIa").textContent), "MA23 com mapa da IA, o botão vira 'refazer'");
    api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmFonteIa").onclick();
    ok(api.mmFonteAtual() === "ia", "MA24 e '🤖 da IA' volta ao dele");
    /* editou o resumo: a conferência é refeita na hora */
    api.$("matTexto").value = TXT + NL + "- **Causais:** porque, visto que, em 30 dias.";
    api.matMapaPintar();
    ok(api.mmUltimoAtual().arvore.conf.fora === 0 && api.mmUltimoAtual().arvore.conf.num === 0 && !/mm-ia-fora/.test(noEl("mmNo_l6").className), "MA25 o resumo mudou, a conferência muda junto");
    api.matGravar(ch, TXT + NL + "Mais uma linha.", { disciplina: "Português", topico: "Conectivos" });
    ok(api.matObter(ch).mapaIA && api.matObter(ch).mapaIA.texto === g.texto, "MA26 gravar o resumo não apaga o mapa da IA");
    api.$("btnMmIa").onclick();
    ok(!api.$("btnMmIaApagar").hidden && /já tem um mapa da IA/.test(api.$("mmIaAviso").textContent), "MA27 refazer avisa que troca o mapa e oferece apagar");
    api.mmIaApagar(ch);
    ok(!api.matObter(ch).mapaIA && api.mmFonteAtual() === "texto", "MA28 apagar tira o mapa; volta o do texto");
    ok(api.mmIaGravar(api.matChave("Português", "Inexistente"), RESP) === null, "MA29 sem resumo gravado, não guarda");
    ["mm_resumo_ia", "mm_fonte_texto", "mm_fonte_ia", "mm_ia_pedir", "mm_ia_refazer", "mm_ia_conf_mapa", "mm_ia_fora", "mm_ia_num", "mm_ia_sem_linha", "mmia_titulo", "mmia_ajuda", "mmia_p",
      "mmia_copiar", "mmia_copiado", "mmia_conf", "mmia_conf_fora", "mmia_conf_num", "mmia_conf_sem_lista", "mmia_usar", "mmia_apagar", "mmia_apagar_conf", "mmia_sem_resumo", "mmia_ja_tem", "mmia_cortado"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MA30 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
  }

  /* ---------------- MC: (19.178.0) a curadoria de qualidade do mapa e o registro para pedir a avaliação ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["Os conectivos ligam termos e orações.", "",
      "## Ramo — Conjunções Coordenativas", "",
      "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, ==!contudo==.", "  - **Exceção:** \"e\" com valor adversativo", "",
      "## Ramo — Conjunções Subordinadas", "", "* **Causais:** porque, visto que."].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.matMapaAlternar(true);
    const no = (label) => { let achou = null; const ir = (x) => { if (x.label === label) achou = x; x.filhos.forEach(ir); }; ir(api.mmUltimoAtual().arvore.raiz); return achou; };
    const btn = (id) => api.$("matMapa").querySelectorAll("button").find((b) => b.id === id);
    const li = (id) => api.$("matMapa").querySelectorAll("li").find((x) => x.id === id);
    ok(btn("btnMmCuradoria") && /curadoria/.test(btn("btnMmCuradoria").textContent) && !btn("btnMmQualidade"), "MC1 o botão da curadoria na barra; sem nada marcado, sem registro");
    btn("btnMmCuradoria").onclick();
    ok(api.mmCuradoriaAtual() && btn("mmCurOk_l5") && btn("mmCurErr_l5") && btn("mmCurDuv_l5") && /faltam 7/.test(api.$("mmCurPlacar").textContent),
      "MC2 no modo curadoria, cada galho com ✓ ✗ ? e o placar: " + (api.$("mmCurPlacar") || {}).textContent);
    api.mmTreinoAlternar(true);
    ok(!api.mmCuradoriaAtual() && api.mmTreinoAtual(), "MC3 ligar o treino desliga a curadoria");
    api.mmCurAlternar(true);
    ok(api.mmCuradoriaAtual() && !api.mmTreinoAtual2(), "MC4 e ligar a curadoria desliga o treino");
    btn("mmCurOk_l4").onclick();
    api.mmCurMarcar(no("Adversativas"), "errado", "contudo não é adversativa? conferir");
    api.mmCurMarcar(no("Causais"), "duvida", "");
    const cur = api.mmCurDoMapa();
    ok(Object.keys(cur).length === 3 && cur[no("Adversativas").caminho].v === "errado" && cur[no("Adversativas").caminho].nota === "contudo não é adversativa? conferir" && cur[no("Aditivas").caminho].v === "ok",
      "MC5 o veredito guardado pelo caminho do galho, com a nota");
    ok(/✓ 1 · ✗ 1 · \? 1 · faltam 4/.test(api.$("mmCurPlacar").textContent) && /on/.test(btn("mmCurOk_l4").className), "MC6 o placar conta: " + api.$("mmCurPlacar").textContent);
    btn("mmCurOk_l4").onclick();
    ok(!api.mmCurDoMapa()[no("Aditivas").caminho], "MC7 tocar de novo no mesmo veredito desfaz");
    api.mmCurAlternar(false);
    ok(/mm-cur-errado/.test(li("mmNo_l5").className) && /✗ errado/.test(li("mmNo_l5").textContent) && /\? duvidoso/.test(li("mmNo_l10").textContent) && !btn("mmCurErr_l5"),
      "MC8 fora do modo, o veredito fica à vista no galho (sem os botões)");
    /* o registro */
    const itens = api.mmQualItens(api.mmUltimoAtual().arvore);
    ok(itens.length === 2 && itens[0].caminho === "Conjunções Coordenativas › Adversativas" && itens[0].tipos.join() === "errado" && /^Adversativas: mas, porém, contudo/.test(itens[0].trecho) && !/==/.test(itens[0].trecho),
      "MC9 o registro: os pontos com o caminho, o motivo e o trecho do resumo (sem os sinais): " + JSON.stringify(itens.map((x) => [x.caminho, x.tipos, x.trecho])));
    const ped = api.mmQualPedido(api.mmUltimoAtual().arvore, { topico: "Conectivos", disciplina: "Português" });
    ok(/QUALIDADE/.test(ped) && /"Conectivos" \(Português\)/.test(ped) && /- Conjunções Coordenativas\n  - Aditivas — e, nem/.test(ped) && /\[1\] Conjunções Coordenativas › Adversativas/.test(ped)
      && /Nota da pessoa: contudo não é adversativa/.test(ped) && /No resumo: "/.test(ped) && /CORRETO \| INCORRETO \| IMPRECISO/.test(ped) && /\[2\] Conjunções Subordinadas › Causais/.test(ped),
      "MC10 o pedido de avaliação: o mapa inteiro de contexto, os pontos numerados com nota e trecho, e o formato da resposta");
    ok(btn("btnMmQualidade") && /registro de qualidade \(2\)/.test(btn("btnMmQualidade").textContent), "MC11 com pontos, o botão do registro com a contagem");
    btn("btnMmQualidade").onclick();
    ok(api.$("dlgMmQual").open && api.$("mmQualLista").querySelectorAll(".mmq-item").length === 2 && /2 ponto/.test(api.$("mmQualSub").textContent) && /Nenhuma avaliação/.test(api.$("mmQualAvalInfo").textContent),
      "MC12 o registro abre com os pontos e sem avaliação guardada");
    ok(api.$("mmQualGm_config") || api.$("mmQualGm_bt"), "MC13 o Gemini direto (ou o caminho para configurar) ao lado do copiar");
    api.$("mmQualResp").value = "[1] INCORRETO — contudo é adversativa — gramática\n[2] CORRETO";
    api.$("btnMmQualGuardar").onclick();
    ok(api.mmQualAval() && /INCORRETO/.test(api.mmQualAval().texto) && /Avaliação guardada em/.test(api.$("mmQualAvalInfo").textContent), "MC14 a avaliação que voltou fica guardada, com a data");
    api.$("btnMmQualFechar").onclick();
    btn("btnMmQualidade").onclick();
    ok(/INCORRETO/.test(api.$("mmQualResp").value), "MC15 reabrir mostra a avaliação guardada");
    api.$("btnMmQualFechar").onclick();
    ok(api.BK_CHAVES.material.indexOf("eac_mm_curadoria") >= 0, "MC16 a curadoria e as avaliações entram no backup");
    /* o mapa da IA: a curadoria dele é separada; o aviso automático conferido como ✓ sai do registro */
    const RESP = ["- **Conjunções Coordenativas**", "  - **Aditivas** — e, nem", "  - **Adversativas** — mas, porém", "- **Conjunções Subordinadas**", "  - **Causais** — porque", "  - **Finais** — a fim de que, em 2 casos"].join(NL);
    api.mmIaGravar(ch, RESP);
    api.mmFonteDefinir("ia");
    ok(!Object.keys(api.mmCurDoMapa()).length, "MC17 o mapa da IA começa sem curadoria (a do mapa do texto é outra)");
    const itIa = api.mmQualItens(api.mmUltimoAtual().arvore);
    ok(itIa.length === 1 && itIa[0].tipos.join() === "fora,num", "MC18 no mapa da IA, os avisos automáticos entram no registro: " + JSON.stringify(itIa.map((x) => x.tipos)));
    api.mmCurMarcar(no("Finais"), "ok", "");
    ok(!api.mmQualItens(api.mmUltimoAtual().arvore).length && /Revise o mapa inteiro/.test(api.mmQualPedido(api.mmUltimoAtual().arvore, {})), "MC19 o aviso que você conferiu (✓) sai do registro; sem pontos, o pedido é do mapa inteiro");
    api.mmFonteDefinir("texto");
    ok(Object.keys(api.mmCurDoMapa()).length === 2, "MC20 de volta ao mapa do texto, a curadoria dele continua");
    api.mmIaApagar(ch);
    ok(!api.mmCurDoMapa(ch + "|ia")["conjuncoes subordinadas › finais"], "MC21 apagar o mapa da IA apaga a curadoria dele");
    ["mmq_ligar", "mmq_sair", "mmq_placar", "mmq_selo_errado", "mmq_selo_duvida", "mmq_registro_bt", "mmq_titulo", "mmq_ajuda", "mmq_sub", "mmq_sub_ia", "mmq_vazio", "mmq_tipo_errado", "mmq_tipo_duvida",
      "mmq_tipo_fora", "mmq_tipo_num", "mmq_copiar", "mmq_copiado", "mmq_guardar", "mmq_aval_guardada", "mmq_aval_nenhuma", "mmq_p_intro", "mmq_p_intro_ia", "mmq_p_pontos", "mmq_p_formato_pontos", "mmq_p_tudo", "mmq_nota_errado", "mmq_nota_duvida"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MC22 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
  }

  /* ---------------- MV: (19.179.0) a avaliação vira correção ---------------- */
  {
    /* ler a avaliação, nos formatos que as IAs devolvem */
    const L = (x) => JSON.stringify(api0.mmQualLerAval(x));
    const { api: api0 } = rodar();
    const A1 = api0.mmQualLerAval("[1] INCORRETO — contudo é adversativa — Bechara, Moderna Gramática");
    ok(A1.length === 1 && A1[0].n === 1 && A1[0].v === "incorreto" && A1[0].correcao === "contudo é adversativa" && A1[0].fonte === "Bechara, Moderna Gramática", "MV1 [n] VEREDITO — correção — fonte: " + L("[1] INCORRETO — contudo é adversativa — Bechara, Moderna Gramática"));
    const A2 = api0.mmQualLerAval(["**[2]** **CORRETO** — art. 5º, CF", "3. IMPRECISO: falta o \"bem como\" - Cegalla", "[4] Incorrect — the fix — source"].join(NL));
    ok(A2.length === 3 && A2[0].n === 2 && A2[0].v === "correto" && A2[0].correcao === "art. 5º, CF" && A2[1].n === 3 && A2[1].v === "impreciso" && A2[1].fonte === "Cegalla" && A2[2].v === "incorreto",
      "MV2 negrito, '3.', dois-pontos, hífen e inglês: " + JSON.stringify(A2));
    const A3 = api0.mmQualLerAval(["Outros problemas:", "- Aditivas — PARCIALMENTE CORRETO — falta \"bem como\" — gramática", "No todo, o mapa é correto e confiável.", "Não tenho certeza sobre o item 2."].join(NL));
    ok(A3.length === 1 && A3[0].n === null && A3[0].termo === "Aditivas" && A3[0].v === "impreciso", "MV3 'Termo — VEREDITO' dos outros problemas; a frase solta fica de fora: " + JSON.stringify(A3));
    ok(!api0.mmQualLerAval("[1] INCORRETO").some((x) => x.v === "correto") && api0.mmQualLerAval("[1] INCORRETO")[0].v === "incorreto", "MV4 'INCORRETO' não é lido como 'correto'");
    /* a tela */
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["## Ramo — Conjunções Coordenativas", "",
      "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, contudo.", "  - **Exceção:** \"e\" com valor adversativo", "",
      "## Ramo — Conjunções Subordinadas", "", "* **Causais:** porque, visto que."].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.matMapaAlternar(true);
    const no = (label) => { let achou = null; const ir = (x) => { if (x.label === label) achou = x; x.filhos.forEach(ir); }; ir(api.mmUltimoAtual().arvore.raiz); return achou; };
    const li = (id) => api.$("matMapa").querySelectorAll("li").find((x) => x.id === id);
    const btQ = (id) => api.$("mmQualAvalLista").querySelectorAll("button").find((b) => b.id === id);
    api.mmCurMarcar(no("Adversativas"), "errado", "contudo?");
    api.mmCurMarcar(no("Causais"), "duvida", "");
    const ped = api.mmQualPedidoAtual();
    ok(/\[1\] Conjunções Coordenativas › Adversativas/.test(ped) && /\[2\] Conjunções Subordinadas › Causais/.test(ped), "MV5 o pedido numerado");
    /* depois do pedido, outro galho marcado: a numeração do pedido continua valendo */
    api.mmCurMarcar(no("Exceção"), "errado", "");
    api.mmQualGuardarAval(["[1] INCORRETO — contudo é adversativa, mas o resumo omite \"todavia\" — Bechara", "[2] CORRETO — Cegalla, p. 290",
      "Outros problemas:", "- Aditivas — IMPRECISO — falta \"bem como\" — gramática normativa"].join(NL));
    const P = api.mmQualAvalPontos(api.mmUltimoAtual().arvore);
    ok(P.length === 3 && P[0].no && P[0].no.label === "Adversativas" && P[1].no && P[1].no.label === "Causais" && P[2].no && P[2].no.label === "Aditivas",
      "MV6 cada ponto ligado ao seu galho — o [2] é Causais, como no pedido, mesmo com outro galho marcado depois: " + P.map((x) => x.no && x.no.label).join("|"));
    api.matMapaPintar();
    ok(/mm-a-corrigir/.test(li("mmNo_l3").className) && /✏ a corrigir/.test(li("mmNo_l3").textContent) && /mm-a-corrigir/.test(li("mmNo_l2").className) && !/mm-a-corrigir/.test(li("mmNo_l8").className),
      "MV7 no mapa, '✏ a corrigir' nos galhos com INCORRETO/IMPRECISO (não no CORRETO)");
    const bCorr = api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmSoCorrigir");
    ok(bCorr && /a corrigir \(2\)/.test(bCorr.textContent), "MV7b o filtro '✏ a corrigir' com a contagem");
    bCorr.onclick();
    const visC = api.$("matMapa").querySelectorAll("li").filter((x) => /mm-no/.test(x.className)).map((x) => x.id);
    ok(visC.indexOf("mmNo_l3") >= 0 && visC.indexOf("mmNo_l2") >= 0 && visC.indexOf("mmNo_l8") < 0, "MV7c só os galhos a corrigir e o caminho até eles: " + visC.join());
    api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmSoCorrigir").onclick();
    api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmQualidade").onclick();
    ok(/✗ 1 incorreto.*~ 1 impreciso.*✓ 1 correto.*0 de 3 resolvido/.test(api.$("mmQualAvalTit").textContent), "MV8 o registro resume a avaliação: " + api.$("mmQualAvalTit").textContent);
    ok(btQ("btnMmQualCorrigir_0") && btQ("btnMmQualCorrigido_0") && btQ("btnMmQualDiscordo_0") && btQ("btnMmQualAceitar_1") && btQ("btnMmQualAceitarTodos"),
      "MV9 incorreto: corrigir / corrigido / discordo; correto: aceitar (e todos de uma vez)");
    btQ("btnMmQualAceitarTodos").onclick();
    const cC = api.mmCurDoMapa()[no("Causais").caminho];
    ok(cC && cC.v === "ok" && /Cegalla, p\. 290/.test(cC.nota) && /1 de 3 resolvido/.test(api.$("mmQualAvalTit").textContent), "MV10 aceitar: o galho fica ✓ conferido, com a fonte na nota");
    btQ("btnMmQualCorrigir_0").onclick();
    const ta = api.$("matTexto");
    ok(!api.$("dlgMmQual").open && api.matModoAtual() === "editar" && ta.value.slice(ta.selectionStart, ta.selectionEnd) === "* **Adversativas:** mas, porém, contudo.",
      "MV11 'corrigir no resumo' abre a edição com a linha do galho selecionada: " + JSON.stringify(ta.value.slice(ta.selectionStart, ta.selectionEnd)));
    api.matTrocarModo("ler");
    api.matMapaAlternar(true);
    const p0 = api.mmQualAvalPontos(api.mmUltimoAtual().arvore)[0];
    api.mmQualResolver(p0, "corrigido");
    const cA = api.mmCurDoMapa()[no("Adversativas").caminho];
    ok(cA && cA.v === "ok" && /corrigido pela avaliação: contudo é adversativa/.test(cA.nota) && !/mm-a-corrigir/.test(li("mmNo_l3").className),
      "MV12 '✓ corrigido': o galho passa a conferido, com a correção na nota, e o aviso sai do mapa");
    const p2 = api.mmQualAvalPontos(api.mmUltimoAtual().arvore)[2];
    api.mmQualResolver(p2, "discordo");
    ok(!/mm-a-corrigir/.test(li("mmNo_l2").className) && !api.mmCurDoMapa()[no("Aditivas").caminho], "MV13 'discordo' tira o ponto sem mexer na curadoria");
    api.mmQualResolver(api.mmQualAvalPontos(api.mmUltimoAtual().arvore)[2], "");
    ok(/mm-a-corrigir/.test(li("mmNo_l2").className), "MV14 reabrir volta o aviso");
    api.mmQualGuardarAval(api.mmQualAval().texto);
    ok(Object.keys(api.mmQualAval().res).length === 2, "MV15 guardar a mesma avaliação de novo mantém o que já foi resolvido");
    api.mmQualGuardarAval("[1] CORRETO — x");
    ok(!Object.keys(api.mmQualAval().res).length, "MV16 uma avaliação nova recomeça");
    api.mmQualGuardarAval("Gostei muito do mapa.");
    api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmQualidade").onclick();
    ok(/Não achei pontos/.test(api.$("mmQualAvalLista").textContent), "MV17 avaliação sem pontos: avisa e fica guardada como texto");
    try { api.$("dlgMmQual").close(); } catch (x) {}
    ["mm_f_corrigir", "mm_f_corrigir_tip", "mmq_selo_corrigir", "mmq_aval_tit", "mmq_aval_nada", "mmq_ver_incorreto", "mmq_ver_impreciso", "mmq_ver_correto", "mmq_correcao", "mmq_fonte", "mmq_sem_galho", "mmq_corrigir", "mmq_corrigido",
      "mmq_discordo", "mmq_aceitar", "mmq_aceitar_todos", "mmq_reabrir", "mmq_res_corrigido", "mmq_res_aceito", "mmq_res_discordo", "mmq_nota_corrigido", "mmq_nota_aceito", "mmq_corrigir_toast"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MV18 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
  }

  /* ---------------- MP: (19.180.0) imprimir o mapa (ou salvar em PDF) ---------------- */
  {
    const { api, janela } = rodar();
    api.matIniciar();
    const TXT = ["Os conectivos ligam termos e orações.", "",
      "## Ramo — Conjunções Coordenativas", "",
      "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, ==!contudo==.", "  - **Exceção:** ==~\"e\" com valor adversativo==", "",
      "## Ramo — Conjunções Subordinadas", "", "Texto corrido do ramo, sem negrito, que é bem mais comprido do que o limite de noventa caracteres para caber.", "",
      "* **Causais:** porque, visto que."].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.matMapaAlternar(true);
    const no = (label) => { let achou = null; const ir = (x) => { if (x.label === label) achou = x; x.filhos.forEach(ir); }; ir(api.mmUltimoAtual().arvore.raiz); return achou; };
    api.mmCurMarcar(no("Causais"), "errado", "visto que é causal, mas falta o 'como'");
    api.mmMarcarResultado(no("Aditivas"), "n");
    /* recolher um ramo na tela não tira nada do papel */
    api.mmAlternar(api.mmChave(), no("Conjunções Coordenativas").id);
    let durante = null; const ouv = {};
    const imp = () => api.$("mmImpressao");
    janela.print = () => {
      const area = imp();
      durante = { classe: janela.document.body.classList.contains("eac-imprimindo"), folhas: area.querySelectorAll(".mmp-folha").length,
        texto: area.textContent, nos: area.querySelectorAll("li").length, compacto: area.querySelectorAll(".mmp-compacto").length,
        cores: area.querySelectorAll("li").filter((x) => /mmp-cor-/.test(x.className)).map((x) => x.className.match(/mmp-cor-\d/)[0]) };
    };
    janela.addEventListener = (tipo, fn) => { ouv[tipo] = fn; };
    janela.removeEventListener = (tipo) => { delete ouv[tipo]; };
    const bImp = api.$("matMapa").querySelectorAll("button").find((b) => b.id === "btnMmImprimir");
    ok(bImp && /imprimir \/ PDF/.test(bImp.textContent), "MP1 o botão '🖨 imprimir / PDF' na barra do mapa");
    bImp.onclick();
    ok(durante && durante.classe && durante.folhas === 1 && durante.nos === 8, "MP2 na hora de imprimir: a classe do CSS ligada e a folha com TODOS os galhos (o recolhido também): " + JSON.stringify(durante && [durante.folhas, durante.nos]));
    ok(/🗺 Conectivos/.test(durante.texto) && /Português · mapa do resumo · 8 galhos/.test(durante.texto) && /impresso em \d\d\/\d\d\/\d{4}/.test(durante.texto), "MP3 o cabeçalho: tópico, disciplina, qual mapa, quantos galhos e a data");
    ok(/Texto corrido do ramo, sem negrito, que é bem mais comprido do que o limite de noventa caracteres para caber\./.test(durante.texto) && !/… —/.test(durante.texto)
      && /mas, porém, contudo\./.test(durante.texto) && /❗/.test(durante.texto) && /⚠/.test(durante.texto) && /Sinais: ❗ /.test(durante.texto) && !/==/.test(durante.texto),
      "MP4 o detalhe, as marcas como sinais e a legenda só com os sinais usados");
    ok(/✗ errado/.test(durante.texto) && /🔁 não lembrei/.test(durante.texto) && /📝 Texto corrido/.test(durante.texto), "MP5 no papel também: ✗ errado, 🔁 não lembrei e a nota discreta");
    ok(durante.cores.join() === "mmp-cor-0,mmp-cor-1", "MP6 cada ramo com a sua cor: " + durante.cores.join());
    ok(typeof ouv.afterprint === "function", "MP7 a limpeza espera o 'afterprint'");
    ouv.afterprint();
    ok(!janela.document.body.classList.contains("eac-imprimindo") && imp().children.length === 0 && !ouv.afterprint, "MP8 depois, a classe sai e a área esvazia");
    /* só palavras-chave: sem detalhe nem nota, em duas colunas; com filtro, só o filtrado */
    api.mmCompactoAlternar();
    api.mmImprimirAtual(); ouv.afterprint && ouv.afterprint();
    ok(durante.compacto === 1 && !/mas, porém/.test(durante.texto) && !/📝/.test(durante.texto) && /só palavras-chave/.test(durante.texto), "MP9 'só palavras-chave' sai sem detalhe e sem notas (em colunas)");
    api.mmCompactoAlternar();
    api.mmFiltroDefinir2("grifos");
    api.mmImprimirAtual(); ouv.afterprint && ouv.afterprint();
    ok(/Adversativas/.test(durante.texto) && !/Aditivas/.test(durante.texto) && !/Causais/.test(durante.texto) && /filtro: 🖍 só grifados/.test(durante.texto), "MP10 com o filtro, só o filtrado (e o cabeçalho diz qual): " + durante.texto.slice(0, 160));
    api.mmFiltroDefinir2("grifos");
    /* vários (a véspera): uma folha por tópico; o resumo sem mapa fica de fora */
    const ch2 = api.matChave("Português", "Crase");
    api.matGravar(ch2, ["## Ramo — Regra", "- **Antes de feminino:** a + a", "- **Proibida:** antes de verbo", "## Ramo — Casos", "- **Facultativa:** possessivo"].join(NL), { disciplina: "Português", topico: "Crase" });
    const ch3 = api.matChave("Português", "Curto");
    api.matGravar(ch3, "Uma linha.", { disciplina: "Português", topico: "Curto" });
    const nF = api.mmImprimirVarios([{ disciplina: "Português", topico: "Conectivos", chave: ch }, { disciplina: "Português", topico: "Crase", chave: ch2 }, { disciplina: "Português", topico: "Curto", chave: ch3 }]);
    ok(nF === 2 && durante.folhas === 2 && /🗺 Crase/.test(durante.texto) && /✗ errado/.test(durante.texto), "MP11 imprimir vários: uma folha por tópico (com a curadoria de cada um); sem mapa, fica de fora");
    ouv.afterprint && ouv.afterprint();
    /* o mapa da IA, quando é ele que está à vista */
    api.mmIaGravar(ch, ["- **Conjunções Coordenativas**", "  - **Adversativas** — mas, porém", "- **Conjunções Subordinadas**", "  - **Finais** — a fim de que"].join(NL));
    api.mmFonteDefinir("ia");
    api.mmImprimirAtual(); ouv.afterprint && ouv.afterprint();
    ok(/mapa da IA/.test(durante.texto) && /não está no resumo/.test(durante.texto), "MP12 o mapa da IA sai como mapa da IA, com o aviso do que não está no resumo");
    api.mmFonteDefinir("texto");
    ["mm_imprimir", "mm_imprimir_tip", "mmp_fonte_texto", "mmp_fonte_ia", "mmp_galhos", "mmp_compacto", "mmp_filtro", "mmp_impresso", "mmp_nao_lembrei", "mmp_legenda", "rv_vespera_imprimir", "rv_vespera_imprimir_tip"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MP13 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
  }

  /* ---------------- MK: (19.181.0) o aviso nos cartões de galhos com problema ---------------- */
  {
    const { api } = rodar();
    api.matIniciar();
    const TXT = ["## Ramo — Conjunções Coordenativas", "",
      "* **Regra:** classificam-se pelo sentido.", "* **Aditivas:** e, nem, não só… mas também.", "* **Adversativas:** mas, porém, contudo.", "",
      "## Ramo — Conjunções Subordinadas", "", "* **Regra:** iniciam oração dependente.", "* **Causais:** porque, visto que.", "* **Na medida em que:** causa (= uma vez que)."].join(NL);
    const ch = api.matChave("Português", "Conectivos");
    api.matGravar(ch, TXT, { disciplina: "Português", topico: "Conectivos" });
    api.matAbrirEditor({ disciplina: "Português", nome: "Conectivos" }, "ler");
    api.matMapaAlternar(true);
    const no = (label, pai) => { let achou = null; const ir = (x, p) => { if (x.label === label && (!pai || (p && p.label === pai))) achou = x; x.filhos.forEach((f) => ir(f, x)); }; ir(api.mmUltimoAtual().arvore.raiz, null); return achou; };
    const nota = (front, back, topico) => ({ disciplina: "Português", topico: topico || "Conectivos", chave: api.matChave("Português", topico || "Conectivos"), card: { kind: "basic", front, back } });
    ok(!api.mmProblemasDoTopico(ch).length && !api.mmCartaoProblemas(nota("O que exprimem as adversativas?", "oposição")).length, "MK1 sem curadoria, nenhum aviso (e nada a calcular)");
    api.mmCurMarcar(no("Adversativas"), "errado", "contudo não é adversativa?");
    api.mmCurMarcar(no("Regra", "Conjunções Subordinadas"), "duvida", "");
    const P = api.mmProblemasDoTopico(ch);
    ok(P.length === 2 && P.some((x) => x.label === "Adversativas" && x.tipo === "errado" && /contudo/.test(x.nota)), "MK2 os galhos com problema do tópico: " + JSON.stringify(P.map((x) => [x.label, x.tipo])));
    ok(api.mmCartaoProblemas(nota("Conjunções Coordenativas › Adversativas — o que é / o que diz?", "mas, porém, contudo.")).length === 1, "MK3 o cartão feito pelo próprio mapa liga direto");
    ok(api.mmCartaoProblemas(nota("Qual o valor das conjunções adversativas?", "Oposição: mas, porém, contudo.")).length === 1, "MK4 o nome do galho e o ramo de cima no texto do cartão: liga");
    ok(!api.mmCartaoProblemas(nota("Qual o valor das conjunções aditivas?", "Soma: e, nem.")).length, "MK5 cartão de outro galho: sem aviso");
    ok(!api.mmCartaoProblemas(nota("Qual a regra das coordenativas?", "Classificam-se pelo sentido.")).length && api.mmCartaoProblemas(nota("Regra das subordinadas: o que iniciam?", "Oração dependente.")).length === 1,
      "MK6 nome genérico ('Regra'): só liga com o ramo de cima certo");
    ok(!api.mmCartaoProblemas(nota("Qual o valor das adversativas?", "Oposição.", "Crase")).length, "MK7 cartão de outro tópico: sem aviso");
    /* a avaliação que manda corrigir também avisa; resolvida, o aviso some */
    api.mmQualPedidoAtual();
    api.mmQualGuardarAval("Outros problemas:" + NL + "- Na medida em que — INCORRETO — indica causa, mas 'à medida que' é proporção — Bechara");
    const nCausa = nota("O que indica 'na medida em que'?", "Causa (= uma vez que).");
    const pc = api.mmCartaoProblemas(nCausa);
    ok(pc.length === 1 && pc[0].tipo === "corrigir" && /Bechara/.test(pc[0].nota), "MK8 o ponto que a avaliação mandou corrigir também avisa: " + JSON.stringify(pc));
    /* na revisão: antes de virar, só 'confira'; virado, o galho e a nota */
    api.estcAbrirLista([nota("Qual o valor das conjunções adversativas?", "Oposição: mas, porém, contudo.")], { rotulo: "teste" });
    const av = () => api.$("estCartao").querySelectorAll(".est-mm-aviso")[0];
    ok(av() && /Confira a resposta/.test(av().textContent) && !/Adversativas/.test(av().textContent), "MK9 antes de virar: o aviso sem entregar a resposta");
    api.estcVirar();
    ok(av() && /✗ errado: «Adversativas»/.test(av().textContent) && /contudo não é adversativa/.test(av().textContent) && av().querySelectorAll("button").some((b) => b.id === "btnEstMmMapa"),
      "MK10 virado: o galho, a nota e o '🗺 ver no mapa': " + (av() && av().textContent));
    av().querySelectorAll("button").find((b) => b.id === "btnEstMmMapa").onclick();
    ok(!api.$("dlgGerEstudo").open && api.matMapaAtual() && api.mmCuradoriaAtual(), "MK11 'ver no mapa' fecha a revisão e abre o mapa na curadoria");
    api.mmCurAlternar(false);
    /* resolvido, o aviso some */
    api.mmCurMarcar(no("Adversativas"), "ok", "conferido");
    ok(!api.mmCartaoProblemas(nota("Qual o valor das conjunções adversativas?", "Oposição.")).length, "MK12 o galho conferido: o aviso do cartão some");
    const pts = api.mmQualAvalPontos(api.mmUltimoAtual().arvore);
    api.mmQualResolver(pts[0], "corrigido");
    ok(!api.mmCartaoProblemas(nCausa).length, "MK13 o ponto da avaliação resolvido: o aviso some também");
    ["mmc_aviso", "mmc_aviso_virado", "mmc_tipo_errado", "mmc_tipo_duvida", "mmc_tipo_corrigir", "mmc_do_mapa_ia", "mmc_ver_mapa", "mmc_selo"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "MK14 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.matMapaAlternar(false);
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
