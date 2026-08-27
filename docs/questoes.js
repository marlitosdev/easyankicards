/* =====================================================================
 * QUESTÕES — arquivo próprio
 *
 * Por que arquivo próprio, e não dentro da gaveta do tópico como o resumo,
 * os cartões e a lei seca: uma questão de "Princípios orçamentários" da FGV
 * serve para o TCE-PE e serve para o ISS Caruaru. Presa ao tópico de um
 * edital, ela teria de ser duplicada a cada concurso novo — e duplicata é
 * onde o estudo começa a mentir sobre o quanto foi feito.
 *
 * Cada questão guarda a CHAVE do tópico (disciplina›tópico, a mesma regra de
 * endereçamento do material), então continua sendo possível perguntar "as
 * questões deste resumo" sem que ela pertença ao resumo.
 *
 * FORMATO CANÔNICO (o que a IA devolve e o que o app lê)
 *
 *   ? CE :: FGV :: Enunciado da afirmação a julgar
 *   = C :: Comentário explicando por que está certa
 *
 *   ? ME :: Cebraspe :: Enunciado da pergunta
 *   A) primeira opção
 *   B) segunda opção
 *   C) terceira opção
 *   = B :: Comentário explicando a resposta
 *
 * CE = certo/errado (gabarito "C" ou "E").
 * ME = múltipla escolha (gabarito é a letra).
 * A banca é opcional: deixar vazio é resposta honesta, inventar não é.
 * ===================================================================== */

const QS_CHAVE_LOJA = "eac_questoes";
const QS_TIPOS = ["ce", "me"];
let qsBanco = [];

function qsNormal(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function qsCarregar(lerLoja) {
  let cru = null;
  if (lerLoja) cru = lerLoja(QS_CHAVE_LOJA);
  else { try { cru = localStorage.getItem(QS_CHAVE_LOJA); } catch (e) { cru = null; } }
  try {
    const v = JSON.parse(cru || "[]");
    qsBanco = Array.isArray(v) ? v : [];
  } catch (e) { qsBanco = []; }
  return qsBanco;
}

function qsSalvar(gravar, chave) {
  const txt = JSON.stringify(qsBanco);
  if (gravar) { gravar(QS_CHAVE_LOJA, txt); return; }
  try { localStorage.setItem(QS_CHAVE_LOJA, txt); } catch (e) {}
  /* mesma ponte do material: sem ela, a questão recém-criada só aparecia
   * na agenda depois de recarregar a página */
  try { if (typeof edAvisarMudanca === "function") edAvisarMudanca(chave); }
  catch (e) {}
}

function qsTodas() { return qsBanco; }

let qsSeq = 0;
function qsNovoId() {
  qsSeq++;
  return "q" + Date.now().toString(36) + qsSeq.toString(36);
}

/* ---------------------------------------------------------------------
 * O PROMPT
 *
 * O trabalho da IA é TRANSFORMAR o que já está no resumo, não inventar
 * matéria nova: um texto que já é questão vira questão respondível; um
 * texto corrido vira questões sobre o que ele afirma. O que ele não diz,
 * a IA não deve supor.
 * ------------------------------------------------------------------- */
/* PROMPT PARA UM CADERNO COM FONTES CARREGADAS (NotebookLM e afins).
 *
 * A diferença que justifica um prompt separado: ali a IA já tem o
 * material e responde ancorada nele. O prompt genérico pede "gere
 * questões sobre este texto" e não manda texto nenhum — no caderno isso
 * desperdiça a única vantagem real do lugar, e ainda deixa a porta
 * aberta para a IA responder de memória, que é como entram no banco as
 * questões com contexto errado.
 *
 * Aqui as instruções são o contrário: SÓ o que está nas fontes, e a
 * citação de onde saiu dentro do comentário — que é o que permite,
 * meses depois, conferir a questão contra o material em vez de
 * acreditar nela. */
function qsPromptCaderno(ctx) {
  const c = ctx || {};
  return t("qs_prompt_caderno", {
    disciplina: c.disciplina || "?",
    topico: c.topico || "?",
    concurso: c.concurso || "?",
  });
}

function qsPrompt(texto, ctx) {
  const c = ctx || {};
  return t("qs_prompt", {
    disciplina: c.disciplina || "?",
    topico: c.topico || "?",
    concurso: c.concurso || "?",
    texto: String(texto || "").slice(0, 12000),
  });
}

/* ---------------------------------------------------------------------
 * LER A RESPOSTA
 *
 * Tolerante na entrada, rígido na saída — a mesma postura do leitor de
 * cartões. O que não der para entender vai para "ignoradas" COM o motivo,
 * em vez de virar uma questão pela metade que só aparece meses depois, no
 * meio de um simulado, quando não dá mais para saber o que se perdeu.
 * ------------------------------------------------------------------- */
/* TUDO NUMA LINHA SÓ TAMBÉM É RESPOSTA VÁLIDA.
 *
 * O formato pede um campo por linha, mas a IA — e a área de transferência
 * de alguns chats — devolve o bloco inteiro numa linha:
 *   "[QUESTAO] TIPO: CE BANCA: FGV ENUNCIADO: … GABARITO: C COMENTARIO: … [/QUESTAO]"
 * O leitor só olhava o COMEÇO da linha, então via o "[QUESTAO]" e jogava o
 * resto fora: treze questões perfeitas viravam treze "sem enunciado e sem
 * gabarito". O conteúdo estava certo; a exigência é que era rígida demais.
 *
 * Aqui a linha é reaberta nos rótulos, antes de qualquer leitura. Rótulo é
 * marca inequívoca — não se confunde com texto corrido —, então dá para
 * cortar por ele sem risco de partir um enunciado ao meio.
 */
function qsAbrirCampos(txt) {
  return String(txt || "")
    .replace(/\s*\[\s*\/\s*QUEST[ÃA]O\s*\]\s*/gi, "\n[/QUESTAO]\n")
    .replace(/\s*\[\s*QUEST[ÃA]O\s*\]\s*/gi, "\n[QUESTAO]\n")
    /* NÃO consumir a quebra de linha depois dos dois-pontos.
     * Com "\\s*" ali, um campo vazio ("BANCA:" sozinho na linha) engolia a
     * quebra seguinte e grudava o campo de baixo dentro dele — a banca
     * vazia virava "BANCA: ENUNCIADO: …" e o enunciado sumia. */
    .replace(/(^|[^\S\n])(TIPO|BANCA|ENUNCIADO|GABARITO|COMENT[ÁA]RIO)[ \t]*:[ \t]*/gim,
             (mm, antes, nome) => "\n" + nome.toUpperCase() + ": ")
    .replace(/\n{3,}/g, "\n\n");
}

function qsLerResposta(txt, ctx) {
  const c = ctx || {};
  const achados = [];
  const ignoradas = [];
  const linhas = qsAbrirCampos(txt).split("\n");
  let atual = null;

  const fechar = () => {
    if (!atual) return;
    /* opções escritas dentro do próprio enunciado: "… ? A) uma B) outra" */
    qsSepararOpcoesInline(atual);
    /* O CONTEÚDO MANDA, NÃO O RÓTULO.
     * A IA às vezes escreve "? CE" e entrega opções A/B/C. Se a correção
     * viesse depois da conferência, uma questão perfeitamente boa era
     * recusada por "gabarito não é C nem E" — jogando fora o trabalho por
     * causa de uma etiqueta. */
    if (atual.tipo === "ce" && atual.opcoes.length >= 2) atual.tipo = "me";
    if (atual.tipo === "me" && !atual.opcoes.length) atual.tipo = "ce";
    const problemas = [];
    if (!atual.enunciado) problemas.push("sem_enunciado");
    if (!atual.gabarito) problemas.push("sem_gabarito");
    if (atual.tipo === "me") {
      if (atual.opcoes.length < 2) problemas.push("poucas_opcoes");
      else if (!atual.opcoes.some((o) => o.letra === atual.gabarito)) {
        problemas.push("gabarito_fora_das_opcoes");
      }
    }
    if (atual.tipo === "ce" && atual.gabarito
        && atual.gabarito !== "C" && atual.gabarito !== "E") {
      problemas.push("gabarito_nao_e_C_nem_E");
    }
    delete atual._lendoComentario;
    if (problemas.length) {
      ignoradas.push({ linha: atual.linha,
                       txt: String(atual.enunciado || "").slice(0, 70),
                       motivo: problemas.join("+") });
    } else {
      achados.push(atual);
    }
    atual = null;
  };

  /* CAMPOS NOMEADOS — o formato que a IA deve devolver.
   * A primeira versão pedia uma linha compacta ("? CE :: banca :: …") e
   * confiava em pontuação para separar as partes. Funciona quando a IA
   * colabora e falha em silêncio quando ela põe um "::" no meio do
   * enunciado. Com o campo dito pelo nome, cada pedaço chega rotulado e
   * não há o que adivinhar.
   * O formato antigo continua sendo aceito: respostas já copiadas por aí
   * não podem parar de funcionar. */
  const CAMPOS = {
    tipo: /^TIPO\s*:\s*(.*)$/i,
    banca: /^BANCA\s*:\s*(.*)$/i,
    enunciado: /^ENUNCIADO\s*:\s*(.*)$/i,
    gabarito: /^GABARITO\s*:\s*(.*)$/i,
    comentario: /^COMENT[ÁA]RIO\s*:\s*(.*)$/i,
  };
  let campoAberto = "";

  linhas.forEach((l0, li) => {
    const l = l0.trim();
    /* linha em branco ENCERRA o comentário. Sem isso, a despedida da IA
     * ("Espero ter ajudado!") virava parte do gabarito comentado — o mesmo
     * defeito que os cartões já tiveram com o prompt vazando para dentro
     * do cartão. */
    if (!l) { if (atual) atual._lendoComentario = false; return; }
    if (/^-{3,}$/.test(l)) { if (atual) atual._lendoComentario = false; return; }

    /* abre uma questão nova no formato nomeado */
    if (/^\[QUEST[ÃA]O\]?/i.test(l) || /^QUEST[ÃA]O\s*\d*\s*$/i.test(l)) {
      fechar();
      campoAberto = "";
      atual = {
        id: qsNovoId(), tipo: "ce", enunciado: "", opcoes: [], gabarito: "",
        comentario: "", banca: "",
        disciplina: c.disciplina || "", topico: c.topico || "",
        chave: c.chave || "", concurso: c.concurso || "",
        origem: "prompt", linha: li + 1,
      };
      return;
    }
    if (/^\[\/QUEST[ÃA]O\]$/i.test(l)) { fechar(); campoAberto = ""; return; }

    let achouCampo = false;
    Object.keys(CAMPOS).forEach((k) => {
      if (achouCampo) return;
      const mm = l.match(CAMPOS[k]);
      if (!mm) return;
      achouCampo = true;
      if (!atual) {
        atual = {
          id: qsNovoId(), tipo: "ce", enunciado: "", opcoes: [], gabarito: "",
          comentario: "", banca: "",
          disciplina: c.disciplina || "", topico: c.topico || "",
          chave: c.chave || "", concurso: c.concurso || "",
          origem: "prompt", linha: li + 1,
        };
      }
      const v = String(mm[1] || "").trim();
      /* TIPO é dica, não decisão: quem manda é o conteúdo — tem opções, é
       * múltipla escolha; não tem, é certo/errado. A IA erra o rótulo com
       * frequência e acerta o conteúdo. O campo continua sendo LIDO para
       * não sobrar como linha solta dentro do enunciado. */
      if (k === "tipo") atual.tipo = qsNormal(v).indexOf("ce") === 0 ? "ce" : "me";
      else if (k === "gabarito") atual.gabarito = v.toUpperCase().slice(0, 1);
      else atual[k] = v;
      campoAberto = k;
    });
    if (achouCampo) return;

    if (/^\?/.test(l)) {
      fechar();
      campoAberto = "";
      const p = l.replace(/^\?\s*/, "").split("::").map((x) => x.trim());
      const tipo = qsNormal(p[0]).replace(/[^a-z]/g, "");
      let banca = "", enunciado = "";
      /* "? CE :: banca :: enunciado", mas a banca pode faltar e aí são dois
       * campos. Contar as partes é mais gentil do que exigir um "::" vazio
       * de quem escreve à mão. */
      if (p.length >= 3) { banca = p[1]; enunciado = p.slice(2).join(" :: "); }
      else { enunciado = p.slice(1).join(" :: "); }
      atual = {
        id: qsNovoId(),
        tipo: QS_TIPOS.indexOf(tipo) >= 0 ? tipo : "me",
        enunciado: enunciado.trim(),
        opcoes: [], gabarito: "", comentario: "",
        banca: banca.trim(),
        disciplina: c.disciplina || "", topico: c.topico || "",
        chave: c.chave || "", concurso: c.concurso || "",
        origem: "prompt", linha: li + 1,
      };
      return;
    }

    const mo = l.match(/^([A-Ea-e])\s*[).\-]\s+(.+)$/);
    if (mo && atual && !atual.gabarito) {
      campoAberto = "";
      atual.opcoes.push({ letra: mo[1].toUpperCase(), txt: mo[2].trim() });
      return;
    }

    if (/^=/.test(l) && atual) {
      const p = l.replace(/^=\s*/, "").split("::");
      atual.gabarito = String(p[0] || "").trim().toUpperCase().slice(0, 1);
      atual.comentario = p.slice(1).join("::").trim();
      atual._lendoComentario = true;
      return;
    }

    /* continuação de um campo nomeado que ocupou mais de uma linha */
    if (atual && campoAberto && (campoAberto === "enunciado" || campoAberto === "comentario")) {
      atual[campoAberto] = (atual[campoAberto] ? atual[campoAberto] + " " : "") + l;
      return;
    }
    if (atual && atual._lendoComentario) {
      /* só continua o comentário se a frase estava PENDURADA. Um comentário
       * que já terminou em ponto não pede continuação — o que vem depois é
       * outra coisa, e outra coisa tem de aparecer na conferência em vez de
       * entrar de carona no gabarito. */
      if (/[.!?:;]["»)\]]?$/.test(atual.comentario)) {
        atual._lendoComentario = false;
        ignoradas.push({ linha: li + 1, txt: l.slice(0, 70), motivo: "fora_de_questao" });
        return;
      }
      atual.comentario = (atual.comentario ? atual.comentario + " " : "") + l;
      return;
    }
    if (atual && !atual.gabarito && !atual.opcoes.length) {
      atual.enunciado = (atual.enunciado ? atual.enunciado + " " : "") + l;
      return;
    }
    ignoradas.push({ linha: li + 1, txt: l.slice(0, 70), motivo: "fora_de_questao" });
  });
  fechar();

  return { achados, ignoradas };
}

/* =====================================================================
 * D1 — QUESTÕES QUE JÁ ESTÃO ESCRITAS NO RESUMO
 *
 * Boa parte do material já vem em forma de questão, com a resposta logo
 * abaixo. Lendo assim não há teste nenhum: a resposta chega antes de a
 * pergunta terminar. Aqui elas são ENCONTRADAS no texto — sem IA, sem
 * reescrever nada.
 *
 * Conservador de propósito: exige o PAR cabeçalho + resposta. Um sozinho
 * não vira questão. Material didático é cheio de pergunta retórica seguida
 * de explicação, e transformar isso em questão esconderia texto que a
 * pessoa quer ler corrido.
 * ===================================================================== */
const QS_CAB = /^\s*[-*•]?\s*(?:\*\*)?\s*Quest[ãa]o\b\s*(\d+)?\s*(?:\(([^)]*)\))?\s*:?\s*(?:\*\*)?\s*(.*)$/i;
const QS_RESP = /^\s*[-*•]?\s*(?:\*\*)?\s*(?:Resposta|Gabarito)\s*:?\s*(.*)$/i;

function qsSemMarcacao(s) {
  /* tira também o "#" de título: material de estudo escreve as questões
   * como "#### **Questão 1: …**", e sem remover o cabeçalho de markdown o
   * detector não reconhecia nenhuma delas. */
  return String(s == null ? "" : s)
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*|__|_|==[!?§*~]?/g, "").trim();
}

/* "… ? A) uma B) outra C) terceira" numa linha só.
 * Precisa rodar também no FIM do bloco: as opções costumam vir na linha
 * seguinte ao cabeçalho, e checar só no cabeçalho deixava a questão como
 * certo/errado com um gabarito "B" que não existia em opção nenhuma. */
function qsSepararOpcoesInline(bloco) {
  if (!bloco || bloco.opcoes.length) return bloco;
  const partes = String(bloco.enunciado || "").split(/(?=\b[A-E]\)\s)/);
  if (partes.length < 3) return bloco;
  bloco.enunciado = partes[0].trim();
  partes.slice(1).forEach((p) => {
    const mm = p.match(/^([A-E])\)\s*(.*)$/);
    if (mm) bloco.opcoes.push({ letra: mm[1], txt: mm[2].trim() });
  });
  return bloco;
}

function qsNoTexto(txt) {
  const linhas = String(txt || "").split("\n");
  const blocos = [];
  let aberto = null;
  let gabDe = null;      /* questão cujo comentário está sendo lido da seção de gabaritos */

  linhas.forEach((l, i) => {
    const cru = qsSemMarcacao(l);

    const mc = cru.match(QS_CAB);
    if (mc) {
      /* SEÇÃO "GABARITO COMENTADO", à parte.
       * Muito material separa as questões das respostas: primeiro a lista de
       * questões, depois um bloco "GABARITO COMENTADO" onde cada linha é
       * "Questão 1: Gabarito B" seguida da fundamentação. Essas linhas
       * COMEÇAM com "Questão", então eram lidas como um cabeçalho novo — e
       * a questão lá de cima ficava sem gabarito e era recusada.
       * Aqui, "Questão N: Gabarito X" volta para a questão N. */
      /* guarda a questão ainda aberta ANTES de tratar a linha de gabarito:
       * senão ela é descartada aqui e o gabarito dela, que vem logo abaixo,
       * não encontra dono. */
      const guardarAberta = () => {
        if (!aberto) return;
        qsSepararOpcoesInline(aberto);
        aberto.fim = i - 1;
        aberto.tipo = aberto.opcoes.length ? "me" : "ce";
        aberto.completa = false;
        blocos.push(aberto);
        aberto = null;
      };
      const mg = String(mc[3] || "").match(
        /^Gabarito\s*:?\s*([A-E]|Certo|Errado|Sim|N[ãa]o|Verdadeiro|Falso)\b[.,]?\s*(.*)$/i);
      if (mg && mc[1]) {
        guardarAberta();
        const dono = blocos.filter((b) => b.num === mc[1] && !b.gabarito)[0];
        if (dono) {
          const g = qsNormal(mg[1]);
          dono.gabarito = /^[a-e]$/.test(g) ? g.toUpperCase()
            : (/^(sim|certo|verdadeiro)/.test(g) ? "C" : "E");
          dono.comentario = [dono.comentario, mg[2]].filter(Boolean).join(" ").trim();
          dono.completa = !!(dono.gabarito && dono.enunciado);
          gabDe = dono;                 /* as linhas seguintes são a fundamentação */
          return;
        }
      }
      /* cabeçalho novo antes de a resposta chegar: o anterior não era uma
       * questão completa, e questão sem gabarito não dá para responder */
      /* GUARDA A ANTERIOR MESMO SEM RESPOSTA.
       * Ela era descartada em silêncio, e por isso a seção "GABARITO
       * COMENTADO" mais abaixo não tinha a quem entregar o gabarito. Fica
       * como incompleta — e a seção de gabaritos a completa. */
      guardarAberta();
      gabDe = null;
      aberto = {
        ini: i, num: mc[1] || "",
        /* o parêntese NÃO é necessariamente a banca: "(FGV - Juiz)" é, mas
         * "(Questão de Pegadinha)" e "(FGV - Adaptada)" não são. Guardo o
         * texto inteiro como rótulo e deixo a banca para confirmação — o
         * detector não tem como saber, e chutar viraria etiqueta errada
         * em cima de questão certa. */
        rotulo: (mc[2] || "").trim(),
        enunciado: mc[3] || "", opcoes: [], gabarito: "", comentario: "",
      };
      qsSepararOpcoesInline(aberto);
      return;
    }
    /* fundamentação do gabarito, na seção à parte */
    if (!aberto && gabDe) {
      if (!cru) { gabDe = null; return; }
      gabDe.comentario = (gabDe.comentario ? gabDe.comentario + " " : "")
        + cru.replace(/^\s*(?:\*\*)?\s*Fundamenta[çc][ãa]o\s*(?:\*\*)?\s*:?\s*/i, "");
      return;
    }
    if (!aberto) return;

    /* opção em linha própria */
    const mo = cru.match(/^([A-Ea-e])\s*[).]\s+(.+)$/);
    if (mo && !aberto.gabarito) {
      aberto.opcoes.push({ letra: mo[1].toUpperCase(), txt: mo[2].trim() });
      return;
    }

    const mr = cru.match(QS_RESP);
    if (mr) {
      const resto = mr[1] || "";
      /* "GABARITO COMENTADO" é TÍTULO de seção, não resposta.
       * Começa com "Gabarito", então era engolido como se fosse a resposta
       * da questão aberta acima — e a palavra "COMENTADO" ia parar dentro
       * do comentário dela. */
      if (!resto || /^(comentad[oa]s?|das quest[õo]es|comentado das quest[õo]es)$/i
          .test(resto.trim())) {
        return;
      }
      const porLetra = resto.match(/^([A-E])\b[.)]?\s*(.*)$/);
      const porPalavra = resto.match(/^(Sim|N[ãa]o|Certo|Errado|Verdadeiro|Falso)\b[.,]?\s*(.*)$/i);
      if (aberto.opcoes.length && porLetra) {
        aberto.gabarito = porLetra[1]; aberto.comentario = porLetra[2];
      } else if (porPalavra) {
        const p0 = qsNormal(porPalavra[1]);
        aberto.gabarito = /^(sim|certo|verdadeiro)/.test(p0) ? "C" : "E";
        aberto.comentario = porPalavra[2];
      } else {
        /* resposta sem gabarito reconhecível: não dá para responder, então
         * não vira questão — mas o bloco fica registrado como incompleto
         * para poder ser mostrado na importação com o motivo. */
        aberto.comentario = resto;
      }
      qsSepararOpcoesInline(aberto);
      aberto.fim = i;
      aberto.tipo = aberto.opcoes.length ? "me" : "ce";
      aberto.completa = !!(aberto.gabarito && aberto.enunciado);
      blocos.push(aberto);
      aberto = null;
      return;
    }

    /* linha corrida logo abaixo do enunciado: continuação dele */
    if (!aberto.opcoes.length && !aberto.gabarito && cru) {
      aberto.enunciado = (aberto.enunciado ? aberto.enunciado + " " : "") + cru;
    }
  });
  if (aberto) {
    qsSepararOpcoesInline(aberto);
    aberto.fim = linhas.length - 1;
    aberto.tipo = aberto.opcoes.length ? "me" : "ce";
    aberto.completa = false;
    blocos.push(aberto);
  }
  return blocos;
}

/* converte os blocos achados no texto para o mesmo formato das questões
 * geradas pela IA, para poderem entrar no banco pelo mesmo caminho */
function qsDeBlocos(blocos, ctx) {
  const c = ctx || {};
  return (blocos || []).filter((b) => b.completa).map((b) => ({
    id: qsNovoId(),
    tipo: b.tipo, enunciado: b.enunciado,
    opcoes: b.opcoes.slice(), gabarito: b.gabarito, comentario: b.comentario,
    banca: "", rotulo: b.rotulo,
    disciplina: c.disciplina || "", topico: c.topico || "",
    chave: c.chave || "", concurso: c.concurso || "",
    origem: "texto",
  }));
}

/* ---------------------------------------------------------------------
 * GRAVAR — com recibo, e sem duplicar
 * ------------------------------------------------------------------- */
function qsIgual(a, b) {
  return qsNormal(a.enunciado) === qsNormal(b.enunciado)
    && (a.chave || "") === (b.chave || "");
}

/* =====================================================================
 * PARECIDA COM ALGUMA QUE JÁ EXISTE?
 *
 * Antes a duplicata era descartada na gravação, calada. O registro dizia
 * "6 repetidas" — um número sem cara: não dava para saber quais, nem
 * contra o que, nem se a decisão estava certa. Perder trabalho em silêncio
 * é pior do que gravar duplicata, porque a duplicata dá para apagar depois
 * e o que sumiu ninguém procura.
 *
 * Esta função só APONTA. Quem decide é quem está olhando.
 * ===================================================================== */
function qsPalavras(s) {
  return qsNormal(s).replace(/[^\wà-ÿ ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3);
}

function qsParecenca(a, b) {
  const pa = qsPalavras(a), pb = qsPalavras(b);
  if (!pa.length || !pb.length) return 0;
  const setB = {};
  pb.forEach((w) => { setB[w] = 1; });
  let juntas = 0;
  const vistas = {};
  pa.forEach((w) => { if (setB[w] && !vistas[w]) { juntas++; vistas[w] = 1; } });
  const total = new Set(pa.concat(pb)).size;
  return total ? juntas / total : 0;
}

/* devolve { como, existente, score } ou null */
function qsSemelhante(nova, lista) {
  const base = lista || qsBanco;
  const en = qsNormal(nova.enunciado);
  let melhor = null;
  base.forEach((v) => {
    if (qsNormal(v.enunciado) === en) {
      const mesmoTopico = (v.chave || "") === (nova.chave || "");
      const como = mesmoTopico ? "igual" : "igual_outro_topico";
      if (!melhor || como === "igual") melhor = { como, existente: v, score: 1 };
      return;
    }
    const s = qsParecenca(v.enunciado, nova.enunciado);
    if (s >= 0.8 && (!melhor || (melhor.score < s && melhor.como !== "igual"))) {
      melhor = { como: "parecida", existente: v, score: s };
    }
  });
  return melhor;
}

function qsAplicar(lista, gravar) {
  const novas = [];
  let repetidas = 0;
  const recusadas = [];
  (lista || []).forEach((q) => {
    /* "_forcar" é a decisão de quem viu as duas lado a lado e disse para
     * gravar assim mesmo. Sem isso, a escolha da pessoa seria desfeita
     * aqui embaixo, o que é pior do que nunca ter perguntado. */
    if (!q._forcar && qsBanco.some((v) => qsIgual(v, q))) {
      repetidas++;
      recusadas.push({ enunciado: q.enunciado, motivo: "ja_existe" });
      return;
    }
    const limpa = {
      id: q.id || qsNovoId(),
      tipo: q.tipo === "ce" ? "ce" : "me",
      enunciado: String(q.enunciado || "").trim(),
      opcoes: (q.opcoes || []).map((o) => ({ letra: o.letra, txt: o.txt })),
      gabarito: String(q.gabarito || "").toUpperCase().slice(0, 1),
      comentario: String(q.comentario || "").trim(),
      disciplina: q.disciplina || "", topico: q.topico || "",
      chave: q.chave || "", concurso: q.concurso || "", banca: q.banca || "",
      origem: q.origem || "manual",
      /* sem campo de dica aqui: nada cria questao JA com dica — ela nasce
       * depois, pelo botao, via qsGravarDica. Guardar o campo na gravacao
       * seria linha que nenhuma sabotagem consegue quebrar. */
      criado: new Date().toISOString(),
      tentativas: [],
    };
    qsBanco.push(limpa);
    novas.push(limpa);
  });
  qsSalvar(gravar, novas.length ? novas[0].chave : "");
  return { novas: novas.length, repetidas, recusadas,
           ids: novas.map((x) => x.id) };
}

function qsDesfazer(recibo, gravar) {
  if (!recibo || !recibo.ids) return 0;
  const antes = qsBanco.length;
  qsBanco = qsBanco.filter((q) => recibo.ids.indexOf(q.id) < 0);
  qsSalvar(gravar);
  return antes - qsBanco.length;
}

/* A DICA É SUA, e é outra coisa que o comentário.
 * O comentário explica por que o gabarito é aquele — vem da questão. A dica
 * é o que VOCÊ escreveu para não errar de novo: o macete, o jeito de
 * lembrar, o erro que já cometeu aqui. Guardar as duas juntas apagaria essa
 * diferença, e é a sua que costuma ser a que faz a questão parar de cair. */
function qsGravarDica(id, texto, gravar) {
  const q = qsBanco.filter((x) => x.id === id)[0];
  if (!q) return null;
  const limpo = String(texto || "").trim();
  if (limpo) q.dica = limpo; else delete q.dica;
  q.tocado = new Date().toISOString();
  qsSalvar(gravar);
  return limpo || null;
}

function qsDicaDeQuestao(id) {
  const q = qsBanco.filter((x) => x.id === id)[0];
  return (q && q.dica) || "";
}

function qsApagar(id, gravar) {
  const antes = qsBanco.length;
  qsBanco = qsBanco.filter((q) => q.id !== id);
  qsSalvar(gravar);
  return antes - qsBanco.length;
}

/* ---------------------------------------------------------------------
 * ESCOLHER O QUE RESPONDER
 * ------------------------------------------------------------------- */
function qsFiltrar(f) {
  const o = f || {};
  return qsBanco.filter((q) => {
    if (o.chave && q.chave !== o.chave
        && qsChaveNormal(q.chave) !== qsChaveNormal(o.chave)) return false;
    /* CONJUNTO de chaves — é assim que "só as questões deste edital"
     * funciona sem que o banco de questões precise saber o que é um
     * edital. Quem sabe montar a lista é a tela; aqui só se filtra. */
    if (o.chaves && o.chaves.length) {
      const k = qsChaveNormal(q.chave || "");
      if (!k || o.chaves.indexOf(k) < 0) return false;
    }
    if (o.disciplina && qsNormal(q.disciplina) !== qsNormal(o.disciplina)) return false;
    if (o.concurso && qsNormal(q.concurso) !== qsNormal(o.concurso)) return false;
    if (o.banca && qsNormal(q.banca) !== qsNormal(o.banca)) return false;
    if (o.tipo && q.tipo !== o.tipo) return false;
    if (o.soIneditas && (q.tentativas || []).length) return false;
    if (o.soErradas) {
      const ts = q.tentativas || [];
      if (!ts.length || ts[ts.length - 1].acertou) return false;
    }
    if (o.busca && qsNormal(q.enunciado).indexOf(qsNormal(o.busca)) < 0) return false;
    return true;
  });
}

/* quantas questões cada tópico tem — é o que põe o número no botão dentro
 * do resumo sem varrer o banco a cada desenho */
/* A conta por tópico não pode depender de acento nem de caixa.
 * "direito financeiro›leis orçamentárias" e "…›leis orcamentarias" são o
 * mesmo tópico para quem estuda, e eram dois no contador: metade das
 * questões ficava fora da conta e o atalho da agenda mentia o número.
 * Guarda as duas formas — a exata e a normalizada — para quem pergunta com
 * qualquer uma achar. */
function qsChaveNormal(ch) { return qsNormal(ch); }

function qsContarPorChave() {
  const m = {};
  qsBanco.forEach((q) => {
    if (!q.chave) return;
    m[q.chave] = (m[q.chave] || 0) + 1;
    const n = qsChaveNormal(q.chave);
    if (n !== q.chave) m[n] = (m[n] || 0) + 1;
  });
  /* quem consulta por uma forma tem de achar o total das duas */
  Object.keys(m).forEach((k) => {
    const n = qsChaveNormal(k);
    if (n !== k && m[n] !== undefined) m[k] = m[n];
  });
  return m;
}

/* quantas questões existem para este tópico, com a mesma tolerância */
/* =====================================================================
 * O QUE ESTRAGA UMA QUESTÃO GERADA POR IA
 *
 * O caso que originou isto veio inteiro numa questão só, e vale mais
 * que qualquer regra abstrata:
 *
 *   "* *Contexto*: O Município Alfa aprovou lei majorando o ISS…
 *    * *Resolução*: A vinculação é inconstitucional. Viola o princípio
 *    da não vinculação (Art. 167, IV). --- 🩷 Que tal criarmos um
 *    simulado focado nas pegadinhas que a FGV costuma aplicar?
 *    Excelente! Preparei um Simulado Seletivo de Alto Nível com 5
 *    questões inéditas… Tente responder mentalmente antes de conferir
 *    o gabarito comentado. --- SIMULADO DE FINANÇAS PÚBLICAS: ART. 167"
 *
 * Cinco defeitos diferentes ali dentro:
 *   1. a RESOLUÇÃO dentro do enunciado — a questão se responde sozinha;
 *   2. a CONVERSA da IA copiada junto ("Que tal…", "Excelente!");
 *   3. o CABEÇALHO do simulado virou parte do enunciado;
 *   4. markdown cru ("* *Contexto*:") e separadores "---";
 *   5. emoji.
 *
 * Detectar isso é o que permite dizer À IA o que consertar, em vez de
 * pedir "melhore" e receber outra versão do mesmo problema. */
const QS_DEFEITOS = [
  { id: "resolucao", re: /(^|\n|\s)\**\s*(resolu[çc][ãa]o|resposta|gabarito|solu[çc][ãa]o|coment[áa]rio)\s*\**\s*:/i },
  { id: "conversa", re: /(que tal|excelente!|preparei|vamos l[áa]|espero que|bons estudos|segue abaixo|aqui est[ãa]o|tente responder|antes de conferir|logo abaixo)/i },
  { id: "cabecalho", re: /(simulado|bateria de quest[õo]es|lista de exerc[íi]cios|quest[õo]es in[ée]ditas)\s*(de|sobre|:)/i },
  { id: "markdown", re: /(\*\*|^\s*\*\s|\n\s*\*\s|^#{1,6}\s|\n#{1,6}\s|^\s*---\s*$|\n\s*---\s*\n)/ },
  { id: "emoji", re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
  { id: "longo", re: null },
  { id: "varias", re: /(\n|\s)\d+\s*[).]\s+[A-ZÀ-Ú].{40,}(\n|\s)\d+\s*[).]\s+/ },
];

/* TROCAR O TEXTO DE UMA QUESTÃO, MANTENDO A QUESTÃO.
 * Apagar e recriar seria mais curto e perderia o que mais importa numa
 * questão já respondida: as tentativas (o histórico de acertos e erros)
 * e a dica escrita à mão. O id é a identidade; o resto é conteúdo. */
function qsSubstituir(id, campos, gravar) {
  const q = qsBanco.filter((x) => x.id === id)[0];
  if (!q || !campos) return false;
  const antes = { enunciado: q.enunciado, gabarito: q.gabarito };
  ["enunciado", "opcoes", "gabarito", "comentario", "banca"].forEach((k) => {
    if (campos[k] !== undefined && campos[k] !== null && campos[k] !== "") q[k] = campos[k];
  });
  q.corrigida = { q: new Date().toISOString(), antes };
  qsSalvar(gravar);
  return true;
}

function qsDefeitos(q) {
  if (!q) return [];
  const en = String(q.enunciado || "");
  const achados = [];
  QS_DEFEITOS.forEach((d) => {
    if (d.id === "longo") {
      /* 900 caracteres é o dobro de um enunciado longo de banca. Acima
       * disso quase sempre há mais de uma questão colada, ou texto que
       * não é da questão. */
      if (en.length > 900) achados.push({ id: "longo", n: en.length });
      return;
    }
    if (d.re && d.re.test(en)) achados.push({ id: d.id });
  });
  /* gabarito que não combina com o tipo é defeito de estrutura, não de
   * texto: uma CE com gabarito "B" não tem como ser respondida */
  const gab = String(q.gabarito || "").toUpperCase();
  if (q.tipo === "ce" && gab && gab !== "C" && gab !== "E") {
    achados.push({ id: "gab_ce", g: gab });
  }
  if (q.tipo !== "ce" && gab && !(q.opcoes || []).some((o) => o.letra === gab)) {
    achados.push({ id: "gab_me", g: gab });
  }
  return achados;
}

function qsContarDoTopico(chave) {
  const n = qsChaveNormal(chave);
  return qsBanco.filter((q) => q.chave === chave || qsChaveNormal(q.chave) === n).length;
}

/* questões sem tópico nenhum: existem, mas não aparecem em contador de
 * tópico algum. Sem isto elas somem da vista e a soma nunca fecha. */
function qsSemTopico() { return qsBanco.filter((q) => !q.chave); }

function qsBancas() {
  const s = {};
  qsBanco.forEach((q) => { if (q.banca) s[q.banca] = 1; });
  return Object.keys(s).sort();
}

function qsDisciplinas() {
  const s = {};
  qsBanco.forEach((q) => { if (q.disciplina) s[q.disciplina] = 1; });
  return Object.keys(s).sort();
}

/* ---------------------------------------------------------------------
 * RESPONDER
 *
 * O gabarito só aparece DEPOIS de escolher. Mostrar antes transforma o
 * teste em leitura — que é exatamente o que a pessoa já fez no resumo.
 * ------------------------------------------------------------------- */
let qsSessao = null;
const QS_SESSAO_LOJA = "eac_qs_sessao";

/* =====================================================================
 * A SESSÃO SOBREVIVE A FECHAR A JANELA
 *
 * As TENTATIVAS sempre ficaram guardadas em cada questão — o histórico de
 * acertos nunca se perdeu. O que sumia era a sessão: onde você parou e
 * quais já tinha feito nesta rodada. Fechar e reabrir jogava de volta na
 * primeira, com 31 questões pela frente de novo, e as já respondidas
 * voltavam a aparecer.
 *
 * Guardar só a ORDEM DOS IDS, não as questões: se uma for apagada ou
 * corrigida no meio do caminho, quem manda é o banco, e a fila se refaz
 * com o que existe agora.
 * ===================================================================== */
function qsSessaoGravar(gravar) {
  if (!qsSessao) return;
  const dado = {
    escopo: qsSessao.escopo || "",
    ids: qsSessao.fila.map((x) => x.id),
    i: qsSessao.i,
    respondidas: qsSessao.respondidas,
    comecou: qsSessao.comecou,
    tocado: new Date().toISOString(),
  };
  const txt = JSON.stringify(dado);
  if (gravar) { gravar(QS_SESSAO_LOJA, txt); return; }
  try { localStorage.setItem(QS_SESSAO_LOJA, txt); } catch (e) {}
}

function qsSessaoLer(lerLoja) {
  let cru = null;
  if (lerLoja) cru = lerLoja(QS_SESSAO_LOJA);
  else { try { cru = localStorage.getItem(QS_SESSAO_LOJA); } catch (e) { cru = null; } }
  try {
    const v = JSON.parse(cru || "null");
    return v && Array.isArray(v.ids) ? v : null;
  } catch (e) { return null; }
}

function qsSessaoApagar(gravar) {
  if (gravar) { gravar(QS_SESSAO_LOJA, ""); return; }
  try { localStorage.removeItem(QS_SESSAO_LOJA); } catch (e) {}
}

/* Há sessão inacabada para este escopo? Devolve o resumo dela, ou null. */
function qsSessaoRetomavel(escopo, lerLoja) {
  const s = qsSessaoLer(lerLoja);
  if (!s || (escopo && s.escopo !== escopo)) return null;
  const vivas = s.ids.filter((id) => qsBanco.some((x) => x.id === id));
  if (!vivas.length) return null;
  const feitas = (s.respondidas || []).filter((r) => vivas.indexOf(r.id) >= 0);
  if (feitas.length >= vivas.length) return null;     /* já terminou */
  return { total: vivas.length, feitas: feitas.length,
           certas: feitas.filter((r) => r.acertou).length,
           comecou: s.comecou, escopo: s.escopo };
}

function qsSessaoRetomar(escopo, lerLoja, gravar) {
  const s = qsSessaoLer(lerLoja);
  if (!s || (escopo && s.escopo !== escopo)) return null;
  const fila = s.ids.map((id) => qsBanco.filter((x) => x.id === id)[0])
    .filter(Boolean);
  if (!fila.length) return null;
  const respondidas = (s.respondidas || [])
    .filter((r) => fila.some((x) => x.id === r.id));
  qsSessao = { fila, i: Math.max(0, Math.min(fila.length, s.i || 0)),
               respondidas, comecou: s.comecou || new Date().toISOString(),
               escopo: s.escopo || escopo || "" };
  /* cai na primeira ainda não respondida: retomar é continuar de onde
   * parou, não voltar para uma que já foi feita */
  const feito = {};
  respondidas.forEach((r) => { feito[r.id] = 1; });
  const proxima = fila.findIndex((x) => !feito[x.id]);
  if (proxima >= 0) qsSessao.i = proxima;
  qsSessaoGravar(gravar);
  return qsSessao;
}

/* Acrescenta ao FIM as que ainda não estão na fila. É o que permite criar
 * questões novas no meio do caminho sem recomeçar. */
function qsSessaoAcrescentar(lista, gravar) {
  if (!qsSessao) return 0;
  const tem = {};
  qsSessao.fila.forEach((x) => { tem[x.id] = 1; });
  const novas = (lista || []).filter((x) => x && !tem[x.id]);
  novas.forEach((x) => qsSessao.fila.push(x));
  if (novas.length) qsSessaoGravar(gravar);
  return novas.length;
}

/* Embaralha SÓ o que ainda não foi respondido, e a partir da posição
 * atual: mexer no que já passou mudaria o histórico da rodada. */
function qsEmbaralharRestantes(sorte, gravar) {
  if (!qsSessao) return 0;
  const feito = {};
  qsSessao.respondidas.forEach((r) => { feito[r.id] = 1; });
  const ini = qsSessao.i;
  const cabeca = qsSessao.fila.slice(0, ini);
  const resto = qsSessao.fila.slice(ini);
  const pendentes = resto.filter((x) => !feito[x.id]);
  const jaFeitas = resto.filter((x) => feito[x.id]);
  for (let i = pendentes.length - 1; i > 0; i--) {
    const j = Math.floor((sorte ? sorte() : Math.random()) * (i + 1));
    const tmp = pendentes[i]; pendentes[i] = pendentes[j]; pendentes[j] = tmp;
  }
  qsSessao.fila = cabeca.concat(pendentes, jaFeitas);
  qsSessaoGravar(gravar);
  return pendentes.length;
}

function qsSessaoIniciar(lista, opcoes) {
  const o = opcoes || {};
  const fila = (lista || []).slice();
  if (o.embaralhar) {
    for (let i = fila.length - 1; i > 0; i--) {
      const j = Math.floor((o.sorte ? o.sorte() : Math.random()) * (i + 1));
      const tmp = fila[i]; fila[i] = fila[j]; fila[j] = tmp;
    }
  }
  qsSessao = { fila, i: 0, respondidas: [], comecou: new Date().toISOString(),
               escopo: o.escopo || "" };
  qsSessaoGravar(o.gravar);
  return qsSessao;
}

function qsSessaoAtual() { return qsSessao; }

function qsAtual() {
  if (!qsSessao || qsSessao.i >= qsSessao.fila.length) return null;
  return qsSessao.fila[qsSessao.i];
}

function qsJaRespondida() {
  const q = qsAtual();
  if (!q || !qsSessao) return null;
  return qsSessao.respondidas.filter((x) => x.id === q.id)[0] || null;
}

function qsResponder(escolha, gravar) {
  const q = qsAtual();
  if (!q) return null;
  if (qsJaRespondida()) return null;   /* uma resposta por passagem */
  const resp = String(escolha || "").toUpperCase().slice(0, 1);
  const acertou = resp === String(q.gabarito || "").toUpperCase();
  q.tentativas = q.tentativas || [];
  q.tentativas.push({ q: new Date().toISOString(), resp, acertou });
  qsSessao.respondidas.push({ id: q.id, resp, acertou });
  qsSalvar(gravar);
  qsSessaoGravar(gravar);
  /* o bloco em andamento acompanha a cada resposta: assim uma rodada
   * abandonada guarda o que chegou a ser feito, em vez de ficar zerada */
  try {
    if (typeof qhAtualizar === "function") qhAtualizar(qsPlacar(), { gravar });
  } catch (e) {}
  return { acertou, gabarito: q.gabarito, comentario: q.comentario, resp };
}

/* ============ SÓ AS QUE ERREI (ou ainda não respondi) ============
 *
 * Segunda passagem numa lista de 40 questões: 34 já foram e estão
 * certas, e a pessoa quer voltar nas 6 que ficaram. Sem isto, é
 * apertar "próxima" 34 vezes olhando gabarito que já sabe.
 *
 * O filtro NÃO mexe na fila. Recortar a lista pareceria mais simples,
 * mas jogaria fora a ordem e o histórico da rodada — e desligar o
 * filtro não teria como devolver o que foi cortado. Aqui ele só muda
 * quais questões o "próxima" PULA, e por isso liga e desliga no meio
 * da resolução sem perder nada. */
function qsInteressaNoFiltro(q) {
  if (!qsSessao || !q) return true;
  const r = qsSessao.respondidas.filter((x) => x.id === q.id)[0];
  return !r || !r.acertou;
}

function qsFiltroFalhas(ligado, gravar) {
  if (!qsSessao) return false;
  qsSessao.soFalhas = !!ligado;
  /* LIGAR RECOMEÇA A VARREDURA DO TOPO.
   * Continuar de onde estava parecia menos intrusivo, mas o botão diz
   * "só as que errei (6)" e entregaria só as que estivessem ADIANTE do
   * ponto atual — o número da tela prometendo uma coisa e o "próxima"
   * fazendo outra. Do topo, a passagem cobre as seis. */
  if (qsSessao.soFalhas) {
    let i = 0;
    while (i < qsSessao.fila.length && !qsInteressaNoFiltro(qsSessao.fila[i])) i++;
    qsSessao.i = i;
  }
  qsSessaoGravar(gravar);
  return qsSessao.soFalhas;
}

function qsFiltroFalhasLigado() { return !!(qsSessao && qsSessao.soFalhas); }

/* quantas ainda interessam ao filtro, para o botão poder dizer o número */
function qsQuantasFalhas() {
  if (!qsSessao) return 0;
  return qsSessao.fila.filter((q) => qsInteressaNoFiltro(q)).length;
}

function qsAndar(n, gravar) {
  if (!qsSessao) return null;
  const passo = n || 1;
  let i = Math.max(0, Math.min(qsSessao.fila.length, qsSessao.i + passo));
  if (qsSessao.soFalhas) {
    const dir = passo < 0 ? -1 : 1;
    while (i > 0 && i < qsSessao.fila.length
           && !qsInteressaNoFiltro(qsSessao.fila[i])) i += dir;
    /* andando para trás e não sobrou nada antes: fica onde dá, sem
     * cair no índice 0 de uma questão que o filtro esconde */
    if (i < 0) i = 0;
    if (i > qsSessao.fila.length) i = qsSessao.fila.length;
  }
  qsSessao.i = i;
  qsSessaoGravar(gravar);
  return qsAtual();
}

/* PULAR: anda sem responder. A questão continua pendente e volta a
 * aparecer numa próxima passagem — pular não é errar. */
function qsPular(gravar) {
  if (!qsSessao) return null;
  const q = qsAtual();
  if (q) qsSessao.pulou = (qsSessao.pulou || []).concat([q.id]);
  return qsAndar(1, gravar);
}

/* quantas ainda faltam responder nesta sessão */
function qsPendentes() {
  if (!qsSessao) return [];
  const feito = {};
  qsSessao.respondidas.forEach((r) => { feito[r.id] = 1; });
  return qsSessao.fila.filter((x) => !feito[x.id]);
}

function qsPlacar() {
  if (!qsSessao) return { total: 0, feitas: 0, certas: 0, pct: 0 };
  const feitas = qsSessao.respondidas.length;
  const certas = qsSessao.respondidas.filter((x) => x.acertou).length;
  return { total: qsSessao.fila.length, feitas, certas,
           pct: feitas ? Math.round((certas / feitas) * 100) : 0 };
}

function qsDesempenho(lista) {
  const ls = lista || qsBanco;
  let feitas = 0, certas = 0;
  ls.forEach((q) => {
    (q.tentativas || []).forEach((tt) => { feitas++; if (tt.acertou) certas++; });
  });
  return { questoes: ls.length, feitas, certas,
           pct: feitas ? Math.round((certas / feitas) * 100) : null };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    qsNormal, qsCarregar, qsSalvar, qsTodas, qsPrompt, qsPromptCaderno, qsLerResposta,
    qsAplicar, qsDesfazer, qsApagar, qsFiltrar, qsContarPorChave, qsBancas,
    qsDisciplinas, qsSessaoIniciar, qsAtual, qsResponder, qsAndar, qsPlacar,
    qsDesempenho, qsSessaoAtual, qsJaRespondida, qsNoTexto, qsDeBlocos,
    qsGravarDica, qsDicaDeQuestao, qsContarDoTopico, qsSemTopico, qsChaveNormal,
    qsSemelhante, qsParecenca, qsIgual, qsAbrirCampos,
    qsSessaoGravar, qsSessaoLer, qsSessaoApagar, qsSessaoRetomavel,
    qsSessaoRetomar, qsSessaoAcrescentar, qsEmbaralharRestantes,
    qsPular, qsPendentes,
    qsSemMarcacao,
  };
}
