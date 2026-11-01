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
  ok(api.epGravar() === false && /Falta o número/.test(api.$("epMsg").textContent), "P4b 'sim' com uma disciplina sem numero nao grava");
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
  ok(c3.peso === "nao" && lido.avisos.some((a) => /Só 3 de 5/.test(a)), "P5d so algumas com numero: os pesos ficam estimados, com aviso");
  ok(api.$("dlgEdPontua").open, "P5e preencher nao grava nem fecha");

  /* ---- blocos à vista (19.56.0) ---- */
  {
    api.epAbrir();
    const cb = api.epCtxAtual();
    cb.minimo = "sim";
    await api.epCriarBloco("Bloco Teste");
    ok(cb.grupos.some((g) => g.nome === "Bloco Teste") && !api.$("epGrupos").hidden && /Blocos de disciplinas/.test(api.$("epGrupos").textContent), "B1 criar bloco abre a secao dos blocos com o bloco novo");
    cb.ds[0].grupo = "Bloco Teste";
    ok(api.epGravar() === false && /sem o mínimo/.test(api.$("epMsg").textContent), "B2 bloco sem minimo nao grava");
    api.$("dlgEdPontua").close();
  }

  /* ---- discursiva (19.56.0) ---- */
  {
    api.epAbrir();
    const cd = api.epCtxAtual();
    ok(cd.discursiva === "nao", "D0 sem a linha da discursiva, a pergunta 3 comeca em 'nao'");
    cd.discursiva = "sim";
    ok(api.epGravar() === false && /Discursiva: falta/.test(api.$("epMsg").textContent), "D1 discursiva sem valor nem disciplinas nao grava");
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

  /* ---- textos ---- */
  ["ep_tit", "ep_sub", "ep_btn", "ep_q1", "ep_q2", "ep_frase_grupo", "ep_frase_disc", "ep_ia_pedido", "ep_gravado", "ed_conf_resolver", "ed_banc_texto", "ed_mud_tit", "ed_mud_aplicar", "ed_prompt_disc", "ed_prompt_rev_disc", "ed_conf_discursiva_tit", "ed_conf_discursiva_curto", "ed_conserto_feito", "ed_conserto_min", "ed_conf_pesos_faltam"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
