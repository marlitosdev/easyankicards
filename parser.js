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
function ehTagSolta(txt) {
  const s = (txt || "").trim();
  if (!s || s.length > 60 || /[.!?;:]/.test(s)) return false;
  return s.split(",").every((p) => p.trim() && !/\s/.test(p.trim()));
}

function looksLikeTags(raw) {
  raw = raw.trim();
  return !!raw && !raw.includes("{{") && !raw.includes(":")
    && raw.length <= 60 && parseTags(raw).length <= 6;
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
      const txt = s.replace(/^@\s*/, "");
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
    if (s.startsWith("+")) {
      const txt = s.replace(/^\+\s*/, "");
      if (atual !== null) atual.more = atual.more ? atual.more + "<br>" + txt : txt;
      else pendenteMore = pendenteMore ? pendenteMore + "<br>" + txt : txt;
      continue;
    }
    if (atual !== null && clozeAberto(atual.texto)) {
      atual.texto += " " + s;
    } else if (atual !== null && s.startsWith(DELIM)) {
      atual.texto += " " + s;
    } else if (atual !== null && /^[.,;:)\]}\u00bb\u2026-]/.test(s)) {
      // Continuacao de frase: a linha comeca com pontuacao (a IA quebrou a
      // resposta em varias linhas). NAO e cartao novo, mesmo contendo "::"
      // da tag no fim. Junta tudo; os campos sao separados depois.
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
    if (rt.includes("{{") || rt.includes(":") || rt.length > 60 || parseTags(rt).length > 6)
      issues.push(pm("i_tags_text"));
  }
  if (card.kind === "cloze" && clozeAberto(card.front)) issues.push(pm("i_cloze_open"));
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
  for (const { linha, texto, par, more, titulo } of agruparLinhas(rawText)) {
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
  if (c.titulo) s += "\n@ " + c.titulo;
  if (c.more) s += "\n+ " + c.more.replace(/<br>/g, "\n+ ");
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

function removerMarcadoresTexto(raw) {
  return raw.split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•▪*]|\d+[.)\]]|[a-eA-E][.)])\s+/, ""))
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
  return /^\s*(?:[-•▪*]|\d+[.)\]])\s+/m.test(raw);
}


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
const RE_TITULO_CARTAO = /^[ \t]*@[ \t]*([^\n]*?)[ \t]+((?:[^:\n]|:(?!:))*::[\s\S]*)$/;

function corrigirTituloGrudado(raw) {
  return raw.split(/\r?\n/).map((linha) => {
    const m = linha.match(RE_TITULO_MC) || linha.match(RE_TITULO_CARTAO);
    if (!m || !m[1].trim()) return linha;
    return "@ " + m[1].trim() + "\n" + m[2].trim();
  }).join("\n");
}

function temTituloGrudado(raw) {
  return raw.split(/\r?\n/).some((l) => RE_TITULO_MC.test(l) || RE_TITULO_CARTAO.test(l));
}

function temTagsQueSaoTexto(raw) {
  return raw.split(/\r?\n/).some((linha) => {
    const s = linha.trim();
    if (!s || s.startsWith("#") || s.startsWith("+") || s.startsWith("@")) return false;
    const parts = splitLine(s);
    return parts.length === 3 && !looksLikeTags(parts[2]);
  });
}


