/* 核心：路由、抽屉、搜索、右键、面包屑、toast、工具函数 */
(function(){
"use strict";

const UI = {};
window.UI = UI;

/* ---------- 工具 ---------- */
UI.esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
UI.now = () => new Date().toISOString().slice(0,16).replace("T"," ");
UI.today = () => new Date().toISOString().slice(0,10);
UI.qs = s => document.querySelector(s);
UI.qsa = s => Array.from(document.querySelectorAll(s));

UI.toast = function(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.add("hidden"), 2200);
};

/* 确认框（基于原生 confirm 简化） */
UI.confirm = function(msg){ return window.confirm(msg); };

/* ---------- 面包屑 ---------- */
const ROUTE_TITLES = {
  "dashboard":"首页仪表盘",
  "lesson-prep":"课程备课",
  "lesson-plans":"教案管理",
  "courseware":"课件中心",
  "question-bank":"题库管理",
  "scores":"学生成绩",
  "reflection":"教学复盘",
  "planning":"教学计划"
};
UI.setCrumbs = function(parts){
  const el = document.getElementById("breadcrumb");
  el.innerHTML = parts.map((p,i)=>{
    const last = i===parts.length-1;
    const txt = UI.esc(p.title);
    const node = last ? `<span class="cur">${txt}</span>` : `<a href="${UI.esc(p.href||"#/dashboard")}">${txt}</a>`;
    return node;
  }).join('<span style="margin:0 6px;color:#cbd5e1">/</span>');
};

/* ---------- 侧边栏 ---------- */
function initSidebar(){
  const sb = document.getElementById("sidebar");
  const collapsed = localStorage.getItem("twb_sidebar") === "1";
  setCollapsed(collapsed);
  document.getElementById("collapseBtn").onclick = ()=> setCollapsed(!sb.classList.contains("collapsed"));
  document.getElementById("sideToggle").onclick = ()=> setCollapsed(!sb.classList.contains("collapsed"));
}
function setCollapsed(v){
  const sb = document.getElementById("sidebar");
  sb.classList.toggle("collapsed", v);
  document.body.classList.toggle("side-collapsed", v);
  localStorage.setItem("twb_sidebar", v ? "1" : "0");
}
function setActiveNav(route){
  UI.qsa("#sideNav .nav-item").forEach(a=>{
    a.classList.toggle("active", a.dataset.nav === route);
  });
}

/* ---------- 抽屉 ---------- */
let drawerSaveFn = null;
let drawerTag = "";
UI.openDrawer = function(title, bodyHTML, onSave, tag){
  document.getElementById("drawerTitle").textContent = title;
  document.getElementById("drawerBody").innerHTML = bodyHTML;
  document.getElementById("drawer").classList.remove("hidden");
  document.getElementById("drawerMask").classList.remove("hidden");
  drawerSaveFn = onSave;
  drawerTag = tag || title;
  // 富文本工具栏初始化
  initRichText();
  // 自动草稿恢复
  const draft = DB.draftGet(drawerTag);
  const form = document.getElementById("drawerBody");
  if(draft && form.querySelector("[data-draft-restore]")){
    // 仅在明确标记恢复时（有标记字段即恢复）
    applyDraft(form, draft.data);
    UI.toast("已恢复未提交草稿");
  }
  form.addEventListener("input", ()=> DB.draftSave(form, drawerTag));
  const first = form.querySelector("input,select,textarea");
  if(first) first.focus();
};
function applyDraft(form, data){
  Object.keys(data||{}).forEach(name=>{
    form.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach(el=>{
      if(el.type==="checkbox"){ el.checked = (data[name]||[]).indexOf(el.value)>=0; }
      else el.value = data[name];
    });
  });
}
UI.closeDrawer = function(){
  document.getElementById("drawer").classList.add("hidden");
  document.getElementById("drawerMask").classList.add("hidden");
  drawerSaveFn = null;
  document.getElementById("drawerBody").innerHTML = "";
};
UI.drawerOpen = function(){ return !document.getElementById("drawer").classList.contains("hidden"); };

/* 表单收集 */
UI.collect = function(root){
  const data = {};
  root.querySelectorAll("[name]").forEach(el=>{
    if(el.type==="checkbox"){
      if(!data[el.name]) data[el.name]=[];
      if(el.checked) data[el.name].push(el.value);
    } else data[el.name] = el.value.trim ? el.value.trim() : el.value;
  });
  return data;
};

/* ---------- 富文本 ---------- */
function initRichText(){
  UI.qsa(".rt-toolbar").forEach(bar=>{
    bar.querySelectorAll("button[data-cmd]").forEach(btn=>{
      btn.onmousedown = e => e.preventDefault();
      btn.onclick = ()=>{
        const ed = document.getElementById(btn.closest(".rt-toolbar").dataset.editor);
        if(!ed) return;
        ed.focus();
        if(btn.dataset.cmd === "createLink"){
          const url = prompt("输入链接地址：", "https://");
          if(url) document.execCommand("createLink", false, url);
        } else if(btn.dataset.cmd === "insertImage"){
          const inp = document.getElementById("richTextFile");
          inp.onchange = ()=>{
            const f = inp.files[0]; if(!f) return;
            const r = new FileReader();
            r.onload = ()=> document.execCommand("insertImage", false, r.result);
            r.readAsDataURL(f); inp.value="";
          };
          inp.click();
        } else {
          document.execCommand(btn.dataset.cmd, false, null);
        }
      };
    });
  });
}

/* ---------- 右键菜单 ---------- */
let ctxActions = [];
UI.bindCtx = function(container, actionsForItem){
  container.addEventListener("contextmenu", e=>{
    const item = e.target.closest("[data-ctx-id]");
    if(!item) return;
    e.preventDefault();
    ctxActions = actionsForItem(item);
    showCtx(e.clientX, e.clientY);
  });
};
function showCtx(x,y){
  const m = document.getElementById("ctxMenu");
  m.innerHTML = ctxActions.map((a,i)=> a==="-" ? '<div class="sep"></div>' :
    `<button data-i="${i}" class="${a.danger?"danger":""}">${UI.esc(a.label)}</button>`).join("");
  m.classList.remove("hidden");
  m.style.left = Math.min(x, innerWidth-170)+"px";
  m.style.top = Math.min(y, innerHeight-m.offsetHeight-10)+"px";
  m.querySelectorAll("button").forEach(b=>{
    b.onclick = ()=>{
      const a = ctxActions[+b.dataset.i];
      m.classList.add("hidden");
      if(a && a.run) a.run();
    };
  });
}
document.addEventListener("click", ()=> document.getElementById("ctxMenu").classList.add("hidden"));
document.addEventListener("contextmenu", e=>{
  if(!e.target.closest("[data-ctx-id]")) document.getElementById("ctxMenu").classList.add("hidden");
});

/* ---------- 全局搜索 ---------- */
const SEARCH_MAP = [
  {coll:"lessons", kind:"备课", route:"lesson-prep", text:x=>x.title+" "+x.subject+" "+x.grade},
  {coll:"plans", kind:"教案", route:"lesson-plans", text:x=>x.title+" "+(x.content||"").replace(/<[^>]+>/g,"")+" "+(x.tags||[]).join(" ")},
  {coll:"files", kind:"课件", route:"courseware", text:x=>x.name+" "+x.folder+" "+(x.note||"")},
  {coll:"questions", kind:"题目", route:"question-bank", text:x=>x.qid+" "+x.content+" "+x.point},
  {coll:"students", kind:"学生", route:"scores", text:x=>x.name+" "+x.sno+" "+x.klass},
  {coll:"reflections", kind:"复盘", route:"reflection", text:x=>x.lesson+" "+(x.highlight||"")+" "+(x.improve||"")},
  {coll:"tasks", kind:"任务", route:"planning", text:x=>x.text},
  {coll:"calendar", kind:"计划", route:"planning", text:x=>x.title+" "+x.date}
];
function initSearch(){
  const inp = document.getElementById("globalSearch");
  const box = document.getElementById("searchResults");
  inp.addEventListener("input", ()=>{
    const kw = inp.value.trim().toLowerCase();
    if(!kw){ box.classList.add("hidden"); return; }
    const out = [];
    SEARCH_MAP.forEach(m=>{
      DB.Store.all(m.coll).forEach(x=>{
        if(String(m.text(x)||"").toLowerCase().includes(kw)){
          out.push({kind:m.kind, route:m.route, title: m.coll==="tasks"? x.text : (x.title||x.name||x.content||x.qid||"")});
        }
      });
    });
    box.innerHTML = out.length ? out.slice(0,20).map((r,i)=>
      `<div class="sr-item" data-r="${r.route}"><span class="sr-kind">${r.kind}</span>${UI.esc(r.title)}</div>`).join("")
      : '<div class="sr-empty">没有找到相关内容</div>';
    box.classList.remove("hidden");
    box.querySelectorAll(".sr-item").forEach(el=>{
      el.onclick = ()=>{ location.hash = "#/"+el.dataset.r; box.classList.add("hidden"); inp.value=""; };
    });
  });
  inp.addEventListener("blur", ()=> setTimeout(()=>box.classList.add("hidden"), 200));
}

/* ---------- 导出按钮 ---------- */
function initTop(){
  document.getElementById("exportBtn").onclick = ()=> DB.exportBackup();
}

/* ---------- 路由 ---------- */
const routes = {};
UI.route = function(name, fn){ routes[name] = fn; };
function navigate(){
  const hash = location.hash.replace(/^#\//,"") || "dashboard";
  const [name, param] = hash.split("/");
  const fn = routes[name] || routes["dashboard"];
  setActiveNav(name in ROUTE_TITLES ? name : "dashboard");
  const content = document.getElementById("content");
  try{
    fn(content, param);
  }catch(e){
    content.innerHTML = `<div class="card"><div class="empty">页面加载出错：${UI.esc(e.message)}</div></div>`;
    console.error(e);
  }
  if(!UI._crumbsSet) UI.setCrumbs([{title:"首页", href:"#/dashboard"},{title: ROUTE_TITLES[name]||"页面"}]);
  UI._crumbsSet = false;
  window.scrollTo(0,0);
}
UI._setCrumbsNow = function(parts){ UI.setCrumbs(parts); UI._crumbsSet = true; };

/* 抽屉按钮绑定 */
function initDrawerBtns(){
  document.getElementById("drawerClose").onclick = UI.closeDrawer;
  document.getElementById("drawerCancel").onclick = ()=>{ UI.closeDrawer(); };
  document.getElementById("drawerMask").onclick = UI.closeDrawer;
  document.getElementById("drawerSave").onclick = function(){
    if(!drawerSaveFn){ UI.closeDrawer(); return; }
    const body = document.getElementById("drawerBody");
    const data = UI.collect(body);
    // 富文本
    const rte = body.querySelector(".rt-editor");
    if(rte) data[rte.id] = rte.innerHTML;
    const ok = drawerSaveFn(data, body);
    if(ok !== false){
      DB.draftClear(drawerTag);
      document.getElementById("draftStatus").textContent = "";
      UI.closeDrawer();
      navigate();
    }
  };
}

/* 导入 */
document.getElementById("importFile").addEventListener("change", function(){
  const f = this.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=> DB.importBackup(r.result);
  r.readAsText(f);
  this.value = "";
});
UI.pickImport = function(){ document.getElementById("importFile").click(); };

document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && UI.drawerOpen()) UI.closeDrawer();
  if((e.ctrlKey||e.metaKey) && e.key === "k"){ e.preventDefault(); document.getElementById("globalSearch").focus(); }
});

window.addEventListener("hashchange", navigate);
document.addEventListener("DOMContentLoaded", ()=>{
  initSidebar(); initSearch(); initTop(); initDrawerBtns();
  navigate();
});
})();