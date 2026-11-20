/* =====================================================================
 * A CAPA DA ABERTURA DIZ A VERSÃO QUE ESTÁ CARREGANDO (19.192.0)
 *
 *  AB1. a capa traz a versão escrita no HTML (ela aparece antes de qualquer script);
 *  AB2. a versão da capa bate com o VERSAO do app.js e com o sw.js — trocar a versão sem trocar a capa quebra aqui;
 *  AB3. ao carregar, o app confirma o número na capa.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const ler = (f) => fs.readFileSync(path.join(__dirname, "..", "docs", f), "utf8");
  const html = ler("index.html"), app = ler("app.js"), sw = ler("sw.js");
  const capa = (html.match(/id="aberturaVersao">v([\d.]+)</) || [])[1] || "";
  const versao = (app.match(/const VERSAO = "([\d.]+)"/) || [])[1] || "";
  const swv = (sw.match(/const SW_VERSION = "([\d.]+)"/) || [])[1] || "";
  ok(!!capa && html.indexOf('id="aberturaVersao"') > html.indexOf('id="abertura"') && html.indexOf('id="aberturaVersao"') < html.indexOf("<script src="),
    "AB1 a capa traz a versão escrita no HTML, antes de qualquer script: " + capa);
  ok(capa === versao && versao === swv, "AB2 a versão da capa (" + capa + ") bate com o VERSAO (" + versao + ") e o sw.js (" + swv + ")");
  const { api } = rodar();
  ok(api.$("aberturaVersao") && api.$("aberturaVersao").textContent === "v" + versao, "AB3 o app confirma a versão na capa ao carregar: " + (api.$("aberturaVersao") || {}).textContent);
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
