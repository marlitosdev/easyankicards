/* =====================================================================
 * A CONFERÊNCIA CRUZADA: "ATUALIZAR PARA UMA VERSÃO NOVA" x REVOGADO NO TEXTO (etapa 5)
 *
 * A comparação de versões (leiCompararVersoes) comparava um artigo AUSENTE na versão nova como "possivelmente
 * revogado", mas um artigo PRESENTE cujo texto novo é só "Art. X. (Revogado pela Lei Y)" caía em "mudou de
 * redação" — e disparava alarmes que não fazem sentido para isso ("só 9% das palavras coincidem", "texto bem
 * menor que o anterior"), sem aproveitar a fonte precisa que o texto novo já traz (que pode ser diferente da
 * fonte geral digitada no topo da tela).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Um artigo cujo texto NOVO consta como revogado/vetado/suprimido (leiRevogacaoDoArtigo) vira um tipo
 *     próprio ("revogado_texto"/"vetado_texto"/"suprimido_texto"), NÃO "mudou": sem os alarmes de tamanho/
 *     palavras, com um aviso informativo próprio, e com a fonte do PRÓPRIO texto (fonteItem), que pode diferir
 *     da fonte geral. Um "(Revogado…)" misturado com texto de verdade continua "mudou", com o aviso antigo.
 *  2. A tela mostra o tipo e a fonte no título; os dois lados (antes/depois) aparecem sem destaque de palavras
 *     (não é diff de redação, é revogação).
 *  3. Aceitar grava como REVOGADO (texto vazio, revogado:true), nunca como se a nota fosse a nova redação —
 *     com a fonte do texto quando existe, senão a fonte geral. O artigo passa a valer as regras de "fora do
 *     estudo" (etapa 3): some do progresso, de recitar e pede confirmação para cartão.
 *  4. O histórico de decisões usa uma regra própria por tipo, com a ação certa, e risco baixo (é um aviso
 *     informativo, não um alerta).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const p = iniciar();

  const doze = () => Array.from({ length: 12 }, (_, i) =>
    "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + " com redação própria e completa da lei.").join("\n");

  /* ---- 1: leiCompararVersoes — o tipo e os alertas ---- */
  {
    const base = doze().split("\n");
    const novo1 = base.slice();
    novo1[5] = "Art. 6º (Revogado pela Lei Complementar nº 227, de 2026)";        /* puro: SÓ a marca */
    const novo2 = base.slice();
    novo2[6] = "Art. 7º (VETADO).";
    const novo3 = base.slice();
    novo3[7] = "Art. 8º (Suprimido)";
    const cmp = (novo) => p.leiCompararVersoes(base.join("\n"), novo.join("\n"), {});
    const c1 = cmp(novo1), c2 = cmp(novo2), c3 = cmp(novo3);
    const item = (c, num) => c.itens.filter((i) => i.num === num)[0];
    ok(item(c1, "6").tipo === "revogado_texto" && item(c1, "6").revogacao.fonte === "Lei Complementar nº 227, de 2026" && item(c1, "6").fonteItem === "Lei Complementar nº 227, de 2026",
      "T1 art. 6º (Revogado pela …): tipo 'revogado_texto', com a fonte do PRÓPRIO texto: " + JSON.stringify(item(c1, "6")));
    ok(item(c2, "7").tipo === "vetado_texto" && item(c2, "7").revogacao.fonte === "", "T2 art. 7º (VETADO): tipo 'vetado_texto', sem fonte (o veto nao tem 'pela …'): " + JSON.stringify(item(c2, "7")));
    ok(item(c3, "8").tipo === "suprimido_texto", "T3 art. 8º (Suprimido): tipo 'suprimido_texto': " + JSON.stringify(item(c3, "8")));
    ok(item(c1, "6").antigo === base[5] && item(c1, "6").novo === novo1[5], "T4 antigo/novo guardam o texto de cada lado, por inteiro");
    /* SEM os alarmes de "mudou": o texto novo e' bem menor e quase nenhuma palavra coincide, e isso NAO deve alarmar aqui */
    const al = item(c1, "6").alertas;
    ok(!al.some((a) => a.k === "menor") && !al.some((a) => a.k === "outro") && !al.some((a) => a.k === "numeros") && !al.some((a) => a.k === "so_anotacao"),
      "T5 sem os alarmes de tamanho/palavras/numeros (nao fazem sentido para uma revogacao): " + JSON.stringify(al));
    ok(al.length === 1 && al[0].k === "revogado_texto" && al[0].sev === "info", "T6 so' o aviso informativo proprio, sem elevar o risco: " + JSON.stringify(al));
  }

  /* ---- 2: "(Revogado…)" MISTURADO com texto de verdade continua "mudou" (comportamento antigo preservado) ---- */
  {
    const base = doze().split("\n");
    const novo = base.slice();
    novo[8] = "Art. 9º (Revogado pela Lei nº 1) Mas o disposto no parágrafo único deste artigo permanece em vigor.";
    const cmp = p.leiCompararVersoes(base.join("\n"), novo.join("\n"), {});
    const it9 = cmp.itens.filter((i) => i.num === "9")[0];
    ok(it9.tipo === "mudou", "M1 texto real + a marca no meio: NAO e' 'revogado no texto' de verdade, continua 'mudou': " + JSON.stringify(it9 && it9.tipo));
    ok(it9.alertas.some((a) => a.k === "revogado_no_texto"), "M2 mas o aviso antigo (fraco) continua avisando: " + JSON.stringify(it9.alertas));
  }

  /* ---- 3: o caso AUSENTE (tipo "revogado") nao e' afetado ---- */
  {
    const base = doze().split("\n");
    const parcial = base.filter((_, i) => i !== 9).join("\n");         /* o art. 10 nao aparece */
    const cmp = p.leiCompararVersoes(base.join("\n"), parcial, { ausentes: "revogar" });
    const it10 = cmp.itens.filter((i) => i.num === "10")[0];
    ok(it10.tipo === "revogado" && it10.novo === "" && !it10.revogacao, "A1 ausente continua tipo 'revogado', sem 'revogacao' (a diferenca e' AUSENCIA, nao o texto dizer isso): " + JSON.stringify(it10));
    ok(it10.alertas.some((a) => a.k === "ausente"), "A2 o aviso de ausencia continua");
  }

  /* ---- 4: a tela ---- */
  {
    const a = iniciar();
    const base = doze();
    const l = a.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: base });
    a.leiAbrir("Direito", "T", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "atualização de 2026";
    const novoArr = base.split("\n");
    novoArr[5] = "Art. 6º (Revogado pela Lei Complementar nº 227, de 2026)";
    novoArr[6] = "Art. 7º (VETADO).";
    a.$("leiUpdTexto").value = novoArr.join("\n");
    a.leiAtualizarComparar();
    ok(a.$("dlgLeiCob").open !== true && a.$("leiUpdPasso2").hidden === false, "U1 sem cabecalho de PDF nem lei alteradora, vai direto pra comparacao (sem diálogo extra)");
    const it = a.leiUpdComparoAtual() || [];
    ok(it.length === 2 && it[0].tipo === "revogado_texto" && it[1].tipo === "vetado_texto", "U2 os arts. 6º e 7º mudam, como 'revogado_texto'/'vetado_texto': " + JSON.stringify(it.map((x) => [x.num, x.tipo])));
    a.leiUpdMostrar();
    const titulo = a.$("leiUpdItem").querySelector(".duv-titulo").textContent;
    ok(/^Art\. 6º — revogado \(consta no texto novo\) · Lei Complementar nº 227, de 2026$/.test(titulo), "U3 o titulo mostra o tipo E a fonte do texto: " + titulo);
    const lados = achar(a.$("leiUpdItem"), (c) => cls(c, "lei-upd-lado"));
    ok(lados.length === 2 && lados[0].textContent === it[0].antigo && lados[1].textContent === novoArr[5], "U4 os dois lados mostram o texto por inteiro");
    ok(achar(a.$("leiUpdItem"), (c) => achar(c, (m) => String(m.tag || m.tagName).toLowerCase() === "mark").length).length === 0, "U5 SEM destaque de palavras (nao e' diff de redacao, e' revogacao): " + lados.map((el) => el.innerHTML).join(" || "));
    const alDiv = achar(a.$("leiUpdItem"), (c) => cls(c, "lei-upd-al"));
    ok(alDiv.length === 1 && /revogado, vetado ou suprimido/.test(alDiv[0].textContent), "U6 o aviso informativo aparece na tela: " + (alDiv[0] && alDiv[0].textContent));
    /* fonte VAZIA (o VETADO do art. 7º nao tem "pela ...") nao deixa um " · " sobrando no titulo */
    a.leiUpdMover(1);
    a.leiUpdMostrar();
    const titulo7 = a.$("leiUpdItem").querySelector(".duv-titulo").textContent;
    ok(titulo7 === "Art. 7º — vetado (consta no texto novo)", "U7 sem fonte, o titulo nao sobra com ' · ' vazio: " + JSON.stringify(titulo7));
  }

  /* ---- 5: aceitar e aplicar ---- */
  {
    const a = iniciar();
    const base = doze();
    const l = a.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: base });
    a.leiAbrir("Direito", "T", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "atualização de 2026";
    const novoArr = base.split("\n");
    novoArr[5] = "Art. 6º (Revogado pela Lei Complementar nº 227, de 2026)";
    novoArr[6] = "Art. 7º (VETADO).";           /* sem fonte propria: deve cair na fonte GERAL */
    a.$("leiUpdTexto").value = novoArr.join("\n");
    a.leiAtualizarComparar();
    a.leiUpdComparoAtual().forEach((it, i) => { a.leiUpdMover ? null : null; });
    /* aceita os dois */
    for (let i = 0; i < a.leiUpdComparoAtual().length; i++) { a.leiUpdIdxAtual !== undefined ? null : null; }
    /* usa leiUpdMover para navegar e aceitar cada item */
    a.leiUpdMostrar();
    a.leiUpdAceitar();
    a.leiUpdMover(1);
    a.leiUpdAceitar();
    ok(a.leiUpdComparoAtual().every((x) => x.aceito), "P1 os dois itens foram aceitos: " + JSON.stringify(a.leiUpdComparoAtual().map((x) => [x.num, x.aceito])));
    a.leiAtualizarAplicar();
    const dep = a.leiDe(l.id);
    ok(dep.alteracoes["6"] && dep.alteracoes["6"].texto === "" && dep.alteracoes["6"].revogado === true && dep.alteracoes["6"].fonteAlteracao === "Lei Complementar nº 227, de 2026",
      "P2 art. 6º gravado como REVOGADO, com a fonte do PRÓPRIO texto (nao a geral): " + JSON.stringify(dep.alteracoes["6"]));
    ok(dep.alteracoes["7"] && dep.alteracoes["7"].texto === "" && dep.alteracoes["7"].revogado === true && dep.alteracoes["7"].fonteAlteracao === "atualização de 2026",
      "P3 art. 7º (VETADO, sem fonte propria) cai na fonte GERAL digitada no topo: " + JSON.stringify(dep.alteracoes["7"]));
    ok(dep.alteracoes["6"].historico[dep.alteracoes["6"].historico.length - 1].tipo === "revogado_texto", "P4 o historico do artigo guarda o tipo certo: " + JSON.stringify(dep.alteracoes["6"].historico));
    ok(!/\(Revogado pela/.test(dep.alteracoes["6"].texto), "P5 a nota de revogacao NAO fica guardada como se fosse o texto do artigo");
    /* a etapa 3 (fora do estudo) passa a valer para este artigo */
    const arts = a.leiArtigosEfetivos(dep);
    const a6 = arts.filter((x) => x.num === "6")[0];
    ok(a6.revogado === true && a.leiArtigoRevogado(a6) === true, "P6 o artigo vale como revogado nas regras de 'fora do estudo' (progresso, recitar, cartao): " + JSON.stringify(a6.revogado));
    const pg = a.leiProgresso(l.id);
    ok(pg.total === 10 && pg.revogados === 2, "P7 o progresso da lei ja conta so' os 10 vigentes: " + JSON.stringify([pg.total, pg.revogados]));
  }

  /* ---- 6: o historico de decisoes ---- */
  {
    const a = iniciar();
    const base = doze();
    const l = a.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: base });
    a.leiAbrir("Direito", "T", l.id);
    a.leiAtualizarAbrir();
    a.$("leiUpdFonte").value = "atualização de 2026";
    const novoArr = base.split("\n");
    novoArr[5] = "Art. 6º (Revogado pela Lei Complementar nº 227, de 2026)";
    a.$("leiUpdTexto").value = novoArr.join("\n");
    a.leiAtualizarComparar();
    a.leiUpdMostrar();
    a.leiUpdAceitar();
    a.leiAtualizarAplicar();
    const r = a.decLer().filter((x) => x.area === "versao")[0];
    ok(r.regra === "versao.revogado_texto" && r.risco === "baixo" && /próprio texto novo já diz isso/.test(r.proposta.acao),
      "D1 a decisao usa a regra propria, risco baixo, e a acao certa (nao 'substituir o anexo'): " + JSON.stringify([r.regra, r.risco, r.proposta.acao]));
  }

  /* ---- 7: os textos ---- */
  {
    const chaves = ["lei_upd_tipo_revogado_texto", "lei_upd_tipo_vetado_texto", "lei_upd_tipo_suprimido_texto", "lei_upd_al_revogado_texto",
      "dec_r_versao_revogado_texto", "dec_r_versao_vetado_texto", "dec_r_versao_suprimido_texto"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    ok(chaves.every((k) => linhas(k).length === 2), "I1 as frases existem em portugues e em ingles: " + chaves.filter((k) => linhas(k).length !== 2));
    /* as tres especies (revogado/vetado/suprimido) tem palavra propria em ingles, nao um copia-e-cola */
    const en = (k) => linhas(k)[1] || "";
    ok(/repealed/i.test(en("lei_upd_tipo_revogado_texto")) && /vetoed/i.test(en("lei_upd_tipo_vetado_texto")) && /removed/i.test(en("lei_upd_tipo_suprimido_texto")),
      "I2 o titulo em ingles usa a palavra certa por especie: " + [en("lei_upd_tipo_revogado_texto"), en("lei_upd_tipo_vetado_texto"), en("lei_upd_tipo_suprimido_texto")]);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
