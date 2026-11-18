/* =====================================================================
 * O MAPA CONTA A HISTÓRIA DA LEI (19.168.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  H1. o que mudou em cada artigo: a correção sua, a alteração por norma, o ajuste do leitor;
 *  H2. a árvore diz quantos artigos de cada ramo mudaram e marca o número; "só o que mudou" deixa só esses, um por
 *      linha, com "como veio × como ficou";
 *  H3. a linha do tempo junta correções, alterações por norma e decisões, do dia mais novo para o mais antigo;
 *  H4. o que a limpeza tirou: o artigo inteiro que não existe mais volta ao lugar dele (como correção sua, com
 *      desfazer); o que não é artigo só se copia.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const LEI = ["CAPÍTULO I", "DO COMEÇO", "", "Art. 1º Primeiro artigo.", "", "Art. 2º Texto com leitrua.", "", "Art. 3º Terceiro original.", "", "Art. 4o Quarto com ordinal.", "", "Art. 6º Sexto."].join(NL);
  const l0 = api.leiGuardar({ id: "lei_mh", nome: "Lei da História", texto: LEI });
  api.leiCorrArtigoSalvar(l0.id, "2", "Art. 2º Texto com leitura.");
  api.leiArtigoAlterar(l0.id, "3", { texto: "Art. 3º Terceiro com a redação nova.", fonteAlteracao: "Lei 9/2026" });
  let l = api.leiDe(l0.id);
  const dg = api.leiDiagnosticarLei(l.texto, api.leiOpcDaLei(l));
  const M = api.leiMapaMudancas(l, dg);
  ok(M.get("2") && M.get("2").corr.length === 1 && M.get("3") && M.get("3").alt && M.get("4") && M.get("4").aj.length >= 1 && !M.get("1"),
    "H1 o que mudou: correção (2), alteração por norma (3), ajuste do leitor (4); o 1 não: " + JSON.stringify(Array.from(M.keys())));

  /* H2 */
  api.leiAbrir("Direito", "Testes", l0.id);
  api.leiMapaAbrir();
  const raiz = api.$("leiMapaArvore").children[0];
  ok(raiz && / · ✎ 3$/.test(raiz.children[0].textContent), "H2a o ramo diz quantos artigos dele mudaram: " + (raiz && raiz.children[0].textContent));
  if (raiz.encher) raiz.encher();
  const nums = raiz.querySelectorAll("button").filter((b) => /lei-ir-n-mudou/.test(b.className)).map((b) => b.textContent);
  ok(nums.join() === "2º,3º,4o" || nums.join() === "2º,3º,4º", "H2b os números dos artigos que mudaram ficam marcados: " + nums.join());
  const bf = api.$("btnLeiMapaSoMudou");
  ok(bf && /só o que mudou \(3\)/.test(bf.textContent), "H2c o botão 'só o que mudou (3)'");
  bf.onclick();
  ok(api.leiMapaSoMudouAtual() && api.$("leiMh_2") && api.$("leiMh_3") && api.$("leiMh_4") && !api.$("leiMh_1"), "H2d só o que mudou: uma linha por artigo marcado");
  const t2 = api.$("leiMh_2").textContent, t3 = api.$("leiMh_3").textContent, t4 = api.$("leiMh_4").textContent;
  ok(/1 correção\(ões\) sua/.test(t2) && /como veio × como ficou/.test(t2) && /leitrua/.test(t2) && /leitura/.test(t2), "H2e o artigo corrigido: era / ficou");
  ok(/alterado por Lei 9\/2026/.test(t3) && /era:.*original\./.test(t3) && /ficou:.*redação nova/.test(t3), "H2f o artigo alterado: o texto-base × a redação em vigor (só o trecho que mudou): " + t3.slice(0, 200));
  ok(/ajuste do leitor/.test(t4), "H2g o artigo com ajuste do leitor");
  api.$("btnLeiMapaSoMudou").onclick();
  ok(!api.leiMapaSoMudouAtual(), "H2h o mesmo botão volta a mostrar tudo");

  /* H4 (antes da linha do tempo, que conta as decisões) */
  const dec = api.decRegistrar({ area: "colagem", regra: "colagem.tachado", origem: "app", lei: "Lei da História", ref: "linha 11", decisao: "aceitou", via: "padrao",
    proposta: { acao: "remover", amostra: "Art. 5º", n: 1, linhas: [{ linha: 11, texto: "~~Art. 5º Artigo que saiu por engano.~~" }] } });
  api.decRegistrar({ area: "colagem", regra: "colagem.cabecalho", origem: "app", lei: "Lei da História", ref: "linha 1", decisao: "aceitou", via: "padrao",
    proposta: { acao: "remover", amostra: "DIÁRIO OFICIAL", n: 1, linhas: [{ linha: 1, texto: "DIÁRIO OFICIAL" }] } });
  const ds = api.decLer().filter((d) => d.lei === "Lei da História");
  const dArt = ds.filter((d) => d.regra === "colagem.tachado")[0], dCab = ds.filter((d) => d.regra === "colagem.cabecalho")[0];
  ok(api.leiMapaPodeDevolver(api.leiDe(l0.id), dArt).num === "5" && api.leiMapaPodeDevolver(api.leiDe(l0.id), dCab) === null, "H4a só o artigo inteiro que não existe mais pode voltar");
  api.leiMapaAbrir(true);
  const dd = api.$("leiMapaDec");
  ok(dd && /ver o que saiu \(1\)/.test(dd.textContent) && api.$("btnLeiMhDevolver_" + dArt.id) && api.$("btnLeiMhCopiar_" + dCab.id) && !api.$("btnLeiMhDevolver_" + dCab.id),
    "H4b nas decisões: o que saiu, com 'copiar' e, para o artigo, 'devolver'");
  const r = api.leiMapaDevolver(l0.id, dArt);
  l = api.leiDe(l0.id);
  ok(r.ok && /Quarto com ordinal\.\n\nArt\. 5º Artigo que saiu por engano\.\n\nArt\. 6º/.test(l.texto) && l.correcoes.some((x) => x.tipo === "devolvido" && x.num === "5"), "H4c o artigo volta ao lugar dele, como correção sua: " + JSON.stringify(l.texto.slice(-110)));
  const ent = l.correcoes.filter((x) => x.tipo === "devolvido")[0];
  ok(api.leiCorrArtigoDesfazer(l0.id, ent.id).ok && !/Art\. 5º/.test(api.leiDe(l0.id).texto) && /Quarto com ordinal\.\n\nArt\. 6º/.test(api.leiDe(l0.id).texto), "H4d e o desfazer tira de novo");

  /* H3 */
  const LT = api.leiMapaLinhaTempo(api.leiDe(l0.id));
  const txt = LT.map((x) => x.txt).join(" | ");
  ok(/leitura corrigida/.test(txt) && /Lei 9\/2026: 1 artigo/.test(txt) && /limpeza ao colar: 2 decisão/.test(txt) && /devolvido/.test(txt), "H3a a linha do tempo junta correções, alterações e decisões: " + txt);
  ok(LT.every((x, i) => i === 0 || LT[i - 1].dia >= x.dia), "H3b do dia mais novo para o mais antigo");
  api.leiMapaAbrir(true);
  ok(api.$("leiMapaLinhaTempo") && /Linha do tempo da lei/.test(api.$("leiMapaLinhaTempo").textContent), "H3c a linha do tempo aparece no mapa");

  /* H6: o artigo acrescentado por norma não está no texto colado — ganha ramo próprio, e a conta do botão fecha */
  api.leiArtigoAlterar(l0.id, "4-A", { texto: "Art. 4º-A Acrescido pela norma.", fonteAlteracao: "Lei 10/2026" });
  api.leiMapaAbrir(true);
  const fora = api.$("leiMapaForaDoTexto");
  ok(fora && /fora do texto colado \(2\)/.test(fora.children[0].textContent),
    "H6a o ramo dos acrescentados por norma (o 4-A e o 5, que voltou e saiu de novo e guarda a história): " + (fora && fora.children[0].textContent));
  const nBotao = Number((/\((\d+)\)/.exec(api.$("btnLeiMapaSoMudou").textContent) || [])[1]);
  api.$("btnLeiMapaSoMudou").onclick();
  const nLinhas = api.$("leiMapaArvore").querySelectorAll("div").filter((d) => /^leiMh_/.test(d.id || "")).length;
  ok(api.$("leiMh_4-A") && /alterado por Lei 10\/2026/.test(api.$("leiMh_4-A").textContent), "H6b o acrescentado tem a linha dele no filtro");
  ok(nBotao === api.leiMapaMudancasAtual().size && nLinhas === nBotao, "H6c o botão e as linhas batem: " + nBotao + " × " + nLinhas);
  api.$("btnLeiMapaSoMudou").onclick();
  ok(!api.leiMapaForaDoTexto(api.leiDiagnosticarLei(api.leiDe(l0.id).texto, api.leiOpcDaLei(api.leiDe(l0.id))).estrutura.artigos).includes("2"), "H6d os artigos do texto não entram no ramo de fora");

  ["lei_mh_sem_norma", "lei_mh_fora_tit", "lei_mh_fora_tip", "lei_mh_tip_corr", "lei_mh_tip_alt", "lei_mh_tip_rev", "lei_mh_tip_aj", "lei_mh_comoveio", "lei_mh_ev_alt", "lei_mh_ev_rev", "lei_mh_rev_txt", "lei_mh_acrescido", "lei_mh_ev_aj",
    "lei_mh_aj_recusado", "lei_mh_filtro", "lei_mh_filtro_on", "lei_mh_filtro_tip", "lei_mh_lt_tit", "lei_mh_lt_corr", "lei_mh_lt_alt", "lei_mh_lt_dec_colagem", "lei_mh_lt_dec_versao",
    "lei_mh_lt_dec_repetidos", "lei_mh_lt_dec_outra", "lei_mh_lt_consulta", "lei_mh_lt_versao", "lei_mh_saiu_tit", "lei_mh_copiar", "lei_mh_copiado", "lei_mh_devolver", "lei_mh_devolver_tip",
    "lei_mh_devolver_conf", "lei_mh_devolvido", "lei_mh_dev_nao", "lei_corr_tipo_devolvido", "lei_mh_sem_norma"].forEach((k) =>
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "H5 falta " + k + " em " + lg); }));
  api.setLanguage("pt");
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
