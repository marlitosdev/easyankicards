/* =====================================================================
 * O MENU ⋮ DA QUESTÃO NÃO PODE SER CORTADO PELA CAIXA
 *
 * POR QUE ISTO EXISTE. É a terceira vez que o mesmo defeito aparece com
 * outra roupa, e as três têm a mesma raiz: um elemento flutuante
 * desenhado DENTRO de uma caixa que o recorta ou o sobrepõe.
 *
 *   1. O balão do (?) da jurisprudência, atrás do <dialog>: um dialog
 *      aberto por showModal() vive no top layer, e nenhum z-index de um
 *      elemento pendurado no <body> o alcança.
 *   2. A tela cheia do raio-X, que não expandia: dialog.ui-modal
 *      (0,1,1) ganhava de .plog-cheia (0,1,0).
 *   3. Este: o menu era "position:absolute" pendurado num botão que
 *      mora dentro de #qsSessCorpo, que recorta.
 *
 * A LIÇÃO QUE ESTE ARQUIVO GUARDA: z-index não tira ninguém de dentro
 * de um recorte. Quem recorta é o ANCESTRAL, e "overflow:visible" no
 * filho não muda nada — overflow fala do conteúdo do próprio elemento,
 * não do lugar dele no pai. Ou o flutuante sai da subárvore recortada
 * (pendurado no <dialog>, como o balão), ou deixa de ser medido contra
 * ela (position:fixed, como aqui).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const HTML = fs.readFileSync(
  path.join(__dirname, "..", "docs", "index.html"), "utf8");

function cssRegra(sel) {
  const i = HTML.indexOf("\n" + sel + "{");
  if (i < 0) return "";
  return HTML.slice(i + 1, HTML.indexOf("}", i) + 1);
}

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* Monta a barra de ferramentas de uma questão e devolve as peças. */
  const barraDe = (api) => {
    const q = { id: "q1", enunciado: "enunciado qualquer", tipo: "ce",
                gabarito: "C", disciplina: "D", topico: "T" };
    const barra = api.qsUiFerramentas(q);
    const todos = [];
    const varrer = (el) => {
      Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
    };
    varrer(barra);
    const menu = todos.filter((x) => /qs-fer-menu/.test(x.className || ""))[0];
    const bm = todos.filter((x) => x.textContent === "⋮")[0];
    return { barra, menu, bm };
  };

  /* ==============================================================
   * M1: O RECORTE DA CAIXA — a causa de verdade
   *
   * #qsSessCorpo recorta (era overflow-y:auto, virou overflow:hidden
   * quando as duas zonas de rolagem desceram para os filhos). Um
   * "position:absolute" pendurado num botão de dentro dela é cortado na
   * borda, e nenhum z-index resolve isso.
   * ============================================================== */
  {
    const corpo = cssRegra("#dlgQsResponder #qsSessCorpo");
    const recorta = /overflow(-[xy])?:\s*(hidden|auto|scroll|clip)/.test(corpo);
    const menuCss = cssRegra(".qs-fer-menu");
    if (recorta) {
      ok(!/position:\s*absolute/.test(menuCss),
         "M1 a caixa da questão recorta (" + corpo.match(/overflow[^;}]*/)[0]
         + ") e o menu ⋮ continua position:absolute dentro dela: ele vai "
         + "ser cortado na borda, e z-index não tira ninguém de dentro "
         + "de um recorte: " + menuCss);
    }
    /* E O JS É QUEM O TORNA fixed, na hora de abrir. Deixar "fixed" na
     * folha de estilo faria um menu escondido ser medido contra a
     * janela mesmo sem ninguém o ter pedido. */
    const js = fs.readFileSync(
      path.join(__dirname, "..", "docs", "questoes-ui.js"), "utf8");
    ok(/position\s*=\s*"fixed"/.test(js),
       "M1a nada torna o menu independente do recorte: sem fixed (ou "
       + "sem pendurá-lo no <dialog>), ele volta a ser cortado");
  }

  /* ==============================================================
   * M2: ABRE POSICIONADO PELO BOTÃO, e não no canto da tela
   *
   * Um menu fixed sem left/top calculados aparece em 0,0 — canto
   * superior esquerdo da janela, longe do ⋮ que a pessoa tocou. É o
   * jeito mais fácil de "consertar o corte" e criar outro defeito.
   * ============================================================== */
  {
    const { api } = rodar();
    const { menu, bm } = barraDe(api);
    ok(!!menu && !!bm, "M2-pre a barra não tem o ⋮ e o menu");
    bm._rect = { left: 700, top: 300, width: 30, height: 24,
                 right: 730, bottom: 324 };
    bm.onclick({ stopPropagation() {} });

    ok(menu.hidden === false, "M2 o ⋮ não abriu o menu");
    ok(menu.style.position === "fixed",
       "M2a o menu abriu sem sair do recorte: " + menu.style.position);
    /* embaixo do botão, não em cima dele nem no canto */
    ok(menu.style.top === "328px",
       "M2b o menu não abriu logo abaixo do botão (esperado 328px, o pé "
       + "do botão mais a folga): " + menu.style.top);
    /* alinhado pela direita do botão, como era com "right:0" */
    ok(menu.style.left === "500px",
       "M2c o menu não ficou alinhado à direita do botão: " + menu.style.left);
    ok(!/NaN/.test(menu.style.left + menu.style.top),
       "M2d a posição saiu NaN — no navegador o menu aparece no canto: "
       + menu.style.left + " / " + menu.style.top);
  }

  /* ---- M2e: encostado na borda, recua para caber ---- */
  {
    const { api } = rodar();
    const { menu, bm } = barraDe(api);
    api.larguraTela(360);        /* telefone */
    bm._rect = { left: 330, top: 100, width: 28, height: 24,
                 right: 358, bottom: 124 };
    bm.onclick({ stopPropagation() {} });
    const esq = parseInt(menu.style.left, 10);
    ok(esq >= 8 && esq + 230 <= 360 - 8 + 1,
       "M2e num telefone o menu saiu pela borda direita da janela: "
       + "left=" + esq + " com 230px de largura numa tela de 360");
  }

  /* ==============================================================
   * M3: FECHA POR CLIQUE FORA E POR ESC
   *
   * Sendo fixed, ele não rola junto com nada: um menu que só fecha pelo
   * próprio botão vira um retângulo grudado na tela assim que a pessoa
   * clica em qualquer outro lugar.
   * ============================================================== */
  {
    const { api } = rodar();
    const { menu, bm } = barraDe(api);
    bm._rect = { left: 100, top: 100, width: 28, height: 24,
                 right: 128, bottom: 124 };
    bm.onclick({ stopPropagation() {} });
    ok(menu.hidden === false, "M3-pre o menu não abriu");
    api.docDisparar("click", {});
    ok(menu.hidden === true,
       "M3 clicar fora não fechou o menu: ele fica grudado na tela, e "
       + "sendo fixed nem some ao rolar");
  }
  {
    const { api } = rodar();
    const { menu, bm } = barraDe(api);
    bm._rect = { left: 100, top: 100, width: 28, height: 24,
                 right: 128, bottom: 124 };
    bm.onclick({ stopPropagation() {} });
    api.docDisparar("keydown", { key: "a" });
    ok(menu.hidden === false,
       "M3a qualquer tecla fecha o menu — digitar no rascunho o fecharia");
    api.docDisparar("keydown", { key: "Escape" });
    ok(menu.hidden === true, "M3b Esc não fechou o menu");
  }

  /* ---- M3c: e os ouvintes saem junto ----
   * Ouvinte de "click" no documento que sobrevive ao fechamento é
   * defeito acumulativo: abrir e fechar dez vezes deixa dez ouvintes
   * rodando a cada clique da tela. */
  {
    const { api } = rodar();
    const { menu, bm } = barraDe(api);
    bm._rect = { left: 10, top: 10, width: 20, height: 20,
                 right: 30, bottom: 30 };
    const conta = () => (api.docOuvintes("click") || []).length;
    const zero = conta();
    bm.onclick({ stopPropagation() {} });
    bm.onclick({ stopPropagation() {} });
    bm.onclick({ stopPropagation() {} });
    api.docDisparar("click", {});
    ok(conta() === zero,
       "M3c os ouvintes do documento ficaram para trás: " + conta()
       + " contra " + zero + " no começo — abrir e fechar o menu vinte "
       + "vezes deixa vinte funções rodando a cada clique da tela");
    ok(menu.hidden === true, "M3d o menu ficou aberto no fim");
  }

  /* ---- M4: só um menu aberto por vez ---- */
  {
    const { api } = rodar();
    const a = barraDe(api);
    const b = barraDe(api);
    a.bm._rect = { left: 10, top: 10, width: 20, height: 20, right: 30, bottom: 30 };
    b.bm._rect = { left: 40, top: 10, width: 20, height: 20, right: 60, bottom: 30 };
    a.bm.onclick({ stopPropagation() {} });
    b.bm.onclick({ stopPropagation() {} });
    ok(a.menu.hidden === true,
       "M4 dois menus abertos ao mesmo tempo: eles se sobrepõem e a "
       + "pessoa toca no item do menu errado");
    ok(b.menu.hidden === false, "M4a o segundo menu não abriu");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
