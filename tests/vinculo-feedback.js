/* =====================================================================
 * O VÍNCULO FEITO À MÃO SE MOSTRA (v18.49.0)
 *
 * O relato, com print: "o art. 148 não tinha vínculo. Fiz com a
 * Constituição Federal manualmente. Visualmente não tenho garantia de
 * que o vínculo foi efetivado." Agora: (1) ao guardar, um aviso diz o que
 * foi ligado e onde vale, e o link pisca na tela; (2) daí em diante o
 * link tem 🔗 e o balão diz "vínculo feito por você"; (3) a prévia diz
 * "🔗 Vínculo feito por você em DD/MM · vale só neste tópico"; (4)
 * desligar também confirma.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Sistema Tributário Brasileiro", TOP = "Tributos e suas espécies";
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave(DISC, TOP);
  api.leiGuardar({ id: "cf88", nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", apelido: "CF88", especie: "Constituição",
    texto: "Art. 148. A União, mediante lei complementar, poderá instituir empréstimos compulsórios.\nArt. 149. Compete exclusivamente à União instituir contribuições sociais." });
  api.matGravar(ch, "2. A destinação legal do produto da arrecadação é irrelevante para a natureza e validade do tributo (art. 148 e outros).", { disciplina: DISC, topico: TOP });
  api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
  const links = () => api.$("matLeitura").querySelectorAll("button.mat-lei-link");
  const do148 = () => links().find((b) => b.textContent === "art. 148");
  ok(do148() && !/qs-lei-link-perm/.test(do148().className), "F0 antes: 'art. 148' é link sem vínculo fixo");

  /* F1: ligar à mão (o caminho da bolha / "ligar a outro") → aviso com o que foi feito */
  api.qsVincEscolherPara({ disciplina: DISC, topico: TOP, comentario: "art. 148", _onde: "resumo", _aoVoltar: () => api.matRender && api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true) },
    { trecho: "art. 148", cit: null });
  api.$("qsVincLei").value = "cf88";
  api.$("qsVincArts").value = "148";
  ok(api.qsVincSalvar() === true, "F1 o vínculo foi gravado");
  const dq = api.citUltimoDestaqueLer();
  ok(dq && dq.trecho === "art. 148" && dq.n >= 1, "F1b ao guardar, o link recém-ligado é destacado na tela: " + JSON.stringify(dq));
  const aviso = api.$("toast").textContent;
  ok(/^✓ Vínculo guardado: «art\. 148» → CF88, art\. 148 · só neste tópico\./.test(aviso), "F1a o aviso diz o que foi ligado e onde vale: " + aviso);

  /* F2: daí em diante o link se distingue (classe do 🔗 e balão) */
  const l = do148();
  ok(l && /qs-lei-link-perm/.test(l.className) && /vínculo feito por você \(só neste tópico\)/.test(l.title), "F2 o link tem a marca do vínculo seu e o balão diz isso: " + (l && l.title));
  ok(api.citDestacarRecem("art. 148") >= 1, "F2a o link recém-ligado é destacado na tela");

  /* F3: a prévia diz que o vínculo é seu, desde quando e onde vale */
  l.onclick({ stopPropagation() {} });
  ok(api.$("dlgLeiCitaPreview").open === true && api.$("leiCitaVincInfo").hidden === false && /^🔗 Vínculo feito por você em .+ · vale só neste tópico\.$/.test(api.$("leiCitaVincInfo").textContent),
     "F3 a prévia mostra o vínculo seu: " + api.$("leiCitaVincInfo").textContent);
  /* F4: desligar confirma */
  api.$("btnLeiCitaDesligar").onclick();
  ok(/^✓ Link desligado: «art\. 148»/.test(api.$("toast").textContent), "F4 desligar também confirma: " + api.$("toast").textContent);
  /* uma citação comum (sem vínculo seu) não mostra a linha */
  api.leiCitaVincInfoPintar({ texto: "art. 149", num: "149" });
  ok(api.$("leiCitaVincInfo").hidden === true, "F4a citação sem vínculo seu: sem a linha");

  /* F5: o CSS — 🔗 nos links fixos (resumo, questões, cartões e leitor de lei) e o destaque */
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  ok(/\.qs-lei-link-perm::after,\.lei-cita-link\.lei-cita-perm::after\{content:"🔗"/.test(html) && html.indexOf(".cit-recem{") > 0 && html.indexOf("@keyframes citRecem") > 0, "F5 o CSS do 🔗 e do destaque existe");
  ["qs_vinc_feito", "cit_perm_tip_topico", "cit_perm_tip_tudo", "lei_cita_vinc_info", "lei_cita_vinc_info_sem_data", "lei_cita_desligado_feito"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "F6 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
