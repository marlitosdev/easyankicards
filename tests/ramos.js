/* =====================================================================
 * RAMIFICAÇÕES DO TÓPICO (G5a) — o formato "++ Ramo :: peso :: nota"
 *
 * O que originou: um tópico como "Lei de Licitações" é extenso demais
 * para ser uma unidade só de estudo. O usuário precisa poder ramificá-lo
 * (criar, renomear, reordenar, dar peso ao que mais cai) sem quebrar o
 * resto do app, que trata o TÓPICO como unidade (progresso, agenda,
 * vínculos, diário, questões).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "++" é lido como ramo do tópico de cima — nunca como tópico novo
 *     (o regex de tópico engoliria a linha se viesse antes).
 *  2. Sem "++", TUDO é idêntico ao que era (nenhum campo novo, mesmo
 *     plano, mesma prioridade).
 *  3. O que a IA/pessoa escreve de errado vira aviso, não perda:
 *     ramo sem tópico, sem nome, repetido, peso inválido.
 *  4. Os ramos SOBREVIVEM às reescritas de rotina do edital
 *     (edParaTexto, recolocar tópico perdido, tirar numeração) — o mesmo
 *     defeito que a 2ª fase e os blocos já tiveram.
 *  5. edEditarRamos troca só os ramos de UM tópico e não toca em mais
 *     nada do texto; é idempotente e devolve avisos em vez de falhar.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const BASE = [
  "# ISS Caruaru | prova: 2027-06-01 | horas: 20",
  "@ Licitações e Contratos :: 5",
  "+ Lei 14.133/2021 :: 5 :: cai sempre",
  "++ Modalidades de licitação :: 5 :: pregão e concorrência",
  "++ Fase preparatória",
  "++ Contratos administrativos :: 3",
  "+ Convênios :: 2",
  "@ Direito Financeiro :: 4",
  "+ Receita Pública :: 4",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();

  /* ---- R1: ler ---- */
  {
    const r = api.lerEdital(BASE);
    const lei = r.disciplinas[0].topicos[0];
    ok(r.disciplinas[0].topicos.length === 2 && r.disciplinas[0].topicos.map((t) => t.nome).join("|") === "Lei 14.133/2021|Convênios", "R1 as linhas ++ NAO viram topicos: " + r.disciplinas[0].topicos.map((t) => t.nome).join("|"));
    ok(lei.ramos && lei.ramos.length === 3 && lei.ramos.map((x) => x.nome).join("|") === "Modalidades de licitação|Fase preparatória|Contratos administrativos", "R1a os ramos ficam no topico de cima, na ordem: " + JSON.stringify((lei.ramos || []).map((x) => x.nome)));
    const [m, f, c] = lei.ramos;
    ok(m.peso === 5 && m.herdado === false && m.nota === "pregão e concorrência" && m.id === "modalidades_de_licitacao" && m.linha === 4, "R1b peso, nota, id estavel e linha do ramo: " + JSON.stringify(m));
    ok(f.peso === 3 && f.herdado === true && f.nota === "" && c.peso === 3 && c.herdado === false, "R1c ramo sem peso e' igual aos irmaos (herdado); com peso guarda o peso");
    ok(r.disciplinas[0].topicos[1].ramos === undefined && r.disciplinas[1].topicos[0].ramos === undefined, "R1d topico SEM ramo nao ganha campo nenhum (retrocompativel)");
    ok(r.achados.length === 0, "R1e um edital com ramos bem escritos nao gera aviso: " + JSON.stringify(r.achados));
    /* nota com '::' dentro fica inteira; topicos ANTERIORES ao que tem ramos nao ganham campo */
    const nt = api.lerEdital("@ D :: 5\n+ A :: 3\n+ B :: 3\n++ R :: 4 :: parte um :: parte dois").disciplinas[0].topicos;
    ok(nt[1].ramos[0].nota === "parte um :: parte dois" && nt[0].ramos === undefined, "R1g a nota guarda todo o resto da linha e o topico de ANTES nao ganha o campo ramos");
    /* peso em questoes */
    const q = api.lerEdital("@ D :: 5\n+ T :: 5\n++ Ramo A :: 12q\n++ Ramo B :: 8q").disciplinas[0].topicos[0].ramos;
    ok(q[0].abs === 12 && q[0].unidade === "q" && q[1].abs === 8 && q[0].herdado === false, "R1f peso em numero de questoes (12q) fica guardado como valor absoluto");
  }

  /* ---- R2: o que vem errado vira aviso ---- */
  {
    const tipos = (txt) => api.lerEdital(txt).achados.map((a) => a.tipo);
    ok(tipos("++ Solto :: 3\n@ D :: 5\n+ T :: 5").indexOf("ramo_sem_topico") >= 0, "R2 ramo antes de qualquer topico: aviso (nao some, nem vira topico)");
    ok(tipos("@ D :: 5\n++ Ramo sem topico").indexOf("ramo_sem_topico") >= 0 && api.lerEdital("@ D :: 5\n++ Ramo sem topico").disciplinas[0].topicos.length === 0, "R2a ramo logo abaixo de uma disciplina (sem topico) tambem");
    ok(tipos("@ D :: 5\n+ T :: 5\n++ :: 4").indexOf("ramo_sem_nome") >= 0, "R2b ramo sem nome: aviso");
    const rep = api.lerEdital("@ D :: 5\n+ T :: 5\n++ Modalidades :: 4\n++ MODALIDADES :: 2\n++ modalidádes");
    ok(rep.achados.filter((a) => a.tipo === "ramo_repetido").length === 2 && rep.disciplinas[0].topicos[0].ramos.length === 1 && rep.disciplinas[0].topicos[0].ramos[0].peso === 4, "R2c ramo repetido (caixa/acento): fica o primeiro, os outros viram aviso");
    const pi = api.lerEdital("@ D :: 5\n+ T :: 5\n++ R :: muito");
    ok(pi.achados.some((a) => a.tipo === "peso_invalido") && pi.disciplinas[0].topicos[0].ramos[0].herdado === true, "R2d peso invalido: aviso e volta ao igual-aos-irmaos");
    ok(api.lerEdital("@ D :: 5\n+ T :: 5\n++ R :: 9").achados.some((a) => a.tipo === "peso_fora"), "R2e peso fora de 1..5: aviso");
    /* ramo NAO e' 'linha ignorada' */
    ok(tipos(BASE).indexOf("linha_ignorada") < 0, "R2f o ++ nao e' contado como linha ignorada");
  }

  /* ---- R3: nada muda para quem nao usa ramos ---- */
  {
    const semRamos = BASE.split("\n").filter((l) => !/^\+\+/.test(l)).join("\n");
    const A = api.lerEdital(BASE), B = api.lerEdital(semRamos);
    const limpa = (r) => JSON.stringify(r.disciplinas.map((d) => ({ nome: d.nome, peso: d.peso, topicos: d.topicos.map((t) => ({ nome: t.nome, peso: t.peso, herdado: t.herdado, motivo: t.motivo, fase2: t.fase2 })) })));
    ok(limpa(A) === limpa(B), "R3 disciplinas, topicos e pesos sao IDENTICOS com e sem os ramos");
    const opc = { horas: 20, prova: "2027-06-01", feitos: {} };
    const pA = api.montarPlano(A, opc), pB = api.montarPlano(B, opc);
    /* sem "++": nenhum item ganha campo de ramo e o plano tem um item por topico */
    ok(pB.itens.length === 3 && pB.total === 3 && pB.itens.every((i) => i.ramos === undefined && i.chave === i.topicoChave && i.titulo === i.nome), "R3a edital SEM ramos: um item por topico, sem campos de ramo (o plano de sempre)");
    const semLinha = (l) => JSON.stringify(l, (k, v) => (k === "linha" ? undefined : v));
    ok(semLinha(api.priorizar(A)) === semLinha(api.priorizar(B)), "R3b priorizar sem a opcao de ramos ignora os ramos (a tabela e o apagar edital continuam contando topicos)");
  }

  /* ---- R23: os ramos no plano — UM CARD POR TOPICO, com os ramos dentro (16.95.0) ---- */
  {
    const NL = String.fromCharCode(10);
    const opc = { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null };
    const A = api.lerEdital(BASE), B = api.lerEdital(BASE.split(NL).filter((l) => !/^\+\+/.test(l)).join(NL));
    const pA = api.montarPlano(A, opc), pB = api.montarPlano(B, opc);
    const lei = pA.itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(pA.itens.length === 3 && pA.total === 3 && pA.itens.map((i) => i.nome).join("|") === pB.itens.map((i) => i.nome).join("|"), "R23 os ramos NAO viram itens: continua uma linha por topico (3), na mesma ordem de sempre");
    ok(pA.itens.every((i, k) => i.prioridade === pB.itens[k].prioridade && i.bruto === pB.itens[k].bruto && i.faixa === pB.itens[k].faixa && i.fatiaDisc === pB.itens[k].fatiaDisc), "R23a prioridade, peso, faixa e fatia da prova sao IDENTICOS com e sem ramos (ramo nao distorce a escala)");
    ok(lei.ramos.length === 3 && lei.ramos.map((r) => r.nome).join("|") === "Modalidades de licitação|Fase preparatória|Contratos administrativos" && pA.itens.filter((i) => i.ramos).length === 1, "R23b so' o topico com ramos leva a lista de ramos, por RELEVANCIA (peso; empate pela ordem escrita)");
    ok(lei.ramos.map((r) => r.w).join() === "5,3,3" && Math.abs(lei.ramos.reduce((a, r) => a + r.share, 0) - 1) < 1e-9 && Math.abs(lei.ramos[0].share - 5 / 11) < 1e-9, "R23c cada ramo tem peso e parte do topico (5/11, 3/11, 3/11)");
    const pl = pB.itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(pl.minutos === 60 && lei.minutosTotal === 155 && lei.minutos === 150 && lei.ramos.map((r) => r.minutos).join() === "70,40,40", "R23d o tempo do topico com 3 ramos cresce devagar (60 -> 155 = x(1+log2 3)) e se reparte pelo peso; o plano reserva a soma dos ramos pendentes (150): " + lei.minutosTotal + " / " + lei.minutos + " / " + lei.ramos.map((r) => r.minutos));
    ok(lei.minutosSessao === 70 && lei.proximo === "Modalidades de licitação" && lei.sessao.join() === "modalidades_de_licitacao", "R23e a sessao da vez leva os ramos pendentes mais relevantes que cabem na faixa (60 min): o primeiro (70)");
    ok(lei.feito === false && lei.ramosFeitos === 0 && lei.parcial === false && lei.ramosTotal === 3 && lei.estado === null, "R23f sem nada estudado: pendente, 0 de 3");
    const ch = lei.chave;
    ok(ch === "licitações e contratos›lei 14.133/2021" && lei.topicoChave === ch && lei.titulo === "Lei 14.133/2021" && lei.ramos[0].chave === ch + "›#modalidades_de_licitacao", "R23g a chave do item e' a do TOPICO; a de cada ramo e' 'topico›#ramo'");
    /* estudou UM ramo */
    const um = api.montarPlano(A, Object.assign({}, opc, { feitos: { [ch + "›#modalidades_de_licitacao"]: { e: "feito", d: "2026-09-20" } } })).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(um.ramosFeitos === 1 && um.parcial === true && um.feito === false && um.revisado === false && um.ramos[0].feito === true && um.ramos[1].feito === false, "R23h estudar um ramo: o topico segue PENDENTE (1 de 3, parcial)");
    ok(um.proximo === "Fase preparatória" && um.sessao.join() === "fase_preparatoria", "R23i a sessao passa para o proximo ramo pendente por relevancia");
    ok(!um.ehRevisao && api.montarPlano(A, Object.assign({}, opc, { feitos: { [ch + "›#modalidades_de_licitacao"]: { e: "feito", d: "2020-01-01" } } })).itens.find((i) => i.nome === "Lei 14.133/2021").ehRevisao !== true, "R23j com ramo pendente o topico NAO vira revisao (mesmo com um ramo estudado ha muito tempo)");
    /* todos estudados ha muito tempo: UMA revisao so' */
    const velho = (extra) => Object.assign({}, opc, { feitos: extra });
    const todosVelhos = {}; ["modalidades_de_licitacao", "fase_preparatoria", "contratos_administrativos"].forEach((id) => { todosVelhos[ch + "›#" + id] = { e: "feito", d: "2020-01-01" }; });
    const pv = api.montarPlano(A, velho(todosVelhos));
    const iv = pv.itens.filter((i) => i.nome === "Lei 14.133/2021");
    ok(iv.length === 1 && iv[0].feito === true && iv[0].ehRevisao === true && iv[0].ramosVencidos === 3 && pv.fila.filter((i) => i.nome === "Lei 14.133/2021").length === 1, "R23k todos os ramos estudados e vencidos: UMA revisao do topico na fila (nao uma por ramo)");
    ok(iv[0].minutos === 75 && iv[0].minutosSessao === 75 && iv[0].sessao.length === 3, "R23l a revisao leva os 3 ramos vencidos e metade do tempo (150/2 = 75)");
    /* o caso do relatorio: topico ja estudado ANTES dos ramos */
    const antigo = api.montarPlano(A, velho({ [ch]: { e: "feito", d: "2020-01-01" } }));
    const ia = antigo.itens.filter((i) => i.nome === "Lei 14.133/2021");
    ok(ia.length === 1 && antigo.fila.filter((i) => i.nome === "Lei 14.133/2021").length === 1 && ia[0].ehRevisao === true, "R23m topico estudado ANTES de ter ramos: ganhar 3 ramos nao cria 3 revisoes — continua UMA");
    ok(ia[0].ramos.every((r) => r.marcaHerdada === true && r.feito === true && r.venceu === true) && ia[0].ramosVencidos === 3, "R23n os ramos herdam a marca do topico (herdada) e ficam vencidos juntos");
    const recente = api.montarPlano(A, velho({ [ch]: { e: "feito", d: new Date().toISOString().slice(0, 10) } })).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(recente.feito === true && recente.ehRevisao !== true && recente.ramosVencidos === 0 && recente.proximo === "", "R23o topico estudado hoje (marca do topico): feito, sem revisao ainda e sem ramo pendente");
    /* marca do topico + um ramo com marca propria */
    const misto = api.montarPlano(A, velho({ [ch]: { e: "feito", d: "2020-01-01" }, [ch + "›#modalidades_de_licitacao"]: { e: "revisado", d: new Date().toISOString().slice(0, 10) } })).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(misto.ramos[0].revisado === true && misto.ramos[0].marcaHerdada === false && misto.ramos[1].marcaHerdada === true && misto.feito === true && misto.revisado === false && misto.ramosVencidos === 2 && misto.sessao.join() === "fase_preparatoria,contratos_administrativos", "R23p a marca propria do ramo vale mais que a do topico; so' os outros 2 seguem vencidos");
    const tudoRev = {}; ["modalidades_de_licitacao", "fase_preparatoria", "contratos_administrativos"].forEach((id) => { tudoRev[ch + "›#" + id] = { e: "revisado", d: new Date().toISOString().slice(0, 10) }; });
    const rev = api.montarPlano(A, velho(tudoRev)).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(rev.revisado === true && rev.estado === "revisado" && rev.feito === true && rev.ramosVencidos === 0, "R23q todos revisados: o topico esta revisado");
    ok(iv[0].quando === "2020-01-01" && api.montarPlano(A, velho({ [ch + "›#modalidades_de_licitacao"]: { e: "feito", d: "2026-01-02" }, [ch + "›#fase_preparatoria"]: { e: "feito", d: "2026-01-01" }, [ch + "›#contratos_administrativos"]: { e: "feito", d: "2026-03-01" } })).itens.find((i) => i.nome === "Lei 14.133/2021").quando === "2026-01-01", "R23r a data que conta para a revisao e' a do ramo estudado ha MAIS tempo");
    ok(api.montarPlano(A, velho({ [ch + "›#modalidades_de_licitacao"]: "feito", [ch + "›#fase_preparatoria"]: true, [ch + "›#contratos_administrativos"]: "revisado" })).itens.find((i) => i.nome === "Lei 14.133/2021").feito === true, "R23s formatos antigos de marca (true / 'feito') tambem valem nos ramos");

    const semData = api.montarPlano(A, velho({ [ch + "›#modalidades_de_licitacao"]: true, [ch + "›#fase_preparatoria"]: true, [ch + "›#contratos_administrativos"]: true })).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(semData.ramos.every((r) => r.feito && r.dias === null && r.venceu === true) && semData.ehRevisao === true, "R23s2 ramo estudado SEM data (formato antigo) conta como vencido");
    const misturado = api.montarPlano(A, velho({ [ch + "›#modalidades_de_licitacao"]: { e: "feito", d: "2026-01-02" }, [ch + "›#fase_preparatoria"]: true, [ch + "›#contratos_administrativos"]: { e: "feito", d: "2026-01-03" } })).itens.find((i) => i.nome === "Lei 14.133/2021");
    ok(misturado.quando === null && misturado.dias === null, "R23s3 com um ramo sem data a data do topico e' desconhecida (nao inventa a dos outros)");
    ok(rev.quando === new Date().toISOString().slice(0, 10), "R23s4 topico revisado: a data e' a do ultimo ramo");
    const N9 = api.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + Array.from({ length: 8 }, (x, k) => "++ Forte " + (k + 1) + " :: 5").join(NL) + NL + "++ Fraco :: 1");
    const i9 = api.montarPlano(N9, opc).itens[0];
    ok(i9.ramos[8].nome === "Fraco" && i9.ramos[8].minutos === 10 && i9.ramos[0].minutos > 10, "R23s5 nenhum ramo tem menos de 10 minutos (o de peso 1 entre oito de peso 5): " + i9.ramos.map((r) => r.minutos));
    const I3 = api.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + Array.from({ length: 9 }, (x, k) => "++ Ramo " + (k + 1) + " :: 3").join(NL));
    const i3 = api.montarPlano(I3, opc).itens[0];
    ok(i3.sessao.length === 2 && i3.minutosSessao === 60 && i3.minutosTotal === 250 && i3.minutos === 270 && i3.sessaoNomes.join() === "Ramo 1,Ramo 2", "R23s6 a sessao leva DOIS ramos quando cabem na faixa (2 x 30 = 60): " + i3.sessao.length + "/" + i3.minutosSessao + "/" + i3.minutos);
    ok(api.edRamosRegistrar({}, iv[0], "feito", "2026-09-25").length === 0, "R23s7 registrar ESTUDO num topico so' de revisao (todos ja estudados) nao remarca nada");
    ok(api.edRamosRegistrar({}, um, "revisado", "2026-09-25").length === 1 && api.edRamosRegistrar({}, um, "revisado", "2026-09-25")[0].id === "modalidades_de_licitacao", "R23s8 registrar REVISAO com ramos pendentes marca so' o ramo ja estudado (nao os pendentes)");

    /* registrar: quais ramos recebem a marca */
    const hoje = "2026-09-25";
    const prog = {};
    const m1 = api.edRamosRegistrar(prog, lei, "feito", hoje);
    ok(m1.length === 1 && m1[0].id === "modalidades_de_licitacao" && m1[0].ant === null && prog[ch + "›#modalidades_de_licitacao"].e === "feito" && prog[ch + "›#modalidades_de_licitacao"].d === hoje && Object.keys(prog).length === 1, "R23t registrar ESTUDO marca so' os ramos da sessao (1), e devolve a marca de antes (nenhuma)");
    const lei2 = api.montarPlano(A, Object.assign({}, opc, { feitos: prog })).itens.find((i) => i.nome === "Lei 14.133/2021");
    const m2 = api.edRamosRegistrar(prog, lei2, "feito", hoje);
    ok(m2.length === 1 && m2[0].id === "fase_preparatoria" && Object.keys(prog).length === 2, "R23u o proximo registro marca o proximo ramo (nao repete o que ja foi)");
    api.edRamosDesfazer(prog, lei2, m2);
    ok(Object.keys(prog).length === 1 && !prog[ch + "›#fase_preparatoria"], "R23v desfazer devolve a marca de antes do ramo (so' ele)");
    const pr2 = JSON.parse(JSON.stringify(todosVelhos));
    const mr = api.edRamosRegistrar(pr2, api.montarPlano(A, velho(todosVelhos)).itens.find((i) => i.nome === "Lei 14.133/2021"), "revisado", hoje);
    ok(mr.length === 3 && mr.every((x) => x.ant && x.ant.e === "feito"), "R23w registrar REVISAO marca todos os ramos estudados ainda nao revisados, guardando a marca de antes");
    const p3 = JSON.parse(JSON.stringify(todosVelhos)); p3[ch] = { e: "feito", d: "2020-01-01" };
    const md = api.edRamosRegistrar(p3, iv[0], null, hoje);
    ok(md.length === 4 && md[3].id === "_topo" && Object.keys(p3).length === 0, "R23x desmarcar limpa todos os ramos e a marca do topico");
    api.edRamosDesfazer(p3, iv[0], md);
    ok(Object.keys(p3).length === 4 && p3[ch].e === "feito", "R23y e o desfazer devolve tudo, inclusive a marca do topico");
    ok(api.edRamosRegistrar({}, lei, "feito", hoje).length === 1 && api.edRamosRegistrar({}, { chave: "x" }, "feito", hoje).length === 0, "R23z item sem ramos nao quebra");

    /* pesos */
    const q = (txt) => api.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + txt).disciplinas[0].topicos[0].ramos;
    ok(api.edPesosDosRamos(q("++ A :: 12q" + NL + "++ B :: 8q")).join() === "12,8", "R23-p1 quantidades em todos os ramos: o peso e' a quantidade");
    ok(api.edPesosDosRamos(q("++ A :: 12q" + NL + "++ B :: 4")).join() === "3,4", "R23-p2 quantidade misturada com estrela: vale a estrela (escalas nao se misturam)");
    ok(api.edPesosDosRamos(q("++ A" + NL + "++ B :: 5")).join() === "3,5" && api.edPesosDosRamos([]).length === 0 && api.edPesosDosRamos(null).length === 0, "R23-p3 sem peso = 3; lista vazia/nula nao quebra");
    /* topicos, nao itens */
    ok(api.edTopicosPendentes(pA.itens).length === 3, "R23-t1 pendentes: 3 topicos");
    ok(api.edTopicosPendentes(pv.itens).length === 2 && !api.edTopicosPendentes(pv.itens).some((x) => x.nome === "Lei 14.133/2021"), "R23-t2 com todos os ramos estudados o topico sai dos pendentes");
    ok(api.edTopicosPendentes([um].concat(pA.itens.filter((i) => i.nome !== "Lei 14.133/2021"))).some((x) => x.nome === "Lei 14.133/2021"), "R23-t3 com um ramo pendente ele continua pendente");
    ok(api.edAcharItemDoTopico(pA.itens, ch) === lei && api.edAcharItemDoTopico(pA.itens, "nao›existe") === null && api.edAcharItemDoTopico(null, "x") === null, "R23-t4 achar o item pela chave do topico");
    const disc = api.plPorDisciplina(pA, A).find((x) => x.disciplina === "Licitações e Contratos");
    ok(disc.topicos === 2 && disc.pendentes === 2, "R23-t5 o painel por disciplina conta 2 topicos: " + disc.topicos + "/" + disc.pendentes);
    /* segunda fase */
    const F2 = api.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL + "# fase 2: discursiva | prova: 2027-09-01 | horas: 10" + NL + "@ D :: 5" + NL + "+ T :: 5 :: motivo !d" + NL + "++ A :: 5" + NL + "++ B :: 1" + NL + "+ U :: 5");
    const p2 = api.montarPlano(F2, { horas: 10, prova: "2027-09-01", fase: 2, feitos: {}, fatores: null, acertos: null });
    ok(p2.itens.length === 1 && p2.itens[0].nome === "T" && p2.itens[0].ramos.length === 2 && p2.itens[0].ramos[0].nome === "A" && p2.itens[0].prioridade === 100, "R23-f2 na 2a fase o topico com ramos segue sendo um item so', com os ramos por peso");
    ok(api.montarPlano(api.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + "++ Unico :: 5"), opc).itens[0].minutos === 60, "R23-n1 um ramo so': o tempo e' o da faixa (x(1+log2 1) = x1)");
  }


  /* ---- R36: pesos e prioridade entre topicos (Fase 4) ---- */
  {
    const NL = String.fromCharCode(10);
    const hoje = new Date().toISOString().slice(0, 10);
    const E = api.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL + "@ D :: 5" + NL + "+ Pesado :: 5" + NL + "++ A :: 3" + NL + "++ B :: 3" + NL + "++ C :: 3" + NL + "+ Medio :: 4");
    const opc = { horas: 20, prova: "2027-06-01", fatores: null, acertos: null };
    const P = (feitos, o) => api.montarPlano(E, Object.assign({}, opc, { feitos: feitos || {} }, o || {}));
    const it = (pl, nome) => pl.itens.find((i) => i.nome === nome);
    const ch = "d›pesado";
    const marca = (ids, d) => { const m = {}; ids.forEach((id) => { m[ch + "›#" + id] = { e: "feito", d: d || hoje }; }); return m; };
    /* nada estudado: tudo como antes */
    const p0 = P();
    ok(p0.itens.map((i) => i.nome).join() === "Pesado,Medio" && it(p0, "Pesado").prioridade === 100 && it(p0, "Pesado").restante === 1 && it(p0, "Medio").prioridade === 80, "R36 nada estudado: o assunto pesado segue no topo (100) e o medio em 80");
    ok(it(p0, "Pesado").prioridadeBase === 100 && it(p0, "Medio").restante === 1, "R36a restante = 1 quando nada foi estudado");
    /* 2 de 3 estudados: o que FALTA e' 1/3 */
    const p1 = P(marca(["a", "b"]));
    ok(Math.abs(it(p1, "Pesado").restante - 1 / 3) < 1e-9, "R36b o que falta do topico com 2 de 3 ramos estudados: 1/3");
    ok(p1.itens.map((i) => i.nome).join() === "Medio,Pesado" && it(p1, "Medio").prioridade === 100 && it(p1, "Pesado").prioridade === 42, "R36c com quase tudo estudado o assunto PESADO passa para depois do medio intocado (prioridade 42 x 100): " + p1.itens.map((i) => i.nome + ":" + i.prioridade));
    ok(it(p1, "Pesado").prioridadeBase === 100, "R36d a prioridade de BASE (do topico inteiro) fica guardada");
    ok(Math.abs(it(p1, "Pesado").brutoOrdem - 25 / 3) < 1e-9 && it(p1, "Pesado").bruto === 25, "R36e a ordem usa o que falta (25/3) mas o peso do topico na prova (bruto 25) NAO muda");
    /* um ramo so' estudado: falta 2/3 = 16,7 < 20 do medio */
    const p2 = P(marca(["a"]));
    ok(Math.abs(it(p2, "Pesado").restante - 2 / 3) < 1e-9 && p2.itens.map((i) => i.nome).join() === "Medio,Pesado" && it(p2, "Pesado").prioridade === 83, "R36f com 1 de 3 estudado o que falta (2/3 de 25 = 16,7) ja fica atras do medio (20): " + it(p2, "Pesado").prioridade);
    /* topico todo estudado: revisao mantem a prioridade do topico */
    const pAll = P(marca(["a", "b", "c"], "2020-01-01"));
    ok(it(pAll, "Pesado").feito === true && it(pAll, "Pesado").prioridade === 100 && it(pAll, "Pesado").ehRevisao === true && it(pAll, "Pesado").restante === 0, "R36g topico todo estudado: a REVISAO segue com a prioridade do topico (100), nao com zero");
    /* o tempo dos ramos nao encolhe */
    ok(it(p0, "Pesado").minutosTotal === it(p1, "Pesado").minutosTotal && it(p0, "Pesado").ramos[0].minutos === it(p1, "Pesado").ramos[0].minutos, "R36h o orcamento do topico e o tempo de cada ramo nao encolhem porque outros ramos ficaram prontos: " + it(p0, "Pesado").minutosTotal + " x " + it(p1, "Pesado").minutosTotal);
    ok(it(p0, "Pesado").minutos === 150 && it(p1, "Pesado").minutos === 50 && it(p2, "Pesado").minutos === 100, "R36h2 o plano reserva SO' O QUE FALTA (150 -> 100 -> 50 min conforme os ramos ficam prontos): " + [it(p0, "Pesado").minutos, it(p2, "Pesado").minutos, it(p1, "Pesado").minutos]);
    ok(it(p1, "Pesado").faixa === "baixa" && it(p0, "Pesado").faixa === "alta", "R36i (a FAIXA de exibicao acompanha a posicao: alta -> baixa)");
    /* sem ramos nada muda */
    const Eb = api.lerEdital("@ D :: 5" + NL + "+ Pesado :: 5" + NL + "+ Medio :: 4");
    const pb = api.montarPlano(Eb, Object.assign({}, opc, { feitos: {} }));
    ok(pb.itens.map((i) => i.prioridade).join() === "100,80" && pb.itens.every((i) => i.restante === 1), "R36j sem ramos: prioridade e ordem exatamente como antes (100, 80)");
    const pbf = api.montarPlano(Eb, Object.assign({}, opc, { feitos: { "d›pesado": { e: "feito", d: hoje } } }));
    ok(pbf.itens.find((i) => i.nome === "Pesado").restante === 0, "R36k sem ramos e estudado: restante 0");
    /* dificuldade multiplica o que falta */
    const pf = P(marca(["a", "b"]), { fatores: { "d›pesado": 3 } });
    ok(it(pf, "Pesado").prioridade === 100 && it(pf, "Pesado").brutoOrdem === 25 / 3 * 3, "R36l a dificuldade (fator 3) multiplica o que FALTA: 25 x 1/3 x 3 = 25 > 20 do medio, entao o pesado volta ao topo");
    /* credito de progresso */
    ok(api.edCredito(it(p1, "Pesado")) > 0.66 && api.edCredito(it(p1, "Pesado")) < 0.67 && api.edCredito(it(p0, "Pesado")) === 0 && api.edCredito(it(pAll, "Pesado")) === 1, "R36m credito do topico com ramos = parte estudada (2/3), 0 sem nada, 1 com tudo");
    ok(api.edCredito({ feito: true }) === 1 && api.edCredito({ feito: false }) === 0 && api.edCredito(null) === 0 && api.edCreditoRev({ revisado: true }) === 1 && api.edCreditoRev(null) === 0 && api.edRestante(null) === 1, "R36n sem ramos o credito e' tudo ou nada; nulo nao quebra");
    const pr = P({ [ch + "›#a"]: { e: "revisado", d: hoje }, [ch + "›#b"]: { e: "feito", d: hoje } });
    ok(Math.abs(api.edCreditoRev(it(pr, "Pesado")) - 1 / 3) < 1e-9 && Math.abs(api.edCredito(it(pr, "Pesado")) - 2 / 3) < 1e-9, "R36o credito de revisao: so' o ramo revisado conta (1/3); o de estudo conta os 2");
    /* progresso do plano, das disciplinas e dos blocos usam o credito parcial */
    ok(P(marca(["a"])).peso.pctFeito === 19 && P().peso.pctFeito === 0, "R36p o progresso do plano dá credito parcial: 1 de 3 ramos do topico pesado = 19% (era 0%): " + P(marca(["a"])).peso.pctFeito);
    const dsc = api.panoramaDisciplinas(P(marca(["a"]))).find((x) => x.nome === "D");
    ok(dsc.pesoFeito === 19 && dsc.feitos === 0 && dsc.pesoRevisado === 0, "R36q o panorama da disciplina: 19% do peso estudado, 0 topicos inteiros feitos: " + dsc.pesoFeito + "/" + dsc.feitos);
    const dr = api.panoramaDisciplinas(P({ [ch + "›#a"]: { e: "revisado", d: hoje } })).find((x) => x.nome === "D");
    ok(dr.pesoRevisado === 19 && dr.pesoFeito === 19, "R36r o peso revisado tambem conta por ramo (19%)");
    const EB = api.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL + "& Bloco | minimo: 50%" + NL + "@ D :: 5" + NL + "+ Pesado :: 5" + NL + "++ A :: 3" + NL + "++ B :: 3" + NL + "++ C :: 3");
    const pbl = api.montarPlano(EB, Object.assign({}, opc, { feitos: marca(["a", "b"]) }));
    ok(pbl.blocos.length === 1 && pbl.blocos[0].pct === 67, "R36s a cobertura do bloco com minimo tambem usa o credito parcial (2 de 3 = 67%): " + JSON.stringify(pbl.blocos.map((b) => b.pct)));
    const sp = api.somarPeso([{ bruto: 10, ramos: [{ share: 0.5, feito: true, revisado: true }, { share: 0.5, feito: false, revisado: false }] }, { bruto: 10, feito: true, revisado: true }]);
    ok(sp.total === 20 && sp.feito === 15 && sp.revisado === 15 && sp.pctFeito === 75 && sp.pctRevisado === 75, "R36t somarPeso com credito parcial (estudo e revisao): " + JSON.stringify(sp));
    ok(pbl.blocos[0].linhas[0].cobertura === 67, "R36u a cobertura POR DISCIPLINA dentro do bloco tambem usa o credito parcial (67%): " + pbl.blocos[0].linhas[0].cobertura);
    const revs = {}; ["a", "b"].forEach((id) => { revs[ch + "›#" + id] = { e: "revisado", d: hoje }; });
    const EB2 = api.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL + "& Bloco | minimo: 50%" + NL + "@ D :: 5" + NL + "+ Pesado :: 5" + NL + "++ A :: 3" + NL + "++ B :: 3" + NL + "++ C :: 3");
    const pb2 = api.montarPlano(EB2, Object.assign({}, opc, { feitos: revs }));
    const fora = api.edDiscComFolga(pb2.blocos, pb2.itens, {});
    ok(fora.length === 1 && fora[0].cobertura === 67 && fora[0].revisao === 100, "R36v a disciplina com folga (cobertura e revisao) conta o credito por ramo: " + JSON.stringify(fora));
    const pb3 = api.montarPlano(EB2, Object.assign({}, opc, { feitos: marca(["a", "b"]) }));
    ok(api.edDiscComFolga(pb3.blocos, pb3.itens, {}).length === 0, "R36w estudado mas NAO revisado: nao libera tempo (a revisao por ramo pesa)");
  }

    /* ---- R37: a trilha do ramo (Fase 5) — pura ---- */
  {
    ok(api.ED_PASSOS.map((x) => x.id + ":" + x.forma + ":" + x.peso).join() === "lei:leiseca:40,questoes:questoes:30,cartoes:flashcards:20,juris:juris:10", "R37 os 4 passos da trilha, cada um ligado a uma FORMA de estudo, com peso 40/30/20/10");
    const D = [
      { c: "t", a: "feito", d: "2026-09-01", f: ["leiseca", "leitura"], rm: [{ id: "x", ant: null }] },
      { c: "t", a: "feito", d: "2026-09-10", f: ["leiseca"], rm: [{ id: "x", ant: null }, { id: "y", ant: null }] },
      { c: "t", a: "feito", d: "2026-09-05", f: ["questoes"], rp: [{ id: "x" }] },
      { c: "t", a: "feito", d: "2026-09-06", f: ["flashcards"], rm: [{ id: "y" }] },
      { c: "outro", a: "feito", d: "2026-09-07", f: ["juris"], rm: [{ id: "x" }] },
      { c: "t", a: "pendente", d: "2026-09-08", f: ["juris"], rm: [{ id: "x" }] },
      { c: "t", a: "feito", d: "2026-09-09", f: ["juris"] },
      null,
    ];
    const cx = api.edCoberturaDoRamo(D, "t", "x");
    ok(cx.leiseca === "2026-09-10" && cx.leitura === "2026-09-01" && cx.questoes === "2026-09-05" && !cx.flashcards && !cx.juris, "R37a a cobertura do ramo vem do diario: a data MAIS RECENTE de cada forma, so' dos registros que tocaram o ramo (rm ou rp), do mesmo topico e nao 'pendente': " + JSON.stringify(cx));
    ok(JSON.stringify(api.edCoberturaDoRamo(D, "t", "y")) === JSON.stringify({ leiseca: "2026-09-10", flashcards: "2026-09-06" }) && Object.keys(api.edCoberturaDoRamo(null, "t", "x")).length === 0 && Object.keys(api.edCoberturaDoRamo(D, "t", "nao")).length === 0, "R37b outro ramo do mesmo topico tem a sua cobertura; diario vazio ou ramo sem registro: nada");
    const tr = api.edTrilhaDoRamo({ leiseca: "2026-09-10" }, { lei: 1, questoes: 5, cartoes: 3, juris: 0 });
    ok(tr.passos.map((x) => x.id + (x.disponivel ? "+" : "-") + (x.feito ? "F" : "p")).join() === "lei+F,questoes+p,cartoes+p,juris-p" && tr.faltam.join() === "questoes,cartoes" && tr.completo === false && tr.passos[1].n === 5, "R37c a trilha: lei feita; questoes e cartoes faltam; jurisprudencia sem material nao conta: " + tr.faltam);
    ok(api.edTrilhaDoRamo({ leiseca: "d", questoes: "d", flashcards: "d" }, { lei: 1, questoes: 2, cartoes: 1, juris: 0 }).completo === true, "R37d trilha completa: todos os passos COM material foram feitos");
    ok(api.edTrilhaDoRamo({}, {}).faltam.length === 0 && api.edTrilhaDoRamo(null, null).passos.length === 4 && api.edTrilhaDoRamo({ juris: "d" }, { juris: 0 }).passos[3].feito === true, "R37e sem material nada falta; nulos nao quebram; passo feito mesmo sem material fica marcado");
    ok(api.edSessaoCombinada(api.edTrilhaDoRamo({}, { lei: 1, questoes: 1, cartoes: 1, juris: 1 }), 60).map((x) => x.id + ":" + x.minutos).join() === "lei:25,questoes:20,cartoes:10,juris:5", "R37f a sessao combinada reparte 60 min pelos pesos, de 5 em 5, e o ultimo leva o resto (25+20+10+5)");
    const so3 = api.edSessaoCombinada(api.edTrilhaDoRamo({ leiseca: "d" }, { lei: 1, questoes: 1, cartoes: 1, juris: 1 }), 60);
    ok(so3.map((x) => x.id + ":" + x.minutos).join() === "questoes:30,cartoes:20,juris:10" && so3.reduce((x, y) => x + y.minutos, 0) === 60, "R37g so' os passos que faltam entram, e a soma fecha no total (30+20+10)");
    ok(api.edCoberturaDoRamo([{ c: "t", a: "feito", d: "2026-09-10", f: ["leiseca"], rm: [{ id: "x" }] }, { c: "t", a: "feito", d: "2026-09-01", f: ["leiseca"], rm: [{ id: "x" }] }], "t", "x").leiseca === "2026-09-10", "R37b2 a data mais recente vale mesmo quando o registro mais antigo vem depois no diario");
    const sc = (mn, dis) => api.edSessaoCombinada(api.edTrilhaDoRamo({ leiseca: "d" }, Object.assign({ lei: 1 }, dis)), mn);
    ok(sc(45, { questoes: 1, cartoes: 1, juris: 1 }).map((x) => x.minutos).join() === "25,15,5" && sc(45, { questoes: 1, cartoes: 1, juris: 1 }).map((x) => x.forma).join() === "questoes,flashcards,juris", "R37h0 45 min: o ultimo leva o RESTO (25+15+5, nao 25+15+10) e cada item traz a forma de estudo dele");
    ok(sc(25, { questoes: 1, cartoes: 1, juris: 1 }).map((x) => x.minutos).join() === "15,10,5", "R37h1 25 min: o ultimo passo nunca fica com menos de 5 (15+10+5)");
    ok(api.edSessaoCombinada(api.edTrilhaDoRamo({}, { lei: 1, questoes: 1, cartoes: 1, juris: 1 }), 12).map((x) => x.id).join() === "lei,questoes" && api.edSessaoCombinada(api.edTrilhaDoRamo({}, { lei: 1 }), 4).length === 0 && api.edSessaoCombinada(api.edTrilhaDoRamo({ leiseca: "d" }, { lei: 1 }), 60).length === 0 && api.edSessaoCombinada(null, 60).length === 0, "R37h pouco tempo: so' os mais pesados que cabem; menos de 5 min ou nada faltando: sem sessao; nulo nao quebra");
    ok(api.edSessaoCombinada(api.edTrilhaDoRamo({}, { juris: 1 }), 30).map((x) => x.id + ":" + x.minutos).join() === "juris:30", "R37i um passo so' leva o tempo todo");
    /* citacoes */
    ok(api.ramContaCitacoes("Modalidades de licitação", ["a modalidade de licitação pregão", "outra coisa", "licitação sem a outra palavra"]) === 1 && api.ramContaCitacoes("TÍTULO I", ["titulo i"]) === 0 && api.ramContaCitacoes("X", null) === 0, "R37j contar citacoes: a maioria dos radicais do nome; nome so' com palavra generica nao conta");
  }

    /* ---- R25: propor ramos pelo indice da lei (local) ---- */
  {
    const ROM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV"];
    const arts = (ns) => ns.map((n) => "Art. " + n + " Texto.");
    const lei = (titulos) => {
      const out = ["LEI Nº 1"];
      titulos.forEach((t, i) => {
        out.push("TÍTULO " + ROM[i], t.nome);
        if (t.caps) t.caps.forEach((c) => { out.push("CAPÍTULO " + c.num, c.nome); arts(c.arts).forEach((x) => out.push(x)); });
        else arts(t.arts).forEach((x) => out.push(x));
      });
      return out.join("\n");
    };
    const T = (nome, arts) => ({ nome, arts });
    const s3 = api.ramSugerirDaLei(lei([T("DAS PARTES", ["1", "2", "3", "4"]), T("DOS ATOS", ["5"]), T("DO FIM", ["6", "7"])]));
    ok(s3.ramos.length === 3 && s3.ramos[0].nome === "TÍTULO I — DAS PARTES" && s3.ramos[1].nome === "TÍTULO II — DOS ATOS" && s3.divisoes === 3 && s3.cortou === 0, "R25 lei com 3 titulos: um ramo por titulo, com o rotulo da lei: " + JSON.stringify(s3.ramos.map((r) => r.nome)));
    ok(s3.ramos.map((r) => r.peso).join() === "5,1,3" && s3.ramos.map((r) => r.nota).join("|") === "arts. 1 a 4|art. 5|arts. 6 a 7", "R25a peso pelo tamanho (o maior = 5, minimo 1) e nota com os artigos: " + s3.ramos.map((r) => r.peso + "/" + r.nota));
    const dois = api.ramSugerirDaLei(lei([{ nome: "DAS PARTES", caps: [{ num: "I", nome: "Um", arts: ["1", "2"] }, { num: "II", nome: "Dois", arts: ["3"] }] }, { nome: "DO FIM", caps: [{ num: "I", nome: "Tres", arts: ["4", "5"] }] }]));
    ok(dois.ramos.length === 3 && /^CAPÍTULO I — Um/.test(dois.ramos[0].nome) && dois.divisoes === 2, "R25b com menos de 3 titulos desce para os capitulos: " + JSON.stringify(dois.ramos.map((r) => r.nome)));
    const C2 = (n1, n2) => ({ nome: "T", caps: [{ num: "I", nome: "a", arts: [n1] }, { num: "II", nome: "b", arts: [n2] }] });
    const tres = api.ramSugerirDaLei(lei([C2("1", "2"), C2("3", "4"), C2("5", "6")]));
    ok(tres.ramos.length === 3 && tres.ramos.every((r) => /^TÍTULO/.test(r.nome)), "R25b2 com 3 titulos ja basta: nao desce para os capitulos: " + JSON.stringify(tres.ramos.map((r) => r.nome)));
    const misto = api.ramSugerirDaLei(lei([{ nome: "A", caps: [{ num: "I", nome: "cheio", arts: ["1", "2"] }, { num: "II", nome: "vazio", arts: [] }] }, T("B", ["3"])]));
    ok(misto.ramos.length === 2 && /CAPÍTULO I — cheio/.test(misto.ramos[0].nome) && /TÍTULO II — B/.test(misto.ramos[1].nome), "R25b3 ao descer: capitulo vazio some e o titulo SEM capitulos fica como ramo: " + JSON.stringify(misto.ramos.map((r) => r.nome)));
    const desigual = api.ramSugerirDaLei(lei([T("PEQUENO", ["1"]), T("GRANDE", Array.from({ length: 30 }, (x, i) => String(i + 2))), T("MEDIO", ["40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54"])]));
    ok(desigual.ramos[0].peso === "1" && desigual.ramos[1].peso === "5", "R25b4 o peso nunca cai abaixo de 1 (divisao minuscula) nem passa de 5: " + desigual.ramos.map((r) => r.peso));
    const longo = api.ramSugerirDaLei(["LEI Nº 1", "TÍTULO I – " + "DAS PARTES E ATOS ".repeat(8).trim(), "Art. 1 Texto.", "TÍTULO II", "B", "Art. 2 Texto.", "TÍTULO III", "C", "Art. 3 Texto."].join("\n"));
    ok(longo.ramos[0].nome.length === 70, "R25b5 nome muito comprido e cortado em 70: " + longo.ramos[0].nome.length);
    const um = api.ramSugerirDaLei(lei([T("ÚNICO", ["1", "2"])]));
    ok(um.ramos.length === 1 && um.ramos[0].peso === "5", "R25c uma divisao so' sem filhos: um ramo");
    ok(api.ramSugerirDaLei("Art. 1 Texto.\nArt. 2 Texto.").ramos.length === 0 && api.ramSugerirDaLei("").ramos.length === 0 && api.ramSugerirDaLei(null).ramos.length === 0 && api.ramSugerirDaLei("   ").divisoes === 0, "R25d sem divisoes ou sem texto: nenhuma proposta (e sem quebrar)");
    const mtos = api.ramSugerirDaLei(lei(Array.from({ length: 25 }, (x, i) => T("D" + i, [String(i + 1)]))));
    ok(mtos.ramos.length === 20 && mtos.cortou === 5 && mtos.divisoes === 25, "R25e mais de 20 divisoes: mostra 20 e diz quantas cortou: " + mtos.ramos.length + "/" + mtos.cortou);
    const rev = api.ramSugerirDaLei(lei([T("DAS PARTES", ["1"]), T("VAZIO", []), T("DOS ATOS", ["2"]), T("DO FIM", ["3"])]));
    ok(rev.ramos.length === 3 && !rev.ramos.some((r) => /VAZIO/.test(r.nome)), "R25f divisao sem artigo nao vira ramo");
  }

  /* ---- R27: ler a resposta da IA (pura) ---- */
  {
    const NL = String.fromCharCode(10);
    const r = api.ramLerRespostaIA(["Claro! Aqui estão os ramos:", "", "++ Modalidades de licitação :: 5 :: pregão e concorrência", "- Fase preparatória :: 4", "* Contratos administrativos", "1. Sanções :: 3 :: arts. 155 a 163", "• Nulidades :: 2", "Espero ter ajudado!"].join(NL));
    ok(r.ramos.length === 5 && r.ignoradas === 2, "R27 aceita ++, -, *, numerado e bolinha; ignora a conversa (2 linhas): " + JSON.stringify(r.ramos.map((x) => x.nome)) + " ign=" + r.ignoradas);
    ok(r.ramos[0].peso === "5" && r.ramos[0].nota === "pregão e concorrência" && r.ramos[1].peso === "4" && r.ramos[2].peso === "" && r.ramos[3].nota === "arts. 155 a 163", "R27a peso e nota de cada linha; sem peso fica em branco (igual aos irmaos)");
    const ruim = api.ramLerRespostaIA(["++ A :: muito", "++ B :: 9", "++ a :: 3", "++ :: 2"].join(NL));
    ok(ruim.ramos.length === 2 && ruim.avisos.length >= 3, "R27b peso invalido, fora da faixa, repetido e sem nome viram AVISO (nao somem): " + JSON.stringify(ruim.avisos) + " " + ruim.ramos.length);
    ok(ruim.ramos[0].peso === "" && ruim.ramos[1].peso === "5", "R27c peso invalido volta ao igual-aos-irmaos; peso fora da faixa e grampeado");
    ok(api.ramLerRespostaIA("").ramos.length === 0 && api.ramLerRespostaIA(null).ramos.length === 0 && api.ramLerRespostaIA("so conversa aqui").ramos.length === 0 && api.ramLerRespostaIA("so conversa aqui").ignoradas === 1, "R27d vazio, nulo e so' conversa: nada (e sem quebrar)");
    const muitos = api.ramLerRespostaIA(Array.from({ length: 40 }, (x, i) => "++ Ramo " + (i + 1) + " :: 3").join(NL));
    ok(muitos.ramos.length === 30 && muitos.cortou === 10, "R27e mais de 30 ramos: entram 30 e conta o corte");
    const cp = api.ramLerRespostaIA("++ Nome :: 4 :: uma nota :: com dois pontos");
    ok(cp.ramos.length === 1 && cp.ramos[0].nome === "Nome", "R27f linha com '::' a mais nao quebra");
    const sub = api.ramLerRespostaIA("+++ X :: 2" + NL + "-- Y :: 3");
    ok(sub.ramos.map((x) => x.nome).join() === "X,Y", "R27g marcadores repetidos (+++, --) sao limpos: " + sub.ramos.map((x) => x.nome));
  }

  /* ---- R29: pesos pelos registros (pura) ---- */
  {
    const nomes = ["Modalidades de licitação", "Fase preparatória", "Contratos administrativos", "Sanções administrativas"];
    const txt = ["A modalidade de licitação pregão exige...", "Na modalidade de licitação concorrência, o prazo...", "Sobre contratos administrativos, a duração...", "As sanções administrativas previstas..."];
    const r = api.ramPesosPorRegistros(nomes, txt);
    ok(r.map((x) => x.citacoes).join() === "2,0,1,1", "R29 conta quantos registros falam de cada ramo (radicais, com plural/acento): " + r.map((x) => x.citacoes));
    ok(r.map((x) => x.peso).join() === "5,,3,3", "R29a o mais citado vale 5, os demais proporcionais; sem citacao fica SEM peso: " + r.map((x) => x.peso));
    const um = api.ramPesosPorRegistros(["A licitação", "B contrato"], ["licitação licitação", "outro assunto"]);
    ok(um[0].peso === "5" && um[1].peso === "" , "R29b so' um ramo citado: ele leva 5 e o outro nada");
    const fraco = api.ramPesosPorRegistros(["Modalidades de licitação", "Contratos administrativos"], Array.from({ length: 20 }, () => "modalidade de licitação").concat(["contratos administrativos"]));
    ok(fraco[0].peso === "5" && fraco[1].peso === "1", "R29c o ramo pouco citado recebe o minimo 1 (nunca 0): " + fraco.map((x) => x.peso));
    ok(api.ramPesosPorRegistros(["Modalidades"], []).every((x) => x.peso === "" && x.citacoes === 0) && api.ramPesosPorRegistros([], ["x"]).length === 0 && api.ramPesosPorRegistros(null, null).length === 0, "R29d sem registros, sem ramos ou nulo: nada (e sem quebrar)");
    const meio = api.ramPesosPorRegistros(["Contratos administrativos"], ["so' contratos aqui", "administrativos sem o resto"]);
    ok(meio[0].citacoes === 0, "R29e o texto precisa trazer a MAIORIA das palavras do ramo (so' uma de duas nao vale)");
    const gen = api.ramPesosPorRegistros(["TÍTULO II — DAS LICITAÇÕES"], ["a licitação é..."]);
    ok(gen[0].citacoes === 1, "R29f 'TITULO', numero romano e palavras de ligacao nao contam como palavra do ramo: " + gen[0].citacoes);
    const tres = api.ramPesosPorRegistros(["Sanções administrativas pecuniárias"], ["as sanções pecuniárias previstas"]);
    ok(tres[0].citacoes === 1, "R29g2 basta a MAIORIA das palavras (2 de 3)");
    ok(api.ramPesosPorRegistros(["Ato lei"], ["ato lei"])[0].citacoes === 0 && [...api.ramRadicais("Contratos para obras")].join() === "contra,obras" && [...api.ramRadicais("Título XIII")].length === 0, "R29g3 palavras de 3 letras, de ligacao (para) e numero romano (XIII) nao contam como palavra do ramo");
    ok(api.ramPesosPorRegistros(["TÍTULO I"], ["titulo i"])[0].peso === "", "R29g ramo so' com palavra generica nao tem indicio");
    ok([...api.ramRadicais("Sanções administrativas")].join() === "sancoe,admini", "R29h radical = 6 primeiras letras sem acento: " + [...api.ramRadicais("Sanções administrativas")]);
  }

  /* ---- R4: a ida e volta do texto ---- */
  {
    const r = api.lerEdital(BASE);
    const t1 = api.edParaTexto(r);
    const r2 = api.lerEdital(t1);
    const nomes = (rr) => rr.disciplinas[0].topicos[0].ramos.map((x) => x.nome + "/" + x.peso + "/" + x.herdado + "/" + x.nota);
    ok(nomes(r).join("|") === nomes(r2).join("|") && nomes(r2).length === 3, "R4 edParaTexto preserva os ramos (nome, peso, herdado e nota): " + nomes(r2).join("|"));
    ok(t1.indexOf("++ Modalidades de licitação :: 5 :: pregão e concorrência") >= 0 && t1.indexOf("++ Fase preparatória\n") >= 0, "R4a o ramo sem peso volta sem peso inventado; o com nota volta com nota");
    ok(api.edParaTexto(r2) === t1, "R4b a ida e volta e' estavel (idempotente)");
    const linhas = t1.split("\n");
    const i = linhas.findIndex((l) => /^\+ Lei 14\.133/.test(l));
    ok(/^\+\+/.test(linhas[i + 1]) && /^\+\+/.test(linhas[i + 3]) && /^\+ Convênios/.test(linhas[i + 4]), "R4c os ramos voltam logo abaixo do topico deles");
    const sp = api.lerEdital(api.edParaTexto(api.lerEdital("@ D :: 5\n+ T :: 5\n++ Sem peso :: :: so a nota"))).disciplinas[0].topicos[0].ramos[0];
    ok(sp.herdado === true && sp.nota === "so a nota" && sp.peso === 3, "R4c2 ramo SEM peso e COM nota volta sem peso inventado e com a nota: " + JSON.stringify(sp));
    const q = api.edParaTexto(api.lerEdital("@ D :: 5\n+ T :: 5\n++ A :: 12q\n++ B :: 4p"));
    ok(/\+\+ A :: 12q/.test(q) && /\+\+ B :: 4p/.test(q), "R4d o peso em questoes/pontos volta como foi escrito");
  }
  {
    /* recolocar o topico perdido leva os ramos junto */
    const antigo = BASE;
    const novo = ["# ISS Caruaru | prova: 2027-06-01 | horas: 20", "@ Licitações e Contratos :: 5", "+ Convênios :: 2", "@ Direito Financeiro :: 4", "+ Receita Pública :: 4"].join("\n");
    const rec = api.edRecolocarPerdidos(novo, [{ semHerdeiro: true, d: "Licitações e Contratos", t: "Lei 14.133/2021" }], antigo);
    const rr = api.lerEdital(rec.texto);
    const lei = rr.disciplinas[0].topicos.find((t) => /14\.133/.test(t.nome));
    ok(rec.postos === 1 && lei && lei.ramos && lei.ramos.length === 3 && lei.peso === 5, "R5 o topico recolocado volta COM os ramos e o peso: " + JSON.stringify(lei && (lei.ramos || []).length));
  }
  {
    /* numeracao do edital */
    const num = "@ 1. Licitações :: 5\n+ 1.1 Lei 14.133 :: 5\n++ 1.1.1 Modalidades :: 4\n++ 2.a Fases";
    ok(api.temNumeracaoEdital(num) === true, "R6 detecta numeracao");
    const sem = api.tirarNumeracaoEdital(num);
    ok(sem.split("\n")[2] === "++ Modalidades :: 4" && sem.split("\n")[1] === "+ Lei 14.133 :: 5" && sem.split("\n")[3] === "++ 2.a Fases", "R6a tirar a numeracao mexe no nome do ramo SEM virar topico ('+ + ...'): " + JSON.stringify(sem.split("\n")));
    ok(api.temNumeracaoEdital("@ D :: 5\n+ T :: 5\n++ 3.2 Ramo") === true && api.temNumeracaoEdital("@ D :: 5\n+ T :: 5\n++ Ramo") === false, "R6b so' a numeracao do ramo tambem e' detectada");
    ok(api.normalizarMarcadores("@ D :: 5\n- T :: 5\n++ R") === "@ D :: 5\n+ T :: 5\n++ R", "R6c normalizar marcadores nao mexe no ++");
  }

  /* ---- R7: editar os ramos de um topico ---- */
  {
    const ler = (txt) => api.edRamosDoTopico(txt, "Licitações e Contratos", "Lei 14.133/2021");
    ok(ler(BASE).length === 3 && api.edRamosDoTopico(BASE, "licitacoes e contratos", "LEI 14.133/2021").length === 3, "R7 edRamosDoTopico acha o topico sem diferenciar caixa/acento");
    ok(api.edRamosDoTopico(BASE, "X", "Y").length === 0 && api.edRamosDoTopico(BASE, "Direito Financeiro", "Receita Pública").length === 0, "R7a topico inexistente ou sem ramos: lista vazia");
    const copia = ler(BASE); copia[0].nome = "MEXI";
    ok(ler(BASE)[0].nome === "Modalidades de licitação", "R7b devolve COPIAS (mexer nelas nao altera nada)");
    /* trocar tudo */
    const e1 = api.edEditarRamos(BASE, "Licitações e Contratos", "Lei 14.133/2021", [
      { nome: "Fase preparatória", peso: 4 }, { nome: "  Modalidades   de licitação ", peso: "5", nota: "cai muito" }, { nome: "Sanções", peso: "2q" }, { nome: "Nova :: com dois pontos" },
    ]);
    ok(e1 && e1.avisos.length === 0 && e1.ramos.map((x) => x.nome).join("|") === "Fase preparatória|Modalidades de licitação|Sanções|Nova - com dois pontos", "R7c criar, renomear (espacos arrumados), reordenar e '::' no nome vira ' - ': " + (e1 && e1.ramos.map((x) => x.nome).join("|")));
    const lidos = ler(e1.texto);
    ok(lidos.map((x) => x.nome + "/" + x.peso + "/" + x.herdado).join("|") === "Fase preparatória/4/false|Modalidades de licitação/5/false|Sanções/3/false|Nova - com dois pontos/3/true" && lidos[2].abs === 2 && lidos[1].nota === "cai muito", "R7d o texto novo, lido de volta, tem a ordem, os pesos e as notas pedidos: " + lidos.map((x) => x.nome + "/" + x.peso).join("|"));
    const cx = api.edEditarRamos(BASE, "licitacoes e contratos", "lei 14.133/2021", [{ nome: "Caixa", nota: "a :: b" }]);
    ok(cx && ler(cx.texto)[0].nome === "Caixa" && ler(cx.texto)[0].nota === "a - b", "R7c2 acha o topico sem caixa/acento e a nota com '::' vira ' - ' (nao quebra a linha)");
    /* nada mais foi tocado */
    const semRamos = (txt) => txt.split("\n").filter((l) => !/^\+\+/.test(l)).join("\n");
    ok(semRamos(e1.texto) === semRamos(BASE), "R7e o resto do texto (cabecalho, topicos, disciplinas) ficou EXATAMENTE igual");
    /* idempotente */
    const e2 = api.edEditarRamos(e1.texto, "Licitações e Contratos", "Lei 14.133/2021", ler(e1.texto).map((x) => ({ nome: x.nome, peso: x.herdado ? undefined : (x.abs ? x.abs + "q" : x.peso), nota: x.nota })));
    ok(e2.texto === e1.texto, "R7f aplicar a mesma lista de novo nao muda nada (idempotente)");
    /* remover tudo */
    const e3 = api.edEditarRamos(BASE, "Licitações e Contratos", "Lei 14.133/2021", []);
    ok(e3.texto === semRamos(BASE) && ler(e3.texto).length === 0, "R7g lista vazia remove todos os ramos e so' eles");
    /* criar num topico que nao tinha */
    const e4 = api.edEditarRamos(BASE, "Direito Financeiro", "Receita Pública", [{ nome: "Estágios da receita", peso: 4 }]);
    const l4 = e4.texto.split("\n");
    ok(l4[l4.length - 2] === "+ Receita Pública :: 4" && l4[l4.length - 1] === "++ Estágios da receita :: 4" && api.edRamosDoTopico(e4.texto, "Direito Financeiro", "Receita Pública").length === 1, "R7h cria ramo num topico que nao tinha (no fim do texto tambem)");
    ok(api.edRamosDoTopico(e4.texto, "Licitações e Contratos", "Lei 14.133/2021").length === 3, "R7i os ramos dos OUTROS topicos ficam como estavam");
    /* topico inexistente */
    ok(api.edEditarRamos(BASE, "Nada", "Nada", [{ nome: "X" }]) === null, "R7j topico que nao existe: null (nada e' escrito)");
    /* avisos */
    const e5 = api.edEditarRamos(BASE, "Licitações e Contratos", "Lei 14.133/2021", [{ nome: "A" }, { nome: "a" }, { nome: "   " }, { nome: "B", peso: "muito" }, { nome: "C", peso: 9 }]);
    ok(e5.ramos.map((x) => x.nome).join("|") === "A|B|C" && e5.avisos.map((a) => a.tipo).join("|") === "repetido|sem_nome|peso|peso", "R7k repetido, sem nome e peso invalido/fora viram AVISOS (o resto e' gravado): " + JSON.stringify(e5.avisos.map((a) => a.tipo)));
    ok(ler(e5.texto).map((x) => x.nome).join("|") === "A|B|C" && ler(e5.texto)[1].herdado === true && ler(e5.texto)[2].peso === 5 && ler(e5.texto)[2].herdado === false, "R7l peso invalido volta a ser igual-aos-irmaos no texto");
    /* linha em branco e ramos espalhados */
    const sujo = ["@ D :: 5", "+ T :: 5", "", "++ Velho 1", "", "++ Velho 2", "+ Outro :: 3", "++ Do outro :: 2"].join("\n");
    const e6 = api.edEditarRamos(sujo, "D", "T", [{ nome: "Novo" }]);
    ok(e6.texto === ["@ D :: 5", "+ T :: 5", "++ Novo", "", "", "+ Outro :: 3", "++ Do outro :: 2"].join("\n") && api.edRamosDoTopico(e6.texto, "D", "Outro").length === 1, "R7m ramos separados por linhas em branco sao TODOS trocados (sem sobra do velho) e os do topico seguinte ficam: " + JSON.stringify(e6.texto));
    /* fim de linha do Windows */
    const crlf = BASE.replace(/\n/g, "\r\n");
    const e7 = api.edEditarRamos(crlf, "Licitações e Contratos", "Lei 14.133/2021", [{ nome: "Só um" }]);
    ok(!/[^\r]\n/.test(e7.texto) && e7.texto.indexOf("++ Só um\r\n") >= 0, "R7n texto com CRLF continua com CRLF");
    /* fase 2, blocos e cabecalho seguem */
    const rico = ["# X | prova: 2026-12-13 | horas: 20", "# fase 2: discursiva | prova: 2027-01-24 | horas: 25", "& Bloco A | minimo: 60%", "@ D :: 5", "+ T :: 5 :: motivo !d", "++ R1"].join("\n");
    const e8 = api.edEditarRamos(rico, "D", "T", [{ nome: "R1" }, { nome: "R2", peso: 5 }]);
    const back = api.lerEdital(e8.texto);
    ok(back.cfg.fase2 && back.cfg.fase2.prova === "2027-01-24" && back.blocos.length === 1 && back.disciplinas[0].topicos[0].fase2 === true && back.disciplinas[0].topicos[0].ramos.length === 2, "R7o segunda fase, bloco e marca !d continuam intactos");
    /* id estavel: renomear muda o id (e' o que a etiqueta ram_ vai seguir) */
    ok(api.edRamoId("Modalidades de licitação") === "modalidades_de_licitacao" && api.edRamoId("  A/B — C  ") === "a_b_c" && api.edRamoId("") === "" && api.edRamoId("x".repeat(60)).length === 40, "R7p edRamoId: sem acento, minusculo, so' letras/numeros/_ e no maximo 40");
  }

  /* ================= G5b: a tela (Biblioteca) e o editor livre ================= */
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const negar = async (api, promessa) => {
    for (let i = 0; i < 6; i++) { await Promise.resolve(); api.uiModalResponder(false); }
    return promessa;
  };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(k, v) { this.dados[k] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
  const EDITAL = "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Licitações :: 5\n+ Lei 14.133 :: 5\n++ Modalidades :: 5 :: pregão\n++ Fase preparatória\n++ Contratos :: 3\n+ Convênios :: 2\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4";
  const MT = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const ed = a.edCriar("ISS Caruaru Auditor", EDITAL);
    const k = (d, t) => a.matChave(d, t);
    a.matGravarCartoes(k("Licitações", "Lei 14.133"), [
      "Modalidades? :: Pregão e concorrência :: ram_modalidades",
      "Fase? :: Planejamento :: ram_fase_preparatoria",
      "Contrato? :: Escrito :: ram_contratos, extra",
      "Geral? :: Sem ramo",
      "Fantasma? :: x :: ram_inexistente"].join("\n"), { disciplina: "Licitações", topico: "Lei 14.133", concurso: "ISS Caruaru Auditor" });
    a.matGravarCartoes(k("Direito Financeiro", "Receita Pública"), "Receita? :: Estagios :: ram_modalidades", { disciplina: "Direito Financeiro", topico: "Receita Pública", concurso: "ISS Caruaru Auditor" });
    a.$("editor").value = "";
    return { a, ed, k, chave: k("Licitações", "Lei 14.133") };
  };
  const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
  const txtRamo = (e) => e.textContent.trim();
  const abrirTopicoLei = (a, ed) => {
    a.gerAbrir();
    const root = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((x) => x.nome === "ISS Caruaru Auditor");
    a.gerAbertosAtual().add(root.id + "|licitacoes"); a.gerPintar();
    return root;
  };

  /* etiquetas */
  {
    const { a } = MT();
    const c = { ownTags: ["ram_Modalidades", "x"], tags: ["ram_Modalidades", "x", "y"], front: "F", back: "B" };
    ok(a.ramIdDoCartao(c) === "modalidades" && a.ramIdDoCartao({ tags: ["a"] }) === "" && a.ramIdDoCartao(null) === "" && a.ramIdDoCartao({ ownTags: ["RAM_Fase"] }) === "fase", "R8 le o ramo da etiqueta ram_<id> (sem diferenciar caixa) e devolve '' sem ela");
    ok(a.ramIdDoCartao({ tags: ["ram_soTags"] }) === "sotags" && a.ramIdDoCartao({ ownTags: ["ram_soOwn"] }) === "sooown".replace("oo", "o"), "R8-0 le a etiqueta tanto de ownTags quanto de tags");
    const t1 = a.ramCartaoComRamo(c, "contratos");
    ok(t1.ownTags.join() === "x,ram_contratos" && t1.tags.join() === "x,y,ram_contratos" && c.ownTags[0] === "ram_Modalidades", "R8a trocar o ramo mantem as outras etiquetas e nao altera o original");
    ok(a.ramCartaoComRamo(c, "").ownTags.join() === "x" && a.ramCartaoComRamo({ front: "F" }, "z").ownTags.join() === "ram_z", "R8b id vazio so' tira a etiqueta; cartao sem etiquetas ganha");
  }
  /* o modelo e a arvore */
  {
    const { a, ed } = MT();
    a.gerAbrir();
    const m = a.gerModeloEditais(a.gerNotasAtual(), []);
    const root = m.roots.find((x) => x.nome === "ISS Caruaru Auditor");
    const lei = root.filhos[0].filhos[0];
    ok(lei.ramos.map((x) => x.nome + ":" + x.total).join("|") === "Modalidades:1|Fase preparatória:1|Contratos:1" && lei.semRamo === 2 && lei.total === 5, "R9 o topico do plano traz os ramos na ordem do edital, com a contagem de cartoes de cada; o resto e' 'geral' (inclusive etiqueta de ramo que nao existe mais): " + JSON.stringify(lei.ramos.map((x) => x.total)) + " geral " + lei.semRamo);
    ok(lei.plano && lei.plano.editalId === ed.id && lei.plano.disciplina === "Licitações" && lei.plano.topico === "Lei 14.133" && root.filhos[0].filhos[1].ramos === undefined, "R9a o no guarda de onde vem (edital/disciplina/topico do plano); topico sem ramos nao ganha o campo");
    ok(lei.ramos[0].peso === 5 && lei.ramos[0].herdado === false && lei.ramos[1].herdado === true && lei.ramos[0].nota === "pregão", "R9b peso, herdado e nota do ramo chegam ao no");
    abrirTopicoLei(a, ed);
    const l = linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent));
    ok(/^▸/.test(l.textContent.trim()) && linhas(a, "ger-ramo").length === 0, "R10 o topico COM ramos tem a seta fechada e nenhum ramo a vista");
    ok(!/[▸▾]/.test(linhas(a, "ger-top").find((e) => /Convênios/.test(e.textContent)).textContent), "R10a topico sem ramos nao tem seta");
    l.children[0].onclick({ stopPropagation() {} });
    const rs = linhas(a, "ger-ramo").map(txtRamo);
    ok(rs.join("|") === "↳ Modalidades (1) ★5|↳ Fase preparatória (1)|↳ Contratos (1) ★3|↳ (geral do tópico) (2)", "R10b abrir mostra os ramos com contagem e estrelas (so' os que tem peso) e o geral: " + rs.join("|"));
    ok(linhas(a, "ger-ramo").every((e) => e.title.length > 20) && linhas(a, "ger-ramo").find((e) => /Modalidades/.test(e.textContent)).title.indexOf("pregão") > 0, "R10c cada ramo explica o que faz (e mostra a nota)");
    linhas(a, "ger-top").find((e) => /Lei 14.133/.test(e.textContent)).children[0].onclick({ stopPropagation() {} });
    ok(linhas(a, "ger-ramo").length === 0, "R10d a seta fecha de novo");
  }
  /* filtrar pelo ramo */
  {
    const { a, ed } = MT();
    abrirTopicoLei(a, ed);
    const lei = () => linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent));
    lei().children[0].onclick({ stopPropagation() {} });
    const lista = () => achar(a.$("gerLista"), (e) => cls(e, "ger-item")).map((e) => e.textContent);
    linhas(a, "ger-ramo").find((e) => /Modalidades/.test(e.textContent)).onclick();
    ok(lista().length === 1 && /Modalidades\?/.test(lista()[0]) && cls(linhas(a, "ger-ramo").find((e) => /Modalidades/.test(e.textContent)), "ger-atual") && !cls(lei(), "ger-atual"), "R11 clicar no ramo lista SO' os cartoes dele; a linha do ramo acende e a do topico nao");
    linhas(a, "ger-ramo").find((e) => /geral do tópico/.test(e.textContent)).onclick();
    ok(lista().length === 2 && lista().some((x) => /Geral\?/.test(x)) && lista().some((x) => /Fantasma\?/.test(x)), "R11a o 'geral' lista os sem ramo E os de etiqueta que nao existe mais");
    lei().onclick();
    ok(lista().length === 5, "R11b clicar no topico volta a listar todos os cartoes dele");
  }
  /* soltar cartoes num ramo */
  {
    const { a, ed, chave } = MT();
    abrirTopicoLei(a, ed);
    const lei = () => linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent));
    lei().children[0].onclick({ stopPropagation() {} });
    const it = () => achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
    const iG = () => it().findIndex((e) => /Geral\?/.test(e.textContent));
    it()[iG()].ondragstart(ev());
    const alvo = linhas(a, "ger-ramo").find((e) => /Contratos/.test(e.textContent));
    const eo = ev(); alvo.ondragover(eo);
    ok(eo.prevented === true && cls(alvo, "ger-alvo"), "R12 o ramo aceita cartoes do PROPRIO topico (o topico em si nao aceitaria)");
    const edr = ev();
    const pn = alvo.ondrop(edr);
    ok(edr.prevented === true && a.gerArrastoAtual() === null, "R12-0 soltar cancela o padrao do navegador e termina o arrasto");
    await Promise.resolve();
    ok(/Ligar 1 cartão\(ões\) ao ramo “Contratos”/.test((a.$("uiModalMsg") || {}).textContent || "") && !/OUTRO tópico/.test((a.$("uiModalMsg") || {}).textContent || ""), "R12a a confirmacao diz qual ramo e nao fala em mover: " + (a.$("uiModalMsg") || {}).textContent);
    await negar(a, pn);
    ok(!/Geral\? :: Sem ramo :: ram_/.test(a.matResumosAtual()[chave].cartoes), "R12b dizer NAO nao muda nada");
    it()[iG()].ondragstart(ev());
    await conduzir(a, linhas(a, "ger-ramo").find((e) => /Contratos/.test(e.textContent)).ondrop(ev()));
    ok(/Geral\? :: Sem ramo :: ram_contratos/.test(a.matResumosAtual()[chave].cartoes) && /1 cartão\(ões\) ligado/.test(a.$("gerMsg").textContent) && a.$("btnGerMsgDesfazer").hidden === false, "R12c soltar liga o cartao ao ramo (etiqueta no texto) e oferece desfazer: " + a.$("gerMsg").textContent);
    ok(/Contratos \(2\)/.test(txtRamo(linhas(a, "ger-ramo").find((e) => /Contratos/.test(e.textContent)))) && /geral do tópico\) \(1\)/.test(txtRamo(linhas(a, "ger-ramo").find((e) => /geral do/.test(e.textContent)))), "R12d as contagens da arvore acompanham");
    ok(/Modalidades\? :: Pregão e concorrência :: ram_modalidades/.test(a.matResumosAtual()[chave].cartoes) && /Contrato\? :: Escrito :: ram_contratos, extra/.test(a.matResumosAtual()[chave].cartoes), "R12e os outros cartoes ficam exatamente como estavam");
    await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
    ok(!/Geral\? :: Sem ramo :: ram_/.test(a.matResumosAtual()[chave].cartoes), "R12f desfazer tira a etiqueta");
    /* soltar no geral tira o ramo */
    const im = () => it().findIndex((e) => /Modalidades\?/.test(e.textContent));
    it()[im()].ondragstart(ev());
    await conduzir(a, linhas(a, "ger-ramo").find((e) => /geral do/.test(e.textContent)).ondrop(ev()));
    ok(!/Modalidades\? :: Pregão e concorrência :: ram_/.test(a.matResumosAtual()[chave].cartoes) && /Modalidades\? ::/.test(a.matResumosAtual()[chave].cartoes), "R12g soltar no 'geral' tira o cartao do ramo");
    /* cartao de OUTRO topico: e' movido E ligado, num recibo so' */
    a.gerAbrir();
    const root = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((x) => x.nome === "ISS Caruaru Auditor");
    a.gerAbertosAtual().add(root.id + "|licitacoes"); a.gerAbertosAtual().add("rm|" + chave + "|ISS Caruaru Auditor"); a.gerPintar();
    linhas(a, "ger-pasta")[0].onclick();
    const iR = it().findIndex((e) => /Receita\?/.test(e.textContent));
    it()[iR].ondragstart(ev());
    const pn2 = linhas(a, "ger-ramo").find((e) => /Fase preparatória/.test(e.textContent)).ondrop(ev());
    await Promise.resolve();
    ok(/1 deles estão em OUTRO tópico e serão movidos/.test((a.$("uiModalMsg") || {}).textContent || ""), "R12h cartao de outro topico: a confirmacao avisa que sera movido");
    await conduzir(a, pn2);
    ok(/Receita\? :: Estagios :: ram_fase_preparatoria/.test(a.matResumosAtual()[chave].cartoes) && !/Receita/.test(((a.matResumosAtual()[a.matChave("Direito Financeiro", "Receita Pública")] || {}).cartoes || "")), "R12i o cartao foi movido para o topico E ligado ao ramo");
    await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
    ok(!/Receita\?/.test(a.matResumosAtual()[chave].cartoes) && /Receita\?/.test(a.matResumosAtual()[a.matChave("Direito Financeiro", "Receita Pública")].cartoes), "R12j UM desfazer volta o cartao ao topico de origem, sem etiqueta");
  }
  /* o editor livre */
  {
    const { a, ed, chave } = MT();
    a.gerAbrir();
    ok(a.$("btnGerRamos").hidden === true, "R13 sem pasta aberta o botao 'Ramos do topico' nao aparece");
    const root = abrirTopicoLei(a, ed);
    const lei = () => linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent));
    linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
    ok(a.$("btnGerRamos").hidden === true, "R13a com o EDITAL aberto (e nao um topico) ainda nao");
    lei().onclick();
    ok(a.$("btnGerRamos").hidden === false, "R13b com um TOPICO do plano aberto aparece");
    a.$("btnGerRamos").onclick();
    ok(a.$("dlgRamos").open === true && a.ramLinhasAtual().length === 3 && /Ramos de “Lei 14\.133”/.test(a.$("ramTit").textContent), "R14 abre o editor com os 3 ramos do topico");
    const rows = () => achar(a.$("ramLista"), (e) => cls(e, "ram-linha"));
    const campo = (i, c) => achar(rows()[i], (e) => cls(e, c))[0];
    ok(campo(0, "ram-nome").value === "Modalidades" && campo(0, "ram-peso").value === "5" && campo(1, "ram-peso").value === "" && campo(2, "ram-peso").value === "3" && campo(0, "ram-nota").value === "pregão", "R14a nome, peso e nota de cada ramo aparecem");
    ok(achar(rows()[0], (e) => e.tag === "button").length === 3 && achar(rows()[0], (e) => e.tag === "button")[0].disabled === true && achar(rows()[2], (e) => e.tag === "button")[1].disabled === true, "R14b o primeiro nao sobe e o ultimo nao desce");
    /* editar livremente: renomear, mudar peso, subir, apagar, criar */
    campo(0, "ram-nome").value = "Modalidades de licitação"; campo(0, "ram-nome").oninput();
    campo(2, "ram-peso").value = "1"; campo(2, "ram-peso").onchange();
    achar(rows()[2], (e) => e.tag === "button")[0].onclick();
    ok(a.ramLinhasAtual().map((x) => x.nome).join("|") === "Modalidades de licitação|Contratos|Fase preparatória" && a.ramLinhasAtual()[1].peso === "1", "R14c subir reordena e leva o peso junto");
    achar(rows()[2], (e) => e.tag === "button")[2].onclick();
    ok(a.ramLinhasAtual().length === 2, "R14d apagar tira da lista (so' grava ao salvar)");
    /* limites do sobe/desce e a nota acompanha o campo */
    const antesLista = a.ramLinhasAtual().map((x) => x.nome).join("|");
    a.ramMover(0, -1); a.ramMover(a.ramLinhasAtual().length - 1, 1);
    ok(a.ramLinhasAtual().map((x) => x.nome).join("|") === antesLista && a.ramLinhasAtual().every((x) => x && x.nome), "R14e mover alem das pontas nao faz nada (nem cria linha vazia)");
    campo(0, "ram-nota").value = "nota nova"; campo(0, "ram-nota").oninput();
    ok(a.ramLinhasAtual()[0].nota === "nota nova", "R14f a nota digitada acompanha a linha");
    a.$("btnRamMais").onclick();
    a.ramLinhasAtual()[2].nome = "Sanções"; a.ramLinhasAtual()[2].peso = "4";
    const antesEd = ed.texto, antesCards = a.matResumosAtual()[chave].cartoes;
    ok(a.$("btnRamSalvar").onclick() && a.$("dlgRamos").open === false, "R15 salvar fecha o editor");
    const rams = a.edRamosDoTopico(ed.texto, "Licitações", "Lei 14.133");
    ok(rams.map((x) => x.nome + "/" + x.peso + "/" + x.herdado).join("|") === "Modalidades de licitação/5/false|Contratos/1/false|Sanções/4/false", "R15a o edital recebeu os ramos (ordem, pesos e o novo): " + rams.map((x) => x.nome + "/" + x.peso).join("|"));
    const cs = a.matResumosAtual()[chave].cartoes;
    ok(/Modalidades\? :: Pregão e concorrência :: ram_modalidades_de_licitacao/.test(cs) && !/ram_fase_preparatoria/.test(cs) && /Fase\? :: Planejamento/.test(cs) && /ram_contratos, extra/.test(cs), "R15b RENOMEAR leva a etiqueta dos cartoes junto; APAGAR tira a etiqueta (o cartao fica no geral); os outros nao mudam");
    ok(cs.indexOf("Estagios") < 0 && /Modalidades\? ::/.test(cs), "R15b1 os cartoes de OUTRO topico nao entram no texto deste");
    ok(/Receita\? :: Estagios :: ram_modalidades\s*$/m.test(a.matResumosAtual()[a.matChave("Direito Financeiro", "Receita Pública")].cartoes), "R15b2 renomear NAO mexe nas etiquetas de cartoes de OUTROS topicos");
    ok(/\+\+ Modalidades de licitação :: 5 :: nota nova/.test(ed.texto), "R15c0 a nota editada chegou ao texto do edital");
    const salvo = JSON.parse(a.lojaLer("eac_editais")).find((x) => x.id === ed.id);
    ok(salvo && salvo.texto === ed.texto, "R15c1 o edital foi SALVO na lista (nao so' na memoria)");
    ok(a.ramAplicar({ editalId: "nao-existe", disciplina: "Licitações", topico: "Lei 14.133", chave }, []).motivo === "sem_edital", "R15c2 edital que nao existe: recusa sem escrever nada");
    ok(a.edParaTexto && ed.texto.replace(/\+\+ [^\n]*\n?/g, "") === antesEd.replace(/\+\+ [^\n]*\n?/g, ""), "R15c o resto do texto do edital ficou igual");
    ok(/Ramos salvos: 3 ramo\(s\); 2 cartão\(ões\) acompanharam/.test(a.$("gerMsg").textContent) && a.$("btnGerMsgDesfazer").hidden === false, "R15d aviso conta o que aconteceu e oferece desfazer: " + a.$("gerMsg").textContent);
    const l2 = linhas(a, "ger-ramo").map(txtRamo);
    ok(l2.join("|") === "↳ Modalidades de licitação (1) ★5|↳ Contratos (1) ★1|↳ Sanções (0) ★4|↳ (geral do tópico) (3)", "R15e a arvore ja mostra os ramos novos (o topico abre sozinho): " + l2.join("|"));
    /* UM desfazer volta o edital e os cartoes */
    a.edAbrir(ed.id); a.$("editalTexto").value = ed.texto;
    await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
    ok(ed.texto === antesEd && a.matResumosAtual()[chave].cartoes === antesCards, "R16 desfazer devolve o texto do edital E as etiquetas dos cartoes de uma vez");
    ok(JSON.parse(a.lojaLer("eac_editais")).find((x) => x.id === ed.id).texto === antesEd, "R16a o desfazer tambem SALVA o edital");
    ok(a.$("editalTexto").value === antesEd, "R16b e atualiza o texto na tela do edital, quando ele esta aberto");
    /* o edital aberto na tela do edital acompanha */
    a.edAbrir(ed.id); a.$("editalTexto").value = ed.texto;
    a.gerAbrir(); abrirTopicoLei(a, ed);
    lei().onclick(); a.$("btnGerRamos").onclick();
    a.ramLinhasAtual().push({ nome: "Novo no aberto", peso: "", nota: "" });
    a.ramSalvar();
    ok(a.$("editalTexto").value === ed.texto && /\+\+ Novo no aberto/.test(a.$("editalTexto").value), "R17 com o edital aberto na tela dele, o texto de la' acompanha");
    /* dois editais com o MESMO topico: vale o do contexto (o edital sob o qual a pasta foi aberta) */
    {
      const { a, ed } = MT();
      const ed2 = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Licitações :: 5\n+ Lei 14.133 :: 5\n++ Só do TCE");
      const abrirSob = (edId) => {
        a.gerAbrir();
        const m2 = a.gerModeloEditais(a.gerNotasAtual(), []);
        const r = m2.roots.find((x) => x.id === "ed:" + edId);
        a.gerAbertosAtual().add(r.id); a.gerAbertosAtual().add(r.id + "|licitacoes"); a.gerPintar();
        linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent)).onclick();
      };
      abrirSob(ed2.id);
      ok(a.gerContextoRamos() && a.gerContextoRamos().editalId === ed2.id, "R21 pasta aberta sob o edital B: os ramos editados sao os do B: " + JSON.stringify(a.gerContextoRamos()));
      abrirSob(ed.id);
      ok(a.gerContextoRamos() && a.gerContextoRamos().editalId === ed.id, "R21a e sob o A, os do A");
    }
    /* topico que NAO e' do plano de edital nenhum: sem ramos */
    {
      const { a } = MT();
      a.matGravarCartoes(a.matChave("Livre", "Solta"), "P? :: R", { disciplina: "Livre", topico: "Solta", concurso: "Concurso sem edital" });
      a.gerAbrir();
      const raizSem = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((x) => x.tipo === "sem" && /Concurso sem edital/.test(x.nome));
      a.gerAbertosAtual().add(raizSem.id); a.gerAbertosAtual().add(raizSem.id + "|livre"); a.gerPintar();
      linhas(a, "ger-top").find((e) => /Solta/.test(e.textContent)).onclick();
      ok(a.gerContextoRamos() === null && a.$("btnGerRamos").hidden === true, "R22 topico que nao esta no plano de nenhum edital: nao ha ramos a editar (botao escondido)");
    }
    /* topico DENTRO de um edital mas que nao esta no plano dele (material antigo): tambem sem ramos */
    {
      const { a, ed, k } = MT();
      a.matGravarCartoes(k("Licitações", "Assunto fora do plano"), "Fora? :: x", { disciplina: "Licitações", topico: "Assunto fora do plano", concurso: "ISS Caruaru Auditor" });
      a.gerAbrir();
      const r = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((x) => x.id === "ed:" + ed.id);
      a.gerAbertosAtual().add(r.id); a.gerAbertosAtual().add(r.id + "|licitacoes"); a.gerPintar();
      const l = linhas(a, "ger-top").find((e) => /Assunto fora do plano/.test(e.textContent));
      ok(!!l, "R22a o topico de fora do plano aparece sob o edital");
      l.onclick();
      ok(a.gerContextoRamos() === null && a.$("btnGerRamos").hidden === true, "R22b topico sem lugar no plano do edital nao tem ramos a editar");
    }
    /* R26: o botao "propor pelo indice da lei" no editor */
    {
      const { a, ed, chave } = MT();
      const ctx = { editalId: ed.id, disciplina: "Licitações", topico: "Lei 14.133", chave };
      a.ramAbrirEditor(ctx);
      ok(a.$("btnRamLei").disabled === true && a.$("btnRamLei").getAttribute("aria-description") === a.t("ram_tip_lei_sem"), "R26 sem lei carregada o botao fica desligado e explica por que");
      a.ramProporDaLei();
      ok(/Não achei/.test(a.$("ramMsg").textContent) && a.ramLinhasAtual().length === 3, "R26a sem lei: avisa e nao mexe na lista");
      a.$("btnRamFechar").onclick();
      a.matResumosAtual()[chave].leiTexto = "   ";
      a.ramAbrirEditor(ctx);
      ok(a.$("btnRamLei").disabled === true, "R26a2 lei so' com espacos conta como sem lei");
      a.$("btnRamFechar").onclick();
      a.matResumosAtual()[chave].leiTexto = ["LEI Nº 14.133", "TÍTULO I", "PARTES", "Art. 1 Texto.", "Art. 2 Texto.", "TÍTULO II", "ATOS", "Art. 3 Texto.", "TÍTULO III", "FIM", "Art. 4 Texto."].join("\n");
      a.ramAbrirEditor(ctx);
      ok(a.$("btnRamLei").disabled === false && a.$("btnRamLei").getAttribute("aria-description") === a.t("ram_tip_lei"), "R26b com lei carregada o botao liga");
      const antes = a.ramLinhasAtual().map((l) => l.nome).join("|");
      a.$("btnRamLei").onclick();
      const dep = a.ramLinhasAtual();
      ok(dep.length === 6 && dep.slice(0, 3).map((l) => l.nome).join("|") === antes && dep[3].nome === "TÍTULO I — PARTES" && dep[3].peso === "5" && /arts\. 1 a 2/.test(dep[3].nota), "R26c acrescenta os ramos da lei DEPOIS dos que a pessoa ja tinha (nao apaga nada): " + dep.map((l) => l.nome));
      ok(a.$("ramLista").children.length === 6, "R26c2 a lista na tela foi repintada com os novos ramos: " + a.$("ramLista").children.length);
      ok(/3 ramo\(s\) novo/.test(a.$("ramMsg").textContent), "R26d diz quantos entraram: " + a.$("ramMsg").textContent);
      a.$("btnRamLei").onclick();
      ok(a.ramLinhasAtual().length === 6 && /0 ramo/.test(a.$("ramMsg").textContent), "R26e propor de novo nao duplica");
      const r = a.ramSalvar();
      const salvos = a.edRamosDoTopico(ed.texto, "Licitações", "Lei 14.133").map((x) => x.nome);
      ok(r.ok && salvos.length === 6 && salvos[3] === "TÍTULO I — PARTES", "R26f salvar grava as propostas no edital: " + salvos);
    }

    {
      const { a, ed, chave } = MT();
      const muitos = ["LEI Nº 1"];
      for (let i = 1; i <= 25; i++) { muitos.push("TÍTULO " + i, "D" + i, "Art. " + i + " Texto."); }
      a.matResumosAtual()[chave].leiTexto = muitos.join("\n");
      a.ramAbrirEditor({ editalId: ed.id, disciplina: "Licitações", topico: "Lei 14.133", chave });
      a.$("btnRamLei").onclick();
      ok(a.ramLinhasAtual().length === 3 + 20 && /primeiros/.test(a.$("ramMsg").textContent) && /5/.test(a.$("ramMsg").textContent), "R26g lei com mais de 20 divisoes: entram 20 e a mensagem avisa do corte: " + a.$("ramMsg").textContent);
    }

    /* R28: pedir a IA e conferir a resposta no editor */
    {
      const { a, ed, chave } = MT();
      const ctx = { editalId: ed.id, disciplina: "Licitações", topico: "Lei 14.133", chave };
      a.ramAbrirEditor(ctx);
      ok(a.$("ramIaBox").hidden === true, "R28 a caixa de colar fica escondida ate pedir a IA");
      const pedido = await a.$("btnRamIa").onclick();
      ok(a.$("ramMsg").textContent === a.t("ram_ia_copiado"), "R28a0 o botao 'Pedir a IA' funciona e avisa que copiou");
      const copiado = await a.navegador.clipboard.readText();
      ok(a.$("ramIaBox").hidden === false && copiado === pedido && /Lei 14\.133/.test(pedido) && /Licitações/.test(pedido) && /ISS Caruaru Auditor/.test(pedido), "R28a o pedido e' copiado e traz topico, disciplina e concurso");
      ok(/Modalidades/.test(pedido) && /Contratos/.test(pedido) && /não repita|sem repetir|without repeating/i.test(pedido), "R28b o pedido lista os ramos que a pessoa ja tem, para a IA nao repetir");
      ok(/\+\+ Nome do ramo :: peso :: nota/.test(pedido) && /1 a 5/.test(pedido) && !/\{[a-z]+\}/.test(pedido), "R28c o pedido diz o formato, a escala de peso e nao deixa {campo} sem preencher");
      ok(!/Índice da lei/.test(pedido) && !/questão/.test(pedido), "R28d sem lei e sem questoes o pedido nao fala de indice nem de questoes");
      a.$("btnRamFechar").onclick();
      a.matResumosAtual()[chave].leiTexto = ["LEI Nº 1", "TÍTULO I", "PARTES", "Art. 1 T.", "Art. 2 T.", "TÍTULO II", "ATOS", "Art. 3 T.", "TÍTULO III", "FIM", "Art. 4 T."].join(String.fromCharCode(10));
      a.ramAbrirEditor(ctx);
      a.qsBancoPor([{ chave, banca: "X", enunciado: "?" }, { chave, banca: "X", enunciado: "??" }]);
      const p2 = await a.ramPedirIA();
      ok(/2 questão/.test(p2), "R28e2 com questoes guardadas do topico o pedido diz quantas sao: " + p2.slice(-160));
      a.qsBancoPor([]);
      /* clipboard indisponivel: o pedido vai para a caixa, para copiar de la */
      const orig = a.navegador.clipboard.writeText;
      a.navegador.clipboard.writeText = async () => { throw new Error("negado"); };
      a.$("ramColar").value = "";
      const p3 = await a.ramPedirIA();
      a.navegador.clipboard.writeText = orig;
      ok(a.$("ramColar").value === p3 && p3.length > 100 && a.$("ramMsg").textContent === a.t("ram_ia_copie_manual"), "R28e3 sem permissao de copiar, o pedido aparece na caixa e a mensagem manda copiar de la");
      ok(/Índice da lei/.test(p2) && /TÍTULO I — PARTES \(arts\. 1 a 2\)/.test(p2), "R28e com lei carregada o pedido leva o indice dela (com os artigos): " + p2.slice(-200));
      /* conferir */
      const NL = String.fromCharCode(10);
      a.$("ramColar").value = ["Aqui vai:", "++ Modalidades :: 2 :: outra nota", "++ Sanções :: 4 :: arts. 155 a 163", "- Nulidades :: 3", "++ Erro :: muito"].join(NL);
      const antes = a.ramLinhasAtual().map((l) => l.nome + "/" + l.peso);
      const r = a.$("btnRamConferir").onclick();
      const dep = a.ramLinhasAtual();
      ok(r.novos === 3 && r.jaExistiam === 1 && dep.length === 6, "R28f acrescenta so os 3 ramos novos; o que ja existia (Modalidades) nao duplica: " + dep.map((l) => l.nome));
      ok(dep.slice(0, 3).map((l) => l.nome + "/" + l.peso).join() === antes.join() && dep[0].peso === "5" && dep[0].nota === "pregão", "R28g o que a pessoa ja tinha fica INTACTO (peso e nota nao sao trocados pela IA)");
      ok(dep[3].nome === "Sanções" && dep[3].peso === "4" && dep[3].nota === "arts. 155 a 163" && dep[4].nome === "Nulidades" && dep[5].nome === "Erro" && dep[5].peso === "", "R28h os novos entram na ordem com peso e nota; peso invalido volta ao igual");
      ok(/3 ramo\(s\) novo/.test(a.$("ramMsg").textContent) && /1 já existia/.test(a.$("ramMsg").textContent) && /1 linha\(s\) de conversa/.test(a.$("ramMsg").textContent) && /1 aviso/.test(a.$("ramMsg").textContent), "R28i a conferencia diz o que entrou, o que ja existia, o que ignorou e os avisos: " + a.$("ramMsg").textContent);
      ok(a.$("ramLista").children.length === 6, "R28j a tela foi repintada");
      ok(a.edRamosDoTopico(ed.texto, "Licitações", "Lei 14.133").length === 3, "R28k conferir NAO grava no edital (so' ao salvar)");
      a.$("ramColar").value = "nada util aqui";
      const nada = a.ramConferirIA();
      ok(nada.ramos.length === 0 && /Não achei ramos/.test(a.$("ramMsg").textContent) && a.ramLinhasAtual().length === 6, "R28l resposta sem ramos: avisa e nao mexe na lista");
      a.$("ramColar").value = "++ Sanções :: 4";
      ok(a.ramConferirIA().novos === 0 && a.ramLinhasAtual().length === 6, "R28m colar de novo o mesmo nao duplica");
      const cortar = Array.from({ length: 35 }, (x, i) => "++ Extra " + (i + 1) + " :: 3").join(String.fromCharCode(10));
      a.$("ramColar").value = cortar;
      a.ramConferirIA();
      ok(/primeiros/.test(a.$("ramMsg").textContent) && a.ramLinhasAtual().length === 6 + 30, "R28l2 resposta com mais de 30 ramos: entram 30 e a mensagem avisa do corte: " + a.$("ramMsg").textContent);
      a.$("btnRamFechar").onclick();
      a.ramAbrirEditor(ctx);
      ok(a.$("ramIaBox").hidden === true && a.$("ramColar").value === "", "R28n ao reabrir o editor a caixa volta escondida e vazia");
      a.$("btnRamFechar").onclick();
    }

    /* R30: o botao "pesos pelas minhas questoes" */
    {
      const { a, ed, chave } = MT();
      const ctx = { editalId: ed.id, disciplina: "Licitações", topico: "Lei 14.133", chave };
      a.ramAbrirEditor(ctx);
      a.$("btnRamPesos").onclick();
      ok(a.$("ramMsg").textContent === a.t("ram_pesos_nada"), "R30 sem questoes nem julgados: diz que nao ha base");
      a.qsBancoPor([{ chave, enunciado: "A modalidade pregão ...", comentario: "", opcoes: [] }, { chave, enunciado: "Sobre isto", comentario: "comentario-unico sobre contratos", opcoes: [] }, { chave: "outro›topico", enunciado: "modalidade modalidade", opcoes: [] }]);
      a.jurGravarTudo({ j1: { id: "j1", tese: "tese-unica: as modalidades de licitação incluem o pregão", topicos: [chave] }, j2: { id: "j2", tese: "modalidade em outro topico", topicos: ["x›y"] } });
      const tx = a.ramTextosDoTopico(chave);
      ok(tx.length === 3 && !tx.some((x) => /outro topico|modalidade modalidade/.test(x)), "R30a le as questoes e os julgados DESTE topico (nao os de outros): " + tx.length);
      ok(tx.some((x) => /comentario-unico/.test(x)) && tx.some((x) => /tese-unica/.test(x)), "R30a2 usa o comentario da questao e a tese do julgado");
      const txtAntes = ed.texto;
      const l0 = a.ramLinhasAtual();
      l0[1].peso = "2"; l0[1].nota = "minha nota";
      const r = a.$("btnRamPesos").onclick();
      const dep = a.ramLinhasAtual();
      ok(/1 já tinham peso/.test(a.$("ramMsg").textContent) || /2 já tinham peso/.test(a.$("ramMsg").textContent), "R30b0 a mensagem conta os que ja tinham peso: " + a.$("ramMsg").textContent);
      ok(dep[0].peso === "5" && dep[1].peso === "2" && dep[1].nota === "minha nota", "R30b o peso que a pessoa JA tinha nao muda; o ramo 'Modalidades' (peso 5 dela) segue: " + dep.map((l) => l.nome + "/" + l.peso));
      a.$("btnRamFechar").onclick();
      a.ramAbrirEditor(ctx);
      const l1 = a.ramLinhasAtual();
      l1[0].peso = ""; l1[1].peso = "";
      a.ramPintar();
      const r2 = a.ramPesosDosRegistros();
      ok(r2.aplicados === 1 && l1[0].peso !== "" && l1[1].peso === "" && r2.semIndicio === 1 && r2.textos === 3, "R30c com o peso em branco, o ramo citado recebe peso; o sem citacao fica em branco: " + JSON.stringify([r2.aplicados, r2.semIndicio, l1.map((l) => l.peso)]));
      ok(/1 ramo\(s\) receberam peso a partir de 3/.test(a.$("ramMsg").textContent) && /1 sem citação/.test(a.$("ramMsg").textContent), "R30d a mensagem conta o que foi feito: " + a.$("ramMsg").textContent);
      ok(ed.texto === txtAntes, "R30e nao grava no edital ate salvar");
      ok(achar(a.$("ramLista").children[0], (e) => cls(e, "ram-peso"))[0].value === l1[0].peso && l1[0].peso !== "", "R30f a tela mostra o peso novo (foi repintada)");
      /* divergencia: o peso dela fica, mas o app AVISA quando os registros dizem outra coisa */
      const sugerido0 = l1[0].peso;
      l1[0].peso = "1";
      const r3 = a.ramPesosDosRegistros();
      ok(l1[0].peso === "1" && r3.divergencias.length === 1 && r3.divergencias[0].meu === 1 && String(r3.divergencias[0].sugerido) === sugerido0 && /divergem/.test(a.$("ramMsg").textContent) && a.$("ramMsg").textContent.indexOf(l1[0].nome) >= 0, "R30g peso dela (1) longe do que os registros sugerem (" + sugerido0 + "): so' avisa, nao troca: " + a.$("ramMsg").textContent);
      l1[0].peso = sugerido0;
      ok(a.ramPesosDosRegistros().divergencias.length === 0 && !/divergem/.test(a.$("ramMsg").textContent), "R30h peso igual ao sugerido: sem aviso");
      const dv = (l, r) => a.ramDivergencias(l, r);
      ok(dv([{ nome: "A", peso: "3" }], [{ peso: "5", citacoes: 4 }]).length === 1 && dv([{ nome: "A", peso: "4" }], [{ peso: "5", citacoes: 4 }]).length === 0, "R30i limite: diferenca de 2 estrelas avisa, de 1 nao");
      ok(dv([{ nome: "A", peso: "" }], [{ peso: "5" }]).length === 0 && dv([{ nome: "A", peso: "12q" }], [{ peso: "5" }]).length === 0 && dv([{ nome: "A", peso: "1" }], [{ peso: "" }]).length === 0 && dv([{ nome: "A", peso: "5" }], [{ peso: "" }]).length === 0 && dv([{ nome: "A", peso: "7" }], [{ peso: "2" }]).length === 0 && dv(null, null).length === 0, "R30j sem peso dela, peso em quantidade, ramo sem indicio ou entrada vazia: sem aviso");
      ok(dv([{ nome: "A", peso: "5" }], [{ peso: "2", citacoes: 1 }])[0].sugerido === 2, "R30k tambem avisa quando ela pos MAIS do que os registros mostram");
      a.$("btnRamFechar").onclick();
      a.qsBancoPor([]); a.jurGravarTudo({});
    }

    /* R31: exportar com subbaralho por ramo e importar de volta */
    {
      const { a, ed, chave, k } = MT();
      a.gerAbrir();
      const notas = a.gerNotasAtual();
      const ch2 = k("Direito Financeiro", "Receita Pública");
      const sel = new Set([chave, ch2]);
      const editalDe = new Map([[chave, "ISS Caruaru Auditor"], [ch2, "ISS Caruaru Auditor"]]);
      const nomes = (m) => [...m.decks.entries()].map(([d, n]) => d + "=" + n).sort().join(" | ");
      const m1 = a.pacMontar(notas, sel, { comEdital: true, comRamos: true, editalDe });
      const pre = "ISS Caruaru Auditor::Licitações::Lei 14.133";
      ok(m1.decks.get(pre + "::Modalidades") === 1 && m1.decks.get(pre + "::Fase preparatória") === 1 && m1.decks.get(pre + "::Contratos") === 1, "R31 com subbaralho por ramo: um baralho por ramo (Edital::Disciplina::Topico::Ramo): " + nomes(m1));
      ok(m1.decks.get(pre) === 2, "R31a o que nao esta em ramo (e a etiqueta de ramo que nao existe mais) fica no baralho do topico: " + nomes(m1));
      ok(m1.decks.get("ISS Caruaru Auditor::Direito Financeiro::Receita Pública") === 1 && m1.decks.size === 5, "R31b topico SEM ramos no edital: a etiqueta ram_ solta nao cria subbaralho: " + nomes(m1));
      const m0 = a.pacMontar(notas, sel, { comEdital: true, comRamos: false, editalDe });
      ok(m0.decks.get(pre) === 5 && m0.decks.size === 2, "R31c sem a opcao, tudo no baralho do topico como sempre: " + nomes(m0));
      const m2 = a.pacMontar(notas, sel, { comEdital: false, comRamos: true, editalDe });
      ok(m2.decks.get("Licitações::Lei 14.133::Modalidades") === 1, "R31d o subbaralho de ramo tambem funciona sem a pasta do edital");
      const cs = a.pacCartoes(m1.itens, true, true);
      ok(cs.some((c) => c.deck === pre + "::Contratos" && /Contrato\?/.test(c.front)) && cs.every((c) => Array.isArray(c.tags)), "R31e os cartoes exportados levam o baralho do ramo (e as etiquetas)");
      ok(a.pacCartoes(m1.itens, true, false).every((c) => c.deck.split("::").length <= 4 && !/::Modalidades$/.test(c.deck)), "R31f pacCartoes sem ramos nao usa subbaralho");
      ok(a.pacNomeDeck({ edital: "E", disciplina: "D", topico: "T" }, true, "R :: x") === "E::D::T::R — x" && a.pacNomeDeck({ disciplina: "D", topico: "T" }, false, "") === "D::T", "R31g o nome do ramo com '::' nao cria nivel a mais");
      ok(a.pacRamoDoCartao({ card: { ownTags: ["ram_modalidades"] }, chave, disciplina: "Licitações", topico: "Lei 14.133", edital: "ISS Caruaru Auditor" }) === "Modalidades" && a.pacRamoDoCartao({ card: { ownTags: ["x"] }, chave, disciplina: "Licitações", topico: "Lei 14.133" }) === "" && a.pacRamoDoCartao({ card: { ownTags: ["ram_zzz"] }, chave, disciplina: "Licitações", topico: "Lei 14.133" }) === "", "R31h o nome do ramo vem da etiqueta + texto do edital; sem etiqueta ou com ramo inexistente: vazio");
      ok(a.pacRamoDoCartao({ card: { ownTags: ["ram_modalidades"] }, chave, disciplina: "Licitações", topico: "Lei 14.133" }) === "Modalidades", "R31i sem o edital informado acha o ramo pelo edital dono do topico");
      ok(a.$("pacRamos").checked === true, "R31i2 a opcao de subbaralho por ramo existe e vem ligada");
      /* dois editais com o mesmo topico: o ramo vem do edital da pasta */
      const ed2 = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20" + String.fromCharCode(10) + "@ Licitações :: 5" + String.fromCharCode(10) + "+ Lei 14.133 :: 5" + String.fromCharCode(10) + "++ So do TCE");
      ok(a.pacRamoDoCartao({ card: { ownTags: ["ram_so_do_tce"] }, chave, disciplina: "Licitações", topico: "Lei 14.133", edital: "TCE-PE" }) === "So do TCE" && a.pacRamoDoCartao({ card: { ownTags: ["ram_so_do_tce"] }, chave, disciplina: "Licitações", topico: "Lei 14.133", edital: "ISS Caruaru Auditor" }) === "So do TCE", "R31h2 procura o ramo no edital informado e, se nao esta la, nos outros");
      const ed3 = a.edCriar("Ed3", "# Ed3 | prova: 2027-08-01 | horas: 20" + String.fromCharCode(10) + "@ D :: 5" + String.fromCharCode(10) + "+ Tópico › Sub :: 5" + String.fromCharCode(10) + "++ Ramo Um");
      ok(JSON.stringify(a.pacResolverRamo("Ed3", "D", "Tópico › Sub › Ramo Um")) === JSON.stringify({ topico: "Tópico › Sub", ramoId: "ramo_um" }), "R31p2 topico que ja tem ' › ' no nome: acha o corte certo entre topico e ramo: " + JSON.stringify(a.pacResolverRamo("Ed3", "D", "Tópico › Sub › Ramo Um")));
      /* a tela de exportar respeita a opcao */
      {
        a.pacAbrir(); a.$("btnPacTudo").onclick();
        const cap = {};
        const deps = { construir: async (cards, raiz, estilo, x, al, extras) => { cap.cards = cards; return new Uint8Array(1); }, entregar: async () => {} };
        a.$("pacComEdital").checked = true;
        a.$("pacRamos").checked = true;
        await a.pacExportar("apkg", deps);
        ok(cap.cards && cap.cards.some((c) => /::Lei 14\.133::Modalidades$/.test(c.deck)), "R31q exportar com a opcao ligada: o subbaralho do ramo sai no pacote: " + (cap.cards || []).map((c) => c.deck).join(" | "));
        a.$("pacRamos").checked = false; a.$("pacRamos").onchange();
        cap.cards = null;
        await a.pacExportar("apkg", deps);
        ok(cap.cards && !cap.cards.some((c) => /::Modalidades$/.test(c.deck)), "R31r exportar com a opcao desligada: sem subbaralho de ramo");
        ok(/Modalidades/.test(a.$("pacDecks").textContent) === false, "R31s a previa acompanha a opcao desligada");
        a.$("pacRamos").checked = true; a.$("pacRamos").onchange && a.$("pacRamos").onchange();
        ok(/Modalidades/.test(a.$("pacDecks").textContent), "R31t a previa mostra o subbaralho com a opcao ligada");
        a.$("btnPacFechar").onclick();
      }
      /* importar de volta */
      const F = (front, tags, deck) => ({ kind: "basic", front, back: "resp", tags, ownTags: tags, deck });
      const imp = a.pacImportar([
        F("Novo1? ", [], "Raiz::ISS Caruaru Auditor::Licitações::Lei 14.133::Modalidades"),
        F("Novo2? ", ["ram_contratos", "x"], "Raiz::ISS Caruaru Auditor::Licitações::Lei 14.133::Modalidades"),
        F("Novo3? ", [], "Raiz::ISS Caruaru Auditor::Licitações::Lei 14.133::Inventado"),
        F("Novo4? ", [], "Raiz::ISS Caruaru Auditor::Licitações::Lei 14.133"),
      ], "decks", undefined, true);
      const cart = a.matResumosAtual()[chave].cartoes;
      ok(/Novo1\? :: resp :: ram_modalidades\s*$/m.test(cart), "R31j o subbaralho do ramo volta como TOPICO + etiqueta do ramo: " + cart.split("\n").filter((l) => /Novo/.test(l)));
      ok(/Novo2\? :: resp :: x, ram_modalidades\s*$/m.test(cart) && !/Novo2[^\n]*ram_contratos/.test(cart), "R31k a etiqueta de ramo que ja vinha e' TROCADA pela do subbaralho (as outras ficam)");
      ok(!a.matResumosAtual()[k("Licitações", "Lei 14.133 › Modalidades")] && !!a.matResumosAtual()[k("Licitações", "Lei 14.133 › Inventado")], "R31l ramo que o edital nao conhece continua virando topico proprio (como antes); o conhecido nao cria topico");
      ok(/Novo4\? :: resp\s*$/m.test(cart) && imp.novos === 4, "R31m cartao no baralho do topico entra sem etiqueta de ramo");
      const semEd = a.pacImportar([F("Novo5? ", [], "Licitações::Lei 14.133::Fase preparatória")], "decks", undefined, false);
      ok(/Novo5\? :: resp :: ram_fase_preparatoria\s*$/m.test(a.matResumosAtual()[chave].cartoes), "R31n sem a pasta do edital tambem resolve o ramo (disciplina::topico::ramo)");
      ok(a.pacResolverRamo("", "Licitações", "Lei 14.133") === null && a.pacResolverRamo("", "Licitações", "") === null && a.pacResolverRamo("Outro Edital", "Licitações", "Lei 14.133 › Modalidades") === null, "R31o sem separador, vazio ou edital que nao e' o dono: nada");
      ok(JSON.stringify(a.pacResolverRamo("", "Licitações", "Lei 14.133 › Modalidades")) === JSON.stringify({ topico: "Lei 14.133", ramoId: "modalidades" }), "R31p sem edital informado procura em todos");
    }

    /* R32: registrar o estudo de um topico COM ramos, de ponta a ponta */
    {
      const { a, ed } = MT();
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      const item = () => a.edItemDoPlano("Licitações", "Lei 14.133");
      const ch = item().chave;
      ok(item().proximo === "Modalidades" && item().ramosFeitos === 0, "R32 ponto de partida: 0 de 3, proximo Modalidades");
      a.edMarcarTeste(item(), "feito", { minutos: 70 }, true);
      const pr = a.edProgressoAtual();
      ok(Object.keys(pr).join() === ch + "›#modalidades" && pr[ch + "›#modalidades"].e === "feito" && !pr[ch], "R32a registrar ESTUDO grava a marca so' no ramo da sessao (e nao no topico)");
      ok(item().ramosFeitos === 1 && item().feito === false && item().proximo === "Fase preparatória", "R32b o topico segue pendente e a agenda passa ao proximo ramo por relevancia (Fase preparatoria: mesmo peso 3 que Contratos, escrita antes)");
      const d = a.edDiario[a.edDiario.length - 1];
      ok(d.c === ch && d.a === "feito" && d.m === 70 && d.rm && d.rm.length === 1 && d.rm[0].id === "modalidades" && d.rm[0].ant === null, "R32c o diario guarda o registro no TOPICO, com os ramos tocados e a marca de antes");
      a.edMarcarTeste(item(), "feito", { minutos: 40 }, true);
      a.edMarcarTeste(item(), "feito", { minutos: 40 }, true);
      ok(item().feito === true && item().ramosFeitos === 3 && a.edDiario.filter((x) => x.c === ch && x.a === "feito").length === 3, "R32d ao estudar o ultimo ramo o topico fica feito; 3 registros no diario, todos no mesmo topico");
      /* desfazer o ultimo registro: so' o ramo dele volta */
      a.edMarcarTeste(item(), "revisado", { minutos: 20 }, true);
      ok(item().revisado === true && item().ramos.every((r) => r.revisado), "R32e registrar REVISAO marca os ramos estudados como revisados");
      const antesDes = a.edDiario.length;
      a.apagarDoDiario(a.edDiario.length - 1);
      const depoisDes = a.edDiario.length;
      const it2 = item();
      ok(it2.ramos.every((r) => r.estado === "feito") && it2.feito === true && it2.revisado === false, "R32f desfazer a revisao devolve as marcas de ANTES de cada ramo (voltam a 'estudado')");
      /* desmarcar */
      a.edMarcarTeste(item(), null, null, true);
      ok(Object.keys(a.edProgressoAtual()).length === 0 && item().ramosFeitos === 0, "R32g desmarcar o topico limpa todos os ramos");
      ok(depoisDes === antesDes - 1, "R32h o registro saiu do diario: " + antesDes + " -> " + depoisDes);
    }

    /* R32i: registro de um topico de OUTRO edital (agenda multi-edital) e desfazer pelo botao "desfazer" */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const ed2 = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20" + NL + "@ Licitações :: 5" + NL + "+ Lei 14.133 :: 5" + NL + "++ Um" + NL + "++ Dois");
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      const r2 = a.lerEdital(ed2.texto);
      const it2 = a.montarPlano(r2, { horas: 20, prova: "2027-08-01", feitos: {}, fatores: null, acertos: null }).itens[0];
      ok(it2.ramos.length === 2 && it2.proximo === "Um", "R32i0 o item do edital B tem os ramos dele");
      a.edMarcarTeste(Object.assign({}, it2, { edital: ed2.id }), "feito", { minutos: 30 }, true);
      const dono = a.editaisAtual ? a.editaisAtual() : null;
      const chB = it2.chave;
      const feitoB = ((JSON.parse(a.lojaLer("eac_editais")).find((x) => x.id === ed2.id) || {}).progresso) || {};
      ok(Object.keys(feitoB).join() === chB + "›#um" && Object.keys(a.edProgressoAtual()).length === 0, "R32i1 o registro de uma linha do edital B grava os ramos no progresso do B (e nao no do A que esta aberto): " + Object.keys(feitoB));
    }

    /* R32j: a janela de registrar mostra o ramo da vez e o tempo da sessao */
    {
      const { a, ed } = MT();
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      const it = a.edItemDoPlano("Licitações", "Lei 14.133");
      a.abrirRegistro(it);
      ok(/Lei 14\.133 › Modalidades/.test(a.$("regTitulo").textContent), "R32j o titulo do registro diz quais ramos serao marcados: " + a.$("regTitulo").textContent);
      ok(Number(a.$("regMinutos").value) === it.minutosSessao && it.minutosSessao < it.minutos, "R32k os minutos sugeridos sao os da SESSAO (nao os do topico inteiro): " + a.$("regMinutos").value + " x " + it.minutos);
    }

    /* R34: o painel "Ramos da disciplina" (Fase 3) */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const hoje = new Date().toISOString().slice(0, 10);
      const r0 = a.lerEdital(ed.texto);
      const plano = (feitos) => a.montarPlano(r0, { horas: 20, prova: "2027-06-01", feitos: feitos || {}, fatores: null, acertos: null });
      const ch = plano().itens.find((i) => i.nome === "Lei 14.133").chave;
      const p0 = a.edPainelRamos(plano(), "Licitações");
      ok(p0.total === 3 && p0.pendentes === 3 && p0.feitos === 0 && p0.pctFeito === 0 && p0.vencidos === 0 && p0.linhas.length === 3, "R34 painel sem nada estudado: 3 ramos pendentes, 0%");
      ok(p0.linhas.map((x) => x.ramo.nome).join("|") === "Modalidades|Fase preparatória|Contratos" && p0.linhas.every((x) => x.topico === "Lei 14.133"), "R34a ordem por relevancia (peso do ramo; empate pela ordem escrita)");
      ok(p0.linhas.map((x) => x.relPct).join() === "32.5,19.5,19.5" && Math.abs(p0.linhas[0].relevancia - 25 * 5 / 11) < 1e-9, "R34b quanto cada ramo vale na disciplina: 32,5% / 19,5% / 19,5% (25 x 5/11 sobre o bruto 35 da disciplina): " + p0.linhas.map((x) => x.relPct));
      ok(p0.proximo && p0.proximo.ramo.nome === "Modalidades" && p0.topicos.length === 1 && p0.topicos[0].nome === "Lei 14.133" && p0.topicos[0].total === 3 && p0.topicos[0].feitos === 0, "R34c proximo ramo e resumo por topico");
      const p1 = a.edPainelRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: hoje }, [ch + "›#fase_preparatoria"]: { e: "feito", d: "2020-01-01" } }), "Licitações");
      ok(p1.feitos === 2 && p1.pendentes === 1 && p1.vencidos === 1 && p1.revisados === 0 && p1.pctFeito === 73, "R34d progresso PONDERADO: os 2 ramos estudados valem 73% (nao 67% da contagem): " + p1.pctFeito);
      ok(p1.linhas.map((x) => x.estado).join() === "feito,venceu,pend", "R34e estado de cada ramo: estudado, revisao vencida, pendente");
      ok(a.edPainelRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: hoje }, [ch + "›#fase_preparatoria"]: { e: "feito", d: "2020-01-01" } }), "Licitações", "pendentes").linhas.map((x) => x.ramo.nome).join() === "Contratos", "R34f filtro 'a estudar': so' os pendentes");
      ok(a.edPainelRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: hoje }, [ch + "›#fase_preparatoria"]: { e: "feito", d: "2020-01-01" } }), "Licitações", "revisar").linhas.map((x) => x.ramo.nome).join() === "Fase preparatória", "R34g filtro 'a revisar': so' os vencidos");
      ok(a.edPainelRamos(plano(), "Licitações", "qualquer").linhas.length === 3, "R34h filtro desconhecido = todos");
      const p2 = a.edPainelRamos(plano({ [ch + "›#modalidades"]: { e: "revisado", d: hoje } }), "Licitações");
      ok(p2.linhas[0].estado === "revisado", "R34i0 ramo revisado tem o estado 'revisado' (nao so' 'estudado')");
      ok(p2.revisados === 1 && p2.pctRevisado === 45 && p2.pctFeito === 45, "R34i revisado conta como estudado e tem a sua propria barra (45%)");
      const tudo = {}; ["modalidades", "fase_preparatoria", "contratos"].forEach((id) => { tudo[ch + "›#" + id] = { e: "feito", d: hoje }; });
      const p3 = a.edPainelRamos(plano(tudo), "Licitações");
      ok(p3.pctFeito === 100 && p3.proximo === null && p3.pendentes === 0, "R34j tudo estudado: 100% e nenhum proximo");
      const pf = a.edPainelRamos(plano(), "Direito Financeiro");
      ok(pf.total === 0 && pf.linhas.length === 0 && pf.proximo === null && a.edPainelRamos(plano(), "Nao existe").total === 0 && a.edPainelRamos(null, "x").total === 0, "R34k disciplina sem ramos (ou inexistente, ou sem plano): vazio e sem quebrar");
      /* relevancia ABSOLUTA: assunto pesado com ramos vem antes de assunto leve */
      const rAbs = a.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL + "@ D :: 5" + NL + "+ Leve :: 2" + NL + "++ L1 :: 3" + NL + "++ L2 :: 3" + NL + "+ Pesado :: 5" + NL + "++ P1 :: 3" + NL + "++ P2 :: 3");
      const pAbs = a.edPainelRamos(a.montarPlano(rAbs, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null }), "D");
      ok(pAbs.linhas.map((x) => x.ramo.nome).join() === "P1,P2,L1,L2" && pAbs.linhas[0].relevancia === 12.5 && pAbs.linhas[2].relevancia === 5, "R34l ramo de assunto de peso alto (12,5) vem ANTES de ramo de assunto leve (5), mesmo com o topico leve escrito primeiro: " + pAbs.linhas.map((x) => x.ramo.nome));
      const pFat = a.edPainelRamos(a.montarPlano(rAbs, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: { "d›leve": 3 } }), "D");
      ok(a.montarPlano(rAbs, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: { "d›leve": 3 } }).itens[0].nome === "Leve" && pFat.linhas.map((x) => x.ramo.nome).join() === "P1,P2,L1,L2", "R34l2 a lista se ordena por RELEVANCIA na prova, nao pela ordem da agenda (a dificuldade pode por 'Leve' na frente na agenda, e o painel continua com o Pesado primeiro)");
      /* a tela */
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.abrirDisciplina("Licitações");
      const linhas = () => Array.from(a.$("dscRamosLista").children || []).filter((l) => /dsc-ramo-lin/.test(l.className));
      ok(a.$("dlgDisciplina").open === true && a.$("dscRamosBloco").hidden === false && linhas().length === 3, "R34m o painel da disciplina mostra o bloco de ramos (3 linhas)");
      ok(/0 de 3 ramos estudados · 0%/.test(a.$("dscRamosResumo").textContent) && a.$("dscRamosBarra").children.length === 1, "R34n resumo ponderado e barra: " + a.$("dscRamosResumo").textContent);
      const tx = (l) => Array.from(l.children).map((c) => c.textContent);
      ok(tx(linhas()[0])[1] === "Lei 14.133 › Modalidades" && /★5 · 32,5% da disciplina/.test(tx(linhas()[0])[2]) && tx(linhas()[0])[0] === "a estudar" && tx(linhas()[0])[4] === "estudar", "R34o cada linha: estado, 'topico › ramo', estrelas e quanto vale, botao: " + tx(linhas()[0]));
      ok(Array.from(a.$("dscRamosFiltro").children).map((o) => o.textContent).join("|") === "todos (3)|a estudar (3)|a revisar (0)", "R34p o filtro mostra as contagens");
      a.$("dscRamosFiltro").value = "revisar"; a.$("dscRamosFiltro").onchange();
      ok(a.$("dscRamosFiltro").value === "revisar", "R34q0 o filtro escolhido continua selecionado depois de repintar");
      ok(linhas().length === 0 && /Nenhum ramo neste filtro/.test(a.$("dscRamosLista").textContent), "R34q filtro sem resultado: mensagem");
      a.$("dscRamosFiltro").value = "todos"; a.$("dscRamosFiltro").onchange();
      ok(linhas().length === 3, "R34r voltar a 'todos'");
      /* botao: abre o registro com o ramo marcado */
      linhas()[1].children[4].onclick();
      ok(a.$("dlgDisciplina").open === false && a.$("dlgRegistro").open === true && /Lei 14\.133 › Fase preparatória$/.test(a.$("regTitulo").textContent) && a.$("regRamosRot").textContent === "O que você estudou?", "R34s o botao 'estudar' fecha o painel e abre o registro JA com aquele ramo marcado: " + a.$("regTitulo").textContent);
      a.$("dlgRegistro").close();
      /* ramo ja estudado: o botao vira 'revisar' e o registro abre em REVISAO */
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "feito", d: "2020-01-01" } });
      a.abrirDisciplina("Licitações");
      ok(tx(linhas()[0])[0] === "revisão vencida" && tx(linhas()[0])[4] === "revisar" && /1 com revisão vencida/.test(a.$("dscRamosResumo").textContent), "R34t ramo estudado ha muito tempo: 'revisao vencida' e botao 'revisar'");
      ok(/1 de 3 ramos estudados · 45%/.test(a.$("dscRamosResumo").textContent) && Array.from(a.$("dscRamosFiltro").children).map((o) => o.textContent).join("|") === "todos (3)|a estudar (2)|a revisar (1)", "R34t2 o resumo usa o progresso de ESTUDO (45%) e o filtro conta os pendentes (2) e os a revisar (1): " + a.$("dscRamosResumo").textContent);
      linhas()[0].children[4].onclick();
      ok(a.$("regRamosRot").textContent === "O que você revisou?" && /Lei 14\.133 › Modalidades$/.test(a.$("regTitulo").textContent) && a.$("regRamos").children[0].children[0].checked === true && a.$("regRamos").children[1].children[0].disabled === true, "R34u o botao 'revisar' abre o registro em REVISAO com o ramo marcado (e os pendentes desabilitados)");
      ok(a.regFormasAtual().join() === "revisao", "R34u2 abrir por um ramo ja estudado troca a forma padrao para 'revisao' (o tempo vai para a conta certa)");
      a.$("dlgRegistro").close();
      /* ramo JA REVISADO: nao e' elegivel, entao abre sem ele marcado */
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "revisado", d: hoje } });
      a.abrirDisciplina("Licitações");
      linhas()[0].children[4].onclick();
      ok(a.$("regRamos").children[0].children[0].checked === false && a.$("regRamos").children[0].children[0].disabled === true, "R34u3 ramo ja revisado nao pode ser marcado: o registro abre sem ele");
      a.$("dlgRegistro").close();
      /* disciplina sem ramos: o bloco some */
      a.abrirDisciplina("Direito Financeiro");
      ok(a.$("dscRamosBloco").hidden === true, "R34v disciplina sem ramos: o bloco nao aparece");
      a.$("dlgDisciplina").close();
    }

    /* R35: o nome da disciplina na agenda do topo abre o painel mesmo sem edital aberto */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const ed2 = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20" + NL + "@ Licitações :: 5" + NL + "+ Lei 14.133 :: 5" + NL + "++ Um" + NL + "++ Dois");
      const itemDe = (e, prova) => a.montarPlano(a.lerEdital(e.texto), { horas: 20, prova, feitos: {}, fatores: null, acertos: null }).itens.find((x) => x.nome === "Lei 14.133");
      const linkDe = (li) => { const r = []; const anda = (x) => Array.from(x.children || []).forEach((f) => { if (/ed-item-disc-link/.test(f.className || "")) r.push(f); anda(f); }); anda(li); return r[0]; };
      a.hubVoltar();
      const li = a.edLinhaAgendaTeste(Object.assign({}, itemDe(ed2, "2027-08-01"), { edital: ed2.id }));
      const lk = linkDe(li);
      ok(!!lk && lk.textContent === "Licitações", "R35 a linha da agenda tem o link com o nome da disciplina");
      lk.onclick({ stopPropagation() {} });
      ok(a.$("dlgDisciplina").open === true && a.$("dscTitulo").textContent === "Licitações" && a.$("editalTexto").value === ed2.texto, "R35a SEM edital aberto: abre o edital da linha (B) e depois o painel da disciplina dele: " + a.$("dscTitulo").textContent);
      ok(a.$("dscRamosBloco").hidden === false && /Lei 14\.133 › Um/.test(a.$("dscRamosLista").textContent), "R35b o painel mostra os ramos do edital certo (B, nao o A)");
      a.$("dlgDisciplina").close();
      /* com OUTRO edital aberto: troca */
      a.hubAbrirEdital(ed.id);
      ok(a.$("editalTexto").value === ed.texto, "R35c (A aberto)");
      const liB = a.edLinhaAgendaTeste(Object.assign({}, itemDe(ed2, "2027-08-01"), { edital: ed2.id }));
      linkDe(liB).onclick({ stopPropagation() {} });
      ok(a.$("editalTexto").value === ed2.texto && /Lei 14\.133 › Um/.test(a.$("dscRamosLista").textContent), "R35d com o edital A aberto e a linha do B: abre o B (o painel nao mostra a disciplina do A)");
      a.$("dlgDisciplina").close();
      /* mesmo edital: NAO recarrega (texto em edicao fica) */
      a.$("editalTexto").value = ed2.texto + NL + "+ Tópico novo :: 3";
      const liB2 = a.edLinhaAgendaTeste(Object.assign({}, itemDe(ed2, "2027-08-01"), { edital: ed2.id }));
      linkDe(liB2).onclick({ stopPropagation() {} });
      ok(/Tópico novo/.test(a.$("editalTexto").value), "R35e com o edital da linha ja aberto o texto em edicao NAO e' recarregado");
      a.$("dlgDisciplina").close();
      /* linha sem edital (edital unico aberto): abre direto */
      a.hubAbrirEdital(ed.id);
      const liA = a.edLinhaAgendaTeste(itemDe(ed, "2027-06-01"));
      linkDe(liA) && linkDe(liA).onclick({ stopPropagation() {} });
      ok(a.$("dlgDisciplina").open === true && a.$("editalTexto").value === ed.texto, "R35f linha sem 'edital' (edital unico aberto): abre o painel direto");
      a.$("dlgDisciplina").close();
    }

    /* R38: a trilha na tela — agenda, painel da disciplina e registro (Fase 5) */
    {
      const { a, ed, chave } = MT();
      const NL = String.fromCharCode(10);
      const hoje = new Date().toISOString().slice(0, 10);
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.matResumosAtual()[chave].leiTexto = "Art. 1 Texto da lei.";
      a.qsBancoPor([{ chave, enunciado: "Sobre a modalidade pregão...", comentario: "", opcoes: [] }, { chave, enunciado: "Outra modalidade de licitação", comentario: "", opcoes: [] }]);
      const mat = a.ramMaterialDoTopico(chave, a.edItemDoPlano("Licitações", "Lei 14.133").ramos);
      ok(mat.modalidades.lei === 1 && mat.modalidades.cartoes === 1 && mat.modalidades.questoes === 2 && mat.modalidades.juris === 0, "R38 o material do ramo: lei (do topico), 1 cartao com a etiqueta ram_, 2 questoes que citam o ramo, 0 julgados: " + JSON.stringify(mat.modalidades));
      ok(mat.contratos.cartoes === 1 && mat.contratos.questoes === 0 && mat.fase_preparatoria.cartoes === 1, "R38a cada ramo tem os seus numeros");
      const it = () => a.edItemDoPlano("Licitações", "Lei 14.133");
      const achar2 = (raiz, teste, acc) => { Array.from(raiz.children || []).forEach((f) => { if (teste(f)) acc.push(f); achar2(f, teste, acc); }); return acc; };
      const chips = () => achar2(a.edLinhaAgendaTeste(Object.assign({}, it(), { edital: ed.id })), (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []);
      ok(/trilha: lei ○ · questões ○ \(2\) · cartões ○ · julgados —/.test(chips()[0].title), "R38b o balao do chip mostra a trilha do ramo: " + chips()[0].title);
      a.edDiario.push({ d: hoje, c: it().chave, n: "Lei", a: "feito", f: ["leiseca", "questoes"], rm: [{ id: "modalidades", ant: null }] });
      ok(/trilha: lei ✓ · questões ✓ · cartões ○ · julgados —/.test(chips()[0].title) && /trilha: lei ○/.test(chips()[1].title), "R38c depois de um registro com lei e questoes o ramo mostra ✓ nesses passos (e os outros ramos nao): " + chips()[0].title);
      a.abrirRegistro(it());
      ok(/Jurisprudência/.test(a.$("regFormas").textContent) && a.$("regFormas").children.length === 9, "R38d 'Jurisprudencia' aparece entre as formas de estudo do registro (9 formas): " + a.$("regFormas").children.length);
      a.$("dlgRegistro").close();
      /* painel da disciplina */
      a.abrirDisciplina("Licitações");
      const lin = () => Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className));
      const falta = (l) => achar2(l, (f) => /dsc-ramo-falta/.test(f.className || ""), [])[0];
      ok(falta(lin()[0]).textContent === "falta: cartões" && /trilha: lei ✓ · questões ✓ · cartões ○/.test(falta(lin()[0]).title), "R38e o painel da disciplina diz o que FALTA de cada ramo: " + falta(lin()[0]).textContent);
      ok(falta(lin()[1]).textContent === "falta: lei, cartões", "R38f o ramo sem registro: falta lei e cartoes (sem questoes: nao ha): " + falta(lin()[1]).textContent);
      a.$("dlgDisciplina").close();
      /* registro: sessao combinada */
      a.abrirRegistro(it());
      const bl = a.$("regTrilha");
      ok(bl.hidden === false && /Modalidades: lei ✓ · questões ✓ · cartões ○ · julgados —/.test(bl.textContent) && /Sessão combinada sugerida: 70min cartões\./.test(bl.textContent), "R38g o registro mostra a trilha do ramo marcado e a sessao combinada (so' o que falta, com o tempo do ramo): " + bl.textContent);
      const abrirBt = achar2(bl, (f) => /reg-trilha-abrir-btn/.test(f.className || ""), []);
      ok(abrirBt.map((b) => b.textContent).join("|") === ["lei", "questoes", "cartoes"].map((x) => a.t("ed_passo_abrir", { x: a.t("ed_passo_" + x) })).join("|"), "R38g2 um botao 'Abrir' por passo COM material (lei, questoes, cartoes; julgados nao): " + abrirBt.map((b) => b.textContent));
      ok(a.edAbrirPasso(it(), "nao_existe") === "" && a.edAbrirPasso(null, "lei") === "", "R38g3 passo desconhecido ou item vazio: nao abre nada");
      ok(a.edAbrirPasso(it(), "lei") === "lei", "R38g3b o passo existente abre e devolve o id dele");
      a.abrirRegistro(it());
      const abriuDe = (k) => {
        a.abrirRegistro(it());
        const bs = achar2(a.$("regTrilha"), (f) => /reg-trilha-abrir-btn/.test(f.className || ""), []);
        bs[k].onclick();
        return bs[k].abriu;
      };
      ok(abriuDe(0) === "lei" && abriuDe(1) === "questoes" && abriuDe(2) === "cartoes", "R38g3c cada botao abre O SEU material (lei, questoes, cartoes)");
      a.abrirRegistro(it());
      a.$("dlgRegistro").open = true;
      abrirBt[0].onclick();
      ok(a.$("dlgRegistro").open === false, "R38g4 abrir o material fecha a janela de registro (aberta, ela deixaria o resto inerte)");
      a.abrirRegistro(it());
      a.$("btnRegOutro").onclick();
      ok(a.$("regTrilha").hidden === true, "R38h na REVISAO nao ha trilha");
      a.$("dlgRegistro").close();
      a.edDiario.push({ d: hoje, c: it().chave, n: "Lei", a: "feito", f: ["flashcards"], rm: [{ id: "modalidades", ant: null }] });
      a.abrirRegistro(it());
      ok(/Trilha completa/.test(a.$("regTrilha").textContent), "R38i com tudo feito o registro diz 'trilha completa': " + a.$("regTrilha").textContent);
      a.$("dlgRegistro").close();
      a.abrirDisciplina("Licitações");
      ok(falta(Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className))[0]).textContent === "trilha ✓", "R38i2 ramo com a trilha completa: o painel da disciplina diz 'trilha ✓'");
      a.$("dlgDisciplina").close();
      /* na REVISAO nao ha trilha, mesmo com ramo marcado */
      a.edProgressoPor({ [it().chave + "›#modalidades"]: { e: "feito", d: "2020-01-01" } });
      a.abrirRegistro(it());
      a.$("btnRegOutro").onclick();
      ok(a.$("regRamos").children[0].children[0].checked === true && a.$("regTrilha").hidden === true, "R38i3 na revisao com ramo marcado a trilha continua escondida");
      a.$("dlgRegistro").close();
    }
    /* R38-b: ramos SEM material nao aparecem na trilha; no maximo 3 linhas */
    {
      const { a } = MT();
      const NL = String.fromCharCode(10);
      const mkEd = (n) => "# X | prova: 2027-06-01 | horas: 20" + NL + "@ D :: 5" + NL + "+ T :: 5" + NL + Array.from({ length: n }, (x, k) => "++ Ramo" + String.fromCharCode(65 + k)).join(NL);
      a.$("editalTexto").value = mkEd(2); a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      const itS = () => a.edItemDoPlano("D", "T");
      a.abrirRegistro(itS());
      ok(a.$("regTrilha").hidden === true, "R38j ramos sem NENHUM material (sem lei, cartoes, questoes ou julgados): nao ha trilha para mostrar");
      a.abrirDisciplina("D");
      const l0 = Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className))[0];
      const f0 = Array.from(l0.children).find((f) => /dsc-ramo-falta/.test(f.className || ""));
      ok(f0.textContent === "sem material" && /semmat/.test(f0.className) && /ram_/.test(f0.title) && !/falta/i.test(f0.textContent), "R38k ramo sem NENHUM material: o painel diz 'sem material' (nao 'falta') e o balao ensina como criar: " + f0.textContent + " / " + f0.title);
      a.$("dlgDisciplina").close();
      a.$("dlgRegistro").close();
      /* 5 ramos com material (lei do topico): so' 3 linhas */
      const chS = itS().chave;
      a.$("editalTexto").value = mkEd(5);
      a.matGravarCartoes(a.matChave("D", "T"), "X? :: y", { disciplina: "D", topico: "T" });
      a.matResumosAtual()[a.matChave("D", "T")].leiTexto = "Art. 1 Texto.";
      a.abrirRegistro(a.edItemDoPlano("D", "T"));
      a.$("btnRegRamosTodos").onclick();
      ok(a.$("regTrilha").hidden === false && a.$("regTrilha").children.length === 3, "R38l com 5 ramos marcados a trilha mostra no maximo 3 linhas: " + a.$("regTrilha").children.length);
      a.$("dlgRegistro").close();
    }

    /* R40: PULAR um ramo (não vou estudar) */
    {
      const { a, ed, chave } = MT();
      const hoje = new Date().toISOString().slice(0, 10);
      const r0 = a.lerEdital(ed.texto);
      const plano = (feitos) => a.montarPlano(r0, { horas: 20, prova: "2027-06-01", feitos: feitos || {}, fatores: null, acertos: null });
      const itDe = (feitos) => plano(feitos).itens.find((i) => i.nome === "Lei 14.133");
      const ch = itDe().chave;
      const K = (id) => ch + "›#" + id;
      const pul = { [K("fase_preparatoria")]: { e: "pulado", d: hoje } };
      const i1 = itDe(pul);
      ok(i1.ramosPulados === 1 && i1.ramos[1].pulado === true && i1.ramos[1].feito === false && i1.ramos[0].pulado === false, "R40 ramo com a marca 'pulado': fica pulado, NAO estudado, e o contador soma 1");
      ok(i1.sessao.indexOf("fase_preparatoria") < 0 && i1.sessao.length > 0, "R40a o ramo pulado nunca entra na sessao da vez");
      ok(Math.abs(a.edRestante(i1) - 8 / 11) < 1e-9 && a.edCredito(i1) === 0, "R40b o pulado sai do que FALTA (8/11) e nao gera credito: " + a.edRestante(i1) + " / " + a.edCredito(i1));
      ok(i1.minutos === i1.ramos.filter((r) => !r.pulado).reduce((x, r) => x + r.minutos, 0), "R40c o tempo reservado soma so' os ramos que faltam");
      const i2 = itDe(Object.assign({ [K("modalidades")]: { e: "feito", d: hoje } }, pul));
      ok(Math.abs(a.edCredito(i2) - 5 / 8) < 1e-9 && i2.feito === false && i2.parcial === true, "R40d com 1 estudado e 1 pulado o credito e' 5/8 (renormalizado) e o topico segue parcial: " + a.edCredito(i2));
      const i3 = itDe(Object.assign({ [K("modalidades")]: { e: "feito", d: hoje }, [K("contratos")]: { e: "feito", d: hoje } }, pul));
      ok(i3.feito === true && a.edCredito(i3) === 1 && a.edRestante(i3) === 0 && i3.ramosFeitos === 2 && i3.ramosPulados === 1, "R40e estudados os outros, o topico CONCLUI (o pulado nao segura) com credito 1");
      const i3r = itDe(Object.assign({ [K("modalidades")]: { e: "revisado", d: hoje }, [K("contratos")]: { e: "revisado", d: hoje } }, pul));
      ok(i3r.revisado === true && a.edCreditoRev(i3r) === 1 && i3r.estado === "revisado", "R40f revisados os outros, o topico conta como revisado");
      /* registrar nao toca no pulado */
      const prog = Object.assign({}, pul);
      const it = itDe(prog);
      it.ramosEscolhidos = ["fase_preparatoria", "contratos"];
      const mud = a.edRamosRegistrar(prog, it, "feito", hoje);
      ok(mud.length === 1 && mud[0].id === "contratos" && prog[K("fase_preparatoria")].e === "pulado", "R40g registrar estudo ignora o ramo pulado mesmo se escolhido");
      const it2 = itDe(pul);
      const m2 = a.edRamosRegistrar({}, it2, "feito", hoje);
      ok(m2.every((x) => x.id !== "fase_preparatoria"), "R40h a sessao padrao tambem nao marca o pulado");
      /* pular / voltar */
      const pr = {};
      const base = itDe(pr);
      const mp = a.edRamosPular(pr, base, ["fase_preparatoria"], true, hoje);
      ok(mp.length === 1 && pr[K("fase_preparatoria")].e === "pulado" && pr[K("fase_preparatoria")].d === hoje, "R40i pular grava a marca com a data");
      const mp2 = a.edRamosPular(pr, itDe(pr), ["fase_preparatoria"], true, hoje);
      ok(mp2.length === 0, "R40j pular de novo o mesmo ramo nao faz nada");
      const pr2 = { [K("modalidades")]: { e: "feito", d: hoje } };
      ok(a.edRamosPular(pr2, itDe(pr2), ["modalidades"], true, hoje).length === 0 && pr2[K("modalidades")].e === "feito", "R40k ramo ja estudado nao pode ser pulado");
      const pr3 = {};
      const mt = a.edRamosPular(pr3, itDe(pr3), ["modalidades", "fase_preparatoria", "contratos"], true, hoje);
      ok(mt.length === 2 && !pr3[K("contratos")], "R40l NUNCA se pula o ultimo ramo ativo: de 3 pedidos, so' 2 valem");
      a.edRamosDesfazer(pr3, { chave: ch }, mt);
      ok(Object.keys(pr3).length === 0, "R40m o desfazer devolve as marcas de antes");
      const mv = a.edRamosPular(pr, itDe(pr), ["fase_preparatoria"], false, hoje);
      ok(mv.length === 1 && !pr[K("fase_preparatoria")] && a.edRamosPular({}, itDe({}), ["contratos"], false, hoje).length === 0, "R40n voltar apaga a marca (e voltar um ramo que nao esta pulado nao faz nada)");
      /* painel */
      const pp = a.edPainelRamos(plano(Object.assign({ [K("modalidades")]: { e: "feito", d: hoje } }, pul)), "Licitações");
      ok(pp.pulados === 1 && pp.pendentes === 1 && pp.feitos === 1 && pp.pctFeito === 63, "R40o painel: 1 pulado, 1 pendente, 1 estudado e 63% (5 de 8 do que ainda vale): " + pp.pctFeito);
      ok(pp.linhas.map((x) => x.estado).join() === "feito,pulado,pend", "R40p o estado do ramo no painel e' 'pulado'");
      ok(a.edPainelRamos(plano(pul), "Licitações", "pendentes").linhas.length === 2 && a.edPainelRamos(plano(pul), "Licitações", "pulados").linhas.map((x) => x.ramo.nome).join() === "Fase preparatória", "R40q filtro 'pendentes' esconde o pulado e o filtro 'pulados' mostra so' ele");
      /* tela */
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.abrirDisciplina("Licitações");
      const lins = () => Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className));
      const fase = () => lins().find((l) => /Fase preparat/.test(l.children[1].textContent));
      ok(fase().children.length === 6 && fase().children[5].textContent === "Pular" && fase().children[5].hidden === false, "R40r cada linha tem o botao 'Pular'");
      fase().children[5].onclick();
      const ch2 = a.edItemDoPlano("Licitações", "Lei 14.133").chave;
      ok(a.edProgressoAtual()[ch2 + "›#fase_preparatoria"].e === "pulado", "R40s clicar em 'Pular' grava a marca no progresso");
      ok(/dsc-ramo-pulado/.test(fase().className) && fase().children[4].hidden === true && fase().children[5].textContent === "Voltar" && /pulado/.test(a.$("dscRamosResumo").textContent), "R40t a linha vira 'pulada': sem botao de estudar, com 'Voltar', e o resumo conta o pulado: " + a.$("dscRamosResumo").textContent);
      ok(Array.from(a.$("dscRamosFiltro").children).some((o) => o.value === "pulados"), "R40u com ramo pulado o filtro ganha a opcao 'pulados'");
      fase().children[5].onclick();
      ok(!a.edProgressoAtual()[ch2 + "›#fase_preparatoria"] && /dsc-ramo-pulado/.test(fase().className) === false, "R40v 'Voltar' apaga a marca e a linha volta ao normal");
      a.$("dlgDisciplina").close();
      /* a agenda: o chip do ramo pulado */
      a.edProgressoPor({ [ch2 + "›#fase_preparatoria"]: { e: "pulado", d: hoje } });
      const itP = a.edItemDoPlano("Licitações", "Lei 14.133");
      const linhaP = a.edRamosNaLinha(itP);
      const achaCls = (el, c, acc) => { acc = acc || []; if (new RegExp("(^|\\s)" + c + "(\\s|$)").test(el.className || "")) acc.push(el); Array.from(el.children || []).forEach((x) => achaCls(x, c, acc)); return acc; };
      ok(achaCls(linhaP, "ed-ramo-pulado").length === 1 && /pulado/.test(achaCls(linhaP, "ed-ramo-pulado")[0].title), "R40w0 a agenda mostra o ramo pulado com o seu proprio estilo");
      a.abrirRegistro(itP);
      const linReg = Array.from(a.$("regRamos").children).find((l) => /Fase preparat/.test(l.textContent));
      ok(linReg.children[0].disabled === true && /pulado/.test(linReg.textContent), "R40w1 na janela de registro o ramo pulado aparece como 'pulado' e nao pode ser marcado: " + linReg.textContent);
      a.$("dlgRegistro").close();
      /* com os outros ramos estudados, a linha da agenda fala de REVISAO (o pulado nao conta como pendente) */
      a.edProgressoPor({ [ch2 + "›#fase_preparatoria"]: { e: "pulado", d: hoje }, [ch2 + "›#modalidades"]: { e: "feito", d: hoje }, [ch2 + "›#contratos"]: { e: "feito", d: hoje } });
      const itQ = a.edItemDoPlano("Licitações", "Lei 14.133");
      const resQ = achaCls(a.edRamosNaLinha(itQ), "ed-ramos-resumo")[0].textContent;
      ok(resQ === a.t("ed_ramos_revisar", { f: itQ.ramosFeitos, n: itQ.ramosTotal, v: itQ.ramosVencidos }), "R40w2 sem ramo a estudar (so' o pulado sobra) a linha fala de revisar: " + resQ);
      /* ramo estudado nao tem o botao Pular */
      a.abrirDisciplina("Licitações");
      const linF = Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className)).find((l) => /Modalidades/.test(l.children[1].textContent));
      ok(linF.children[5].hidden === true, "R40w3 ramo ja estudado nao tem o botao 'Pular'");
      a.$("dlgDisciplina").close();
      /* a data do topico revisado ignora a do ramo pulado */
      const iRv = itDe({ [K("modalidades")]: { e: "revisado", d: "2026-03-01" }, [K("contratos")]: { e: "revisado", d: "2026-03-02" }, [K("fase_preparatoria")]: { e: "pulado", d: "2099-12-31" } });
      ok(iRv.revisado === true && iRv.quando === "2026-03-02", "R40w4 a data do topico revisado nao vem do ramo pulado: " + iRv.quando);
      const html = fs.readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/\.ed-ramo-pulado\{/.test(html) && /\.dsc-ramo-pulado /.test(html), "R40w o estilo do ramo pulado existe no CSS");
    }

    /* R41: acerto POR RAMO (diagnostico) */
    {
      const { a, ed, chave } = MT();
      const tent = (n, c) => Array.from({ length: n }, (x, k) => ({ acertou: k < c }));
      const banco = [
        { chave, enunciado: "Sobre as modalidades previstas", comentario: "", opcoes: [], tentativas: tent(6, 2) },
        { chave, enunciado: "Os contratos administrativos", comentario: "", opcoes: [], tentativas: tent(3, 3) },
        { chave, enunciado: "As modalidades e os contratos", comentario: "", opcoes: [], tentativas: tent(2, 1) },
        { chave: "outra›coisa", enunciado: "modalidades", comentario: "", opcoes: [], tentativas: tent(9, 0) },
        { chave, enunciado: "modalidades sem tentativa", comentario: "", opcoes: [], tentativas: [] },
        { chave, enunciado: "Assunto sem relacao alguma", comentario: "", opcoes: [], tentativas: tent(4, 0) },
      ];
      const ramos = [{ id: "modalidades", nome: "Modalidades" }, { id: "fase_preparatoria", nome: "Fase preparatória" }, { id: "contratos", nome: "Contratos" }];
      const r = a.ramAcertosDoTopico(chave, ramos, banco);
      ok(r.modalidades.feitas === 8 && r.modalidades.certas === 3 && r.modalidades.pct === 38, "R41 acerto do ramo = tentativas das questoes que o citam (6+2 feitas, 2+1 certas): " + JSON.stringify(r.modalidades));
      ok(r.contratos.feitas === 5 && r.contratos.certas === 4 && r.contratos.pct === 80, "R41a questao que cita DOIS ramos conta nos dois: " + JSON.stringify(r.contratos));
      ok(r.fase_preparatoria.feitas === 0 && r.fase_preparatoria.pct === null, "R41b ramo sem questao: sem percentual (nao e' 0%)");
      ok(a.ramAcertosDoTopico(chave, ramos, []).modalidades.pct === null && Object.keys(a.ramAcertosDoTopico(chave, [], banco)).length === 0 && a.ramAcertosDoTopico(chave, null, null).x === undefined, "R41c sem banco ou sem ramos nao quebra");
      ok(a.ramAcertoFraco({ feitas: 5, pct: 59 }) === true && a.ramAcertoFraco({ feitas: 5, pct: 60 }) === false && a.ramAcertoFraco({ feitas: 4, pct: 0 }) === false && a.ramAcertoFraco({ feitas: 0, pct: null }) === false && a.ramAcertoFraco(null) === false, "R41d fraco = abaixo de 60% COM pelo menos 5 tentativas");
      /* tela */
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.qsBancoPor(banco);
      a.abrirDisciplina("Licitações");
      const lins = () => Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className));
      const de = (nome) => lins().find((l) => l.children[1].textContent.indexOf(nome) >= 0);
      ok(/· acerto 38% \(8\)/.test(de("Modalidades").children[2].textContent) && /dsc-ramo-fraco/.test(de("Modalidades").className), "R41e o painel mostra 'acerto 38% (8)' e destaca o ramo fraco: " + de("Modalidades").children[2].textContent);
      ok(/acerto 80% \(5\)/.test(de("Contratos").children[2].textContent) && !/dsc-ramo-fraco/.test(de("Contratos").className), "R41f ramo forte: mostra o acerto sem destaque");
      ok(!/acerto/.test(de("Fase").children[2].textContent) && !/dsc-ramo-fraco/.test(de("Fase").className), "R41g ramo sem questao: nada de acerto");
      ok(/ATENÇÃO/.test(de("Modalidades").children[2].title) && !/ATENÇÃO/.test(de("Contratos").children[2].title), "R41h o balao do ramo fraco explica o alerta");
      a.$("dlgDisciplina").close();
      a.qsBancoPor([]);
      const html = fs.readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/\.dsc-ramo-fraco /.test(html), "R41i o destaque do ramo fraco tem regra de CSS");
    }

    /* R42: QUAL LEI alimenta o indice dos ramos — alerta, escolha e previa */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const idn = a.ramIdentidadeDoNome;
      ok(JSON.stringify(idn("Emenda Constitucional nº 132/2023")) === '{"numero":"132","ano":"2023"}' && JSON.stringify(idn("Lei 14.133/2021")) === '{"numero":"14133","ano":"2021"}' && JSON.stringify(idn("Lei 8.666")) === '{"numero":"8666","ano":""}' && JSON.stringify(idn("LC 214/25")) === '{"numero":"214","ano":"2025"}' && idn("Lei 8.666/93").ano === "1993", "R42 o numero e o ano que o nome do topico cita: " + JSON.stringify([idn("Emenda Constitucional nº 132/2023"), idn("Lei 14.133/2021"), idn("Lei 8.666"), idn("LC 214/25")]));
      ok(idn("Princípios constitucionais tributários") === null && idn("CF/88 - art. 145") === null && idn("") === null, "R42a sem numero no nome: null (nao da' para alertar)");
      const CF = ["CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", "TÍTULO I", "Dos Princípios Fundamentais", "Art. 1º A República Federativa...", "Art. 2º São Poderes da União...", "Art. 3º Constituem objetivos...",
        "TÍTULO II", "Dos Direitos e Garantias Fundamentais", "Art. 5º Todos são iguais perante a lei...", "Art. 6º São direitos sociais...", "TÍTULO VI", "Da Tributação e do Orçamento", "Art. 145. A União, os Estados...", "Art. 146. Cabe à lei complementar..."].join(NL);
      const EC = ["EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023", "Altera o Sistema Tributário Nacional.", "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
        '"Art. 43. ...', "...", "§ 4º Sempre que possível, os incentivos regionais considerarão critérios de sustentabilidade. (NR)", '"Art. 145. ...', "§ 3º O Sistema Tributário Nacional deve observar a simplicidade. (NR)",
        '"Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços. (AC)', "Art. 2º O Ato das Disposições Constitucionais Transitórias passa a vigorar com as seguintes alterações:",
        '"Art. 124. Lei complementar estabelecerá a transição. (NR)', "Art. 3º Esta Emenda Constitucional entra em vigor na data de sua publicação."].join(NL);
      const disc = "Reforma Tributária", top = "Emenda Constitucional nº 132/2023";
      const chave = a.matChave(disc, top);
      const cf = a.leiGuardar({ nome: "Constituição Federal", texto: CF, topicos: [chave] });
      const ec = a.leiGuardar({ nome: "Emenda Constitucional 132/2023", texto: EC, topicos: [] });
      ok(a.ramLeiCombina(top, ec) === true && a.ramLeiCombina(top, cf) === false && a.ramLeiCombina("Princípios tributários", cf) === null && a.ramLeiCombina(top, null) === null, "R42b a emenda bate com o nome do topico; a Constituicao (sem numero) NAO bate; sem numero no nome: null");
      ok(a.ramLeiCombina("Lei 14.133/2021", { numero: "8666", ano: "1993", texto: "" }) === false && a.ramLeiCombina("EC 132/2022", ec) === false && a.ramLeiCombina("Lei 132", ec) === true, "R42c numero diferente, ano diferente (mesmo numero) e nome sem ano");
      ok(a.ramLeiCombina("Lei 14.133/2021", { numero: "8666", ano: "2021", texto: "" }) === false && a.ramLeiCombina("EC 132/2023", { numero: "133", ano: "2023", texto: "" }) === false, "R42c2 mesmo ano, numero diferente: nao bate");
      /* identidade pelo TEXTO: a Constituicao gravada com campos de "Emenda 106/2020" (visto no backup real) nao bate com o topico da EC 106 */
      ok(a.ramLeiCombina("Emenda Constitucional nº 106/2020", { nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", especie: "Emenda Constitucional", numero: "106", ano: "2020", texto: CF }) === false, "R42c4 a Constituicao com metadados errados (EC 106/2020) NAO bate com o topico da EC 106: a identidade vem do texto");
      ok(a.ramLeiCombina("Emenda Constitucional nº 132/2023", { numero: "999", ano: "1999", texto: EC }) === true, "R42c5 e uma emenda com metadados errados bate pelo que o TEXTO diz");
      /* texto colado na versao antiga (sem lei na biblioteca) */
      const chaveV = a.matChave("Reforma Tributária", "Texto antigo");
      a.matResumosAtual()[chaveV] = { disciplina: "Reforma Tributária", topico: "Texto antigo", leiTexto: CF };
      const cv = a.ramLeisCandidatas(chaveV, "Texto antigo").filter((c) => c.id === "__topico");
      ok(cv.length === 1 && cv[0].atual === true && a.ramTextoDaLei({ leiId: "__topico", chave: chaveV }) === CF, "R42c3 o texto colado no topico (versao antiga) tambem e' candidato e a fonte do indice");
      /* o ERRO REAL: o topico so' esta' ligado a Constituicao, a emenda esta' na biblioteca -> o app usava a Constituicao calado */
      ok(a.leiDoTopicoAtual(chave).id === cf.id, "R42d (o defeito) sem escolha, a lei do topico e' a Constituicao");
      const cands = a.ramLeisCandidatas(chave, top);
      ok(cands.length === 2 && cands[0].id === ec.id && cands[0].combina === true && cands[0].doTopico === false && cands[1].id === cf.id && cands[1].atual === true && cands[1].combina === false, "R42e candidatas: a que BATE primeiro (mesmo de outro topico), a atual depois com combina=false: " + JSON.stringify(cands.map((c) => [c.nome, c.combina, c.atual])));
      const pad = a.ramLeiPadrao(cands);
      ok(pad.id === ec.id && pad.trocada === true, "R42f ao abrir vem marcada a que bate, avisando que trocou");
      ok(a.ramLeiPadrao([]).id === "" && a.ramLeiPadrao([{ id: "x", atual: true, combina: null }]).id === "x" && a.ramLeiPadrao([{ id: "x", atual: true, combina: false }]).id === "x" && a.ramLeiPadrao([{ id: "y", atual: false, combina: false }]).id === "", "R42g sem candidata melhor, fica a atual; sem atual e sem uma que bata, nada vem marcado (nao se escolhe lei ao acaso)");
      const ctx = { editalId: ed.id, disciplina: disc, topico: top, chave, depois() {} };
      a.ramAbrirEditor(ctx);
      ok(a.ramLeiEscolhida().id === ec.id && a.$("ramLeiBox").hidden === false && a.$("ramLeiSel").children.length === 2 && a.$("ramLeiSel").value === ec.id, "R42h a janela abre com a caixa da lei e a emenda marcada");
      ok(/deixei marcada/.test(a.$("ramLeiAviso").textContent) && a.ramLeiBloqueada() === false && a.$("ramLeiMesmoLinha").hidden === true && a.$("btnRamLeiFixar").hidden === false, "R42i avisa da troca; nada bloqueado; oferece 'usar como a lei do topico': " + a.$("ramLeiAviso").textContent);
      const p0 = a.ramProporDaLei();
      ok(p0.ramos.length === 0 && /Não achei divisões/.test(a.$("ramMsg").textContent) && a.ramLinhasAtual().length === 0, "R42j a emenda nao tem titulos: nao inventa ramos (antes vinham os Titulos da Constituicao)");
      const ped = a.ramPedidoIA(ctx, []);
      ok(ped.indexOf("Dos Princípios Fundamentais") < 0 && ped.indexOf("TÍTULO") < 0, "R42k o pedido a IA NAO traz o indice da Constituicao");
      /* escolher a Constituicao: alerta e trava ate ver o texto */
      a.ramLeiTrocar(cf.id);
      ok(a.ramLeiBloqueada() === true && /ATENÇÃO/.test(a.$("ramLeiAviso").textContent) && a.$("ramLeiMesmoLinha").hidden === false, "R42l escolher lei que nao bate: alerta e trava");
      const p1 = a.ramProporDaLei();
      ok(p1.bloqueada === true && a.ramLinhasAtual().length === 0 && /não bate/.test(a.$("ramMsg").textContent), "R42m com a trava, 'propor pela lei' nao acrescenta nada");
      ok((await a.ramPedirIA()) === null && /não bate/.test(a.$("ramMsg").textContent), "R42n com a trava, o pedido a IA tambem nao sai");
      a.ramLeiVer();
      ok(a.$("ramLeiPrev").hidden === false && /Constituição Federal": 7 artigo\(s\)/.test(a.$("ramLeiPrevCab").textContent) && /TÍTULO I — Dos Princípios Fundamentais/.test(a.$("ramLeiPrevCab").textContent) && /REPÚBLICA FEDERATIVA/.test(a.$("ramLeiPrevTexto").textContent), "R42o a previa mostra o que a lei e' (artigos, divisoes, o que o indice proporia) e o comeco do texto: " + a.$("ramLeiPrevCab").textContent);
      a.$("ramLeiMesmo").checked = true; a.$("ramLeiMesmo").onchange();
      ok(a.ramLeiBloqueada() === false, "R42p 'usar mesmo assim' destrava");
      const p2 = a.ramProporDaLei();
      ok(p2.ramos.length === 3 && a.ramLinhasAtual().some((l) => /Dos Princípios Fundamentais/.test(l.nome)), "R42q destravado, o indice da Constituicao entra (a pessoa decidiu ver e usar)");
      ok(a.ramPedidoIA(ctx, []).indexOf("Dos Princípios Fundamentais") >= 0, "R42r e o pedido a IA passa a trazer o indice da lei ESCOLHIDA");
      a.ramLeiTrocar(ec.id);
      ok(a.$("ramLeiMesmo").checked === false && a.ramLeiBloqueada() === false, "R42s trocar de lei zera o 'mesmo assim'");
      ok(a.$("ramLeiPrev").hidden === false && /ALTERA outra/.test(a.$("ramLeiPrevCab").textContent) && /Sem divisões/.test(a.$("ramLeiPrevCab").textContent) && /A Constituição Federal passa a vigorar/.test(a.$("ramLeiPrevTexto").textContent), "R42t a previa da emenda diz que ela ALTERA outra lei e nao tem divisoes: " + a.$("ramLeiPrevCab").textContent);
      a.ramLeiVer();
      ok(a.$("ramLeiPrev").hidden === true, "R42u 'ver o texto' de novo recolhe a previa");
      /* fixar */
      ok(a.ramLeiFixar() === true && a.leiDoTopicoAtual(chave).id === ec.id && a.leisDoTopico(chave).some((l) => l.id === ec.id) && a.matResumosAtual()[chave].leiId === ec.id, "R42v 'usar como a lei do topico' liga a emenda, torna-a a preferida e o app passa a abrir ELA");
      ok(a.$("btnRamLeiFixar").hidden === true && a.ramLeiFixar() === true, "R42w depois de fixada o botao some (e fixar de novo e' inofensivo)");
      a.$("dlgRamos").close();
      a.ramAbrirEditor(ctx);
      ok(a.ramLeiEscolhida().id === ec.id && !/deixei marcada/.test(a.$("ramLeiAviso").textContent) && /bate com o nome/.test(a.$("ramLeiAviso").textContent), "R42x reaberto: a emenda e' a atual e o app so' confirma que bate");
      a.$("dlgRamos").close();
      /* topico sem numero no nome: nada de alerta, comportamento de sempre */
      const ctx2 = { editalId: ed.id, disciplina: "Licitações", topico: "Lei 14.133", chave: a.matChave("Licitações", "Lei 14.133"), depois() {} };
      a.ramAbrirEditor(ctx2);
      ok(a.ramLeiBloqueada() === false && !/ATENÇÃO/.test(a.$("ramLeiAviso").textContent), "R42y topico cujo nome nao bate com nenhuma lei conhecida: sem alerta e sem trava");
      a.$("dlgRamos").close();
      /* na janela da LEI: o alerta aparece quando a lei aberta nao bate com o nome do topico */
      a.leiAbrir(disc, top, cf.id);
      ok(a.$("leiAvisoNome").hidden === false && /Emenda Constitucional nº 132\/2023/.test(a.$("leiAvisoNome").textContent) && /Constituição Federal/.test(a.$("leiAvisoNome").textContent), "R43 abrir a Constituicao no topico da emenda: a janela da lei AVISA (nome do topico e da lei): " + a.$("leiAvisoNome").textContent);
      a.$("dlgLeiSeca").close();
      a.leiAbrir(disc, top, ec.id);
      ok(a.$("leiAvisoNome").hidden === true && a.$("leiAvisoNome").textContent === "", "R43a abrir a emenda no topico da emenda: sem aviso");
      a.$("dlgLeiSeca").close();
      a.leiAbrir("", "", cf.id);
      ok(a.$("leiAvisoNome").hidden === true, "R43b lei aberta pela Biblioteca (sem topico): sem aviso");
      a.$("dlgLeiSeca").close();
      a.leiAbrir("Licitações", "Lei 14.133", cf.id);
      ok(a.$("leiAvisoNome").hidden === false, "R43c topico que cita 'Lei 14.133' com a Constituicao aberta: avisa");
      a.leiTrocarPara(ec.id);
      ok(a.$("leiAvisoNome").hidden === false, "R43d trocar para a emenda dentro do topico da Lei 14.133 tambem nao bate: continua avisando");
      a.$("dlgLeiSeca").close();
      a.leiAbrir(disc, top, cf.id);
      a.leiTrocarPara(ec.id);
      ok(a.$("leiAvisoNome").hidden === true, "R43e no topico da emenda, trocar da Constituicao para a emenda (\"usar uma lei ja guardada\") apaga o aviso");
      a.$("dlgLeiSeca").close();
      /* R44: o relatorio de leis e vinculos do log do leitor */
      const cfErrada = a.leiGuardar({ nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", especie: "Emenda Constitucional", numero: "106", ano: "2020", texto: CF, topicos: [chave] });
      const rel = a.leiRelatorioVinculos();
      ok(/^LEIS E VÍNCULOS · EasyAnkiCards/.test(rel) && rel.indexOf(a.leisLista().length + " lei(s) na biblioteca") >= 0 && rel.indexOf("Emenda Constitucional 132/2023") >= 0 && rel.indexOf("Constituição Federal") >= 0, "R44 o relatorio traz o cabecalho, a versao e as leis: " + rel.slice(0, 200));
      ok((rel.match(/⚠ DIVERGE/g) || []).length === 1 && /campos guardados: Emenda Constitucional 106 2020 · identidade lida do texto: Constituição 1988  ⚠ DIVERGE/.test(rel), "R44a marca a divergencia (a Constituicao gravada como 'Emenda 106/2020') e so' ela: " + (rel.match(/campos guardados.*/g) || []).join(" || "));
      ok((rel.match(/NÃO BATE com o nome do tópico/g) || []).length === 2 && /Emenda Constitucional 132\/2023[\s\S]*?ligada a 1 tópico\(s\):\n      - Reforma Tributária › .*preferida do tópico\n/.test(rel.replace(/\r/g, "")), "R44b as duas Constituicoes 'NAO BATEM' com o topico da EC e a emenda e' a preferida");
      ok(/há outra preferida/.test(rel) && /TÓPICOS COM MAIS DE UMA LEI \(1\):/.test(rel) && /o app abre: Emenda Constitucional 132\/2023 · preferida guardada: Emenda Constitucional 132\/2023/.test(rel), "R44c secao dos topicos com mais de uma lei: qual o app abre e qual e' a preferida");
      ok(rel.indexOf("Art. 43.") < 0 && rel.indexOf("==== TEXTO") < 0 && /começo do texto: EMENDA CONSTITUCIONAL Nº 132/.test(rel), "R44d sem o texto das leis (so' o comeco de cada uma)");
      const relT = a.leiRelatorioVinculos({ comTexto: true });
      ok(relT.indexOf("==== TEXTO [") >= 0 && relT.indexOf('"Art. 43. ...') >= 0 && relT.length > rel.length, "R44e com o texto: cada lei vem inteira no fim");
      /* sem preferida: vale a primeira ligada, em ordem alfabetica */
      const chave3 = a.matChave("Direito X", "Tópico Y");
      a.leiLigar(cf.id, chave3); a.leiLigar(ec.id, chave3);
      const rel3 = a.leiRelatorioVinculos();
      ok(/direito x › tópico y · sem preferida: usada por ser a 1ª ligada/.test(rel3) && /preferida guardada: nenhuma \(vale a 1ª ligada, em ordem alfabética\)/.test(rel3), "R44f topico com duas leis e SEM preferida: o relatorio diz que vale a primeira ligada (a causa do erro real)");
      a.$("dlgLeiLog").open = true;
      a.$("btnLeiLogVinc").onclick();
      ok(/^LEIS E VÍNCULOS/.test(a.$("leiLogTexto").value) && a.$("leiLogTexto").value.indexOf("==== TEXTO") < 0, "R44g o botao 'copiar leis e vinculos' monta o relatorio (sem texto) na caixa do log");
      a.$("btnLeiLogVincTexto").onclick();
      ok(a.$("leiLogTexto").value.indexOf("==== TEXTO [") >= 0, "R44h o botao '... com o texto das leis' inclui o texto");
      ok(a.leiRelatorioVinculos.length === 1 || true, "R44i (existe)");
      /* R45: corrigir a identificacao guardada das leis */
      const errada = a.leiDe(cfErrada.id);
      const dv = a.leiIdentidadeDivergente(errada);
      ok(dv && dv.de.especie === "Emenda Constitucional" && dv.de.numero === "106" && dv.de.ano === "2020" && dv.para.especie === "Constituição" && dv.para.numero === "" && dv.para.ano === "1988", "R45 a Constituicao gravada como 'Emenda 106/2020' e' divergente: de 106/2020 para Constituicao/1988: " + JSON.stringify(dv));
      ok(a.leiIdentidadeDivergente(a.leiDe(ec.id)) === null && a.leiIdentidadeDivergente({ texto: EC, especie: "Emenda Constitucional", numero: "132", ano: "2023" }) === null && a.leiIdentidadeDivergente({ texto: "", numero: "9" }) === null && a.leiIdentidadeDivergente({ texto: "sem cabecalho nenhum" , numero: "9" }) === null, "R45a campo vazio, campo igual, sem texto e texto sem cabecalho: nao sao divergencia");
      ok(a.leiIdentidadeDivergente({ texto: EC, especie: "Lei", numero: "132", ano: "2023" }) !== null && a.leiIdentidadeDivergente({ texto: EC, especie: "", numero: "", ano: "1999" }) !== null && a.leiIdentidadeDivergente({ texto: EC, especie: "", numero: "77", ano: "" }) !== null, "R45b divergem tambem: so' a especie errada, so' o ano errado, so' o numero errado");
      ok(a.leiIdentidadesDivergentes().length === 1 && a.leiIdentidadesDivergentes()[0].id === cfErrada.id, "R45c a lista das divergentes na biblioteca: so' a errada");
      a.$("dlgLeiLog").open = true;
      const antes = JSON.stringify(a.leiDe(cfErrada.id));
      ok((await a.leiIdentidadeTela(async () => false)).length === 0 && JSON.stringify(a.leiDe(cfErrada.id)) === antes && a.leiIdentidadesRecibo().length === 0, "R45d recusando a pergunta, NADA muda");
      let perguntou = "";
      const rr = await a.leiIdentidadeTela(async (txt) => { perguntou = txt; return true; });
      const dep = a.leiDe(cfErrada.id);
      ok(rr.length === 1 && dep.especie === "Constituição" && dep.numero === "" && dep.ano === "1988" && dep.nome === errada.nome && dep.texto === errada.texto && JSON.stringify(dep.topicos) === JSON.stringify(errada.topicos), "R45e corrigiu so' especie/numero/ano: nome, texto e vinculos intactos");
      ok(/1 lei\(s\)/.test(perguntou) && perguntou.indexOf("CONSTITUIÇÃO DA REPÚBLICA") >= 0 && perguntou.indexOf("Emenda Constitucional 106 2020 → Constituição 1988") >= 0, "R45f a pergunta lista o que vai mudar (de -> para): " + perguntou);
      ok(/Corrigi 1 lei/.test(a.$("leiLogTexto").value) && a.leiIdentidadesRecibo().length === 1 && a.$("btnLeiLogIdentDesfazer").hidden === false, "R45g avisa o que fez, guarda o recibo e mostra o 'desfazer'");
      ok((a.leiRelatorioVinculos().match(/⚠ DIVERGE/g) || []).length === 0, "R45h o relatorio de vinculos deixa de marcar a divergencia");
      ok((await a.leiIdentidadeTela(async () => true)).length === 0 && /Nenhuma lei/.test(a.$("leiLogTexto").value), "R45i sem divergencia: diz que nao ha nada a corrigir (nem pergunta)");
      ok(a.leiIdentidadeDesfazerTela() === 1 && a.leiDe(cfErrada.id).especie === "Emenda Constitucional" && a.leiDe(cfErrada.id).numero === "106" && a.leiDe(cfErrada.id).ano === "2020" && a.leiIdentidadesRecibo().length === 0 && a.$("btnLeiLogIdentDesfazer").hidden === true && /Desfeito: 1 lei/.test(a.$("leiLogTexto").value), "R45j desfazer devolve os campos de antes, apaga o recibo e esconde o botao");
      ok(a.leiIdentidadeDesfazerTela() === 0, "R45k desfazer sem recibo nao faz nada");
      const html45 = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/id="btnLeiLogIdent"/.test(html45) && /id="btnLeiLogIdentDesfazer"[^>]*hidden/.test(html45), "R45l os botoes estao no log do leitor (o desfazer nasce escondido)");
      const html44 = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/id="btnLeiLogVinc"/.test(html44) && /id="btnLeiLogVincTexto"/.test(html44), "R44j os dois botoes estao no log do leitor");
      const html42 = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/\.ram-lei-box\{/.test(html42) && /\.ram-lei-texto\{/.test(html42), "R42z a caixa da lei tem CSS");
    }

    /* R46: META DA SEMANA EM RAMOS */
    {
      const { a, ed } = MT();
      const HOJE = "2026-09-24";
      const hojeReal = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
      ok(JSON.stringify(a.edSemanaCalendario("2026-09-26")) === '{"ini":"2026-09-21","fim":"2026-09-27"}' && JSON.stringify(a.edSemanaCalendario("2026-09-21")) === '{"ini":"2026-09-21","fim":"2026-09-27"}' && JSON.stringify(a.edSemanaCalendario("2026-09-27")) === '{"ini":"2026-09-21","fim":"2026-09-27"}' && JSON.stringify(a.edSemanaCalendario("2026-03-01")) === '{"ini":"2026-02-23","fim":"2026-03-01"}', "R46 a semana vai de segunda a domingo (sabado, segunda, domingo e virada de mes)");
      const sem = { ini: "2026-09-21", fim: "2026-09-27" };
      const dia = [
        { d: "2026-09-22", c: "k", a: "feito", rm: [{ id: "a" }, { id: "_topo" }], rp: [{ id: "b" }, { id: "a" }] },
        { d: "2026-09-20", c: "k", a: "feito", rm: [{ id: "velho" }] },
        { d: "2026-09-28", c: "k", a: "feito", rm: [{ id: "futuro" }] },
        { d: "2026-09-23", c: "k", a: "pendente", rm: [{ id: "desmarcado" }], rp: [{ id: "desmarcado2" }] },
        { d: "2026-09-23", c: "k", a: "revisado", rm: [{ id: "revisto" }], rp: [{ id: "c" }] },
        { d: "?", c: "k", a: "feito", rm: [{ id: "semdata" }] },
        { d: "2026-09-27", c: "outro", a: "feito", rm: [{ id: "a" }] },
      ];
      const rd = a.edRamosDaSemana(dia, sem);
      ok(JSON.stringify(rd) === JSON.stringify({ "k›a": "feito", "k›b": "parcial", "k›c": "parcial", "outro›a": "feito" }), "R46a do diario: estudado (feito vence parcial), parcial; fora da semana, desmarcado, revisado, sem data e o marcador do topico nao contam: " + JSON.stringify(rd));
      ok(Object.keys(a.edRamosDaSemana(null, sem)).length === 0 && Object.keys(a.edRamosDaSemana([null, {}], sem)).length === 0, "R46b diario vazio ou lixo: nada");
      const r0 = a.lerEdital(ed.texto);
      const plano = (feitos) => a.montarPlano(r0, { horas: 20, prova: "2027-06-01", feitos: feitos || {}, fatores: null, acertos: null });
      const pl0 = plano();
      const it0 = pl0.itens.find((i) => i.nome === "Lei 14.133");
      const ch = it0.chave;
      const M0 = a.edMetaDeRamos(pl0, [], { hoje: HOJE });
      ok(M0.n === 3 && M0.feitos === 0 && M0.parciais === 0 && M0.pendentes === 3 && M0.ramos.map((x) => x.nome).join("|") === "Modalidades|Fase preparatória|Contratos" && M0.minutos === M0.ramos.reduce((s2, x) => s2 + x.minutos, 0) && M0.minutos > 0 && M0.sobra === 0, "R46c sem registro: os 3 ramos do topico com ramos, pelos mais relevantes, e o tempo somado: " + JSON.stringify([M0.n, M0.minutos, M0.ramos.map((x) => x.nome)]));
      ok(M0.semana.ini === "2026-09-21" && M0.orcamento === pl0.porSemana && M0.ramos.every((x) => x.estado === "pend" && x.item && x.topicoChave === ch), "R46d traz a semana, o orcamento da semana e o estado de cada ramo");
      /* estudado esta semana: continua na meta (senao "4 de 6" viraria "0 de 2" ao estudar) */
      const dEst = [{ d: HOJE, c: ch, a: "feito", rm: [{ id: "modalidades" }] }];
      const M1 = a.edMetaDeRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: HOJE } }), dEst, { hoje: HOJE });
      ok(M1.n === 3 && M1.feitos === 1 && M1.pendentes === 2 && M1.ramos[0].estado === "feito" && M1.minutosFeitos === M1.ramos[0].minutos, "R46e o ramo estudado esta semana CONTINUA na meta como feito (n segue 3): " + JSON.stringify([M1.n, M1.feitos, M1.ramos.map((x) => x.estado)]));
      const M1b = a.edMetaDeRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: "2026-09-10" } }), [{ d: "2026-09-10", c: ch, a: "feito", rm: [{ id: "modalidades" }] }], { hoje: HOJE });
      ok(M1b.n === 2 && M1b.feitos === 0, "R46f estudado em OUTRA semana: nao entra (ja' esta' feito, nao e' meta desta semana)");
      const M1c = a.edMetaDeRamos(plano(), [{ d: HOJE, c: ch, a: "feito", rp: [{ id: "contratos" }] }], { hoje: HOJE });
      ok(M1c.parciais === 1 && M1c.feitos === 0 && M1c.ramos.find((x) => x.ramoId === "contratos").estado === "parcial" && M1c.n === 3, "R46g ramo deixado parcial esta semana aparece como parcial");
      /* o que ja' foi estudado GASTA o orcamento: com so' 1 min sobrando, nenhum pendente cabe */
      const mMod = M0.ramos[0].minutos;
      const M1d = a.edMetaDeRamos(plano({ [ch + "›#modalidades"]: { e: "feito", d: HOJE } }), dEst, { hoje: HOJE, minutos: mMod + 1 });
      ok(M1d.n === 1 && M1d.feitos === 1 && M1d.pendentes === 0 && M1d.sobra === 2, "R46e2 o ramo estudado consome o orcamento da semana: sobrando so' 1 min, nenhum pendente entra: " + JSON.stringify([M1d.n, M1d.pendentes, M1d.sobra]));
      ok(a.edMetaDeRamos(Object.assign({}, pl0, { porSemana: 0 }), dEst, { hoje: HOJE }).n === 0, "R46e3 sem orcamento de semana nao ha meta (nem com ramo estudado)");
      /* ordem: a RELEVANCIA (peso do topico x parte do ramo), nao a ordem em que estao escritos */
      const NL46 = String.fromCharCode(10);
      const rAbs = a.lerEdital("# X | prova: 2027-06-01 | horas: 20" + NL46 + "@ D :: 5" + NL46 + "+ Leve :: 2" + NL46 + "++ L1 :: 3" + NL46 + "++ L2 :: 3" + NL46 + "+ Pesado :: 5" + NL46 + "++ P1 :: 3" + NL46 + "++ P2 :: 3");
      const plAbs = a.montarPlano(rAbs, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null });
      ok(a.edMetaDeRamos(plAbs, [], { hoje: HOJE }).ramos.map((x) => x.nome).join() === "P1,P2,L1,L2", "R46e4 ramos do topico pesado vem ANTES dos do leve, mesmo escritos depois: " + a.edMetaDeRamos(plAbs, [], { hoje: HOJE }).ramos.map((x) => x.nome).join());
      /* pulado */
      const M2 = a.edMetaDeRamos(plano({ [ch + "›#fase_preparatoria"]: { e: "pulado", d: HOJE } }), [], { hoje: HOJE });
      ok(M2.n === 2 && M2.ramos.every((x) => x.ramoId !== "fase_preparatoria"), "R46h ramo pulado fora da meta");
      /* orcamento */
      const m1 = M0.ramos[0].minutos;
      const M3 = a.edMetaDeRamos(pl0, [], { hoje: HOJE, minutos: m1 });
      ok(M3.n === 1 && M3.ramos[0].nome === "Modalidades" && M3.sobra === 2 && M3.minutos <= m1, "R46i com orcamento so' para um ramo: entra o mais relevante e 'sobra' conta os outros 2: " + JSON.stringify([M3.n, M3.sobra]));
      ok(a.edMetaDeRamos(pl0, [], { hoje: HOJE, minutos: 1 }).n === 0 && a.edMetaDeRamos(Object.assign({}, pl0, { porSemana: 0 }), [], { hoje: HOJE }).n === 0 && a.edMetaDeRamos(null, [], { hoje: HOJE }).n === 0, "R46j sem orcamento (ou plano vazio): nada");
      const M4 = a.edMetaDeRamos(pl0, dEst, { hoje: HOJE, minutos: 1 });
      ok(M4.n === 1 && M4.feitos === 1, "R46k o que ja' foi estudado entra SEMPRE, mesmo estourando o orcamento");
      /* so' a agenda desta semana */
      const plS = Object.assign({}, pl0, { itens: pl0.itens.map((i) => (i.chave === ch ? Object.assign({}, i, { semana: 2 }) : i)) });
      ok(a.edMetaDeRamos(plS, [], { hoje: HOJE }).n === 0 && a.edMetaDeRamos(plS, dEst, { hoje: HOJE }).n === 1, "R46l topico da agenda de OUTRA semana nao entra; mas o ramo estudado esta semana entra");
      const plN = Object.assign({}, pl0, { itens: pl0.itens.map((i) => (i.chave === ch ? Object.assign({}, i, { semana: null }) : i)) });
      ok(a.edMetaDeRamos(plN, [], { hoje: HOJE }).n === 3, "R46m sem cronograma (semana nula) o topico vale");
      /* sem ramos no edital */
      const r1 = a.lerEdital("# X | prova: 2027-06-01 | horas: 20\n@ D :: 5\n+ T :: 5\n+ U :: 3");
      const pl1 = a.montarPlano(r1, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null });
      ok(a.edMetaDeRamos(pl1, [], { hoje: HOJE }).n === 0, "R46n edital sem ramos: meta em ramos vazia (comportamento de sempre)");
      /* tela: acompanhamento e painel da disciplina */
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.edDiario.length = 0;
      a.edDiario.push({ d: hojeReal(), c: ch, n: "Lei 14.133", disc: "Licitações", a: "feito", m: 30, rm: [{ id: "modalidades" }] });
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "feito", d: hojeReal() } });
      const plT = a.montarPlano(a.lerEdital(ed.texto), { horas: 20, prova: "2027-06-01", feitos: { [ch + "›#modalidades"]: { e: "feito", d: hojeReal() } }, fatores: null, acertos: null });
      a.edPintarRitmo(plT);
      const bloco = achar(a.$("edRitmo"), (e) => cls(e, "ac-meta-ramos"))[0];
      const chips = achar(bloco || a.$("edRitmo"), (e) => cls(e, "ac-meta-chip"));
      ok(!!bloco && /Meta da semana em ramos/.test(bloco.textContent) && /3 ramo\(s\)/.test(bloco.textContent) && /estudados 1/.test(bloco.textContent) && chips.length === 3, "R46o o acompanhamento mostra a meta da semana em ramos e um chip por ramo: " + (bloco ? bloco.textContent.slice(0, 160) : "sem bloco"));
      ok(/^✓ Modalidades/.test(chips[0].textContent) && !/^✓/.test(chips[1].textContent) && cls(chips[0], "ed-ramo-feito"), "R46p o ramo estudado vem marcado com ✓");
      chips[1].onclick();
      ok(a.$("dlgRegistro").open === true, "R46q clicar num ramo PENDENTE abre o registro dele");
      a.$("dlgRegistro").close();
      a.abrirDisciplina("Licitações");
      const lin46 = Array.from(a.$("dscRamosLista").children).filter((l) => /dsc-ramo-lin/.test(l.className));
      ok(lin46.length === 3 && lin46.every((l) => /dsc-ramo-semana/.test(l.className) && /esta semana/.test(l.children[2].textContent)), "R46r o painel da disciplina marca 'esta semana' nos ramos da meta");
      a.$("dlgDisciplina").close();
      a.edDiario.length = 0;
      const html46 = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(/\.ac-meta-chips\{/.test(html46) && /\.ac-meta-chip\{/.test(html46), "R46s a meta tem CSS");
    }

    /* R47: CONSULTAR A LEI ALTERADA — a que dispositivos pertence cada "..." da emenda */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const pts = (n) => ".".repeat(n);
      const EC = ["EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023", "", "Altera o Sistema Tributário Nacional.", "",
        "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:", "",
        '"Art. 43. ' + pts(60), "", pts(60), "", '§ 4º Sempre que possível, a concessão dos incentivos regionais a que se refere o § 2º, III, considerará critérios de sustentabilidade ambiental e redução das emissões de carbono." (NR)', "",
        '"Art. 145. ' + pts(60), "", '§ 3º O Sistema Tributário Nacional deverá observar os princípios da simplicidade." (NR)', "",
        "Art. 2º O Ato das Disposições Constitucionais Transitórias passa a vigorar com as seguintes alterações:", "",
        '"Art. 124. Lei complementar estabelecerá a transição." (NR)', "",
        "Art. 3º Esta Emenda Constitucional entra em vigor na data de sua publicação."].join(NL);
      const cfTxt = (par4) => ["CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", "TÍTULO III", "Da Organização do Estado",
        "Art. 43. Para efeitos administrativos, a União poderá articular sua ação em um mesmo complexo geoeconômico e social.",
        "§ 1º Lei complementar disporá sobre:", "I - as condições para integração de regiões em desenvolvimento;", "II - a composição dos organismos regionais.",
        "§ 2º Os incentivos regionais compreenderão, além de outros, na forma da lei:", "I - igualdade de tarifas;", "II - juros favorecidos;", "III - isenções de tributos federais;", "IV - prioridade para o aproveitamento dos rios.",
        "§ 3º Nas áreas a que se refere o § 2º, IV, a União incentivará a recuperação de terras áridas.",
        par4,
        "TÍTULO VI", "Da Tributação e do Orçamento",
        "Art. 145. A União, os Estados, o Distrito Federal e os Municípios poderão instituir os seguintes tributos:",
        "§ 1º Sempre que possível, os impostos terão caráter pessoal.", "§ 2º As taxas não poderão ter base de cálculo própria de impostos.", "§ 3º O Sistema Tributário Nacional deverá observar os princípios da simplicidade.",
        "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS",
        "Art. 43. Artigo 43 do ADCT, sem relação com o do corpo.", "Art. 124. Lei complementar estabelecerá a transição."].join(NL);
      const CF = cfTxt("§ 4º Sempre que possível, a concessão dos incentivos regionais a que se refere o § 2º, III, considerará critérios de sustentabilidade ambiental e redução das emissões de carbono.");
      const CFVELHA = cfTxt("§ 4º Redação antiga do parágrafo quarto.");
      /* seccoes: o numero repete entre o corpo e o ADCT */
      ok(a.leiSecoes(CF).adct !== null && a.leiArtigosDaSecao(CF, "adct").map((x) => x.num).join() === "43,124" && a.leiArtigosDaSecao(CF, "corpo").map((x) => x.num).join() === "43,145" && a.leiArtigosDaSecao(CF, "tudo").length === 4, "R47 o ADCT e' uma secao da Constituicao: adct = 43,124; corpo = 43,145 (o numero repete)");
      const cf = a.leiGuardar({ nome: "Constituição Federal", texto: CF, topicos: [] });
      const ec = a.leiGuardar({ nome: "Emenda Constitucional 132/2023", texto: EC, topicos: [] });
      const leisAll = () => a.leisLista();
      const cc = a.leiAlvosCandidatos({ curto: "Constituição Federal" }, leisAll());
      ok(cc.length === 1 && cc[0].id === cf.id && cc[0].confianca === "alta", "R47a candidata para 'Constituicao Federal': so' a Constituicao (a emenda nao entra)");
      const ca = a.leiAlvosCandidatos({ curto: "ADCT" }, leisAll());
      ok(ca.length === 1 && ca[0].id === cf.id && ca[0].confianca === "media" && /divisão/.test(ca[0].motivo), "R47b sem lei do ADCT separada, a candidata do ADCT e' a Constituicao (confianca media, 'o ADCT e' uma divisao')");
      const adct = a.leiGuardar({ nome: "ADCT - Ato das Disposições Constitucionais Transitórias", texto: "Art. 1º Texto do ADCT.", topicos: [] });
      const ca2 = a.leiAlvosCandidatos({ curto: "ADCT" }, leisAll());
      ok(ca2.length === 2 && ca2[0].id === adct.id && ca2[0].confianca === "alta" && ca2[1].id === cf.id, "R47c com a lei do ADCT separada, ela vem primeiro (alta) e a Constituicao depois");
      /* a ordem: confianca alta antes da media, mesmo que a media venha antes em ordem alfabetica */
      const adctZ = a.leiGuardar({ nome: "Z ADCT separado (outra cópia)", texto: "Art. 1º Outro texto do ADCT, mais longo que o outro.", topicos: [] });
      const ca3 = a.leiAlvosCandidatos({ curto: "ADCT" }, leisAll());
      ok(ca3.length === 3 && ca3[2].id === cf.id && ca3[2].confianca === "media" && ca3[0].confianca === "alta" && ca3[1].confianca === "alta", "R47c2 as de confianca ALTA vem antes da media (a Constituicao, alfabeticamente no meio, fica por ultimo)");
      a.leiApagar(adctZ.id);
      ok(a.leiAlvosCandidatos({ curto: "Emenda Constitucional nº 132/2023" }, leisAll()).map((x) => x.id).join() === ec.id && a.leiAlvosCandidatos({ curto: "Lei nº 132/2023" }, leisAll())[0].confianca === "media" && a.leiAlvosCandidatos({ curto: "Emenda Constitucional nº 132/2022" }, leisAll()).length === 0 && a.leiAlvosCandidatos({ curto: "Emenda Constitucional nº 133/2023" }, leisAll()).length === 0 && a.leiAlvosCandidatos(null, leisAll()).length === 0, "R47d alvo numerado: numero e ano batem = alta; outra especie = media; outro ano = nenhuma; alvo vazio = nenhuma");
      const cfRec = () => a.leiDe(cf.id);
      ok(/^Art\. 43\. Para efeitos/.test(a.leiArtigoDoAlvo(cfRec(), "Constituição Federal", "43").texto) && /^Art\. 43\. Artigo 43 do ADCT/.test(a.leiArtigoDoAlvo(cfRec(), "ADCT", "43").texto) && a.leiArtigoDoAlvo(cfRec(), "Constituição Federal", "124") === null && a.leiArtigoDoAlvo(cfRec(), "ADCT", "124") !== null && a.leiArtigoDoAlvo(null, "ADCT", "1") === null, "R47e o artigo certo: 'art. 43' do corpo x do ADCT; 124 so' existe no ADCT");
      ok(/Texto do ADCT/.test(a.leiArtigoDoAlvo(a.leiDe(adct.id), "ADCT", "1").texto), "R47f lei do ADCT separada: vale toda ela");
      /* as lacunas do exemplo do usuario: art. 43 */
      const par = a.leiLerAlteradora(EC, null);
      const b43 = par.blocos.find((b) => b.num === "43"), b145 = par.blocos.find((b) => b.num === "145");
      const art43 = a.leiArtigoDoAlvo(cfRec(), "Constituição Federal", "43");
      const lc = a.leiLacunasDoBloco(b43.corpo, art43.texto);
      ok(lc.casou && lc.marcadores === 2 && lc.lacunas.length === 2 && lc.lacunas[0].descricao === "caput" && lc.lacunas[0].n === 1 && lc.lacunas[1].descricao === "§§ 1º a 3º" && lc.lacunas[1].n === 9 && lc.semMarcador.length === 0 && Object.keys(lc.mostradas).join() === "P4", "R47g art. 43 (o exemplo): a 1a marca e' o CAPUT; a 2a sao os §§ 1º a 3º (9 dispositivos: 1º, I, II, 2º, I a IV, 3º); so' o § 4º e' escrito: " + JSON.stringify(lc.lacunas.map((x) => [x.descricao, x.n])));
      ok(lc.lacunas[1].entradas.map((e) => e.chave).join() === "P1,P1>I,P1>II,P2,P2>I,P2>II,P2>III,P2>IV,P3" && /Lei complementar disporá/.test(lc.lacunas[1].entradas[0].texto), "R47h as entradas da lacuna sao os dispositivos certos, com o texto da lei alterada");
      const art145 = a.leiArtigoDoAlvo(cfRec(), "Constituição Federal", "145");
      const l145 = a.leiLacunasDoBloco(b145.corpo, art145.texto);
      ok(l145.casou && l145.lacunas.length === 1 && l145.lacunas[0].descricao === "caput" && l145.semMarcador.length === 1 && l145.semMarcador[0].descricao === "§§ 1º e 2º", "R47i o que fica entre o caput omitido e o § 3º escrito, sem marca propria, vai para 'semMarcador' (§§ 1º e 2º): " + JSON.stringify([l145.lacunas.map((x) => x.descricao), l145.semMarcador.map((x) => x.descricao)]));
      ok(a.leiDescreverLacuna([{ chave: "P1", tipo: "paragrafo", rotulo: "§ 1º", nivel: 1 }]) === "§ 1º" && a.leiDescreverLacuna([{ chave: "II", tipo: "inciso", rotulo: "II -", nivel: 2 }, { chave: "III", tipo: "inciso", rotulo: "III -", nivel: 2 }]) === "II e III" && a.leiDescreverLacuna([{ chave: "caput", tipo: "caput", rotulo: "", nivel: 0 }, { chave: "I", tipo: "inciso", rotulo: "I -", nivel: 2 }, { chave: "I>a", tipo: "alinea", rotulo: "a)", nivel: 3 }]) === "caput, I", "R47j a descricao: § singular, incisos 'II e III', o filho ja' esta' dentro do pai");
      /* casos de borda das lacunas, com blocos escritos a mao */
      const bl = (...linhas) => linhas.join(NL);
      /* (1) dispositivo omitido COM filhos: "§ 2º ....." leva junto os incisos (menos o que a emenda escreve) */
      const cA = a.leiLacunasDoBloco(bl('"Art. 43. ' + pts(60), "", "§ 2º " + pts(60), "", '§ 3º Nas áreas a que se refere o § 2º, IV, texto novo." (NR)'), art43.texto);
      ok(cA.casou && cA.lacunas.map((x) => x.tipo + ":" + x.chave + ":" + x.descricao + ":" + x.n).join("|") === "propria:caput:caput:1|propria:P2:§ 2º:5" && cA.semMarcador.map((x) => x.descricao).join() === "§ 1º,§ 4º", "R47y '§ 2º ....' omitido leva o § 2º e seus 4 incisos (5); o § 1º (antes) e o § 4º (depois do § 3º escrito), sem marca, vao para semMarcador: " + JSON.stringify(cA.lacunas.map((x) => [x.tipo, x.chave, x.descricao, x.n])));
      /* (2) o que a emenda escreve DENTRO do omitido nao conta como omitido */
      const cB = a.leiLacunasDoBloco(bl('"Art. 43. ' + pts(60), "", "§ 2º " + pts(60), "", "III - isenções de tributos federais, texto novo." + '" (NR)'), art43.texto);
      const propB = cB.lacunas.find((x) => x.chave === "P2");
      ok(!!propB && propB.n === 4 && propB.entradas.every((e) => e.chave !== "P2>III") && cB.mostradas["P2>III"] === true, "R47z '§ 2º ....' e depois o inciso III escrito: a lacuna do § 2º tem 4 (nao inclui o III que a emenda escreve): " + (propB ? propB.entradas.map((e) => e.chave).join() : "sem"));
      /* (3) a marca vai so' ate' o proximo dispositivo escrito: o que vem depois dele e' outra coisa */
      const cC = a.leiLacunasDoBloco(bl('"Art. 43. ' + pts(60), "", pts(60), "", "§ 2º Os incentivos regionais, texto novo." + '" (NR)'), art43.texto);
      ok(cC.casou && cC.lacunas.length === 2 && cC.lacunas[1].tipo === "depois" && cC.lacunas[1].descricao === "§ 1º" && cC.lacunas[1].n === 3 && cC.semMarcador.length === 1 && /§§ 3º e 4º|§ 3º/.test(cC.semMarcador[0].descricao), "R47aa a marca depois do caput cobre so' o que vai ate' o § 2º escrito (§ 1º, com 3 dispositivos); o que vem depois do § 2º (§§ 3º e 4º) e' 'semMarcador': " + JSON.stringify([cC.lacunas.map((x) => [x.descricao, x.n]), cC.semMarcador.map((x) => x.descricao)]));
      /* (4) duas marcas seguidas: a 1a leva os dispositivos, a 2a fica sem nada e o chip dela e' so' um "…" */
      const cD = a.leiLacunasDoBloco(bl('"Art. 43. Caput reescrito pela emenda.', "", pts(60), "", pts(60), "", "§ 4º Texto novo." + '" (NR)'), art43.texto);
      ok(cD.lacunas.length === 2 && cD.lacunas[0].n === 9 && cD.lacunas[1].n === 0 && cD.lacunas[1].descricao === "", "R47bb duas marcas seguidas: a primeira cobre os 9 dispositivos e a segunda fica vazia");
      ok(/lei-lacuna-vazia/.test(a.leiLacunaChip("x1", { lacuna: cD.lacunas[1], numCru: "43", alvoCurto: "Constituição Federal" })) && !/data-lac/.test(a.leiLacunaChip("x1", { lacuna: cD.lacunas[1], numCru: "43", alvoCurto: "Constituição Federal" })) && /data-lac="x2"/.test(a.leiLacunaChip("x2", { lacuna: cD.lacunas[0], numCru: "43", alvoCurto: "Constituição Federal" })), "R47cc a marca vazia vira um '…' comum (sem clique); a que cobre algo, um chip clicavel");
      /* consulta */
      const cons = a.leiArtigoParaConsulta(b43.corpo, art43.texto);
      ok(cons.incorpora === true && cons.mesclou === false && cons.dispositivos.length === 11 && cons.dispositivos.filter((d) => d.etiqueta === "alterado").map((d) => d.chave).join() === "P4" && cons.dispositivos[0].etiqueta === "fora", "R47k a Constituicao da biblioteca JA' traz o § 4º: incorpora, 11 dispositivos, so' o § 4º 'alterado', o resto 'fora'");
      const artVelho = a.leiArtigosDaSecao(CFVELHA, "corpo").find((x) => x.num === "43");
      const cons2 = a.leiArtigoParaConsulta(b43.corpo, artVelho.texto);
      ok(cons2.incorpora === false && cons2.mesclou === true && /emissões de carbono/.test(cons2.texto) && !/Redação antiga/.test(cons2.texto), "R47l Constituicao de ANTES da emenda: previa mesclada (o § 4º da emenda no lugar do antigo)");
      const artAspas = { texto: art43.texto.replace("emissões de carbono.", "emissões de “carbono”;  ") };
      ok(a.leiArtigoParaConsulta(b43.corpo, artAspas.texto).incorpora === true, "R47l2 aspas curvas, pontuacao e espacos diferentes nao impedem de reconhecer que a lei da biblioteca ja' traz a redacao");
      /* tela: faixa, sugestao e escolha */
      const disc = "Reforma Tributária", top = "Emenda Constitucional nº 132/2023";
      const chave = a.matChave(disc, top);
      a.leiLigar(ec.id, chave);
      a.leiAbrir(disc, top, ec.id);
      const ctx = a.leiAlvoCtxAtual();
      ok(!!ctx && ctx.porCurto["Constituição Federal"].escolhida.id === cf.id && ctx.porCurto["Constituição Federal"].decidida === false && ctx.porCurto["ADCT"].escolhida.id === adct.id && ctx.porCurto["Constituição Federal"].artigos === 2 && ctx.porCurto["ADCT"].artigos === 1, "R47m ao ler a emenda o app SUGERE a lei de cada alvo (a Constituicao e o ADCT separado), sem que estejam ligadas ao topico");
      const faixa = a.$("leiFaixaAlvo");
      ok(faixa.hidden === false && /Esta lei ALTERA Constituição Federal: 2 artigo/.test(faixa.textContent) && /Esta lei ALTERA ADCT/.test(faixa.textContent) && /Sugestão do app/.test(faixa.textContent) && !/Escolha sua/.test(faixa.textContent), "R47n a faixa avisa que a lei ALTERA a Constituicao e que a lei consultada e' sugestao: " + faixa.textContent.slice(0, 200));
      const regs = a.leiLacunasRegAtual();
      const chavesReg = Object.keys(regs);
      ok(chavesReg.length >= 2 && chavesReg.some((k) => regs[k].num === "43" && regs[k].lacuna.descricao === "caput") && chavesReg.some((k) => regs[k].num === "43" && regs[k].lacuna.descricao === "§§ 1º a 3º") && chavesReg.every((k) => regs[k].leiAlvoId === cf.id || regs[k].leiAlvoId === adct.id), "R47o cada '...' do art. 43 virou um chip registrado (caput; §§ 1º a 3º), apontando para a lei sugerida: " + chavesReg.join());
      const idA = chavesReg.find((k) => regs[k].num === "43" && regs[k].lacuna.descricao === "§§ 1º a 3º");
      const html47 = Array.from(a.$("leiLeitura").querySelectorAll(".lei-art-txt")).map((e) => e.innerHTML).join("");
      ok(html47.indexOf('data-lac="' + idA + '"') >= 0 && /= §§ 1º a 3º · art\. 43 de Constituição Federal/.test(html47), "R47p o texto da leitura traz o chip '= §§ 1º a 3º · art. 43 de Constituição Federal'");
      /* clicar no chip: expande, e clicar de novo recolhe */
      const pai = { children: [], insertBefore(b) { this.children.push(b); }, removeChild(x) { this.children = this.children.filter((y) => y !== x); } };
      const chip = { tagName: "P", className: "", parentNode: pai, nextSibling: null, getAttribute: (k) => (k === "data-lac" ? idA : null) };
      ok(a.leiLacunaClique({ target: chip }) === true && pai.children.length === 1 && /Não está escrito na emenda — vem de Constituição Federal, art\. 43: §§ 1º a 3º/.test(pai.children[0].textContent) && /Lei complementar disporá sobre/.test(pai.children[0].textContent) && /Os incentivos regionais compreenderão/.test(pai.children[0].textContent), "R47q clicar no chip mostra, no lugar, o texto da lei alterada (§§ 1º a 3º), com o aviso 'nao esta' escrito na emenda'");
      ok(a.leiLacunaClique({ target: chip }) === true && pai.children.length === 0 && a.leiLacunaClique({ target: { getAttribute: () => null, parentNode: null } }) === false && a.leiLacunaClique(null) === false, "R47r clicar de novo recolhe; clicar fora de um chip nao faz nada");
      /* consulta do artigo inteiro */
      ok(a.leiConsultaAbrir(regs[idA]) === true && /Consulta · art\. 43 de Constituição Federal/.test(a.$("leiConsultaTit").textContent) && /JÁ traz a redação desta emenda/.test(a.$("leiConsultaAviso").textContent) && a.$("dlgLeiConsulta").open === true, "R47s a janela de consulta abre com o titulo e o aviso de que a lei da biblioteca ja' traz a emenda");
      const linhasC = a.$("leiConsultaCorpo").children;
      ok(linhasC.length === 11 && /lei-cons-fora/.test(linhasC[0].className) && /lei-cons-alterado/.test(linhasC[10].className) && /escrito pela emenda/.test(linhasC[10].textContent) && !/não está na emenda/.test(linhasC[0].textContent) && /Em cinza: o que a emenda não escreve/.test(a.$("leiConsultaAviso").textContent), "R47t a consulta mostra o artigo inteiro: o § 4º destacado ('escrito pela emenda') e o resto em cinza, explicado na legenda do aviso (sem etiqueta em cada linha)");
      a.$("dlgLeiConsulta").close();
      /* a escolha e' do usuario e fica guardada na lei que altera */
      const cf2 = a.leiGuardar({ nome: "CF/88 compilada (outra cópia)", texto: CFVELHA, topicos: [] });
      a.leiAlvoEscolher("Constituição Federal", cf2.id);
      ok(a.leiDe(ec.id).alvos["Constituição Federal"] === cf2.id && a.leiAlvoCtxAtual().porCurto["Constituição Federal"].escolhida.id === cf2.id && a.leiAlvoCtxAtual().porCurto["Constituição Federal"].decidida === true && /Escolha sua/.test(a.$("leiFaixaAlvo").textContent), "R47u escolher outra lei: guarda em l.alvos da emenda, a faixa passa a dizer 'Escolha sua' e a leitura usa a escolhida");
      const idB = Object.keys(a.leiLacunasRegAtual()).find((k) => a.leiLacunasRegAtual()[k].num === "43" && a.leiLacunasRegAtual()[k].lacuna.descricao === "§§ 1º a 3º");
      ok(!!idB && a.leiLacunasRegAtual()[idB].leiAlvoId === cf2.id, "R47v os chips passam a apontar para a lei ESCOLHIDA");
      /* R48: o caminho de volta — a lei ALTERADA mostra por quem foi alterada */
      const rec = a.leiAlteracoesRecebidas(a.leiDe(cf.id));
      ok(Object.keys(rec).sort().join() === "adct|124,corpo|145,corpo|43" && rec["corpo|43"][0].id === ec.id && rec["corpo|43"][0].rotulo === "Art. 1º" && rec["corpo|43"][0].num === "1" && rec["adct|124"][0].rotulo === "Art. 2º" && rec["adct|124"][0].num === "2", "R48 a Constituicao sabe quem a altera: corpo art. 43 e 145 (pelo art. 1º da emenda) e ADCT art. 124 (pelo art. 2º): " + Object.keys(rec).sort().join());
      ok(Object.keys(a.leiAlteracoesRecebidas(a.leiDe(ec.id))).length === 0 && Object.keys(a.leiAlteracoesRecebidas(null)).length === 0 && (() => { const r1 = a.leiAlteracoesRecebidas(a.leiDe(cf.id)); return r1 === a.leiAlteracoesRecebidas(a.leiDe(cf.id)) && JSON.stringify(r1) === JSON.stringify(rec); })(), "R48a a emenda nao e' alterada por ninguem; sem lei, vazio; a segunda chamada usa o memo (mesmo objeto)");
      const recAdct = a.leiAlteracoesRecebidas(a.leiDe(adct.id));
      ok(Object.keys(recAdct).join() === "tudo|124", "R48a2 a lei do ADCT separada so' recebe o que alterou o ADCT (o art. 124), nao os artigos da Constituicao do corpo: " + Object.keys(recAdct).join());
      const adctArts = a.leiArtigosDaSecao(CF, "adct"), corpoArts = a.leiArtigosDaSecao(CF, "corpo");
      const rcx = { mapa: rec, adct: a.leiSecoes(CF).adct };
      const chip43 = a.leiChipsRecebidos({ num: "43", indice: corpoArts[0].indice }, rcx);
      ok(!!chip43 && chip43.children.length === 1 && /alterado por .* · Art\. 1º/.test(chip43.children[0].textContent), "R48b o artigo 43 do CORPO ganha o selo 'alterado por … · Art. 1º': " + (chip43 && chip43.textContent));
      ok(a.leiChipsRecebidos({ num: "43", indice: adctArts[0].indice }, rcx) === null && a.leiChipsRecebidos({ num: "124", indice: adctArts[1].indice }, rcx) !== null && a.leiChipsRecebidos({ num: "43", indice: corpoArts[0].indice }, null) === null, "R48c o art. 43 do ADCT NAO ganha o selo do art. 43 do corpo (a numeracao repete); o 124 do ADCT ganha");
      a.leiAbrir("", "", cf.id);
      const selos = a.$("leiLeitura").querySelectorAll(".lei-alt-chip-rec");
      ok(selos.length === 3 && selos.every((b) => /alterado por/.test(b.textContent)), "R48d lendo a Constituicao, 3 artigos ganham o selo (43, 145 e o 124 do ADCT): " + selos.length);
      selos[0].onclick();
      ok(a.$("leiTexto").value === EC && a.$("leiFaixaAlvo").hidden === false, "R48e clicar no selo abre a EMENDA (e a faixa dela aparece)");
      const rel = a.leiRelatorioVinculos();
      ok(/LEIS QUE ALTERAM OUTRAS/.test(rel) && /Emenda Constitucional 132\/2023 altera Constituição Federal: 2 artigo\(s\) citado\(s\) · consultaria «Constituição Federal» \(alta; identificada pelo texto como a Constituição\) · achou 2 artigo\(s\), 2 com trecho omitido, 2 já constam na lei consultada/.test(rel), "R48f o relatorio traz, por alvo, a lei que seria consultada e quantos artigos ja' constam: " + (rel.split("\n").filter((l) => /altera /.test(l)).join(" || ")));
      ok(/altera ADCT: 1 artigo\(s\) citado\(s\) · consultaria «ADCT - Ato das Disposições Constitucionais Transitórias» \(alta; lei separada do ADCT\) · achou 0 artigo\(s\)/.test(rel), "R48g o ADCT separado e' a candidata (alta) e o relatorio diz que nao achou o art. 124 nela");
      ok(a.leiAlteracoesDe(a.leiDe(cf.id)).length === 0 && a.leiAlteracoesDe({ texto: "Art. 1º Texto." }).length === 0, "R48h lei sem artigo entre aspas: nao altera ninguem");
      a.$("dlgLeiSeca").close();
      /* sem a lei alterada na biblioteca */
      a.leiApagar(cf.id); a.leiApagar(cf2.id); a.leiApagar(adct.id);
      ok(/altera Constituição Federal: 2 artigo\(s\) citado\(s\) · ⚠ Constituição Federal NÃO está na biblioteca/.test(a.leiRelatorioVinculos()), "R48i sem a Constituicao na biblioteca, o relatorio avisa: '⚠ Constituição Federal NÃO está na biblioteca'");
      a.leiAbrir(disc, top, ec.id);
      ok(a.leiAlvoCtxAtual().porCurto["Constituição Federal"].escolhida === null && /não está na biblioteca/.test(a.$("leiFaixaAlvo").textContent) && Object.keys(a.leiLacunasRegAtual()).filter((k) => a.leiLacunasRegAtual()[k].leiAlvoId === cf.id).length >= 0 && /abrir a Biblioteca de leis/.test(a.$("leiFaixaAlvo").textContent), "R47w sem a Constituicao na biblioteca: a faixa diz que nao esta' e oferece abrir a Biblioteca (a leitura segue sem chips)");
      /* lei que nao altera ninguem: sem faixa */
      const lisa = a.leiGuardar({ nome: "Lei simples", texto: "Art. 1º Texto qualquer da lei.", topicos: [] });
      a.leiAbrir("X", "Y", lisa.id);
      ok(a.$("leiFaixaAlvo").hidden === true && a.leiAlvoCtxAtual() === null, "R47x lei comum: sem faixa e sem contexto de alvo");
      a.$("dlgLeiSeca").close();
    }

    /* R49: ESPELHAR o registro em outro edital ligado por vinculo */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const ED2 = ["# SEFAZ Alagoas | prova: 2027-08-01 | horas: 20", "@ Licitações :: 5", "+ Nova Lei de Licitações :: 5", "++ Modalidades :: 5", "++ Contratos :: 3", "@ Outra :: 3", "+ Tópico B :: 3"].join(NL);
      const ed2 = a.edCriar("SEFAZ Alagoas", ED2);
      const chOrig = a.vkChave("Licitações", "Lei 14.133"), chDest = a.vkChave("Licitações", "Nova Lei de Licitações");
      ok(a.vkAplicar([{ de: { chave: chOrig }, para: { chave: chDest }, conf: "ALTA" }], ed2.id, "estudei").novos === 1, "R49pre vinculo criado");
      const dests = a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2]);
      ok(dests.length === 1 && dests[0].editalId === ed2.id && dests[0].disciplina === "Licitações" && dests[0].topico === "Nova Lei de Licitações" && dests[0].chave === "licitações›nova lei de licitações" && dests[0].ramos.join() === "modalidades,contratos" && dests[0].estadoAtual === null, "R49 destino do espelho: o topico do outro edital ligado por vinculo (com a chave do progresso, os ramos e o estado atual): " + JSON.stringify(dests));
      ok(a.vkEspelhosDe("Licitações", "Nova Lei de Licitações", ed2.id, [ed, ed2]).map((d) => d.topico).join() === "Lei 14.133" && a.vkEspelhosDe("Licitações", "Lei 14.133", ed2.id, [ed, ed2]).length === 0 && a.vkEspelhosDe("Licitações", "Sem vinculo", ed.id, [ed, ed2]).length === 0, "R49a vale nos dois sentidos; nunca devolve o proprio edital; sem vinculo, nada");
      a.vkAplicar([{ de: { chave: chOrig }, para: { chave: a.vkChave("Outra", "Tópico B") }, conf: "MEDIA" }], ed2.id, "estudei");
      ok(a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2]).length === 1, "R49b vinculo de confianca MEDIA nao gera espelho");
      ok(a.vkArquivar([{ a: chOrig, b: chDest }], true) === 1 && a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2]).length === 0 && a.vkArquivar([{ a: chOrig, b: chDest }], false) === 1 && a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2]).length === 1, "R49b2 vinculo ARQUIVADO nao gera espelho (e volta a gerar ao desarquivar)");
      ed2.progresso["licitações›nova lei de licitações"] = { e: "feito", d: "2026-01-01" };
      ok(a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2])[0].estadoAtual === "feito", "R49b3 o destino traz o estado que o topico ja' tem la'");
      delete ed2.progresso["licitações›nova lei de licitações"];
      const ed3 = a.edCriar("Concurso encerrado", ["# Velho | prova: 2020-01-01 | horas: 20", "@ Licitações :: 5", "+ Nova Lei de Licitações :: 5"].join(NL));
      ok(a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2, ed3]).length === 1 && a.vkEspelhosDe("Licitações", "Lei 14.133", ed.id, [ed, ed2, ed3], { incluirEncerrados: true }).length === 2, "R49c edital ENCERRADO fora (a menos que peça)");
      /* as marcas, puras */
      const H = "2026-09-26";
      const p1 = {};
      const m1 = a.edEspelharMarcas(p1, { chave: "c", ramos: [] }, "feito", [], H, "O");
      ok(m1.length === 1 && m1[0].k === "c" && m1[0].ant === null && JSON.stringify(p1.c) === JSON.stringify({ e: "feito", d: H, esp: "O" }), "R49d topico sem ramos: grava a marca com data e origem");
      ok(a.edEspelharMarcas({ c: { e: "revisado", d: "2026-01-01" } }, { chave: "c", ramos: [] }, "revisado", [], H, "O").length === 0, "R49e0 revisado no destino e revisao de origem: nada");
      ok(a.edEspelharMarcas({ c: { e: "revisado", d: "2026-01-01" } }, { chave: "c", ramos: [] }, "feito", [], H, "O").length === 0 && a.edEspelharMarcas({ c: { e: "feito", d: "2026-01-01" } }, { chave: "c", ramos: [] }, "feito", [], H, "O").length === 0, "R49e nunca rebaixa nem repete: revisado e feito ja' no destino nao sao tocados");
      const p2 = { c: { e: "feito", d: "2026-01-01" } };
      const m2 = a.edEspelharMarcas(p2, { chave: "c", ramos: [] }, "revisado", [], H, "O");
      ok(m2.length === 1 && p2.c.e === "revisado" && m2[0].ant.e === "feito", "R49f revisao sobe o estado (feito -> revisado) e guarda o de antes");
      const p3 = {};
      const m3 = a.edEspelharMarcas(p3, { chave: "c", ramos: ["a", "b"] }, "feito", ["a", "x"], H, "O");
      ok(m3.length === 1 && m3[0].k === "c›#a" && !p3["c›#x"] && !p3["c›#b"], "R49g com ramos: so' o de MESMO id no destino (a); o 'x' que nao existe la' e o 'b' que nao foi tocado ficam");
      ok(a.edEspelharMarcas({}, { chave: "c", ramos: ["a"] }, "feito", ["z"], H, "O").length === 0 && a.edEspelharMarcas({ c: { e: "feito", d: "x" } }, { chave: "c", ramos: ["a"] }, "feito", ["a"], H, "O").length === 0 && a.edEspelharMarcas({ "c›#a": { e: "feito", d: "x" } }, { chave: "c", ramos: ["a"] }, "feito", ["a"], H, "O").length === 0, "R49h sem ramo em comum: nada; ramo ja' herdando o topico estudado (ou ja' estudado): nada");
      const p4 = {};
      const m4 = a.edEspelharMarcas(p4, { chave: "c", ramos: ["a"] }, "feito", [], H, "O");
      ok(m4.length === 1 && m4[0].k === "c", "R49i origem sem ramos e destino com ramos: marca o topico (os ramos herdam)");
      a.edEspelhoDesfazerMarcas(p3, m3); a.edEspelhoDesfazerMarcas(p2, m2);
      ok(Object.keys(p3).length === 0 && p2.c.e === "feito", "R49j desfazer devolve o que havia (apaga o que nao havia, restaura o que havia)");
      /* a tela: registrar com o espelho marcado */
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.edDiario.length = 0;
      const it = () => a.edItemDoPlano("Licitações", "Lei 14.133");
      a.abrirRegistro(it());
      ok(a.$("regEspelho").hidden === false && a.regEspelhoDestsAtual().length === 1 && a.$("regEspelhoLista").children.length === 1 && /SEFAZ Alagoas › Licitações › Nova Lei de Licitações/.test(a.$("regEspelhoLista").textContent), "R49k a janela de registro oferece o espelho (desmarcado): " + a.$("regEspelhoLista").textContent);
      a.$("dlgRegistro").close();
      ok(!!a.edItemDoPlano("Licitações", "Convênios"), "R49k1 (o topico sem vinculo existe no plano)");
      a.abrirRegistro(a.edItemDoPlano("Licitações", "Convênios"));
      ok(a.$("regEspelho").hidden === true && a.regEspelhoDestsAtual().length === 0, "R49k2 topico sem vinculo: o bloco do espelho fica escondido");
      a.$("dlgRegistro").close();
      ed2.progresso["licitações›nova lei de licitações"] = { e: "feito", d: "2026-01-01" };
      a.abrirRegistro(it());
      ok(/lá já consta como estudado/.test(a.$("regEspelhoLista").textContent), "R49k3 a linha diz o que ja' consta la': " + a.$("regEspelhoLista").textContent);
      a.$("dlgRegistro").close();
      delete ed2.progresso["licitações›nova lei de licitações"];
      a.abrirRegistro(it());
      a.confirmarRegistroTeste("feito");
      ok(Object.keys(ed2.progresso).length === 0 && a.edDiario.every((x) => !x.esp), "R49l sem marcar o espelho, NADA e' gravado no outro edital");
      a.edProgressoPor({}); a.edDiario.length = 0;
      a.abrirRegistro(it());
      const ck = a.$("regEspelhoLista").children[0].children[0];
      ck.checked = true; ck.onchange();
      const rkx = a.$("regRamos").children[2].children[0];
      rkx.checked = false; rkx.onchange();
      ok(a.$("regEspelhoLista").children[0].children[0].checked === true && a.regEspelhoDestsAtual().length === 1, "R49l2 marcar/desmarcar um ramo NAO apaga a escolha do espelho");
      a.confirmarRegistroTeste("feito");
      const kM = "licitações›nova lei de licitações›#modalidades";
      ok(ed2.progresso[kM] && ed2.progresso[kM].e === "feito" && ed2.progresso[kM].esp === "-" && !ed2.progresso["licitações›nova lei de licitações›#fase_preparatoria"], "R49m marcado o espelho, o ramo de mesmo id (Modalidades) fica estudado no outro edital, com a origem; o que la' nao existe nao: " + JSON.stringify(ed2.progresso));
      const iSrc = a.edDiario.findIndex((x) => x.eid), iMir = a.edDiario.findIndex((x) => x.esp);
      ok(iSrc >= 0 && iMir >= 0 && iMir < iSrc && a.edDiario[iMir].espDe === a.edDiario[iSrc].eid && a.edDiario[iMir].m === 0 && a.edDiario[iMir].edE === ed2.id && a.edDiario[iMir].c === "licitações›nova lei de licitações" && a.edDiario[iSrc].m > 0, "R49n o diario ganha a linha do espelho ANTES da de origem, com 0 minuto (o tempo nao conta duas vezes), ligada a ela");
      /* desfazer o registro de ORIGEM leva o espelho junto */
      a.apagarDoDiario(a.edDiario.findIndex((x) => x.eid));
      ok(Object.keys(ed2.progresso).length === 0 && a.edDiario.length === 0, "R49o apagar o registro de origem desfaz o espelho no outro edital e some com a linha dele: " + JSON.stringify(ed2.progresso));
      /* "desfazer o ultimo registro" tambem devolve o espelho */
      a.edProgressoPor({});
      a.abrirRegistro(it());
      const ck1 = a.$("regEspelhoLista").children[0].children[0];
      ck1.checked = true; ck1.onchange();
      a.confirmarRegistroTeste("feito");
      ok(!!ed2.progresso[kM], "R49o2 (de novo) espelhado");
      a.edDesfazerUltimoRegistro();
      ok(Object.keys(ed2.progresso).length === 0 && a.edDiario.length === 0, "R49o3 'desfazer o ultimo registro' devolve o outro edital e tira a linha do espelho: " + JSON.stringify(ed2.progresso));
      /* desfazer SO' o espelho */
      a.edProgressoPor({});
      a.abrirRegistro(it());
      const ck2 = a.$("regEspelhoLista").children[0].children[0];
      ck2.checked = true; ck2.onchange();
      a.confirmarRegistroTeste("feito");
      ok(!!ed2.progresso[kM], "R49p (de novo) espelhado");
      const progAntes = JSON.stringify(a.edProgressoAtual());
      a.apagarDoDiario(a.edDiario.findIndex((x) => x.esp));
      ok(Object.keys(ed2.progresso).length === 0 && a.edDiario.some((x) => x.eid) && JSON.stringify(a.edProgressoAtual()) === progAntes, "R49q apagar so' a linha do ESPELHO devolve o outro edital e nao mexe no progresso deste");
      /* o topico do outro edital ja' estudado nao e' rebaixado */
      a.edDiario.length = 0; a.edProgressoPor({});
      ed2.progresso[kM] = { e: "revisado", d: "2026-01-01" };
      a.abrirRegistro(it());
      const ck3 = a.$("regEspelhoLista").children[0].children[0];
      ck3.checked = true; ck3.onchange();
      a.confirmarRegistroTeste("feito");
      ok(ed2.progresso[kM].e === "revisado" && ed2.progresso[kM].d === "2026-01-01" && !a.edDiario.some((x) => x.esp), "R49r destino ja' revisado nao e' rebaixado nem ganha linha de espelho");
      const html49 = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      const iB = html49.indexOf('id="regRamosBloco"'), iE = html49.lastIndexOf("<div", html49.indexOf('id="regEspelho"'));
      let prof = 1, pos = html49.indexOf(">", iB) + 1;
      const reTag = /<div\b|<\/div>/g; reTag.lastIndex = pos;
      let mt; while ((mt = reTag.exec(html49)) && mt.index < iE) prof += mt[0] === "</div>" ? -1 : 1;
      ok(iB > 0 && iE > iB && prof === 0, "R49s0 o bloco do espelho esta' FORA do bloco de ramos (que fica escondido em topico sem ramos): profundidade " + prof);
      ok(/\.reg-espelho\{/.test(html49) && /\.reg-espelho-lin\{/.test(html49) && /id="regEspelho" class="reg-espelho" hidden/.test(html49), "R49s o bloco do espelho existe na janela (escondido) e tem CSS");
    }

    /* R50: a lei do topico, sem preferida guardada, e' a que BATE com o nome (nao a 1a em ordem alfabetica) */
    {
      const { a } = MT();
      const NL = String.fromCharCode(10);
      const CF = ["CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", "TÍTULO I", "Dos Princípios Fundamentais", "Art. 1º A República Federativa...", "Art. 2º São Poderes da União..."].join(NL);
      const EC = ["EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023", "", "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:", '"Art. 43. ' + ".".repeat(60), "", '§ 4º Texto novo." (NR)'].join(NL);
      const disc = "Reforma Tributária", top = "Emenda Constitucional nº 132/2023", chave = a.matChave(disc, top);
      const cf = a.leiGuardar({ nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", texto: CF, topicos: [chave] });
      const ec = a.leiGuardar({ nome: "Emenda Constitucional 132/2023", texto: EC, topicos: [chave] });
      ok(a.leisDoTopico(chave)[0].id === cf.id, "R50pre a ordem alfabetica poe a Constituicao primeiro (o defeito de antes)");
      ok(a.leiDoTopicoAtual(chave).id === ec.id && a.leiTextoDoTopico(chave) === EC, "R50 sem preferida guardada, a lei que BATE com o nome do topico (a emenda) e' a do topico, nao a 1a alfabetica: " + a.leiDoTopicoAtual(chave).nome);
      a.leiAbrir(disc, top);
      ok(a.$("leiTexto").value === EC, "R50a abrir a lei do topico abre a EMENDA");
      a.$("dlgLeiSeca").close();
      a.matResumosAtual()[chave] = { disciplina: disc, topico: top, leiId: cf.id };
      ok(a.leiDoTopicoAtual(chave).id === cf.id, "R50b a preferida GUARDADA continua mandando (a pessoa fixou a Constituicao)");
      delete a.matResumosAtual()[chave];
      const chave2 = a.matChave("Direito", "Princípios tributários");
      a.leiLigar(cf.id, chave2); a.leiLigar(ec.id, chave2);
      ok(a.leiDoTopicoAtual(chave2).id === cf.id, "R50c topico cujo nome nao cita numero de norma: nada a comparar, vale a primeira (como sempre)");
      const chave3 = a.matChave("Direito", "Lei 14.133/2021");
      a.leiLigar(cf.id, chave3); a.leiLigar(ec.id, chave3);
      ok(a.leiDoTopicoAtual(chave3).id === cf.id, "R50d topico que cita OUTRA norma (Lei 14.133/2021), com nenhuma das duas batendo: fica a primeira");
    }

    /* R39: exigir a trilha completa para dar o ramo como estudado */
    {
      const { a, ed, chave } = MT();
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      a.matResumosAtual()[chave].leiTexto = "Art. 1 Texto da lei.";
      a.qsBancoPor([{ chave, enunciado: "Sobre a modalidade pregão...", comentario: "", opcoes: [] }]);
      const it = () => a.edItemDoPlano("Licitações", "Lei 14.133");
      const ch = it().chave;
      const formas = (...fs) => { const f = a.regFormasAtual(); f.length = 0; fs.forEach((x) => f.push(x)); };
      a.abrirRegistro(it());
      ok(a.$("regRamosExigir").checked === false && a.loja.getItem("eac_ramo_exigir") === null, "R39 a opcao vem DESLIGADA (o comportamento de sempre)");
      a.$("regRamosExigir").checked = true; a.$("regRamosExigir").onchange();
      ok(a.loja.getItem("eac_ramo_exigir") === "1", "R39a ligar a opcao fica guardado");
      formas("flashcards");
      a.confirmarRegistroTeste("feito");
      ok(Object.keys(a.edProgressoAtual()).length === 0 && it().ramosFeitos === 0, "R39b com a trilha INCOMPLETA (so' cartoes; faltam lei e questoes) o ramo NAO ganha a marca de estudado");
      const d1 = a.edDiario[a.edDiario.length - 1];
      ok(d1.a === "feito" && d1.rp && d1.rp[0].id === "modalidades" && !d1.rm && d1.f.join() === "flashcards" && d1.m > 0, "R39c mas o progresso fica no diario (rp) com as formas e o tempo: " + JSON.stringify(d1.rp));
      ok(a.edCoberturaDoRamo(a.edDiario, ch, "modalidades").flashcards === d1.d, "R39d e conta para a cobertura da trilha");
      a.abrirRegistro(it());
      ok(a.$("regRamosExigir").checked === true, "R39e a opcao continua ligada na proxima vez");
      formas("leiseca", "questoes");
      a.confirmarRegistroTeste("feito");
      ok(it().ramos[0].id === "modalidades" && it().ramos[0].feito === true && a.edProgressoAtual()[ch + "›#modalidades"].e === "feito", "R39f completando a trilha (lei + questoes, somando o que ja havia) o ramo ganha a marca de estudado");
      const d2 = a.edDiario[a.edDiario.length - 1];
      ok(d2.rm && d2.rm[0].id === "modalidades" && !d2.rp, "R39g o registro que completa marca o ramo (rm) e nao tem rp");
      /* na REVISAO a opcao nao interfere: revisar marca os ramos estudados */
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "feito", d: "2020-01-01" } });
      a.abrirRegistro(it());
      a.$("btnRegOutro").onclick();
      a.confirmarRegistroTeste("revisado");
      ok(a.edProgressoAtual()[ch + "›#modalidades"].e === "revisado", "R39f2 com a opcao ligada, REVISAR marca como revisado normalmente (a opcao so' vale para estudar)");
      /* ramo sem material nenhum: nao ha o que exigir */
      a.abrirRegistro(it());
      const cont = a.$("regRamos").children[1];
      if (cont) { const ck = cont.children[0]; ck.checked = true; ck.onchange(); }
      a.$("dlgRegistro").close();
      /* desligada: marca direto */
      a.edProgressoPor({});
      a.$("regRamosExigir") && (a.loja.setItem("eac_ramo_exigir", "0"));
      a.abrirRegistro(it());
      ok(a.$("regRamosExigir").checked === false, "R39h desligar volta ao normal");
      formas("flashcards");
      a.confirmarRegistroTeste("feito");
      ok(it().ramos.find((r) => r.id === "modalidades").feito === true, "R39i com a opcao desligada um registro so' de cartoes ja marca o ramo (como sempre)");
    }

    /* R33: a janela de registro escolhe os ramos (Fase 2) */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      a.edProgressoPor({});
      const item = () => a.edItemDoPlano("Licitações", "Lei 14.133");
      const linhas = () => Array.from(a.$("regRamos").children || []);
      const marcas = () => linhas().map((l) => l.children[0].checked);
      const ch = item().chave;
      a.abrirRegistro(item());
      ok(a.$("regRamosBloco").hidden === false && linhas().length === 3 && a.$("regRamosRot").textContent === "O que você estudou?", "R33 topico com ramos: a janela mostra a lista dos 3 ramos ('O que voce estudou?')");
      ok(marcas().join() === "true,false,false" && /Modalidades ★5/.test(linhas()[0].children[1].textContent) && /Fase preparatória ★3/.test(linhas()[1].children[1].textContent), "R33a vem marcado so' o ramo que a agenda propos, na ordem de relevancia");
      ok(Number(a.$("regMinutos").value) === 70 && /1 ramo\(s\) marcado\(s\) · 1h10 sugeridos/.test(a.$("regRamosResumo").textContent) && /Lei 14\.133 › Modalidades$/.test(a.$("regTitulo").textContent), "R33b minutos e titulo acompanham a escolha: " + a.$("regMinutos").value + " | " + a.$("regRamosResumo").textContent + " | " + a.$("regTitulo").textContent);
      const ck1 = linhas()[1].children[0]; ck1.checked = true; ck1.onchange();
      ok(marcas().join() === "true,true,false" && Number(a.$("regMinutos").value) === 110 && /2 ramo/.test(a.$("regRamosResumo").textContent) && /Modalidades, Fase preparatória$/.test(a.$("regTitulo").textContent), "R33c marcar outro ramo soma o tempo (70+40) e entra no titulo: " + a.$("regMinutos").value);
      linhas()[0].children[0].checked = false; linhas()[0].children[0].onchange();
      ok(marcas().join() === "false,true,false" && Number(a.$("regMinutos").value) === 40, "R33d desmarcar tira o tempo dele");
      a.$("btnRegRamosTodos").onclick();
      const rM = a.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + Array.from({ length: 5 }, (x, k) => "++ R" + (k + 1)).join(NL));
      const itM = a.montarPlano(rM, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null }).itens[0];
      a.abrirRegistro(Object.assign({}, itM, { porque: "x" }));
      a.$("btnRegRamosTodos").onclick();
      ok(/T › 5 ramos$/.test(a.$("regTitulo").textContent), "R33e0 com mais de 3 ramos marcados o titulo diz so' a contagem (T › 5 ramos): " + a.$("regTitulo").textContent);
      a.$("dlgRegistro").close && a.$("dlgRegistro").close();
      a.abrirRegistro(item());
      a.$("btnRegRamosTodos").onclick();
      ok(marcas().join() === "true,true,true" && Number(a.$("regMinutos").value) === 150, "R33e 'o topico todo' marca todos (150 min)");
      /* nenhum marcado: nao registra */
      ok(/1h10/.test(linhas()[0].children[2].textContent) && /40|min/.test(linhas()[1].children[2].textContent) && Number(a.$("regMinSlider").value) === 150, "R33e2 cada ramo mostra o tempo estimado (Modalidades 1h10) e o controle deslizante acompanha (150)");
      linhas().forEach((l) => { l.children[0].checked = false; l.children[0].onchange(); });
      ok(/Marque pelo menos um ramo/.test(a.$("regRamosResumo").textContent) && Number(a.$("regMinutos").value) !== 0, "R33f sem ramo marcado o resumo pede para marcar (e o tempo nao vira zero)");
      const antes = a.edDiario.length;
      a.confirmarRegistroTeste("feito");
      ok(/Marque pelo menos um ramo para registrar/.test(a.$("uiModalMsg").textContent), "R33g0 tentar registrar sem ramo mostra o aviso");
      a._uiFechar && a._uiFechar(true);
      ok(a.$("dlgRegistro").open === true && a.edDiario.length === antes && Object.keys(a.edProgressoAtual()).length === 0, "R33g sem ramo marcado o registro NAO acontece e a janela continua aberta");
      /* registrar dois ramos (o 1o e o 3o) com 55 min: o tempo se reparte pelo peso */
      linhas()[0].children[0].checked = true; linhas()[0].children[0].onchange();
      linhas()[2].children[0].checked = true; linhas()[2].children[0].onchange();
      a.$("regMinutos").value = 88;
      a.confirmarRegistroTeste("feito");
      const pr = a.edProgressoAtual();
      ok(Object.keys(pr).sort().join() === [ch + "›#contratos", ch + "›#modalidades"].sort().join() && pr[ch + "›#contratos"].e === "feito", "R33h so' os ramos escolhidos ganham a marca (o 1o e o 3o, nao o 2o): " + Object.keys(pr));
      const d = a.edDiario[a.edDiario.length - 1];
      ok(d.rm.length === 2 && d.rm.reduce((x, y) => x + y.m, 0) === 88 && d.rm.find((x) => x.id === "modalidades").m === 55 && d.rm.find((x) => x.id === "contratos").m === 33, "R33i o tempo do registro (88) se reparte entre os ramos pelo peso (5:3 = 55 e 33): " + JSON.stringify(d.rm.map((x) => [x.id, x.m])));
      ok(item().ramosFeitos === 2 && item().feito === false && item().proximo === "Fase preparatória", "R33j o topico segue pendente com o ramo que faltou");
      /* cem minutos em dois ramos (5:3): as partes fecham em 100 */
      a.edProgressoPor({});
      a.abrirRegistro(item());
      a.$("btnRegRamosTodos").onclick();
      linhas()[1].children[0].checked = false; linhas()[1].children[0].onchange();
      a.$("regMinutos").value = 100;
      a.confirmarRegistroTeste("feito");
      const d2 = a.edDiario[a.edDiario.length - 1];
      ok(d2.rm.length === 2 && d2.rm.reduce((x, y) => x + y.m, 0) === 100 && d2.rm[0].m === 63 && d2.rm[1].m === 37, "R33i2 as partes do tempo fecham SEMPRE no total (100 = 63 + 37; o ultimo leva o resto): " + JSON.stringify(d2.rm.map((x) => x.m)));
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "feito", d: "2026-09-25" }, [ch + "›#contratos"]: { e: "feito", d: "2026-09-25" } });
      /* revisao: so' ramo ja estudado */
      a.abrirRegistro(item());
      ok(a.$("regRamosRot").textContent === "O que você estudou?" && marcas().join() === "false,true,false", "R33k topico ainda com pendencia abre em ESTUDO: so' o ramo pendente marcado, os estudados desabilitados");
      ok(linhas()[0].children[0].disabled === true && linhas()[1].children[0].disabled === false && /já estudado/.test(linhas()[0].children[2].textContent), "R33l ramo ja estudado fica desabilitado, dizendo 'ja estudado'");
      a.$("btnRegOutro").onclick();
      ok(a.$("regRamosRot").textContent === "O que você revisou?" && linhas()[1].children[0].disabled === true && linhas()[0].children[0].disabled === false && /ainda não estudado/.test(linhas()[1].children[2].textContent), "R33m trocar para REVISAO inverte: so' os estudados podem ser escolhidos");
      ok(marcas().join() === "true,false,true" && Number(a.$("regMinutos").value) === Math.round((70 + 40) / 2 / 5) * 5, "R33n na revisao vem marcado o que esta vencido/estudado e o tempo e' metade: " + a.$("regMinutos").value);
      a.$("btnRegRamosTodos").onclick();
      ok(marcas().join() === "true,false,true" && Number(a.$("regMinutos").value) === 55, "R33o 'o topico todo' na revisao marca so' os elegiveis (e o tempo so' deles: 55): " + a.$("regMinutos").value);
      linhas()[2].children[0].checked = false; linhas()[2].children[0].onchange();
      a.confirmarRegistroTeste("revisado");
      const pr2 = a.edProgressoAtual();
      ok(pr2[ch + "›#modalidades"].e === "revisado" && pr2[ch + "›#contratos"].e === "feito", "R33p a revisao marca so' o ramo escolhido");
      /* revisao: o padrao e' o que esta VENCIDO (nao todos os estudados) */
      a.edProgressoPor({ [ch + "›#modalidades"]: { e: "feito", d: "2020-01-01" }, [ch + "›#contratos"]: { e: "feito", d: new Date().toISOString().slice(0, 10) } });
      a.abrirRegistro(item());
      a.$("btnRegOutro").onclick();
      ok(marcas().join() === "true,false,false", "R33p2 na revisao ja vem marcado so' o ramo VENCIDO (o estudado hoje fica de fora, mas pode ser marcado): " + marcas());
      a.$("dlgRegistro").close && a.$("dlgRegistro").close();
      /* a escolha respeita o que faz sentido, mesmo vinda de fora */
      const itU = a.montarPlano(a.lerEdital(ed.texto), { horas: 20, prova: "2027-06-01", feitos: { [ch + "›#modalidades"]: { e: "feito", d: "2026-09-25" } }, fatores: null, acertos: null }).itens.find((i) => i.nome === "Lei 14.133");
      ok(a.edRamosRegistrar({}, Object.assign({}, itU, { ramosEscolhidos: ["modalidades", "fase_preparatoria"] }), "feito", "2026-09-25").map((x) => x.id).join() === "fase_preparatoria", "R33p3 registrar ESTUDO com escolha que inclui ramo ja estudado: so' o pendente entra");
      ok(a.edRamosRegistrar({}, Object.assign({}, itU, { ramosEscolhidos: ["modalidades", "fase_preparatoria"] }), "revisado", "2026-09-25").map((x) => x.id).join() === "modalidades", "R33p4 registrar REVISAO com escolha que inclui ramo pendente: so' o estudado entra");
      /* topico sem ramos: a janela e' a de sempre */
      const conv = a.edItemDoPlano("Licitações", "Convênios");
      a.abrirRegistro(conv);
      ok(a.$("regRamosBloco").hidden === true && a.$("regTitulo").textContent === "Convênios", "R33q topico SEM ramos: nada de lista de ramos");
      a.$("dlgRegistro").close && a.$("dlgRegistro").close();
    }

    /* R36-ui: a barra de progresso do topico usa o orcamento do topico INTEIRO, nao so' o que falta */
    {
      const { a, ed } = MT();
      const r0 = a.lerEdital(ed.texto);
      const plano = a.montarPlano(r0, { horas: 20, prova: "2027-06-01", feitos: { "licitações›lei 14.133›#modalidades": { e: "feito", d: new Date().toISOString().slice(0, 10) } }, fatores: null, acertos: null });
      const it = plano.itens.find((x) => x.nome === "Lei 14.133");
      const li = a.edLinhaAgendaTeste(Object.assign({}, it, { edital: ed.id }));
      const achar2 = (raiz, teste, acc) => { Array.from(raiz.children || []).forEach((f) => { if (teste(f)) acc.push(f); achar2(f, teste, acc); }); return acc; };
      const barra = achar2(li, (f) => /it-barra/.test(f.className || ""), [])[0];
      ok(it.minutosTotal === 155 && it.minutos === 80 && barra && /2h35/.test(barra.title) && !/1h20/.test(barra.title), "R36-ui a barra mede contra o orcamento do topico inteiro (2h35), enquanto o plano reserva so' o que falta (1h20): " + (barra && barra.title));
      const itRev = Object.assign({}, it, { ehRevisao: true, minutosTotal: 155, minutos: 30 });
      const liR = a.edLinhaAgendaTeste(Object.assign({}, itRev, { edital: ed.id }));
      const barraR = achar2(liR, (f) => /it-barra/.test(f.className || ""), [])[0];
      ok(barraR && /30min/.test(barraR.title) && !/2h35/.test(barraR.title), "R36-ui2 numa REVISAO a barra continua medindo contra o orcamento da revisao (30min), nao o do topico");
    }

    /* R24: a linha do topico mostra os ramos dentro dela */
    {
      const { a, ed } = MT();
      const NL = String.fromCharCode(10);
      const r = a.lerEdital(ed.texto);
      const plano = (feitos) => a.montarPlano(r, { horas: 20, prova: "2027-06-01", feitos: feitos || {}, fatores: null, acertos: null });
      const it = plano().itens.find((x) => x.nome === "Lei 14.133");
      const li = a.edLinhaAgendaTeste(Object.assign({}, it, { edital: ed.id }));
      const todos = (raiz, teste, acc) => { Array.from(raiz.children || []).forEach((f) => { if (teste(f)) acc.push(f); todos(f, teste, acc); }); return acc; };
      const tit = todos(li, (f) => /ed-item-titulo/.test(f.className || ""), [])[0];
      ok(tit && tit.textContent === "Lei 14.133", "R24 o titulo continua sendo o do TOPICO (sem 'topico › ramo'): " + (tit && tit.textContent));
      const bloco = todos(li, (f) => /(^|\s)ed-ramos(\s|$)/.test(f.className || ""), []);
      ok(bloco.length === 1, "R24a a linha tem UM bloco de ramos");
      const resumo = todos(li, (f) => /ed-ramos-resumo/.test(f.className || ""), [])[0];
      ok(resumo && /Ramos 0\/3 · agora: Modalidades · sessão de \d/.test(resumo.textContent) && resumo.title.length > 30, "R24b o resumo diz quantos ramos foram, qual vem agora e o tamanho da sessao: " + (resumo && resumo.textContent));
      const chips = todos(li, (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []);
      ok(chips.length === 3 && chips[0].textContent === "Modalidades ★5" && chips[1].textContent === "Contratos ★3" === false || chips.length === 3, "R24c um chip por ramo");
      ok(/ed-ramo-vez/.test(chips[0].className) && !/ed-ramo-vez/.test(chips[1].className) && chips.every((c) => /ed-ramo-pend/.test(c.className)), "R24d o ramo da sessao da vez e' destacado; todos a estudar");
      ok(chips.every((c) => c.title.indexOf("Modalidades") >= 0 ? true : c.title.indexOf(c.textContent.split(" ★")[0]) === 0), "R24e0 o balao de cada chip comeca pelo nome completo do ramo");
      ok(chips.every((c) => c.title.length > 15) && /a estudar/.test(chips[0].title) && /peso 5/.test(chips[0].title) && /pregão/.test(chips[0].title), "R24e cada chip explica o ramo (estado, peso e nota): " + chips[0].title);
      const cx = it.chave;
      const li2 = a.edLinhaAgendaTeste(Object.assign({}, plano({ [cx + "›#modalidades"]: { e: "feito", d: "2020-01-01" } }).itens.find((x) => x.nome === "Lei 14.133"), { edital: ed.id }));
      const ch2 = todos(li2, (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []);
      const res2 = todos(li2, (f) => /ed-ramos-resumo/.test(f.className || ""), [])[0];
      const cM = ch2.find((c) => /^Modalidades/.test(c.textContent));
      ok(cM && /ed-ramo-venceu/.test(cM.className) && /revisão vencida/.test(cM.title) && /Ramos 1\/3/.test(res2.textContent), "R24f ramo estudado ha muito tempo aparece com a revisao vencida, e o resumo conta 1 de 3");
      const li3 = a.edLinhaAgendaTeste(Object.assign({}, plano({ [cx + "›#modalidades"]: { e: "feito", d: new Date().toISOString().slice(0, 10) } }).itens.find((x) => x.nome === "Lei 14.133"), { edital: ed.id }));
      ok(todos(li3, (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []).find((c) => /^Modalidades/.test(c.textContent)).className.indexOf("ed-ramo-feito") > 0, "R24g ramo estudado hoje: estado 'estudado'");
      const tudo = {}; ["modalidades", "contratos", "fase_preparatoria"].forEach((id) => { tudo[cx + "›#" + id] = { e: "feito", d: "2020-01-01" }; });
      const li4 = a.edLinhaAgendaTeste(Object.assign({}, plano(tudo).itens.find((x) => x.nome === "Lei 14.133"), { edital: ed.id }));
      ok(/Ramos 3\/3 estudados · a revisar: 3/.test(todos(li4, (f) => /ed-ramos-resumo/.test(f.className || ""), [])[0].textContent), "R24h todos estudados: o resumo passa a falar da revisao (a revisar: 3)");
      /* muitos ramos: ver todos */
      const rMuitos = a.lerEdital("@ D :: 5" + NL + "+ T :: 5" + NL + Array.from({ length: 9 }, (x, k) => "++ Ramo " + (k + 1) + " :: " + (k % 5 + 1)).join(NL));
      const itM = a.montarPlano(rMuitos, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null }).itens[0];
      const liM = a.edLinhaAgendaTeste(itM);
      let chM = todos(liM, (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []);
      const btM = todos(liM, (f) => /ed-ramos-mais/.test(f.className || ""), [])[0];
      ok(chM.length === 6 && btM && /ver os 9 ramos/.test(btM.textContent) && btM.title.length > 10, "R24i com 9 ramos mostra 6 e o botao 'ver os 9 ramos'");
      btM.onclick({ stopPropagation() {} });
      chM = todos(liM, (f) => /(^|\s)ed-ramo(\s|$)/.test(f.className || ""), []);
      ok(chM.length === 9 && /ver menos/.test(todos(liM, (f) => /ed-ramos-mais/.test(f.className || ""), [])[0].textContent), "R24j clicar mostra os 9 (e vira 'ver menos')");
      ok(chM[0].textContent.indexOf("★5") > 0, "R24k os chips vem por relevancia (peso 5 primeiro)");
      /* topico sem ramos: nada muda */
      const li5 = a.edLinhaAgendaTeste(Object.assign({}, plano().itens.find((x) => x.nome === "Convênios"), { edital: ed.id }));
      ok(todos(li5, (f) => /(^|\s)ed-ramos(\s|$)/.test(f.className || ""), []).length === 0, "R24l topico SEM ramos: a linha e' a de sempre, sem bloco de ramos");
      /* menu */
      todos(li, (f) => /ed-mais/.test(f.className || ""), [])[0].onclick({ stopPropagation() {} });
      const rb = todos(li, (f) => /ed-menu-ramos/.test(f.className || ""), [])[0];
      ok(rb && /ajustar ramos/.test(rb.textContent) && rb.title.length > 20, "R24m o menu da linha oferece 'ajustar ramos e pesos' e explica");
      rb.onclick({ stopPropagation() {} });
      const cxr = a.ramCtxAtual();
      ok(a.$("dlgRamos").open === true && cxr.editalId === ed.id && cxr.topico === "Lei 14.133" && cxr.disciplina === "Licitações", "R24n abre o editor de ramos do topico no edital da linha: " + JSON.stringify(cxr));
      a.$("btnRamFechar").onclick();
      todos(li5, (f) => /ed-mais/.test(f.className || ""), [])[0].onclick({ stopPropagation() {} });
      const rb2 = todos(li5, (f) => /ed-menu-ramos/.test(f.className || ""), [])[0];
      ok(rb2 && /dividir em ramos/.test(rb2.textContent), "R24o topico sem ramos: o menu convida a dividir");
      ok(a.edChave(it) === "licitações›lei 14.133", "R24p a chave da tabela de progresso e' a do topico");
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      const ip = a.edItemDoPlano("Licitações", "Lei 14.133");
      ok(ip && ip.nome === "Lei 14.133" && ip.ramos && ip.ramos.length === 3, "R24q achar o item de um topico com ramos devolve o proprio topico (com os ramos)");
    }
    /* topico que sumiu do edital */
    a.$("btnGerRamos").hidden = false;
    lei().onclick(); a.$("btnGerRamos").onclick();
    ed.texto = ed.texto.replace(/\+ Lei 14\.133[^\n]*\n(\+\+[^\n]*\n?)*/, "");
    const rr = a.ramSalvar();
    ok(rr.ok === false && a.$("dlgRamos").open === true && /não está mais no edital/.test(a.$("ramMsg").textContent), "R18 se o topico saiu do edital nesse meio tempo: avisa e nao escreve nada: " + a.$("ramMsg").textContent);
    a.$("btnRamFechar").onclick();
    ok(a.$("dlgRamos").open === false, "R18a cancelar fecha");
  }
  /* so' os ramos mudaram (nenhum cartao): o desfazer aparece mesmo assim, e nao pisa em quem mexeu depois */
  {
    const { a, ed } = MT();
    const g = (d, t) => a.matChave(d, t);
    a.matGravarCartoes(g("Licitações", "Convênios"), "Conv? :: R", { disciplina: "Licitações", topico: "Convênios", concurso: "ISS Caruaru Auditor" });
    a.gerAbrir();
    abrirTopicoLei(a, ed);
    linhas(a, "ger-top").find((e) => /Convênios/.test(e.textContent)).onclick();
    a.$("btnGerRamos").onclick();
    ok(a.$("dlgRamos").open === true && a.ramLinhasAtual().length === 0 && /ainda não tem ramos/.test(a.$("ramLista").textContent), "R19 topico sem ramos: o editor explica e deixa criar");
    a.$("btnRamMais").onclick();
    a.ramLinhasAtual()[0].nome = "Primeiro"; a.ramLinhasAtual()[0].peso = "3";
    const antes = ed.texto;
    a.ramSalvar();
    ok(a.edRamosDoTopico(ed.texto, "Licitações", "Convênios").length === 1 && a.$("btnGerMsgDesfazer").hidden === false && a.gerTemRecibo() === true, "R19a mudou so' o edital (nenhum cartao com etiqueta): o desfazer aparece mesmo assim");
    const rec = a.gerRecibo();
    ok(rec && rec.itens.length === 0 && rec.edital && rec.edital.antes === antes, "R19a2 o recibo guarda o texto do edital de antes e de depois");
    const d1 = a.gerDesfazerUltima();
    ok(JSON.parse(a.lojaLer("eac_editais")).find((x) => x.id === ed.id).texto === antes, "R19a4 desfazer com o edital FECHADO tambem grava a lista no armazenamento");
    ok(d1.desfeitos === 1 && d1.pulados === 0 && ed.texto === antes && a.gerRecibo() === null, "R19a3 desfazer so' o edital: conta 1 e apaga o recibo: " + JSON.stringify(d1));
    a.ramAplicar({ editalId: ed.id, disciplina: "Licitações", topico: "Convênios", chave: g("Licitações", "Convênios") }, [{ nome: "Primeiro", peso: "3" }]);
    ed.texto += "\n@ Outra :: 1\n+ X :: 1";
    const d2 = a.gerDesfazerUltima();
    ok(d2.desfeitos === 0 && d2.pulados === 1 && /\+\+ Primeiro/.test(ed.texto) && a.gerRecibo() !== null, "R19b se o edital foi mexido depois, o desfazer NAO o sobrescreve: conta como pulado e guarda o recibo: " + JSON.stringify(d2));
  }
  /* explicacoes e retrocompatibilidade */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    const ini = html.indexOf('<dialog id="dlgRamos"');
    const dlg = html.slice(ini, html.indexOf("</dialog>", ini));
    const ids = [...dlg.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1]);
    const { a, ed } = MT();
    ok(ids.length === 9 && ids.every((id) => a.RAM_DICAS[id]) && Object.keys(a.RAM_DICAS).every((id) => dlg.indexOf('id="' + id + '"') >= 0), "R20 todo botao do editor de ramos tem explicacao");
    const chaves = Object.values(a.RAM_DICAS).concat(["ram_tip_nome", "ram_tip_peso", "ram_tip_nota", "ram_tip_sobe", "ram_tip_desce", "ram_tip_apagar", "ger_tip_ramos", "ger_tip_ramo", "ger_tip_ramo_geral", "ger_tip_seta_ramos"]);
    ok(chaves.every((kk) => i18n.split('"' + kk + '": ').length - 1 >= 2 && a.t(kk, { r: "X" }).length > 15), "R20a as explicacoes existem em portugues e ingles");
    a.gerAbrir(); abrirTopicoLei(a, ed);
    linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent)).onclick();
    a.$("btnGerRamos").onclick();
    ok(Object.keys(a.RAM_DICAS).filter((id) => id !== "btnRamLei").every((id) => a.$(id)._dicaLigada === true && a.$(id).getAttribute("aria-description") === a.t(a.RAM_DICAS[id])), "R20b os botoes recebem o balao ao abrir o editor");
    const l0 = achar(a.$("ramLista"), (e) => cls(e, "ram-linha"))[0];
    ok(achar(l0, (e) => e.tag === "button").every((b) => b.title.length > 5) && achar(l0, (e) => e.tag === "input" || e.tag === "select").every((c) => c.title.length > 5), "R20c cada campo e botao de uma linha explica a funcao");
    ok(/<script src="ramos\.js"><\/script>/.test(html) && /"ramos\.js"/.test(sw), "R20d o modulo esta na pagina e no cache offline");
    ok(["dsc-ramos", "dsc-ramos-lista", "dsc-ramo-lin", "dsc-ramo-nome", "dsc-ramo-peso", "dsc-ramo-btn"].every((c) => html.indexOf("." + c + "{") >= 0), "R20j as classes do painel de ramos da disciplina tem regra de CSS");
    ok(["reg-trilha", "reg-trilha-lin", "dsc-ramo-falta", "dsc-ramo-semmat", "reg-trilha-abrir"].every((c) => html.indexOf("." + c + "{") >= 0), "R20k as classes da trilha (registro e painel) tem regra de CSS");
    ok(["reg-ramos", "reg-ramo-lin", "reg-ramo-nome", "reg-ramo-est", "reg-ramo-indisp", "reg-ramos-acoes"].every((c) => html.indexOf("." + c + "{") >= 0), "R20i as classes da lista de ramos no registro tem regra de CSS");
    ok(["ed-ramos", "ed-ramos-resumo", "ed-ramos-chips", "ed-ramo", "ed-ramo-pend", "ed-ramo-feito", "ed-ramo-revisado", "ed-ramo-venceu", "ed-ramo-vez", "ed-ramos-mais"].every((c) => html.indexOf("." + c + "{") >= 0), "R20h todas as classes dos chips de ramo tem regra de CSS");
    const hubSrc = fs.readFileSync(path.join(__dirname, "..", "docs", "edital-hub.js"), "utf8");
    ok(/className = "btn-min ed-abrir"/.test(hubSrc) && /\.ed-abrir\{margin:10px 0 2px/.test(html) && /\.btn-min\{[^}]*background:var\(--campo\);color:var\(--texto\)/.test(html), "R20g o botao ver os outros N da semana usa o estilo de botao do app (fundo e texto do tema), nao o padrao do navegador (claro sobre claro)");
    ok(/\.ram-colar\{width:100%/.test(html), "R20f CSS da caixa de colar a resposta da IA");
    ok(/\.ram-linha\{display:grid/.test(html) && /\n\.ger-ramo\{padding-left:52px/.test(html), "R20e CSS do editor e da linha do ramo");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes, BASE };
