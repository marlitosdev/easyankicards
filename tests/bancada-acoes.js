/* AS AÇÕES DA BANCADA — nomes pelo que fazem, e uma reação a cada gesto.
 *
 * Eram quatro botões cujos rótulos descreviam o GESTO e não o resultado:
 * "Criar prompt para a IA organizar o edital", "Colar plano corrigido".
 * Dois problemas de uma vez.
 *
 * O primeiro: nada dizia que eram metades do MESMO trabalho. Pedir a
 * revisão e receber a revisão eram dois botões separados por um terceiro,
 * podiam ser apertados fora de ordem, e quem apertasse só o primeiro
 * ficava com uma janela de texto na tela e nenhuma ideia do que fazer
 * depois. Agora são um caminho só, de dois passos, dentro da mesma caixa.
 *
 * O segundo: o botão do prompt ABRIA UMA JANELA COM TEXTO para a pessoa
 * selecionar e copiar à mão. "Abriu uma janela" e "está na área de
 * transferência" não são a mesma coisa, e a diferença só era descoberta
 * depois, na hora de colar — longe dali, sem nada que ligasse uma coisa à
 * outra. Copiar de verdade e dizer o que foi copiado custa duas linhas e
 * remove a dúvida inteira.
 *
 * E o botão de recolher: recolhido, ele é a ÚNICA saída de uma coluna
 * que virou uma linha de resumo. Enquanto ele se parecia com "Copiar
 * tudo" e "Apagar tudo" — mesma cor, mesmo tamanho, no canto —, quem
 * recolhesse por engano concluiria que o app comeu o edital. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(
    path.join(__dirname, "..", "docs", "index.html"), "utf8");

  /* ================================================================
   * B1: CADA AÇÃO DIZ O QUE FAZ
   * ============================================================== */
  {
    /* A explicação mora ao lado do botão, no HTML, e não numa dica que
     * só aparece com o mouse parado em cima — num aplicativo que se usa
     * no celular, "title" é uma explicação que ninguém lê. */
    const bloco = (html.match(/<div class="ed-acoes">([\s\S]*?)<\/div>\s*<label class="bancada-sub"/) || [])[1] || "";
    ok(bloco, "B1-pre a faixa de acoes da bancada nao foi encontrada");
    const botoes = [...bloco.matchAll(/<button[^>]*id="(\w+)"/g)].map((m) => m[1]);
    const exps = [...bloco.matchAll(/class="ed-acao-exp"/g)].length;

    /* DUAS, e não três: "comparar e vincular editais" saiu daqui.
     * A pergunta que ele responde tem dois sujeitos — "onde estes DOIS
     * concursos se encontram?" —, e quem a faz está olhando para a
     * lista de editais, não para um deles aberto. */
    ok(botoes.length === 2,
       "B1 a bancada nao tem duas acoes: " + JSON.stringify(botoes));
    ok(exps === botoes.length,
       "B1b ha acao sem explicacao ao lado: " + exps + " para "
       + botoes.length + " botoes");
    /* O BOTÃO SOLTO DO PROMPT NÃO EXISTE MAIS em lugar nenhum: se ele
     * sobrasse, haveria dois caminhos para a mesma coisa e um deles não
     * levaria à caixa que recebe a resposta. */
    ok(!/id="btnEditalPrompt"/.test(html),
       "B1c o botao separado do prompt do edital continua na tela");
    ok(botoes.indexOf("btnEditalColar") >= 0
       && botoes.indexOf("btnEditalDiag") >= 0,
       "B1d a faixa perdeu uma das acoes: " + JSON.stringify(botoes));
    /* e a que saiu foi PARAR na lista de editais, não sumiu */
    ok(/id="btnHubVincular"/.test(html),
       "B1e a comparacao de editais sumiu em vez de mudar de lugar");
  }

  /* ---- B2: os nomes falam do resultado, não do gesto ---- */
  {
    const { api } = rodar();
    const nome = (k) => api.t(k);
    /* "Criar prompt" é o que a pessoa faz; "revisar o edital" é o que
     * ela quer. O rótulo tem de ser a segunda coisa. */
    ok(!/prompt/i.test(nome("ed_rev_btn")),
       "B2 o nome da acao ainda descreve o gesto e nao o resultado: "
       + nome("ed_rev_btn"));
    ok(!/^Diagnóstico/i.test(nome("ed_diag_btn")),
       "B2b o diagnostico continua com nome de relatorio: "
       + nome("ed_diag_btn"));
    /* E as explicações precisam existir de verdade: t() devolve a
     * própria chave quando não acha, e uma tela cheia de "ed_rev_exp"
     * continua funcionando sem avisar ninguém. */
    ["ed_rev_exp", "ed_diag_exp", "vk_botao_exp"].forEach((k) => {
      ok(nome(k) !== k && nome(k).length > 40,
         "B2c a explicacao de " + k + " esta faltando ou e curta demais: "
         + nome(k));
    });
  }

  /* ================================================================
   * B3: O PASSO 1 COPIA DE VERDADE E DIZ O QUE COPIOU
   * ============================================================== */
  {
    const { api, janela } = rodar();
    api.edIniciar();
    janela.__area = "";
    ok(api.$("btnEdColarPedido"),
       "B3-pre o passo 1 nao existe dentro da caixa de colar");

    await conduzir(api, Promise.resolve(api.$("btnEdColarPedido").onclick()));

    /* NA ÁREA DE TRANSFERÊNCIA, não numa janela para copiar à mão. */
    ok(String(janela.__area || "").length > 200,
       "B3 o pedido nao foi para a area de transferencia: "
       + String(janela.__area).slice(0, 60));
    ok(janela.__area === api.t("ed_prompt"),
       "B3b o que foi copiado nao e o pedido de organizacao do edital");

    /* E A PESSOA FICA SABENDO. O aviso diz o tamanho — que é como se
     * confere que copiou tudo — e qual é o próximo passo, que é a
     * informação que faltava quando os dois botões eram separados. */
    const msg = (api.$("uiModalMsg") || {}).textContent || "";
    ok(/copiado/i.test(msg),
       "B3c copiar nao avisou nada: " + msg.slice(0, 60));
    ok(/\d+ caracteres/.test(msg),
       "B3d o aviso nao diz o tamanho do que foi copiado: " + msg);
    ok(/passo 2/i.test(msg),
       "B3e o aviso nao diz o que fazer em seguida: " + msg);
  }

  /* ---- B4: falhar ao copiar não pode parecer sucesso ---- */
  {
    const { api, janela } = rodar();
    api.edIniciar();
    janela.__area = "";
    /* A primeira versão disto chamava copiar(), que não existe neste
     * app: o botão falhava calado e parecia ter copiado. */
    janela.navigator.clipboard.writeText = async () => { throw new Error("x"); };
    await conduzir(api, Promise.resolve(api.$("btnEdColarPedido").onclick()));
    const msg = (api.$("uiModalMsg") || {}).textContent || "";
    ok(!/copiado/i.test(msg) || /não|nao|falh/i.test(msg),
       "B4 copiar falhou e o aviso disse que deu certo: " + msg);
  }

  /* ================================================================
   * B5: RECOLHER, E ACHAR O CAMINHO DE VOLTA
   * ============================================================== */
  {
    const { api } = rodar();
    api.edIniciar();
    const bt = api.$("btnEdBancRecolher");
    ok(bt, "B5-pre o botao de recolher nao existe");

    /* aberto: discreto */
    ok(!/banc-aberta/.test(bt.className || ""),
       "B5 a bancada aberta ja pinta o botao de saida: " + bt.className);
    const antes = bt.textContent;

    api.bancAlternar();
    /* recolhido: cor viva, porque agora ele é a única saída */
    ok(/banc-aberta/.test(bt.className || ""),
       "B5b recolhido, o botao de volta continua igual aos outros: "
       + bt.className);
    ok(bt.textContent !== antes,
       "B5c o rotulo nao mudou ao recolher: " + bt.textContent);
    /* E CONTINUA NA TELA. Um botão de expandir escondido dentro do que
     * ele expande não teria como ser apertado. */
    ok(bt.hidden !== true,
       "B5d o botao de expandir foi escondido junto com o que ele expande");
    ok(api.$("edBancCorpo").hidden === true,
       "B5e recolher nao recolheu o corpo da bancada");
    ok(api.$("edBancResumo").hidden === false,
       "B5f recolhido, nao sobrou nem o resumo do edital");

    /* e voltar desfaz */
    api.bancAlternar();
    ok(!/banc-aberta/.test(bt.className || ""),
       "B5g expandir deixou o botao em cor de alerta: " + bt.className);
    ok(api.$("edBancCorpo").hidden === false,
       "B5h expandir nao trouxe o corpo de volta");
  }

  /* ---- B6: o estado tem nome próprio (a lição do E15) ---- */
  {
    /* "modos-min" era ao mesmo tempo a classe do botão de recolher (com
     * all:unset e 20x20) e o estado que o JS punha no contêiner — e o
     * contêiner herdava o tamanho do botão, virando uma caixinha de 20
     * pixels. Aqui a identidade é "banc-alternar" e o estado é
     * "banc-aberta", e a regra do estado só pinta. */
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
    const regra = (css.match(/\.banc-aberta\s*\{([^}]*)\}/) || [])[1] || "";
    ok(regra, "B6-pre a regra do estado recolhido nao existe");
    ok(!/(^|;|\s)(all|display|width|height|position)\s*:/.test(regra),
       "B6 a regra do estado mexe na FORMA, nao so na cor: " + regra);
    ok(!/class="[^"]*\bbanc-aberta\b/.test(html),
       "B6b o estado tambem esta escrito no HTML como identidade");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
