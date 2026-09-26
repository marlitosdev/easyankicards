/* =====================================================================
 * DECISÕES — O HISTÓRICO DO QUE O APP SUGERIU TIRAR E DO QUE A PESSOA DECIDIU
 *
 * Antes, uma limpeza confirmada virava uma linha "escolhas confirmadas" com uma contagem: sem o
 * que sairia, sem o porquê, sem a decisão item a item, e numa janela rolante que apaga o antigo.
 * Agora cada sugestão vira um registro permanente, e é dele que se descobre quais regras erram.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada registro traz: quando, versão do app, área, regra estável, lei, onde, motivo, o
 *     trecho proposto (as linhas que sairiam, por inteiro), o risco e a decisão — e é gravado.
 *  2. O histórico é limitado (contagem e tamanho), mas o que sai é DOBRADO em contagens por
 *     regra: as taxas de recusa não se perdem. Nada cresce sem fim por uma sugestão com mil linhas.
 *  3. A revisão da colagem, os artigos repetidos, a versão nova (e o que fazer com o que
 *     falta) e o apagar artigo/lei registram o que foi proposto E o que a pessoa decidiu
 *     (aceitou, recusou, escolheu outra coisa, ficou sem decisão; e recusar a confirmação de
 *     apagar também fica).
 *  4. A tela mostra o resumo, a taxa de recusa por regra (com aviso quando é alta), a lista
 *     filtrável com o que seria tirado, "sugestão certa/errada" com uma frase, e copiar,
 *     baixar e apagar (esta última mostrando o que se perde).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const eh = (c, tag) => String(c.tag || c.tagName || "").toLowerCase() === tag;
  const conduzir = async (api, aceitar) => {
    for (let i = 0; i < 25; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
    await new Promise((r) => setTimeout(r, 5));
  };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const base = (o) => Object.assign({ area: "colagem", regra: "colagem.cabecalho", lei: "Lei X", ref: "linha 3", motivo: "porque sim", decisao: "aceitou", proposta: { acao: "remover", amostra: "trecho", n: 1 } }, o || {});

  /* ==============================================================
   * S: O ARMAZENAMENTO
   * ============================================================== */
  {
    const api = iniciar();
    const id = api.decRegistrar(base());
    const l = api.decLer();
    ok(l.length === 1 && l[0].id === id && /^\d{4}-\d\d-\d\dT/.test(l[0].q) && /^\d+\.\d+\.\d+$/.test(l[0].v) && l[0].origem === "app" && l[0].feedback === "", "S1 o registro tem id, data, versao do app e os campos padrao: " + JSON.stringify(l[0]).slice(0, 160));
    const guardado = JSON.parse(api.lojaLer("eac_decisoes"));
    ok(guardado.length === 1 && guardado[0].regra === "colagem.cabecalho", "S1a e foi gravado no armazenamento");
    /* cada texto e' limitado */
    const longo = "x".repeat(5000);
    const linhas = []; for (let i = 1; i <= 100; i++) linhas.push({ linha: i, texto: longo });
    api.decRegistrar(base({ motivo: longo, ref: longo, lei: longo, proposta: { acao: longo, amostra: longo, depois: longo, n: 100, linhas, alertas: new Array(20).fill(longo) } }));
    const r = api.decLer()[1];
    ok(r.motivo.length === 300 && r.ref.length === 80 && r.lei.length === 120 && r.proposta.amostra.length === 600 && r.proposta.depois.length === 300 && r.proposta.acao.length === 60, "S2 os textos sao limitados: " + [r.motivo.length, r.proposta.amostra.length]);
    ok(r.proposta.linhas.length === 60 && r.proposta.linhas[0].texto.length === 300 && r.proposta.alertas.length === 8 && r.proposta.alertas[0].length === 40 && r.proposta.n === 100, "S2a no maximo 60 linhas de 300 caracteres e 8 alertas, e o total (n) continua dizendo 100");
    /* lote: uma gravacao, ids diferentes */
    const ids = api.decRegistrarLote([base(), base(), base()]);
    ok(ids.length === 3 && new Set(ids).size === 3 && api.decLer().length === 5, "S3 um lote de 3: ids diferentes");
    ok(api.decRegistrarLote([]).length === 0 && api.decLer().length === 5, "S3a lote vazio nao faz nada");
  }
  {
    /* limite por contagem: o que sai e' DOBRADO nas contagens da regra */
    const api = iniciar();
    api.decLimites(5, 500000);
    for (let i = 0; i < 8; i++) api.decRegistrar(base({ regra: "colagem.pagina", decisao: i % 2 ? "recusou" : "aceitou", feedback: undefined }));
    ok(api.decLer().length === 5, "S4 so 5 ficam na integra: " + api.decLer().length);
    const st = api.decPorRegra().filter((x) => x.regra === "colagem.pagina")[0];
    ok(st.sug === 8 && st.ace === 4 && st.rec === 4, "S4a mas as contagens da regra continuam completas (8 sugeridas, 4 aceitas, 4 recusadas): " + JSON.stringify(st));
    ok(!!api.lojaLer("eac_decisoes_resumo") && JSON.parse(api.lojaLer("eac_decisoes_resumo"))["colagem.pagina"].sug === 3, "S4b o que foi dobrado esta no armazenamento (3 dobradas)");
    /* o julgamento tambem sobrevive a dobra */
    const api2 = iniciar();
    api2.decLimites(2, 500000);
    const a = api2.decRegistrar(base({ regra: "repetidos.redacao", area: "repetidos" }));
    api2.decMarcar(a, "errada", "estava errada");
    api2.decRegistrar(base({ regra: "repetidos.redacao", area: "repetidos" }));
    api2.decRegistrar(base({ regra: "repetidos.redacao", area: "repetidos" }));
    const s2 = api2.decPorRegra()[0];
    ok(api2.decLer().length === 2 && s2.sug === 3 && s2.err === 1, "S4c 'sugestao errada' de um registro dobrado continua contando: " + JSON.stringify(s2));
    /* limite por tamanho */
    const api3 = iniciar();
    api3.decLimites(1000, 2500);
    for (let i = 0; i < 10; i++) api3.decRegistrar(base({ proposta: { acao: "remover", amostra: "y".repeat(500), n: 1 } }));
    ok(api3.decLer().length < 10 && api3.decLer().length >= 1 && api3.decPorRegra()[0].sug === 10, "S5 o limite de tamanho tambem poda (sobram " + api3.decLer().length + ") sem perder a contagem");
  }
  {
    /* o julgamento */
    const api = iniciar();
    const id = api.decRegistrar(base());
    ok(api.decMarcar(id, "errada", "era lei de verdade") === true && api.decLer()[0].feedback === "errada" && api.decLer()[0].nota === "era lei de verdade", "S6 marcar 'errada' com a frase");
    ok(JSON.parse(api.lojaLer("eac_decisoes"))[0].feedback === "errada", "S6a e grava");
    api.decMarcar(id, "certa");
    ok(api.decLer()[0].feedback === "certa" && api.decLer()[0].nota === "era lei de verdade", "S6b trocar para 'certa' sem frase nova mantem a frase");
    api.decMarcar(id, "");
    ok(api.decLer()[0].feedback === "" && api.decLer()[0].nota === "", "S6c tirar o julgamento limpa a frase");
    api.decMarcar(id, "errada", "y".repeat(1000));
    ok(api.decLer()[0].nota.length === 300 && api.decMarcar("nao-existe", "certa") === false, "S6d a frase e' limitada e id desconhecido e' recusado");
    api.decMarcar(id, "talvez");
    ok(api.decLer()[0].feedback === "", "S6e so 'certa' e 'errada' valem");
  }
  {
    /* estatisticas */
    const api = iniciar();
    const reg = (d) => api.decRegistrar(base({ regra: "colagem.remissao", decisao: d }));
    ["aceitou", "aceitou", "aceitou", "recusou", "recusou", "escolheu", "sem_decisao"].forEach(reg);
    let s = api.decPorRegra()[0];
    ok(s.sug === 7 && s.decididas === 5 && Math.abs(s.taxaRecusa - 0.4) < 1e-9 && s.revisar === true, "S7 taxa de recusa so entre quem decidiu (2 de 5 = 40%), 'escolheu' e 'sem decisao' fora: " + JSON.stringify(s));
    const api2 = iniciar();
    ["aceitou", "aceitou", "aceitou", "recusou"].forEach((d) => api2.decRegistrar(base({ regra: "colagem.grafia", decisao: d })));
    s = api2.decPorRegra()[0];
    ok(s.decididas === 4 && s.taxaRecusa === 0.25 && s.revisar === false, "S7a com menos de 5 decididas ou taxa baixa nao pede revisao");
    const api3 = iniciar();
    ["recusou", "recusou", "recusou", "recusou", "aceitou"].forEach((d) => api3.decRegistrar(base({ regra: "colagem.anexo", decisao: d })));
    ok(api3.decPorRegra()[0].revisar === true && api3.decPorRegra()[0].taxaRecusa === 0.8, "S7b recusa alta pede revisao");
    /* 'mudou' conta como recusa */
    const api4 = iniciar();
    ["aceitou", "aceitou", "aceitou", "mudou", "mudou"].forEach((d) => api4.decRegistrar(base({ regra: "colagem.anexo", decisao: d })));
    ok(api4.decPorRegra()[0].taxaRecusa === 0.4, "S7c escolher outra coisa conta como recusa");
    /* poucas decisoes nao bastam para julgar uma regra, mesmo com recusa de 50% */
    const api5 = iniciar();
    ["recusou", "recusou", "aceitou", "aceitou"].forEach((d) => api5.decRegistrar(base({ regra: "colagem.anexo", decisao: d })));
    ok(api5.decPorRegra()[0].taxaRecusa === 0.5 && api5.decPorRegra()[0].revisar === false, "S7d com menos de 5 decisoes nao pede revisao (nem com 50% de recusa)");
  }
  {
    /* exportar, recarregar e limpar */
    const api = iniciar();
    api.decRegistrar(base({ regra: "colagem.grafia" }));
    api.decRegistrar(base({ regra: "colagem.pagina", decisao: "recusou" }));
    const linhas = api.decExportar().split("\n");
    ok(linhas.length === 4 && linhas[3] === "", "S8 uma linha por registro mais o cabecalho, terminando em quebra: " + linhas.length);
    const cab = JSON.parse(linhas[0]);
    ok(cab.tipo === "cabecalho" && cab.registros === 2 && /^\d+\.\d+\.\d+$/.test(cab.app) && cab.regras.length === 2 && !!cab.gerado, "S8a o cabecalho traz versao, total e as estatisticas por regra");
    ok(JSON.parse(linhas[1]).tipo === "decisao" && JSON.parse(linhas[1]).regra === "colagem.grafia" && JSON.parse(linhas[2]).decisao === "recusou", "S8b cada linha e' uma decisao completa em JSON");
    /* limpar zera TAMBEM as contagens do que ja tinha sido dobrado */
    const apiD = iniciar();
    apiD.decLimites(2, 500000);
    for (let i = 0; i < 5; i++) apiD.decRegistrar(base({ regra: "colagem.pagina" }));
    ok(apiD.decPorRegra()[0].sug === 5 && Object.keys(JSON.parse(apiD.lojaLer("eac_decisoes_resumo"))).length === 1, "S9-pre ha contagens dobradas");
    apiD.decLimpar();
    ok(apiD.decPorRegra().length === 0 && Object.keys(JSON.parse(apiD.lojaLer("eac_decisoes_resumo"))).length === 0, "S9x limpar zera as contagens dobradas (no armazenamento tambem)");
    api.decLimpar();
    ok(api.decLer().length === 0 && JSON.parse(api.lojaLer("eac_decisoes")).length === 0 && api.decPorRegra().length === 0, "S9 limpar zera o historico e as contagens");
    /* recarregar do armazenamento */
    api.decRegistrar(base());
    const guardado = api.lojaLer("eac_decisoes");
    const api2 = iniciar();
    api2.decRecarregar();
    ok(api2.decLer().length === 0, "S10 outra sessao (armazenamento proprio) comeca vazia");
    ok(api.decLer().length === 1 && guardado.indexOf("colagem.cabecalho") > 0, "S10a a sessao com o registro mantem");
    ok(api.decRiscoDoTexto(["Art. 5º Fica proibido"]) === "alto" && api.decRiscoDoTexto(["§ 2º Nos casos"]) === "alto" && api.decRiscoDoTexto(["no prazo de 30 dias"]) === "alto" && api.decRiscoDoTexto(["multa de 40%"]) === "alto" && api.decRiscoDoTexto(["valor de R$ 10"]) === "alto", "S11 linha com artigo, paragrafo, prazo, percentual ou valor e' risco alto");
    ok(api.decRiscoDoTexto(["Página 3 de 296", "DIÁRIO OFICIAL DA UNIÃO"]) === "baixo" && api.decRiscoDoTexto([]) === "baixo", "S11a cabecalho e numero de pagina sao risco baixo");
  }

  /* ==============================================================
   * F: OS FLUXOS
   * ============================================================== */
  const cab = (texto) => { const L = []; return texto; };
  const paginas = (cabec) => {
    const L = [];
    for (let p = 1; p <= 6; p++) {
      L.push(cabec);
      for (let k = 1; k <= 8; k++) L.push("Art. " + ((p - 1) * 8 + k) + "º Texto do artigo " + ((p - 1) * 8 + k) + " com uma frase longa para ocupar espaço.");
      L.push("Página " + p + " de 6");
    }
    L.push("Art . 49 Texto com a grafia errada do artigo.");
    return L.join("\n");
  };
  {
    /* revisao da colagem: confirmar com tudo no padrao */
    const api = iniciar();
    const texto = paginas("DIÁRIO OFICIAL DA UNIÃO - SEÇÃO 1 - Lei nº 9.999 de 2020");
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreAnalisar(texto).pre, aoConfirmar: () => {} });
    ok(api.decLer().length === 0, "F1-pre abrir a revisao ainda nao registra nada (so a decisao final)");
    api.leiPreConfirmar();
    const l = api.decLer();
    ok(l.length === 3 && l.map((x) => x.regra).sort().join() === "colagem.cabecalho,colagem.grafia,colagem.pagina", "F1 uma decisao por mudanca sugerida: " + l.map((x) => x.regra));
    ok(l.every((x) => x.decisao === "aceitou" && x.via === "padrao" && x.area === "colagem" && x.origem === "app" && x.lei === "(lei nova)"), "F1a aceitas no padrao, da area colagem, lei ainda nao criada");
    const c = l.filter((x) => x.regra === "colagem.cabecalho")[0];
    ok(c.proposta.acao === "remover" && c.proposta.n === 6 && c.proposta.linhas.length === 6 && /DIÁRIO OFICIAL/.test(c.proposta.linhas[0].texto) && c.proposta.linhas[0].linha === 1 && c.risco === "baixo", "F1b o cabecalho: 6 linhas que sairiam, POR INTEIRO e com o numero da linha, risco baixo: " + JSON.stringify(c.proposta.linhas[0]));
    ok(/linhas 1, /.test(c.ref) && /Linhas iguais/.test(c.motivo), "F1c onde e o motivo (a explicacao da regra): " + c.ref + " | " + c.motivo.slice(0, 40));
    const g = l.filter((x) => x.regra === "colagem.grafia")[0];
    ok(g.proposta.acao === "corrigir" && g.proposta.linhas.length === 0 && /Art \. 49/.test(g.proposta.amostra) && /Art\. 49/.test(g.proposta.depois) && g.risco === "baixo", "F1d a grafia corrige (antes e depois), nao remove linhas");
  }
  {
    /* recusar um grupo: fica 'recusou' e 'manual'; o resto continua no padrao */
    const api = iniciar();
    const texto = paginas("DIÁRIO OFICIAL DA UNIÃO - SEÇÃO 1 - Lei nº 9.999 de 2020");
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreAnalisar(texto).pre, aoConfirmar: () => {} });
    const btn = achar(api.$("leiPreLista"), (x) => x.id === "btnLeiPreNenhum_cabecalho")[0];
    ok(!!btn, "F2-pre o botao 'recusar todos' do grupo existe");
    btn.onclick();
    api.leiPreConfirmar();
    const l = api.decLer();
    const c = l.filter((x) => x.regra === "colagem.cabecalho")[0], p = l.filter((x) => x.regra === "colagem.pagina")[0];
    ok(c.decisao === "recusou" && c.via === "manual" && p.decisao === "aceitou" && p.via === "padrao", "F2 recusar o cabecalho: 'recusou/manual'; a pagina segue 'aceitou/padrao': " + [c.decisao, c.via, p.decisao, p.via]);
  }
  {
    /* "usar o texto original": tudo recusado, e o motivo do caminho */
    const api = iniciar();
    const texto = paginas("DIÁRIO OFICIAL DA UNIÃO - SEÇÃO 1 - Lei nº 9.999 de 2020");
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreAnalisar(texto).pre, aoConfirmar: () => {} });
    api.leiPreOriginal();
    const l = api.decLer();
    ok(l.length === 3 && l.every((x) => x.decisao === "recusou" && x.via === "texto_original"), "F3 'usar o texto original' recusa tudo, com o caminho: " + l.map((x) => x.decisao + "/" + x.via));
    /* voltar para revisar NAO e' decisao */
    const api2 = iniciar();
    api2.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api2.leiPreAnalisar(texto).pre, aoConfirmar: () => {} });
    api2.leiPreCancelar();
    ok(api2.decLer().length === 0, "F3a voltar para revisar nao registra decisao (ela ainda nao existe)");
  }
  {
    /* risco alto: o cabecalho tem prazo/valor */
    const api = iniciar();
    const texto = paginas("REGULAMENTO GERAL - prazo de 30 dias - Diário Oficial");
    api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreAnalisar(texto).pre, aoConfirmar: () => {} });
    api.leiPreConfirmar();
    const c = api.decLer().filter((x) => x.regra === "colagem.cabecalho")[0];
    ok(c && c.risco === "alto", "F4 um 'cabecalho' que tem prazo e' risco ALTO (pode ser lei): " + (c && c.risco));
  }
  {
    /* artigos repetidos */
    const api = iniciar();
    const D = "Art. 1º Um.\nArt. 2º Dois antigo.\nArt. 2º Dois novo. (Redação dada pela Lei nº 9, de 2020)\nArt. 3º Tres.";
    const grupos = api.leiDuplicados(D);
    api.leiDuplicadosAbrir({ modo: "criar", texto: D, grupos, aoConfirmar: () => {} });
    api.leiDupSugestoes();
    ok(api.leiDupConfirmar() === true, "F5-pre confirmou com a sugestao");
    let r = api.decLer()[0];
    ok(api.decLer().length === 1 && r.regra === "repetidos.redacao" && r.decisao === "aceitou" && r.area === "repetidos" && r.ref === "art. 2º" && r.risco === "baixo", "F5 repetido aceito na sugestao: " + JSON.stringify([r.regra, r.decisao, r.ref, r.risco]));
    ok(r.proposta.linhas.length === 1 && /Dois novo/.test(r.proposta.linhas[0].texto) && r.proposta.linhas[0].linha === 3 && /alteração/.test(r.proposta.acao) && /Dois antigo/.test(r.proposta.amostra) && /redacao/.test(r.motivo) && /forte/.test(r.motivo), "F5a o que SAIU DE VERDADE da base (o texto novo vira alteracao: a base fica com o antigo), por inteiro e com a linha; o que a sugestao previa fica na amostra: " + JSON.stringify([r.proposta.acao, r.proposta.linhas, r.proposta.amostra]));
    /* escolher manter TODAS = recusou */
    const api2 = iniciar();
    api2.leiDuplicadosAbrir({ modo: "criar", texto: D, grupos: api2.leiDuplicados(D), aoConfirmar: () => {} });
    api2.leiDupCtxAtual().decisoes["2"] = { manter: "todas" };
    api2.leiDupConfirmar();
    r = api2.decLer()[0];
    ok(r.decisao === "recusou" && r.escolha === "manter todas as cópias", "F5b manter todas as copias = recusou a sugestao: " + [r.decisao, r.escolha]);
    ok(r.proposta.linhas.length === 0 && r.proposta.n === 0 && /nada foi removido/.test(r.proposta.acao) && /Dois antigo/.test(r.proposta.amostra), "F5b1 manter todas: NADA saiu (sem linhas), e a amostra mostra o que a sugestao removeria: " + JSON.stringify([r.proposta.acao, r.proposta.linhas.length]));
    /* escolher a outra */
    const api3 = iniciar();
    const gs = api3.leiDuplicados(D);
    api3.leiDuplicadosAbrir({ modo: "criar", texto: D, grupos: gs, aoConfirmar: () => {} });
    api3.leiDupCtxAtual().decisoes["2"] = { manter: gs[0].candidatos[0].indice };
    api3.leiDupConfirmar();
    r = api3.decLer()[0];
    ok(r.decisao === "recusou" && r.escolha === "manter outra cópia", "F5c manter a OUTRA copia = recusou: " + [r.decisao, r.escolha]);
    ok(r.proposta.linhas.length === 1 && /Dois novo/.test(r.proposta.linhas[0].texto) && r.proposta.linhas[0].linha === 3 && /remover a cópia não escolhida/.test(r.proposta.acao) && /Dois antigo/.test(r.proposta.amostra), "F5c1 o que SAIU foi a copia nao escolhida (a nova), e nao o que a sugestao previa (a antiga, na amostra): " + JSON.stringify([r.proposta.acao, r.proposta.linhas, r.proposta.amostra]));
  }
  {
    /* LEI JA GUARDADA: "revisar repetidos" REESCREVE o texto guardado (e' o unico caminho que apaga da base).
     * O que sai precisa ficar no historico, com a lei, e por inteiro — senao nao ha como saber nem restaurar. */
    const api = iniciar();
    const salvo = "Art. 1º Um.\nArt. 2º Dois antigo texto completo.\nArt. 2º Dois novo. (Redação dada pela Lei nº 9, de 2020)\nArt. 3º Tres.";
    const l = api.leiGuardar({ id: "lei_g", nome: "Lei Guardada", texto: salvo });
    api.leiAbrir("Direito", "T", l.id);
    ok(api.leiRevisarRepetidos() === true, "F5e-pre a revisao abriu para a lei guardada");
    api.leiDupSugestoes();
    api.leiDupConfirmar();
    const guardado = api.leiDe(l.id).texto;
    ok(/Dois antigo texto completo/.test(guardado) && !/Dois novo/.test(guardado) && /Dois novo/.test(api.leiDe(l.id).alteracoes["2"].texto), "F5e no texto GUARDADO: a base fica com o antigo e a redacao nova vira ALTERACAO (o que saiu da base e' o texto novo)");
    const r = api.decLer()[0];
    ok(api.decLer().length === 1 && r.lei === "Lei Guardada" && r.decisao === "aceitou" && /Dois novo/.test(r.proposta.linhas[0].texto) && r.proposta.linhas[0].linha === 3, "F5f e o historico guarda a lei, a decisao e o trecho que saiu da base, POR INTEIRO e com a linha (da para restaurar): " + JSON.stringify([r.lei, r.decisao, r.proposta.linhas]));
  }
  {
    /* repetido SEM indicio no texto (so a posicao): confianca fraca = risco alto */
    const api = iniciar();
    const D2 = "Art. 1º Um.\nArt. 2º Dois A.\nArt. 2º Dois B.\nArt. 3º Tres.";
    const gs = api.leiDuplicados(D2);
    api.leiDuplicadosAbrir({ modo: "criar", texto: D2, grupos: gs, aoConfirmar: () => {} });
    api.leiDupCtxAtual().decisoes["2"] = { manter: gs[0].sugerido };
    api.leiDupConfirmar();
    const r = api.decLer()[0];
    ok(r.regra === "repetidos.posicao" && r.risco === "alto" && r.decisao === "aceitou" && /fraca/.test(r.motivo), "F5d repetido so pela posicao (confianca fraca): risco ALTO e a regra propria: " + JSON.stringify([r.regra, r.risco, r.decisao, r.motivo]));
  }
  {
    /* anexos: separar (padrao), descartar (outra escolha) e manter no artigo (recusa) */
    const api = iniciar();
    const L = []; for (let i = 1; i <= 8; i++) L.push("Art. " + i + "º Texto do artigo " + i + " com uma frase longa.");
    L.push("ANEXO I", "TABELA DE ALÍQUOTAS", "Serviço A    2,00%", "Serviço B    5,00%", "ANEXO II", "TABELA DE PRAZOS", "Prazo de 30 dias");
    const T = L.join("\n");
    api.leiRevisarColagemAbrir({ modo: "criar", texto: T, pre: api.leiPreAnalisar(T).pre, aoConfirmar: () => {} });
    api.leiPreCtxAtual().decisoes["anx:9"] = "descartar";
    api.leiPreCtxAtual().decisoes["anx:13"] = "manter";
    api.leiPreConfirmar();
    const a = api.decLer().filter((x) => x.regra === "colagem.anexo");
    ok(a.length === 2 && a[0].decisao === "mudou" && a[0].escolha === "descartar" && a[0].risco === "alto" && a[0].via === "manual", "F10 anexo DESCARTADO = escolheu outra coisa, risco alto: " + JSON.stringify(a[0] && [a[0].decisao, a[0].escolha, a[0].risco]));
    ok(a[0].proposta.linhas.length === 4 && /ANEXO I/.test(a[0].proposta.linhas[0].texto) && /Serviço B/.test(a[0].proposta.linhas[3].texto) && /9–12/.test(a[0].ref) && a[0].proposta.acao === "separar", "F10a as 4 linhas do anexo, por inteiro, e a faixa (linhas 9–12): " + JSON.stringify([a[0].ref, a[0].proposta.linhas.length]));
    ok(a[1].decisao === "recusou" && a[1].risco === "medio", "F10b anexo mantido dentro do artigo = recusou (risco medio): " + JSON.stringify([a[1].decisao, a[1].risco]));
    const api2 = iniciar();
    api2.leiRevisarColagemAbrir({ modo: "criar", texto: T, pre: api2.leiPreAnalisar(T).pre, aoConfirmar: () => {} });
    api2.leiPreConfirmar();
    const b = api2.decLer().filter((x) => x.regra === "colagem.anexo");
    ok(b.length === 2 && b.every((x) => x.decisao === "aceitou" && x.via === "padrao" && x.risco === "medio"), "F10c anexo separado no padrao = aceitou: " + b.map((x) => x.decisao + "/" + x.via));
  }
  {
    /* versao nova: aceitou, recusou e sem decisao, com o risco pelos alertas */
    const api = iniciar();
    const velho = []; for (let i = 1; i <= 20; i++) velho.push(i === 20 ? "Art. 20. Vinte artigos originais aqui." : (i === 2 ? "Art. 2. Texto original do segundo artigo que fala de muitas coisas diferentes e importantes." : "Art. " + i + ". Texto do artigo " + i + "."));
    const l = api.leiGuardar({ id: "lei_v", nome: "Lei V", texto: velho.join("\n") });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    const novo = velho.slice(0, 19); novo[0] = "Art. 1. Um mudado."; novo[1] = "Art. 2. Zebra quadro elefante uva mesa cadeira janela porta."; novo.push("Art. 21. Novo artigo vinte e um.");
    api.$("leiUpdFonte").value = "LC 018/2020";
    api.$("leiUpdTexto").value = novo.join("\n");
    api.leiAtualizarComparar();
    const it = api.leiUpdComparoAtual();
    ok(it && it.length >= 3, "F6-pre a comparacao tem itens: " + (it && it.map((x) => x.num + ":" + x.tipo)));
    const por = (tipo) => it.filter((x) => x.tipo === tipo)[0];
    it.filter((x) => x.tipo === "mudou" && x.num === "1")[0].aceito = true;
    it.filter((x) => x.tipo === "mudou" && x.num === "2")[0].recusado = true;
    por("novo").recusado = true;       /* o 'revogado' (art. 20) fica sem decisao */
    api.leiAtualizarAplicar();
    const d = api.decLer();
    const v = (regra) => d.filter((x) => x.regra === regra)[0];
    ok(d.length === it.length && v("versao.mudou") && v("versao.novo") && v("versao.revogado"), "F6 uma decisao por artigo comparado: " + d.map((x) => x.regra + "/" + x.decisao));
    ok(v("versao.mudou").decisao === "aceitou" && v("versao.novo").decisao === "recusou" && v("versao.revogado").decisao === "sem_decisao", "F6a aceitou, recusou e sem decisao: " + d.map((x) => x.decisao));
    ok(v("versao.mudou").ref === "art. 1" && /Texto do artigo 1./.test(v("versao.mudou").proposta.amostra) && /Um mudado/.test(v("versao.mudou").proposta.depois) && v("versao.mudou").lei === "Lei V", "F6b antes e depois da redacao, artigo e lei: " + JSON.stringify(v("versao.mudou").proposta));
    ok(/revogado/.test(v("versao.revogado").proposta.acao) && /Vinte artigos originais/.test(v("versao.revogado").proposta.amostra), "F6c o artigo que NAO aparece: a acao diz que vira revogado e traz o texto que some da leitura");
    const forte = d.filter((x) => x.ref === "art. 2")[0];
    ok(forte.decisao === "recusou" && forte.risco === "alto" && forte.proposta.alertas.some((a) => /^outro:alerta/.test(a)), "F6e um artigo que virou OUTRO texto (alerta da comparacao) e' risco ALTO: " + JSON.stringify([forte.risco, forte.proposta.alertas]));
    ok(v("versao.revogado").risco === "medio" && v("versao.novo").risco === "baixo" && d.filter((x) => x.ref === "art. 1")[0].risco === "baixo", "F6f o ausente e' risco medio (aviso), o artigo novo e a troca simples, baixo: " + [v("versao.revogado").risco, v("versao.novo").risco]);
    ok(v("versao.revogado").proposta.alertas.length >= 1 && v("versao.revogado").risco !== "", "F6d os alertas da comparacao viajam no registro: " + JSON.stringify(v("versao.revogado").proposta.alertas) + " risco=" + v("versao.revogado").risco);
  }
  {
    /* o que fazer com os artigos ausentes */
    const api = iniciar();
    const l = api.leiGuardar({ id: "lei_c", nome: "Lei C", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiAbrir("Direito", "T", l.id);
    let voltou = null;
    api.leiUpdGuardaAbrir({ avisos: [{ k: "baixa" }], baixa: true }, (e) => { voltou = e; });
    api.leiCobCtxAtual().escolha = "revogar";
    api.leiCobConfirmar();
    const r = api.decLer()[0];
    ok(voltou === "revogar" && r.regra === "versao.cobertura" && r.decisao === "escolheu" && r.escolha === "revogar" && r.risco === "alto" && /baixa/.test(r.motivo), "F7 a escolha sobre os ausentes fica (e 'revogar' e' risco alto): " + JSON.stringify([r.decisao, r.escolha, r.risco, r.motivo]));
  }
  {
    /* apagar artigo: confirmar E recusar ficam */
    const api = iniciar();
    const l = api.leiGuardar({ id: "lei_a", nome: "Lei A", texto: "Art. 1º Um.\nArt. 2º Dois artigos aqui com texto.\nArt. 3º Tres." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiEdAbrir("2");
    let p = api.leiEdApagar();
    await conduzir(api, false);
    await p;
    let r = api.decLer()[0];
    ok(api.decLer().length === 1 && r.area === "apagar" && r.origem === "pessoa" && r.decisao === "recusou" && /^apagar\.(artigo|revogar)$/.test(r.regra) && r.via === "pedido", "F8 recusar a confirmacao de apagar TAMBEM fica registrado: " + JSON.stringify([r.regra, r.decisao, r.origem]));
    ok(/Dois artigos aqui/.test(r.proposta.amostra) && r.ref === "Art. 2º" && r.lei === "Lei A" && r.risco === "medio", "F8a o que se perderia (o texto do artigo), onde e o risco: " + JSON.stringify([r.proposta.amostra, r.ref, r.lei]));
    p = api.leiEdApagar();
    await conduzir(api, true);
    await p;
    r = api.decLer()[1];
    ok(api.decLer().length === 2 && r.decisao === "aceitou", "F8b confirmar tambem: " + (r && r.decisao));
  }
  {
    /* apagar artigo NA COLAGEM (a lei ainda nao foi gravada): e' o outro ramo */
    const api = iniciar();
    const ch = api.matChave("Direito", "T"); api.matGravar(ch, "R.", { disciplina: "Direito", topico: "T", concurso: "TCE" });
    api.leiAbrir("Direito", "T");
    api.$("leiTexto").value = "Art. 1º Um.\nArt. 2º Dois artigos aqui com texto.\nArt. 3º Tres.";
    api.leiEdAbrir("2");
    let p = api.leiEdApagar();
    await conduzir(api, false);
    await p;
    let r = api.decLer()[0];
    ok(r.regra === "apagar.artigo" && r.decisao === "recusou" && /Dois artigos aqui/.test(r.proposta.amostra) && r.origem === "pessoa", "F8c apagar na colagem recusado: " + JSON.stringify([r.regra, r.decisao]));
    p = api.leiEdApagar();
    await conduzir(api, true);
    await p;
    r = api.decLer()[1];
    ok(r.regra === "apagar.artigo" && r.decisao === "aceitou", "F8d apagar na colagem confirmado: " + JSON.stringify([r.regra, r.decisao]));
  }
  {
    /* apagar lei: com onde ela e' usada */
    const api = iniciar();
    const ch1 = api.matChave("Direito", "Receita"); api.matGravar(ch1, "R.", { disciplina: "Direito", topico: "Receita", concurso: "TCE" });
    const l = api.leiGuardar({ nome: "Lei 4.320/1964", texto: "Art. 1º Um.\nArt. 2º Dois.", topicos: [ch1] });
    api.matResumosAtual()[ch1].leiId = l.id;
    api.leiBibAbrir();
    let c = api.leiBibApagar(l);
    await conduzir(api, false);
    await c;
    let r = api.decLer()[0];
    ok(r.regra === "apagar.lei" && r.decisao === "recusou" && r.lei === "Lei 4.320/1964" && r.risco === "alto" && /2 artigos, usada em 1 tópico/.test(r.ref) && r.proposta.n === 2, "F9 apagar a lei recusado: " + JSON.stringify([r.regra, r.decisao, r.ref, r.risco]));
    c = api.leiBibApagar(l);
    await conduzir(api, true);
    await c;
    ok(api.decLer().length === 2 && api.decLer()[1].decisao === "aceitou" && api.leisLista().length === 0, "F9a apagar de verdade: 'aceitou' e a lei some");
  }

  /* ==============================================================
   * U: A TELA
   * ============================================================== */
  {
    const api = iniciar();
    ok(api.decAbrir() === true && api.$("dlgDecisoes").open === true, "U1 abre o dialogo");
    ok(/Nenhuma decisão registrada ainda/.test(api.$("decLista").textContent) && api.$("decResumo").textContent === "", "U1a vazio: diz quando as decisoes aparecem");
    api.$("dlgDecisoes").close();
    api.decRegistrar(base({ regra: "colagem.cabecalho", decisao: "aceitou", risco: "baixo", proposta: { acao: "remover", amostra: "DIÁRIO OFICIAL", n: 6, linhas: [{ linha: 1, texto: "DIÁRIO OFICIAL DA UNIÃO" }, { linha: 20, texto: "DIÁRIO OFICIAL DA UNIÃO" }] } }));
    for (let i = 0; i < 5; i++) api.decRegistrar(base({ regra: "repetidos.redacao", area: "repetidos", decisao: i < 3 ? "recusou" : "aceitou", risco: "alto", lei: "Lei Y" }));
    api.decRegistrar(base({ regra: "apagar.lei", area: "apagar", origem: "pessoa", decisao: "aceitou" }));
    api.decAbrir();
    ok(/7 decisão\(ões\) · 4 aceita\(s\) · 3 recusada\(s\) · 0 com outra escolha · 0 sem decisão · 0 marcada\(s\) como errada\(s\)/.test(api.$("decResumo").textContent), "U2 o resumo: " + api.$("decResumo").textContent);
    const regras = achar(api.$("decRegras"), (c) => /dec-regra(\s|$)/.test(c.className || ""));
    ok(regras.length === 3 && /Artigo repetido: manter a redação nova/.test(regras[0].textContent) && /5 sugeridas · 3 recusadas ou mudadas \(60%\)/.test(regras[0].textContent), "U3 uma linha por regra, com a taxa de recusa, a mais frequente primeiro: " + regras.map((x) => x.textContent.slice(0, 70)));
    ok(/dec-regra-alerta/.test(regras[0].className) && /vale revisar esta regra/.test(regras[0].textContent) && !/dec-regra-alerta/.test(regras[1].className), "U3a a regra muito recusada leva o aviso 'vale revisar'; as outras nao");
    ok(regras.some((x) => /Linhas iguais|Cabeçalho ou rodapé repetido/.test(x.textContent)), "U3b as regras da colagem usam o nome que a revisao ja mostrava");
    const itens = () => achar(api.$("decLista"), (c) => /dec-item/.test(c.className || ""));
    ok(itens().length === 7 && /Artigo repetido|Apagar lei/.test(itens()[0].textContent), "U4 a lista tem as 7, a mais nova primeiro: " + itens().length);
    const it = itens().filter((x) => /Cabeçalho ou rodapé repetido/.test(x.textContent))[0];
    ok(/aceitou/.test(it.textContent) && /risco baixo/.test(it.textContent) && /Lei X/.test(it.textContent) && /Por quê: porque sim/.test(it.textContent), "U4a a decisao, o risco, a lei e o porque");
    ok(/linha 1 DIÁRIO OFICIAL DA UNIÃO/.test(it.textContent) && /linha 20 DIÁRIO/.test(it.textContent) && /ver o que seria tirado/.test(it.textContent), "U4b o que seria tirado, linha a linha, num bloco que se abre");
    ok(itens().filter((x) => /pedido por você/.test(x.textContent)).length === 1, "U4c o que foi pedido pela pessoa e' marcado como tal");
    /* filtros */
    api.$("btnDecF_area_repetidos").onclick();
    ok(itens().length === 5 && /mat-ligado/.test(api.$("btnDecF_area_repetidos").className), "U5 filtrar por area: " + itens().length);
    api.$("btnDecF_decisao_recusou").onclick();
    ok(itens().length === 3, "U5a e por decisao (juntos): " + itens().length);
    api.$("btnDecF_area_apagar").onclick();
    ok(/Nenhuma decisão com este filtro/.test(api.$("decLista").textContent), "U5b filtro sem resultado diz isso");
    api.$("btnDecF_area_todas").onclick(); api.$("btnDecF_decisao_todas").onclick();
    ok(itens().length === 7, "U5c 'todas' volta");
    /* o julgamento pela tela */
    const btnErrada = achar(itens()[0], (c) => /dec-fb-errada/.test(c.className || ""))[0];
    btnErrada.onclick();
    ok(api.decLer().filter((x) => x.feedback === "errada").length === 1 && /1 marcada\(s\) como errada\(s\)/.test(api.$("decResumo").textContent), "U6 'sugestao errada' pela tela: " + api.$("decResumo").textContent);
    const nota = achar(itens()[0], (c) => /dec-nota/.test(c.className || ""))[0];
    ok(!!nota && /por que estava errada/.test(nota.placeholder), "U6a aparece o campo da frase");
    nota.value = "era o Art. 5 da lei";
    nota.onchange();
    ok(api.decLer().filter((x) => x.nota === "era o Art. 5 da lei").length === 1, "U6b a frase e' gravada");
    achar(itens()[0], (c) => /dec-fb-errada/.test(c.className || ""))[0].onclick();
    ok(api.decLer().filter((x) => x.feedback === "errada").length === 0 && achar(itens()[0], (c) => /dec-nota/.test(c.className || "")).length === 0, "U6c tocar de novo tira o julgamento (e o campo)");
    achar(itens()[0], (c) => /dec-fb-certa/.test(c.className || ""))[0].onclick();
    ok(api.decLer().filter((x) => x.feedback === "certa").length === 1, "U6d 'sugestao certa'");
  }
  {
    /* mais de 100 */
    const api = iniciar();
    api.decRegistrarLote(Array.from({ length: 130 }, () => base()));
    api.decAbrir();
    ok(achar(api.$("decLista"), (c) => /dec-item/.test(c.className || "")).length === 100 && /…e mais 30/.test(api.$("decLista").textContent), "U7 a tela mostra 100 e diz quantas faltam (o copiar leva tudo)");
  }
  {
    /* copiar, baixar e apagar */
    const api = iniciar();
    api.decRegistrar(base({ regra: "colagem.pagina" }));
    api.decRegistrar(base({ regra: "colagem.pagina", decisao: "recusou" }));
    const t1 = api.decCopiar();
    ok(t1.split("\n").length === 4 && JSON.parse(t1.split("\n")[0]).registros === 2, "U8 copiar leva o historico todo (cabecalho + 2)");
    ok(api.decBaixar() === t1.replace(/"gerado":"[^"]*"/, (m) => m) || api.decBaixar().split("\n").length === 4, "U8a baixar leva o mesmo conteudo");
    api.decAbrir();
    const p = api.decApagar();
    const msg = api.$("uiModalMsg").textContent || "";
    ok(/2 decisão\(ões\) de 1 tipo\(s\) de sugestão/.test(msg) && /não há como reconstituir/.test(msg), "U9 apagar o historico MOSTRA o que se perde antes de perguntar: " + msg.slice(0, 120));
    await conduzir(api, false);
    ok((await p) === false && api.decLer().length === 2, "U9a recusar mantem");
    const p2 = api.decApagar();
    await conduzir(api, true);
    ok((await p2) === true && api.decLer().length === 0 && /Nenhuma decisão registrada/.test(api.$("decLista").textContent), "U9b confirmar apaga e a tela esvazia");
    ok(api.$("uiModal").open !== true, "U9b1 nenhuma pergunta ficou aberta");
    const p3 = api.decApagar();
    ok(api.$("uiModal").open !== true, "U9c sem nada para apagar nao pergunta (nenhuma caixa se abre)");
    await conduzir(api, false);
    ok((await p3) === false, "U9d e devolve falso");
  }
  {
    /* botoes ligados */
    const api = iniciar();
    ok(typeof api.$("btnLeiLogDecisoes").onclick === "function" && typeof api.$("btnLeiBibDecisoes").onclick === "function", "U10 'decisoes' no registro da lei e na Biblioteca");
    api.$("btnLeiBibDecisoes").onclick();
    ok(api.$("dlgDecisoes").open === true, "U10a abre a tela");
    api.$("btnDecFechar").onclick();
    ok(api.$("dlgDecisoes").open !== true, "U10b fecha");
  }

  /* ==============================================================
   * T: HTML, ARQUIVOS E TEXTOS
   * ============================================================== */
  {
    const api = iniciar();
    const pos = (s) => html.indexOf(s);
    ok(pos('<script src="registro-tudo.js"></script>') < pos('<script src="decisoes.js"></script>'), "T1 o script carrega");
    ok(/"decisoes\.js"/.test(fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8")), "T1a e esta no cache offline (service worker)");
    ok(/"eac_decisoes", "eac_decisoes_resumo"/.test(fs.readFileSync(path.join(__dirname, "..", "docs", "backup.js"), "utf8")), "T1b e entra no backup (o historico e' o que se quer manter)");
    ok(/<dialog id="dlgDecisoes"/.test(html) && ["btnDecCopiar", "btnDecBaixar", "btnDecApagar", "btnDecFechar", "btnDecX", "decResumo", "decRegras", "decFiltros", "decLista"].every((id) => html.indexOf('id="' + id + '"') >= 0), "T2 o dialogo e seus controles");
    ["dec-regra", "dec-regra-alerta", "dec-badge", "dec-b-aceitou", "dec-b-recusou", "dec-risco-alto", "dec-trecho", "dec-acoes"].forEach((c) => {
      ok(new RegExp("\\." + c + "[{,]").test(html), "T3 a classe ." + c + " tem estilo");
    });
    const chaves = ["dec_titulo", "dec_ajuda", "dec_resumo", "dec_copiar", "dec_baixar", "dec_apagar_conf", "dec_r_apagar_lei", "dec_r_versao_cobertura", "dec_r_repetidos_intra", "dec_certa", "dec_errada", "dec_d_mudou", "dec_risco_alto"];
    ok(chaves.every((k) => api.t(k) !== k), "T4 os textos existem em portugues");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok(chaves.every((k) => (i18n.match(new RegExp('"' + k + '":', "g")) || []).length === 2), "T4a e em ingles (cada chave 2x: pt e en)");
    ok(api.decTituloDaRegra("colagem.cabecalho") === api.t("lei_pre_g_cabecalho") && api.decTituloDaRegra("regra.desconhecida") === "regra.desconhecida", "T5 o titulo da regra: o da revisao para a colagem, e o proprio nome se nao ha texto");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
