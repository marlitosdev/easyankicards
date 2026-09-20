/* =====================================================================
 * "EXIBIÇÃO" FLUTUA, E AS MARCAS SÃO PONTOS
 *
 * "exibição" (letra, janela, leitura ampliada) era uma faixa que EMPURRAVA a lei para baixo cada
 * vez que abria — e responde uma pergunta que se faz uma vez por sessão. As seis marcas eram seis
 * pílulas de texto disputando a linha com os modos. Agora:
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "exibição" abre um pop-over sob o botão (posição vinda do retângulo dele, sem sair da
 *     janela, subindo quando falta lugar), com três linhas: leitura ampliada, letra e janela.
 *  2. Fecha ao clicar FORA, com Esc (só ele — a lei fica aberta), ao ampliar a leitura, ao
 *     fechar a lei e ao abrir outra; um clique DENTRO dele não fecha; os ouvintes não vazam.
 *  3. As seis marcas continuam todas (mesmas ids e ações), agora como pontos coloridos: o nome
 *     vem na dica (title), o rótulo escrito volta no foco do teclado e na tela de toque.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const regra = (sel) => (html.match(new RegExp(sel + "\\{([^}]*)\\}")) || [])[1] || "";
  const LEI = ["Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Três."].join("\n");
  const montar = () => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito", "Tributário");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
    const l = api.leiGuardar({ id: "lei_x", nome: "Lei X", texto: LEI });
    api.leiLigar(l.id, ch);
    api.leiAbrir("Direito", "Tributário", l.id);
    return { api, l };
  };
  const pop = (api) => api.$("leiGavExibir");
  const btn = (api) => api.$("btnLeiExibir");
  const ouvintes = (api) => api.docOuvintes("click").length + api.docOuvintes("keydown").length;

  /* ==============================================================
   * P: O POP-OVER
   * ============================================================== */
  {
    const { api } = montar();
    const base = ouvintes(api);
    ok(pop(api).hidden === true, "P1 nasce fechado");
    btn(api)._rect = { top: 100, left: 40, width: 80, height: 24 };
    btn(api).onclick();
    ok(pop(api).hidden === false && /btn-min-ok/.test(btn(api).className || ""), "P2 o botao abre e fica marcado");
    ok(pop(api).style.left === "40px" && pop(api).style.top === "128px", "P2a fica sob o botao, alinhado a esquerda dele: " + pop(api).style.left + "," + pop(api).style.top);
    /* o HTML estatico nao vira arvore no simulador: a estrutura se confere no texto do HTML */
    const ini = html.indexOf('id="leiGavExibir"');
    const corpo = html.slice(ini, html.indexOf("<!-- SÓ EDITÁVEL", ini));
    const linhas = corpo.split('<div class="lei-pop-linha">').slice(1);
    ok(linhas.length === 3, "P3 tres linhas (leitura ampliada, letra, janela): " + linhas.length);
    ok(/id="btnLeiCheia"/.test(linhas[0])
      && ["btnLeiMenor", "btnLeiMaior", "btnLeiFonteReset", "leiFonteAtual"].every((id) => linhas[1].indexOf('id="' + id + '"') >= 0)
      && ["btnLeiJanelaMenos", "btnLeiJanelaMais", "leiJanelaNome"].every((id) => linhas[2].indexOf('id="' + id + '"') >= 0), "P3a cada controle na sua linha");
    ok(ouvintes(api) === base + 2, "P4 abrir registra os ouvintes de clique fora e de Esc: " + (ouvintes(api) - base));

    /* dentro dele NAO fecha; o proprio botao alterna */
    api.$("btnLeiMaior").parentNode = pop(api);        /* no navegador ele e' filho do pop-over; o simulador nao monta o HTML estatico */
    api.docDisparar("click", { target: api.$("btnLeiMaior") });
    ok(pop(api).hidden === false, "P5 clicar num controle do pop-over nao o fecha (a letra pede varios cliques)");
    api.docDisparar("click", { target: btn(api) });
    ok(pop(api).hidden === false, "P5a o clique que abre tambem chega ao documento e nao o fecha na hora");
    /* fora fecha e tira os ouvintes */
    api.docDisparar("click", { target: api.$("leiLeitura") });
    ok(pop(api).hidden === true && !/btn-min-ok/.test(btn(api).className || "") && ouvintes(api) === base, "P6 clique fora fecha, desmarca o botao e nao deixa ouvinte para tras: " + ouvintes(api));
    /* Esc */
    btn(api).onclick();
    let barrou = 0;
    api.docDisparar("keydown", { key: "Escape", preventDefault() { barrou++; }, stopPropagation() { barrou++; } });
    ok(pop(api).hidden === true && barrou === 2, "P7 Esc fecha so o pop-over (nao deixa o Esc chegar a lei): " + barrou);
    api.docDisparar("keydown", { key: "a", preventDefault() { barrou += 10; } });
    btn(api).onclick();
    api.docDisparar("keydown", { key: "a", preventDefault() { barrou += 10; } });
    ok(pop(api).hidden === false && barrou === 2, "P7a outra tecla nao fecha nem e' barrada");
    /* o botao alterna */
    btn(api).onclick();
    ok(pop(api).hidden === true && ouvintes(api) === base, "P8 tocar de novo no botao fecha");
    /* abrir duas vezes seguidas nao acumula ouvintes */
    btn(api).onclick(); btn(api).onclick(); btn(api).onclick();
    ok(ouvintes(api) === base + 2, "P8a abrir e fechar varias vezes nao acumula ouvintes: " + (ouvintes(api) - base));
    api.$("leiGavExibir").hidden = true;
    btn(api).onclick();
    /* ampliar a leitura fecha (a janela muda de tamanho) */
    api.$("btnLeiCheia").onclick();
    ok(pop(api).hidden === true && ouvintes(api) === base, "P9 'ler maior' fecha o pop-over: a janela mudou de tamanho");
    api.$("btnLeiCheia") && api.leiCheiaTrocar && api.leiCheiaTrocar(false);
    /* fechar a lei fecha */
    btn(api).onclick();
    ok(pop(api).hidden === false, "P10 reabre");
    api.leiFechar();
    ok(pop(api).hidden === true && ouvintes(api) === base, "P10a fechar a lei fecha o pop-over e limpa os ouvintes");
    /* abrir uma lei (a mesma ou outra) com o pop-over aberto: ele nao atravessa para a lei nova */
    api.leiAbrir("Direito", "Tributário", "lei_x");
    btn(api).onclick();
    ok(pop(api).hidden === false, "P10b reabre");
    api.leiAbrir("Direito", "Tributário", "lei_x");
    ok(pop(api).hidden === true && ouvintes(api) === base, "P10c abrir uma lei fecha o pop-over que ficou aberto");
  }
  {
    /* NAO SAI DA JANELA: colado na direita recua; sem lugar embaixo, sobe */
    const { api } = montar();
    btn(api)._rect = { top: 100, left: 1900, width: 80, height: 24 };
    btn(api).onclick();
    const esq = parseInt(pop(api).style.left, 10);
    ok(esq === 1200 - 340 - 8, "P11 botao junto da borda direita (janela de 1200): o pop-over recua para caber, left=" + esq);
    btn(api).onclick();
    btn(api)._rect = { top: 1000, left: 40, width: 80, height: 24 };
    Object.defineProperty(pop(api), "offsetHeight", { value: 200, configurable: true });
    btn(api).onclick();
    const alto = parseInt(pop(api).style.top, 10);
    ok(alto === 1000 - 200 - 4, "P12 sem lugar embaixo (janela de 900) ele sobe para cima do botao: top=" + alto);
    /* e com espaco embaixo, desce */
    btn(api).onclick();
    btn(api)._rect = { top: 100, left: 40, width: 80, height: 24 };
    btn(api).onclick();
    ok(parseInt(pop(api).style.top, 10) === 128, "P12a com lugar embaixo ele desce: top=" + pop(api).style.top);
    /* mexer na janela/letra reposiciona */
    btn(api)._rect = { top: 100, left: 300, width: 80, height: 24 };
    pop(api).onclick();
    ok(pop(api).style.left === "300px", "P13 clicar dentro reposiciona (o botao pode ter se mexido): " + pop(api).style.left);
    btn(api).onclick();
    pop(api).onclick();
    ok(pop(api).hidden === true, "P13a reposicionar com ele fechado nao o reabre");
  }

  /* ==============================================================
   * C: O CSS E O HTML
   * ============================================================== */
  {
    const pp = regra("\\.lei-pop");
    ok(/position:fixed/.test(pp) && /z-index:\d+/.test(pp) && /box-shadow/.test(pp) && /width:min\(340px,calc\(100vw - 16px\)\)/.test(pp), "C1 o pop-over e' fixo, por cima e cabe na tela: " + pp);
    ok(/\.lei-pop\[hidden\]\{display:none\}/.test(html), "C2 escondido de verdade (display:flex venceria o atributo hidden)");
    ok(!/\.lei-gaveta/.test(html) && !/lei-gaveta/.test(html), "C3 a faixa antiga nao existe mais");
    ok(/<div class="lei-pop" id="leiGavExibir"[^>]*hidden>/.test(html), "C4 o pop-over no HTML nasce hidden");
  }

  /* ==============================================================
   * M: AS MARCAS
   * ============================================================== */
  {
    const { api } = montar();
    const ids = ["btnLeiMarcaDest", "btnLeiMarcaImp", "btnLeiMarcaDuv", "btnLeiMarcaProva", "btnLeiMarcaPeg", "btnLeiMarcaNota"];
    ok(ids.every((id) => typeof api.$(id).onclick === "function"), "M1 as seis marcas continuam, todas com acao");
    const bloco = html.slice(html.indexOf('id="leiMarcas"') - 40, html.indexOf('id="leiMarcas"') + 2600);
    ok(/class="mat-barra lei-marcas-pontos" id="leiMarcas"/.test(bloco), "M2 a barra de marcas e' a dos pontos");
    const nomes = { btnLeiMarcaDest: "Destaque", btnLeiMarcaImp: "Importante", btnLeiMarcaDuv: "Dúvida", btnLeiMarcaProva: "Caiu na prova", btnLeiMarcaPeg: "Pegadinha", btnLeiMarcaNota: "Nota" };
    Object.keys(nomes).forEach((id) => {
      const m = bloco.match(new RegExp('id="' + id + '"[^>]*?title="([^"]*)"'));
      ok(m && m[1].indexOf(nomes[id] + " — ") === 0, "M3 a dica de " + id + " comeca pelo nome (" + nomes[id] + "): " + (m && m[1].slice(0, 40)));
    });
    const mc = regra("\\.lei-marcas-pontos \\.marca");
    ok(/width:20px/.test(mc) && /height:20px/.test(mc) && /border-radius:50%/.test(mc) && /font-size:0/.test(mc), "M4 cada marca e' um ponto de 20px, sem texto a vista: " + mc);
    ok(/\.lei-marcas-pontos \.marca:focus-visible\{[^}]*font-size:10\.5px/.test(html), "M5 o rotulo escrito volta no foco do teclado");
    ok(/@media \(hover:none\)\{\s*\.lei-marcas-pontos \.marca\{[^}]*font-size:10\.5px/.test(html), "M6 e na tela de toque, onde nao ha 'passar o mouse'");
    /* a cor de cada ponto e' a do grifo: as classes .marca-* continuam nos botoes */
    ["marca-d", "marca-i", "marca-q", "marca-prova", "marca-peg", "marca-nota"].forEach((c) => {
      ok(new RegExp('class="marca ' + c + '"').test(bloco), "M7 o ponto tem a cor do grifo (" + c + ")");
    });
    /* o texto da marca continua no botao (leitor de tela), so nao aparece */
    ok(/data-i18n="mat_marca_d"/.test(bloco) && /data-i18n="lei_marca_nota"/.test(bloco), "M8 o nome continua no botao (leitor de tela le)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
