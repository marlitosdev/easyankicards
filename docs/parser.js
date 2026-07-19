/* EasyAnkiCards PWA — parser (porte fiel do core.py v5.1).
 * Mesmas regras da versão desktop:
 *  - linha sem "::"/cloze continua o cartão anterior (colagem de PDF/IA);
 *  - linha começando com "::" continua; cloze aberto {{c1:: continua;
 *  - linha em branco separa cartões; "#" comenta;
 *  - >3 campos "::": reorganiza (pontuação descartada, último campo
 *    vira tags se parecer tags); heurísticas marcam cartões suspeitos.
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

function looksLikeTags(raw) {
  raw = raw.trim();
  return !!raw && !raw.includes("{{") && !raw.includes(":")
    && raw.length <= 60 && parseTags(raw).length <= 6;
}

function agruparLinhas(rawText) {
  const blocos = [];   // itens: {linha, texto, par?}
  let atual = null;
  const linhas = rawText.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const s = linhas[i].trim();
    if (!s) { atual = null; continue; }
    if (s.startsWith("#")) continue;
    if (atual !== null && clozeAberto(atual.texto)) {
      atual.texto += " " + s;
    } else if (atual !== null && s.startsWith(DELIM)) {
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
      blocos.push(atual);
    } else if (atual !== null) {
      atual.texto += " " + s;
    } else {
      atual = { linha: i + 1, texto: s };
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
  if (rawParts.length === 3) {
    const rt = rawParts[2];
    if (rt.includes("{{") || rt.includes(":") || rt.length > 60 || parseTags(rt).length > 6)
      issues.push(pm("i_tags_text"));
  }
  if (card.kind === "cloze" && clozeAberto(card.front)) issues.push(pm("i_cloze_open"));
  return issues;
}

function parseText(rawText, globalTags) {
  globalTags = globalTags || [];
  const result = { cards: [], warnings: [], warnLines: [] };
  const avisar = (msg, n) => { result.warnings.push(msg); result.warnLines.push(n); };
  for (const { linha, texto, par } of agruparLinhas(rawText)) {
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
                     tags: globalTags.concat(tags), line: linha, issues: [] };
      if (!question) { avisar(pm("w_empty_field", { n: linha }), linha); continue; }
      if (options.length < 2) card.issues.push(pm("i_mc_fewopts"));
      if (correct === -1) card.issues.push(pm("i_mc_nocorrect"));
      card.infos = par ? [pm("i_pair")] : [];
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
    }

    let card;
    if (isCloze) {
      if (!front) { avisar(pm("w_cloze_empty", { n: linha }), linha); continue; }
      card = { kind: "cloze", front, back, tags: globalTags.concat(tags), line: linha, issues: [] };
    } else {
      if (parts.length < 2) {
        avisar(pm("w_no_delim", { n: linha, c: "'" + texto.slice(0, 60) + "'" }), linha);
        continue;
      }
      if (!front || !back) { avisar(pm("w_empty_field", { n: linha }), linha); continue; }
      card = { kind: "basic", front, back, tags: globalTags.concat(tags), line: linha, issues: [] };
    }
    card.issues = checarSuspeitas(card, parts);
    if (extraIssue) card.issues.push(extraIssue);
    card.infos = par ? [pm("i_pair")] : [];
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
                 "#deck column:2", "#deck:" + deckName, "#tags column:5"];
  for (const c of cardsParaExportar(result.cards)) {
    lines.push([c.kind === "cloze" ? "Cloze" : "Basic", deckName,
                campo(c.front), campo(c.back), c.tags.join(" ")].join("\t"));
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

/* Cartão -> linha de texto do editor (fonte única de verdade). */
function cardToLine(c) {
  if (c.kind === "mc") {
    const ops = c.options.map((o, i) => (i === c.correct ? o + " *" : o)).join(" | ");
    const campos = ["[MC] " + c.front, ops];
    if (c.back || c.tags.length) campos.push(c.back);
    if (c.tags.length) campos.push(c.tags.join(", "));
    return campos.join(" :: ");
  }
  const campos = [c.front];
  if (c.back || c.kind === "basic") campos.push(c.back);
  if (c.tags.length) campos.push(c.tags.join(", "));
  return campos.join(" :: ");
}

/* Cartões prontos para exportação (MC vira Básico com HTML). */
function cardsParaExportar(cards) {
  return cards.map((c) => c.kind === "mc"
    ? Object.assign({}, c, { kind: "basic" }, mcFields(c))
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
