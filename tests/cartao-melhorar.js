/* CARTÕES: APAGAR SEM ESTRAGO, E CORRIGIR COM PRÉVIA.
 *
 * Os dois defeitos que originaram este arquivo vieram da mesma tela:
 * apagar o segundo cartão respondia "não achei esse cartão no texto
 * salvo", e o cartão que se queria apagar era a REGRA nº 3 do prompt
 * de geração, copiada de volta pela IA. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const apagarOPrimeiro = async (api) => {
    const p = api.mcApagarCartao(0);
    api.uiModalResponder(true);
    await new Promise((r) => setTimeout(r, 0));
    api.uiModalResponder(true);
    await p;
  };

  /* ---- C1: apagar cartao de LACUNA ----
   * A busca comparava a frente JA PROCESSADA ("[...]") com o texto CRU
   * ("{{c1::30 dias}}"). Nunca casavam. Por isso so o primeiro apagava:
   * ele era um cartao comum, os seguintes eram cloze. */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matGravarCartoes(ch, [
      "Comum :: Resposta",
      "O prazo e de {{c1::30 dias}} :: obs",
      "Outra lacuna {{c1::valor}} :: obs2",
      "Ultimo :: Z",
    ].join("\n"), { disciplina: "D", topico: "T" });
    api.mcEstudarDireto("D", "T");
    ok(api.mcCartoesSalvos().length === 4, "C1-pre deviam existir 4 cartoes");

    for (let k = 0; k < 3; k++) {
      const antes = api.mcCartoesSalvos().length;
      await apagarOPrimeiro(api);
      const dep = api.mcCartoesSalvos().length;
      ok(dep === antes - 1,
         `C1 a ${k + 1}a exclusao nao apagou nada (${antes} -> ${dep}) — `
         + "era o caso do cartao de lacuna, que nunca casava com o texto cru");
    }
    ok(api.mcCartoesSalvos().length === 1, "C1b sobrou numero errado de cartoes");
    ok(api.mcCartoesSalvos()[0].front === "Ultimo",
       "C1c apagou o cartao errado: sobrou " + api.mcCartoesSalvos()[0].front);
  }

  /* ---- C2: apagar leva junto o que e do cartao ----
   * Apagar uma linha so deixava o "+ saiba mais" orfao — e o leitor
   * junta o "+" ao cartao ACIMA dele, entao a explicacao passava a
   * grudar no cartao SEGUINTE. O cartao errado ganhava um "saiba mais"
   * que nao era dele, sem ninguem ver. */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matGravarCartoes(ch, [
      "@ Titulo do primeiro",
      "Com saiba mais :: Resposta",
      "+ Explicacao que e DELE",
      "+ Segunda linha da explicacao",
      "Vizinho de baixo :: Resposta B",
    ].join("\n"), { disciplina: "D", topico: "T" });
    api.mcEstudarDireto("D", "T");
    const antes = api.mcCartoesSalvos();
    ok(antes.length === 2, `C2-pre deviam existir 2 cartoes, ha ${antes.length}`);
    ok(!String(antes[1].more || "").trim(),
       "C2-pre2 o vizinho ja comeca com 'saiba mais', o cenario nao discrimina");

    await apagarOPrimeiro(api);
    const dep = api.mcCartoesSalvos();
    ok(dep.length === 1, `C2 devia sobrar 1 cartao, sobrou ${dep.length}`);
    ok(dep[0].front === "Vizinho de baixo",
       "C2b sobrou o cartao errado: " + dep[0].front);
    ok(!String(dep[0].more || "").trim(),
       "C2c a explicacao do cartao apagado grudou no vizinho: "
       + String(dep[0].more || "").slice(0, 60));
    ok(!String(dep[0].titulo || "").includes("primeiro"),
       "C2d o titulo do cartao apagado grudou no vizinho");
  }

  /* ---- C3: apagar nao vai as cegas pelo numero da linha ----
   * Se o texto mudou desde que a lista foi montada, apagar pela posicao
   * apagaria OUTRO cartao — o acidente que este recurso nao pode ter. */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const bruto = ["A :: 1", "B :: 2", "C :: 3"].join("\n");
    const cards = api.parseText(bruto).cards;
    /* o cartao "C" diz que esta na linha 3; o texto agora tem uma linha
     * a mais no comeco, entao a linha 3 e o "B" */
    const outro = ["ZZZ :: 0", "A :: 1", "B :: 2", "C :: 3"].join("\n");
    const novo = api.mcTextoSemCartao(outro, cards[2]);
    ok(novo !== null, "C3 nao achou o cartao no texto deslocado");
    ok(/B :: 2/.test(novo || ""),
       "C3b apagou o cartao errado ao seguir o numero da linha as cegas: " + novo);
    ok(!/C :: 3/.test(novo || ""), "C3c nao apagou o cartao pedido");
  }

  /* ---- C4: o detector reconhece a REGRA DO PROMPT virada cartao ----
   * O caso real: a frente do cartao era a regra numero 3 do proprio
   * prompt de geracao, que a IA copiou de volta. */
  {
    const { api } = rodar();
    const regra = { front: "3. Cartões de omissão (cloze): envolva o termo a "
      + "memorizar em [...]. Cada lacuna do MESMO cartão usa um número DIFERENTE.",
      back: "obs", tags: [] };
    const d = api.cmDefeitosDoCartao(regra).map((x) => x.id);
    ok(d.indexOf("prompt") >= 0,
       "C4 nao reconheceu a regra do prompt travestida de cartao: " + JSON.stringify(d));
    ok(d.indexOf("numerado") >= 0, "C4b nao viu a numeracao '3. ' no comeco");

    const bom = { front: "Qual o prazo para inscrever restos a pagar?",
                  back: "Ate 31 de dezembro", tags: [] };
    ok(api.cmDefeitosDoCartao(bom).length === 0,
       "C4c acusou defeito num cartao bom: "
       + JSON.stringify(api.cmDefeitosDoCartao(bom).map((x) => x.id)));

    /* meia pergunta: sem verso e sem lacuna nao ha o que conferir */
    ok(api.cmDefeitosDoCartao({ front: "Restos a pagar", back: "", tags: [] })
       .some((x) => x.id === "sem_verso"),
       "C4d cartao sem verso e sem lacuna passou como bom");
    /* mas lacuna sem verso e legitima */
    ok(!api.cmDefeitosDoCartao({ front: "O prazo e {{c1::31/12}}", back: "", tags: [] })
       .some((x) => x.id === "sem_verso"),
       "C4e acusou 'sem verso' num cartao de lacuna, onde isso e normal");
    /* duas lacunas com o mesmo numero viram uma so no Anki */
    ok(api.cmDefeitosDoCartao({ front: "{{c1::A}} e {{c1::B}}", back: "", tags: [] })
       .some((x) => x.id === "cloze_repetida"),
       "C4f nao viu duas lacunas com o mesmo numero");
  }

  /* ---- C5: corrigir mostra ANTES e DEPOIS, e so aplica depois ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matGravarCartoes(ch, [
      "3. Cartões de omissão: envolva o termo a memorizar em [...] :: obs",
      "Bom :: Resposta boa",
    ].join("\n"), { disciplina: "D", topico: "T" });
    api.mcEstudarDireto("D", "T");

    const bm = api.$("btnMcEstMelhorar");
    ok(!!bm && bm.hidden === false, "C5 falta o botao de melhorar o cartao");
    ok(/\d/.test(bm.textContent || ""),
       "C5b o botao nao avisa quantos problemas tem: " + bm.textContent);
    ok(/qm-alerta/.test(bm.className || ""),
       "C5c cartao com defeito nao se anuncia");

    bm.onclick();
    ok(api.$("dlgMcMelhorar").open === true, "C5d a janela de correcao nao abriu");
    const pr = api.$("cmMelPrompt").value || "";
    ok(/pergunta :: resposta/.test(pr),
       "C5e o prompt nao ensina o formato que o app sabe ler");
    ok(!/\{defeitos\}|\{atual\}/.test(pr), "C5f sobrou marcador no prompt");

    /* colagem que nao e cartao nao vira cartao */
    api.$("cmMelColar").value = "desculpe, nao entendi";
    api.$("btnCmMelConferir").onclick();
    api.uiModalResponder(true);
    ok(api.$("btnCmMelAplicar").hidden === true,
       "C5g resposta que nao e cartao habilitou o aplicar");

    const antesTexto = String(api.matResumosAtual()[ch].cartoes || "");
    api.$("cmMelColar").value = "Qual o prazo para inscrever restos a pagar? :: Ate 31/12";
    api.$("btnCmMelConferir").onclick();
    ok(api.$("cmMelComparar").hidden === false,
       "C5h nao mostrou o antes e o depois — aplicar as cegas e confiar na IA "
       + "justamente onde ela ja errou");
    const lados = api.$("cmMelComparar").querySelectorAll(".qm-lado");
    ok(lados.length === 2, `C5i deviam ser dois lados, sao ${lados.length}`);
    ok(/Cart[õo]es de omiss/.test(lados[0].textContent || ""),
       "C5j o lado 'como esta' nao mostra o cartao atual");
    ok(/restos a pagar/i.test(lados[1].textContent || ""),
       "C5k o lado 'como ficaria' nao mostra a versao nova");
    ok(String(api.matResumosAtual()[ch].cartoes || "") === antesTexto,
       "C5l conferir ja gravou — nada pode mudar antes de aplicar");

    api.$("btnCmMelAplicar").onclick();
    api.uiModalResponder(true);
    const depois = api.mcCartoesSalvos();
    ok(depois.length === 2, `C5m deviam continuar 2 cartoes, ha ${depois.length}`);
    ok(depois.some((c) => /restos a pagar/i.test(c.front)),
       "C5n o cartao corrigido nao entrou");
    ok(!depois.some((c) => /Cart[õo]es de omiss/.test(c.front)),
       "C5o o cartao ruim continua la");
    ok(depois.some((c) => c.front === "Bom"),
       "C5p a correcao levou junto o cartao que estava bom");
  }

  /* ---- C6: a IA devolve VARIOS cartoes ----
   * Para um cartao longo demais, devolver tres e a correcao certa —
   * "um cartao por ideia". Descartar em silencio joga fora o trabalho. */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matGravarCartoes(ch, "Tres ideias juntas :: R", { disciplina: "D", topico: "T" });
    api.mcEstudarDireto("D", "T");
    api.$("btnMcEstMelhorar").onclick();
    api.$("cmMelColar").value = ["Ideia um? :: A", "Ideia dois? :: B", "Ideia tres? :: C"]
      .join("\n");
    api.$("btnCmMelConferir").onclick();

    ok(api.$("cmMelExtras").hidden === false,
       "C6 os cartoes extras foram descartados em silencio");
    ok(/2/.test(api.$("cmMelExtras").textContent || ""),
       "C6b o aviso nao diz quantos sobraram");
    ok(api.$("btnCmMelAplicarTodos").hidden === false,
       "C6c falta a saida para acrescentar os extras");

    api.$("btnCmMelAplicarTodos").onclick();
    api.uiModalResponder(true);
    ok(api.mcCartoesSalvos().length === 3,
       `C6d deviam existir 3 cartoes, ha ${api.mcCartoesSalvos().length}`);
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "cartao-melhorar", 60000).then((f) => {
    f.forEach((m) => console.log("  FALHA  " + m));
    console.log(f.length ? `\ncartao-melhorar: ${f.length} FALHA(S)\n`
      : `\ncartao-melhorar: apagar e corrigir ok (${f.quantas} verificacoes)\n`);
    process.exit(f.length ? 1 : 0);
  });
}
