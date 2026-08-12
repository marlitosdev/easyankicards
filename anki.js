/* EasyAnkiCards — gerador de .apkg no navegador.
 *
 * ┌── MAPA DO ARQUIVO ───────────────────────────────────────────────┐
 * │ ANKI_SCHEMA/COL_*    schema e JSONs extraídos de um pacote real  │
 * │                      gerado pela genanki (Python) e validados    │
 * │ ESTILOS/cssEstilo()  4 estilos visuais; cada um com IDs de       │
 * │                      modelo próprios                             │
 * │ comSaibaMais()       acrescenta os campos "Saiba mais" e         │
 * │                      "Título" ao FIM (compatível com decks já    │
 * │                      importados: campos novos entram vazios)     │
 * │ buildApkg()          monta o SQLite e compacta em .apkg          │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * CUIDADOS ao mexer aqui:
 *  - Campos novos SEMPRE no fim da lista (mudar a ordem quebra notas
 *    já importadas pelo usuário).
 *  - O ID do baralho vem de hash do nome: reimportar atualiza em vez
 *    de duplicar. Não trocar por número aleatório.
 *  - Blocos condicionais {{#Campo}}...{{/Campo}} evitam faixas vazias
 *    no cartão.
 *
 * Origem dos dados: schema e JSONs extraídos de um pacote gerado pela
 * genanki (Python) e validados contra o Anki real. Requer sql.js e
 * JSZip (CDN). Fluxo: buildApkg(cards, deck, estilo, titulo) -> bytes.
 */

const ANKI_SCHEMA = "CREATE TABLE col (\n    id              integer primary key,\n    crt             integer not null,\n    mod             integer not null,\n    scm             integer not null,\n    ver             integer not null,\n    dty             integer not null,\n    usn             integer not null,\n    ls              integer not null,\n    conf            text not null,\n    models          text not null,\n    decks           text not null,\n    dconf           text not null,\n    tags            text not null\n);\nCREATE TABLE notes (\n    id              integer primary key,   /* 0 */\n    guid            text not null,         /* 1 */\n    mid             integer not null,      /* 2 */\n    mod             integer not null,      /* 3 */\n    usn             integer not null,      /* 4 */\n    tags            text not null,         /* 5 */\n    flds            text not null,         /* 6 */\n    sfld            integer not null,      /* 7 */\n    csum            integer not null,      /* 8 */\n    flags           integer not null,      /* 9 */\n    data            text not null          /* 10 */\n);\nCREATE TABLE cards (\n    id              integer primary key,   /* 0 */\n    nid             integer not null,      /* 1 */\n    did             integer not null,      /* 2 */\n    ord             integer not null,      /* 3 */\n    mod             integer not null,      /* 4 */\n    usn             integer not null,      /* 5 */\n    type            integer not null,      /* 6 */\n    queue           integer not null,      /* 7 */\n    due             integer not null,      /* 8 */\n    ivl             integer not null,      /* 9 */\n    factor          integer not null,      /* 10 */\n    reps            integer not null,      /* 11 */\n    lapses          integer not null,      /* 12 */\n    left            integer not null,      /* 13 */\n    odue            integer not null,      /* 14 */\n    odid            integer not null,      /* 15 */\n    flags           integer not null,      /* 16 */\n    data            text not null          /* 17 */\n);\nCREATE TABLE revlog (\n    id              integer primary key,\n    cid             integer not null,\n    usn             integer not null,\n    ease            integer not null,\n    ivl             integer not null,\n    lastIvl         integer not null,\n    factor          integer not null,\n    time            integer not null,\n    type            integer not null\n);\nCREATE TABLE graves (\n    usn             integer not null,\n    oid             integer not null,\n    type            integer not null\n);\nCREATE INDEX ix_notes_usn on notes (usn);\nCREATE INDEX ix_cards_usn on cards (usn);\nCREATE INDEX ix_revlog_usn on revlog (usn);\nCREATE INDEX ix_cards_nid on cards (nid);\nCREATE INDEX ix_cards_sched on cards (did, queue, due);\nCREATE INDEX ix_revlog_cid on revlog (cid);\nCREATE INDEX ix_notes_csum on notes (csum);";

const COL_CONF = {
        "activeDecks": [
            1
        ],
        "addToCur": true,
        "collapseTime": 1200,
        "curDeck": 1,
        "curModel": "1425279151691",
        "dueCounts": true,
        "estTimes": true,
        "newBury": true,
        "newSpread": 0,
        "nextPos": 1,
        "sortBackwards": false,
        "sortType": "noteFld",
        "timeLim": 0
    };
const COL_MODELS = {"1607392319": {"css": "\n.card {\n  font-family: -apple-system, \"Segoe UI\", Arial, sans-serif;\n  font-size: 20px;\n  text-align: center;\n  color: #1a1a2e;\n  background-color: #fdfdfd;\n}\n.cloze { font-weight: bold; color: #0b6bcb; }\n", "did": 7969556022, "flds": [{"name": "Frente", "ord": 0, "font": "Liberation Sans", "media": [], "rtl": false, "size": 20, "sticky": false}, {"name": "Verso", "ord": 1, "font": "Liberation Sans", "media": [], "rtl": false, "size": 20, "sticky": false}], "id": "1607392319", "latexPost": "\\end{document}", "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n", "latexsvg": false, "mod": 1784336948, "name": "Gerador Flashcards - B\u00e1sico", "req": [[0, "all", [0]]], "sortf": 0, "tags": [], "tmpls": [{"name": "Cart\u00e3o 1", "qfmt": "{{Frente}}", "afmt": "{{FrontSide}}<hr id='answer'>{{Verso}}", "ord": 0, "bafmt": "", "bqfmt": "", "bfont": "", "bsize": 0, "did": null}], "type": 0, "usn": -1, "vers": []}, "1607392320": {"css": "\n.card {\n  font-family: -apple-system, \"Segoe UI\", Arial, sans-serif;\n  font-size: 20px;\n  text-align: center;\n  color: #1a1a2e;\n  background-color: #fdfdfd;\n}\n.cloze { font-weight: bold; color: #0b6bcb; }\n", "did": 7969556022, "flds": [{"name": "Texto", "ord": 0, "font": "Liberation Sans", "media": [], "rtl": false, "size": 20, "sticky": false}, {"name": "Extra", "ord": 1, "font": "Liberation Sans", "media": [], "rtl": false, "size": 20, "sticky": false}], "id": "1607392320", "latexPost": "\\end{document}", "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n", "latexsvg": false, "mod": 1784336948, "name": "Gerador Flashcards - Cloze", "req": [[0, "all", [0, 1]]], "sortf": 0, "tags": [], "tmpls": [{"name": "Cloze", "qfmt": "{{cloze:Texto}}", "afmt": "{{cloze:Texto}}<br>{{Extra}}", "ord": 0, "bafmt": "", "bqfmt": "", "bfont": "", "bsize": 0, "did": null}], "type": 1, "usn": -1, "vers": []}};   /* modelos Básico (1607392319) e Cloze (1607392320) */
const COL_DCONF = {
        "1": {
            "autoplay": true,
            "id": 1,
            "lapse": {
                "delays": [
                    10
                ],
                "leechAction": 0,
                "leechFails": 8,
                "minInt": 1,
                "mult": 0
            },
            "maxTaken": 60,
            "mod": 0,
            "name": "Default",
            "new": {
                "bury": true,
                "delays": [
                    1,
                    10
                ],
                "initialFactor": 2500,
                "ints": [
                    1,
                    4,
                    7
                ],
                "order": 1,
                "perDay": 20,
                "separate": true
            },
            "replayq": true,
            "rev": {
                "bury": true,
                "ease4": 1.3,
                "fuzz": 0.05,
                "ivlFct": 1,
                "maxIvl": 36500,
                "minSpace": 1,
                "perDay": 100
            },
            "timer": 0,
            "usn": 0
        }
    };
const DECK_DEFAULT = {"collapsed": false, "conf": 1, "desc": "", "dyn": 0, "extendNew": 10, "extendRev": 50, "id": 1, "lrnToday": [0, 0], "mod": 1425279151, "name": "Default", "newToday": [0, 0], "revToday": [0, 0], "timeToday": [0, 0], "usn": 0};
const DECK_TEMPLATE = {"collapsed": false, "conf": 1, "desc": "", "dyn": 0, "extendNew": 0, "extendRev": 50, "id": 7969556022, "lrnToday": [163, 2], "mod": 1425278051, "name": "RefDeck", "newToday": [163, 2], "revToday": [163, 0], "timeToday": [163, 23598], "usn": -1};

/* ID de baralho estável derivado do nome (mesma ideia da versão desktop):
 * regenerar o mesmo baralho atualiza no Anki em vez de duplicar. */
function stableDeckId(name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) >>> 0;
  return 1000000000 + (h % 8999999999);
}

/* Identidade do cartao para o Anki. Reimportar o mesmo baralho ATUALIZA a
 * nota quando o guid coincide, e cria uma copia quando nao coincide.
 *
 * Por isso o guid tem de sair do CONTEUDO QUE VOCE ESCREVEU, nunca do HTML
 * gerado: enquanto ele saia dos campos ja formatados, toda melhoria de
 * apresentacao (um <hr> novo, um <div> de paragrafo) mudava o guid de todos
 * os cartoes e a reimportacao duplicava o baralho inteiro. */
function guidDoCartao(c) {
  return guidFor(c.front, [c.back || "", c.more || ""].join("\x1f"));
}

function guidFor(front, back) {
  let h = 2166136261;
  const s = front + "\x1f" + back;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return "eac" + h.toString(36);
}

function clozeOrds(text) {
  const ords = new Set();
  const re = /\{\{c(\d+)::/g;
  let m;
  while ((m = re.exec(text)) !== null) ords.add(parseInt(m[1], 10) - 1);
  return ords.size ? [...ords].sort((a, b) => a - b) : [0];
}


/* ------------------------------------------------------------------
 * ESTILOS VISUAIS (facultativos) — v6.2
 * O CSS vive no modelo de nota do Anki, então o estilo escolhido vale
 * para o baralho exportado inteiro. Cabeçalhos automáticos usam os
 * campos especiais do Anki: {{Subdeck}} (pasta) e {{Tags}}.
 * Cada estilo tem IDs de modelo próprios para não conflitar entre si.
 * ------------------------------------------------------------------ */

/* O título do topo é um CAMPO da nota ("Título"), preenchido na
 * exportação — assim o usuário pode escrever o que quiser, em vez de
 * ficar preso ao nome do baralho. Vazio = cabeçalho não aparece. */
const EST_HEAD = '{{#Título}}<div class="materia">{{Título}}</div>{{/Título}}' +
                 '{{#Tags}}<div class="assunto">{{Tags}}</div>{{/Tags}}';

/* Bloco "Saiba mais": {{hint:...}} vira um link clicável no Anki que
 * expande a explicação. Só aparece se o campo estiver preenchido. */
const EST_MORE = '{{#Saiba mais}}<div class="saibamais">{{hint:Saiba mais}}</div>{{/Saiba mais}}';

const EST_TMPLS = {
  basicQ: EST_HEAD + '<div class="box">{{Frente}}</div>',
  basicA: EST_HEAD + '<div class="box">{{Frente}}</div>' +
          '{{#Verso}}<div class="resposta">{{Verso}}</div>{{/Verso}}' + EST_MORE,
  clozeQ: EST_HEAD + '<div class="box">{{cloze:Texto}}</div>',
  clozeA: EST_HEAD + '<div class="box">{{cloze:Texto}}</div>' +
          '{{#Extra}}<div class="justificativa">{{Extra}}</div>{{/Extra}}' + EST_MORE,
  mcQ: EST_HEAD + '<div class="box">{{Pergunta}}<br><br>{{Alternativas}}</div>',
  mcA: EST_HEAD + '<div class="box">{{Pergunta}}</div>' +
       '{{#Correta}}<div class="resposta">{{Correta}}</div>{{/Correta}}' +
       '{{#Extra}}<div class="justificativa">{{Extra}}</div>{{/Extra}}' + EST_MORE,
};

/* Transforma a explicação em blocos legíveis, na hora de exportar:
 *   - uma linha "+" vira um bloco com espaço embaixo (antes era só <br>,
 *     e o texto saía num parágrafo único, sem respiro entre conceitos);
 *   - "Termo — texto" ganha o termo em negrito, que é o que o olho procura;
 *   - a linha "---" vira um traço separando blocos de assunto.
 * O texto do usuário NÃO muda: isto acontece só no arquivo gerado. */
function maisEmBlocos(more) {
  const partes = String(more || "").split(/<br\s*\/?>/i)
    .map((s) => s.trim()).filter(Boolean);
  if (!partes.length) return "";
  return partes.map((p) => {
    if (/^-{2,}$/.test(p) || p === "—") return '<hr class="mais-sep">';
    const m = p.match(/^([^—:]{2,60})\s+—\s+([\s\S]+)$/);
    const corpo = m ? "<b>" + m[1].trim() + "</b> — " + m[2].trim() : p;
    return '<div class="mais-item">' + corpo + "</div>";
  }).join("");
}

/* Mesma ideia do "Saiba mais", agora para a resposta e a justificativa:
 * o texto chegava aqui com <br> entre as linhas, e <br> nao aceita margem —
 * o resultado era um bloco unico, sem divisao de paragrafo. Cada linha vira
 * um <div>, que aceita espacamento. */
function linhasEmBlocos(txt) {
  const linhas = String(txt || "").split(/<br\s*\/?>/i)
    .map((s) => s.trim()).filter(Boolean);
  const blocos = [];
  linhas.forEach((l) => {
    /* "I - x / II - y / III - z" e' uma lista escrita numa linha so' porque
     * o formato exige a resposta inteira numa linha. Aqui ela volta a ser
     * lista, com uma regua entre um item e o seguinte. */
    const itens = typeof itensDaLista === "function" ? itensDaLista(l) : null;
    if (itens) itens.forEach((i) => blocos.push(["item", i]));
    else blocos.push(["par", l]);
  });
  if (blocos.length < 2) return String(txt || "");
  return blocos.map(([cls, t]) => '<div class="' + cls + '">' + t + "</div>").join("");
}

function cssEstilo(p) {
  p = Object.assign({ alinha: "justify" }, p);
  return `
.card{background:${p.fundo};font-family:Arial,sans-serif;font-size:18px;
  line-height:1.6;color:${p.texto};padding:14px 6px}
/* Alinhamento declarado no NOSSO invólucro, e não herdado. O modelo padrão
   do Anki traz ".card{text-align:center}"; quem já importou uma versão
   antiga do baralho pode ter esse CSS grudado no tipo de nota, e aí tudo
   sai centralizado. Declarando aqui, o resultado não depende disso. */
.card,.eac{text-align:left}
/* Blocos de texto corrido: justificado COM separação silábica. Justificar
   sem hifenização abre "rios" de espaço em branco e piora a leitura no
   celular, que é onde o cartão é revisado. */
.box,.justificativa,.saibamais div.hint{text-align:${p.alinha};
  hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word}
.materia{max-width:480px;margin:0 auto 10px;background:${p.cab};color:${p.cabTexto};
  font-weight:bold;font-size:21px;text-align:center;padding:10px;
  border-radius:14px;box-shadow:1px 3px 4px ${p.sombra};box-sizing:border-box}
.assunto{max-width:480px;margin:0 auto;background:${p.sub};color:${p.texto};
  font-style:italic;font-size:13px;letter-spacing:1px;text-align:center;
  padding:7px;border-radius:14px 14px 0 0;box-shadow:1px 3px 4px ${p.sombra};
  box-sizing:border-box}
.box{max-width:480px;margin:0 auto;background:${p.caixa};color:${p.texto};
  padding:18px;box-shadow:1px 3px 4px ${p.sombra};box-sizing:border-box}
.resposta{max-width:480px;margin:16px auto 0;background:${p.caixa};color:${p.destaque};
  font-weight:bold;font-size:21px;line-height:1.4;text-align:center;padding:12px;
  text-wrap:balance;box-shadow:1px 3px 4px ${p.sombra};box-sizing:border-box}
/* Resposta longa não cabe no formato "manchete": vira texto corrido, no
   tamanho normal, alinhada como o resto. Quem decide é o app, na hora de
   exportar, porque só ele sabe o tamanho do texto. */
.resposta .longa,.resposta.longa{font-size:18px;font-weight:600;text-align:${p.alinha};
  padding:16px;text-wrap:initial;hyphens:auto;-webkit-hyphens:auto}
.justificativa{max-width:480px;margin:16px auto 0;background:${p.caixa};color:${p.texto};
  padding:16px;border-radius:0 0 14px 14px;
  box-shadow:1px 3px 4px ${p.sombra};box-sizing:border-box}
/* "Saiba mais": a pílula vale para o LINK. O conteúdo revelado é o texto
   mais longo do cartão e antes herdava "centralizado + letter-spacing" —
   era o que deixava a leitura difícil. Ele agora tem tratamento próprio. */
.saibamais{max-width:480px;margin:14px auto 0;background:${p.sub || p.caixa};
  color:${p.texto};text-align:center;padding:11px 14px;border-radius:16px;
  box-shadow:1px 3px 4px ${p.sombra};box-sizing:border-box}
.saibamais a{color:${p.destaque};text-decoration:none;font-weight:bold;letter-spacing:1px}
.saibamais div.hint{margin-top:11px;padding-top:11px;letter-spacing:normal;
  border-top:1px solid ${p.sombra};font-size:16px;line-height:1.65}
/* Um conceito por bloco. Entre dois conceitos entra uma linha fina: com
   cinco ou dez conceitos, so a margem nao separa nada — o olho le tudo como
   um paragrafo unico. A linha e discreta de proposito; o traco FORTE fica
   reservado para "+ ---", que marca mudanca de assunto.
   ".mais-item + .mais-item" so casa entre dois blocos seguidos, entao o
   bloco logo apos um "+ ---" nao ganha linha dupla. */
.mais-item{margin:0 0 9px}
.mais-item + .mais-item{border-top:1px solid ${p.sombra}40;
  padding-top:9px}
.mais-item:last-child{margin-bottom:0}
.mais-item b{color:${p.destaque}}
.mais-sep{border:0;border-top:2px dashed ${p.destaque};margin:14px 0 12px}
/* paragrafos da resposta longa e da justificativa */
.par{margin:0 0 9px}
.par + .par{border-top:1px solid ${p.sombra}33;padding-top:9px}
.par:last-child{margin-bottom:0}
/* itens de uma enumeracao ("I - ... / II - ...") ganham regua mais visivel
   que a de paragrafo: aqui a linha e' o que diz "acabou um item, comecou
   outro", e nao apenas um respiro de leitura */
.item{margin:0 0 10px;text-align:left}
.item + .item{border-top:1px solid ${p.sombra};padding-top:10px}
.item:last-child{margin-bottom:0}
.cloze{font-weight:bold;color:${p.destaque}}
.mc-correta{color:${p.destaque};font-weight:bold}
`;
}

/* Cores de cada estilo. O CSS é montado na hora, porque o alinhamento do
 * texto é escolhido pelo usuário na exportação. */
/* (o app.js tem a sua própria tabela, só para o mini-preview do diálogo;
   esta aqui é a que vai para o .apkg — nomes diferentes de propósito) */
const CORES_APKG = {
  esquema: { fundo: "#f2f3f6", texto: "#26344f", cab: "#26344f",
    cabTexto: "#f7f7f7", sub: "#d9d9d9", caixa: "#ffffff",
    destaque: "#4eaed9", sombra: "#abb2b9" },
  dark: { fundo: "#14161b", texto: "#e9ebf0", cab: "#3350a5",
    cabTexto: "#ffffff", sub: "#2a2e37", caixa: "#1f232b",
    destaque: "#7cc4ff", sombra: "#00000088" },
  paper: { fundo: "#f4ecd8", texto: "#3b2f1d", cab: "#8b5e34",
    cabTexto: "#fdf6e3", sub: "#e7dcc3", caixa: "#fffaf0",
    destaque: "#b45309", sombra: "#c9b895" },
};

const ESTILOS = {
  classic: { ids: [1607392319, 1607392320, 1607392321], paleta: null },
  esquema: { ids: [1698100011, 1698100012, 1698100013], paleta: "esquema" },
  dark: { ids: [1698100021, 1698100022, 1698100023], paleta: "dark" },
  paper: { ids: [1698100031, 1698100032, 1698100033], paleta: "paper" },
};


/* Monta os 3 modelos (básico, cloze, MC) para o estilo pedido. */
function modelosParaEstilo(estilo, alinha) {
  const cfg = ESTILOS[estilo] || ESTILOS.classic;
  // "justify" só compensa junto com hifenização; "left" fica disponível
  // para quem prefere a margem direita irregular (mais comum em telas)
  const al = alinha === "left" ? "left" : "justify";
  const css = cfg.paleta
    ? cssEstilo(Object.assign({ alinha: al }, CORES_APKG[cfg.paleta])) : null;
  const base = JSON.parse(JSON.stringify(COL_MODELS));
  const models = montarModeloMC(base);          // garante o MC clássico
  if (!css) {
    // estilo clássico: mesmo layout simples, mas com o link "Saiba mais"
    const saida = {};
    Object.keys(models).forEach((k) => {
      const m = comSaibaMais(models[k]);
      m.tmpls[0].afmt += "<br>" + EST_MORE;
      /* o modelo classico nasce com ".card{text-align:center}": a regra e
       * REMOVIDA, nao sobrescrita — sobrescrever depende da ordem do arquivo
       * e some no dia em que alguem reordenar o CSS. */
      m.css = String(m.css || "").replace(/(\.card\s*\{[^}]*?)text-align:\s*center;?/, "");
      /* alinhamento e blocos, iguais aos estilos novos,
       * senao a explicacao longa sai centralizada linha a linha */
      m.css = (m.css || "") + "\n.card,.eac{text-align:left}"
            + "\n.saibamais a{color:#0b6bcb;font-weight:bold;text-decoration:none}"
            + "\n.mais-item{margin:0 0 9px;text-align:left}"
            + "\n.mais-item + .mais-item{border-top:1px solid #ddd;padding-top:9px}"
            + "\n.mais-sep{border:0;border-top:2px dashed #0b6bcb;margin:14px 0 12px}"
            + "\n.par{margin:0 0 9px;text-align:left}"
            + "\n.item{margin:0 0 10px;text-align:left}"
            + "\n.item + .item{border-top:1px solid #bbb;padding-top:10px}";
      saida[k] = m;
    });
    return saida;
  }

  const [idB, idC, idM] = cfg.ids;
  const out = {};
  const b = comSaibaMais(models["1607392319"]);
  b.id = idB; b.name = "EasyAnkiCards " + estilo + " - Básico";
  b.css = css;
  const idioma = (typeof LANG !== "undefined" && LANG === "en") ? "en" : "pt-BR";
  // sem lang o navegador não sabe onde separar as sílabas, e o texto
  // justificado volta a abrir buracos entre as palavras
  const env = (s) => '<div class="eac" lang="' + idioma + '">' + s + "</div>";
  b.tmpls[0].qfmt = env(EST_TMPLS.basicQ);
  b.tmpls[0].afmt = env(EST_TMPLS.basicA);
  out[String(idB)] = b;

  const c = comSaibaMais(models["1607392320"]);
  c.id = idC; c.name = "EasyAnkiCards " + estilo + " - Cloze";
  c.css = css;
  c.tmpls[0].qfmt = env(EST_TMPLS.clozeQ);
  c.tmpls[0].afmt = env(EST_TMPLS.clozeA);
  out[String(idC)] = c;

  const m = comSaibaMais(models["1607392321"]);
  m.id = idM; m.name = "EasyAnkiCards " + estilo + " - Múltipla Escolha";
  m.css = css;
  m.tmpls[0].qfmt = env(EST_TMPLS.mcQ);
  m.tmpls[0].afmt = env(EST_TMPLS.mcA);
  out[String(idM)] = m;
  return out;
}

/* Monta o modelo de Múltipla Escolha clonando o Básico.
 * O template da RESPOSTA não usa {{FrontSide}}: mostra a pergunta e
 * SOMENTE a alternativa correta (as demais desaparecem), + explicação. */
/* Acrescenta o campo "Saiba mais" ao final de um modelo.
 * Adicionar no FIM preserva a ordem dos campos existentes, então quem já
 * importou versões anteriores recebe o campo novo vazio, sem perder nada. */
function comSaibaMais(m) {
  const modelo = JSON.parse(JSON.stringify(m));
  ["Saiba mais", "Título"].forEach((nome) => {
    if (modelo.flds.some((f) => f.name === nome)) return;
    const novo = JSON.parse(JSON.stringify(modelo.flds[0]));
    novo.name = nome;
    novo.ord = modelo.flds.length;
    modelo.flds.push(novo);
  });
  return modelo;
}

function montarModeloMC(models) {
  const basic = models["1607392319"];
  const mc = JSON.parse(JSON.stringify(basic));
  mc.id = 1607392321;
  mc.name = "EasyAnkiCards - Múltipla Escolha";
  const f0 = basic.flds[0];
  mc.flds = ["Pergunta", "Alternativas", "Correta", "Extra"].map((nome, i) =>
    Object.assign(JSON.parse(JSON.stringify(f0)), { name: nome, ord: i }));
  mc.tmpls[0].name = "Cartão MC";
  mc.tmpls[0].qfmt = "{{Pergunta}}<br><br>{{Alternativas}}";
  mc.tmpls[0].afmt = "{{Pergunta}}<br><br><span class='mc-correta'>{{Correta}}</span>" +
                     "{{#Extra}}<hr id='answer'>{{Extra}}{{/Extra}}";
  mc.css = (mc.css || "") + "\n.mc-correta{color:#1a7f37;font-weight:bold}";
  models["1607392321"] = mc;
  return models;
}

/* cards: [{kind:"basic"|"cloze"|"mc", front, back, tags, options?, correct?}] */
async function buildApkg(cards, deckName, estilo, titulo, alinha) {
  estilo = estilo || "classic";
  titulo = titulo === undefined ? "" : titulo;
  const SQL = await window.__sqlPromise;   /* initSqlJs, ver index.html */
  const db = new SQL.Database();
  db.run(ANKI_SCHEMA);

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const deckId = stableDeckId(deckName);
  const deck = JSON.parse(JSON.stringify(DECK_TEMPLATE));
  deck.id = deckId; deck.name = deckName; deck.mod = nowSec;
  const decks = {}; decks["1"] = DECK_DEFAULT; decks[String(deckId)] = deck;

  const models = modelosParaEstilo(estilo, alinha);
  const [MID_B, MID_C, MID_M] = (ESTILOS[estilo] || ESTILOS.classic).ids;
  db.run(
    "INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,'{}')",
    [nowSec, now, now, JSON.stringify(COL_CONF), JSON.stringify(models),
     JSON.stringify(decks), JSON.stringify(COL_DCONF)]
  );

  let id = now;
  for (const c of cards) {
    let mid, campos;
    if (c.kind === "mc") {
      mid = MID_M;
      const alts = c.options.map((o, i) => letra(i) + ") " + o).join("<br>");
      const correta = "✔ " + letra(c.correct) + ") " + (c.options[c.correct] || "");
      campos = [c.front, alts, correta, linhasEmBlocos(c.back || ""),
                maisEmBlocos(c.more),
                c.titulo || titulo];
    } else {
      mid = c.kind === "cloze" ? MID_C : MID_B;
      // resposta comprida não funciona no formato "manchete" centralizado:
      // marcamos aqui, que é onde se conhece o tamanho do texto
      const verso = (c.back || "").length > 90
        ? '<div class="longa">' + linhasEmBlocos(c.back) + "</div>"
        : linhasEmBlocos(c.back || "");
      campos = [c.front, verso, maisEmBlocos(c.more), c.titulo || titulo];
    }
    const noteId = id++;
    const flds = campos.join("\x1f");
    const tags = c.tags.length ? " " + c.tags.join(" ") + " " : "";
    db.run(
      "INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,0,0,'')",
      [noteId, guidDoCartao(c), mid, nowSec, tags, flds, c.front]
    );
    const ords = c.kind === "cloze" ? clozeOrds(c.front) : [0];
    for (const ord of ords) {
      db.run(
        "INSERT INTO cards VALUES (?,?,?,?,?,-1,0,0,0,0,0,0,0,0,0,0,0,'')",
        [id++, noteId, deckId, ord, nowSec]
      );
    }
  }

  const bytes = db.export();
  db.close();
  const zip = new JSZip();
  zip.file("collection.anki2", bytes);
  zip.file("media", "{}");
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}


/* ------------------------------------------------------------------
 * IMPORTAR .apkg — lê um pacote do Anki e devolve cartões no formato
 * do app: [{kind, front, back, tags, more, titulo}]
 *
 * Formatos: pacotes novos (Anki 2.1.50+) trazem collection.anki21b
 * comprimido em zstd; os antigos trazem collection.anki2 direto.
 * ------------------------------------------------------------------ */

/* Carrega o fzstd (descompactação zstd dos pacotes modernos do Anki).
 * Tenta dois CDNs; sem ele, pacotes novos não podem ser lidos. */
const _FZSTD_CDNS = [
  "https://cdnjs.cloudflare.com/ajax/libs/fzstd/0.1.1/index.min.js",
  "https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js",
  "https://unpkg.com/fzstd@0.1.1/umd/index.js",
];

async function _carregarFzstd() {
  if (window.fzstd) return true;
  for (const url of _FZSTD_CDNS) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload = resolve;
        s.onerror = () => reject(new Error("falhou " + url));
        document.head.append(s);
        setTimeout(() => reject(new Error("timeout " + url)), 8000);
      });
      if (window.fzstd) return true;
    } catch (e) { /* tenta o próximo */ }
  }
  return false;
}

async function _descompactarZstd(bytes) {
  if (!(await _carregarFzstd()))
    throw new Error("ZSTD_INDISPONIVEL");
  return window.fzstd.decompress(bytes);
}

/* Remove HTML deixando texto legível (o Anki guarda os campos em HTML). */
function _limparHtml(s) {
  return (s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(div|p|li|tr)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function lerApkg(arrayBuffer) {
  const SQL = await window.__sqlPromise;
  const zip = await JSZip.loadAsync(arrayBuffer);

  // escolhe a melhor fonte de dados dentro do pacote
  let bytes = null, erroZstd = null;
  const temModerno = !!zip.file("collection.anki21b");
  if (temModerno) {
    const raw = await zip.file("collection.anki21b").async("uint8array");
    try { bytes = await _descompactarZstd(raw); }
    catch (e) { bytes = null; erroZstd = e; }
  }
  if (!bytes && zip.file("collection.anki21"))
    bytes = await zip.file("collection.anki21").async("uint8array");
  if (!bytes && zip.file("collection.anki2"))
    bytes = await zip.file("collection.anki2").async("uint8array");
  if (!bytes) throw new Error("collection não encontrada no pacote");
  // guarda o contexto para detectar a "cópia de aviso" mais abaixo
  var _pacoteModerno = temModerno, _falhouZstd = !!erroZstd;

  const db = new SQL.Database(bytes);

  // modelos: id -> {tipo (0 basico / 1 cloze), campos[]}
  const modelos = {};
  try {
    const col = db.exec("SELECT models FROM col")[0];
    const js = JSON.parse(col.values[0][0]);
    Object.keys(js).forEach((k) => {
      modelos[k] = { tipo: js[k].type, campos: (js[k].flds || []).map((f) => f.name) };
    });
  } catch (e) { /* formato novo: tabela notetypes */ }
  if (!Object.keys(modelos).length) {
    try {
      const r = db.exec("SELECT ntid, ord, name FROM fields ORDER BY ntid, ord")[0];
      (r ? r.values : []).forEach(([ntid, ord, nome]) => {
        modelos[ntid] = modelos[ntid] || { tipo: 0, campos: [] };
        modelos[ntid].campos[ord] = nome;
      });
      const t = db.exec("SELECT id, config FROM notetypes")[0];
      (t ? t.values : []).forEach(([id, cfg]) => {
        const txt = new TextDecoder("utf-8", { fatal: false }).decode(cfg);
        if (modelos[id]) modelos[id].tipo = /cloze/i.test(txt) ? 1 : 0;
      });
    } catch (e) { /* segue com heurística */ }
  }

  // nome do baralho (primeiro que não seja Default)
  let deckNome = "";
  try {
    const d = db.exec("SELECT decks FROM col")[0];
    const js = JSON.parse(d.values[0][0]);
    deckNome = (Object.values(js).map((x) => x.name).find((n) => n && n !== "Default")) || "";
  } catch (e) {
    try {
      const r = db.exec("SELECT name FROM decks")[0];
      deckNome = (r ? r.values.map((v) => String(v[0]).replace(/\x1f/g, "::")) : [])
        .find((n) => n && n !== "Default") || "";
    } catch (e2) { /* sem nome */ }
  }

  const res = db.exec("SELECT mid, flds, tags FROM notes");
  const linhas = res.length ? res[0].values : [];
  const cards = [];
  linhas.forEach(([mid, flds, tags]) => {
    const campos = String(flds).split("\x1f").map(_limparHtml);
    const m = modelos[mid] || {};
    const nomes = (m.campos || []).map((n) => String(n || "").toLowerCase());
    const tagArr = String(tags || "").trim().split(/\s+/).filter(Boolean);

    /* Modelos personalizados (muito comuns em baralhos de concurso) põem
     * matéria/assunto nos primeiros campos e a pergunta mais adiante.
     * Escolhemos os campos por HEURÍSTICA, na ordem:
     *  1. nomes conhecidos (pergunta/frente/texto/afirmação...)
     *  2. o primeiro campo que contenha lacuna {{c1::}}
     *  3. o campo mais longo (costuma ser o enunciado) */
    const iPor = (chaves) => nomes.findIndex((n) => chaves.some((k) => n.includes(k)));
    let iFrente = iPor(["pergunta", "frente", "front", "texto", "text", "afirma", "enunciado", "questão", "questao"]);
    if (iFrente < 0) iFrente = campos.findIndex((c) => /\{\{c\d+::/.test(c));
    if (iFrente < 0) {
      let melhor = 0;
      campos.forEach((c, i) => { if ((c || "").length > (campos[melhor] || "").length) melhor = i; });
      iFrente = melhor;
    }
    let iVerso = iPor(["resposta", "verso", "back", "correta", "gabarito"]);
    if (iVerso === iFrente) iVerso = -1;
    if (iVerso < 0) {
      // primeiro campo com texto depois da frente
      for (let i = 0; i < campos.length; i++)
        if (i !== iFrente && (campos[i] || "").length > 1) { iVerso = i; break; }
    }
    let iMais = iPor(["extra", "saiba", "embasamento", "justificativa", "coment", "explica"]);
    if (iMais === iFrente || iMais === iVerso) iMais = -1;
    // cabeçalhos (matéria/assunto) viram TÍTULO do cartão
    let iTitulo = iPor(["matéria", "materia", "assunto", "tópico", "topico", "título", "titulo", "header"]);
    if (iTitulo === iFrente || iTitulo === iVerso) iTitulo = -1;

    let frente = campos[iFrente] || "";
    if (!frente) return;
    // "#" no início vira comentário no editor; "@ + *" são metadados.
    // Preserva o conteúdo trocando por uma forma equivalente e visível.
    frente = frente.replace(/^\s*#\s*/, "nº ").replace(/^\s*[@+*]\s*/, "");
    const ehCloze = m.tipo === 1 || /\{\{c\d+::/.test(frente);
    let verso = ehCloze ? "" : (campos[iVerso] || "");
    let mais = iMais >= 0 ? (campos[iMais] || "") : (ehCloze && iVerso >= 0 ? (campos[iVerso] || "") : "");
    // Cartão básico SEM verso seria descartado pelo parser ("verso vazio").
    // Usa a explicação como resposta; se não houver, deixa um marcador
    // para o usuário completar — nenhum cartão importado se perde.
    if (!ehCloze && !verso.trim()) {
      if (mais.trim()) { verso = mais; mais = ""; }
      else verso = "(sem resposta no baralho original)";
    }
    cards.push({
      kind: ehCloze ? "cloze" : "basic",
      front: frente,
      back: verso,
      tags: tagArr, ownTags: tagArr,
      more: mais,
      titulo: iTitulo >= 0 ? (campos[iTitulo] || "") : "",
    });
  });
  db.close();
  /* Pacotes modernos trazem uma cópia antiga contendo APENAS um aviso
   * ("Atualize para a versão mais recente do Anki..."). Se caímos nela
   * porque o zstd falhou, avisamos em vez de importar o aviso. */
  const soAviso = cards.length <= 1 &&
    cards.every((c) => /atualize para a vers|update to the latest/i.test(c.front || ""));
  if (soAviso) {
    const err = new Error(_falhouZstd ? "ZSTD_INDISPONIVEL" : "PACOTE_SO_AVISO");
    err.code = _falhouZstd ? "ZSTD" : "AVISO";
    throw err;
  }
  return { deck: deckNome, cards };
}
