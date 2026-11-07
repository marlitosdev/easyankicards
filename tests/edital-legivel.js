/* (19.93.0) A ABA EDITAL LEGÍVEL — fase 1 (só CSS; o simulador não tem motor de CSS, então se confere o texto das regras)
 *
 *   EL1  o bloco existe e só usa os quatro tamanhos: 12, 14, 16 e 20 px (nada abaixo de 12)
 *   EL2  cada classe que estava pequena (medida com o ISS) entra na escala, no tamanho do papel dela
 *   EL3  os botões têm alvo de toque: 32 px (44 px no toque); o "?" cresce de verdade; os itens do menu "⋯" têm 44 px no toque
 *   EL4  os selos que não quebravam linha agora quebram (com a letra maior, passavam da coluna)
 *   EL5  tudo preso a #secEdital: nada muda nas outras abas
 */
const fs = require("fs");
const path = require("path");

function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const ini = html.indexOf("(19.93.0) A ABA EDITAL LEGÍVEL");
  const fim = html.indexOf("</style>", ini);
  /* o bloco começa DEPOIS do comentário de abertura (senão a 1ª "regra" levaria o texto do comentário) */
  const bloco = ini > 0 ? html.slice(html.indexOf("*/", ini) + 2, fim) : "";
  ok(bloco.length > 500, "EL0 o bloco da escala existe");
  const regras = [...bloco.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), corpo: m[2] }));
  const tamanhos = new Set(regras.map((r) => (r.corpo.match(/font-size:([\d.]+)px/) || [])[1]).filter(Boolean));
  ok([...tamanhos].every((x) => ["12", "14", "16", "20"].indexOf(x) >= 0) && tamanhos.size === 4, "EL1 só quatro tamanhos de letra, nenhum abaixo de 12 px: " + [...tamanhos].join(","));
  const tamDe = (cls) => { const r = regras.find((x) => /font-size/.test(x.corpo) && x.sel.split(",").some((s) => s.trim() === "#secEdital " + cls)); return r ? (r.corpo.match(/font-size:([\d.]+)px/) || [])[1] : null; };
  const esperado = {
    ".ed-caixa-tit": "20", ".bancada-nome": "20", ".ed-item-titulo": "16",
    ".btn-min": "14", ".ed-item-porque": "14", ".ed-ramos-resumo": "14", ".ed-min-num": "14", ".hub-aviso-chip": "14", "summary": "14", ".lac-num": "14",
    ".ed-selo-cc": "12", ".ed-item-trava": "12", ".ed-selo-andamento": "12", ".ed-st-item": "12", ".ed-ramo": "12", ".ac-c": "12", ".di-sem-prev": "12", ".selo-ajuda": "12",
  };
  const errados = Object.keys(esperado).filter((c) => tamDe(c) !== esperado[c]).map((c) => c + "=" + tamDe(c));
  ok(errados.length === 0, "EL2 cada classe no tamanho do papel dela (título 16, seção 20, texto 14, detalhe 12): " + errados.join(" "));
  /* (19.94.0) o "+" de registrar saiu da linha (foi para o menu "⋯"): no toque, cada item do menu tem 44 px */
  ok(/#secEdital \.btn-min,[^{]*\{min-height:32px/.test(bloco) && /#secEdital \.selo-ajuda\{width:24px;height:24px\}/.test(bloco)
    && /@media \(pointer:coarse\)\{[\s\S]*#secEdital \.btn-min[^{]*\{min-height:44px\}/.test(bloco)
    && /@media \(pointer:coarse\)\{[\s\S]*#secEdital \.ed-menu-item\{min-height:44px\}/.test(bloco), "EL3 alvo de toque: 32 px (44 no toque); o '?' cresce de verdade e o menu '⋯' tem itens de 44 px no toque");
  ok(/#secEdital \.ed-selo-andamento,#secEdital \.ed-item-trava\{white-space:normal;max-width:100%/.test(bloco), "EL4 os selos que não quebravam linha agora quebram");
  ok(regras.every((r) => !r.sel || r.sel.startsWith("@media") || r.sel.split(",").every((s) => s.trim().startsWith("#secEdital"))), "EL5 toda regra presa a #secEdital (as outras abas não mudam)");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
