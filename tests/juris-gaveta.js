/* =====================================================================
 * A GAVETA DE JULGADOS PARA QUEM CHEGA (v18.40.0, JM2)
 *
 * O relato, com print: cada julgado tinha até oito controles mudos no
 * cabeçalho (🩹N, ✅, "⚠ N a conferir", "conferir ↗", 🃏, ✏️, 📋, 🗑️) e
 * uma linha "Ramo deste julgado" em todo cartão; três falavam de
 * "conferir", e o 🩹 com número aparecia em quase todos só porque a
 * ementa é opcional. Agora: UM selo de situação (quando há algo a fazer)
 * que abre o porquê e as ações; à vista só 🃏 e ⋯ (ações com nome, ramo
 * e excluir); e, num tópico sem julgado, os três jeitos de começar.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const D = "Direito Tributário", T = "Tributos";
  const cls = (e) => String((e && e.className) || "");
  const guardar = (api, dados) => {
    const j = api.jurGravar(Object.assign({ tese: "tese qualquer" }, dados));
    api.jurLigar(j.id, api.matChave(D, T), D, T);
    return api.jurDe(j.id);
  };
  const itemDe = (api, j) => api.$("jurLista").querySelectorAll(".jur-item").filter((li) => li.querySelectorAll("button").some((b) => b.id === "btnJurConferi_" + j.id || b.id === "btnJurMemOk_" + j.id) || (li.textContent || "").indexOf(j.numero) >= 0)[0];

  /* G1-G2: a situação "a conferir" abre o porquê e as ações */
  {
    const { api } = rodar();
    api.matIniciar();
    const j = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706", data: "2017-03-15", aConferir: ["data", "orgao"] });
    api.jurAbrir(D, T, "ler");
    const li = itemDe(api, j);
    const selo = li.querySelectorAll(".jur-sel").filter((x) => /a conferir/.test(x.textContent || ""))[0];
    const sit = li.querySelectorAll(".jur-situacao")[0];
    ok(selo && /▾$/.test(selo.textContent) && selo.getAttribute("role") === "button" && sit && sit.hidden === true, "G1 o selo '⚠ 2 a conferir ▾' é um botão e o painel começa fechado: " + (selo && selo.textContent));
    selo.onclick({ stopPropagation() {} });
    ok(sit.hidden === false && /data, órgão|data, orgão|data/.test(sit.textContent) && sit.querySelectorAll(".jur-oficial-lnk").length === 1, "G1a tocar no selo abre o porquê (os campos), com o site oficial: " + sit.textContent.slice(0, 160));
    const ia = sit.querySelectorAll("button").filter((b) => b.textContent === api.t("jur_sit_ia_btn"))[0];
    ok(!!ia && typeof ia.onclick === "function", "G1b o painel oferece conferir com a IA");
    const bConf = sit.querySelectorAll("button").filter((b) => b.id === "btnJurConferi_" + j.id)[0];
    ok(!!bConf, "G1c o painel tem o '✓ conferi'");
    if (bConf) bConf.onclick({ stopPropagation() {} });
    ok(api.jurDe(j.id).aConferir.length === 0 && !api.$("jurLista").querySelectorAll(".jur-sel").some((x) => /a conferir/.test(x.textContent || "")), "G2 '✓ conferi' limpa a marca e o selo some");
  }

  /* G3-G5: julgado sem nada a fazer: sem selo de situação, à vista só 🃏 e ⋯; o ⋯ tem as ações com nome */
  {
    const { api } = rodar();
    api.matIniciar();
    const j = guardar(api, { tribunal: "STJ", classe: "REsp", numero: "1101728", tese: "A tese." });
    api.jurAbrir(D, T, "ler");
    const li = itemDe(api, j);
    const ics = li.querySelectorAll(".jur-ic");
    ok(ics.length === 2 && ics[0].textContent === "🃏" && ics[1].textContent === "⋯", "G3 à vista só o 🃏 e o ⋯ (era 🩹N ✏️ 📋 🗑️ também): " + ics.map((b) => b.textContent).join(" "));
    ok(!li.querySelectorAll(".jur-sel").some((x) => /conferir/.test(cls(x))) && !ics.some((b) => /🩹/.test(b.textContent)), "G3a sem nada a conferir: nenhum selo de situação e nenhum 🩹 com número (ementa ausente não é erro)");
    const painel = li.querySelectorAll(".jur-mais-painel")[0];
    ok(painel && painel.hidden === true && ics[1].getAttribute("aria-expanded") === "false", "G4 o ⋯ começa fechado");
    ics[1].onclick({ stopPropagation() {} });
    const rot = painel.querySelectorAll("button").map((b) => b.textContent);
    ok(painel.hidden === false && ics[1].getAttribute("aria-expanded") === "true", "G4a tocar no ⋯ abre o painel");
    ok(rot[0] === "✏️ editar" && /^🩹 completar com a IA \(falta: /.test(rot[1]) && rot[2] === "📋 copiar" && rot[rot.length - 1] === "🗑️ excluir deste tópico",
       "G4b as ações têm NOME, e o que falta vem escrito: " + rot.join(" | "));
    ok(painel.querySelectorAll("button").every((b) => typeof b.onclick === "function" && b.title), "G4c toda ação do ⋯ faz algo e tem explicação");
    painel.querySelectorAll("button")[0].onclick();
    ok(api.$("jurTese").value === "A tese.", "G5 'editar' abre o julgado no formulário");
  }

  /* G6: tese de memória: o selo abre o painel com o '✓ conferi' */
  {
    const { api } = rodar();
    api.matIniciar();
    const j = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: "lembrada", deMemoria: true, certeza: "media" });
    api.jurAbrir(D, T, "ler");
    const li = itemDe(api, j);
    const selo = li.querySelectorAll(".jur-sel").filter((x) => /jur-mem/.test(cls(x)))[0];
    const sit = li.querySelectorAll(".jur-situacao")[0];
    ok(selo && selo.getAttribute("role") === "button" && sit.querySelectorAll("button").some((b) => b.id === "btnJurMemOk_" + j.id) && /MEMÓRIA/.test(sit.textContent), "G6 o selo 'tese de memória' abre o porquê e o '✓ conferi'");
  }

  /* G7: tópico sem julgado: os três jeitos de começar; com julgado, não */
  {
    const { api } = rodar();
    api.matIniciar();
    api.jurAbrir(D, "Vazio", "ler");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const bloco = html.slice(html.indexOf('id="jurComecar"'), html.indexOf('id="jurPassos"'));
    ok(api.$("jurComecar").hidden === false && ["jur_comecar_1", "jur_comecar_2", "jur_comecar_3"].every((k) => bloco.indexOf('data-i18n="' + k + '"') > 0), "G7 tópico sem julgado: aparecem os três jeitos de guardar o primeiro");
    guardar(api, { tribunal: "STF", classe: "ADI", numero: "1917" });
    api.jurAbrir(D, T, "incluir");
    ok(api.$("jurComecar").hidden === true, "G7a com julgado no tópico, '＋ Novo julgado' vai direto ao formulário (sem o texto de começo)");
  }

  /* G8: os nomes do topo */
  {
    const { api } = rodar();
    ok(api.t("jur_mais") === "＋ Novo julgado" && api.t("jur_prompt_btn") === "procurar repetidos (com IA)", "G8 o topo diz o que cada botão faz: " + api.t("jur_mais") + " | " + api.t("jur_prompt_btn"));
    ["jur_sit_mem", "jur_sit_conferir", "jur_sit_conferi_btn", "jur_sit_ia_btn", "jur_mais_aj", "jur_mais_editar", "jur_mais_completar_n", "jur_mais_conferir_ia", "jur_mais_copiar", "jur_mais_excluir", "jur_comecar_tit", "jur_comecar_1", "jur_comecar_2", "jur_comecar_3"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "G8a falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
