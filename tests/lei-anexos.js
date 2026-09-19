/* =====================================================================
 * ANEXOS — a tabela que a lei alteradora substitui, revoga ou cria
 *
 * O CASO REAL. A LC 145/2024 diz "Ficam substituídos os Anexos VI, VII e XV" e
 * "Fica revogado o Anexo XI"; o texto dos anexos novos vem NO FIM da própria lei
 * alteradora, cada um com o número dela ("ANEXO I") e, logo abaixo, o do Anexo do
 * Código que ele substitui ("Anexo VI"). Tabela não se mescla por linha.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. As tabelas do fim da lei alteradora NÃO viram parte do último artigo dela,
 *     nem "artigo-alvo" do Código: são anexos, ligados ao Anexo que substituem.
 *  2. "Ficam substituídos os Anexos VI, VII e XV" / "VI a VIII" / "revogado o XI"
 *     viram uma ORDEM por anexo — nunca uma frase solta que ninguém acompanha.
 *  3. O anexo novo SUBSTITUI o antigo por inteiro; o antigo fica guardado
 *     (textoOriginal) e o histórico diz qual lei mexeu. Revogar não apaga a tabela.
 *  4. Ordem sem o texto do anexo novo, e ordem que só ALTERA linha de um anexo, não
 *     mexem em nada: viram aviso.
 *  5. Nada muda sem o "aceitar" da pessoa, e o texto dos artigos nunca é tocado.
 *  6. O anexo aparece na tela com o antes e o depois, e a lei mostra o histórico.
 *  7. Também no PDF consolidado: "Art. 343A", "Art. 356. B São…", "Art. 383
 *     (Revogado)" e incisos que pulam (II, V) são lidos como o Código os escreve.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const BASE = [
  "Art. 5º. Tributo é toda prestação pecuniária.",
  "Art. 162. Os contribuintes devem se inscrever.",
  "§ 1º A inscrição é obrigatória.",
  "Art. 356. A Taxa de Licença de Publicidade é devida.",
  "I. em vias públicas;",
  "II. em veículos;",
  "Art. 383. Texto antigo do art. 383.",
  "Art. 384. Texto antigo do art. 384.",
  "Art. 385. Texto antigo do art. 385.",
].join("\n");

const ANEXO_VI_ANTIGO = "ANEXO VI\nTABELA DE ALÍQUOTAS\nServiço A    1,00%\nServiço B    3,00%";
const ANEXO_XI_ANTIGO = "ANEXO XI\nTABELA DE MULTAS\nInfração 1    R$ 100,00";

const CAB = ["LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024",
  "Altera a Lei Complementar nº 15, de 05 de janeiro de 2009 e dá outras providências.",
  "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:"];
const CORPO = [
  "“ Art. 162 [...]",
  "§4º O contribuinte que não realizar movimentação terá sua inscrição suspensa. (AC)",
  "Art. 2º Ficam substituídos os Anexos VI e VII da Lei Complementar nº 15/2009.",
  "Art. 3º Fica revogado o Anexo XI da Lei Complementar nº 15/2009.",
  "Art. 4º Esta Lei Complementar entra em vigor na data de sua publicação.",
  "Caruaru, 23 de dezembro de 2024."];
const ANEXOS = ["ANEXO I", "Anexo VI", "TABELA DE ALÍQUOTAS", "Serviço A    2,00%", "Serviço B    5,00%",
  "ANEXO II", "Anexo VII", "TABELA DE PRAZOS", "Prazo de 30 dias"];
const LC145 = CAB.concat(CORPO, ANEXOS).join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api: p } = rodar();
  const lei = (extra) => Object.assign({ id: "lei_lc15", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009",
    texto: BASE, alteracoes: {}, anexos: [{ titulo: "ANEXO VI", texto: ANEXO_VI_ANTIGO }, { titulo: "ANEXO XI", texto: ANEXO_XI_ANTIGO }] }, extra || {});

  /* ==============================================================
   * P: AS PEÇAS PURAS
   * ============================================================== */
  ok(p.leiRomanoDoAnexo("ANEXO VI — TABELA") === "VI" && p.leiRomanoDoAnexo("Anexo 12") === "12" && p.leiRomanoDoAnexo("Anexo Único") === "ÚNICO" && p.leiRomanoDoAnexo("Art. 5º") === "",
    "P1 o numero do anexo: " + [p.leiRomanoDoAnexo("ANEXO VI — TABELA"), p.leiRomanoDoAnexo("Anexo 12"), p.leiRomanoDoAnexo("Anexo Único")]);
  const o1 = p.leiOrdemDeAnexo("Ficam substituídos os Anexos VI, VII e XV da Lei Complementar nº 15/2009");
  ok(o1 && o1.acao === "substituir" && o1.alvos.join() === "VI,VII,XV", "P2 'Anexos VI, VII e XV': " + JSON.stringify(o1));
  const o2 = p.leiOrdemDeAnexo("Fica revogado o Anexo XI da Lei");
  ok(o2 && o2.acao === "revogar" && o2.alvos.join() === "XI", "P2a revogar: " + JSON.stringify(o2));
  const o3 = p.leiOrdemDeAnexo("Ficam substituídos os Anexos VI a VIII");
  ok(o3 && o3.alvos.join() === "VI,VII,VIII", "P2b a faixa 'VI a VIII' inclui o VII: " + JSON.stringify(o3));
  const o4 = p.leiOrdemDeAnexo("Fica incluído o Anexo XVI");
  ok(o4 && o4.acao === "incluir" && o4.alvos.join() === "XVI", "P2c incluir: " + JSON.stringify(o4));
  ok(p.leiOrdemDeAnexo("Altera o item 4 do Anexo II").acao === "alterar", "P2d 'altera o item 4 do Anexo II' e' so alteracao de linha");
  ok(p.leiOrdemDeAnexo("Art. 5º Tributo é toda prestação.") === null, "P2e frase sem anexo nao e' ordem");

  /* ==============================================================
   * A: LER OS ANEXOS DA LEI ALTERADORA
   * ============================================================== */
  {
    const sep = p.leiAnexosDaAlteradora(LC145);
    ok(sep.anexos.length === 2 && sep.anexos[0].alvo === "VI" && sep.anexos[1].alvo === "VII", "A1 os dois anexos, ligados aos anexos-alvo: " + JSON.stringify(sep.anexos.map((a) => [a.proprio, a.alvo])));
    ok(sep.anexos[0].proprio === "ANEXO I" && /Serviço B\s+5,00%/.test(sep.anexos[0].texto) && !/TABELA DE PRAZOS/.test(sep.anexos[0].texto), "A1a a tabela de cada um fica no seu");
    ok(!/TABELA DE ALÍQUOTAS|Prazo de 30 dias/.test(sep.texto) && /Caruaru, 23 de dezembro/.test(sep.texto), "A1b o texto dos artigos vem SEM as tabelas");
    const par = p.leiLerAlteradora(LC145, lei());
    ok(par.blocos.map((b) => b.num).join() === "162", "A2 so o art. 162 e' artigo-alvo (as tabelas nao viram artigo nem entram no 4º): " + par.blocos.map((b) => b.num));
    ok(par.ordensAnexo.length === 2 && par.ordensAnexo[0].alvos.join() === "VI,VII" && par.ordensAnexo[1].acao === "revogar", "A2a as ordens sobre anexos: " + JSON.stringify(par.ordensAnexo));
    ok(par.anexos.length === 2 && !/TABELA/.test(par.textoSemAnexos), "A2b o texto sem anexos fica para guardar a lei");
    ok(!par.avisos.some((a) => a.k === "anexo"), "A2c ordem entendida nao e' 'aviso solto': " + JSON.stringify(par.avisos));
  }

  /* ==============================================================
   * I: OS ITENS DE ANEXO
   * ============================================================== */
  {
    const l = lei();
    const it = p.leiItensDaAlteradora(l, p.leiLerAlteradora(LC145, l));
    ok(it.map((x) => x.num).join() === "162,ANEXO:VI,ANEXO:VII,ANEXO:XI", "I1 artigos primeiro, depois os anexos: " + it.map((x) => x.num));
    const vi = it.filter((x) => x.num === "ANEXO:VI")[0], vii = it.filter((x) => x.num === "ANEXO:VII")[0], xi = it.filter((x) => x.num === "ANEXO:XI")[0];
    ok(vi.tipo === "anexo_subst" && vi.rotulo === "Anexo VI" && /1,00%/.test(vi.antigo) && /2,00%/.test(vi.novo) && vi.alertas.some((a) => a.k === "anexo_tabela"),
      "I2 Anexo VI: o antigo e o novo, lado a lado: " + JSON.stringify(vi).slice(0, 260));
    ok(vii.antigo === "" && /30 dias/.test(vii.novo) && vii.alertas.some((a) => a.k === "anexo_sem_base"), "I2a Anexo VII nao existia guardado: avisa que nao ha o que comparar");
    ok(xi.tipo === "anexo_rev" && xi.novo === "" && /R\$ 100,00/.test(xi.antigo) && xi.alertas.some((a) => a.k === "anexo_revogar"), "I3 Anexo XI revogado, com o texto antigo a vista");
    ok(it.every((x) => x.aceito === false && x.recusado === false), "I4 nenhum item vem aceito");
    ok(it.avisos.length === 0, "I4a nada sobrou como aviso: " + JSON.stringify(it.avisos));
    ok(p.leiAnexoDaLei(l, "VI").texto === ANEXO_VI_ANTIGO, "I5 a lei gravada nao foi tocada pela leitura");
  }
  {
    /* a ordem existe, o texto do anexo novo NAO veio: aviso, nunca item que apagaria a tabela */
    const l = lei();
    const semTexto = CAB.concat(CORPO).join("\n");
    const it = p.leiItensDaAlteradora(l, p.leiLerAlteradora(semTexto, l));
    ok(!it.some((x) => x.num === "ANEXO:VI" || x.num === "ANEXO:VII"), "I6 sem o texto do anexo novo nao ha item de substituicao: " + it.map((x) => x.num));
    ok(it.avisos.filter((a) => a.k === "anexo_sem_texto").map((a) => a.texto).join() === "Anexo VI,Anexo VII", "I6a o app diz quais anexos ficaram sem texto: " + JSON.stringify(it.avisos));
    ok(it.some((x) => x.num === "ANEXO:XI" && x.tipo === "anexo_rev"), "I6b a revogacao de anexo nao precisa de texto");
  }
  {
    /* so altera uma linha do anexo: aviso */
    const l = lei();
    const t2 = CAB.concat(["“Art. 162 [...]", "§4º Novo. (AC)", "Art. 2º Fica alterado o item 4 do Anexo II da Lei Complementar nº 15/2009.", "Art. 3º Vigência."]).join("\n");
    const it = p.leiItensDaAlteradora(l, p.leiLerAlteradora(t2, l));
    ok(it.length === 1 && it.avisos.some((a) => a.k === "anexo" && /Anexo II/.test(a.texto)), "I7 'altera o item 4 do Anexo II' vira aviso: " + JSON.stringify(it.avisos));
  }
  {
    /* varios anexos sem o "Anexo VI" do alvo: a ordem casa por posicao */
    const l = lei({ anexos: [] });
    const t3 = CAB.concat(["“Art. 162 [...]", "§4º Novo. (AC)", "Art. 2º Ficam substituídos os Anexos VI e VII.", "Art. 3º Vigência.",
      "ANEXO I", "Serviço A    2,00%", "ANEXO II", "Prazo de 30 dias"]).join("\n");
    const it = p.leiItensDaAlteradora(l, p.leiLerAlteradora(t3, l));
    const ax = it.filter((x) => /^ANEXO:/.test(x.num));
    ok(ax.length === 2 && /2,00%/.test(ax[0].novo) && /30 dias/.test(ax[1].novo), "I8 anexos sem o numero do alvo casam por posicao: " + JSON.stringify(ax.map((x) => [x.num, x.novo])));
  }

  /* ==============================================================
   * L: APLICAR (a peça pura)
   * ============================================================== */
  {
    const antes = [{ titulo: "ANEXO VI", texto: ANEXO_VI_ANTIGO }, { titulo: "ANEXO XI", texto: ANEXO_XI_ANTIGO }];
    const copia = JSON.stringify(antes);
    const l1 = p.leiAplicarAnexo(antes, { num: "ANEXO:VI", tipo: "anexo_subst", novo: "ANEXO VI\nNOVA", dataLei: "2024-12-23" }, { fonte: "LC 145/2024", data: "2026-01-01" });
    ok(JSON.stringify(antes) === copia, "L1 a lista recebida nao e' mudada");
    ok(l1[0].texto === "ANEXO VI\nNOVA" && l1[0].textoOriginal === ANEXO_VI_ANTIGO && l1[0].revogado === false && l1[0].historico.length === 1 && l1[0].fonteAlteracao === "LC 145/2024",
      "L2 substituir: novo texto, o antigo guardado, historico: " + JSON.stringify(l1[0]).slice(0, 240));
    const l2 = p.leiAplicarAnexo(l1, { num: "ANEXO:VI", tipo: "anexo_subst", novo: "ANEXO VI\nMAIS NOVA", dataLei: "2025-05-01" }, { fonte: "LC 150/2025", data: "2026-02-01" });
    ok(l2[0].textoOriginal === ANEXO_VI_ANTIGO && l2[0].historico.length === 2 && l2[0].fonteAlteracao === "LC 145/2024; LC 150/2025", "L3 substituir de novo: o ORIGINAL continua sendo o primeiro: " + l2[0].textoOriginal.slice(0, 30));
    const l3 = p.leiAplicarAnexo(antes, { num: "ANEXO:XI", tipo: "anexo_rev", dataLei: "2024-12-23" }, { fonte: "LC 145/2024", data: "2026-01-01" });
    ok(l3[1].revogado === true && l3[1].texto === ANEXO_XI_ANTIGO, "L4 revogar nao apaga a tabela: " + JSON.stringify(l3[1]).slice(0, 200));
    const l4 = p.leiAplicarAnexo(antes, { num: "ANEXO:VII", tipo: "anexo_subst", novo: "ANEXO VII\nX", dataLei: "2024-12-23" }, { fonte: "LC 145/2024", data: "2026-01-01" });
    ok(l4.length === 3 && l4[2].titulo === "ANEXO VII" && l4[2].texto === "ANEXO VII\nX" && l4[2].textoOriginal === undefined, "L5 anexo que nao existia e' criado (sem 'original'): " + JSON.stringify(l4[2]));
  }

  /* ==============================================================
   * U: A TELA
   * ============================================================== */
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const montar = () => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_lc15", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE,
      anexos: [{ titulo: "ANEXO VI", texto: ANEXO_VI_ANTIGO }, { titulo: "ANEXO XI", texto: ANEXO_XI_ANTIGO }] });
    api.leiAbrir("Direito Tributário", "CTM", l.id);
    api.leiAtualizarAbrir();
    return { api, l };
  };
  {
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true; api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = LC145;
    const r = api.leiAtualizarComparar();
    ok(r === true && api.$("dlgLeiPre").open !== true, "U1 as tabelas do fim da lei alteradora NAO abrem a revisao de 'anexos' (sao lidas aqui): " + r);
    ok(/ANEXO I\b/.test(api.$("leiUpdTexto").value) && /TABELA DE ALÍQUOTAS/.test(api.$("leiUpdTexto").value), "U1a o texto colado continua inteiro na caixa");
    const it = api.leiUpdComparoAtual();
    ok(it.map((x) => x.num).join() === "162,ANEXO:VI,ANEXO:VII,ANEXO:XI", "U2 os anexos entram na lista de decisao: " + it.map((x) => x.num));
    api.leiUpdMover(1);
    const txt = api.$("leiUpdItem").textContent || "";
    ok(/Anexo VI — tabela substituída/.test(txt), "U3 o titulo diz 'Anexo VI', nao 'Art. VI': " + txt.slice(0, 90));
    ok(/1,00%/.test(txt) && /2,00%/.test(txt), "U3a a tabela antiga e a nova aparecem na tela");
    ok(achar(api.$("leiUpdItem"), (c) => /lei-upd-al/.test(c.className || "")).some((c) => /SUBSTITUI o antigo por inteiro/.test(c.textContent)), "U3b o alerta 'a tabela substitui por inteiro' aparece");
    api.leiUpdMover(2);
    ok(/Anexo XI — anexo revogado/.test(api.$("leiUpdItem").textContent || ""), "U4 o Anexo XI aparece como revogado");
    ok(!achar(api.$("leiUpdItem"), (c) => c.id === "leiUpdProposto").length, "U4a nao ha caixa de edicao de mesclagem para anexo");
    /* decisao: aceita o VI, recusa o VII, deixa o XI sem decidir */
    api.leiUpdMover(-2);
    api.leiUpdAceitar();
    api.leiUpdMover(1);
    api.leiUpdPular();
    api.leiAtualizarAplicar();
    const dep = api.leiDe("lei_lc15");
    const vi = dep.anexos.filter((a) => a.titulo === "ANEXO VI")[0];
    ok(dep.anexos.length === 2 && /2,00%/.test(vi.texto) && vi.textoOriginal === ANEXO_VI_ANTIGO, "U5 so o VI aceito mudou; o antigo ficou guardado: " + JSON.stringify(dep.anexos).slice(0, 260));
    ok(vi.historico.length === 1 && vi.historico[0].fonte === "LC 145/2024" && vi.historico[0].dataLei === "2024-12-23", "U5a o historico diz quem mudou o anexo: " + JSON.stringify(vi.historico));
    ok(!dep.anexos.some((a) => /VII$/.test(a.titulo)) && dep.anexos.filter((a) => a.titulo === "ANEXO XI")[0].revogado !== true, "U5b o recusado e o sem decisao nao entram");
    ok(dep.texto === BASE && !dep.alteracoes["ANEXO:VI"] && Object.keys(dep.alteracoes || {}).length === 0, "U5c o texto dos artigos nao foi tocado e o anexo nao virou 'artigo alterado': " + Object.keys(dep.alteracoes || {}));
    /* a lei que ALTERA foi guardada com os anexos a parte e o corpo limpo */
    const alt = api.leisLista().filter((x) => /145/.test(x.nome))[0];
    ok(alt && !/TABELA DE ALÍQUOTAS/.test(alt.texto) && (alt.anexos || []).length === 2 && /Serviço B\s+5,00%/.test(alt.anexos[0].texto), "U6 a lei que altera guarda o corpo sem as tabelas, e as tabelas como anexos: " + (alt && JSON.stringify((alt.anexos || []).map((a) => a.titulo))));
    /* a tela da lei mostra o anexo substituido e o anterior */
    api.leiPintarAnexos();
    const cx = api.$("leiAnexos");
    const sumarios = achar(cx, (c) => c.tag === "summary" || c.tagName === "SUMMARY").map((c) => c.textContent);
    ok(sumarios.some((s) => /ANEXO VI/.test(s) && /substituído por LC 145\/2024/.test(s)), "U7 o Anexo VI aparece como substituido por LC 145/2024: " + JSON.stringify(sumarios));
    ok(sumarios.some((s) => /anexo anterior/i.test(s)), "U7a ha o caminho para ver o anexo anterior: " + JSON.stringify(sumarios));
  }
  {
    /* aceitar a revogacao: a tabela continua guardada e marcada */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true; api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = LC145;
    api.leiAtualizarComparar();
    api.leiUpdComparoAtual().filter((x) => x.num === "ANEXO:XI").forEach((x) => { x.aceito = true; });
    api.leiAtualizarAplicar();
    const xi = api.leiDe("lei_lc15").anexos.filter((a) => a.titulo === "ANEXO XI")[0];
    ok(xi.revogado === true && xi.texto === ANEXO_XI_ANTIGO, "U8 anexo revogado continua guardado: " + JSON.stringify(xi).slice(0, 200));
    api.leiPintarAnexos();
    const sumarios = achar(api.$("leiAnexos"), (c) => c.tag === "summary" || c.tagName === "SUMMARY").map((c) => c.textContent);
    ok(sumarios.some((s) => /ANEXO XI/.test(s) && /revogado por LC 145\/2024/.test(s)), "U8a a lei mostra 'revogado por LC 145/2024': " + JSON.stringify(sumarios));
  }
  {
    /* ordem de substituir SEM o texto do anexo novo: o aviso aparece na tela e nada e' proposto */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true; api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = CAB.concat(CORPO).join("\n");
    api.leiAtualizarComparar();
    const txt = api.$("leiUpdItem").textContent || "";
    ok(/Anexo VI/.test(txt) && /não veio na colagem/.test(txt), "U9 o app avisa que o texto do anexo novo nao veio: " + txt.slice(-260));
  }
  {
    /* colar como 'lei inteira' um texto que PARECE alteradora nao pode engolir os anexos */
    const { api } = montar();
    api.$("leiUpdFonte").value = "LC 145/2024";
    api.$("leiUpdTexto").value = LC145.replace("“ Art. 162", "Art. 162");
    api.leiAtualizarComparar();
    ok(api.$("dlgLeiPre").open !== true || !/Anexo|ANEXO/.test(api.$("leiPreLista") ? (api.$("leiPreLista").textContent || "") : ""), "U10 a revisao da colagem 'inteira' que parece alteradora nao oferece separar anexos");
    ok(/TABELA DE ALÍQUOTAS/.test(api.$("leiUpdTexto").value), "U10a os anexos continuam no texto para o modo 'so alteracoes'");
  }

  /* ==============================================================
   * R: O PDF CONSOLIDADO — sufixos sem hífen, artigo revogado e incisos que pulam
   * ============================================================== */
  {
    const hs = (t) => p.leiCabecalhosAlteradora(t).map((h) => h.numCru);
    ok(hs("Art. 343A Fica criado o registro.\nArt. 343B Fica criado outro.").join() === "343-A,343-B", "R1 'Art. 343A' e' o 343-A: " + hs("Art. 343A Fica criado o registro."));
    ok(hs("Art. 356. (Revogado)\nArt. 356. B São responsáveis os tomadores.\nArt. 356. C A Taxa de Fiscalização será devida.").join() === "356,356-B,356-C",
      "R2 'Art. 356. B São…' e' o 356-B: " + hs("Art. 356. (Revogado)\nArt. 356. B São responsáveis os tomadores.\nArt. 356. C A Taxa"));
    ok(hs("Art. 10. O prazo será de dez dias.\nArt. 11. A multa será de 10%.").join() === "10,11", "R3 'Art. 10. O prazo' NAO vira 10-O: " + hs("Art. 10. O prazo será de dez dias.\nArt. 11. A multa"));
    ok(hs("Art. 356. A São responsáveis os tomadores.").join() === "356", "R3a 'Art. 356. A São' sozinho (sem o B) fica como artigo 356");
    ok(hs("Art. 5º. Os prazos.\nArt. 6º O prazo.").join() === "5,6", "R3b com ordinal nunca ha sufixo de letra");
  }
  {
    const l = lei();
    const t = CAB.concat(["“Art. 383 (Revogado)", "Art. 384 (Revogado)", "Art. 385. (Revogado)", "Art. 999 (Revogado)", "Art. 2º Vigência."]).join("\n");
    const it = p.leiItensDaAlteradora(l, p.leiLerAlteradora(t, l));
    ok(it.map((x) => x.num + ":" + x.tipo).join() === "383:revogado,384:revogado,385:revogado", "R4 'Art. 383 (Revogado)' revoga o artigo inteiro (e o 999, que nao existe, nao vira item): " + it.map((x) => x.num + ":" + x.tipo));
    ok(it.avisos.some((a) => a.k === "revogar_ausente" && /999/.test(a.texto)), "R4a o art. inexistente vira aviso: " + JSON.stringify(it.avisos));
    ok(l.texto === BASE, "R4b nada e' gravado");
    const b385 = p.leiLerAlteradora(t, l).blocos.filter((b) => b.num === "383")[0].bloco;
    ok(b385.revogado === true && b385.caputAcao === "rev", "R4c (art. 383) o caput curto '(Revogado)' continua sendo revogacao, nao 'omitido': " + JSON.stringify(b385));
  }
  {
    const l = lei();
    const t = CAB.concat(["“Art. 356 [...]", "II. (Revogado) V. Taxa de licença. (NR)", "Art. 2º Vigência."]).join("\n");
    const par = p.leiLerAlteradora(t, l);
    const u = par.blocos[0].bloco.unidades.map((x) => x.chave + "/" + x.acao).join();
    ok(/II\/rev/.test(u) && /V\/nr/.test(u), "R5 os incisos que pulam (II e depois V) sao lidos: " + u);
    const t5 = CAB.concat(["“Art. 356 [...]", "II. (Revogado)", "V. Taxa de licença. (NR)", "Art. 2º Vigência."]).join("\n");
    const u5 = p.leiLerAlteradora(t5, l).blocos[0].bloco.unidades.map((x) => x.chave + "/" + x.acao).join();
    ok(/II\/rev/.test(u5) && /V\/nr/.test(u5), "R5a o mesmo, um inciso por linha: " + u5);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
