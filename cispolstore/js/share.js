// Share an invoice or a receipt as a real PDF (WhatsApp, e-mail…): the document is drawn to an image and wrapped in a minimal PDF, with no library.
(() => {
  const App = window.App, esc = App.esc, W = 794, PAD = '1.4cm 1.5cm';  // A4 width in CSS pixels
  const enc = s => new TextEncoder().encode(s);
  const dataUrlBytes = u => Uint8Array.from(atob(u.split(',')[1]), c => c.charCodeAt(0));
  // JPEG pages -> PDF (one full-width image per A4 page)
  const buildPdf = pages => {
    const PW = 595.28, PH = 841.89, parts = [], offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? enc(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); put(body); put('\nendobj\n'); };
    put('%PDF-1.4\n');
    const n = pages.length, kids = pages.map((_, k) => `${5 + k * 3} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
    pages.forEach((p, k) => {
      const im = 3 + k * 3, ct = im + 1, pg = im + 2, h = PW * p.h / p.w;
      offs[im] = len; put(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put('\nendstream\nendobj\n');
      const c = `q ${PW} 0 0 ${h.toFixed(2)} 0 ${(PH - h).toFixed(2)} cm /Im0 Do Q`; obj(ct, `<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    });
    const total = 3 + n * 3, xref = len; put(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let k = 1; k < total; k++) put(String(offs[k] || 0).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len); let o = 0; parts.forEach(b => { out.set(b, o); o += b.length; }); return out;
  };
  // draw the document (HTML string) to canvas pages
  const render = async html => {
    const K = App.docKit, host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;box-sizing:border-box;padding:${PAD};background:#fff`;
    host.innerHTML = `<style>${K.DOC_CSS()}</style>${html}`; document.body.appendChild(host);
    await Promise.all([...host.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : 0));
    const H = Math.ceil(host.scrollHeight); host.style.position = 'static'; host.style.left = '0'; const xhtml = new XMLSerializer().serializeToString(host); host.remove();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const S = 2, cw = W * S, ph = Math.round(cw * 841.89 / 595.28), full = document.createElement('canvas'); full.width = cw; full.height = H * S;
    const g = full.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, full.height); g.drawImage(img, 0, 0, cw, H * S);
    const pages = []; for (let y = 0; y < full.height || !pages.length; y += ph) {
      const h = Math.min(ph, full.height - y), c = document.createElement('canvas'); c.width = cw; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cw, h); x.drawImage(full, 0, y, cw, h, 0, 0, cw, h);
      pages.push({ w: cw, h, jpg: dataUrlBytes(c.toDataURL('image/jpeg', 0.92)) });
    }
    return buildPdf(pages);
  };
  App.sharePdf = async (name, html) => {
    try {
      const done = App.busy('Préparation du PDF…');
      let bytes; try { bytes = await render(html); } finally { done(); } const file = new File([bytes], name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      App.toast('PDF enregistré : ' + name);
    } catch (e) { console.warn('sharePdf', e); App.toast('PDF indisponible sur cet appareil : utilisez Imprimer'); }
  };
  App.actions.invshare = async d => { const i = App.invoice(d.id); if (i) App.sharePdf(`${i.number}.pdf`, App.invoiceDoc(i, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.recshare = async d => { const p = App.db.payments.find(x => x.id === d.id); if (p) App.sharePdf(`Recu-${App.receiptNo(p)}.pdf`, App.receiptDoc(p, await App.docKit.logoData(), await App.docKit.stampData())); };
})();
