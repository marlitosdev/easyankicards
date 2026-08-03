/* EasyAnkiCards PWA — parser (núcleo de interpretação do texto).
 *
 * ┌── MAPA DO ARQUIVO ───────────────────────────────────────────────┐
 * │ agruparLinhas()      junta linhas soltas em "cartões lógicos" e  │
 * │                      recolhe metadados "@" (título) e "+"        │
 * │                      (Saiba mais), aceitos ANTES ou DEPOIS       │
 * │                      do cartão                                   │
 * │ splitLine()          divide por "::" protegendo {{c1::...}}      │
 * │ parseText()          monta os Card{} e aplica as tolerâncias     │
 * │ checarSuspeitas()    heurísticas que geram os avisos laranja     │
 * │ cardToLine()         Card{} -> texto (o texto é a fonte única)   │
 * │ exportTxtString()    .txt com coluna de deck                     │
 * │ corrigir*()          correções de um toque oferecidas na tela    │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * REGRAS DE OURO ao mexer aqui:
 *  1. O TEXTO do editor é a única fonte de verdade. Todo recurso novo
 *     precisa de ida e volta: parseText(cardToLine(c)) == c.
 *  2. Tags globais NUNCA entram em cardToLine (usar ownTags), senão
 *     elas se multiplicam a cada reescrita.
 *  3. Lacuna cloze precisa estar no 1º campo, ou o Anki não gera
 *     cartão para a nota.
 *  4. Ao adicionar tolerância, prefira AVISAR (issues/infos) a
 *     transformar em silêncio.
 *
 * TOLERÂNCIAS já implementadas (não remover sem motivo):
 *  - linha sem "::"/cloze continua o cartão anterior (colagem de PDF/IA);
 *  - linha começando com "::" continua; cloze aberto {{c1:: continua;
 *  - "Pergunta?" + "Resposta" em linhas seguidas viram um cartão;
 *  - linha em branco separa cartões; "#" comenta;
 *  - ">3 campos "::"" é reorganizado (pontuação descartada, último campo
 *    vira tags se parecer tags);
 *  - "@" e "+" valem antes ou depois do cartão;
 *  - cloze só no verso é movido para a frente.
 */

const CLOZE_RE = /\{\{c\d+::[\s\S]+?\}\}/;
const CLOZE_RE_G = /\{\{c\d+::[\s\S]+?\}\}/g;
const CLOZE_START_RE = /\{\{c\d+::/;
const DELIM = "::";

function splitLine(line) {
  const placeholders = [];
  const masked = line.replace(CLOZE_RE_G, (m) => {
    placeholders.push(m);
    return "\x00" + (placeholders.length - 1) + "\x00";
  });
  return masked.split(DELIM).map((p) =>
    p.trim().replace(/\x00(\d+)\x00/g, (_, i) => placeholders[+i])
  );
}

function parseTags(raw) {
  return raw.trim().split(/[\s,]+/)
    .map((tg) => tg.replace(/^#+/, "").replace(/ /g, "_"))
    .filter((tg) => tg.length);
}

function clozeAberto(text) {
  return (text.match(/\{\{/g) || []).length > (text.match(/\}\}/g) || []).length;
}

function hasDelim(line) { return splitLine(line).length > 1; }

/* Uma palavra só (ou lista separada por vírgula), sem espaços internos
 * nem pontuação de frase — o formato típico de etiqueta do Anki. */
/* Era uma segunda cópia da regra de "isto são etiquetas?", com um limite de
 * 60 caracteres próprio — foi por ela que as tags do cartão cloze de 61
 * caracteres viravam observação. Agora existe UMA regra só. */
function ehTagSolta(txt) { return looksLikeTags(txt); }

/* REGRA DE OURO: esta função decide se o 3º campo são ETIQUETAS ou TEXTO.
 * Quem responde "texto" manda o conteúdo para uma linha "+", então um erro
 * aqui APAGA as tags do cartão. Não use tamanho como critério: nomes como
 * "NBASP_100, ISSAI, Auditoria_Governamental, Conceitos_Iniciais" passam de
 * 60 caracteres e são etiquetas perfeitamente válidas (bug v8.23).
 * O que distingue etiqueta de frase é a FORMA: partes separadas por vírgula,
 * cada uma sem espaço interno (o Anki separa tags por espaço) e sem
 * pontuação de fim de frase. */
function looksLikeTags(raw) {
  const s = (raw || "").trim();
  if (!s || s.includes("{{") || s.includes(":") || /[.!?;]/.test(s)) return false;
  if (s.length > 200 || parseTags(s).length > 8) return false;
  return s.split(",").every((x) => x.trim() && !/\s/.test(x.trim()));
}

function agruparLinhas(rawText) {
  const blocos = [];   // itens: {linha, texto, par?, titulo?, more?}
  let atual = null;
  let pendenteTitulo = null;   // "@" visto antes do cartão
  let pendenteMore = null;     // "+" visto antes do cartão
  const linhas = rawText.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const s = linhas[i].trim();
    if (!s) { atual = null; continue; }
    if (s.startsWith("#")) continue;
    /* Linha começando com "+" = explicação extra ("Saiba mais") do cartão
       anterior. No Anki vira um link que o aluno clica para expandir. */
    /* Linhas de METADADO: "@" título e "+" explicação.
       Elas podem vir DEPOIS do cartão (forma canônica) ou ANTES dele —
       modelos de IA costumam escrever o título na linha de cima. Quando
       vêm antes, ficam "pendentes" e são aplicadas ao próximo cartão. */
    if (s.startsWith("@")) {
      const semArroba = s.replace(/^@\s*/, "");
      // A linha do título contém também um cartão? (":: " ou lacuna)
      const temCartaoJunto = hasDelim(semArroba) || CLOZE_START_RE.test(semArroba);
      if (temCartaoJunto) {
        const mMC = semArroba.match(/^([^\n]*?)\s+(\[MC\][\s\S]*)$/);
        if (mMC && mMC[1].trim()) {
          // separação exata: título antes do marcador [MC]
          pendenteTitulo = mMC[1].trim();
          atual = { linha: i + 1, texto: mMC[2].trim(), titulo: pendenteTitulo };
          pendenteTitulo = null;
          blocos.push(atual);
          continue;
        }
        // ambíguo: preserva TUDO como cartão (nada se perde) e sinaliza
        atual = { linha: i + 1, texto: semArroba, tituloGrudado: true };
        if (pendenteMore) { atual.more = pendenteMore; pendenteMore = null; }
        blocos.push(atual);
        continue;
      }
      const txt = semArroba;
      // Olha a próxima linha com conteúdo: se for um cartão, o título é
      // DELE (padrão "@ título" acima do cartão); senão, é do atual.
      let prox = "";
      for (let k = i + 1; k < linhas.length; k++) {
        const p = linhas[k].trim();
        if (!p) break;
        if (p.startsWith("#")) continue;
        prox = p;
        break;
      }
      const proxEhCartao = prox && !prox.startsWith("+") && !prox.startsWith("@") &&
                           (hasDelim(prox) || CLOZE_START_RE.test(prox));
      if (proxEhCartao || atual === null) {
        pendenteTitulo = txt;
        atual = null;          // encerra o cartão anterior
      } else {
        atual.titulo = txt;
      }
      continue;
    }
    if (s.startsWith("+") || /^\*\s+\S/.test(s)) {
      const txt = s.replace(/^[+*]\s*/, "");
      const dono = atual !== null ? atual
                 : (blocos.length ? blocos[blocos.length - 1] : null);
      // sem cartão anterior, guarda para o próximo (explicação escrita acima)
      if (dono) dono.more = dono.more ? dono.more + "<br>" + txt : txt;
      else pendenteMore = pendenteMore ? pendenteMore + "<br>" + txt : txt;
      continue;
    }
    if (atual !== null && clozeAberto(atual.texto)) {
      atual.texto += " " + s;
    } else if (atual !== null && s.startsWith(DELIM)) {
      atual.texto += " " + s;
    } else if (atual !== null && /^[.,;:)\]}\u00bb\u2026]/.test(s)
               && /[a-zA-Z\u00c0-\u017f0-9]/.test(s)) {
      // Continuacao de frase: a linha comeca com pontuacao E tem palavras
      // (a IA quebrou a resposta). Junta ao cartao. Linhas so de pontuacao
      // ou separadores ("---") NAO entram aqui -> viram bloco ignorado.
      atual.texto += " " + s;
    } else if (atual !== null && !hasDelim(atual.texto) && !CLOZE_RE.test(atual.texto)) {
      // Cartão anterior incompleto. Se ele termina em "?" e esta linha
      // parece a resposta, infere o par Pergunta :: Resposta sozinho.
      if (atual.texto.trim().endsWith("?") && !hasDelim(s)
          && !CLOZE_START_RE.test(s) && !s.endsWith("?")) {
        atual.texto += " :: " + s;
        atual.par = true;
      } else {
        atual.texto += " " + s;
      }
    } else if (hasDelim(s) || CLOZE_START_RE.test(s)) {
      atual = { linha: i + 1, texto: s };
      if (pendenteTitulo) { atual.titulo = pendenteTitulo; pendenteTitulo = null; }
      if (pendenteMore) { atual.more = pendenteMore; pendenteMore = null; }
      blocos.push(atual);
    } else if (atual !== null) {
      atual.texto += " " + s;
    } else {
      atual = { linha: i + 1, texto: s };
      if (pendenteTitulo) { atual.titulo = pendenteTitulo; pendenteTitulo = null; }
      if (pendenteMore) { atual.more = pendenteMore; pendenteMore = null; }
      blocos.push(atual);
    }
  }
  return blocos;
}

function checarSuspeitas(card, rawParts) {
  const issues = [];
  const limpo = (s) => s.replace(/[.!?,;\- ]+/g, "");
  if (card.kind === "basic") {
    if (limpo(card.front).length < 2) issues.push(pm("i_front_short", { v: card.front }));
    if (limpo(card.back).length < 2) issues.push(pm("i_back_short"));
  }
  if (rawParts.length === 3 && card.kind !== "mc") {
    const rt = rawParts[2];
    // uma única regra para todo o app: looksLikeTags
    if (!looksLikeTags(rt)) {
      issues.push(pm("i_tags_text"));
      // marca para o resumo NÃO contar isto como etiqueta: mover uma frase
      // dessas para uma linha "+" é o comportamento certo, e a rede de
      // segurança não pode confundir isso com perda de tags
      card.tagsSuspeitas = true;
    }
  }
  if (card.kind === "cloze" && clozeAberto(card.front)) issues.push(pm("i_cloze_open"));
  // Mesmo número de lacuna na pergunta E na resposta: o Anki esconde as duas
  // ao mesmo tempo e o cartão fica impossível de responder. Repetir o número
  // dentro do MESMO campo é legítimo (esconde os dois juntos de propósito).
  if (card.kind === "cloze") {
    const nums = (s) => new Set(((s || "").match(/\{\{c(\d+)::/g) || [])
      .map((x) => x.replace(/\D/g, "")));
    const nf = nums(card.front), nb = nums(card.back);
    if ([...nf].some((n) => nb.has(n))) issues.push(pm("i_cloze_repetida"));
  }
  // frente começando por marcador de lista => quase sempre é a resposta do
  // cartão anterior que a IA quebrou em várias linhas
  if (ehLinhaContinuacao(card.front)) issues.push(pm("i_continuacao"));
  // Lacuna com opções: o Anki imprime tudo entre colchetes na mesma frase.
  // Alternativas longas deixam o cartão ilegível — melhor usar [MC] em lista.
  if (card.kind === "cloze") {
    const m = card.front.match(/\{\{c\d+::([\s\S]*?)::([\s\S]*?)\}\}/);
    if (m && m[2].includes("/")) {
      const ops = m[2].split("/").map((s) => s.trim()).filter(Boolean);
      const maior = ops.reduce((a, o) => Math.max(a, o.length), 0);
      if (maior > 40) issues.push(pm("i_mc_inline_long", { n: maior }));
    }
  }
  return issues;
}

function parseText(rawText, globalTags) {
  globalTags = globalTags || [];
  const result = { cards: [], warnings: [], warnLines: [], ignorados: [] };
  const avisar = (msg, n, texto) => {
    result.warnings.push(msg);
    result.warnLines.push(n);
    if (texto !== undefined) result.ignorados.push({ line: n, texto });
  };
  for (const { linha, texto, par, more, titulo, tituloGrudado } of agruparLinhas(rawText)) {
    /* Múltipla escolha: [MC] Pergunta :: op1 | op2 * | op3 :: explicação :: tags
       (o * marca a alternativa correta). Vira cartão Básico na exportação. */
    if (texto.startsWith("[MC]")) {
      const parts = splitLine(texto.slice(4).trim());
      const question = parts[0] || "";
      const rawOps = (parts[1] || "").split("|").map((s) => s.trim()).filter(Boolean);
      let correct = -1;
      const options = rawOps.map((o, i) => {
        if (/\*\s*$/.test(o) || o.startsWith("*")) {
          if (correct === -1) correct = i;
          return o.replace(/^\*\s*/, "").replace(/\s*\*\s*$/, "");
        }
        return o;
      });
      const back = parts[2] || "";
      const tags = parts.length >= 4 ? parseTags(parts[3]) : [];
      const card = { kind: "mc", front: question, back, options,
                     correct: correct === -1 ? 0 : correct,
                     tags: globalTags.concat(tags), ownTags: tags,
                     line: linha, issues: [] };
      if (!question) { avisar(pm("w_empty_field", { n: linha }), linha, texto); continue; }
      if (options.length < 2) card.issues.push(pm("i_mc_fewopts"));
      if (correct === -1) card.issues.push(pm("i_mc_nocorrect"));
      card.infos = par ? [pm("i_pair")] : [];
      card.raw = texto;
      card.more = more || "";
      card.titulo = titulo || "";
      result.cards.push(card);
      continue;
    }
    const isCloze = CLOZE_RE.test(texto);
    const parts = splitLine(texto);
    let front, back, tags, extraIssue = null;

    if (parts.length > 3) {
      let tagsRaw, meio;
      if (looksLikeTags(parts[parts.length - 1])) {
        tagsRaw = parts[parts.length - 1]; meio = parts.slice(1, -1);
      } else { tagsRaw = ""; meio = parts.slice(1); }
      meio = meio.filter((p) => p.replace(/[.!?,;\- ]+/g, "").length);
      front = parts[0];
      back = meio.join("<br>");
      tags = parseTags(tagsRaw);
      extraIssue = pm("i_extra_fields", { n: parts.length });
    } else {
      front = parts[0];
      back = parts.length >= 2 ? parts[1] : "";
      if (isCloze && back && !back.replace(/[.!?,;\- ]+/g, "").length) back = "";
      tags = parts.length >= 3 ? parseTags(parts[2]) : [];
      /* Cloze com apenas 2 campos e o 2º parecendo etiqueta
         (uma só palavra, sem espaços, típico de "Materia_Assunto"):
         o autor queria uma TAG, não uma observação. */
      if (isCloze && parts.length === 2 && back && ehTagSolta(back)) {
        tags = parseTags(back);
        back = "";
      }
    }

    let card;
    if (isCloze) {
      if (!front) { avisar(pm("w_cloze_empty", { n: linha }), linha, texto); continue; }
      /* A lacuna precisa estar na FRENTE (campo "Texto" do Anki). Quando
         ela aparece só no verso — padrão "Pergunta? :: {{c1::Resposta}}" —
         as duas partes viram uma frase só, senão o Anki não gera cartão. */
      let clozeMovido = false;
      if (!CLOZE_RE.test(front) && CLOZE_RE.test(back)) {
        front = front.replace(/\s+$/, "") + " " + back.trim();
        back = "";
        clozeMovido = true;
      }
      card = { kind: "cloze", front, back, tags: globalTags.concat(tags),
               ownTags: tags, line: linha, issues: [] };
      if (clozeMovido) card.avisoCloze = true;
    } else {
      if (parts.length < 2) {
        avisar(pm("w_no_delim", { n: linha, c: "'" + texto.slice(0, 60) + "'" }), linha, texto);
        continue;
      }
      if (!front || !back) { avisar(pm("w_empty_field", { n: linha }), linha, texto); continue; }
      card = { kind: "basic", front, back, tags: globalTags.concat(tags),
               ownTags: tags, line: linha, issues: [] };
    }
    card.issues = checarSuspeitas(card, parts);
    if (extraIssue) card.issues.push(extraIssue);
    card.infos = par ? [pm("i_pair")] : [];
    if (card.avisoCloze) { card.infos.push(pm("i_cloze_moved")); delete card.avisoCloze; }
    if (tituloGrudado) card.issues.push(pm("i_titulo_grudado"));
    card.raw = texto;
    card.more = more || "";
    card.titulo = titulo || "";
    result.cards.push(card);
  }
  result.nBasic = result.cards.filter((c) => c.kind === "basic").length;
  result.nCloze = result.cards.filter((c) => c.kind === "cloze").length;
  result.nSuspicious = result.cards.filter((c) => c.issues.length).length;
  result.nPares = result.cards.filter((c) => c.infos && c.infos.length).length;
  result.hasProblems = result.warnings.length > 0 || result.nSuspicious > 0;
  return result;
}

/* Exportação .txt — mesma engenharia da versão desktop:
 * coluna de deck (#deck column) cria a pasta no Anki se não existir. */
function exportTxtString(result, deckName) {
  const campo = (s) => s.replace(/\t/g, " ").replace(/\n/g, "<br>");
  const lines = ["#separator:tab", "#html:true", "#notetype column:1",
                 "#deck column:2", "#deck:" + deckName, "#tags column:6"];
  for (const c of cardsParaExportar(result.cards)) {
    lines.push([c.kind === "cloze" ? "Cloze" : "Basic", deckName,
                campo(c.front), campo(c.back), campo(c.more || ""),
                c.tags.join(" ")].join("\t"));
  }
  return lines.join("\n") + "\n";
}


/* ----------------- serialização e utilidades (v5.4) ----------------- */

function letra(i) { return String.fromCharCode(65 + i); }

/* Converte um cartão MC nos campos frente/verso do modelo Básico. */
function mcFields(c) {
  const front = c.front + "<br><br>" +
    c.options.map((o, i) => letra(i) + ") " + o).join("<br>");
  let back = "✔ " + letra(c.correct) + ") " + (c.options[c.correct] || "");
  if (c.back) back += "<br>" + c.back;
  return { front, back };
}

/* Cartão -> linha(s) de texto do editor (fonte única de verdade).
   A explicação "Saiba mais" volta como uma linha iniciada por "+". */
function cardToLine(c) {
  let s = cardToLineBase(c);
  if (c.more) s += "\n+ " + c.more.replace(/<br>/g, "\n+ ");
  // Título ACIMA do cartão (mesmo lugar do formato de entrada/prompt),
  // separado dos cartões vizinhos pela linha em branco entre blocos.
  if (c.titulo) s = "@ " + c.titulo + "\n" + s;
  return s;
}

/* Tags que pertencem ao cartão (as globais NÃO são gravadas no texto,
 * senão elas se duplicariam a cada reescrita). */
function tagsProprias(c) {
  return c.ownTags !== undefined ? c.ownTags : c.tags;
}

function cardToLineBase(c) {
  if (c.kind === "mc") {
    const tg = tagsProprias(c);
    const ops = c.options.map((o, i) => (i === c.correct ? o + " *" : o)).join(" | ");
    const campos = ["[MC] " + c.front, ops];
    if (c.back || tg.length) campos.push(c.back);
    if (tg.length) campos.push(tg.join(", "));
    return campos.join(" :: ");
  }
  const tg = tagsProprias(c);
  const campos = [c.front];
  if (c.back || c.kind === "basic") campos.push(c.back);
  if (tg.length) campos.push(tg.join(", "));
  return campos.join(" :: ");
}

/* Cartões prontos para exportação (MC vira Básico com HTML). */
function cardsParaExportar(cards) {
  return cards.map((c) => c.kind === "mc"
    ? Object.assign({}, c, { kind: "basic" }, mcFields(c), { more: c.more || "" })
    : c);
}

/* --------- correções automáticas sugeridas pelo "Analisar" ---------- */

const RE_MARCADOR = /^\s*(?:[-•▪*]|\d+[.)\]]|[a-eA-E][.)])\s+/;

/* REGRA DE OURO: só tiramos o marcador de linhas que REALMENTE são cartão
 * (têm "::" fora da lacuna, ou abrem uma lacuna). Uma linha sem "::" pode ser
 * explicacao ("* texto" / "+ texto") ou continuacao da resposta — apagar o
 * marcador dela transforma o conteudo em linha orfa e o cartao perde o
 * "Saiba mais". Foi o que quebrou o baralho da NBASP 100 (v8.21). */
function marcadorRemovivel(l) {
  if (/^\s*[@+]/.test(l)) return false;
  return hasDelim(l) || CLOZE_START_RE.test(l);
}

function removerMarcadoresTexto(raw) {
  return raw.split(/\r?\n/)
    .map((l) => (marcadorRemovivel(l) ? l.replace(RE_MARCADOR, "") : l))
    .join("\n");
}

/* Junta "Pergunta?\nResposta" (linhas adjacentes sem '::') em pares. */
function emparelharTexto(raw) {
  const linhas = raw.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < linhas.length; i++) {
    const a = linhas[i].trim();
    const b = i + 1 < linhas.length ? linhas[i + 1].trim() : "";
    if (a.endsWith("?") && !hasDelim(a) && !a.startsWith("#")
        && b && !hasDelim(b) && !b.endsWith("?") && !b.startsWith("#")) {
      out.push(a + " :: " + b);
      out.push("");
      i++;
    } else out.push(linhas[i]);
  }
  return out.join("\n");
}

function temParesSoltos(raw) {
  const linhas = raw.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i + 1 < linhas.length; i++) {
    if (linhas[i].endsWith("?") && !hasDelim(linhas[i]) && !linhas[i].startsWith("#")
        && linhas[i + 1] && !hasDelim(linhas[i + 1]) && !linhas[i + 1].endsWith("?")
        && !linhas[i + 1].startsWith("#")) return true;
  }
  return false;
}

function temMarcadores(raw) {
  return raw.split(/\r?\n/).some((l) => marcadorRemovivel(l) && RE_MARCADOR.test(l));
}

/* Markdown que a IA insiste em usar: o Anki mostra os asteriscos literais.
 * Converter para <b> preserva o destaque sem sujar o cartao. */
const RE_NEGRITO_MD = /\*\*([^*\n]{1,120})\*\*/g;
function temMarkdown(raw) { RE_NEGRITO_MD.lastIndex = 0; return RE_NEGRITO_MD.test(raw); }
function corrigirMarkdown(raw) { return raw.replace(RE_NEGRITO_MD, "<b>$1</b>"); }

/* Resposta quebrada em varias linhas: a IA escreveu "• item" / "1. item" em
 * linhas soltas e cada uma virou um cartao torto. Nao ha conserto automatico
 * seguro (nao da para adivinhar onde a resposta terminava) — por isso o
 * aplicativo APONTA e oferece o prompt de correcao para a IA. */
const RE_CONTINUACAO = /^\s*(?:[•▪·]|[-–—]\s|\d+[.)]\s|\*\*)/;
function ehLinhaContinuacao(front) { return RE_CONTINUACAO.test(front || ""); }


/* ------------------------------------------------------------------
 * CORREÇÕES AUTOMÁTICAS sugeridas ao usuário (aplicadas com um toque).
 * Cada função recebe o texto inteiro do editor e devolve o texto já
 * corrigido — nunca altera nada sozinha: quem decide é a interface.
 * ------------------------------------------------------------------ */

/* Move para uma linha "+" o 3º campo que é claramente uma explicação
 * (frase longa/com pontuação) e não uma lista de tags. */
function corrigirTagsQueSaoTexto(raw) {
  return raw.split(/\r?\n/).map((linha) => {
    const s = linha.trim();
    if (!s || s.startsWith("#") || s.startsWith("+") || s.startsWith("@")) return linha;
    const parts = splitLine(s);
    if (parts.length !== 3) return linha;
    if (looksLikeTags(parts[2])) return linha;
    // 3º campo é texto: vira explicação na linha de baixo
    return parts[0] + " :: " + parts[1] + "\n+ " + parts[2];
  }).join("\n");
}

/* Separa um título "@..." que ficou grudado no início do cartão. */
/* Título "@" grudado no cartão. Só corrigimos automaticamente o caso
 * INEQUÍVOCO — quando existe o marcador "[MC]" ou "::" e dá para saber
 * exatamente onde o título termina. Em casos ambíguos preferimos avisar
 * e deixar o usuário separar, em vez de cortar a frase no lugar errado. */
const RE_TITULO_MC = /^[ \t]*@[ \t]*([^\n]*?)[ \t]+(\[MC\][\s\S]*)$/;

function corrigirTituloGrudado(raw) {
  return raw.split(/\r?\n/).map((linha) => {
    const m = linha.match(RE_TITULO_MC);
    if (!m || !m[1].trim()) return linha;
    return "@ " + m[1].trim() + "\n" + m[2].trim();
  }).join("\n");
}

function temTituloGrudado(raw) {
  return raw.split(/\r?\n/).some((l) => RE_TITULO_MC.test(l));
}

function temTagsQueSaoTexto(raw) {
  return raw.split(/\r?\n/).some((linha) => {
    const s = linha.trim();
    if (!s || s.startsWith("#") || s.startsWith("+") || s.startsWith("@")) return false;
    const parts = splitLine(s);
    return parts.length === 3 && !looksLikeTags(parts[2]);
  });
}




/* Detecta linhas soltas (não são cartão, título, comentário nem já são
 * explicação) que aparecem DEPOIS de um cartão — provável explicação que
 * perdeu o "+"/"*". */
function _ehLinhaCartao(s) {
  return s.length > 0 && !s.startsWith("#") && !s.startsWith("+")
    && !s.startsWith("*") && !s.startsWith("@")
    && (splitLine(s).length > 1 || CLOZE_START_RE.test(s) || s.startsWith("[MC]"));
}

function temOrfaosExplicacao(raw) {
  let cartaoAntes = false;
  for (const linha of raw.split(/\r?\n/)) {
    const s = linha.trim();
    if (!s) continue;
    if (s.startsWith("@") || _ehLinhaCartao(s)) { cartaoAntes = true; continue; }
    if (s.startsWith("#") || s.startsWith("+") || (/^\*\s+\S/).test(s)) continue;
    // linha sem "::"/cloze, não é metadado: se veio depois de um cartão, é órfã
    if (cartaoAntes && splitLine(s).length === 1 && !CLOZE_START_RE.test(s)) return true;
  }
  return false;
}

/* Transforma cada linha órfã (após um cartão) em explicação "+" dele. */
function corrigirOrfaosExplicacao(raw) {
  let cartaoAntes = false;
  return raw.split(/\r?\n/).map((linha) => {
    const s = linha.trim();
    if (!s) return linha;
    if (s.startsWith("@") || _ehLinhaCartao(s)) { cartaoAntes = true; return linha; }
    if (s.startsWith("#") || s.startsWith("+") || (/^\*\s+\S/).test(s)) return linha;
    if (cartaoAntes && splitLine(s).length === 1 && !CLOZE_START_RE.test(s))
      return "+ " + s;                 // órfã vira explicação do cartão anterior
    return linha;
  }).join("\n");
}


/* Detecta lacunas com ALTERNATIVAS longas (>40 caracteres), que no Anki
 * aparecem todas entre colchetes na mesma linha e ficam ilegíveis. */
/* Lacuna com dica: casa APENAS dentro de uma mesma lacuna (sem cruzar
 * "}}" nem quebra de linha) — evitar isto era a causa de cartões
 * fundidos/apagados na correção automática. */
const RE_LACUNA_DICA = /\{\{c(\d+)::((?:(?!\}\})[^\n])*?)::((?:(?!\}\})[^\n])*?)\}\}/g;

function temLacunaOpcoesLongas(raw) {
  const re = new RegExp(RE_LACUNA_DICA.source, "g");
  let m;
  while ((m = re.exec(raw)) !== null) {
    // m[1]=numero, m[2]=resposta, m[3]=dica/alternativas
    const maior = m[3].split("/").reduce((a, o) => Math.max(a, o.trim().length), 0);
    if (maior > 40) return true;
  }
  return false;
}

/* Remove as alternativas dessas lacunas, mantendo a resposta correta.
 * O cartão vira ocultação simples — legível e válido no Anki. */
function corrigirLacunaOpcoesLongas(raw) {
  return raw.replace(new RegExp(RE_LACUNA_DICA.source, "g"), (todo, n, resp, ops) => {
    const maior = ops.split("/").reduce((a, o) => Math.max(a, o.trim().length), 0);
    if (maior <= 40) return todo;                    // dica curta: preserva
    return "{{c" + n + "::" + resp.trim() + "}}";    // remove só a dica longa
  });
}

/* ===================================================================
 * PROMPT DE CORREÇÃO  (v8.22)
 * Quando o texto da IA vem torto de um jeito que o app NÃO consegue
 * consertar sozinho (resposta quebrada em várias linhas, cartão sem "::",
 * markdown), montamos um prompt objetivo: lista dos problemas COM o número
 * da linha e o trecho literal + as regras do formato + o texto numerado.
 * A IA devolve o texto inteiro corrigido, que o usuário cola de volta.
 * =================================================================== */

/* Reúne, sem repetir linha, tudo que o app critica no texto. */
function problemasDoTexto(raw, r) {
  const linhas = raw.split(/\r?\n/);
  const achados = [];
  const add = (n, msg) => {
    if (!n) return;
    const ja = achados.find((p) => p.n === n);
    // mesma linha com mais de um problema: junta as mensagens em vez de
    // descartar — o prompt precisa contar tudo que há de errado ali
    if (ja) { if (!ja.msg.includes(msg)) ja.msg += " " + msg; return; }
    achados.push({ n, msg: String(msg), txt: (linhas[n - 1] || "").trim() });
  };
  (r.warnLines || []).forEach((n, i) => add(n, r.warnings[i]));
  r.cards.forEach((c) => { if (c.issues && c.issues.length) add(c.line, c.issues[0]); });
  // críticas que aparecem no painel de sugestões e também são acionáveis
  // pela IA (cartão longo demais, frente repetida)
  const vistos = {};
  r.cards.forEach((c) => {
    if ((c.front + c.back).length > 220) add(c.line, t("crit_long_msg"));
    const k = c.front.toLowerCase().trim();
    if (vistos[k]) add(c.line, t("crit_dup_msg", { a: vistos[k] }));
    else vistos[k] = c.line;
  });
  // Os detectores estruturais valem para o texto inteiro, mas dá para achar
  // a LINHA culpada aplicando cada um a uma linha de cada vez. Sem isso, o
  // modo parcial não conseguiria isolar o bloco (bug encontrado no teste
  // P11: o cartão com markdown ficava de fora do prompt).
  const porLinha = [
    [temMarkdown, "fixg_markdown"],
    [temTituloGrudado, "fixg_title_glued"],
    [temMarcadores, "fixg_bullets"],
    [temTagsQueSaoTexto, "fixg_tags_text"],
  ];
  linhas.forEach((l, i) => {
    if (!l.trim()) return;
    porLinha.forEach(([detector, chave]) => {
      try { if (detector(l)) add(i + 1, t(chave)); } catch (e) {}
    });
    // este precisa da linha seguinte para decidir
    try {
      if (temTagsNaExplicacao(l + "\n" + (linhas[i + 1] || "")))
        add(i + 1, t("crit_tags_in_more"));
    } catch (e) {}
  });
  achados.sort((a, b) => a.n - b.n);
  // sobra para o prompt do texto inteiro: o que não coube em nenhuma linha
  const gerais = [];
  if (temLacunaOpcoesLongas(raw) && !achados.length) gerais.push(t("crit_lacuna_ops"));
  return { achados, gerais };
}

/* Monta o texto do prompt pronto para colar na IA. */
function montarPromptCorrecao(raw, r) {
  const { achados, gerais } = problemasDoTexto(raw, r);
  const corta = (s) => (s.length > 150 ? s.slice(0, 150) + "…" : s);
  let lista = achados.map((p, i) =>
    (i + 1) + ". " + t("fixp_line") + " " + p.n + " — " + p.msg
    + "\n   " + t("fixp_content") + ' "' + corta(p.txt) + '"').join("\n");
  gerais.forEach((g, i) => {
    lista += (lista ? "\n" : "") + (achados.length + i + 1) + ". " + g;
  });
  if (!lista) lista = "— " + t("fixp_generic");
  const numerado = raw.split(/\r?\n/).map((l, i) => (i + 1) + "| " + l).join("\n");
  return t("fix_prompt").replace("{problemas}", lista).replace("{texto}", numerado);
}

/* ===================================================================
 * RESUMO DO TEXTO  (v8.23)
 * Números que descrevem um texto em uma linha. Servem para três coisas:
 * o relatório de diagnóstico, a rede de segurança das correções e os
 * testes automáticos (tests/rodar.js). Um mesmo resumo em toda parte
 * evita que "antes/depois" signifique coisas diferentes em cada tela.
 * =================================================================== */
function resumoTexto(raw) {
  const r = parseText(raw || "", []);
  return {
    cartoes: r.cards.length,
    // sem as linhas de continuação, que são cartões só na aparência.
    // É esta a contagem que vale como "conteúdo": juntar linhas tortas
    // reduz `cartoes` sem perder nada, e não pode disparar alarme falso.
    cartoesReais: r.cards.filter((c) => !ehLinhaContinuacao(c.front)).length,
    avisos: r.warnings.length,
    suspeitos: r.nSuspicious,
    // linhas de "Saiba mais" somadas: é o conteúdo que some sem ninguém
    // perceber quando uma correção mexe demais no texto
    // linha "+" que contém só etiquetas não é explicação: contá-la faria a
    // rede de segurança acusar perda de conteúdo ao devolvê-las ao cartão
    saibaMais: r.cards.reduce((s, c) => s + (c.more
      ? c.more.split("<br>").filter((x) => x.trim() && !looksLikeTags(x)).length
      : 0), 0),
    titulos: r.cards.filter((c) => c.titulo).length,
    // só etiquetas de verdade: um 3º campo que na verdade é frase não conta
    tags: r.cards.reduce(
      (s, c) => s + (c.tagsSuspeitas ? 0 : (c.ownTags || []).length), 0),
    linhas: (raw || "").split(/\r?\n/).length,
    chars: (raw || "").length,
  };
}

/* Marca quais detectores acendem — o "painel de instrumentos" do texto. */
function detectoresAtivos(raw) {
  const d = {
    marcadores: temMarcadores(raw),
    titulo_grudado: temTituloGrudado(raw),
    orfaos_explicacao: temOrfaosExplicacao(raw),
    tags_que_sao_texto: temTagsQueSaoTexto(raw),
    lacuna_opcoes_longas: temLacunaOpcoesLongas(raw),
    markdown: temMarkdown(raw),
    tags_na_explicacao: temTagsNaExplicacao(raw),
    cloze_repetida: temClozeRepetida(raw),
    espacos: temEspacosRuins(raw),
    pares_soltos: temParesSoltos(raw),
  };
  return Object.keys(d).filter((k) => d[k]);
}

/* ===================================================================
 * TAGS QUE VIRARAM EXPLICAÇÃO  (v8.23.2)
 * Conserto do estrago que a v8.23 fazia: uma linha "+" logo abaixo do
 * cartão contendo APENAS etiquetas (palavras separadas por vírgula, sem
 * espaço interno e sem pontuação) era, na verdade, o campo de tags. Aqui
 * ela volta para o fim da linha do cartão. Só age quando o cartão ainda
 * NÃO tem etiquetas — por isso é idempotente.
 * =================================================================== */
function _varrerTagsNaExplicacao(raw, aplicar) {
  const L = raw.split(/\r?\n/);
  let achou = false;
  for (let i = 0; i < L.length; i++) {
    const s = L[i].trim();
    if (!s || s.startsWith("@") || s.startsWith("+") || s.startsWith("#")) continue;
    if (!(hasDelim(s) || CLOZE_START_RE.test(s))) continue;
    const partes = splitLine(s);
    // já tem etiquetas no último campo? então não há o que trazer de volta
    if (partes.length > 1 && looksLikeTags(partes[partes.length - 1])) continue;
    const prox = (L[i + 1] || "").trim();
    if (!prox.startsWith("+")) continue;
    const conteudo = prox.replace(/^\+\s*/, "");
    if (!conteudo || !looksLikeTags(conteudo)) continue;
    achou = true;
    if (!aplicar) return true;
    L[i] = L[i].replace(/\s+$/, "") + " :: " + conteudo;
    L.splice(i + 1, 1);
  }
  return aplicar ? L.join("\n") : achou;
}
function temTagsNaExplicacao(raw) { return _varrerTagsNaExplicacao(raw, false); }
function corrigirTagsNaExplicacao(raw) { return _varrerTagsNaExplicacao(raw, true); }

/* ===================================================================
 * CORREÇÃO PARCIAL  (v8.25)
 * Mandar o texto inteiro para a IA a cada erro é caro e arriscado: ela
 * reescreve o que estava certo. Aqui isolamos SÓ os blocos com problema
 * e marcamos cada um com uma âncora "@@ N" (N = linha em que o bloco
 * começa). A IA devolve os mesmos blocos com as mesmas âncoras, e o app
 * troca cada bloco no lugar certo — o resto do texto não é tocado.
 * A âncora é o que torna a colagem VERIFICÁVEL: dá para conferir se
 * voltou tudo, se voltou coisa que não foi enviada e se algum bloco
 * deixou de gerar cartão.
 * =================================================================== */

/* Faixa de linhas de um cartão: "@" acima, a linha do cartão, "+" abaixo.
 * Índices 0-based, inclusivos nas duas pontas. */
function blocoDoCartao(linhas, linhaCartao) {
  const i = linhaCartao - 1;
  let fim = i;
  while (fim + 1 < linhas.length && linhas[fim + 1].trim().startsWith("+")) fim++;
  let ini = i;
  if (ini - 1 >= 0 && linhas[ini - 1].trim().startsWith("@")) ini--;
  return { ini, fim };
}

/* Junta os problemas por bloco de cartão. Devolve os blocos em ordem. */
function blocosComProblema(raw, r) {
  const linhas = raw.split(/\r?\n/);
  const { achados } = problemasDoTexto(raw, r);
  const mapa = new Map();
  achados.forEach((p) => {
    const dono = r.cards.find((c) => {
      const b = blocoDoCartao(linhas, c.line);
      return p.n - 1 >= b.ini && p.n - 1 <= b.fim;
    });
    const b = dono ? blocoDoCartao(linhas, dono.line) : { ini: p.n - 1, fim: p.n - 1 };
    if (!mapa.has(b.ini)) mapa.set(b.ini, { ini: b.ini, fim: b.fim, probs: [] });
    mapa.get(b.ini).probs.push(p);
  });
  // Uma linha de continuação sozinha não diz nada à IA: ela precisa do
  // cartão dono para saber o que remontar. Puxa o bloco do cartão anterior
  // (com o título "@") para dentro deste.
  mapa.forEach((b) => {
    let guarda = 0;
    while (b.ini > 0 && ehLinhaContinuacao((linhas[b.ini] || "").trim()) && guarda++ < 20) {
      const anteriores = r.cards.filter((c) => c.line - 1 < b.ini);
      if (!anteriores.length) break;
      const ba = blocoDoCartao(linhas, anteriores[anteriores.length - 1].line);
      if (ba.ini >= b.ini) break;
      b.ini = ba.ini;
    }
  });

  // Funde blocos colados. Quando a IA quebra a resposta em várias linhas,
  // cada linha vira um "cartão" torto e ganharia uma âncora só sua — a IA
  // receberia pedaços sem contexto e não teria como remontar o cartão.
  // Blocos vizinhos (sem linha de conteúdo entre eles) viram UMA âncora.
  const ordenados = [...mapa.values()].sort((a, b) => a.ini - b.ini);
  const fundidos = [];
  ordenados.forEach((b) => {
    const ult = fundidos[fundidos.length - 1];
    const soBrancoEntre = ult && linhas.slice(ult.fim + 1, b.ini).every((l) => !l.trim());
    if (ult && b.ini <= ult.fim + 1 && soBrancoEntre !== false) {
      ult.fim = Math.max(ult.fim, b.fim);
      ult.probs.push(...b.probs);
    } else if (ult && b.ini <= ult.fim + 1) {
      ult.fim = Math.max(ult.fim, b.fim);
      ult.probs.push(...b.probs);
    } else fundidos.push({ ...b, probs: [...b.probs] });
  });
  return fundidos.map((b) => {
    const texto = linhas.slice(b.ini, b.fim + 1).join("\n");
    return {
      id: b.ini + 1,                                 // âncora = linha inicial
      ini: b.ini, fim: b.fim, probs: b.probs, texto,
      // Quantos cartões DE VERDADE havia aqui. As linhas de continuação
      // viram "cartões" tortos na leitura, mas juntá-las de volta em um só
      // é justamente o conserto pedido — contá-las faria a conferência
      // recusar a resposta certa. Por isso ficam de fora.
      cartoesOriginais: Math.max(1, parseText(texto, []).cards
        .filter((c) => !ehLinhaContinuacao(c.front)).length),
    };
  });
}

/* Monta o prompt que pede a correção SÓ dos blocos com problema. */
function montarPromptCorrecaoParcial(raw, r) {
  const blocos = blocosComProblema(raw, r);
  if (!blocos.length) return { texto: "", blocos: [] };
  const corta = (s) => (s.length > 150 ? s.slice(0, 150) + "…" : s);
  const lista = blocos.map((b) => {
    const p = b.probs.map((x) => "   - " + t("fixp_line") + " " + x.n + ": " + x.msg
      + "\n     " + t("fixp_content") + ' "' + corta(x.txt) + '"').join("\n");
    return "@@ " + b.id + "\n" + p;
  }).join("\n");
  const trechos = blocos.map((b) => "@@ " + b.id + "\n" + b.texto).join("\n\n");
  return {
    texto: t("fix_prompt_partial")
      .replace("{problemas}", lista).replace("{trechos}", trechos),
    blocos,
  };
}

/* Lê a resposta da IA e separa os blocos pelas âncoras "@@ N". */
function separarBlocosMarcados(resposta) {
  const mapa = new Map();
  let atual = null, buf = [];
  const fechar = () => {
    if (atual !== null) mapa.set(atual, buf.join("\n").replace(/^\s*\n+/, "").replace(/\s+$/, ""));
    buf = [];
  };
  for (const l of (resposta || "").split(/\r?\n/)) {
    const m = l.match(/^\s*@@\s*(\d+)\s*$/);
    if (m) { fechar(); atual = Number(m[1]); continue; }
    if (atual !== null) buf.push(l);
  }
  fechar();
  return mapa;
}

/* Confere a resposta da IA ANTES de mexer no texto do usuário.
 * Devolve o que dá para aplicar e a lista de problemas encontrados. */
function conferirCorrecaoParcial(resposta, blocos) {
  const recebidos = separarBlocosMarcados(resposta);
  const enviados = new Set(blocos.map((b) => b.id));
  const erros = [], avisos = [], aplicar = [];
  if (!recebidos.size) {
    erros.push(t("fixpart_no_anchor"));
    return { erros, avisos, aplicar, recebidos };
  }
  recebidos.forEach((txt, id) => {
    if (!enviados.has(id)) { avisos.push(t("fixpart_unknown", { n: id })); return; }
    if (!txt.trim()) { erros.push(t("fixpart_empty", { n: id })); return; }
    const r = parseText(txt, []);
    if (!r.cards.length) { erros.push(t("fixpart_nocard", { n: id })); return; }
    const b = blocos.find((x) => x.id === id);
    // o bloco pode CRESCER (a IA dividiu um cartão longo — isso é o pedido),
    // mas nunca encolher: menos cartões significa conteúdo perdido
    if (r.cards.length < (b.cartoesOriginais || 1)) {
      erros.push(t("fixpart_lostcard",
        { n: id, a: b.cartoesOriginais, d: r.cards.length }));
      return;
    }
    aplicar.push({ ...b, novo: txt, cartoes: r.cards.length });
  });
  blocos.filter((b) => !recebidos.has(b.id))
    .forEach((b) => avisos.push(t("fixpart_missing", { n: b.id })));
  return { erros, avisos, aplicar, recebidos };
}

/* Troca os blocos no texto. De baixo para cima, para os índices das linhas
 * de cima não mudarem no meio do caminho. */
function aplicarCorrecaoParcial(raw, aplicar) {
  const linhas = raw.split(/\r?\n/);
  [...aplicar].sort((a, b) => b.ini - a.ini).forEach((b) => {
    linhas.splice(b.ini, b.fim - b.ini + 1, ...b.novo.split(/\r?\n/));
  });
  return linhas.join("\n");
}

/* ===================================================================
 * LACUNA REPETIDA ENTRE PERGUNTA E RESPOSTA  (v8.26)
 * "P {{c1::x}}? :: R {{c1::y}}" — o Anki esconde as duas ao mesmo tempo,
 * e o cartão fica sem como ser respondido. O conserto é renumerar só as
 * lacunas do lado da RESPOSTA, aproveitando o primeiro número livre.
 * A troca é posicional (por índice no texto), não por remontagem da
 * linha: assim nada mais na linha muda, nem um espaço.
 * =================================================================== */

/* Índice do primeiro "::" que está FORA de uma lacuna. -1 se não houver. */
function posSeparadorTopo(l) {
  let dentro = 0;
  for (let i = 0; i < l.length - 1; i++) {
    if (l[i] === "{" && l[i + 1] === "{") { dentro++; i++; continue; }
    if (l[i] === "}" && l[i + 1] === "}") { dentro = Math.max(0, dentro - 1); i++; continue; }
    if (dentro === 0 && l[i] === ":" && l[i + 1] === ":") return i;
  }
  return -1;
}

function _varrerClozeRepetida(raw, aplicar) {
  const L = raw.split(/\r?\n/);
  let achou = false;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (!CLOZE_START_RE.test(l)) continue;
    const pos = posSeparadorTopo(l);
    if (pos < 0) continue;                       // sem resposta: nada a fazer
    const frente = l.slice(0, pos), resto = l.slice(pos);
    const numsDe = (s) => ((s.match(/\{\{c(\d+)::/g) || []).map((x) => x.replace(/\D/g, "")));
    const naFrente = new Set(numsDe(frente));
    const repetidos = [...new Set(numsDe(resto))].filter((n) => naFrente.has(n));
    if (!repetidos.length) continue;
    achou = true;
    if (!aplicar) return true;
    let livre = Math.max(0, ...numsDe(l).map(Number)) + 1;
    const troca = {};
    repetidos.forEach((n) => { troca[n] = String(livre++); });
    L[i] = frente + resto.replace(/\{\{c(\d+)::/g,
      (m, n) => (troca[n] ? "{{c" + troca[n] + "::" : m));
  }
  return aplicar ? L.join("\n") : achou;
}
function temClozeRepetida(raw) { return _varrerClozeRepetida(raw, false); }
function corrigirClozeRepetida(raw) { return _varrerClozeRepetida(raw, true); }

/* ===================================================================
 * HIGIENE DE ESPAÇAMENTO  (v8.28)
 * Miudezas que a IA e o PDF deixam para trás e que só aparecem depois,
 * no cartão: dois espaços seguidos, espaço antes da vírgula, travessão
 * grudado nas palavras. Nada aqui muda o SENTIDO do texto — só o
 * espaçamento — por isso é seguro aplicar em bloco.
 * =================================================================== */
function _higienizarLinha(l) {
  if (/^\s*#/.test(l)) return l;                    // comentário fica como está
  return l
    .replace(/[ \t]{2,}/g, " ")                     // espaços repetidos
    .replace(/\s+([,;.!?])/g, "$1")                 // espaço antes de pontuação
    .replace(/([^\s—])—([^\s—])/g, "$1 — $2")       // travessão grudado
    .replace(/\s*\.\.\.\s*/g, "… ")                 // reticências
    .replace(/\s+$/, "");                           // espaço no fim da linha
}
function _varrerEspacos(raw, aplicar) {
  const L = raw.split(/\r?\n/);
  const novo = L.map(_higienizarLinha);
  if (!aplicar) return novo.some((l, i) => l !== L[i]);
  return novo.join("\n");
}
function temEspacosRuins(raw) { return _varrerEspacos(raw, false); }
function corrigirEspacos(raw) { return _varrerEspacos(raw, true); }
