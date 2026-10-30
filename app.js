/* =========================================================
   PGO Digital — Apontamento de produção
   Home › Apontamento | Diárias | Horas Paradas | Meus lançamentos
   Login por nome e senha; cada usuário vê só os próprios dados.
   Equipes, fazendas/talhões e insumos vêm das planilhas do Google (config.js).
   Sem internet: o lançamento fica no aparelho e é enviado sozinho depois.
   ========================================================= */
(function () {
  'use strict';

  // ---------- Configuração ----------
  const CFG = window.PGO_CONFIG || {};
  const COMPRAS = window.APP_CONFIG || {};
  const URL_SB = (CFG.SUPABASE_URL || COMPRAS.SUPABASE_URL || '').trim();
  const KEY_SB = (CFG.SUPABASE_ANON_KEY || COMPRAS.SUPABASE_ANON_KEY || '').trim();
  const configurado = /^https:\/\//.test(URL_SB) && KEY_SB.length > 20 && !/SEU-PROJETO|COLE_AQUI/.test(URL_SB + KEY_SB);
  const PLANILHAS = CFG.PLANILHAS || {};
  const MOTIVOS = (CFG.MOTIVOS && CFG.MOTIVOS.length) ? CFG.MOTIVOS : ['Chuva', 'Manutenção / quebra de máquina', 'Outros'];

  // ---------- Utilidades ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => new Date().toLocaleDateString('sv-SE');
  const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE'); };
  const dataBR = (d) => { if (!d) return '—'; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; };
  const diaSemana = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const num = (n, dec) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: dec == null ? 3 : dec });
  const lerNum = (s) => { s = String(s == null ? '' : s).trim().replace(/\s/g, ''); if (!s) return null; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const igual = (a, b) => semAcento(String(a || '').trim()) === semAcento(String(b || '').trim());
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const hhmm = (t) => String(t || '').slice(0, 5);
  function minutos(i, f) {
    if (!i || !f) return 0;
    const [a, b] = i.split(':').map(Number), [c, d] = f.split(':').map(Number);
    let m = (c * 60 + d) - (a * 60 + b); if (m < 0) m += 1440; return m;
  }
  const duracao = (m) => { m = Math.round(m); const hh = Math.floor(m / 60), mm = m % 60; return hh ? `${hh}h${mm ? String(mm).padStart(2, '0') : ''}` : `${mm} min`; };
  const ordenarUP = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? padrao : v; } catch (_) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  const P = {
    apont: 'M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1zM9 12l2 2 4-4M8 17h8',
    diaria: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    parada: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6',
    lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    voltar: 'M15 6l-6 6 6 6', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', chev: 'M9 6l6 6-6 6',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', sair: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10',
    menu: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    lixo: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
    nuvem: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z', olho: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    mapa: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

  function toast(msg, tipo, tempo) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), tempo || 4500);
  }
  function dialogo(html) {
    const d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d);
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
    if (/could not find the function|does not exist|schema cache/i.test(m)) return 'O banco ainda não tem as tabelas do PGO. Rode o arquivo pgo.sql no SQL Editor do Supabase.';
    if (/JWT|refresh token/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    return m;
  }

  // ---------- Estado ----------
  const S = {
    sb: null, user: ler('pgo.usuario', null),
    base: ler('pgo.base', { equipes: [], fazendas: [], insumos: [], em: null }),
    dados: { apontamentos: [], diarias: [], paradas: [] },
    filtro: { aba: 'apontamentos', periodo: '30', busca: '' },
    enviando: false,
  };
  const chaveFila = () => 'pgo.fila.' + (S.user ? S.user.id : '');
  const fila = () => ler(chaveFila(), []);
  const salvarFila = (f) => gravar(chaveFila(), f);
  const app = () => $('#app');

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
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0&_=${Date.now()}`);
    if (!r.ok) throw new Error('planilha ' + r.status);
    return lerCSV(await r.text());
  }
  async function carregarBase() {
    try {
      const [eq, fz, ins] = await Promise.all([planilha(PLANILHAS.equipes), planilha(PLANILHAS.fazendas), planilha(PLANILHAS.insumos)]);
      S.base = {
        equipes: eq.map((r) => ({ cdc: r.cdc, equipe: r.equipe, tipo: /mec/i.test(r.tipo) ? 'Mecanizado' : /man/i.test(r.tipo) ? 'Manual' : (r.tipo || '') })).filter((r) => r.equipe),
        fazendas: fz.map((r) => ({ cdc: r.cdc, fazenda: r.fazenda, up: r.up || r.talhao, area: lerNum(r.area) })).filter((r) => r.fazenda && r.up),
        insumos: ins.map((r) => ({ cdc: r.cdc, insumo: r.insumo })).filter((r) => r.insumo),
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
  const cdcs = () => [...new Set([...S.base.equipes, ...S.base.fazendas, ...S.base.insumos].map((r) => r.cdc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const areaDe = (fz, up) => { const t = S.base.fazendas.find((r) => r.fazenda === fz && String(r.up) === String(up)); return t ? t.area : null; };

  // ---------- Lançamentos (servidor + fila do aparelho) ----------
  async function carregarDados() {
    if (!S.sb || !navigator.onLine) return false;
    try {
      const [a, d, p] = await Promise.all([
        S.sb.from('pgo_apontamentos').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(500),
        S.sb.from('pgo_diarias').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(800),
        S.sb.from('pgo_horas_paradas').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(800),
      ]);
      for (const r of [a, d, p]) if (r.error) throw r.error;
      S.dados = { apontamentos: a.data, diarias: d.data, paradas: p.data };
      gravar('pgo.dados.' + S.user.id, S.dados);
      return true;
    } catch (e) { if (!redeErro(e)) console.warn(e); return false; }
  }
  // junta o que já está no servidor com o que ainda está na fila
  function visao() {
    const v = { apontamentos: S.dados.apontamentos.slice(), diarias: S.dados.diarias.slice(), paradas: S.dados.paradas.slice() };
    for (const it of fila()) {
      const p = Object.assign({}, it.dados, { _fila: true, _erro: it.erro || null, usuario_id: S.user.id, criado_em: it.criado });
      if (it.tipo === 'apontamento') {
        if (v.apontamentos.some((x) => x.id === p.id)) continue;
        v.apontamentos.unshift(p);
        (p.diarias || []).forEach((x) => v.diarias.unshift(Object.assign({}, x, { _fila: true, apontamento_id: p.id, data: p.data, criado_em: it.criado })));
        (p.paradas || []).forEach((x) => v.paradas.unshift(Object.assign({ fazenda: p.fazenda, up: p.up }, x, { _fila: true, apontamento_id: p.id, data: p.data, criado_em: it.criado })));
      } else if (it.tipo === 'diaria') { if (!v.diarias.some((x) => x.id === p.id)) v.diarias.unshift(p); }
      else if (it.tipo === 'parada') { if (!v.paradas.some((x) => x.id === p.id)) v.paradas.unshift(p); }
    }
    return v;
  }
  const FUNCAO = { apontamento: 'pgo_salvar_apontamento', diaria: 'pgo_salvar_diaria', parada: 'pgo_salvar_parada' };
  async function lancar(tipo, dados) {
    const f = fila(); f.push({ tipo, dados, criado: new Date().toISOString() }); salvarFila(f);
    await enviarFila(true);
    return !fila().some((x) => x.dados.id === dados.id && !x.erro);   // true = já chegou ao servidor
  }
  async function enviarFila(silencioso) {
    if (S.enviando || !S.sb || !navigator.onLine || !S.user) { barra(); return; }
    S.enviando = true; barra();
    try {
      await sessao();
      for (const it of fila()) {
        if (it.erro) continue;
        try {
          await rpc(FUNCAO[it.tipo], { p: it.dados });
          salvarFila(fila().filter((x) => x.dados.id !== it.dados.id));
        } catch (e) {
          if (redeErro(e)) break;
          if (/Faça login novamente|sessão|JWT/i.test(e.message || '')) { break; }
          salvarFila(fila().map((x) => (x.dados.id === it.dados.id ? Object.assign({}, x, { erro: msgErro(e) }) : x)));
          if (!silencioso) toast('Um lançamento foi recusado: ' + msgErro(e), 'erro', 9000);
        }
      }
      await carregarDados();
    } catch (e) { if (!redeErro(e)) console.warn(e); }
    finally { S.enviando = false; barra(); if (rotaAtual() === 'lancamentos' || rotaAtual() === 'home') render(); }
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
  function entrou(u) {
    S.user = u; gravar('pgo.usuario', u); gravar('pgo.ultimo_nome', u.nome);
    S.dados = ler('pgo.dados.' + u.id, { apontamentos: [], diarias: [], paradas: [] });
    shell(); location.hash = '#/home'; render(true);
    carregarDados().then(() => render());
    enviarFila();
  }
  async function sair() {
    const n = fila().filter((x) => !x.erro).length;
    if (n) { toast(`Há ${n} lançamento(s) esperando internet. Conecte-se para enviar antes de sair.`, 'erro', 8000); return; }
    if (!(await confirmar('Sair do PGO Digital?', 'No próximo acesso, entre com o seu nome e senha.', 'Sair'))) return;
    try { if (navigator.onLine) await rpc('pgo_sair'); } catch (_) {}
    try { await S.sb.auth.signOut(); } catch (_) {}
    try { localStorage.removeItem('pgo.usuario'); localStorage.removeItem('pgo.dados.' + S.user.id); } catch (_) {}
    S.user = null; S.dados = { apontamentos: [], diarias: [], paradas: [] };
    location.hash = ''; telaLogin();
  }

  // =========================================================
  //   Estrutura e rotas
  // =========================================================
  const TITULOS = { home: 'Início', apontamento: 'Apontamento', diaria: 'Diária', parada: 'Hora parada', lancamentos: 'Meus lançamentos' };
  function shell() {
    app().innerHTML = `
      <header class="topbar"><a class="menu-btn" href="../APP-menu/" aria-label="Voltar ao menu dos apps" title="Menu dos apps">${ic('menu', 18)}<span>Menu</span></a>
        <div class="brand"><span class="tag">PGO Digital</span></div>
        <div class="spacer"></div>
        <span class="net" id="net" hidden></span>
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
  const rotaAtual = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return TITULOS[r] ? r : 'home'; };
  window.addEventListener('hashchange', () => render(true));
  window.addEventListener('beforeunload', (e) => { if ($('form[data-sujo="1"]')) { e.preventDefault(); e.returnValue = ''; } });

  function render(trocou) {
    if (!S.user || !$('#view')) return;
    const r = rotaAtual(); const view = $('#view');
    if (!trocou && view.dataset.rota === r && $('form[data-sujo="1"]', view)) return;   // não apaga o que está sendo digitado
    const mudou = view.dataset.rota !== r; view.dataset.rota = r;
    ({ home: vHome, apontamento: vApontamento, diaria: vDiaria, parada: vParada, lancamentos: vLancamentos })[r](view);
    if (mudou) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  }
  const cabecalho = (titulo, sub) => `<div class="sub-head"><a class="btn btn-ghost btn-sm" href="#/home">${ic('voltar', 18)} Início</a></div>
    <div class="page-head"><div><h1>${h(titulo)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;

  // =========================================================
  //   Home
  // =========================================================
  function vHome(view) {
    const v = visao(); const hj = hoje();
    const deHoje = (l) => l.filter((x) => String(x.data).slice(0, 10) === hj).length;
    const minParadoHoje = v.paradas.filter((x) => String(x.data).slice(0, 10) === hj).reduce((s, x) => s + minutos(hhmm(x.hora_inicio), hhmm(x.hora_fim)), 0);
    const f = fila(); const comErro = f.filter((x) => x.erro).length;
    view.innerHTML = `
      <div class="ola"><p class="muted">${h(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</p>
        <h1>Olá, ${h(S.user.nome.split(' ')[0])}</h1><p class="muted">${h(S.user.cdc)}</p></div>
      ${comErro ? `<a class="alert alert-erro" href="#/lancamentos">${comErro} lançamento(s) recusado(s). Toque para ver.</a>` : ''}
      <div class="hoje">
        <div><b>${deHoje(v.apontamentos)}</b><span>${deHoje(v.apontamentos) === 1 ? 'apontamento' : 'apontamentos'} hoje</span></div>
        <div><b>${deHoje(v.diarias)}</b><span>${deHoje(v.diarias) === 1 ? 'diária' : 'diárias'} hoje</span></div>
        <div><b>${minParadoHoje ? duracao(minParadoHoje) : '0'}</b><span>parado hoje</span></div>
      </div>
      <nav class="atalhos" aria-label="Lançar">
        <a class="atalho a1" href="#/apontamento"><span class="ico">${ic('apont', 30)}</span><b>Apontamento</b><small>Equipe, estrutura do dia, local, diárias, insumos e paradas</small></a>
        <a class="atalho a2" href="#/diaria"><span class="ico">${ic('diaria', 30)}</span><b>Diárias</b><small>Serviço por diária com horário</small></a>
        <a class="atalho a3" href="#/parada"><span class="ico">${ic('parada', 30)}</span><b>Horas Paradas</b><small>Motivo e horário da parada</small></a>
        <a class="atalho a4" href="#/lancamentos"><span class="ico">${ic('lista', 30)}</span><b>Meus lançamentos</b><small>Ver tudo o que você lançou</small></a>
      </nav>
      ${S.base.em ? '' : '<p class="alert alert-warn">Ainda não consegui ler as planilhas de equipes, fazendas e insumos. Conecte-se à internet.</p>'}`;
  }

  // =========================================================
  //   Componentes de formulário
  // =========================================================
  // Escolher de uma lista com barra de pesquisa
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
  function ligarContadores(raiz, aoMudar) {
    $$('[data-mais],[data-menos]', raiz).forEach((b) => (b.onclick = () => {
      const i = $('#' + (b.dataset.mais || b.dataset.menos), raiz); const v = parseInt(i.value, 10) || 0;
      i.value = Math.max(0, v + (b.dataset.mais ? 1 : -1)); i.dispatchEvent(new Event('input', { bubbles: true })); aoMudar && aoMudar();
    }));
  }
  const intDe = (raiz, id) => { const t = String($('#' + id, raiz)?.value || '').trim(); if (!t) return null; const n = Number(t.replace(',', '.')); return Number.isInteger(n) && n >= 0 ? n : NaN; };
  const horasHTML = (pfx, i, f) => `<div class="grid-2"><div class="field"><label for="${pfx}-hi">Hora de início</label><input id="${pfx}-hi" class="input" type="time" value="${h(i || '')}"></div>
    <div class="field"><label for="${pfx}-hf">Hora final</label><input id="${pfx}-hf" class="input" type="time" value="${h(f || '')}"></div></div>
    <p class="dur" id="${pfx}-dur"></p>`;
  function ligarHoras(raiz, pfx) {
    const at = () => { const i = $('#' + pfx + '-hi', raiz).value, f = $('#' + pfx + '-hf', raiz).value; const el = $('#' + pfx + '-dur', raiz);
      el.textContent = i && f && i !== f ? 'Duração: ' + duracao(minutos(i, f)) + (f < i ? ' (passa da meia-noite)' : '') : ''; };
    $('#' + pfx + '-hi', raiz).addEventListener('input', at); $('#' + pfx + '-hf', raiz).addEventListener('input', at); at();
  }
  function conferirHoras(i, f, pre) {
    if (!i) return `${pre}Informe a hora de início.`;
    if (!f) return `${pre}Informe a hora final.`;
    if (i === f) return `${pre}A hora final precisa ser diferente da inicial.`;
    return null;
  }
  async function concluir(form, tipo, dados, msgOk) {
    const bt = $('button[type="submit"], .btn-salvar', form); bt.disabled = true; const txt = bt.innerHTML; bt.textContent = 'Salvando…';
    try {
      const chegou = await lancar(tipo, dados);
      const recusado = fila().find((x) => x.dados.id === dados.id && x.erro);
      if (recusado) {   // o servidor recusou: tira da fila e mostra o motivo no formulário
        salvarFila(fila().filter((x) => x.dados.id !== dados.id));
        bt.disabled = false; bt.innerHTML = txt; barra();
        $('.form-error', form).textContent = recusado.erro; return;
      }
      delete form.dataset.sujo;
      toast(chegou ? msgOk : 'Sem internet: o lançamento ficou guardado no aparelho e será enviado sozinho.', chegou ? 'in' : '', 6000);
      location.hash = '#/home';
    } catch (e) { bt.disabled = false; bt.innerHTML = txt; $('.form-error', form).textContent = msgErro(e); }
  }

  // =========================================================
  //   Apontamento
  // =========================================================
  function vApontamento(view) {
    const A = { fazenda: '', up: '', equipe: '', tipo: '', diarias: [], insumos: [], paradas: [] };
    view.innerHTML = cabecalho('Apontamento', 'Lançamento do dia da equipe.') + `
      <form id="f-ap" class="stack" novalidate>
        <section class="panel">
          <div class="grid-2 stack-sm"><div class="field"><label for="ap-data">Data</label><input id="ap-data" type="date" class="input" value="${hoje()}" max="${hoje()}"></div>
          <div id="ap-eq-box"></div></div>
        </section>
        <section class="panel"><h2>Estrutura do dia</h2><div id="ap-estr"><p class="muted">Escolha a equipe para preencher a estrutura.</p></div></section>
        <section class="panel"><h2>Local</h2><div id="ap-local"></div></section>
        <section class="panel"><div class="sec-head"><h2>Diárias</h2><button type="button" class="btn btn-ghost btn-sm" id="ap-add-di">${ic('plus', 18)} Adicionar diária</button></div><div id="ap-di" class="itens"></div></section>
        <section class="panel"><div class="sec-head"><h2>Insumos</h2><button type="button" class="btn btn-ghost btn-sm" id="ap-add-in">${ic('plus', 18)} Adicionar insumo</button></div><div id="ap-in" class="itens"></div></section>
        <section class="panel"><div class="sec-head"><h2>Horas paradas</h2><button type="button" class="btn btn-ghost btn-sm" id="ap-add-pa">${ic('plus', 18)} Adicionar parada</button></div><div id="ap-pa" class="itens"></div></section>
        <section class="panel">
          <div class="field"><label for="ap-obs">Observação</label><textarea id="ap-obs" class="input" placeholder="Algo importante sobre o dia"></textarea></div>
          <p class="form-error" role="alert"></p>
          <button class="btn btn-block btn-salvar" type="submit">Salvar apontamento</button>
        </section>
      </form>`;
    const form = $('#f-ap', view);
    const sujo = () => { form.dataset.sujo = '1'; $('.form-error', form).textContent = ''; };
    form.addEventListener('input', sujo);

    // Equipe
    const eqBox = () => {
      const e = equipes().find((x) => x.equipe === A.equipe);
      $('#ap-eq-box', view).innerHTML = campoEscolha('ap-eq', 'Equipe', A.equipe, equipes().length ? 'Escolher equipe' : 'Sem equipes para o seu CDC', e ? e.tipo : '');
      $('#ap-eq', view).onclick = async () => {
        const v = await escolher('Equipe', equipes().map((x) => ({ v: x.equipe, t: x.equipe, sub: x.tipo })), A.equipe);
        if (v != null) { const x = equipes().find((q) => q.equipe === v); A.equipe = v; A.tipo = x ? x.tipo : ''; eqBox(); estrutura(); sujo(); }
      };
    };
    // Estrutura do dia: manual = pessoas; mecanizado = máquinas
    const estrutura = () => {
      const el = $('#ap-estr', view);
      if (!A.equipe) { el.innerHTML = '<p class="muted">Escolha a equipe para preencher a estrutura.</p>'; return; }
      if (A.tipo === 'Mecanizado') {
        el.innerHTML = `<p class="muted small">Equipe mecanizada: quantidade de máquinas no dia.</p><div class="contadores">
          ${contador('ap-tm', 'Trator médio')}${contador('ap-tp', 'Trator pesado')}${contador('ap-cam', 'Caminhão')}${contador('ap-dro', 'Drone')}</div>`;
      } else {
        el.innerHTML = `<p class="muted small">Equipe ${A.tipo === 'Manual' ? 'manual' : ''}: pessoas no dia.</p><div class="contadores">
          ${contador('ap-col', 'Colaboradores')}${contador('ap-fal', 'Faltas')}${contador('ap-fer', 'Férias')}</div><p class="presentes" id="ap-pres"></p>`;
        const pres = () => { const c = intDe(view, 'ap-col') || 0, f = intDe(view, 'ap-fal') || 0, r = intDe(view, 'ap-fer') || 0; const el2 = $('#ap-pres', view);
          el2.textContent = c ? `Presentes: ${Math.max(0, c - f - r)} de ${c}` : ''; el2.classList.toggle('erro', f + r > c && c > 0); };
        $$('#ap-col,#ap-fal,#ap-fer', view).forEach((i) => i.addEventListener('input', pres));
        ligarContadores(el, pres); pres(); return;
      }
      ligarContadores(el);
    };
    // Local principal
    ligarLocal(view, 'ap', A, () => { sujo(); });

    // Diárias dentro do apontamento
    const desenharDiarias = () => {
      const box = $('#ap-di', view);
      box.innerHTML = A.diarias.length ? A.diarias.map((d, i) => `<div class="item" data-i="${i}">
        <div class="item-head"><b>Diária ${i + 1}</b><button type="button" class="icon-btn" data-rm-di="${i}" aria-label="Remover diária ${i + 1}">${ic('lixo', 18)}</button></div>
        <div id="di${i}-local"></div>
        <div class="field"><label for="di${i}-txt">Diária</label><input id="di${i}-txt" class="input" value="${h(d.diaria || '')}" placeholder="Ex.: limpeza de aceiro, roçada manual"></div>
        ${horasHTML('di' + i, d.hora_inicio, d.hora_fim)}</div>`).join('') : '<p class="muted small">Nenhuma diária neste apontamento.</p>';
      A.diarias.forEach((d, i) => {
        ligarLocal(view, 'di' + i, d, sujo); ligarHoras(view, 'di' + i);
        $('#di' + i + '-txt', view).oninput = (e) => { d.diaria = e.target.value; };
        $('#di' + i + '-hi', view).addEventListener('input', (e) => { d.hora_inicio = e.target.value; });
        $('#di' + i + '-hf', view).addEventListener('input', (e) => { d.hora_fim = e.target.value; });
      });
      $$('[data-rm-di]', view).forEach((b) => (b.onclick = () => { A.diarias.splice(+b.dataset.rmDi, 1); desenharDiarias(); sujo(); }));
    };
    $('#ap-add-di', view).onclick = () => { A.diarias.push({ id: uuid(), fazenda: A.fazenda, up: A.up, diaria: '', hora_inicio: '', hora_fim: '' }); desenharDiarias(); sujo(); $(`#di${A.diarias.length - 1}-txt`, view).focus(); };

    // Insumos
    const desenharInsumos = () => {
      const box = $('#ap-in', view); const lista = insumos();
      box.innerHTML = A.insumos.length ? A.insumos.map((x, i) => `<div class="item linha-in">
        <div class="field"><label for="in${i}-n">Insumo</label><select id="in${i}-n" class="input"><option value="">Selecione</option>${lista.map((n) => `<option ${n === x.insumo ? 'selected' : ''}>${h(n)}</option>`).join('')}</select></div>
        <div class="field"><label for="in${i}-q">Quantidade</label><input id="in${i}-q" class="input" inputmode="decimal" value="${h(x.quantidade || '')}" placeholder="0"></div>
        <button type="button" class="icon-btn" data-rm-in="${i}" aria-label="Remover insumo ${i + 1}">${ic('lixo', 18)}</button></div>`).join('') : `<p class="muted small">Nenhum insumo neste apontamento.${lista.length ? '' : ' (A planilha de insumos não tem itens para o seu CDC.)'}</p>`;
      A.insumos.forEach((x, i) => { $('#in' + i + '-n', view).onchange = (e) => { x.insumo = e.target.value; }; $('#in' + i + '-q', view).oninput = (e) => { x.quantidade = e.target.value; }; });
      $$('[data-rm-in]', view).forEach((b) => (b.onclick = () => { A.insumos.splice(+b.dataset.rmIn, 1); desenharInsumos(); sujo(); }));
    };
    $('#ap-add-in', view).onclick = () => { A.insumos.push({ insumo: '', quantidade: '' }); desenharInsumos(); sujo(); };

    // Horas paradas
    const desenharParadas = () => {
      const box = $('#ap-pa', view);
      box.innerHTML = A.paradas.length ? A.paradas.map((p, i) => `<div class="item" data-i="${i}">
        <div class="item-head"><b>Parada ${i + 1}</b><button type="button" class="icon-btn" data-rm-pa="${i}" aria-label="Remover parada ${i + 1}">${ic('lixo', 18)}</button></div>
        <div class="field"><label for="pa${i}-m">Motivo</label><select id="pa${i}-m" class="input"><option value="">Selecione</option>${MOTIVOS.map((m) => `<option ${m === p.motivo ? 'selected' : ''}>${h(m)}</option>`).join('')}</select></div>
        ${horasHTML('pa' + i, p.hora_inicio, p.hora_fim)}</div>`).join('') : '<p class="muted small">Nenhuma hora parada neste apontamento.</p>';
      A.paradas.forEach((p, i) => {
        ligarHoras(view, 'pa' + i);
        $('#pa' + i + '-m', view).onchange = (e) => { p.motivo = e.target.value; };
        $('#pa' + i + '-hi', view).addEventListener('input', (e) => { p.hora_inicio = e.target.value; });
        $('#pa' + i + '-hf', view).addEventListener('input', (e) => { p.hora_fim = e.target.value; });
      });
      $$('[data-rm-pa]', view).forEach((b) => (b.onclick = () => { A.paradas.splice(+b.dataset.rmPa, 1); desenharParadas(); sujo(); }));
    };
    $('#ap-add-pa', view).onclick = () => { A.paradas.push({ id: uuid(), motivo: '', hora_inicio: '', hora_fim: '' }); desenharParadas(); sujo(); };

    eqBox(); estrutura(); desenharDiarias(); desenharInsumos(); desenharParadas();

    form.onsubmit = (e) => {
      e.preventDefault();
      const err = $('.form-error', form); err.textContent = '';
      const falha = (m, el) => { err.textContent = m; if (el) el.focus(); };
      const data = $('#ap-data', view).value;
      if (!data) return falha('Informe a data.', $('#ap-data', view));
      if (data > hoje()) return falha('A data não pode ser no futuro.', $('#ap-data', view));
      if (!A.equipe) return falha('Escolha a equipe.', $('#ap-eq', view));
      const dados = { id: uuid(), data, equipe: A.equipe, equipe_tipo: A.tipo || null };
      const campos = A.tipo === 'Mecanizado' ? [['trator_medio', 'ap-tm', 'Trator médio'], ['trator_pesado', 'ap-tp', 'Trator pesado'], ['caminhao', 'ap-cam', 'Caminhão'], ['drone', 'ap-dro', 'Drone']]
        : [['colaboradores', 'ap-col', 'Colaboradores'], ['faltas', 'ap-fal', 'Faltas'], ['ferias', 'ap-fer', 'Férias']];
      for (const [k, id, rot] of campos) { const v = intDe(view, id); if (Number.isNaN(v)) return falha(`${rot}: use um número inteiro.`, $('#' + id, view)); dados[k] = v; }
      if ((dados.faltas || 0) + (dados.ferias || 0) > (dados.colaboradores || 0) && (dados.faltas || dados.ferias)) return falha('Faltas + férias não podem passar do número de colaboradores.', $('#ap-fal', view));
      if (!A.fazenda) return falha('Escolha a fazenda.', $('#ap-fz', view));
      if (!A.up) return falha('Escolha o talhão (UP).', $('#ap-up', view));
      Object.assign(dados, { fazenda: A.fazenda, up: A.up, area_ha: areaDe(A.fazenda, A.up) });
      for (let i = 0; i < A.diarias.length; i++) {
        const d = A.diarias[i], pre = `Diária ${i + 1}: `;
        if (!d.fazenda) return falha(pre + 'escolha a fazenda.', $('#di' + i + '-fz', view));
        if (!d.up) return falha(pre + 'escolha o talhão.', $('#di' + i + '-up', view));
        if (!String(d.diaria || '').trim()) return falha(pre + 'escreva a diária.', $('#di' + i + '-txt', view));
        const eh = conferirHoras(d.hora_inicio, d.hora_fim, pre); if (eh) return falha(eh, $('#di' + i + '-hi', view));
      }
      const ins = [];
      for (let i = 0; i < A.insumos.length; i++) {
        const x = A.insumos[i]; if (!x.insumo && !String(x.quantidade || '').trim()) continue;   // linha vazia
        if (!x.insumo) return falha(`Insumo ${i + 1}: escolha o insumo.`, $('#in' + i + '-n', view));
        const q = lerNum(x.quantidade); if (!(q > 0)) return falha(`Insumo ${i + 1}: informe uma quantidade maior que zero.`, $('#in' + i + '-q', view));
        ins.push({ insumo: x.insumo, quantidade: q });
      }
      for (let i = 0; i < A.paradas.length; i++) {
        const p = A.paradas[i], pre = `Parada ${i + 1}: `;
        if (!p.motivo) return falha(pre + 'escolha o motivo.', $('#pa' + i + '-m', view));
        const eh = conferirHoras(p.hora_inicio, p.hora_fim, pre); if (eh) return falha(eh, $('#pa' + i + '-hi', view));
      }
      Object.assign(dados, {
        insumos: ins,
        diarias: A.diarias.map((d) => ({ id: d.id, fazenda: d.fazenda, up: d.up, diaria: d.diaria.trim(), hora_inicio: d.hora_inicio, hora_fim: d.hora_fim })),
        paradas: A.paradas.map((p) => ({ id: p.id, fazenda: A.fazenda, up: A.up, motivo: p.motivo, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim })),
        observacao: $('#ap-obs', view).value.trim() || null,
      });
      concluir(form, 'apontamento', dados, `Apontamento de ${dataBR(data)} salvo.`);
    };
  }

  // =========================================================
  //   Diárias e Horas Paradas (lançamentos soltos)
  // =========================================================
  function vDiaria(view) { vSolto(view, 'diaria'); }
  function vParada(view) { vSolto(view, 'parada'); }
  function vSolto(view, tipo) {
    const dia = tipo === 'diaria';
    const L = { fazenda: '', up: '' };
    view.innerHTML = cabecalho(dia ? 'Diária' : 'Horas paradas', dia ? 'Serviço feito por diária.' : 'Registre o tempo em que a equipe ficou parada.') + `
      <form id="f-so" class="panel" novalidate>
        <div class="field" style="max-width:260px"><label for="so-data">Data</label><input id="so-data" type="date" class="input" value="${hoje()}" max="${hoje()}"></div>
        <div id="so-local"></div>
        ${dia ? `<div class="field"><label for="so-txt">Diária</label><input id="so-txt" class="input" placeholder="Ex.: limpeza de aceiro, roçada manual"></div>`
              : `<div class="field"><label for="so-mot">Motivo</label><select id="so-mot" class="input"><option value="">Selecione</option>${MOTIVOS.map((m) => `<option>${h(m)}</option>`).join('')}</select></div>`}
        ${horasHTML('so')}
        <div class="field"><label for="so-obs">Observações</label><textarea id="so-obs" class="input"></textarea></div>
        <p class="form-error" role="alert"></p>
        <button class="btn btn-block btn-salvar" type="submit">Salvar ${dia ? 'diária' : 'hora parada'}</button>
      </form>`;
    const form = $('#f-so', view);
    form.addEventListener('input', () => { form.dataset.sujo = '1'; $('.form-error', form).textContent = ''; });
    ligarLocal(view, 'so', L, () => { form.dataset.sujo = '1'; });
    ligarHoras(view, 'so');
    form.onsubmit = (e) => {
      e.preventDefault();
      const err = $('.form-error', form); const falha = (m, el) => { err.textContent = m; if (el) el.focus(); };
      const data = $('#so-data', view).value, hi = $('#so-hi', view).value, hf = $('#so-hf', view).value;
      if (!data) return falha('Informe a data.', $('#so-data', view));
      if (data > hoje()) return falha('A data não pode ser no futuro.', $('#so-data', view));
      if (!L.fazenda) return falha('Escolha a fazenda.', $('#so-fz', view));
      if (!L.up) return falha('Escolha o talhão (UP).', $('#so-up', view));
      const dados = { id: uuid(), data, fazenda: L.fazenda, up: L.up, hora_inicio: hi, hora_fim: hf, observacao: $('#so-obs', view).value.trim() || null };
      if (dia) { dados.diaria = $('#so-txt', view).value.trim(); if (!dados.diaria) return falha('Escreva a diária.', $('#so-txt', view)); }
      else { dados.motivo = $('#so-mot', view).value; if (!dados.motivo) return falha('Escolha o motivo.', $('#so-mot', view)); }
      const eh = conferirHoras(hi, hf, ''); if (eh) return falha(eh, $('#so-hi', view));
      concluir(form, tipo, dados, dia ? 'Diária salva.' : 'Hora parada salva.');
    };
  }

  // =========================================================
  //   Meus lançamentos
  // =========================================================
  function vLancamentos(view) {
    const F = S.filtro; const v = visao();
    const desde = F.periodo === 'tudo' ? '0000-00-00' : diasAtras(Number(F.periodo) - 1);
    const q = semAcento(F.busca).trim();
    const passa = (x, txt) => String(x.data).slice(0, 10) >= desde && (!q || q.split(/\s+/).every((t) => semAcento(txt).includes(t)));
    const listas = {
      apontamentos: v.apontamentos.filter((x) => passa(x, [x.equipe, x.fazenda, 'up ' + x.up, x.observacao, ...(x.insumos || []).map((i) => i.insumo)].join(' '))),
      diarias: v.diarias.filter((x) => passa(x, [x.diaria, x.fazenda, 'up ' + x.up, x.observacao].join(' '))),
      paradas: v.paradas.filter((x) => passa(x, [x.motivo, x.fazenda, 'up ' + x.up, x.observacao].join(' '))),
    };
    const ABAS = [['apontamentos', 'Apontamentos'], ['diarias', 'Diárias'], ['paradas', 'Horas paradas']];
    const lista = listas[F.aba];
    const totMin = (l) => l.reduce((s, x) => s + minutos(hhmm(x.hora_inicio), hhmm(x.hora_fim)), 0);
    const resumo = F.aba === 'apontamentos' ? `${lista.length} apontamento(s)` : `${lista.length} lançamento(s) · ${duracao(totMin(lista))} no total`;
    view.innerHTML = cabecalho('Meus lançamentos', 'Só aparecem os lançamentos feitos por você.') + `
      <div class="filtros" role="group" aria-label="Tipo">${ABAS.map(([k, t]) => `<button class="chip" data-aba="${k}" aria-pressed="${F.aba === k}">${t}<span class="n">${listas[k].length}</span></button>`).join('')}</div>
      <div class="tools"><div class="search">${ic('search', 20)}<input type="search" class="input" id="lq" placeholder="Pesquisar equipe, fazenda, UP, motivo…" value="${h(F.busca)}" aria-label="Pesquisar"></div>
        <select class="input periodo" id="lp" aria-label="Período">${[['1', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['tudo', 'Tudo']].map(([k, t]) => `<option value="${k}" ${F.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <p class="resumo-l">${resumo}</p>
      <div id="ll">${lista.length ? agrupar(lista, F.aba) : `<div class="empty"><strong>Nada por aqui</strong>${q ? 'Nenhum lançamento com essa pesquisa.' : 'Nenhum lançamento neste período.'}</div>`}</div>`;
    $$('[data-aba]', view).forEach((b) => (b.onclick = () => { F.aba = b.dataset.aba; render(true); }));
    $('#lp', view).onchange = (e) => { F.periodo = e.target.value; render(true); };
    $('#lq', view).oninput = (e) => { F.busca = e.target.value; clearTimeout(vLancamentos.t); vLancamentos.t = setTimeout(() => { render(true); const i = $('#lq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); };
    $$('[data-abrir]', view).forEach((b) => (b.onclick = () => detalhe(F.aba, b.dataset.abrir)));
  }
  function agrupar(lista, aba) {
    const dias = [...new Set(lista.map((x) => String(x.data).slice(0, 10)))].sort().reverse();
    return dias.map((d) => `<section class="dia"><h2 class="dia-tit">${dataBR(d)} <span>${diaSemana(d)}</span></h2>
      <div class="cartoes">${lista.filter((x) => String(x.data).slice(0, 10) === d).map((x) => cartao(x, aba)).join('')}</div></section>`).join('');
  }
  function etiquetaFila(x) { return x._erro ? '<span class="st erro">Recusado</span>' : x._fila ? `<span class="st fila">${ic('nuvem', 14)} Na fila</span>` : ''; }
  function cartao(x, aba) {
    if (aba === 'apontamentos') {
      const estr = x.equipe_tipo === 'Mecanizado'
        ? [['trator_medio', 'tr. médio'], ['trator_pesado', 'tr. pesado'], ['caminhao', 'caminhão'], ['drone', 'drone']].filter(([k]) => x[k]).map(([k, t]) => `${x[k]} ${t}`).join(' · ')
        : (x.colaboradores ? `${x.colaboradores} colab.${x.faltas ? ` · ${x.faltas} falta(s)` : ''}${x.ferias ? ` · ${x.ferias} férias` : ''}` : '');
      return `<button class="lanc" data-abrir="${h(x.id)}"><span class="l-top"><b>${h(x.equipe)}</b>${etiquetaFila(x)}</span>
        <span class="l-sub">${ic('mapa', 14)} ${h(x.fazenda)} · UP ${h(x.up)}</span>${estr ? `<span class="l-sub">${h(estr)}</span>` : ''}</button>`;
    }
    const m = minutos(hhmm(x.hora_inicio), hhmm(x.hora_fim));
    return `<button class="lanc" data-abrir="${h(x.id)}"><span class="l-top"><b>${h(aba === 'diarias' ? x.diaria : x.motivo)}</b><span class="dur-tag">${duracao(m)}</span>${etiquetaFila(x)}</span>
      <span class="l-sub">${hhmm(x.hora_inicio)}–${hhmm(x.hora_fim)} · ${h(x.fazenda)} · UP ${h(x.up)}${x.apontamento_id ? ' · no apontamento' : ''}</span></button>`;
  }
  function detalhe(aba, id) {
    const v = visao(); const x = v[aba].find((y) => y.id === id); if (!x) return;
    const linha = (r, val) => (val == null || val === '' ? '' : `<div><dt>${h(r)}</dt><dd>${val}</dd></div>`);
    let corpo = '';
    if (aba === 'apontamentos') {
      const di = v.diarias.filter((d) => d.apontamento_id === x.id), pa = v.paradas.filter((p) => p.apontamento_id === x.id);
      corpo = `<dl class="det">${linha('Data', dataBR(x.data))}${linha('Equipe', h(x.equipe) + (x.equipe_tipo ? ` <small>(${h(x.equipe_tipo)})</small>` : ''))}
        ${linha('Local', `${h(x.fazenda)} · UP ${h(x.up)}${x.area_ha ? ` <small>(${num(x.area_ha, 2)} ha)</small>` : ''}`)}
        ${linha('Colaboradores', x.colaboradores)}${linha('Faltas', x.faltas)}${linha('Férias', x.ferias)}
        ${linha('Trator médio', x.trator_medio)}${linha('Trator pesado', x.trator_pesado)}${linha('Caminhão', x.caminhao)}${linha('Drone', x.drone)}
        ${linha('Insumos', (x.insumos || []).map((i) => `${h(i.insumo)}: <b>${num(i.quantidade)}</b>`).join('<br>'))}
        ${linha('Diárias', di.map((d) => `${h(d.diaria)} · ${hhmm(d.hora_inicio)}–${hhmm(d.hora_fim)} (${duracao(minutos(hhmm(d.hora_inicio), hhmm(d.hora_fim)))}) · ${h(d.fazenda)} UP ${h(d.up)}`).join('<br>'))}
        ${linha('Horas paradas', pa.map((p) => `${h(p.motivo)} · ${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)} (${duracao(minutos(hhmm(p.hora_inicio), hhmm(p.hora_fim)))})`).join('<br>'))}
        ${linha('Observação', h(x.observacao))}</dl>`;
    } else {
      corpo = `<dl class="det">${linha('Data', dataBR(x.data))}${linha('Local', `${h(x.fazenda)} · UP ${h(x.up)}`)}
        ${linha(aba === 'diarias' ? 'Diária' : 'Motivo', h(aba === 'diarias' ? x.diaria : x.motivo))}
        ${linha('Horário', `${hhmm(x.hora_inicio)} às ${hhmm(x.hora_fim)} · <b>${duracao(minutos(hhmm(x.hora_inicio), hhmm(x.hora_fim)))}</b>`)}
        ${linha('Lançado', x.apontamento_id ? 'Dentro de um apontamento' : 'Avulso')}${linha('Observações', h(x.observacao))}</dl>`;
    }
    const tipo = { apontamentos: 'apontamento', diarias: 'diaria', paradas: 'parada' }[aba];
    const naFilaSolto = x._fila && !(aba !== 'apontamentos' && x.apontamento_id);
    const dentroDeApont = aba !== 'apontamentos' && x.apontamento_id;
    const d = dialogo(`<div class="dlg"><div class="dlg-head"><h2>${h({ apontamentos: 'Apontamento', diarias: 'Diária', paradas: 'Hora parada' }[aba])}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      ${x._erro ? `<div class="alert alert-erro">O servidor recusou este lançamento: ${h(x._erro)}</div>` : x._fila ? '<div class="alert alert-warn">Ainda não foi enviado: será enviado quando houver internet.</div>' : ''}
      ${corpo}
      <div class="dlg-foot">${dentroDeApont ? '<p class="muted small">Para apagar, exclua o apontamento onde ela foi lançada.</p>'
        : `<button class="btn btn-perigo" data-del>${ic('lixo', 18)} ${naFilaSolto ? 'Descartar' : 'Excluir'}</button>`}</div></div>`);
    $('[data-x]', d).onclick = () => d.close();
    const del = $('[data-del]', d);
    if (del) del.onclick = async () => {
      const extra = aba === 'apontamentos' ? ' As diárias e horas paradas lançadas nele também serão excluídas.' : '';
      if (!(await confirmar('Excluir este lançamento?', 'Não dá para desfazer.' + extra, 'Excluir', true))) return;
      if (x._fila) { salvarFila(fila().filter((y) => y.dados.id !== x.id)); d.close(); barra(); toast('Lançamento descartado.'); render(true); return; }
      if (!navigator.onLine) return toast('Para excluir um lançamento já enviado é preciso internet.', 'erro');
      try { await rpc('pgo_excluir', { p_tipo: tipo, p_id: x.id }); await carregarDados(); d.close(); toast('Lançamento excluído.'); render(true); }
      catch (e) { toast(msgErro(e), 'erro'); }
    };
  }

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
      S.dados = ler('pgo.dados.' + S.user.id, { apontamentos: [], diarias: [], paradas: [] });
      shell(); render(true);
      if (navigator.onLine) {
        try { await sessao(); const u = await rpc('pgo_eu'); if (!u || !u.id) { localStorage.removeItem('pgo.usuario'); S.user = null; return telaLogin('Entre de novo com o seu nome e senha.'); } S.user = u; gravar('pgo.usuario', u); }
        catch (e) { if (!redeErro(e)) console.warn(e); }
        await enviarFila(); await carregarDados(); render();
      }
      return;
    }
    telaLogin();
  }
  boot();
})();
