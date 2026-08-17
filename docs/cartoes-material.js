/* =====================================================================
 * SALVAR CARTÕES NO MATERIAL DE ESTUDO
 *
 * Até aqui o cartão saía do app e não voltava: virava .apkg e sumia para
 * dentro do Anki. Na hora de revisar um tópico, o material tinha o resumo
 * e não tinha as perguntas que aquele resumo gerou — que é justamente o
 * que se quer reler antes da prova.
 *
 * O depósito já existia (matResumos[chave].cartoes, desde a v8.62); o que
 * faltava era o caminho até ele, e a decisão de PARA QUAL tópico cada
 * cartão vai.
 *
 * Três degraus, do barato ao caro:
 *   1. as etiquetas do próprio cartão      (grátis, instantâneo)
 *   2. a IA lendo o conteúdo               (só o que sobrou)
 *   3. "assuntos gerais da disciplina"     (o resto, sem palpite)
 *
 * Nada é gravado sem a sua conferência — mesmo o degrau 1, porque
 * etiqueta errada é tão fácil de escrever quanto etiqueta certa.
 * ===================================================================== */

const CM_GERAL = "(assuntos gerais)";

function cmNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function cmChave(disciplina, topico) {
  return cmNormal(disciplina) + "›" + cmNormal(topico);
}

/* A gaveta "assuntos gerais" de cada disciplina. Precisa de chave própria
 * e improvável: se fosse "geral", um edital com um tópico chamado "Geral"
 * despejaria os cartões soltos em cima de um tópico real. */
function cmChaveGeral(disciplina) {
  return cmNormal(disciplina) + "›" + cmNormal(CM_GERAL);
}

/* ------------------------------------------------------------------
 * DEGRAU 1 — as etiquetas do cartão
 * O app já escreve etiquetas como "Direito Financeiro::Restos a pagar";
 * quem gerou o cartão a partir de um tópico tem essa informação de graça.
 * ------------------------------------------------------------------ */
function cmClassificarLocal(cards, plano) {
  /* As etiquetas NÃO chegam aqui como foram escritas. Medi com o leitor do
   * próprio app:
   *   "Direito Financeiro::Restos a pagar" → tags [] (foi parar no VERSO)
   *   "Direito Financeiro"                 → ["Direito", "Financeiro"]
   *   "Direito_Financeiro Restos_a_pagar"  → ["Direito_Financeiro", ...]
   * Comparar etiqueta a etiqueta com o nome do tópico, como eu fazia,
   * errava em todos esses casos. O jeito que sobrevive é juntar tudo numa
   * frase só, trocar "_" por espaço, e procurar o NOME dentro dela.
   *
   * A busca é por palavra inteira e prefere o nome mais LONGO: "Bens" não
   * pode ganhar de "Bens públicos" só por aparecer dentro dele. */
  const cabe = (agulha, palheiro) => {
    if (!agulha) return false;
    const k = palheiro.indexOf(agulha);
    if (k < 0) return false;
    const antes = k === 0 ? " " : palheiro[k - 1];
    const dep = k + agulha.length >= palheiro.length ? " " : palheiro[k + agulha.length];
    return /\s/.test(antes) && /\s/.test(dep);
  };

  const tops = (plano || []).map((i) => ({ i, n: cmNormal(i.nome) }))
    .sort((a, b) => b.n.length - a.n.length);
  const discs = [];
  (plano || []).forEach((i) => {
    if (!discs.some((d) => d.nome === i.disciplina))
      discs.push({ nome: i.disciplina, n: cmNormal(i.disciplina) });
  });
  discs.sort((a, b) => b.n.length - a.n.length);

  return (cards || []).map((c, k) => {
    const bruto = (c.tags || []).concat([c.titulo || ""]).join(" ");
    /* cmNormal já troca "_" e ":" por espaço (tudo que não é letra ou
     * número vira espaço) — não repito isso aqui: código defensivo que
     * nenhuma sabotagem consegue quebrar é código que mente sobre o que
     * está protegendo. */
    const palheiro = " " + cmNormal(bruto) + " ";

    const top = tops.find((x) => cabe(x.n, palheiro));
    if (top) {
      return { card: c, n: k,
               destino: { disciplina: top.i.disciplina, topico: top.i.nome },
               via: "etiqueta", confirmado: false };
    }
    /* etiqueta que casa com a DISCIPLINA mas não com o tópico já resolve
     * metade: o cartão vai para os assuntos gerais dela, não para o limbo */
    const d = discs.find((x) => cabe(x.n, palheiro));
    if (d) {
      return { card: c, n: k, destino: { disciplina: d.nome, topico: CM_GERAL },
               via: "etiqueta_disciplina", confirmado: false };
    }
    return { card: c, n: k, destino: null, via: "sem_pista", confirmado: false };
  });
}

/* ------------------------------------------------------------------
 * DEGRAU 2 — o prompt
 * Leva SÓ os cartões sem destino e a lista de tópicos. Sem datas, sem
 * pesos, sem o resto do edital: quanto menor a tarefa, melhor a resposta.
 * ------------------------------------------------------------------ */
function cmPrompt(itens, plano, nomeEdital) {
  const cartoes = (itens || []).map((x) =>
    "[" + (x.n + 1) + "] " + String(x.card.front || "").slice(0, 180)).join("\n");
  const topicos = (plano || []).map((i) => "- " + i.disciplina + " > " + i.nome).join("\n");
  return t("cm_prompt", { edital: nomeEdital || "", cartoes, topicos, geral: CM_GERAL });
}

/* "~ 3 :: Direito Financeiro > Restos a pagar" */
function cmLerResposta(txt, itens, plano) {
  const porNome = {};
  (plano || []).forEach((i) => { porNome[cmNormal(i.nome)] = i; });
  const porDisc = {};
  (plano || []).forEach((i) => { porDisc[cmNormal(i.disciplina)] = i.disciplina; });
  const porNumero = {};
  (itens || []).forEach((x) => { porNumero[x.n + 1] = x; });

  const achados = [], ignoradas = [];
  String(txt || "").split("\n").forEach((l, li) => {
    const bruta = l.trim();
    if (!bruta) return;
    if (!/^~/.test(bruta)) { ignoradas.push({ linha: li + 1, txt: bruta.slice(0, 60) }); return; }
    const p = bruta.replace(/^~\s*/, "").split("::").map((x) => x.trim());
    const num = parseInt(p[0], 10);
    const item = porNumero[num];
    if (!item) { ignoradas.push({ linha: li + 1, txt: bruta.slice(0, 60), motivo: "cartao_inexistente" }); return; }

    const alvo = String(p[1] || "");
    const nomeTop = alvo.split(">").pop().trim();
    const nomeDisc = alvo.indexOf(">") >= 0 ? alvo.split(">")[0].trim() : "";
    const top = porNome[cmNormal(nomeTop)];
    if (top) { achados.push({ n: item.n, destino: { disciplina: top.disciplina, topico: top.nome }, via: "ia" }); return; }
    /* a IA pode dizer só a disciplina, ou mandar para os gerais — as duas
     * são respostas válidas e melhores que inventar um tópico */
    const soDisc = porDisc[cmNormal(nomeDisc)];
    const discPeloTopico = porDisc[cmNormal(nomeTop)];
    /* a IA dizer só a disciplina é resposta válida e honesta */
    if (discPeloTopico && !nomeDisc) {
      achados.push({ n: item.n, destino: { disciplina: discPeloTopico, topico: CM_GERAL }, via: "ia_geral" });
      return;
    }
    /* a IA dizer uma disciplina real e um tópico que NÃO existe é outra
     * coisa: ela inventou. Vai para os gerais igual, mas com o nome
     * inventado à mostra na conferência — redirecionar em silêncio
     * esconderia exatamente o erro que a conferência existe para pegar. */
    if (soDisc) {
      achados.push({ n: item.n, destino: { disciplina: soDisc, topico: CM_GERAL },
                     via: "ia_inventou", inventado: nomeTop });
      return;
    }
    ignoradas.push({ linha: li + 1, txt: bruta.slice(0, 60), motivo: "topico_inexistente" });
  });
  return { achados, ignoradas };
}

/* ------------------------------------------------------------------
 * GRAVAR
 * Cada cartão vira uma linha no formato do app, com o concurso como
 * ETIQUETA — assim a marca viaja com o cartão, aparece na revisão e
 * sobrevive à exportação de volta para o Anki.
 * ------------------------------------------------------------------ */
function cmLinhaCartao(c, concurso) {
  /* O "::" é o separador de campos do material. Qualquer "::" que sobre
   * dentro do texto OU das etiquetas cria um campo a mais, e o leitor do
   * próprio app devolve o cartão mutilado — testei: com a etiqueta
   * hierárquica "Direito Financeiro::Restos a pagar", o cartão voltava com
   * tags ["TCE-PE_2026"] e a disciplina PERDIDA. A hierarquia do Anki é
   * bonita, mas aqui ela custa o dado; então vira "_". */
  const limpa = (s) => String(s || "").replace(/\s*::\s*/g, " — ").replace(/\r?\n+/g, " ").trim();
  const achata = (tg) => String(tg).replace(/::/g, "_").replace(/\s+/g, "_");
  const tags = (c.tags || []).map(achata).filter(Boolean);
  const marca = "concurso_" + String(concurso || "").replace(/\s+/g, "_");
  if (concurso && tags.indexOf(marca) < 0) tags.push(marca);
  return limpa(c.front) + " :: " + limpa(c.back) + (tags.length ? " :: " + tags.join(" ") : "");
}

/* Idempotente: salvar duas vezes o mesmo lote não duplica nada. A
 * comparação é pela FRENTE do cartão, que é o que identifica a pergunta —
 * o verso pode ter sido corrigido no meio do caminho. */
function cmAplicar(destinos, concurso, gravar) {
  const porChave = {};
  (destinos || []).forEach((d) => {
    if (!d || !d.destino) return;
    const ch = d.destino.topico === CM_GERAL
      ? cmChaveGeral(d.destino.disciplina)
      : cmChave(d.destino.disciplina, d.destino.topico);
    (porChave[ch] = porChave[ch] || { destino: d.destino, itens: [] }).itens.push(d);
  });

  let novos = 0, repetidos = 0, topicos = 0;
  Object.keys(porChave).forEach((ch) => {
    const g = porChave[ch];
    const antes = (typeof matResumos === "object" && matResumos[ch]
      && matResumos[ch].cartoes) || "";
    const jaTem = new Set(antes.split("\n")
      .map((l) => cmNormal(l.split("::")[0])).filter(Boolean));

    const linhas = [];
    g.itens.forEach((d) => {
      const linha = cmLinhaCartao(d.card, concurso);
      const frente = cmNormal(linha.split("::")[0]);
      if (jaTem.has(frente)) { repetidos++; return; }
      jaTem.add(frente);
      linhas.push(linha);
      novos++;
    });
    if (!linhas.length) return;
    topicos++;
    const texto = (antes ? antes.replace(/\s*$/, "") + "\n" : "") + linhas.join("\n");
    gravar(ch, texto, { disciplina: g.destino.disciplina,
                        topico: g.destino.topico, concurso: concurso || "" });
  });
  return { novos, repetidos, topicos };
}

/* Quanto de cada degrau — para o cabeçalho da conferência dizer, antes de
 * qualquer trabalho, o que vai dar trabalho. */
function cmContar(itens) {
  const c = { etiqueta: 0, etiqueta_disciplina: 0, ia: 0, ia_geral: 0,
              ia_inventou: 0, sem_pista: 0 };
  (itens || []).forEach((x) => { c[x.via] = (c[x.via] || 0) + 1; });
  c.comDestino = (itens || []).filter((x) => x.destino).length;
  c.total = (itens || []).length;
  return c;
}
