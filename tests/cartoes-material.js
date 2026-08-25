/* =====================================================================
 * SALVAR CARTÕES NO MATERIAL (v8.76)
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

function carregar() {
  const matResumos = {};
  const src = fs.readFileSync(path.join(RAIZ, "docs", "cartoes-material.js"), "utf8");
  const api = new Function("matResumos", "t", src + `
    return { CM_GERAL, cmNormal, cmChave, cmChaveGeral, cmClassificarLocal,
             cmPrompt, cmLerResposta, cmLinhaCartao, cmAplicar, cmContar,
             cmParaGerais, cmDesfazer };`)(
    matResumos, (k, p) => k + " " + JSON.stringify(p || {}));
  api._mat = matResumos;
  api._ler = (ch) => (matResumos[ch] && matResumos[ch].cartoes) || "";
  api._gravar = (ch, txt, meta) => {
    matResumos[ch] = Object.assign({}, matResumos[ch] || {}, { cartoes: txt }, meta);
  };
  return api;
}

const PLANO = [
  { disciplina: "Direito Financeiro", nome: "Restos a pagar" },
  { disciplina: "Direito Financeiro", nome: "Lei de Responsabilidade Fiscal" },
  { disciplina: "Controle Externo", nome: "Lei Organica do TCE/PE" },
];

function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  /* ---- C1: degrau 1, as etiquetas do proprio cartao ---- */
  {
    const api = carregar();
    const cards = [
      { front: "O que sao restos a pagar?", back: "Despesas empenhadas e nao pagas",
        tags: ["Direito Financeiro::Restos a pagar"] },
      { front: "Qual o limite de pessoal?", back: "60%",
        tags: ["Direito Financeiro"] },
      { front: "Pergunta solta", back: "Resposta solta", tags: [] },
      { front: "Composicao do TCE", back: "7 conselheiros",
        tags: ["Controle Externo::Lei Organica do TCE/PE"] },
    ];
    const itens = api.cmClassificarLocal(cards, PLANO);
    /* NADA e aplicado: a v8.76 preenchia o destino direto e, com 843 cartoes
     * reais, o resultado foi ruim. Sugerir 500 destinos e aplica-los todos e
     * o mesmo que nao perguntar nada. */
    ok(itens.every((x) => x.destino === null),
       "C1-zero a classificacao local aplicou destino sozinha");
    ok(itens[0].via === "etiqueta" && itens[0].sugestao.topico === "Restos a pagar",
       `C1 etiqueta com topico nao virou sugestao: ${JSON.stringify(itens[0].sugestao)}`);
    /* etiqueta que casa so com a disciplina ja resolve metade: vai para os
     * gerais dela, nao para o limbo */
    ok(itens[1].via === "etiqueta_disciplina" && itens[1].sugestao.topico === api.CM_GERAL,
       `C1b etiqueta so de disciplina devia sugerir os gerais: ${JSON.stringify(itens[1].sugestao)}`);
    ok(itens[2].via === "sem_pista" && !itens[2].sugestao,
       "C1c cartao sem etiqueta nenhuma ganhou sugestao do nada");
    ok(itens[3].sugestao.disciplina === "Controle Externo",
       "C1d etiqueta de outra disciplina sugeriu a disciplina errada");

    const c = api.cmContar(itens);
    ok(c.total === 4 && c.comDestino === 0 && c.comSugestao === 3 && c.sem_pista === 1,
       `C1e a contagem para o cabecalho errou: ${JSON.stringify(c)}`);
  }

  /* ---- C2: "assuntos gerais" nao pode colidir com topico real ----
   * Um edital com um topico chamado "Geral" despejaria os cartoes soltos
   * em cima de um topico de verdade. */
  {
    const api = carregar();
    const planoArmadilha = PLANO.concat([{ disciplina: "Direito Financeiro", nome: "Geral" }]);
    ok(api.cmChaveGeral("Direito Financeiro")
       !== api.cmChave("Direito Financeiro", "Geral"),
       "C2 a gaveta de assuntos gerais colide com um topico chamado 'Geral'");
    const itens = api.cmClassificarLocal(
      [{ front: "x", back: "y", tags: ["Direito Financeiro::Geral"] }], planoArmadilha);
    ok(itens[0].sugestao.topico === "Geral" && itens[0].via === "etiqueta",
       "C2b o topico real 'Geral' devia ser reconhecido como topico, nao como gaveta");
  }

  /* ---- C3: a resposta da IA ---- */
  {
    const api = carregar();
    const cards = [{ front: "P1", back: "R1", tags: [] }, { front: "P2", back: "R2", tags: [] },
                   { front: "P3", back: "R3", tags: [] }, { front: "P4", back: "R4", tags: [] }];
    const itens = api.cmClassificarLocal(cards, PLANO);
    const resp = [
      "Segue a classificacao:",
      "~ 1 :: Direito Financeiro > Restos a pagar",
      "~ 2 :: Direito Financeiro",
      "~ 3 :: Direito Financeiro > Topico Que Nao Existe",
      "~ 99 :: Direito Financeiro > Restos a pagar",
      "espero ter ajudado",
    ].join("\n");
    const r = api.cmLerResposta(resp, itens, PLANO);
    ok(r.achados.length === 3, `C3 esperava 3 achados, veio ${r.achados.length}`);
    ok(r.achados[0].via === "ia" && r.achados[0].destino.topico === "Restos a pagar",
       "C3b o par valido nao foi lido certo");
    /* so a disciplina e resposta VALIDA: melhor os gerais que um topico inventado */
    ok(r.achados[1].via === "ia_geral" && r.achados[1].destino.topico === api.CM_GERAL,
       `C3c resposta so com disciplina devia ir para os gerais: ${JSON.stringify(r.achados[1])}`);
    /* C3d — a IA inventou um topico dentro de uma disciplina real. Jogar
     * nos gerais e razoavel; fazer isso EM SILENCIO nao e, porque esconde
     * da conferencia justamente o erro que ela existe para pegar. */
    const inv = r.achados.find((x) => x.via === "ia_inventou");
    ok(!!inv, "C3d topico inventado pela IA foi aceito como se existisse");
    ok(inv && inv.inventado === "Topico Que Nao Existe",
       "C3d2 a conferencia nao mostra qual topico a IA inventou");
    ok(inv && inv.destino.topico === api.CM_GERAL,
       "C3d3 o cartao de topico inventado devia cair nos assuntos gerais");
    ok(r.ignoradas.some((x) => x.motivo === "cartao_inexistente"),
       "C3e numero de cartao inexistente foi aceito");
  }

  /* ---- C4: gravar, com a marca do concurso ---- */
  {
    const api = carregar();
    const cards = [
      { front: "O que sao restos a pagar?", back: "Despesas empenhadas", tags: ["Direito Financeiro::Restos a pagar"] },
      { front: "Limite de pessoal", back: "60%", tags: ["Direito Financeiro"] },
    ];
    /* o teste aceita as sugestoes de proposito — e o que a pessoa faria
     * clicando "usar" em cada uma */
    const itens = api.cmClassificarLocal(cards, PLANO)
      .filter((x) => x.sugestao)
      .map((x) => Object.assign({}, x, { destino: x.sugestao }));
    const r = api.cmAplicar(itens, "TCE-PE 2026", api._gravar);
    ok(r.novos === 2, `C4 esperava 2 cartoes gravados, veio ${r.novos}`);
    ok(r.topicos === 2, `C4b esperava 2 destinos distintos, veio ${r.topicos}`);

    const chTop = api.cmChave("Direito Financeiro", "Restos a pagar");
    const chGer = api.cmChaveGeral("Direito Financeiro");
    ok(api._mat[chTop] && /restos a pagar/i.test(api._mat[chTop].cartoes),
       "C4c o cartao nao chegou no topico certo");
    ok(api._mat[chGer] && /Limite de pessoal/.test(api._mat[chGer].cartoes),
       "C4d o cartao sem topico nao foi para os assuntos gerais");

    /* a marca do concurso viaja como ETIQUETA: aparece na revisao e
     * sobrevive a exportacao de volta para o Anki */
    ok(/concurso_TCE-PE_2026/.test(api._mat[chTop].cartoes),
       `C4e o cartao nao ficou marcado com o concurso: ${api._mat[chTop].cartoes}`);
    ok(api._mat[chTop].disciplina === "Direito Financeiro"
       && api._mat[chTop].topico === "Restos a pagar",
       "C4f o material gravado nao guardou disciplina e topico");

    /* ---- C5: idempotente ---- */
    const r2 = api.cmAplicar(itens, "TCE-PE 2026", api._gravar);
    ok(r2.novos === 0 && r2.repetidos === 2,
       `C5 salvar de novo duplicou: ${r2.novos} novos, ${r2.repetidos} repetidos`);
    /* contar por LINHA, nao pelo termo: "restos a pagar" aparece na
     * pergunta E na etiqueta, e a primeira versao deste teste acusou
     * duplicata onde nao havia */
    ok(api._mat[chTop].cartoes.split("\n").filter(Boolean).length === 1,
       `C5b o mesmo cartao ficou duas vezes no material: ${api._mat[chTop].cartoes}`);

    /* e um cartao NOVO no mesmo topico e acrescentado, nao substitui */
    const extra = [{ card: { front: "Prazo de inscricao", back: "31/12", tags: [] },
                     destino: { disciplina: "Direito Financeiro", topico: "Restos a pagar" } }];
    api.cmAplicar(extra, "TCE-PE 2026", api._gravar);
    ok(/restos a pagar/i.test(api._mat[chTop].cartoes)
       && /Prazo de inscricao/.test(api._mat[chTop].cartoes),
       "C5c gravar um cartao novo apagou os que ja estavam no topico");
  }

  /* ---- C6: o "::" do cartao nao pode quebrar o formato ----
   * O separador do app e "::". Cartao cuja pergunta contenha "::" viraria
   * tres campos e o material sairia corrompido. */
  {
    const api = carregar();
    const linha = api.cmLinhaCartao(
      { front: "Art. 5 :: inciso II", back: "Legalidade :: principio",
        tags: ["Direito Financeiro::Restos a pagar"] }, "TCU");
    ok(linha.split("::").length === 3,
       `C6 a linha tem campos demais e o leitor devolve o cartao mutilado: ${JSON.stringify(linha)}`);
    ok(/inciso II/.test(linha) && /Legalidade/.test(linha),
       "C6b o conteudo do cartao se perdeu ao escapar o separador");
    /* a etiqueta hierarquica do Anki tambem quebra: testei, e o cartao
     * voltava com tags ["TCU"] e a DISCIPLINA perdida */
    ok(/Direito_Financeiro_Restos_a_pagar/.test(linha),
       `C6c a etiqueta de disciplina se perdeu ao achatar: ${JSON.stringify(linha)}`);
    ok(/concurso_TCU/.test(linha), "C6d a marca do concurso sumiu");
  }

  /* ---- C7: quebra de linha dentro do cartao ---- */
  {
    const api = carregar();
    const linha = api.cmLinhaCartao({ front: "P\ncom quebra", back: "R\nidem", tags: [] }, "");
    ok(linha.indexOf("\n") < 0,
       `C7 quebra de linha vazou para o material e criaria um cartao fantasma: ${JSON.stringify(linha)}`);
  }

  /* ---- C8: IDA E VOLTA — o cartao tem de voltar inteiro ----
   * Este e o teste que pegou o defeito de verdade. Gravar no material so
   * serve se o cartao puder ser LIDO de volta pelo leitor do proprio app.
   * Com a etiqueta hierarquica do Anki ("Disciplina::Topico") a linha
   * ganhava um campo a mais e o cartao voltava com a DISCIPLINA PERDIDA —
   * tags ["TCE-PE_2026"] e nada mais. Nenhum teste de escrita pegaria
   * isso: so o de leitura. */
  {
    const api = carregar();
    const parser = fs.readFileSync(path.join(RAIZ, "docs", "parser.js"), "utf8");
    const P = new Function("t", "UI", "pm", parser + "; return { parseText };")(
      (k) => k, { pt: {}, en: {} }, (k, p) => k + " " + JSON.stringify(p || {}));

    const originais = [
      { front: "O que sao restos a pagar?", back: "Despesas empenhadas e nao pagas",
        tags: ["Direito Financeiro::Restos a pagar"] },
      { front: "Art. 5 :: inciso II", back: "Legalidade :: principio", tags: [] },
      { front: "Pergunta com\nquebra", back: "Resposta", tags: ["solta"] },
    ];
    const itens = originais.map((c, k) => ({ card: c, n: k,
      destino: { disciplina: "Direito Financeiro", topico: "Restos a pagar" } }));
    api.cmAplicar(itens, "TCE-PE 2026", api._gravar);
    const blob = api._mat[api.cmChave("Direito Financeiro", "Restos a pagar")].cartoes;

    const lido = P.parseText(blob);
    ok(lido.cards.length === 3,
       `C8 gravei 3 cartoes e o leitor do app achou ${lido.cards.length}`);
    ok(!lido.cards.some((c) => (c.issues || []).some((x) => /extra_fields/.test(x))),
       "C8b o leitor acusou campos a mais: a linha gravada esta fora do formato");

    const c0 = lido.cards[0];
    ok(c0 && /restos a pagar/i.test(c0.front),
       `C8c a pergunta nao voltou: ${JSON.stringify(c0 && c0.front)}`);
    ok(c0 && /Despesas empenhadas/.test(c0.back),
       `C8d a resposta nao voltou: ${JSON.stringify(c0 && c0.back)}`);
    /* a marca do concurso E a disciplina precisam sobreviver as duas viagens */
    ok(c0 && (c0.tags || []).some((x) => /concurso_TCE/.test(x)),
       `C8e a marca do concurso se perdeu na volta: ${JSON.stringify(c0 && c0.tags)}`);
    ok(c0 && (c0.tags || []).some((x) => /Direito_Financeiro/.test(x)),
       `C8f a DISCIPLINA se perdeu na volta: ${JSON.stringify(c0 && c0.tags)}`);

    const c1 = lido.cards[1];
    ok(c1 && /inciso II/.test(c1.front) && /Legalidade/.test(c1.back),
       `C8g o cartao com '::' no proprio texto voltou partido: ${JSON.stringify(c1)}`);
  }

  /* ---- C9: as etiquetas COMO ELAS CHEGAM DE VERDADE ----
   * Medi com o leitor do proprio app o que sobra de cada forma de etiqueta:
   *   "Direito Financeiro::Restos a pagar" -> tags []  (foi para o VERSO)
   *   "Direito Financeiro"                 -> ["Direito", "Financeiro"]
   *   "Direito_Financeiro Restos_a_pagar"  -> ["Direito_Financeiro", ...]
   * A primeira versao do classificador comparava etiqueta a etiqueta com o
   * nome do topico e errava em TODOS esses casos — inclusive o mais comum,
   * que e a disciplina com espaco no nome. */
  {
    const api = carregar();
    const casos = [
      [["Direito_Financeiro", "Restos_a_pagar"], "Restos a pagar", "C9 tags com _ no lugar do espaco"],
      [["Direito", "Financeiro"], api.CM_GERAL, "C9b disciplina partida em duas tags"],
      [["direito financeiro", "restos a pagar"], "Restos a pagar", "C9c tags em minusculas"],
      [["DIREITO FINANCEIRO::RESTOS A PAGAR"], "Restos a pagar", "C9d hierarquia em maiusculas"],
      [["Restos_a_pagar"], "Restos a pagar", "C9e so o topico, sem a disciplina"],
      [[], null, "C9f sem etiqueta nenhuma"],
    ];
    casos.forEach(([tags, esperado, nome]) => {
      const r = api.cmClassificarLocal([{ front: "P", back: "R", tags }], PLANO)[0];
      const veio = r.sugestao ? r.sugestao.topico : null;
      ok(veio === esperado,
         `${nome}: esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(veio)}`);
    });
  }

  /* ---- C10: nome curto nao pode ganhar de nome longo ----
   * Um topico "Bens" casaria dentro de "Bens publicos" e o cartao iria para
   * o assunto errado — errado E silencioso, que e a pior combinacao. */
  {
    const api = carregar();
    const plano = [
      { disciplina: "Direito Civil", nome: "Bens" },
      { disciplina: "Direito Civil", nome: "Bens publicos e dominio" },
    ];
    const r = api.cmClassificarLocal(
      [{ front: "P", back: "R", tags: ["Bens_publicos_e_dominio"] }], plano)[0];
    ok(r.sugestao && r.sugestao.topico === "Bens publicos e dominio",
       `C10 o nome curto ganhou do longo: ${JSON.stringify(r.sugestao)}`);

    /* e a palavra tem de ser inteira: "Bem" nao casa dentro de "Bens" */
    const r2 = api.cmClassificarLocal(
      [{ front: "P", back: "R", tags: ["Bensiario"] }], plano)[0];
    ok(!r2.sugestao, `C10b casou pedaco de palavra: ${JSON.stringify(r2.sugestao)}`);
  }

  /* ---- C11: "jogar nos gerais" pergunta QUAL disciplina ----
   * A v8.76 usava cmPlano[0].disciplina — a PRIMEIRA do edital — e o
   * comentario dizia "a disciplina mais provavel", o que era falso. No
   * edital do TCE-PE a primeira e Lingua Portuguesa, e foi para la que
   * foram parar as perguntas sobre Orcamento Base Zero. */
  {
    const api = carregar();
    const itens = api.cmClassificarLocal(
      [{ front: "O que e OBZ?", back: "Orcamento base zero", tags: [] },
       { front: "Outro", back: "R", tags: [] }], PLANO);
    ok(api.cmParaGerais(itens, "") === 0,
       "C11 mandou para os gerais sem disciplina escolhida");
    itens.forEach((x) => ok(!x.destino, "C11b sem disciplina, nada podia ter destino"));

    const n = api.cmParaGerais(itens, "Direito Financeiro");
    ok(n === 2, `C11c esperava 2 cartoes movidos, veio ${n}`);
    ok(itens[0].destino.disciplina === "Direito Financeiro"
       && itens[0].destino.topico === api.CM_GERAL,
       `C11d foi para o lugar errado: ${JSON.stringify(itens[0].destino)}`);

    /* e nao pisa em quem ja tem destino escolhido a mao */
    const outros = api.cmClassificarLocal([{ front: "X", back: "Y", tags: [] }], PLANO);
    outros[0].destino = { disciplina: "Controle Externo", topico: "Lei Organica do TCE/PE" };
    api.cmParaGerais(outros, "Direito Financeiro");
    ok(outros[0].destino.topico === "Lei Organica do TCE/PE",
       "C11e sobrescreveu um destino que a pessoa ja tinha escolhido");
  }

  /* ---- C12: DESFAZER ----
   * A primeira coisa que aconteceu no uso real foi 843 cartoes irem para o
   * lugar errado sem caminho de volta. */
  {
    const api = carregar();
    const cards = [
      { front: "P1", back: "R1", tags: [] }, { front: "P2", back: "R2", tags: [] },
      { front: "P3", back: "R3", tags: [] },
    ];
    const itens = cards.map((c, k) => ({ card: c, n: k,
      destino: { disciplina: "Direito Financeiro", topico: "Restos a pagar" } }));

    /* algo escrito a mao ANTES, que nao pode ser levado junto no desfazer */
    const ch = api.cmChave("Direito Financeiro", "Restos a pagar");
    api._gravar(ch, "Pergunta antiga :: Resposta antiga :: minha_tag",
                { disciplina: "Direito Financeiro", topico: "Restos a pagar" });

    const rec = api.cmAplicar(itens, "TCE-PE", api._gravar);
    ok(rec.novos === 3, `C12 esperava 3 gravados, veio ${rec.novos}`);
    ok(rec.recibo && rec.recibo.length === 1 && rec.recibo[0].linhas.length === 3,
       `C12b o recibo nao registrou o que foi gravado: ${JSON.stringify(rec.recibo)}`);
    ok(api._ler(ch).split("\n").length === 4, "C12c pre: deviam ser 4 linhas");

    const d = api.cmDesfazer(rec, api._gravar, api._ler);
    ok(d.removidas === 3, `C12d desfazer removeu ${d.removidas} em vez de 3`);
    ok(api._ler(ch) === "Pergunta antiga :: Resposta antiga :: minha_tag",
       `C12e desfazer levou junto o que ja estava la: ${JSON.stringify(api._ler(ch))}`);

    /* desfazer duas vezes nao pode remover o que nao gravou */
    const d2 = api.cmDesfazer(rec, api._gravar, api._ler);
    ok(d2.removidas === 0, `C12f desfazer de novo removeu mais ${d2.removidas} linhas`);
    ok(api._ler(ch) === "Pergunta antiga :: Resposta antiga :: minha_tag",
       "C12g desfazer duas vezes comeu o material antigo");
  }

  /* ---- C13: desfazer respeita o que foi escrito DEPOIS ---- */
  {
    const api = carregar();
    const ch = api.cmChave("Direito Financeiro", "Restos a pagar");
    const itens = [{ card: { front: "P1", back: "R1", tags: [] }, n: 0,
                     destino: { disciplina: "Direito Financeiro", topico: "Restos a pagar" } }];
    const rec = api.cmAplicar(itens, "TCE-PE", api._gravar);
    api._gravar(ch, api._ler(ch) + "\nEscrita depois :: Resposta :: x",
                { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    api.cmDesfazer(rec, api._gravar, api._ler);
    ok(api._ler(ch) === "Escrita depois :: Resposta :: x",
       `C13 desfazer apagou o que foi escrito depois: ${JSON.stringify(api._ler(ch))}`);
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "cartoes-material", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\ncartoes-material: ${f.length} FALHA(S)\n`
    : "\ncartoes-material: etiquetas, IA, gavetas e idempotencia ok (60 verificacoes)\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
