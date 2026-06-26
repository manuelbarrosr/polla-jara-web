// ============================================================
//  APP.JS — helpers compartidos por todas las páginas
// ============================================================

// Usuario logueado (o null)
async function getUser(){
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

// Trae el perfil del usuario. Si no existe, NO está habilitado (no pagó).
async function getProfile(){
  const user = await getUser();
  if(!user) return { user:null, profile:null };
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { user, profile: data || null };
}

// Protege una página: si no hay sesión o no hay perfil, manda al inicio.
async function requireProfile(){
  const { user, profile } = await getProfile();
  if(!user){ location.href = 'index.html'; return null; }
  if(!profile){ location.href = 'index.html'; return null; }
  return { user, profile };
}

async function signOut(){
  await sb.auth.signOut();
  location.href = 'index.html';
}

// Pinta la barra superior con el nombre + cerrar sesión
function paintTopbar(profile){
  const who = document.getElementById('who');
  if(who && profile){
    who.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="signOut()">Cerrar sesión</button>`;
  }
  setupNavPredicciones();
  setupAdminLink(profile);
}

// Agrega la opción "Admin" al menú solo para administradores (is_admin)
function setupAdminLink(profile){
  if(!profile || !profile.is_admin) return;
  const nav = document.querySelector('.topbar nav');
  if(!nav || nav.querySelector('.nav-admin')) return;
  const a = document.createElement('a');
  a.href = 'admin.html';
  a.className = 'nav-admin';
  a.textContent = 'Admin';
  nav.appendChild(a);
}

// Arma el ítem "Mi ticket" del menú según los tickets del usuario:
//  · 0 tickets  -> manda al inicio
//  · 1 ticket   -> link directo a esa planilla
//  · 2 o más    -> menú desplegable con cada ticket
async function setupNavPredicciones(){
  const host = document.getElementById('nav-predicciones');
  if(!host) return;
  const user = await getUser();
  if(!user) return;

  const { data } = await sb.from('entries').select('id,nombre').eq('user_id', user.id).order('id');
  const tickets = data || [];

  if(tickets.length === 0){
    host.innerHTML = '<a href="index.html#tickets">Mi ticket</a>';
    return;
  }
  if(tickets.length === 1){
    host.innerHTML = `<a href="predicciones.html?ticket=${tickets[0].id}">Mi ticket</a>`;
    return;
  }

  host.innerHTML =
    `<button type="button" class="navdrop-btn">Mis tickets ▾</button>
     <div class="navdrop-menu">
       ${tickets.map((t,i)=>`<a href="predicciones.html?ticket=${t.id}">${escapeHtml(t.nombre || ('Ticket '+(i+1)))}</a>`).join('')}
     </div>`;
  const btn = host.querySelector('.navdrop-btn');
  btn.addEventListener('click', e=>{ e.stopPropagation(); host.classList.toggle('open'); });
  document.addEventListener('click', ()=> host.classList.remove('open'));
}

// Escapa texto para evitar romper el HTML
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
