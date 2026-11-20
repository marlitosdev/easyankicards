/* =====================================================================
 * A CONSULTA AO LADO, DENTRO DO LEITOR DE LEI (19.184.0)
 *
 * O "⇔ lei e julgados lado a lado" abria duas janelas soltas, com o par fixo e os julgados do tópico inteiro, sem
 * relação com o artigo da tela. Virou um painel do leitor.
 *
 * O QUE PRECISA SER VERDADE:
 *  C1. só em tela larga e com a lei aberta pelo tópico; abrir alarga a janela e fica lembrado (aberto e conteúdo);
 *  C2. julgados: os que citam o artigo da tela vêm primeiro, em destaque; depois os que citam a lei; depois o resto;
 *  C3. a citação de um julgado: a da lei aberta leva a leitura ao artigo; a de outra lei abre no painel, com voltar;
 *  C4. com o painel aberto, a citação do leitor (e a do resumo do painel) abre nele, não na prévia; fechado, na prévia;
 *  C5. resumo, outra lei e questões do artigo;
 *  C6. a tela cheia e a tela estreita recolhem o painel; aberta pela Biblioteca, sem botão;
 *  C7. o atalho da ficha abre a lei com os julgados ao lado; o lado a lado antigo saiu.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const arts = (k, pre) => Array.from({ length: k }, (_, i) => "Art. " + (i + 1) + "º " + (pre || "Texto do artigo") + " " + (i + 1) + ".").join(NL);
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const cls = (e, c) => (" " + String((e && e.className) || "") + " ").indexOf(" " + c + " ") >= 0;
  const DISC = "Direito Administrativo", TOP = "Atos administrativos";

  const montar = (largura) => {
    const r = rodar();
    const { api, janela } = r;
    janela.innerWidth = largura || 1400;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "A anulação segue o art. 53 da Lei 9.784/1999.", { disciplina: DISC, topico: TOP, concurso: "TJ" });
    const l1 = api.leiGuardar({ nome: "Lei 9.784/1999", texto: arts(60), topicos: [] });
    const l2 = api.leiGuardar({ nome: "Lei 8.112/1990", texto: arts(10, "Servidor"), topicos: [] });
    api.leiLigar(l1.id, ch); api.leiLigar(l2.id, ch);
    api.jurGravar({ tribunal: "STF", classe: "Súmula", numero: "473", tese: "A administração pode anular seus próprios atos, quando eivados de vícios.", topicos: [ch] });
    api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1001", tese: "O art. 1º da Lei 9.784/1999 vale para os Estados sem lei própria.", topicos: [ch] });
    api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1002", tese: "O prazo do art. 54 da Lei 9.784/1999 é decadencial; e o art. 5º da Lei 8.112/1990 trata da posse.", topicos: [ch] });
    /* sem layout no simulador, a leitura sem altura: o artigo do topo e' o primeiro (leiBlocoAte) */
    api.$("leiLeitura")._rect = { top: 0, left: 0, width: 800, height: 0 };
    return Object.assign(r, { ch, l1, l2 });
  };
  const corpo = (api) => api.$("leiConsCorpo");
  const achar = (raiz, fn) => {
    const out = [];
    const ir = (e) => { Array.from(e.children || []).forEach((f) => { if (fn(f)) out.push(f); ir(f); }); };
    if (raiz) ir(raiz);
    return out;
  };
  const botaoTexto = (api, re) => achar(corpo(api), (e) => (e.tagName || e.tag || "").toUpperCase() === "BUTTON" && re.test(e.textContent || ""))[0];

  /* C1 */
  {
    const { api, l1 } = montar();
    api.leiAbrir(DISC, TOP, l1.id);
    ok(api.$("btnLeiConsulta").hidden === false && api.$("leiConsulta").hidden === true, "C1 tela larga: o botão aparece e o painel nasce fechado");
    api.$("btnLeiConsulta").onclick();
    ok(api.$("leiConsulta").hidden === false && cls(api.$("dlgLeiSeca"), "lei-com-cons") && cls(api.$("btnLeiConsulta"), "btn-min-ok"),
      "C1a abrir mostra o painel, alarga a janela e acende o botão");
    const g = JSON.parse(api.loja.getItem("eac_lei_consulta") || "{}");
    ok(g.aberto === true && g.modo === "julgados", "C1b fica lembrado (aberto, julgados): " + JSON.stringify(g));
    api.leiConsModo("resumo");
    ok(JSON.parse(api.loja.getItem("eac_lei_consulta")).modo === "resumo", "C1c a escolha do conteúdo fica lembrada");
    api.$("btnLeiConsFechar").onclick();
    ok(api.$("leiConsulta").hidden === true && !cls(api.$("dlgLeiSeca"), "lei-com-cons") && JSON.parse(api.loja.getItem("eac_lei_consulta")).aberto === false,
      "C1d o ✖ fecha o painel e a janela volta ao tamanho dela");
  }

  /* C2 e C3 */
  {
    const { api, l1, l2 } = montar();
    api.leiAbrir(DISC, TOP, l1.id);
    api.leiConsAlternar(true);
    const art = api.leiConsArtAtual();
    ok(art && art.num === "1", "C2-pre o artigo da tela é o 1º: " + JSON.stringify(art && art.num));
    const tx = corpo(api).textContent || "";
    ok(/3 julgado\(s\) do tópico/.test(tx) && /1 cita\(m\) o Art\. 1º/.test(tx), "C2 o cabeçalho conta os julgados e os que citam o artigo da tela: " + tx.slice(0, 120));
    const itens = achar(corpo(api), (e) => cls(e, "lei-cons-item"));
    ok(itens.length === 3 && cls(itens[0], "lei-cons-destaque") && /REsp 1001|1001/.test(itens[0].textContent) && !cls(itens[1], "lei-cons-destaque"),
      "C2a o que cita o art. 1º vem primeiro, em destaque");
    ok(/Citam o Art\. 1º \(na tela\)/.test(tx) && /Citam esta lei/.test(tx) && /cita o\(s\) art\. 54/.test(tx) && /Os outros do tópico/.test(tx) && /473/.test(itens[2].textContent),
      "C2b depois os que citam a lei (com os artigos) e por fim o resto (a Súmula 473)");
    /* C3: a citação da OUTRA lei abre no painel; voltar devolve os julgados */
    const lk = achar(corpo(api), (e) => cls(e, "lei-cons-cit") && /art\. 5º da Lei 8\.112/.test(e.textContent || ""))[0];
    ok(!!lk && !cls(lk, "lei-cons-cit-aqui"), "C3-pre a citação da Lei 8.112 é um link (de outra lei)");
    lk.onclick();
    ok(api.leiConsCitAtual() && api.leiConsCitAtual().lei.id === l2.id && /Servidor 5/.test(corpo(api).textContent) && api.$("dlgLeiCitaPreview").open !== true,
      "C3 a citação de outra lei abre NO painel (o art. 5º da 8.112), sem a prévia");
    api.$("btnLeiConsProx").onclick();
    ok(api.leiConsCitAtual().num === "6" && /Servidor 6/.test(corpo(api).textContent), "C3a dá para andar para o artigo vizinho");
    api.$("btnLeiConsVoltar").onclick();
    ok(!api.leiConsCitAtual() && /3 julgado\(s\)/.test(corpo(api).textContent), "C3b voltar devolve os julgados");
    const aqui = achar(corpo(api), (e) => cls(e, "lei-cons-cit-aqui") && /art\. 54/.test(e.textContent || ""))[0];
    ok(!!aqui, "C3c a citação da lei ABERTA (art. 54) é o link que leva a leitura");
    let erro = null;
    try { aqui.onclick(); } catch (e) { erro = e; }
    ok(!erro && !api.leiConsCitAtual(), "C3d tocar nela leva a leitura e não troca o painel");
  }

  /* C4 */
  {
    const { api, l1, l2 } = montar();
    api.leiAbrir(DISC, TOP, l1.id);
    const c = { num: "2", numCru: "2º", rotulo: "Lei 8.112/1990", texto: "art. 2º da Lei 8.112/1990" };
    /* fechado: a prévia de sempre */
    api.leiCitacaoPreviewAbrir(c, "1", { ctx: api.leiCtxDoLeitor() });
    ok(api.$("dlgLeiCitaPreview").open === true, "C4 com o painel fechado, a citação abre na prévia (como antes)");
    api.$("dlgLeiCitaPreview").close();
    api.leiConsAlternar(true);
    api.leiCitacaoPreviewAbrir(c, "1", { ctx: api.leiCtxDoLeitor() });
    ok(api.$("dlgLeiCitaPreview").open !== true && api.leiConsCitAtual() && api.leiConsCitAtual().lei.id === l2.id && api.leiConsCitAtual().num === "2",
      "C4a com o painel aberto, a citação do leitor abre nele");
    /* de fora do leitor (uma questão por cima, por exemplo): a prévia, não o painel */
    api.leiConsModo("julgados");
    api.leiCitacaoPreviewAbrir(c, "", { lei: l2, ctx: { disciplina: DISC, topico: TOP } });
    ok(api.$("dlgLeiCitaPreview").open === true && !api.leiConsCitAtual(), "C4b a citação que vem de fora do leitor continua na prévia");
    api.$("dlgLeiCitaPreview").close();
    /* "prévia completa" a um toque */
    api.leiCitacaoPreviewAbrir(c, "1", { ctx: api.leiCtxDoLeitor() });
    api.$("btnLeiConsPrevia").onclick();
    ok(api.$("dlgLeiCitaPreview").open === true, "C4c 'prévia completa' abre a prévia de sempre");
    api.$("dlgLeiCitaPreview").close();
    /* o resumo do painel: a citação dele abre no painel */
    api.leiConsModo("resumo");
    const tx = corpo(api).textContent || "";
    ok(/anulação segue/.test(tx), "C5 o resumo do tópico aparece no painel: " + tx.slice(0, 80));
    const lk = achar(corpo(api), (e) => /art\. 53/.test(e.textContent || "") && (e.tagName || e.tag || "").toUpperCase() === "BUTTON")[0];
    ok(!!lk, "C5a a citação do resumo é um link");
    api.leiConsMarcarClique();
    if (lk) lk.onclick();
    ok(api.leiConsCitAtual() && api.leiConsCitAtual().num === "53" && api.leiConsCitAtual().lei.id === l1.id && api.$("dlgLeiCitaPreview").open !== true,
      "C5b tocar na citação do resumo do painel abre o artigo NO painel");
  }

  /* C5: outra lei e questões */
  {
    const { api, l1 } = montar();
    api.leiAbrir(DISC, TOP, l1.id);
    api.leiConsAlternar(true);
    api.leiConsModo("outra");
    const artsEl = achar(corpo(api), (e) => cls(e, "lei-cons-art"));
    ok(artsEl.length === 10 && /Lei 8\.112\/1990/.test(corpo(api).textContent), "C5c outra lei do tópico: a 8.112, artigo por artigo: " + artsEl.length);
    ok(typeof api.$("leiConsOutraIr")._irPara === "function", "C5d o 'ir ao art.' existe");
    api.$("leiConsOutraIr").value = "7";
    ok(api.$("leiConsOutraIr")._irPara() === true, "C5e 'ir ao art. 7' acha o artigo");
    api.leiConsModo("questoes");
    ok(/Nenhuma questão sua cita o Art\. 1º/.test(corpo(api).textContent), "C5f questões do artigo da tela (sem nenhuma, diz isso): " + corpo(api).textContent.slice(0, 80));
  }

  /* C6 */
  {
    const { api, janela, l1 } = montar();
    api.leiAbrir(DISC, TOP, l1.id);
    api.leiConsAlternar(true);
    api.leiCheiaTrocar(true);
    ok(api.$("leiConsulta").hidden === true && !cls(api.$("dlgLeiSeca"), "lei-com-cons") && api.$("btnLeiConsulta").hidden === true, "C6 na tela cheia o painel se recolhe");
    api.leiCheiaTrocar(false);
    ok(api.$("leiConsulta").hidden === false, "C6a sair da tela cheia traz o painel de volta");
    janela.innerWidth = 700;
    api.leiConsAplicar();
    ok(api.$("leiConsulta").hidden === true && api.$("btnLeiConsulta").hidden === true, "C6b tela estreita: sem painel e sem botão");
    janela.innerWidth = 1400;
    api.leiAbrirAvulsa(l1.id);
    ok(api.$("btnLeiConsulta").hidden === true && api.$("leiConsulta").hidden === true, "C6c aberta pela Biblioteca (sem tópico): sem botão");
  }

  /* C7 */
  {
    const { api, l1 } = montar();
    api.leiConsAbrirTopico(DISC, TOP, "julgados");
    ok(api.$("dlgLeiSeca").open === true && api.$("leiConsulta").hidden === false && api.leiConsLer().modo === "julgados" && api.$("dlgJuris").open !== true,
      "C7 o atalho abre a lei com os julgados ao lado (uma janela só)");
    ok(!/split-lj/.test(html) && !/leiJurLadoALado/.test(fs.readFileSync(path.join(__dirname, "..", "docs", "material.js"), "utf8")) && typeof api.leiJurLadoALado === "undefined",
      "C7a o lado a lado antigo saiu (CSS e função)");
    const mat = fs.readFileSync(path.join(__dirname, "..", "docs", "material.js"), "utf8");
    ok((mat.match(/leiConsAbrirTopico\(x\.disciplina, x\.topico, "julgados"\)/g) || []).length === 2, "C7b a ficha e o menu do tópico usam o atalho novo");
    const ini = html.indexOf('id="leiConsulta"');
    ok(ini > html.indexOf('<dialog id="dlgLeiSeca"') && ini < html.indexOf("</dialog>", html.indexOf('<dialog id="dlgLeiSeca"')), "C7c o painel é parte do diálogo da lei (não outra janela)");
    ok(html.indexOf("#dlgLeiSeca.lei-com-cons[open]") > html.indexOf("#dlgLeiSeca.lei-j-maxima[open]"), "C7d a largura do painel vem depois das larguras de janela (vence a escolhida)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
