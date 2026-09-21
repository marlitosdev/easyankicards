/* =====================================================================
 * ARTIGOS REPETIDOS: SÓ SE DECIDE ONDE HÁ INDÍCIO, E NADA DE LEI É APAGADO SEM AVISO
 *
 * Colando a LC 214/2025 a conferência de repetidos pediu 20 decisões (o botão de confirmar só liberava com todas):
 *  · 17 eram FALSAS — parágrafos da LC 123 citados entre aspas dentro dos arts. 516, 517, 518 e 530;
 *  · 2 eram um erro de numeração do próprio texto ("II … ; e / II … ." nos arts. 444 e 462): as duas redações são
 *    diferentes e as duas ficam;
 *  · 1 era real (art. 152, inciso II: a redação antiga e a nova "Redação dada pela LC 227").
 * E a revisão da colagem tinha marcado, por padrão, para APAGAR quatro vezes a linha "1. os incisos I e II do
 * caput; e" — item legítimo das alíneas dos artigos de vigência, tomado por cabeçalho de página.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. As linhas citadas (entre aspas) não são do artigo que as traz: o mesmo § dentro do bloco citado não é
 *     repetição. O bloco que a pessoa mandou tratar como texto comum volta a valer. Repetição REAL, fora das
 *     aspas, continua apontada.
 *  2. Item numerado ("1. …") e linha que termina em ";" ou ":" nunca são cabeçalho de página.
 *  3. Repetição dentro do MESMO artigo sem indício em nenhuma das versões: não pede escolha nem trava o
 *     confirmar; entra num bloco recolhido "só para conferir", com "manter todas" como padrão do app
 *     (registrado como "automático", e NÃO como "a lei repete de verdade"). Com indício ("Redação dada…")
 *     continua sendo decisão, com a sugestão marcada. Na atualização, e para artigo inteiro repetido, segue
 *     como antes.
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

  /* uma lei de verdade, com 14 artigos comuns e três que ALTERAM a LC 123 com parágrafos repetidos entre aspas */
  const PTS = ".".repeat(40);
  const L = ["LEI COMPLEMENTAR Nº 214, DE 2025"];
  for (let i = 1; i <= 14; i++) L.push("Art. " + i + "º Texto próprio do artigo " + i + ", que trata do imposto e da sua incidência.");
  L.push("Art. 20. A Lei Complementar nº 123, de 14 de dezembro de 2006, passa a vigorar com as seguintes alterações:");
  L.push("“Art. 13. Texto do artigo treze.", "§ 1º Primeiro parágrafo citado.", "§ 3º Terceiro parágrafo citado.” (NR)");
  L.push("“Art. 14. Texto do artigo quatorze.", "§ 1º Outro primeiro parágrafo citado.", "§ 3º Outro terceiro parágrafo citado, mais longo.", "§ 1º Último parágrafo citado, colado no proprio do artigo.” (NR)");
  L.push("§ 1º Este parágrafo é do próprio artigo 20.");
  L.push("Art. 21. A Lei nº 8.019, de 1990, passa a vigorar com as seguintes alterações:");
  L.push("“Art. 2º Texto do dois.", "§ 1º Mais um primeiro parágrafo citado.” (NR)");
  L.push("Art. 22. Esta Lei Complementar entra em vigor na data de sua publicação.");
  const A = L.join("\n");

  /* ---- 1: as linhas citadas não são do artigo ---- */
  {
    ok(p.leiEhAlteradora(A) === false, "P0 (a lei de teste NAO e' 'alteradora': tem so' 3 artigos que alteram outras leis)");
    const cit = p.leiLerCitacoes(A.split("\n"), {});
    ok(cit.blocos.length === 2 && cit.blocos[0].trechos.length === 2, "P0a (2 blocos: um por artigo que altera outra lei; o primeiro com 2 trechos citados): " + cit.blocos.length);
    ok(p.leiDuplicados(A).length === 0, "R1 o § 1º e o § 3º citados (varios blocos) dentro do art. 20 NAO sao repeticao: " + JSON.stringify(p.leiDuplicados(A).map((g) => g.num)));
    const rec = {}; cit.blocos.forEach((b) => { rec[b.id] = true; });
    ok(p.leiDuplicados(A, [], { recusados: rec }).length > 0, "R2 mandando tratar os blocos como texto comum, os parágrafos voltam a valer como do artigo (e se repetem)");
    const l = { id: "lei_x", texto: A, ajustesRecusados: rec };
    ok(p.leiRepetidosDaLei({ id: "lei_x", texto: A }).length === 0 && p.leiRepetidosDaLei(l).length > 0,
      "R3 a lei GUARDADA respeita a mesma escolha (e a memoria nao mistura as duas): " + p.leiRepetidosDaLei(l).length);
    /* repeticao real, fora das aspas, continua */
    const real = A.replace("Art. 22.", "Art. 21-A. O artigo tem o § 2º antigo.\n§ 2º A regra antiga do parágrafo.\n§ 2º A regra nova do parágrafo. (Redação dada pela Lei Complementar nº 227, de 2026)\nArt. 22.");
    const g = p.leiDuplicados(real);
    ok(g.length === 1 && g[0].intra === true && g[0].confianca === "forte" && g[0].motivo === "redacao", "R4 a repeticao REAL (fora das aspas) continua apontada, com a sugestao segura: " + JSON.stringify(g.map((x) => [x.num, x.confianca, x.motivo])));
    /* o § citado com o mesmo numero de um § PROPRIO do artigo nao os faz repetidos */
    const propriosDois = A.replace("§ 1º Este parágrafo é do próprio artigo 20.", "§ 1º Este parágrafo é do próprio artigo 20.\n§ 1º Este outro tambem e' do proprio artigo 20.");
    ok(p.leiDuplicados(propriosDois).length === 1 && /20/.test(p.leiDuplicados(propriosDois)[0].num), "R5 dois § 1º PROPRIOS do art. 20 continuam apontados (so' os citados saem)");
  }

  /* ---- 2: item de lista não é cabeçalho de página ---- */
  {
    ok(["1. os incisos I e II do caput; e", "2) o inciso III;", "texto que segue:", "os bens; ou", "  3. Item numerado sem ponto e virgula"].every((s) => p.leiLinhaDeConteudo(s)), "C1 item numerado e linha que termina em ; ou : sao conteudo");
    ok(["Presidência da República — Subchefia para Assuntos Jurídicos", "Casa Civil", "www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm", "Este texto não substitui o publicado no DOU de 17.1.2025"].every((s) => !p.leiLinhaDeConteudo(s)), "C2 cabecalho de pagina de verdade nao e' conteudo");
    const T = ["Art. 1º Texto um."];
    for (let k = 0; k < 4; k++) {
      T.push("Art. " + (30 + k) + ". Produz efeitos:", "I - a partir de 2027:", "a) do art. " + (4 + k) + ":", "1. os incisos I e II do caput; e", "2. o inciso " + (3 + k) + ";");
      for (let f = 0; f < 6; f++) T.push("Art. " + (40 + k * 10 + f) + ". Texto de enchimento numero " + (k * 10 + f) + " da lei de teste.");
    }
    const cab = (t) => p.leiPreprocessar(t).mudancas.filter((m) => m.grupo === "cabecalho");
    ok(cab(T.join("\n")).length === 0, "C3 a linha '1. os incisos I e II do caput; e' repetida em 4 artigos NAO e' cabecalho (a LC 214 a apagava por padrao): " + JSON.stringify(cab(T.join("\n")).map((m) => m.antes)));
    const H = T.map((s, i) => (i > 0 && i % 8 === 0 ? "Presidência da República — Subchefia para Assuntos Jurídicos" : s));
    ok(cab(H.join("\n")).length === 1, "C4 (controle) o cabecalho de pagina de verdade, repetido e espacado, continua sendo achado: " + cab(H.join("\n")).length);
  }

  /* ---- 3: a tela — só se decide onde há indício ---- */
  const fraca = ["Art. 1º Um.", "Art. 444. Fica concedido o crédito presumido.", "§ 4º O importador deverá recolher o imposto quando:",
    "I - a revenda não cumpra a exigência disposta no caput;", "II - não se comprove o ingresso do bem no estabelecimento de destino; e",
    "II - o bem seja revendido para fora da Zona Franca ou transferido para fora da Zona Franca.", "Art. 445. Outro artigo."].join("\n");
  {
    const g = p.leiDuplicados(fraca);
    ok(g.length === 1 && g[0].intra === true && g[0].confianca === "fraca" && p.leiDupSoConferir(g[0], "criar") && !p.leiDupSoConferir(g[0], "atualizar"),
      "T0 (a repeticao sem indicio dentro do artigo e' 'so' para conferir' na criacao e NAO na atualizacao): " + JSON.stringify(g.map((x) => [x.num, x.confianca])));
    ok(!p.leiDupSoConferir({ intra: false, confianca: "fraca" }, "criar") && !p.leiDupSoConferir({ intra: true, confianca: "forte" }, "criar"),
      "T0a artigo INTEIRO repetido e repeticao COM indicio continuam sendo decisao");
  }
  {
    const api = iniciar();
    const gs = api.leiDuplicados(fraca);
    const num = gs[0].num;
    let res = null;
    api.leiDuplicadosAbrir({ modo: "criar", texto: fraca, grupos: gs, aoConfirmar(r) { res = r; } });
    const dec = api.leiDupCtxAtual().decisoes[num];
    ok(dec && dec.manter === "todas" && dec.auto === true, "T1 o padrao do app e' manter todas, marcado como AUTOMATICO: " + JSON.stringify(dec));
    ok(api.$("btnLeiDupConfirmar").disabled === false, "T2 sem indicio dentro do artigo, o confirmar NAO trava");
    const lista = api.$("leiDupLista");
    const det = achar(lista, (c) => c.id === "leiDupConfer")[0];
    ok(!!det && det.open !== true && achar(det, (c) => c.id === "leiDupGrupo_" + num).length === 1, "T3 o grupo esta num bloco RECOLHIDO 'so' para conferir'");
    ok(Array.from(lista.children).every((c) => c.id !== "leiDupGrupo_" + num), "T3a e nao na lista principal de decisoes");
    ok(/só para conferir \(nada é apagado\)/.test(api.$("leiDupResumo").textContent) && /Só para conferir \(1\) — nada é apagado/.test(det.textContent), "T4 o resumo e o bloco dizem que nada e' apagado: " + api.$("leiDupResumo").textContent);
    ok(/erro de numeração do próprio texto/.test(det.textContent) && /nada é apagado/.test(det.textContent), "T4a o cartao explica o que pode ser (erro de numeracao da fonte)");
    ok(api.$("leiDupFaltam").textContent === "Tudo escolhido. Confirme para continuar.", "T4b nada 'falta' escolher: " + api.$("leiDupFaltam").textContent);
    api.$("btnLeiDupConfirmar").onclick();
    ok(res && res.texto.replace(/\n{3,}/g, "\n\n") === fraca.replace(/\n{3,}/g, "\n\n"), "T5 confirmar sem escolher NAO apaga nenhuma linha da lei");
    ok(res && res.resumo.length === 1 && res.resumo[0].acao === "todas" && res.resumo[0].auto === true, "T5a o resumo diz que foi o app que manteve (auto): " + JSON.stringify(res && res.resumo));
    const r = api.decLer().filter((x) => x.area === "repetidos")[0];
    ok(r && r.decisao === "automatico" && /manter todas/.test(r.escolha), "T5b o historico de decisoes registra 'automatico', nao 'recusou': " + JSON.stringify(r && [r.decisao, r.escolha]));
  }
  {
    /* a pessoa escolhe DE PROPOSITO */
    const api = iniciar();
    const gs = api.leiDuplicados(fraca);
    const num = gs[0].num;
    let res = null;
    api.leiDuplicadosAbrir({ modo: "criar", texto: fraca, grupos: gs, aoConfirmar(r) { res = r; } });
    const radios = () => achar(api.$("leiDupGrupo_" + num), (c) => c.type === "radio");
    ok(radios().length === 3 && radios().filter((r) => r.checked)[0].value === "todas", "T6 as tres opcoes existem e 'manter todas' vem marcada");
    radios().filter((r) => r.value === "todas")[0].onchange();
    ok(!api.leiDupCtxAtual().decisoes[num].auto, "T6a escolher 'manter todas' de proposito tira o 'automatico' (a lei repete DE VERDADE: vai para repetidosOk)");
    radios().filter((r) => r.value === String(gs[0].candidatos[0].indice))[0].onchange();
    api.$("btnLeiDupConfirmar").onclick();
    ok(res && /não se comprove/.test(res.texto) && !/revendido para fora/.test(res.texto) && res.resumo[0].acao === "manter", "T7 escolher uma das versoes apaga so' a outra");
    const r = api.decLer().filter((x) => x.area === "repetidos")[0];
    ok(r && r.decisao === "recusou" && r.escolha === "manter outra cópia", "T7a e isso fica registrado como escolha da pessoa: " + JSON.stringify(r && [r.decisao, r.escolha]));
  }
  {
    /* atualizacao: sem 'manter todas', a escolha continua obrigatoria */
    const api = iniciar();
    api.leiDuplicadosAbrir({ modo: "atualizar", texto: fraca, grupos: api.leiDuplicados(fraca), aoConfirmar() {} });
    ok(api.$("btnLeiDupConfirmar").disabled === true && achar(api.$("leiDupLista"), (c) => c.id === "leiDupConfer").length === 0, "T8 na atualizacao o grupo segue como decisao obrigatoria, sem bloco 'so' para conferir'");
  }
  {
    /* com indicio: decisao de verdade, na lista principal, sugestao marcada */
    const forte = ["Art. 1º Um.", "Art. 152. As reduções serão renovadas:", "I - a cada dois anos;", "II - em intervalos não inferiores a 4 (quatro) anos.", "II - em intervalos não inferiores a 3 (três) anos. (Redação dada pela Lei Complementar nº 227, de 2026)", "Art. 153. Outro."].join("\n");
    const api = iniciar();
    const gs = api.leiDuplicados(forte);
    api.leiDuplicadosAbrir({ modo: "criar", texto: forte, grupos: gs, aoConfirmar() {} });
    ok(gs.length === 1 && gs[0].confianca === "forte" && Array.from(api.$("leiDupLista").children).some((c) => c.id === "leiDupGrupo_" + gs[0].num) && achar(api.$("leiDupLista"), (c) => c.id === "leiDupConfer").length === 0,
      "T9 o art. 152 (com 'Redacao dada') e' decisao de verdade, na lista principal: " + JSON.stringify(gs.map((x) => [x.num, x.confianca])));
    ok(api.leiDupCtxAtual().decisoes[gs[0].num].manter === gs[0].sugerido && !api.leiDupCtxAtual().decisoes[gs[0].num].auto, "T9a com a sugestao segura marcada");
  }

  /* ---- 3b: o app NUNCA silencia o numero sozinho (repetidosOk so' recebe o que a pessoa escolheu) ---- */
  {
    const num = p.leiDuplicados(fraca)[0].num;
    /* criacao: pelo fluxo de salvar */
    const criar = (escolher) => {
      const api = iniciar();
      api.leiAbrir("Direito", "T");
      api.$("leiTexto").value = fraca;
      if (api.leiGravar() !== "pendente") return null;
      if (escolher) achar(api.$("leiDupGrupo_" + num), (c) => c.type === "radio" && c.value === "todas")[0].onchange();
      api.$("btnLeiDupConfirmar").onclick();
      return api.leisLista()[0];
    };
    const a = criar(false), b = criar(true);
    ok(a && (a.repetidosOk || []).length === 0, "O1 criar SEM escolher: a lei nao e' marcada como 'repete de verdade': " + JSON.stringify(a && a.repetidosOk));
    ok(b && (b.repetidosOk || []).indexOf(num) >= 0, "O1a criar escolhendo 'manter todas' DE PROPOSITO: entra em repetidosOk: " + JSON.stringify(b && b.repetidosOk));
    /* revisao de uma lei guardada */
    const rev = (escolher) => {
      const api = iniciar();
      const l = api.leiGuardar({ nome: "Lei 9/2009", texto: fraca });
      api.leiAbrir("Direito", "T", l.id);
      api.leiRevisarRepetidos();
      if (!api.$("dlgLeiDup").open) return null;
      if (escolher) achar(api.$("leiDupGrupo_" + num), (c) => c.type === "radio" && c.value === "todas")[0].onchange();
      api.$("btnLeiDupConfirmar").onclick();
      return api.leiDe(l.id);
    };
    const c = rev(false), d = rev(true);
    ok(c && (c.repetidosOk || []).length === 0 && c.texto === fraca, "O2 revisar SEM escolher: nada apagado e o numero continua 'a conferir': " + JSON.stringify(c && c.repetidosOk));
    ok(d && (d.repetidosOk || []).indexOf(num) >= 0, "O2a revisar escolhendo 'manter todas' de proposito: entra em repetidosOk");
  }

  /* ---- 4: os textos ---- */
  {
    const chaves = ["lei_dup_resumo_conf", "lei_dup_fraca_conf", "lei_dup_fraca_intra", "lei_dup_conferir_sm", "lei_dup_conferir_ajuda"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2), "I1 cada frase existe em portugues e em ingles: " + chaves.filter((k) => linhas(k).length !== 2));
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I2 pt e en usam os mesmos campos");
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/\.lei-dup-confer\{[^}]*border:1px dashed/.test(html) && /\.lei-dup-confer>summary\{/.test(html), "I3 o bloco 'so' para conferir tem estilo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
