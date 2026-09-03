/* =====================================================================
 * VIZINHANÇA SEMÂNTICA — QUAIS DUPLAS MERECEM SER OLHADAS
 *
 * O problema que isto resolve tem número: 533 tópicos de um edital
 * contra 232 do outro são 123.656 duplas. Não cabem num prompt, e o
 * recorte por disciplina — a solução anterior — obrigava a rodar
 * dezesseis vezes e a casar "Direito Financeiro" com "Finanças
 * Públicas" na mão.
 *
 * Um vetor por tópico e uma multiplicação depois, sobram umas duzentas
 * duplas que valem a pergunta. Um prompt só, edital inteiro.
 *
 * =====================================================================
 * O QUE ESTE MÓDULO NÃO FAZ: VINCULAR
 * =====================================================================
 *
 * Nenhum score, por mais alto que seja, cria vínculo aqui. Não é
 * precaução exagerada — é que o cosseno responde OUTRA pergunta.
 *
 * Ele mede "estes dois textos falam do mesmo assunto?". A pergunta do
 * aplicativo é "estudar um cobre o outro, para estes dois cargos?". A
 * distância entre as duas aparece justamente nos casos que importam, e
 * nas duas direções:
 *
 *   · "Improbidade administrativa" e "Lei nº 8.429/1992" são a MESMA
 *     coisa e ficam LONGE — um é conceito, o outro é número de lei;
 *   · "Responsabilidade Civil" e "Responsabilidade Civil do Estado" são
 *     coisas DIFERENTES e ficam quase coladas;
 *   · "Licitações: Lei 14.133" e "Licitações: modalidades" idem.
 *
 * E há um limite estrutural: o recorte depende do CARGO — auditor de
 * controle externo lê a lei orgânica do tribunal, auditor fiscal lê o
 * regulamento do imposto —, e o cargo não está escrito no nome do
 * tópico. Nenhum vetor de "Controle da Administração Pública" pode
 * saber disso.
 *
 * Então a vizinhança ORDENA e ENCURTA. Quem responde é a IA, com os
 * dois cargos à vista, e quem decide é quem estuda, marcando par a par.
 * Um vínculo errado faz pular um assunto na prova; esse erro não pode
 * nascer de uma multiplicação de vetores.
 * ===================================================================== */

/* 768 e não 3072: um quarto do tamanho por 0,26% de qualidade, e aqui o
 * que se pede aos vetores é ordenar uma lista, não decidir nada. */
const VZ_DIMS = 768;
const VZ_MODELO = "gemini-embedding-001";
const VZ_LOTE = 90;          /* a API aceita ~100 por chamada */
const VZ_CORTE = 0.6;        /* abaixo disto não vale nem perguntar */
const VZ_TETO = 250;         /* quantas duplas cabem num prompt legível */
const VZ_CHAVE_API = "eac_chave_gemini";

/* AS FAIXAS SÃO DE LEITURA, NÃO DE DECISÃO.
 * Elas dizem por onde começar a ler o log — nada mais. */
const VZ_FAIXAS = { forte: 0.82, provavel: 0.7 };

function vzFaixa(s) {
  if (s >= VZ_FAIXAS.forte) return "forte";
  if (s >= VZ_FAIXAS.provavel) return "provavel";
  return "duvida";
}

/* ------------------------------------------------------------------
 * A CHAVE
 *
 * Fica no localStorage deste aparelho, legível por qualquer script da
 * página. É a sua chave e o seu computador, mas isso precisa estar
 * ESCRITO na tela — e por isso existe o botão de apagar, e por isso ela
 * fica fora do backup: um arquivo de backup circula por nuvem e por
 * e-mail, e uma chave de API dentro dele vira cobrança de outra pessoa.
 * ------------------------------------------------------------------ */
function vzChaveApi() {
  try { return String(localStorage.getItem(VZ_CHAVE_API) || "").trim(); }
  catch (e) { return ""; }
}

function vzGuardarChave(v) {
  const limpa = String(v || "").trim();
  try {
    if (limpa) localStorage.setItem(VZ_CHAVE_API, limpa);
    else localStorage.removeItem(VZ_CHAVE_API);
  } catch (e) {}
  return limpa;
}

/* O FIM DA CHAVE, para mostrar sem mostrar. "…kJ2f" basta para saber
 * qual chave está ali; a chave inteira na tela vira captura de tela. */
function vzChaveResumida(v) {
  const s = String(v || vzChaveApi() || "");
  if (!s) return "";
  return s.length <= 8 ? "…" + s.slice(-4) : s.slice(0, 4) + "…" + s.slice(-4);
}

/* =====================================================================
 * O REGISTRO DO PROCESSO DE VINCULAÇÃO
 *
 * O registro geral do app (reg) guarda uma linha por evento e serve
 * para "o que aconteceu neste aplicativo hoje". Não serve para
 * diagnosticar ESTE processo, que tem cinco etapas, roda em cima de
 * centenas de itens e falha de maneiras específicas: a IA devolveu
 * quarenta linhas e só oito foram reconhecidas — por quê? A triagem
 * separou duzentas duplas e a IA recusou cento e oitenta — o corte está
 * frouxo demais? Apaguei quinhentos vínculos — quais eram?
 *
 * Nenhuma dessas perguntas se responde com uma linha de log. Elas
 * precisam do NÚMERO DE ENTRADA E DO NÚMERO DE SAÍDA de cada etapa,
 * lado a lado, porque o defeito mora sempre na diferença entre os dois.
 *
 * Guarda pouco de propósito: contagens e amostras, nunca as listas
 * inteiras. O aplicativo vive em 5 MB e este registro é diagnóstico —
 * ele não pode competir por espaço com o diário de estudo.
 * ===================================================================== */
const VZ_LOG_CHAVE = "eac_vinculo_log";
const VZ_LOG_MAX = 60;
const VZ_LOG_AMOSTRA = 6;

function vzLogLer() {
  try {
    const L = JSON.parse(localStorage.getItem(VZ_LOG_CHAVE) || "[]");
    return Array.isArray(L) ? L : [];
  } catch (e) { return []; }
}

function vzLogGravar(etapa, dados, amostra) {
  const L = vzLogLer();
  L.push({
    q: new Date().toISOString(),
    e: etapa,
    d: dados || {},
    /* A AMOSTRA é o que transforma número em diagnóstico. "8 de 40
     * reconhecidas" diz que há um problema; as seis linhas que não
     * foram reconhecidas dizem QUAL — quase sempre um nome que a IA
     * reescreveu, e isso só se vê lendo. */
    a: (amostra || []).slice(0, VZ_LOG_AMOSTRA).map((x) => String(x).slice(0, 120)),
  });
  while (L.length > VZ_LOG_MAX) L.shift();
  try {
    if (typeof guardar === "function") guardar(VZ_LOG_CHAVE, JSON.stringify(L));
    else localStorage.setItem(VZ_LOG_CHAVE, JSON.stringify(L));
  } catch (e) {}
  return L.length;
}

function vzLogLimpar() {
  try { localStorage.removeItem(VZ_LOG_CHAVE); } catch (e) {}
}

/* O relatório em texto, para colar num relato de problema. */
function vzLogTexto() {
  const L = vzLogLer();
  if (!L.length) return t("vzl_vazio");
  return L.map((x) => {
    const cab = (x.q || "").slice(0, 16).replace("T", " ") + "  " + x.e;
    const nums = Object.keys(x.d || {})
      .map((k) => k + "=" + x.d[k]).join("  ");
    const am = (x.a || []).map((s) => "      · " + s).join("\n");
    return cab + (nums ? "\n      " + nums : "") + (am ? "\n" + am : "");
  }).join("\n");
}

/* ------------------------------------------------------------------
 * O TEXTO QUE VIRA VETOR
 *
 * A disciplina entra junto porque metade dos tópicos não significa nada
 * sozinha: "Conceito", "Princípios", "Espécies" aparecem em seis
 * matérias e o vetor de "Conceito" solto não fica perto de nada útil.
 *
 * O CARGO NÃO ENTRA. Ele é o mesmo para todos os tópicos de um edital,
 * então acrescentá-lo empurraria TODOS os pares na mesma direção — o
 * ruído subiria junto com o sinal e a ordenação, que é a única coisa
 * que se quer aqui, ficaria igual. Quem precisa saber do cargo é a IA,
 * na etapa seguinte, e lá ele está.
 * ------------------------------------------------------------------ */
function vzTextoDoTopico(disciplina, topico) {
  const d = String(disciplina || "").trim();
  const t2 = String(topico || "").trim();
  return d ? d + ": " + t2 : t2;
}

/* ------------------------------------------------------------------
 * COSSENO
 *
 * Com os vetores já normalizados (a API devolve assim), o cosseno é o
 * produto escalar. Normalizar de novo por precaução custa uma raiz por
 * vetor e evita um resultado silenciosamente errado caso a API mude —
 * e "silenciosamente errado" aqui significa uma lista de candidatos
 * ordenada por nada.
 * ------------------------------------------------------------------ */
function vzNormalizar(v) {
  let soma = 0;
  for (let i = 0; i < v.length; i++) soma += v[i] * v[i];
  const n = Math.sqrt(soma);
  if (!n || !isFinite(n)) return v.slice();
  const saida = new Array(v.length);
  for (let i = 0; i < v.length; i++) saida[i] = v[i] / n;
  return saida;
}

function vzCos(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  /* o arredondamento de ponto flutuante põe 1.0000000002 de vez em
   * quando, e um score acima de 100% na tela destrói a confiança na
   * medida inteira */
  return Math.max(-1, Math.min(1, s));
}

/* ------------------------------------------------------------------
 * O CRUZAMENTO
 *
 * 533 × 232 = 123.656 comparações de 768 números. Parece muito e são
 * uns 95 milhões de multiplicações — décimos de segundo. O que não
 * cabe é o resultado: por isso o corte e o teto.
 *
 * "melhorPorOrigem" existe porque a distribuição é desigual. Um tópico
 * genérico ("Princípios") fica razoavelmente perto de trinta outros, e
 * sem limite por origem ele sozinho ocuparia as duzentas e cinquenta
 * vagas — o edital inteiro sumiria atrás de uma palavra vaga.
 * ------------------------------------------------------------------ */
function vzCruzar(a, b, opc) {
  const o = opc || {};
  const corte = o.corte === undefined ? VZ_CORTE : o.corte;
  const teto = o.teto === undefined ? VZ_TETO : o.teto;
  const porOrigem = o.porOrigem === undefined ? 3 : o.porOrigem;
  const pares = [];

  (a || []).forEach((x) => {
    const daqui = [];
    (b || []).forEach((y) => {
      if (!x.vetor || !y.vetor) return;
      const s = vzCos(x.vetor, y.vetor);
      if (s < corte) return;
      daqui.push({
        de: { disciplina: x.disciplina, topico: x.topico },
        para: { disciplina: y.disciplina, topico: y.topico },
        score: s, faixa: vzFaixa(s),
      });
    });
    daqui.sort((p, q) => q.score - p.score);
    daqui.slice(0, porOrigem).forEach((p) => pares.push(p));
  });

  pares.sort((p, q) => q.score - p.score);
  /* devolve quantas ficaram de fora: um teto que corta em silêncio faz
   * a pessoa concluir que o resto do edital não tem coincidência
   * nenhuma, quando o que houve foi falta de espaço */
  const cortados = Math.max(0, pares.length - teto);
  return { pares: pares.slice(0, teto), cortados };
}

/* ------------------------------------------------------------------
 * A CHAMADA À API
 *
 * "buscar" entra por parâmetro para o teste poder responder no lugar da
 * rede. Sem isso, ou o teste chama a internet — e passa a depender de
 * uma chave, de uma conexão e do humor de um servidor —, ou este
 * caminho fica sem teste nenhum.
 * ------------------------------------------------------------------ */
/* A APARA MORA AQUI, no ponto em que ela decide alguma coisa.
 *
 * Guardar e ler também aparavam, e as duas se cobriam: tirar qualquer
 * uma não mudava nada, o que é o mesmo que dizer que nenhuma das duas
 * estava sendo testada. Colar uma chave do site traz espaço no fim mais
 * vezes do que não traz, e encodeURIComponent transforma esse espaço em
 * "%20" dentro da URL — uma chave silenciosamente diferente, recusada
 * com a mesma mensagem de uma chave errada de verdade. */
function vzUrlLote(chave) {
  return "https://generativelanguage.googleapis.com/v1beta/models/"
    + VZ_MODELO + ":batchEmbedContents?key="
    + encodeURIComponent(String(chave || "").trim());
}

async function vzVetores(textos, opc) {
  const o = opc || {};
  const chave = o.chave || vzChaveApi();
  if (!chave) throw new Error("sem_chave");
  const buscar = o.buscar
    || (typeof fetch === "function" ? (u, i) => fetch(u, i) : null);
  if (!buscar) throw new Error("sem_rede");

  const saida = [];
  for (let i = 0; i < textos.length; i += VZ_LOTE) {
    const lote = textos.slice(i, i + VZ_LOTE);
    const corpo = {
      requests: lote.map((t2) => ({
        model: "models/" + VZ_MODELO,
        content: { parts: [{ text: String(t2) }] },
        /* SEMANTIC_SIMILARITY e não RETRIEVAL: a pergunta é
         * "parecidos entre si?", simétrica, e não "qual documento
         * responde a esta busca?" */
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: VZ_DIMS,
      })),
    };
    const r = await buscar(vzUrlLote(chave), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!r || !r.ok) {
      /* O MOTIVO, NÃO SÓ "DEU ERRO". Chave recusada, cota estourada e
       * rede caída pedem coisas diferentes de quem está na frente da
       * tela, e "falhou" manda tentar de novo nos três casos. */
      const st = (r && r.status) || 0;
      let detalhe = "";
      try { detalhe = r && r.text ? String(await r.text()).slice(0, 300) : ""; }
      catch (e) {}
      const err = new Error(st === 400 || st === 401 || st === 403
        ? "chave_recusada" : (st === 429 ? "cota" : "rede"));
      err.status = st;
      err.detalhe = detalhe;
      throw err;
    }
    const dados = await r.json();
    const vetores = (dados && dados.embeddings) || [];
    if (vetores.length !== lote.length) {
      const err = new Error("resposta_incompleta");
      err.detalhe = vetores.length + " de " + lote.length;
      throw err;
    }
    vetores.forEach((e) => saida.push(vzNormalizar((e && e.values) || [])));
    if (o.andamento) o.andamento(Math.min(i + VZ_LOTE, textos.length),
                                 textos.length);
  }
  return saida;
}

/* ------------------------------------------------------------------
 * DE DUAS LISTAS DE TÓPICOS ÀS DUPLAS CANDIDATAS
 *
 * OS VETORES NÃO SÃO GUARDADOS.
 *
 * 765 tópicos em 768 dimensões são uns 4 MB escritos como texto, e o
 * aplicativo inteiro vive dentro de 5 MB de localStorage — guardá-los
 * espremeria o diário, o material e as questões, que são os dados de
 * verdade, para acelerar uma etapa que custa um milésimo de dólar
 * refazer. Passam pela memória, viram duzentas duplas, e vão embora.
 * ------------------------------------------------------------------ */
/* =====================================================================
 * MEDIR OS VÍNCULOS QUE JÁ EXISTEM — para ordenar a faxina
 *
 * Revisar quinhentos vínculos a olho não acontece. Mas a saída NÃO é
 * apagar sozinho abaixo de um corte, e o motivo é o mesmo de sempre,
 * agora invertido:
 *
 *   · score ALTO é prova fraca de equivalência — "Responsabilidade
 *     Civil" e "Responsabilidade Civil do Estado" ficam a 94%;
 *   · score BAIXO é prova fraca de NÃO-equivalência — "Improbidade
 *     administrativa" e "Lei nº 8.429/1992" são a mesma coisa e ficam
 *     longe, porque um é conceito e o outro é número de lei.
 *
 * Apagar automaticamente abaixo de 0,6 destruiria justamente os
 * vínculos mais valiosos: os que ligam nomes diferentes para a mesma
 * matéria. Esses são difíceis de reconhecer e são o motivo de existir
 * esta ferramenta — os fáceis a pessoa acha sozinha.
 *
 * Então a medida ORDENA e PRÉ-MARCA. Os mais frouxos sobem para o topo
 * da lista, já marcados, com o número ao lado; um passe de olho
 * desmarca os poucos que são bons e o resto vai embora numa vez. O
 * trabalho manual cai de quinhentas decisões para uma leitura — e
 * continua sendo decisão de quem estuda.
 * ===================================================================== */
async function vzMedirVinculos(pares, opc) {
  const o = opc || {};
  const lista = pares || [];
  if (!lista.length) return { medidos: [], tokens: 0 };

  /* cada tópico entra UMA vez, mesmo aparecendo em dez vínculos: são
   * quinhentos pares e umas duzentas chaves distintas, e pagar dez
   * vezes pelo mesmo vetor é jogar dinheiro e tempo fora */
  const indice = {}, textos = [];
  const por = (nome) => {
    const partes = String(nome || "").split("›");
    const txt = vzTextoDoTopico(partes[0], partes.slice(1).join("›"));
    if (indice[txt] === undefined) { indice[txt] = textos.length; textos.push(txt); }
    return indice[txt];
  };
  lista.forEach((p) => { p._ia = por(p.nomeA); p._ib = por(p.nomeB); });

  const vetores = await vzVetores(textos, o);
  const medidos = lista.map((p) => Object.assign({}, p, {
    score: vzCos(vetores[p._ia], vetores[p._ib]),
  }));
  /* DO MAIS FROUXO PARA O MAIS FIRME: a faxina começa por onde há mais
   * chance de estar o lixo, e quem cansar no meio já terá tirado o pior */
  medidos.sort((a, b) => a.score - b.score);
  medidos.forEach((m) => { delete m._ia; delete m._ib; });
  const tokens = Math.ceil(textos.join(" ").length / 4);
  vzLogGravar("medir-vinculos",
    { pares: lista.length, topicos: textos.length, tokens },
    medidos.slice(0, VZ_LOG_AMOSTRA).map((m) =>
      Math.round(m.score * 100) + "%  " + m.nomeA + " ↔ " + m.nomeB));
  return { medidos, tokens };
}

async function vzDuplas(listaA, listaB, opc) {
  const o = opc || {};
  const a = (listaA || []).map((x) => ({
    disciplina: x.disciplina || "",
    topico: x.topico || x.nome || "",
  }));
  const b = (listaB || []).map((x) => ({
    disciplina: x.disciplina || "",
    topico: x.topico || x.nome || "",
  }));
  if (!a.length || !b.length) return { pares: [], cortados: 0, tokens: 0 };

  const textos = a.concat(b).map((x) => vzTextoDoTopico(x.disciplina, x.topico));
  const vetores = await vzVetores(textos, o);
  a.forEach((x, i) => { x.vetor = vetores[i]; });
  b.forEach((x, i) => { x.vetor = vetores[a.length + i]; });

  const r = vzCruzar(a, b, o);
  /* uma estimativa grosseira para a tela poder dizer o custo — quatro
   * caracteres por token é a regra de bolso, e o número serve para
   * ordem de grandeza, não para conferir a fatura */
  r.tokens = Math.ceil(textos.join(" ").length / 4);
  r.quantosA = a.length;
  r.quantosB = b.length;
  return r;
}
