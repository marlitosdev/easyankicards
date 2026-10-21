/* =====================================================================
 * GERA docs/dados/juris-catalogo.json A PARTIR DAS FONTES OFICIAIS
 *
 *   node scripts/catalogo-juris.js            (tudo; ~1.600 consultas, alguns minutos)
 *   node scripts/catalogo-juris.js --so stj-sum,stf-rg   (só algumas partes, juntando ao catálogo existente)
 *
 * POR QUE UM SCRIPT, E NÃO A IA: o catálogo existe para CONFERIR a tese guardada. Um catálogo escrito de memória
 * (o de 20/10 trazia Temas com o assunto de outro número e teses inventadas) troca o erro da pessoa pelo erro dele,
 * com selo de "oficial". Aqui cada entrada é lida da página do tribunal e leva a data da leitura; o que a página não
 * mostra (data de aprovação das súmulas do STF, por exemplo) fica vazio — nunca inventado.
 *
 * Fontes (todas públicas, só leitura, uma consulta por vez com pausa):
 *  · STJ súmulas ........ scon.stj.jus.br/SCON/sumstj/toc.jsp?livre=@num='N'
 *  · STJ repetitivos .... processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp (faixas de 10 temas)
 *  · STF súmulas e SVs .. portal.stf.jus.br/jurisprudencia/sumariosumulas.asp (lista → página de cada uma)
 *  · STF repercussão .... portal.stf.jus.br/repercussaogeral/retornartesesrepercussaogeral.asp (teses, com e sem RG)
 * ===================================================================== */
const fs = require("fs");
const path = require("path");

const SAIDA = path.join(__dirname, "..", "docs", "dados", "juris-catalogo.json");
const HOJE = new Date().toISOString().slice(0, 10);
const PAUSA = 120;
/* LIMITE=N: só os N primeiros de cada parte (para testar o leitor sem baixar tudo) */
const LIMITE = +process.env.LIMITE || Infinity;
/* o ramo do direito como a fonte escreve ("DIREITO TRIBUTÁRIO - IPTU") → "Direito Tributário · IPTU": é o filtro por assunto */
const ramoBonito = (s) => String(s || "").split(/\s+-\s+|;/).map((p) => p.trim().toLowerCase()
  .replace(/(^|\s|\()(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E|Em|Na|No|Por|Para|A|O|Ao)\b/g, (m) => m.toLowerCase())
  .replace(/\b(Iptu|Icms|Iss|Ipi|Ir|Itcmd|Itbi|Ipva|Pis|Cofins|Cpmf|Csll|Inss|Fgts|Sus|Cdc|Cpc|Ctn|Clt|Stf|Stj)\b/g, (m) => m.toUpperCase())
  .replace(/^./, (c) => c.toUpperCase())).filter(Boolean).join(" · ");
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const ENT = { nbsp: " ", quot: '"', amp: "&", lt: "<", gt: ">", ordm: "º", ordf: "ª", sect: "§", deg: "°", ndash: "–", mdash: "—", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", middot: "·" };
function entidades(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&([a-z]+);/gi, (m, n) => {
      if (ENT[n] != null) return ENT[n];
      const acento = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧" };
      const mm = n.match(/^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil)$/);
      return mm ? (mm[1] + acento[mm[2]]).normalize("NFC") : m;
    });
}
/* texto da página: as tags viram " | " (separador de campo) e os espaços se juntam */
function texto(h) {
  return entidades(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " | "))
    .replace(/[\u0000-\u001f ]/g, " ").replace(/(\s*\|\s*)+/g, " | ").replace(/\s+/g, " ").trim();
}
const corrido = (s) => String(s || "").replace(/\s*\|\s*/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "(").replace(/\s+/g, " ").trim();
const dataIso = (d) => { const m = String(d || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };

async function pega(url, opc) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, opc);
      if (r.status === 200) {
        const b = Buffer.from(await r.arrayBuffer());
        const cab = String(r.headers.get("content-type") || "");
        const latin = /8859-1|latin1|windows-1252/i.test(cab) || (!/utf-8/i.test(cab) && /scon\.stj|processo\.stj/.test(url));
        return new TextDecoder(latin ? "iso-8859-1" : "utf-8").decode(b);
      }
      if (r.status === 404) return "";
    } catch (e) { /* tenta de novo */ }
    await dorme(1500 * (t + 1));
  }
  throw new Error("sem resposta: " + url);
}

const itens = {};
const poe = (chave, o) => {
  const limpo = {};
  Object.keys(o).forEach((k) => { const v = o[k]; if (v !== "" && v != null && !(Array.isArray(v) && !v.length)) limpo[k] = v; });
  itens[chave] = limpo;
};
const conta = {};
function progresso(rot, i, n) { if (i % 25 === 0 || i === n) process.stdout.write("  " + rot + ": " + i + "/" + n + "\r"); }

/* ---------- STJ súmulas ---------- */
async function stjSumulas() {
  let n = 1, vazias = 0, achadas = 0;
  while (vazias < 25) {
    const t = texto(await pega("https://scon.stj.jus.br/SCON/sumstj/toc.jsp?livre=" + encodeURIComponent("@num='" + n + "'")));
    /* "Súmula | 212 | CANCELADA | DIREITO … | enunciado. (SÚMULA 212 , PRIMEIRA SEÇÃO, julgado em …, DJ …) | SÚMULA ALTERADA …" */
    const re = new RegExp("Súmula \\| " + n + " \\| (.{0,3000}?)\\(\\s*SÚMULA[\\s|]*" + n + "[\\s|]*,([^)]*)\\)(.{0,400})");
    const m = t.match(re);
    if (!m) { vazias++; n++; continue; }
    vazias = 0; achadas++;
    const partes = m[1].split(" | ").map((x) => x.trim()).filter(Boolean);
    const marca = partes.filter((x) => /^(CANCELADA|REVOGADA|ALTERADA|SUPERADA)$/.test(x)).map((x) => x.toLowerCase());
    const corpo = partes.filter((x) => !/^(CANCELADA|REVOGADA|ALTERADA|SUPERADA)$/.test(x));
    /* a 1ª parte é o ramo ("DIREITO TRIBUTÁRIO - IPTU"): todo em maiúsculas */
    const ramo = corpo.length > 1 && corpo[0] === corpo[0].toUpperCase() ? corpo.shift() : "";
    const meta = m[2].split(",").map((x) => x.trim());
    const julg = meta.find((x) => /julgado em/i.test(x)) || "";
    const pub = meta.filter((x) => /^(DJe?|REPDJe?)\b/.test(x) || /^p\.\s*\d/.test(x)).join(", ");
    poe("STJ|sumula|" + n, {
      tribunal: "STJ", classe: "Súmula", numero: String(n),
      tese: corrido(corpo.join(" ")), ramo: ramoBonito(ramo),
      situacao: marca.includes("cancelada") || marca.includes("revogada") ? "cancelada" : "vigente",
      nota: marca.includes("alterada") || /SÚMULA ALTERADA/.test(m[3]) ? "redação alterada pelo STJ" : "",
      orgao: (meta[0] || "").replace(/\b(\p{L})(\p{L}*)/gu, (x, a, b) => a + b.toLowerCase()),
      data: dataIso(julg), fonte: pub,
    });
    progresso("STJ súmulas", n, n);
    n++;
    if (achadas >= LIMITE) break;
    await dorme(PAUSA);
  }
  conta["STJ súmulas"] = achadas;
}

/* ---------- STJ repetitivos ---------- */
async function stjRepetitivos() {
  let ini = 1, vaziasSeguidas = 0, achados = 0;
  while (vaziasSeguidas < 4) {
    const fim = ini + 9;
    const t = texto(await pega("https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=" + ini + "&cod_tema_final=" + fim));
    const docs = t.split(/ \| Documento \d+ \| /).slice(1);
    if (!docs.length) vaziasSeguidas++; else vaziasSeguidas = 0;
    docs.forEach((d) => {
      const num = (d.match(/Tema Repetitivo \| (\d+) \|/) || [])[1];
      if (!num) return;
      const campo = (rot, prox) => { const m = d.match(new RegExp("\\| " + rot + " \\| (.*?) \\| (?:" + prox + ") \\|")); return m ? corrido(m[1]) : ""; };
      const situacao = campo("Situação", "Órgão julgador|Ramo do direito");
      const tese = campo("Tese Firmada", "Anotações NUGEPNAC|Informações Complementares|Modulação|Repercussão Geral|REsp|AREsp|EREsp|RMS|Pet|CC|Última atualização");
      const proc = [...d.matchAll(/\| ((?:REsp|AREsp|EREsp|RMS|Pet|CC|ProAfR no REsp) \d+\/[A-Z]{2}) \|/g)].map((x) => x[1]);
      const julgado = (d.match(/Julgado em \| (\d{2}\/\d{2}\/\d{4})/) || [])[1] || "";
      const publicado = (d.match(/Acórdão publicado em \| (\d{2}\/\d{2}\/\d{4})/) || [])[1] || "";
      const relator = (d.match(/Relator \| ([^|]+) \|/) || [])[1] || "";
      const sit = /cancel/i.test(situacao) ? "cancelada" : /revis|superad/i.test(situacao) ? "superada" : tese ? "vigente" : "pendente";
      poe("STJ|tema|" + num, {
        tribunal: "STJ", classe: "Tema", numero: num, tese, situacao: sit,
        ramo: ramoBonito(campo("Ramo do direito", "Questão submetida a julgamento|Tese Firmada")),
        orgao: campo("Órgão julgador", "Ramo do direito").replace(/\b(\p{L})(\p{L}*)/gu, (x, a, b) => a + b.toLowerCase()),
        data: dataIso(julgado), fonte: publicado ? "acórdão publicado em " + publicado : "",
        relator: relator.trim().replace(/\b(\p{L})(\p{L}*)/gu, (x, a, b) => a + b.toLowerCase()),
        paradigmas: proc,
      });
      achados++;
    });
    progresso("STJ repetitivos", fim, fim);
    ini += 10;
    if (achados >= LIMITE) break;
    await dorme(PAUSA);
  }
  conta["STJ repetitivos"] = achados;
}

/* ---------- STF súmulas e súmulas vinculantes ---------- */
async function stfSumulas(base) {
  const vinc = base === 26;
  const lista = (await pega("https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=" + base)).replace(/&nbsp;/g, " ");
  const ids = [...lista.matchAll(/sumula=(\d+)[^>]*>\s*S[úu]mula(?: Vinculante)?\s+(\d+)([^<]*)/g)].map((x) => ({ id: x[1], n: x[2], extra: entidades(x[3]).trim() }));
  let i = 0;
  for (const e of ids.slice(0, LIMITE)) {
    i++;
    const url = "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=" + base + "&sumula=" + e.id;
    const html = await pega(url);
    /* o enunciado é o 1º bloco "parCOM" depois do título "Súmula N" — o resto da página (precedentes, jurisprudência
     * selecionada, teses) vem em outros blocos, com títulos que variam: cortar por título deixava passar */
    /* o título pode vir "Súmula Vinculante&nbsp;3" ou "Súmula 584 <em>(cancelada)</em>": lê o bloco inteiro do título,
     * decodificado, e confere o número; o enunciado é o parCOM logo depois */
    let tese = "", tituloTxt = "";
    for (const m of html.matchAll(/<div class="titulo">((?:(?!<\/div>)[\s\S])*?)<\/div>\s*<div class="parCOM">([\s\S]*?)<\/div>/g)) {
      const tt = texto(m[1]).replace(/\s*\|\s*/g, " ").trim();
      if (new RegExp("^S[úu]mula(?: Vinculante)? " + e.n + "(?!\\d)").test(tt)) { tituloTxt = tt; tese = texto(m[2]); break; }
    }
    const mPub = html.match(/Data de publica[çc][ãa]o do enunciado:\s*([^<]+)/);
    const pub = mPub ? corrido(entidades(mPub[1])) : "";
    const mData = pub.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    const dataPub = mData ? mData[3] + "-" + mData[2].padStart(2, "0") + "-" + mData[1].padStart(2, "0") : "";
    /* o STF marca na lista ("Súmula 9 (cancelada)") e no próprio texto ("(superada) A imunidade … (superada)") */
    const marca = (e.extra + " " + tituloTxt + " " + (tese.match(/\((cancelada|revogada|superada)\)/i) || [""])[0]).toLowerCase();
    const situacao = /cancelad|revogad/.test(marca) ? "cancelada" : /superad/.test(marca) ? "superada" : "vigente";
    tese = corrido(tese).replace(/^\((cancelada|revogada|superada)\)\s*/i, "").replace(/\s*\((cancelada|revogada|superada)\)$/i, "");
    poe("STF|" + (vinc ? "sumula vinculante" : "sumula") + "|" + e.n, {
      tribunal: "STF", classe: vinc ? "Súmula Vinculante" : "Súmula", numero: e.n, tese,
      situacao, stfId: e.id, data: dataPub, fonte: pub,
    });
    progresso(vinc ? "STF SVs" : "STF súmulas", i, ids.length);
    await dorme(PAUSA);
  }
  conta[vinc ? "STF súmulas vinculantes" : "STF súmulas"] = ids.length;
}

/* ---------- STF repercussão geral ---------- */
async function stfRG() {
  let n = 0;
  for (const tipo of ["com", "sem"]) {
    const bruto = await pega("https://portal.stf.jus.br/repercussaogeral/retornartesesrepercussaogeral.asp", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "tipo=" + tipo,
    });
    let arr = [];
    try { const d = JSON.parse(bruto); arr = Array.isArray(d) ? d : Object.values(d).find(Array.isArray) || []; } catch (e) { arr = []; }
    arr.slice(0, LIMITE).forEach((x) => {
      const num = String(x.numeroTema || "").replace(/^0+/, "");
      if (!num) return;
      poe("STF|tema|" + num, {
        tribunal: "STF", classe: "Tema", numero: num,
        tese: corrido(entidades(String(x.descricaoTese || "")).replace(/[¿]/g, " ")),
        situacao: "vigente", repercussao: tipo === "com" ? "com repercussão geral" : "sem repercussão geral",
        data: dataIso(x.dataAndamento),
        paradigmas: x.siglaClasse && x.numeroProcesso ? [x.siglaClasse + " " + x.numeroProcesso] : [],
        incidente: String(x.incidente || ""),
      });
      n++;
    });
    await dorme(PAUSA);
  }
  conta["STF temas (RG)"] = n;
}

(async () => {
  const iSo = process.argv.indexOf("--so");
  const so = (process.argv.find((a) => a.startsWith("--so=")) || "").slice(5) || (iSo > 0 ? process.argv[iSo + 1] || "" : "");
  const quer = (k) => !so || so.split(",").includes(k);
  if (so && fs.existsSync(SAIDA)) {
    const velho = JSON.parse(fs.readFileSync(SAIDA, "utf8")).itens || {};
    Object.keys(velho).forEach((k) => { ["url", "questao", "situacaoOficial"].forEach((c) => delete velho[k][c]); itens[k] = velho[k]; });
  }
  if (quer("stf-rg")) await stfRG();
  if (quer("stf-sv")) await stfSumulas(26);
  if (quer("stf-sum")) await stfSumulas(30);
  if (quer("stj-sum")) await stjSumulas();
  if (quer("stj-rep")) await stjRepetitivos();
  const ordenado = {};
  Object.keys(itens).sort((a, b) => { const [ta, ca, na] = a.split("|"), [tb, cb, nb] = b.split("|"); return (ta + ca).localeCompare(tb + cb) || (+na - +nb); })
    .forEach((k) => { ordenado[k] = itens[k]; });
  const saida = {
    versao: 1, geradoEm: HOJE,
    fontes: {
      "STJ súmulas": "https://scon.stj.jus.br/SCON/sumstj/",
      "STJ repetitivos": "https://processo.stj.jus.br/repetitivos/temas_repetitivos/",
      "STF súmulas e súmulas vinculantes": "https://portal.stf.jus.br/jurisprudencia/aplicacaosumula.asp",
      "STF repercussão geral": "https://portal.stf.jus.br/repercussaogeral/teses.asp",
    },
    contagem: conta, itens: ordenado,
  };
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(saida));
  console.log("\ncatálogo: " + Object.keys(ordenado).length + " itens · " + Math.round(fs.statSync(SAIDA).size / 1024) + " KB · " + JSON.stringify(conta));
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
