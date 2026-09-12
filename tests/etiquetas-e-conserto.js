/* O AVISO QUE ACUSAVA O PRÓPRIO APP, e o botão que faltava.
 *
 * Cinquenta cartões colados, cinquenta avisos: "3º campo parece TEXTO,
 * não tags — provável quebra de linha faltando". Todos falsos, e todos
 * sobre etiquetas que o PRÓPRIO PROMPT do app tinha acabado de mandar a
 * IA escrever, no formato que parseTags lê sem hesitar.
 *
 * A causa: looksLikeTags discordava de parseTags. parseTags separa por
 * espaço OU vírgula — a convenção do Anki. looksLikeTags separava só por
 * vírgula e recusava qualquer campo com espaço dentro. Duas funções
 * respondendo à mesma pergunta com regras diferentes.
 *
 * E não parava no aviso: o cartão saía marcado tagsSuspeitas, e a rede
 * de segurança que confere se as etiquetas sobreviveram passava a contar
 * ZERO etiquetas em cinquenta cartões etiquetados.
 *
 * Depois disso, o botão: consertar o que dá para consertar, com a mesma
 * cadeia segura da bancada — e uma rede que RECUSA o conserto que perca
 * cartão ou etiqueta. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

/* três linhas reais do lote que gerou os cinquenta avisos */
const LOTE_REAL = [
  "O que são receitas públicas originárias? :: São aquelas que o Estado"
  + " arrecada por meio da exploração de suas atividades econômicas. ::"
  + " disc_Direito_Financeiro top_Receita_Publica"
  + " concurso_TCE_PE_Auditor_de_Controle_Externo_Contas_Publicas de_resumo",
  "Qual é o mnemônico para os quatro estágios da receita pública? :: PLAR. ::"
  + " disc_Direito_Financeiro top_Receita_Publica"
  + " concurso_TCE_PE_Auditor_de_Controle_Externo_Contas_Publicas de_resumo",
  "O que é o estágio da previsão da receita? :: É a estimativa de"
  + " arrecadação constante na LOA. ::"
  + " disc_Direito_Financeiro top_Receita_Publica"
  + " concurso_TCE_PE_Auditor_de_Controle_Externo_Contas_Publicas de_resumo",
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
  /* RESPONDE O QUE APARECER, e nunca espera para sempre.
   *
   * Amarrar o teste a um número fixo de janelas faz dele um teste que
   * TRAVA quando o código muda de caminho — e um teste travado não diz
   * nada: some do relatório em vez de ficar vermelho. Aqui ele responde
   * "sim" a tudo que abrir e desiste com um valor reconhecível. */
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return Promise.race([promessa, Promise.resolve(pronto ? null : "travou")])
      .then((v) => (pronto ? v : "travou"));
  };

  const abrir = (api) => {
    api.matIniciar(); api.edIniciar(); api.gerLogCarregar();
    const ch = api.matChave("Direito Financeiro", "Receita pública");
    api.matGravar(ch, "Receita pública é ingresso definitivo.",
      { disciplina: "Direito Financeiro", topico: "Receita pública",
        concurso: "TCE-PE Auditor" });
    api.matAbrirEditor(
      { disciplina: "Direito Financeiro", nome: "Receita pública" }, true);
    api.matCartoesAbrir();
    return ch;
  };

  /* ================================================================
   * T1: as etiquetas do próprio app passam sem aviso
   * ============================================================== */
  {
    const { api } = rodar();
    const r = api.parseText(LOTE_REAL);
    ok(r.cards.length === 3,
       "T1-pre deviam ser 3 cartões: " + r.cards.length);
    /* ZERO AVISOS. Era este o defeito: as três linhas produziam três
     * avisos idênticos sobre etiquetas perfeitamente válidas. */
    ok(r.nSuspicious === 0,
       "T1 as etiquetas do proprio app foram acusadas de texto em "
       + r.nSuspicious + " cartão(ões): "
       + JSON.stringify((r.cards[0] || {}).issues));
    ok(r.cards[0].tags.length === 4,
       "T1b as etiquetas nao foram lidas: "
       + JSON.stringify(r.cards[0].tags));
    /* E A REDE DE SEGURANÇA TEM DE VÊ-LAS. Marcadas como suspeitas, elas
     * contavam zero — e qualquer correção posterior poderia apagá-las
     * sem que o "antes e depois" acusasse perda nenhuma. */
    ok(api.resumoTexto(LOTE_REAL).tags === 12,
       "T1c a rede de seguranca nao conta as etiquetas: "
       + api.resumoTexto(LOTE_REAL).tags);
  }

  /* ---- T2: looksLikeTags e parseTags têm de concordar ---- */
  {
    const { api } = rodar();
    /* DUAS FUNÇÕES PARA A MESMA PERGUNTA foi a causa-raiz. Se parseTags
     * lê um campo como etiquetas, looksLikeTags não pode chamá-lo de
     * texto — e vice-versa, nos casos que importam. */
    const etiquetas = [
      "disc_Direito_Financeiro top_Receita_Publica de_resumo",
      "NBASP_100 ISSAI Auditoria",
      "anatomia, fisiologia",
      "#direito #financeiro",
      "Impostos",
    ];
    etiquetas.forEach((s) => {
      ok(api.looksLikeTags(s) === true,
         "T2 campo de etiquetas recusado: " + s);
      ok(api.parseTags(s).length > 0,
         "T2b parseTags nao leu nada de: " + s);
    });

    /* e o que a checagem existe para pegar continua sendo pego */
    const frases = [
      "provavel quebra de linha faltando entre dois cartoes",
      "a resposta certa para a questao",
      "tag_a linha solta que vira explicacao",
      "Isto e uma frase.",
    ];
    frases.forEach((s) => {
      ok(api.looksLikeTags(s) === false,
         "T2c frase aceita como etiquetas: " + s);
    });
  }

  /* ---- T3: uma etiqueta com sublinhado não legitima a frase toda ---- */
  {
    const { api } = rodar();
    /* Foi o segundo tropeço da correção: "uma composta basta" fazia
     * "tag_a linha solta que vira explicacao" passar por etiquetas, e a
     * correção automática engolia a frase inteira para dentro do campo
     * de tags. Palavra de ligação — "que" — é a assinatura da frase. */
    ok(api.looksLikeTags("tag_a estudar depois") === true,
       "T3 duas palavras soltas com uma etiqueta viraram frase");
    ok(api.looksLikeTags("tag_a linha que vira explicacao") === false,
       "T3b frase com uma etiqueta no começo passou por etiquetas");
  }

  /* ================================================================
   * C1: o botão conserta, e diz o que fez
   * ============================================================== */
  {
    const { api } = rodar();
    abrir(api);
    /* markdown e marcador de lista: dois defeitos que a cadeia segura
     * sabe desfazer sozinha */
    api.$("mcTexto").value = [
      "- **Pergunta em negrito com marcador?** :: Resposta. :: tag_a",
      "- Outra pergunta com marcador? :: Outra resposta. :: tag_b",
    ].join("\n");
    api.matCartoesConferir();
    const antes = api.resumoTexto(api.$("mcTexto").value);

    const p = api.matCartoesConsertar();
    /* PERGUNTAR ANTES NÃO É CERIMÔNIA: o conserto REESCREVE o que a
     * pessoa colou. Aplicar calado e deixá-la descobrir depois é o mesmo
     * defeito de uma correção automática que perde conteúdo. */
    ok(api.$("uiModal").open === true,
       "C1-conf o conserto reescreveu o texto sem perguntar");
    ok(/Aplicar\?/.test(api.$("uiModalMsg").textContent || ""),
       "C1-conf2 a pergunta nao mostra o antes e o depois: "
       + (api.$("uiModalMsg").textContent || "").slice(0, 70));
    const feito = await conduzir(api, p);
    ok(feito !== "travou", "C1-trava o conserto ficou esperando uma resposta");
    ok(feito === true, "C1 o conserto nao foi aplicado");
    const depois = api.resumoTexto(api.$("mcTexto").value);
    ok(depois.avisos + depois.suspeitos < antes.avisos + antes.suspeitos,
       "C1b o conserto nao reduziu os avisos: "
       + (antes.avisos + antes.suspeitos) + " → "
       + (depois.avisos + depois.suspeitos));
    /* CONSERTAR NÃO PODE CUSTAR CARTÃO NEM ETIQUETA. Ganhar pode: aqui
     * as duas linhas começavam com "-" e contavam como continuação, não
     * como cartão — tirar o marcador é justamente o que as promove. */
    ok(depois.cartoesReais >= antes.cartoesReais,
       "C1c o conserto perdeu cartões: "
       + antes.cartoesReais + " → " + depois.cartoesReais);
    ok(depois.tags >= antes.tags,
       "C1d o conserto perdeu etiquetas: " + antes.tags + " → " + depois.tags);

    /* e a tela repinta sozinha: ter de apertar "conferir" depois de
     * consertar faria o botão parecer sem efeito */
    ok(/2 cartão/.test(api.$("mcAviso").textContent || ""),
       "C1e a conferencia nao repintou depois do conserto: "
       + api.$("mcAviso").textContent);
  }

  /* ---- C2: sem nada a consertar, ele diz isso ---- */
  {
    const { api } = rodar();
    abrir(api);
    api.$("mcTexto").value = LOTE_REAL;
    api.matCartoesConferir();
    const antes = api.$("mcTexto").value;
    const feito = await conduzir(api, api.matCartoesConsertar());
    /* NÃO INVENTAR CONSERTO. Um texto correto que sai diferente do botão
     * de consertar é a pior forma de perder confiança na ferramenta. */
    ok(feito === false, "C2 consertou um texto que estava certo");
    ok(api.$("mcTexto").value === antes,
       "C2b o texto mudou mesmo sem haver o que consertar");
  }

  /* ---- C3: a rede de segurança recusa o conserto que perde ---- */
  {
    const { api } = rodar();
    abrir(api);
    /* A REDE TESTADA COM NÚMEROS NA MÃO. Fabricar um texto que provoque
     * a perda amarraria o teste à forma atual do desastre — e o desastre
     * muda de forma. O que não pode mudar é a regra. */
    const base = { cartoes: 10, cartoesReais: 10, tags: 40 };
    ok(api.matConsertoPerdas(base, { cartoesReais: 10, tags: 40 }).length === 0,
       "C3 acusou perda onde nada mudou");
    ok(api.matConsertoPerdas(base, { cartoesReais: 7, tags: 40 }).length === 1,
       "C3b perder tres cartões passou pela rede");
    ok(api.matConsertoPerdas(base, { cartoesReais: 10, tags: 0 }).length === 1,
       "C3c perder todas as etiquetas passou pela rede");
    ok(api.matConsertoPerdas(base, { cartoesReais: 7, tags: 0 }).length === 2,
       "C3d perder as duas coisas devia dar dois motivos");
    /* JUNTAR LINHA PARTIDA REDUZ a contagem bruta sem perder nada: é
     * conserto, não perda, e alarme falso aqui treina a pessoa a ignorar
     * o alarme. Por isso a conta é de cartões REAIS. */
    ok(api.matConsertoPerdas({ cartoes: 10, cartoesReais: 8, tags: 40 },
                             { cartoes: 8, cartoesReais: 8, tags: 40 }).length === 0,
       "C3e juntar linha partida foi confundido com perda de cartão");
    /* e ganhar etiqueta não é perda */
    ok(api.matConsertoPerdas(base, { cartoesReais: 10, tags: 44 }).length === 0,
       "C3f ganhar etiquetas foi acusado de perda");
  }

  /* ---- C4: o prompt de correção, para o que a regra não resolve ---- */
  {
    const { api } = rodar();
    abrir(api);
    api.$("mcTexto").value = "linha sem delimitador nenhum aqui";
    api.matCartoesConferir();
    ok(api.matCartoesPromptCorrecao() === true,
       "C4 o prompt de correcao nao foi gerado");
    const log = api.gerLogTodos().filter((x) => /prompt de correção/.test(x.o || ""));
    ok(log.length === 1,
       "C4b o prompt de correcao nao foi registrado: " + log.length);

    /* SEM PROBLEMA, SEM PROMPT: copiar um prompt de correção de um texto
     * correto manda a IA procurar defeito onde não há — e ela inventa. */
    api.$("mcTexto").value = LOTE_REAL;
    api.matCartoesConferir();
    ok(api.matCartoesPromptCorrecao() === false,
       "C4c gerou prompt de correcao para um texto sem problema");
  }

  /* ---- C5: os dois botões estão onde o problema aparece ---- */
  {
    const { api } = rodar();
    abrir(api);
    api.$("mcTexto").value = "linha sem delimitador nenhum aqui";
    api.matCartoesConferir();
    const cx = api.$("mcRecusadas");
    ok(cx && cx.hidden === false, "C5-pre a caixa de avisos devia estar aberta");
    ok(!!api.$("btnMcConsertar"), "C5 falta o botao de consertar");
    ok(!!api.$("btnMcPromptFix"), "C5b falta o botao de prompt de correcao");
    ok(typeof api.$("btnMcConsertar").onclick === "function",
       "C5c o botao de consertar nao esta ligado a nada");
    ok(typeof api.$("btnMcPromptFix").onclick === "function",
       "C5d o botao de prompt de correcao nao esta ligado a nada");

    /* DENTRO da caixa dos avisos, e não perdidos no rodapé: o remédio
     * tem de estar onde o sintoma aparece. Lido do HTML porque o
     * simulador registra os ids mas não monta a árvore do que está
     * declarado em markup. */
    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i = html.indexOf('id="mcRecusadas"');
    const j = html.indexOf("</div>", html.indexOf('id="mcRecusadasLista"'));
    const dentro = html.slice(i, j);
    ok(dentro.indexOf('id="btnMcConsertar"') > 0,
       "C5e o botao de consertar nao esta na caixa dos avisos");
    ok(dentro.indexOf('id="btnMcPromptFix"') > 0,
       "C5f o botao de prompt de correcao nao esta na caixa dos avisos");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
