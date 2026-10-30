/* =====================================================================
 * O LOCALIZADOR DO ARTIGO LONGO E AS REFERÊNCIAS AO PRÓPRIO ARTIGO (19.43.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "ressalvado o disposto no inciso V", escrito dentro do § 1º, vira link para o inciso V DO § 1º do mesmo artigo
 *     (e não para o inciso V do caput). Fica de fora o que aponta para outro artigo ou lei e o rótulo da própria linha.
 *  2. Rolando dentro do artigo, a faixa do topo mostra o artigo e as partes que já começaram acima da tela,
 *     empilhadas (art. › § › inciso); some quando o começo do artigo está à vista.
 *  3. O × da faixa e o botão de "exibição" desligam; a escolha fica guardada e a faixa não volta até religar.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const r = rodar();
  const api = r.api;

  /* ---- 1a: o leitor das referências soltas ---- */
  const refs = (s) => api.leiRefsRelativas(s).map((x) => x.texto + "=" + [x.paragrafos.join("/"), x.incisos.join("/"), x.alineas.join("/")].join("|"));
  ok(refs("ressalvado o disposto no inciso V; (Incluído pela Emenda Constitucional nº 132)").join() === "inciso V=|V|", "R1 'no inciso V' e referencia: " + refs("ressalvado o disposto no inciso V;"));
  ok(!refs("nos termos do inciso V do art. 155").length, "R2 'inciso V do art. 155' e de outro artigo");
  ok(!refs("conforme art. 155, § 2º, X").length, "R3 a parte de uma citacao de artigo nao e solta");
  ok(!refs("§ 1º O imposto previsto no caput deste artigo").length && !refs("Parágrafo único. Texto").length, "R4 o rotulo da propria linha nao e referencia");
  ok(refs("observado o disposto no § 5º, III;").join() === "§ 5º, III=5º|III|", "R5 '§ 5º, III': " + refs("observado o disposto no § 5º, III;"));
  ok(refs("nos incisos I a III do § 2º deste artigo").join() === "incisos I a III do § 2º=2º|I/II/III|", "R6 faixa de incisos de um paragrafo");
  ok(refs("na forma da alínea “b” do inciso II").join() === "alínea “b” do inciso II=|II|b", "R7 alinea do inciso");
  ok(!refs("o § 2º da Lei nº 8.666").length, "R8 '§ 2º da Lei' e de outra lei");

  /* ---- 1b: no leitor, o lugar da frase decide o § ---- */
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito", "Tributário");
  api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
  const LEI = [
    "Art. 1º Lei complementar instituirá o imposto.",
    "§ 1º O imposto previsto no caput deste artigo:",
    "I - incidirá sobre operações;",
    "II - será informado pelo princípio da neutralidade;",
    "III - não incidirá sobre as exportações;",
    "IV - terá legislação única, ressalvado o disposto no inciso V;",
    "V - cada ente fixará sua alíquota própria;",
    "§ 2º Para fins do disposto no § 1º, V, o ente poderá vincular.",
    "Art. 2º Outro artigo.",
  ].join("\n");
  const l = api.leiGuardar({ id: "lei_loc", nome: "Lei Loc", texto: LEI });
  api.leiLigar(l.id, ch);
  api.leiAbrir("Direito", "Tributário", l.id);
  api.leiTrocarModo("ler");
  const bloco = api.$("leiArt_1");
  const links = [];
  const achar = (el) => Array.from((el && el.children) || []).forEach((c) => { if (/lei-cita-rel/.test(c.className || "")) links.push(c); achar(c); });
  achar(bloco);
  const noV = links.filter((b) => b.textContent === "inciso V")[0];
  ok(noV && noV._cit && noV._cit.paragrafos.join() === "1º" && noV._cit.incisos.join() === "V" && noV._cit.num === "1",
    "L1 'no inciso V' dentro do § 1º aponta o inciso V do § 1º do mesmo artigo: " + (noV && JSON.stringify([noV._cit.paragrafos, noV._cit.incisos])));
  const p1 = links.filter((b) => /§ 1º, V/.test(b.textContent))[0];
  ok(p1 && p1._cit.paragrafos.join() === "1º" && p1._cit.incisos.join() === "V", "L2 '§ 1º, V' tambem vira link para a parte certa");

  /* ---- 2: a faixa ---- */
  const cx = api.$("leiLeitura");
  cx._rect = { top: 100, left: 0, width: 600, height: 400 };
  const corpo = Array.from(bloco.children).filter((c) => /lei-art-txt/.test(c.className || ""))[0];
  const ls = Array.from(corpo.children).filter((c) => c.tagName === "P");
  const por = (top) => { bloco._rect = { top: top - 30, left: 0, width: 600, height: 400 }; ls.forEach((el, i) => { el._rect = { top: top + i * 30, left: 0, width: 600, height: 28 }; }); };
  const a2 = api.$("leiArt_2");
  if (a2) a2._rect = { top: 900, left: 0, width: 600, height: 50 };
  por(150);
  ok(api.leiLocAtualizar().length === 0 && api.$("leiLocLinha").hidden === true, "F1 com o comeco do artigo a vista, a faixa nao aparece");
  por(95 - 30 * 6);   /* a linha do inciso V (7ª) está no topo; o § 1º e o inciso IV já subiram */
  const cad = api.leiLocAtualizar();
  const rots = cad.map((c) => c.rotulo).join(" › ");
  ok(api.$("leiLocLinha").hidden === false && /^Art\. 1º › § 1º/.test(rots), "F2 a faixa empilha o artigo e o § 1º: " + rots);
  ok(api.$("leiLoc").children.length === cad.length + 1 && api.$("btnLeiLocFechar"), "F3 uma linha por nivel e o × para desligar");

  /* ---- 3: desligar ---- */
  api.$("btnLeiLocFechar").onclick();
  ok(api.leiLocLigado() === false && api.$("leiLocLinha").hidden === true && api.loja.getItem("eac_lei_localizador") === "0", "D1 o × desliga e guarda");
  ok(api.leiLocAtualizar().length === 0, "D2 desligado, rolar nao traz a faixa de volta");
  api.leiLocDefinir(true);
  ok(api.leiLocLigado() && api.$("leiLocLinha").hidden === false && /ligado/.test(api.$("btnLeiLoc").textContent), "D3 religado em exibicao, a faixa volta: " + api.$("btnLeiLoc").textContent);

  /* ---- 4: a prévia da citação tem o mesmo localizador ---- */
  noV.onclick({ stopPropagation() {} });
  const pv = api.$("leiCitaPreviewTexto");
  const pls = Array.from(pv.children).filter((c) => /lei-cita-l/.test(c.className || ""));
  ok(api.$("dlgLeiCitaPreview").open && pls.length === LEI.split("\n").length - 1 && pls.some((d) => d.children[0] && /lei-cita-alvo/.test(d.children[0].className)),
    "V1 a previa abre com uma linha por bloco e o inciso V marcado: " + pls.length);
  pv._rect = { top: 300, left: 0, width: 500, height: 300 };
  pls.forEach((d, i) => { d._rect = { top: i === pls.length - 1 ? 900 : 300 - 30 * 6 + 5 + i * 30, left: 0, width: 500, height: 28 }; });
  const cp = api.leiCitaLocAtualizar();
  ok(api.$("leiCitaLoc").hidden === false && cp.map((c) => c.rotulo).slice(0, 2).join(" › ") === "Art. 1º › § 1º", "V2 rolando a previa, a faixa diz artigo e §: " + cp.map((c) => c.rotulo).join(" › "));
  pls.forEach((d, i) => { d._rect = { top: 310 + i * 30, left: 0, width: 500, height: 28 }; });
  ok(api.leiCitaLocAtualizar().length === 0 && api.$("leiCitaLoc").hidden === true, "V3 com o comeco do artigo a vista, a faixa some");

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
