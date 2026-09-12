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

/* E12 — TODO data-i18n TEM DE EXISTIR NO DICIONÁRIO.
 *
 * t() devolve a PRÓPRIA CHAVE quando não encontra a tradução. Isso é
 * bom para não quebrar a tela, e péssimo para descobrir o erro: o botão
 * simplesmente aparece escrito "lei_proc_btn" e continua clicável, sem
 * nenhum aviso em lugar nenhum.
 *
 * Foi exatamente o que aconteceu: um botão chegou à tela do usuário
 * exibindo o nome interno da chave. Nenhum teste podia pegar, porque
 * nenhum teste olhava para isto. Agora olha.
 */
/* E14 — children NÃO É ARRAY.
 *
 * element.children devolve uma HTMLCollection: tem length e índice, e
 * nenhum dos métodos de Array. "(el.children || []).forEach(...)" parece
 * defensivo — o "|| []" sugere que alguém pensou no caso vazio — e
 * quebra em toda execução no navegador, porque a coleção existe e
 * simplesmente não tem forEach.
 *
 * Dois defeitos assim chegaram ao uso real (o menu de três pontos do
 * material e a barra do rascunho ao trocar para o teclado), vistos no
 * registro de erros do navegador e por nenhum teste: o simulador
 * entregava um Array de verdade. O simulador foi corrigido para não ter
 * esses métodos; esta regra é o segundo cadeado.
 *
 * A saída é Array.from(el.children), que funciona nos dois. */
function testeColecoes() {
  const falhas = [];
  fs.readdirSync(path.join(RAIZ, "docs"))
    .filter((f) => f.endsWith(".js"))
    .forEach((arq) => {
      const js = fs.readFileSync(path.join(RAIZ, "docs", arq), "utf8");
      [...js.matchAll(/([\w.]+)\.children\s*(?:\|\|\s*\[\])?\s*\)?\s*\.(forEach|map|filter|reduce|some|every|find)\b/g)]
        .forEach((m) => {
          /* Array.from(...) na frente resolve, e e a forma recomendada */
          const antes = js.slice(Math.max(0, m.index - 12), m.index);
          if (/Array\.from\($/.test(antes)) return;
          falhas.push(`E14 ${arq}: "${m[0].slice(0, 40)}" — children e uma `
            + "HTMLCollection e nao tem esse metodo; quebra no navegador. "
            + "Use Array.from(el.children)");
        });
    });
  return falhas;
}

/* E15 — UM NOME, UM SIGNIFICADO.
 *
 * Uma classe que o JS liga e desliga é um ESTADO; uma classe escrita no
 * HTML é o que o elemento É. Quando o mesmo nome faz as duas coisas, a
 * regra base — que casa por classe simples — passa a valer também para
 * quem só recebeu o estado.
 *
 * Foi assim que recolher a faixa de navegação a transformava numa
 * caixinha de 20 pixels: "modos-min" era a classe do botão de recolher
 * (com "all:unset" e 20x20) e, ao mesmo tempo, o estado que o JS punha
 * no contêiner. O contêiner herdava o tamanho do botão.
 *
 * O par perigoso: a classe é estática no HTML, é ligada/desligada por JS
 * e a sua regra base define GEOMETRIA — "all:", "display:", "width:" ou
 * "height:".
 *
 * A geometria é o corte, e não é arbitrário. "btn-min-ok" e
 * "btn-min-perigo" também são estáticos e alternados, e são inofensivos:
 * pintam cor de texto e de borda, e cor errada num elemento errado é
 * feio, não quebrado. Já "all:unset" com 20x20 aplicado a um contêiner
 * apaga o layout dele inteiro — foi o que encolheu a faixa de navegação
 * para uma caixinha. Modificador de cor pode ser compartilhado; forma,
 * não. */
function testeClassesAmbiguas() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";

  /* as classes que o JS liga/desliga */
  const alternadas = new Set();
  fs.readdirSync(path.join(RAIZ, "docs"))
    .filter((f) => f.endsWith(".js"))
    .forEach((arq) => {
      const js = fs.readFileSync(path.join(RAIZ, "docs", arq), "utf8");
      [...js.matchAll(/classList\s*\.\s*(?:toggle|add)\s*\(\s*"([\w-]+)"/g)]
        .forEach((m) => alternadas.add(m[1]));
    });

  /* as classes escritas à mão no HTML */
  const estaticas = new Set();
  [...html.matchAll(/class="([^"]+)"/g)].forEach((m) => {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => estaticas.add(c));
  });

  /* as que têm regra própria de classe simples (".x{" ou ".x:hover{") */
  const comRegraBase = new Set();
  [...css.matchAll(/(^|[,}\s])\.([\w-]+)\s*(?::[\w-()]+)?\s*\{/g)]
    .forEach((m) => comRegraBase.add(m[2]));

  /* a regra base de cada classe, para saber se ela define forma */
  const corpoDe = {};
  [...css.matchAll(/(^|[,}\s])\.([\w-]+)\s*\{([^}]*)\}/g)].forEach((m) => {
    corpoDe[m[2]] = (corpoDe[m[2]] || "") + m[3];
  });
  const mexeNaForma = (c) =>
    /(^|;|\s)(all|display|width|height|position)\s*:/.test(corpoDe[c] || "");

  alternadas.forEach((c) => {
    if (!estaticas.has(c) || !comRegraBase.has(c)) return;
    if (!mexeNaForma(c)) return;
    falhas.push(`E15 a classe "${c}" e' estado (o JS liga e desliga) E `
      + "identidade (esta escrita num class= do HTML), e a regra base dela "
      + "define FORMA (all/display/width/height/position). Quem so recebe "
      + "o estado herda a geometria de quem tem a classe de origem. "
      + "Da' um nome proprio ao estado");
  });
  return falhas;
}

/* E16 — A VERSÃO É UM NÚMERO SÓ, ESCRITO EM TRÊS LUGARES.
 *
 * Ela vive em três constantes que precisam concordar:
 *   · VERSAO (app.js)      — o que a tela mostra e o que vai no backup;
 *   · CACHE (sw.js)        — o nome do cache; se não mudar, o navegador
 *     serve os arquivos VELHOS de uma versão nova;
 *   · SW_VERSION (sw.js)   — o que o worker responde quando a página
 *     pergunta se a atualização é real.
 *
 * As três já divergiram das três maneiras possíveis. A v14.2 e a v14.3
 * subiram com o CACHE trocado e a VERSAO parada em 14.1.0: os arquivos
 * novos chegavam, e o cabeçalho continuava anunciando a versão anterior
 * — o pior tipo de defeito, porque faz duvidar de um deploy que deu
 * certo, e não há como distinguir isso de um deploy que falhou.
 *
 * E SW_VERSION corria numa numeração própria (9.11.0 contra 14.1.0),
 * o que quebrava em silêncio a única decisão que ele toma: a página
 * compara a versão do worker em espera com a VERSAO para saber se avisa
 * ou se ativa calado. Com duas escalas, "diferente" era sempre verdade
 * e o ramo do silêncio nunca rodava.
 *
 * Um número em três lugares só se mantém igual se alguma coisa cobrar.
 * É esta função. */
/* E17 — LARGURA DE TABELA SE PERGUNTA AO CONTÊINER, NÃO À JANELA.
 *
 * O Raio-X abria numa caixa de no máximo 1080 px. As regras que
 * escondiam colunas perguntavam "@media (max-width:760px)" — largura da
 * JANELA —, então num monitor de 1400 px a consulta dizia "tela larga",
 * as nove colunas ficavam todas na tela e a tabela transbordava numa
 * barra de rolagem horizontal. A pessoa pedia tela cheia justamente
 * para não ter essa barra, e ela continuava lá: a janela sempre foi
 * larga; quem estava apertado era o modal.
 *
 * O erro é fácil de repetir, porque "@media" é o reflexo de quem
 * escreve CSS. Este invariante exige que toda regra de tabela que
 * dependa de largura pergunte ao contêiner — ou esteja declarada como
 * reserva explícita, dentro de "@supports not (container-type…)", para
 * navegador que não conheça a consulta.
 *
 * PARA TIRAR ESTE INVARIANTE seria preciso um motivo: a tabela passar a
 * ocupar a janela inteira, e não uma caixa dentro dela. */
function testeLarguraDeCaixa() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");

  /* acha cada bloco "@media (...max-width...){ ... }" de primeiro nível
   * e olha se ele mexe em tabela sem estar dentro de um @supports */
  const re = /@supports\s+not\s*\(container-type[^)]*\)\s*\{|@media[^{]*max-width[^{]*\{/g;
  let m;
  let dentroDeSupports = -1;
  while ((m = re.exec(html)) !== null) {
    const abre = m.index + m[0].length;
    /* onde este bloco fecha: conta chaves a partir da abertura */
    let nivel = 1, i = abre;
    while (i < html.length && nivel > 0) {
      if (html[i] === "{") nivel++;
      else if (html[i] === "}") nivel--;
      i++;
    }
    if (/^@supports/.test(m[0])) { dentroDeSupports = i; continue; }
    if (m.index < dentroDeSupports) continue;   /* é a reserva declarada */
    const corpo = html.slice(abre, i);
    const alvos = (corpo.match(/\.plog-tab\b|\.plog-col-top\b|\.plog-so-largo\b/g) || []);
    if (alvos.length) {
      falhas.push("E17 ha regra de tabela do Raio-X dentro de um "
        + "@media de largura de JANELA (" + alvos.length + " seletor(es)). "
        + "O que fica apertado e' a CAIXA, nao a janela: numa tela larga a "
        + "consulta diz 'cabe', as nove colunas aparecem e a tabela "
        + "transborda. Use @container, ou declare a reserva dentro de "
        + "@supports not (container-type:inline-size).");
    }
  }

  /* e a consulta de contêiner tem de existir de fato */
  if (!/@container\s+plogcx/.test(html)) {
    falhas.push("E17b nao ha nenhuma consulta @container para a tabela do "
      + "Raio-X: sem ela as colunas nunca somem quando a caixa aperta.");
  }
  /* PROCURA O NOME, e não "container-type": a própria linha do
   * "@supports not (container-type:inline-size)" contém esse texto, e
   * por causa dela a verificação passava mesmo com o contêiner
   * removido — dava certo pela existência da sua própria reserva. */
  if (!/container-name\s*:\s*plogcx/.test(html)) {
    falhas.push("E17c o corpo do Raio-X nao foi declarado como conteiner "
      + "(container-type:inline-size), entao a consulta @container nunca "
      + "encontra a caixa e simplesmente nao vale.");
  }
  return falhas;
}

/* E18 — ESPECIFICIDADE: LARGURA DE MODAL SE ESCREVE "dialog.X".
 *
 * A regra geral do aplicativo é "dialog.ui-modal{max-width:440px;
 * width:calc(100% - 36px)}". Ela é ELEMENTO + CLASSE — especificidade
 * (0,1,1) — e por isso vence qualquer regra de classe sozinha (0,1,0),
 * esteja onde estiver no arquivo. Especificidade não se resolve por
 * ordem: escrever depois não adianta.
 *
 * O ESTRAGO REAL: ".plog-modal{max-width:1080px}" nunca valeu, e o
 * Raio-X sempre coube em 440 px. ".plog-cheia{width:100vw}" nunca
 * valeu, e a tela cheia parecia só esticar para baixo — o usuário
 * relatou isso três vezes, e duas correções minhas foram no lugar
 * errado (consulta de contêiner, tamanho inline do "resize") porque eu
 * testava o pedaço alterado em vez da cascata inteira.
 * ".diag-modal{max-width:860px}" também nunca valeu, e TODOS os
 * diálogos de diagnóstico vinham espremidos.
 *
 * O defeito é silencioso: a regra está escrita, parece certa, e
 * simplesmente não vale. Só um invariante o pega.
 *
 * PARA TIRAR ESTE INVARIANTE seria preciso que "dialog.ui-modal"
 * deixasse de definir largura. */
function testeEspecificidadeDeModal() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";

  /* o que a regra geral fixa e que, por isso, uma classe sozinha nao
   * consegue mudar */
  const geral = (css.match(/dialog\.ui-modal\s*\{([^}]*)\}/) || [])[1] || "";
  const presas = ["width", "max-width"].filter((k) =>
    new RegExp("(^|;)\\s*" + k + "\\s*:").test(geral));
  if (!presas.length) return falhas;   /* a regra geral mudou: nada a exigir */

  /* candidatas: classes que aparecem num <dialog> do HTML, mais as que
   * o JS liga e desliga (a de tela cheia nao esta escrita no HTML) */
  const nomes = new Set();
  [...html.matchAll(/<dialog[^>]*class="([^"]+)"/g)].forEach((m) => {
    m[1].split(/\s+/).forEach((c) => { if (c) nomes.add(c); });
  });
  fs.readdirSync(path.join(RAIZ, "docs")).filter((f) => f.endsWith(".js"))
    .forEach((f) => {
      const js = fs.readFileSync(path.join(RAIZ, "docs", f), "utf8");
      [...js.matchAll(/classList\.(?:add|remove|toggle)\(\s*"([^"]+)"/g)]
        .forEach((m) => nomes.add(m[1]));
    });

  nomes.forEach((c) => {
    if (c === "ui-modal") return;
    /* a regra escrita SEM o prefixo de elemento */
    const re = new RegExp("(^|\\})\\s*\\." + c.replace(/[-]/g, "\\-")
      + "(?:\\[[^\\]]*\\])?\\s*\\{([^}]*)\\}", "m");
    const m = css.match(re);
    if (!m) return;
    const corpo = m[2] || "";
    const conflita = presas.filter((k) =>
      new RegExp("(^|;)\\s*" + k + "\\s*:").test(corpo));
    if (conflita.length) {
      falhas.push('E18 a regra ".' + c + '" define ' + conflita.join(" e ")
        + ' mas perde para "dialog.ui-modal", que e elemento+classe e '
        + "vence classe sozinha em qualquer posicao do arquivo. A regra "
        + "esta escrita, parece certa e nao vale nada. Escreva "
        + '"dialog.' + c + '" (como "dialog.mat-amplo" ja faz).');
    }
  });
  return falhas;
}

/* E19 — COLEÇÃO DO NAVEGADOR NÃO É ARRAY.
 *
 * "element.children" devolve uma HTMLCollection; "querySelectorAll"
 * devolve uma NodeList. Nenhuma das duas é um Array: a primeira não tem
 * forEach nem map; a segunda tem forEach mas não tem map, filter, find
 * nem reduce. Escrever "(el.children || []).forEach(...)" parece
 * defensivo e não é — o "|| []" só age quando children NÃO existe, que
 * é justamente o caso em que não havia problema.
 *
 * ISTO JÁ QUEBROU EM PRODUÇÃO, três vezes, e o registro do usuário
 * mostra as três:
 *   material.js:1964  (el.children || []).forEach is not a function
 *   rascunho.js:278   (g.children || []).forEach is not a function
 *   rascunho.js:319   (g.children || []).forEach is not a function
 *
 * E A SUÍTE NÃO TEM COMO PEGAR: no simulador, "children" é um array de
 * verdade, com forEach e map. O simulador é mais generoso que o
 * navegador — o mesmo motivo que já escondeu o nó de texto oco, o
 * "childNodes" ausente e o "innerWidth" que não existia. Onde o teste
 * não alcança, o invariante alcança: este lê o código-fonte.
 *
 * PARA TIRAR ESTE INVARIANTE seria preciso que as coleções do DOM
 * passassem a ser arrays — o que não vai acontecer. */
function testeColecaoNaoEArray() {
  const falhas = [];
  const METODOS = "forEach|map|filter|find|findIndex|some|every|reduce|"
    + "reduceRight|sort|slice|includes|indexOf|flatMap|join|concat|at|reverse";
  /* NodeList TEM forEach; HTMLCollection não tem nada. Por isso as duas
   * listas: o que vale para uma não vale para a outra. */
  const COLECOES = [
    { nome: "children", re: /\.children\b/g, temForEach: false },
    { nome: "childNodes", re: /\.childNodes\b/g, temForEach: true },
    { nome: "querySelectorAll", re: /\.querySelectorAll\s*\([^)]*\)/g, temForEach: true },
    { nome: "getElementsByClassName", re: /\.getElementsByClassName\s*\([^)]*\)/g, temForEach: false },
    { nome: "getElementsByTagName", re: /\.getElementsByTagName\s*\([^)]*\)/g, temForEach: false },
  ];

  fs.readdirSync(path.join(RAIZ, "docs")).filter((f) => f.endsWith(".js"))
    .forEach((arq) => {
      const js = fs.readFileSync(path.join(RAIZ, "docs", arq), "utf8");
      const linhaDe = (i) => js.slice(0, i).split("\n").length;
      COLECOES.forEach((c) => {
        c.re.lastIndex = 0;
        let m;
        while ((m = c.re.exec(js)) !== null) {
          /* o que vem DEPOIS: pula um "|| []" e parênteses de fecho, que
           * são justamente a forma que engana */
          const depois = js.slice(m.index + m[0].length, m.index + m[0].length + 40);
          const chamada = depois.match(
            new RegExp("^\\s*(?:\\|\\|\\s*\\[\\s*\\]\\s*)?\\)*\\s*\\.\\s*(" + METODOS + ")\\s*\\("));
          if (!chamada) continue;
          const metodo = chamada[1];
          if (c.temForEach && metodo === "forEach") continue;

          /* JÁ ESTAVA ENVOLVIDO?
           *
           * O envoltório não encosta no ".children": entre eles há a
           * expressão que produz o elemento — "Array.from(g.children)",
           * "[...(el && el.children)]". A primeira versão desta
           * verificação exigia "Array.from(" colado, e por isso acusou
           * cinco linhas que já estavam certas. Aqui ela aceita
           * qualquer expressão no meio, desde que não tenha vírgula
           * (que indicaria outro argumento) nem fechar o parêntese. */
          const antes = js.slice(Math.max(0, m.index - 80), m.index);
          const dentroDe = (abre) =>
            new RegExp(abre + "[^,;()\\[\\]]*$").test(antes);
          if (dentroDe("Array\\.from\\s*\\(")) continue;
          if (dentroDe("\\[\\s*\\.\\.\\.")) continue;
          if (dentroDe("\\[\\s*\\]\\s*\\.\\s*\\w+\\s*\\.\\s*call\\s*\\(")) continue;

          falhas.push("E19 " + arq + ":" + linhaDe(m.index) + " chama ."
            + metodo + "() direto em ." + c.nome + ", que devolve uma "
            + "colecao do DOM e NAO um array — quebra no navegador com "
            + "'is not a function'. O simulador dos testes usa array de "
            + "verdade e nao pega isto. Envolva: Array.from(...)."
            + metodo + "() ou [...].");
        }
      });
    });
  return falhas;
}

/* E20 — O GRIFO NÃO PODE SER DESENHADO TRANSPARENTE.
 *
 * TRÊS VEZES o mesmo defeito neste projeto, e nas três nenhum teste de
 * comportamento podia ver, porque o simulador não tem folha de estilo:
 *
 *  · "dialog.ui-modal{max-width:440px}" vencia ".plog-cheia{100vw}" e o
 *    painel nunca abria em tela cheia;
 *  · ".qs-cor{all:unset}" vencia ".gr-am{background:...}" e as bolinhas
 *    de cor apareciam vazias;
 *  · ".gr-cx mark.gr-m{background:transparent}" vencia ".gr-am" e o
 *    GRIFO SAÍA INVISÍVEL — o texto era envolvido, a marca era criada,
 *    tudo funcionava, e não se via nada. Foi relatado três vezes.
 *
 * TENTEI GENERALIZAR e não deu: a verificação genérica — "a classe que
 * modifica tem de vencer a que ela modifica" — acusou 120 regras, quase
 * todas com razão de sobra do outro lado (":hover" DEVE ser mais
 * específico; ".pai .filho" descreve outro contexto). Uma suíte que
 * grita à toa é uma suíte que se aprende a ignorar, e aí ela deixa
 * passar justamente o caso real. Fazer aquilo direito pede um
 * analisador de CSS de verdade, com atalhos, "!important" e herança.
 *
 * Então esta verificação é ESTREITA de propósito: cobre o arquivo que
 * quebrou três vezes, com zero alarme falso. Não é elegante; é honesta
 * sobre o que consegue garantir.
 */
/* =====================================================================
 * E21: DOIS ELEMENTOS COM O MESMO id
 *
 * O app inteiro se liga à tela por getElementById. Com o id repetido, o
 * navegador devolve SEMPRE o primeiro: o segundo botão existe, é
 * clicável, e não faz nada — sem erro no console, sem nada no registro.
 * É o defeito mais barato de criar (copiar um bloco de HTML e mudar só
 * o texto) e um dos mais caros de achar, porque o sintoma é "esse botão
 * não funciona", que é o que se diz de qualquer coisa quebrada.
 *
 * A varredura é do HTML cru e não do DOM: um id duplicado precisa ser
 * pego ANTES de alguém abrir a tela onde ele está.
 * ===================================================================== */
function testeIdsUnicos() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  /* fora dos comentários: um bloco comentado com um id dentro é código
   * que não existe, e acusá-lo mandaria procurar um defeito que não há */
  const limpo = html.replace(/<!--[\s\S]*?-->/g, " ");
  const vistos = new Map();
  const re = /\sid="([^"]+)"/g;
  let m;
  while ((m = re.exec(limpo)) !== null) {
    const id = m[1];
    vistos.set(id, (vistos.get(id) || 0) + 1);
  }
  const repetidos = [...vistos.entries()].filter(([, n]) => n > 1);
  if (repetidos.length) {
    falhas.push("E21 id repetido no HTML — getElementById devolve so o "
      + "PRIMEIRO, e o segundo elemento fica clicavel e mudo, sem erro "
      + "nenhum: "
      + repetidos.map(([id, n]) => id + " (" + n + "x)").join(", "));
  }
  return falhas;
}

/* =====================================================================
 * E22: BOTÃO LIGADO COM A AÇÃO NO LUGAR DO NOME
 *
 * O DEFEITO REAL, achado no registro do usuário: sete botões do leitor
 * de lei — todos os "fechar" — estavam ligados com dois argumentos numa
 * função de três. A arrow caiu no lugar do NOME, a ação ficou
 * undefined, e o clique produzia "Cannot read properties of undefined
 * (reading 'apply')".
 *
 * POR QUE ISTO PRECISA DE INVARIANTE E NÃO SÓ DE CONSERTO. O sintoma
 * era invisível de três formas ao mesmo tempo: o botão existia e
 * respondia ao toque; nenhum teste de tela reclamava, porque nenhum
 * teste clica em "fechar"; e a mensagem de erro imprimia o CÓDIGO no
 * lugar do nome — "falha em () => $(\"dlgLeiProc\").close()" — mandando
 * quem lê procurar um defeito dentro do close(), que está perfeito.
 *
 * A varredura é do TEXTO do arquivo, e não do comportamento: o erro
 * mora na ordem dos argumentos e aparece antes de qualquer clique.
 * ===================================================================== */
function testeBotaoComNome() {
  const falhas = [];
  const ARQS = { "lei-ui.js": ["leiBotao", "liga"], "material.js": ["matBotao"] };
  Object.keys(ARQS).forEach((arq) => {
    let src = "";
    try { src = fs.readFileSync(path.join(RAIZ, "docs", arq), "utf8"); }
    catch (e) { return; }
    /* fora dos comentários: o comentário desta própria correção mostra a
     * chamada errada como exemplo, e acusá-lo mandaria consertar um texto */
    const limpo = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    ARQS[arq].forEach((fn) => {
      /* segundo argumento começando com "(" ou "function" ou "=>":
       * é a ação ocupando a vaga do nome */
      const aspa = '["\']';
      const re = new RegExp("\\b" + fn + "\\s*\\(\\s*" + aspa
        + "[^\"']+" + aspa + "\\s*,\\s*(\\(|function\\b|async\\b)", "g");
      const achados = limpo.match(re) || [];
      achados.forEach((a) => {
        falhas.push("E22 " + arq + ": " + a.replace(/\s+/g, " ").trim()
          + "... — a acao esta no lugar do NOME. O botao fica MUDO (a "
          + "acao vira undefined), o clique estoura em '.apply', e o log "
          + "imprime o codigo no lugar do nome");
      });
    });
  });
  return falhas;
}

/* =====================================================================
 * E23: CLASSE DE ESTADO QUE NÃO PINTA NADA
 *
 * O DEFEITO REAL: os botões de dificuldade recebiam a classe "ativa" ao
 * serem tocados e continuavam idênticos na tela. Havia estilo para
 * ".reg-humor.ativa.humor-ruim" e para as outras duas do humor, e
 * NENHUM para ".reg-humor.ativa" sozinho — os de dificuldade usam
 * "dif-alta/dif-media/dif-baixa" e caíam no vazio.
 *
 * POR QUE ISTO É PIOR QUE UM BOTÃO QUEBRADO: o clique funcionava. O
 * estado mudava, a repintura acontecia, o valor ia para o registro. Só
 * que a tela não dizia nada — e quem toca num botão que não reage toca
 * de novo. Tocar no aceso DESMARCA, então a segunda tentativa apagava a
 * avaliação que a primeira tinha feito. O usuário relatou "não estão
 * funcionando"; do lado de dentro, funcionavam duas vezes.
 *
 * É a quarta vez que esta família aparece — o grifo sem cor, o balão
 * atrás do modal, a tela cheia que não expandia — e todas com a mesma
 * assinatura: o JS faz a coisa certa e o CSS não acompanha.
 *
 * A INVARIANTE É ESTREITA DE PROPÓSITO. Uma regra geral do tipo "toda
 * classe usada pelo JS precisa de CSS" já foi tentada aqui (E20) e
 * produziu 120 falsos positivos, e suíte barulhenta é suíte ignorada.
 * Esta pergunta uma coisa só: as famílias de botão que ligam e desligam
 * têm um estilo de "ativa" que vale para QUALQUER variante?
 * ===================================================================== */
function testeAtivaPinta() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  /* as famílias em que o JS pendura "ativa" para dizer o que está
   * escolhido; o valor é o seletor genérico que precisa existir */
  ["reg-humor", "mat-tipo"].forEach((fam) => {
    const generico = new RegExp("\\." + fam + "\\.ativa\\s*\\{[^}]*\\}");
    if (!generico.test(limpo)) {
      falhas.push("E23 nao ha estilo para \"." + fam + ".ativa\" sozinho — "
        + "so para variantes. Uma variante nova recebe a classe, o clique "
        + "funciona, o estado muda e a tela fica IGUAL; quem toca num "
        + "botao que nao reage toca de novo, e o segundo toque desmarca");
    }
  });
  return falhas;
}

function testeGrifoVisivel() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, " ");

  /* a regra base da marca, que zera o amarelo do navegador */
  const base = limpo.match(/(\.gr-cx\s+mark\.gr-m)\s*\{([^}]*)\}/);
  if (!base) {
    falhas.push("E20 nao achei a regra base do grifo (.gr-cx mark.gr-m); "
      + "se ela mudou de nome, esta verificacao precisa acompanhar.");
    return falhas;
  }
  if (!/background/.test(base[2])) return falhas;   /* nao zera nada */

  /* então CADA cor precisa de uma regra pelo menos tão específica */
  ["gr-am", "gr-vd", "gr-rs", "gr-az"].forEach((cor) => {
    const re = new RegExp("\\.gr-cx\\s+mark\\.gr-m\\." + cor
      + "\\s*\\{[^}]*background", "");
    if (!re.test(limpo)) {
      falhas.push('E20 a cor "' + cor + '" do grifo so tem regra de uma '
        + 'classe, e a base ".gr-cx mark.gr-m" define "background" com '
        + "especificidade maior — o grifo vai ser desenhado "
        + "TRANSPARENTE e ninguem vai ver marca nenhuma. Escreva "
        + '".gr-cx mark.gr-m.' + cor + '".');
    }
  });
  return falhas;
}

function testeVersaoUnica() {
  const falhas = [];
  const app = fs.readFileSync(path.join(RAIZ, "docs", "app.js"), "utf8");
  const sw = fs.readFileSync(path.join(RAIZ, "docs", "sw.js"), "utf8");

  const versao = (app.match(/const\s+VERSAO\s*=\s*"([^"]+)"/) || [])[1];
  const cache = (sw.match(/const\s+CACHE\s*=\s*"easyankicards-v([^"]+)"/) || [])[1];
  const swv = (sw.match(/const\s+SW_VERSION\s*=\s*"([^"]+)"/) || [])[1];

  if (!versao) falhas.push("E16 nao achei VERSAO em app.js");
  if (!cache) falhas.push("E16 nao achei CACHE em sw.js (ou mudou de formato)");
  if (!swv) falhas.push("E16 nao achei SW_VERSION em sw.js");
  if (!versao || !cache || !swv) return falhas;

  if (cache !== versao) {
    falhas.push(`E16 a tela diz v${versao} e o cache do service worker diz `
      + `v${cache}. Se o CACHE ficar para tras, o navegador serve os `
      + "arquivos VELHOS; se a VERSAO ficar para tras, a tela anuncia a "
      + "versao anterior e nao ha como saber se o deploy funcionou");
  }
  if (swv !== versao) {
    falhas.push(`E16 SW_VERSION (${swv}) e VERSAO (${versao}) precisam ser `
      + "o mesmo numero: a pagina compara os dois para decidir se avisa "
      + "que ha atualizacao. Em escalas diferentes, 'diferente' e sempre "
      + "verdade e o aviso aparece todas as vezes");
  }
  return falhas;
}

function testeI18n() {
  const falhas = [];
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(RAIZ, "docs", "i18n.js"), "utf8");

  /* o dicionário PT é o primeiro bloco; basta saber quais chaves existem
   * nele, e para isso a lista de "chave":" no arquivo já serve */
  const fim = js.indexOf('\n "en": {');
  const pt = fim > 0 ? js.slice(0, fim) : js;
  const existe = new Set(
    [...pt.matchAll(/^\s{2}"([\w.-]+)"\s*:/gm)].map((m) => m[1]));

  const usadas = [...html.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)]
    .map((m) => m[1]);
  const faltando = [...new Set(usadas)].filter((k) => !existe.has(k));
  if (faltando.length) {
    falhas.push("E12 data-i18n aponta para chave que nao existe no "
      + "dicionario (o botao vai aparecer escrito com o nome da chave): "
      + faltando.join(", "));
  }
  return falhas;
}

/* E13 — NENHUMA CHAVE REPETIDA NO DICIONÁRIO.
 *
 * Um objeto JS não reclama de chave repetida: a última vence, calada. E
 * como o dicionário tem milhares de linhas e cresce por acréscimo no
 * meio, escrever uma chave que já existia quatrocentas linhas abaixo é
 * fácil demais — o texto novo simplesmente não aparece, e o antigo passa
 * a aparecer em um lugar onde não faz sentido.
 *
 * Aconteceu com "qs_dica_tit": eu criei o título de uma dobra com esse
 * nome, e já existia um "Sua dica para: {e}" mais adiante. O rótulo da
 * dobra ia sair escrito "Sua dica para: " com o {e} vazio, e nada
 * quebraria para avisar. */
function testeI18nRepetidas() {
  const falhas = [];
  const js = fs.readFileSync(path.join(RAIZ, "docs", "i18n.js"), "utf8");
  /* SÃO QUATRO BLOCOS, não dois: UI tem pt e en, e PARSER_MSG também. Um
   * corte só no primeiro "en" juntaria dicionários diferentes e apontaria
   * repetição onde não há — foi o primeiro jeito que tentei, e ele
   * acusava mil chaves. */
  const linhas = js.split("\n");
  const blocos = [];
  let atual = null;
  linhas.forEach((l, i) => {
    const m = l.match(/^\s*"(pt|en)"\s*:\s*\{\s*$/);
    if (m) { atual = { nome: m[1] + "@" + (i + 1), chaves: {}, repetidas: [] };
             blocos.push(atual); return; }
    if (!atual) return;
    const k = l.match(/^\s{2}"([\w.-]+)"\s*:/);
    if (!k) return;
    if (atual.chaves[k[1]] && atual.repetidas.indexOf(k[1]) < 0) {
      atual.repetidas.push(k[1]);
    }
    atual.chaves[k[1]] = 1;
  });
  blocos.forEach((b) => {
    if (b.repetidas.length) {
      falhas.push("E13 chave repetida no dicionario " + b.nome
        + " (a ultima vence, em silencio, e o texto novo nao aparece): "
        + b.repetidas.join(", "));
    }
  });
  return falhas;
}

module.exports = { testes: () => [...testes(), ...testeSW(), ...testeDialogos(),
                                  ...testeHidden(), ...testeCliquesOrfaos(),
                                  ...testeContraste(), ...testeI18n(),
                                  ...testeI18nRepetidas(),
                                  ...testeColecoes(),
                                  ...testeClassesAmbiguas(),
                                  ...testeVersaoUnica(),
                                  ...testeLarguraDeCaixa(),
                                  ...testeEspecificidadeDeModal(),
                                  ...testeColecaoNaoEArray(),
                                  ...testeGrifoVisivel(),
                                  ...testeIdsUnicos(),
                                  ...testeBotaoComNome(),
                                  ...testeAtivaPinta()] };

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
