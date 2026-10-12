/* O SEU JULGAMENTO ENTRA NA FILA — E SÓ NA FILA.
 *
 * O plano media a prova e ignorava você: a prioridade de um tópico era a
 * mesma no primeiro dia e depois de você errar 70% das questões dele.
 * Agora três níveis (inseguro 1,5 · em evolução 1,0 · domino 0,7)
 * multiplicam o peso do edital e mudam a ordem.
 *
 * A ARMADILHA QUE ISTO PODIA CRIAR, e que estes testes existem para
 * fechar: se a dificuldade entrasse no "bruto" — o número com que o app
 * mede a fatia da prova, a cobertura do edital e o cumprimento dos
 * mínimos por bloco —, marcar um tópico como difícil AUMENTARIA o peso
 * dele no edital, e a sua cobertura CAIRIA sem você ter desestudado
 * nada. O painel de eliminação passaria a reagir ao seu humor.
 *
 * A prova não fica mais difícil porque você achou que ela é. Então são
 * dois números: "bruto" mede a prova, "brutoOrdem" decide o que vem
 * primeiro — e os testes daqui afirmam que o primeiro não se move.
 *
 * As outras duas: avaliação de março não pode comandar a agenda de
 * novembro (vence em 45 dias), e um palpite tirado de uma tarde ruim não
 * pode apagar o que você declarou. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# X | prova: 2027-06-01 | horas: 12",
  "@ Direito Financeiro :: 5",
  "+ Receita :: 5", "+ Despesa :: 5", "+ Restos a pagar :: 3",
  "@ Português :: 2",
  "+ Crase :: 5", "+ Regência :: 3",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const texto = () => EDITAL.replace("2027-06-01", daqui(300));
  const plano = (api, fatores) => api.montarPlano(api.lerEdital(texto()),
    { horas: 12, prova: daqui(300), fatores: fatores || {} });

  /* ================================================================
   * G1: A MEDIDA DA PROVA NÃO SE MEXE
   * ============================================================== */
  {
    const { api } = rodar();
    const semD = plano(api, {});
    const comD = plano(api, { "direito financeiro›receita": 1.5 });

    const de = (p, nome) => p.itens.filter((i) => i.nome === nome)[0];
    ok(de(semD, "Receita").bruto === 25 && de(comD, "Receita").bruto === 25,
       "G1 a dificuldade entrou no peso do edital: "
       + de(comD, "Receita").bruto);
    /* A FATIA DA PROVA é o número que responde "quanto isto vale".
     * Achar um tópico difícil não muda quanto ele vale. */
    ok(JSON.stringify(semD.fatia) === JSON.stringify(comD.fatia),
       "G1b a fatia da prova mudou por causa da sua avaliacao:\n"
       + JSON.stringify(semD.fatia) + "\n" + JSON.stringify(comD.fatia));
    /* E A COBERTURA. Este é o pior caso possível: você marca um tópico
     * como difícil e o painel de eliminação passa a dizer que você
     * cobriu menos do edital — sem ter desestudado uma linha. */
    ok(JSON.stringify(semD.peso) === JSON.stringify(comD.peso),
       "G1c a cobertura do edital mudou por causa da sua avaliacao:\n"
       + JSON.stringify(semD.peso) + "\n" + JSON.stringify(comD.peso));
    ok(semD.peso.total === comD.peso.total,
       "G1d o peso total do edital mudou: " + semD.peso.total
       + " -> " + comD.peso.total);
  }

  /* ---- G2: mas a ORDEM muda ---- */
  {
    const { api } = rodar();
    /* Regência vale 6 (2×3) e Receita vale 25: sem opinião, Receita vem
     * muito antes. Mesmo assim, o fator não pode ser tão forte que
     * inverta tudo — ele reordena DENTRO da razoabilidade. */
    const semD = plano(api, {});
    const comD = plano(api, { "direito financeiro›restos a pagar": 1.5,
                              "direito financeiro›despesa": 0.7 });
    const pos = (p, nome) => p.fila.map((i) => i.nome).indexOf(nome);
    ok(pos(semD, "Restos a pagar") > pos(semD, "Despesa"),
       "G2-pre o ponto de partida ja estava invertido");
    ok(pos(comD, "Restos a pagar") < pos(comD, "Despesa"),
       "G2 marcar um como inseguro e outro como dominado nao trocou a ordem: "
       + comD.fila.map((i) => i.nome).join(" > "));

    /* e os minutos acompanham: um tópico inseguro merece uma sessão
     * maior, e é isso que a faixa faz */
    const rp = comD.itens.filter((i) => i.nome === "Restos a pagar")[0];
    const rpSem = semD.itens.filter((i) => i.nome === "Restos a pagar")[0];
    ok(rp.minutos >= rpSem.minutos,
       "G2b o topico inseguro nao ganhou tempo: " + rpSem.minutos
       + " -> " + rp.minutos);
    ok(rp.brutoOrdem === 15 * 1.5,
       "G2c o brutoOrdem nao e peso x fator: " + rp.brutoOrdem);
    /* A PRIORIDADE NUNCA PASSA DE 100. Ela é uma razão contra o maior da
     * lista; se o numerador levasse o fator e o denominador não, um
     * tópico difícil apareceria com 130%. */
    comD.itens.forEach((i) => {
      ok(i.prioridade <= 100,
         "G2d prioridade acima de 100 em " + i.nome + ": " + i.prioridade);
    });
  }

  /* ---- G3: quem não opina não vê nada mudar ---- */
  {
    const { api } = rodar();
    const a = plano(api, {});
    const b = plano(api, { "direito financeiro›receita": 1.0 });
    ok(a.fila.map((i) => i.nome).join() === b.fila.map((i) => i.nome).join(),
       "G3 'em evolucao' mexeu na ordem — ele e o padrao e deve ser neutro");
    /* fator inválido não pode virar zero e sumir com o tópico */
    const c = plano(api, { "direito financeiro›receita": 0 });
    const d = plano(api, { "direito financeiro›receita": "abacaxi" });
    ok(c.itens.filter((i) => i.nome === "Receita")[0].fator === 1,
       "G3b fator zero nao foi recusado — o topico ia para o fim da fila");
    ok(d.itens.filter((i) => i.nome === "Receita")[0].fator === 1,
       "G3c fator de texto virou NaN e contaminou a conta");
  }

  /* ================================================================
   * G4: A AVALIAÇÃO VENCE
   * ============================================================== */
  {
    const { api, janela } = rodar();
    api.difDefinir("Direito Financeiro", "Receita", "alta", "declarada");
    const nova = api.difDe("Direito Financeiro", "Receita");
    ok(nova.fator === 1.5 && !nova.vencida,
       "G4 a avaliacao de hoje nao vale: " + JSON.stringify(nova));

    /* envelhecendo a marca à mão, que é o que o calendário faria */
    const m = JSON.parse(janela.localStorage.getItem("eac_dificuldade"));
    m["direito financeiro›receita"].d = daqui(-(api.DIF_VALIDADE + 1));
    janela.localStorage.setItem("eac_dificuldade", JSON.stringify(m));
    /* o mapa fica em cache; sem reler, o teste conferiria a memoria e nao
     * o que esta gravado — e o cache velho e' um defeito de verdade, o
     * mesmo que faz um backup restaurado nao aparecer ate o F5 */
    api.difRecarregar();

    const velha = api.difDe("Direito Financeiro", "Receita");
    ok(velha.nivel === "alta",
       "G4b a avaliacao vencida foi APAGADA — perdeu-se a informacao de "
       + "que voce ja achou isto dificil");
    ok(velha.vencida === true && velha.fator === 1,
       "G4c uma opiniao de dois meses atras continua comandando a agenda: "
       + JSON.stringify(velha));
    /* e some do mapa que vai para o motor */
    ok(api.difMapaFatores()["direito financeiro›receita"] === undefined,
       "G4d o fator vencido continua sendo entregue ao plano");
  }

  /* ================================================================
   * G5: DECLARAR VENCE INFERIR
   * ============================================================== */
  {
    const { api } = rodar();
    api.difDefinir("Português", "Crase", "baixa", "declarada");
    /* uma tarde ruim não desmente o que você afirmou */
    const mudou = api.difDoHumor("Português", "Crase", "ruim");
    ok(mudou === false,
       "G5 uma sessao ruim apagou a sua declaracao de que domina o assunto");
    ok(api.difDe("Português", "Crase").nivel === "baixa",
       "G5b o nivel declarado foi trocado pelo palpite da sessao: "
       + api.difDe("Português", "Crase").nivel);

    /* mas preenche o silêncio de quem nunca opinou */
    const novo = api.difDoHumor("Português", "Regência", "ruim");
    ok(novo === true, "G5c a sessao ruim nao virou avaliacao onde nao havia");
    const r = api.difDe("Português", "Regência");
    ok(r.nivel === "alta" && r.origem === "sessao",
       "G5d a avaliacao inferida nao se identifica como inferida: "
       + JSON.stringify(r));

    /* E VOCÊ SEMPRE PODE CORRIGIR O APP — o caminho contrário é livre */
    ok(api.difDefinir("Português", "Regência", "baixa", "declarada") === true,
       "G5e voce nao consegue corrigir um palpite do app");
    ok(api.difDe("Português", "Regência").origem === "declarada",
       "G5f a correcao nao virou declaracao");
  }

  /* ---- G6: a tela mostra o nível, e a agenda usa o mapa real ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("T", texto());
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(300);
    api.difDefinir("Direito Financeiro", "Restos a pagar", "alta", "declarada");
    api.edRender(); api.hubRender();

    const achar = (el, out) => {
      Array.from(el.children || []).forEach((f) => {
        if (/(^| )ed-item( |$)/.test(f.className || "")) out.push(f);
        achar(f, out);
      });
      return out;
    };
    const linha = achar(api.$("edAgendaTopo"), [])
      .filter((li) => /Restos/.test(li.textContent || ""))[0];
    ok(!!linha, "G6-pre a linha nao esta na agenda");
    /* O SELO. Sem ele a ordem mudaria sozinha e nada na tela diria por
     * quê — e ordem que muda sozinha é ordem em que ninguem confia. */
    ok(/difícil/i.test((linha || {}).textContent || ""),
       "G6 a linha nao mostra o nivel declarado: "
       + ((linha || {}).textContent || "").slice(0, 60));

    /* um tópico "em evolução" não ganha selo: seria ruído em toda linha */
    api.difDefinir("Português", "Crase", "media", "declarada");
    api.hubRender();
    const lc = achar(api.$("edAgendaTopo"), [])
      .filter((li) => /Crase/.test(li.textContent || ""))[0];
    ok(!lc || !/em evolu/i.test(lc.textContent || ""),
       "G6b o nivel padrao virou selo em toda linha");

    /* e o plano, chamado sem fatores, lê o armazenamento de verdade */
    const p = api.montarPlano(api.lerEdital(texto()),
      { horas: 12, prova: daqui(300) });
    const rp = p.itens.filter((i) => i.nome === "Restos a pagar")[0];
    ok(rp && rp.fator === 1.5,
       "G6c a tela declarou e o plano nao viu: " + JSON.stringify(rp && rp.fator));
  }

  /* ---- G7: o registro grava o que você marcou ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("T", texto());
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(300);
    api.edRender();
    const r = api.lerEdital(texto());
    const p = api.montarPlano(r, { horas: 12, prova: daqui(300) });
    const item = p.itens.filter((i) => i.nome === "Despesa")[0];

    api.abrirRegistro(item);
    ok(api.regDifAtual() === "",
       "G7 o registro ja abre com um nivel escolhido — nao opinar viraria "
       + "uma opiniao");
    const cx = api.$("regDificuldade");
    const botoes = Array.from(cx.children || []);
    ok(botoes.length === 3, "G7b deviam ser tres niveis: " + botoes.length);
    botoes[0].onclick();                 /* "Inseguro" */
    ok(api.regDifAtual() === "alta",
       "G7c clicar no nivel nao guardou a escolha: " + api.regDifAtual());
    /* clicar de novo desmarca: dá para tirar a opinião sem trocar por outra */
    botoes[0].onclick();
    ok(api.regDifAtual() === "", "G7d nao da para desmarcar o nivel");

    botoes[0].onclick();
    api.$("regMinutos").value = 30;
    api.confirmarRegistro("feito");
    const d = api.difDe("Direito Financeiro", "Despesa");
    ok(d.nivel === "alta" && d.origem === "declarada",
       "G7e o nivel marcado no registro nao foi gravado: " + JSON.stringify(d));
  }

  /* ---- G7b: e sobrevive ao backup ----
   * "eac_rascunhos" ficou meses fora do backup, e restaurar apagava os
   * rabiscos em silêncio. Uma avaliação de dificuldade é o mesmo caso,
   * pior: são meses de julgamento seu, e a perda aparece só como uma
   * agenda que "voltou ao normal". */
  {
    const { api } = rodar();
    /* LER A LISTA, NÃO O ARQUIVO. Procurar o nome no texto de backup.js
     * passaria só porque o COMENTÁRIO que explica a chave a menciona —
     * a asserção continuaria verde com a chave fora da lista. */
    const todas = [];
    Object.keys(api.BK_CHAVES || {}).forEach((g) => {
      (api.BK_CHAVES[g] || []).forEach((k) => todas.push(k));
    });
    ok(todas.indexOf("eac_dificuldade") >= 0,
       "G7f o mapa de dificuldade nao entra no backup — restaurar apagaria "
       + "meses de avaliacao sem avisar: " + todas.length + " chaves");
    ok(todas.indexOf("eac_plano_snaps") >= 0,
       "G7g a serie de instantaneos do plano nao entra no backup");
  }

  /* ---- G8: o raio-X mostra o fator ---- */
  {
    const { api } = rodar();
    const p = plano(api, { "direito financeiro›receita": 1.5 });
    const c = api.plItemConta(
      p.itens.filter((i) => i.nome === "Receita")[0]);
    ok(c.fator === 1.5 && c.brutoOrdem === 37.5,
       "G8 o raio-X nao leva o fator: " + JSON.stringify(c));
    ok(/1,5|1\.5/.test(api.t("dif_col_aj")),
       "G8b a ajuda da coluna nao diz o que o fator faz");
  }

  /* ================================================================
   * S2: O ACERTO NO TÓPICO ENTRA COMO SINAL — com a origem dita na tela
   * ============================================================== */
  {
    const { api } = rodar();
    const RC = "direito financeiro›receita", DP = "direito financeiro›despesa";
    const tent = (n, certas, dia) => Array.from({ length: n }, (x, k) => ({ q: dia + "T10:" + String(k).padStart(2, "0") + ":00Z", resp: 0, acertou: k < certas }));
    /* motor puro */
    const m = api.edAcertosPorTopico(
      [{ d: "2026-10-01", c: RC, a: "feito", q: { feitas: 6, certas: 2 } },
       { d: "2026-10-02", c: RC, a: "feito", q: { feitas: 10, certas: 10, app: true } },
       { d: "2026-10-03", c: RC, a: "pendente", q: { feitas: 10, certas: 10 } },
       { d: "2026-10-04", c: DP, a: "feito", q: { pct: 90 } }],
      [{ chave: RC, tentativas: tent(5, 1, "2026-10-05") }, { chave: DP, tentativas: tent(9, 9, "2026-10-05") }]);
    ok(m[RC].feitas === 11 && m[RC].certas === 3 && m[RC].pct === 27 && m[RC].valido && m[RC].nivel === "alta",
       "S2a o acerto do topico soma tentativas do app e registros com contagem (sem o 'pendente' e sem o que veio do app, q.app): " + JSON.stringify(m[RC]));
    ok(m[DP].feitas === 9 && !m[DP].valido && m[DP].nivel === "",
       "S2b menos de 10 questoes nao decide nada (e o percentual 'de cabeca' nao entra): " + JSON.stringify(m[DP]));
    const lim = (certas) => api.edAcertosPorTopico([], [{ chave: RC, tentativas: tent(20, certas, "2026-10-05") }])[RC].nivel;
    ok(lim(11) === "alta" && lim(12) === "media" && lim(16) === "media" && lim(17) === "baixa",
       "S2c os cortes: abaixo de 60% dificil, de 85% para cima facil (55% / 60% / 80% / 85%): " + [lim(11), lim(12), lim(16), lim(17)]);
    const jan = api.edAcertosPorTopico([], [{ chave: RC, tentativas: tent(40, 0, "2026-01-01").concat(tent(40, 40, "2026-10-01")) }])[RC];
    ok(jan.feitas === 40 && jan.pct === 100 && jan.nivel === "baixa", "S2d so' as ~40 questoes mais RECENTES contam (quem melhorou nao fica preso ao comeco): " + JSON.stringify(jan));

    /* quem decide: a sua declaracao > o acerto > o palpite da sessao */
    const c = api.edCombinarFatores(
      { [RC]: { nivel: "baixa", fator: 0.7, origem: "declarada" }, [DP]: { nivel: "alta", fator: 1.5, origem: "sessao" }, "x›y": { nivel: "alta", fator: 1.5, origem: "sessao" } },
      { [RC]: { valido: true, nivel: "alta", pct: 30 }, [DP]: { valido: true, nivel: "media", pct: 70 }, "a›b": { valido: true, nivel: "baixa" }, "c›d": { valido: false, nivel: "" } });
    ok(c.fatores[RC] === 0.7 && c.origem[RC] === "declarada", "S2e a sua declaracao vence o acerto");
    ok(c.fatores[DP] === 1 && c.origem[DP] === "acerto", "S2f o acerto (mesmo 'normal') vence o palpite antigo da sessao");
    ok(c.fatores["a›b"] === 0.7 && c.origem["a›b"] === "acerto" && c.fatores["x›y"] === 1.5 && c.origem["x›y"] === "sessao" && !("c›d" in c.fatores),
       "S2g sem declaracao: o acerto valido decide; sem acerto valido fica o palpite; amostra pequena nao entra: " + JSON.stringify(c));

    /* o plano usa (sem fatores passados) e diz de onde veio */
    api.qsBancoPor([{ chave: RC, disciplina: "Direito Financeiro", tentativas: tent(12, 3, "2026-10-05") }]);
    api.diarioPor([]);
    const p = api.montarPlano(api.lerEdital(texto()), { horas: 12, prova: daqui(300) });
    const rc = p.itens.filter((i) => i.nome === "Receita")[0], dp = p.itens.filter((i) => i.nome === "Despesa")[0];
    ok(rc.fator === 1.5 && rc.fatorOrigem === "acerto" && rc.acertoTopico.pct === 25 && rc.bruto === dp.bruto && rc.brutoOrdem > dp.brutoOrdem,
       "S2h o plano sobe o topico com acerto baixo (e so' a ORDEM muda, o peso da prova nao): " + JSON.stringify({ f: rc.fator, o: rc.fatorOrigem, b: rc.bruto }));
    ok(dp.fator === 1 && !dp.fatorOrigem && !dp.acertoTopico, "S2i topico sem questoes: nada muda");
    api.difDefinir("Direito Financeiro", "Receita", "baixa", "declarada");
    const p2 = api.montarPlano(api.lerEdital(texto()), { horas: 12, prova: daqui(300) });
    const rc2 = p2.itens.filter((i) => i.nome === "Receita")[0];
    ok(rc2.fator === 0.7 && rc2.fatorOrigem === "declarada", "S2j declarar 'facil' vence o acerto baixo");
    api.difApagar("Direito Financeiro", "Receita");
    ok(api.montarPlano(api.lerEdital(texto()), { horas: 12, prova: daqui(300), fatores: {} }).itens.filter((i) => i.nome === "Receita")[0].fator === 1,
       "S2k fatores passados na mao continuam mandando (o motor sem dependencia)");

    /* raio-X: o fator e a origem */
    const conta = api.plItemConta(rc);
    ok(conta.fatorOrigem === "acerto" && conta.acertoPct === 25, "S2l o raio-X leva a origem do fator: " + JSON.stringify(conta));
    ok(/acerto/.test(api.t("dif_col_aj")) && /já entra/.test(api.t("plog_sinais_txt")), "S2m a ajuda da coluna e a aba de sinais dizem que o acerto por topico entra");
  }

  /* ---- S2: a tela — selo da agenda e "Como foi?" ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("T", texto());
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(300);
    const RA = "direito financeiro›restos a pagar";
    const tent = (n, certas) => Array.from({ length: n }, (x, k) => ({ q: "2026-10-05T10:" + String(k).padStart(2, "0") + ":00Z", resp: 0, acertou: k < certas }));
    api.qsBancoPor([{ chave: RA, disciplina: "Direito Financeiro", tentativas: tent(14, 7) }]);
    api.edRender(); api.hubRender();
    const achar = (el, out, re) => { Array.from(el.children || []).forEach((f) => { if (re.test(f.className || "")) out.push(f); achar(f, out, re); }); return out; };
    const linha = achar(api.$("edAgendaTopo"), [], /(^| )ed-item( |$)/).filter((li) => /Restos/.test(li.textContent || ""))[0];
    const selo = linha && achar(linha, [], /(^| )dif-selo( |$)/)[0];
    ok(selo && selo.textContent === "difícil · 50%" && /medido/.test(selo.className) && /50% nas últimas 14/.test(selo.title),
       "S2n o selo da agenda diz que veio do acerto, com o numero: " + (selo && selo.textContent) + " | " + (selo && selo.title));
    const item = { nome: "Restos a pagar", disciplina: "Direito Financeiro", chave: RA, minutos: 30 };
    api.abrirRegistro(item);
    const eco = () => api.$("regDifEco").textContent;
    ok(eco() === "Sem resposta: vale o seu acerto nas questões deste tópico — 50% em 14 → «Difícil».", "S2o 'Como foi?' sem resposta diz que vale o acerto: " + eco());
    api.$("regDificuldade").children[2].onclick();
    ok(/^Fácil: .* \(Seu acerto, 50% em 14 questões, diria «Difícil» — vale a sua resposta\.\)$/.test(eco()), "S2p responder diferente: vale a resposta, e a tela lembra o acerto: " + eco());
    api.$("regDificuldade").children[0].onclick();
    ok(!/Seu acerto/.test(eco()), "S2q responder o mesmo que o acerto diz: sem lembrete");
    api.$("dlgRegistro").close();
    api.difDefinir("Direito Financeiro", "Restos a pagar", "baixa", "declarada");
    api.abrirRegistro(item);
    ok(/^Sem resposta: continua valendo «Fácil»/.test(eco()), "S2r com declaracao valendo, e' ela que a tela diz (nao o acerto): " + eco());
    api.$("dlgRegistro").close();
    api.edRender(); api.hubRender();
    const linha2 = achar(api.$("edAgendaTopo"), [], /(^| )ed-item( |$)/).filter((li) => /Restos/.test(li.textContent || ""))[0];
    const selo2 = linha2 && achar(linha2, [], /(^| )dif-selo( |$)/)[0];
    ok(selo2 && selo2.textContent === "fácil" && !/medido/.test(selo2.className), "S2s com declaracao, o selo e' o da declaracao: " + (selo2 && selo2.textContent));
  }

  /* ---- S2: o registro que vem de uma sessao do app nao conta duas vezes ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.abrirRegistro({ nome: "Receita", disciplina: "Direito Financeiro", chave: "direito financeiro›receita", minutos: 30 });
    api.regDeQuestoes(12, 9, 30);
    ok(JSON.stringify(api.regQuestoesDoFormulario()) === JSON.stringify({ feitas: 12, certas: 9, app: true }), "S2t a contagem trazida do app vai marcada (app)");
    api.$("regQCertas").value = "8";
    ok(!api.regQuestoesDoFormulario().app, "S2u mudou os numeros a mao: deixa de ser a mesma sessao, conta");
    api.$("dlgRegistro").close();
    api.abrirRegistro({ nome: "Receita", disciplina: "Direito Financeiro", chave: "direito financeiro›receita", minutos: 30 });
    api.$("regQFeitas").value = "12"; api.$("regQCertas").value = "9";
    ok(!api.regQuestoesDoFormulario().app, "S2v reabrir o registro esquece a sessao anterior");
    const porDisc = api.edAcertos([{ disc: "D", a: "feito", q: { feitas: 10, certas: 5, app: true } }, { disc: "D", a: "feito", q: { feitas: 4, certas: 4 } }],
      [{ disciplina: "D", tentativas: [{ acertou: true }, { acertou: false }] }]);
    ok(porDisc.D.feitas === 6 && porDisc.D.certas === 5, "S2w o acerto por disciplina tambem nao conta duas vezes: " + JSON.stringify(porDisc.D));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
