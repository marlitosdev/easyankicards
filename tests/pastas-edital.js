/* (19.97.0) A PASTA DO EDITAL COMPLETA
 *
 *   PE1  a pasta do edital tem as leis ligadas a tópicos dele E as usadas em vínculos desses tópicos
 *   PE2  pôr à mão (a lei do concurso inteiro): entra, e tirar à mão tira; o que é automático não sai à mão
 *   PE3  a pasta é do edital (id): renomear o edital não muda a pasta; o id antigo ("ed:<concurso>") ainda serve
 *   PE4  a fileira: as de prova já passada vão para o fim, recolhidas atrás de um toque
 *   PE5  a janela "📁 pastas": as de edital marcáveis, as automáticas travadas e com o porquê; o 📁 do item conta tudo
 *   PE6  o que foi posto à mão vai no backup
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = "\n";
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  const iss = api.edCriar("ISS", ["# ISS Caruaru | prova: " + d(60) + " | horas: 20", "@ Contabilidade :: 5", "+ PCASP :: 5", "@ Administrativo :: 4", "+ Atos administrativos :: 4"].join(NL));
  const tce = api.edCriar("TCE", ["# TCE-PE | prova: " + d(-10) + " | horas: 20", "@ Financeiro :: 5", "+ Lei 4.320 :: 5"].join(NL));
  const chP = api.matChave("Contabilidade", "PCASP"), chA = api.matChave("Administrativo", "Atos administrativos"), chT = api.matChave("Financeiro", "Lei 4.320");
  api.leiGuardar({ id: "l101", nome: "LC 101/2000", texto: "Art. 1º Um.", topicos: [chP] });
  api.leiGuardar({ id: "l4320", nome: "Lei 4.320/1964", texto: "Art. 105. Um.", topicos: [chT] });
  api.leiGuardar({ id: "l9784", nome: "Lei 9.784/1999", texto: "Art. 1º Um.", topicos: [] });
  api.leiGuardar({ id: "lcf", nome: "Constituição Federal", texto: "Art. 1º Um.", topicos: [] });
  api.citVinculoSalvar({ trecho: "art. 105, § 1º", leiId: "l4320", artigos: [{ num: "105", numCru: "105, § 1º" }], chave: chP });
  api.citVinculoSalvar({ trecho: "art. 2º da Lei 9.784", leiId: "l9784", artigos: [{ num: "2", numCru: "2" }], chave: chA });
  const item = (id) => ({ t: "lei", id, topicos: (api.leisLista().find((l) => l.id === id) || {}).topicos || [] });
  const naPasta = (pid) => api.leisLista().filter((l) => api.pasContem(pid, item(l.id))).map((l) => l.id).sort().join(",");

  const pISS = "ed:" + iss.id;
  ok(naPasta(pISS) === "l101,l4320,l9784", "PE1 a pasta do ISS: a lei ligada ao tópico e as usadas em vínculos: " + naPasta(pISS));
  ok(api.pasEdMotivo(api.pasEdIndice().lista.find((e) => e.id === String(iss.id)), item("l4320")) === "vinculo", "PE1b e diz o porquê (vínculo)");

  ok(api.pasAlternar(pISS, "lei", "lcf", true) === true && naPasta(pISS) === "l101,l4320,l9784,lcf", "PE2 pôr à mão a Constituição na pasta do ISS");
  ok(api.pasAlternar(pISS, "lei", "lcf", false) === false && naPasta(pISS) === "l101,l4320,l9784", "PE2b tirar à mão tira");
  api.pasAlternar(pISS, "lei", "lcf", true);

  iss.nome = "ISS Caruaru — Auditor"; iss.renomeado = true; api.edSalvarLista();
  ok(naPasta(pISS) === "l101,l4320,l9784,lcf" && api.pasTodas().some((p) => p.id === pISS && p.nome === "ISS Caruaru — Auditor"), "PE3 renomear o edital não muda a pasta (é pela id)");
  ok(api.pasContem("ed:ISS Caruaru", item("lcf")) === true, "PE3b o id antigo ('ed:<concurso>') ainda é entendido");

  /* a fileira */
  api.leiBibAbrir();
  const chips = () => api.$("leiBibPastas").querySelectorAll("button").map((b) => b.textContent);
  const c1 = chips();
  ok(c1.some((x) => /^📋 ISS Caruaru — Auditor · 4$/.test(x)) && !c1.some((x) => /📋 TCE/.test(x)) && c1.some((x) => /1 de provas já passadas/.test(x)),
    "PE4 o TCE-PE (prova passada) fica recolhido no fim: " + c1.join(" | "));
  api.$("leiBibPastas").querySelectorAll("button").filter((b) => /provas já passadas/.test(b.textContent))[0].onclick();
  const c2 = chips();
  ok(c2.some((x) => /^📋 TCE · 1$/.test(x)) && c2.indexOf(c2.find((x) => /📋 TCE/.test(x))) > c2.indexOf("＋ pasta"), "PE4b um toque mostra, depois das outras: " + c2.join(" | "));
  api.pasVerEncerradosForcar(false);

  /* a janela */
  const bt = api.$("leiBibLista").querySelectorAll("button").filter((b) => b.id === "btnPas_lei_l4320")[0];
  ok(bt && bt.textContent === "📁 2", "PE5 o 📁 da Lei 4.320 conta as pastas de edital (ISS por vínculo, TCE por tópico): " + (bt && bt.textContent));
  bt.onclick({ stopPropagation() {} });
  const ckI = api.$("pasEdCk_" + iss.id), ckT = api.$("pasEdCk_" + tce.id);
  ok(ckI && ckI.checked && ckI.disabled && ckT.checked && ckT.disabled && /vínculo/.test(api.$("pasEdLista").textContent) && /tópico/.test(api.$("pasEdLista").textContent),
    "PE5b as de edital aparecem marcadas e travadas, com o porquê");
  api.$("btnPasFechar").onclick();
  api.pasAbrir("lei", "l9784", "Lei 9.784/1999");
  const ckT2 = api.$("pasEdCk_" + tce.id);
  ok(ckT2 && !ckT2.checked && !ckT2.disabled, "PE5c na que ela não está, dá para marcar");
  ckT2.checked = true; ckT2.onchange();
  ok(api.pasContem("ed:" + tce.id, item("l9784")) && /posta à mão/.test(api.$("pasEdLista").textContent), "PE5d marcar põe à mão, e a janela diz isso");
  api.$("btnPasFechar").onclick();

  ok(JSON.parse(api.montarBackup().dados.material.eac_pastas_ed || "{}")[iss.id], "PE6 o que foi posto à mão vai no backup");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
