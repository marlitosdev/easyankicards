/* (19.101.0) A VIRADA PARA O EDITAL DEFINITIVO, COM APOIO DE IA
 *
 *   VI1  o pedido da virada usa as regras de hoje (blocos, questões, ramos) e pede os nomes do previsto e o de-para;
 *        o previsto vai sem o cabeçalho
 *   VI2  "copiado" só quando copiou; falhou, avisa
 *   VI3  o de-para é lido ("= D :: T => D :: T", com ";" para dividido) e sai do texto aplicado
 *   VI4  o cabeçalho é o seu: nome e horas ficam, a data vem do publicado, "previsto:" sai; sem data, "previsto:" fica
 *   VI5  um tópico que saiu aparece UMA vez, com tudo o que tem; material de OUTRO concurso não entra
 *   VI6  o destino vem sugerido pela IA (ou pelo nome parecido), marcado; escolher à mão tira a marca e vale
 *   VI7  aplicar leva o tópico inteiro: resumo, estudo, leis, julgados, questões e vínculos de citação
 *   VI8  o carimbo de pré-edital só pega os registros deste concurso
 *   VI9  (19.102.0) a virada guarda um recibo, e o ⋯ do topo oferece desfazer
 *   VI10 desfazer devolve tudo: texto, resumo, lei, citação e o carimbo; avisa se o plano mudou depois
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const ano = new Date().getFullYear() + 1;
  const { api, janela } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar(); api.leiIniciar && api.leiIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  api.diarioPor([]);
  const PRE = ["# ISS Recife | previsto: " + ano + "-03.." + ano + "-06 | horas: 15",
    "@ Direito Tributário :: 5 :: confirmada", "+ ISS :: 5", "+ Obrigação tributária :: 4",
    "@ Contabilidade :: 4 :: provável", "+ PCASP :: 4", "+ Mineração de dados :: 2"].join("\n");
  const e = api.edCriar("ISS Recife — Auditor", PRE);
  const outro = api.edCriar("TCE-PE", "# TCE-PE | prova: " + ano + "-09-10 | horas: 20\n@ Controle :: 5\n+ Auditoria :: 5");
  api.hubAbrirEdital(e.id);
  api.vrIniciar();

  /* ---- VI1 / VI2 ---- */
  const pr = api.vrPrompt(PRE);
  ok(/PESO DA DISCIPLINA EM QUESTÕES/.test(pr) && /BLOCOS COM NOTA MÍNIMA/.test(pr) && /OS NOMES DO PREVISTO VALEM/.test(pr) && /= Disciplina do previsto :: Tópico do previsto => Disciplina publicada :: Tópico publicado/.test(pr)
    && /\+ Mineração de dados :: 2/.test(pr) && !/previsto: \d{4}/.test(pr) && !/horas: 15/.test(pr),
    "VI1 o pedido tem as regras de hoje, os nomes, o de-para e o previsto sem cabeçalho");
  janela.__area = "";
  const r1 = await api.vrGerarPrompt();
  ok(r1 === true && /OS NOMES DO PREVISTO VALEM/.test(janela.__area || ""), "VI2 copiou o pedido novo");
  const wt = janela.navigator.clipboard.writeText;
  janela.navigator.clipboard.writeText = async () => { throw new Error("negado"); };
  const r2 = api.vrGerarPrompt();
  await new Promise((r) => setImmediate(r));
  api.uiModalResponder(true);
  ok(await r2 === false, "VI2b a cópia falhou: avisa e não diz 'copiado'");
  janela.navigator.clipboard.writeText = wt;

  /* ---- coisas no tópico que vai sair ("Mineração de dados" → "Mineração de dados e big data") e no que muda de nome ("PCASP") ---- */
  const chMin = api.matChave("Contabilidade", "Mineração de dados");
  api.matGravar(chMin, "Resumo de mineração.", { disciplina: "Contabilidade", topico: "Mineração de dados" });
  const chPC = api.matChave("Contabilidade", "PCASP");
  api.matGravar(chPC, "Resumo do PCASP.", { disciplina: "Contabilidade", topico: "PCASP" });
  api.leiGuardar({ id: "l4320", nome: "Lei 4.320/1964", texto: "Art. 1º Um.", topicos: [chPC] });
  api.citVinculoSalvar({ trecho: "art. 1º", leiId: "l4320", artigos: [{ num: "1", numCru: "1" }], chave: chPC });
  /* material de OUTRO concurso, que não é órfão desta virada */
  api.matGravar(api.matChave("Controle", "Auditoria"), "Do TCE.", { disciplina: "Controle", topico: "Auditoria" });
  api.diarioPor([
    { d: "2026-10-01", c: chPC, disc: "Contabilidade", n: "PCASP", a: "feito", m: 60, cc: "ISS Recife" },
    { d: "2026-10-02", c: "x", disc: "Controle", n: "Auditoria", a: "feito", m: 90, cc: "TCE-PE" },
    { d: "2026-10-03", c: chMin, disc: "Contabilidade", n: "Mineração de dados", a: "feito", m: 30 },
    { d: "2026-10-04", c: "y", disc: "Português", n: "Crase", a: "feito", m: 20 },
  ]);
  api.edProgresso[chMin] = { e: "feito", d: "2026-10-03" };

  /* ---- a resposta da IA ---- */
  const POS = ["# ISS Recife — Auditor Fiscal | prova: " + ano + "-04-20 | horas: 12",
    "# discursiva | pontos: 30",
    "@ Direito Tributário :: 20q", "+ ISS :: 5", "+ Obrigação tributária :: 4",
    "@ Contabilidade Aplicada ao Setor Público :: 10q", "+ Plano de Contas Aplicado ao Setor Público :: 4", "+ Mineração de dados e big data :: 2",
    "= Contabilidade :: PCASP => Contabilidade Aplicada ao Setor Público :: Plano de Contas Aplicado ao Setor Público"].join("\n");

  /* VI3 */
  const dp = api.preDePara(POS + "\n= A :: B => C :: D ; C :: E");
  ok(dp.length === 3 && dp[0].para.topico === "Plano de Contas Aplicado ao Setor Público" && dp[2].para.topico === "E", "VI3 o de-para é lido, com ';' para dividido");
  /* VI4 */
  const fin = api.preCabecalhoVirada(PRE, POS);
  ok(/^# ISS Recife \| prova: \d{4}-04-20 \| horas: 15\n/.test(fin) && /# discursiva \| pontos: 30/.test(fin) && !/previsto:/.test(fin) && !/^= /m.test(fin) && !/Auditor Fiscal/.test(fin),
    "VI4 o cabeçalho é o seu (nome e horas), com a data do publicado; o de-para sai: " + fin.split("\n")[0]);
  const semData = api.preCabecalhoVirada(PRE, POS.replace(/ \| prova: [^|]+/, ""));
  ok(/^# ISS Recife \| previsto: /.test(semData), "VI4b sem data no publicado, o 'previsto:' fica: " + semData.split("\n")[0]);

  /* VI5 / VI6 */
  api.vrAbrir();
  api.$("vrTexto").value = POS;
  const c = api.vrConferir();
  const orf = api.vrOrfaosAtuais();
  const pc = orf.find((o) => o.topico === "PCASP"), mi = orf.find((o) => o.topico === "Mineração de dados");
  ok(orf.length === 2 && pc && mi && !orf.some((o) => o.topico === "Auditoria"), "VI5 um por tópico que saiu, e o material do TCE não entra: " + orf.map((o) => o.topico).join(", "));
  ok(pc.tem.material && pc.tem.leis === 1 && pc.tem.cit === 1 && mi.tem.estudo && mi.tem.material, "VI5b cada um diz o que tem: " + JSON.stringify(pc.tem));
  ok(pc.sugestao === "ia" && pc.destino && pc.destino.topico === "Plano de Contas Aplicado ao Setor Público" && /sugestão da IA/.test(api.$("vrOrfSug_" + orf.indexOf(pc)).textContent),
    "VI6 o destino do PCASP vem da IA, marcado");
  ok(mi.sugestao === "nome" && mi.destino && mi.destino.topico === "Mineração de dados e big data", "VI6b sem de-para, sugere pelo nome parecido: " + JSON.stringify(mi.destino));
  ok(/↪ A IA indicou 1/.test(api.$("vrAviso").textContent || "") || (c.depara && c.depara.length === 1), "VI6c o resumo diz quantos a IA indicou");
  const kMi = orf.indexOf(mi);
  api.$("vrOrfSel_" + kMi).value = ""; api.$("vrOrfSel_" + kMi).onchange();
  ok(mi.tocado && !mi.destino && api.$("vrOrfSug_" + kMi).hidden === true, "VI6d escolher à mão ('deixar como está') tira a sugestão");
  api.vrConferir();
  ok(!api.vrOrfaosAtuais().find((o) => o.topico === "Mineração de dados").destino, "VI6e e a escolha sobrevive à nova conferência");

  /* VI7 / VI8: aplicar */
  const ap = api.vrAplicar();
  api.uiModalResponder(true);
  await new Promise((r) => setImmediate(r));
  api.uiModalResponder(true);
  await new Promise((r) => setImmediate(r));
  api.uiModalResponder && api.uiModalResponder(true);
  await ap;
  const chNovo = api.matChave("Contabilidade Aplicada ao Setor Público", "Plano de Contas Aplicado ao Setor Público");
  const mat = api.matResumosAtual();
  ok(mat[chNovo] && /Resumo do PCASP/.test(mat[chNovo].texto) && !mat[chPC], "VI7 o resumo foi para o tópico novo");
  ok(api.leisDoTopico(chNovo).some((l) => l.id === "l4320") && !api.leisDoTopico(chPC).length, "VI7b a lei foi junto");
  ok(api.citVinculosLer().some((v) => v.chave === chNovo && v.k.indexOf(chNovo + "|") === 0), "VI7c o vínculo de citação foi junto");
  ok(mat[chMin] && /mineração/.test(mat[chMin].texto), "VI7d o que ficou 'como está' não foi mexido");
  const txt = api.$("editalTexto").value;
  ok(/^# ISS Recife \| prova: \d{4}-04-20 \| horas: 15/.test(txt) && !/^= /m.test(txt) && api.vrEhPrevisto() === false, "VI7e o texto aplicado tem o seu cabeçalho e não tem o de-para");
  const di = api.diarioAtual();
  ok(di[0].fase === "pre" && di[1].fase !== "pre" && di[2].fase === "pre" && di[3].fase !== "pre",
    "VI8 o carimbo pegou só o ISS (pelo nome e pelo tópico), não o TCE nem o tópico de fora: " + di.map((x) => x.fase || "-").join(","));
  /* VI9 / VI10: desfazer a virada por inteiro */
  const rec = api.vrReciboDe(e.id);
  ok(rec && rec.mat.length === 1 && rec.leis.length === 1 && rec.cit.length === 1 && rec.diario === 2 && rec.textoAntes === PRE,
    "VI9 a virada guardou o recibo (material, lei, citação, carimbo e o texto de antes)");
  ok(/Desfazer a virada/.test(api.t("vr_pronto_desfazer", { n: 30 })), "VI9b o aviso do fim da virada diz como desfazer");
  const itens = api.hubTopoMenuItens();
  const itD = itens.find((x) => x.id === "btnEdDesfazerVirada");
  ok(itD && /↶ Desfazer a virada de \d{2}\/\d{2}\/\d{4}/.test(itD.rot), "VI9c o ⋯ do topo oferece desfazer: " + (itD && itD.rot));
  api.$("editalTexto").value = api.$("editalTexto").value + "\n+ Um tópico novo :: 3";
  const perguntas = [];
  ok(await api.vrDesfazer(async (m) => { perguntas.push(m); return false; }) === false && /mudado depois da virada/.test(perguntas[0]) && api.vrReciboDe(e.id),
    "VI10 com o plano mudado depois, o desfazer avisa — e 'não' não desfaz");
  const dz = api.vrDesfazer(async () => true);
  await new Promise((r) => setImmediate(r));
  api.uiModalResponder(true);
  ok(await dz === true, "VI10b desfez");
  const mat2 = api.matResumosAtual();
  ok(mat2[chPC] && /Resumo do PCASP/.test(mat2[chPC].texto) && !mat2[chNovo], "VI10c o resumo voltou ao PCASP (e o tópico novo, que não existia, sumiu)");
  ok(api.leisDoTopico(chPC).some((l) => l.id === "l4320") && !api.leisDoTopico(chNovo).length, "VI10d a lei voltou");
  ok(api.citVinculosLer().some((v) => v.chave === chPC && v.k.indexOf(chPC + "|") === 0), "VI10e o vínculo de citação voltou");
  const di2 = api.diarioAtual();
  ok(di2.every((x) => !x.fase && !x.faseVirada), "VI10f o carimbo saiu do diário");
  ok(api.$("editalTexto").value === PRE && api.vrEhPrevisto() === true && !api.vrReciboDe(e.id) && !api.hubTopoMenuItens().some((x) => x.id === "btnEdDesfazerVirada"),
    "VI10g o plano voltou a ser o previsto e o recibo foi usado");
  api.edApagar(e.id); api.edApagar(outro.id); api.diarioPor([]);
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
