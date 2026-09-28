/* Questões: leitura da resposta da IA, gravação sem duplicar, e o motor de
 * responder — que só pode mostrar o gabarito DEPOIS da escolha. */
const q = require("../docs/questoes.js");

function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const loja = {};
  const ler = (k) => loja[k];
  const gravar = (k, v) => { loja[k] = v; };
  const CTX = { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias",
                chave: "direito financeiro›leis orcamentarias", concurso: "TCE-PE" };

  /* ---- Q0: o formato de CAMPOS NOMEADOS ----
   * A linha compacta dependia de pontuacao para separar as partes: um
   * "::" dentro do enunciado quebrava tudo em silencio. Com o campo dito
   * pelo nome, nao ha o que adivinhar. */
  {
    const R = [
      "[QUESTAO]",
      "TIPO: ME", "BANCA: FGV",
      "ENUNCIADO: Sobre as transferencias especiais :: assinale a correta",
      "sobre o regramento constitucional.",
      "A) Sao exclusivas para saude.",
      "B) Podem ir 100% para infraestrutura.",
      "C) Cada uma deve ter 50% em saude.",
      "GABARITO: B",
      "COMENTARIO: A exigencia incide sobre o montante global,",
      "e nao sobre cada repasse.",
      "[/QUESTAO]",
      "",
      "[QUESTAO]",
      "TIPO: CE", "BANCA:",
      "ENUNCIADO: A vedacao de inscricao e valida.",
      "GABARITO: E",
      "COMENTARIO: Simetria ao modelo federal.",
      "[/QUESTAO]",
    ].join("\n");
    const r = q.qsLerResposta(R, CTX);
    ok(r.achados.length === 2, `Q0 esperava 2, veio ${r.achados.length}`);
    ok(r.ignoradas.length === 0, "Q0b recusou linha do formato nomeado");
    ok(r.achados[0].tipo === "me" && r.achados[0].opcoes.length === 3,
       "Q0c perdeu as opcoes no formato nomeado");
    ok(r.achados[0].gabarito === "B", "Q0d gabarito errado");
    ok(/:: assinale a correta/.test(r.achados[0].enunciado),
       "Q0e o '::' dentro do enunciado quebrou o campo — era o motivo de existir este formato");
    ok(/nao sobre cada repasse/.test(r.achados[0].comentario),
       "Q0f comentario de duas linhas foi cortado");
    ok(r.achados[1].tipo === "ce" && r.achados[1].gabarito === "E",
       "Q0g o certo/errado nomeado nao foi lido");
    ok(r.achados[1].banca === "", "Q0h banca vazia virou algo");
    ok(r.achados.every((x) => x.chave === CTX.chave),
       "Q0i o formato nomeado perdeu o topico");
    /* o rotulo TIPO e so dica — quem decide e o conteudo —, mas a linha
     * PRECISA ser consumida: solta, ela vira parte do enunciado */
    ok(r.achados.every((x) => !/TIPO:/i.test(x.enunciado)),
       "Q0j a linha 'TIPO:' vazou para dentro do enunciado");
    ok(r.achados.every((x) => !/BANCA:/i.test(x.enunciado)),
       "Q0k a linha 'BANCA:' vazou para dentro do enunciado");
  }

  /* ---- Q0z: BLOCO INTEIRO NUMA LINHA SO ----
   * A IA (e a area de transferencia de alguns chats) devolve tudo numa
   * linha. O leitor so olhava o COMECO da linha: via "[QUESTAO]" e jogava
   * o resto fora — treze questoes perfeitas viravam treze "sem enunciado e
   * sem gabarito". O conteudo estava certo; a exigencia e que era rigida. */
  {
    const UMA_LINHA = [
      "[QUESTAO] TIPO: CE BANCA: FGV ENUNCIADO: O orcamento brasileiro e lei"
        + " em sentido formal, de natureza autorizativa com partes impositivas."
        + " GABARITO: C COMENTARIO: Conforme a aula, e lei formal, especial e"
        + " temporaria. [/QUESTAO]",
      "[QUESTAO] TIPO: ME BANCA: FGV ENUNCIADO: Qual o limite das emendas"
        + " individuais impositivas? A) 1,2% da RCL. B) 2% da RCL do exercicio"
        + " anterior. C) 1% da RCL. D) 2% da RCL do exercicio em curso."
        + " GABARITO: B COMENTARIO: Apos a EC 126/2022 o limite e de 2%."
        + " [/QUESTAO]",
    ].join("\n");
    const r = q.qsLerResposta(UMA_LINHA, CTX);
    ok(r.achados.length === 2,
       `Q0z esperava 2, veio ${r.achados.length} (recusadas: ${r.ignoradas.length})`);
    ok(r.ignoradas.length === 0, "Q0z1 recusou bloco que estava completo");
    const a1 = r.achados[0] || {}, a2 = r.achados[1] || {};
    ok(a1.tipo === "ce" && a1.gabarito === "C", "Q0z2 certo/errado numa linha falhou");
    ok(/natureza autorizativa/.test(a1.enunciado),
       "Q0z3 o enunciado nao foi separado: " + a1.enunciado);
    ok(!/GABARITO|COMENTARIO|TIPO:|BANCA:/i.test(a1.enunciado),
       "Q0z4 os rotulos vazaram para dentro do enunciado: " + a1.enunciado);
    ok(/lei formal, especial/.test(a1.comentario || ""),
       "Q0z5 o comentario nao foi separado");
    ok(a1.banca === "FGV", "Q0z6 a banca nao foi lida na linha unica");
    ok(a2.tipo === "me" && a2.opcoes.length === 4,
       `Q0z7 as opcoes inline nao viraram alternativas (${a2.opcoes.length})`);
    ok(a2.gabarito === "B", "Q0z8 gabarito da multipla escolha errado");
    ok(!/A\)/.test(a2.enunciado), "Q0z9 as opcoes ficaram dentro do enunciado");
    ok(a2.opcoes[1].txt.indexOf("2% da RCL do exercicio anterior") === 0,
       "Q0z10 o texto da alternativa saiu truncado: " + a2.opcoes[1].txt);

    /* CAMPO VAZIO NAO PODE ENGOLIR O DE BAIXO.
     * "BANCA:" sozinho numa linha fazia a limpeza consumir a quebra e
     * grudar o ENUNCIADO dentro da banca — o enunciado sumia inteiro. */
    const comVazio = q.qsLerResposta([
      "[QUESTAO]", "TIPO: CE", "BANCA:",
      "ENUNCIADO: A vedacao de inscricao e valida.",
      "GABARITO: E", "COMENTARIO: Simetria.", "[/QUESTAO]",
    ].join("\n"), CTX);
    ok(comVazio.achados.length === 1,
       `Q0z11 campo vazio quebrou a leitura (${comVazio.ignoradas.map((x) => x.motivo).join(",")})`);
    ok((comVazio.achados[0] || {}).enunciado === "A vedacao de inscricao e valida.",
       "Q0z12 o enunciado foi engolido pelo campo vazio de cima: "
       + JSON.stringify((comVazio.achados[0] || {}).enunciado));
    ok((comVazio.achados[0] || {}).banca === "",
       "Q0z13 a banca vazia virou algo");
  }

  /* ---- Q0q: campos em OUTRA ORDEM ----
   * A IA reordena campos com frequencia. Se um deles deixar de ser
   * reconhecido, a linha inteira vira parte do enunciado — e so aparece
   * meses depois, no meio de um simulado. */
  {
    const R = [
      "[QUESTAO]",
      "ENUNCIADO: A vedacao de inscricao em restos a pagar e valida.",
      "BANCA: Cebraspe",
      "TIPO: CE",
      "GABARITO: E",
      "COMENTARIO: Simetria ao modelo federal.",
      "[/QUESTAO]",
    ].join("\n");
    const r = q.qsLerResposta(R, CTX);
    ok(r.achados.length === 1, `Q0q esperava 1, veio ${r.achados.length}`);
    const x = r.achados[0] || {};
    ok(x.enunciado === "A vedacao de inscricao em restos a pagar e valida.",
       "Q0r um campo nao reconhecido vazou para o enunciado: "
       + JSON.stringify(x.enunciado));
    ok(x.banca === "Cebraspe", "Q0s a banca fora de ordem nao foi lida");
    ok(x.gabarito === "E", "Q0t o gabarito fora de ordem nao foi lido");
    ok(/Simetria/.test(x.comentario || ""), "Q0u o comentario nao foi lido");
  }

  /* ---- Q0m: texto que ACABA com a questao aberta ----
   * O ultimo bloco e fechado fora do laco. Sem separar as opcoes ali
   * tambem, uma questao de multipla escolha no fim do texto virava
   * certo/errado com o enunciado cheio de "A) B) C)". */
  {
    const b = q.qsNoTexto([
      "#### **Questao 7: Titulo**",
      "Qual a alternativa correta? A) Uma. B) Outra. C) Terceira.",
    ].join("\n"));
    ok(b.length === 1, `Q0m esperava 1 bloco, veio ${b.length}`);
    ok(b[0].opcoes.length === 3,
       `Q0n as opcoes do fim do texto nao foram separadas (${b[0].opcoes.length})`);
    ok(b[0].tipo === "me", "Q0o ficou como certo/errado tendo tres opcoes");
    ok(!/A\)/.test(b[0].enunciado), "Q0p as opcoes ficaram dentro do enunciado");
  }

  /* ---- Q1: os quatro formatos reais ---- */
  q.qsCarregar(ler);
  {
    const RESP = [
      "? CE :: FGV :: Lei municipal pode prever emendas impositivas de bancada?",
      "= C :: Pelo principio da auto-organizacao (Art. 29, CF).",
      "",
      "? ME :: FGV :: Qual o fundamento do STF para anular o Orcamento Secreto?",
      "A) Falta de previsao no PPA.",
      "B) Violacao a transparencia.",
      "C) Falta de autorizacao do TCU.",
      "= B :: Postulados republicanos de transparencia",
      "e impossibilidade de parlamentares incognitos.",
      "",
      "? CE :: :: As emendas Pix integram a receita para reparticao.",
      "= E :: Art. 166-A, 1o: nao integram.",
    ].join("\n");
    const r = q.qsLerResposta(RESP, CTX);
    ok(r.achados.length === 3, `Q1 esperava 3 questoes, veio ${r.achados.length}`);
    ok(r.ignoradas.length === 0, "Q1b ignorou linha que devia entender");
    ok(r.achados[0].tipo === "ce" && r.achados[0].gabarito === "C",
       "Q1c certo/errado nao foi lido");
    ok(r.achados[1].tipo === "me" && r.achados[1].opcoes.length === 3,
       "Q1d multipla escolha perdeu as opcoes");
    ok(r.achados[1].gabarito === "B", "Q1e gabarito da multipla escolha errado");
    ok(/parlamentares incognitos/.test(r.achados[1].comentario),
       "Q1f comentario de duas linhas foi cortado");
    ok(r.achados[0].banca === "FGV", "Q1g a banca nao foi guardada");
    ok(r.achados[2].banca === "", "Q1h banca vazia virou algo");
    ok(r.achados.every((x) => x.chave === CTX.chave && x.concurso === "TCE-PE"),
       "Q1i a questao nao guardou de qual topico e concurso veio");
  }

  /* ---- Q2: o que TEM de ser recusado ---- */
  {
    const RUIM = [
      "? ME :: FGV :: Pergunta sem opcao nenhuma",
      "= B :: comentario",
      "",
      "? ME :: FGV :: Pergunta cujo gabarito nao esta entre as opcoes",
      "A) uma",
      "B) outra",
      "= D :: comentario",
      "",
      "? CE :: FGV :: Afirmacao sem gabarito",
      "",
      "? CE :: FGV :: Afirmacao com gabarito impossivel",
      "= X :: comentario",
    ].join("\n");
    const r = q.qsLerResposta(RUIM, CTX);
    const motivos = r.ignoradas.map((x) => x.motivo).join("|");
    /* "ME sem opção" vira CE — e aí o gabarito B nao serve */
    ok(/gabarito_nao_e_C_nem_E/.test(motivos), "Q2 gabarito invalido passou");
    ok(/gabarito_fora_das_opcoes/.test(motivos),
       "Q2b gabarito apontando para opcao inexistente passou");
    ok(/sem_gabarito/.test(motivos), "Q2c questao sem gabarito passou");
    ok(r.achados.length === 0, `Q2d aceitou questao quebrada (${r.achados.length})`);
  }

  /* ---- Q3: a etiqueta do tipo nao manda; o conteudo manda ---- */
  {
    const r = q.qsLerResposta([
      "? CE :: FGV :: Isto foi rotulado como certo/errado mas tem opcoes",
      "A) uma", "B) outra",
      "= A :: comentario",
    ].join("\n"), CTX);
    ok(r.achados.length === 1 && r.achados[0].tipo === "me",
       "Q3 rotulo errado da IA nao foi corrigido pelo conteudo");
  }

  /* ---- Q3b: o comentario continua, mas a despedida da IA nao entra ----
   * O leitor de cartoes ja sofreu disto: texto de conversa vazando para
   * dentro do conteudo. Aqui a regra e simples — frase pendurada continua,
   * frase terminada em ponto nao pede continuacao. */
  {
    const r = q.qsLerResposta([
      "? ME :: FGV :: Pergunta?",
      "A) uma", "B) outra",
      "= B :: Postulados republicanos.",
      "linha solta logo abaixo",
      "",
      "? CE :: FGV :: Outra afirmacao.",
      "= C :: O argumento focou na transgressao aos postulados",
      "e na impossibilidade de parlamentares incognitos.",
      "",
      "Espero ter ajudado!",
    ].join("\n"), CTX);
    ok(r.achados.length === 2, `Q3b esperava 2, veio ${r.achados.length}`);
    ok(r.achados[0].comentario === "Postulados republicanos.",
       "Q3b1 a linha solta entrou no comentario");
    ok(/parlamentares incognitos/.test(r.achados[1].comentario),
       "Q3b2 o comentario pendurado foi cortado");
    ok(r.ignoradas.length === 2, `Q3b3 devia recusar 2 linhas, recusou ${r.ignoradas.length}`);
    ok(r.ignoradas.some((x) => /Espero ter ajudado/.test(x.txt)),
       "Q3b4 a despedida da IA nao apareceu na conferencia");
  }

  /* ---- Q4: gravar, nao duplicar, desfazer ---- */
  {
    const r = q.qsLerResposta("? CE :: FGV :: Uma afirmacao qualquer.\n= C :: pois sim.", CTX);
    const rec = q.qsAplicar(r.achados, gravar);
    ok(rec.novas === 1, "Q4 nao gravou");
    ok(q.qsTodas().length >= 1, "Q4b o banco ficou vazio");
    ok(!!loja["eac_questoes"], "Q4c nao gravou no armazenamento");

    const r2 = q.qsLerResposta("? CE :: FGV :: Uma afirmacao qualquer.\n= C :: pois sim.", CTX);
    const rec2 = q.qsAplicar(r2.achados, gravar);
    ok(rec2.novas === 0 && rec2.repetidas === 1,
       "Q4d gravou a mesma questao duas vezes");

    const antes = q.qsTodas().length;
    q.qsDesfazer(rec, gravar);
    ok(q.qsTodas().length === antes - 1, "Q4e desfazer nao tirou o que entrou");
  }

  /* ---- Q5: a mesma questao serve a dois concursos ---- */
  {
    const loja2 = {}; q.qsCarregar((k) => loja2[k]);
    const g2 = (k, v) => { loja2[k] = v; };
    q.qsAplicar(q.qsLerResposta("? CE :: FGV :: Afirmacao A.\n= C :: x", CTX).achados, g2);
    const outro = Object.assign({}, CTX, { concurso: "ISS Caruaru",
      chave: "direito financeiro›receita publica", topico: "Receita publica" });
    q.qsAplicar(q.qsLerResposta("? CE :: FGV :: Afirmacao A.\n= C :: x", outro).achados, g2);
    ok(q.qsTodas().length === 2,
       "Q5 o mesmo enunciado em OUTRO topico devia poder existir");
    ok(q.qsFiltrar({ chave: CTX.chave }).length === 1,
       "Q5b o filtro por topico trouxe questao de outro topico");
    ok(q.qsFiltrar({ concurso: "ISS Caruaru" }).length === 1,
       "Q5c o filtro por concurso nao funciona");
    ok(q.qsContarPorChave()[CTX.chave] === 1, "Q5d a contagem por topico errou");
    ok(q.qsBancas().join(",") === "FGV", "Q5e a lista de bancas errou");
  }

  /* ---- Q6: responder — o gabarito so depois da escolha ---- */
  {
    const loja3 = {}; q.qsCarregar((k) => loja3[k]);
    const g3 = (k, v) => { loja3[k] = v; };
    q.qsAplicar(q.qsLerResposta([
      "? CE :: FGV :: Primeira.", "= C :: comentario um.",
      "? ME :: FGV :: Segunda.", "A) a", "B) b", "= B :: comentario dois.",
    ].join("\n"), CTX).achados, g3);

    q.qsSessaoIniciar(q.qsFiltrar({ chave: CTX.chave }));
    const a1 = q.qsAtual();
    ok(a1 && a1.enunciado === "Primeira.", "Q6 a sessao nao comecou na primeira");
    ok(q.qsJaRespondida() === null, "Q6b a questao ja nasceu respondida");
    const res = q.qsResponder("E", g3);
    ok(res && res.acertou === false, "Q6c errar nao foi reconhecido como erro");
    ok(res.gabarito === "C" && /comentario um/.test(res.comentario),
       "Q6d o gabarito comentado nao veio depois de responder");
    ok(q.qsResponder("C", g3) === null,
       "Q6e deixou responder duas vezes a mesma passagem");

    q.qsAndar(1);
    const a2 = q.qsAtual();
    ok(a2 && a2.tipo === "me" && a2.opcoes.length === 2, "Q6f nao andou para a segunda");
    const res2 = q.qsResponder("B", g3);
    ok(res2.acertou === true, "Q6g acertar nao foi reconhecido");

    const p = q.qsPlacar();
    ok(p.total === 2 && p.feitas === 2 && p.certas === 1 && p.pct === 50,
       `Q6h placar errado: ${JSON.stringify(p)}`);
    q.qsAndar(1);
    ok(q.qsAtual() === null, "Q6i a sessao nao terminou no fim da fila");
  }

  /* ---- Q7: o desempenho fica gravado e volta ---- */
  {
    const guardado = JSON.parse(JSON.stringify(q.qsTodas()));
    ok(guardado.some((x) => (x.tentativas || []).length),
       "Q7 a tentativa nao ficou registrada na questao");
    const d = q.qsDesempenho();
    ok(d.feitas === 2 && d.certas === 1 && d.pct === 50,
       `Q7b desempenho acumulado errado: ${JSON.stringify(d)}`);
    ok(q.qsFiltrar({ soErradas: true }).length === 1,
       "Q7c o filtro de erradas nao encontrou a que errei");
    ok(q.qsFiltrar({ soIneditas: true }).length === 0,
       "Q7d disse que ha ineditas depois de responder todas");
  }

  /* ---- Q8: o banco entra no backup ----
   * As questoes moram em arquivo proprio. Se ninguem as puser na lista do
   * backup, "salvar base" gera um arquivo sem elas e "carregar outra base"
   * apaga o banco inteiro — em silencio, que e o pior jeito de perder. */
  {
    const bk = require("fs").readFileSync(
      require("path").join(__dirname, "..", "docs", "backup.js"), "utf8");
    ok(/eac_questoes/.test(bk), "Q8 eac_questoes ficou de fora do backup");
    const lista = (bk.match(/material:\s*\[([^\]]*)\]/) || [, ""])[1];
    ok(/eac_questoes/.test(lista),
       "Q8b eac_questoes nao esta no grupo de chaves salvas");
    ok(/eac_qs_sessao/.test(lista),
       "Q8c a rodada em andamento ficou de fora do backup");
  }

  /* ---- Q9: D1, o detector de questoes JA ESCRITAS no texto ---- */
  {
    const T = [
      "**Questao 1 (FGV - Adaptada):** E constitucional lei municipal que preveja emendas?",
      "",
      "* **Resposta: Sim.** Pelo principio da auto-organizacao (Art. 29, CF).",
      "",
      "**Questao 2 (Cebraspe - Procurador):** A vedacao de inscricao e valida?",
      "- **Resposta: Nao.** O modelo federal preve a possibilidade (ADI 7493).",
      "**Questao 3 (FGV - Juiz):** Qual o fundamento? A) Falta de previsao no PPA."
        + " B) Violacao a transparencia. C) Falta de autorizacao do TCU.",
      "",
      "* **Resposta: B.** O argumento central da Ministra Rosa Weber.",
      "",
      "**Questao 4 (Questao de Pegadinha):** As emendas Pix integram a receita?",
      "",
      "* **Resposta: Nao.** Conforme o Art. 166-A.",
      "",
      "Texto comum que nao e questao nenhuma, so explicacao corrida.",
      "",
      "**Vedacoes:** Proibido o uso para despesas com pessoal, o que termina",
      "com dois pontos mas nao e questao.",
      "",
      /* isca de verdade: linha que TERMINA em interrogacao. Material
       * didatico e cheio disto, e virar questao aqui esconderia a
       * explicacao que vem logo abaixo. */
      "Mas afinal, o que muda com a Emenda 105?",
      "Muda que o repasse passa a ser direto, sem convenio.",
    ].join("\n");
    const b = q.qsNoTexto(T);
    ok(b.length === 4, `Q9 esperava 4 blocos, veio ${b.length}`);
    ok(b.every((x) => x.completa), "Q9b algum bloco veio incompleto");
    ok(b[0].tipo === "ce" && b[0].gabarito === "C", "Q9c 'Sim' nao virou Certo");
    ok(b[1].tipo === "ce" && b[1].gabarito === "E", "Q9d 'Nao' nao virou Errado");
    ok(b[2].tipo === "me" && b[2].opcoes.length === 3 && b[2].gabarito === "B",
       "Q9e a questao de multipla escolha na linha corrida nao foi separada");
    ok(b[2].opcoes[0].txt === "Falta de previsao no PPA.",
       `Q9f a opcao A saiu errada: ${JSON.stringify(b[2].opcoes[0].txt)}`);
    ok(/Rosa Weber/.test(b[2].comentario), "Q9g o comentario nao foi separado do gabarito");
    /* o parentese NAO e sempre banca: o detector nao pode chutar */
    ok(b[3].rotulo === "Questao de Pegadinha",
       "Q9h o rotulo do parentese nao foi guardado como esta");
    ok(b.every((x) => x.banca === undefined),
       "Q9i o detector inventou uma banca que nao sabe qual e");
    /* e NADA de falso positivo */
    ok(!b.some((x) => /Texto comum/.test(x.enunciado)), "Q9j pegou texto corrido");
    ok(!b.some((x) => /Vedacoes/.test(x.enunciado)), "Q9k pegou um titulo com dois pontos");
    ok(!b.some((x) => /pergunta retorica/.test(x.enunciado)),
       "Q9l pegou pergunta retorica sem marcador de resposta");
  }

  /* ---- Q10: cabecalho sem resposta NAO e respondivel ----
   * Ele passou a ser DEVOLVIDO como bloco incompleto, porque o gabarito
   * pode vir numa secao "GABARITO COMENTADO" mais abaixo. O que nao pode
   * e virar questao respondivel sem gabarito. */
  {
    const b = q.qsNoTexto([
      "**Questao 9 (FGV):** Enunciado que nunca recebe resposta.",
      "", "Outro paragrafo qualquer.",
    ].join("\n"));
    ok(b.filter((x) => x.completa).length === 0,
       "Q10 cabecalho sem gabarito virou questao respondivel");
    ok(q.qsDeBlocos(b, {}).length === 0,
       "Q10b bloco incompleto foi parar no banco");
  }

  /* ---- Q10b: secao "GABARITO COMENTADO" a parte ----
   * Material de estudo separa as questoes das respostas. Ali cada linha e
   * "Questao 1: Gabarito B", que COMECA com "Questao" e era lida como um
   * cabecalho novo — deixando a questao de cima sem gabarito. */
  {
    const T = [
      "#### **Questao 1: Restos a pagar**",
      "O gestor pode deixar de inscrever? A) Sim. B) Nao. C) Depende.",
      "",
      "#### **Questao 2: Emendas Pix**",
      "As emendas Pix integram a receita para reparticao?",
      "",
      "#### **GABARITO COMENTADO**",
      "",
      "#### **Questao 1: Gabarito B**",
      "**Fundamentacao**: normas de reproducao obrigatoria.",
      "",
      "#### **Questao 2: Gabarito Nao**",
      "**Fundamentacao**: Art. 166-A, 1o.",
    ].join("\n");
    const b = q.qsNoTexto(T);
    ok(b.length === 2, `Q10c esperava 2 questoes, veio ${b.length}`);
    ok(b.every((x) => x.completa), "Q10d o gabarito da secao a parte nao chegou");
    ok(b[0].gabarito === "B" && b[0].tipo === "me",
       "Q10e a letra do gabarito nao voltou para a questao certa");
    ok(b[1].gabarito === "E", "Q10f 'Gabarito Nao' nao virou Errado");
    ok(/reproducao obrigatoria/.test(b[0].comentario),
       "Q10g a fundamentacao nao virou comentario");
    ok(!/COMENTADO/.test(b[1].comentario),
       "Q10h o titulo da secao entrou no comentario");
    ok(b[0].num === "1" && b[1].num === "2",
       "Q10i o numero da questao nao foi guardado, e e por ele que o gabarito acha o dono");
  }

  /* ---- Q10j: o titulo com #### nao pode esconder a questao ---- */
  {
    const b = q.qsNoTexto("#### **Questao 5 (FGV):** Enunciado?\n* **Resposta: Sim.** ok.");
    ok(b.length === 1 && b[0].completa,
       "Q10j questao escrita como titulo markdown nao foi reconhecida");
  }

  /* ---- Q11: resposta sem gabarito reconhecivel fica INCOMPLETA ---- */
  {
    const b = q.qsNoTexto([
      "**Questao 9 (FGV):** Enunciado.",
      "* **Resposta:** depende do caso concreto.",
    ].join("\n"));
    ok(b.length === 1 && b[0].completa === false,
       "Q11 resposta sem C/E/letra devia ficar incompleta, nao respondivel");
  }

  /* ---- Q12: blocos do texto entram no banco pelo mesmo caminho ---- */
  {
    const loja4 = {}; q.qsCarregar((k) => loja4[k]);
    const g4 = (k, v) => { loja4[k] = v; };
    const b = q.qsNoTexto([
      "**Questao 1 (FGV):** Enunciado do texto.",
      "* **Resposta: Sim.** Comentario.",
    ].join("\n"));
    const conv = q.qsDeBlocos(b, CTX);
    ok(conv.length === 1 && conv[0].origem === "texto",
       "Q12 a questao vinda do texto nao foi marcada como tal");
    ok(conv[0].chave === CTX.chave, "Q12b perdeu o topico no caminho");
    q.qsAplicar(conv, g4);
    ok(q.qsTodas().length === 1, "Q12c nao gravou");
    q.qsAplicar(q.qsDeBlocos(b, CTX), g4);
    ok(q.qsTodas().length === 1, "Q12d importar de novo duplicou");
  }

  /* ---- Q13: numeracao do prompt sem repetir ---- */
  {
    const fs = require("fs");
    const path = require("path");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const pt = (i18n.match(/"qs_prompt":\s*"((?:[^"\\]|\\.)*)"/) || [, ""])[1];
    const nums = (pt.match(/\\n(\d)\./g) || []).map((x) => x.slice(2, 3));
    ok(nums.length > 3, "Q13 nao consegui ler as regras do prompt");
    ok(nums.length === new Set(nums).size,
       "Q13b o prompt tem numero de regra repetido: " + nums.join(","));
  }

  /* ---- Q14: a conta por topico nao pode depender de acento ----
   * O atalho da agenda dizia 4 questoes onde havia 12: metade estava
   * gravada com a chave acentuada e a outra sem, e o contador tratava as
   * duas como topicos diferentes. */
  {
    const loja5 = {}; q.qsCarregar((k) => loja5[k]);
    const g5 = (k, v) => { loja5[k] = v; };
    const comAcento = "direito financeiro›leis orçamentárias";
    const semAcento = "direito financeiro›leis orcamentarias";
    q.qsAplicar([
      { tipo: "ce", enunciado: "Uma.", gabarito: "C", chave: comAcento },
      { tipo: "ce", enunciado: "Duas.", gabarito: "C", chave: comAcento },
      { tipo: "ce", enunciado: "Tres.", gabarito: "C", chave: semAcento },
    ], g5);
    ok(q.qsTodas().length === 3, "Q14 nao gravou as tres");
    ok(q.qsContarDoTopico(comAcento) === 3,
       `Q14b perguntando com acento devia achar 3, achou ${q.qsContarDoTopico(comAcento)}`);
    ok(q.qsContarDoTopico(semAcento) === 3,
       `Q14c perguntando sem acento devia achar 3, achou ${q.qsContarDoTopico(semAcento)}`);
    ok(q.qsFiltrar({ chave: comAcento }).length === 3,
       "Q14d o filtro por topico tambem tem de juntar as duas formas");
    ok(q.qsContarPorChave()[comAcento] === 3,
       "Q14e o mapa de contagem por chave discorda da contagem direta");
    ok(q.qsContarDoTopico("direito financeiro›outro topico") === 0,
       "Q14f passou a contar topico que nao e o pedido");
  }

  /* ---- Q15: questao sem topico nao some da vista ---- */
  {
    const loja6 = {}; q.qsCarregar((k) => loja6[k]);
    const g6 = (k, v) => { loja6[k] = v; };
    q.qsAplicar([
      { tipo: "ce", enunciado: "Com topico.", gabarito: "C", chave: "d›t" },
      { tipo: "ce", enunciado: "Sem topico nenhum.", gabarito: "C", chave: "" },
    ], g6);
    ok(q.qsSemTopico().length === 1,
       "Q15 as questoes sem topico ficaram invisiveis");
    ok(q.qsContarDoTopico("d›t") === 1,
       "Q15b a sem topico entrou na conta de um topico que nao e dela");
  }

  /* =====================================================================
   * Q16: MODO SOLTO — texto de prova já pronto, sem a palavra "Questão"
   *
   * O CASO REAL: um texto copiado de um PDF de questões comentadas, cada
   * uma no formato "(banca/ano) enunciado" + alternativas a)...e) +
   * "Comentário: ..." (campo PRÓPRIO, antes do gabarito) + "Gabarito: X"
   * (às vezes por extenso, "Gabarito: Letra E"). qsNoTexto SEM {solto:true}
   * nunca reconhecia nada disso — faltava a palavra "Questão".
   * ===================================================================== */
  {
    const TEMA299 = [
      "(SEFAZ-RJ-Auditor/2025) Segundo o entendimento majoritário do Supremo Tribunal Federal (STF), o sistema",
      "vigente de classificação de tributos quanto à sua espécie segue a teoria",
      "a) dicotômica.",
      "b) tricotômica.",
      "c) bipartite.",
      "d) tripartite.",
      "e) pentapartite.",
      "Comentário: O Supremo Tribunal Federal adota a teoria pentapartite para classificar os tributos, conforme",
      "interpretação do art. 145 da Constituição Federal. Assim, reconhece-se cinco espécies tributárias: impostos,",
      "taxas, contribuições de melhoria, empréstimos compulsórios e contribuições especiais (estas últimas",
      "previstas nos arts. 149 e 195 da CF).",
      "Gabarito: Letra E",
    ].join("\n");
    /* ---- Q16a: SEM opts.solto, nada disso vira questão (opt-in de propósito) ---- */
    const semSolto = q.qsNoTexto(TEMA299);
    ok(!semSolto.some((b) => b.completa),
       "Q16a sem {solto:true} o texto solto nao pode virar questao sozinho");

    /* ---- Q16b: COM opts.solto, a questao inteira e' reconhecida ---- */
    const b1 = q.qsNoTexto(TEMA299, { solto: true });
    ok(b1.length === 1 && b1[0].completa, "Q16b a questao do Tema 299 nao foi reconhecida: " + JSON.stringify(b1));
    ok(b1[0].rotulo === "SEFAZ-RJ-Auditor/2025",
       "Q16c o parentese do inicio nao virou rotulo: " + JSON.stringify(b1[0].rotulo));
    ok(/^Segundo o entendimento/.test(b1[0].enunciado) && /teoria$/.test(b1[0].enunciado),
       "Q16d o enunciado em duas linhas nao foi juntado: " + JSON.stringify(b1[0].enunciado));
    ok(b1[0].tipo === "me" && b1[0].opcoes.length === 5 && b1[0].opcoes[4].letra === "E",
       "Q16e as 5 alternativas em minuscula nao foram lidas: " + JSON.stringify(b1[0].opcoes));
    ok(b1[0].gabarito === "E", "Q16f 'Gabarito: Letra E' nao virou E: " + b1[0].gabarito);
    ok(/adota a teoria pentapartite/.test(b1[0].comentario) && !/^Gabarito/.test(b1[0].comentario),
       "Q16g o comentario (campo proprio, ANTES do gabarito) nao foi lido: " + JSON.stringify(b1[0].comentario));

    /* ---- Q16h: comentario em VARIOS PARAGRAFOS (um por alternativa) ---- */
    const PGECE = [
      "A natureza jurídica específica do tributo é determinada",
      "a) pela denominação estabelecida na Constituição.",
      "b) pela destinação do produto da sua arrecadação.",
      "c) pelas características formais fixadas em lei tributária.",
      "d) pelo fato gerador da respectiva obrigação.",
      "e) pelos sujeitos ativo e passivo da obrigação.",
      "Comentário: A questão trata dos critérios para determinação da natureza jurídica dos tributos.",
      "Letra A: Errada. A denominação não determina a natureza jurídica do tributo, art. 4º, I, do CTN.",
      "Letra D: Correta. Conforme o art. 4º do CTN, a natureza jurídica específica do tributo é determinada",
      "pelo fato gerador da respectiva obrigação.",
      "Gabarito: D",
    ].join("\n");
    const b2 = q.qsNoTexto(PGECE, { solto: true });
    ok(b2.length === 1 && b2[0].completa && b2[0].gabarito === "D",
       "Q16h a segunda questao (gabarito por extenso curto) nao foi reconhecida: " + JSON.stringify(b2));
    ok(/Letra A: Errada/.test(b2[0].comentario) && /Letra D: Correta/.test(b2[0].comentario),
       "Q16i o comentario em varios paragrafos nao foi todo juntado: " + JSON.stringify(b2[0].comentario));
    ok(!b2[0].rotulo, "Q16j sem parentese no inicio, nao pode inventar rotulo");

    /* ---- Q16k: as DUAS questoes, uma atras da outra, no mesmo texto colado ---- */
    const juntas = q.qsNoTexto([TEMA299, PGECE].join("\n"), { solto: true });
    ok(juntas.length === 2 && juntas.every((b) => b.completa),
       "Q16k as duas questoes coladas juntas deviam virar 2 blocos completos: " + JSON.stringify(juntas.map((b) => b.completa)));
    const conv = q.qsDeBlocos(juntas, CTX);
    ok(conv.length === 2 && conv.every((c) => c.origem === "texto" && c.chave === CTX.chave),
       "Q16l a conversao para o formato do banco perdeu alguma questao ou o topico");
  }

  /* ---- Q17: MODO SOLTO nao contamina o formato da IA na mesma caixa ----
   * O DEFEITO REAL (pego pelos testes de tela): sem essa guarda, o modo
   * solto lia "[QUESTAO]"/"TIPO:"/"BANCA:" como enunciado corrido comum, e
   * a linha "A) opcao" da IA virava uma opcao de uma questao FANTASMA que
   * fechava sozinha no "GABARITO: ..." dela — acrescentando um achado
   * mutilado por cima do que qsLerResposta ja tinha lido certo. */
  {
    const RESPOSTA_IA = [
      "[QUESTAO]",
      "TIPO: ME",
      "BANCA: FGV",
      "ENUNCIADO: Qual o fundamento?",
      "A) PPA",
      "B) Transparencia",
      "GABARITO: B",
      "COMENTARIO: Postulados republicanos.",
      "[/QUESTAO]",
    ].join("\n");
    const lida = q.qsLerResposta(RESPOSTA_IA, CTX);
    ok(lida.achados.length === 1, "Q17 premissa: a IA formatada continua lendo 1 questao normalmente");
    const soltoSobreRespostaIA = q.qsNoTexto(RESPOSTA_IA, { solto: true });
    ok(soltoSobreRespostaIA.some((b) => b.completa),
       "Q17b premissa: sem guarda, o modo solto TAMBEM acha algo nesse texto (por isso a guarda mora na tela)");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const f = testes();
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\nquestoes: ${f.length} FALHA(S)\n`
    : `\nquestoes: formato, gravacao e sessao ok (${f.quantas} verificacoes)\n`);
  process.exit(f.length ? 1 : 0);
}
