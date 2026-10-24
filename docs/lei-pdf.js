/* =====================================================================
 * LER A LEI DIRETO DO PDF (v19.3.0)
 *
 * POR QUÊ: a lei que só existe em PDF (o Código Tributário de Caruaru, 296 páginas, e as leis que o alteram) tinha de
 * passar pelo Word ou por um conversor, e chegava estragada: o "Art. 349" virava "Art. 3 49", "Município" virava
 * "Municí pio", e o RISCO do texto revogado se perdia — a LC 15 compilada abriu 217 grupos de "artigos repetidos".
 *
 * O QUE SE MEDIU nos 4 PDFs reais de Caruaru (LC 15, 95, 112 e 145): todos têm texto (nenhum é imagem escaneada);
 * a LC 112 e a LC 145 vêm PICOTADAS ("1"+"12,", "Certid"+"ã"+"o"); e o risco da LC 15 é DESENHADO (traço fino sobre
 * o meio da letra). Montando pela POSIÇÃO de cada pedaço — espaço só quando o PDF tem um, ou quando a distância passa
 * de ~1/5 da altura da letra — não sobra número partido; e o traço achado sobre o miolo da letra marca o riscado:
 * na LC 15, as redações antigas dos arts. 3º, 8º e 38, o art. 349 revogado e o Anexo VII inteiro saem riscados, a
 * redação nova não — e, separado o riscado, ficam 556 artigos vigentes e NENHUM repetido.
 *
 * COMO: o PDF.js (o leitor de PDF do Firefox) é baixado SÓ quando alguém escolhe um PDF (≈1 MB, fica guardado). Cada
 * linha da página vira um <p>, cada trecho riscado um <s>, e esse HTML segue o MESMO caminho do .htm/.docx
 * (leiTextoDeArquivoHtml): o texto e o riscado saem do lugar de sempre, e a revisão da colagem limpa cabeçalho de
 * página, número de página e linha quebrada como já faz. Tabelas dos anexos entram como texto, linha a linha.
 * ===================================================================== */
const LEI_PDFJS = {
  script: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
};
let leiPdfLibPromessa = null;

/* o PDF.js, sob demanda */
function leiPdfCarregarLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (leiPdfLibPromessa) return leiPdfLibPromessa;
  leiPdfLibPromessa = new Promise((resolve, reject) => {
    /* sem resposta em 60 s (rede caindo no meio), desiste e diz o motivo — a leitura não pode ficar presa */
    const prazo = setTimeout(() => { leiPdfLibPromessa = null; reject(new Error("tempo esgotado")); }, 60000);
    const s = document.createElement("script");
    s.src = LEI_PDFJS.script;
    s.onload = () => {
      clearTimeout(prazo);
      if (!window.pdfjsLib) { leiPdfLibPromessa = null; reject(new Error("pdfjsLib ausente")); return; }
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = LEI_PDFJS.worker; } catch (e) {}
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { clearTimeout(prazo); leiPdfLibPromessa = null; reject(new Error("não carregou o leitor de PDF")); };
    document.head.appendChild(s);
  });
  return leiPdfLibPromessa;
}

/* OS TRAÇOS HORIZONTAIS FINOS da página (o risco do texto revogado é um deles): [{ x0, x1, y }], no espaço da página.
 * Segue as transformações (save/restore/transform) porque o traço costuma vir desenhado num sistema deslocado. */
function leiPdfTracos(opList, OPS) {
  const out = [];
  if (!opList || !OPS) return out;
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  const fns = opList.fnArray || [], args = opList.argsArray || [];
  for (let k = 0; k < fns.length; k++) {
    const fn = fns[k], a = args[k];
    if (fn === OPS.save) pilha.push(ctm.slice());
    else if (fn === OPS.restore) ctm = pilha.pop() || ctm;
    else if (fn === OPS.transform && a) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath && a) {
      const os = a[0] || [], cs = a[1] || [];
      let i = 0, cx = 0, cy = 0;
      for (const o of os) {
        if (o === OPS.moveTo) { cx = cs[i++]; cy = cs[i++]; }
        else if (o === OPS.lineTo) {
          const nx = cs[i++], ny = cs[i++];
          const p1 = ap(ctm, cx, cy), p2 = ap(ctm, nx, ny);
          if (Math.abs(p1[1] - p2[1]) < 1.5 && Math.abs(p1[0] - p2[0]) > 3) out.push({ x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y: (p1[1] + p2[1]) / 2 });
          cx = nx; cy = ny;
        } else if (o === OPS.rectangle) {
          const x = cs[i++], y = cs[i++], w = cs[i++], h = cs[i++];
          const p1 = ap(ctm, x, y), p2 = ap(ctm, x + w, y + h);
          if (Math.abs(p2[1] - p1[1]) < 2.5 && Math.abs(p2[0] - p1[0]) > 3) out.push({ x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y: (p1[1] + p2[1]) / 2 });
        } else if (o === OPS.curveTo) i += 6;
        else if (o === OPS.curveTo2 || o === OPS.curveTo3) i += 4;
      }
    }
  }
  return out;
}

/* o pedaço está RISCADO: traços sobre o MIOLO da letra (de 15% a 75% da altura, acima da linha de base) cobrindo mais
 * da metade da largura dele. Sublinhado (abaixo) e borda de tabela (entre as linhas) não contam. */
function leiPdfRiscado(it, tracos) {
  const w = +it.width || 0;
  if (w <= 0 || !tracos || !tracos.length) return false;
  const x0 = it.transform[4], x1 = x0 + w, y = it.transform[5];
  const h = Math.abs(it.transform[3]) || +it.height || 10;
  let cob = 0;
  tracos.forEach((t) => { if (t.y > y + h * 0.15 && t.y < y + h * 0.75) cob += Math.max(0, Math.min(x1, t.x1) - Math.max(x0, t.x0)); });
  return cob / w > 0.5;
}

/* AS LINHAS de uma página, montadas pela POSIÇÃO: [{ runs: [{ t, r }] }] (r = riscado) */
function leiPdfLinhas(items, tracos) {
  const linhas = [];
  let cur = null, ultX1 = null, ultY = null;
  const fecha = () => { if (cur && cur.some((x) => x.t.trim())) linhas.push({ runs: cur }); cur = null; ultX1 = null; };
  const poe = (t, r) => {
    const u = cur[cur.length - 1];
    if (u && u.r === r) u.t += t; else cur.push({ t, r });
  };
  (items || []).forEach((it) => {
    const s = String(it.str || "");
    const tem = !!s.trim();
    const x = it.transform[4], y = it.transform[5];
    const h = Math.abs(it.transform[3]) || +it.height || 10;
    if (cur === null || (tem && ultY !== null && Math.abs(y - ultY) > h * 0.5)) { fecha(); cur = []; }
    if (tem) {
      const r = leiPdfRiscado(it, tracos);
      const txt = cur.map((x2) => x2.t).join("");
      /* o espaço: só quando o PDF tem um, ou quando a distância é de verdade (o picotado "Certid"+"ã"+"o" fica junto) */
      if (ultX1 !== null && !/^\s/.test(s) && !/\s$/.test(txt) && (x - ultX1) > h * 0.22) poe(" ", cur.length ? cur[cur.length - 1].r : r);
      poe(s, r);
      ultX1 = x + (+it.width || 0); ultY = y;
    } else if (s) poe(s, cur.length ? cur[cur.length - 1].r : false);
    if (it.hasEOL) fecha();
  });
  fecha();
  return linhas;
}

function leiPdfEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* as linhas de todas as páginas → HTML (<p> por linha, <s> no riscado), o formato que leiTextoDeArquivoHtml lê */
function leiPdfHtml(paginas) {
  const ps = [];
  (paginas || []).forEach((linhas) => (linhas || []).forEach((ln) => {
    ps.push("<p>" + ln.runs.map((x) => (x.r && x.t.trim() ? "<s>" + leiPdfEsc(x.t) + "</s>" : leiPdfEsc(x.t))).join("") + "</p>");
  }));
  return "<html><body>" + ps.join("\n") + "</body></html>";
}

/* O PDF → { texto, n, motivo, paginas } (o mesmo formato de leiTextoDeDocx). motivo: "pdf_sem_leitor" (o PDF.js não
 * carregou: sem internet na primeira vez), "pdf_sem_texto" (PDF de imagem escaneada), "pdf_invalido". */
async function leiTextoDePdf(bytes, opc) {
  const o = opc || {};
  let lib;
  try { lib = o.pdfjsLib || await (o.carregar || leiPdfCarregarLib)(); }
  catch (e) { return { texto: "", n: 0, motivo: "pdf_sem_leitor", paginas: 0 }; }
  let pdf;
  try {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const tarefa = lib.getDocument({ data: u8 });
    pdf = await (tarefa.promise || tarefa);
  } catch (e) { return { texto: "", n: 0, motivo: "pdf_invalido", paginas: 0 }; }
  const OPS = lib.OPS || {};
  const paginas = [];
  let chars = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    if (typeof o.onProgresso === "function") { try { o.onProgresso(p, pdf.numPages); } catch (e) {} }
    const pg = await pdf.getPage(p);
    const tc = await pg.getTextContent();
    let tracos = [];
    try { tracos = leiPdfTracos(await pg.getOperatorList(), OPS); } catch (e) { tracos = []; }
    const linhas = leiPdfLinhas(tc.items, tracos);
    linhas.forEach((ln) => ln.runs.forEach((x) => { chars += x.t.trim().length; }));
    paginas.push(linhas);
  }
  /* menos de 20 letras por página: é imagem (escaneado) — nada de texto para ler */
  if (chars < Math.max(20, pdf.numPages * 20)) return { texto: "", n: 0, motivo: "pdf_sem_texto", paginas: pdf.numPages };
  /* o "sem_tachado" do leitor de .htm não é problema aqui (lei sem nada riscado): motivo só para o que impede a leitura */
  const r = leiTextoDeArquivoHtml(leiPdfHtml(paginas));
  return r.texto ? { texto: r.texto, n: r.n || 0, paginas: pdf.numPages }
    : { texto: "", n: 0, motivo: "pdf_sem_texto", paginas: pdf.numPages };
}
