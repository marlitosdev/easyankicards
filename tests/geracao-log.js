/* REGISTRO DA GERAÇÃO — e, antes dele, o defeito que o motivou.
 *
 * A tela dizia "2 cartão(ões) lido(s) · 1 aviso(s)" e parava aí. O aviso
 * existia — o parser devolve a frase inteira, com o número da linha e o
 * texto recusado — e a função que lia jogava tudo fora no caminho de
 * volta, guardando só o comprimento da lista. Contar um problema sem
 * dizer qual é pior do que não contar: a pessoa fica sabendo que algo
 * deu errado e sem nenhum caminho para descobrir o quê.
 *
 * O que precisa valer aqui: o motivo aparece NA TELA, com a linha e o
 * texto; recusada e a-conferir são coisas distintas; o registro guarda
 * os motivos junto dos números; o filtro de hoje usa o dia da PESSOA; e
 * digitar não pode encher o log de linhas iguais. */
const { rodar } = require("./fumaca.js");

/* a primeira linha é um título de seção que a IA costuma devolver junto,
 * e é exatamente o tipo de linha que vira "1 aviso" sem explicação */
const COLADO_COM_LIXO = [
  "Aqui estão seus cartões, espero ter ajudado!",
  "",
  "Receita pública é ingresso definitivo? :: Sim, sem obrigação de devolução.",
  "",
  "Restos a pagar :: Despesas empenhadas e não pagas até 31/12.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };
  const abrirCartoes = (api) => {
    api.matIniciar(); api.edIniciar(); api.gerLogCarregar();
    const ch = api.matChave("Direito Financeiro", "Receita pública");
    api.matGravar(ch, "Receita pública é ingresso definitivo.",
      { disciplina: "Direito Financeiro", topico: "Receita pública",
        concurso: "TCE-PE Auditor" });
    api.matAbrirEditor(
      { disciplina: "Direito Financeiro", nome: "Receita pública" }, true);
    api.matCartoesAbrir();
  };

  /* ---- G1: o aviso aparece, com linha, motivo e texto ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    api.$("mcTexto").value = COLADO_COM_LIXO;
    const r = api.matCartoesConferir();

    ok(r.cards.length === 2,
       "G1-pre o texto de exemplo devia dar 2 cartões, deu " + r.cards.length);
    ok(r.avisos.length === 1,
       "G1-pre2 o texto de exemplo devia dar 1 aviso, deu " + r.avisos.length);

    /* O PARSER JÁ SABIA. O defeito nunca foi de detecção — era a função
     * de leitura devolvendo só `avisos` e descartando `ignorados`, que é
     * quem carrega o número da linha e o texto jogado fora. */
    ok(r.ignorados && r.ignorados.length === 1,
       "G1 a linha recusada nao voltou junto do aviso: "
       + JSON.stringify(r.ignorados));
    ok(/espero ter ajudado/i.test((r.ignorados[0] || {}).texto || ""),
       "G1b o texto recusado nao veio junto: "
       + JSON.stringify(r.ignorados[0]));

    const cx = api.$("mcRecusadas");
    ok(cx && cx.hidden === false, "G1c a caixa dos avisos ficou escondida");
    const itens = acharClasse(api.$("mcRecusadasLista"), "mc-recusada", []);
    ok(itens.length === 1, "G1d o aviso nao virou linha na tela: " + itens.length);
    const txt = (itens[0] || {}).textContent || "";
    /* TRÊS COISAS: a linha, o motivo e o texto. Faltando qualquer uma
     * delas a pessoa tem de contar linhas no campo para achar o culpado. */
    ok(/linha 1/i.test(txt), "G1e a linha do problema nao aparece: " + txt);
    ok(/::/.test(txt) || /delimitador/i.test(txt),
       "G1f o motivo nao aparece: " + txt);
    ok(/espero ter ajudado/i.test(txt),
       "G1g o texto recusado nao aparece: " + txt);
  }

  /* ---- G2: sem aviso, a caixa some ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    api.$("mcTexto").value = "Pergunta boa? :: Resposta boa.";
    api.matCartoesConferir();
    /* CAIXA VAZIA PERMANENTE vira ruído e a pessoa para de olhar — e aí
     * ela não olha justamente no dia em que o aviso aparece. */
    ok(api.$("mcRecusadas").hidden === true,
       "G2 a caixa de avisos ficou aberta sem nada para avisar");
    ok(acharClasse(api.$("mcRecusadasLista"), "mc-recusada", []).length === 0,
       "G2b sobrou linha de aviso da leitura anterior");
  }

  /* ---- G3: recusada e a-conferir são coisas diferentes ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    /* quatro campos: vira cartão, mas reorganizado — é "a conferir",
     * não "recusado" */
    api.$("mcTexto").value =
      "Pergunta? :: parte um :: parte dois :: Materia_Assunto\n\nlinha solta sem nada";
    const r = api.matCartoesConferir();
    ok(r.cards.length === 1, "G3-pre devia sobrar 1 cartão: " + r.cards.length);
    ok(r.suspeitos.length >= 1,
       "G3 o cartao reorganizado nao foi marcado como a conferir");

    const itens = acharClasse(api.$("mcRecusadasLista"), "mc-recusada", []);
    ok(itens.length === 2, "G3b deviam ser 2 linhas: " + itens.length);
    const classes = itens.map((x) => x.className || "").join(" ");
    /* MISTURADAS NUMA LISTA SÓ a pessoa apaga o que estava bom: uma não
     * virou cartão, a outra virou e só precisa de um olhar. */
    ok(/mc-recusada-recusada/.test(classes) && /mc-recusada-suspeito/.test(classes),
       "G3c recusada e a-conferir sairam iguais: " + classes);
  }

  /* ---- G4: a contagem do cabeçalho bate com a lista ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    api.$("mcTexto").value =
      "Pergunta? :: parte um :: parte dois :: Materia_Assunto\n\nlinha solta sem nada";
    api.matCartoesConferir();
    const cab = api.$("mcAviso").textContent || "";
    const itens = acharClasse(api.$("mcRecusadasLista"), "mc-recusada", []);
    /* DOIS NÚMEROS QUE NÃO BATEM são pior do que um número só: o
     * cabeçalho contava apenas os avisos do parser e escondia os cartões
     * tortos, então "1 aviso" com duas linhas embaixo. */
    ok(new RegExp("\\b" + itens.length + " aviso").test(cab),
       "G4 o cabecalho diz um numero e a lista mostra outro ("
       + itens.length + "): " + cab);
  }

  /* ---- G5: o registro guarda os motivos junto dos números ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    api.$("mcTexto").value = COLADO_COM_LIXO;
    api.matCartoesConferir();

    const log = api.gerLogTodos();
    ok(log.length === 1, "G5 a leitura nao virou linha do registro: " + log.length);
    const x = log[0] || {};
    ok(x.tp === "cartoes" && x.e === "leitura",
       "G5b a linha nao diz de que geracao foi: " + x.tp + "/" + x.e);
    /* NÚMEROS SEM MOTIVO seriam a mesma tela de antes, só que guardada. */
    ok(x.mot && x.mot.length === 1,
       "G5c o motivo nao foi guardado junto: " + JSON.stringify(x.mot));
    ok(/espero ter ajudado/i.test(x.mot[0] || ""),
       "G5d o texto recusado nao foi guardado: " + x.mot[0]);
    ok(x.top === "Receita pública",
       "G5e a linha nao diz em que topico foi: " + x.top);
    ok(x.n && x.n.lidos === 2,
       "G5f os numeros nao foram guardados: " + JSON.stringify(x.n));

    /* e o texto do registro traz o motivo INDENTADO sob a linha dele */
    const txt = api.gerLogTexto();
    ok(/cartoes\/leitura/.test(txt),
       "G5g a linha do registro nao diz tipo e etapa: " + txt.slice(0, 120));
    ok(/\n {6,}· .*espero ter ajudado/i.test(txt),
       "G5h o motivo nao aparece sob a linha a que pertence:\n" + txt);
  }

  /* ---- G6: digitar não enche o registro ---- */
  {
    const { api } = rodar();
    abrirCartoes(api);
    api.$("mcTexto").value = COLADO_COM_LIXO;
    /* a conferência está no "input" do campo: roda a cada tecla */
    api.matCartoesConferir();
    api.matCartoesConferir();
    api.matCartoesConferir();
    ok(api.gerLogTodos().length === 1,
       "G6 conferir a mesma coisa tres vezes gerou "
       + api.gerLogTodos().length + " linhas");

    /* mas MUDAR o resultado é um evento novo */
    api.$("mcTexto").value = COLADO_COM_LIXO + "\n\noutra linha solta";
    api.matCartoesConferir();
    ok(api.gerLogTodos().length === 2,
       "G6b um aviso novo nao entrou no registro: " + api.gerLogTodos().length);

    /* campo vazio é o estado de partida, não um evento */
    const antes = api.gerLogTodos().length;
    api.$("mcTexto").value = "";
    api.matCartoesConferir();
    ok(api.gerLogTodos().length === antes,
       "G6c esvaziar o campo virou linha do registro");
  }

  /* ---- G7: os filtros, e o dia da pessoa ---- */
  {
    const { api } = rodar();
    api.gerLogCarregar();
    api.gerReg("cartoes", "leitura", "hoje, cartões");
    api.gerReg("questoes", "leitura", "hoje, questões");
    api.gerReg("questoes", "erro", "falha em copiar prompt");
    /* uma linha de ontem, para o filtro de hoje ter o que esconder */
    const todos = api.gerLogTodos();
    todos[0].q = new Date(Date.now() - 86400000).toISOString();

    api.gerLogFiltros({ hoje: true, erros: false, tipo: "" });
    ok(/hoje, questões/.test(api.gerLogTexto()),
       "G7 o filtro de hoje escondeu o que e de hoje");
    ok(!/hoje, cartões/.test(api.gerLogTexto()),
       "G7b o filtro de hoje mostrou a linha de ontem");

    /* O FILTRO DE HOJE PRECISA SAIR AQUI. Com ele ligado, a linha de
     * cartões já estava escondida por ser de ontem — e o teste do filtro
     * de tipo passaria mesmo se ele não filtrasse nada. */
    api.gerLogFiltros({ hoje: false, tipo: "" });
    ok(/cartoes\//.test(api.gerLogTexto()),
       "G7c-pre sem filtro de tipo a linha de cartoes devia aparecer");
    api.gerLogFiltros({ tipo: "questoes" });
    const so = api.gerLogTexto();
    ok(/hoje, questões/.test(so) && !/cartoes\//.test(so),
       "G7c o filtro por tipo nao separou:\n" + so);

    api.gerLogFiltros({ erros: true });
    ok(/falha em copiar prompt/.test(api.gerLogTexto())
       && !/hoje, questões/.test(api.gerLogTexto()),
       "G7d o filtro de erros nao isolou a falha");

    /* O RESUMO DIZ O QUE O FILTRO ESCONDE. Sem ele, "0 linhas" com o
     * filtro de hoje ligado parece registro vazio — e a conclusão é que
     * o app não registra nada. */
    api.gerLogFiltros({ hoje: true, erros: false, tipo: "" });
    const num = api.gerLogNumeros();
    ok(num.total === 3 && num.vendo === 2,
       "G7e o resumo nao separa visto de guardado: " + JSON.stringify(num));
    ok(num.erros === 1 && num.cartoes === 1 && num.questoes === 2,
       "G7f as contagens por tipo sairam erradas: " + JSON.stringify(num));
  }

  /* ---- G8: o dia é o do relógio da pessoa, não o de Greenwich ---- */
  {
    const { api } = rodar();
    /* 22h no Brasil já é o dia seguinte em UTC. Comparando os dois como
     * texto, o filtro de hoje mostrava ZERO linhas justamente no horário
     * em que mais se estuda — e o registro parecia não registrar. */
    const noite = new Date(2026, 7, 27, 22, 30, 0);
    ok(api.gerLogDiaLocal(noite) === "2026-08-27",
       "G8 o dia local saiu como " + api.gerLogDiaLocal(noite));
    ok(api.gerLogDiaLocal("nao e data") === "",
       "G8b data invalida nao devolveu vazio");
  }

  /* ---- G9: código interno não é explicação ---- */
  {
    const { api } = rodar();
    const s = api.gerMotivoTexto("gabarito_fora_das_opcoes");
    ok(s && !/_/.test(s),
       "G9 o codigo interno vazou para a tela: " + s);
    /* motivo que ninguém traduziu ainda volta legível, não como chave */
    const d = api.gerMotivoTexto("motivo_que_nao_existe");
    ok(d === "motivo que nao existe",
       "G9b motivo desconhecido virou chave crua: " + d);
    ok(api.gerMotivoTexto("") === "", "G9c motivo vazio inventou texto");

    /* as três formas de motivo viram a mesma linha */
    ok(/linha 4/.test(api.gerMotivoLinha({ linha: 4, motivo: "sem_gabarito" })),
       "G9d o motivo em codigo nao virou linha com numero");
    ok(api.gerMotivoLinha("frase pronta do parser") === "frase pronta do parser",
       "G9e a frase pronta foi mexida");
  }

  /* ---- G10: o registro atravessa o fechar e abrir ---- */
  {
    const { api, janela } = rodar();
    api.gerLogCarregar();
    api.gerReg("cartoes", "gravacao", "gravados no tópico", "3 cartões");
    ok(!!janela.localStorage.getItem("eac_ger_log"),
       "G10 o registro nao foi gravado");

    /* GRAVAR NÃO É GUARDAR. Só recarregando dá para saber se o que foi
     * escrito volta inteiro — foi assim que o histórico das questões
     * quase ficou de fora do backup. */
    api.gerLogLimpar();
    janela.localStorage.setItem("eac_ger_log", JSON.stringify([
      { q: new Date().toISOString(), tp: "cartoes", e: "gravacao",
        o: "gravados no tópico", d: "3 cartões", mot: [] },
    ]));
    api.gerLogCarregar();
    ok(api.gerLogTodos().length === 1,
       "G10b o registro nao sobreviveu a reabrir: " + api.gerLogTodos().length);

    /* e lixo no lugar do registro não pode derrubar a tela: o registro é
     * justamente o que se abre quando algo já deu errado */
    janela.localStorage.setItem("eac_ger_log", "{isto nao e json");
    let quebrou = "";
    try { api.gerLogCarregar(); } catch (e) { quebrou = (e && e.message) || String(e); }
    ok(!quebrou, "G10c registro corrompido derrubou o carregamento: " + quebrou);
    ok(api.gerLogTodos().length === 0,
       "G10c2 registro corrompido nao virou lista vazia");
    ok(typeof api.gerLogTexto() === "string",
       "G10d a tela do registro quebrou com o arquivo corrompido");

    api.gerReg("questoes", "leitura", "depois do estrago");
    api.gerLogCarregar();
    ok(api.gerLogTodos().length === 1,
       "G10e nao deu para voltar a registrar depois do arquivo corrompido");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
