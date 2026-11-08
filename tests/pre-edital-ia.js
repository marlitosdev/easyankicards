/* (19.100.0) PRÉ-EDITAL COM IA E A CONFIANÇA VALENDO
 *
 *   PI1  a marca na linha: trocar reescreve só o 3º campo, guarda o motivo e o "| escolha:"; "boato · na agenda" é lido
 *   PI2  o plano do pré-edital deixa o boato de fora (foraBoato) até "na agenda"; edital publicado não filtra nada
 *   PI3  no modo pré-edital, o passo 1 fala do edital anterior e o prompt é o do plano esperado: as regras do formato, a
 *        regra da confiança e o edital base dentro (sem o cabeçalho antigo)
 *   PI4  "usar como está (sem IA)": as disciplinas e os tópicos do edital base, marcados provável, no passo 2; pergunta antes
 *        de trocar um plano já colado
 *   PI5  na aba Plano do pré-edital, uma linha por disciplina com a marca; trocar grava no texto, e o boato ganha
 *        "incluir na agenda"
 *   PI6  a agenda diz o que ficou fora por ser boato, e incluir põe de volta
 *   PI7  o plano sem nenhum tópico (só boatos) não trava o diagnóstico
 *   PI8  a bancada do pré-edital conta o prazo pela janela prevista, em vez de pedir a data
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const ano = new Date().getFullYear() + 1;
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));

  /* ---- PI1 ---- */
  const l1 = api.preConfLinha("@ Língua Espanhola :: 5q :: provável — estava em 2019 | escolha: Língua", "boato", true);
  ok(l1 === "@ Língua Espanhola :: 5q :: boato · na agenda — estava em 2019 | escolha: Língua", "PI1 troca só a marca, guarda o motivo e a escolha: " + l1);
  const r1 = api.lerEdital("# X | previsto: " + ano + "-03\n" + l1 + "\n+ Leitura :: 3");
  const d1 = r1.disciplinas[0];
  ok(d1.confianca === "boato" && d1.naAgenda === true && d1.confNota === "estava em 2019" && d1.escolha === "Língua", "PI1b o app lê a marca, a inclusão e o motivo: " + JSON.stringify([d1.confianca, d1.naAgenda, d1.confNota]));
  ok(api.preConfLinha("@ Penal :: 3 :: boato", "", false) === "@ Penal :: 3", "PI1c sem marca, o campo sai");

  /* ---- PI2 ---- */
  const txPre = "# ISS Recife | previsto: " + ano + "-03.." + ano + "-06 | horas: 15\n@ Tributário :: 5 :: confirmada\n+ ISS :: 5\n@ Penal :: 3 :: boato — notícia\n+ Crimes :: 3";
  const p1 = api.montarPlano(api.lerEdital(txPre), { horas: 15 });
  ok(p1.foraBoato.join() === "Penal" && !p1.itens.some((i) => i.disciplina === "Penal"), "PI2 o boato fica fora do plano: " + p1.foraBoato);
  const p2 = api.montarPlano(api.lerEdital(api.preConfTrocar(txPre, "penal", "boato", true)), { horas: 15 });
  ok(!p2.foraBoato.length && p2.itens.some((i) => i.disciplina === "Penal"), "PI2b 'na agenda' põe de volta");
  const p3 = api.montarPlano(api.lerEdital(txPre.replace(/previsto: [^|]+/, "prova: " + ano + "-05-10 ")), { horas: 15 });
  ok(!p3.foraBoato.length && p3.itens.some((i) => i.disciplina === "Penal"), "PI2c com o edital publicado, a marca não tira nada");

  /* ---- PI3 / PI4: a caixa do novo edital ---- */
  const base = api.edCriar("ISS Recife 2019", "# ISS Recife 2019 | prova: 2019-08-10 | horas: 20\n# fase 2: discursiva | prova: 2019-09-10\n& Básicos | minimo: 50%\n@ Português :: 10q\n+ Crase :: 3\n@ Direito Tributário :: 20q :: confirmada — dado\n+ ISS :: 5\n++ Base de cálculo :: 4");
  const set = (id, v) => { api.$(id).value = v; if (api.$(id).oninput) api.$(id).oninput(); };
  const modo = (q) => { const id = { data: "edNovoModoData", sem: "edNovoModoSem", pre: "edNovoModoPre" }[q]; api.$(id).checked = true; api.$(id).onchange(); };
  api.hubNovo();
  ok(api.$("edNovoPasso1Txt").textContent === api.t("ed_novo_passo1"), "PI3 fora do pré-edital, o passo 1 de sempre");
  modo("pre");
  ok(/edital ANTERIOR/.test(api.$("edNovoPasso1Txt").textContent), "PI3b no pré-edital, o passo 1 fala do edital anterior");
  ok(api.$("btnEdNovoPrompt").textContent === api.t("ed_novo_prompt_bt_pre"), "PI3b' o botão do passo 1 diz que é o plano esperado");
  const opB = Array.from(api.$("edNovoPreBase").children || []);
  ok(opB[0].value === "" && opB.some((o) => o.value === String(base.id)), "PI3c a base lista os editais do app");
  api.$("edNovoPreBase").value = String(base.id);
  const pr = api.hubNovoCopiarPrompt();
  ok(/AINDA NÃO TEM EDITAL/.test(pr) && /CONFIANÇA DE CADA DISCIPLINA/.test(pr) && /provavel — estava no edital anterior/.test(pr) && /PESO DA DISCIPLINA EM QUESTÕES/.test(pr)
    && /@ Direito Tributário :: 20q :: confirmada/.test(pr) && !/2019-08-10/.test(pr) && !/2019-09-10/.test(pr) && !/\[cole aqui o edital anterior/.test(pr),
    "PI3d o prompt do plano esperado: formato, confiança e a base dentro, sem as datas antigas");
  ok(/já com o plano de “ISS Recife 2019”/.test(api.$("edNovoPromptMsg").textContent), "PI3e o aviso diz que a base foi junto");
  api.$("edNovoPreBase").value = "";
  ok(/\[cole aqui o edital anterior deste concurso\]/.test(api.hubNovoCopiarPrompt()), "PI3f sem base, o prompt pede o edital anterior");

  ok(await api.hubNovoUsarBase(async () => true) === false && /Escolha antes/.test(api.$("edNovoPreBaseMsg").textContent), "PI4 sem base escolhida, avisa");
  api.$("edNovoPreBase").value = String(base.id);
  ok(await api.hubNovoUsarBase(async () => true) === true, "PI4b usar como está");
  const pl = api.$("edNovoPlano").value;
  ok(/^& Básicos \| minimo: 50%/.test(pl) && /@ Português :: 10q :: provável — estava no edital de ISS Recife 2019/.test(pl) && /@ Direito Tributário :: 20q :: confirmada — dado/.test(pl)
    && /\+\+ Base de cálculo :: 4/.test(pl) && !/# /.test(pl) && /2 disciplinas e 2 tópicos/.test(api.$("edNovoPreBaseMsg").textContent),
    "PI4c o plano do edital base no passo 2, marcado provável (o que já tinha marca fica): " + pl.split("\n").slice(0, 3).join(" / "));
  set("edNovoPlano", "@ Outro :: 3\n+ x :: 3");
  const perg = [];
  ok(await api.hubNovoUsarBase(async (m) => { perg.push(m); return false; }) === false && perg.length === 1 && /@ Outro/.test(api.$("edNovoPlano").value), "PI4d com plano colado, pergunta antes de trocar");
  api.$("dlgEdNovo").close();

  /* ---- PI5 / PI6: a aba Plano e a agenda ---- */
  const pre = api.edCriar("ISS Recife", txPre);
  api.hubAbrirEdital(pre.id);
  const box = api.$("edPreConf");
  ok(box.hidden === false && api.$("edPconfSel_0").value === "confirmada" && api.$("edPconfSel_1").value === "boato" && api.$("edPconfAg_1") && api.$("edPconfAg_1").checked === false
    && /Fora da agenda agora: Penal/.test(box.textContent) && /notícia/.test(box.textContent),
    "PI5 a aba Plano mostra a marca de cada disciplina, o motivo e o que está fora: " + box.textContent.slice(0, 160));
  ok(/semanas \(\d+ dias\) até o início da janela prevista \(mar\/\d{4} – jun\/\d{4}\)/.test(api.$("edRestam").textContent), "PI8 a bancada do pré-edital conta pela janela prevista (não pede a data): " + api.$("edRestam").textContent);
  api.hubPintarAgenda();
  const av = api.$("edPrevAviso_" + pre.id);
  ok(av && /Fora da agenda por ser boato: Penal/.test(av.textContent), "PI6 a agenda diz o que ficou fora: " + (av && av.textContent));
  api.$("edPconfAg_1").checked = true; api.$("edPconfAg_1").onchange();
  ok(/@ Penal :: 3 :: boato · na agenda — notícia/.test(api.$("editalTexto").value) && /boato · na agenda/.test(api.edAberto().texto) && !/Fora da agenda/.test(api.$("edPrevAviso_" + pre.id).textContent),
    "PI6b incluir grava no texto (e no edital) e a agenda deixa de avisar");
  api.$("edPconfSel_0").value = "provavel"; api.$("edPconfSel_0").onchange();
  ok(/@ Tributário :: 5 :: provável/.test(api.$("editalTexto").value), "PI5b trocar a marca grava no texto");
  api.hubAbrirEdital(base.id);
  ok(api.$("edPreConf").hidden === true, "PI5c edital publicado não mostra a caixa");
  /* PI7: o plano sem nenhum tópico (pré-edital só de boatos) travava o diagnóstico ("genericos[0].motivo") */
  const soBoato = api.edCriar("Só boato", "# Só boato | previsto: " + ano + "-05 | horas: 10\n@ Penal :: 3 :: boato\n+ Crimes :: 3");
  let travou = "";
  try { api.hubAbrirEdital(soBoato.id); } catch (e) { travou = e.message; }
  ok(!travou && api.edAberto().id === soBoato.id && /Fora da agenda agora: Penal/.test(api.$("edPreConf").textContent), "PI7 o pré-edital só de boatos abre sem travar: " + travou);
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
