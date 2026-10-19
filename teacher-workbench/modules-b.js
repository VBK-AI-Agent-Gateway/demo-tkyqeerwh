/* 7 大模块：备课 / 教案 / 课件 / 题库 / 成绩 / 复盘 / 计划 */
(function(){
"use strict";
const {esc, toast, confirm:cfm, openDrawer, today, bindCtx} = UI;
const S = DB.Store;
const eb = () => window.__emptyBox;

function crumbs(title, extra){
  UI._setCrumbsNow([{title:"首页",href:"#/dashboard"},{title}].concat(extra||[]));
}
function foldersOf(type){ return S.all("folders").filter(f=>f.type===type); }

/* ============ 1. 课程备课 ============ */
UI.route("lesson-prep", function(el){
  crumbs("课程备课");
  let kw="", status="all";
  function render(){
    let list = S.all("lessons").filter(l=>
      (status==="all"||l.status===status) &&
      (!kw || (l.title+l.subject+l.grade).toLowerCase().includes(kw)));
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">课程备课</div><div class="page-sub">记录课程计划、教学目标与课堂安排</div></div>
      <div class="page-tools"><button class="btn btn-primary" id="newL">+ 新增备课</button></div></div>
    <div class="filter-bar">
      <input type="search" class="grow" id="lkw" placeholder="搜索课程 / 学科 / 班级" value="${esc(kw)}">
      <select id="lst"><option value="all">全部状态</option><option value="active" ${status==="active"?"selected":""}>进行中</option><option value="archived" ${status==="archived"?"selected":""}>已归档</option></select>
    </div>
    <div class="table-wrap"><table class="tbl"><thead><tr>
      <th>课程</th><th>学科/班级</th><th>日期/节次</th><th>教学目标</th><th>状态</th><th style="width:170px">操作</th>
    </tr></thead><tbody>
    ${list.length ? list.map(l=>`
      <tr data-ctx-id data-lesson="${l.id}" class="${l.status==="archived"?"row-done":""}">
        <td><b>${esc(l.title)}</b><div class="muted" style="font-size:12px">${esc(l.classroom)}</div></td>
        <td>${esc(l.subject)} · ${esc(l.grade)}</td>
        <td>${esc(l.date)}<div class="muted" style="font-size:12px">${esc(l.period)}</div></td>
        <td style="max-width:240px">${esc(l.objectives)}</td>
        <td><span class="tag ${l.status==="archived"?"gray":"green"}">${l.status==="archived"?"已归档":"进行中"}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" data-edit="${l.id}">编辑</button>
          <button class="btn btn-ghost btn-sm" data-copy="${l.id}">复制</button>
          <button class="btn btn-ghost btn-sm" data-arch="${l.id}">${l.status==="archived"?"恢复":"归档"}</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6">${eb()("暂无备课记录，点击右上角新增")}</td></tr>`}
    </tbody></table></div>`;
    el.querySelector("#lkw").oninput = e=>{ kw = e.target.value.trim().toLowerCase(); render(); el.querySelector("#lkw").focus(); const v=el.querySelector("#lkw"); v.setSelectionRange(v.value.length,v.value.length); };
    el.querySelector("#lst").onchange = e=>{ status = e.target.value; render(); };
    el.querySelector("#newL").onclick = ()=> edit(null);
    el.querySelectorAll("[data-edit]").forEach(b=> b.onclick = ()=> edit(S.get("lessons",b.dataset.edit)));
    el.querySelectorAll("[data-copy]").forEach(b=> b.onclick = ()=>{ const l=S.get("lessons",b.dataset.copy); S.insert("lessons",Object.assign({},l,{title:l.title+" (副本)",id:undefined})); toast("已复制课程"); render(); });
    el.querySelectorAll("[data-arch]").forEach(b=> b.onclick = ()=>{ const l=S.get("lessons",b.dataset.arch); S.update("lessons",l.id,{status:l.status==="archived"?"active":"archived"}); toast("状态已更新"); render(); });
    bindCtx(el, item=>{ const l=S.get("lessons",item.dataset.lesson); return [
      {label:"编辑", run:()=>edit(l)},
      {label:"复制", run:()=>{ S.insert("lessons",Object.assign({},l,{title:l.title+" (副本)",id:undefined})); toast("已复制"); render(); }},
      {label:l.status==="archived"?"恢复":"归档", run:()=>{ S.update("lessons",l.id,{status:l.status==="archived"?"active":"archived"}); render(); }},
      "-",
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该备课？")){ S.remove("lessons",l.id); render(); }}}
    ];});
  }
  function edit(l){
    openDrawer(l?"编辑备课":"新增备课", `
      <div class="form-grid" data-draft-restore>
        <div class="field full"><label>课程名称<span class="req">*</span></label><input name="title" value="${esc(l?l.title:"")}" placeholder="例如：函数的单调性"></div>
        <div class="field"><label>学科</label><input name="subject" value="${esc(l?l.subject:"")}" placeholder="数学"></div>
        <div class="field"><label>班级</label><input name="grade" value="${esc(l?l.grade:"")}" placeholder="高一(3)班"></div>
        <div class="field"><label>上课日期</label><input type="date" name="date" value="${esc(l?l.date:today())}"></div>
        <div class="field"><label>节次</label><input name="period" value="${esc(l?l.period:"")}" placeholder="第1节"></div>
        <div class="field full"><label>教室</label><input name="classroom" value="${esc(l?l.classroom:"")}" placeholder="A301"></div>
        <div class="field full"><label>教学目标</label><textarea name="objectives" rows="3" placeholder="本节课学生应达成的目标…">${esc(l?l.objectives:"")}</textarea></div>
        <div class="field full"><label>课堂安排</label><textarea name="schedule" rows="4" placeholder="导入 → 讲解 → 练习 → 小结">${esc(l?l.schedule:"")}</textarea></div>
        <div class="field full"><label>备注</label><textarea name="notes" rows="2">${esc(l?l.notes:"")}</textarea></div>
        <div class="field full"><label>状态</label><select name="status"><option value="active" ${!l||l.status==="active"?"selected":""}>进行中</option><option value="archived" ${l&&l.status==="archived"?"selected":""}>已归档</option></select></div>
      </div>`,
      d=>{ if(!d.title){ toast("请填写课程名称"); return false; }
        if(l) S.update("lessons",l.id,d); else S.insert("lessons",d);
        toast("备课已保存");
      }, l?"edit-lesson":"new-lesson");
  }
  window.__editLesson = id => { const l=S.get("lessons",id); if(l) edit(l); };
  render();
});

/* ============ 2. 教案管理 ============ */
UI.route("lesson-plans", function(el){
  crumbs("教案管理");
  let kw="", folder="all", tagF="";
  function render(){
    const fs = foldersOf("plans");
    let list = S.all("plans").filter(p=>
      (folder==="all"||p.folder===folder) &&
      (!tagF || (p.tags||[]).includes(tagF)) &&
      (!kw || (p.title+(p.content||"").replace(/<[^>]+>/g,"")+(p.tags||[]).join("")).toLowerCase().includes(kw)));
    const allTags = [...new Set(S.all("plans").flatMap(p=>p.tags||[]))];
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">教案管理</div><div class="page-sub">富文本教案 · 文件夹分类 · 标签与全文搜索</div></div>
      <div class="page-tools"><button class="btn btn-ghost" id="newFolder">+ 文件夹</button><button class="btn btn-primary" id="newP">+ 新建教案</button></div></div>
    <div class="split">
      <div class="folder-list">
        <div class="folder-item ${folder==="all"?"on":""}" data-f="all">📁 全部教案 <span class="muted">${S.all("plans").length}</span></div>
        ${fs.map(f=>`<div class="folder-item ${folder===f.name?"on":""}" data-f="${esc(f.name)}">📁 ${esc(f.name)} <span class="del" data-df="${f.id}">✕</span> <span class="muted">${S.query("plans",p=>p.folder===f.name).length}</span></div>`).join("")}
        <div class="folder-add"><input id="folderName" placeholder="新文件夹名"><button class="btn btn-primary btn-sm" id="addFolder">添加</button></div>
      </div>
      <div>
        <div class="filter-bar">
          <input type="search" class="grow" id="pkw" placeholder="全文搜索标题、正文、标签" value="${esc(kw)}">
          <select id="ptag"><option value="">全部标签</option>${allTags.map(t=>`<option ${tagF===t?"selected":""}>${esc(t)}</option>`).join("")}</select>
        </div>
        <div class="grid g3">
        ${list.length ? list.map(p=>`
          <div class="card" style="padding:14px 16px" data-ctx-id data-plan="${p.id}" data-open="${p.id}">
            <div style="font-weight:700;font-size:14px">${esc(p.title)}</div>
            <div class="muted" style="font-size:12px;margin:4px 0">📁 ${esc(p.folder||"未分类")} · ${esc(p.updatedAt||"")}</div>
            <div style="font-size:12px;color:#475569;min-height:36px">${(p.content||"").replace(/<[^>]+>/g,"").slice(0,60)}…</div>
            <div>${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
            ${(p.linkedCourseware||[]).length?`<div class="muted" style="font-size:12px;margin-top:4px">🔗 课件:${p.linkedCourseware.map(esc).join("、")}</div>`:""}
            ${(p.linkedQuestions||[]).length?`<div class="muted" style="font-size:12px">❓ 试题:${p.linkedQuestions.map(esc).join("、")}</div>`:""}
            <div class="flexrow" style="margin-top:8px">
              <button class="btn btn-ghost btn-sm" data-edit="${p.id}">编辑</button>
              <button class="btn btn-danger btn-sm" data-del="${p.id}">删除</button>
            </div>
          </div>`).join("") : `<div style="grid-column:1/-1">${eb()("暂无教案，点击右上角新建")}</div>`}
        </div>
      </div>
    </div>`;
    el.querySelectorAll("[data-f]").forEach(d=> d.onclick = e=>{ if(e.target.dataset.df) return; folder=d.dataset.f; render(); });
    el.querySelectorAll("[data-df]").forEach(d=> d.onclick = e=>{ e.stopPropagation(); if(cfm("删除文件夹？(教案保留)")){ S.remove("folders",d.dataset.df); render(); }});
    el.querySelector("#addFolder").onclick = ()=>{ const v=el.querySelector("#folderName").value.trim(); if(!v){toast("请输入文件夹名");return;} S.insert("folders",{name:v,type:"plans"}); toast("文件夹已添加"); render(); };
    el.querySelector("#newFolder").onclick = ()=>{ el.querySelector("#folderName").focus(); };
    el.querySelector("#pkw").oninput = e=>{ kw=e.target.value.trim().toLowerCase(); render(); const i=el.querySelector("#pkw"); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
    el.querySelector("#ptag").onchange = e=>{ tagF=e.target.value; render(); };
    el.querySelector("#newP").onclick = ()=> edit(null);
    el.querySelectorAll("[data-edit]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); edit(S.get("plans",b.dataset.edit)); });
    el.querySelectorAll("[data-del]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); if(cfm("删除该教案？")){ S.remove("plans",b.dataset.del); toast("已删除"); render(); }});
    el.querySelectorAll("[data-open]").forEach(c=> c.onclick = ()=> edit(S.get("plans",c.dataset.open)));
    bindCtx(el, item=>{ const p=S.get("plans",item.dataset.plan); if(!p) return [{label:"刷新",run:render}]; return [
      {label:"编辑", run:()=>edit(p)},
      {label:"复制", run:()=>{ S.insert("plans",Object.assign({},p,{title:p.title+" (副本)",id:undefined})); toast("已复制"); render(); }},
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该教案？")){ S.remove("plans",p.id); render(); }}}
    ];});
  }
  function edit(p){
    const fs = foldersOf("plans");
    const allQ = S.all("questions");
    const allF = S.all("files");
    openDrawer(p?"编辑教案":"新建教案", `
      <div class="form-grid" data-draft-restore>
        <div class="field full"><label>标题<span class="req">*</span></label><input name="title" value="${esc(p?p.title:"")}"></div>
        <div class="field"><label>文件夹</label><select name="folder">${[""].concat(fs.map(f=>f.name)).map(n=>`<option value="${esc(n)}" ${p&&p.folder===n?"selected":""}>${n||"未分类"}</option>`).join("")}</select></div>
        <div class="field"><label>标签(逗号分隔)</label><input name="tags" value="${esc(p?(p.tags||[]).join(","):"")}" placeholder="高一,概念课"></div>
        <div class="field full"><label>关联课件(可多选)</label>
          <div class="check-grid">${allF.map(f=>`<label><input type="checkbox" name="linkedCourseware" value="${esc(f.name)}" ${(p&&(p.linkedCourseware||[]).includes(f.name))?"checked":""}>${esc(f.name)}</label>`).join("") || '<span class="muted">暂无课件</span>'}</div></div>
        <div class="field full"><label>关联试题(可多选)</label>
          <div class="check-grid">${allQ.map(q=>`<label><input type="checkbox" name="linkedQuestions" value="${esc(q.qid+" "+q.content.slice(0,14))}" ${(p&&(p.linkedQuestions||[]).some(x=>x.startsWith(q.qid)))?"checked":""}>${esc(q.qid)}</label>`).join("") || '<span class="muted">暂无试题</span>'}</div></div>
        <div class="field full"><label>教案正文</label>
          <div class="rt-toolbar" data-editor="rtBody">
            <button data-cmd="bold" title="加粗"><b>B</b></button>
            <button data-cmd="italic" title="斜体"><i>I</i></button>
            <button data-cmd="underline" title="下划线"><u>U</u></button>
            <button data-cmd="formatBlock" title="标题2">H2</button>
            <button data-cmd="insertUnorderedList" title="无序列表">•列表</button>
            <button data-cmd="insertOrderedList" title="有序列表">1.列表</button>
            <button data-cmd="createLink" title="链接">🔗</button>
            <button data-cmd="insertImage" title="图片">🖼</button>
            <button data-cmd="removeFormat" title="清除格式">⌫格式</button>
          </div>
          <div class="rt-editor" id="rtBody" contenteditable="true" data-draft-restore>${p?(p.content||""):"<p>在这里编写教案…</p>"}</div>
        </div>
      </div>`,
      d=>{
        if(!d.title){ toast("请填写标题"); return false; }
        const patch = Object.assign({}, d, {
          tags: String(d.tags||"").split(/[,，]/).map(s=>s.trim()).filter(Boolean),
          linkedCourseware: [].concat(d.linkedCourseware||[]),
          linkedQuestions: [].concat(d.linkedQuestions||[]),
          updatedAt: new Date().toISOString().slice(0,16).replace("T"," ")
        });
        if(p) S.update("plans",p.id,patch); else S.insert("plans",patch);
        toast("教案已保存");
      }, p?"edit-plan":"new-plan");
  }
  window.__editPlan = id => { const p=S.get("plans",id); if(p) edit(p); };
  render();
});

/* ============ 3. 课件中心 ============ */
UI.route("courseware", function(el){
  crumbs("课件中心");
  let folder="all", kw="";
  function render(){
    const fs = foldersOf("courseware");
    const list = S.all("files").filter(f=>
      (folder==="all"||f.folder===folder) &&
      (!kw || (f.name+(f.note||"")).toLowerCase().includes(kw)));
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">课件中心</div><div class="page-sub">PPT / PDF / 教学资料 · 预览、下载、文件夹分类</div></div>
      <div class="page-tools"><button class="btn btn-ghost" id="newFolder">+ 文件夹</button><button class="btn btn-primary" id="newF">+ 上传资料</button></div></div>
    <div class="split">
      <div class="folder-list">
        <div class="folder-item ${folder==="all"?"on":""}" data-f="all">📁 全部资料 <span class="muted">${S.all("files").length}</span></div>
        ${fs.map(f=>`<div class="folder-item ${folder===f.name?"on":""}" data-f="${esc(f.name)}">📁 ${esc(f.name)} <span class="del" data-df="${f.id}">✕</span> <span class="muted">${S.query("files",x=>x.folder===f.name).length}</span></div>`).join("")}
        <div class="folder-add"><input id="folderName" placeholder="新文件夹名"><button class="btn btn-primary btn-sm" id="addFolder">添加</button></div>
      </div>
      <div>
        <div class="filter-bar"><input type="search" class="grow" id="fkw" placeholder="搜索文件名 / 备注" value="${esc(kw)}"></div>
        <div class="file-grid">
        ${list.length ? list.map(f=>{
          const ico = f.type==="PPT"?"📊":f.type==="PDF"?"📕":f.type==="DOC"?"📘":f.type==="IMG"?"🖼":"📦";
          return `<div class="file-card" data-ctx-id data-file="${f.id}" data-open="${f.id}">
            <div class="file-ico">${ico}</div>
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-meta">${esc(f.type)} · ${esc(f.size)} · ${esc(f.date)}</div>
            <div class="muted" style="font-size:12px">📁 ${esc(f.folder||"未分类")}</div>
            <div class="flexrow" style="margin-top:8px">
              <button class="btn btn-ghost btn-sm" data-prev="${f.id}">预览</button>
              <button class="btn btn-ghost btn-sm" data-dl="${f.id}">下载</button>
            </div>
          </div>`;}).join("") : `<div style="grid-column:1/-1">${eb()("暂无资料，点击右上角上传")}</div>`}
        </div>
      </div>
    </div>`;
    el.querySelectorAll("[data-f]").forEach(d=> d.onclick = e=>{ if(e.target.dataset.df) return; folder=d.dataset.f; render(); });
    el.querySelectorAll("[data-df]").forEach(d=> d.onclick = e=>{ e.stopPropagation(); if(cfm("删除文件夹？(文件保留)")){ S.remove("folders",d.dataset.df); render(); }});
    el.querySelector("#addFolder").onclick = ()=>{ const v=el.querySelector("#folderName").value.trim(); if(!v){toast("请输入文件夹名");return;} S.insert("folders",{name:v,type:"courseware"}); toast("已添加"); render(); };
    el.querySelector("#newFolder").onclick = ()=> el.querySelector("#folderName").focus();
    el.querySelector("#fkw").oninput = e=>{ kw=e.target.value.trim().toLowerCase(); render(); const i=el.querySelector("#fkw"); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
    el.querySelector("#newF").onclick = ()=> edit(null);
    el.querySelectorAll("[data-open]").forEach(c=> c.onclick = e=>{ if(e.target.closest("button")) return; edit(S.get("files",c.dataset.open)); });
    el.querySelectorAll("[data-prev]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); preview(S.get("files",b.dataset.prev)); });
    el.querySelectorAll("[data-dl]").forEach(b=> b.onclick = e=> { e.stopPropagation(); download(S.get("files",b.dataset.dl)); });
    bindCtx(el, item=>{ const f=S.get("files",item.dataset.file); if(!f) return [{label:"刷新",run:render}]; return [
      {label:"编辑信息", run:()=>edit(f)},
      {label:"预览", run:()=>preview(f)},
      {label:"下载", run:()=>download(f)},
      "-",
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该资料？")){ S.remove("files",f.id); render(); }}}
    ];});
  }
  function typeOf(name){
    const n = name.toLowerCase();
    if(n.endsWith(".ppt")||n.endsWith(".pptx")) return "PPT";
    if(n.endsWith(".pdf")) return "PDF";
    if(n.endsWith(".doc")||n.endsWith(".docx")||n.endsWith(".txt")) return "DOC";
    if(/\.(png|jpg|jpeg|gif|webp)$/.test(n)) return "IMG";
    return "FILE";
  }
  function edit(f){
    const fs = foldersOf("courseware");
    openDrawer(f?"编辑资料信息":"上传资料", `
      <div class="form-grid" data-draft-restore>
        <div class="field full"><label>文件名<span class="req">*</span></label>
          <div class="flexrow"><input name="name" value="${esc(f?f.name:"")}" placeholder="课件-单调性.pptx">
          <button type="button" class="btn btn-ghost btn-sm" id="pickLocal">选择本地文件</button></div>
          <div class="hint">可直接选择本地文件自动填入名称与大小</div></div>
        <div class="field"><label>类型</label><select name="type">${["PPT","PDF","DOC","IMG","FILE"].map(t=>`<option ${f&&f.type===t?"selected":""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>大小</label><input name="size" value="${esc(f?f.size:"")}" placeholder="3.4 MB"></div>
        <div class="field"><label>文件夹</label><select name="folder">${[""].concat(fs.map(x=>x.name)).map(n=>`<option value="${esc(n)}" ${f&&f.folder===n?"selected":""}>${n||"未分类"}</option>`).join("")}</select></div>
        <div class="field"><label>日期</label><input type="date" name="date" value="${esc(f?f.date:today())}"></div>
        <div class="field full"><label>预览/下载链接</label><input name="url" value="${esc(f?f.url:"")}" placeholder="https://…（留空则本地管理）"></div>
        <div class="field full"><label>备注</label><textarea name="note" rows="2">${esc(f?f.note:"")}</textarea></div>
      </div>`,
      d=>{
        if(!d.name){ toast("请填写文件名"); return false; }
        if(!d.type) d.type = typeOf(d.name);
        if(f) S.update("files",f.id,d); else S.insert("files",d);
        toast("资料已保存");
      }, f?"edit-file":"new-file");
    const pick = UI.qs("#pickLocal");
    if(pick) pick.onclick = ()=>{
      const inp = document.getElementById("uploadFile");
      inp.onchange = ()=>{ const file=inp.files[0]; if(!file) return;
        UI.qs('[name="name"]').value = file.name;
        UI.qs('[name="type"]').value = typeOf(file.name);
        UI.qs('[name="size"]').value = (file.size/1024 > 1024 ? (file.size/1048576).toFixed(1)+" MB" : Math.max(1,Math.round(file.size/1024))+" KB");
        inp.value="";
      };
      inp.click();
    };
  }
  function preview(f){
    if(f.url){
      openDrawer("预览 · "+f.name, `<div style="height:70vh"><iframe src="${esc(f.url)}" style="width:100%;height:100%;border:1px solid #e5e7eb;border-radius:6px"></iframe></div>
        <p class="muted" style="margin-top:8px;font-size:12px">外部链接预览；若无法打开请使用下载。</p>`, ()=>true, "preview");
    } else {
      openDrawer("预览 · "+f.name, `
        <div class="card" style="text-align:center;padding:40px 20px">
          <div style="font-size:44px">${f.type==="PPT"?"📊":f.type==="PDF"?"📕":"📘"}</div>
          <div style="font-weight:700;margin-top:8px">${esc(f.name)}</div>
          <div class="muted">${esc(f.type)} · ${esc(f.size)} · ${esc(f.date)}</div>
          <div class="muted" style="margin-top:14px;font-size:13px">本地登记的资料不存储文件本体，可编辑「预览/下载链接」接入在线地址。</div>
          ${f.note?`<div class="mini-plan" style="text-align:left;margin-top:14px"><div class="d">备注：${esc(f.note)}</div></div>`:""}
        </div>`, ()=>true, "preview");
    }
  }
  function download(f){
    if(f.url){ const a=document.createElement("a"); a.href=f.url; a.download=f.name; a.click(); }
    else toast("该资料未关联下载链接，请编辑补充");
  }
  render();
});

/* ============ 4. 题库管理 ============ */
UI.route("question-bank", function(el){
  crumbs("题库管理");
  let kw="", point="all", diff="all", type="all", picked=new Set();
  function render(){
    const points = [...new Set(S.all("questions").map(q=>q.point))];
    const diffs = ["简单","中等","较难"];
    const list = S.all("questions").filter(q=>
      (point==="all"||q.point===point) && (diff==="all"||q.difficulty===diff) && (type==="all"||q.type===type) &&
      (!kw || (q.qid+q.content+q.point+q.analysis).toLowerCase().includes(kw)));
    const diffTag = d=> d==="简单"?"green":d==="较难"?"red":"orange";
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">题库管理</div><div class="page-sub">多题型录入 · 知识点/难度筛选 · 生成练习 · 学生反馈</div></div>
      <div class="page-tools"><button class="btn btn-ghost" id="genEx">生成练习卷</button><button class="btn btn-primary" id="newQ">+ 录入试题</button></div></div>
    <div class="filter-bar">
      <input type="search" class="grow" id="qkw" placeholder="搜索题干 / 解析 / 编号" value="${esc(kw)}">
      <select id="qpt"><option value="all">全部知识点</option>${points.map(p=>`<option ${point===p?"selected":""}>${esc(p)}</option>`).join("")}</select>
      <select id="qdf"><option value="all">全部难度</option>${diffs.map(d=>`<option ${diff===d?"selected":""}>${d}</option>`).join("")}</select>
      <select id="qtp"><option value="all">全部题型</option>${["选择","填空","解答","判断"].map(t=>`<option ${type===t?"selected":""}>${t}</option>`).join("")}</select>
    </div>
    <div id="bulkBar">${picked.size?`<div class="bulk-bar">已选 <b>${picked.size}</b> 题 <button class="btn btn-primary btn-sm" id="bulkGen">生成练习</button><button class="btn btn-ghost btn-sm" id="bulkClear">清空选择</button></div>`:""}</div>
    <div class="table-wrap"><table class="tbl"><thead><tr>
      <th style="width:36px"></th><th>编号</th><th>题干</th><th>题型</th><th>知识点</th><th>难度</th><th>分值</th><th>学生反馈</th><th style="width:120px">操作</th>
    </tr></thead><tbody>
    ${list.length ? list.map(q=>`
      <tr data-ctx-id data-q="${q.id}">
        <td><input type="checkbox" data-pick="${q.id}" ${picked.has(q.id)?"checked":""}></td>
        <td class="mono">${esc(q.qid)}</td>
        <td style="max-width:280px">${esc(q.content)}<div class="q-opts">${(q.options||[]).map(o=>`<div>${esc(o)}</div>`).join("")}</div></td>
        <td><span class="tag gray">${esc(q.type)}</span></td>
        <td>${esc(q.point)}</td>
        <td><span class="tag ${diffTag(q.difficulty)}">${esc(q.difficulty)}</span></td>
        <td>${q.score}</td>
        <td class="muted" style="max-width:160px;font-size:12px">${esc(q.feedback||"—")}</td>
        <td><button class="btn btn-ghost btn-sm" data-edit="${q.id}">编辑</button><button class="btn btn-danger btn-sm" data-del="${q.id}">删除</button></td>
      </tr>`).join("") : `<tr><td colspan="9">${eb()("暂无试题")}</td></tr>`}
    </tbody></table></div>`;
    el.querySelector("#qkw").oninput = e=>{ kw=e.target.value.trim().toLowerCase(); render(); const i=el.querySelector("#qkw"); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
    el.querySelector("#qpt").onchange = e=>{ point=e.target.value; render(); };
    el.querySelector("#qdf").onchange = e=>{ diff=e.target.value; render(); };
    el.querySelector("#qtp").onchange = e=>{ type=e.target.value; render(); };
    el.querySelector("#newQ").onclick = ()=> edit(null);
    el.querySelector("#genEx").onclick = ()=> generate([...picked.size?S.all("questions").filter(q=>picked.has(q.id)):list]);
    const bg = el.querySelector("#bulkGen"); if(bg) bg.onclick = ()=> generate(S.all("questions").filter(q=>picked.has(q.id)));
    const bc = el.querySelector("#bulkClear"); if(bc) bc.onclick = ()=>{ picked.clear(); render(); };
    el.querySelectorAll("[data-pick]").forEach(cb=> cb.onchange = ()=>{ cb.checked?picked.add(+cb.dataset.pick):picked.delete(+cb.dataset.pick); render(); });
    el.querySelectorAll("[data-edit]").forEach(b=> b.onclick = ()=> edit(S.get("questions",b.dataset.edit)));
    el.querySelectorAll("[data-del]").forEach(b=> b.onclick = ()=>{ if(cfm("删除该题？")){ S.remove("questions",b.dataset.del); render(); }});
    bindCtx(el, item=>{ const q=S.get("questions",item.dataset.q); if(!q) return [{label:"刷新",run:render}]; return [
      {label:"编辑", run:()=>edit(q)},
      {label:picked.has(q.id)?"取消勾选":"勾选此题", run:()=>{ picked.has(q.id)?picked.delete(q.id):picked.add(q.id); render(); }},
      {label:"记录学生反馈", run:()=>feedback(q)},
      "-",
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该题？")){ S.remove("questions",q.id); render(); }}}
    ];});
  }
  function edit(q){
    openDrawer(q?"编辑试题":"录入试题", `
      <div class="form-grid" data-draft-restore>
        <div class="field"><label>编号</label><input name="qid" value="${esc(q?q.qid:"Q-"+String(Date.now()).slice(-4))}"></div>
        <div class="field"><label>题型</label><select name="type">${["选择","填空","解答","判断"].map(t=>`<option ${q&&q.type===t?"selected":""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>知识点</label><input name="point" value="${esc(q?q.point:"")}" placeholder="函数单调性"></div>
        <div class="field"><label>难度</label><select name="difficulty">${["简单","中等","较难"].map(d=>`<option ${q&&q.difficulty===d?"selected":""}>${d}</option>`).join("")}</select></div>
        <div class="field"><label>分值</label><input type="number" name="score" value="${q?q.score:4}"></div>
        <div class="field full"><label>题干<span class="req">*</span></label><textarea name="content" rows="3">${esc(q?q.content:"")}</textarea></div>
        <div class="field full"><label>选项(每行一个，选择/判断题用)</label><textarea name="optionsText" rows="4" placeholder="A. 选项一&#10;B. 选项二">${esc(q?(q.options||[]).join("\n"):"")}</textarea></div>
        <div class="field full"><label>答案</label><input name="answer" value="${esc(q?q.answer:"")}"></div>
        <div class="field full"><label>解析</label><textarea name="analysis" rows="2">${esc(q?q.analysis:"")}</textarea></div>
        <div class="field full"><label>学生反馈</label><textarea name="feedback" rows="2" placeholder="记录学生答题情况…">${esc(q?q.feedback:"")}</textarea></div>
      </div>`,
      d=>{
        if(!d.content){ toast("请填写题干"); return false; }
        d.options = String(d.optionsText||"").split("\n").map(s=>s.trim()).filter(Boolean);
        d.score = +d.score||0;
        delete d.optionsText;
        if(q) S.update("questions",q.id,d); else S.insert("questions",d);
        toast("试题已保存");
      }, q?"edit-q":"new-q");
  }
  function feedback(q){
    openDrawer("学生反馈 · "+q.qid, `
      <div class="field"><label>反馈内容</label><textarea name="feedback" rows="6" placeholder="记录典型错误、掌握情况…">${esc(q.feedback||"")}</textarea></div>`,
      d=>{ S.update("questions",q.id,{feedback:d.feedback}); toast("反馈已记录"); }, "qfb");
  }
  function generate(qs){
    if(!qs.length){ toast("请先勾选或筛选出题目"); return; }
    const total = qs.reduce((s,q)=>s+(+q.score||0),0);
    openDrawer("生成练习卷(" + qs.length + " 题 / 共 " + total + " 分)", `
      <div class="muted" style="margin-bottom:10px">按勾选/当前列表生成，可直接打印。</div>
      ${qs.map((q,i)=>`
        <div class="card" style="margin-bottom:10px;padding:12px 14px">
          <div><b>${i+1}.</b>（${esc(q.type)}·${q.score}分）${esc(q.content)}</div>
          ${(q.options||[]).map(o=>`<div class="muted" style="margin-left:18px">${esc(o)}</div>`).join("")}
        </div>`).join("")}
      <div class="q-answer">参考答案：${qs.map((q,i)=>`${i+1}.${esc(q.answer||"略")}`).join("　")}</div>`,
      ()=>{ window.print(); return true; }, "exercise");
  }
  render();
});

/* ============ 5. 学生成绩 ============ */
UI.route("scores", function(el){
  crumbs("学生成绩");
  let exam="all";
  function render(){
    const exams = [...new Set(S.all("scores").map(s=>s.exam))];
    const students = S.all("students");
    const rows = students.map(st=>{
      const ss = S.all("scores").filter(s=>s.student===st.name && (exam==="all"||s.exam===exam));
      const avg = ss.length? (ss.reduce((a,b)=>a+ +b.score,0)/ss.length).toFixed(1) : "-";
      const latest = ss[ss.length-1];
      const prev = ss[ss.length-2];
      const trend = latest&&prev ? (+latest.score - +prev.score) : null;
      return {st, ss, avg, trend, latest};
    });
    const allExamScores = S.all("scores").filter(s=>exam==="all"||s.exam===exam);
    const classAvg = allExamScores.length? (allExamScores.reduce((a,b)=>a+ +b.score,0)/allExamScores.length).toFixed(1):"-";
    const pass = allExamScores.filter(s=>+s.score>=60).length;
    const excellent = allExamScores.filter(s=>+s.score>=90).length;
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">学生成绩</div><div class="page-sub">成绩录入 · 趋势图表 · 班级统计 · 学生标记</div></div>
      <div class="page-tools">
        <select id="examSel"><option value="all">全部考试</option>${exams.map(e=>`<option ${exam===e?"selected":""}>${esc(e)}</option>`).join("")}</select>
        <button class="btn btn-ghost" id="newStudent">+ 新增学生</button>
        <button class="btn btn-primary" id="newScore">+ 录入成绩</button>
      </div></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">班级均分</div><div class="stat-value">${classAvg}</div></div>
      <div class="stat-card"><div class="stat-label">及格率</div><div class="stat-value">${allExamScores.length?((pass/allExamScores.length)*100).toFixed(0):0}%</div></div>
      <div class="stat-card"><div class="stat-label">优秀率(≥90)</div><div class="stat-value">${allExamScores.length?((excellent/allExamScores.length)*100).toFixed(0):0}%</div></div>
      <div class="stat-card"><div class="stat-label">在册学生</div><div class="stat-value">${students.length}</div></div>
    </div>
    <div class="card"><div class="card-title">成绩趋势<span class="sub">按考试对比班级均分</span></div>
      <div class="chart-box"><canvas class="chart" id="scoreChart" width="900" height="260"></canvas></div>
      <div class="legend"><span><i style="background:#2563eb"></i>班级均分</span></div>
    </div>
    <div class="card"><div class="card-title">成绩明细</div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>各次成绩</th><th>平均分</th><th>趋势</th><th>标记</th><th style="width:130px">操作</th></tr></thead><tbody>
    ${rows.length ? rows.map(r=>`
      <tr data-ctx-id data-st="${r.st.id}">
        <td class="mono">${esc(r.st.sno)}</td>
        <td><b>${esc(r.st.name)}</b></td>
        <td>${esc(r.st.klass)}</td>
        <td>${r.ss.map(s=>`<span class="tag ${+s.score>=90?"green":(+s.score>=60?"":"red")}">${esc(s.exam)}:${s.score}</span>`).join("")||'<span class="muted">未录入</span>'}</td>
        <td><b>${r.avg}</b></td>
        <td>${r.trend===null?'<span class="muted">—</span>':`<span class="tag ${r.trend>=0?"green":"red"}">${r.trend>=0?"▲":"▼"} ${Math.abs(r.trend)}</span>`}</td>
        <td>${r.st.tag?`<span class="tag ${r.st.tag==="需关注"?"red":"green"}">${esc(r.st.tag)}</span>`:'<span class="muted">—</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" data-tag="${r.st.id}">标记</button><button class="btn btn-ghost btn-sm" data-es="${r.st.id}">录分</button></td>
      </tr>`).join("") : `<tr><td colspan="8">${eb()("暂无学生，请先新增学生")}</td></tr>`}
    </tbody></table></div></div>`;
    el.querySelector("#examSel").onchange = e=>{ exam=e.target.value; render(); };
    el.querySelector("#newStudent").onclick = ()=> editStudent(null);
    el.querySelector("#newScore").onclick = ()=> editScore(null);
    el.querySelectorAll("[data-tag]").forEach(b=> b.onclick = ()=> tagStudent(S.get("students",b.dataset.tag)));
    el.querySelectorAll("[data-es]").forEach(b=> b.onclick = ()=> editScore(null, S.get("students",b.dataset.es).name));
    bindCtx(el, item=>{ const st=S.get("students",item.dataset.st); if(!st) return [{label:"刷新",run:render}]; return [
      {label:"编辑学生", run:()=>editStudent(st)},
      {label:"录入成绩", run:()=>editScore(null,st.name)},
      {label:"标记情况", run:()=>tagStudent(st)},
      {label:"查看趋势", run:()=>{ exam="all"; render(); }},
      "-",
      {label:"删除学生", danger:true, run:()=>{ if(cfm("删除该学生及其成绩？")){ S.all("scores").filter(s=>s.student===st.name).forEach(s=>S.remove("scores",s.id)); S.remove("students",st.id); render(); }}}
    ];});
    // 图表
    const cv = el.querySelector("#scoreChart");
    const data = exams.map(e=>{ const arr=S.all("scores").filter(s=>s.exam===e).map(s=>+s.score); return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0; });
    window.__drawLine(cv, exams, data, "班级均分");
  }
  function editStudent(st){
    openDrawer(st?"编辑学生":"新增学生", `
      <div class="form-grid" data-draft-restore>
        <div class="field"><label>姓名<span class="req">*</span></label><input name="name" value="${esc(st?st.name:"")}"></div>
        <div class="field"><label>学号</label><input name="sno" value="${esc(st?st.sno:"")}"></div>
        <div class="field full"><label>班级</label><input name="klass" value="${esc(st?st.klass:"高一(3)班")}"></div>
        <div class="field full"><label>备注</label><textarea name="note" rows="3">${esc(st?st.note:"")}</textarea></div>
      </div>`,
      d=>{ if(!d.name){ toast("请填写姓名"); return false; }
        if(st) S.update("students",st.id,d); else S.insert("students",Object.assign({tag:""},d));
        toast("学生已保存"); }, st?"edit-st":"new-st");
  }
  function tagStudent(st){
    openDrawer("标记学生 · "+st.name, `
      <div class="field"><label>情况标记</label><select name="tag">
        ${["","进步明显","需关注","偏科","请假较多"].map(t=>`<option value="${t}" ${st.tag===t?"selected":""}>${t||"不标记"}</option>`).join("")}
      </select></div>
      <div class="field" style="margin-top:10px"><label>说明</label><textarea name="note" rows="4">${esc(st.note||"")}</textarea></div>`,
      d=>{ S.update("students",st.id,{tag:d.tag,note:d.note}); toast("已标记"); }, "tag-st");
  }
  function editScore(score, presetStudent){
    const students = S.all("students");
    const exams = [...new Set(S.all("scores").map(s=>s.exam))];
    openDrawer(score?"编辑成绩":"录入成绩", `
      <div class="form-grid" data-draft-restore>
        <div class="field"><label>学生<span class="req">*</span></label><select name="student">
          <option value="">请选择</option>
          ${students.map(s=>`<option ${score?score.student===s.name:(presetStudent===s.name?"selected":"")}>${esc(s.name)}</option>`).join("")}
        </select></div>
        <div class="field"><label>考试</label><input name="exam" list="examList" value="${esc(score?score.exam:"月考一")}" placeholder="月考一 / 期中…">
          <datalist id="examList">${exams.map(e=>`<option>${esc(e)}</option>`).join("")}</datalist></div>
        <div class="field"><label>日期</label><input type="date" name="date" value="${esc(score?score.date:today())}"></div>
        <div class="field"><label>分数<span class="req">*</span></label><input type="number" name="score" min="0" max="150" value="${score?score.score:""}"></div>
      </div>`,
      d=>{ if(!d.student){ toast("请选择学生"); return false; }
        if(d.score===""||d.score==null){ toast("请填写分数"); return false; }
        d.score = +d.score;
        if(score) S.update("scores",score.id,d); else S.insert("scores",d);
        toast("成绩已保存"); }, score?"edit-score":"new-score");
  }
  render();
});

/* ============ 6. 教学复盘 ============ */
UI.route("reflection", function(el){
  crumbs("教学复盘");
  const list = S.all("reflections").slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  el.innerHTML = `
  <div class="page-head"><div><div class="page-title">教学复盘</div><div class="page-sub">绑定课程 · 亮点 / 问题 / 改进 · 时间线展示</div></div>
    <div class="page-tools"><button class="btn btn-primary" id="newR">+ 新增复盘</button></div></div>
  <div class="timeline">
    ${list.length ? list.map(r=>`
      <div class="tl-item" data-ctx-id data-r="${r.id}">
        <div class="tl-date">${esc(r.date)} · 课程：${esc(r.course)}</div>
        <div class="tl-head"><div class="tl-title">${esc(r.lesson)}</div>
          <div class="flexrow"><button class="btn btn-ghost btn-sm" data-edit="${r.id}">编辑</button><button class="btn btn-danger btn-sm" data-del="${r.id}">删除</button></div></div>
        <div class="tl-sec"><b>✨ 课堂亮点：</b>${esc(r.highlight||"—")}</div>
        <div class="tl-sec"><b>⚠️ 存在问题：</b>${esc(r.problem||"—")}</div>
        <div class="tl-sec"><b>🔧 改进方向：</b>${esc(r.improve||"—")}</div>
        ${r.todo?`<div class="tl-sec"><b>📌 待办：</b>${esc(r.todo)}</div>`:""}
      </div>`).join("") : `<div class="card">${eb()("暂无复盘记录，点击右上角新增")}</div>`}
  </div>`;
  el.querySelector("#newR").onclick = ()=> edit(null);
  el.querySelectorAll("[data-edit]").forEach(b=> b.onclick = ()=> edit(S.get("reflections",b.dataset.edit)));
  el.querySelectorAll("[data-del]").forEach(b=> b.onclick = ()=>{ if(cfm("删除该复盘？")){ S.remove("reflections",b.dataset.del); render0(); }});
  function render0(){ location.hash="#/reflection"; UI.route && (window.dispatchEvent(new HashChangeEvent("hashchange"))); }
  bindCtx(el, item=>{ const r=S.get("reflections",item.dataset.r); if(!r) return []; return [
    {label:"编辑", run:()=>edit(r)},
    {label:"复制", run:()=>{ S.insert("reflections",Object.assign({},r,{id:undefined})); toast("已复制"); location.reload(); }},
    {label:"删除", danger:true, run:()=>{ if(cfm("删除该复盘？")){ S.remove("reflections",r.id); location.reload(); }}}
  ];});
  function edit(r){
    const lessons = S.all("lessons");
    openDrawer(r?"编辑复盘":"新增复盘", `
      <div class="form-grid" data-draft-restore>
        <div class="field"><label>关联课程<span class="req">*</span></label><input name="lesson" list="lessonList" value="${esc(r?r.lesson:"")}" placeholder="课程名"></div>
        <datalist id="lessonList">${lessons.map(l=>`<option>${esc(l.title)}</option>`).join("")}</datalist>
        <div class="field"><label>学科</label><input name="course" value="${esc(r?r.course:"")}" placeholder="数学"></div>
        <div class="field full"><label>日期</label><input type="date" name="date" value="${esc(r?r.date:today())}"></div>
        <div class="field full"><label>课堂亮点</label><textarea name="highlight" rows="2">${esc(r?r.highlight:"")}</textarea></div>
        <div class="field full"><label>存在问题</label><textarea name="problem" rows="2">${esc(r?r.problem:"")}</textarea></div>
        <div class="field full"><label>改进方向</label><textarea name="improve" rows="2">${esc(r?r.improve:"")}</textarea></div>
        <div class="field full"><label>产生的待办</label><input name="todo" value="${esc(r?r.todo:"")}" placeholder="选填，保存后同步为任务"></div>
      </div>`,
      d=>{ if(!d.lesson){ toast("请填写关联课程"); return false; }
        if(r) S.update("reflections",r.id,d); else {
          const nr = S.insert("reflections",d);
          if(d.todo) S.insert("tasks",{text:d.todo,due:d.date,priority:"中",done:false,source:"教学复盘"});
        }
        toast("复盘已保存"); }, r?"edit-r":"new-r");
  }
});

/* ============ 7. 教学计划 ============ */
UI.route("planning", function(el){
  crumbs("教学计划");
  let tab = "month";
  const now = new Date();
  let curY = now.getFullYear(), curM = now.getMonth();
  function render(){
    el.innerHTML = `
    <div class="page-head"><div><div class="page-title">教学计划</div><div class="page-sub">周计划 / 月计划 · 日历视图 · 任务自动同步首页待办</div></div>
      <div class="page-tools"><button class="btn btn-primary" id="newC">+ 新增计划事项</button></div></div>
    <div class="tabs">
      <div class="tab ${tab==="cal"?"on":""}" data-t="cal">📅 日历视图</div>
      <div class="tab ${tab==="week"?"on":""}" data-t="week">周计划</div>
      <div class="tab ${tab==="month"?"on":""}" data-t="month">月计划</div>
      <div class="tab ${tab==="task"?"on":""}" data-t="task">任务清单(同步首页)</div>
    </div>
    <div id="planBody"></div>`;
    el.querySelectorAll(".tab").forEach(t=> t.onclick = ()=>{ tab=t.dataset.t; render(); });
    el.querySelector("#newC").onclick = ()=> editEv(null);
    const body = el.querySelector("#planBody");
    if(tab==="cal") renderCal(body);
    else if(tab==="week") renderList(body,"week","周计划");
    else if(tab==="month") renderList(body,"month","月计划");
    else renderTasks(body);
    bindCtx(el, item=>{
      if(item.dataset.ev){ const ev=S.get("calendar",item.dataset.ev); return [
        {label:"编辑", run:()=>editEv(ev)},
        {label:ev.done?"标记未完成":"标记完成", run:()=>{ S.update("calendar",ev.id,{done:!ev.done}); render(); }},
        {label:ev.type==="task"||ev.type==="month"?"同步为首页任务":"转为首页任务", run:()=>{ S.insert("tasks",{text:ev.title,due:ev.date,priority:"中",done:false,source:"教学计划"}); toast("已同步到首页待办"); }},
        "-",
        {label:"删除", danger:true, run:()=>{ if(cfm("删除该事项？")){ S.remove("calendar",ev.id); render(); }}}
      ];}
      if(item.dataset.tk){ const t=S.get("tasks",item.dataset.tk); return [
        {label:"编辑", run:()=>window.__openTaskDrawer(t)},
        {label:t.done?"标记未完成":"标记完成", run:()=>{ S.update("tasks",t.id,{done:!t.done}); render(); }},
        "-",
        {label:"删除", danger:true, run:()=>{ if(cfm("删除该任务？")){ S.remove("tasks",t.id); render(); }}}
      ];}
      return [{label:"新增", run:()=>editEv(null)}];
    });
  }
  function renderCal(body){
    const first = new Date(curY, curM, 1);
    const startDow = (first.getDay()+6)%7; // 周一起
    const daysInM = new Date(curY, curM+1, 0).getDate();
    const events = S.all("calendar");
    const td = today();
    let cells = "";
    for(let i=0;i<42;i++){
      const dNum = i - startDow + 1;
      let dateStr, other=false;
      if(dNum<1){ const d=new Date(curY,curM, dNum); dateStr=fmt(d); other=true; }
      else if(dNum>daysInM){ const d=new Date(curY,curM+1, dNum-daysInM); dateStr=fmt(d); other=true; }
      else dateStr = `${curY}-${String(curM+1).padStart(2,"0")}-${String(dNum).padStart(2,"0")}`;
      const evs = events.filter(e=>e.date===dateStr);
      cells += `<div class="cal-cell ${other?"other":""} ${dateStr===td?"today":""}" data-day="${dateStr}" data-ctx-id>
        <div class="cal-daynum">${dateStr.slice(5)}</div>
        ${evs.map(e=>`<div class="cal-ev ${e.done?"done":""}" data-ev="${e.id}" data-ctx-id>${esc(e.title)}</div>`).join("")}
      </div>`;
      if(i>=35 && dNum>=daysInM) break;
    }
    body.innerHTML = `
      <div class="cal-head">
        <div class="flexrow"><button class="btn btn-ghost btn-sm" data-mv="-1">← 上月</button>
        <b style="font-size:16px">${curY} 年 ${curM+1} 月</b>
        <button class="btn btn-ghost btn-sm" data-mv="1">下月 →</button>
        <button class="btn btn-ghost btn-sm" data-mv="0">今天</button></div>
        <span class="muted" style="font-size:12px">点击日期格新增；右键事项编辑</span>
      </div>
      <div class="cal-grid">
        ${["一","二","三","四","五","六","日"].map(d=>`<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>`;
    body.querySelectorAll("[data-mv]").forEach(b=> b.onclick = ()=>{
      const v = +b.dataset.mv;
      if(v===0){ curY=now.getFullYear(); curM=now.getMonth(); }
      else { curM+=v; if(curM<0){curM=11;curY--;} if(curM>11){curM=0;curY++;} }
      render();
    });
    body.querySelectorAll(".cal-cell").forEach(c=> c.onclick = e=>{
      if(e.target.dataset.ev) return;
      editEv(null, c.dataset.day);
    });
  }
  function fmt(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function renderList(body, type, title){
    const evs = S.all("calendar").filter(e=>e.type===type || (type==="week" && e.type==="week")).sort((a,b)=>a.date.localeCompare(b.date));
    const all = S.all("calendar").filter(e=> e.type===type).sort((a,b)=>a.date.localeCompare(b.date));
    body.innerHTML = `
      <div class="card"><div class="card-title">${title === "周计划" ? "📅 本周及近期周计划" : "🗓 月度计划"}<span class="sub">${all.length} 项</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>日期</th><th>事项</th><th>类型</th><th>状态</th><th style="width:130px">操作</th></tr></thead><tbody>
      ${all.length ? all.map(e=>`
        <tr data-ctx-id data-ev="${e.id}" class="${e.done?"row-done":""}">
          <td>${esc(e.date)}</td>
          <td>${esc(e.title)}</td>
          <td><span class="tag gray">${e.type==="week"?"周":"月"}</span></td>
          <td><span class="tag ${e.done?"green":"orange"}">${e.done?"已完成":"进行中"}</span></td>
          <td><button class="btn btn-ghost btn-sm" data-edit="${e.id}">编辑</button><button class="btn btn-ghost btn-sm" data-done="${e.id}">${e.done?"取消完成":"完成"}</button><button class="btn btn-danger btn-sm" data-del="${e.id}">删除</button></td>
        </tr>`).join("") : `<tr><td colspan="5">${eb()("暂无"+title+"，点击右上角新增")}</td></tr>`}
      </tbody></table></div></div>
      <div class="card"><div class="card-title">全部任务(与首页待办实时同步)</div>
        ${S.all("tasks").length ? S.all("tasks").map(t=>`
          <div class="todo-item ${t.done?"done":""}" data-ctx-id data-tk="${t.id}">
            <input type="checkbox" data-tcheck="${t.id}" ${t.done?"checked":""}>
            <span class="todo-text">${esc(t.text)}</span>
            <span class="todo-meta">${esc(t.due||"")} · ${esc(t.source||"")}</span>
          </div>`).join("") : eb()("暂无任务")}
      </div>`;
    body.querySelectorAll("[data-edit]").forEach(b=> b.onclick = ()=> editEv(S.get("calendar",b.dataset.edit)));
    body.querySelectorAll("[data-del]").forEach(b=> b.onclick = ()=>{ if(cfm("删除该事项？")){ S.remove("calendar",b.dataset.del); render(); }});
    body.querySelectorAll("[data-done]").forEach(b=> b.onclick = ()=>{ const e=S.get("calendar",b.dataset.done); S.update("calendar",e.id,{done:!e.done}); render(); });
    body.querySelectorAll("[data-tcheck]").forEach(cb=> cb.onchange = ()=>{ S.update("tasks",cb.dataset.tcheck,{done:cb.checked}); render(); });
  }
  function renderTasks(body){
    const tasks = S.all("tasks");
    body.innerHTML = `
      <div class="card"><div class="card-title">任务清单<span class="sub">勾选完成 · 右键编辑/删除 · 同步首页待办</span></div>
      <div class="flexrow" style="margin-bottom:10px"><button class="btn btn-primary btn-sm" id="addT">+ 新建任务</button><button class="btn btn-ghost btn-sm" id="impT">导入备份</button></div>
      ${tasks.length ? tasks.map(t=>`
        <div class="todo-item ${t.done?"done":""}" data-ctx-id data-tk="${t.id}">
          <input type="checkbox" data-tcheck="${t.id}" ${t.done?"checked":""}>
          <span class="todo-text">${esc(t.text)}</span>
          <span class="todo-meta">${esc(t.due||"")} · ${esc(t.priority||"")}优先 · ${esc(t.source||"")}</span>
        </div>`).join("") : eb()("暂无任务")}
      </div>`;
    body.querySelector("#addT").onclick = ()=> window.__openTaskDrawer(null);
    body.querySelector("#impT").onclick = ()=> UI.pickImport();
    body.querySelectorAll("[data-tcheck]").forEach(cb=> cb.onchange = ()=>{ S.update("tasks",cb.dataset.tcheck,{done:cb.checked}); render(); });
  }
  function editEv(ev, presetDate){
    openDrawer(ev?"编辑计划事项":"新增计划事项", `
      <div class="form-grid" data-draft-restore>
        <div class="field full"><label>事项<span class="req">*</span></label><input name="title" value="${esc(ev?ev.title:"")}"></div>
        <div class="field"><label>日期</label><input type="date" name="date" value="${esc(ev?ev.date:(presetDate||today()))}"></div>
        <div class="field"><label>计划类型</label><select name="type">
          <option value="week" ${ev&&ev.type==="week"?"selected":(!ev&&tab==="week"?"selected":"")}>周计划</option>
          <option value="month" ${ev&&ev.type==="month"?"selected":((!ev&&tab!=="week")?"selected":"")}>月计划</option>
          <option value="course" ${ev&&ev.type==="course"?"selected":""}>课程</option>
          <option value="task" ${ev&&ev.type==="task"?"selected":""}>任务</option>
        </select></div>
        <div class="field full"><label><input type="checkbox" name="syncTask" value="1" style="width:auto;vertical-align:-2px"> 同时同步为首页待办任务</label></div>
      </div>`,
      d=>{ if(!d.title){ toast("请填写事项"); return false; }
        const sync = (d.syncTask||[]).length>0; delete d.syncTask;
        if(ev) S.update("calendar",ev.id,d); else S.insert("calendar",Object.assign({done:false},d));
        if(sync) S.insert("tasks",{text:d.title,due:d.date,priority:"中",done:false,source:"教学计划"});
        toast(sync?"已保存并同步首页待办":"计划已保存"); }, ev?"edit-ev":"new-ev");
  }
  render();
});

})();