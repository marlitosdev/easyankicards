/* (19.98.0) A BIBLIOTECA DE LEIS MAIS FÁCIL
 *
 *   BT1  tela cheia (lembrada) e uma rolagem só (a da lista); o ✖ é o único fechar
 *   BT2  uma fileira de filtros: as pastas e "🔗 sem tópico" no fim (saíram "Todas / Do concurso atual / Sem vínculo")
 *   BT3  cada lei em uma linha: "Abrir", o 📁 e o "⋯" — mapa, ligar a tópico e apagar estão no "⋯"
 *   BT4  a frase de como funciona fala de tópico, pasta 📋 do edital e pastas 📁
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const dlgHtml = html.slice(html.indexOf('<dialog id="dlgLeiBib"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgLeiBib"')));

  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
  const ch = api.matChave("D", "T");
  api.leiGuardar({ id: "la", nome: "Lei A", texto: "Art. 1º Um.\nArt. 2º Dois.", topicos: [ch] });
  api.leiGuardar({ id: "lb", nome: "Lei B", texto: "Art. 1º Um.", topicos: [] });
  api.loja.removeItem("eac_lb_cheia");
  api.leiBibAbrir();

  ok(/id="btnLeiBibCheia"/.test(dlgHtml) && /id="btnLeiBibX"/.test(dlgHtml) && !/id="btnLeiBibFechar"/.test(dlgHtml)
    && /dialog\.lb-dlg\[open\] #leiBibLista\{flex:1 1 auto;min-height:0;max-height:none;overflow:auto\}/.test(html) && /dialog\.lb-dlg\.lb-cheia\[open\]\{width:100vw/.test(html),
    "BT1 tela cheia, um só fechar (✖) e a lista é a única rolagem");
  api.$("btnLeiBibCheia").onclick();
  ok(api.$("dlgLeiBib").classList.contains("lb-cheia") && api.loja.getItem("eac_lb_cheia") === "1" && api.$("btnLeiBibCheia").textContent === api.t("dom_cheia_sair"), "BT1b o botão liga a tela cheia e a escolha fica lembrada");
  api.$("btnLeiBibCheia").onclick();

  ok(!/id="btnLeiBibTodas"|id="btnLeiBibConcurso"/.test(html), "BT2 saíram 'Todas' e 'Do concurso atual' (as pastas fazem isso)");
  const sem = api.$("btnLeiBibSem");
  ok(sem && /sem tópico · 1/.test(sem.textContent) && todos(api.$("leiBibPastas")).includes(sem), "BT2b '🔗 sem tópico · 1' está na fileira das pastas: " + (sem && sem.textContent));
  sem.onclick();
  const nomes = () => todos(api.$("leiBibLista")).filter((x) => /(^| )lei-bib-tit( |$)/.test(x.className || "")).map((x) => x.childNodes ? x.textContent : "").join("|");
  ok(/^Lei B/.test(nomes()) && !/Lei A/.test(nomes()), "BT2c o filtro mostra só a lei sem tópico: " + nomes());
  api.$("btnLeiBibSem").onclick();

  const linha = api.$("leiBib_la");
  const bts = todos(linha).filter((x) => x.tag === "button" && !todos(todos(linha).find((y) => /lei-bib-usos/.test(y.className || "")) || null).includes(x));
  const rot = bts.map((b) => b.textContent);
  ok(/lb-linha/.test(linha.className) && rot[0] === api.t("lei_bib_abrir") && rot.indexOf("⋯") >= 0 && !rot.some((x) => /apagar|ligar|mapa/i.test(x)),
    "BT3 a linha tem Abrir, 📁 e ⋯ (sem mapa/ligar/apagar soltos): " + rot.join(" | "));
  api.$("btnLeiBibMais_la").onclick({ stopPropagation() {} });
  const itens = todos(linha).filter((x) => /(^| )ed-menu-item( |$)/.test(x.className || ""));
  ok(itens.map((x) => x.id).join(",") === "btnLeiBibMapa_la,btnLeiBibLigar_la,btnLeiBibApagar_la" && /ed-menu-perigo/.test(itens[2].className), "BT3b o ⋯ traz mapa, ligar e apagar (em vermelho)");
  api.edMenuFechar();

  ok(/pasta 📋/.test(api.t("lei_bib_ajuda")) && /📁/.test(api.t("lei_bib_ajuda")) && /tópico/.test(api.t("lei_bib_ajuda")), "BT4 a frase explica tópico, pasta do edital e pastas suas");
  api.$("dlgLeiBib").close();
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
