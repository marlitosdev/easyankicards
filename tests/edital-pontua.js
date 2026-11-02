/* =====================================================================
 * COMO A PROVA PONTUA (19.55.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  P1 a janela lê do texto os pesos e os blocos que já existem (inclusive o bloco de uma disciplina só = mínimo dela);
 *  P2 gravar escreve só os pesos ("10q"/"20p") e as linhas "&"; tópicos, ramos, motivos e cabeçalho ficam iguais;
 *  P3 disciplinas do mesmo grupo ficam juntas e as sem mínimo vêm antes dos blocos (senão cairiam num bloco);
 *  P4 "Não" nas perguntas tira o item da conferência do edital; "Sim" sem número em alguma disciplina não grava;
 *  P5 a resposta da IA ("Disciplina | questões | pontos | mínimo | grupo") preenche a tabela, sem gravar;
 *  P6 com o edital criado, o texto colado fica recolhido e o resumo oferece "⚖ Pontuação e cortes".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const TXT = [
    "# ISS Teste | prova: 2026-11-29 | horas: 33",
    "",
    "@ Sistema Tributário Brasileiro :: 5",
    "+ Tributos e suas espécies :: 5 :: base",
    "++ Taxas :: 5 :: art. 77",
    "+ Lançamento :: 5",
    "@ Noções de Direito Administrativo :: 4",
    "+ Atos administrativos :: 5",
    "@ Português :: 4",
    "+ Crase :: 5",
    "@ Raciocínio Lógico :: 2",
    "+ Tabela-verdade :: 5",
    "@ Informática :: 2",
    "+ Segurança da Informação :: 5",
  ].join("\n");
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const ed = api.edCriar("ISS Teste", TXT);
  api.hubAbrirEdital(ed.id || ed);
  api.$("editalTexto").value = TXT;

  /* ---- P1 ---- */
  ok(api.epAbrir() === true && api.$("dlgEdPontua").open, "P1 a janela abre");
  const c = api.epCtxAtual();
  ok(c.ds.length === 5 && c.peso === "nao" && c.minimo === "nao", "P1b sem numeros nem blocos: as duas respostas comecam em 'nao'");

  /* ---- P2/P3: o caso Caruaru — Específicos em grupo, as outras com mínimo próprio ---- */
  c.minimo = "sim";
  c.grupos = [{ nome: "Conhecimentos Específicos", min: { tipo: "pct", valor: 50 } }];
  c.ds.forEach((d) => {
    if (/Tributário|Administrativo/.test(d.nome)) d.grupo = "Conhecimentos Específicos";
    if (d.nome === "Português") d.min = { tipo: "pct", valor: 50 };
    if (/Lógico|Informática/.test(d.nome)) d.min = { tipo: "pct", valor: 40 };
  });
  /* Português sem número: "sim" na pergunta 1 não grava */
  c.peso = "sim";
  c.ds.forEach((d) => { d.abs = /Português/.test(d.nome) ? 0 : 5; d.unidade = "q"; });
  ok(api.epGravar() === false && /falta o número de questões ou pontos de 1 disciplina/.test(api.$("epMsg").textContent), "P4b 'sim' com uma disciplina sem numero nao grava");
  c.peso = "nao";
  const novo = api.epNovoTexto(TXT, c);
  const r = api.lerEdital(novo);
  const bl = (nome) => r.blocos.find((b) => b.nome === nome);
  ok(bl("Conhecimentos Específicos") && bl("Conhecimentos Específicos").minimo.valor === 50 && bl("Conhecimentos Específicos").disciplinas.length === 2,
    "P2 o grupo vira um bloco com o minimo e as duas disciplinas: " + JSON.stringify(r.blocos.map((b) => [b.nome, b.disciplinas])));
  ok(bl("Português") && bl("Português").minimo.valor === 50 && bl("Raciocínio Lógico").minimo.valor === 40 && bl("Informática").disciplinas.join() === "Informática",
    "P2b cada disciplina com minimo proprio vira um bloco so dela");
  const conta = (rr) => rr.disciplinas.map((d) => d.nome + ":" + d.topicos.map((tp) => tp.nome + "/" + (tp.ramos || []).length + "/" + (tp.motivo || "")).join(",")).sort().join(";");
  ok(conta(r) === conta(api.lerEdital(TXT)) && r.cfg.prova === "2026-11-29" && r.cfg.horas === 33, "P2c topicos, ramos, motivos e cabecalho iguais");
  ok(r.disciplinas.find((d) => d.nome === "Sistema Tributário Brasileiro").peso === 5, "P2d sem numero do edital, o peso de 1 a 5 continua");

  /* gravar de verdade: vai para o edital, a conferência perde o item de corte */
  ok(api.epGravar() === true && !api.$("dlgEdPontua").open, "P2e gravar fecha a janela");
  const r2 = api.lerEdital(api.$("editalTexto").value);
  ok(r2.blocos.length === 4, "P2f o texto do edital passou a ter os 4 blocos");
  ok(api.edConfPendencias(r2, api.montarPlano(r2, { horas: 33, prova: "2026-11-29", feitos: {} }), ed.id || ed).indexOf("corte") < 0, "P4 com os cortes, sai o item 'pontos de corte' da conferencia");

  /* P1 de novo: lendo o texto gravado, a janela reconhece grupo e mínimos próprios */
  api.epAbrir();
  const c2 = api.epCtxAtual();
  ok(c2.minimo === "sim" && c2.grupos.length === 1 && c2.ds.find((d) => d.nome === "Português").min.valor === 50 && c2.ds.find((d) => /Tributário/.test(d.nome)).grupo === "Conhecimentos Específicos",
    "P1c a janela le de volta o grupo e os minimos proprios");

  /* ---- P3: disciplina sem mínimo não cai dentro de um bloco ---- */
  c2.ds.find((d) => d.nome === "Informática").min = null;
  const r3 = api.lerEdital(api.epNovoTexto(api.$("editalTexto").value, c2));
  ok(!r3.blocos.some((b) => b.disciplinas.indexOf("Informática") >= 0), "P3 a disciplina sem minimo fica fora de todos os blocos: " + JSON.stringify(r3.blocos.map((b) => [b.nome, b.disciplinas])));

  /* ---- P5: IA ---- */
  api.epAbrir();
  ok(/Sistema Tributário Brasileiro/.test(api.epPromptIA()) && /Disciplina \| questões \| pontos \| mínimo \| grupo/.test(api.epPromptIA()), "P5 o pedido leva a lista exata das disciplinas e o formato");
  const lido = api.epLerIA([
    "Disciplina | questões | pontos | mínimo | grupo",
    "Sistema Tributário Brasileiro | - | - | 50% | Conhecimentos Específicos",
    "Noções de Direito Administrativo | - | - | 50% | Conhecimentos Específicos",
    "Português | 10 | 20 | 50% | -",
    "Raciocínio Lógico | 5 | 5 | 40% | -",
    "Informática | 5 | 5 | 40% | -",
    "Química | 5 | 5 | 40% | -",
  ].join("\n"));
  const c3 = api.epCtxAtual();
  ok(lido.lidas === 5 && lido.avisos.some((a) => /Química/.test(a)), "P5b le as linhas e avisa a disciplina desconhecida");
  ok(c3.minimo === "sim" && c3.grupos[0] && c3.grupos[0].min.valor === 50 && c3.ds.find((d) => d.nome === "Português").min.valor === 50 && c3.ds.find((d) => d.nome === "Português").abs === 20,
    "P5c preenche grupo, minimos e pontos");
  ok(c3.peso === "nao" && lido.avisos.some((a) => /só trouxe o número de questões \(ou pontos\) de 3 das 5/.test(a)), "P5d so algumas com numero: os pesos ficam estimados, com aviso");
  ok(api.$("dlgEdPontua").open, "P5e preencher nao grava nem fecha");

  /* ---- blocos à vista (19.56.0) ---- */
  {
    api.epAbrir();
    const cb = api.epCtxAtual();
    cb.minimo = "sim";
    await api.epCriarBloco("Bloco Teste");
    ok(cb.grupos.some((g) => g.nome === "Bloco Teste") && !api.$("epGrupos").hidden && /Blocos de disciplinas/.test(api.$("epGrupos").textContent), "B1 criar bloco abre a secao dos blocos com o bloco novo");
    cb.ds[0].grupo = "Bloco Teste";
    ok(api.epGravar() === false && /sem a nota mínima/.test(api.$("epMsg").textContent), "B2 bloco sem minimo nao grava");
    api.$("dlgEdPontua").close();
  }

  /* ---- discursiva (19.56.0) ---- */
  {
    api.epAbrir();
    const cd = api.epCtxAtual();
    ok(cd.discursiva === "nao", "D0 sem a linha da discursiva, a pergunta 3 comeca em 'nao'");
    cd.discursiva = "sim";
    ok(api.epGravar() === false && /Pergunta 3 \(discursiva\): falta/.test(api.$("epMsg").textContent), "D1 discursiva sem valor nem disciplinas nao grava");
    cd.disc.pontos = 40; cd.disc.objetiva = 90; cd.disc.minimo = { tipo: "pct", valor: 50 }; cd.disc.linhas = { min: 25, max: 30 }; cd.disc.corrigida = 50;
    cd.disc.disciplinas = ["Sistema Tributário Brasileiro"];
    const frases = api.epResumoAtual();
    ok(frases.some((f) => /31% da nota final/.test(f)) && frases.some((f) => /25 a 30 linhas/.test(f)) && frases.some((f) => /50 primeiros/.test(f)), "D2 'como fica' explica o peso, as linhas e a classificacao: " + frases.join(" | "));
    const tx = api.epNovoTexto(api.$("editalTexto").value, cd);
    const rd = api.lerEdital(tx);
    ok(rd.cfg.discursiva && rd.cfg.discursiva.pontos === 40 && rd.cfg.discursiva.disciplinas[0] === "Sistema Tributário Brasileiro" && rd.cfg.prova === "2026-11-29",
      "D3 a linha '# discursiva' vai para o cabecalho, sem estragar o resto: " + tx.split("\n").slice(0, 3).join(" / "));
    const p0 = api.montarPlano(api.lerEdital(api.$("editalTexto").value), { horas: 20, prova: "2026-11-29", hoje: "2026-11-01", feitos: {}, tempoRecente: null });
    const p1 = api.montarPlano(rd, { horas: 20, prova: "2026-11-29", hoje: "2026-11-01", feitos: {}, tempoRecente: null });
    ok(p1.discursiva && p1.discursiva.s === 31 && p1.fatia["Sistema Tributário Brasileiro"] > p0.fatia["Sistema Tributário Brasileiro"] && p1.fatia["Português"] < p0.fatia["Português"],
      "D4 a discursiva sobe a fatia de onde ela cai e encolhe as outras: " + JSON.stringify([p0.fatia, p1.fatia]));
    ok(api.epGravar() === true && api.lerEdital(api.$("editalTexto").value).cfg.discursiva.pontos === 40, "D5 gravar leva a discursiva para o edital");
    const comD = api.$("editalTexto").value;
    const semD = comD.split("\n").filter((l) => !/^\s*#\s*discursiva/i.test(l)).join("\n");
    const mD = api.edManterPontuacao(comD, semD);
    ok(mD.discursiva && api.lerEdital(mD.txt).cfg.discursiva && api.lerEdital(mD.txt).cfg.discursiva.pontos === 40, "D5b a revisao com IA que devolve o plano sem a discursiva nao a apaga");
    api.epAbrir();
    const ce = api.epCtxAtual();
    ok(ce.discursiva === "sim" && ce.disc.corrigida === 50, "D6 reabrir le a discursiva de volta");
    ce.discursiva = "nao"; ce.disc = { pontos: 0, objetiva: 0, minimo: null, linhas: null, corrigida: 0, disciplinas: [] };
    api.epLerIA("Discursiva | 40 | 90 | 50% | 25-30 | 50 | Sistema Tributário Brasileiro; Noções de Direito Administrativo");
    ok(ce.discursiva === "sim" && ce.disc.pontos === 40 && ce.disc.disciplinas.length === 2 && ce.disc.linhas.max === 30, "D7 a IA preenche a discursiva");
    api.$("dlgEdPontua").close();
    api.hubDiscTreinoMarcar(ed.id || ed, true);
    ok(api.hubDiscTreinoFeito(ed.id || ed) === true, "D8 o treino de escrita da semana fica marcado");
  }

  /* ---- compatibilidade com a revisão e a criação com IA (19.56.0) ---- */
  {
    const comCortes = api.$("editalTexto").value;
    const semCortes = comCortes.split("\n").filter((l) => !/^\s*&/.test(l)).join("\n");
    const m = api.edManterPontuacao(comCortes, semCortes);
    const rm = api.lerEdital(m.txt);
    ok(m.cortes && rm.blocos.length >= 3 && rm.blocos.some((b) => b.nome === "Conhecimentos Específicos"), "K1 plano novo sem cortes: os cortes do atual sao mantidos");
    const outro = comCortes.replace("& Português | minimo: 50%", "& Português | minimo: 60%");
    const m2 = api.edManterPontuacao(comCortes, outro);
    ok(!m2.cortes && m2.txt === outro, "K2 plano novo que ja traz cortes manda");
    const base = api.t("ed_prompt");
    ok(/Se o mínimo for de CADA disciplina/.test(base) && /Se o mínimo for de CADA disciplina/.test(api.edPromptRevisao(["# x", "@ A :: 3", "+ t :: 3"].join("\n"), [])), "K3 criar e revisar levam a mesma regra dos cortes");
    ok(/RAMIFICAÇÕES/.test(api.edPromptEdital(true)) && !/RAMIFICAÇÕES/.test(api.edPromptEdital(false)), "K4 o pedido de montar leva a regra dos ramos quando pedida");
    ok(api.t("ed_conf_ramos") !== "ed_conf_ramos", "K5 o aviso de ramos que somem existe");
    ok(api.hubConferir(ed.id || ed) === true, "K6 conferir no edital responde (abre, rola ate a conferencia ou abre a janela)");
  }

  /* ---- (19.57.0) M: o painel das mudanças da revisão e a discursiva no pedido ---- */
  {
    const A = ["# R | prova: 2030-01-01 | horas: 10", "& Básicos | minimo: 40%", "@ Português :: 3", "+ Crase :: 3", "+ Vírgula :: 2",
      "@ Direito :: 4", "+ Atos :: 4", "++ Vinculados :: 3", "++ Discricionários :: 3", "+ Licitação :: 3", "@ Geografia :: 2", "+ Mapas :: 2"].join("\n");
    const D = ["# R | prova: 2030-01-01 | horas: 10", "# discursiva | pontos: 30 | objetiva: 100 | disciplinas: Direito",
      "& Básicos | minimo: 50%", "@ Português :: 3", "+ Crase :: 4", "+ Vírgula :: 2",
      "@ Direito :: 5", "+ Atos :: 4", "++ Vinculados :: 3", "+ Licitação :: 3", "+ Contratos :: 3", "@ Contabilidade :: 3", "+ Balanço :: 3"].join("\n");
    const c = api.edCompararColagem(A, D, {});
    const m = api.edMudancasRevisao(A, D, c, { cortes: false, pesos: true, discursiva: false });
    const tem = (l, re) => l.some((x) => re.test(x));
    ok(tem(m.sai, /Geografia/) && tem(m.sai, /Mapas/) && tem(m.sai, /Discricion/), "M1 vermelho: disciplina, tópico e ramo que saem: " + JSON.stringify(m.sai));
    ok(tem(m.entra, /Contabilidade/) && tem(m.entra, /Contratos/) && tem(m.entra, /discursiva/i), "M2 verde: disciplina, tópico e discursiva que entram: " + JSON.stringify(m.entra));
    ok(tem(m.muda, /Direito: 4 → 5/) && tem(m.muda, /Crase: peso 3 → 4/) && tem(m.muda, /Básicos: 40% → 50%/), "M3 âmbar: pesos e corte que mudam: " + JSON.stringify(m.muda));
    ok(m.mantem.length === 1 && !tem(m.entra, /^Português/), "M4 azul só com o que o app manteve; o que não mudou não aparece");
    const m0 = api.edMudancasRevisao(A, A, api.edCompararColagem(A, A, {}), null);
    ok(!m0.sai.length && !m0.entra.length && !m0.muda.length, "M5 sem mudança, painel vazio");
    /* a regra da discursiva no pedido: só quando o plano ainda não tem a linha */
    ok(/PROVA DISCURSIVA/.test(api.edPromptEdital(false, undefined, { tem: false })) && !/PROVA DISCURSIVA/.test(api.edPromptEdital(false)) && !/PROVA DISCURSIVA/.test(api.edPromptEdital(false, undefined, { tem: true })), "M6 montar: a regra da discursiva só sem a linha");
    ok(!/\+\+/.test(api.t("ed_prompt_disc")), "M6b a regra nova não fala de ++");
    ok(/PROVA DISCURSIVA/.test(api.edPromptRevisao(A, [])) && /Mantenha a linha "# discursiva"/.test(api.edPromptRevisao(D, [])), "M7 revisar: pede a discursiva sem a linha; mantém com ela");
    const nv = api.hubNovoTexto({ nome: "N", prova: "2030-01-01", horas: 5, plano: "# Outro | horas: 99\n# discursiva | pontos: 20 | objetiva: 80 | disciplinas: A\n@ A :: 3\n+ t :: 3" });
    const rn = api.lerEdital(nv);
    ok(rn.cfg.discursiva && rn.cfg.discursiva.pontos === 20 && rn.cfg.horas === 5, "M8 criar guarda a linha da discursiva e descarta o outro cabeçalho: " + nv);
    ok(api.edConfPendencias(api.lerEdital(A), null, "mx").indexOf("discursiva") >= 0 && api.edConfPendencias(api.lerEdital(D), null, "mx").indexOf("discursiva") < 0, "M9 conferência: discursiva pendente só sem a linha");
    api.edConfDispensar("mx", "discursiva");
    ok(api.edConfPendencias(api.lerEdital(A), null, "mx").indexOf("discursiva") < 0, "M10 'não tem discursiva' tira o item");
  }

  /* ---- (19.58.0) X: o texto colado da TELA do chat e o mínimo na linha "@" são consertados ---- */
  {
    const tela = [
      "ISS X Auditor | prova: 2030-11-29 | horas: 27",
      "discursiva | pontos: 40 | objetiva: 90 | disciplinas: Tributário",
      "& Conhecimentos Específicos | minimo: 30 @ Tributário :: 8q", "",
      "* Princípios :: 5 :: tema basilar !d ++ Legalidade :: 5 :: exceções !d ++ Anterioridade :: 5 :: regras !d", "",
      "* Lançamento :: 5 :: núcleo !d @ Administrativo :: 4q", "",
      "* Atos :: 5 :: central !d & Conhecimentos Básicos @ Português :: 10q | minimo: 10", "",
      "* Crase :: 5 :: clássico @ Lógica :: 5q | minimo: 2", "",
      "* Tautologias :: 2 :: P & Q e contingências @ Redação :: 3q", "",
      "* Coesão :: 3 :: P&D na prática",
    ].join("\n");
    ok(api.lerEdital(tela).disciplinas.length === 0, "X0 como veio da tela, o leitor não acha nada (o motivo do conserto)");
    const c = api.edConsertarColagem(tela);
    const r = api.lerEdital(c.texto);
    const D = (n) => r.disciplinas.find((d) => d.nome === n);
    const B = (n) => (r.blocos || []).find((b) => b.nome === n);
    ok(c.mudou && r.cfg.prova === "2030-11-29" && r.cfg.horas === 27 && r.cfg.discursiva && r.cfg.discursiva.pontos === 40, "X1 o cabeçalho e a discursiva voltam com o '#'");
    ok(r.disciplinas.length === 5 && D("Tributário").topicos.length === 2 && D("Tributário").topicos[0].ramos.length === 2, "X2 disciplinas, tópicos e ramos separados: " + c.texto);
    ok(D("Português").abs === 10 && B("Português") && B("Português").minimo.valor === 10 && B("Lógica").minimo.valor === 2, "X3 o mínimo na linha '@' vira bloco próprio e o 10q não se perde");
    ok(B("Conhecimentos Específicos").minimo.valor === 30 && B("Conhecimentos Específicos").disciplinas.join() === "Tributário,Administrativo", "X4 o bloco das específicas fica com as dele");
    ok(B("Conhecimentos Básicos") && B("Conhecimentos Básicos").disciplinas.join() === "Redação", "X5 a disciplina sem mínimo continua no bloco de antes (os de mínimo próprio vão para o fim)");
    ok(/P & Q e contingências/.test(c.texto) && /P&D na prática/.test(c.texto), "X6 '&' dentro de um motivo não vira bloco");
    ok(!api.edConsertarColagem(c.texto).mudou, "X7 consertar de novo não muda nada");
    const certo = ["# A | prova: 2030-01-01 | horas: 5", "& B | minimo: 50%", "@ A :: 3", "+ t :: 3 :: x * y", "++ r :: 2"].join("\n");
    ok(!api.edConsertarColagem(certo).mudou, "X8 um plano já certo volta igual");
    /* (19.59.2) "*" no tópico com os "++" já em linha própria: o "++" não pode fazer o conserto achar que está tudo certo */
    const meio = ["# M | prova: 2030-01-01 | horas: 5", "@ A :: 5", "", "* t1 :: 5 :: x !d", "++ r1 :: 4 :: y", "", "* t2 :: 3 :: z", "", "@ B :: 10q", "", "* t3 :: 2"].join("\n");
    const cm = api.edConsertarColagem(meio);
    ok(cm.mudou && cm.topicos === 3 && !/^\s*\*/m.test(cm.texto) && api.lerEdital(cm.texto).disciplinas[0].topicos[0].ramos.length === 1, "X11 '*' vira '+' mesmo com '++' no texto: " + cm.texto);
    ok(/r1 :: 4 :: y\n\+ t2/.test(cm.texto), "X12 as linhas em branco entre tópicos saem: " + JSON.stringify(cm.texto));
    ok(!api.edConsertarColagem(cm.texto).mudou, "X13 de novo não muda");
    ok(/Português, Lógica/.test(api.edConsertoTexto(c)) && api.edConsertoTexto({ mudou: false }) === "", "X9 o aviso diz o que foi feito");
    /* na caixa: colar conserta e avisa */
    api.$("edColarTexto").value = tela;
    api.edConferirColagem();
    ok(/^# ISS X/.test(api.$("edColarTexto").value), "X10 a caixa da revisão é consertada ao colar");
  }

  /* ---- (19.58.0) W: o mínimo na linha "@" já gravado no edital — o aviso de "pesos estimados" não pode ficar preso ---- */
  {
    const T = ["# W | prova: 2030-11-29 | horas: 20", "& Específicos | minimo: 30", "@ Tributário :: 8q", "+ a :: 5",
      "& Básicos", "@ Português :: 10q | minimo: 10", "+ b :: 5", "@ Lógica :: 5q | minimo: 2", "+ c :: 5", "@ Redação :: 3q", "+ d :: 3"].join("\n");
    const r = api.lerEdital(T);
    const D = (n) => r.disciplinas.find((d) => d.nome === n);
    const B = (n) => (r.blocos || []).find((b) => b.nome === n);
    ok(D("Português").abs === 10 && D("Lógica").abs === 5, "W1 o 10q não se perde com '| minimo' na mesma linha");
    ok(B("Português") && B("Português").minimo.valor === 10 && B("Lógica").minimo.valor === 2, "W2 o mínimo da linha é o mínimo dela");
    ok(B("Básicos").disciplinas.join() === "Redação" && D("Redação").bloco === "Básicos", "W3 a seguinte sem mínimo continua no bloco de antes");
    const pl = api.montarPlano(r, { hoje: "2030-01-01" });
    ok(pl.fatiaExata && api.edConfPendencias(r, pl, "w1").indexOf("pesos") < 0, "W4 com todos os números, o aviso de pesos sai");
    const e = api.epEstado(T);
    ok(e.ds.find((d) => d.nome === "Português").min.valor === 10 && e.ds.find((d) => d.nome === "Português").abs === 10, "W5 a janela de pontuação lê o mínimo e o número");
    const nv = api.epNovoTexto(T, e);
    ok(!/\| *minimo/i.test(nv.split("\n").filter((l) => /^@/.test(l)).join("\n")) && /& Português \| minimo: 10/.test(nv), "W6 gravar pela janela tira o '| minimo' da linha '@' e escreve o bloco: " + nv);
    const r2 = api.lerEdital(T.replace("@ Redação :: 3q", "@ Redação :: 3"));
    const cx = api.edConferenciaEdital(r2, api.montarPlano(r2, { hoje: "2030-01-01" }), "w2");
    const txt = cx ? cx.textContent : "";
    ok(/Ainda sem o número do edital \(1\): Redação/.test(txt), "W7 o aviso diz qual disciplina falta: " + txt.slice(0, 200));
  }

  /* ---- (19.59.0) C: consultar o cadastrado, mudar o peso 1-5, confirmar antes de gravar, sair perguntando, regras ---- */
  {
    const T = ["# C | prova: 2030-11-29 | horas: 10", "@ Alfa :: 5", "+ a :: 5", "+ b :: 3", "@ Beta :: 2", "+ c :: 5"].join("\n");
    api.$("editalTexto").value = T;
    ok(api.epAbrir() === true, "C1 a janela abre");
    const at = api.$("epAtual").textContent;
    ok(/Cadastrado agora/.test(at) && /Alfa/.test(at) && /Alfapeso 5escala de 1 a 5/.test(at) && /≈80%/.test(at) && /não cadastrada/.test(at), "C2 'cadastrado agora' mostra peso, quanto vale e a discursiva: " + at.slice(0, 300));
    ok(api.$("epRegras") && (require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8").match(/data-i18n="ep_regra_[1-8]"/g) || []).length === 8, "C3 as regras dos pesos estão na janela");
    const sel = api.$("epPeso15_1");
    ok(sel && sel.value === "2", "C4 sem números, o peso 1-5 aparece para mudar");
    sel.value = "4"; sel.onchange();
    const mud = api.epMudancas(api.epCtxAtual());
    ok(mud.length === 1 && /Beta: peso 2 \(1 a 5\) → peso 4 \(1 a 5\)/.test(mud[0].txt), "C5 a mudança é listada de → para: " + JSON.stringify(mud));
    ok(/≈/.test(api.$("epFatia_1").textContent), "C6 a coluna 'vale' mostra a fatia ao vivo: " + api.$("epFatia_1").textContent);
    /* gravar: a confirmação vem antes; "Cancelar" não grava */
    let pr = api.epGravarConfirmando();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); api.uiModalResponder(false); }
    ok((await pr) === false && api.$("editalTexto").value === T && api.$("dlgEdPontua").open, "C7 cancelar na confirmação não grava e a janela continua");
    pr = api.epGravarConfirmando();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); api.uiModalResponder(true); }
    ok((await pr) === true && /@ Beta :: 4/.test(api.$("editalTexto").value) && /@ Alfa :: 5/.test(api.$("editalTexto").value), "C8 confirmando, grava só o peso mudado: " + api.$("editalTexto").value);
    /* sem mudança: avisa e não grava */
    api.epAbrir();
    pr = api.epGravarConfirmando();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); api.uiModalResponder(true); }
    ok((await pr) === false, "C9 sem mudança não há o que gravar");
    /* sair com mudança pergunta; "Cancelar" mantém a janela aberta */
    api.$("epPeso15_0").value = "3"; api.$("epPeso15_0").onchange();
    pr = api.epFechar();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); api.uiModalResponder(false); }
    ok((await pr) === false && api.$("dlgEdPontua").open, "C10 sair com mudança pergunta; cancelar continua na janela");
    pr = api.epFechar();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); api.uiModalResponder(true); }
    ok((await pr) === true && !api.$("dlgEdPontua").open && /@ Alfa :: 5/.test(api.$("editalTexto").value), "C11 'sair sem gravar' fecha e o edital fica como estava");
    /* com os números do edital, o cadastrado diz "10 questões" e o vale é exato */
    api.$("editalTexto").value = T.replace("@ Alfa :: 5", "@ Alfa :: 10q").replace("@ Beta :: 2", "@ Beta :: 5q");
    api.epAbrir();
    const at2 = api.$("epAtual").textContent;
    ok(/10 questões/.test(at2) && /67%/.test(at2) && !/≈67%/.test(at2), "C12 com números, 'cadastrado agora' é exato: " + at2.slice(0, 200));
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.59.1) V: o que impede gravar é dito ANTES da confirmação, num alerta, com o nome do que falta ---- */
  {
    const T = ["# V | prova: 2030-11-29 | horas: 10", "@ Alfa :: 5", "+ a :: 5", "@ Beta :: 2", "+ c :: 5"].join("\n");
    api.$("editalTexto").value = T;
    api.epAbrir();
    const c = api.epCtxAtual();
    c.peso = "sim"; c.ds[0].abs = 10; c.ds[0].unidade = "q";
    c.discursiva = "sim"; c.disc.pontos = 40;
    let msg = "";
    const pr = api.epGravarConfirmando();
    for (let i = 0; i < 4; i++) { await Promise.resolve(); msg = msg || String(api.$("uiModalMsg").textContent || ""); api.uiModalResponder(true); }
    ok((await pr) === false && api.$("editalTexto").value === T, "V1 com falta, nada é gravado");
    ok(/NADA FOI GRAVADO/.test(msg) && /Beta/.test(msg) && /quanto vale a prova objetiva/.test(msg) && /em quais disciplinas/.test(msg), "V2 o alerta diz o que falta, por nome: " + msg);
    ok(!/ANTES DE GRAVAR/.test(msg), "V3 a confirmação nem aparece quando não dá para gravar");
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.60.0) S: revisão SÓ DOS PESOS — pedido curto, resposta mesclada, tópicos intactos ---- */
  {
    const A = ["# S | prova: 2030-11-29 | horas: 10", "& Específicos | minimo: 50%", "@ Tributário :: 5", "+ a :: 5 :: x !d", "++ r1 :: 4", "+ b :: 3",
      "@ Administrativo :: 3", "+ c :: 4", "& Básicos", "@ Português :: 4", "+ d :: 5", "@ Inglês :: 2 | escolha: Língua", "+ e :: 3", "@ Espanhol :: 2 | escolha: Língua", "+ f :: 3"].join("\n");
    const conta = (tx) => { const r = api.lerEdital(tx); return r.disciplinas.length + "|" + r.disciplinas.reduce((x, d) => x + d.topicos.length + d.topicos.reduce((y, tp) => y + (tp.ramos || []).length, 0), 0); };
    api.$("editalTexto").value = A;
    /* o pedido */
    api.$("edColarSoPesos").checked = true;
    const pr = api.edColarPedidoTexto();
    ok(/SÓ OS PESOS DAS DISCIPLINAS/.test(pr) && /@ Tributário :: 5/.test(pr) && !/\+ a :: 5/.test(pr) && /Tributário: 2 tópicos/.test(pr), "S1 o pedido curto leva só disciplinas, blocos e o tamanho de cada uma");
    ok(pr.length < api.edPromptRevisao(A, []).length / 2 && /PROVA DISCURSIVA/.test(pr) && /escolha/.test(pr), "S2 bem menor, com a regra da discursiva e das escolhas");
    api.$("edColarSoPesos").checked = false;
    ok(!/SÓ OS PESOS/.test(api.edColarPedidoTexto()), "S3 sem o marcador, o pedido é o de sempre");
    /* a mescla */
    const R1 = ["# Outro | prova: 2020-01-01 | horas: 99", "# discursiva | pontos: 30 | objetiva: 70 | disciplinas: tributario", "& Específicos | minimo: 60%",
      "@ TRIBUTÁRIO :: 20q", "@ Administrativo :: 10q", "& Português | minimo: 50%", "@ Português :: 10q", "@ Inglês :: 5q | escolha: Língua", "@ Espanhol :: 5q | escolha: Língua", "@ Nova :: 5q"].join("\n");
    ok(api.edColarSoPesosResp(R1, A) && !api.edColarSoPesosResp(A, A), "S4 resposta sem tópicos é 'só pesos'; plano com tópicos não");
    const m = api.edMesclarPesos(A, R1);
    const rm = api.lerEdital(m.texto);
    const D = (n) => rm.disciplinas.find((d) => d.nome === n);
    ok(!m.erro && conta(m.texto) === conta(A), "S5 tópicos e ramos idênticos depois da mescla: " + m.erro);
    ok(D("Tributário").abs === 20 && D("Português").abs === 10 && D("Inglês").escolha === "Língua", "S6 pesos novos, escolha mantida");
    ok(rm.cfg.prova === "2030-11-29" && rm.cfg.horas === 10, "S7 o cabeçalho (data e horas) continua o do app");
    ok(rm.cfg.discursiva && rm.cfg.discursiva.pontos === 30 && rm.cfg.discursiva.disciplinas.join() === "Tributário", "S8 a discursiva da resposta entra, com o nome do plano");
    ok((rm.blocos || []).find((b) => b.nome === "Específicos").minimo.valor === 60 && (rm.blocos || []).find((b) => b.nome === "Português"), "S9 blocos e mínimos da resposta");
    ok(m.semPar.join() === "Nova" && !rm.disciplinas.some((d) => d.nome === "Nova") && m.casadas === 5, "S10 disciplina sem par é ignorada e avisada");
    ok(/\+ a :: 5 :: x !d/.test(m.texto) && /\+\+ r1 :: 4/.test(m.texto), "S11 as linhas dos tópicos ficam exatamente como estavam");
    /* resposta parcial e misturada */
    const m2 = api.edMesclarPesos(A, ["@ Tributário :: 20q", "@ Português :: 4"].join("\n"));
    ok(!m2.erro && m2.faltaram.join() === "Administrativo,Inglês,Espanhol" && m2.misto && /Português/.test(m2.semNumero.join()), "S12 o que faltou fica como estava; mistura avisada: " + JSON.stringify(m2.faltaram));
    /* na janela: conferir e aplicar pelo painel */
    api.$("edColarTexto").value = R1;
    const c = api.edConferirColagem();
    ok(c && c.soPesos && conta(c.novoTxt) === conta(A) && /Só pesos: 5 disciplina/.test(api.$("edColarAviso").textContent), "S13 a conferência compara o plano mesclado e diz 'só pesos'");
    ok(!api.$("btnEdColarAplicar").disabled && api.$("btnEdColarAplicar").textContent === "Aplicar os pesos", "S14 o botão de aplicar fica livre e diz o que faz");
    const pa = api.edAplicarColagem();
    for (let i = 0; i < 8; i++) { await Promise.resolve(); api.uiModalResponder(true); }
    await pa;
    ok(/@ Tributário :: 20q/.test(api.$("editalTexto").value) && conta(api.$("editalTexto").value) === conta(A), "S15 aplicado: pesos novos e os mesmos tópicos");
    /* resposta COMPLETA com o marcador ligado: decide pelo conteúdo, fluxo normal */
    api.$("editalTexto").value = A;
    api.$("edColarTexto").value = A.replace("@ Tributário :: 5", "@ Tributário :: 4");
    const c2 = api.edConferirColagem();
    ok(c2 && !c2.soPesos, "S16 resposta com tópicos segue o fluxo normal");
    api.$("edColarTexto").value = "";
  }

  /* ---- (19.60.1) N: "Não" na pergunta 1 não apaga números que já existem; "(50%)" no nome do bloco é o mínimo ---- */
  {
    const T = ["# N | prova: 2030-11-29 | horas: 10", "& Específicos | minimo: 50%", "@ Tributário :: 5", "+ a :: 5", "@ Administrativo :: 4", "+ b :: 4",
      "& Português | minimo: 50%", "@ Português :: 10q", "+ c :: 5", "@ Lógica :: 5q", "+ d :: 3"].join("\n");
    api.$("editalTexto").value = T;
    api.epAbrir();
    const c = api.epCtxAtual();
    ok(c.peso === "nao" && /Português10 questões/.test(api.$("epTabela").textContent) && !/Português1 · raro/.test(api.$("epTabela").textContent), "N1 edital misturado: a disciplina com número mostra o número, não a lista 1 a 5: " + c.peso + " " + !!api.$("epPeso15_2") + " " + String(api.$("epTabela").textContent).slice(0, 160));
    c.discursiva = "nao";
    c.ds.find((d) => d.nome === "Tributário").peso = 4;
    ok(api.epGravar() === true && /@ Português :: 10q/.test(api.$("editalTexto").value) && /@ Lógica :: 5q/.test(api.$("editalTexto").value) && /@ Tributário :: 4/.test(api.$("editalTexto").value), "N2 gravar com 'Não' de partida mantém os números: " + api.$("editalTexto").value.split("\n").filter((l) => /^@/.test(l)).join(" | "));
    /* trocar de "Sim" para "Não" nesta janela é o pedido explícito de tirar os números */
    const T2 = ["# N2 | prova: 2030-11-29 | horas: 10", "@ A :: 10q", "+ a :: 5", "@ B :: 5q", "+ b :: 3"].join("\n");
    api.$("editalTexto").value = T2;
    api.epAbrir();
    api.epCtxAtual().peso = "nao";
    ok(api.epGravar() === true && !/q/.test(api.$("editalTexto").value.split("\n").filter((l) => /^@/.test(l)).join("")), "N3 'Sim' → 'Não' tira os números (pedido explícito)");
    /* a resposta da IA com "(50%)" no nome do bloco */
    api.$("editalTexto").value = T;
    api.epAbrir();
    api.epLerIA(["Tributário | - | - | 50% | Específicos (50%)", "Administrativo | - | - | 50% | específicos (50%)", "Português | 10 | 20 | 50% | -", "Lógica | 5 | 5 | 40% | -"].join("\n"));
    const c3 = api.epCtxAtual();
    ok(c3.grupos.length === 1 && c3.grupos[0].nome === "Específicos" && c3.grupos[0].min.valor === 50, "N4 '(50%)' sai do nome do bloco e o nome existente é reaproveitado: " + JSON.stringify(c3.grupos));
    ok(/sem número: Tributário, Administrativo/.test(api.$("epMsg").textContent), "N5 o aviso diz quais ficaram sem número");
    ok(api.epGravar() === true && /@ Português :: 20p/.test(api.$("editalTexto").value) && /& Específicos \| minimo: 50%/.test(api.$("editalTexto").value), "N6 gravado: os números da IA ficam e o bloco mantém o nome");
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.61.0) H: fatia híbrida — numeradas exatas, as outras dividem o que sobra da objetiva ---- */
  {
    const base = ["# H | prova: 2030-11-29 | horas: 10", "# discursiva | pontos: 0 | objetiva: 100",
      "@ Alfa :: 5", "+ a :: 5", "+ b :: 5", "@ Beta :: 5", "+ c :: 5", "+ d :: 5", "@ Port :: 20p", "+ e :: 5", "@ Log :: 20p", "+ f :: 3"];
    const T = base.join("\n").replace("# discursiva | pontos: 0 | objetiva: 100", "# discursiva | pontos: 10 | objetiva: 100 | disciplinas: Alfa");
    const pl = api.montarPlano(api.lerEdital(T), { hoje: "2030-01-01" });
    const h = pl.fatiaHibrida;
    ok(h && h.total === 100 && h.numeradas === 40 && h.resto === 60 && h.estimadas.join() === "Alfa,Beta", "H1 numeradas em pontos + total da objetiva: híbrida: " + JSON.stringify(h));
    ok(h.pts.Alfa === 30 && h.pts.Beta === 30 && h.pts.Port === 20, "H2 o resto (60) dividido pela estimativa (iguais aqui): " + JSON.stringify(h.pts));
    ok(!pl.fatiaExata && pl.fatia.Port < pl.fatia.Alfa, "H3 a fatia mostrada é a dos pontos (com a discursiva): " + JSON.stringify(pl.fatia));
    /* sem o total da objetiva, ou numeradas em questões: não há híbrida (a de sempre) */
    const semTotal = ["# H | prova: 2030-11-29 | horas: 10", "@ Alfa :: 5", "+ a :: 5", "@ Port :: 20p", "+ e :: 5"].join("\n");
    ok(!api.montarPlano(api.lerEdital(semTotal), { hoje: "2030-01-01" }).fatiaHibrida, "H4 sem o total da objetiva, sem híbrida");
    ok(!api.montarPlano(api.lerEdital(T.replace(/20p/g, "20q")), { hoje: "2030-01-01" }).fatiaHibrida, "H5 numeradas em questões (total em pontos): sem híbrida");
    ok(!api.montarPlano(api.lerEdital(T.replace("@ Alfa :: 5", "@ Alfa :: 30p").replace("@ Beta :: 5", "@ Beta :: 30p")), { hoje: "2030-01-01" }).fatiaHibrida, "H6 todas numeradas: exata, sem híbrida");
    /* na janela: "≈" só nas estimadas; o cadastrado explica */
    api.$("editalTexto").value = T;
    api.epAbrir();
    const at = api.$("epAtual").textContent;
    ok(/Exato para as disciplinas com o número do edital \(40 de 100/.test(at) && /≈/.test(at) && /Port20pontosnúmerodoedital\d+%/.test(at.replace(/\s/g, "")) && /Log20pontosnúmerodoedital\d+%/.test(at.replace(/\s/g, "")) && !/Port20pontosnúmerodoedital≈/.test(at.replace(/\s/g, "")), "H7 cadastrado agora diz o que é exato e o que é ≈: " + at.slice(250, 520));
    const r2 = api.lerEdital(T);
    const cx = api.edConferenciaEdital(r2, pl, "h1");
    ok(cx && /divide os 60 que sobram da objetiva \(100\)/.test(cx.textContent), "H8 a conferência explica a divisão");
    ok(/Exato para Port, Log/.test(String(api.$("epResumo").textContent)), "H9 o 'como fica' diz o que é exato e o que é estimado: " + String(api.$("epResumo").textContent).slice(0, 200));
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.62.0) F: "Como fica" marca o que mudou em relação ao gravado ---- */
  {
    const T = ["# F | prova: 2030-11-29 | horas: 10", "& Específicos | minimo: 50%", "@ Alfa :: 5", "+ a :: 5", "@ Beta :: 4", "+ b :: 4",
      "& Port | minimo: 50%", "@ Port :: 3", "+ c :: 3"].join("\n");
    api.$("editalTexto").value = T;
    api.epAbrir();
    const txt = () => String(api.$("epResumo").textContent || "");
    ok(!/[＋↻✕]/.test(txt()), "F1 sem mexer, nada marcado: " + txt().slice(0, 120));
    const c = api.epCtxAtual();
    c.ds.find((d) => d.nome === "Port").min = { tipo: "pct", valor: 60 };
    api.epPintarAtualResumo();
    ok(/↻ 1 mudou/.test(txt()) && /antes: Você é eliminado se fizer menos de 50% em Port/.test(txt()), "F2 mínimo mudado: âmbar com o antes: " + txt().slice(0, 300));
    c.discursiva = "sim"; c.disc.pontos = 20; c.disc.objetiva = 80; c.disc.disciplinas = ["Alfa"];
    api.epPintarAtualResumo();
    ok(/＋ 2 novo/.test(txt()) && /＋ A discursiva vale 20%/.test(txt()), "F3 discursiva cadastrada: verde: " + txt().slice(0, 200));
    c.ds.forEach((d) => { if (d.grupo === "Específicos") d.grupo = ""; });
    c.grupos = c.grupos.filter((g) => g.nome !== "Específicos");
    api.epPintarAtualResumo();
    ok(/✕ 1 sai/.test(txt()) && /✕ Você é eliminado se fizer menos de 50% em Específicos/.test(txt()), "F4 bloco desfeito: vermelho, riscado: " + txt().slice(0, 400));
    /* gravar e reabrir: tudo neutro de novo */
    c.discursiva = "nao";
    c.ds.forEach((d) => { if (!d.grupo && d.nome !== "Port") d.min = null; });
    c.minimo = "sim";
    ok(api.epGravar() === true, "F5 grava");
    api.epAbrir();
    ok(!/[＋↻✕]/.test(txt()), "F6 depois de gravar, neutro: " + txt().slice(0, 160));
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.63.0) L: "preencher" diz o que fez, linha por linha; campos mudados marcados; guia dos campos ---- */
  {
    const T = ["# L | prova: 2030-11-29 | horas: 10", "@ Alfa :: 5", "+ a :: 5", "@ Beta :: 4", "+ b :: 4", "@ Gama :: 3", "+ c :: 3"].join("\n");
    api.$("editalTexto").value = T;
    api.epAbrir();
    ok(/O que pôr em|Sem os números do edital/.test(api.$("epTabela").textContent), "L1 a tabela começa com o guia do que pôr nos campos");
    const r = api.epLerIA(["Disciplina | questões | pontos | mínimo | grupo", "Alfa | 10 | 20 | 50% | -", "Beta | dez | - | metade | -",
      "Inventada | 5 | - | - | -", "texto solto sem barras", "Alfa | 12 | - | - | -", "Discursiva | 40 | - | 50% | 25-30 | - | Alfa; Zeta"].join("\n"));
    const tipos = r.linhas.map((x) => x.n + ":" + x.tipo).join(" ");
    ok(tipos === "1:info 2:ok 3:aviso 4:erro 5:aviso 6:aviso 7:aviso", "L2 cada linha com o seu estado: " + tipos);
    const msg = (n) => (r.linhas.find((x) => x.n === n) || {}).msg || "";
    ok(/10 questões e 20 pontos \(uso os pontos/.test(msg(2)) && /“dez” na coluna questões não é um número/.test(msg(3)) && /Mínimo “metade” não foi entendido/.test(msg(3)), "L3 o que foi lido e o que está errado, em palavras: " + msg(2) + " / " + msg(3));
    ok(/“Inventada” não é uma disciplina do seu edital/.test(msg(4)) && /não tem as partes separadas/.test(msg(5)) && /apareceu de novo/.test(msg(6)), "L4 disciplina desconhecida, linha sem '|' e repetida");
    ok(/Falta: quanto vale a objetiva/.test(msg(7)) && /não achei no edital: Zeta/.test(msg(7)), "L5 discursiva incompleta diz o que falta: " + msg(7));
    ok(/Sem linha na resposta \(ficam como estão\): Gama/.test(r.avisos.join(" ")), "L6 disciplina sem linha é avisada");
    ok(!api.$("epIaConf").hidden && /Pronto: li \d+ linha/.test(api.$("epIaConf").textContent) && /linha 3/.test(api.$("epIaConf").textContent), "L7 o relatório aparece abaixo da caixa: " + String(api.$("epIaConf").textContent).slice(0, 160));
    ok(r.mudados >= 1 && api.$("epVale_0") && api.$("epVale_0").classList.contains("ep-campo-mudou"), "L8 campo que mudou fica marcado (" + r.mudados + ")");
    const r0 = api.epLerIA("nada aqui\noutra linha");
    ok(r0.lidas === 0 && /Não consegui ler nenhuma linha/.test(api.$("epIaConf").textContent) && /5 partes separadas por/.test(api.$("epIaConf").textContent), "L9 sem nada legível: diz e mostra o formato");
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- (19.64.0) I: incluir disciplina pela janela ---- */
  {
    const T = ["# I | prova: 2030-11-29 | horas: 10", "& Específicos | minimo: 50%", "@ Alfa :: 5", "+ a :: 5", "++ r :: 3", "@ Beta :: 4", "+ b :: 4"].join("\n");
    api.$("editalTexto").value = T;
    api.epAbrir();
    ok(/\+ incluir disciplina/.test(api.$("epTabela").textContent), "I1 o botão está embaixo da tabela");
    const pRep = api.epIncluirDisciplina("Alfa", "");
    for (let i = 0; i < 3; i++) { await Promise.resolve(); api.uiModalResponder(true); }
    ok((await pRep) === false && /já está no edital/.test(api.$("epMsg").textContent), "I2 nome repetido é recusado");
    ok((await api.epIncluirDisciplina("  Gama | @ ", "")) === true, "I3 inclui (limpa sinais do nome)");
    const c = api.epCtxAtual();
    const g = c.ds.find((d) => d.nome === "Gama");
    ok(g && g.novo && g.topico === "Conteúdo geral de Gama" && /nova/.test(api.$("epTabela").textContent), "I4 entra marcada, com o tópico padrão");
    const mud = api.epMudancas(c);
    ok(mud.some((m) => /disciplina nova: Gama/.test(m.txt)), "I5 a confirmação lista a disciplina nova: " + JSON.stringify(mud));
    ok(/＋/.test(String(api.$("epResumo").textContent)), "I6 o 'como fica' marca a nova em verde");
    g.peso = 2; g.grupo = "Específicos";
    ok(api.epGravar() === true, "I7 grava com a trava aceitando exatamente a disciplina nova: " + api.$("epMsg").textContent);
    const r = api.lerEdital(api.$("editalTexto").value);
    const dg = r.disciplinas.find((d) => d.nome === "Gama");
    ok(dg && dg.peso === 2 && dg.topicos.length === 1 && dg.topicos[0].nome === "Conteúdo geral de Gama" && dg.bloco === "Específicos", "I8 no edital: peso, 1 tópico e o bloco: " + api.$("editalTexto").value);
    ok(r.disciplinas.find((d) => d.nome === "Alfa").topicos[0].ramos.length === 1, "I9 o resto do edital fica igual");
    /* tirar antes de gravar */
    api.epAbrir();
    await api.epIncluirDisciplina("Delta", "Primeiro assunto");
    const c2 = api.epCtxAtual();
    ok(c2.ds.some((d) => d.nome === "Delta") && api.$("btnEpTirarNova_3"), "I10 a nova tem o botão de tirar");
    api.$("btnEpTirarNova_3").onclick();
    ok(!api.epCtxAtual().ds.some((d) => d.nome === "Delta") && !api.epMudancas(api.epCtxAtual()).length, "I11 tirar desfaz a inclusão");
    try { api.$("dlgEdPontua").close(); } catch (e) {}
  }

  /* ---- textos ---- */
  ["ep_tit", "ep_sub", "ep_btn", "ep_q1", "ep_q2", "ep_frase_grupo", "ep_frase_disc", "ep_ia_pedido", "ep_gravado", "ed_conf_resolver", "ed_banc_texto", "ed_mud_tit", "ed_mud_aplicar", "ed_prompt_disc", "ed_prompt_rev_disc", "ed_conf_discursiva_tit", "ed_conf_discursiva_curto", "ed_conserto_feito", "ed_conserto_min", "ed_conf_pesos_faltam", "ep_atual_tit", "ep_regras_tit", "ep_regra_7", "ep_conf_botoes", "ep_sair_conf", "ep_col_peso15", "ed_colar_so_pesos", "ed_colar_so_pesos_exp", "ed_pp_cab", "ed_pp_r2", "ed_colar_pesos_misto", "ed_colar_sem_pesos", "ep_regra_8", "ep_atual_sub_hibrida", "ed_conf_pesos_hibrida", "ep_fatia_hibrida", "ep_res_novos", "ep_res_mudou", "ep_res_sai", "ep_res_antes", "ep_nova_btn", "ep_nova_pergunta", "ep_mud_nova", "ep_nova_ok"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
