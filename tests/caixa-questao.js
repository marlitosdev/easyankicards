/* DUAS FALTAS QUE SÓ APARECEM QUANDO SE RESPONDE QUESTÃO DE VERDADE
 *
 * 1. COPIAR A QUESTÃO DE DENTRO DA CAIXA DA DICA. Escrever a explicação
 *    com as próprias palavras costuma passar por perguntar a uma IA, e
 *    para perguntar é preciso o enunciado. Sem o botão, o caminho era
 *    fechar a caixa — PERDENDO o que já estava escrito —, copiar na
 *    tela de trás e reabrir.
 *
 * 2. O TAMANHO DA CAIXA E DA LETRA. Enunciado de concurso é texto
 *    longo, cheio de vírgula e de negativa, lido com atenção; a caixa
 *    foi dimensionada para caber em telefone. Quem precisa de letra
 *    maior precisa dela SEMPRE — então o ajuste tem de sobreviver ao
 *    fechar da sessão, senão ninguém o usa duas vezes. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* ================================================================
   * Q1: O TAMANHO GUARDADO
   * ============================================================== */
  {
    const { api } = rodar();
    api.qsUiIniciar();
    const dlg = api.$("dlgQsResponder");

    ok(api.qsTamanhoAtual() === 0,
       "Q1 nao comeca no tamanho normal: " + api.qsTamanhoAtual());
    ok(!/qs-t1|qs-t2/.test(dlg.className || ""),
       "Q1a a caixa ja nasce com uma classe de tamanho: " + dlg.className);

    api.qsTamanhoTrocar();
    ok(api.qsTamanhoAtual() === 1, "Q1b trocar nao avancou o tamanho");
    /* A CLASSE VAI NO <dialog>: e o que faz a caixa E o texto crescerem
     * juntos. Mexer so na fonte deixaria texto grande em caixa estreita
     * — mais linhas curtas, que e o que cansa. */
    ok(/qs-t1/.test(dlg.className || ""),
       "Q1c a classe do tamanho nao foi para a caixa: " + dlg.className);

    api.qsTamanhoTrocar();
    ok(/qs-t2/.test(dlg.className || ""),
       "Q1d o segundo tamanho nao chegou na caixa: " + dlg.className);
    /* AS CLASSES SAO EXCLUSIVAS. Com as duas ligadas, o tamanho passaria
     * a depender da ordem das regras no CSS, e nao da escolha. */
    ok(!/qs-t1/.test(dlg.className || ""),
       "Q1e o tamanho anterior ficou ligado junto: " + dlg.className);

    /* DA VOLTA. Sem isto, chegar no maior seria um beco: para voltar ao
     * normal so recarregando o aplicativo. */
    api.qsTamanhoTrocar();
    ok(api.qsTamanhoAtual() === 0, "Q1f o ciclo nao volta ao normal");
    ok(!/qs-t1|qs-t2/.test(dlg.className || ""),
       "Q1g voltou ao normal e a classe ficou: " + dlg.className);

    /* O BOTAO DIZ EM QUE TAMANHO ESTA. Um botao mudo obriga a apertar
     * para descobrir. */
    api.qsTamanhoTrocar();
    const rot = api.$("btnQsTamanho").textContent || "";
    ok(/A\+/.test(rot),
       "Q1h o botao nao diz o tamanho em que esta: " + rot);
  }

  /* ---- Q2: sobrevive ao fechar ---- */
  {
    const { api } = rodar();
    api.qsUiIniciar();
    api.qsTamanhoTrocar();
    ok(api.lojaLer("eac_qs_tamanho") === "1",
       "Q2 o tamanho nao foi guardado: " + api.lojaLer("eac_qs_tamanho"));
    ok(JSON.stringify(api.gruposBackup || {}).indexOf("eac_qs_tamanho") >= 0,
       "Q2a o tamanho da letra ficou de fora do backup");
  }

  /* ---- Q2b: e volta aplicado no arranque seguinte ---- */
  {
    const { api } = rodar();
    /* SEGUNDA SESSAO, com a escolha ja guardada. E o caso que importa:
     * um ajuste que se perde ao reabrir e um ajuste que se refaz toda
     * vez, e ai nao se usa. */
    api.loja.setItem("eac_qs_tamanho", "2");
    api.qsUiIniciar();
    ok(/qs-t2/.test(api.$("dlgQsResponder").className || ""),
       "Q2b a escolha guardada nao foi aplicada ao abrir de novo: "
       + api.$("dlgQsResponder").className);
  }

  /* ================================================================
   * Q3: COPIAR A QUESTÃO DE DENTRO DA CAIXA DA DICA
   * ============================================================== */
  {
    const { api } = rodar();
    /* A QUESTÃO PRECISA ESTAR NO BANCO.
     *
     * A dica não é um campo que se põe no objeto: ela é gravada por
     * qsGravarDica e lida por qsDicaDeQuestao, as duas procurando a
     * questão no banco pelo id. Com um objeto solto, gravar não grava,
     * ler devolve vazio — e "a dica não foi junto" passaria porque não
     * havia dica nenhuma, não porque o copiador a deixou de fora. */
    api.qsCarregar();
    api.qsAplicar([{
      tipo: "ce", concurso: "ISS Caruaru", banca: "FGV",
      disciplina: "Direito Tributário", topico: "Princípios",
      enunciado: "No âmbito da Reforma Tributária, a fixação de alíquotas da CBS "
        + "poderá ser feita por lei ordinária.",
      opcoes: [{ letra: "C", txt: "Certo" }, { letra: "E", txt: "Errado" }],
      gabarito: "C",
      comentario: "A competência é da lei ordinária, art. 195, § 15, da CF/88.",
    }]);
    const q = api.qsTodas()[0];
    api.qsGravarDica(q.id, "MINHA ANOTACAO ANTIGA");
    const ex = api.qsUiCopiarNaDica(q);
    ok(!!ex && typeof ex.faz === "function",
       "Q3 a caixa da dica nao recebeu o botao de copiar");
    ok(/copiar/i.test(ex.rotulo || ""),
       "Q3a o botao nao diz o que faz: " + ex.rotulo);

    const txt = ex.faz();
    ok(/CBS/.test(txt), "Q3b o enunciado nao foi copiado: " + txt.slice(0, 60));
    ok(/Errado/.test(txt), "Q3c as alternativas nao foram copiadas");
    /* UMA FRASE QUE SÓ EXISTE NO COMENTÁRIO.
     *
     * "lei ordinária" aparece TAMBÉM no enunciado, e por isso a
     * asserção passava com o comentário inteiro de fora — a sabotagem
     * que copiava sem gabarito nem comentário passou limpo. "art. 195"
     * só está no comentário. */
    ok(!/art\. 195/i.test(q.enunciado),
       "Q3d-pre a frase escolhida tambem esta no enunciado, e o teste "
       + "nao distingue comentario de enunciado");
    ok(/art\. 195/i.test(txt),
       "Q3d o comentario nao foi copiado: " + txt);
    ok(/gabarito/i.test(txt) || /Certo/.test(txt.split("Errado")[1] || ""),
       "Q3d2 o gabarito nao foi copiado: " + txt);
    /* A DICA NAO VAI JUNTO. E ela que se esta escrevendo agora, e mandar
     * para a IA o rascunho da propria resposta e pedir que ela concorde
     * com voce. */
    ok(/MINHA ANOTACAO ANTIGA/
         .test(api.plTextoDaQuestao(q, { gabarito: true, dica: true })),
       "Q3-pre com dica:true a dica tambem nao sai, entao o teste abaixo "
       + "nao mede a escolha de deixa-la fora");
    ok(!/MINHA ANOTACAO ANTIGA/.test(txt),
       "Q3e a dica foi junto no texto copiado");
  }

  /* ---- Q4: a caixa mostra o botao, e so quando ha o que copiar ----
   *
   * A CAIXA E FECHADA PELO PROPRIO BOTAO DO RODAPE, e nao pelo
   * _uiFechar: aquele resolve o dialogo generico de sim/nao, e uiTexto
   * tem os seus. Fechar pelo lugar errado deixaria a promessa pendurada
   * e o arquivo inteiro travaria sem imprimir nada. */
  {
    const { api } = rodar();
    const b = api.$("btnTxtLivreExtra");
    ok(!!b, "Q4-pre o botao extra nao existe no HTML");

    /* SEM "extra": a caixa serve a meia duzia de telas que nao tem
     * questao nenhuma para oferecer, e ali o botao nao pode aparecer. */
    const p1 = api.uiTexto("um titulo", "");
    ok(b.hidden === true,
       "Q4 a caixa sem questao mostrou o botao de copiar assim mesmo");
    api.$("btnTxtLivreNao").onclick();
    await p1;

    const p2 = api.uiTexto("Sua dica", "", null,
      { rotulo: "copiar a questão", dica: "x", faz: () => "TEXTO COPIADO" });
    ok(b.hidden === false, "Q4a a caixa da dica nao mostrou o botao");
    ok(/copiar/i.test(b.textContent || ""),
       "Q4b o botao apareceu sem rotulo: " + b.textContent);
    /* CLICAR NAO FECHA A CAIXA. E o ponto inteiro: copiar sem perder o
     * que ja estava escrito. */
    api.$("txtLivreCampo").value = "o que eu ja tinha escrito";
    b.onclick();
    ok(api.$("dlgTextoLivre").open === true,
       "Q4c copiar fechou a caixa da dica");
    ok(api.$("txtLivreCampo").value === "o que eu ja tinha escrito",
       "Q4d copiar mexeu no texto que estava sendo escrito: "
       + api.$("txtLivreCampo").value);
    api.$("btnTxtLivreNao").onclick();
    await p2;
    /* NA PRÓXIMA CAIXA SEM QUESTÃO, o botão some E O GATILHO VAI JUNTO.
     *
     * Só conferir "hidden" não bastava: a abertura seguinte reescreve
     * hidden de qualquer jeito, então a asserção passava mesmo com o
     * gatilho antigo preso — apontando para a questão da caixa
     * anterior. O que importa é que não sobre chamada nenhuma. */
    const p3 = api.uiTexto("outro titulo", "");
    ok(b.hidden === true,
       "Q4e o botao ficou visivel numa caixa que nao tem o que copiar");
    ok(!b.onclick,
       "Q4f o gatilho da caixa anterior ficou preso, apontando para a "
       + "questao errada");
    api.$("btnTxtLivreNao").onclick();
    await p3;
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
