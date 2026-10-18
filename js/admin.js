/* =========================================================
   ASSET PATHS (only the seed demo cat photos need this)
========================================================= */
const ASSET_PATHS = {
  catCard1: "assets/images/catCard1.png",
  catCard2: "assets/images/catCard2.png",
  catCard3: "assets/images/catCard3.png"
};

/* =========================================================
   API HELPERS (Cloudflare Pages Functions + D1 + R2)
========================================================= */
const DEFAULT_SETTINGS = {
  wishlistUrl:"https://www.amazon.jp/hz/wishlist/ls/",
  signatureUrl:"https://www.change.org/",
  instagramUrl:"https://www.instagram.com/",
  lineUrl:"https://line.me/",
  phone:"090-6610-2948",
  representative:"野田 ひとみ"
};

async function apiRequest(url, method, body){
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body !== undefined ? {"Content-Type":"application/json"} : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try{ data = await res.json(); }catch(e){ /* no body */ }
  if(!res.ok){
    const msg = (data && data.error) ? data.error : `request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function checkSession(){
  try{
    const data = await apiRequest("/api/session", "GET");
    return !!(data && data.loggedIn);
  }catch(e){ return false; }
}

async function loadCats(){
  try{
    return await apiRequest("/api/cats", "GET");
  }catch(e){
    console.error("load cats failed", e);
    return [];
  }
}
async function loadSettings(){
  try{
    return await apiRequest("/api/settings", "GET");
  }catch(e){
    console.error("load settings failed", e);
    return DEFAULT_SETTINGS;
  }
}
async function saveSettings(s){
  return apiRequest("/api/settings", "PUT", s);
}

// クロップ/選択直後の画像は data: URL。保存時にR2へアップロードしてURLへ差し替える。
async function uploadImageIfNeeded(image){
  if(!image || !image.startsWith("data:")) return image;
  const blob = await (await fetch(image)).blob();
  const formData = new FormData();
  formData.append("file", blob, "cat.png");
  const res = await fetch("/api/upload", { method:"POST", credentials:"include", body: formData });
  let data = null;
  try{ data = await res.json(); }catch(e){ /* no body */ }
  if(!res.ok){
    throw new Error((data && data.error) || "画像のアップロードに失敗しました");
  }
  return data.url;
}

/* =========================================================
   APP STATE

/* =========================================================
   APP STATE
========================================================= */
const state = {
  route: "admin-login",
  loggedIn: false,
  cats: [],
  settings: {},
  loading: true,
  adminFilterStatus: "すべて",
  adminFilterGender: "すべて",
  adminPage: 1,
  adminPageSize: 6
};

function showToast(msg){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id="toast"; t.className="toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove("show"), 2200);
}

function scrollToFormOnMobile(){
  if(window.innerWidth <= 880){
    const panel = document.getElementById("cat-form-panel");
    if(panel) panel.scrollIntoView({behavior:"smooth", block:"start"});
  }
}

function go(route){
  state.route = route;
  render();
}

/* =========================================================
   RENDER FUNCTIONS
========================================================= */
function renderLogin(){
  return `
  <div class="login-shell">
    <div class="login-card">
      <h2>ログイン</h2>
      <div class="form-field">
        <label>メールアドレス</label>
        <input type="email" id="login-email" placeholder="admin@example.com">
      </div>
      <div class="form-field">
        <label>パスワード</label>
        <input type="password" id="login-pass">
      </div>
      <div class="login-error" id="login-error"></div>
      <button class="btn btn-primary" id="login-submit">ログイン</button>
    </div>
  </div>`;
}

function renderAdminTopbar(active){
  return `
  <div class="admin-topbar">
    <div class="admin-tabs">
      <button data-route="admin-cats" class="${active==='admin-cats'?'active':''}">猫管理</button>
      <button data-route="admin-settings" class="${active==='admin-settings'?'active':''}">サイト設定</button>
    </div>
    <div class="right-actions">
      <button id="logout-btn">ログアウト</button>
    </div>
  </div>`;
}

function emptyCatForm(){
  return {id:null, image:"", imageOriginal:"", gender:"女の子", status:"募集中", trimming:false};
}
let catFormData = emptyCatForm();

function renderCatForm(){
  const f = catFormData;
  const previewSrc = ASSET_PATHS[f.image] || f.image || "";
  return `
  <div class="admin-panel" id="cat-form-panel">
    <a href="#cat-list-panel" class="mobile-jump-link" id="jump-to-list">▼ 一覧へ戻る</a>
    <h2>編集フォーム${f.id ? "" : "（一覧から選択）"}</h2>
    <div class="form-field">
      <label>画像アップロード</label>
      <label class="upload-box" id="upload-box">
        ${previewSrc ? `<img src="${previewSrc}" alt="">` : `<span class="upload-hint">クリックして画像を選択</span>`}
        <input type="file" id="f-image-file" accept="image/*">
      </label>
    </div>
    <div class="form-field-check">
      <input type="checkbox" id="f-trim" ${f.trimming ? "checked" : ""} ${!f.image ? "disabled" : ""}>
      <label for="f-trim" style="margin:0;">この画像をトリミングする</label>
    </div>
    ${f.trimming && f.image ? `
    <div class="crop-wrap">
      <div class="crop-container" id="crop-container">
        <img id="crop-img" src="${f.imageOriginal || previewSrc}" draggable="false">
        <div class="crop-box" id="crop-box">
          <div class="crop-handle" data-handle="nw"></div>
          <div class="crop-handle" data-handle="ne"></div>
          <div class="crop-handle" data-handle="sw"></div>
          <div class="crop-handle" data-handle="se"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-primary btn-sm" id="apply-crop-btn" style="flex:1;">トリミングを適用</button>
        <button class="btn btn-ghost btn-sm" id="cancel-crop-btn" style="flex:1;">キャンセル</button>
      </div>
    </div>` : ""}
    <div class="form-field">
      <label>ステータス</label>
      <select id="f-status">
        <option ${f.status==="募集中"?"selected":""}>募集中</option>
        <option ${f.status==="里親決定"?"selected":""}>里親決定</option>
      </select>
    </div>
    <div class="form-field">
      <label>性別</label>
      <select id="f-gender">
        <option ${f.gender==="女の子"?"selected":""}>女の子</option>
        <option ${f.gender==="男の子"?"selected":""}>男の子</option>
      </select>
    </div>
    <button class="btn btn-primary" id="save-cat-btn">保存</button>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="cancel-cat-btn" style="flex:1;">${f.id ? "選択解除" : "クリア"}</button>
      ${f.id ? `<button class="btn btn-danger btn-sm" id="delete-cat-btn" style="flex:1;">この猫を削除</button>` : ""}
    </div>
  </div>`;
}

function initCropTool(){
  const container = document.getElementById("crop-container");
  if(!container) return;
  const box = document.getElementById("crop-box");
  const img = document.getElementById("crop-img");

  function setBox(x,y,w,h){
    box.style.left = x+"px"; box.style.top = y+"px";
    box.style.width = w+"px"; box.style.height = h+"px";
  }
  function getBox(){
    return {x:parseFloat(box.style.left), y:parseFloat(box.style.top), w:parseFloat(box.style.width), h:parseFloat(box.style.height)};
  }
  function initSize(){
    const cw = container.clientWidth, ch = container.clientHeight;
    const w = cw*0.6, h = ch*0.6;
    setBox((cw-w)/2, (ch-h)/2, w, h);
  }
  if(img.complete && img.naturalWidth) initSize(); else img.onload = initSize;

  let mode=null, startX=0, startY=0, startBox=null;

  function onDown(handle, e){
    mode = handle;
    startX = e.clientX; startY = e.clientY; startBox = getBox();
    e.preventDefault();
  }
  box.addEventListener("pointerdown", e=>{ onDown("move", e); box.setPointerCapture(e.pointerId); });
  box.querySelectorAll(".crop-handle").forEach(h=>{
    h.addEventListener("pointerdown", e=>{ e.stopPropagation(); onDown(h.dataset.handle, e); h.setPointerCapture(e.pointerId); });
  });
  function onMove(e){
    if(!mode) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    const cw=container.clientWidth, ch=container.clientHeight;
    let {x,y,w,h}=startBox;
    if(mode==="move"){
      x=Math.min(Math.max(0,startBox.x+dx), cw-w);
      y=Math.min(Math.max(0,startBox.y+dy), ch-h);
    } else {
      if(mode.includes("n")){ h=startBox.h-dy; y=startBox.y+dy; }
      if(mode.includes("s")){ h=startBox.h+dy; }
      if(mode.includes("w")){ w=startBox.w-dx; x=startBox.x+dx; }
      if(mode.includes("e")){ w=startBox.w+dx; }
      w=Math.max(40,w); h=Math.max(40,h);
      x=Math.max(0,Math.min(x, cw-w));
      y=Math.max(0,Math.min(y, ch-h));
      w=Math.min(w, cw-x); h=Math.min(h, ch-y);
    }
    setBox(x,y,w,h);
  }
  box.addEventListener("pointermove", onMove);
  box.addEventListener("pointerup", ()=>{ mode=null; });
  box.querySelectorAll(".crop-handle").forEach(h=>{
    h.addEventListener("pointermove", onMove);
    h.addEventListener("pointerup", ()=>{ mode=null; });
  });

  const applyBtn = document.getElementById("apply-crop-btn");
  const cancelBtn = document.getElementById("cancel-crop-btn");
  if(applyBtn) applyBtn.addEventListener("click", ()=>{
    const b = getBox();
    const cw = container.clientWidth, ch = container.clientHeight;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(cw/iw, ch/ih);
    const dispW = iw*scale, dispH = ih*scale;
    const offX = (cw-dispW)/2, offY = (ch-dispH)/2;
    const srcX = Math.max(0,(b.x-offX)/scale);
    const srcY = Math.max(0,(b.y-offY)/scale);
    const srcW = b.w/scale;
    const srcH = b.h/scale;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(srcW);
    canvas.height = Math.round(srcH);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    catFormData.image = canvas.toDataURL("image/png");
    catFormData.trimming = false;
    showToast("トリミングしました");
    render();
  });
  if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ catFormData.trimming = false; render(); });
}

function statusPillClass(status){
  if(status==="里親決定") return "st-done";
  return "st-active";
}

function renderAdminCats(){
  const filtered = state.cats.filter(c=>{
    const okStatus = state.adminFilterStatus==="すべて" || c.status===state.adminFilterStatus;
    const okGender = state.adminFilterGender==="すべて" || c.gender===state.adminFilterGender;
    return okStatus && okGender;
  });
  const pageSize = state.adminPageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize));
  if(state.adminPage > totalPages) state.adminPage = totalPages;
  const startIdx = (state.adminPage-1)*pageSize;
  const pageCats = filtered.slice(startIdx, startIdx+pageSize);

  const rows = pageCats.map(c=>{
    const src = ASSET_PATHS[c.image] || c.image || "";
    const thumb = src ? `<img src="${src}" alt="">` : `<div class="thumb-empty">写真<br>未登録</div>`;
    return `
    <div class="admin-cat-row ${catFormData.id===c.id?'selected':''}" data-select="${c.id}">
      ${thumb}
      <div class="info">${c.gender||""}</div>
      <span class="status-pill ${statusPillClass(c.status)}">${c.status}</span>
    </div>`;
  }).join("");

  const pagBtns = [];
  pagBtns.push(`<button class="nav-btn" id="admin-pg-prev" ${state.adminPage===1?"disabled":""}>‹</button>`);
  for(let i=1;i<=totalPages;i++){
    if(i===1||i===totalPages||Math.abs(i-state.adminPage)<=1){
      pagBtns.push(`<button class="${i===state.adminPage?'active':''}" data-admin-page="${i}">${i}</button>`);
    } else if(!pagBtns[pagBtns.length-1].includes("…")){
      pagBtns.push(`<span style="color:#999;">…</span>`);
    }
  }
  pagBtns.push(`<button class="nav-btn" id="admin-pg-next" ${state.adminPage===totalPages?"disabled":""}>›</button>`);

  return `
  <div class="admin-shell">
    ${renderAdminTopbar("admin-cats")}
    <div class="admin-body">
      <div class="admin-grid">
        <div class="admin-panel" id="cat-list-panel">
          <div class="admin-panel-head">
            <h2 style="margin:0;">猫一覧（${filtered.length}匹）</h2>
            <button class="btn btn-primary btn-sm" id="new-cat-btn">＋新規登録</button>
          </div>
          <a href="#cat-form-panel" class="mobile-jump-link" id="jump-to-form">▲ 編集フォームへ</a>
          <div class="admin-filters" style="margin-bottom:14px;">
            絞込：
            <select id="admin-filter-status">
              <option ${state.adminFilterStatus==="すべて"?"selected":""}>すべて</option>
              <option ${state.adminFilterStatus==="募集中"?"selected":""}>募集中</option>
              <option ${state.adminFilterStatus==="里親決定"?"selected":""}>里親決定</option>
            </select>
            <select id="admin-filter-gender">
              <option ${state.adminFilterGender==="すべて"?"selected":""}>性別すべて</option>
              <option ${state.adminFilterGender==="女の子"?"selected":""}>女の子</option>
              <option ${state.adminFilterGender==="男の子"?"selected":""}>男の子</option>
            </select>
          </div>
          <div class="admin-cat-list">
            ${rows || `<div class="admin-empty">該当する猫がいません</div>`}
          </div>
          <div class="admin-pagination">${pagBtns.join("")}</div>
        </div>
        ${renderCatForm()}
      </div>
    </div>
  </div>`;
}

function renderAdminSettings(){
  const s = state.settings;
  return `
  <div class="admin-shell">
    ${renderAdminTopbar("admin-settings")}
    <div class="admin-body">
      <div class="admin-panel" style="max-width:640px;margin:0 auto;">
        <h2>サイト設定</h2>
        <div class="form-field"><label>Amazonほしいものリスト URL</label><input id="s-wishlist" value="${s.wishlistUrl||""}"></div>
        <div class="form-field"><label>署名リンク URL</label><input id="s-signature" value="${s.signatureUrl||""}"></div>
        <div class="form-field"><label>Instagram アカウントURL</label><input id="s-insta" value="${s.instagramUrl||""}"></div>
        <div class="form-field"><label>LINE公式アカウントURL</label><input id="s-line" value="${s.lineUrl||""}"></div>
        <div class="form-field"><label>電話番号</label><input id="s-phone" value="${s.phone||""}"></div>
        <div class="form-field"><label>代表者名</label><input id="s-rep" value="${s.representative||""}"></div>
        <button class="btn btn-primary" id="save-settings-btn">保存</button>
      </div>
    </div>
  </div>`;
}

/* =========================================================
   MASTER RENDER + EVENT BINDING
========================================================= */

/* =========================================================
   MASTER RENDER + EVENT BINDING
========================================================= */
function render(){
  const app = document.getElementById("app");
  if(state.loading){
    app.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;color:#999;">読み込み中...</div>`;
    return;
  }
  let html = "";
  if(state.route === "admin-login") html = renderLogin();
  else if(state.route === "admin-cats") html = renderAdminCats();
  else if(state.route === "admin-settings") html = renderAdminSettings();
  app.innerHTML = html;
  bindEvents();
}

function bindEvents(){
  if(state.route === "admin-login"){
    const submit = document.getElementById("login-submit");
    const pass = document.getElementById("login-pass");
    const doLogin = async ()=>{
      submit.disabled = true;
      document.getElementById("login-error").textContent = "";
      try{
        await apiRequest("/api/login", "POST", { password: pass.value });
        state.loggedIn = true;
        go("admin-cats");
      }catch(e){
        document.getElementById("login-error").textContent = "パスワードが違います";
      }finally{
        submit.disabled = false;
      }
    };
    submit.addEventListener("click", doLogin);
    pass.addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });
  }

  if(state.route === "admin-cats" || state.route === "admin-settings"){
    document.querySelectorAll(".admin-tabs button").forEach(btn=>{
      btn.addEventListener("click", ()=>{ catFormData = emptyCatForm(); go(btn.dataset.route); });
    });
    document.getElementById("logout-btn").addEventListener("click", async ()=>{
      try{ await apiRequest("/api/login", "DELETE"); }catch(e){ /* ignore */ }
      state.loggedIn=false;
      go("admin-login");
    });
  }

  if(state.route === "admin-cats"){
    document.getElementById("new-cat-btn").addEventListener("click", ()=>{ catFormData = emptyCatForm(); render(); scrollToFormOnMobile(); });

    const fileInput = document.getElementById("f-image-file");
    if(fileInput){
      fileInput.addEventListener("change", ()=>{
        const file = fileInput.files[0];
        if(!file) return;
        if(file.size > 3*1024*1024){ showToast("画像サイズが大きすぎます（3MB以下推奨）"); return; }
        const reader = new FileReader();
        reader.onload = ()=>{ catFormData.image = reader.result; catFormData.imageOriginal = reader.result; catFormData.trimming = false; render(); };
        reader.readAsDataURL(file);
      });
    }

    const trimCheck = document.getElementById("f-trim");
    if(trimCheck) trimCheck.addEventListener("change", ()=>{ catFormData.trimming = trimCheck.checked; render(); });
    initCropTool();

    document.getElementById("save-cat-btn").addEventListener("click", async ()=>{
      const f = catFormData;
      f.status = document.getElementById("f-status").value;
      f.gender = document.getElementById("f-gender").value;
      f.trimming = document.getElementById("f-trim").checked;
      if(!f.image){ showToast("画像を選択してください"); return; }

      const saveBtn = document.getElementById("save-cat-btn");
      saveBtn.disabled = true;
      const originalLabel = saveBtn.textContent;
      saveBtn.textContent = "保存中...";
      try{
        const imageUrl = await uploadImageIfNeeded(f.image);
        const payload = { name: f.name || "", gender: f.gender, status: f.status, image: imageUrl };
        if(f.id){
          await apiRequest(`/api/cats/${encodeURIComponent(f.id)}`, "PUT", payload);
        } else {
          await apiRequest("/api/cats", "POST", payload);
        }
        state.cats = await loadCats();
        showToast("保存しました");
        catFormData = emptyCatForm();
      }catch(e){
        console.error(e);
        showToast(e.message || "保存に失敗しました（画像サイズが大きい可能性があります）");
      }finally{
        render();
      }
    });
    document.getElementById("cancel-cat-btn").addEventListener("click", ()=>{ catFormData = emptyCatForm(); render(); });
    const delBtn = document.getElementById("delete-cat-btn");
    if(delBtn) delBtn.addEventListener("click", async ()=>{
      if(!confirm("この猫のデータを削除しますか？")) return;
      try{
        await apiRequest(`/api/cats/${encodeURIComponent(catFormData.id)}`, "DELETE");
        state.cats = await loadCats();
        showToast("削除しました");
      }catch(e){
        console.error(e);
        showToast("削除に失敗しました");
      }
      catFormData = emptyCatForm();
      render();
    });
    document.querySelectorAll("[data-select]").forEach(row=>{
      row.addEventListener("click", ()=>{
        const cat = state.cats.find(c=>c.id===row.dataset.select);
        if(cat){ catFormData = {...cat}; render(); scrollToFormOnMobile(); }
      });
    });
    const fStatusSel = document.getElementById("admin-filter-status");
    if(fStatusSel) fStatusSel.addEventListener("change", ()=>{ state.adminFilterStatus = fStatusSel.value; state.adminPage=1; render(); });
    const fGenderSel = document.getElementById("admin-filter-gender");
    if(fGenderSel) fGenderSel.addEventListener("change", ()=>{ state.adminFilterGender = fGenderSel.value; state.adminPage=1; render(); });
    const aPrev = document.getElementById("admin-pg-prev");
    const aNext = document.getElementById("admin-pg-next");
    if(aPrev) aPrev.addEventListener("click", ()=>{ if(state.adminPage>1){state.adminPage--; render();} });
    if(aNext) aNext.addEventListener("click", ()=>{ state.adminPage++; render(); });
    document.querySelectorAll("[data-admin-page]").forEach(btn=>{
      btn.addEventListener("click", ()=>{ state.adminPage = parseInt(btn.dataset.adminPage,10); render(); });
    });
  }

  if(state.route === "admin-settings"){
    document.getElementById("save-settings-btn").addEventListener("click", async ()=>{
      const s = {
        wishlistUrl: document.getElementById("s-wishlist").value.trim(),
        signatureUrl: document.getElementById("s-signature").value.trim(),
        instagramUrl: document.getElementById("s-insta").value.trim(),
        lineUrl: document.getElementById("s-line").value.trim(),
        phone: document.getElementById("s-phone").value.trim(),
        representative: document.getElementById("s-rep").value.trim()
      };
      try{
        state.settings = await saveSettings(s);
        showToast("設定を保存しました");
      }catch(e){
        console.error(e);
        showToast("設定の保存に失敗しました");
      }
    });
  }
}

(async function init(){
  render();
  const [loggedIn, cats, settings] = await Promise.all([checkSession(), loadCats(), loadSettings()]);
  state.loggedIn = loggedIn;
  state.cats = cats;
  state.settings = settings;
  state.route = loggedIn ? "admin-cats" : "admin-login";
  state.loading = false;
  render();
})();
