/* =====================================================================
 * TESTES DA LISTA DE EDITAIS (v8.68)
 *
 * O que muda de verdade ao sair de "um edital" para "vários" não é a tela:
 * é que passam a existir estados que antes não podiam existir errado —
 * progresso do edital A aparecendo no B, migração que perde quem já usava
 * o app, e uma agenda que junta concursos sem dizer de qual é cada linha.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

function carregar() {
  const loja = {};
  const localStorage = {
    getItem: (k) => (loja[k] === undefined ? null : loja[k]),
    setItem: (k, v) => { loja[k] = String(v); },
    removeItem: (k) => { delete loja[k]; },
    get length() { return Object.keys(loja).length; },
    key: (i) => Object.keys(loja)[i],
  };
  const src = ["edital.js", "editais.js"]
    .map((f) => fs.readFileSync(path.join(RAIZ, "docs", f), "utf8")).join("\n");
  /* editais.js usa guardar() do app.js — no navegador app.js carrega antes.
   * Aqui o dublê registra a chamada, para o teste poder cobrar. */
  const gravou = [];
  const guardar = (k, v) => { gravou.push(k); localStorage.setItem(k, v); return true; };
  const api = new Function("localStorage", "reg", "guardar", src + `
    return { edCarregarLista, edSalvarLista, edCriar, edApagar, edDuplicar,
             edAbrir, edAberto, edAgrupados, edSituacao, edUrgencia,
             edTopicosAtivos, lerEdital, montarPlano, agendar, edQualidadeLeitura, edOptativas, edEscolhasPendentes, edDefinirEscolha, edLerEscolhas, edEscolhasTexto, edParaTexto, diagnosticoPlano, edMapaDeCalor, edNivelDeCalor, edSemanaDeEstudo, edDiasDeEstudo, edPrevistoPorDia, edCompararColagem, acompanhamento, projetarCobertura, comparativoEditais, edIncluirDisciplina, edExcluirDisciplina, edRedistribuir,
             get editais(){ return editais; },
             get gravou(){ return gravou; } };`)(localStorage, () => {}, guardar);
  return { api, loja };
}

const CAB = (nome, prova, horas) =>
  `# ${nome}${prova ? " | prova: " + prova : ""} | horas: ${horas || 10}`;
const CORPO = "\n@ Financeiro :: 5\n+ Receita :: 5 :: cai sempre\n+ Despesa :: 3 :: cai as vezes";

function testes() {
  const falhas = [];
  const ok = (cond, msg) => { if (!cond) falhas.push(msg); };

  /* ---- L1: a migração. Quem já usava o app não pode abrir e achar vazio ---- */
  {
    const { api, loja } = carregar();
    loja["eac_edital_texto"] = CAB("TCE-PE Auditor", "2026-09-10") + CORPO;
    loja["eac_edital_progresso"] = JSON.stringify({ "financeiro›receita": { e: "feito" } });
    api.edCarregarLista();
    const l = api.editais;
    ok(l.length === 1, `L1 a migracao devia criar 1 edital, criou ${l.length}`);
    ok(l[0] && l[0].nome === "TCE-PE Auditor",
       `L1b o nome devia vir do cabecalho, veio "${l[0] && l[0].nome}"`);
    ok(l[0] && Object.keys(l[0].progresso).length === 1,
       "L1c a migracao PERDEU o progresso — e progresso nao se refaz colando texto");

    /* migrar de novo não pode duplicar */
    api.edCarregarLista();
    ok(api.editais.length === 1,
       `L1d recarregar duplicou o edital migrado (${api.editais.length})`);
  }

  /* ---- L2: sem edital antigo, não inventa nada ---- */
  {
    const { api } = carregar();
    api.edCarregarLista();
    ok(api.editais.length === 0, "L2 criou edital do nada numa base vazia");
  }

  /* ---- L3: os três grupos, e a régua é a data da prova ---- */
  {
    const { api } = carregar();
    api.edCarregarLista();
    api.edCriar("Perto", CAB("Perto", "2026-09-10") + CORPO);
    api.edCriar("Longe", CAB("Longe", "2027-06-01") + CORPO);
    api.edCriar("Sem data", CAB("Sem data", null) + CORPO);
    api.edCriar("Passado", CAB("Passado", "2020-01-01") + CORPO);
    const g = api.edAgrupados("", "2026-08-16");
    ok(g.proximo.length === 1 && g.proximo[0].nome === "Perto",
       `L3 grupo "prova proxima" errado: ${g.proximo.map((x) => x.nome)}`);
    ok(g.encerrado.length === 1 && g.encerrado[0].nome === "Passado",
       `L3b grupo "encerrado" errado: ${g.encerrado.map((x) => x.nome)}`);
    ok(g.sem_data.length === 2,
       `L3c prova distante devia cair em "sem data proxima", veio ${g.sem_data.length}`);

    /* dentro do grupo, prova mais proxima primeiro */
    api.edCriar("Amanha", CAB("Amanha", "2026-08-20") + CORPO);
    const g2 = api.edAgrupados("", "2026-08-16");
    ok(g2.proximo[0].nome === "Amanha",
       `L3d o mais urgente devia vir primeiro, veio ${g2.proximo[0].nome}`);

    /* filtro */
    const g3 = api.edAgrupados("pert", "2026-08-16");
    const tot = g3.proximo.length + g3.sem_data.length + g3.encerrado.length;
    ok(tot === 1, `L3e o filtro devia deixar 1 edital, deixou ${tot}`);
  }

  /* ---- L4: progresso é POR EDITAL ----
   * Sem isto, marcar "Receita" estudada no TCU marcaria no TCE-PE também,
   * e as estatisticas de peso cumprido passam a mentir nos dois. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const a = api.edCriar("A", CAB("A", "2026-09-10") + CORPO);
    const b = api.edCriar("B", CAB("B", "2026-09-10") + CORPO);
    a.progresso["financeiro›receita"] = { e: "feito" };
    api.edSalvarLista();
    ok(Object.keys(b.progresso).length === 0,
       "L4 marcar no edital A vazou para o edital B");
    const g = api.edAgrupados("", "2026-08-16");
    const ca = g.proximo.find((x) => x.nome === "A");
    const cb = g.proximo.find((x) => x.nome === "B");
    ok(ca.feitos === 1 && cb.feitos === 0,
       `L4b contagem por edital errada: A=${ca.feitos} B=${cb.feitos}`);
  }

  /* ---- L5: duplicar copia o edital, NÃO o progresso ----
   * Herdar o progresso do outro concurso seria mentir sobre o que a pessoa
   * estudou naquele cargo — e ela so descobriria na hora da prova. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const a = api.edCriar("Cargo 1", CAB("Cargo 1", "2026-09-10") + CORPO);
    a.progresso["financeiro›receita"] = { e: "feito" };
    api.edSalvarLista();
    const c = api.edDuplicar(a.id);
    ok(c && c.texto === a.texto, "L5 duplicar nao copiou o texto");
    ok(c && Object.keys(c.progresso).length === 0,
       "L5b duplicar trouxe o progresso junto — isso mente sobre o que foi estudado");
    ok(c && c.id !== a.id, "L5c a copia ficou com o mesmo id do original");
  }

  /* ---- L6: apagar não leva os outros junto ---- */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const a = api.edCriar("A", CAB("A", "2026-09-10") + CORPO);
    api.edCriar("B", CAB("B", "2026-09-10") + CORPO);
    api.edAbrir(a.id);
    api.edApagar(a.id);
    ok(api.editais.length === 1 && api.editais[0].nome === "B",
       "L6 apagar um edital levou o outro junto");
    ok(api.edAberto() === null,
       "L6b apagar o edital aberto deixou a tela apontando para o que nao existe");
  }

  /* ---- L7: urgência ordena entre editais ----
   * Peso 5 numa prova sem data nao vale o mesmo que peso 4 numa prova em
   * tres semanas. Sem esse ajuste, a agenda da semana ordena por um numero
   * que ignora a unica coisa que nao da para negociar: o calendario. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const perto = api.edSituacao({ texto: CAB("x", "2026-08-30") }, "2026-08-16");
    const longe = api.edSituacao({ texto: CAB("y", "2027-06-01") }, "2026-08-16");
    const nada = api.edSituacao({ texto: CAB("z", null) }, "2026-08-16");
    const velho = api.edSituacao({ texto: CAB("w", "2020-01-01") }, "2026-08-16");
    ok(api.edUrgencia(perto) > api.edUrgencia(longe),
       "L7 prova em duas semanas nao ficou mais urgente que prova em 10 meses");
    ok(api.edUrgencia(nada) < api.edUrgencia(longe),
       "L7b edital sem data devia pesar MENOS que um com data marcada");
    ok(api.edUrgencia(velho) === 0,
       "L7c prova que ja passou continua disputando espaco na semana");
  }

  /* ---- L8: a agenda junta editais e sabe de qual veio cada linha ----
   * Sem o nome do concurso na linha, a agenda vira um amontoado em que a
   * pessoa nao sabe para que prova esta estudando. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    api.edCriar("TCE", CAB("TCE", "2026-09-10") + CORPO);
    api.edCriar("TCU", CAB("TCU", "2026-10-20") + CORPO);
    api.edCriar("Passado", CAB("Passado", "2020-01-01") + CORPO);
    const it = api.edTopicosAtivos({ hoje: "2026-08-16" });
    ok(it.length > 0, "L8 a agenda de varios editais veio vazia");
    ok(it.every((i) => i.editalNome),
       "L8b tem linha na agenda sem dizer de qual concurso e");
    const nomes = [...new Set(it.map((i) => i.editalNome))].sort();
    ok(nomes.join(",") === "TCE,TCU",
       `L8c a agenda devia juntar so os ativos, veio: ${nomes.join(",")}`);
    /* ordenacao: o mais urgente com o mesmo peso vem antes */
    const tce = it.findIndex((i) => i.editalNome === "TCE");
    const tcu = it.findIndex((i) => i.editalNome === "TCU");
    ok(tce < tcu, "L8d com pesos iguais, a prova mais proxima devia vir primeiro");
  }

  /* ---- L9: a agenda de topo precisa de DIA e HORA ----
   * Ao subir para o topo, o agendamento ficou para tras: as linhas vinham
   * sem "quinta, 19:00". Uma agenda sem horario e uma lista. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    api.edCriar("TCE", CAB("TCE", "2026-09-10") + CORPO);
    const it = api.edTopicosAtivos({ hoje: "2026-08-16" });
    const sem = it.slice(0, 5);
    api.agendar(sem, { dias: 5, inicio: "19:00" });
    ok(sem.every((i) => i.dia && i.hora),
       "L9 tem item da agenda sem dia ou sem horario sugerido");
    ok(sem[0].hora === "19:00",
       `L9b o primeiro item devia comecar no horario escolhido, veio ${sem[0].hora}`);

    /* mudar o comeco do dia tem de mover TUDO */
    const outro = it.slice(0, 5);
    api.agendar(outro, { dias: 5, inicio: "06:30" });
    ok(outro[0].hora === "06:30",
       `L9c mudar o comeco do dia nao mudou a agenda (veio ${outro[0].hora})`);

    /* menos dias na semana concentra mais coisa por dia */
    const a5 = it.slice(0, 10); api.agendar(a5, { dias: 5, inicio: "19:00" });
    const a2 = it.slice(0, 10); api.agendar(a2, { dias: 2, inicio: "19:00" });
    const dias5 = new Set(a5.map((i) => i.dia)).size;
    const dias2 = new Set(a2.map((i) => i.dia)).size;
    ok(dias2 <= dias5,
       `L9d reduzir dias/semana devia concentrar, nao espalhar (${dias2} vs ${dias5})`);
  }

  /* ---- S: A SEMANA DE ESTUDO (D4.1) — os mesmos dias da agenda, segunda a domingo ---- */
  {
    const { api } = carregar();
    ok(api.edDiasDeEstudo(5).join() === "seg,ter,qua,qui,sex" && api.edDiasDeEstudo(6).join() === "seg,ter,qua,qui,sex,sáb" && api.edDiasDeEstudo(7).join() === "seg,ter,qua,qui,sex,sáb,dom" && api.edDiasDeEstudo(1).join() === "seg", "S1 os dias de estudo: 5 = segunda a sexta; sábado e domingo só com 6 e 7");
    ok(api.edDiasDeEstudo().join() === api.edDiasDeEstudo(5).join() && api.edDiasDeEstudo(99).length === 7 && api.edDiasDeEstudo(-3).length === 1, "S1b sem número vale 5; os extremos são presos entre 1 e 7");
    const it = [{ dia: "seg", minutos: 40 }, { dia: "seg", minutos: 20 }, { dia: "qua", minutos: 30 }, { minutos: 99 }];
    const pv = api.edPrevistoPorDia(it);
    ok(pv.seg === 60 && pv.qua === 30 && Object.keys(pv).length === 2 && api.edPrevistoPorDia(null).seg === undefined, "S2 o previsto por dia soma o que a agenda pôs em cada dia (linha sem dia não conta)");
    /* a agenda de verdade só usa os dias de estudo */
    api.edCarregarLista();
    api.edCriar("TCE", CAB("TCE", "2026-09-10") + CORPO);
    const itens = api.edTopicosAtivos({ hoje: "2026-08-16" }).slice(0, 8);
    api.agendar(itens, { dias: 3, inicio: "19:00" });
    ok(itens.every((i) => api.edDiasDeEstudo(3).indexOf(i.dia) >= 0), "S2b agendar() e edDiasDeEstudo() concordam: " + itens.map((i) => i.dia).join());

    /* quinta, 01/10/2026: a semana é 28/09 a 04/10 */
    const HOJE = "2026-10-01";
    const diario = [
      { d: "2026-09-28", m: 40, a: "feito" }, { d: "2026-09-28", m: 20, a: "revisado" },
      { d: "2026-09-30", m: 30, a: "feito" },
      { d: "2026-10-03", m: 45, a: "feito" },
      { d: "2026-09-29", m: 50, a: "pendente" },
      { d: "2026-09-27", m: 100, a: "feito" },
      { d: "?", m: 70, a: "feito" },
      { d: "2026-10-05", m: 80, a: "feito" },
    ];
    const prev = { seg: 60, ter: 60, qua: 60, qui: 60, sex: 60 };
    const S = api.edSemanaDeEstudo(HOJE, 5, diario, prev);
    ok(S.semana.ini === "2026-09-28" && S.semana.fim === "2026-10-04" && S.dias.map((d) => d.cod).join() === "seg,ter,qua,qui,sex,sáb,dom", "S3 a semana vai de segunda a domingo, nesta ordem: " + S.dias.map((d) => d.cod + d.iso.slice(8)).join());
    ok(S.dias.map((d) => d.estado).join() === "passado,passado,passado,hoje,futuro,futuro,futuro" && S.dias.map((d) => d.estudo).join() === "true,true,true,true,true,false,false", "S3b passado, hoje e futuro; sábado e domingo são folga com 5 dias");
    ok(S.dias[0].feitoMin === 60 && S.dias[0].registros === 2 && S.dias[1].feitoMin === 0 && S.dias[2].feitoMin === 30 && S.dias[5].feitoMin === 45 && S.dias[5].estudo === false && S.dias[5].previstoMin === 0, "S3c o feito de cada dia; o estudo na folga aparece (extra); 'desmarcou', domingo passado, data '?' e semana seguinte não entram: " + S.dias.map((d) => d.feitoMin).join());
    ok(S.metaMin === 300 && S.feitoMin === 135 && S.pct === 45 && S.faltaMin === 165 && S.metaDiaMin === 60, "S3d totais: meta 5h, feito 2h15, 45%, falta 2h45, meta do dia 1h: " + JSON.stringify([S.metaMin, S.feitoMin, S.pct, S.faltaMin, S.metaDiaMin]));
    ok(S.restantes.join() === "qui,sex" && S.diasRestantes === 2 && S.porDiaNecessario === 83, "S3e restam quinta (hoje) e sexta; para fechar, 83 min por dia: " + S.restantes.join() + " " + S.porDiaNecessario);
    ok(api.edSemanaDeEstudo(HOJE, 5, diario, prev, 120).faltaMin === 0 && api.edSemanaDeEstudo(HOJE, 5, diario, prev, 120).porDiaNecessario === 0 && api.edSemanaDeEstudo(HOJE, 5, diario, prev, 120).pct === 113, "S4 meta batida: falta 0, nada por dia, pct passa de 100");
    ok(api.edSemanaDeEstudo(HOJE, 5, diario, prev, 0).pct === null && api.edSemanaDeEstudo(HOJE, 5, diario, prev, 0).metaMin === 0, "S4b meta 0 não divide: pct nulo");
    const comFolga = api.edSemanaDeEstudo(HOJE, 5, diario, Object.assign({ sáb: 60 }, prev));
    ok(comFolga.dias[5].previstoMin === 0 && comFolga.metaMin === 300, "S4c o que a agenda pôs num dia FORA dos dias de estudo não vira meta (sábado com 5 dias)");
    /* fim de semana */
    const sab = api.edSemanaDeEstudo("2026-10-03", 5, diario, prev);
    ok(sab.restantes.length === 0 && sab.diasRestantes === 0 && sab.porDiaNecessario === null && sab.faltaMin === 165 && sab.dias[5].estado === "hoje", "S5 sábado com 5 dias: não há dia de estudo restante, e nada por dia (null, não divisão por zero)");
    ok(api.edSemanaDeEstudo("2026-10-03", 6, diario, Object.assign({ sáb: 60 }, prev)).restantes.join() === "sáb", "S5b com 6 dias o sábado volta a ser dia de estudo");
    const dom = api.edSemanaDeEstudo("2026-10-04", 5, diario, prev);
    ok(dom.semana.ini === "2026-09-28" && dom.dias[6].estado === "hoje" && dom.dias[6].cod === "dom", "S5c domingo ainda é a semana que começou na segunda anterior");
    const vazio = api.edSemanaDeEstudo(HOJE, 5, null, null);
    ok(vazio.feitoMin === 0 && vazio.metaMin === 0 && vazio.pct === null && vazio.dias.length === 7 && vazio.porDiaNecessario === 0, "S6 sem diário e sem agenda: tudo zerado, sem quebrar");
  }

  /* ---- M: O MAPA DE CALOR (D4.3) ---- */
  {
    const { api } = carregar();
    ok(api.edNivelDeCalor(0, 60) === 0 && api.edNivelDeCalor(29, 60) === 1 && api.edNivelDeCalor(30, 60) === 2 && api.edNivelDeCalor(59, 60) === 2 && api.edNivelDeCalor(60, 60) === 3 && api.edNivelDeCalor(74, 60) === 3 && api.edNivelDeCalor(75, 60) === 4 && api.edNivelDeCalor(10, 0) === 1, "M1 níveis pela meta do dia: 0 nada · <50% · até 99% · bateu · 125%+ (e sem régua, qualquer estudo é nível 1)");
    ok(api.edNivelDeCalor(15, 60, true) === 1 && api.edNivelDeCalor(16, 60, true) === 2 && api.edNivelDeCalor(30, 60, true) === 2 && api.edNivelDeCalor(31, 60, true) === 3 && api.edNivelDeCalor(45, 60, true) === 3 && api.edNivelDeCalor(46, 60, true) === 4, "M1b níveis relativos ao melhor dia: 25% · 50% · 75% · acima");
    const HOJE = "2026-10-01";
    const diario = [
      { d: "2026-10-01", m: 30, a: "feito" }, { d: "2026-09-30", m: 60, a: "feito" }, { d: "2026-09-29", m: 20, a: "feito" },
      { d: "2026-09-28", m: 45, a: "revisado" }, { d: "2026-09-27", m: 80, a: "feito" },
      { d: "2026-09-29", m: 500, a: "pendente" }, { d: "?", m: 900, a: "feito" },
    ];
    const M = api.edMapaDeCalor(HOJE, 5, diario, { metaMin: 300, semanas: 3 });
    ok(M.semanas.length === 3 && M.semanas.map((s) => s.ini).join() === "2026-09-28,2026-09-21,2026-09-14" && M.semanas[0].fim === "2026-10-04", "M2 as semanas vêm da mais recente para a mais antiga, de segunda a domingo");
    ok(M.semanas[0].dias.map((d) => d.cod).join() === "seg,ter,qua,qui,sex,sáb,dom" && M.semanas[0].dias.map((d) => d.estudo).join() === "true,true,true,true,true,false,false", "M2b os dias, na ordem e com os dias de estudo da agenda");
    ok(M.escala === "meta" && M.metaDiaMin === 60 && M.semanas[0].dias.map((d) => d.nivel).join() === "2,1,3,2,0,0,0", "M3 níveis da semana atual contra a meta do dia (60): " + M.semanas[0].dias.map((d) => d.nivel).join());
    ok(M.semanas[0].dias.map((d) => d.futuro).join() === "false,false,false,false,true,true,true" && M.semanas[0].dias[3].hoje === true, "M3b hoje marcado; dias seguintes são futuro (sem nível)");
    ok(api.edMapaDeCalor(HOJE, 5, [{ d: "2026-10-02", m: 100, a: "feito" }], { metaMin: 300, semanas: 1 }).semanas[0].dias[4].nivel === 0, "M3c dia futuro nunca tem nível, mesmo com registro datado nele");
    ok(M.semanas[1].dias[6].feitoMin === 80 && M.semanas[1].dias[6].nivel === 4 && M.semanas[1].dias[6].estudo === false, "M4 estudar numa folga aparece e conta (domingo, 80 min, nível 4)");
    ok(M.semanas[0].totalMin === 155 && M.semanas[0].pct === 52 && M.semanas[1].totalMin === 80 && M.semanas[1].pct === 27 && M.semanas[2].totalMin === 0 && M.semanas[2].pct === 0, "M5 total e % da semana contra a meta (155/300 = 52%); 'desmarcou' e data '?' não entram");
    const R = api.edMapaDeCalor(HOJE, 5, diario, { metaMin: 300, semanas: 3, relativa: true });
    ok(R.escala === "relativa" && R.maxDiaMin === 80 && R.metaDiaMin === 0 && R.semanas[0].pct === null && R.semanas[1].dias[6].nivel === 4 && R.semanas[0].dias[2].nivel === 3 && R.semanas[0].dias[0].nivel === 3 && R.semanas[0].dias[3].nivel === 2 && R.semanas[0].dias[1].nivel === 1, "M6 escala relativa (o melhor dia do período é a régua; sem %): " + R.semanas[0].dias.map((d) => d.nivel).join());
    ok(api.edMapaDeCalor(HOJE, 5, diario, { metaMin: 0, semanas: 3 }).escala === "relativa", "M6b sem meta a escala é relativa sozinha");
    ok(api.edMapaDeCalor(HOJE, 5, diario, { semanas: 0 }).semanas.length === 8 && api.edMapaDeCalor(HOJE, 5, diario, { semanas: 999 }).semanas.length === 52 && api.edMapaDeCalor(HOJE, 5, null, null).semanas.length === 8, "M7 número de semanas: padrão 8, no máximo 52, e aguenta diário vazio");
    ok(api.edMapaDeCalor("2026-10-04", 5, [], { semanas: 1 }).semanas[0].ini === "2026-09-28" && api.edMapaDeCalor(HOJE, 6, [], { metaMin: 360, semanas: 1 }).metaDiaMin === 60, "M8 domingo ainda é a semana de segunda; com 6 dias a meta do dia divide por 6");
  }

  /* ---- O: DISCIPLINAS OPTATIVAS — "escolha 1 de N" (X1, 17.86.0) ----
   * O caso real: CFO PM-PE manda escolher Língua Estrangeira ESPANHOL ou INGLÊS, e o app contava as duas. */
  {
    const { api } = carregar();
    const CFO = [
      "# CFO PM-PE | prova: 2027-02-21 | horas: 20",
      "& Conhecimentos | minimo: 50%",
      "@ Direito Penal :: 10q", "+ Lei penal :: 5",
      "@ Língua Portuguesa :: 10q", "+ Crase :: 3",
      "@ Língua Estrangeira Espanhol :: 5q | escolha: Língua Estrangeira", "+ Gramática :: 3",
      "@ Língua Estrangeira Inglês :: 5q | escolha: Língua Estrangeira", "+ Grammar :: 3",
    ].join("\n");
    const plano = (txt) => api.montarPlano(api.lerEdital(txt), { horas: 20, prova: "2027-02-21", hoje: "2026-10-01", feitos: {}, fatores: null, acertos: null });
    const r0 = api.lerEdital(CFO);
    ok(r0.optativas.length === 1 && r0.optativas[0].nome === "Língua Estrangeira" && r0.optativas[0].opcoes.join() === "Língua Estrangeira Espanhol,Língua Estrangeira Inglês" && r0.optativas[0].escolhida === "", "O1 duas disciplinas com a mesma chave 'escolha:' formam UM grupo, ainda sem escolha");
    ok(r0.disciplinas.length === 4 && r0.disciplinas.every((d) => !d.inativa) && r0.disciplinas[2].nome === "Língua Estrangeira Espanhol" && r0.disciplinas[2].abs === 5 && r0.disciplinas[2].optativa === "Língua Estrangeira", "O1b o sufixo '| escolha:' não suja o nome nem o peso (5q), e nenhuma está inativa sem escolha");
    const p0 = plano(CFO);
    ok(p0.itens.length === 4 && p0.itens.filter((i) => /Estrangeira/.test(i.disciplina)).length === 2, "O2 SEM escolha, as duas contam no plano (provisório)");
    ok(api.edEscolhasPendentes(r0).length === 1 && api.diagnosticoPlano(r0, p0).some((a) => a.id === "escolha_pendente" && !a.grave && /Espanhol ou Língua Estrangeira Inglês/.test(a.msg)), "O2b sem escolha há uma pendência e o diagnóstico avisa (sem ser grave)");

    const ESP = api.edDefinirEscolha(CFO, "Língua Estrangeira", "Língua Estrangeira Espanhol");
    ok(/^# CFO PM-PE \| prova: 2027-02-21 \| horas: 20 \| escolhas: Língua Estrangeira=Língua Estrangeira Espanhol\n/.test(ESP), "O3 a escolha vai para o CABEÇALHO, sem mexer no resto do texto: " + ESP.split("\n")[0]);
    ok(ESP.split("\n").slice(1).join("\n") === CFO.split("\n").slice(1).join("\n"), "O3b só a linha do cabeçalho muda");
    const r1 = api.lerEdital(ESP);
    ok(r1.cfg.escolhas["Língua Estrangeira"] === "Língua Estrangeira Espanhol" && r1.disciplinas[2].inativa === false && r1.disciplinas[3].inativa === true && r1.optativas[0].escolhida === "Língua Estrangeira Espanhol" && api.edEscolhasPendentes(r1).length === 0, "O4 escolhido o Espanhol, o Inglês fica INATIVO (no texto, fora do plano) e a pendência some");
    const p1 = plano(ESP);
    ok(p1.itens.length === 3 && !p1.itens.some((i) => /Inglês/.test(i.disciplina)), "O5 o plano NÃO tem a optativa não escolhida: " + p1.itens.map((i) => i.disciplina).join());
    const fat = {}; p1.itens.forEach((i) => { fat[i.disciplina] = p1.fatia ? p1.fatia[i.disciplina] : i.fatia; });
    ok(p1.fatia && p1.fatia["Direito Penal"] === 40 && p1.fatia["Língua Portuguesa"] === 40 && p1.fatia["Língua Estrangeira Espanhol"] === 20 && p1.fatia["Língua Estrangeira Inglês"] === undefined, "O6 a fatia da prova sai SEM a não escolhida (10+10+5 = 25 questões: 40% · 40% · 20%): " + JSON.stringify(p1.fatia));
    const INGLES = api.edDefinirEscolha(ESP, "língua estrangeira", "Língua Estrangeira Inglês");
    ok(/escolhas: Língua Estrangeira=Língua Estrangeira Inglês/.test(INGLES) && !/Espanhol$/m.test(INGLES.split("\n")[0]) && api.lerEdital(INGLES).disciplinas[2].inativa === true, "O7 trocar a escolha reescreve a mesma chave (sem duplicar) e inverte quem está ativo");
    ok(!/escolhas/.test(api.edDefinirEscolha(ESP, "Língua Estrangeira", "")) && api.edDefinirEscolha(CFO, "Língua Estrangeira", "").split("\n")[0] === "# CFO PM-PE | prova: 2027-02-21 | horas: 20", "O7b escolha vazia tira a escolha");
    ok(api.edDefinirEscolha("@ A :: 3\n+ t :: 3", "G", "A").split("\n")[0] === "# escolhas: G=A", "O7c sem cabeçalho o app cria um só com a escolha");
    const f2 = api.edDefinirEscolha("# fase 2: discursiva | prova: 2027-03-01\n# X | prova: 2027-02-01\n@ A :: 3", "G", "A").split("\n");
    ok(f2[0] === "# fase 2: discursiva | prova: 2027-03-01" && /escolhas: G=A/.test(f2[1]), "O7d a linha de 'fase 2' não é tomada pelo cabeçalho: " + f2.slice(0, 2).join(" // "));

    /* o bloco com mínimo absoluto não conta as questões da não escolhida */
    const BL = ["# B | prova: 2027-02-21 | horas: 20", "& Específicos | minimo: 9",
      "@ Penal :: 10q", "+ a :: 3", "@ Espanhol :: 5q | escolha: Língua", "+ g :: 3", "@ Inglês :: 5q | escolha: Língua", "+ h :: 3"].join("\n");
    const minDe = (txt) => api.montarPlano(api.lerEdital(txt), { horas: 20, prova: "2027-02-21", hoje: "2026-10-01", feitos: {}, fatores: null, acertos: null }).blocos[0].minPct;
    ok(minDe(BL) === 45 && minDe(api.edDefinirEscolha(BL, "Língua", "Espanhol")) === 60, "O8 o mínimo absoluto do bloco (9 questões) vira % sobre as questões que VALEM: 45% com as duas optativas (20q) e 60% com só uma (15q): " + minDe(BL) + " / " + minDe(api.edDefinirEscolha(BL, "Língua", "Espanhol")));

    ok(JSON.stringify(api.edLerEscolhas("a=b; solto; c=; =d; e = f ")) === JSON.stringify({ a: "b", e: "f" }), "O11b o cabeçalho ignora pares sem '=' ou com um lado vazio: " + JSON.stringify(api.edLerEscolhas("a=b; solto; c=; =d; e = f ")));
    /* o peso derivado das questões NÃO usa a não escolhida como régua */
    const REG = ["# R | escolhas: L=Esp", "@ Penal :: 10q", "+ a :: 3", "@ Port :: 10q", "+ b :: 3", "@ Esp :: 5q | escolha: L", "+ c :: 3", "@ Ing :: 40q | escolha: L", "+ d :: 3"].join("\n");
    const rr = api.lerEdital(REG);
    ok(rr.disciplinas[0].peso === 5 && rr.disciplinas[2].peso === 3 && rr.disciplinas[3].inativa === true, "O12 sem a Inglês (40q, inativa) a régua é a maior das ativas (10q): Penal vale 5, Esp 3; com ela valeria 2: " + rr.disciplinas.map((d) => d.nome + ":" + d.peso).join());
    /* o diagnóstico não aponta defeito na não escolhida */
    const DG = ["# D | escolhas: L=Esp", "@ Penal :: 3", "+ a :: 3", "+ b :: 3", "+ c :: 3", "@ Esp :: 3 | escolha: L", "+ d :: 3", "+ e :: 3", "@ Ing :: 3 | escolha: L", "+ f :: 3"].join("\n");
    const rd = api.lerEdital(DG);
    const dg = api.diagnosticoPlano(rd, api.montarPlano(rd, { horas: 10, prova: "2027-02-21", hoje: "2026-10-01", feitos: {}, fatores: null, acertos: null }));
    ok(!dg.some((x) => /Ing/.test(x.msg)) && api.diagnosticoPlano(api.lerEdital(DG.replace("escolhas: L=Esp", "x: 1")), api.montarPlano(api.lerEdital(DG.replace("escolhas: L=Esp", "x: 1")), { horas: 10, prova: "2027-02-21", hoje: "2026-10-01", feitos: {}, fatores: null, acertos: null })).some((x) => /Ing/.test(x.msg)), "O13 o diagnóstico não fala da optativa NÃO escolhida (um único tópico dela não é 'granularidade'), mas fala quando ainda não há escolha: " + dg.map((x) => x.id).join());
    /* ida e volta: o texto reescrito mantém a escolha e as marcas de grupo */
    const volta = api.edParaTexto(api.lerEdital(ESP));
    ok(/escolhas: Língua Estrangeira=Língua Estrangeira Espanhol/.test(volta) && (volta.match(/\| escolha: Língua Estrangeira/g) || []).length === 2, "O9 edParaTexto devolve a escolha e as duas marcas '| escolha:' (a reescrita de rotina não apaga)");
    const r2 = api.lerEdital(volta);
    ok(r2.optativas[0].escolhida === "Língua Estrangeira Espanhol" && r2.disciplinas.filter((d) => d.inativa).length === 1, "O9b o texto reescrito lê igual");

    /* defeitos do texto */
    const ruim = api.lerEdital("# X\n@ A :: 3 | escolha: Língua\n+ t :: 3\n@ B :: 3\n+ u :: 3");
    ok(ruim.achados.some((a) => a.tipo === "escolha_um_so") && ruim.optativas.length === 0 && !ruim.disciplinas[0].inativa, "O10 um grupo de escolha com UMA opção só é apontado e não desativa nada");
    ok(api.lerEdital(CFO.replace("horas: 20", "horas: 20 | escolhas: Outro=Nada")).achados.some((a) => a.tipo === "escolha_grupo_inexistente") && api.lerEdital(CFO.replace("horas: 20", "horas: 20 | escolhas: Língua Estrangeira=Alemão")).achados.some((a) => a.tipo === "escolha_disciplina_inexistente"), "O10b escolha para grupo ou disciplina que não existe é apontada");
    ok(api.lerEdital(CFO.replace("horas: 20", "horas: 20 | escolhas: Língua Estrangeira=Alemão")).disciplinas.every((d) => !d.inativa), "O10c escolha inválida não desativa ninguém (o aluno vê as duas até corrigir)");
    ok(api.lerEdital("@ A :: 3 | outra: coisa\n+ t :: 3").disciplinas[0].escolha === "" && api.lerEdital("# X | escolhas: a=b; c=d\n@ A :: 3\n+ t :: 3").cfg.escolhas.c === "d", "O11 outra barra vertical não vira 'escolha'; várias escolhas no cabeçalho se separam por ponto e vírgula");
  }

  /* ---- OS: GRUPO DE ESCOLHA SUSPEITO (X5, 17.90.0) ----
   * O caso real: a IA pôs "| escolha: Conhecimentos Básicos" nas CINCO disciplinas obrigatórias de um bloco. */
  {
    const { api } = carregar();
    const CAM = (extra) => ["# Câmara | prova: 2027-01-17 | horas: 8" + (extra || ""),
      "& Conhecimentos Básicos | minimo: 18p",
      "@ Língua Portuguesa :: 90p | escolha: Conhecimentos Básicos", "+ a :: 3",
      "@ Língua Inglesa :: 90p | escolha: Conhecimentos Básicos", "+ b :: 3",
      "@ Direito Administrativo :: 90p | escolha: Conhecimentos Básicos", "+ c :: 3",
      "@ Direito Constitucional :: 90p | escolha: Conhecimentos Básicos", "+ d :: 3",
      "@ Tecnologia da Informação :: 90p | escolha: Conhecimentos Básicos", "+ e :: 3",
      "& Conhecimentos Específicos | minimo: 27p", "@ Linguística :: 90p", "+ f :: 4"].join("\n");
    const r = api.lerEdital(CAM());
    ok(r.optativas.length === 0 && r.disciplinas.every((d) => !d.inativa && !d.optativa) && r.achados.filter((a) => a.tipo === "escolha_suspeita").length === 1 && r.achados.find((a) => a.tipo === "escolha_suspeita").txt === "Conhecimentos Básicos", "OS1 a chave que é o NOME DO BLOCO não vale: nenhum grupo, nenhuma disciplina inativa, e o leitor aponta (1 achado)");
    const rEsc = api.lerEdital(CAM(" | escolhas: Conhecimentos Básicos=Língua Portuguesa"));
    ok(rEsc.disciplinas.every((d) => !d.inativa), "OS1b mesmo com 'escolhas:' no cabeçalho nenhuma obrigatória é desativada (o app não deixa quatro matérias fora do plano)");
    const pl = api.montarPlano(r, { horas: 8, prova: "2027-01-17", hoje: "2026-10-01", feitos: {}, fatores: null, acertos: null });
    ok(pl.itens.length === 6, "OS1c as seis disciplinas continuam no plano: " + pl.itens.length);
    const q = api.edQualidadeLeitura(r);
    ok(q.provisorio === true && q.motivos.some((m) => m.id === "escolha_suspeita" && m.nomes[0] === "Conhecimentos Básicos"), "OS2 o veredito de leitura traz o motivo 'escolha_suspeita' (plano provisório)");
    ok(api.diagnosticoPlano(r, pl).some((a) => a.id === "escolha_suspeita" && !a.grave && /nome de um bloco/.test(a.msg)), "OS2b o diagnóstico explica: parece nome de bloco, o app manteve todas");
    /* outros jeitos de suspeitar */
    const DOIS = ["# X", "& Básicos | minimo: 50%", "@ A :: 3 | escolha: Básicos", "+ a :: 3", "@ B :: 3 | escolha: Básicos", "+ b :: 3"].join("\n");
    ok(api.lerEdital(DOIS).optativas.length === 0 && api.lerEdital(DOIS).achados.some((a) => a.tipo === "escolha_suspeita"), "OS3 chave igual ao nome do bloco é suspeita mesmo com só 2 opções");
    const QUATRO = ["# X", "@ A :: 3 | escolha: Idioma", "+ a :: 3", "@ B :: 3 | escolha: Idioma", "+ b :: 3", "@ C :: 3 | escolha: Idioma", "+ c :: 3", "@ D :: 3 | escolha: Idioma", "+ d :: 3"].join("\n");
    ok(api.lerEdital(QUATRO).optativas.length === 0 && api.lerEdital(QUATRO).achados.some((a) => a.tipo === "escolha_suspeita"), "OS4 um grupo de escolha com 4 opções é suspeito (raramente é escolha de verdade)");
    const TRES = QUATRO.split("\n").slice(0, 7).join("\n");
    ok(api.lerEdital(TRES).optativas.length === 1 && api.lerEdital(TRES).optativas[0].opcoes.length === 3, "OS4b com 3 opções ainda vale");
    const BLOCO = ["# X", "& Básicos | minimo: 50%", "@ A :: 3 | escolha: Grupo", "+ a :: 3", "@ B :: 3 | escolha: Grupo", "+ b :: 3", "@ C :: 3 | escolha: Grupo", "+ c :: 3"].join("\n");
    ok(api.lerEdital(BLOCO).optativas.length === 0, "OS5 um grupo que é o bloco INTEIRO (3+ disciplinas) é suspeito, mesmo com outra chave");
    const IDIOMAS = ["# X", "& Idiomas | minimo: 5", "@ A :: 3 | escolha: Língua", "+ a :: 3", "@ B :: 3 | escolha: Língua", "+ b :: 3"].join("\n");
    ok(api.lerEdital(IDIOMAS).optativas.length === 1 && !api.lerEdital(IDIOMAS).achados.some((a) => a.tipo === "escolha_suspeita"), "OS5b um bloco de só 2 disciplinas que SÃO o par de opções (chave diferente do nome do bloco) continua sendo escolha de verdade");
    const PAR = ["# X", "& Específicos | minimo: 50%", "@ P :: 3", "+ p :: 3", "@ A :: 3 | escolha: Língua", "+ a :: 3", "@ B :: 3 | escolha: Língua", "+ b :: 3"].join("\n");
    ok(api.lerEdital(PAR).optativas.length === 1 && !api.lerEdital(PAR).achados.some((a) => a.tipo === "escolha_suspeita"), "OS6 um par de idiomas DENTRO de um bloco com outras disciplinas continua sendo escolha de verdade");
  }

  /* ---- L10: colar plano corrigido tem de dizer o que se PERDE ----
   * O aviso antigo olhava so a contagem de topicos. Um plano com o mesmo
   * numero de topicos, mas com um deles renomeado, passava calado — e a
   * marca de estudado daquele topico ia junto, porque o progresso e
   * guardado por "disciplina›topico". */
  {
    const { api } = carregar();
    const antes = ["# X | prova: 2026-12-30 | horas: 10", "@ Financeiro :: 5",
      "+ Receita :: 5 :: pq", "+ Despesa :: 4 :: pq",
      "@ Civil :: 2", "+ Contratos :: 3 :: pq"].join("\n");
    const depois = ["# X | prova: 2026-12-30 | horas: 10", "@ Financeiro :: 3",
      "+ Receita publica :: 5 :: pq", "+ Despesa :: 4 :: pq",
      "@ Penal :: 4", "+ Crimes :: 3 :: pq"].join("\n");
    const prog = { "financeiro›receita": { e: "feito" } };
    const c = api.edCompararColagem(antes, depois, prog);

    ok(c.topicosAntes === 3 && c.topicosDepois === 3,
       `L10 contagem errada: ${c.topicosAntes} → ${c.topicosDepois}`);
    ok(c.orfaos.length === 1 && c.orfaos[0].t === "Receita",
       "L10b nao detectou o topico ESTUDADO que sumiu com a renomeacao");
    ok(c.grave === true,
       "L10c mesmo numero de topicos e progresso perdido nao foi marcado como grave");
    ok(c.pesosMudam.length === 1 && c.pesosMudam[0].de === 5 && c.pesosMudam[0].para === 3,
       "L10d a mudanca de peso da disciplina passou despercebida");
    ok(c.discSomem.join() === "Civil" && c.discSurgem.join() === "Penal",
       `L10e disciplinas: somem=${c.discSomem} surgem=${c.discSurgem}`);

    /* topico que some SEM estar marcado nao e perda de progresso: avisar com
     * o mesmo peso de alarme faz a pessoa aprender a ignorar o alarme */
    const c2 = api.edCompararColagem(antes, depois, {});
    ok(c2.orfaos.length === 0 && c2.grave === false,
       "L10f sem progresso marcado, a troca nao devia ser tratada como grave");

    /* colar texto sem topico nenhum apagaria o edital inteiro */
    const c3 = api.edCompararColagem(antes, "isto aqui nao e um edital", {});
    ok(c3.vazio === true, "L10g texto sem topico nenhum nao foi barrado");

    /* plano identico: nada a perder */
    const c4 = api.edCompararColagem(antes, antes, prog);
    ok(c4.orfaos.length === 0 && c4.somem.length === 0 && c4.pesosMudam.length === 0,
       "L10h colar o mesmo plano acusou mudancas que nao existem");
  }

  /* ---- L11: a projeção — a única linha acionável do painel ---- */
  {
    const { api } = carregar();
    /* O cenario precisa APERTAR. Com 80 topicos em 15 semanas, qualquer
     * ritmo cobre tudo e a projecao satura em 100% — foi assim que a
     * primeira versao destes testes passou com a fila de prioridade
     * invertida e com o orcamento de tempo ignorado. Aqui: 240 topicos,
     * 4 semanas. */
    const L = ["# TCE | prova: 2026-09-13 | horas: 40"];
    for (let d = 1; d <= 16; d++) {
      L.push("@ D" + d + " :: " + (1 + (d % 5)));
      for (let k = 1; k <= 15; k++) L.push("+ T" + d + "-" + k + " :: " + (1 + ((d + k) % 5)) + " :: pq");
    }
    const r = api.lerEdital(L.join("\n"));
    const p = api.montarPlano(r, { horas: 40, prova: "2026-09-13", hoje: "2026-08-16", feitos: {} });
    const proj = (min) => api.acompanhamento(p, [{ d: "2026-08-10", m: min }], 40 * 60).projecao;

    /* H-B: sem registro nao se projeta. Um numero inventado com cara de dado
     * e pior que numero nenhum — a pessoa decide em cima dele. */
    const semReg = api.acompanhamento(p, [], 40 * 60);
    ok(semReg.projecao === null,
       "L11 projetou sem nenhum registro de estudo — isso e chute com cara de dado");
    ok(semReg.ritmo.medivel === false,
       "L11b disse que o ritmo e medivel sem nenhuma semana registrada");
    ok(proj(600) && proj(600).pesoPct > 0,
       "L11c com registro devia projetar onde o ritmo leva");

    /* L11c2 — a linha do ritmo e a da projecao nao podem discordar.
     * Um registro de 0 minutos fazia o painel dizer "fez 0min/semana (media
     * de 1 semana)" logo acima de "sem registro de estudo". Cada bloco
     * estava certo pela sua propria regra; juntos, mentiam. */
    const zerado = api.acompanhamento(p, [{ d: "2026-08-10", m: 0 }], 40 * 60);
    ok(zerado.ritmo.medivel === false,
       "L11c2 'media de 1 semana com 0min' foi tratada como ritmo medivel");
    ok((zerado.ritmo.medivel === false) === (zerado.projecao === null),
       "L11c3 o ritmo e a projecao discordam sobre haver registro");
    const comDados = api.acompanhamento(p, [{ d: "2026-08-10", m: 600 }], 40 * 60);
    ok((comDados.ritmo.medivel === true) === (comDados.projecao !== null),
       "L11c4 com registro real, ritmo e projecao continuam discordando");

    /* o cenario tem de estar apertado, senao os testes abaixo comparam
     * 100% com 100% e nao verificam nada */
    ok(proj(600).pesoPct < 90,
       `L11-pre o cenario nao aperta: 10h/sem ja cobre ${proj(600).pesoPct}%`);

    /* L11d — estudar mais nunca cobre menos */
    ok(proj(1800).pesoPct > proj(300).pesoPct,
       `L11d estudar 6x mais nao aumentou a cobertura (${proj(300).pesoPct}% vs ${proj(1800).pesoPct}%)`);

    /* L11e — o orcamento de tempo E respeitado: um ritmo pequeno nao pode
     * projetar a prova inteira */
    ok(proj(60).pesoPct < 100,
       `L11e 1h por semana projetou ${proj(60).pesoPct}% do peso — o tempo esta sendo ignorado`);
    ok(proj(99999).pesoPct <= 100,
       `L11e2 a projecao passou de 100% do peso (${proj(99999).pesoPct}%)`);

    /* H-E — a projecao segue a FILA DE PRIORIDADE.
     * Medir isso por limiar percentual e chute: topico de peso alto tambem
     * custa mais minutos, entao a vantagem de priorizar e real mas modesta,
     * e um limiar mal escolhido deixa passar a fila invertida (foi o que
     * aconteceu na primeira versao deste teste). Aqui a invariante e
     * verificada direto: nada que ficou de fora pesa mais que o mais leve
     * que entrou. */
    const pr = proj(300);
    ok(pr.menorDentro !== null && pr.maiorFora !== null,
       "L11f-pre o cenario devia deixar topicos dentro E fora");
    /* nota honesta: com muitos empates de peso, o corte pode cair no meio de
     * um grupo empatado e esta comparacao passa mesmo com a fila invertida.
     * Quem pega esse caso e o L11g, logo abaixo — os dois juntos e que
     * fecham a invariante, nao este sozinho. */
    ok(pr.maiorFora <= pr.menorDentro,
       `L11f a fila de prioridade nao foi respeitada: ficou de fora um topico `
       + `de peso ${pr.maiorFora} enquanto entrou um de peso ${pr.menorDentro}`);

    /* e a vantagem de priorizar existe: metade do tempo cobre mais que
     * metade do peso */
    const meio = proj(300).pesoPct, todo = proj(600).pesoPct;
    ok(meio >= todo * 0.5,
       `L11g metade do tempo cobriu menos que metade do peso (${meio}% de ${todo}%)`);
  }

  /* ---- L12: "cobrir tudo" e AVISO, nunca meta ----
   * O numero e so "minutos pendentes ÷ semanas": descreve a distancia ate a
   * prova, nao o estudo. O mesmo edital pede 164h/semana com a prova em 13
   * dias e 5h/semana com a prova em 6 meses. */
  {
    const { api } = carregar();
    const L = ["# X | prova: 2026-08-30 | horas: 60"];
    for (let k = 1; k <= 120; k++) L.push("+ T" + k + " :: 5 :: pq");
    const r = api.lerEdital(["@ Unica :: 5"].concat(L.slice(1)).join("\n"));
    const rr = api.lerEdital(L[0] + "\n@ Unica :: 5\n" + L.slice(1).join("\n"));
    /* 2h/semana: com a prova perto, boa parte NAO cabe — que e o unico
     * cenario em que o aviso tem o que dizer. Com 60h tudo cabia, e o teste
     * media o nada (foi o que ele me devolveu na primeira rodada). */
    const perto = api.montarPlano(rr, { horas: 2, prova: "2026-08-30", hoje: "2026-08-16", feitos: {} });
    const longe = api.montarPlano(rr, { horas: 2, prova: "2027-08-16", hoje: "2026-08-16", feitos: {} });
    const aPerto = api.acompanhamento(perto, [], 2 * 60);
    const aLonge = api.acompanhamento(longe, [], 2 * 60);
    ok(perto.fora.length > 0,
       "L12-pre o cenario de teste devia ter topicos de fora e nao tem");
    ok(aPerto.fora.horasParaTudo > aLonge.fora.horasParaTudo,
       "L12 o mesmo edital devia pedir MAIS horas por semana com a prova mais perto");
    ok(aLonge.fora.n < aPerto.fora.n,
       `L12b com um ano de prazo deviam sobrar MENOS de fora (${aLonge.fora.n} vs ${aPerto.fora.n})`);
    /* o que fica de fora e medido em PESO, nao so em contagem */
    ok(typeof aPerto.fora.pesoPct === "number" && aPerto.fora.pesoPct > 0,
       "L12c o que fica de fora nao esta medido em peso da prova");
  }

  /* ---- L13: comparativo entre editais (H4) ----
   * Somar a cobertura de dois concursos produz um numero que nao existe —
   * ninguem presta uma prova media. Com dois editais a pergunta muda para
   * "estou abandonando um deles?", e so uma linha por edital responde. */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const fab = (nome, prova, npd) => {
      const L = ["# " + nome + " | prova: " + prova + " | horas: 20"];
      for (let d = 1; d <= 6; d++) {
        L.push("@ D" + d + " :: " + (1 + (d % 5)));
        for (let k = 1; k <= npd; k++) L.push("+ T" + d + "-" + k + " :: " + (1 + ((d + k) % 5)) + " :: pq");
      }
      return api.edCriar(nome, L.join("\n"));
    };
    /* criados na ordem ERRADA de proposito: se o comparativo nao ordenar
     * pela data da prova, o teste passa por acidente da ordem de cadastro —
     * foi o que aconteceu na primeira versao deste bloco */
    fab("TCU", "2027-06-01", 14);
    fab("Encerrado", "2020-01-01", 5);
    fab("TCE-PE", "2026-08-29", 14);

    const diario = [
      { d: "2026-08-10", m: 390, cc: "TCE-PE" }, { d: "2026-08-03", m: 390, cc: "TCE-PE" },
      { d: "2026-08-10", m: 120, cc: "TCU" }, { d: "2026-08-03", m: 120, cc: "TCU" },
    ];
    const c = api.comparativoEditais(diario, "2026-08-16");

    ok(c.length === 2, `L13 o comparativo devia trazer so os ativos, trouxe ${c.length}`);
    ok(c[0].nome === "TCE-PE",
       `L13b a prova mais proxima devia vir primeiro, veio ${c[0].nome}`);

    /* o RITMO e por edital: o diario guarda o concurso em cada registro.
     * Sem isso, as 6h30 do TCE apareceriam tambem como ritmo do TCU e a
     * tabela diria que os dois vao bem. */
    ok(c[0].ritmoMin === 390 && c[1].ritmoMin === 120,
       `L13c o ritmo vazou entre editais: ${c[0].ritmoMin} / ${c[1].ritmoMin}`);

    /* a coluna que decide: onde cada prova chega no ritmo atual. A prova
     * perto com pouco tempo tem de projetar MENOS que a distante. */
    ok(c[0].projecao < c[1].projecao,
       `L13d a prova em 13 dias projetou mais que a de 289 dias `
       + `(${c[0].projecao}% vs ${c[1].projecao}%)`);

    /* registro sem concurso identificado conta para todos: e o caso dos
     * registros antigos, anteriores a v8.66. Melhor contar do que sumir. */
    const antigo = api.comparativoEditais([{ d: "2026-08-10", m: 300 }], "2026-08-16");
    ok(antigo.every((l) => l.ritmoMin === 300),
       "L13e registro antigo (sem concurso) deixou de contar para os editais");
  }

  /* ---- L14: escopo — o numero global e o do edital nao se confundem ---- */
  {
    const { api } = carregar();
    api.edCarregarLista();
    const L1 = ["# A | prova: 2026-10-30 | horas: 20", "@ X :: 5", "+ x1 :: 5 :: pq", "+ x2 :: 5 :: pq"];
    const L2 = ["# B | prova: 2026-10-30 | horas: 20", "@ Y :: 5", "+ y1 :: 5 :: pq"];
    const a = api.edCriar("A", L1.join("\n"));
    api.edCriar("B", L2.join("\n"));
    a.progresso["x›x1"] = { e: "feito" };
    api.edSalvarLista();

    const c = api.comparativoEditais([], "2026-08-16");
    const la = c.find((x) => x.nome === "A"), lb = c.find((x) => x.nome === "B");
    ok(la.pesoEstudado > 0 && lb.pesoEstudado === 0,
       `L14 a cobertura vazou entre editais: A=${la.pesoEstudado}% B=${lb.pesoEstudado}%`);
    ok(la.topicos === 2 && lb.topicos === 1,
       `L14b a contagem de topicos misturou os editais: ${la.topicos}/${lb.topicos}`);
  }

  /* ---- L15: incluir disciplina à mão ---- */
  {
    const { api } = carregar();
    const base = ["# X | prova: 2026-12-30 | horas: 10", "@ Financeiro :: 5",
      "+ Receita :: 5 :: pq", "+ Despesa :: 4 :: pq",
      "@ Civil :: 2", "+ Contratos :: 3 :: pq"].join("\n");

    const r = api.edIncluirDisciplina(base, "Direito Tributario", 4,
      "Especies tributarias :: 5 :: cai muito\nLegislacao\nDivida ativa :: 4");
    ok(!r.erro, "L15 a inclusao falhou: " + r.erro);
    ok(r.topicos === 3, `L15b esperava 3 topicos, veio ${r.topicos}`);

    /* o resultado tem de ser LIDO de volta igual: o edital mora no texto,
     * e escrever num formato que o proprio app nao le e o pior dos mundos */
    const lido = api.lerEdital(r.texto);
    const nova = lido.disciplinas.find((d) => d.nome === "Direito Tributario");
    ok(!!nova, "L15c a disciplina incluida nao foi relida do texto");
    ok(nova.peso === 4, `L15d o peso nao sobreviveu a ida e volta (${nova && nova.peso})`);
    ok(nova.topicos.length === 3, "L15e os topicos nao sobreviveram");
    /* Topico sem peso entra com 3 — e o TEXTO gerado tem de dizer "3",
     * nao "null". Checar so o objeto relido passava com "null" escrito no
     * arquivo, porque o leitor cai no padrao 3 de qualquer jeito: o defeito
     * ficava guardado no edital, invisivel, ate alguem abrir o texto. */
    ok(nova.topicos[1].peso === 3,
       `L15f topico sem peso devia entrar com 3, entrou com ${nova.topicos[1].peso}`);
    ok(!/::\s*(null|undefined|NaN)/.test(r.texto),
       "L15f2 o texto gerado tem peso invalido escrito nele: "
       + JSON.stringify((r.texto.match(/.*(null|undefined|NaN).*/) || [""])[0]));
    /* e o resto do edital continua inteiro */
    ok(lido.disciplinas.length === 3, "L15g incluir mexeu nas disciplinas que ja existiam");

    ok(api.edIncluirDisciplina(base, "", 3, "x").erro === "sem_nome",
       "L15h aceitou disciplina sem nome");
    ok(api.edIncluirDisciplina(base, "Nova", 3, "   ").erro === "sem_topicos",
       "L15i aceitou disciplina sem nenhum topico");
    ok(api.edIncluirDisciplina(base, "financeiro", 3, "x").erro === "repetida",
       "L15j aceitou uma disciplina com nome que ja existe");
  }

  /* ---- L16: excluir disciplina NAO apaga historico ----
   * O diario e o registro do que voce fez; historico nao se reescreve
   * porque o plano mudou. E as marcas ficam guardadas pela chave
   * "disciplina›topico": se a disciplina voltar, elas voltam com ela. */
  {
    const { api } = carregar();
    const base = ["# X | prova: 2026-12-30 | horas: 10", "@ Financeiro :: 5",
      "+ Receita :: 5 :: pq", "+ Despesa :: 4 :: pq",
      "@ Civil :: 2", "+ Contratos :: 3 :: pq"].join("\n");
    const prog = { "financeiro›receita": { e: "feito" } };

    const x = api.edExcluirDisciplina(base, "Financeiro", prog);
    ok(!x.erro, "L16 a exclusao falhou: " + x.erro);
    ok(x.topicos === 2 && x.marcados === 1,
       `L16b as contas da exclusao estao erradas: ${x.topicos}/${x.marcados}`);

    const lido = api.lerEdital(x.texto);
    ok(lido.disciplinas.length === 1 && lido.disciplinas[0].nome === "Civil",
       "L16c a exclusao levou junto a disciplina errada");
    /* os TOPICOS tem de sair junto com a disciplina. Tirar so a linha "@"
     * deixa os "+" orfaos no texto — e eles somem da leitura sem somem do
     * arquivo, que e o pior estado possivel: invisiveis e presentes. */
    const antesTop = api.lerEdital(base).disciplinas
      .reduce((a, d) => a + d.topicos.length, 0);
    const depoisTop = lido.disciplinas.reduce((a, d) => a + d.topicos.length, 0);
    ok(depoisTop === antesTop - x.topicos,
       `L16c2 sobraram topicos orfaos: ${antesTop} - ${x.topicos} ≠ ${depoisTop}`);
    ok(!/^\s*\+\s*Receita/m.test(x.texto),
       "L16c3 o topico da disciplina excluida continua no texto");

    /* a funcao NAO pode tocar no progresso que recebeu */
    ok(Object.keys(prog).length === 1 && prog["financeiro›receita"],
       "L16d excluir a disciplina apagou a marca de estudado");

    /* e incluir de volta devolve o que estava marcado */
    const volta = api.edIncluirDisciplina(x.texto, "Financeiro", 5,
      "Receita :: 5 :: pq\nDespesa :: 4 :: pq");
    const p2 = api.montarPlano(api.lerEdital(volta.texto),
      { horas: 10, prova: "2026-12-30", hoje: "2026-08-16", feitos: prog });
    ok(p2.feitos === 1,
       `L16e a disciplina voltou mas a marca de estudado nao (feitos=${p2.feitos})`);

    ok(api.edExcluirDisciplina(base, "Nao existe", {}).erro === "nao_achou",
       "L16f excluiu uma disciplina que nao existe");
  }

  /* ---- L17: redistribuir sugere, nao aplica ---- */
  {
    const { api } = carregar();
    const antes = ["# X | horas: 10", "@ A :: 3", "+ a1 :: 3", "@ B :: 3", "+ b1 :: 3"].join("\n");
    const dep = api.edIncluirDisciplina(antes, "C", 5, "c1 :: 5\nc2 :: 5\nc3 :: 5");
    const mud = api.edRedistribuir(antes, dep.texto);
    ok(mud.length > 0, "L17 incluir uma disciplina pesada nao deslocou ninguem");
    ok(mud.every((m) => m.para >= 1 && m.para <= 5),
       "L17b a sugestao de peso saiu da faixa 1-5");
    /* a sugestao nao pode ter mexido no texto: quem aplica e a pessoa */
    ok(api.lerEdital(dep.texto).disciplinas.find((d) => d.nome === "A").peso === 3,
       "L17c edRedistribuir alterou o texto sozinho");
    /* nada muda quando nada e incluido */
    ok(api.edRedistribuir(antes, antes).length === 0,
       "L17d sugeriu redistribuir sem nenhuma mudanca");
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "editais", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\neditais: ${f.length} FALHA(S)\n`
    : "\neditais: migracao, grupos, isolamento e agenda multi-edital ok (83 verificacoes)\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
