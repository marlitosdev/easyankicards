/* QUATRO DEFEITOS QUE SÓ O USO REAL MOSTROU.
 *
 * Vieram de uma sessão com 133 tópicos contra 533, 250 duplas triadas e
 * 523 vínculos guardados — e nenhum deles aparece em cenário pequeno:
 *
 * 1. DEPOIS DE TRIAR, A TELA MENTIA PELA METADE. vzTriar repintava o
 *    resumo ("250 duplas, a escolha por disciplina não é mais
 *    necessária") e não repintava o modo: a faixa de disciplinas
 *    continuava na tela e o passo 1 continuava dizendo "Criar prompt
 *    DESTA disciplina". A frase dizia uma coisa e o botão outra.
 *
 * 2. O APP CHUTAVA A DISCIPLINA CORRESPONDENTE. Sem par plausível ele
 *    caía na primeira da lista, e na tela real casou "Sistema
 *    Tributário Brasileiro" com "Ciência de Dados". A função de
 *    sugestão foi escrita para NÃO chutar; a tela reintroduzia o chute
 *    na linha seguinte, com "|| dB[0]".
 *
 * 3. O CORTE DA FAXINA ERA CIRCULAR. Os vínculos nascem de uma triagem
 *    que descarta tudo abaixo de 0,60 — então nenhum pode estar abaixo
 *    de 0,60, e medir de novo com o mesmo número nunca marca nada. No
 *    uso real: 523 medidos, ZERO abaixo do corte, o mais frouxo da base
 *    em 89%. A ferramenta respondia "está tudo ótimo" porque perguntava
 *    com a régua que tinha selecionado.
 *
 * 4. A TELA ABRIA COM O AVISO VERMELHO. Sem edital aberto, os dois
 *    seletores caíam no mesmo concurso, e o primeiro que se via era
 *    "escolha dois editais diferentes". Aviso antes de qualquer gesto
 *    não é aviso: é configuração errada com cara de erro do usuário. */
const { rodar } = require("./fumaca.js");

const V = (a, b, c) => [a, b, c];

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const redeFalsa = (mapa) => async (url, init) => {
    const corpo = JSON.parse(init.body);
    return { ok: true, json: async () => ({
      embeddings: corpo.requests.map((r) => {
        const txt = r.content.parts[0].text;
        const achou = Object.keys(mapa).filter((k) => txt.indexOf(k) >= 0)[0];
        return { values: (mapa[achou] || V(0, 0, 1)).slice() };
      }) }) };
  };

  /* DISCIPLINAS SEM PARENTESCO NENHUM entre os dois editais — que é o
   * caso real: "Sistema Tributário Brasileiro" e "Ciência de Dados". */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    api.diarioPor([]);
    const iss = api.edCriar("ISS", "# ISS Caruaru | prova: " + daqui(88)
      + " | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n"
      + "+ Lançamento :: 5 :: pq\n+ Domicílio tributário :: 4 :: pq");
    const sefaz = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + daqui(109)
      + " | horas: 20\n@ Ciência de Dados :: 5\n"
      + "+ Bancos de dados relacionais :: 5 :: pq\n"
      + "@ Direito Tributário :: 4\n+ Revisão do lançamento :: 5 :: pq");
    return { iss, sefaz };
  };

  /* ================================================================
   * U1: A TELA ABRE SEM O AVISO VERMELHO
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    /* SEM EDITAL ABERTO — é o caso que produzia o defeito: "abertoId"
     * vinha vazio e os dois seletores caíam no primeiro da lista. */
    api.hubVoltar();
    api.vkIniciarTela();
    api.vkAbrir();

    const de = String(api.$("vkDeEdital").value || "");
    const para = String(api.$("vkParaEdital").value || "");
    ok(de && para,
       "U1-pre os seletores abriram vazios: " + de + " / " + para);
    ok(de !== para,
       "U1 a tela abriu com o mesmo edital dos dois lados: " + de);
    /* e portanto o aviso não pode estar na tela */
    ok(!/dois editais diferentes/i.test(api.$("vkResumo").textContent || ""),
       "U1b a tela abriu ja mostrando o aviso de edital repetido: "
       + api.$("vkResumo").textContent);
  }

  /* ---- U2: com um edital aberto, o outro lado é outro ---- */
  {
    const { api } = rodar();
    const { iss } = montar(api);
    api.hubAbrirEdital(iss.id);
    api.vkIniciarTela();
    api.vkAbrir();
    ok(String(api.$("vkParaEdital").value) === String(iss.id),
       "U2 o edital aberto nao ficou no lado de destino");
    ok(String(api.$("vkDeEdital").value) !== String(iss.id),
       "U2b o edital aberto ficou nos dois lados");
  }

  /* ================================================================
   * U3: SEM PAR PLAUSÍVEL, O APP NÃO CHUTA
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss, sefaz } = montar(api);
    api.vkIniciarTela();
    api.vkAbrir();
    api.$("vkDeEdital").value = String(iss.id);
    api.$("vkParaEdital").value = String(sefaz.id);
    api.vkTrocarModo("ambos");

    ok(api.$("vkDeDisc").value === "Sistema Tributário Brasileiro",
       "U3-pre a disciplina de origem veio errada: "
       + api.$("vkDeDisc").value);
    /* "Sistema Tributário Brasileiro" não tem par plausível do outro
     * lado — a função de sugestão devolve vazio, e a tela tem de
     * respeitar isso em vez de cair na primeira da lista. */
    ok(api.$("vkParaDisc").value === "",
       "U3 sem par plausivel a tela chutou uma disciplina qualquer: "
       + api.$("vkParaDisc").value);
    /* e o seletor PEDE a escolha, em vez de ficar em branco sem dizer
     * o que se espera */
    /* as opções vivem nos filhos do <select> no simulador, como no
     * navegador — "options" é uma coleção que o stub não mantém */
    const op = Array.from(api.$("vkParaDisc").children || [])[0];
    ok(op && /escolha/i.test(op.textContent || ""),
       "U3b o seletor vazio nao pede a escolha: "
       + JSON.stringify(op && op.textContent));
  }

  /* ================================================================
   * U4: DEPOIS DE TRIAR, A TELA INTEIRA MUDA
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss, sefaz } = montar(api);
    api.vzGuardarChave("x");
    api.vkIniciarTela();
    api.vkAbrir();
    api.$("vkDeEdital").value = String(iss.id);
    api.$("vkParaEdital").value = String(sefaz.id);
    api.vkTrocarModo("ambos");
    ok(api.$("vkDiscs").hidden === false,
       "U4-pre a faixa de disciplinas nao aparece antes de triar");

    await conduzir(api, api.vzTriar({ chave: "x", buscar: redeFalsa({
      "Lançamento": V(1, 0, 0),
      "Revisão do lançamento": V(0.98, 0.2, 0),
      "Domicílio tributário": V(0, 1, 0),
      "Bancos de dados relacionais": V(0, 0, 1),
    }) }));

    ok(api.vzDuplasAtuais.length > 0,
       "U4-pre2 a triagem nao achou dupla nenhuma");
    /* A FAIXA DE DISCIPLINAS SOME. Triado, o recorte por disciplina
     * deixou de valer — e deixá-lo na tela sugere que ele ainda manda
     * em alguma coisa. */
    ok(api.$("vkDiscs").hidden === true,
       "U4 depois de triar a faixa de disciplinas continua na tela");
    /* E O PASSO 1 PARA DE DIZER "DESTA DISCIPLINA". A frase do resumo
     * já dizia "a escolha por disciplina não é mais necessária"; o
     * botão logo abaixo continuava dizendo o contrário. */
    ok(!/desta disciplina/i.test(api.$("btnVkPrompt").textContent || ""),
       "U4b o passo 1 continua falando em disciplina depois de triar: "
       + api.$("btnVkPrompt").textContent);
    ok(!/uma disciplina por vez/i.test(api.$("vkPromptExp").textContent || ""),
       "U4c a explicacao do passo 1 continua falando em disciplina: "
       + api.$("vkPromptExp").textContent);
  }

  /* ================================================================
   * U5: O CORTE DA FAXINA É RELATIVO À BASE
   * ============================================================== */
  {
    const { api } = rodar();

    /* O CASO REAL: todos altos, porque nasceram de uma triagem que já
     * cortou em 0,60. Um corte fixo em 0,60 marcaria ZERO. */
    const todosAltos = [0.89, 0.90, 0.90, 0.91, 0.93, 0.94, 0.95, 0.97,
                        0.98, 0.99];
    const corte = api.vkRevCorteDe(todosAltos);
    ok(corte !== null,
       "U5 com todos os scores altos o corte desistiu de marcar");
    ok(corte < 0.92,
       "U5b o corte relativo nao ficou no rodape da base: " + corte);
    const marcados = todosAltos.filter((x) => x <= corte).length;
    ok(marcados >= 1 && marcados <= 3,
       "U5c o corte relativo marcou uma fatia estranha da base: "
       + marcados + " de " + todosAltos.length);

    /* UM CORTE FIXO EM 0,60 NÃO MARCARIA NADA — é a prova de que o
     * problema era circular, e não de calibragem. */
    ok(todosAltos.filter((x) => x < 0.6).length === 0,
       "U5d o cenario nao reproduz o caso real (nada abaixo de 0,6)");

    /* E COM VÍNCULOS DE VERDADE FROUXOS, eles é que sobem. */
    const misto = [0.31, 0.42, 0.88, 0.90, 0.91, 0.93, 0.95, 0.96,
                   0.97, 0.98];
    const c2 = api.vkRevCorteDe(misto);
    ok(c2 !== null && misto.filter((x) => x <= c2).every((x) => x < 0.6),
       "U5e com frouxos de verdade na base o corte nao os isolou: " + c2);

    /* O TETO DE SEGURANÇA: se até o rodapé está colado, não há faxina
     * automática a fazer, e o app diz isso em vez de marcar por marcar. */
    ok(api.vkRevCorteDe([0.98, 0.99, 0.99, 1]) === null,
       "U5f uma base inteira colada ainda produziu marcacao automatica");
    ok(api.vkRevCorteDe([]) === null,
       "U5g base vazia produziu corte");
  }

  /* ================================================================
   * U6: TODO BOTÃO REAGE
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss, sefaz } = montar(api);
    /* um vínculo mudo: para "marcar os que não levam a nada" ter o que
     * marcar, é preciso um concurso encerrado e vazio */
    const velho = api.edCriar("TCE", "# TCE-PE | prova: " + daqui(-40)
      + " | horas: 20\n@ Antigo :: 5\n+ Assunto encerrado :: 5 :: pq");
    api.vkAplicar([{
      de: { chave: api.vkChave("Sistema Tributário Brasileiro", "Lançamento") },
      para: { chave: api.vkChave("Antigo", "Assunto encerrado") },
      conf: "ALTA" }], velho.id, "ambos");
    api.vkIniciarTela();
    api.vkRevAbrir();

    /* A FAXINA VIROU DOIS GESTOS: escolher a aba "sem historico" e marcar
     * o que ela mostra. Antes um botao so varria a base inteira e marcava
     * coisas fora da vista. */
    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    /* A REAÇÃO NO PRÓPRIO BOTÃO. Marcar caixas lá embaixo, fora da
     * vista, sem sinal nenhum, faz a pessoa apertar de novo.
     *
     * Ela é lida pela ÚLTIMA REAÇÃO GUARDADA, e não pelo texto do
     * botão: no simulador o setTimeout roda na hora, então o rótulo
     * volta ao normal antes de qualquer asserção conseguir vê-lo. Ler o
     * transiente aqui seria medir o relógio do simulador, não o
     * comportamento. */
    ok(api.vkUltimaReacaoAtual(),
       "U6 marcar os mudos nao deu sinal nenhum");
    ok(/1/.test(api.vkUltimaReacaoAtual()),
       "U6b a reacao nao diz quantos foram marcados: "
       + api.vkUltimaReacaoAtual());
    ok(/✓/.test(api.vkUltimaReacaoAtual()),
       "U6c a reacao nao confirma visualmente: "
       + api.vkUltimaReacaoAtual());

    /* A BARRA DO QUE ESTÁ MARCADO aparece junto. */
    ok(api.$("vkRevBarra").hidden === false,
       "U6d marcou e a barra de selecao nao apareceu");
    ok(/1/.test(api.$("vkRevBarraConta").textContent || ""),
       "U6e a barra nao diz quantos estao marcados: "
       + api.$("vkRevBarraConta").textContent);

    /* DESMARCAR TAMBÉM REAGE, e a barra some. */
    api.vkRevDesmarcar();
    ok(api.$("vkRevBarra").hidden === true,
       "U6f desmarcou tudo e a barra continuou na tela");
    ok(/desmarcad/i.test(api.vkUltimaReacaoAtual()),
       "U6g desmarcar nao deu sinal: " + api.vkUltimaReacaoAtual());
    ok(iss && sefaz, "U6-pre");
  }

  /* ---- U7: a barra só existe quando há o que fazer com ela ---- */
  {
    const { api } = rodar();
    montar(api);
    api.vkIniciarTela();
    api.vkRevAbrir();
    ok(api.$("vkRevBarra").hidden === true,
       "U7 sem nada marcado a barra ocupa espaco na tela");
  }

  /* ---- U8: rolagem única na revisão ---- */
  {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
    const regra = (css.match(/\.vk-rev-lista\s*\{([^}]*)\}/) || [])[1] || "";
    /* O DIÁLOGO JÁ ROLA. A lista rolando por dentro criava duas barras
     * aninhadas, e o atrito de nunca saber qual delas move. */
    ok(!/overflow\s*:\s*auto/.test(regra) && !/max-height/.test(regra),
       "U8 a lista de vinculos rola por dentro do dialogo que ja rola: "
       + regra);
    /* e a caixa de marcar ganhou respiro */
    const li = (css.match(/\.vk-rev-li\s*\{([^}]*)\}/) || [])[1] || "";
    const gap = (li.match(/gap\s*:\s*(\d+)px/) || [])[1];
    ok(Number(gap) >= 10,
       "U8b a caixa de marcar continua colada no texto: gap " + gap);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
