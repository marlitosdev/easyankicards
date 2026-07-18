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
  const blocos = [];
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
      atual.texto += " " + s;
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
  const result = { cards: [], warnings: [] };
  for (const { linha, texto } of agruparLinhas(rawText)) {
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
      if (!front) { result.warnings.push(pm("w_cloze_empty", { n: linha })); continue; }
      card = { kind: "cloze", front, back, tags: globalTags.concat(tags), line: linha, issues: [] };
    } else {
      if (parts.length < 2) {
        result.warnings.push(pm("w_no_delim", { n: linha, c: "'" + texto.slice(0, 60) + "'" }));
        continue;
      }
      if (!front || !back) { result.warnings.push(pm("w_empty_field", { n: linha })); continue; }
      card = { kind: "basic", front, back, tags: globalTags.concat(tags), line: linha, issues: [] };
    }
    card.issues = checarSuspeitas(card, parts);
    if (extraIssue) card.issues.push(extraIssue);
    result.cards.push(card);
  }
  result.nBasic = result.cards.filter((c) => c.kind === "basic").length;
  result.nCloze = result.cards.filter((c) => c.kind === "cloze").length;
  result.nSuspicious = result.cards.filter((c) => c.issues.length).length;
  result.hasProblems = result.warnings.length > 0 || result.nSuspicious > 0;
  return result;
}

/* Exportação .txt — mesma engenharia da versão desktop:
 * coluna de deck (#deck column) cria a pasta no Anki se não existir. */
function exportTxtString(result, deckName) {
  const campo = (s) => s.replace(/\t/g, " ").replace(/\n/g, "<br>");
  const lines = ["#separator:tab", "#html:true", "#notetype column:1",
                 "#deck column:2", "#deck:" + deckName, "#tags column:5"];
  for (const c of result.cards) {
    lines.push([c.kind === "cloze" ? "Cloze" : "Basic", deckName,
                campo(c.front), campo(c.back), c.tags.join(" ")].join("\t"));
  }
  return lines.join("\n") + "\n";
}
