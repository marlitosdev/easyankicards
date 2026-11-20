/* =====================================================================
 * ⚡ A FUGA RÁPIDA REFEITA (19.185.0)
 *
 * Era uma lista fixa de 5 textos com "ver resposta". O que o app ganhou depois não chegava nela.
 *
 * O QUE PRECISA SER VERDADE:
 *  G1. a rodada pega um item de cada tipo, NA ORDEM da corrente (cartão → questão → artigo → pegadinha → julgado →
 *      mapa → prazo → dica), fora da disciplina de agora e sem repetir disciplina enquanto houver outra;
 *  G2. "outros 5" continua de onde parou e não repete nada desta fuga; o relógio não recomeça;
 *  G3. as fontes ligam e desligam (lembrado); só disciplinas dos editais em andamento; o que saiu nas últimas fugas
 *      vai para o fim;
 *  G4. as fontes novas: questões do caderno, artigos que caem (os que você erra primeiro), julgados, pegadinhas da lei,
 *      ramos esquecidos do mapa;
 *  G5. um por vez: virar, sabia/não sabia, a questão respondida ali, "lido" que não conta; o fim da rodada diz por
 *      onde a corrente segue; o resumo junta as rodadas e manda os cartões para "De novo" só a pedido;
 *  G6. "como funciona" explica o "outros 5" e a corrente (aberto na primeira vez); teclas.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const semear = () => { let s = 7; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  const C = (d, i, p, uid) => ({ tipo: "cartao", disciplina: d, topico: "T", frente: "frente " + i, verso: "verso " + i, peso: p, uid: uid || "" });
  const Q = (d, i, gab) => ({ tipo: "questao", id: "q" + i, disciplina: d, topico: "T", frente: "enunciado " + i, q: { id: "q" + i, tipo: "ce", gabarito: gab || "C", comentario: "porque sim " + i }, peso: 3 });
  const A = (d, i) => ({ tipo: "artigo", lei: "Lei " + i, leiId: "lei_" + i, num: String(i), rotulo: "Art. " + i, disciplina: d, topico: "T", frente: "Art. " + i, verso: "texto " + i, motivo: "cai", peso: 5 });
  const M = (tipo, d, i) => ({ tipo, disciplina: d, topico: "T", texto: tipo + " " + i + " de " + d });
  const J = (d, i) => ({ tipo: "julgado", id: "j" + i, disciplina: d, topico: "T", frente: "Súmula " + i, verso: "tese " + i, peso: 2 });
  const MP = (d, i) => ({ tipo: "mapa", chave: "c" + i, caminho: "0." + i, disciplina: d, topico: "T", frente: "ramo " + i, verso: "filhos " + i });
  const P = (d, i) => ({ tipo: "prazo", lei: "Lei P", leiId: "lp", num: String(i), rotulo: "Art. " + i, texto: "prazo de " + i + " dias", disciplina: d });
  const D = (d, i) => ({ tipo: "dica", disciplina: d, topico: "T", texto: "dica " + i });
  const fontes = () => ({
    cartoes: [C("Português", 1, 9), C("Tributário", 2, 8, "u2"), C("Administrativo", 3, 7)],
    questoes: [Q("Tributário", 1), Q("Constitucional", 2, "E")],
    artigos: [A("Administrativo", 1), A("Constitucional", 2)],
    marcas: [M("pegadinha", "Contabilidade", 1), M("importante", "Informática", 2), M("pegadinha", "Português", 3)],
    julgados: [J("Informática", 1), J("Tributário", 2)],
    mapa: [MP("Contabilidade", 1)], prazos: [P("Administrativo", 1)], dicas: [D("Lógica", 1)], discs: new Set(),
  });
  const todas = { cartoes: true, questoes: true, leis: true, julgados: true, marcas: true, mapa: true, dicas: true };

  /* G1 e G2: a corrente */
  {
    const { api } = rodar();
    const F = fontes();
    const r = api.fugaSortear({ disc: "Português", rnd: semear(), fontes: F, ativas: todas, vistos: [] });
    ok(r.itens.map((x) => x.tipo).join() === "cartao,questao,artigo,pegadinha,julgado" && r.proxInicio === 5,
      "G1 uma de cada, na ordem da corrente: " + r.itens.map((x) => x.tipo).join() + " · próx " + r.proxInicio);
    ok(r.itens.every((x) => x.disciplina !== "Português"), "G1a nada da disciplina de agora");
    const ds = r.itens.map((x) => x.disciplina);
    ok(new Set(ds).size === ds.length, "G1b sem repetir disciplina na rodada enquanto há outra: " + ds.join());
    const r2 = api.fugaSortear({ disc: "Português", rnd: semear(), fontes: F, ativas: todas, vistos: [], excluir: r.itens.map(api.fugaChave), inicio: r.proxInicio });
    ok(r2.itens.map((x) => x.tipo).slice(0, 4).join() === "mapa,prazo,dica,cartao" && r2.itens.every((x) => r.itens.indexOf(x) < 0 && r.itens.map(api.fugaChave).indexOf(api.fugaChave(x)) < 0),
      "G2 'outros 5' continua de onde parou (mapa, prazo, dica, cartão…) e não repete: " + r2.itens.map((x) => x.tipo).join());
  }

  /* G3: as fontes, os editais, as últimas fugas */
  {
    const { api } = rodar();
    const F = fontes();
    const sem = api.fugaSortear({ disc: "", rnd: semear(), fontes: F, ativas: Object.assign({}, todas, { cartoes: false, questoes: false }), vistos: [] });
    ok(!sem.itens.some((x) => x.tipo === "cartao" || x.tipo === "questao"), "G3 fonte desligada não entra: " + sem.itens.map((x) => x.tipo).join());
    const ed = api.fugaSortear({ disc: "", rnd: semear(), fontes: F, ativas: todas, vistos: [], discs: new Set(["tributario"]) });
    ok(ed.itens.length && ed.itens.every((x) => x.disciplina === "Tributário"), "G3a só as disciplinas dos editais em andamento: " + ed.itens.map((x) => x.disciplina).join());
    const F2 = { cartoes: [C("Penal", 1, 9), C("Civil", 2, 8)], questoes: [], artigos: [], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    const v = api.fugaSortear({ disc: "", rnd: semear(), fontes: F2, ativas: todas, vistos: [api.fugaChave(F2.cartoes[0])], n: 1 });
    ok(v.itens[0] && v.itens[0].frente === "frente 2", "G3b o que saiu nas últimas fugas vai para o fim");
    api.fugaPrefDefinir({ fontes: { mapa: false }, min: 5 });
    const pf = api.fugaPref();
    ok(pf.fontes.mapa === false && pf.fontes.cartoes === true && pf.min === 5, "G3c 'o que entra' e a duração ficam lembrados");
    api.fugaPrefDefinir({ fontes: { cartoes: false, questoes: false, leis: false, julgados: false, marcas: false, mapa: false, dicas: false } });
    ok(api.fugaPref().fontes.cartoes === true, "G3d nunca todas desligadas (a fuga ficaria vazia sem dizer por quê)");
  }

  /* G4: as fontes reais */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar(); api.qsUiIniciar && api.qsUiIniciar();
    api.qsTodas().push({ id: "qx1", tipo: "ce", enunciado: "A imunidade recíproca alcança as autarquias?", gabarito: "C", tentativas: [{ acertou: false }], disciplina: "Tributário", topico: "Imunidades", chave: "" });
    api.qsTodas().push({ id: "qx2", tipo: "ce", enunciado: "Questão dominada que já saiu do caderno.", gabarito: "E", tentativas: [{ acertou: false }, { acertou: true }, { acertou: true }], disciplina: "Tributário", topico: "Imunidades" });
    const qs = api.fugaQuestoes();
    ok(qs.length === 1 && qs[0].id === "qx1" && qs[0].q.gabarito === "C", "G4 as questões do caderno (a dominada não): " + qs.map((x) => x.id).join());
    api.jurGravar({ tribunal: "STF", classe: "Súmula Vinculante", numero: "29", tese: "É constitucional a adoção, no cálculo do valor de taxa, de um ou mais elementos da base de cálculo própria de determinado imposto.", topicos: ["direito tributário›taxas"] });
    const js = api.fugaJulgados();
    ok(js.length === 1 && /29/.test(js[0].frente) && /taxa/.test(js[0].verso) && js[0].peso === 2, "G4a os julgados: o nome na frente, a tese no verso (súmula primeiro)");
    api.leiGuardar({ id: "lei_pg", nome: "Lei PG", texto: "Art. 1º O prazo é ==~de 5 anos, não de 10== para tudo." + NL + "Art. 2º Outro.", topicos: [] });
    ok(api.fugaMarcas().some((x) => x.tipo === "pegadinha" && x.texto === "de 5 anos, não de 10" && x.origem === "Lei PG"), "G4b as pegadinhas marcadas na própria lei");
    api.matGravar(api.matChave("Constitucional", "Direitos"), "Texto ==~não confunda prazo com decadência aqui== e ==!o ponto principal da aula==.", { disciplina: "Constitucional", topico: "Direitos" });
    const mk = api.fugaMarcas();
    ok(mk.some((x) => x.tipo === "pegadinha" && x.texto === "não confunda prazo com decadência aqui" && x.disciplina === "Constitucional") && mk.some((x) => x.tipo === "importante"), "G4c as dos resumos continuam");
    api.leiGuardar({ id: "lei_f", nome: "Lei F", texto: ["Art. 1º Disposição geral.", "", "Art. 2º O recurso tem prazo de 15 (quinze) dias.", "", "Art. 3º (Revogado) O prazo de 10 dias."].join(NL) });
    const pz = api.fugaPrazos(semear());
    ok(pz.some((x) => /Art\. 2º/.test(x.rotulo) && x.lei === "Lei F" && x.leiId === "lei_f") && !pz.some((x) => /Art\. 3º/.test(x.rotulo)), "G4d os artigos com prazo (não o revogado), com a lei para abrir");
    /* os artigos que caem: uma passada pelas questões; o que você erra vem primeiro, com a disciplina das questões */
    api.leiGuardar({ id: "lei_9999", nome: "Lei 9.999/2001", texto: ["Art. 1º Disposição geral sobre tudo.", "", "Art. 2º O lançamento se faz em 30 dias contados da ciência."].join(NL), topicos: [] });
    api.qsTodas().push({ id: "qa1", tipo: "ce", enunciado: "Conforme o art. 2º da Lei 9.999/2001, o lançamento se faz em 60 dias.", gabarito: "E", tentativas: [{ acertou: false }, { acertou: false }], disciplina: "Financeiro", topico: "Lançamento" });
    api.qsTodas().push({ id: "qa2", tipo: "ce", enunciado: "O art. 1º da Lei 9.999/2001 trata de disposição geral.", gabarito: "C", tentativas: [{ acertou: true }], disciplina: "Financeiro", topico: "Lançamento" });
    const arts = api.fugaArtigos();
    const a2 = arts.find((x) => x.leiId === "lei_9999" && x.num === "2");
    ok(!!a2 && arts.indexOf(a2) < arts.findIndex((x) => x.leiId === "lei_9999" && x.num === "1") && /você erra/.test(a2.motivo) && a2.disciplina === "Financeiro" && /30 dias/.test(a2.verso),
      "G4f os artigos que caem, o que você erra primeiro, com a disciplina das questões: " + JSON.stringify(arts.map((x) => x.num + ":" + x.disciplina)));
    /* o mapa: um ramo marcado "não lembrei" no tentar lembrar */
    const ch = api.matChave("Penal", "Crimes");
    api.matGravar(ch, ["# Crimes", "- Furto", "  - subtrair coisa alheia móvel", "- Roubo", "  - com violência ou grave ameaça"].join(NL), { disciplina: "Penal", topico: "Crimes" });
    const arv = api.mmArvoreDaChave(ch);
    let alvo = null;
    const ir = (no) => { if (!alvo && /Roubo/.test(no.label || "")) alvo = no; (no.filhos || []).forEach(ir); };
    if (arv) ir(arv.raiz);
    ok(!!alvo, "G4e-pre o mapa do resumo tem o ramo 'Roubo'");
    if (alvo) api.loja.setItem("eac_mm_treino", JSON.stringify({ [ch]: { [alvo.caminho]: { v: "n", em: "2026-11-20" } } }));
    const mp = api.fugaMapa();
    ok(mp.length === 1 && /Roubo/.test(mp[0].frente) && /violência/.test(mp[0].verso) && mp[0].disciplina === "Penal", "G4e os ramos esquecidos do mapa: " + JSON.stringify(mp.map((x) => x.frente)));
  }

  /* G5: a janela, um por vez */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.fugaAbrir({ fontes: fontes(), disc: "Português", rnd: semear() });
    const S = () => api.fugaEstado();
    ok(api.$("dlgFuga").open && S().rodada === 1 && S().itens.length === 5 && api.$("fugaItem_0"), "G5 abre a rodada 1 com o 1º item");
    /* (19.187.0) as bolinhas dizem que há outros itens, sem texto */
    const passos = () => [0, 1, 2, 3, 4].map((k) => api.$("btnFugaPasso_" + k));
    ok(passos().every(Boolean) && !api.$("btnFugaPasso_5") && /fuga-passo-atual/.test(passos()[0].className) && !/item 1 de 5/.test(api.$("fugaLista").textContent),
      "G5a as 5 bolinhas da rodada no topo, a atual em destaque (sem o 'item 1 de 5')");
    passos()[2].onclick();
    ok(S().i === 2 && /fuga-passo-atual/.test(api.$("btnFugaPasso_2").className), "G5a2 tocar numa bolinha leva ao item dela");
    api.$("btnFugaPasso_0").onclick();
    ok(S().i === 0, "G5a3 e volta");
    ok(!api.$("fugaVerso") || !/verso 2/.test(api.$("fugaLista").textContent), "G5b o verso do cartão começa escondido");
    api.$("btnFugaVirar").onclick();
    ok(/verso/.test(api.$("fugaLista").textContent) && api.$("btnFugaSabia") && api.$("btnFugaNaoSabia"), "G5c virar mostra o verso e 'sabia'/'não sabia'");
    api.$("btnFugaNaoSabia").onclick();
    ok(S().i === 1 && S().itens[1].tipo === "questao" && api.$("btnFugaQ_C"), "G5d 'não sabia' segue para a questão, com Certo/Errado");
    const marca0 = api.$("btnFugaPasso_0").querySelectorAll(".fuga-passo-marca")[0];
    ok(/fuga-passo-erro/.test(api.$("btnFugaPasso_0").className) && marca0 && marca0.textContent === "✗" && /fuga-passo-atual/.test(api.$("btnFugaPasso_1").className),
      "G5d2 a bolinha respondida fica com a cor do resultado e a marca ✗ no canto");
    /* (19.188.0) voltar a um item respondido: reabre para rever, com o que você marcou, sem pedir de novo */
    api.$("btnFugaPasso_0").onclick();
    ok(S().i === 0 && S().revelado === true && api.$("fugaFeito") && /não sabia/.test(api.$("fugaFeito").textContent) && !api.$("fugaLista").querySelectorAll("#btnFugaSabia").length,
      "G5d3 a bolinha respondida reabre o item para rever: 'Você marcou: não sabia'");
    ok(api.$("btnFugaAnt").disabled === true, "G5d4 no primeiro item, o ‹ fica apagado");
    api.$("btnFugaSeg").onclick();
    ok(S().i === 1 && S().revelado === false && api.$("btnFugaQ_C"), "G5d5 › vai ao vizinho (a questão, ainda sem resposta)");
    api.$("btnFugaAnt").onclick(); api.$("btnFugaProx").onclick();
    ok(S().i === 1, "G5d6 'próximo' de quem está revendo leva ao próximo SEM resposta");
    api.$("btnFugaQ_C").onclick();
    ok(/Acertou — gabarito: C/.test(api.$("fugaLista").textContent) && /porque sim/.test(api.$("fugaLista").textContent) && S().respostas[1].sabia === true,
      "G5e a questão se responde ali: certo/errado, o gabarito e o comentário");
    api.$("btnFugaProx").onclick();
    api.$("btnFugaVirar").onclick();
    ok(api.$("btnFugaIr") && /abrir na lei/.test(api.$("btnFugaIr").textContent), "G5f o artigo oferece abrir na lei");
    api.$("btnFugaSabia").onclick();
    ok(S().itens[3].tipo === "pegadinha" && api.$("btnFugaLido"), "G5g a pegadinha é só de ler: 'lido'");
    api.$("btnFugaLido").onclick();
    api.$("btnFugaVirar").onclick(); api.$("btnFugaSabia").onclick();
    ok(S().fase === "fimRodada" && /Rodada 1: ✓ 3 · ✗ 1 · lidos 1/.test(api.$("fugaLista").textContent),
      "G5h o fim da rodada conta (o 'lido' à parte): " + api.$("fugaLista").textContent.slice(0, 90));
    ok(/A próxima começa por 🗺 ramo esquecido do mapa/.test(api.$("fugaLista").textContent), "G5i diz, curto, por onde a próxima rodada começa");
    const fim = api.fugaEstado().min;
    api.$("btnFugaSeguir").onclick();
    ok(S().rodada === 2 && S().itens[0].tipo === "mapa" && S().fase === "item", "G5j 'outros 5' abre a rodada 2 a partir do mapa");
    /* no meio da rodada: o que ficou sem resposta não conta */
    api.$("btnFugaOutros").onclick();
    ok(S().rodada === 3 && S().respostas.length === 5, "G5k 'outros 5' no meio da rodada: a seguinte, sem contar o que ficou sem resposta");
    ok(api.fugaEstado().min === fim, "G5l o relógio é o mesmo (não recomeça)");
    api.fugaTerminar();
    const rs = api.$("fugaLista").textContent;
    ok(S().fase === "resumo" && /5 itens em 3 rodada\(s\): 3 sabia, 1 não sabia/.test(rs) && /Os que você não sabia/.test(rs), "G5m o resumo junta as rodadas: " + rs.slice(0, 120));
  }
  {
    /* mandar para "De novo": só o cartão não sabido, só a pedido */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const F = { cartoes: [C("Tributário", 9, 9, "uid_9")], questoes: [], artigos: [], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    api.fugaAbrir({ fontes: F, disc: "", rnd: semear() });
    ok(!api.loja.getItem("eac_cartao_estudo") || !/uid_9/.test(api.loja.getItem("eac_cartao_estudo")), "G5o abrir e responder não grava nada na agenda");
    api.$("btnFugaVirar").onclick(); api.$("btnFugaNaoSabia").onclick();
    api.$("btnFugaTerminar").onclick();
    ok(api.$("btnFugaMandar") && /mandar 1 cartão/.test(api.$("btnFugaMandar").textContent), "G5p o resumo oferece mandar o cartão para 'De novo'");
    api.$("btnFugaMandar").onclick();
    const ag = JSON.parse(api.loja.getItem("eac_cartao_estudo") || "{}");
    ok(ag.uid_9 && (ag.uid_9.h || []).slice(-1)[0] === 1 && /em "De novo"/.test(api.$("btnFugaMandar").textContent) && api.$("btnFugaMandar").disabled === true,
      "G5q o cartão vai para 'De novo' na agenda (uma vez): " + JSON.stringify(ag.uid_9 && ag.uid_9.h));
    ok(api.fugaMandarRevisao() === 0, "G5r mandar de novo não grava outra vez");
  }

  {
    /* o anúncio da corrente pula o tipo vazio, como a rodada de verdade (sem ramos esquecidos, segue o prazo) */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const F = Object.assign(fontes(), { mapa: [] });
    api.fugaAbrir({ fontes: F, disc: "Português", rnd: semear() });
    for (let k = 0; k < 5; k++) api.fugaProximo();
    ok(/começa por ⏳ prazo/.test(api.$("fugaLista").textContent), "G5s sem ramos esquecidos, o anúncio já diz que a próxima começa pelo prazo: " + api.$("fugaLista").textContent.slice(0, 160));
    api.fugaOutros();
    ok(api.fugaEstado().itens[0].tipo === "prazo", "G5t e a rodada começa mesmo pelo prazo");
  }

  {
    /* (19.186.0) a questão respondida na fuga entra no histórico dela; fechar por qualquer caminho encerra a fuga */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const q = { id: "qf1", tipo: "ce", enunciado: "A taxa pode ter base de cálculo própria de imposto?", gabarito: "E", tentativas: [{ q: "2026-11-01T10:00:00.000Z", resp: "C", acertou: false }], disciplina: "Tributário", topico: "Taxas" };
    api.qsTodas().push(q);
    const F = { cartoes: [], questoes: api.fugaQuestoes(), artigos: [], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    ok(F.questoes.length === 1, "G7-pre a questão do caderno entra na fuga");
    api.fugaAbrir({ fontes: F, disc: "", rnd: semear() });
    api.$("btnFugaQ_E").onclick();
    const ult = q.tentativas[q.tentativas.length - 1];
    ok(q.tentativas.length === 2 && ult.resp === "E" && ult.acertou === true && ult.origem === "fuga", "G7 a resposta da fuga entra no histórico da questão, com a origem: " + JSON.stringify(ult));
    ok(/Anotada no histórico da questão/.test(api.$("fugaLista").textContent), "G7a a fuga diz que anotou");
    api.qsTentativaAvulsa("qf1", "E", "fuga");
    ok(api.qsCadernoEstado(q).dentro === false && api.qsCadernoEstado(q).motivo === "dominada", "G7b dois acertos seguidos (na fuga) tiram a questão do caderno: " + JSON.stringify(api.qsCadernoEstado(q)));
    ok(api.qsTentativaAvulsa("nao_existe", "C", "fuga") === null, "G7c questão que não existe: nada");
    /* o Esc fecha a janela sem passar pelo "voltar ao estudo": o evento de fechar encerra a fuga */
    api.fugaAoFechar();
    ok(api.fugaRelogioAtivo() === false && api.fugaEstado().registrado === true, "G7d fechar por qualquer caminho para o relógio e anota o fim no registro");
    api.fugaAoFechar();
    ok(api.fugaEstado().registrado === true, "G7e uma linha só, mesmo fechando de novo");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "fuga.js"), "utf8");
    ok(/addEventListener\("close", \(\) => fugaAoFechar\(\)\)/.test(html), "G7f a janela da fuga ouve o fechar (Esc incluído)");
    ok(/3–5 min/.test(api.t("fuga_btn_menu")), "G7g o menu diz 3–5 min: " + api.t("fuga_btn_menu"));
  }

  {
    /* (19.187.0) G8: o cartão da fuga é o cartão do estudo */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const nota = { card: { front: "O prazo é de {{c1::5 anos::quantos anos?}} contados do {{c2::fato gerador}}.", back: "", more: "Decadência — prazo para lançar" }, disciplina: "Tributário", topico: "Decadência", chave: "" };
    const mc = { card: { kind: "mc", front: "Qual tributo é vinculado?", options: ["Imposto", "Taxa", "Empréstimo"], correct: 1, back: "A taxa é vinculada a uma atividade estatal." }, disciplina: "Tributário", topico: "Espécies", chave: "" };
    const F = { cartoes: [
      { tipo: "cartao", disciplina: "Tributário", topico: "Decadência", frente: "x", verso: "y", peso: 5, uid: "g1#c1", cn: 1, nota },
      { tipo: "cartao", disciplina: "Financeiro", topico: "Espécies", frente: "x", verso: "y", peso: 4, uid: "g2", cn: 0, nota: mc }],
      questoes: [], artigos: [], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    api.fugaAbrir({ fontes: F, disc: "", rnd: () => 0 });
    const S = () => api.fugaEstado();
    const x0 = S().itens[S().i];
    if (x0.uid !== "g1#c1") api.$("btnFugaPasso_" + S().itens.findIndex((x) => x.uid === "g1#c1")).onclick();
    const cart = () => api.$("fugaLista").querySelectorAll(".est-cartao")[0];
    ok(cart() && /quantos anos?/.test(cart().textContent) && /fato gerador/.test(cart().textContent) && !/5 anos/.test(cart().textContent),
      "G8 a lacuna como no estudo: a dica no buraco, as outras lacunas preenchidas: " + (cart() && cart().textContent.slice(0, 90)));
    api.$("btnFugaVirar").onclick();
    ok(/5 anos/.test(cart().textContent) && api.$("fugaLista").querySelectorAll(".est-cl-r").length === 1 && api.$("btnFugaSaiba"), "G8a virada: a resposta em destaque e o '✚ saiba mais'");
    ok([1, 2, 3, 4].every((k) => api.$("btnFugaNota" + k)) && /De novo|de novo/i.test(api.$("btnFugaNota1").textContent), "G8b as quatro notas do estudo, com o nome de cada uma: " + api.$("btnFugaNota1").textContent);
    api.$("btnFugaNota3").onclick();
    const ag = JSON.parse(api.loja.getItem("eac_cartao_estudo") || "{}");
    ok(ag["g1#c1"] && (ag["g1#c1"].h || []).slice(-1)[0] === 3 && S().respostas[0].sabia === true && S().respostas[0].nota === 3,
      "G8c a nota vale na agenda dos cartões, como no estudo: " + JSON.stringify(ag["g1#c1"] && ag["g1#c1"].h));
    /* rever o cartão já revisado: a nota dada, sem as quatro de novo (a agenda não leva uma segunda nota) */
    const iG1 = S().itens.findIndex((x) => x.uid === "g1#c1");
    api.$("btnFugaPasso_" + iG1).onclick();
    ok(api.$("fugaFeito") && /Revisado: Bom/.test(api.$("fugaFeito").textContent) && !api.$("fugaLista").querySelectorAll(".fuga-notas").length,
      "G8c2 rever o cartão mostra a nota dada ('Revisado: Bom'), sem pedir outra: " + (api.$("fugaFeito") && api.$("fugaFeito").textContent));
    api.$("btnFugaProx").onclick();
    /* a múltipla escolha: escolher revela e sugere a nota */
    ok(S().itens[S().i].uid === "g2" && api.$("btnFugaOp_0"), "G8d o cartão de múltipla escolha mostra as alternativas");
    api.$("btnFugaOp_0").onclick();
    ok(/est-op-erro/.test(api.$("btnFugaOp_0").className) && /est-op-ok/.test(api.$("btnFugaOp_1").className) && /est-nota-sug/.test(api.$("btnFugaNota1").className),
      "G8e a escolha errada fica marcada, a certa aparece, e a nota sugerida é 'de novo'");
    const dlg = api.$("dlgFuga");
    (dlg._ouv && dlg._ouv.keydown || []).forEach((fn) => fn({ key: "1", target: { tagName: "DIV" }, preventDefault() {} }));
    ok(S().fase === "fimRodada" && S().respostas[1].nota === 1, "G8f a tecla 1 dá a nota, como no estudo");
    api.fugaTerminar();
    ok(!api.$("btnFugaMandar") || api.$("btnFugaMandar").disabled === true, "G8g o cartão já revisado não pede 'mandar para De novo'");
  }

  {
    /* (19.188.0) G9: de onde saiu o artigo — a lei, a questão, e o aviso quando a lei foi deduzida; abrir na lei pelo tópico */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Administrativo", "Atos");
    api.matGravar(ch, "Resumo dos atos.", { disciplina: "Administrativo", topico: "Atos", concurso: "TJ" });
    const textoLei = Array.from({ length: 60 }, (_, i) => "Art. " + (i + 1) + (i < 9 ? "º" : ".") + " Texto do artigo " + (i + 1) + " da lei.").join(NL);
    const l = api.leiGuardar({ id: "lei_9784", nome: "Lei 9.784/1999 Lei de Processo Administrativo", texto: textoLei, topicos: [] });
    api.leiLigar(l.id, ch);
    const q1 = { id: "qo1", tipo: "ce", enunciado: "Segundo o art. 55, atos com defeitos sanáveis podem ser convalidados pela Administração.", gabarito: "C", tentativas: [{ acertou: false }], disciplina: "Administrativo", topico: "Atos", chave: ch };
    const q2 = { id: "qo2", tipo: "ce", enunciado: "O art. 54 da Lei 9.784/1999 fixa o prazo de decadência.", gabarito: "C", tentativas: [{ acertou: true }], disciplina: "Administrativo", topico: "Atos", chave: ch };
    api.qsTodas().push(q1, q2);
    const a1 = api.qsArtigosDaQuestao(q1)[0], a2 = api.qsArtigosDaQuestao(q2)[0];
    ok(a1 && a1.leiId === l.id && a1.como === "topico" && /art. 55, atos/.test(a1.trecho), "G9 a questão sem a lei escrita: a lei do tópico, marcada como suposta, com o trecho: " + JSON.stringify(a1));
    ok(a2 && a2.como === "nomeada", "G9a a questão que escreve a lei: 'nomeada'");
    /* o nome por extenso logo depois da citação também é a lei escrita ("art. 128 do Código Tributário Nacional") */
    const ctn = { nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN" };
    ok(api.qsNomeiaLei(" do Código Tributário Nacional, a responsabilidade", ctn) && api.qsNomeiaLei(" do CTN.", ctn) && !api.qsNomeiaLei(" da Constituição Federal", ctn) && api.qsNomeiaLei(" da Lei de Processo Administrativo", l),
      "G9a2 reconhece o nome por extenso e o apelido logo depois da citação");
    const a55 = api.fugaArtigos().find((x) => x.leiId === l.id && x.num === "55");
    ok(a55 && a55.soDeduzida === true && a55.fonte.q === q1 && /9.784/.test(a55.frente) && /9.784/.test(a55.leiCurta),
      "G9b o item diz a lei e guarda a questão de onde saiu: " + (a55 && a55.frente));
    const F = { cartoes: [], questoes: [], artigos: [a55], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    api.fugaAbrir({ fontes: F, disc: "", rnd: () => 0 });
    const tx = api.$("fugaLista").textContent;
    ok(/9.784/.test(tx) && /Segundo o art. 55/.test(tx) && api.$("fugaOrigemAviso") && /não diz a lei/.test(api.$("fugaOrigemAviso").textContent) && api.$("btnFugaOrigemQ"),
      "G9c a fuga mostra a lei, o trecho da questão, o aviso de que a lei foi suposta e 'ver a questão': " + tx.slice(0, 200));
    ok(/foi suposta por ser a lei do tópico «Atos» que tem o Art. 55/.test(api.$("fugaOrigemAviso").textContent), "G9c2 diz POR QUE esta lei: a do tópico que tem o artigo: " + api.$("fugaOrigemAviso").textContent);
    ok(!api.$("fugaFrente").querySelectorAll("button").length, "G9d a frente do artigo não vira link (o 'Art. 55' tracejado que não levava a nada)");
    api.$("btnFugaVirar").onclick();
    api.$("btnFugaIr").onclick();
    ok(api.$("dlgLeiSeca").open === true && api.leiCtxDoLeitor().topico === "Atos" && api.leiIdAtualValor() === l.id,
      "G9e 'abrir na lei' abre PELO TÓPICO da questão (não solta): " + JSON.stringify(api.leiCtxDoLeitor().topico));
    /* a questão que escreve a lei: o motivo é a própria citação */
    const a54 = api.fugaArtigos().find((x) => x.leiId === l.id && x.num === "54");
    api.fugaAbrir({ fontes: Object.assign({}, F, { artigos: [a54] }), disc: "", rnd: () => 0 });
    ok(/a questão cita “art\. 54 da Lei 9\.784\/1999”/.test(api.$("fugaOrigemAviso").textContent) && /fuga-origem-ok/.test(api.$("fugaOrigemAviso").className),
      "G9c3 lei escrita na questão: o motivo é a citação, sem alerta: " + api.$("fugaOrigemAviso").textContent);
    api.leiAbrirAvulsa(l.id);
    ok(api.$("leiTextoAjuda").hidden === true, "G9f aberta pela Biblioteca, sem o 'cole aqui só se a lei ainda não existe'");
  }

  {
    /* (19.189.0) G10: o ✖ e o "sair e voltar", com o que foi registrado */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const q = { id: "qr1", tipo: "ce", enunciado: "Questão do caderno para registrar na fuga.", gabarito: "C", tentativas: [{ acertou: false }], disciplina: "Tributário", topico: "T" };
    api.qsTodas().push(q);
    const nota = { card: { front: "Frente {{c1::resposta}}", back: "" }, disciplina: "Penal", topico: "P", chave: "" };
    const F = { cartoes: [{ tipo: "cartao", disciplina: "Penal", topico: "P", frente: "x", verso: "y", peso: 5, uid: "gr#c1", cn: 1, nota }],
      questoes: api.fugaQuestoes(), artigos: [], marcas: [{ tipo: "pegadinha", disciplina: "Civil", topico: "C", texto: "pegadinha para ler" }], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    api.fugaAbrir({ fontes: F, disc: "", rnd: () => 0 });
    ok(api.$("btnFugaX") && /Nada registrado/.test(api.$("fugaRegistro").textContent) && /sair e voltar/.test(api.t("fuga_voltar")),
      "G10 o ✖ no canto, 'sair e voltar' e 'Nada registrado' enquanto nada foi gravado");
    api.$("btnFugaVirar").onclick(); api.$("btnFugaNota3").onclick();
    api.$("btnFugaQ_C").onclick();
    ok(/Registrado: 1 cartão\(ões\) na agenda · 1 questão\(ões\) no histórico/.test(api.$("fugaRegistro").textContent) && /fuga-registro-sim/.test(api.$("fugaRegistro").className),
      "G10a depois da nota do cartão e da questão, a linha diz o que foi registrado: " + api.$("fugaRegistro").textContent);
    api.$("btnFugaProx").onclick(); api.$("btnFugaLido").onclick();
    ok(api.fugaEstado().respostas.length === 3 && /1 cartão\(ões\) na agenda · 1 questão/.test(api.$("fugaRegistro").textContent), "G10b o 'lido' não registra nada (a linha não muda)");
    api.$("btnFugaX").onclick();
    ok(api.$("dlgFuga").open !== true && api.fugaEstado().registrado === true, "G10c o ✖ fecha e encerra a fuga (como o Esc)");
  }

  /* G6: como funciona, chips e teclas */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.fugaAbrir({ fontes: fontes(), disc: "Português", rnd: semear() });
    ok(api.$("fugaComo").hidden === true && api.$("fugaOpcoes").hidden === true, "G6 pouco texto: 'como funciona' e 'o que entra' fechados no ⓘ e no ⚙");
    const txt = api.t("fuga_como_txt");
    ok(/bolinhas/.test(txt) && /outros 5/.test(txt) && /cartão → questão → artigo/.test(txt) && /não recomeça/.test(txt) && txt.length < 420,
      "G6a o ⓘ explica as bolinhas, o 'outros 5', a sequência e o relógio — curto: " + txt.length);
    ok(/não recomeça o relógio/.test(api.t("fuga_outros_tip")), "G6b o balão do 'outros 5' diz o mesmo");
    api.$("btnFugaComo").onclick();
    ok(api.$("fugaComo").hidden === false, "G6c o ⓘ abre o 'como funciona'");
    api.$("btnFugaOpcoes").onclick();
    ok(api.$("fugaComo").hidden === true && api.$("fugaOpcoes").hidden === false, "G6c2 o ⚙ abre o 'o que entra' (um painel por vez)");
    ok(api.$("btnFugaF_cartoes") && /\(3\)/.test(api.$("btnFugaF_cartoes").textContent), "G6d os chips dizem quantos itens cada fonte tem: " + (api.$("btnFugaF_cartoes") && api.$("btnFugaF_cartoes").textContent));
    api.$("btnFugaF_julgados").onclick();
    ok(api.fugaPref().fontes.julgados === false && !/fuga-chip-on/.test(api.$("btnFugaF_julgados").className), "G6e tocar no chip desliga a fonte");
    api.$("btnFugaMin_5").onclick();
    ok(api.fugaPref().min === 5 && /⏱ 5:00|⏱ 4:5\d/.test(api.$("fugaRelogio").textContent), "G6f 5 min: o relógio recomeça com 5 — " + api.$("fugaRelogio").textContent);
    /* teclas */
    const dlg = api.$("dlgFuga");
    const tecla = (key, alvo) => { let parou = false; (dlg._ouv && dlg._ouv.keydown || []).forEach((fn) => fn({ key, target: alvo || { tagName: "DIV" }, preventDefault() { parou = true; } })); return parou; };
    ok(tecla(" ") === true && api.fugaEstado().revelado === true, "G6g espaço vira");
    ok(tecla("s") === true && api.fugaEstado().i === 1, "G6h S = sabia, e segue");
    ok(tecla("e") === true && api.fugaEstado().revelado === true, "G6i E responde a questão");
    ok(tecla("ArrowRight") === true && api.fugaEstado().i === 2, "G6j → próximo");
    ok(tecla(" ", { tagName: "INPUT" }) === false, "G6k digitando, a tecla não vale");
    ["fuga_como_tit", "fuga_como_txt", "fuga_outros_tip", "fuga_corrente", "fuga_rodada_tip", "fuga_passo_tip", "fuga_nota_tip", "fuga_resumo", "fuga_mandar", "fuga_tipo_questao", "fuga_tipo_mapa", "fuga_f_leis", "fuga_vazia"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "G6l falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    api.fugaPintar({ itens: [] });
    ok(api.$("fugaVazia"), "G6m sem material, diz de onde ele vem");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
