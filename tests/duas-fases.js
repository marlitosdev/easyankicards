/* DUAS DATAS NA MESMA INSCRIÇÃO.
 *
 * A SEFAZ-AL faz a objetiva em dezembro e a discursiva em janeiro. A
 * saída errada é cadastrar dois editais: o conteúdo é o mesmo, o
 * progresso se partiria em dois, as horas seriam divididas entre duas
 * coisas que são uma só, e a segunda fase é CONDICIONAL — só acontece se
 * a pessoa passar na primeira.
 *
 * Então a unidade continua sendo o edital; o que ganha plural é a data.
 *
 * O erro caro que este arquivo existe para impedir: contar as semanas
 * até JANEIRO e espalhar o conteúdo da objetiva por elas. Isso incluiria
 * no orçamento quatro semanas que só existem se a pessoa passar, e
 * dezembro — a fase que decide tudo — receberia menos horas do que
 * precisa. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# SEFAZ-AL Auditor | prova: 2026-12-13 | horas: 20",
  "# fase 2: discursiva | prova: 2027-01-24 | horas: 25",
  "@ Direito Tributário :: 5",
  "+ Obrigação tributária :: 5 :: cai sempre !d",
  "+ Responsabilidade tributária :: 3 :: !d5",
  "+ Crédito tributário :: 4 :: só objetiva",
  "@ Legislação de Alagoas :: 4",
  "+ ICMS-AL :: 5 :: !d",
  "+ ITCD-AL :: 3",
  "@ Noções de Informática :: 1",
  "+ Planilhas :: 2",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* ---- F1: ler as duas datas ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);

    ok(r.cfg.prova === "2026-12-13",
       "F1 a data da primeira fase se perdeu: " + r.cfg.prova);
    /* A SEGUNDA LINHA "#" ANTES SOBRESCREVIA A PRIMEIRA EM SILÊNCIO.
     * Duas linhas de cabeçalho eram lidas como duas configuracoes do
     * mesmo edital, e a ultima ganhava — a data de dezembro sumia. */
    ok(!!r.cfg.fase2, "F1b a segunda fase nao foi lida");
    ok(r.cfg.fase2 && r.cfg.fase2.prova === "2027-01-24",
       "F1c a data da segunda fase saiu errada: "
       + (r.cfg.fase2 && r.cfg.fase2.prova));
    ok(r.cfg.fase2 && r.cfg.fase2.horas === 25,
       "F1d as horas da segunda fase nao foram lidas: "
       + (r.cfg.fase2 && r.cfg.fase2.horas));
    ok(r.cfg.fase2 && /discursiva/i.test(r.cfg.fase2.nome),
       "F1e a segunda fase perdeu o nome: " + (r.cfg.fase2 && r.cfg.fase2.nome));
    ok(r.cfg.horas === 20,
       "F1f as horas da primeira fase foram sobrescritas: " + r.cfg.horas);

    /* edital de UMA fase continua igual */
    const r1 = api.lerEdital("# TCE-PE | prova: 2026-08-30 | horas: 40\n@ D :: 5\n+ A :: 5");
    ok(!r1.cfg.fase2, "F1g edital de uma fase ganhou uma segunda do nada");

    /* fase 2 sem horas próprias herda as da primeira: mais provável que
     * a pessoa tenha esquecido do que que pretenda estudar zero hora */
    const r2 = api.lerEdital("# X | prova: 2026-12-13 | horas: 20\n"
      + "# fase 2 | prova: 2027-01-24\n@ D :: 5\n+ A :: 5 :: !d");
    ok(!!r2.cfg.fase2 && r2.cfg.fase2.horas === 20,
       "F1h fase 2 sem horas ficou com "
       + (r2.cfg.fase2 ? r2.cfg.fase2.horas : "nenhuma fase 2"));
  }

  /* ---- F2: o marcador por tópico ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const tops = [];
    r.disciplinas.forEach((d) => d.topicos.forEach((x) => tops.push(x)));

    const obr = tops.filter((x) => /Obrigação/.test(x.nome))[0];
    ok(obr && obr.fase2 === true, "F2 '!d' nao marcou o topico");
    /* O MOTIVO SAI LIMPO. Ele é exibido na tela, e "cai sempre !d" seria
     * sintaxe vazando para quem lê. */
    ok(obr && obr.motivo === "cai sempre",
       "F2b o marcador ficou no meio do motivo: " + (obr && obr.motivo));
    ok(obr && obr.pesoF2 === 5,
       "F2c sem peso proprio, a fase 2 devia herdar o peso 5, veio "
       + (obr && obr.pesoF2));

    const resp = tops.filter((x) => /Responsabilidade/.test(x.nome))[0];
    /* PESO PRÓPRIO NA SEGUNDA FASE: um tópico que vale 2% da objetiva
     * pode ser uma questao discursiva inteira, e herdar o peso da
     * primeira apagaria justamente essa diferenca. */
    ok(resp && resp.peso === 3,
       "F2d o peso da primeira fase mudou: " + (resp && resp.peso));
    ok(resp && resp.pesoF2 === 5,
       "F2e o peso proprio da fase 2 nao foi lido: " + (resp && resp.pesoF2));
    ok(resp && resp.motivo === "",
       "F2f o motivo devia ficar vazio: " + JSON.stringify(resp && resp.motivo));

    /* SEM MARCADOR, O TÓPICO É SÓ DA PRIMEIRA FASE — que e o caso da
     * maioria, e portanto o padrao certo. */
    const cred = tops.filter((x) => /Crédito/.test(x.nome))[0];
    ok(cred && cred.fase2 === false,
       "F2g topico sem marcador entrou na segunda fase");
    ok(cred && cred.motivo === "só objetiva",
       "F2h o motivo de um topico sem marcador foi alterado: "
       + (cred && cred.motivo));
    ok(tops.filter((x) => x.fase2).length === 3,
       "F2i deviam ser 3 topicos na segunda fase, sao "
       + tops.filter((x) => x.fase2).length);
  }

  /* ---- F3: dois orçamentos, e o prazo é o da PRÓXIMA data ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);

    const p1 = api.montarPlano(r, { hoje: "2026-09-01", feitos: {} });
    ok(p1.fase.n === 1, "F3 em setembro devia estar na 1a fase: " + p1.fase.n);
    /* O ERRO CARO: contar ate JANEIRO e espalhar a objetiva por semanas
     * que so existem se a pessoa passar. Dezembro receberia menos horas
     * do que precisa, e e a fase que decide tudo. */
    ok(p1.prazo === "2026-12-13",
       "F3b o prazo da 1a fase apontou para janeiro: " + p1.prazo);
    ok(p1.itens.length === 6,
       "F3c a 1a fase devia ter os 6 topicos, tem " + p1.itens.length);
    ok(p1.porSemana === 20 * 60,
       "F3d as horas da 1a fase sairam erradas: " + p1.porSemana);
    ok(p1.fase2N === 3,
       "F3e o plano nao conta quantos topicos voltam: " + p1.fase2N);
    ok(p1.fase.temFase2 === true, "F3f o plano da 1a fase esqueceu a 2a");

    /* passada a objetiva, a agenda troca sozinha */
    const p2 = api.montarPlano(r, { hoje: "2026-12-20", feitos: {} });
    ok(p2.fase.n === 2, "F3g em 20/12 devia estar na 2a fase: " + p2.fase.n);
    ok(p2.prazo === "2027-01-24",
       "F3h o prazo da 2a fase saiu errado: " + p2.prazo);
    ok(p2.porSemana === 25 * 60,
       "F3i as horas da 2a fase nao foram usadas: " + p2.porSemana);
    /* SÓ O QUE CAI NELA. A discursiva nao cobra o edital inteiro; manter
     * a lista da primeira encheria janeiro de assunto que nao vai cair. */
    ok(p2.itens.length === 3,
       "F3j a 2a fase devia ter 3 topicos, tem " + p2.itens.length);
    ok(!p2.itens.some((i) => /Planilhas|ITCD|Crédito/.test(i.nome)),
       "F3k topico que nao cai na discursiva entrou na agenda dela: "
       + p2.itens.map((i) => i.nome).join(", "));
    ok(p2.vencida === false,
       "F3l com a 2a fase pela frente o plano se deu por encerrado");

    /* E COM O PESO DELA. "Responsabilidade tributaria" e peso 3 na
     * objetiva e 5 na discursiva: na agenda de janeiro ela tem de subir
     * acima do que a superava em dezembro. */
    const ordem1 = p1.itens.map((i) => i.nome);
    const ordem2 = p2.itens.map((i) => i.nome);
    const iResp1 = ordem1.findIndex((x) => /Responsabilidade/.test(x));
    const iIcms1 = ordem1.findIndex((x) => /ICMS/.test(x));
    const iResp2 = ordem2.findIndex((x) => /Responsabilidade/.test(x));
    const iIcms2 = ordem2.findIndex((x) => /ICMS/.test(x));
    ok(iIcms1 < iResp1,
       "F3m premissa mudou: em dezembro o ICMS devia vir antes");
    ok(iResp2 < iIcms2,
       "F3n com peso 5 na discursiva, Responsabilidade devia subir: "
       + ordem2.join(" > "));

    /* passadas as DUAS datas, aí sim acabou */
    const p3 = api.montarPlano(r, { hoje: "2027-03-01", feitos: {} });
    ok(p3.vencida === true,
       "F3o passadas as duas datas o plano ainda se acha em andamento");
  }

  /* ---- F4: o edital de duas fases não some da agenda em dezembro ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    const e = api.edCriar("SEFAZ-AL", EDITAL);

    const sSet = api.edSituacao(e, "2026-09-01");
    ok(sSet.grupo === "proximo" && sSet.fase === 1,
       "F4 em setembro o edital devia estar ativo na 1a fase");
    ok(sSet.prova === "2026-12-13",
       "F4b a situacao aponta para a data errada: " + sSet.prova);

    /* O PONTO CRÍTICO. Sem tratar a segunda data, a SEFAZ-AL viraria
     * "encerrada" no dia 14 de dezembro — com a discursiva ainda pela
     * frente — e sumiria da agenda exatamente no mes em que ela precisa
     * aparecer todos os dias. */
    const sDez = api.edSituacao(e, "2026-12-20");
    ok(sDez.grupo !== "encerrado",
       "F4c o edital foi dado como encerrado com a 2a fase pela frente");
    ok(sDez.fase === 2, "F4d a situacao nao virou para a 2a fase: " + sDez.fase);
    ok(sDez.prova === "2027-01-24",
       "F4e a situacao nao passou a contar para janeiro: " + sDez.prova);
    ok(sDez.dias === 35, "F4f contagem ate janeiro errada: " + sDez.dias);

    /* passadas as duas, encerra */
    const sMar = api.edSituacao(e, "2027-03-01");
    ok(sMar.grupo === "encerrado",
       "F4g passadas as duas datas o edital continua ativo");
    ok(sMar.desde > 0 && sMar.dias === null,
       "F4h o encerrado saiu com prazo estranho: "
       + sMar.dias + " / " + sMar.desde);
  }

  /* ---- F5: a agenda diz em que fase se está ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    api.edCriar("SEFAZ-AL", EDITAL);
    api.hubPintarAgenda();

    const txt = api.$("edAgendaTopo").textContent || "";
    ok(api.$("edAgendaTopo").hidden === false, "F5 a agenda nao apareceu");
    /* ESTUDAR COM O CALENDÁRIO ERRADO NA CABEÇA é o erro mais caro num
     * concurso de duas datas: em dezembro revisar para janeiro, ou em
     * janeiro estudar o que so caia em dezembro. */
    const selos = api.$("edAgendaTopo").querySelectorAll(".ed-selo-fase");
    ok(selos.length > 0,
       "F5b nenhuma linha diz de que fase e: " + txt.slice(0, 120));
    ok(selos.every((x) => /1/.test(x.textContent || "")),
       "F5c hoje estamos na 1a fase e o selo diz outra coisa: "
       + selos.map((x) => x.textContent).join(","));

    /* e o topico que VOLTA em janeiro leva um sinal — nao muda a ordem,
     * muda o cuidado: um resumo que sera reusado vale ser feito melhor */
    const voltas = api.$("edAgendaTopo").querySelectorAll(".ed-selo-volta");
    ok(voltas.length > 0,
       "F5d nenhum topico da agenda avisa que volta na segunda fase");
  }

  /* ---- F6: edital de uma fase só continua sem selo nenhum ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    api.edCriar("TCE-PE", "# TCE-PE | prova: 2027-06-01 | horas: 40\n"
      + "@ D :: 5\n+ A :: 5\n+ B :: 4");
    api.hubPintarAgenda();
    /* num edital comum o selo seria ruido dizendo o obvio */
    ok(api.$("edAgendaTopo").querySelectorAll(".ed-selo-fase").length === 0,
       "F6 edital de uma fase ganhou selo de fase");
    ok(api.$("edAgendaTopo").querySelectorAll(".ed-selo-volta").length === 0,
       "F6b edital de uma fase ganhou sinal de 'volta na segunda'");
  }

  /* ---- F7: quem gera o edital precisa saber que isto existe ---- */
  {
    const { api } = rodar();
    const p = api.t("ed_prompt");
    /* RECURSO QUE A IA NÃO CONHECE É RECURSO QUE NINGUÉM USA.
     * O edital chega colado da IA. Se o prompt não ensinar a sintaxe da
     * segunda fase, ela nunca a produz — e o recurso fica esperando que
     * a pessoa descubra sozinha uma marcação que não está em lugar
     * nenhum da tela. */
    ok(/# fase 2/.test(p),
       "F7 o prompt de edital nao ensina a segunda linha de cabecalho");
    ok(/!d\b/.test(p), "F7b o prompt nao ensina o marcador !d");
    ok(/!d5/.test(p), "F7c o prompt nao ensina o peso proprio da fase 2");
    /* e avisa contra marcar tudo, que e o jeito de anular a marca */
    ok(/quase tudo/.test(p),
       "F7d o prompt nao avisa contra marcar quase todos os topicos");
  }

  /* ---- F8: o texto do edital sobrevive à ida e volta ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const volta = api.edParaTexto(r);
    const r2 = api.lerEdital(volta);
    /* O EDITAL É REESCRITO pelo app em várias operações (colar plano
     * corrigido, incluir disciplina à mão). Se a ida e volta perder a
     * segunda fase ou os marcadores, o plano de janeiro evapora numa
     * operação de rotina — e sem aviso nenhum. */
    ok(!!r2.cfg.fase2 && r2.cfg.fase2.prova === "2027-01-24",
       "F8 a ida e volta pelo texto perdeu a segunda fase: "
       + JSON.stringify(r2.cfg.fase2));
    const marcados = [];
    r2.disciplinas.forEach((d) => d.topicos.forEach((x) => {
      if (x.fase2) marcados.push(x.nome);
    }));
    ok(marcados.length === 3,
       "F8b a ida e volta perdeu marcadores: sobraram " + marcados.length
       + " de 3 (" + marcados.join(", ") + ")");
    const resp = [];
    r2.disciplinas.forEach((d) => d.topicos.forEach((x) => {
      if (/Responsabilidade/.test(x.nome)) resp.push(x);
    }));
    ok(resp[0] && resp[0].pesoF2 === 5,
       "F8c a ida e volta perdeu o peso proprio da fase 2: "
       + (resp[0] && resp[0].pesoF2));
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes, EDITAL };
