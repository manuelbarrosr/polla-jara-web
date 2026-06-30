/* ============================================================
   stats.js — cálculo de estadísticas de la polla (compartido)
   Lo usan estadisticas.html (página completa) e index.html (tarjeta).
   Requiere window.sb (cliente Supabase) ya inicializado.
   ============================================================ */

// Traducción de países al español SOLO para esta vista/tarjeta (no toca la base ni la llave).
window.ES_PAIS = {
  'Germany':'Alemania','Paraguay':'Paraguay','France':'Francia','Sweden':'Suecia',
  'South Africa':'Sudáfrica','Canada':'Canadá','Netherlands':'Países Bajos','Morocco':'Marruecos',
  'Portugal':'Portugal','Croatia':'Croacia','Spain':'España','Austria':'Austria',
  'United States':'Estados Unidos','USA':'Estados Unidos','Bosnia-Herzegovina':'Bosnia y Herzegovina',
  'Belgium':'Bélgica','Senegal':'Senegal','Brazil':'Brasil','Japan':'Japón',
  'Ivory Coast':'Costa de Marfil','Norway':'Noruega','Mexico':'México','Ecuador':'Ecuador',
  'England':'Inglaterra','Congo DR':'RD Congo','DR Congo':'RD Congo','Argentina':'Argentina',
  'Cape Verde':'Cabo Verde','Australia':'Australia','Egypt':'Egipto','Switzerland':'Suiza',
  'Algeria':'Argelia','Colombia':'Colombia','Ghana':'Ghana','Italy':'Italia','Uruguay':'Uruguay',
  'Chile':'Chile','Peru':'Perú','Bolivia':'Bolivia','Venezuela':'Venezuela','Nigeria':'Nigeria',
  'Cameroon':'Camerún','Tunisia':'Túnez','South Korea':'Corea del Sur','Korea Republic':'Corea del Sur',
  'Saudi Arabia':'Arabia Saudita','Iran':'Irán','Qatar':'Catar','Iraq':'Irak','Jordan':'Jordania',
  'United Arab Emirates':'Emiratos Árabes Unidos','Uzbekistan':'Uzbekistán','New Zealand':'Nueva Zelanda',
  'Denmark':'Dinamarca','Poland':'Polonia','Serbia':'Serbia','Ukraine':'Ucrania','Scotland':'Escocia',
  'Wales':'Gales','Turkey':'Turquía','Greece':'Grecia','Czech Republic':'Chequia','Romania':'Rumania',
  'Hungary':'Hungría','Slovakia':'Eslovaquia','Slovenia':'Eslovenia','Costa Rica':'Costa Rica',
  'Panama':'Panamá','Honduras':'Honduras','Jamaica':'Jamaica','Mali':'Malí','Burkina Faso':'Burkina Faso',
};
window.tEquipo = name => (window.ES_PAIS[name] || name || '');

window.computePollaStats = async function(){
  const [cfgR, msR, psR, spR, tsR, entR] = await Promise.all([
    sb.from('config').select('key,value'),
    sb.from('matches').select('id,round,home_team,away_team,home_score,away_score,status'),
    sb.from('predictions').select('entry_id,match_id,home_pred,away_pred'),
    sb.from('special_predictions').select('champion,runner_up,third,mvp,top_scorer'),
    sb.from('teams').select('name,crest'),
    sb.from('entries').select('id,nombre,user_id'),
  ]);

  const C = Object.fromEntries((cfgR.data||[]).map(c=>[c.key, c.value]));
  const P = { unique:+(C.pts_unique??9), exact:+(C.pts_exact??5), tend:+(C.pts_tendencia??2), gol:+(C.pts_gol??1) };
  const TICKET_PRICE = 2500;

  const matches  = msR.data || [];
  const preds    = psR.data || [];
  const specials = spR.data || [];
  const crest    = Object.fromEntries((tsR.data||[]).map(t=>[t.name, t.crest]));
  const entries  = entR.data || [];
  const nameById = Object.fromEntries(entries.map(e=>[e.id, e.nombre]));
  const mById    = Object.fromEntries(matches.map(m=>[m.id, m]));
  const T        = window.tEquipo;   // traducción de país (solo para estas etiquetas)

  const isFin = m => m && m.status==='FINISHED' && m.home_score!=null && m.away_score!=null;
  const finished = matches.filter(isFin);

  // cuántos pusieron el marcador exacto en cada partido terminado (para "única")
  const nExact = {};
  finished.forEach(m=>{
    nExact[m.id] = preds.filter(p=>p.match_id===m.id && p.home_pred===m.home_score && p.away_pred===m.away_score).length;
  });

  // evalúa una predicción contra el resultado real (120')
  function evalPred(p, m){
    const ph=p.home_pred, pa=p.away_pred, hs=m.home_score, as=m.away_score;
    if(ph===hs && pa===as){
      const uni = nExact[m.id]===1;
      return { pts: uni?P.unique:P.exact, exact:true, unique:uni, tendOk:true, golOk:true };
    }
    let pts=0, tendOk=false, golOk=false;
    if(Math.sign(ph-pa)===Math.sign(hs-as)){ pts+=P.tend; tendOk=true; }
    if(ph===hs || pa===as){ pts+=P.gol; golOk=true; }
    return { pts, exact:false, unique:false, tendOk, golOk };
  }

  // acumuladores
  const catPts = { unica:0, exacto:0, tend:0, gol:0 };   // puntos por origen
  const byEntry = {};   // id -> {pts, exacts, uniques, fin, scored}
  const byMatch = {};   // id -> {total, scored, tend, exact}
  let best = null;      // mejor predicción individual
  const E = id => byEntry[id] || (byEntry[id] = {pts:0, exacts:0, uniques:0, fin:0, scored:0});
  const M = id => byMatch[id] || (byMatch[id] = {total:0, scored:0, tend:0, exact:0});

  preds.forEach(p=>{
    const m = mById[p.match_id];
    if(!isFin(m)) return;
    const r = evalPred(p, m);
    const e = E(p.entry_id);
    e.fin++; e.pts += r.pts;
    if(r.exact){ e.exacts++; if(r.unique) e.uniques++; }
    if(r.pts>0) e.scored++;

    if(r.exact && r.unique) catPts.unica  += P.unique;
    else if(r.exact)        catPts.exacto += P.exact;
    else { if(r.tendOk) catPts.tend += P.tend; if(r.golOk) catPts.gol += P.gol; }

    const mm = M(p.match_id);
    mm.total++; if(r.pts>0) mm.scored++; if(r.tendOk) mm.tend++; if(r.exact) mm.exact++;

    if(!best || r.pts>best.pts){
      best = { pts:r.pts, nombre:nameById[p.entry_id]||'—',
               label:`${T(m.home_team)} ${m.home_score}-${m.away_score} ${T(m.away_team)}` };
    }
  });

  // superlativos
  const entryArr = Object.entries(byEntry).map(([id,v])=>({ id:+id, nombre:nameById[+id]||'—', ...v }));
  const maxBy = (arr, f, guard) => arr.filter(guard||(()=>true)).sort((a,b)=> f(b)-f(a))[0] || null;
  const MINFIN = 4;
  const masUnicas  = maxBy(entryArr, e=>e.uniques, e=>e.uniques>0);
  const masExactos = maxBy(entryArr, e=>e.exacts,  e=>e.exacts>0);
  const masCertero = maxBy(entryArr.map(e=>({ ...e, rate: e.fin? e.scored/e.fin : 0 })),
                           e=>e.rate, e=>e.fin>=MINFIN);

  // análisis por partido
  const matchArr = Object.entries(byMatch).map(([id,v])=>{
    const m = mById[+id];
    return { id:+id, ...v,
      label:`${T(m.home_team)} ${m.home_score}-${m.away_score} ${T(m.away_team)}`,
      home:m.home_team, away:m.away_team, hs:m.home_score, as:m.away_score,
      scoredRate: v.total? v.scored/v.total : 0,
      tendRate:   v.total? v.tend/v.total   : 0,
      exactRate:  v.total? v.exact/v.total  : 0 };
  }).filter(x=>x.total>=1);
  const sortAsc  = f => [...matchArr].sort((a,b)=> f(a)-f(b))[0] || null;
  const sortDesc = f => [...matchArr].sort((a,b)=> f(b)-f(a))[0] || null;
  const masDificil = sortAsc(x=>x.scoredRate);
  const masFacil   = sortDesc(x=>x.scoredRate);
  const sorpresa   = sortAsc(x=>x.tendRate);

  // patrones de apuestas
  const sf = {};
  preds.forEach(p=>{ const k=`${p.home_pred}-${p.away_pred}`; sf[k]=(sf[k]||0)+1; });
  const topScores = Object.entries(sf).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
                          .slice(0,6).map(([k,c])=>({ k, c }));
  const avgPred = preds.length    ? preds.reduce((s,p)=>s+p.home_pred+p.away_pred,0)/preds.length : 0;
  const avgReal = finished.length ? finished.reduce((s,m)=>s+m.home_score+m.away_score,0)/finished.length : 0;

  // especiales: top elegidos por campo
  function topPick(field){
    const f = {}; let tot = 0;
    specials.forEach(s=>{ const v=(s[field]||'').trim(); if(v){ f[v]=(f[v]||0)+1; tot++; } });
    const list = Object.entries(f).sort((a,b)=> b[1]-a[1])
                       .map(([name,c])=>({ name, c, pct: tot? Math.round(c/tot*100) : 0 }));
    return { list, total: tot };
  }

  // KPIs
  const players  = new Set(entries.map(e=>e.user_id)).size;
  const tickets  = entries.length;
  const totalExacts = entryArr.reduce((s,e)=>s+e.exacts, 0);
  const totalPoints = entryArr.reduce((s,e)=>s+e.pts, 0);

  return {
    crest, P,
    kpis: { players, tickets, pozo: tickets*TICKET_PRICE,
            avgPoints: tickets? totalPoints/tickets : 0,
            totalExacts, finishedCount: finished.length },
    catPts,
    superlativos: { masUnicas, masExactos, masCertero, mejorPartido: best },
    partidos: { masDificil, masFacil, sorpresa },
    apuestas: { topScores, avgPred, avgReal },
    especiales: { champions: topPick('champion'), runners: topPick('runner_up'),
                  thirds: topPick('third'), mvps: topPick('mvp'), scorers: topPick('top_scorer') },
  };
};

// Frase rotativa para la tarjeta del inicio (elige una al azar entre las disponibles).
window.pickRotatingStat = function(S){
  const flag = name => { const c = S.crest[name]; return c ? `<img src="${c}" alt="" style="height:1em;vertical-align:-2px;border-radius:2px;margin-right:4px">` : ''; };
  const T = window.tEquipo;
  const opts = [];

  const ch = S.especiales.champions.list;
  if(ch[0]){
    let s = `El <b>${ch[0].pct}%</b> eligió a ${flag(ch[0].name)}${T(ch[0].name)} como campeón`;
    if(ch[1]) s += `, seguido por ${T(ch[1].name)} (${ch[1].pct}%)`;
    opts.push(s + '.');
  }

  const sc = S.apuestas.topScores;
  if(sc[0]){
    let s = `El marcador más pronosticado es <b>${sc[0].k}</b> (${sc[0].c} veces)`;
    if(sc[1]) s += `, seguido del ${sc[1].k} (${sc[1].c} veces)`;
    opts.push(s + '.');
  }

  const sp = S.partidos.sorpresa;
  if(sp) opts.push(`La mayor sorpresa hasta ahora: <b>${sp.label}</b>. Solo el ${Math.round(sp.tendRate*100)}% acertó la tendencia.`);

  if(S.kpis.totalExacts){
    const np = S.kpis.finishedCount;
    opts.push(`Ya van <b>${S.kpis.totalExacts}</b> marcadores exactos clavados en ${np} partido${np===1?'':'s'} jugado${np===1?'':'s'}.`);
  }

  const mv = S.especiales.mvps.list;
  if(mv[0]){
    let s = `El MVP más elegido es <b>${mv[0].name}</b> (${mv[0].pct}%)`;
    if(mv[1]) s += `, seguido por ${mv[1].name} (${mv[1].pct}%)`;
    opts.push(s + '.');
  }

  const gl = S.especiales.scorers.list;
  if(gl[0]){
    let s = `El goleador más elegido es <b>${gl[0].name}</b> (${gl[0].pct}%)`;
    if(gl[1]) s += `, seguido por ${gl[1].name} (${gl[1].pct}%)`;
    opts.push(s + '.');
  }

  if(!opts.length) return 'Pronto habrá datos para mostrar aquí.';
  return opts[Math.floor(Math.random()*opts.length)];
};
