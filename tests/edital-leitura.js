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
  const { api, janela } = rodar();
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
    ok(api.$("dlgEdColar").open === true && Array.from(api.$("edAchLista").children).some((x) => /mais de uma vez/.test(x.textContent)), "L5j e ele abre a REVISÃO COM A IA (passo 0) com a repetida");
    ok(/ponto\(s\) a revisar/.test(api.$("edAchRes").textContent), "L5j2 e o passo 0 resume quantos pontos tem: " + api.$("edAchRes").textContent);
    api.$("dlgEdColar").open = false;
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

  /* ---- Y2b: onde copiar, onde colar — dois cartões, semáforo na caixa de colar e guarda no editor ---- */
  {
    api.matIniciar(); api.edIniciar();
    const PLANO = ["# C | prova: 2030-05-10 | horas: 20", "@ Português :: 5", "+ Crase :: 3 :: m", "+ Verbos :: 4 :: m", "@ Direito :: 3", "+ Atos :: 3 :: m", "+ Poderes :: 2 :: m", "@ Auditoria :: 4", "+ Achado :: 5 :: m", "+ Risco :: 3 :: m"].join("\n");
    const ed = api.edCriar("Colar", PLANO);
    api.hubAbrirEdital(ed.id);
    api.edRender();
    const sem = () => ({ c: cls(api.$("edColarSem")), t: api.$("edColarSemTxt").textContent, ico: api.$("edColarSemIco").textContent, ta: cls(api.$("edColarTexto")), bt: Array.from(api.$("edColarSemAcoes").children).map((b) => b.id), ap: api.$("btnEdColarAplicar").disabled });
    const colar = (txt) => { api.$("edColarTexto").value = txt; api.edConferirColagem(); return sem(); };
    api.$("btnEditalColar").onclick();
    /* abrir: tudo no zero */
    let x = sem();
    ok(tem(api.$("edColarSem"), "sem-vazio") && x.ico === "○" && /RESPOSTA da IA/.test(x.t) && x.ap === true && tem(api.$("edColarTexto"), "ta-vazio"), "Y2b-a ao abrir: semáforo cinza ('cole só a RESPOSTA') e 'Substituir o plano' desligado: " + JSON.stringify(x));
    ok(api.$("edColarPasso1").className === "ednovo-passo" && api.$("edColarPasso2").className === "ednovo-passo" && api.$("edColarPedidoMsg").textContent === "", "Y2b-b ao abrir nenhum passo está marcado");
    /* passo 1: copiar marca o passo e diz isso NA TELA */
    await conduzir(api.$("btnEdColarPedido").onclick());
    ok(api.$("edColarPasso1").className === "ednovo-passo feito" && api.$("edColarPasso2").className === "ednovo-passo ativo" && /✓ Copiado — \d+ linhas, \d+ caracteres/.test(api.$("edColarPedidoMsg").textContent), "Y2b-c copiar marca o passo 1 (✓) e destaca o 2, com a mensagem no próprio cartão: " + api.$("edColarPedidoMsg").textContent);
    /* o que se cola: cada tipo de erro tem a sua cor e a sua frase */
    x = colar(PLANO);
    ok(tem(api.$("edColarSem"), "sem-atencao") && /IGUAL ao plano que você já tem/.test(x.t) && x.ap === true && x.bt.includes("btnEdColarLimparSem"), "Y2b-d colou o PRÓPRIO plano de volta: âmbar, diz que é igual, desliga 'Substituir' e oferece limpar: " + JSON.stringify(x));
    ok(colar(PLANO + "\n\n\r\n").t === x.t && colar(PLANO.replace(/\n/g, "\r\n")).c.includes("sem-atencao"), "Y2b-e 'igual' ignora linhas em branco e quebras de linha do Windows");
    x = colar("# x | horas: 20\n" + api.edPromptEdital(true));
    ok(tem(api.$("edColarSem"), "sem-erro") && x.ico === "⛔" && x.ta.includes("ta-erro") && x.ap === true && /PROMPT/.test(x.t), "Y2b-f colou o PEDIDO por engano: vermelho, ⛔, campo vermelho, 'Substituir' desligado");
    const CRU = ["CONHECIMENTOS BÁSICOS", "LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos. 2 Reconhecimento de tipos e gêneros textuais. 3 Pontuação.", "TECNOLOGIA DA INFORMAÇÃO: 1 MSOffice 365. 2 Redes de computadores. 2.1 Conceitos básicos. 2.2 Topologias."].join("\n");
    x = colar(CRU);
    ok(tem(api.$("edColarSem"), "sem-atencao") && /Parece o edital como saiu/.test(x.t) && x.ap === true && x.bt.includes("btnEdColarEstruturar") && x.bt.includes("btnEdColarLimparSem"), "Y2b-g colou o edital CRU: âmbar, oferece 'Estruturar aqui (sem IA)' e limpar, 'Substituir' desligado: " + JSON.stringify(x));
    api.$("btnEdColarEstruturar").onclick();
    x = sem();
    ok(/^& Conhecimentos Básicos/.test(api.$("edColarTexto").value) && tem(api.$("edColarSem"), "sem-ok") && x.ap === false && x.bt.includes("btnEdColarDesestruturar") && /Entendi: 2 disciplina\(s\) e 5 tópico\(s\)/.test(x.t), "Y2b-h estruturou: verde, 'Substituir' liga e aparece 'voltar ao texto original': " + JSON.stringify(x));
    api.$("btnEdColarDesestruturar").onclick();
    ok(api.$("edColarTexto").value === CRU && tem(api.$("edColarSem"), "sem-atencao"), "Y2b-i voltar devolve EXATAMENTE o texto colado");
    /* a resposta boa */
    const BOA = PLANO.replace("+ Crase :: 3 :: m", "+ Crase :: 4 :: m");
    x = colar(BOA);
    ok(tem(api.$("edColarSem"), "sem-ok") && x.ico === "✓" && /Entendi: 3 disciplina\(s\) e 6 tópico\(s\)\. Confira a comparação/.test(x.t) && x.ap === false && x.ta.includes("ta-ok") && api.$("edColarPasso2").className === "ednovo-passo feito", "Y2b-j resposta boa: verde, ✓, diz o que entendeu, liga 'Substituir' e fecha o passo 2: " + JSON.stringify(x));
    x = colar(BOA + "\nlinha solta sem sentido\noutra linha solta");
    ok(tem(api.$("edColarSem"), "sem-atencao") && /confira: 2 linha\(s\) ignorada\(s\)/.test(x.t) && x.ap === false, "Y2b-k entendeu mas há linhas ignoradas: âmbar com o motivo, e dá para aplicar (a conferência decide): " + x.t);
    x = colar("");
    ok(tem(api.$("edColarSem"), "sem-vazio") && x.ap === true && x.bt.length === 0, "Y2b-l limpar a caixa volta ao cinza e desliga o botão");
    /* abrir de novo esquece o original guardado e o estado dos passos */
    colar(CRU); api.$("btnEdColarEstruturar").onclick();
    api.$("btnEditalColar").onclick();
    ok(api.$("edColarTexto").value === "" && !Array.from(api.$("edColarSemAcoes").children).some((b) => b.id === "btnEdColarDesestruturar") && api.$("edColarPasso1").className === "ednovo-passo", "Y2b-m abrir de novo zera a caixa, o 'voltar' e os passos");

    /* o EDITOR da bancada: colar a resposta da IA ali pergunta antes */
    const ev = (txt) => ({ clipboardData: { getData: () => txt }, preventDefault() { this.parou = true; }, parou: false });
    api.$("editalTexto").value = PLANO; api.edRender();
    const e1 = ev("só uma linha"); await api.edColarNoEditor(e1);
    ok(e1.parou === false, "Y2b-n colar um trecho curto no editor: normal (não intercepta)");
    const e2 = ev("texto qualquer sem estrutura\nlinha dois\nlinha três\nlinha quatro\nlinha cinco\nlinha seis\nlinha sete"); await api.edColarNoEditor(e2);
    ok(e2.parou === false, "Y2b-o texto longo que NÃO tem disciplinas: colar normal");
    api.edColarModoDefinir("organizar");
    const e3 = ev(BOA); const p3 = api.edColarNoEditor(e3);
    ok(e3.parou === true, "Y2b-p texto longo com disciplinas (parece a resposta da IA) com plano existente: intercepta");
    const r3 = await conduzir(p3);
    ok(r3 === "revisar" && api.$("edColarTexto").value === BOA && api.$("editalTexto").value === PLANO && api.$("dlgEdColar").open === true, "Y2b-q 'sim': o texto vai para o passo 2 da revisão e o plano da bancada NÃO muda");
    ok(tem(api.$("edColarSem"), "sem-ok") && api.$("edColarPasso1").className === "ednovo-passo feito", "Y2b-r e a revisão abre já com o semáforo verde e o passo 1 dado como feito");
    ok(api.$("btnEdColarModoCor").getAttribute("aria-pressed") === "true", "Y2b-r2 e já abre no modo 'Corrigir o plano que já tenho' (o texto colado é uma resposta, não um edital novo)");
    api.$("dlgEdColar").open = false;
    api.$("editalTexto").value = PLANO; api.$("editalTexto").selectionStart = 0; api.$("editalTexto").selectionEnd = 0;
    const e4 = ev(BOA); const p4 = api.edColarNoEditor(e4);
    let pronto = false; p4.then(() => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(false); } catch (e) {} }
    ok((await p4) === "colou" && api.$("editalTexto").value === BOA + PLANO, "Y2b-s 'não': cola no editor do jeito de sempre, no ponto do cursor");
    /* plano vazio: colar à vontade (é como se começa) */
    api.$("editalTexto").value = "";
    const e5 = ev(BOA); await api.edColarNoEditor(e5);
    ok(e5.parou === false, "Y2b-t editor vazio: colar à vontade, sem pergunta");
    /* copiar FALHOU: a tela não diz que copiou, e o passo 1 não é marcado */
    api.$("btnEditalColar").onclick();
    const wAntes = janela.navigator.clipboard.writeText;
    janela.navigator.clipboard.writeText = async () => { throw new Error("negado"); };
    await conduzir(api.$("btnEdColarPedido").onclick());
    janela.navigator.clipboard.writeText = wAntes;
    ok(api.$("edColarPedidoMsg").textContent === "" && api.$("edColarPasso1").className === "ednovo-passo" && api.$("edColarPasso2").className === "ednovo-passo", "Y2b-v copiar falhou: nada de '✓ Copiado' e nenhum passo marcado");
    /* texto cru SEM numeração aproveitável: continua cru e NÃO oferece estruturar */
    const SEMNUM = Array.from({ length: 12 }, () => "Frase solta sem estrutura nenhuma para virar edital").join("\n");
    x = colar(SEMNUM);
    ok(tem(api.$("edColarSem"), "sem-atencao") && x.ap === true && !x.bt.includes("btnEdColarEstruturar") && x.bt.includes("btnEdColarLimparSem"), "Y2b-w cru sem numeração: só 'limpar' (estruturar não tem o que fazer): " + JSON.stringify(x.bt));
    /* colar um trecho PEQUENO de plano (5 linhas) no editor: normal; só os longos perguntam */
    api.$("editalTexto").value = PLANO;
    const e6 = ev(PLANO.split("\n").slice(0, 5).join("\n")); await api.edColarNoEditor(e6);
    ok(e6.parou === false, "Y2b-x até 5 linhas de plano coladas no editor: normal (a pergunta é para o plano inteiro)");
    /* ---- Y3: o pedido tem dois modos — organizar (edital oficial) e corrigir (o plano que já tenho) ---- */
    const pr = (id) => api.$(id).getAttribute("aria-pressed");
    api.$("editalTexto").value = ["# C | horas: 20", "@ A :: 3", "+ a1", "+ a2", "@ B :: 3", "+ b1", "+ b2", "@ C :: 3", "+ c1", "+ c2"].join("\n"); api.edRender();
    api.$("btnEditalColar").onclick();
    ok(pr("btnEdColarModoCor") === "true" && pr("btnEdColarModoOrg") === "false" && api.$("btnEdColarModoCor").disabled === false && /plano atual e os pontos/.test(api.$("edColarModoExp").textContent), "Y3d com plano lido, o padrão é 'Corrigir o plano que já tenho' (e a explicação diz o que a IA recebe)");
    ok(/vão no pedido à IA/.test(api.$("edAchLista").textContent), "Y3e o passo 0 diz que os pontos 'precisa da IA' vão no pedido");
    api.$("btnEdColarModoOrg").onclick();
    ok(pr("btnEdColarModoOrg") === "true" && pr("btnEdColarModoCor") === "false" && api.edColarPedidoTexto() === api.t("ed_prompt") && /instruções de como organizar/.test(api.$("edColarModoExp").textContent), "Y3f trocar para 'Montar a partir do edital oficial': o pedido é o ed_prompt de sempre");
    api.$("btnEdColarModoCor").onclick();
    janela.__area = "";
    await conduzir(api.$("btnEdColarPedido").onclick());
    const rev = janela.__area;
    ok(/^Você vai REVISAR um PLANO DE ESTUDO/.test(rev) && /\nPLANO ATUAL:\n# C \| horas: 20\n@ A :: 3/.test(rev) && rev.indexOf("PLANO ATUAL:") > rev.indexOf("REGRAS:"), "Y3g o pedido de revisão: cabeçalho de REVISÃO, as regras e o PLANO ATUAL no fim");
    ok(/O QUE O APLICATIVO JÁ ENCONTROU/.test(rev) && /\[GRAVE\] Todas as 3 disciplinas estão com peso 3/.test(rev), "Y3h lista o que o app achou e é da IA (peso igual, [GRAVE]): " + rev.slice(rev.indexOf("O QUE O APLICATIVO"), rev.indexOf("O QUE O APLICATIVO") + 200));
    ok(!/data de prova|linha\(s\) não foram entendidas/.test(rev), "Y3i e NÃO lista o que é decisão da pessoa (sem data) nem do app");
    /* contrato: toda regra do ed_prompt está no pedido de revisão (os dois não se separam) */
    const base = api.t("ed_prompt");
    const miolo = base.slice(base.search(/\n\nFORMATO/) + 2, base.search(/\n\nEXEMPLO DE SAÍDA:/));
    const regras = miolo.split("\n").filter((l) => /^\d+\./.test(l));
    ok(rev.includes(miolo), "Y3j0 o bloco FORMATO + REGRAS do ed_prompt entra INTEIRO e idêntico no pedido de revisão (nem uma linha cortada)");
    ok(regras.length >= 12 && regras.every((l) => rev.includes(l)) && rev.includes("13. ESTE É UM PLANO PRONTO"), "Y3j toda regra do ed_prompt (" + regras.length + ") está no pedido de revisão, e a nova vem numerada depois (13)");
    ok(!/Colar plano corrigido/.test(rev + base) && /Passo 2 — traga a resposta da IA para cá/.test(rev) && /Passo 2 — traga a resposta da IA para cá/.test(base), "Y3k os dois pedidos dizem para onde a resposta volta (passo 2), não para o botão antigo");
    ok(/✓ Copiado/.test(api.$("edColarPedidoMsg").textContent), "Y3l copiar no modo corrigir marca o passo 1");
    const LIMPO6 = ["# C | prova: 2030-05-10 | horas: 20"].concat([4, 4, 4, 3, 3].map((p, i) => ["@ D" + i + " :: " + p, "+ t" + i + "a :: 3 :: cai sempre", "+ t" + i + "b :: 3 :: cai bastante", "+ t" + i + "c :: 3 :: cai pouco"].join("\n"))).join("\n");
    api.$("editalTexto").value = LIMPO6; api.edRender();
    const semAch = api.edPromptRevisao(LIMPO6, api.edAchadosAtuais());
    ok(!/O QUE O APLICATIVO JÁ ENCONTROU/.test(semAch) && semAch.includes("PLANO ATUAL:\n# C"), "Y3j1 plano sem nada para a IA resolver: o pedido NÃO traz o cabeçalho 'o que o app achou' vazio");
    /* sem plano: só 'organizar', e 'corrigir' desligado */
    api.$("editalTexto").value = ""; api.edRender();
    api.$("btnEditalColar").onclick();
    ok(pr("btnEdColarModoOrg") === "true" && api.$("btnEdColarModoCor").disabled === true && api.edColarModoDefinir("corrigir") === "organizar", "Y3m sem plano: só 'montar a partir do edital oficial'; 'corrigir' fica desligado e não pega");
    /* o prompt colado no editor não conta como plano */
    api.$("editalTexto").value = "# x | horas: 20\n" + api.edPromptEdital(true); api.edRender();
    ok(api.edColarTemPlano() === false, "Y3n o prompt colado no editor não conta como 'plano que já tenho'");
    api.$("editalTexto").value = "";
    /* Y4: um caminho só — o botão da bancada e o "ver o que está errado" abrem a MESMA revisão, zerada */
    api.$("editalTexto").value = PLANO; api.edRender();
    api.$("edColarTexto").value = "sobra de antes"; api.$("dlgEdColar").open = false; api.$("edColarAviso").hidden = false;
    api.edRevisaoAbrir();
    ok(api.$("dlgEdColar").open === true && api.$("edColarTexto").value === "" && api.$("edColarAviso").hidden === true && pr("btnEdColarModoCor") === "true", "Y4a abrir a revisão abre o diálogo, zera a caixa e o aviso, e escolhe o modo pelo plano");
    ok(api.$("btnEditalColar").onclick === api.edRevisaoAbrir, "Y4b o botão da bancada chama a mesma função (não há outro caminho)");
    api.$("dlgEdColar").open = false;
    ok(!/Cole aqui o resultado do prompt/.test(api.t("ed_colar")) && /Revisar o edital com a IA/.test(api.t("ed_colar")), "Y2b-u o rótulo do editor não convida mais a colar a resposta da IA ali: " + api.t("ed_colar"));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
