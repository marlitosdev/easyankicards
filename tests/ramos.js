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
    ok(pB.itens.length === 3 && pB.total === 3 && pB.itens.every((i) => i.ramoId === undefined && i.ramo === undefined && i.chave === i.topicoChave && i.titulo === i.nome), "R3a edital SEM ramos: um item por topico, sem campos de ramo (o plano de sempre)");
    const semLinha = (l) => JSON.stringify(l, (k, v) => (k === "linha" ? undefined : v));
    ok(semLinha(api.priorizar(A)) === semLinha(api.priorizar(B)), "R3b priorizar sem a opcao de ramos ignora os ramos (a tabela e o apagar edital continuam contando topicos)");
  }

  /* ---- R23: os ramos ENTRAM NO PLANO (G5c) ---- */
  {
    const opc = { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null };
    const A = api.lerEdital(BASE), B = api.lerEdital(BASE.split("\n").filter((l) => !/^\+\+/.test(l)).join("\n"));
    const pA = api.montarPlano(A, opc), pB = api.montarPlano(B, opc);
    const lic = pA.itens.filter((i) => i.disciplina === "Licitações e Contratos");
    ok(pA.itens.length === 5 && lic.filter((i) => i.ramoId).length === 3 && lic.filter((i) => !i.ramoId).length === 1, "R23 o topico com 3 ramos vira 3 itens; o sem ramos continua um so: " + pA.itens.map((i) => i.titulo).join(" | "));
    const ra = lic.filter((i) => i.ramoId);
    ok(ra[0].titulo === "Lei 14.133/2021 › Modalidades de licitação" && ra[0].nome === "Lei 14.133/2021" && ra[0].ramo === "Modalidades de licitação", "R23a o item do ramo tem titulo composto e continua com o NOME do topico (leis, questoes e cartoes seguem por topico)");
    ok(ra[0].topicoChave === "licitações e contratos›lei 14.133/2021" && ra[0].chave === ra[0].topicoChave + "›#modalidades_de_licitacao" && ra[1].chave !== ra[0].chave, "R23b cada ramo tem chave PROPRIA (progresso, diario e revisao por ramo)");
    const soma = ra.reduce((a, i) => a + i.bruto, 0);
    ok(Math.abs(soma - 25) < 1e-9, "R23c a massa do topico se conserva (a soma do bruto dos ramos = peso da disciplina x peso do topico): " + soma);
    const fatiaA = pA.itens.find((i) => i.disciplina === "Licitações e Contratos").fatiaDisc, fatiaB = pB.itens.find((i) => i.disciplina === "Licitações e Contratos").fatiaDisc;
    ok(fatiaA !== undefined && fatiaA === fatiaB, "R23d a fatia da disciplina na prova NAO muda com os ramos: " + fatiaA + " x " + fatiaB);
    ok(Math.abs(ra[0].bruto - 25 * 5 / 11) < 1e-9 && Math.abs(ra[1].bruto - 25 * 3 / 11) < 1e-9, "R23e o bruto de cada ramo segue o peso dele (5 e 3 de 11)");
    ok(pA.itens[0].ramoId === "modalidades_de_licitacao" && pA.itens[0].prioridade === 100 && ra[1].prioridade < ra[0].prioridade && ra[1].prioridade > 0, "R23f o ramo de peso maior sobe na fila e vira a prioridade 100: " + ra.map((i) => i.prioridade));
    ok(ra[1].brutoOrdem === ra[2].brutoOrdem && ra[0].brutoOrdem > ra[1].brutoOrdem && Math.abs(ra[0].brutoOrdem - 25 * 5 / (11 / 3)) < 1e-9, "R23g a ordem: peso do ramo dividido pela media dos irmaos (o de peso medio fica como o topico era)");
    ok(ra[0].ramoDe === 3 && ra[0].ramoPeso === 5 && ra[1].ramoPeso === 3 && ra[0].ramoNota === "pregão e concorrência" && ra[1].ramoNota === "", "R23w cada item guarda quantos irmaos tem, o peso e a nota do ramo");
    ok(ra[0].linha === A.disciplinas[0].topicos[0].ramos[0].linha && ra[2].linha === A.disciplinas[0].topicos[0].ramos[2].linha && ra[0].linha !== ra[2].linha, "R23x o item leva a linha do PROPRIO ramo no edital");
    const pFator = api.montarPlano(A, Object.assign({}, opc, { fatores: { "licitações e contratos›lei 14.133/2021": 2 } })).itens.filter((i) => i.ramoId);
    ok(pFator[0].fator === 2 && Math.abs(pFator[0].brutoOrdem - 2 * ra[0].brutoOrdem) < 1e-9 && Math.abs(pFator[0].bruto - ra[0].bruto) < 1e-9, "R23y a dificuldade do topico multiplica a ORDEM dos ramos, nunca o bruto (as duas reguas nao se misturam)");
    /* mudar o peso reordena */
    const C = api.lerEdital(BASE.replace("++ Contratos administrativos :: 3", "++ Contratos administrativos :: 5"));
    const pC = api.montarPlano(C, opc).itens.filter((i) => i.ramoId);
    ok(pC[0].ramoId === "modalidades_de_licitacao" && pC[1].ramoId === "contratos_administrativos" && pC[2].ramoId === "fase_preparatoria", "R23h subir o peso de um ramo o poe na frente dos de peso menor: " + pC.map((i) => i.ramoId));
    const D2 = api.lerEdital(BASE.replace("++ Contratos administrativos :: 3", "++ Contratos administrativos :: 1"));
    const pD = api.montarPlano(D2, opc).itens.filter((i) => i.ramoId);
    ok(pD[pD.length - 1].ramoId === "contratos_administrativos", "R23i descer o peso o manda para o fim");
    /* progresso */
    const chTop = ra[0].topicoChave;
    const fT = api.montarPlano(A, Object.assign({}, opc, { feitos: { [chTop]: "feito" } })).itens.filter((i) => i.ramoId);
    ok(fT.length === 3 && fT.every((i) => i.feito), "R23j topico ja dado como feito antes dos ramos: todos os ramos herdam a marca");
    const fR = api.montarPlano(A, Object.assign({}, opc, { feitos: { [ra[0].chave]: "feito" } })).itens.filter((i) => i.ramoId);
    ok(fR[0].feito === true && fR[1].feito === false && fR[2].feito === false, "R23k marcar UM ramo como feito nao marca os irmaos");
    const fR2 = api.montarPlano(A, Object.assign({}, opc, { feitos: { [ra[0].chave]: { e: "revisado", d: "2026-01-01" } } })).itens.find((i) => i.ramoId === "modalidades_de_licitacao");
    ok(fR2.revisado === true && fR2.quando === "2026-01-01", "R23l o ramo guarda o proprio estado e data");
    /* a agenda */
    ok(pA.fila.every((i) => i.titulo) && pA.fila.filter((i) => i.ramoId).length === 3, "R23m os ramos entram na fila/agenda como itens");
    /* pesos: quantidades so valem se todos trouxerem */
    const q = (txt) => api.lerEdital("@ D :: 5\n+ T :: 5\n" + txt).disciplinas[0].topicos[0].ramos;
    ok(api.edPesosDosRamos(q("++ A :: 12q\n++ B :: 8q")).join() === "12,8", "R23n quantidades em todos os ramos: o peso e a quantidade");
    ok(api.edPesosDosRamos(q("++ A :: 12q\n++ B :: 4")).join() === "3,4", "R23o quantidade misturada com estrela: vale a estrela (escalas nao se misturam)");
    ok(api.edPesosDosRamos(q("++ A\n++ B :: 5")).join() === "3,5" && api.edPesosDosRamos([]).length === 0 && api.edPesosDosRamos(null).length === 0, "R23p sem peso = 3 (igual aos irmaos); lista vazia/nula nao quebra");
    /* topicos, nao itens */
    ok(api.edTopicosPendentes(pA.itens).length === 3 && api.edTopicosPendentes(pA.itens).filter((x) => x.nome === "Lei 14.133/2021").length === 1, "R23q os pendentes por TOPICO contam o topico com ramos uma vez so");
    const pTudo = api.montarPlano(A, Object.assign({}, opc, { feitos: { [ra[0].chave]: "feito", [ra[1].chave]: "feito", [ra[2].chave]: "feito" } }));
    ok(!api.edTopicosPendentes(pTudo.itens).some((x) => x.nome === "Lei 14.133/2021") && api.edTopicosPendentes(pTudo.itens).length === 2, "R23q2 com todos os ramos feitos o topico sai dos pendentes");
    const pF = api.montarPlano(A, Object.assign({}, opc, { feitos: { [ra[0].chave]: "feito", [ra[1].chave]: "feito" } }));
    ok(api.edTopicosPendentes(pF.itens).some((x) => x.nome === "Lei 14.133/2021"), "R23r o topico segue pendente enquanto faltar um ramo");
    ok(api.edAcharItemDoTopico(pA.itens, ra[0].topicoChave) === ra[0] && api.edAcharItemDoTopico(pA.itens, ra[1].chave) === ra[1] && api.edAcharItemDoTopico(pA.itens, "nao›existe") === null && api.edAcharItemDoTopico(null, "x") === null, "R23s achar o item pelo topico da o primeiro ramo; pela chave do ramo, o proprio");
    ok(api.edAcharItemDoTopico(pB.itens, pB.itens[0].chave) === pB.itens[0], "R23t sem ramos, achar pelo topico da o proprio item");
    /* painel por disciplina: conta topicos, nao ramos */
    const disc = api.plPorDisciplina(pA, A).find((x) => x.disciplina === "Licitações e Contratos");
    ok(disc.topicos === 2 && disc.pendentes === 2, "R23u o painel por disciplina conta 2 topicos (nao 4 itens): " + disc.topicos + "/" + disc.pendentes);
    /* a segunda fase carrega a divisao */
    const F2 = api.lerEdital("# X | prova: 2027-06-01 | horas: 20\n# fase 2: discursiva | prova: 2027-09-01 | horas: 10\n@ D :: 5\n+ T :: 5 :: motivo !d\n++ A :: 5\n++ B :: 1\n+ U :: 5");
    const p2 = api.montarPlano(F2, { horas: 10, prova: "2027-09-01", fase: 2, feitos: {}, fatores: null, acertos: null });
    ok(Math.abs(p2.itens[0].bruto + p2.itens[1].bruto - 25) < 1e-9 && Math.abs(p2.itens[0].bruto - 25 * 5 / 6) < 1e-9 && p2.itens[1].prioridade === 20, "R23v2 na 2a fase o peso do topico tambem se reparte (25 = 20,83 + 4,17) e a prioridade segue a razao dos pesos: " + JSON.stringify(p2.itens.map((i) => [i.bruto, i.prioridade])));
    const F3 = api.lerEdital("# X | prova: 2027-06-01 | horas: 20\n# fase 2: discursiva | prova: 2027-09-01 | horas: 10\n@ D :: 5\n+ T :: 5 :: motivo !d\n++ A :: 5\n++ B :: 1\n+ V :: 5 :: motivo !d");
    const p3 = api.montarPlano(F3, { horas: 10, prova: "2027-09-01", fase: 2, feitos: {}, fatores: null, acertos: null });
    const pv = p3.itens.find((i) => i.nome === "V");
    ok(pv && pv.prioridade === 60 && p3.itens.find((i) => i.ramoId === "a").prioridade === 100, "R23v3 na 2a fase o ramo de peso alto passa o topico sem ramos (ordem = peso / media, na mesma regua): " + JSON.stringify(p3.itens.map((i) => [i.titulo, i.prioridade])));
    ok(p2.itens.length === 2 && p2.itens[0].ramoId === "a" && p2.itens[0].prioridade === 100 && p2.itens[1].prioridade < 100 && p2.itens.every((i) => i.topicoChave === "d›t"), "R23v na 2a fase o topico tambem se divide em ramos, na mesma ordem de peso: " + JSON.stringify(p2.itens.map((i) => [i.ramoId, i.prioridade])));
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

    /* R24: o plano mostra e ajusta os ramos */
    {
      const { a, ed } = MT();
      const r = a.lerEdital(ed.texto);
      const pl = a.montarPlano(r, { horas: 20, prova: "2027-06-01", feitos: {}, fatores: null, acertos: null });
      const it = pl.itens.find((x) => x.ramoId === "modalidades");
      const li = a.edLinhaAgendaTeste(Object.assign({}, it, { edital: ed.id }));
      const todos = (raiz, teste, acc) => { Array.from(raiz.children || []).forEach((f) => { if (teste(f)) acc.push(f); todos(f, teste, acc); }); return acc; };
      const tit = todos(li, (f) => /ed-item-titulo/.test(f.className || ""), [])[0];
      ok(tit && tit.textContent === "Lei 14.133 › Modalidades" && /Ramo Modalidades de 3/.test(tit.title) && /peso 5/.test(tit.title) && /pregão/.test(tit.title), "R24 a linha da agenda mostra 'Topico › Ramo' e explica o ramo (peso e nota) no balao: " + (tit && tit.textContent) + " | " + (tit && tit.title));
      const mais = todos(li, (f) => /ed-mais/.test(f.className || ""), [])[0];
      mais.onclick({ stopPropagation() {} });
      const rb = todos(li, (f) => /ed-menu-ramos/.test(f.className || ""), [])[0];
      ok(rb && /ajustar ramos/.test(rb.textContent) && rb.title.length > 20, "R24a o menu da linha oferece 'ajustar ramos e pesos' e explica");
      rb.onclick({ stopPropagation() {} });
      const cx = a.ramCtxAtual();
      ok(a.$("dlgRamos").open === true && cx.editalId === ed.id && cx.topico === "Lei 14.133" && cx.disciplina === "Licitações", "R24b abre o editor de ramos do TOPICO (nao do titulo composto) no edital da linha: " + JSON.stringify(cx));
      a.$("btnRamFechar").onclick();
      const li2 = a.edLinhaAgendaTeste(Object.assign({}, pl.itens.find((x) => x.nome === "Convênios"), { edital: ed.id }));
      const tit2 = todos(li2, (f) => /ed-item-titulo/.test(f.className || ""), [])[0];
      todos(li2, (f) => /ed-mais/.test(f.className || ""), [])[0].onclick({ stopPropagation() {} });
      const rb2 = todos(li2, (f) => /ed-menu-ramos/.test(f.className || ""), [])[0];
      ok(tit2.textContent === "Convênios" && !tit2.title && rb2 && /dividir em ramos/.test(rb2.textContent), "R24c topico SEM ramos: titulo simples, sem balao de ramo, e o menu convida a dividir");
      ok(a.edChave(it) === it.chave && a.edChave(it) !== a.edChave(pl.itens.find((x) => x.ramoId === "contratos")) && a.edChave(pl.itens.find((x) => x.nome === "Convênios")) === "licitações›convênios", "R24d a chave do ramo na tabela de progresso e' propria; a do topico sem ramos, a de sempre");
      a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
      const ip = a.edItemDoPlano("Licitações", "Lei 14.133");
      ok(ip && ip.nome === "Lei 14.133" && ip.ramoId, "R24e achar o item de um topico com ramos devolve o primeiro ramo dele (as telas de material/lei/questao seguem funcionando)");
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
    ok(ids.length === 7 && ids.every((id) => a.RAM_DICAS[id]) && Object.keys(a.RAM_DICAS).every((id) => dlg.indexOf('id="' + id + '"') >= 0), "R20 todo botao do editor de ramos tem explicacao");
    const chaves = Object.values(a.RAM_DICAS).concat(["ram_tip_nome", "ram_tip_peso", "ram_tip_nota", "ram_tip_sobe", "ram_tip_desce", "ram_tip_apagar", "ger_tip_ramos", "ger_tip_ramo", "ger_tip_ramo_geral", "ger_tip_seta_ramos"]);
    ok(chaves.every((kk) => i18n.split('"' + kk + '": ').length - 1 >= 2 && a.t(kk, { r: "X" }).length > 15), "R20a as explicacoes existem em portugues e ingles");
    a.gerAbrir(); abrirTopicoLei(a, ed);
    linhas(a, "ger-top").find((e) => /Lei 14\.133/.test(e.textContent)).onclick();
    a.$("btnGerRamos").onclick();
    ok(Object.keys(a.RAM_DICAS).filter((id) => id !== "btnRamLei").every((id) => a.$(id)._dicaLigada === true && a.$(id).getAttribute("aria-description") === a.t(a.RAM_DICAS[id])), "R20b os botoes recebem o balao ao abrir o editor");
    const l0 = achar(a.$("ramLista"), (e) => cls(e, "ram-linha"))[0];
    ok(achar(l0, (e) => e.tag === "button").every((b) => b.title.length > 5) && achar(l0, (e) => e.tag === "input" || e.tag === "select").every((c) => c.title.length > 5), "R20c cada campo e botao de uma linha explica a funcao");
    ok(/<script src="ramos\.js"><\/script>/.test(html) && /"ramos\.js"/.test(sw), "R20d o modulo esta na pagina e no cache offline");
    ok(/\.ram-colar\{width:100%/.test(html), "R20f CSS da caixa de colar a resposta da IA");
    ok(/\.ram-linha\{display:grid/.test(html) && /\n\.ger-ramo\{padding-left:52px/.test(html), "R20e CSS do editor e da linha do ramo");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes, BASE };
