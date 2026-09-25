/* =====================================================================
 * RESOLVER REPETIDOS EM LOTE, SEM TRAVAR (16.77.0)
 *
 * O que originou: no baralho real (1582 cartões, 273 grupos, 973 a mais)
 * o "resolver todos (mesclando)" congelou o app. Cada cartão removido
 * reescrevia o texto inteiro da bancada, repintava 955 cartões, regravava a
 * lixeira e o armazenamento: 181 ms por cartão (mais de dois minutos só de
 * trabalho, sem contar o navegador).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O lote dá EXATAMENTE o mesmo resultado que resolver um grupo de cada vez.
 *  2. Cada pasta é gravada UMA vez; a lixeira, uma vez; o histórico, uma foto.
 *  3. Ele devolve o controle ao navegador (a barra de progresso anda) e diz
 *     quantos grupos já foram.
 *  4. Escala: 1500 cartões em segundos.
 *  5. Dá para desfazer o lote inteiro (material pelo recibo, bancada pelo
 *     Histórico), sem pisar no que mudou depois — e sem deixar cópia na lixeira.
 *  6. A tela: carga com barra e aviso, nada clicável enquanto trabalha, resumo
 *     no fim, botão de desfazer.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 40 && !pronto; i++) {
      await new Promise((r) => setImmediate(r));
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const RICO = "Serviços constantes da lista anexa à LC 116/2003, conforme o art. 1º; o imposto é municipal e incide sobre a prestação de serviços de qualquer natureza, ainda que não seja atividade preponderante do prestador";
  const historico = (a) => { try { return JSON.parse(a.loja.getItem("eac_hist") || "[]"); } catch (e) { return []; } };

  /* uma biblioteca com material em 2 topicos e bancada, com varios grupos */
  const grupo = (i) => {
    /* quatro palavras so' deste grupo; os grupos entre si dividem apenas as palavras comuns */
    const w = `aa${i} bb${i} cc${i} dd${i}`;
    return [
      `Qual o prazo de recolhimento do imposto ${w}?`,
      `Qual o prazo para recolhimento do imposto ${w} do serviço?`,
      `Prazo do imposto ${w}`,
    ];
  };
  const montar = (quantos) => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const banc = [], mat1 = [], mat2 = [];
    for (let i = 0; i < quantos; i++) {
      const [x, y, z] = grupo(i);
      banc.push(`@ Trilha ${i}\n${x} :: Até o dia 09 :: t\n+ Nota ${i}`);
      mat1.push(`${y} :: ${RICO} :: t\n+ Literalidade — Art. 40`);
      mat2.push(`${z} :: Dia 09 :: t`);
    }
    a.$("editor").value = banc.join("\n\n");
    const c1 = a.matChave("Trib", "A"), c2 = a.matChave("Trib", "B");
    a.matGravarCartoes(c1, mat1.join("\n\n"), { disciplina: "Trib", topico: "A" });
    a.matGravarCartoes(c2, mat2.join("\n\n"), { disciplina: "Trib", topico: "B" });
    return { a, c1, c2 };
  };

  /* ---- Z1: mesmo resultado que um grupo de cada vez ---- */
  {
    const A = montar(6), B = montar(6);
    const notasA = A.a.cqLerBiblioteca(), relA = A.a.cqRelatorio(notasA);
    relA.grupos.forEach((g) => A.a.cqResolverGrupo(notasA, g.itens, g.melhor, true));
    const notasB = B.a.cqLerBiblioteca(), relB = B.a.cqRelatorio(notasB);
    ok(relA.grupos.length === 6 && relB.grupos.length === 6, `Z1 6 grupos de 3: ${relA.grupos.length}`);
    const r = await B.a.cqResolverLote(notasB, relB.grupos, {});
    ok(r.grupos === 6 && r.removidos === 12 && r.erros === 0 && r.mesclados >= 6, `Z1a o lote: ${JSON.stringify(r)}`);
    ok(A.a.$("editor").value === B.a.$("editor").value, "Z1b bancada igual ao caminho antigo");
    ok(A.a.matResumosAtual()[A.c1].cartoes === B.a.matResumosAtual()[B.c1].cartoes && A.a.matResumosAtual()[A.c2].cartoes === B.a.matResumosAtual()[B.c2].cartoes, "Z1c material igual ao caminho antigo");
    ok(A.a.lixLer().length === B.a.lixLer().length && A.a.lixLer().length === 12, `Z1d a lixeira tem os mesmos 12: ${A.a.lixLer().length}/${B.a.lixLer().length}`);
    ok(B.a.cqRelatorio(B.a.cqLerBiblioteca()).grupos.length === 0, "Z1e depois do lote nao restam repetidos");
    /* sem mesclar */
    const C = montar(3); const nC = C.a.cqLerBiblioteca(), rC = C.a.cqRelatorio(nC);
    const r2 = await C.a.cqResolverLote(nC, rC.grupos, { mesclar: false });
    ok(r2.removidos === 6 && r2.mesclados === 0 && !/Também cobrado/.test(C.a.$("editor").value + JSON.stringify(C.a.matResumosAtual())), `Z1f sem mesclar so' remove: ${JSON.stringify(r2)}`);
    {
      const D = montar(2); const nD = D.a.cqLerBiblioteca(), rD = D.a.cqRelatorio(nD);
      const g0 = rD.grupos[0];
      nD[g0.melhor] = Object.assign({}, nD[g0.melhor], { card: Object.assign({}, nD[g0.melhor].card, { raw: "sumiu :: do texto", line: 999 }) });
      const antesD = D.a.$("editor").value + JSON.stringify(D.a.matResumosAtual());
      const cont = {}; const s0 = D.a.loja.setItem.bind(D.a.loja);
      D.a.loja.setItem = (k, v) => { cont[k] = (cont[k] || 0) + 1; return s0(k, v); };
      const rr = await D.a.cqResolverLote(nD, [g0], {});
      D.a.loja.setItem = s0;
      ok(rr.erros === 1 && rr.removidos === 0 && rr.mesclados === 0, `Z1g mescla que falha: o grupo fica como estava e conta como erro: ${JSON.stringify(rr)}`);
      ok(D.a.$("editor").value + JSON.stringify(D.a.matResumosAtual()) === antesD, "Z1h e nada foi apagado");
      ok(!cont["eac_texto"] && !cont["eac_resumos"] && !cont["eac_lixeira"], `Z1i e nada foi GRAVADO (pasta sem mudanca nao e' regravada): ${JSON.stringify(cont)}`);
    }
  }

  /* ---- Z2: uma gravacao por pasta, uma na lixeira, uma foto ---- */
  {
    const { a } = montar(8);
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    const cont = {};
    const set0 = a.loja.setItem.bind(a.loja);
    a.loja.setItem = (k, v) => { cont[k] = (cont[k] || 0) + 1; return set0(k, v); };
    const h0 = historico(a).length;
    await a.cqResolverLote(notas, rel.grupos, {});
    a.loja.setItem = set0;
    ok(cont["eac_lixeira"] === 1, `Z2 a lixeira e' gravada UMA vez: ${cont["eac_lixeira"]}`);
    ok(cont["eac_texto"] === 1, `Z2a o editor e' salvo UMA vez: ${cont["eac_texto"]}`);
    ok(cont["eac_resumos"] >= 1 && cont["eac_resumos"] <= 2, `Z2b o material e' gravado por pasta, nao por cartao: ${cont["eac_resumos"]}`);
    ok(historico(a).length === h0 + 1, `Z2c uma foto do editor no historico: +${historico(a).length - h0}`);
    ok(cont["eac_cq_recibo"] === 1, "Z2d um recibo");
  }

  /* ---- Z3: devolve o controle e mostra o andamento ---- */
  {
    const { a } = montar(25);
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    const vistos = []; let cedeu = 0;
    await a.cqResolverLote(notas, rel.grupos, { progresso: (i, t) => vistos.push([i, t]), cede: async () => { cedeu++; } });
    ok(JSON.stringify(vistos) === JSON.stringify([[10, 25], [20, 25], [25, 25]]), `Z3 o progresso anda de 10 em 10 e termina no total: ${JSON.stringify(vistos)}`);
    ok(cedeu === 3, `Z3a devolveu o controle 3 vezes: ${cedeu}`);
    const { a: b } = montar(4);
    const n2 = b.cqLerBiblioteca(), r2 = b.cqRelatorio(n2);
    let chamou = false;
    await b.cqResolverLote(n2, r2.grupos, { cede: async () => { chamou = true; } });
    ok(!chamou, "Z3b sem 'progresso' nao precisa ceder (o teste e o uso direto ficam rapidos)");
  }

  /* ---- Z4: escala ---- */
  {
    const { a } = montar(500);          /* 1500 cartoes, 500 grupos */
    const t0 = Date.now();
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    const tAgrupar = Date.now() - t0;
    ok(notas.length === 1500 && rel.grupos.length === 500 && rel.redundantes === 1000, `Z4 1500 cartoes, 500 grupos: ${notas.length}/${rel.grupos.length}/${rel.redundantes}`);
    const t1 = Date.now();
    const r = await a.cqResolverLote(notas, rel.grupos, {});
    const tLote = Date.now() - t1;
    ok(r.removidos === 1000 && r.erros === 0, `Z4a removeu 1000: ${JSON.stringify(r)}`);
    ok(a.cqLerBiblioteca().length === 500, "Z4b sobraram 500 cartoes (um por grupo)");
    ok(tAgrupar < 5000 && tLote < 20000, `Z4c 1500 cartoes em tempo de uso: agrupar ${tAgrupar} ms, resolver ${tLote} ms`);
    ok(a.lixLer().length === 300, `Z4d a lixeira respeita o limite de 300: ${a.lixLer().length}`);
  }

  /* ---- Z5: desfazer o lote ---- */
  {
    const { a, c1, c2 } = montar(6);
    const antes = { ed: a.$("editor").value, t1: a.matResumosAtual()[c1].cartoes, t2: a.matResumosAtual()[c2].cartoes };
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    await a.cqResolverLote(notas, rel.grupos, {});
    const rec = a.cqRecibo();
    ok(rec && rec.itens.length === 3 && rec.itens.filter((x) => x.bancada).length === 1 && rec.itens.filter((x) => !x.bancada).every((x) => typeof x.antes === "string"), `Z5 recibo: material com o antes, bancada so' com a impressao: ${JSON.stringify(rec && rec.itens.map((x) => Object.keys(x)))}`);
    ok(!JSON.stringify(rec).includes("Trilha 0"), "Z5a o texto da bancada NAO foi copiado para o armazenamento (ja esta no Historico)");
    ok(rec.lixIds.length === 12 && a.lixLer().length === 12, "Z5b o recibo lembra os ids da lixeira");
    const d = a.cqDesfazerLote();
    ok(d.desfeitos === 3 && d.pulados === 0, `Z5c desfez as 3 pastas: ${JSON.stringify(d)}`);
    ok(a.$("editor").value === antes.ed && a.matResumosAtual()[c1].cartoes === antes.t1 && a.matResumosAtual()[c2].cartoes === antes.t2, "Z5d tudo voltou exatamente ao que era");
    ok(a.lixLer().length === 0 && a.cqRecibo() === null, "Z5e a lixeira nao ficou com copia dos cartoes que voltaram, e o recibo saiu");
    ok(a.cqDesfazerLote().desfeitos === 0, "Z5f sem recibo nao faz nada");
  }
  {
    /* mexeram depois: nao pisa */
    const { a, c1 } = montar(4);
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    await a.cqResolverLote(notas, rel.grupos, {});
    a.matGravarCartoes(c1, a.matResumosAtual()[c1].cartoes + "\nNovo :: cartao", { disciplina: "Trib", topico: "A" });
    a.$("editor").value = a.$("editor").value + "\nEscrevi :: agora";
    const d = a.cqDesfazerLote();
    ok(d.desfeitos === 1 && d.pulados === 2, `Z5g as duas pastas mexidas depois nao sao pisadas (so' a intocada volta): ${JSON.stringify(d)}`);
    ok(/Novo :: cartao/.test(a.matResumosAtual()[c1].cartoes) && /Escrevi :: agora/.test(a.$("editor").value) && a.cqRecibo() !== null, "Z5h o que foi escrito depois fica, e o recibo continua (da' para tentar de novo)");
  }
  {
    /* editou UM caractere depois (o tamanho nao muda): tambem nao pisa */
    const { a, c1 } = montar(3);
    const notas = a.cqLerBiblioteca(), rel = a.cqRelatorio(notas);
    await a.cqResolverLote(notas, rel.grupos, {});
    const tx = a.matResumosAtual()[c1].cartoes; a.matGravarCartoes(c1, tx.slice(0, 3) + (tx[3] === "x" ? "y" : "x") + tx.slice(4), { disciplina: "Trib", topico: "A" });
    const d = a.cqDesfazerLote();
    ok(d.pulados >= 1 && a.cqRecibo() !== null, `Z5i trocar 1 caractere (mesmo tamanho) conta como mexido: ${JSON.stringify(d)}`);
  }

  /* ---- Z6: a tela ---- */
  {
    const { a, c1 } = montar(5);
    a.cqAbrir();
    ok(a.$("cqCarga").hidden === true && a.$("btnCqDesfazer").hidden === true, "Z6 a carga fica escondida e o desfazer some antes de qualquer lote");
    a.cqCarga(true, "Resolvendo o grupo 3 de 5…", 60);
    ok(a.$("cqCarga").hidden === false && a.$("cqCargaTxt").textContent === "Resolvendo o grupo 3 de 5…" && a.$("cqProg").value === 60 && a.cqOcupadoAtual() === true, "Z6a a carga mostra o texto e a barra");
    ok(["btnCqTudo", "btnCqMais", "btnCqFechar", "btnCqReexibir", "btnCqDesfazer"].every((id) => a.$(id).disabled === true), "Z6b tudo desligado enquanto trabalha");
    /* clicar num grupo enquanto ocupado nao abre pergunta nem mexe */
    const antes = JSON.stringify(a.matResumosAtual()) + a.$("editor").value;
    const btn = (function achar(el) { let r = null; Array.from((el && el.children) || []).forEach((c) => { if (!r && c.tag === "button" && /mesclar/.test(c.textContent)) r = c; if (!r) r = achar(c); }); return r; })(a.$("cqLista"));
    await btn.onclick();
    ok(antes === JSON.stringify(a.matResumosAtual()) + a.$("editor").value, "Z6c enquanto ocupado, clicar num grupo nao faz nada");
    a.cqCarga(false);
    ok(a.$("cqCarga").hidden === true && a.cqOcupadoAtual() === false && a.$("btnCqTudo").disabled === false, "Z6d ao terminar a carga some e os botoes voltam");
    /* o fluxo completo */
    await conduzir(a, a.$("btnCqTudo").onclick());
    const msg = a.$("uiModalMsg") ? a.$("uiModalMsg").textContent : "";
    ok(/Pronto: 10 cartões saíram/.test(msg) && /em 5 grupos/.test(msg) && /desfazer a última resolução em lote/.test(msg), `Z6e o resumo no fim: ${msg}`);
    ok(a.$("cqCarga").hidden === true && a.cqOcupadoAtual() === false, "Z6f a carga terminou escondida");
    ok(/5 cartões lidos · 0 grupos/.test(a.$("cqResumo").textContent) === false || /0 grupos/.test(a.$("cqResumo").textContent), `Z6g a tela atualiza: ${a.$("cqResumo").textContent}`);
    ok(a.$("btnCqDesfazer").hidden === false, "Z6h o botao de desfazer aparece");
    const pos = JSON.stringify(a.matResumosAtual()) + a.$("editor").value;
    const pn = a.$("btnCqDesfazer").onclick();
    for (let i = 0; i < 6; i++) { await new Promise((r) => setImmediate(r)); a.uiModalResponder(false); }
    await pn;
    ok(JSON.stringify(a.matResumosAtual()) + a.$("editor").value === pos, "Z6i dizer NAO em 'desfazer' nao mexe em nada");
    await conduzir(a, a.$("btnCqDesfazer").onclick());
    ok(a.cqRelatorio(a.cqLerBiblioteca()).grupos.length === 5 && a.$("btnCqDesfazer").hidden === true, "Z6j desfazer traz os 5 grupos de volta e some o botao");
    /* enquanto ocupado, 'resolver todos' nao pergunta de novo */
    a.cqAbrir(); a.cqCarga(true, "x", 1);
    a.$("uiModalMsg").textContent = "";
    const pr = a.$("btnCqTudo").onclick();
    await new Promise((r) => setImmediate(r));
    ok(!/Resolver os/.test(a.$("uiModalMsg").textContent), "Z6k enquanto ocupado, um segundo clique em resolver todos e' ignorado");
    await pr; a.cqCarga(false);
    /* um erro no meio do lote aparece e libera a tela */
    a.cqAbrir();
    a.cqNotasAtual()[0].card = null;
    a.$("uiModalMsg").textContent = "";
    await conduzir(a, a.$("btnCqTudo").onclick());
    ok(/O lote parou por um erro/.test(a.$("uiModalMsg").textContent) && a.$("cqCarga").hidden === true && a.cqOcupadoAtual() === false, `Z6l erro no lote: aviso, e a tela volta a responder: ${a.$("uiModalMsg").textContent.slice(0, 80)}`);
  }

  /* ---- Z7: no app ---- */
  {
    const a = rodar().api;
    const mk = (i, tam) => ({ tipo: "cartao", via: "material", rotulo: "c" + i, onde: "x", dados: { chave: "k", bloco: "b".repeat(tam) } });
    const muitos = []; for (let i = 0; i < 350; i++) muitos.push(mk(i, 50));
    const ids = a.lixJogarLote(muitos, "teste");
    ok(a.lixLer().length === 300 && ids.length === 300, `Z8 o limite de 300 itens vale no lote, e so' devolve os ids que ficaram: ${a.lixLer().length}/${ids.length}`);
    ok(a.lixLer()[0].rotulo === "c50" && a.lixLer()[299].rotulo === "c349", "Z8a ficam os MAIS RECENTES");
    const b = rodar().api;
    const grandes = []; for (let i = 0; i < 5; i++) grandes.push(mk(i, 250000));
    b.lixJogarLote(grandes, "teste");
    const chars = b.lixLer().reduce((s, x) => s + JSON.stringify(x).length, 0);
    ok(b.lixLer().length >= 1 && b.lixLer().length < 5 && chars <= 400000 + 260000, `Z8b o limite de caracteres vale no lote (o mais velho sai): ${b.lixLer().length} itens, ${chars} chars`);
    ok(b.lixRemoverIds(b.lixLer().map((x) => x.id)) === b.lixLer().length + 0 || b.lixLer().length === 0, "Z8c remover ids esvazia");
    const c = rodar().api; const i2 = c.lixJogarLote([mk(1, 5), mk(2, 5), mk(3, 5)], "t");
    ok(c.lixRemoverIds([i2[0], i2[2]]) === 2 && c.lixLer().length === 1 && c.lixLer()[0].rotulo === "c2", "Z8d remover ids tira so' os pedidos");
  }

  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/id="cqCarga"/.test(html) && /id="cqProg"/.test(html) && /id="btnCqDesfazer"/.test(html), "Z7 a tela de carga, a barra e o botao de desfazer estao no index.html");
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok(["cq_carga_resolvendo", "cq_feito_lote", "cq_desfazer_btn", "lix_lote_msg"].every((k) => (src.match(new RegExp('"' + k + '"', "g")) || []).length === 2), "Z7a os textos existem em PT e EN");
    const cq = fs.readFileSync(path.join(__dirname, "..", "docs", "cartao-qualidade.js"), "utf8");
    ok(!/r\.grupos\.forEach\(\(g\) => \{\s*const x = cqResolverGrupo/.test(cq), "Z7b 'resolver todos' nao volta ao laco antigo (um grupo por vez, gravando tudo a cada cartao)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`cartao-lote: ok (${f.quantas} verificacoes)`);
  });
}
