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
    ok(/inseguro/i.test((linha || {}).textContent || ""),
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

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
