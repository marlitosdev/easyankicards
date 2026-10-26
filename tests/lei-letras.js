/* =====================================================================
 * LETRAS DOBRADAS OU ESPAÇADAS PELO PDF, ANEXO REVOGADO DE TÍTULO ESPAÇADO, ANEXO VAZIO (v19.25.0)
 *
 * O RELATO (prints da revisão da colagem da LC 15/2009 de Caruaru): a amostra do Anexo IV mostrava
 * "( R e d a ç ã o d a d a p e l a L e i C o m p l e m e n t a r 0 1 8 …) · AAPPUURRAAÇÇÃÃOO DDOO VVAALLOORR VVEENNAALL";
 * faltava o Anexo V e o Anexo XVII aparecia duas vezes, um deles com 10 caracteres.
 *
 * O QUE PRECISA SER VERDADE:
 *  L1 linha com TODA palavra de letras repetidas volta ao normal; qualquer outra fica como está;
 *  L2 nota de alteração com letras espaçadas e sem espaço entre as palavras é refeita só quando a linha inteira se
 *     explica por palavras de nota, números e pontuação;
 *  L3 na colagem: o grupo "letras" (limpeza segura) sugere as correções e, aceito, o texto e o anexo saem corrigidos;
 *     recusado, a linha fica como veio;
 *  L4 "~~A N E X O V~~" + "( R e v o g a d o p e l a … )" é anexo REVOGADO (não some), sem as marcas de risco;
 *  L5 anexo só com o título é apontado como vazio, com a posição;
 *  L6 a tela mostra o grupo, com a cor de limpeza segura, e o resumo do fim conta as linhas corrigidas.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api } = rodar();

  /* ---- L1 ---- */
  ok(api.leiDesdobrarLetras("AAPPUURRAAÇÇÃÃOO DDOO VVAALLOORR VVEENNAALL") === "APURAÇÃO DO VALOR VENAL", "L1 a linha dobrada volta ao normal");
  ok(api.leiDesdobrarLetras("ANEXO XIV") === null && api.leiDesdobrarLetras("TAXA DE FISCALIZAÇÃO") === null, "L1a linha comum fica como está");
  ok(api.leiDesdobrarLetras("AAPPUURRAAÇÇÃÃOO DO VALOR") === null, "L1b só desfaz quando TODAS as palavras estão dobradas");
  ok(api.leiDesdobrarLetras("11 22 33 44") === null, "L1c números repetidos não são letras dobradas");

  /* ---- L2 ---- */
  const nota1 = "( R e d a ç ã o d a d a p e l a L e i C o m p l e m e n t a r 0 1 8 , d e 0 9 d e o u t u b r o d e 2 0 0 9 )";
  const nota2 = "( R e v o g a d o p e l a L e i C o m p l e m e n t a r N ° 0 1 8 / 0 9 )";
  ok(api.leiDesespacarNota(nota1) === "(Redação dada pela Lei Complementar 018, de 09 de outubro de 2009)", "L2 nota de redação refeita: " + api.leiDesespacarNota(nota1));
  ok(api.leiDesespacarNota(nota2) === "(Revogado pela Lei Complementar N° 018/09)", "L2a nota de revogação refeita: " + api.leiDesespacarNota(nota2));
  ok(api.leiDesespacarNota("A T I V I D A D E S P R E S T A D A S") === null, "L2b texto que não é nota fica como veio");
  ok(api.leiDesespacarNota("A N E X O V I") === null && api.leiDesespacarNota("(Revogado pela Lei 1/09)") === null, "L2c título de anexo e linha sem espaçamento não são mexidos");

  /* ---- L3–L5: uma miniatura do fim da LC 15/2009 ---- */
  const linhas = [];
  for (let k = 1; k <= 12; k++) linhas.push("Art. " + k + ". Texto do artigo " + k + " da lei de teste, com a redação completa.");
  linhas.push("A N E X O I V", nota1, "AAPPUURRAAÇÇÃÃOO DDOO VVAALLOORR VVEENNAALL", "Tf = (2 x Tp x Pp) / (Pm + Pp)");
  linhas.push("~~A N E X O V~~", nota2, "~~VALOR VENAL EXCEDENTE~~", "~~VVexc = TFexc x Vo~~");
  linhas.push("A N E X O V I", "TABELA DA TAXA DE LICENÇA", "1 - Comércio em geral 100 UFM", "~~2)~~ (Revogado pela Lei Complementar 018 de 2009)", "3 - Indústria 200 UFM");
  /* anexo revogado com a nota curta: não é "vazio" */
  linhas.push("~~ANEXO VIII~~", "(Revogado)");
  linhas.push("ANEXO XVII", "ANEXO XVII", "TAXA DE FISCALIZAÇÃO DE VEÍCULO DE TRANSPORTE DE PASSAGEIRO", "TFV = PT12 x TV x 4%");
  const texto = linhas.join("\n\n");
  const pre = api.leiPreprocessar(texto);
  const let_ = pre.mudancas.filter((m) => m.grupo === "letras");
  ok(let_.length === 3 && let_.every((m) => m.linhas.length === 1), "L3 três linhas no grupo 'letras': " + JSON.stringify(let_.map((m) => [m.linhas[0], m.depois])));
  const ap = api.leiAplicarPreprocesso(texto, pre.mudancas, {});
  const ax = (r) => ap.anexos.filter((a) => a.titulo === "ANEXO " + r);
  ok(ax("IV").length === 1 && /^ANEXO IV\n\n\(Redação dada pela Lei Complementar 018, de 09 de outubro de 2009\)\n\nAPURAÇÃO DO VALOR VENAL/.test(ax("IV")[0].texto),
    "L3a o Anexo IV sai com a nota e o título legíveis: " + JSON.stringify((ax("IV")[0] || {}).texto));
  ok(ap.resumo.letras === 3, "L3b o resumo conta as linhas corrigidas: " + ap.resumo.letras);
  const dec = {};
  let_.forEach((m) => { dec[m.id] = false; });
  const ap2 = api.leiAplicarPreprocesso(texto, pre.mudancas, dec);
  ok(/AAPPUURRAAÇÇÃÃOO/.test(ap2.anexos.filter((a) => a.titulo === "ANEXO IV")[0].texto) && !ap2.resumo.letras, "L3c recusando, a linha fica como veio");
  ok(ax("V").length === 1 && ax("V")[0].revogado === true && ax("V")[0].texto === "ANEXO V\n\n(Revogado pela Lei Complementar N° 018/09)",
    "L4 o Anexo V revogado não some e sai sem marcas: " + JSON.stringify(ax("V")[0]));
  ok(!/~~/.test(ap.texto) && !ap.anexos.some((a) => /~~/.test(a.texto)), "L4a nenhuma marca de risco sobra");
  const como = api.leiComoVaiFicar(ap.texto, ap.anexos);
  const vazio = como.conferir.filter((p) => p.tipo === "anexo_vazio");
  ok(vazio.length === 1 && vazio[0].rom === "XVII" && vazio[0].pos === 5 && vazio[0].gravidade === "aviso", "L5 o anexo só com título apontado, com a posição: " + JSON.stringify(como.conferir));
  ok(ax("VIII").length === 1 && ax("VIII")[0].revogado && !como.conferir.some((p) => p.tipo === "anexo_vazio" && (p.rom === "V" || p.rom === "VIII")), "L5a o anexo revogado (só a nota, mesmo curta) não é 'vazio'");
  ok(/2\) \(Revogado pela Lei Complementar 018 de 2009\)/.test(ax("VI")[0].texto), "L4b identificador riscado DENTRO do anexo sai sem as marcas: " + JSON.stringify(ax("VI")[0].texto));
  api.setLanguage("pt");
  ok(/O 5º anexo \(Anexo XVII\) está vazio/.test(api.leiComoTexto(vazio[0] || { tipo: "anexo_vazio" })), "L5b o texto do aviso");
  ok(!como.conferir.some((p) => p.tipo === "espacado"), "L5c nenhuma linha espaçada sobra");

  /* ---- L6: a tela ---- */
  api.leiRevisarColagemAbrir({ modo: "criar", texto, pre, aoConfirmar: () => {} });
  const g = api.$("leiPreGrupo_letras");
  ok(g && /lei-pre-grav-segura/.test(g.className) && /Letras dobradas ou espaçadas pelo PDF \(3\)/.test(g.textContent) && /APURAÇÃO DO VALOR VENAL/.test(g.textContent),
    "L6 o grupo na tela, como limpeza segura, com o antes e o depois");
  const item = api.$("leiPreItem_" + let_[1].id);
  const cls = (cl) => { const acc = []; const w = (e) => Array.from(e.children || []).forEach((c) => { if (c.className === cl) acc.push(c.textContent); w(c); }); w(item); return acc; };
  ok(item && cls("lei-pre-antes")[0] === "AAPPUURRAAÇÇÃÃOO DDOO VVAALLOORR VVEENNAALL" && cls("lei-pre-depois")[0] === "APURAÇÃO DO VALOR VENAL" && !/undefined/.test(item.textContent),
    "L6c o item mostra o antes e o depois da linha: " + (item && item.textContent));
  const mIV = pre.mudancas.filter((m) => m.grupo === "anexo" && m.titulo === "ANEXO IV")[0];
  const elIV = mIV && api.$("leiPreItem_" + mIV.id);
  ok(elIV && /» \(Redação dada pela Lei Complementar 018, de 09 de outubro de 2009\) · APURAÇÃO DO VALOR VENAL/.test(elIV.textContent),
    "L6d a amostra do anexo já sai legível: " + (elIV && elIV.textContent.slice(0, 200)));
  ok(api.$("btnLeiPreChip_letras") && /^Letras 3$/.test(api.$("btnLeiPreChip_letras").textContent), "L6a o atalho do grupo");
  ok(/3 linha\(s\) com letras dobradas ou espaçadas corrigida\(s\)/.test(api.$("leiPreFim").textContent), "L6b o resumo do fim: " + api.$("leiPreFim").textContent);
  ["lei_pre_g_letras", "lei_pre_h_letras", "lei_pre_c_letras", "lei_pre_curto_letras", "lei_pre_res_letras", "lei_como_anexo_vazio"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
