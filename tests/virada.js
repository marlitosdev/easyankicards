/* A VIRADA — o dia seguinte à prova.
 *
 * Este arquivo existe por causa de uma data concreta: 31/08/2026, a
 * manhã seguinte ao TCE-PE. Medi o que aconteceria e eram três coisas,
 * duas delas defeituosas:
 *
 *   · a agenda da semana sumia da tela, sem uma palavra de explicação;
 *   · o prazo aparecia como "−6 dias", literal;
 *   · e o plano, se aberto, jurava que o edital inteiro cabia "nesta
 *     semana", com orçamento de zero horas.
 *
 * Nenhuma delas apareceria em teste nenhum, porque nenhum teste tinha
 * chegado ao dia seguinte. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# TCE-PE Auditor | prova: 2026-08-30 | horas: 40",
  "@ Direito Financeiro :: 5",
  "+ Receita pública :: 5",
  "+ Despesa pública :: 5",
  "+ Restos a pagar :: 4",
  "@ Controle Externo :: 4",
  "+ Tribunais de contas :: 5",
  "+ Auditoria governamental :: 4",
].join("\n");

/* dias a partir de hoje, em ISO — para o teste não depender da data em
 * que ele é executado */
function emDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const comData = (iso) => EDITAL.replace("2026-08-30", iso);

  /* ---- V1: o plano de uma prova vencida para de mentir ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(comData(emDias(-6)));
    const p = api.montarPlano(r, { horas: 40, prova: emDias(-6), feitos: {} });

    ok(p.vencida === true, "V1 o plano nao percebeu que a prova ja passou");
    ok(p.diasDesde === 6,
       "V1b nao diz ha quantos dias a prova foi: " + p.diasDesde);

    /* O DEFEITO ORIGINAL: com semanas = 0, a guarda "semanas > 0 &&
     * semana > semanas" nunca disparava, ninguem ia para o "fora", e
     * todos os topicos recebiam semana 1 — um plano afirmando que o
     * edital inteiro cabe nesta semana, com orcamento de zero horas. */
    ok(p.fila.length === 0,
       "V1c " + p.fila.length + " topicos continuam agendados numa prova que ja foi");
    ok(p.fora.length === 5,
       "V1d os 5 topicos deviam estar no 'nao cabe', estao " + p.fora.length);
    ok(p.itens.every((i) => i.semana === null),
       "V1e algum topico ainda tem semana marcada: "
       + JSON.stringify(p.itens.map((i) => i.semana)));
    /* nada some: o plano continua sendo o retrato de onde a pessoa parou */
    ok(p.itens.length === 5,
       "V1f o plano perdeu topicos: " + p.itens.length);
    ok(p.total === 5, "V1g a contagem total mudou: " + p.total);
  }

  /* ---- V2: prova AMANHÃ continua sendo um plano normal ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(comData(emDias(1)));
    const p = api.montarPlano(r, { horas: 40, prova: emDias(1), feitos: {} });
    /* Semanas tambem e ZERO aqui — falta menos de uma semana. E o caso
     * que separa "acabou" de "e amanha": tratar os dois pelo mesmo
     * numero apagaria a agenda da vespera da prova, que e o pior dia
     * possivel para isso acontecer. */
    ok(p.semanas === 0,
       "V2 premissa do teste mudou: semanas devia ser 0 tambem aqui");
    ok(p.vencida === false,
       "V2b prova de amanha foi tratada como ja realizada");
    ok(p.fila.length > 0,
       "V2c a vespera da prova ficou sem nenhum topico agendado");
  }

  /* ---- V3: dias nunca aparece negativo ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    const e = api.edCriar("TCE-PE Auditor", comData(emDias(-6)));
    const s = api.edSituacao(e);

    ok(s.grupo === "encerrado", "V3 a prova vencida nao entrou como encerrada");
    /* "dias" para quem le significa "quanto falta". Para uma prova que
     * passou, o numero que importa e "ha quanto tempo" — sao duas
     * grandezas diferentes, e enquanto dividiam o mesmo campo a tela
     * imprimia "-6 dias". */
    ok(s.dias === null,
       "V3b o encerrado ainda devolve dias como numero: " + s.dias);
    ok(s.desde === 6,
       "V3c nao diz ha quantos dias a prova foi: " + s.desde);
    ok(!(s.dias < 0), "V3d voltou a existir prazo negativo");

    /* e o edital que AINDA vai acontecer continua com dias positivo */
    const e2 = api.edCriar("SEFAZ-AL", comData(emDias(90)));
    const s2 = api.edSituacao(e2);
    ok(s2.dias === 90, "V3e a prova futura perdeu a contagem: " + s2.dias);
    ok(s2.desde === undefined,
       "V3f prova futura ganhou um 'ha quantos dias'");
  }

  /* ---- V3b: dias de CALENDÁRIO, não horas decorridas ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    /* A data da prova e meia-noite; "agora" e uma hora qualquer do dia. A
     * subtracao crua dava 89,1 dias para uma prova daqui a 90, e a tela
     * mostrava 89 — contra os 90 que qualquer pessoa conta no calendario.
     * O erro crescia com o passar do dia: a partir do meio-dia o app
     * "perdia" um dia inteiro, todo dia. */
    [1, 7, 30, 90].forEach((d) => {
      const e = api.edCriar("X" + d, comData(emDias(d)));
      ok(api.edSituacao(e).dias === d,
         "V3g prova daqui a " + d + " dia(s) foi contada como "
         + api.edSituacao(e).dias);
    });
    [1, 6, 30].forEach((d) => {
      const e = api.edCriar("Y" + d, comData(emDias(-d)));
      ok(api.edSituacao(e).desde === d,
         "V3h prova de " + d + " dia(s) atras foi contada como "
         + api.edSituacao(e).desde);
    });
    /* e as semanas do plano seguem a mesma regua */
    const s14 = api.semanasAte(emDias(14));
    ok(s14.dias === 14 && s14.semanas === 2,
       "V3i 14 dias deviam dar 2 semanas cheias, deram "
       + s14.dias + " dias / " + s14.semanas + " semanas");

    /* DUAS DATAS EM TEXTO TÊM DE DAR O NÚMERO DO CALENDÁRIO.
     * Ao zerar a hora eu quebrei este caminho: "AAAA-MM-DD" e parseado
     * como meia-noite UTC, e ler getDate() dele (que e local) tira um
     * dia inteiro em qualquer fuso a oeste de Greenwich — que e o do
     * usuario. De 13 a 30 de agosto sao 17 dias em qualquer fuso. */
    const sTexto = api.semanasAte("2026-08-30", "2026-08-13");
    ok(sTexto.dias === 17,
       "V3j de 13 a 30 de agosto sao 17 dias, a conta deu " + sTexto.dias);
    const sMesmoDia = api.semanasAte("2026-08-30", "2026-08-30");
    ok(sMesmoDia.dias === 0,
       "V3k a prova no proprio dia devia dar 0 dias, deu " + sMesmoDia.dias);
    /* e no dia da prova ela ainda NAO passou */
    const pHoje = api.montarPlano(api.lerEdital(comData(emDias(0))),
      { horas: 40, prova: emDias(0), feitos: {} });
    ok(pHoje.vencida === false,
       "V3l no DIA da prova o app ja a tratou como realizada");
  }

  /* ---- V4: a agenda não some sem explicação ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    api.edCriar("TCE-PE Auditor", comData(emDias(-6)));
    api.hubPintarAgenda();

    const box = api.$("edAgendaTopo");
    /* ERA ISTO: box.hidden = true e ponto final. Na manha de 31 de
     * agosto a pessoa abriria o app e a agenda simplesmente nao estaria
     * la — sem aviso, sem "a prova foi ontem", sem oferta de abrir o
     * proximo. */
    ok(box.hidden === false,
       "V4 a agenda se escondeu de novo, sem dizer por que");

    const txt = box.textContent || "";
    ok(/prova/i.test(txt) && /passou|foi/i.test(txt),
       "V4b a tela nao diz que a prova ja foi: " + txt.slice(0, 100));
    ok(/TCE-PE/.test(txt),
       "V4c nao diz QUAL prova passou: " + txt.slice(0, 100));
    ok(/6 dia/.test(txt),
       "V4d nao diz ha quantos dias: " + txt.slice(0, 140));

    /* MARCAR O QUE CAIU VEM ANTES DE PLANEJAR O PROXIMO.
     * E a informacao mais cara que o app guarda — a unica amostra real
     * do que a banca cobra — e evapora em dias. */
    ok(/caiu/i.test(txt),
       "V4e a tela nao lembra de marcar o que caiu na prova");
    const bts = box.querySelectorAll("button");
    ok(bts.length >= 2,
       "V4f a virada tem " + bts.length + " botao(oes); esperados 2");
    const iMarcar = bts.findIndex((b) => /caiu/i.test(b.textContent || ""));
    const iNovo = bts.findIndex((b) => /pr[óo]ximo|criar/i.test(b.textContent || ""));
    ok(iMarcar >= 0, "V4g falta o botao de marcar o que caiu");
    ok(iNovo >= 0, "V4h falta o botao de criar o proximo edital");
    ok(iMarcar >= 0 && iNovo >= 0 && iMarcar < iNovo,
       "V4i 'criar o proximo' veio antes de 'marcar o que caiu' — "
       + "a ordem importa: o que caiu evapora, o proximo edital espera");
  }

  /* ---- V5: com edital ativo, nada muda ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    api.edCriar("TCE-PE Auditor", comData(emDias(-6)));
    api.edCriar("SEFAZ-AL", comData(emDias(100)));
    api.hubPintarAgenda();

    const txt = api.$("edAgendaTopo").textContent || "";
    /* A virada e para quando NAO HA MAIS NADA ativo. Com a SEFAZ na
     * lista, a agenda normal tem de aparecer — mostrar "a prova ja foi"
     * por cima de um edital em andamento seria trocar um sumico
     * silencioso por um aviso errado. */
    ok(!/A prova já foi/.test(txt),
       "V5 a virada apareceu mesmo havendo edital ativo");
    ok(api.$("edAgendaTopo").hidden === false,
       "V5b a agenda sumiu havendo edital ativo");
  }

  /* ---- V6: sem edital nenhum, a agenda continua escondida ---- */
  {
    const { api } = rodar();
    api.edCarregarLista();
    api.hubPintarAgenda();
    /* quem nunca cadastrou edital nao tem prova para ter passado: um
     * aviso de virada aqui seria falar de algo que nunca existiu */
    ok(api.$("edAgendaTopo").hidden === true,
       "V6 sem edital nenhum a agenda mostrou a virada de pagina");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
