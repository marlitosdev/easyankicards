/* EasyAnkiCards — gerador de .apkg no navegador.
 * Schema e estruturas JSON extraídos de um pacote gerado pela genanki
 * (Python) e validados contra o Anki. Requer sql.js e JSZip (CDN).
 * Fluxo: buildApkg(cards, deckName) -> Uint8Array do arquivo .apkg
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

/* cards: [{kind:"basic"|"cloze", front, back, tags:[]}] */
async function buildApkg(cards, deckName) {
  const SQL = await window.__sqlPromise;   /* initSqlJs, ver index.html */
  const db = new SQL.Database();
  db.run(ANKI_SCHEMA);

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const deckId = stableDeckId(deckName);
  const deck = JSON.parse(JSON.stringify(DECK_TEMPLATE));
  deck.id = deckId; deck.name = deckName; deck.mod = nowSec;
  const decks = {}; decks["1"] = DECK_DEFAULT; decks[String(deckId)] = deck;

  db.run(
    "INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,'{}')",
    [nowSec, now, now, JSON.stringify(COL_CONF), JSON.stringify(COL_MODELS),
     JSON.stringify(decks), JSON.stringify(COL_DCONF)]
  );

  let id = now;
  for (const c of cards) {
    const mid = c.kind === "cloze" ? 1607392320 : 1607392319;
    const noteId = id++;
    const flds = c.front + "\x1f" + (c.back || "");
    const tags = c.tags.length ? " " + c.tags.join(" ") + " " : "";
    db.run(
      "INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,0,0,'')",
      [noteId, guidFor(c.front, c.back || ""), mid, nowSec, tags, flds, c.front]
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
