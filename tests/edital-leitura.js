/* =====================================================================
 * W3 — CONFIANÇA NO QUE FOI LIDO.
 *
 * O relato: "7 disciplinas" na leitura, "4 matérias" no painel (o leitor contava cada "@"; os painéis agrupavam por nome);
 * Português e Direito Financeiro escritos duas vezes eram contados à parte; disciplinas com 0 tópicos passavam; e o
 * "Risco de eliminação", os "buracos" e o Raio-X eram calculados sobre isso com a mesma autoridade de um plano limpo.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O mesmo nome escrito duas vezes é UMA disciplina (soma dos tópicos, quantas vezes apareceu) — e só um jeito de contar.
 *  2. O app diz, com um veredito ("provisório") e os motivos, quando o que leu não é confiável.
 *  3. "Unir as repetidas" junta os blocos SEM perder tópico nem ramo, mantendo o peso e a posição do primeiro.
 *  4. A bancada mostra repetidas e sem-tópico; "Lido" só é verde quando está tudo certo; e uma faixa avisa, em cima dos
 *     painéis calculados (e no Raio-X), que os números são provisórios.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const DUP = [
  "# Duplicado | prova: 2030-05-10 | horas: 20",
  "@ Português :: 10q",
  "@ Direito Financeiro :: 20q",
  "@ Português :: 10q",
  "@ Direito Financeiro :: 20q",
  "+ Orçamento :: 5",
  "+ Receita :: 2",
  "++ PPA :: 4",
  "@ Auditoria Governamental :: 5",
  "+ Achado :: 5",
].join("\n");
const LIMPO = "# Limpo | prova: 2030-05-10 | horas: 20\n@ Português :: 10q\n+ Crase :: 3\n@ Direito Financeiro :: 20q\n+ Orçamento :: 5\n+ Receita :: 2";

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e) => String((e || {}).className || "");
  const tem = (e, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(cls(e));
  const conduzir = async (promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };

  /* ---- L1: contar ---- */
  {
    const r = api.lerEdital(DUP);
    const g = api.edAgruparDisciplinas(r);
    ok(r.disciplinas.length === 5 && g.length === 3 && api.edNomesUnicos(r) === 3, "L1a 5 linhas '@' sao 3 disciplinas: " + r.disciplinas.length + " x " + g.length);
    const pt = g.find((x) => x.nome === "Português"), df = g.find((x) => x.nome === "Direito Financeiro");
    ok(pt.vezes === 2 && pt.topicos === 0 && df.vezes === 2 && df.topicos === 2, "L1b os tópicos são somados e as vezes contadas: " + JSON.stringify([pt.vezes, pt.topicos, df.vezes, df.topicos]));
    ok(api.edNomesUnicos(api.lerEdital("@ Português :: 3\n+ a :: 3\n@ PORTUGUÊS :: 3\n+ b :: 3")) === 1, "L1c a comparação ignora caixa e acento");
    ok(api.edNomesUnicos(api.lerEdital("")) === 0, "L1d edital vazio: zero");
  }

  /* ---- L2: o veredito ---- */
  {
    const q = api.edQualidadeLeitura(api.lerEdital(DUP));
    ok(q.provisorio === true && q.motivos.map((m) => m.id).join(",") === "repetida,sem_topico" && q.unicas === 3, "L2a duplicado + sem topico: provisorio, com os dois motivos: " + JSON.stringify(q.motivos.map((m) => m.id)));
    ok(q.motivos[0].n === 2 && q.motivos[0].nomes.join() === "Português,Direito Financeiro" && q.motivos[1].n === 1 && q.motivos[1].nomes.join() === "Português", "L2b os motivos dizem QUANTAS e QUAIS (2 repetidas; 1 sem topico): " + JSON.stringify(q.motivos));
    const l = api.edQualidadeLeitura(api.lerEdital(LIMPO));
    ok(l.provisorio === false && l.motivos.length === 0, "L2c plano limpo: nada de aviso");
    ok(api.edQualidadeLeitura(api.lerEdital("# x\n" + api.edPromptEdital(true))).motivos[0].id === "prompt", "L2d o prompt colado e' o primeiro motivo");
    ok(api.edQualidadeLeitura(api.lerEdital("@ Nome da disciplina :: 3\n+ x :: 3")).motivos[0].id === "modelo", "L2e nome de exemplo e' motivo");
    const prosa = Array.from({ length: 12 }, (_, i) => "Direito Penal: 1. Lei penal " + i).join("\n");
    ok(api.edQualidadeLeitura(api.lerEdital(prosa)).motivos[0].id === "cru", "L2f texto cru e' motivo");
    const base = Array.from({ length: 12 }, (_, i) => "@ D" + i + " :: 3\n+ t" + i + " :: 3").join("\n");   /* 24 linhas uteis */
    ok(api.edQualidadeLeitura(api.lerEdital(base + "\n" + Array.from({ length: 5 }, (_, i) => "solta " + i).join("\n"))).provisorio === false, "L2g 5 linhas ignoradas num plano de 24 (menos de 1/4): nao incomoda");
    const q6 = api.edQualidadeLeitura(api.lerEdital(base + "\n" + Array.from({ length: 6 }, (_, i) => "solta " + i).join("\n")));
    ok(q6.provisorio === true && q6.motivos[0].id === "ignoradas" && q6.motivos[0].n === 6, "L2h 6 linhas ignoradas = 1/4 do que foi lido: avisa");
    ok(api.edQualidadeLeitura(api.lerEdital(base + "\nsolta 1\nsolta 2\nsolta 3\nsolta 4")).provisorio === false, "L2i 4 linhas ignoradas: abaixo do minimo de 5");
    /* plano PEQUENO: 2 linhas soltas sao 1/1 das uteis (proporcao alta), mas ainda assim < 5: nao incomoda */
    ok(api.edQualidadeLeitura(api.lerEdital("@ A :: 3\n+ a :: 3\nsolta 1\nsolta 2")).provisorio === false, "L2j plano pequeno com 2 linhas soltas: o minimo de 5 vale mesmo quando a proporcao e' alta");
  }

  /* ---- L3: unir as repetidas ---- */
  {
    const unido = api.edUnirRepetidas(DUP);
    const r = api.lerEdital(unido);
    ok(r.disciplinas.map((d) => d.nome).join("|") === "Português|Direito Financeiro|Auditoria Governamental", "L3a cada disciplina uma vez, na ordem do primeiro: " + r.disciplinas.map((d) => d.nome));
    const df = r.disciplinas[1];
    ok(df.topicos.map((x) => x.nome).join() === "Orçamento,Receita" && df.topicos[1].ramos && df.topicos[1].ramos.length === 1 && df.topicos[1].ramos[0].nome === "PPA", "L3b os topicos (e o ramo) da repetida foram para a primeira: " + JSON.stringify(df.topicos.map((x) => x.nome)));
    const cont = (x) => api.lerEdital(x).disciplinas.reduce((a, d) => a + d.topicos.length, 0);
    ok(cont(unido) === cont(DUP) && cont(DUP) === 3, "L3c nenhum topico se perdeu: " + cont(DUP) + " -> " + cont(unido));
    ok(api.edUnirRepetidas(unido) === unido, "L3d idempotente");
    ok(api.edUnirRepetidas(LIMPO) === LIMPO && api.edUnirRepetidas("") === "", "L3e sem repetidas devolve o texto IGUAL");
    ok(unido.indexOf("# Duplicado") === 0 && /Português :: 10q/.test(unido) && (unido.match(/@ Português/g) || []).length === 1, "L3f o cabecalho fica e a linha '@' repetida some");
    const pesos = api.lerEdital(api.edUnirRepetidas("@ A :: 3\n+ a :: 3\n@ A :: 5\n+ b :: 4")).disciplinas;
    ok(pesos.length === 1 && pesos[0].peso === 3 && pesos[0].topicos.length === 2, "L3g o peso do PRIMEIRO manda: " + JSON.stringify(pesos.map((d) => [d.peso, d.topicos.length])));
    const comBloco = api.edUnirRepetidas("& Básicos | minimo: 50%\n@ A :: 3\n+ a :: 3\n\n& Específicos | minimo: 60%\n@ B :: 3\n+ c :: 3\n@ A :: 3\n+ b :: 3");
    const rb = api.lerEdital(comBloco);
    ok(/\+ a :: 3\n\+ b :: 3\n\n& Específicos/.test(comBloco), "L3h2 os topicos trazidos entram logo depois do ultimo topico do primeiro bloco (antes da linha em branco e do proximo '&'): " + JSON.stringify(comBloco));
    ok(rb.blocos.length === 2 && rb.disciplinas.length === 2 && rb.disciplinas[0].topicos.length === 2 && /^& Específicos/m.test(comBloco), "L3h as linhas '&' dos blocos ficam onde estavam: " + JSON.stringify(rb.disciplinas.map((d) => d.topicos.length)));
    ok(api.edUnirRepetidas("@ A :: 3\r\n+ a :: 3\r\n@ A :: 3\r\n+ b :: 3").split("\n").filter((x) => /^@/.test(x.trim())).length === 1, "L3i com fim de linha do Windows tambem");
  }

  /* ---- L4: procurar erros ---- */
  {
    const r = api.lerEdital(DUP);
    const a = api.diagnosticoPlano(r, api.montarPlano(r, { horas: 20, prova: "2030-05-10" }));
    const rep = a.find((x) => x.id === "disciplina_repetida"), sem = a.find((x) => x.id === "sem_topico");
    ok(rep && rep.grave === true && /Direito Financeiro \(2×\)/.test(rep.msg) && /Português \(2×\)/.test(rep.msg), "L4a repetida e' GRAVE e diz quantas vezes: " + (rep && rep.msg));
    ok(sem && sem.grave === false && /Português/.test(sem.msg), "L4b sem topico e' atencao e diz quais");
    const l = api.lerEdital(LIMPO);
    ok(!api.diagnosticoPlano(l, api.montarPlano(l, { horas: 20, prova: "2030-05-10" })).some((x) => x.id === "disciplina_repetida" || x.id === "sem_topico"), "L4c plano limpo: nenhum dos dois");
  }

  /* ---- L5: a bancada e a faixa dos painéis ---- */
  {
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("Duplicado", DUP);
    api.hubAbrirEdital(ed.id);
    api.edRender();
    const sug = Array.from(api.$("editalSug").children).map((s) => s.textContent);
    ok(sug.some((s) => /Lido: 3 disciplinas e 3 tópicos/.test(s)), "L5a 'Lido' conta 3 disciplinas (nao 5): " + sug[0]);
    ok(/^3 disciplinas/.test(api.$("edResumo").textContent), "L5b o resumo do painel tambem diz 3: " + api.$("edResumo").textContent);
    const lido = Array.from(api.$("editalSug").children).find((s) => /Lido:/.test(s.textContent));
    ok(lido && tem(lido.children[0], "dot-org"), "L5c com repetida/sem topico 'Lido' fica ambar, nao verde");
    ok(sug.some((s) => /escrita\(s\) mais de uma vez: Português \(2×\), Direito Financeiro \(2×\)/.test(s)) && sug.some((s) => /sem nenhum tópico: Português/.test(s)), "L5d a bancada lista as repetidas e a sem topico: " + sug.join(" | "));
    const item = Array.from(api.$("editalSug").children).find((s) => /mais de uma vez/.test(s.textContent));
    const fix = achar(item, (b) => b.textContent === api.t("ed_fix_rep"))[0];
    ok(!!fix, "L5e ha o botao 'Unir as repetidas'");
    const aviso = achar(api.$("edPainel"), (e) => tem(e, "ed-aviso-leitura"))[0];
    ok(aviso && tem(aviso, "leit-leve") && /provisórios/.test(aviso.children[0].textContent) && /Português/.test(aviso.children[1].textContent), "L5f a faixa 'plano com problemas de leitura' aparece no painel, em tom leve, e diz quais: " + (aviso && aviso.textContent.slice(0, 120)));
    ok(api.$("edPainel").children[1] === aviso, "L5g e fica logo depois da identidade do edital, antes dos paineis calculados");
    ok(/ed-acao-destaque/.test(cls(api.$("btnEditalColar"))), "L5h o botao 'Revisar o edital com a IA' ganha destaque");
    const ver = achar(aviso, (b) => b.textContent === api.t("ed_leit_ver"))[0];
    ok(!!ver, "L5i a faixa tem 'ver o que esta errado'");
    ver.onclick();
    ok(Array.from(api.$("dpLista").children).some((x) => /mais de uma vez/.test(x.textContent)), "L5j e ele abre o diagnostico com a repetida");
    ok(/Estado: 3 disciplinas, 3 tópicos/.test(api.$("dpResumo").textContent), "L5j2 o resumo do diagnostico tambem diz 3 disciplinas: " + api.$("dpResumo").textContent);
    await conduzir(fix.onclick());
    ok((api.$("editalTexto").value.match(/@ Português/g) || []).length === 1 && api.lerEdital(api.$("editalTexto").value).disciplinas.length === 3, "L5k 'Unir as repetidas' junta no texto da bancada");
    const sug2 = Array.from(api.$("editalSug").children).map((s) => s.textContent);
    ok(!sug2.some((s) => /mais de uma vez/.test(s)) && sug2.some((s) => /sem nenhum tópico: Português/.test(s)), "L5l a repetida some; a disciplina sem topico continua avisada");
    /* so' repetida, ou so' sem topico: 'Lido' tambem deixa de ser verde (cada um sozinho basta) */
    const lidoDe = (txt) => { api.$("editalTexto").value = txt; api.edRender(); return Array.from(api.$("editalSug").children).find((s) => /Lido:/.test(s.textContent)); };
    const soRep = lidoDe("@ A :: 3\n+ a :: 3\n@ A :: 3\n+ b :: 3");
    ok(soRep && tem(soRep.children[0], "dot-org") && /Lido: 1 disciplinas e 2 tópicos/.test(soRep.textContent), "L5m0 so' repetida (sem topico vazio): 'Lido' ambar e conta 1 disciplina: " + (soRep && soRep.textContent.slice(0, 40)));
    const soSem = lidoDe("@ A :: 3\n+ a :: 3\n@ B :: 3");
    ok(soSem && tem(soSem.children[0], "dot-org"), "L5m1 so' disciplina sem topico: 'Lido' ambar");
    /* plano limpo: nada disso */
    api.$("editalTexto").value = LIMPO; api.edRender();
    ok(!achar(api.$("edPainel"), (e) => tem(e, "ed-aviso-leitura")).length && !/ed-acao-destaque/.test(cls(api.$("btnEditalColar"))), "L5m plano limpo: sem faixa e sem destaque");
    const lido2 = Array.from(api.$("editalSug").children).find((s) => /Lido:/.test(s.textContent));
    ok(lido2 && tem(lido2.children[0], "dot-green"), "L5n e 'Lido' volta ao verde");
    /* o prompt: NADA e' calculado (zero disciplinas) — o painel mostra o vazio, e o alerta vermelho fica na bancada */
    api.$("editalTexto").value = "# x | horas: 20\n" + api.edPromptEdital(true); api.edRender();
    ok(api.$("edPainel").children.length === 1 && tem(api.$("edPainel").children[0], "esq-vazio"), "L5o o prompt colado: o painel nao calcula NADA (so' o 'cole o edital'), em vez de risco de eliminacao e buracos inventados");
    ok(/PROMPT/.test(Array.from(api.$("editalSug").children)[0].textContent) && tem(Array.from(api.$("editalSug").children)[0].children[0], "dot-red"), "L5p e a bancada mostra o alerta vermelho do prompt");
    const faixa = api.edAvisoLeitura(api.lerEdital("# x\n" + api.edPromptEdital(true)));
    ok(faixa && tem(faixa, "leit-grave") && /PROMPT/.test(faixa.children[1].textContent), "L5q (a faixa, se algum painel a usar) para o prompt e' GRAVE e diz 'PROMPT'");
    const faixa2 = api.edAvisoLeitura(api.lerEdital(DUP));
    ok(faixa2 && tem(faixa2, "leit-leve"), "L5r repetida/sem topico: faixa leve");
  }

  /* ---- L6: Raio-X ---- */
  {
    api.matIniciar(); api.edIniciar();
    api.editaisAtuais.slice().forEach((x) => api.edApagar(x.id));
    const ed = api.edCriar("Raio", DUP);
    api.hubAbrirEdital(ed.id);
    api.plIniciar();
    api.plAbrir();
    const aviso = achar(api.$("plogCorpo"), (e) => tem(e, "ed-aviso-leitura"))[0];
    ok(aviso && /provisórios/.test(aviso.children[0].textContent) && achar(aviso, (b) => b.textContent === api.t("ed_leit_ver")).length === 0, "L6a o Raio-X tem a mesma faixa, sem o botao (que e' do edital aberto): " + (aviso && aviso.textContent.slice(0, 80)));
    api.edApagar(ed.id);
    const ed2 = api.edCriar("Raio limpo", LIMPO);
    api.hubAbrirEdital(ed2.id);
    api.plAbrir();
    ok(!achar(api.$("plogCorpo"), (e) => tem(e, "ed-aviso-leitura")).length, "L6b com plano limpo o Raio-X nao tem faixa");
  }

  /* ---- L7: o Novo edital conta igual ---- */
  {
    const e = api.hubNovoEstadoPlano(DUP.split("\n").slice(1).join("\n"));
    ok(e.d === 3 && e.t === 3 && e.rep === 2 && e.sem === 1 && e.estado === "atencao" && e.disc.find((x) => x.nome === "Português").vezes === 2, "L7a no Novo edital: 3 disciplinas (nao 5), 2 repetidas, 1 sem topico: " + JSON.stringify([e.d, e.t, e.rep, e.sem]));
    /* a mesma disciplina TRES vezes e' UMA repetida (nao duas) e o chip diz quantas vezes */
    api.hubIniciar(); api.hubNovo();
    api.$("edNovoPlano").value = "@ A :: 3\n+ a :: 3\n@ A :: 3\n+ b :: 3\n@ A :: 3\n+ c :: 3\n@ B :: 3\n+ d :: 3"; api.$("edNovoPlano").oninput();
    const e3 = api.hubNovoEstadoPlano(api.$("edNovoPlano").value);
    ok(e3.d === 2 && e3.rep === 1 && e3.disc[0].vezes === 3 && e3.disc[0].topicos === 3, "L7b tres vezes a mesma disciplina: 1 repetida com 3 topicos somados: " + JSON.stringify([e3.d, e3.rep, e3.disc[0]]));
    const chips = Array.from(api.$("edNovoEntendi").children);
    ok(chips[0].textContent === "A · 3 ×3" && /chip-atencao/.test(cls(chips[0])) && chips[0].title === api.t("ed_novo_chip_rep", { n: 3 }) && chips[1].textContent === "B · 1" && !/chip-/.test(cls(chips[1])), "L7c o chip da repetida traz '×3', fica ambar e explica: " + chips.map((c) => c.textContent + "|" + cls(c)));
    ok(/Entendido, mas confira: 1 disciplina\(s\) repetida\(s\)/.test(api.$("edNovoSemTxt").textContent) && /ambar|atencao/.test(cls(api.$("edNovoSem"))), "L7d o semaforo do Novo edital fica ambar e diz '1 disciplina repetida'");
  }

  /* ---- Y2: Passo 0 da revisão — "O que o app achou", dentro de "Revisar o edital com a IA" ---- */
  {
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("Passo0", DUP);
    api.hubAbrirEdital(ed.id);
    api.edRender();
    const btn = api.$("btnEditalColar");
    const att = (e, k) => (e.getAttribute ? e.getAttribute(k) : null);
    ok(att(btn, "data-n") && Number(att(btn, "data-n")) >= 2, "Y2a o botão 'Revisar o edital com a IA' ganha o selo com a contagem de pontos: " + att(btn, "data-n"));
    btn.onclick();
    const res = api.$("edAchRes").textContent;
    ok(/ponto\(s\) a revisar · \d+ grave\(s\)/.test(res) && cls(api.$("edAchRes")).includes("ed-ach-grave"), "Y2b o resumo diz quantos pontos e quantos graves (e fica vermelho): " + res);
    ok(api.$("edAchLista").hidden === false && api.$("btnEdAchAbrir").getAttribute("aria-expanded") === "true" && api.$("edAchSeta").textContent === "▾", "Y2c com problema GRAVE a lista já vem aberta");
    const itens = Array.from(api.$("edAchLista").children);
    const rep = itens.find((x) => /mais de uma vez/.test(x.textContent));
    ok(rep && tem(achar(rep, (e) => tem(e, "sug-quem"))[0], "quem-app") && achar(rep, (b) => b.textContent === api.t("ed_fix_rep")).length === 1, "Y2d 'disciplina repetida': marcada como do app, com o botão 'Unir as repetidas'");
    ok(achar(rep, (b) => b.textContent === api.t("goto_error")).length === 1, "Y2e e leva à linha ('Ver no texto')");
    const sem = itens.find((x) => /sem nenhum tópico/.test(x.textContent));
    ok(sem && tem(achar(sem, (e) => tem(e, "sug-quem"))[0], "quem-voce") && achar(sem, (e) => /btn-azul/.test(cls(e))).length === 0, "Y2f 'sem tópico': decisão da pessoa (você decide), sem botão de conserto");
    /* corrigir pelo próprio passo 0 repinta a lista */
    const fix = achar(rep, (b) => b.textContent === api.t("ed_fix_rep"))[0];
    await conduzir(fix.onclick());
    ok((api.$("editalTexto").value.match(/@ Português/g) || []).length === 1, "Y2g o botão corrige o texto da bancada");
    ok(!Array.from(api.$("edAchLista").children).some((x) => /mais de uma vez/.test(x.textContent)), "Y2h e a lista é repintada sem o que foi corrigido");
    /* texto que o prompt colado — vira só aquele achado, do app */
    api.$("editalTexto").value = "# x | horas: 20\n" + api.edPromptEdital(true); api.edRender(); api.edAchadosPintar();
    const unico = Array.from(api.$("edAchLista").children);
    ok(unico.length === 1 && /PROMPT/.test(unico[0].textContent) && achar(unico[0], (b) => /btn-azul/.test(cls(b)) && b.textContent === api.t("ed_fix_prompt")).length === 1, "Y2i o prompt colado: um item só, com 'Tirar o prompt do texto'");

    /* plano limpo: nada a dizer, sem selo, lista recolhida */
    const LIMPO5 = ["# C | prova: 2030-05-10 | horas: 20"].concat([4, 4, 4, 3, 3].map((p, i) => ["@ D" + i + " :: " + p, "+ t" + i + "a :: 3 :: cai sempre", "+ t" + i + "b :: 3 :: cai bastante", "+ t" + i + "c :: 3 :: cai pouco"].join("\n"))).join("\n");
    api.$("editalTexto").value = LIMPO5; api.edRender(); api.edAchadosPintar();
    ok(api.edAchadosAtuais().length === 0 && att(btn, "data-n") === null, "Y2j plano limpo: nenhum achado e SEM selo no botão: " + api.edAchadosAtuais().map((x) => x.id));
    ok(/nenhum problema encontrado/.test(api.$("edAchRes").textContent) && cls(api.$("edAchRes")).includes("ed-ach-ok") && api.$("edAchLista").hidden === true, "Y2k e o resumo diz 'nenhum problema' (verde), com a lista recolhida");
    api.$("editalTexto").value = ""; api.edRender(); api.edAchadosPintar();
    ok(att(btn, "data-n") === null && api.$("edAchRes").textContent === "" && /vazio/.test(api.$("edAchLista").textContent), "Y2l texto vazio: sem selo, sem resumo, e a lista diz que o plano está vazio");

    /* só aviso leve: lista recolhida, mas o resumo conta */
    api.$("editalTexto").value = LIMPO5.replace("+ t0a ::", "- t0a ::"); api.edRender(); api.edAchadosPintar();
    const leve = api.edAchadosAtuais();
    ok(leve.length === 1 && leve[0].id === "marcador" && !leve[0].grave, "Y2m só marcador torto: um aviso leve do app: " + leve.map((x) => x.id));
    ok(api.$("edAchLista").hidden === true && /1 ponto\(s\) a revisar · 0 grave\(s\)/.test(api.$("edAchRes").textContent) && !cls(api.$("edAchRes")).includes("ed-ach-grave") && att(btn, "data-n") === "1", "Y2n aviso leve: lista recolhida, resumo sem vermelho e selo '1'");
    api.$("btnEdAchAbrir").onclick();
    ok(api.$("edAchLista").hidden === false && api.$("edAchSeta").textContent === "▾", "Y2o o cabeçalho abre a lista; de novo, recolhe");
    api.$("btnEdAchAbrir").onclick();
    ok(api.$("edAchLista").hidden === true && api.$("edAchSeta").textContent === "▸" && api.$("btnEdAchAbrir").getAttribute("aria-expanded") === "false", "Y2o2 e recolhe de novo");
    /* o que é da IA não leva botão */
    const IA = LIMPO5.replace(/ :: [345](?= |$)/g, " :: 3");
    api.$("editalTexto").value = ["# C | prova: 2030-05-10 | horas: 20", "@ A :: 3", "+ a1", "+ a2", "+ a3", "@ B :: 3", "+ b1", "+ b2", "+ b3", "@ C :: 3", "+ c1", "+ c2", "+ c3"].join("\n"); api.edRender(); api.edAchadosPintar();
    const ia = Array.from(api.$("edAchLista").children).filter((x) => tem(achar(x, (e) => tem(e, "sug-quem"))[0], "quem-ia"));
    ok(ia.length >= 2 && ia.every((x) => achar(x, (e) => tem(e, "sug-acao")).length === 0), "Y2p o que é da IA (pesos iguais, sem peso…) aparece marcado 'precisa da IA' e SEM botão");
    /* o rótulo de QUEM resolve, a cor da bolinha, o texto manda nas datas e o "ver no texto" fecha o diálogo */
    api.$("editalTexto").value = DUP; api.edRender(); api.$("btnEditalColar").onclick();
    const todos = Array.from(api.$("edAchLista").children);
    const quemTxt = (x) => achar(x, (e) => tem(e, "sug-quem"))[0].textContent;
    const rep2 = todos.find((x) => /mais de uma vez/.test(x.textContent)), sem2 = todos.find((x) => /sem nenhum tópico/.test(x.textContent));
    ok(quemTxt(rep2) === api.t("quem_app") && quemTxt(sem2) === api.t("ed_ach_quem_voce"), "Y2r o rótulo diz QUEM resolve: 'o app corrige' / 'você decide': " + quemTxt(rep2) + " | " + quemTxt(sem2));
    ok(tem(achar(rep2, (e) => tem(e, "dot"))[0], "dot-red") && tem(achar(sem2, (e) => tem(e, "dot"))[0], "dot-org"), "Y2s grave = bolinha vermelha; atenção = laranja");
    const iaItem = (() => { api.$("editalTexto").value = ["# C | prova: 2030-05-10 | horas: 20", "@ A :: 3", "+ a1", "+ a2", "+ a3", "@ B :: 3", "+ b1", "+ b2", "+ b3", "@ C :: 3", "+ c1", "+ c2", "+ c3"].join("\n"); api.edRender(); api.edAchadosPintar(); return Array.from(api.$("edAchLista").children).find((x) => /precisa da IA/.test(quemTxt(x))); })();
    ok(!!iaItem && quemTxt(iaItem) === api.t("quem_ia"), "Y2t o rótulo 'precisa da IA' é o dos itens de peso/motivo");
    api.$("editalTexto").value = DUP; api.edRender(); api.edAchadosPintar();
    const irL = achar(Array.from(api.$("edAchLista").children).find((x) => /mais de uma vez/.test(x.textContent)), (b) => b.textContent === api.t("goto_error"))[0];
    api.$("dlgEdColar").open = true; irL.onclick();
    ok(api.$("dlgEdColar").open === false, "Y2u 'Ver no texto' fecha o diálogo (senão a linha fica escondida atrás dele)");
    /* o texto manda: data e horas do cabeçalho vencem os campos; sem data no cabeçalho, vale o campo (e o memo percebe a troca) */
    const iso = (dias) => { const d = new Date(Date.now() + 86400000 * dias); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const CORPO = LIMPO5.split("\n").slice(1).join("\n");
    api.$("editalTexto").value = "# C | prova: " + iso(60) + " | horas: 20\n" + CORPO; api.edRender();
    api.$("edProva").value = "2020-01-01"; api.$("edHoras").value = 1;
    ok(!api.edAchadosAtuais().some((x) => x.id === "nao_cabe"), "Y2v cabeçalho do texto (prova em 60 dias, 20h) vence campos desatualizados (2020, 1h): " + api.edAchadosAtuais().map((x) => x.id));
    api.$("editalTexto").value = "# C | horas: 1\n" + CORPO;
    api.$("edProva").value = iso(400);
    const longe = api.edAchadosAtuais().map((x) => x.id);
    api.$("edProva").value = iso(35);
    const perto = api.edAchadosAtuais().map((x) => x.id);
    ok(!longe.includes("nao_cabe") && perto.includes("nao_cabe"), "Y2w sem data no cabeçalho vale o campo — e trocar o campo recalcula (o memo olha a data): " + longe + " | " + perto);
    /* memo: o mesmo texto não recalcula; texto novo, sim */
    const m1 = api.edAchadosAtuais(), m2 = api.edAchadosAtuais();
    api.$("editalTexto").value += "\n+ c4"; const m3 = api.edAchadosAtuais();
    ok(m1 === m2 && m3 !== m1, "Y2q o resultado é calculado uma vez por texto (e muda quando o texto muda)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
