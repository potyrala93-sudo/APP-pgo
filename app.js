/* =========================================================
   PGO Digital v2 — Apontamento de produção
   Início: atalhos + lançamentos agrupados em cartões por dia (editar, PDF, WhatsApp)
   Lançamentos: Apontamento (atividades, diárias, horas paradas, insumos, fotos) | Diárias | Horas Paradas
   Valores: valor/hora das diárias por tipo (colaborador, trator médio, trator pesado, caminhão)
   Login por nome e senha; cada usuário vê só os próprios dados.
   Sem internet: o lançamento (com as fotos) fica no aparelho e é enviado sozinho depois.
   ========================================================= */
(function () {
  'use strict';

  // ---------- Configuração ----------
  const CFG = window.PGO_CONFIG || {};
  const COMPRAS = window.APP_CONFIG || {};
  const URL_SB = (CFG.SUPABASE_URL || COMPRAS.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const KEY_SB = (CFG.SUPABASE_ANON_KEY || COMPRAS.SUPABASE_ANON_KEY || '').trim();
  const configurado = /^https:\/\//.test(URL_SB) && KEY_SB.length > 20 && !/SEU-PROJETO|COLE_AQUI/.test(URL_SB + KEY_SB);
  const PLANILHAS = CFG.PLANILHAS || {};
  const MOTIVOS = (CFG.MOTIVOS && CFG.MOTIVOS.length) ? CFG.MOTIVOS : ['Chuva', 'Manutenção / quebra de máquina', 'Outros'];
  const RECURSOS = ['Colaborador', 'Trator médio', 'Trator pesado', 'Caminhão'];
  const BUCKET = 'pgo-fotos';

  // ---------- Utilidades ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => new Date().toLocaleDateString('sv-SE');
  const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE'); };
  const dia10 = (d) => String(d || '').slice(0, 10);
  const dataBR = (d) => { if (!d) return '—'; const [a, m, dd] = dia10(d).split('-'); return `${dd}/${m}/${a}`; };
  const dataObj = (d) => new Date(dia10(d) + 'T12:00:00');
  const diaSemana = (d) => dataObj(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dataLonga = (d) => dataObj(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const num = (n, dec) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: dec == null ? 2 : dec });
  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (n) => (n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
  const lerNum = (s) => { if (typeof s === 'number') return s; s = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(/^R\$/i, ''); if (!s) return null; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const numCampo = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false }));
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const igual = (a, b) => semAcento(String(a || '').trim()) === semAcento(String(b || '').trim());
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const hhmm = (t) => String(t || '').slice(0, 5);
  const minDoDia = (t) => { const [a, b] = hhmm(t).split(':').map(Number); return a * 60 + b; };
  function minutos(i, f) {
    i = hhmm(i); f = hhmm(f); if (!i || !f) return 0;
    let m = minDoDia(f) - minDoDia(i); if (m < 0) m += 1440; return m;
  }
  // minutos trabalhados: desconta o que cair entre 11h e 12h (almoço)
  function minLiquidos(i, f) {
    const m = minutos(i, f); if (!m) return 0;
    const s = minDoDia(i), e = s + m; const sobra = (a, b) => Math.max(0, Math.min(e, b) - Math.max(s, a));
    return m - sobra(660, 720) - sobra(2100, 2160);
  }
  const duracao = (m) => { m = Math.round(m); const hh = Math.floor(m / 60), mm = m % 60; return hh ? `${hh}h${mm ? String(mm).padStart(2, '0') : ''}` : `${mm} min`; };
  const horasTxt = (hrs) => duracao(hrs * 60);
  const ordenarUP = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? padrao : v; } catch (_) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const unidade = (atv) => (/\bHORAS?\b/i.test(atv || '') ? 'h' : 'ha');
  const plural = (n, um, varios) => `${num(n, 0)} ${n === 1 ? um : varios}`;

  const P = {
    apont: 'M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1zM9 12l2 2 4-4M8 17h8',
    diaria: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    parada: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6',
    valor: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01',
    voltar: 'M15 6l-6 6 6 6', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', chev: 'M9 6l6 6-6 6', baixo: 'M6 9l6 6 6-6',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', sair: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10',
    menu: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    lixo: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
    nuvem: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z', olho: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    mapa: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    editar: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
    pdf: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    whats: 'M4 20l1.4-4.2A8 8 0 1 1 8.4 19z',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
    lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    equipe: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M19 14a6 6 0 0 1 3 5.2V21',
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

  function toast(msg, tipo, tempo) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), tempo || 4500);
  }
  function dialogo(html, cls) {
    const d = document.createElement('dialog'); if (cls) d.className = cls; d.innerHTML = html; document.body.appendChild(d);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 50));
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.showModal(); return d;
  }
  function confirmar(titulo, texto, ok, perigo) {
    return new Promise((res) => {
      const d = dialogo(`<form method="dialog" class="dlg"><h2>${h(titulo)}</h2>${texto ? `<p>${texto}</p>` : ''}
        <div class="dlg-foot"><button value="nao" class="btn btn-ghost">Cancelar</button><button value="sim" class="btn ${perigo ? 'btn-perigo' : ''}">${h(ok || 'Confirmar')}</button></div></form>`);
      d.addEventListener('close', () => res(d.returnValue === 'sim'));
    });
  }
  const redeErro = (e) => { const m = String((e && (e.message || e.error_description)) || e || ''); return !navigator.onLine || /failed to fetch|network|load failed|fetch failed|timeout/i.test(m); };
  function msgErro(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (redeErro(e)) return 'Sem conexão com a internet.';
    if (/anonymous sign-ins are disabled/i.test(m)) return 'O login anônimo está desligado no Supabase (Authentication › Allow anonymous sign-ins).';
    if (/could not find the function|does not exist|schema cache/i.test(m)) return 'O banco ainda não tem a versão nova do PGO. Rode o arquivo pgo.sql no SQL Editor do Supabase.';
    if (/bucket not found/i.test(m)) return 'A pasta de fotos não existe no Supabase. Rode o arquivo pgo.sql de novo.';
    if (/row-level security|unauthorized|403/i.test(m)) return 'Sem permissão para enviar a foto. Entre de novo no app.';
    if (/JWT|refresh token/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    return m;
  }

  // ---------- Estado ----------
  const S = {
    sb: null, user: ler('pgo.usuario', null),
    base: Object.assign({ equipes: [], fazendas: [], insumos: [], atividades: [], em: null }, ler('pgo.base', {})),
    regs: [], valores: {}, janela: 60, nDias: 3,
    filtro: { periodo: '30', equipe: '', tipo: '', busca: '', buscando: false },
    enviando: false,
  };
  const chaveFila = () => 'pgo.fila2.' + (S.user ? S.user.id : '');
  const fila = () => ler(chaveFila(), []);
  const salvarFila = (f) => gravar(chaveFila(), f);
  const app = () => $('#app');
  const urlFoto = (path) => `${URL_SB}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

  function cliente() {
    if (S.sb) return S.sb;
    if (!configurado || !window.supabase?.createClient) return null;
    S.sb = window.supabase.createClient(URL_SB, KEY_SB, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pgo.auth' } });
    return S.sb;
  }
  async function sessao() {
    const { data } = await S.sb.auth.getSession();
    if (data && data.session) return data.session;
    const r = await S.sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    return r.data.session;
  }
  async function rpc(fn, args) { const { data, error } = await S.sb.rpc(fn, args || {}); if (error) throw error; return data; }

  // ---------- Fotos guardadas no aparelho (IndexedDB) ----------
  const IDB = {
    db: null,
    abrir() {
      if (!this.db) this.db = new Promise((ok, no) => { const r = indexedDB.open('pgo-digital', 1); r.onupgradeneeded = () => r.result.createObjectStore('fotos'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      return this.db;
    },
    async op(modo, fn) {
      const db = await this.abrir();
      return new Promise((ok, no) => { const tx = db.transaction('fotos', modo); const req = fn(tx.objectStore('fotos')); tx.oncomplete = () => ok(req && req.result); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });
    },
    get(k) { return this.op('readonly', (s) => s.get(k)).catch(() => null); },
    put(k, v) { return this.op('readwrite', (s) => s.put(v, k)); },
    del(k) { return this.op('readwrite', (s) => s.delete(k)).catch(() => null); },
  };
  const urlsLocais = new Map();
  async function hidratarFotos(raiz) {
    await Promise.all($$('img[data-path]', raiz).map(async (img) => {
      if (img.getAttribute('src')) return;
      const p = img.dataset.path;
      if (urlsLocais.has(p)) { img.src = urlsLocais.get(p); return; }
      const blob = await IDB.get(p);
      if (blob) { const u = URL.createObjectURL(blob); urlsLocais.set(p, u); img.src = u; } else img.src = urlFoto(p);
    }));
  }
  async function reduzirFoto(arq, max) {
    max = max || 1600; let img;
    try { img = await createImageBitmap(arq, { imageOrientation: 'from-image' }); }
    catch (_) { img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(arq); }); }
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('foto'))), 'image/jpeg', 0.8));
  }
  function verFoto(path) {
    const d = dialogo(`<div class="dlg foto-grande"><div class="dlg-head"><h2>Foto</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div><img alt="Foto do lançamento" data-path="${h(path)}"></div>`);
    $('[data-x]', d).onclick = () => d.close(); hidratarFotos(d);
  }

  // ---------- Planilhas do Google ----------
  function lerCSV(txt) {
    const linhas = []; let campo = '', linha = [], aspas = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (aspas) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
      else if (c === '"') aspas = true;
      else if (c === ',') { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    const cab = (linhas.shift() || []).map((x) => semAcento(x).trim());
    return linhas.filter((l) => l.some((x) => String(x).trim())).map((l) => Object.fromEntries(cab.map((k, i) => [k, String(l[i] == null ? '' : l[i]).trim()])));
  }
  async function planilha(id) {
    if (!id) return [];
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0&_=${Date.now()}`);
    if (!r.ok) throw new Error('planilha ' + r.status);
    return lerCSV(await r.text());
  }
  async function carregarBase() {
    try {
      const [eq, fz, ins, atv] = await Promise.all([planilha(PLANILHAS.equipes), planilha(PLANILHAS.fazendas), planilha(PLANILHAS.insumos), planilha(PLANILHAS.atividades)]);
      S.base = {
        equipes: eq.map((r) => { const m = lerNum(r.metas || r.meta); return { cdc: r.cdc, equipe: r.equipe, tipo: /mec/i.test(r.tipo) ? 'Mecanizado' : /man/i.test(r.tipo) ? 'Manual' : (r.tipo || ''), meta: Number.isFinite(m) && m > 0 ? m : null }; }).filter((r) => r.equipe),
        fazendas: fz.map((r) => ({ cdc: r.cdc, fazenda: r.fazenda, up: r.up || r.talhao, area: lerNum(r.area) })).filter((r) => r.fazenda && r.up),
        insumos: ins.map((r) => ({ cdc: r.cdc, insumo: r.insumo })).filter((r) => r.insumo),
        atividades: atv.map((r) => { const t = lerNum(r.tarifas || r.tarifa); return { cdc: r.cdc, regime: r.regime || '', atividade: r.atividade, tarifa: Number.isFinite(t) ? t : null }; }).filter((r) => r.atividade),
        em: new Date().toISOString(),
      };
      gravar('pgo.base', S.base);
      return true;
    } catch (e) { console.warn('Planilhas', e); return false; }
  }
  const doCDC = (lista) => lista.filter((r) => !S.user || !r.cdc || igual(r.cdc, S.user.cdc));
  const equipes = () => doCDC(S.base.equipes).sort((a, b) => a.equipe.localeCompare(b.equipe, 'pt-BR', { numeric: true }));
  const fazendas = () => [...new Set(doCDC(S.base.fazendas).map((r) => r.fazenda))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const talhoes = (fz) => doCDC(S.base.fazendas).filter((r) => r.fazenda === fz).sort((a, b) => ordenarUP(a.up, b.up));
  const insumos = () => [...new Set(doCDC(S.base.insumos).map((r) => r.insumo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const atividades = () => doCDC(S.base.atividades || []).slice().sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR', { numeric: true }));
  const cdcs = () => [...new Set([...S.base.equipes, ...S.base.fazendas, ...S.base.insumos].map((r) => r.cdc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const areaDe = (fz, up) => { const t = S.base.fazendas.find((r) => r.fazenda === fz && String(r.up) === String(up)); return t ? t.area : null; };
  const atividadeDe = (nome) => (S.base.atividades || []).find((x) => igual(x.atividade, nome)) || null;

  // ---------- Lançamentos (servidor + fila do aparelho) ----------
  async function carregarDados() {
    if (!S.sb || !navigator.onLine || !S.user) return false;
    try {
      const r = await rpc('pgo_meus_registros', { p_desde: diasAtras(S.janela) });
      S.regs = Array.isArray(r) ? r : [];
      gravar('pgo.regs.' + S.user.id, S.regs);
      return true;
    } catch (e) { if (!redeErro(e)) console.warn(e); return false; }
  }
  async function carregarValores() {
    if (!S.sb || !navigator.onLine || !S.user) return false;
    try { S.valores = (await rpc('pgo_valores')) || {}; gravar('pgo.valores.' + S.user.cdc, S.valores); return true; }
    catch (e) { if (!redeErro(e)) console.warn(e); return false; }
  }
  // junta o que já está no servidor com o que ainda está na fila
  function visao() {
    const v = S.regs.map((r) => Object.assign({}, r));
    for (const it of fila()) {
      const p = Object.assign({}, it.dados, { _fila: true, _erro: it.erro || null, criado_em: it.dados.criado_em || it.criado });
      const k = v.findIndex((x) => x.id === p.id);
      if (k >= 0) v[k] = p; else v.push(p);
    }
    return v.sort((a, b) => (dia10(b.data).localeCompare(dia10(a.data))) || String(a.criado_em).localeCompare(String(b.criado_em)));
  }
  const registro = (id) => visao().find((x) => x.id === id) || null;

  async function enviarFotos(fotos) {
    for (const f of fotos || []) {
      const blob = await IDB.get(f.path); if (!blob) continue;
      const { error } = await S.sb.storage.from(BUCKET).upload(f.path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error && !/already exists|duplicate|409/i.test((error.message || '') + ' ' + (error.statusCode || error.error || ''))) throw error;
      await IDB.del(f.path);
    }
  }
  async function apagarArquivos(paths) {
    paths = (paths || []).filter(Boolean); if (!paths.length) return;
    for (const p of paths) await IDB.del(p);
    try { if (navigator.onLine) await S.sb.storage.from(BUCKET).remove(paths); } catch (_) {}
  }
  async function enviarFila(silencioso) {
    if (S.enviando || !S.sb || !navigator.onLine || !S.user) { barra(); return; }
    S.enviando = true; barra();
    try {
      await sessao();
      for (const it of fila()) {
        if (it.erro) continue;
        try {
          await enviarFotos(it.dados.fotos);
          const dados = Object.assign({}, it.dados); delete dados.criado_em;
          await rpc('pgo_salvar_registro', { p: dados });
          salvarFila(fila().filter((x) => x.dados.id !== it.dados.id));
          apagarArquivos(it.remover);
        } catch (e) {
          if (redeErro(e)) break;
          if (/Faça login novamente|sessão|JWT/i.test(e.message || '')) break;
          salvarFila(fila().map((x) => (x.dados.id === it.dados.id ? Object.assign({}, x, { erro: msgErro(e) }) : x)));
          if (!silencioso) toast('Um lançamento foi recusado: ' + msgErro(e), 'erro', 9000);
        }
      }
      await carregarDados();
    } catch (e) { if (!redeErro(e)) console.warn(e); }
    finally { S.enviando = false; barra(); if (rotaAtual() === 'home' || rotaAtual() === 'registros') render(); }
  }
  window.addEventListener('online', () => { barra(); enviarFila(); });
  window.addEventListener('offline', barra);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user) enviarFila(); });

  // =========================================================
  //   Login e cadastro
  // =========================================================
  function telaLogin(msg) {
    const lembrado = ler('pgo.ultimo_nome', '');
    app().innerHTML = `<div class="auth"><div class="auth-box">
      <a class="menu-link" href="../APP-menu/">${ic('voltar', 18)} Menu dos apps</a>
      <div class="auth-brand"><span class="tag big">PGO Digital</span><p class="muted">Apontamento de produção</p></div>
      <form class="auth-card" id="f-login" novalidate>
        <div><h1>Entrar</h1><p class="muted">Use o seu nome e a sua senha.</p></div>
        ${msg ? `<div class="alert alert-warn">${h(msg)}</div>` : ''}
        <div class="field"><label for="l-nome">Nome</label><input id="l-nome" class="input" autocomplete="username" value="${h(lembrado)}" placeholder="Seu nome"></div>
        <div class="field"><label for="l-senha">Senha</label><div class="senha"><input id="l-senha" class="input" type="password" autocomplete="current-password">
          <button type="button" class="icon-btn" id="l-olho" aria-label="Mostrar senha">${ic('olho', 20)}</button></div></div>
        <p class="form-error" id="l-err" role="alert"></p>
        <button class="btn btn-block" id="l-btn">Entrar</button>
        <p class="centro">Primeiro acesso? <button type="button" class="linklike" id="l-novo">Criar cadastro</button></p>
      </form></div></div>`;
    $('#l-olho').onclick = () => { const i = $('#l-senha'); i.type = i.type === 'password' ? 'text' : 'password'; };
    $('#l-novo').onclick = () => telaCadastro();
    (lembrado ? $('#l-senha') : $('#l-nome')).focus();
    $('#f-login').onsubmit = async (e) => {
      e.preventDefault();
      const nome = $('#l-nome').value.trim(), senha = $('#l-senha').value, err = $('#l-err'); err.textContent = '';
      if (nome.length < 2) return (err.textContent = 'Informe o seu nome.');
      if (!senha) return (err.textContent = 'Informe a senha.');
      if (!navigator.onLine) return (err.textContent = 'Para entrar a primeira vez neste aparelho é preciso internet.');
      const bt = $('#l-btn'); bt.disabled = true; bt.textContent = 'Entrando…';
      try { await sessao(); const u = await rpc('pgo_entrar', { p_nome: nome, p_senha: senha }); entrou(u); }
      catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; bt.textContent = 'Entrar'; }
    };
  }
  async function telaCadastro() {
    if (!S.base.equipes.length) await carregarBase();
    const lista = cdcs();
    app().innerHTML = `<div class="auth"><div class="auth-box">
      <div class="auth-brand"><span class="tag big">PGO Digital</span></div>
      <form class="auth-card" id="f-cad" novalidate>
        <div><h1>Criar cadastro</h1><p class="muted">Você vai entrar sempre com este nome e esta senha.</p></div>
        <div class="field"><label for="c-nome">Nome</label><input id="c-nome" class="input" autocomplete="name" placeholder="Nome e sobrenome"></div>
        <div class="field"><label for="c-cdc">CDC</label><select id="c-cdc" class="input"><option value="">Selecione</option>${lista.map((c) => `<option>${h(c)}</option>`).join('')}</select>
          ${lista.length ? '' : '<span class="hint">Não consegui ler a planilha de equipes. Confira a internet.</span>'}</div>
        <div class="field"><label for="c-senha">Senha</label><input id="c-senha" class="input" type="password" autocomplete="new-password" placeholder="Pelo menos 4 caracteres"></div>
        <div class="field"><label for="c-senha2">Repita a senha</label><input id="c-senha2" class="input" type="password" autocomplete="new-password"></div>
        <p class="form-error" id="c-err" role="alert"></p>
        <button class="btn btn-block" id="c-btn">Criar cadastro e entrar</button>
        <p class="centro"><button type="button" class="linklike" id="c-voltar">Já tenho cadastro</button></p>
      </form></div></div>`;
    $('#c-voltar').onclick = () => telaLogin();
    $('#c-nome').focus();
    $('#f-cad').onsubmit = async (e) => {
      e.preventDefault();
      const nome = $('#c-nome').value.trim().replace(/\s+/g, ' '), cdc = $('#c-cdc').value, s1 = $('#c-senha').value, s2 = $('#c-senha2').value, err = $('#c-err'); err.textContent = '';
      if (nome.length < 2) return (err.textContent = 'Informe o seu nome.');
      if (!cdc) return (err.textContent = 'Escolha o seu CDC.');
      if (s1.length < 4) return (err.textContent = 'A senha precisa ter pelo menos 4 caracteres.');
      if (s1 !== s2) return (err.textContent = 'As duas senhas não são iguais.');
      const bt = $('#c-btn'); bt.disabled = true; bt.textContent = 'Criando…';
      try { await sessao(); const u = await rpc('pgo_cadastrar', { p_nome: nome, p_cdc: cdc, p_senha: s1 }); toast('Cadastro criado. Bem-vindo!', 'in'); entrou(u); }
      catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; bt.textContent = 'Criar cadastro e entrar'; }
    };
  }
  function carregarDoAparelho() {
    S.regs = ler('pgo.regs.' + S.user.id, []);
    S.valores = ler('pgo.valores.' + S.user.cdc, {});
  }
  function entrou(u) {
    S.user = u; gravar('pgo.usuario', u); gravar('pgo.ultimo_nome', u.nome);
    carregarDoAparelho();
    shell(); location.hash = '#/home'; render(true);
    Promise.all([carregarDados(), carregarValores()]).then(() => render());
    enviarFila();
  }
  async function sair() {
    const n = fila().filter((x) => !x.erro).length;
    if (n) { toast(`Há ${n} lançamento(s) esperando internet. Conecte-se para enviar antes de sair.`, 'erro', 8000); return; }
    if (!(await confirmar('Sair do PGO Digital?', 'No próximo acesso, entre com o seu nome e senha.', 'Sair'))) return;
    try { if (navigator.onLine) await rpc('pgo_sair'); } catch (_) {}
    try { await S.sb.auth.signOut(); } catch (_) {}
    try { localStorage.removeItem('pgo.usuario'); localStorage.removeItem('pgo.regs.' + S.user.id); } catch (_) {}
    S.user = null; S.regs = []; S.valores = {};
    location.hash = ''; telaLogin();
  }

  // =========================================================
  //   Estrutura e rotas
  // =========================================================
  const ROTAS = { home: 1, apontamento: 1, diarias: 1, paradas: 1, valores: 1, registros: 1 };
  function shell() {
    app().innerHTML = `
      <header class="topbar"><a class="menu-btn" href="../APP-menu/" aria-label="Voltar ao menu dos apps" title="Menu dos apps">${ic('menu', 18)}<span>Menu</span></a>
        <div class="brand"><span class="tag">PGO Digital</span></div>
        <div class="spacer"></div>
        <span class="net" id="net" hidden></span>
        <a class="btn btn-ghost btn-sm top-val" href="#/valores" title="Valores por hora e tarifas">${ic('valor', 18)}<span>Valores</span></a>
        <button class="icon-btn" id="b-sair" title="Sair" aria-label="Sair">${ic('sair', 20)}</button></header>
      <main class="view" id="view" tabindex="-1"></main>`;
    $('#b-sair').onclick = sair;
    barra();
  }
  function barra() {
    const n = $('#net'); if (!n || !S.user) return;
    const f = fila(); const pend = f.filter((x) => !x.erro).length, erro = f.length - pend;
    if (!navigator.onLine) { n.hidden = false; n.className = 'net'; n.textContent = pend ? `Sem internet · ${pend}` : 'Sem internet'; n.title = pend ? `${pend} lançamento(s) esperando internet` : ''; }
    else if (S.enviando && pend) { n.hidden = false; n.className = 'net ok'; n.textContent = 'Enviando…'; }
    else if (pend || erro) { n.hidden = false; n.className = 'net'; n.textContent = erro ? `${erro} com erro` : `${pend} na fila`; }
    else n.hidden = true;
  }
  const rotaAtual = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROTAS[r] ? r : 'home'; };
  const paramRota = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
  window.addEventListener('hashchange', () => render(true));
  window.addEventListener('beforeunload', (e) => { if ($('form[data-sujo="1"]')) { e.preventDefault(); e.returnValue = ''; } });

  function render(trocou) {
    if (!S.user || !$('#view')) return;
    const r = rotaAtual(); const view = $('#view'); const chave = location.hash;
    if (!trocou && view.dataset.rota === chave && $('form[data-sujo="1"]', view)) return;   // não apaga o que está sendo digitado
    if (!trocou && r !== 'home' && r !== 'registros' && view.dataset.rota === chave) return;                  // formulários só redesenham ao entrar
    const mudou = view.dataset.rota !== chave; view.dataset.rota = chave;
    ({ home: vHome, apontamento: vApontamento, diarias: vDiarias, paradas: vParadas, valores: vValores, registros: vRegistros })[r](view);
    if (mudou) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  }
  const cabecalho = (titulo, sub) => `<div class="sub-head"><a class="btn btn-ghost btn-sm" href="#/home">${ic('voltar', 18)} Início</a></div>
    <div class="page-head"><div><h1>${h(titulo)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;

  // =========================================================
  //   Cálculos (faturamento, horas, insumos) por equipe e dia
  // =========================================================
  const sinal = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + brl(Math.abs(v));
  const daMeta = (v, meta) => (meta ? (v / meta * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% da meta' : '');
  const valorHora = (rec) => { const v = S.valores[rec]; return v && v.valor != null && v.valor !== '' ? Number(v.valor) : null; };
  const SEM_EQUIPE = 'Sem equipe';
  const equipeDe = (r) => r.equipe || SEM_EQUIPE;
  // meta da equipe: coluna METAS da planilha de equipes
  function metaEquipe(eq) {
    if (!eq) return null;
    const l = S.base.equipes || [];
    const e = l.find((x) => igual(x.equipe, eq) && (!x.cdc || !S.user || igual(x.cdc, S.user.cdc))) || l.find((x) => igual(x.equipe, eq));
    return e && e.meta > 0 ? e.meta : null;
  }
  // meta do grupo (dia + equipe): a gravada no lançamento; se não houver, a atual da planilha
  function metaGrupo(regs) {
    const ord = regs.slice().sort((a, b) => (b.tipo === 'apontamento') - (a.tipo === 'apontamento'));
    const r = ord.find((x) => x.meta != null && x.meta !== '' && Number(x.meta) > 0);
    return r ? Number(r.meta) : metaEquipe((regs[0] || {}).equipe);
  }
  function calcular(regs, meta) {
    const atv = [], dia = [], par = [], ins = {}, equipes = [];
    for (const r of regs) {
      for (const a of r.atividades || []) {
        const ref = atividadeDe(a.atividade);
        const tarifa = a.tarifa != null && a.tarifa !== '' ? Number(a.tarifa) : (ref ? ref.tarifa : null);
        const q = Number(a.hectares) || 0;
        atv.push(Object.assign({}, a, { reg: r, tarifa, q, un: unidade(a.atividade), valor: tarifa != null ? tarifa * q : null }));
        for (const i of a.insumos || []) ins[i.insumo] = (ins[i.insumo] || 0) + (Number(i.quantidade) || 0);
      }
      for (const d of r.diarias || []) {
        const qt = Number(d.quantidade) || 1, mb = minutos(d.hora_inicio, d.hora_fim), ml = minLiquidos(d.hora_inicio, d.hora_fim), vh = valorHora(d.recurso);
        dia.push(Object.assign({}, d, { reg: r, qt, mb, ml, horas: ml / 60 * qt, vh, valor: vh != null ? vh * ml / 60 * qt : null }));
      }
      for (const p of r.paradas || []) {
        const qt = Number(p.quantidade) || 1, mb = minutos(p.hora_inicio, p.hora_fim), ml = mb, vh = valorHora(p.recurso);   // parada: tempo de relógio (sem desconto de almoço)
        par.push(Object.assign({}, p, { reg: r, qt, mb, ml, horas: ml / 60 * qt, vh, valor: vh != null ? vh * ml / 60 * qt : null }));
      }
      if (r.tipo === 'apontamento') equipes.push(r);
    }
    const soma = (l, k) => l.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const sem = soma(atv, 'valor'), vd = soma(dia, 'valor');
    const porChave = (l, k) => { const o = {}; l.forEach((x) => { const c = x[k] || '—'; o[c] = o[c] || { horas: 0, valor: 0, n: 0, min: 0 }; o[c].horas += x.horas; o[c].valor += Number(x.valor) || 0; o[c].n += x.qt; o[c].min += x.mb; }); return o; };
    meta = meta > 0 ? meta : null;
    return {
      atv, dia, par, ins, equipes, sem, vd, com: sem + vd, meta,
      dCom: meta != null ? sem + vd - meta : null, dSem: meta != null ? sem - meta : null,
      ha: soma(atv.filter((a) => a.un === 'ha'), 'q'), hAtv: soma(atv.filter((a) => a.un === 'h'), 'q'),
      hDia: soma(dia, 'horas'), hPar: soma(par, 'horas'), impacto: soma(par, 'valor'),
      diaPorRec: porChave(dia, 'recurso'), parPorMot: porChave(par, 'motivo'), parPorRec: porChave(par, 'recurso'),
      faltaValor: [...new Set(dia.filter((d) => d.vh == null).map((d) => d.recurso))],
      faltaValorPar: [...new Set(par.filter((d) => d.vh == null).map((d) => d.recurso))],
      semTarifa: [...new Set(atv.filter((a) => a.tarifa == null).map((a) => a.atividade))],
    };
  }
  // agrupa os lançamentos por dia e equipe
  function grupos(lista) {
    const m = new Map();
    for (const r of lista) {
      const k = dia10(r.data) + '|' + equipeDe(r);
      if (!m.has(k)) m.set(k, { chave: k, d: dia10(r.data), equipe: equipeDe(r), regs: [] });
      m.get(k).regs.push(r);
    }
    return [...m.values()].sort((a, b) => b.d.localeCompare(a.d) || (a.equipe === SEM_EQUIPE) - (b.equipe === SEM_EQUIPE) || a.equipe.localeCompare(b.equipe, 'pt-BR', { numeric: true }));
  }
  const grupo = (chave) => grupos(visao()).find((g) => g.chave === chave) || null;
  const tipoEquipe = (g) => (g.regs.find((r) => r.equipe_tipo) || {}).equipe_tipo || (equipes().find((e) => e.equipe === g.equipe) || {}).tipo || '';
  const fotosEquipe = (regs) => regs.flatMap((r) => (r.fotos || []).filter((f) => f.tipo === 'equipe'));
  const TIPO = { apontamento: 'Apontamento', diarias: 'Diárias', paradas: 'Horas paradas' };
  const ICONE = { apontamento: 'apont', diarias: 'diaria', paradas: 'parada' };
  function tituloReg(r) {
    if (r.tipo === 'apontamento') return 'Apontamento';
    if (r.tipo === 'diarias') return (r.diarias || []).length === 1 ? 'Diária' : `${(r.diarias || []).length} diárias`;
    return (r.paradas || []).length === 1 ? 'Hora parada' : `${(r.paradas || []).length} horas paradas`;
  }
  function resumoReg(r) {
    const c = calcular([r]); const p = [];
    if (c.atv.length) p.push(plural(c.atv.length, 'atividade', 'atividades') + (c.ha ? ` · ${num(c.ha)} ha` : ''));
    if (r.tipo === 'diarias') p.push(...Object.entries(c.diaPorRec).map(([k, v]) => `${k} · ${horasTxt(v.horas)}`));
    else if (c.dia.length) p.push(`${plural(c.dia.length, 'diária', 'diárias')} · ${horasTxt(c.hDia)}`);
    if (r.tipo === 'paradas') p.push(...Object.entries(c.parPorMot).map(([k, v]) => `${k} · ${duracao(v.min)}`));
    else if (c.par.length) p.push(`${plural(c.par.length, 'parada', 'paradas')} · ${duracao(c.par.reduce((s, x) => s + x.mb, 0))}`);
    if (fotosEquipe([r]).length) p.push('foto da equipe');
    return p.join(' · ');
  }
  const textoBusca = (r) => [equipeDe(r), TIPO[r.tipo], r.observacao, ...(r.atividades || []).flatMap((a) => [a.atividade, a.fazenda, 'up ' + a.up, a.situacao, ...(a.insumos || []).map((i) => i.insumo)]),
    ...(r.diarias || []).flatMap((d) => [d.diaria, d.recurso, d.fazenda, 'up ' + d.up]), ...(r.paradas || []).flatMap((p) => [p.motivo, p.recurso, p.fazenda, 'up ' + p.up])].join(' ');
  const etiquetaFila = (x) => (x._erro ? '<span class="st erro">Recusado</span>' : x._fila ? `<span class="st fila">${ic('nuvem', 14)} Na fila</span>` : '');
  const paraEnvio = (r) => { const d = clonar(r); ['_fila', '_erro', 'usuario_id', 'cdc', 'atualizado_em'].forEach((k) => delete d[k]); return d; };

  // =========================================================
  //   Início: grade 2×2 + últimos lançamentos (por dia e equipe)
  // =========================================================
  function vHome(view) {
    const v = visao(); const comErro = fila().filter((x) => x.erro).length;
    const gs = grupos(v); const dias = [...new Set(gs.map((g) => g.d))];
    const mostrar = dias.slice(0, S.nDias);
    view.innerHTML = `
      <div class="ola"><p class="muted">${h(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</p>
        <h1>Olá, ${h(S.user.nome.split(' ')[0])}</h1><p class="muted">${h(S.user.cdc)}</p></div>
      ${comErro ? `<p class="alert alert-erro">${comErro} lançamento(s) recusado(s) pelo servidor. Abra o lançamento marcado como "Recusado" para corrigir.</p>` : ''}
      <nav class="grade" aria-label="Menu do PGO">
        <a class="tile t1" href="#/apontamento"><span class="ico">${ic('apont', 28)}</span><b>Apontamento</b><small>Atividades, diárias, insumos e paradas</small></a>
        <a class="tile t2" href="#/diarias"><span class="ico">${ic('diaria', 28)}</span><b>Diárias</b><small>Uma ou várias, com horário</small></a>
        <a class="tile t3" href="#/paradas"><span class="ico">${ic('parada', 28)}</span><b>Horas paradas</b><small>Motivo, tipo e horário</small></a>
        <a class="tile t4" href="#/registros"><span class="ico">${ic('lista', 28)}</span><b>Meus registros</b><small>Histórico, editar e excluir</small></a>
      </nav>
      ${S.base.em ? '' : '<p class="alert alert-warn">Ainda não consegui ler as planilhas de equipes, fazendas, insumos e atividades. Conecte-se à internet.</p>'}
      <div class="sec-tit"><h2>Últimos lançamentos</h2>${v.length ? '<a class="btn btn-ghost btn-sm" href="#/registros">Ver todos</a>' : ''}</div>
      ${mostrar.length ? mostrar.map((d) => blocoDia(d, gs.filter((g) => g.d === d))).join('')
        : '<div class="empty"><strong>Nenhum lançamento ainda</strong>Use os botões acima para lançar o seu primeiro apontamento.</div>'}
      ${dias.length > S.nDias ? '<button class="btn btn-ghost btn-block mais" id="mais-dias">Mostrar mais dias</button>' : ''}`;
    ligarCartoes(view);
    const mais = $('#mais-dias', view); if (mais) mais.onclick = () => { S.nDias += 3; render(true); };
  }
  const blocoDia = (d, gs) => `<section class="dia-bloco"><h3 class="dia-tit">${dataBR(d)} <span>${diaSemana(d)}</span>${d === hoje() ? '<em class="hj">Hoje</em>' : ''}</h3>
    ${gs.map(cartaoEquipe).join('')}</section>`;
  function cartaoEquipe(g) {
    const meta = metaGrupo(g.regs); const c = calcular(g.regs, meta); const fotoEq = fotosEquipe(g.regs)[0];
    const alertas = [];
    if (c.faltaValor.length) alertas.push(`<a href="#/valores">Cadastre o valor/hora de ${h(c.faltaValor.join(', '))}</a> para calcular as diárias.`);
    if (c.semTarifa.length) alertas.push(`Sem tarifa na planilha: ${h(c.semTarifa.join(', '))}.`);
    if (meta == null && g.equipe !== SEM_EQUIPE && (c.atv.length || c.dia.length)) alertas.push('Equipe sem meta na planilha de equipes (coluna METAS).');
    const prod = [c.ha ? `<b>${num(c.ha)}</b> ha` : '', c.hAtv ? `<b>${num(c.hAtv)}</b> h` : '', c.dia.length ? `<b>${horasTxt(c.hDia)}</b> diárias` : '', c.par.length ? `<b>${horasTxt(c.hPar)}</b> paradas` : ''].filter(Boolean);
    const caixa = (rot, val, delta) => `<div class="${delta == null ? '' : delta >= 0 ? 'pos' : 'neg'}"><span>${rot}</span><b>${brl(val)}</b>${delta != null ? `<small class="dl">Δ ${sinal(delta)}</small>` : ''}</div>`;
    return `<article class="eq-card">
      <header class="ec-head">
        ${fotoEq ? `<button class="ec-foto" data-ver="${h(fotoEq.path)}" aria-label="Ver foto da equipe"><img alt="" data-path="${h(fotoEq.path)}"></button>` : `<span class="ec-foto vazio" aria-hidden="true">${ic('equipe', 22)}</span>`}
        <div class="ec-tit"><h4>${h(g.equipe)}</h4><p>${[h(tipoEquipe(g)), prod.join(' · ')].filter(Boolean).join(' · ') || 'Sem produção lançada'}</p></div></header>
      ${c.atv.length || c.dia.length || meta != null ? `<div class="fat">
        <div class="meta"><span>Meta</span><b>${meta != null ? brl(meta) : '—'}</b></div>
        ${caixa('Com diárias', c.com, c.dCom)}${caixa('Sem diárias', c.sem, c.dSem)}
      </div>` : ''}
      ${alertas.length ? `<p class="dc-alerta">${alertas.join('<br>')}</p>` : ''}
      <div class="dc-lista">${g.regs.map((r) => itemReg(r, false)).join('')}</div>
      <footer class="dc-acoes"><button class="btn btn-ghost btn-sm" data-pdf="${h(g.chave)}">${ic('pdf', 18)} Gerar PDF</button>
        <button class="btn btn-ghost btn-sm" data-whats="${h(g.chave)}">${ic('whats', 18)} WhatsApp</button></footer>
    </article>`;
  }
  const itemReg = (r, comEquipe) => `<div class="dc-item">
      <button class="dc-abrir" data-reg="${h(r.id)}"><span class="dc-ico t-${r.tipo}">${ic(ICONE[r.tipo], 18)}</span>
        <span class="dc-txt"><span class="l-top"><b>${comEquipe ? h(equipeDe(r)) + ' · ' : ''}${h(tituloReg(r))}</b>${etiquetaFila(r)}</span><small>${h(resumoReg(r) || TIPO[r.tipo])}</small></span></button>
      <span class="dc-bts">${r.tipo === 'apontamento' ? `<label class="icon-btn dc-bt" title="Adicionar foto da equipe"><span class="sr-only">Adicionar foto da equipe</span>${ic('camera', 19)}<input type="file" accept="image/*" class="sr-only" data-foto-eq="${h(r.id)}"></label>` : ''}
        <button class="icon-btn dc-bt" data-editar="${h(r.id)}" aria-label="Editar" title="Editar">${ic('editar', 19)}</button>
        <button class="icon-btn dc-bt del" data-excluir="${h(r.id)}" aria-label="Excluir" title="Excluir">${ic('lixo', 19)}</button></span>
    </div>`;
  function ligarCartoes(raiz) {
    hidratarFotos(raiz);
    $$('[data-reg]', raiz).forEach((b) => (b.onclick = () => detalhe(b.dataset.reg)));
    $$('[data-editar]', raiz).forEach((b) => (b.onclick = () => editar(b.dataset.editar)));
    $$('[data-excluir]', raiz).forEach((b) => (b.onclick = async () => { const x = registro(b.dataset.excluir); if (x && (await excluirRegistro(x))) render(true); }));
    $$('[data-foto-eq]', raiz).forEach((i) => (i.onchange = (e) => { const a = e.target.files && e.target.files[0]; e.target.value = ''; if (a) fotoEquipeRapida(i.dataset.fotoEq, a); }));
    $$('[data-ver]', raiz).forEach((b) => (b.onclick = () => verFoto(b.dataset.ver)));
    $$('[data-pdf]', raiz).forEach((b) => (b.onclick = () => gerarPDF(b.dataset.pdf)));
    $$('[data-whats]', raiz).forEach((b) => (b.onclick = () => compartilhar(b.dataset.whats)));
  }
  function editar(id) {
    const r = registro(id); if (!r) return;
    location.hash = `#/${r.tipo}?id=${encodeURIComponent(id)}`;
  }
  // Foto da equipe direto do cartão (sem abrir o apontamento)
  async function fotoEquipeRapida(id, arq) {
    const r = registro(id); if (!r) return;
    try {
      const blob = await reduzirFoto(arq); const path = `${S.user.id}/${uuid()}.jpg`;
      await IDB.put(path, blob);
      const dados = paraEnvio(r);
      dados.fotos = [...(r.fotos || []).map((f) => ({ path: f.path, tipo: f.tipo })), { path, tipo: 'equipe' }];
      dados.criado_em = r.criado_em || new Date().toISOString();
      const anterior = fila().find((x) => x.dados.id === id);
      salvarFila([...fila().filter((x) => x.dados.id !== id), { dados, remover: (anterior && anterior.remover) || [], criado: dados.criado_em }]);
      barra(); render(true);
      toast(navigator.onLine ? 'Foto da equipe adicionada.' : 'Foto guardada no aparelho; vai ser enviada quando houver internet.', 'in');
      await enviarFila(true);
      const it = fila().find((x) => x.dados.id === id);
      if (it && it.erro) toast('A foto não foi salva: ' + it.erro, 'erro', 9000);
    } catch (e) { toast(msgErro(e), 'erro'); }
  }
  async function excluirRegistro(x) {
    if (!(await confirmar('Excluir este lançamento?', `${h(equipeDe(x))} · ${h(tituloReg(x))} de ${dataBR(x.data)}. Não dá para desfazer; as fotos dele também são apagadas.`, 'Excluir', true))) return false;
    const noServidor = S.regs.some((y) => y.id === x.id);
    if (noServidor && !navigator.onLine) { toast('Para excluir um lançamento já enviado é preciso internet.', 'erro'); return false; }
    try {
      if (noServidor) { await sessao(); await rpc('pgo_excluir_registro', { p_id: x.id }); }
      const item = fila().find((y) => y.dados.id === x.id);
      salvarFila(fila().filter((y) => y.dados.id !== x.id));
      apagarArquivos([...(x.fotos || []).map((f) => f.path), ...((item && item.remover) || [])]);
      S.regs = S.regs.filter((y) => y.id !== x.id); gravar('pgo.regs.' + S.user.id, S.regs);
      barra(); toast('Lançamento excluído.');
      return true;
    } catch (e) { toast(msgErro(e), 'erro'); return false; }
  }

  // =========================================================
  //   Meus registros (histórico com filtros)
  // =========================================================
  const PERIODOS = [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Último ano'], ['tudo', 'Tudo']];
  function vRegistros(view) {
    const F = S.filtro; const dias = F.periodo === 'tudo' ? 36500 : Number(F.periodo);
    if (dias > S.janela && navigator.onLine && !F.buscando) {
      S.janela = dias; F.buscando = true;
      carregarDados().finally(() => { F.buscando = false; if (rotaAtual() === 'registros') render(true); });
    }
    const desde = diasAtras(dias - 1); const q = semAcento(F.busca).trim();
    const todas = visao();
    const lista = todas.filter((r) => dia10(r.data) >= desde && (!F.equipe || equipeDe(r) === F.equipe) && (!F.tipo || r.tipo === F.tipo)
      && (!q || q.split(/\s+/).every((t) => semAcento(textoBusca(r)).includes(t))));
    const eqs = [...new Set(todas.map(equipeDe))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    let com = 0, comM = 0, ha = 0, meta = 0, nMeta = 0;
    grupos(lista).forEach((g) => { const m = metaGrupo(g.regs); const c = calcular(g.regs, m); com += c.com; ha += c.ha; if (m != null) { meta += m; comM += c.com; nMeta++; } });
    const dl = nMeta ? comM - meta : null;
    const porDia = [...new Set(lista.map((r) => dia10(r.data)))];
    const ABAS = [['', 'Todos'], ['apontamento', 'Apontamentos'], ['diarias', 'Diárias'], ['paradas', 'Horas paradas']];
    view.innerHTML = cabecalho('Meus registros', 'Tudo o que você lançou. Toque para ver; use o lápis para editar e a lixeira para excluir.') + `
      <div class="tools"><div class="search">${ic('search', 20)}<input type="search" class="input" id="rq" placeholder="Pesquisar atividade, fazenda, UP, motivo…" value="${h(F.busca)}" aria-label="Pesquisar"></div></div>
      <div class="tools"><select class="input" id="rp" aria-label="Período">${PERIODOS.map(([k, t]) => `<option value="${k}" ${F.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select class="input" id="re" aria-label="Equipe"><option value="">Todas as equipes</option>${eqs.map((e) => `<option ${F.equipe === e ? 'selected' : ''}>${h(e)}</option>`).join('')}</select></div>
      <div class="filtros" role="group" aria-label="Tipo">${ABAS.map(([k, t]) => `<button class="chip" data-tipo="${k}" aria-pressed="${F.tipo === k}">${t}</button>`).join('')}</div>
      <section class="resumo-reg" aria-label="Resumo do período">
        <div><span>Lançamentos</span><b>${lista.length}</b></div>
        <div><span>Produção</span><b>${num(ha)} ha</b></div>
        <div><span>Faturamento c/ diárias</span><b>${brl(com)}</b></div>
        <div><span>Meta</span><b>${nMeta ? brl(meta) : '—'}</b></div>
        <div class="${dl == null ? '' : dl >= 0 ? 'pos' : 'neg'}"><span>Δ da meta</span><b>${dl == null ? '—' : sinal(dl)}</b></div>
      </section>
      ${F.buscando ? '<p class="muted small">Buscando lançamentos mais antigos…</p>' : ''}
      <div id="rl">${porDia.length ? porDia.map((d) => `<section class="dia"><h3 class="dia-tit">${dataBR(d)} <span>${diaSemana(d)}</span></h3>
        <div class="dc-lista solta">${lista.filter((r) => dia10(r.data) === d).map((r) => itemReg(r, true)).join('')}</div></section>`).join('')
        : `<div class="empty"><strong>Nada por aqui</strong>${q || F.equipe || F.tipo ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste período.'}</div>`}</div>`;
    ligarCartoes(view);
    $('#rp', view).onchange = (e) => { F.periodo = e.target.value; render(true); };
    $('#re', view).onchange = (e) => { F.equipe = e.target.value; render(true); };
    $$('[data-tipo]', view).forEach((b) => (b.onclick = () => { F.tipo = b.dataset.tipo; render(true); }));
    $('#rq', view).oninput = (e) => { F.busca = e.target.value; clearTimeout(vRegistros.t); vRegistros.t = setTimeout(() => { render(true); const i = $('#rq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); };
  }

  // Detalhe de um lançamento
  function detalhe(id) {
    const x = registro(id); if (!x) return;
    const linha = (r, val) => (val == null || val === '' ? '' : `<div><dt>${h(r)}</dt><dd>${val}</dd></div>`);
    const c = calcular([x]);
    const estr = x.tipo !== 'apontamento' ? '' : (x.equipe_tipo === 'Mecanizado'
      ? [['trator_medio', 'trator médio'], ['trator_pesado', 'trator pesado'], ['caminhao', 'caminhão'], ['drone', 'drone']].filter(([k]) => x[k]).map(([k, t]) => `${x[k]} ${t}`).join(' · ')
      : (x.colaboradores ? `${x.colaboradores} colaboradores · ${Math.max(0, x.colaboradores - (x.faltas || 0) - (x.ferias || 0))} presentes${x.faltas ? ` · ${x.faltas} falta(s)` : ''}${x.ferias ? ` · ${x.ferias} férias` : ''}` : ''));
    const atvs = c.atv.map((a) => `<li><b>${h(a.atividade)}</b>${a.situacao ? ` <span class="sit ${a.situacao === 'Finalizado' ? 'fin' : ''}">${h(a.situacao)}</span>` : ''}<br>${h(a.fazenda)} · UP ${h(a.up)} · <b>${num(a.q)} ${a.un}</b>${a.tarifa != null ? ` · ${brl(a.tarifa)}/${a.un} = <b>${brl(a.valor)}</b>` : ''}
      ${(a.insumos || []).length ? `<br><small>Insumos: ${a.insumos.map((i) => `${h(i.insumo)} ${num(i.quantidade, 3)}`).join(' · ')}</small>` : ''}</li>`).join('');
    const dias = c.dia.map((d) => `<li><b>${h(d.recurso)}${d.qt > 1 ? ' × ' + d.qt : ''}</b> · ${h(d.diaria)}<br>${hhmm(d.hora_inicio)}–${hhmm(d.hora_fim)} · ${duracao(d.ml)}${d.ml !== d.mb ? ' (desc. almoço)' : ''} · ${h(d.fazenda)} UP ${h(d.up)}${d.valor != null ? ` · <b>${brl(d.valor)}</b>` : ''}</li>`).join('');
    const pars = c.par.map((p) => `<li><b>${h(p.recurso)}${p.qt > 1 ? ' × ' + p.qt : ''}</b> · ${h(p.motivo)}<br>${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)} · ${duracao(p.mb)} · ${h(p.fazenda)} UP ${h(p.up)}</li>`).join('');
    const fotos = (x.fotos || []);
    const d = dialogo(`<div class="dlg"><div class="dlg-head"><h2>${h(TIPO[x.tipo])} · ${dataBR(x.data)}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      ${x._erro ? `<div class="alert alert-erro">O servidor recusou este lançamento: ${h(x._erro)}<br>Toque em Editar para corrigir.</div>` : x._fila ? '<div class="alert alert-warn">Ainda não foi enviado: será enviado quando houver internet.</div>' : ''}
      <dl class="det">${linha('Equipe', h(equipeDe(x)) + (x.equipe_tipo ? ` <small>(${h(x.equipe_tipo)})</small>` : ''))}${linha('Estrutura', h(estr))}
        ${linha('Atividades', atvs ? `<ul class="det-l">${atvs}</ul>` : '')}${linha('Diárias', dias ? `<ul class="det-l">${dias}</ul>` : '')}
        ${linha('Horas paradas', pars ? `<ul class="det-l">${pars}</ul>` : '')}${linha('Observação', h(x.observacao))}
        ${linha('Fotos', fotos.length ? `<div class="fotos mini">${fotos.map((f) => `<button class="foto" data-ver="${h(f.path)}" title="${f.tipo === 'equipe' ? 'Foto da equipe' : 'Foto da observação'}"><img alt="" data-path="${h(f.path)}"><span>${f.tipo === 'equipe' ? 'Equipe' : 'Obs.'}</span></button>`).join('')}</div>` : '')}</dl>
      <div class="dlg-foot"><button class="btn btn-ghost btn-perigo-txt" data-del>${ic('lixo', 18)} Excluir</button>
        <button class="btn" data-ed>${ic('editar', 18)} Editar</button></div></div>`);
    hidratarFotos(d);
    $('[data-x]', d).onclick = () => d.close();
    $$('[data-ver]', d).forEach((b) => (b.onclick = () => verFoto(b.dataset.ver)));
    $('[data-ed]', d).onclick = () => { d.close(); editar(x.id); };
    $('[data-del]', d).onclick = async () => { if (await excluirRegistro(x)) { d.close(); render(true); } };
  }

  // =========================================================
  //   Componentes de formulário
  // =========================================================
  function escolher(titulo, itens, atual) {   // itens: [{v, t, sub}]
    return new Promise((res) => {
      const d = dialogo(`<div class="dlg escolha"><div class="dlg-head"><h2>${h(titulo)}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
        <div class="search">${ic('search', 20)}<input type="search" class="input" id="e-q" placeholder="Pesquisar" autocomplete="off" aria-label="Pesquisar"></div>
        <div class="lista-escolha" id="e-l">${itens.map((it) => `<button class="opc ${String(it.v) === String(atual) ? 'sel' : ''}" data-v="${h(it.v)}" data-b="${h(semAcento(it.t + ' ' + (it.sub || '')))}"><b>${h(it.t)}</b>${it.sub ? `<small>${h(it.sub)}</small>` : ''}</button>`).join('') || '<p class="muted">Nada para escolher. Confira a planilha.</p>'}</div>
        <p class="muted small" id="e-nada" hidden>Nada encontrado.</p></div>`);
      let valor = null;
      $('[data-x]', d).onclick = () => d.close();
      $('#e-q', d).oninput = (e) => {
        const q = semAcento(e.target.value).trim(); let n = 0;
        $$('#e-l .opc', d).forEach((b) => { const ok = !q || q.split(/\s+/).every((t) => b.dataset.b.includes(t)); b.hidden = !ok; if (ok) n++; });
        $('#e-nada', d).hidden = n > 0;
      };
      $$('#e-l .opc', d).forEach((b) => (b.onclick = () => { valor = b.dataset.v; d.close(); }));
      d.addEventListener('close', () => res(valor));
      if (itens.length > 7) setTimeout(() => $('#e-q', d).focus(), 60);
    });
  }
  const campoEscolha = (id, rotulo, valor, vazio, sub) => `<div class="field"><span class="label" id="${id}-l">${h(rotulo)}</span>
    <button type="button" class="escolha-btn ${valor ? '' : 'vazio'}" id="${id}" aria-labelledby="${id}-l">${h(valor || vazio)}${sub ? `<small>${h(sub)}</small>` : ''}${ic('chev', 18)}</button></div>`;
  // Fazenda + talhão (o talhão depende da fazenda)
  function localHTML(pfx, o) {
    const area = o.fazenda && o.up ? areaDe(o.fazenda, o.up) : null;
    return `<div class="grid-2 stack-sm">${campoEscolha(pfx + '-fz', 'Fazenda', o.fazenda, 'Escolher fazenda')}
      ${campoEscolha(pfx + '-up', 'Talhão (UP)', o.up ? 'UP ' + o.up : '', o.fazenda ? 'Escolher talhão' : 'Escolha a fazenda antes', area != null ? num(area, 2) + ' ha' : '')}</div>`;
  }
  function ligarLocal(raiz, pfx, o, aoMudar) {
    const desenhar = () => { $('#' + pfx + '-local', raiz).innerHTML = localHTML(pfx, o); ligar(); };
    const ligar = () => {
      $('#' + pfx + '-fz', raiz).onclick = async () => {
        const v = await escolher('Fazenda', fazendas().map((f) => ({ v: f, t: f, sub: talhoes(f).length + ' talhões' })), o.fazenda);
        if (v != null && v !== o.fazenda) { o.fazenda = v; o.up = ''; desenhar(); aoMudar && aoMudar(); }
      };
      $('#' + pfx + '-up', raiz).onclick = async () => {
        if (!o.fazenda) return toast('Escolha a fazenda primeiro.');
        const v = await escolher('Talhão (UP) · ' + o.fazenda, talhoes(o.fazenda).map((t) => ({ v: t.up, t: 'UP ' + t.up, sub: t.area != null ? num(t.area, 2) + ' ha' : '' })), o.up);
        if (v != null) { o.up = v; desenhar(); aoMudar && aoMudar(); }
      };
    };
    desenhar();
  }
  const contador = (id, rotulo, valor) => `<div class="contador"><label for="${id}">${h(rotulo)}</label>
    <div class="cont"><button type="button" class="icon-btn" data-menos="${id}" aria-label="Diminuir ${h(rotulo)}">${ic('minus', 20)}</button>
    <input id="${id}" class="input" inputmode="numeric" value="${valor == null ? '' : h(valor)}" placeholder="0">
    <button type="button" class="icon-btn" data-mais="${id}" aria-label="Aumentar ${h(rotulo)}">${ic('plus', 20)}</button></div></div>`;
  function ligarContadores(raiz, aoMudar, minimo) {
    $$('[data-mais],[data-menos]', raiz).forEach((b) => (b.onclick = () => {
      const i = $('#' + (b.dataset.mais || b.dataset.menos), raiz); const v = parseInt(i.value, 10) || 0;
      i.value = Math.max(minimo || 0, v + (b.dataset.mais ? 1 : -1)); i.dispatchEvent(new Event('input', { bubbles: true })); aoMudar && aoMudar();
    }));
  }
  const intDe = (raiz, id) => { const t = String($('#' + id, raiz)?.value || '').trim(); if (!t) return null; const n = Number(t.replace(',', '.')); return Number.isInteger(n) && n >= 0 ? n : NaN; };
  const horasHTML = (pfx, i, f) => `<div class="grid-2"><div class="field"><label for="${pfx}-hi">Hora de início</label><input id="${pfx}-hi" class="input" type="time" value="${h(hhmm(i))}"></div>
    <div class="field"><label for="${pfx}-hf">Hora final</label><input id="${pfx}-hf" class="input" type="time" value="${h(hhmm(f))}"></div></div>
    <p class="dur" id="${pfx}-dur"></p>`;
  function ligarHoras(raiz, pfx, o, almoco) {
    const at = () => {
      const i = $('#' + pfx + '-hi', raiz).value, f = $('#' + pfx + '-hf', raiz).value; o.hora_inicio = i; o.hora_fim = f;
      const el = $('#' + pfx + '-dur', raiz); if (!(i && f && i !== f)) { el.textContent = ''; return; }
      const m = minutos(i, f), ml = minLiquidos(i, f);
      el.textContent = 'Duração: ' + duracao(m) + (f < i ? ' (passa da meia-noite)' : '') + (almoco && ml !== m ? ` · trabalhadas ${duracao(ml)} (desconta o almoço 11h–12h)` : '');
    };
    $('#' + pfx + '-hi', raiz).addEventListener('input', at); $('#' + pfx + '-hf', raiz).addEventListener('input', at); at();
  }
  function conferirHoras(i, f, pre) {
    if (!i) return `${pre}informe a hora de início.`;
    if (!f) return `${pre}informe a hora final.`;
    if (i === f) return `${pre}a hora final precisa ser diferente da inicial.`;
    return null;
  }
  // Tipo do recurso (colaborador, trator médio, trator pesado, caminhão)
  const recursoHTML = (pfx, atual) => `<div class="field"><span class="label" id="${pfx}-rec-l">Tipo</span>
    <div class="seg" role="group" aria-labelledby="${pfx}-rec-l" id="${pfx}-rec">${RECURSOS.map((r) => `<button type="button" data-rec="${h(r)}" aria-pressed="${r === atual}">${h(r)}</button>`).join('')}</div></div>`;
  function ligarRecurso(raiz, pfx, o, aoMudar) {
    $$('#' + pfx + '-rec [data-rec]', raiz).forEach((b) => (b.onclick = () => {
      o.recurso = b.dataset.rec; $$('#' + pfx + '-rec [data-rec]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); aoMudar && aoMudar();
    }));
  }

  // Fotos: lista = [{path, tipo, blob?, url?}] — as novas só vão para o aparelho ao salvar
  const fotosHTML = (id, titulo, dica) => `<div class="fotos-campo"><div class="sec-head"><span class="label">${h(titulo)}</span>
    <label class="btn btn-ghost btn-sm foto-add">${ic('camera', 18)} Adicionar foto<input type="file" accept="image/*" multiple id="${id}-in" class="sr-only"></label></div>
    ${dica ? `<p class="muted small">${h(dica)}</p>` : ''}<div class="fotos" id="${id}"></div></div>`;
  function ligarFotos(raiz, id, lista, tipo, aoMudar) {
    const box = $('#' + id, raiz);
    const desenhar = () => {
      box.innerHTML = lista.filter((f) => f.tipo === tipo).map((f) => `<div class="foto"><img alt="" data-path="${h(f.path)}" ${f.url ? `src="${f.url}"` : ''}>
        <button type="button" class="foto-x" data-rm="${h(f.path)}" aria-label="Remover foto">${ic('x', 16)}</button></div>`).join('');
      hidratarFotos(box);
      $$('[data-rm]', box).forEach((b) => (b.onclick = () => { const k = lista.findIndex((f) => f.path === b.dataset.rm); if (k >= 0) { lista.splice(k, 1); desenhar(); aoMudar && aoMudar(); } }));
    };
    $('#' + id + '-in', raiz).onchange = async (e) => {
      const arqs = Array.from(e.target.files || []); e.target.value = '';
      for (const a of arqs) {
        try { const blob = await reduzirFoto(a); lista.push({ path: `${S.user.id}/${uuid()}.jpg`, tipo, blob, url: URL.createObjectURL(blob) }); }
        catch (_) { toast('Não consegui ler uma das fotos.', 'erro'); }
      }
      desenhar(); aoMudar && aoMudar();
    };
    desenhar();
  }

  // Lista de itens que recolhem em cartões pequenos (atividades, diárias, paradas)
  function listaItens(raiz, sel, cfg) {
    const st = { aberto: cfg.aberto == null ? -1 : cfg.aberto };
    const box = $(sel, raiz);
    const rolar = () => { const el = $('.item.aberto', box); if (el) el.scrollIntoView({ block: 'nearest' }); };
    const desenhar = () => {
      const it = cfg.itens;
      box.innerHTML = (it.length ? it.map((x, i) => (i === st.aberto
        ? `<div class="item aberto"><div class="item-head"><b>${h(cfg.rotulo)} ${i + 1}</b><span class="item-acoes">
             <button type="button" class="btn btn-ghost btn-sm" data-ok>${ic('baixo', 16)} Recolher</button>
             <button type="button" class="icon-btn" data-rm aria-label="Remover ${h(cfg.rotulo.toLowerCase())} ${i + 1}">${ic('lixo', 18)}</button></span></div>${cfg.corpo(x, i)}</div>`
        : `<div class="mini-w"><button type="button" class="item-mini ${cfg.completo(x) ? '' : 'inc'}" data-abrir="${i}" aria-label="Editar ${h(cfg.rotulo.toLowerCase())} ${i + 1}"><span class="n">${i + 1}</span>
             <span class="t">${cfg.resumo(x)}${cfg.completo(x) ? '' : '<em>Incompleto</em>'}</span><span class="mini-ed">${ic('editar', 17)}<span>Editar</span></span></button>
             <button type="button" class="icon-btn mini-rm" data-rm-i="${i}" aria-label="Excluir ${h(cfg.rotulo.toLowerCase())} ${i + 1}" title="Excluir">${ic('lixo', 18)}</button></div>`)).join('')
        : `<p class="muted small">${cfg.vazio}</p>`) + `<button type="button" class="btn btn-ghost btn-add" data-add>${ic('plus', 18)} ${h(cfg.textoAdd(it.length))}</button>`;
      if (st.aberto >= 0 && it[st.aberto]) cfg.ligar(it[st.aberto], st.aberto, box);
      $$('[data-abrir]', box).forEach((b) => (b.onclick = () => { st.aberto = +b.dataset.abrir; desenhar(); rolar(); }));
      const ok = $('[data-ok]', box); if (ok) ok.onclick = () => { st.aberto = -1; desenhar(); };
      $$('[data-rm-i]', box).forEach((b) => (b.onclick = async () => {
        const k = +b.dataset.rmI; const x = it[k];
        if (cfg.resumoTexto(x) && !(await confirmar(`Excluir ${cfg.rotulo.toLowerCase()} ${k + 1}?`, h(cfg.resumoTexto(x)), 'Excluir', true))) return;
        it.splice(k, 1); if (st.aberto === k) st.aberto = -1; else if (st.aberto > k) st.aberto--;
        desenhar(); cfg.mudou && cfg.mudou();
      }));
      const rm = $('[data-rm]', box);
      if (rm) rm.onclick = async () => {
        const x = it[st.aberto];
        if (cfg.resumoTexto(x) && !(await confirmar(`Remover ${cfg.rotulo.toLowerCase()} ${st.aberto + 1}?`, h(cfg.resumoTexto(x)), 'Remover', true))) return;
        it.splice(st.aberto, 1); st.aberto = -1; desenhar(); cfg.mudou && cfg.mudou();
      };
      $('[data-add]', box).onclick = () => { it.push(cfg.novo()); st.aberto = it.length - 1; desenhar(); cfg.mudou && cfg.mudou(); rolar(); };
    };
    desenhar();
    return { desenhar, abrir(i) { st.aberto = i; desenhar(); rolar(); } };
  }

  // ----- Atividade -----
  const novaAtividade = (fz) => ({ atividade: '', regime: '', tarifa: null, fazenda: fz || '', up: '', hectares: '', situacao: '', insumos: [] });
  const SITUACOES = ['Em andamento', 'Finalizado'];
  const atvCompleta = (a) => !!(a.atividade && a.fazenda && a.up && lerNum(a.hectares) > 0 && a.situacao && (a.insumos || []).every((i) => i.insumo && lerNum(i.quantidade) > 0));
  const atvResumoTxt = (a) => [a.atividade, a.fazenda && `${a.fazenda}${a.up ? ' UP ' + a.up : ''}`, lerNum(a.hectares) > 0 && `${num(lerNum(a.hectares))} ${unidade(a.atividade)}`].filter(Boolean).join(' · ');
  const atvResumo = (a) => `<b>${h(a.atividade || 'Atividade sem nome')}</b><small>${h([a.fazenda && `${a.fazenda}${a.up ? ' · UP ' + a.up : ''}`, lerNum(a.hectares) > 0 && `${num(lerNum(a.hectares))} ${unidade(a.atividade)}`, a.situacao, (a.insumos || []).length && plural(a.insumos.length, 'insumo', 'insumos')].filter(Boolean).join(' · ') || 'Toque para preencher')}</small>`;
  function atvCorpo(a, i) {
    const un = unidade(a.atividade); const ref = a.atividade ? atividadeDe(a.atividade) : null; const tar = a.tarifa != null ? a.tarifa : ref && ref.tarifa;
    return `${campoEscolha(`at${i}-atv`, 'Atividade', a.atividade, atividades().length ? 'Escolher atividade' : 'Planilha de atividades vazia', a.atividade ? [a.regime, tar != null ? brl(tar) + '/' + un : 'sem tarifa'].filter(Boolean).join(' · ') : '')}
      <div id="at${i}-local"></div>
      <div class="field campo-ha"><label for="at${i}-ha">${un === 'h' ? 'Horas realizadas' : 'Hectares realizados'}</label>
        <div class="com-unid"><input id="at${i}-ha" class="input" inputmode="decimal" value="${h(numCampo(lerNum(a.hectares)))}" placeholder="0"><span>${un}</span></div>
        ${a.fazenda && a.up && areaDe(a.fazenda, a.up) != null ? `<span class="hint">Área do talhão: ${num(areaDe(a.fazenda, a.up))} ha</span>` : ''}</div>
      <div class="field"><span class="label" id="at${i}-sit-l">Situação do talhão</span>
        <div class="seg seg-2" role="group" aria-labelledby="at${i}-sit-l" id="at${i}-sit">${SITUACOES.map((x) => `<button type="button" data-sit="${x}" aria-pressed="${a.situacao === x}">${x}</button>`).join('')}</div></div>
      <div class="sub-ins"><div class="sec-head"><span class="label">Insumos desta atividade</span><button type="button" class="btn btn-ghost btn-sm" id="at${i}-add-in">${ic('plus', 18)} Insumo</button></div>
        <div id="at${i}-ins" class="itens"></div></div>`;
  }
  function atvLigar(a, i, box, ctx) {
    $(`#at${i}-atv`, box).onclick = async () => {
      const v = await escolher('Atividade', atividades().map((x) => ({ v: x.atividade, t: x.atividade, sub: [x.regime, x.tarifa != null ? brl(x.tarifa) + '/' + unidade(x.atividade) : 'sem tarifa'].filter(Boolean).join(' · ') })), a.atividade);
      if (v != null && v !== a.atividade) { const r = atividadeDe(v); a.atividade = v; a.regime = r ? r.regime : ''; a.tarifa = r ? r.tarifa : null; ctx.mudou(); ctx.redesenhar(); }
    };
    ligarLocal(box, `at${i}`, a, () => { ctx.mudou(); ctx.redesenhar(); });
    $(`#at${i}-ha`, box).oninput = (e) => { a.hectares = e.target.value; };
    $$(`#at${i}-sit [data-sit]`, box).forEach((b) => (b.onclick = () => { a.situacao = b.dataset.sit; $$(`#at${i}-sit [data-sit]`, box).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); ctx.mudou(); }));
    const lista = insumos();
    const desenharIns = () => {
      const el = $(`#at${i}-ins`, box);
      el.innerHTML = a.insumos.length ? a.insumos.map((x, k) => `<div class="linha-in">
        <div class="field"><label for="at${i}-in${k}-n">Insumo</label><select id="at${i}-in${k}-n" class="input"><option value="">Selecione</option>${[...new Set([...lista, x.insumo].filter(Boolean))].map((n) => `<option ${n === x.insumo ? 'selected' : ''}>${h(n)}</option>`).join('')}</select></div>
        <div class="field"><label for="at${i}-in${k}-q">Quantidade</label><input id="at${i}-in${k}-q" class="input" inputmode="decimal" value="${h(numCampo(lerNum(x.quantidade)))}" placeholder="0"></div>
        <button type="button" class="icon-btn" data-rm-in="${k}" aria-label="Remover insumo ${k + 1}">${ic('lixo', 18)}</button></div>`).join('')
        : `<p class="muted small">Nenhum insumo.${lista.length ? '' : ' (A planilha de insumos não tem itens para o seu CDC.)'}</p>`;
      a.insumos.forEach((x, k) => { $(`#at${i}-in${k}-n`, box).onchange = (e) => { x.insumo = e.target.value; }; $(`#at${i}-in${k}-q`, box).oninput = (e) => { x.quantidade = e.target.value; }; });
      $$('[data-rm-in]', el).forEach((b) => (b.onclick = () => { a.insumos.splice(+b.dataset.rmIn, 1); desenharIns(); ctx.mudou(); }));
    };
    $(`#at${i}-add-in`, box).onclick = () => { a.insumos.push({ insumo: '', quantidade: '' }); desenharIns(); ctx.mudou(); $(`#at${i}-in${a.insumos.length - 1}-n`, box).focus(); };
    desenharIns();
  }

  // ----- Diária -----
  const novaDiaria = (fz) => ({ recurso: '', quantidade: 1, fazenda: fz || '', up: '', diaria: '', hora_inicio: '', hora_fim: '' });
  const diaCompleta = (d) => !!(d.recurso && d.fazenda && d.up && String(d.diaria || '').trim() && d.hora_inicio && d.hora_fim && d.hora_inicio !== d.hora_fim);
  const diaResumoTxt = (d) => [d.recurso && `${d.recurso}${d.quantidade > 1 ? ' × ' + d.quantidade : ''}`, d.diaria, d.hora_inicio && d.hora_fim && `${hhmm(d.hora_inicio)}–${hhmm(d.hora_fim)}`].filter(Boolean).join(' · ');
  const diaResumo = (d) => `<b>${h([d.recurso && `${d.recurso}${d.quantidade > 1 ? ' × ' + d.quantidade : ''}`, d.diaria].filter(Boolean).join(' · ') || 'Diária sem dados')}</b>
    <small>${h([d.hora_inicio && d.hora_fim && `${hhmm(d.hora_inicio)}–${hhmm(d.hora_fim)} (${duracao(minLiquidos(d.hora_inicio, d.hora_fim))})`, d.fazenda && `${d.fazenda}${d.up ? ' · UP ' + d.up : ''}`].filter(Boolean).join(' · ') || 'Toque para preencher')}</small>`;
  const diaCorpo = (d, i) => `${recursoHTML('di' + i, d.recurso)}
    <div class="grid-qt">${contador(`di${i}-qt`, 'Quantidade', d.quantidade || 1)}
      <div class="field"><label for="di${i}-txt">Diária</label><input id="di${i}-txt" class="input" value="${h(d.diaria || '')}" placeholder="Ex.: limpeza de aceiro, roçada manual"></div></div>
    <div id="di${i}-local"></div>
    ${horasHTML('di' + i, d.hora_inicio, d.hora_fim)}`;
  function diaLigar(d, i, box, ctx) {
    ligarRecurso(box, 'di' + i, d, ctx.mudou);
    $(`#di${i}-qt`, box).addEventListener('input', (e) => { d.quantidade = parseInt(e.target.value, 10) || ''; });
    ligarContadores($(`#di${i}-qt`, box).closest('.contador'), null, 1);
    $(`#di${i}-txt`, box).oninput = (e) => { d.diaria = e.target.value; };
    ligarLocal(box, 'di' + i, d, ctx.mudou);
    ligarHoras(box, 'di' + i, d, true);
  }

  // ----- Hora parada -----
  const novaParada = (fz) => ({ recurso: '', quantidade: 1, fazenda: fz || '', up: '', motivo: '', hora_inicio: '', hora_fim: '' });
  const parCompleta = (p) => !!(p.recurso && p.fazenda && p.up && p.motivo && p.hora_inicio && p.hora_fim && p.hora_inicio !== p.hora_fim);
  const parResumoTxt = (p) => [p.recurso && `${p.recurso}${p.quantidade > 1 ? ' × ' + p.quantidade : ''}`, p.motivo, p.hora_inicio && p.hora_fim && `${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)}`].filter(Boolean).join(' · ');
  const parResumo = (p) => `<b>${h([p.motivo, p.recurso && `${p.recurso}${p.quantidade > 1 ? ' × ' + p.quantidade : ''}`].filter(Boolean).join(' · ') || 'Parada sem dados')}</b>
    <small>${h([p.hora_inicio && p.hora_fim && `${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)} (${duracao(minutos(p.hora_inicio, p.hora_fim))})`, p.fazenda && `${p.fazenda}${p.up ? ' · UP ' + p.up : ''}`].filter(Boolean).join(' · ') || 'Toque para preencher')}</small>`;
  const parCorpo = (p, i) => `${recursoHTML('pa' + i, p.recurso)}
    <div class="grid-qt">${contador(`pa${i}-qt`, 'Quantidade', p.quantidade || 1)}
      <div class="field"><label for="pa${i}-m">Motivo</label><select id="pa${i}-m" class="input"><option value="">Selecione</option>${[...new Set([...MOTIVOS, p.motivo].filter(Boolean))].map((m) => `<option ${m === p.motivo ? 'selected' : ''}>${h(m)}</option>`).join('')}</select></div></div>
    <div id="pa${i}-local"></div>
    ${horasHTML('pa' + i, p.hora_inicio, p.hora_fim)}`;
  function parLigar(p, i, box, ctx) {
    ligarRecurso(box, 'pa' + i, p, ctx.mudou);
    $(`#pa${i}-qt`, box).addEventListener('input', (e) => { p.quantidade = parseInt(e.target.value, 10) || ''; });
    ligarContadores($(`#pa${i}-qt`, box).closest('.contador'), null, 1);
    $(`#pa${i}-m`, box).onchange = (e) => { p.motivo = e.target.value; };
    ligarLocal(box, 'pa' + i, p, ctx.mudou);
    ligarHoras(box, 'pa' + i, p, false);
  }

  // Validações dos itens (abre o cartão com problema e põe o foco no campo)
  function validarItens(F, falha) {
    for (let i = 0; i < F.atividades.length; i++) {
      const a = F.atividades[i], pre = `Atividade ${i + 1}: `; const ir = (m, campo) => { F.L.atv.abrir(i); return falha(pre + m, campo && $(`#at${i}-${campo}`)); };
      if (!a.atividade) return ir('escolha a atividade.', 'atv');
      if (!a.fazenda) return ir('escolha a fazenda.', 'fz');
      if (!a.up) return ir('escolha o talhão (UP).', 'up');
      const q = lerNum(a.hectares); if (!(q > 0)) return ir(`informe ${unidade(a.atividade) === 'h' ? 'as horas realizadas' : 'os hectares realizados'} (maior que zero).`, 'ha');
      if (!a.situacao) return ir('informe se o talhão está em andamento ou finalizado.', 'sit button');
      for (let k = 0; k < a.insumos.length; k++) {
        const x = a.insumos[k];
        if (!x.insumo) return ir(`escolha o insumo ${k + 1}.`, `in${k}-n`);
        if (!(lerNum(x.quantidade) > 0)) return ir(`informe a quantidade do insumo ${k + 1} (maior que zero).`, `in${k}-q`);
      }
    }
    for (const [lista, nome, pfx, L] of [[F.diarias, 'Diária', 'di', F.L.dia], [F.paradas, 'Hora parada', 'pa', F.L.par]]) {
      for (let i = 0; i < lista.length; i++) {
        const d = lista[i], pre = `${nome} ${i + 1}: `; const ir = (m, campo) => { L.abrir(i); return falha(pre + m, campo && $(`#${pfx}${i}-${campo}`)); };
        if (!d.recurso) return ir('escolha o tipo (colaborador, trator médio, trator pesado ou caminhão).', 'rec button');
        if (!(parseInt(d.quantidade, 10) >= 1)) return ir('a quantidade precisa ser 1 ou mais.', 'qt');
        if (pfx === 'di' && !String(d.diaria || '').trim()) return ir('escreva a diária.', 'txt');
        if (pfx === 'pa' && !d.motivo) return ir('escolha o motivo.', 'm');
        if (!d.fazenda) return ir('escolha a fazenda.', 'fz');
        if (!d.up) return ir('escolha o talhão (UP).', 'up');
        const eh = conferirHoras(d.hora_inicio, d.hora_fim, ''); if (eh) return ir(eh, 'hi');
      }
    }
    return true;
  }
  const limparAtv = (a) => ({ atividade: a.atividade, regime: a.regime || null, tarifa: a.tarifa, fazenda: a.fazenda, up: a.up, area_ha: areaDe(a.fazenda, a.up), hectares: lerNum(a.hectares), situacao: a.situacao || null, insumos: a.insumos.map((x) => ({ insumo: x.insumo, quantidade: lerNum(x.quantidade) })) });
  const limparDia = (d) => ({ recurso: d.recurso, quantidade: parseInt(d.quantidade, 10) || 1, fazenda: d.fazenda, up: d.up, diaria: String(d.diaria).trim(), hora_inicio: hhmm(d.hora_inicio), hora_fim: hhmm(d.hora_fim) });
  const limparPar = (p) => ({ recurso: p.recurso, quantidade: parseInt(p.quantidade, 10) || 1, fazenda: p.fazenda, up: p.up, motivo: p.motivo, hora_inicio: hhmm(p.hora_inicio), hora_fim: hhmm(p.hora_fim) });

  // Salvar (novo ou edição): fotos novas vão para o aparelho, o lançamento entra na fila e é enviado
  async function guardar(form, F, dados, msgOk) {
    const bt = $('.btn-salvar', form); bt.disabled = true; const txt = bt.innerHTML; bt.textContent = 'Salvando…';
    const err = $('.form-error', form);
    const novas = F.fotos.filter((f) => f.blob);
    try {
      for (const f of novas) await IDB.put(f.path, f.blob);
      dados.fotos = F.fotos.map((f) => ({ path: f.path, tipo: f.tipo }));
      const ficaram = new Set(dados.fotos.map((f) => f.path));
      const anterior = fila().find((x) => x.dados.id === dados.id);
      const remover = [...new Set([...F.fotosOriginais.filter((p) => !ficaram.has(p)), ...((anterior && anterior.remover) || [])])];
      dados.criado_em = (F.original && F.original.criado_em) || new Date().toISOString();
      salvarFila([...fila().filter((x) => x.dados.id !== dados.id), { dados, remover, criado: dados.criado_em }]);
      for (const p of remover) IDB.del(p);
      await enviarFila(true);
      const it = fila().find((x) => x.dados.id === dados.id);
      if (it && it.erro) {   // o servidor recusou: volta ao formulário com o motivo
        salvarFila(anterior ? fila().map((x) => (x.dados.id === dados.id ? anterior : x)) : fila().filter((x) => x.dados.id !== dados.id));
        for (const f of novas) IDB.del(f.path);
        bt.disabled = false; bt.innerHTML = txt; barra(); err.textContent = it.erro; return;
      }
      delete form.dataset.sujo;
      toast(it ? (navigator.onLine ? 'Lançamento guardado no aparelho; o envio termina em instantes.' : 'Sem internet: o lançamento ficou guardado no aparelho e será enviado sozinho.') : msgOk, it ? '' : 'in', 6000);
      location.hash = '#/home';
    } catch (e) { bt.disabled = false; bt.innerHTML = txt; err.textContent = msgErro(e); }
  }
  // meta gravada no lançamento: a do dia em que foi lançado; se trocar a equipe, a da equipe nova
  const metaParaSalvar = (F) => (F.original && F.original.equipe === F.equipe && Number(F.original.meta) > 0 ? Number(F.original.meta) : metaEquipe(F.equipe));
  // Campo de equipe (apontamento, diárias e paradas)
  function ligarEquipe(view, F, aoMudar) {
    const box = () => {
      const e = equipes().find((x) => x.equipe === F.equipe);
      $('#f-eq-box', view).innerHTML = campoEscolha('f-eq', 'Equipe', F.equipe, equipes().length ? 'Escolher equipe' : 'Sem equipes para o seu CDC',
        [e ? e.tipo : F.equipe_tipo, e && e.meta ? 'meta ' + brl(e.meta) : ''].filter(Boolean).join(' · '));
      $('#f-eq', view).onclick = async () => {
        const v = await escolher('Equipe', equipes().map((x) => ({ v: x.equipe, t: x.equipe, sub: [x.tipo, x.meta ? 'meta ' + brl(x.meta) : ''].filter(Boolean).join(' · ') })), F.equipe);
        if (v != null) { const x = equipes().find((q) => q.equipe === v); const antes = F.equipe_tipo; F.equipe = v; F.equipe_tipo = x ? x.tipo : ''; box(); aoMudar && aoMudar(antes !== F.equipe_tipo); }
      };
    };
    box();
  }

  // Estado inicial do formulário (novo ou edição)
  function estadoForm(tipo) {
    const id = paramRota('id'); const orig = id ? registro(id) : null;
    if (id && !orig) { toast('Lançamento não encontrado.', 'erro'); location.hash = '#/home'; return null; }
    const o = orig ? clonar(orig) : {};
    const F = {
      id: orig ? orig.id : uuid(), original: orig, tipo, data: dia10(o.data) || hoje(),
      equipe: o.equipe || '', equipe_tipo: o.equipe_tipo || '', o,
      atividades: (o.atividades || []).map((a) => Object.assign(novaAtividade(), a, { insumos: (a.insumos || []).map((x) => Object.assign({}, x)) })),
      diarias: (o.diarias || []).map((d) => Object.assign(novaDiaria(), d, { hora_inicio: hhmm(d.hora_inicio), hora_fim: hhmm(d.hora_fim) })),
      paradas: (o.paradas || []).map((p) => Object.assign(novaParada(), p, { hora_inicio: hhmm(p.hora_inicio), hora_fim: hhmm(p.hora_fim) })),
      fotos: (o.fotos || []).map((f) => ({ path: f.path, tipo: f.tipo })), fotosOriginais: (o.fotos || []).map((f) => f.path),
      observacao: o.observacao || '', L: {},
    };
    F.fazendaPadrao = () => ([...F.atividades, ...F.diarias, ...F.paradas].find((x) => x.fazenda) || {}).fazenda || '';
    return F;
  }
  const rodapeForm = (F, rotulo) => `<section class="panel">
      <div class="field"><label for="f-obs">Observação</label><textarea id="f-obs" class="input" placeholder="Algo importante sobre o dia">${h(F.observacao)}</textarea></div>
      ${fotosHTML('f-fobs', 'Fotos da observação', 'Para justificar o que foi escrito (opcional).')}
      <p class="form-error" role="alert"></p>
      <button class="btn btn-block btn-salvar" type="submit">${h(rotulo)}</button>
      ${F.original ? '<a class="btn btn-ghost btn-block" href="#/home">Cancelar edição</a>' : ''}
    </section>`;

  // =========================================================
  //   Apontamento
  // =========================================================
  function vApontamento(view) {
    const F = estadoForm('apontamento'); if (!F) return;
    if (!F.original) F.atividades.push(novaAtividade());
    const ed = !!F.original;
    view.innerHTML = cabecalho(ed ? 'Editar apontamento' : 'Apontamento', ed ? `Lançado em ${dataBR(F.data)}. Altere o que precisar e salve.` : 'Lançamento do dia da equipe.') + `
      <form id="f-ap" class="stack" novalidate>
        <section class="panel">
          <div class="grid-2 stack-sm"><div class="field"><label for="f-data">Data</label><input id="f-data" type="date" class="input" value="${F.data}" max="${hoje()}"></div>
          <div id="ap-eq-box"></div></div>
        </section>
        <section class="panel"><h2>Estrutura do dia</h2><div id="ap-estr"></div>
          ${fotosHTML('f-feq', 'Foto da equipe', '')}</section>
        <section class="panel"><h2>Atividades</h2><p class="muted small">A fazenda das próximas atividades vem igual à primeira; normalmente só muda o talhão.</p><div id="ap-atv" class="itens"></div></section>
        <section class="panel"><h2>Diárias</h2><div id="ap-di" class="itens"></div></section>
        <section class="panel"><h2>Horas paradas</h2><div id="ap-pa" class="itens"></div></section>
        ${rodapeForm(F, ed ? 'Salvar alterações' : 'Salvar apontamento')}
      </form>`;
    const form = $('#f-ap', view);
    const sujo = () => { form.dataset.sujo = '1'; $('.form-error', form).textContent = ''; };
    form.addEventListener('input', sujo);

    const eqBox = () => {
      const e = equipes().find((x) => x.equipe === F.equipe);
      $('#ap-eq-box', view).innerHTML = campoEscolha('ap-eq', 'Equipe', F.equipe, equipes().length ? 'Escolher equipe' : 'Sem equipes para o seu CDC', [e ? e.tipo : F.equipe_tipo, e && e.meta ? 'meta ' + brl(e.meta) : ''].filter(Boolean).join(' · '));
      $('#ap-eq', view).onclick = async () => {
        const v = await escolher('Equipe', equipes().map((x) => ({ v: x.equipe, t: x.equipe, sub: [x.tipo, x.meta ? 'meta ' + brl(x.meta) : ''].filter(Boolean).join(' · ') })), F.equipe);
        if (v != null) { const x = equipes().find((q) => q.equipe === v); const tipoAntes = F.equipe_tipo; F.equipe = v; F.equipe_tipo = x ? x.tipo : ''; eqBox(); if (tipoAntes !== F.equipe_tipo || !$('#ap-estr .contador', view)) estrutura(); sujo(); }
      };
    };
    const estrutura = () => {
      const el = $('#ap-estr', view); const o = F.o;
      if (!F.equipe) { el.innerHTML = '<p class="muted">Escolha a equipe para preencher a estrutura.</p>'; return; }
      if (F.equipe_tipo === 'Mecanizado') {
        el.innerHTML = `<p class="muted small">Equipe mecanizada: quantidade de máquinas no dia.</p><div class="contadores">
          ${contador('ap-tm', 'Trator médio', o.trator_medio)}${contador('ap-tp', 'Trator pesado', o.trator_pesado)}${contador('ap-cam', 'Caminhão', o.caminhao)}${contador('ap-dro', 'Drone', o.drone)}</div>`;
        ligarContadores(el); return;
      }
      el.innerHTML = `<p class="muted small">Equipe ${F.equipe_tipo === 'Manual' ? 'manual' : ''}: pessoas no dia.</p><div class="contadores">
        ${contador('ap-col', 'Colaboradores', o.colaboradores)}${contador('ap-fal', 'Faltas', o.faltas)}${contador('ap-fer', 'Férias', o.ferias)}</div><p class="presentes" id="ap-pres"></p>`;
      const pres = () => { const c = intDe(view, 'ap-col') || 0, f = intDe(view, 'ap-fal') || 0, r = intDe(view, 'ap-fer') || 0; const el2 = $('#ap-pres', view);
        el2.textContent = c ? `Presentes: ${Math.max(0, c - f - r)} de ${c}` : ''; el2.classList.toggle('erro', f + r > c && c > 0); };
      $$('#ap-col,#ap-fal,#ap-fer', view).forEach((i) => i.addEventListener('input', pres));
      ligarContadores(el, pres); pres();
    };
    eqBox(); estrutura();
    ligarFotos(view, 'f-feq', F.fotos, 'equipe', sujo);
    ligarFotos(view, 'f-fobs', F.fotos, 'obs', sujo);

    const ctx = { mudou: sujo };
    F.L.atv = listaItens(view, '#ap-atv', { itens: F.atividades, aberto: ed ? -1 : 0, rotulo: 'Atividade', vazio: 'Nenhuma atividade.',
      textoAdd: (n) => (n ? 'Adicionar outra atividade' : 'Adicionar atividade'),
      novo: () => novaAtividade(F.fazendaPadrao()), completo: atvCompleta, resumo: atvResumo, resumoTexto: atvResumoTxt, corpo: atvCorpo,
      ligar: (a, i, box) => atvLigar(a, i, box, { mudou: sujo, redesenhar: () => F.L.atv.desenhar() }), mudou: sujo });
    F.L.dia = listaItens(view, '#ap-di', { itens: F.diarias, rotulo: 'Diária', vazio: 'Nenhuma diária neste apontamento.',
      textoAdd: (n) => (n ? 'Adicionar outra diária' : 'Adicionar diária'),
      novo: () => novaDiaria(F.fazendaPadrao()), completo: diaCompleta, resumo: diaResumo, resumoTexto: diaResumoTxt, corpo: diaCorpo,
      ligar: (d, i, box) => diaLigar(d, i, box, ctx), mudou: sujo });
    F.L.par = listaItens(view, '#ap-pa', { itens: F.paradas, rotulo: 'Parada', vazio: 'Nenhuma hora parada neste apontamento.',
      textoAdd: (n) => (n ? 'Adicionar outra parada' : 'Adicionar hora parada'),
      novo: () => novaParada(F.fazendaPadrao()), completo: parCompleta, resumo: parResumo, resumoTexto: parResumoTxt, corpo: parCorpo,
      ligar: (p, i, box) => parLigar(p, i, box, ctx), mudou: sujo });

    form.onsubmit = (e) => {
      e.preventDefault();
      const err = $('.form-error', form); err.textContent = '';
      const falha = (m, el) => { err.textContent = m; if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } return false; };
      const data = $('#f-data', view).value;
      if (!data) return falha('Informe a data.', $('#f-data', view));
      if (data > hoje()) return falha('A data não pode ser no futuro.', $('#f-data', view));
      if (!F.equipe) return falha('Escolha a equipe.', $('#ap-eq', view));
      const dados = { id: F.id, tipo: 'apontamento', data, equipe: F.equipe, equipe_tipo: F.equipe_tipo || null, meta: metaParaSalvar(F) };
      const campos = F.equipe_tipo === 'Mecanizado' ? [['trator_medio', 'ap-tm', 'Trator médio'], ['trator_pesado', 'ap-tp', 'Trator pesado'], ['caminhao', 'ap-cam', 'Caminhão'], ['drone', 'ap-dro', 'Drone']]
        : [['colaboradores', 'ap-col', 'Colaboradores'], ['faltas', 'ap-fal', 'Faltas'], ['ferias', 'ap-fer', 'Férias']];
      for (const [k, id, rot] of campos) { const v = intDe(view, id); if (Number.isNaN(v)) return falha(`${rot}: use um número inteiro.`, $('#' + id, view)); dados[k] = v; }
      if ((dados.faltas || 0) + (dados.ferias || 0) > (dados.colaboradores || 0) && (dados.faltas || dados.ferias)) return falha('Faltas + férias não podem passar do número de colaboradores.', $('#ap-fal', view));
      // cartão de atividade vazio (sem nada preenchido) é ignorado
      F.atividades.splice(0, F.atividades.length, ...F.atividades.filter((a) => a.atividade || a.up || String(a.hectares || '').trim() || a.insumos.length));
      F.L.atv.desenhar();
      if (!F.atividades.length && !F.diarias.length && !F.paradas.length) return falha('Adicione pelo menos uma atividade, diária ou hora parada.');
      if (!validarItens(F, falha)) return;
      Object.assign(dados, {
        atividades: F.atividades.map(limparAtv), diarias: F.diarias.map(limparDia), paradas: F.paradas.map(limparPar),
        observacao: $('#f-obs', view).value.trim() || null,
      });
      guardar(form, F, dados, ed ? 'Apontamento atualizado.' : `Apontamento de ${dataBR(data)} salvo.`);
    };
  }

  // =========================================================
  //   Diárias e Horas Paradas (várias por lançamento)
  // =========================================================
  function vDiarias(view) { vItens(view, 'diarias'); }
  function vParadas(view) { vItens(view, 'paradas'); }
  function vItens(view, tipo) {
    const F = estadoForm(tipo); if (!F) return;
    const dia = tipo === 'diarias'; const ed = !!F.original;
    const lista = dia ? F.diarias : F.paradas;
    if (!ed) lista.push(dia ? novaDiaria() : novaParada());
    view.innerHTML = cabecalho((ed ? 'Editar ' : '') + (dia ? 'diárias' : 'horas paradas').replace(/^./, (c) => (ed ? c : c.toUpperCase())),
      dia ? 'Serviços feitos por diária. Adicione quantas precisar.' : 'Tempo em que a equipe ou as máquinas ficaram paradas.') + `
      <form id="f-it" class="stack" novalidate>
        <section class="panel"><div class="grid-2 stack-sm"><div class="field"><label for="f-data">Data</label><input id="f-data" type="date" class="input" value="${F.data}" max="${hoje()}"></div>
          <div id="f-eq-box"></div></div></section>
        <section class="panel"><h2>${dia ? 'Diárias' : 'Horas paradas'}</h2><div id="it-lista" class="itens"></div></section>
        ${rodapeForm(F, ed ? 'Salvar alterações' : dia ? 'Salvar diárias' : 'Salvar horas paradas')}
      </form>`;
    const form = $('#f-it', view);
    const sujo = () => { form.dataset.sujo = '1'; $('.form-error', form).textContent = ''; };
    form.addEventListener('input', sujo);
    ligarFotos(view, 'f-fobs', F.fotos, 'obs', sujo);
    ligarEquipe(view, F, sujo);
    const ctx = { mudou: sujo };
    const L = listaItens(view, '#it-lista', dia
      ? { itens: lista, aberto: ed ? -1 : 0, rotulo: 'Diária', vazio: 'Nenhuma diária.', textoAdd: (n) => (n ? 'Adicionar outra diária' : 'Adicionar diária'),
          novo: () => novaDiaria(F.fazendaPadrao()), completo: diaCompleta, resumo: diaResumo, resumoTexto: diaResumoTxt, corpo: diaCorpo, ligar: (d, i, box) => diaLigar(d, i, box, ctx), mudou: sujo }
      : { itens: lista, aberto: ed ? -1 : 0, rotulo: 'Parada', vazio: 'Nenhuma hora parada.', textoAdd: (n) => (n ? 'Adicionar outra parada' : 'Adicionar hora parada'),
          novo: () => novaParada(F.fazendaPadrao()), completo: parCompleta, resumo: parResumo, resumoTexto: parResumoTxt, corpo: parCorpo, ligar: (p, i, box) => parLigar(p, i, box, ctx), mudou: sujo });
    F.L = { atv: { abrir() {} }, dia: dia ? L : { abrir() {} }, par: dia ? { abrir() {} } : L };
    form.onsubmit = (e) => {
      e.preventDefault();
      const err = $('.form-error', form); err.textContent = '';
      const falha = (m, el) => { err.textContent = m; if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } return false; };
      const data = $('#f-data', view).value;
      if (!data) return falha('Informe a data.', $('#f-data', view));
      if (data > hoje()) return falha('A data não pode ser no futuro.', $('#f-data', view));
      if (!F.equipe) return falha('Escolha a equipe.', $('#f-eq', view));
      if (!lista.length) return falha(dia ? 'Adicione pelo menos uma diária.' : 'Adicione pelo menos uma hora parada.');
      if (!validarItens(F, falha)) return;
      const dados = { id: F.id, tipo, data, equipe: F.equipe, equipe_tipo: F.equipe_tipo || null, meta: metaParaSalvar(F), diarias: dia ? lista.map(limparDia) : [], paradas: dia ? [] : lista.map(limparPar), observacao: $('#f-obs', view).value.trim() || null };
      guardar(form, F, dados, ed ? 'Lançamento atualizado.' : dia ? 'Diárias salvas.' : 'Horas paradas salvas.');
    };
  }

  // =========================================================
  //   Valores (valor/hora das diárias + tarifas das atividades)
  // =========================================================
  function vValores(view) {
    const fmt = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
    const desenhar = () => {
      view.innerHTML = cabecalho('Valores', `Usados no faturamento dos cartões e no PDF. CDC: <b>${h(S.user.cdc)}</b>`) + `
        <form id="f-val" class="panel stack-sm" novalidate>
          <h2>Diárias · valor por hora</h2>
          <p class="muted small">Faturamento da diária = valor/hora × horas trabalhadas × quantidade. Se o horário pegar das 11h às 12h, essa hora de almoço é descontada. Os valores valem para todos do seu CDC.</p>
          ${RECURSOS.map((r, i) => { const v = S.valores[r]; return `<div class="field"><label for="v${i}">${h(r)}</label>
            <div class="com-unid moeda"><span>R$</span><input id="v${i}" class="input" inputmode="decimal" value="${h(fmt(v && v.valor))}" placeholder="0,00"><span>/hora</span></div>
            ${v && v.em ? `<span class="hint">Atualizado${v.por ? ' por ' + h(v.por) : ''} em ${dataBR(String(v.em).slice(0, 10))}</span>` : '<span class="hint">Ainda não cadastrado</span>'}</div>`; }).join('')}
          <p class="form-error" role="alert"></p>
          <button class="btn btn-block btn-salvar" type="submit">Salvar valores</button>
        </form>
        <section class="panel"><div class="sec-head"><h2>Metas das equipes</h2><span class="muted small">da planilha de equipes</span></div>
          <p class="muted small">A meta de cada equipe vem da coluna METAS. O cartão da equipe e o PDF mostram o delta: faturamento − meta, com e sem as diárias.</p>
          <div class="tarifas">${equipes().map((e) => `<div class="tar"><span><b>${h(e.equipe)}</b><small>${h(e.tipo)}</small></span><b>${e.meta ? brl(e.meta) : '—'}</b></div>`).join('') || '<p class="muted">Não consegui ler a planilha de equipes.</p>'}</div>
        </section>
        <section class="panel"><div class="sec-head"><h2>Tarifas das atividades</h2><span class="muted small">da planilha · ${atividades().length} atividades</span></div>
          <p class="muted small">Faturamento da atividade = tarifa × quantidade realizada. Para mudar uma tarifa, altere a planilha de atividades.</p>
          <div class="search">${ic('search', 20)}<input type="search" class="input" id="tq" placeholder="Pesquisar atividade" aria-label="Pesquisar atividade"></div>
          <div class="tarifas" id="tl">${atividades().map((a) => `<div class="tar" data-b="${h(semAcento(a.atividade + ' ' + a.regime))}"><span><b>${h(a.atividade)}</b><small>${h(a.regime)}</small></span><b>${a.tarifa != null ? brl(a.tarifa) + '<small>/' + unidade(a.atividade) + '</small>' : '—'}</b></div>`).join('') || '<p class="muted">Não consegui ler a planilha de atividades.</p>'}</div>
        </section>`;
      const form = $('#f-val', view);
      form.addEventListener('input', () => { form.dataset.sujo = '1'; $('.form-error', form).textContent = ''; });
      $('#tq', view).oninput = (e) => { const q = semAcento(e.target.value).trim(); $$('#tl .tar', view).forEach((t) => { t.hidden = !!q && !q.split(/\s+/).every((p) => t.dataset.b.includes(p)); }); };
      form.onsubmit = async (e) => {
        e.preventDefault(); const err = $('.form-error', form);
        const p = {};
        for (let i = 0; i < RECURSOS.length; i++) {
          const t = $('#v' + i, view).value.trim(); const n = lerNum(t);
          if (t && !(n >= 0)) { err.textContent = `${RECURSOS[i]}: valor inválido.`; $('#v' + i, view).focus(); return; }
          p[RECURSOS[i]] = t ? n : null;
        }
        if (!navigator.onLine) { err.textContent = 'Para salvar os valores é preciso internet.'; return; }
        const bt = $('.btn-salvar', form); bt.disabled = true; bt.textContent = 'Salvando…';
        try { await sessao(); S.valores = (await rpc('pgo_salvar_valores', { p })) || {}; gravar('pgo.valores.' + S.user.cdc, S.valores); delete form.dataset.sujo; toast('Valores salvos.', 'in'); location.hash = '#/home'; }
        catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; bt.textContent = 'Salvar valores'; }
      };
    };
    desenhar();
    const antes = JSON.stringify(S.valores);
    carregarValores().then((ok) => { if (ok && rotaAtual() === 'valores' && JSON.stringify(S.valores) !== antes && !$('#f-val[data-sujo="1"]')) desenhar(); });
  }

  // =========================================================
  //   WhatsApp (sem valores em dinheiro) — vai com a foto da equipe
  // =========================================================
  function estruturaTxt(r) {
    return r.equipe_tipo === 'Mecanizado'
      ? [['trator_medio', 'trator médio'], ['trator_pesado', 'trator pesado'], ['caminhao', 'caminhão'], ['drone', 'drone']].filter(([k]) => r[k]).map(([k, t]) => `${r[k]} ${t}`).join(' · ')
      : (r.colaboradores ? `${r.colaboradores} colaboradores · ${Math.max(0, r.colaboradores - (r.faltas || 0) - (r.ferias || 0))} presentes${r.faltas ? ` · ${r.faltas} falta(s)` : ''}${r.ferias ? ` · ${r.ferias} férias` : ''}` : '');
  }
  function textoWhats(g) {
    const c = calcular(g.regs); const L = []; const tp = tipoEquipe(g);
    L.push(`*PGO Digital · ${g.equipe}*${tp ? ` (${tp})` : ''}`, `${dataBR(g.d)} (${diaSemana(g.d)}) · ${S.user.nome}`);
    c.equipes.map(estruturaTxt).filter(Boolean).forEach((e) => L.push(`👷 Estrutura: ${e}`));
    if (c.atv.length) {
      L.push('', '✅ *Atividades*');
      c.atv.forEach((a) => {
        L.push(`• ${a.atividade} — ${a.fazenda} UP ${a.up} — *${num(a.q)} ${a.un}*${a.situacao ? ` — ${a.situacao === 'Finalizado' ? 'talhão finalizado' : 'em andamento'}` : ''}`);
        if ((a.insumos || []).length) L.push(`   Insumos: ${a.insumos.map((i) => `${i.insumo} ${num(i.quantidade, 3)}`).join(', ')}`);
      });
    }
    if (c.dia.length) {
      L.push('', '🕒 *Diárias*');
      c.dia.forEach((x) => L.push(`• ${x.recurso}${x.qt > 1 ? ' ×' + x.qt : ''} — ${x.diaria} — ${hhmm(x.hora_inicio)} às ${hhmm(x.hora_fim)} (${duracao(x.ml)}${x.ml !== x.mb ? ', já descontado o almoço' : ''}) — ${x.fazenda} UP ${x.up}`));
    }
    if (c.par.length) {
      L.push('', '⛔ *Horas paradas*');
      c.par.forEach((x) => L.push(`• ${x.motivo} — ${x.recurso}${x.qt > 1 ? ' ×' + x.qt : ''} — ${hhmm(x.hora_inicio)} às ${hhmm(x.hora_fim)} (${duracao(x.mb)}) — ${x.fazenda} UP ${x.up}`));
    }
    g.regs.filter((r) => r.observacao).forEach((r, i) => { if (!i) L.push(''); L.push(`📝 ${r.observacao}`); });
    const tot = [c.ha ? `${num(c.ha)} ha` : '', c.hAtv ? `${num(c.hAtv)} h de atividade` : '', c.dia.length ? `${horasTxt(c.hDia)} de diárias` : '', c.par.length ? `${horasTxt(c.hPar)} paradas` : ''].filter(Boolean);
    if (tot.length) L.push('', `*Total:* ${tot.join(' · ')}`);
    return L.join('\n');
  }
  async function copiarTexto(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (_) { const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} a.remove(); return ok; }
  }
  async function arquivosDasFotos(fotos, nome) {
    const out = [];
    for (const f of fotos) {
      try {
        let b = await IDB.get(f.path);
        if (!b) { const r = await fetch(urlFoto(f.path)); if (r.ok) b = await r.blob(); }
        if (b) out.push(new File([b], `${nome}${fotos.length > 1 ? '-' + (out.length + 1) : ''}.jpg`, { type: 'image/jpeg' }));
      } catch (_) {}
    }
    return out;
  }
  function compartilhar(chave) {
    const g = grupo(chave); if (!g) return;
    const t = textoWhats(g); const fotos = fotosEquipe(g.regs);
    const nomeArq = `equipe ${g.equipe} ${dataBR(g.d).replace(/\//g, '-')}`.replace(/[^\w\- ]+/g, '').trim();
    const dl = dialogo(`<div class="dlg"><div class="dlg-head"><h2>WhatsApp · ${h(g.equipe)}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <p class="muted small">Texto sem valores em dinheiro${fotos.length ? ', com a foto da equipe' : ''}.</p>
      ${fotos.length ? `<div class="fotos mini">${fotos.map((f) => `<div class="foto"><img alt="Foto da equipe" data-path="${h(f.path)}"></div>`).join('')}</div>`
        : `<p class="dc-alerta">Este dia ainda não tem foto da equipe. Use o botão ${ic('camera', 15)} no apontamento para adicionar.</p>`}
      <textarea class="input whats-txt" readonly rows="10" aria-label="Texto para o WhatsApp">${h(t)}</textarea>
      <div class="dlg-foot"><button class="btn btn-ghost" data-copiar>${ic('copiar', 18)} Copiar texto</button>
        <button class="btn btn-whats" data-enviar>${ic('whats', 18)} Enviar no WhatsApp</button></div></div>`);
    hidratarFotos(dl);
    let arquivos = null; const pronto = arquivosDasFotos(fotos, nomeArq).then((a) => (arquivos = a));
    $('[data-x]', dl).onclick = () => dl.close();
    $('[data-copiar]', dl).onclick = async () => { if (await copiarTexto(t)) toast('Texto copiado. Cole no grupo do WhatsApp.', 'in'); else toast('Não consegui copiar. Selecione o texto e copie.', 'erro'); };
    $('[data-enviar]', dl).onclick = async () => {
      await copiarTexto(t);   // se o WhatsApp não levar o texto junto com a foto, é só colar
      if (arquivos === null) await pronto;
      if (arquivos.length && navigator.canShare && navigator.canShare({ files: arquivos })) {
        try { await navigator.share({ files: arquivos, text: t }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      // aparelho sem compartilhamento de arquivos (ex.: computador): baixa a foto e abre o WhatsApp com o texto
      arquivos.forEach((f) => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); });
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
      if (arquivos.length) toast('A foto foi baixada: anexe no grupo. O texto já está copiado.', '', 8000);
    };
  }

  // =========================================================
  //   PDF (relatório da equipe no dia — impressão / "Salvar como PDF")
  // =========================================================
  function relatorioHTML(g) {
    const regs = g.regs; const meta = metaGrupo(regs); const c = calcular(regs, meta);
    const pctDe = (v, t) => (t > 0 ? (v / t * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—');
    const atvOrd = c.atv.slice().sort((a, b) => (b.valor || 0) - (a.valor || 0));
    const motivos = Object.entries(c.parPorMot).sort((a, b) => b[1].horas - a[1].horas);
    const insLinhas = c.atv.flatMap((a) => (a.insumos || []).map((x) => ({ insumo: x.insumo, quantidade: Number(x.quantidade) || 0, atividade: a.atividade, fazenda: a.fazenda, up: a.up })));
    const barra = c.com > 0 ? `<div class="r-barra"><span class="b-atv" style="width:${(c.sem / c.com * 100).toFixed(2)}%"></span><span class="b-dia" style="width:${(c.vd / c.com * 100).toFixed(2)}%"></span></div>
      <div class="r-leg"><span><i class="b-atv"></i>Atividades ${brl(c.sem)} (${pctDe(c.sem, c.com)})</span><span><i class="b-dia"></i>Diárias ${brl(c.vd)} (${pctDe(c.vd, c.com)})</span></div>` : '';
    const fotosEq = fotosEquipe(regs);
    const obsBlocos = regs.map((r) => ({ titulo: tituloReg(r), texto: r.observacao, fotos: (r.fotos || []).filter((f) => f.tipo !== 'equipe') })).filter((o) => o.texto || o.fotos.length);
    const tab = (cab, nTexto, linhas, total) => `<table class="r-tab"><thead><tr>${cab.map((x, i) => `<th${i >= nTexto ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody>${total ? `<tfoot>${total}</tfoot>` : ''}</table>`;
    const nTd = (v) => `<td class="n">${v}</td>`;
    const tp = tipoEquipe(g);
    const kpiDelta = (rot, v, sub) => `<div class="k ${v == null ? '' : v >= 0 ? 'k-pos' : 'k-neg'}"><span>${rot}</span><b>${v != null ? sinal(v) : '—'}</b><small>${sub}</small></div>`;
    return `<div class="rel">
      <header class="r-cab"><div><div class="r-marca">PGO Digital</div><h1>Relatório diário · ${h(g.equipe)}</h1><p class="r-data">${h(dataLonga(g.d))}${tp ? ' · equipe ' + h(tp.toLowerCase()) : ''}</p></div>
        <div class="r-quem"><b>${h(S.user.nome)}</b><span>${h(S.user.cdc)}</span><span>Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></div></header>
      <section class="r-topo ${fotosEq.length ? '' : 'sem-foto'}">
        <div class="r-estr"><h2 class="r-h2-top">Estrutura da equipe</h2>
          ${c.equipes.length ? tab(['Tipo', 'Colab.', 'Faltas', 'Férias', 'Presentes', 'Tr. médio', 'Tr. pesado', 'Caminhão', 'Drone'], 1,
            c.equipes.map((r) => `<tr><td>${h(r.equipe_tipo || '—')}</td>${['colaboradores', 'faltas', 'ferias'].map((k) => nTd(r[k] ?? '—')).join('')}${nTd(r.colaboradores ? Math.max(0, r.colaboradores - (r.faltas || 0) - (r.ferias || 0)) : '—')}${['trator_medio', 'trator_pesado', 'caminhao', 'drone'].map((k) => nTd(r[k] ?? '—')).join('')}</tr>`))
            : '<p class="r-vazio">Sem apontamento de estrutura neste dia.</p>'}</div>
        ${fotosEq.length ? `<figure class="r-fotoeq"><img alt="Foto da equipe" data-path="${h(fotosEq[0].path)}"><figcaption>Foto da equipe${fotosEq.length > 1 ? ` (+${fotosEq.length - 1} no fim)` : ''}</figcaption></figure>` : ''}
      </section>
      <section class="r-kpis r-kpis3">
        <div class="k k-meta"><span>Meta da equipe</span><b>${meta != null ? brl(meta) : '—'}</b><small>${meta != null ? 'da planilha de equipes' : 'sem meta na planilha'}</small></div>
        <div class="k k-dest"><span>Faturamento com diárias</span><b>${brl(c.com)}</b><small>${meta != null ? daMeta(c.com, meta) : 'atividades + diárias'}</small></div>
        ${kpiDelta('Delta com diárias', c.dCom, 'faturamento com diárias − meta')}
        <div class="k k-perda"><span>Horas paradas · perdas</span><b>${c.impacto > 0 ? '−' + brl(c.impacto) : brl(0)}</b><small>${horasTxt(c.hPar)} parado${c.faltaValorPar.length ? ' · sem valor/hora: ' + h(c.faltaValorPar.join(', ')) : ''}</small></div>
        <div class="k"><span>Faturamento sem diárias</span><b>${brl(c.sem)}</b><small>${meta != null ? daMeta(c.sem, meta) : 'só atividades'}</small></div>
        ${kpiDelta('Delta sem diárias', c.dSem, 'faturamento sem diárias − meta')}
      </section>
      ${barra}
      ${c.atv.length ? `<h2>Faturamento por atividade</h2>${tab(['Atividade', 'Fazenda · UP', 'Situação', 'Realizado', 'Tarifa', 'Valor'], 3,
        atvOrd.map((a) => `<tr><td>${h(a.atividade)}${a.regime ? `<small>${h(a.regime)}</small>` : ''}${(a.insumos || []).length ? `<small>Insumos: ${a.insumos.map((i) => `${h(i.insumo)} ${num(i.quantidade, 3)}`).join(', ')}</small>` : ''}</td><td>${h(a.fazenda)} · UP ${h(a.up)}</td><td>${a.situacao ? `<span class="r-sit ${a.situacao === 'Finalizado' ? 'fin' : ''}">${h(a.situacao)}</span>` : '—'}</td>${nTd(`${num(a.q)} ${a.un}`)}${nTd(a.tarifa != null ? brl(a.tarifa) : '—')}${nTd(a.valor != null ? brl(a.valor) : '—')}</tr>`),
        `<tr><td colspan="3">Total das atividades (sem diárias)</td>${nTd(`${num(c.ha)} ha${c.hAtv ? ' · ' + num(c.hAtv) + ' h' : ''}`)}<td></td>${nTd(brl(c.sem))}</tr>`)}` : ''}
      ${c.dia.length ? `<h2>Diárias</h2>${tab(['Tipo', 'Diária', 'Fazenda · UP', 'Horário', 'Horas', 'R$/h', 'Valor'], 4,
        c.dia.map((x) => `<tr><td>${h(x.recurso)}${x.qt > 1 ? ' × ' + x.qt : ''}</td><td>${h(x.diaria)}</td><td>${h(x.fazenda)} · UP ${h(x.up)}</td><td>${hhmm(x.hora_inicio)}–${hhmm(x.hora_fim)}${x.ml !== x.mb ? '<small>desconta almoço</small>' : ''}</td>${nTd(horasTxt(x.horas))}${nTd(x.vh != null ? brl(x.vh) : '<span class="r-alerta">sem valor</span>')}${nTd(brl(x.valor || 0))}</tr>`),
        Object.entries(c.diaPorRec).map(([k, v]) => `<tr class="sub"><td colspan="4">${h(k)}</td>${nTd(horasTxt(v.horas))}<td></td>${nTd(brl(v.valor))}</tr>`).join('') + `<tr><td colspan="4">Total das diárias</td>${nTd(horasTxt(c.hDia))}<td></td>${nTd(brl(c.vd))}</tr>`)}` : ''}
      <h2>Horas paradas e perdas</h2>
      ${c.par.length ? tab(['Motivo', 'Tipo', 'Fazenda · UP', 'Horário', 'Horas', 'R$/h', 'Perda'], 4,
        c.par.map((x) => `<tr><td>${h(x.motivo)}</td><td>${h(x.recurso)}${x.qt > 1 ? ' × ' + x.qt : ''}</td><td>${h(x.fazenda)} · UP ${h(x.up)}</td><td>${hhmm(x.hora_inicio)}–${hhmm(x.hora_fim)}</td>${nTd(horasTxt(x.horas))}${nTd(x.vh != null ? brl(x.vh) : '<span class="r-alerta">sem valor</span>')}${nTd(x.valor != null ? '−' + brl(x.valor) : '—')}</tr>`),
        motivos.map(([k, v]) => `<tr class="sub"><td colspan="4">${h(k)} · ${pctDe(v.horas, c.hPar)} do tempo parado</td>${nTd(horasTxt(v.horas))}<td></td>${nTd(v.valor ? '−' + brl(v.valor) : '—')}</tr>`).join('') + `<tr><td colspan="4">Total parado</td>${nTd(horasTxt(c.hPar))}<td></td>${nTd(c.impacto ? '−' + brl(c.impacto) : brl(0))}</tr>`)
        : '<p class="r-vazio">Nenhuma hora parada lançada.</p>'}
      <h2>Insumos gastos</h2>
      ${insLinhas.length ? tab(['Insumo', 'Atividade', 'Fazenda · UP', 'Quantidade'], 3,
        insLinhas.map((x) => `<tr><td>${h(x.insumo)}</td><td>${h(x.atividade)}</td><td>${h(x.fazenda)} · UP ${h(x.up)}</td>${nTd(num(x.quantidade, 3))}</tr>`),
        Object.entries(c.ins).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, v]) => `<tr class="sub"><td colspan="3">Total de ${h(k)}</td>${nTd(num(v, 3))}</tr>`).join(''))
        : '<p class="r-vazio">Nenhum insumo lançado.</p>'}
      <h2>Observações e fotos</h2>
      ${obsBlocos.length || fotosEq.length > 1 ? obsBlocos.map((o) => `<div class="r-obs-b"><p><b>${h(o.titulo)}</b>${o.texto ? ': ' + h(o.texto) : ''}</p>
          ${o.fotos.length ? `<div class="r-fotos">${o.fotos.map((f) => `<figure><img alt="" data-path="${h(f.path)}"></figure>`).join('')}</div>` : ''}</div>`).join('')
        + (fotosEq.length > 1 ? `<div class="r-obs-b"><p><b>Outras fotos da equipe</b></p><div class="r-fotos">${fotosEq.slice(1).map((f) => `<figure><img alt="" data-path="${h(f.path)}"></figure>`).join('')}</div></div>` : '')
        : '<p class="r-vazio">Nenhuma observação lançada.</p>'}
      <footer class="r-pe">Premissas: faturamento da atividade = tarifa da planilha × quantidade realizada. Diária = valor/hora do CDC × horas trabalhadas × quantidade, descontando o almoço (11h às 12h) quando o horário passa por ele. Meta = coluna METAS da planilha de equipes. Delta = faturamento − meta (com e sem as diárias). Perda das horas paradas = valor/hora × horas paradas × quantidade (não é descontada do faturamento).</footer>
    </div>`;
  }
  async function gerarPDF(chave) {
    const g = grupo(chave); if (!g) return;
    let box = $('#impressao'); if (!box) { box = document.createElement('div'); box.id = 'impressao'; document.body.appendChild(box); }
    box.innerHTML = relatorioHTML(g);
    toast('Preparando o PDF…', '', 2500);
    await hidratarFotos(box);
    await Promise.all($$('img', box).map((img) => (img.complete ? 0 : new Promise((ok) => { img.onload = img.onerror = ok; setTimeout(ok, 8000); }))));
    const antes = document.title; document.title = `PGO ${g.equipe} ${dataBR(g.d).replace(/\//g, '-')}`;
    window.print();
    setTimeout(() => { document.title = antes; }, 1500);
  }
  window.addEventListener('afterprint', () => { const b = $('#impressao'); if (b) b.innerHTML = ''; });

  // =========================================================
  //   Início
  // =========================================================
  async function boot() {
    carregarBase().then((ok) => { if (ok && S.user) render(); });
    if (!cliente()) {
      app().innerHTML = `<div class="auth"><div class="auth-box"><span class="tag big">PGO Digital</span><div class="auth-card"><h2>Sem conexão com o banco</h2>
        <p>${navigator.onLine ? 'Não encontrei o endereço do banco. Confira o config.js.' : 'Conecte-se à internet e abra o app de novo.'}</p>
        <button class="btn" onclick="location.reload()">Tentar de novo</button></div></div></div>`;
      return;
    }
    if (S.user) {
      // entra direto com o usuário guardado; confere a sessão quando houver internet
      carregarDoAparelho();
      shell(); render(true);
      if (navigator.onLine) {
        try { await sessao(); const u = await rpc('pgo_eu'); if (!u || !u.id) { localStorage.removeItem('pgo.usuario'); S.user = null; return telaLogin('Entre de novo com o seu nome e senha.'); } S.user = u; gravar('pgo.usuario', u); }
        catch (e) { if (!redeErro(e)) console.warn(e); }
        await Promise.all([carregarValores(), enviarFila()]); await carregarDados(); render();
      }
      return;
    }
    telaLogin();
  }
  boot();
})();
