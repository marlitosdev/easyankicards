/* =====================================================================
 * O RISCADO DO PLANALTO COM O LINK NO MEIO (19.161.0) — Estatuto da Cidade, art. 53
 *
 * O Planalto risca o artigo revogado com <strike>, mas o link para a lei citada fica FORA do risco, e as linhas só de
 * pontos do artigo citado vêm riscadas sem letra nenhuma. Antes: "Art. 53. (Revogado) Lei nº 7.347, de 24 de julho
 * de 1985 (Revogado pela…)" e um "......." solto, partindo o bloco em dois cards.
 *
 * O QUE PRECISA SER VERDADE:
 *  K1. o link SEM risco entre dois trechos riscados da mesma linha é parte do riscado;
 *  K2. o link vivo (sem riscado dos dois lados) continua vivo;
 *  K3. a linha inteira riscada só de pontos é marcada; a linha de pontos sem risco, não;
 *  K4. o artigo revogado fica "Art. 53. (Revogado pela …)", num card só com o artigo citado;
 *  K5. a redação antiga longa de um artigo que continua é "substituído", não "tabela".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const PAG = (corpo) => '<html><head><meta charset="utf-8"></head><body>' + corpo + "</body></html>";
  const ART52 = '<p>Art. 52. Texto vivo do artigo, com a <a href="L1.htm">Lei nº 1.234, de 1990</a> citada.</p>';
  const ART53 = '<p><a name="art53"></a><strike><small>Art. 53. O art. 1<sup>o</sup> da </small></strike>'
    + '<small><a href="https://www.planalto.gov.br/ccivil_03/leis/L7347orig.htm">Lei nº\n7.347, de 24 de julho de 1985</a>'
    + '<strike>, passa a vigorar acrescido de novo inciso III:</strike>&nbsp;&nbsp; </small>'
    + '<a href="MPV.htm"><font size="2">(Revogado pela Medida Provisória nº 2.180-35, de 24.8.2001)</font></a></p>'
    + '<blockquote><p><strike>"Art. 1<sup>o</sup> ..........................</strike></p>'
    + '<p><strike>...................................</strike></p>'
    + '<p><strike><a href="L7347.htm#art1iii">III –</a> à ordem urbanística;</strike></p>'
    + '<p><strike>.............................." (NR)</strike></p></blockquote>'
    + '<p>Art. 54. Outro artigo vivo.</p><p>...................................</p>';
  const r = api.leiTextoDeArquivoHtml(PAG(ART52 + ART53));
  const L = r.texto.split("\n").filter((x) => x.trim());
  const l53 = L.filter((x) => /Art\. 53/.test(x))[0] || "";
  ok(/^~~Art\. 53\. O art\. 1o da Lei nº 7\.347, de 24 de julho de 1985, passa a vigorar acrescido de novo inciso III:~~ \(Revogado pela/.test(l53),
    "K1 o link entre dois riscados entra no riscado: " + l53);
  const l52 = L.filter((x) => /Art\. 52/.test(x))[0] || "";
  ok(l52.indexOf("~~") < 0, "K2 o link vivo continua vivo: " + l52);
  ok(L.some((x) => /^~~\.{10,}~~$/.test(x)), "K3a a linha riscada só de pontos é marcada: " + JSON.stringify(L));
  ok(/^\.{10,}$/.test(L[L.length - 1]), "K3b a linha de pontos sem risco não é marcada");
  /* o riscado só antes (não depois) do link: o link fica */
  const r2 = api.leiTextoDeArquivoHtml(PAG('<p><strike>Texto antigo,</strike> <a href="x.htm">Lei nº 9.999, de 2020</a>, texto vivo.</p>'));
  ok(/~~Texto antigo,~~ Lei nº 9\.999, de 2020, texto vivo\./.test(r2.texto), "K2b com riscado só de um lado, o link fica: " + r2.texto);
  /* K4: a limpeza */
  const P = api.leiPreprocessar(r.texto);
  const it = (P.mudancas || []).filter((m) => m.grupo === "tachado");
  ok(it.length === 1 && it[0].linhas.length === 5 && it[0].depois === "Art. 53. (Revogado pela Medida Provisória nº 2.180-35, de 24.8.2001)",
    "K4 um card só, e o artigo fica com a nota: " + JSON.stringify(it.map((x) => [x.linhas, x.depois])));
  /* K5 */
  const velho = Array.from({ length: 9 }, (_, k) => "<p><strike>" + (k ? "§ " + k + "º Parágrafo antigo " + k + "." : "Art. 42-A. Redação antiga do artigo:") + "</strike></p>").join("");
  const r3 = api.leiTextoDeArquivoHtml(PAG("<p>Art. 42. Vivo.</p>" + velho + "<p>Art. 42-A. Redação nova do artigo.</p><p>Art. 43. Vivo.</p>"));
  const it3 = api.leiAcharTachados(r3.texto.split("\n"));
  ok(it3.length === 1 && it3[0].tipo === "substituido", "K5 a redação antiga longa é 'substituído': " + JSON.stringify(it3.map((x) => x.tipo)));
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
