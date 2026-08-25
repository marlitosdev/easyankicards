/* =====================================================================
 * ESTRUTURA DO HTML
 * Uma tag fechada a mais ou a menos não quebra nada visivelmente: o
 * navegador conserta à sua maneira, e o resultado é um pedaço da tela
 * aparecendo na coluna errada. Foi o que aconteceu na v8.31 — um
 * "</div>" sobrando fechou a coluna direita cedo, e a prévia dos cartões
 * foi parar embaixo do painel esquerdo.
 * Nem o "node --check" nem o teste de fumaça pegam isso: o app carrega
 * normalmente. Só a contagem das tags pega.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const VAZIAS = new Set(["br", "hr", "img", "input", "meta", "link", "source",
  "area", "base", "col", "embed", "track", "wbr", "path", "circle", "rect"]);

/* Elementos que precisam existir e ficar DENTRO do painel certo.
 * (id do filho, id/classe do ancestral esperado) */
const NINHOS = [
  ["cartoes", "grupo"],
  ["resumo", "grupo"],
  ["barraRevisao", "grupo"],
  ["editor", "grupo"],
  ["sugestoes", "grupo"],
  ["editor", "painelEsquerdo"],
  /* cada modo tem de morar dentro da sua propria secao: se o esqueleto do
   * edital escapar para dentro do modo cartoes, ele aparece junto com o
   * editor e ninguem entende o que esta vendo */
  ["editalTexto", "modo-area"],
  /* #resumoTexto2 era o esqueleto desligado da v8.47. Em 8.68 descobri que
   * ele sobrevivia numa SEGUNDA secao secResumos duplicada, junto com copias
   * mortas de secEdital e secFerramentas — o JS escrevia na primeira e o
   * navegador desenhava as duas. Aqui fica o que existe de verdade. */
  ["matLista", "modo-area"],
  ["matBusca", "secResumos"],
  /* o hub e a bancada do edital: um so pode aparecer de cada vez, e a
   * agenda fica FORA dos dois, porque a semana atravessa editais */
  ["hubLista", "edHub"],
  ["edHub", "secEdital"],
  ["edAgendaTopo", "secEdital"],
  ["editalTexto", "edBancada"],
  ["btnImportar", "secFerramentas"],
  ["btnHistorico", "secFerramentas"],
  ["barraRecuperar", "painelEsquerdo"],
  ["editalTexto", "painelEdital"],
  ["edTabela", "secEdital"],
  ["bancadaNome", "painelEsquerdo"],
];

/* O contrario de NINHOS: elementos que NAO podem cair dentro de um bloco.
 * "Esta dentro de secEdital" era verdade tanto para a agenda no topo quanto
 * para a agenda enfiada na bancada — e sao coisas opostas. A agenda existe
 * porque a semana atravessa editais; dentro da bancada ela sumiria toda vez
 * que o usuario voltasse para a lista, que e justamente quando ele quer ver
 * o que estudar hoje. */
const FORA = [
  ["edAgendaTopo", "edBancada"],
  ["edAgendaTopo", "edHub"],
  ["hubLista", "edBancada"],
  ["editalTexto", "edHub"],
];

function tags(html) {
  // só o <body>: o <head> tem CSS com ">" solto, que confundiria a leitura
  const bruto = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>") + 7);
  /* COMENTARIO NAO E ESTRUTURA.
   * Um comentario que MENCIONA uma tag ("o navegador empilha <dialog> em
   * camada propria") era contado como abertura de verdade, e o teste
   * acusava "falta uma tag" num HTML perfeitamente equilibrado. Trocar o
   * miolo do comentario por espacos preserva a contagem de LINHAS, que e o
   * que os avisos usam para dizer onde esta o problema. */
  const corpo = bruto.replace(/<!--[\s\S]*?-->/g, (c) =>
    c.replace(/[^\n]/g, " "));
  const desloc = html.slice(0, html.indexOf("<body")).split("\n").length - 1;
  const lista = [];
  for (const m of corpo.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, fecha, nome, attrs, auto] = m;
    const tag = nome.toLowerCase();
    const linha = corpo.slice(0, m.index).split("\n").length + desloc;
    /* Elemento vazio (<input>, <img>, <br>) nao entra na pilha — nao tem
     * filhos para conter. Mas o ID dele importa: ate a 8.68 este atalho
     * fazia o teste responder "sumiu do HTML" para QUALQUER campo de
     * formulario, o que na pratica deixava input e img sem guarda nenhuma.
     * Agora vai marcado como folha: registra o caminho, nao abre nivel. */
    if (VAZIAS.has(tag) || auto) {
      if (!fecha) lista.push({ folha: true, fecha: false, tag, attrs, linha });
      continue;
    }
    lista.push({ fecha: !!fecha, tag, attrs, linha });
  }
  return lista;
}

function testes() {
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const falhas = [];
  const pilha = [];
  const caminhos = {};        // id -> lista de ancestrais (ids e classes)

  for (const it of tags(html)) {
    if (it.folha) {
      const idf = (it.attrs.match(/id="([^"]+)"/) || [])[1];
      if (idf) caminhos[idf] = pilha.flatMap((p) => p.marcas);
      continue;
    }
    if (!it.fecha) {
      const id = (it.attrs.match(/id="([^"]+)"/) || [])[1];
      const cls = (it.attrs.match(/class="([^"]+)"/) || [])[1] || "";
      // guarda id E classe: um elemento pode ter os dois, e o ancestral
      // esperado às vezes é a classe ("grupo") de um bloco que ganhou id depois
      if (id) caminhos[id] = pilha.flatMap((p) => p.marcas);
      pilha.push({ tag: it.tag, linha: it.linha,
        marcas: [id, cls.split(" ")[0]].filter(Boolean) });
    } else {
      if (!pilha.length) {
        falhas.push(`E1 linha ${it.linha}: </${it.tag}> sem abertura correspondente`);
        continue;
      }
      const topo = pilha.pop();
      if (topo.tag !== it.tag) {
        falhas.push(`E1 linha ${it.linha}: </${it.tag}> está fechando `
          + `<${topo.tag}> aberta na linha ${topo.linha} — falta ou sobra uma tag`);
      }
    }
  }
  pilha.forEach((p) =>
    falhas.push(`E2 <${p.tag}> aberta na linha ${p.linha} nunca foi fechada`));

  // E3: cada elemento continua dentro do painel a que pertence
  NINHOS.forEach(([id, ancestral]) => {
    if (!(id in caminhos)) { falhas.push(`E3 elemento #${id} sumiu do HTML`); return; }
    if (!caminhos[id].includes(ancestral))
      falhas.push(`E3 #${id} saiu de dentro de "${ancestral}" `
        + `(está em: ${caminhos[id].slice(-4).join(" > ") || "raiz"})`);
  });

  /* E5 — o inverso: o que nao pode estar aninhado ali */
  FORA.forEach(([id, proibido]) => {
    if (!(id in caminhos)) { falhas.push(`E5 elemento #${id} sumiu do HTML`); return; }
    if (caminhos[id].includes(proibido))
      falhas.push(`E5 #${id} nao pode ficar dentro de "${proibido}" `
                  + `(caminho: ${caminhos[id].join(" > ") || "raiz"})`);
  });

  return falhas;
}

/* ------------------------------------------------------------------
 * E6 — o service worker tem de conhecer todo script do app
 *
 * Arquivo fora do SHELL nao quebra nada com a rede boa: o "network-first"
 * busca e entrega. Quebra offline, e quebra so para quem ja tinha o app
 * instalado — que e exatamente quem confia nele. Em 8.68 os dois arquivos
 * novos ficaram de fora e nenhum outro teste percebeu.
 * ------------------------------------------------------------------ */
function testeSW() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(RAIZ, "docs", "sw.js"), "utf8");
  const shellBloco = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [, ""])[1];
  const shell = (shellBloco.match(/"([^"]+)"/g) || []).map((x) => x.slice(1, -1));

  const scripts = (html.match(/<script src="([^"]+)"/g) || [])
    .map((x) => x.replace(/.*src="/, "").replace(/"/, ""))
    .filter((x) => !/^https?:/.test(x));
  scripts.forEach((s) => {
    if (!shell.includes(s))
      falhas.push(`E6 ${s} esta no index.html mas fora do SHELL do sw.js `
                  + "(o app quebra offline para quem ja tem instalado)");
  });

  const vistos = {}, dup = [];
  shell.forEach((x) => { if (vistos[x] && dup.indexOf(x) < 0) dup.push(x); vistos[x] = 1; });
  if (dup.length) falhas.push("E6b SHELL com entrada repetida: " + dup.join(", "));

  shell.filter((x) => /\.js$|\.html$|\.png$|\.webmanifest$/.test(x) && !/^https?:/.test(x))
    .forEach((x) => {
      if (!fs.existsSync(path.join(RAIZ, "docs", x)))
        falhas.push(`E6c SHELL aponta para "${x}", que nao existe em docs/`);
    });
  return falhas;
}

/* =====================================================================
 * E7 — nenhum <dialog> pode ganhar "display" sem exigir [open]
 *
 * Um <dialog> fechado só some porque a folha do NAVEGADOR lhe dá
 * display:none. Uma regra com id ("#dlgMaterial{display:flex}") ganha
 * dessa, e o diálogo passa a aparecer sempre: encaixado no meio da página,
 * sem fundo escuro, sem título — porque ninguém o abriu — e impossível de
 * fechar, já que close() só tira um atributo que ele não estava usando.
 *
 * Foi assim que a lei seca e o resumo apareceram grudados na tela do
 * edital. Nenhum teste de comportamento pega isto: o stub não aplica CSS,
 * e no DOM o diálogo continua com open=false, certinho. Só o navegador
 * mostra o estrago — então a verificação tem de ser sobre o texto do CSS.
 * ===================================================================== */
/* E8 — [hidden] precisa vencer qualquer classe.
 * Mesma armadilha do <dialog>, um degrau abaixo: a regra do navegador tem
 * especificidade baixa, e uma classe com display ganha dela. Sem a regra
 * global, esconder um elemento com .hidden = true nao esconde nada. */
function testeHidden() {
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const falhas = [];
  if (!/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/.test(html)) {
    falhas.push("E8 falta a regra global [hidden]{display:none!important} —"
      + " qualquer classe com display deixa elementos escondidos visiveis na tela");
  }
  return falhas;
}

function testeDialogos() {
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const falhas = [];

  const ids = [...html.matchAll(/<dialog[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  if (!ids.length) falhas.push("E7 nao encontrei nenhum <dialog> no index.html");
  /* as CLASSES usadas em <dialog> caem na mesma armadilha: um
   * ".ui-modal{display:flex}" derruba o display:none de TODOS eles de uma
   * vez — estrago maior que o do id, e pelo mesmo motivo. */
  const classes = {};
  [...html.matchAll(/<dialog[^>]*\bclass="([^"]+)"/g)].forEach((m) => {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => { classes[c] = 1; });
  });

  /* comentários fora antes de olhar seletor: um /* ... *​/ grudado no
   * seletor fazia a verificação achar que a regra mirava um descendente,
   * e ela passava batido justamente na regra que eu tinha escrito errado */
  const css = html.replace(/\/\*[\s\S]*?\*\//g, " ");

  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].forEach((m) => {
    const corpo = m[2];
    if (!/(^|[;\s])display\s*:/.test(corpo)) return;
    m[1].split(",").forEach((p0) => {
      const p = p0.trim();
      if (!p) return;
      /* quem manda é o ÚLTIMO pedaço do seletor: é ele que diz qual
       * elemento recebe o display. "#dlgX .filho" mira o filho, tudo bem;
       * "#dlgX" mira o próprio diálogo. */
      const ultimo = p.split(/[\s>+~]+/).filter(Boolean).pop() || "";
      const porId = ultimo.match(/#([A-Za-z][\w-]*)/);
      const porClasse = [...ultimo.matchAll(/\.([A-Za-z][\w-]*)/g)].map((x) => x[1]);
      const miraDialogo = (porId && ids.indexOf(porId[1]) >= 0)
        || porClasse.some((c) => classes[c])
        || /^dialog\b/.test(ultimo);
      if (!miraDialogo) return;
      if (ultimo.indexOf("[open]") >= 0) return;
      /* "display:none" é a regra padrão do próprio navegador: repeti-la não
       * faz mal nenhum. O perigo é dar QUALQUER outro display. */
      if (/display\s*:\s*none/.test(corpo) && !/display\s*:\s*(?!none)/.test(corpo)) return;
      falhas.push("E7 a regra \"" + p + "\" da display a um <dialog> sem exigir [open]"
        + " — ele vai aparecer na tela sempre, e nao havera como fechar");
    });
  });
  return falhas;
}

/* =====================================================================
 * E9 — BOTAO LIGADO A UM ID QUE NAO EXISTE
 *
 * O app liga quase todo clique assim:
 *
 *     if ($("btnFulano")) $("btnFulano").onclick = ...
 *
 * A guarda protege contra o painel que ainda nao foi aberto, mas tem um
 * custo escondido: se o elemento sumir do HTML, NADA acontece e NADA
 * avisa. Foi assim que "virar o trecho marcado em questao" morreu — o
 * codigo do clique continuou inteiro no arquivo, o botao deixou de
 * existir na pagina, e por semanas o unico caminho que sobrou foi gerar
 * questoes do resumo INTEIRO. Nenhum teste falhou, porque do ponto de
 * vista do JS nao houve erro nenhum.
 *
 * Aqui a pergunta e direta: todo id que o app liga a um onclick existe
 * no index.html? Ids montados em tempo de execucao ficam de fora (sao
 * criados pelo proprio codigo), e por isso a busca so olha literais.
 * ===================================================================== */
function testeCliquesOrfaos() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

  fs.readdirSync(path.join(RAIZ, "docs"))
    .filter((f) => f.endsWith(".js") && f !== "sw.js")
    .forEach((arq) => {
      const js = fs.readFileSync(path.join(RAIZ, "docs", arq), "utf8");
      const vistos = new Set();
      /* $("id").onclick = ... e $("id").addEventListener("click" */
      /* as DUAS formas de ligar clique no app: o $("id").onclick direto
       * e o matBotao("id", ...), que embrulha o mesmo gesto com registro
       * de erro. Cobrir so uma delas deixaria metade dos botoes da barra
       * de marcas sem rede nenhuma. */
      const padroes = [
        /\$\("([A-Za-z][\w-]*)"\)\s*\.\s*(?:onclick\s*=|addEventListener\s*\(\s*"click")/g,
        /matBotao\(\s*"([A-Za-z][\w-]*)"/g,
      ];
      padroes.flatMap((re) => [...js.matchAll(re)])
        .forEach((m) => {
          const id = m[1];
          if (ids.has(id) || vistos.has(id)) return;
          vistos.add(id);
          falhas.push(`E9 ${arq} liga um clique em #${id}, que nao existe no `
            + "index.html — o botao nunca vai funcionar e ninguem vai ser avisado");
        });
    });
  return falhas;
}

/* =====================================================================
 * E10 — CONTRASTE DE TEXTO, MEDIDO
 *
 * "O texto está apagado" é opinião até alguém medir. Aqui a régua é a
 * do WCAG: a razão de contraste entre a cor do texto e o fundo em que
 * ele é desenhado. Abaixo de 4,5:1 texto pequeno deixa de ser legível
 * para muita gente — e essa mesma conta pega o caso extremo que já
 * aconteceu duas vezes neste app: cor de texto igual ao fundo, que dá
 * razão 1:1 e some da tela sem ninguém notar no código.
 *
 * As três variações de tema são conferidas separadamente: uma cor que
 * funciona no claro pode desaparecer no preto.
 * ===================================================================== */
const CONTRASTE_MINIMO = 4.5;

function corParaRgb(c) {
  const h = String(c || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (/^[0-9a-f]{6}$/i.test(h)) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = String(c).match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(",").map((x) => Number(x.trim()));
    if (p.length >= 3 && p.every((x) => isFinite(x))) return [p[0], p[1], p[2]];
  }
  return null;
}

function luminancia(rgb) {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contraste(a, b) {
  const ra = corParaRgb(a), rb = corParaRgb(b);
  if (!ra || !rb) return null;
  const la = luminancia(ra), lb = luminancia(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* lê os blocos :root e :root[data-theme=x], com o :root como base */
function temasDoCss(css) {
  const base = {};
  const temas = { claro: {}, dark: {}, black: {} };
  const pegar = (bloco, alvo) => {
    [...bloco.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].forEach((m) => {
      alvo[m[1]] = m[2].trim();
    });
  };
  const mRoot = css.match(/:root\{([^}]*)\}/);
  if (mRoot) pegar(mRoot[1], base);
  [["light", "claro"], ["dark", "dark"], ["black", "black"]].forEach(([id, nome]) => {
    const re = new RegExp(':root\\[data-theme="' + id + '"\\]\\{([^}]*)\\}');
    const m = css.match(re);
    temas[nome] = Object.assign({}, base);
    if (m) pegar(m[1], temas[nome]);
  });
  return temas;
}

function testeContraste() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
  const temas = temasDoCss(css);

  /* ESCREVER: cor de texto sobre os fundos do app. */
  const escrever = [
    ["--texto", "--bg"], ["--texto", "--panel"], ["--texto", "--campo"],
    ["--sutil", "--bg"], ["--sutil", "--panel"],
    ["--verde-txt", "--panel"], ["--azul-txt", "--panel"],
    ["--roxo-txt", "--panel"], ["--ciano-txt", "--panel"],
    ["--laranja-txt", "--panel"], ["--cinza-txt", "--panel"],
    ["--vermelho-txt", "--panel"],
    /* as quatro semânticas: são elas que dizem "deu certo", "atenção",
     * "deu errado" e "é um aviso" na tela inteira */
    ["--ok", "--panel"], ["--atencao", "--panel"],
    ["--erro", "--panel"], ["--info", "--panel"],
    ["--ok", "--bg"], ["--atencao", "--bg"], ["--erro", "--bg"], ["--info", "--bg"],
  ];
  /* ENCHER: rótulo branco em cima da cor de fundo do botão. O mesmo
   * descuido acontece do outro lado — clarear a cor para o texto ficar
   * legível deixaria o rótulo branco ilegível em cima dela. */
  const encher = ["--acao", "--cinza", "--vermelho", "--verde", "--azul"];

  Object.keys(temas).forEach((nome) => {
    const v = temas[nome];
    escrever.forEach(([fg, bg]) => {
      const r = contraste(v[fg], v[bg]);
      if (r === null) return;
      if (r < CONTRASTE_MINIMO) {
        falhas.push(`E10 tema ${nome}: ${fg} (${v[fg]}) sobre ${bg} (${v[bg]}) `
          + `tem contraste ${r.toFixed(2)}:1 — abaixo de ${CONTRASTE_MINIMO}:1, `
          + "o texto fica apagado");
      }
    });
    encher.forEach((cor) => {
      const r = contraste("#ffffff", v[cor]);
      if (r === null) return;
      if (r < CONTRASTE_MINIMO) {
        falhas.push(`E10 tema ${nome}: rotulo branco sobre ${cor} (${v[cor]}) `
          + `tem contraste ${r.toFixed(2)}:1 — o texto do botao fica apagado`);
      }
    });
  });
/* E11 — UM BOTÃO, UM PAPEL.
   * A crítica de usabilidade tinha razão: pílulas, retângulos, cinza,
   * verde, vermelho e roxo, tudo junto, sem regra. Aqui a regra fica
   * escrita: todo fundo de botão sai de um dos tokens de papel
   * (--acao, --cinza, --vermelho) ou de uma variável de tema. Cor fixa
   * dentro de regra de botão é como as cinco cores nasceram. */
  [...css.matchAll(/([^{}]*\.btn[^{}]*)\{([^}]*)\}/g)].forEach(([, sel, corpo]) => {
    const m = corpo.match(/background\s*:\s*(#[0-9a-fA-F]{3,6})/);
    if (m) {
      falhas.push(`E11 "${sel.trim().slice(0, 44)}" pinta o botao com a cor fixa `
        + `${m[1]} — use --acao (primario), --cinza (secundario) ou `
        + "--vermelho (destrutivo)");
    }
  });

  /* LITERAL QUE FALHA EM TODO TEMA.
   * Cor escrita direto na regra (em vez de token) não segue o tema —
   * e quando ela é ilegível nos três, não há discussão de gosto: é
   * defeito. Regras com fundo próprio ficam de fora, porque aí o par
   * cor/fundo é outro. */
  const fundos = ["claro", "dark", "black"].map((k) => temas[k]["--panel"]);
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].forEach(([, sel, corpo]) => {
    if (/background/.test(corpo)) return;
    if (/data-theme/.test(sel)) return;
    const m = corpo.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6})/);
    if (!m) return;
    const piores = fundos.map((f) => contraste(m[1], f)).filter((x) => x !== null);
    if (piores.length && piores.every((r) => r < CONTRASTE_MINIMO)) {
      falhas.push(`E10 "${sel.trim().slice(0, 40)}" usa a cor literal ${m[1]}, `
        + "que fica abaixo de 4,5:1 nos TRES temas — use um token semantico "
        + "(--ok, --atencao, --erro, --info) em vez de cor fixa");
    }
  });
  return falhas;
}

module.exports = { testes: () => [...testes(), ...testeSW(), ...testeDialogos(),
                                  ...testeHidden(), ...testeCliquesOrfaos(),
                                  ...testeContraste()] };

if (require.main === module) {
  /* rodar SÓ testes() aqui deixava testeSW() e testeDialogos() fora do
   * comando avulso: eu sabotava a regra do <dialog>, rodava este arquivo,
   * via "tudo certo" e concluía que o teste era fraco — quando na verdade
   * ele nem tinha sido chamado. */
  const falhas = module.exports.testes();
  falhas.forEach((f) => console.log("  FALHA  " + f));
  console.log(falhas.length
    ? `\nestrutura: ${falhas.length} FALHA(S)\n`
    : "\nestrutura: HTML balanceado, painéis no lugar\n");
  process.exit(falhas.length ? 1 : 0);
}
