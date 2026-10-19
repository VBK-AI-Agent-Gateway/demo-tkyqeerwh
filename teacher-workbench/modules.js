/* 各模块渲染：仪表盘 + 7 大模块 */
(function(){
"use strict";
const {esc, qs, qsa, toast, confirm:cfm, openDrawer, closeDrawer, setCrumbs, today, bindCtx} = UI;
const S = DB.Store;

/* 通用：表格分页辅助（简化为全量） */
function emptyBox(txt){ return `<div class="empty"><div class="big">📄</div>${esc(txt)}</div>`; }

/* ================= 仪表盘 ================= */
UI.route("dashboard", function(el){
  const lessons = S.all("lessons").filter(x=>x.status!=="archived");
  const todays = lessons.slice(0,4);
  const tasks = S.query("tasks", x=>!x.done).sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  const plans = S.all("plans").slice(-3).reverse();
  const students = S.all("students");
  const scores = S.all("scores");
  const avg = scores.length ? (scores.reduce((s,x)=>s+ +x.score,0)/scores.length).toFixed(1) : "-";

  el.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">首页仪表盘</div><div class="page-sub">${new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})} · 王老师，欢迎回来</div></div>
    <div class="page-tools">
      <button class="btn btn-ghost btn-sm" id="dashImport">导入备份</button>
      <button class="btn btn-primary" id="dashNewTask">+ 新建任务</button>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom:14px">
    <div class="stat-card"><div class="stat-label">进行中课程</div><div class="stat-value">${lessons.length}</div><div class="stat-foot">归档 ${S.query("lessons",x=>x.status==="archived").length} 门</div></div>
    <div class="stat-card"><div class="stat-label">待完成任务</div><div class="stat-value">${tasks.length}</div><div class="stat-foot">高优先级 ${tasks.filter(t=>t.priority==="高").length} 项</div></div>
    <div class="stat-card"><div class="stat-label">题库总量</div><div class="stat-value">${S.all("questions").length}</div><div class="stat-foot">知识点 ${new Set(S.all("questions").map(q=>q.point)).size} 个</div></div>
    <div class="stat-card"><div class="stat-label">学生均分</div><div class="stat-value">${avg}</div><div class="stat-foot">在册学生 ${students.length} 人</div></div>
  </div>

  <div class="grid g2">
    <div class="card">
      <div class="card-title">今日课程<span class="sub">最近课程安排</span></div>
      <div class="today-list">
        ${todays.length ? todays.map(l=>`
          <div class="today-item" data-ctx-id data-lesson="${l.id}">
            <span class="today-time">${esc(l.period)} ${esc(l.date.slice(5))}</span>
            <span class="today-name"><b>${esc(l.title)}</b><div class="muted" style="font-size:12px">${esc(l.grade)} · ${esc(l.classroom)} · ${esc(l.subject)}</div></span>
            <a class="btn btn-ghost btn-sm" href="#/lesson-prep">查看备课</a>
          </div>`).join("") : emptyBox("暂无课程，去「课程备课」新增")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">待完成任务<span class="sub">勾选即完成</span></div>
      <div id="todoList">
        ${tasks.length ? tasks.map(t=>`
          <div class="todo-item" data-ctx-id data-task="${t.id}">
            <input type="checkbox" data-check="${t.id}">
            <span class="todo-text">${esc(t.text)}</span>
            <span class="todo-meta">${esc(t.due||"")} · ${esc(t.priority||"")}优先</span>
          </div>`).join("") : emptyBox("全部任务已完成 🎉")}
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" id="todoAdd">+ 添加任务</button>
    </div>

    <div class="card">
      <div class="card-title">最近教案<a href="#/lesson-plans" class="btn btn-ghost btn-sm">全部教案 →</a></div>
      ${plans.length ? plans.map(p=>`
        <div class="mini-plan" data-ctx-id data-plan="${p.id}">
          <div class="t">${esc(p.title)}</div>
          <div class="d">${esc(p.folder)} · 更新于 ${esc(p.updatedAt||"")}</div>
          <div>${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
        </div>`).join("") : emptyBox("暂无教案")}
    </div>

    <div class="card">
      <div class="card-title">学生数据概览<a href="#/scores" class="btn btn-ghost btn-sm">成绩详情 →</a></div>
      <div class="chart-box"><canvas class="chart" id="dashChart" width="520" height="220"></canvas></div>
      <div class="legend"><span><i style="background:#2563eb"></i>班级均分</span></div>
      <div class="flexrow" style="margin-top:10px">
        ${students.slice(0,6).map(s=>`<span class="tag ${s.tag==="需关注"?"red":(s.tag?"green":"gray")}">${esc(s.name)}${s.tag?" · "+esc(s.tag):""}</span>`).join("")}
      </div>
    </div>
  </div>`;

  // 待办勾选
  el.querySelectorAll("[data-check]").forEach(cb=>{
    cb.onchange = ()=>{ S.update("tasks", cb.dataset.check, {done:cb.checked}); toast(cb.checked?"任务已完成":"任务已恢复"); navigate(); };
  });
  const nav = ()=> location.hash === "#/dashboard" ? (window.dispatchEvent(new HashChangeEvent("hashchange"))) : location.hash="#/dashboard";
  qs("#todoAdd").onclick = openTaskDrawer;
  qs("#dashNewTask").onclick = openTaskDrawer;
  qs("#dashImport").onclick = ()=> UI.pickImport();
  bindCtx(el, item=>{
    if(item.dataset.task) return [
      {label:"编辑任务", run:()=>openTaskDrawer(S.get("tasks",item.dataset.task))},
      {label:item.querySelector("[data-check]") && !S.get("tasks",item.dataset.task).done ? "标记完成":"标记未完成", run:()=>{ const t=S.get("tasks",item.dataset.task); S.update("tasks",t.id,{done:!t.done}); navigate(); }},
      "-",
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该任务？")){ S.remove("tasks",item.dataset.task); navigate(); }}}
    ];
    if(item.dataset.lesson) return [
      {label:"编辑备课", run:()=>{ location.hash="#/lesson-prep"; setTimeout(()=>window.__editLesson && window.__editLesson(+item.dataset.lesson),80); }},
      {label:"复制备课", run:()=>{ const l=S.get("lessons",item.dataset.lesson); S.insert("lessons",Object.assign({},l,{title:l.title+" (副本)"})); toast("已复制课程"); }},
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该课程？")){ S.remove("lessons",item.dataset.lesson); navigate(); }}}
    ];
    if(item.dataset.plan) return [
      {label:"编辑教案", run:()=>{ location.hash="#/lesson-plans"; setTimeout(()=>window.__editPlan && window.__editPlan(+item.dataset.plan),80); }},
      {label:"删除", danger:true, run:()=>{ if(cfm("删除该教案？")){ S.remove("plans",item.dataset.plan); navigate(); }}}
    ];
    return [{label:"刷新", run:navigate}];
  });
  drawDashChart();
});

function drawDashChart(){
  const cv = qs("#dashChart"); if(!cv) return;
  const exams = [...new Set(S.all("scores").map(s=>s.exam))];
  const data = exams.map(e=>{
    const arr = S.all("scores").filter(s=>s.exam===e).map(s=>+s.score);
    return arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  });
  drawLine(cv, exams, data, "班级均分");
}

/* 通用折线图 */
function drawLine(cv, labels, data, label){
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, pad = 34;
  ctx.clearRect(0,0,W,H);
  const max = Math.max(100, ...data)*1.05, min = 0;
  ctx.strokeStyle = "#e5e7eb"; ctx.fillStyle="#6b7280"; ctx.font = "11px sans-serif"; ctx.textAlign="right";
  for(let i=0;i<=4;i++){
    const y = pad + (H-pad*1.6)*i/4;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-10,y); ctx.stroke();
    ctx.fillText(Math.round(max-(max-min)*i/4), pad-6, y+4);
  }
  if(!data.length) return;
  const x = i => pad + (W-pad-14) * (data.length===1?0.5:i/(data.length-1));
  const y = v => pad + (H-pad*1.6) * (1-(v-min)/(max-min));
  ctx.strokeStyle="#2563eb"; ctx.lineWidth=2.5; ctx.beginPath();
  data.forEach((v,i)=> i? ctx.lineTo(x(i),y(v)) : ctx.moveTo(x(i),y(v)));
  ctx.stroke();
  ctx.fillStyle="#2563eb";
  data.forEach((v,i)=>{ ctx.beginPath(); ctx.arc(x(i),y(v),4,0,7); ctx.fill(); });
  ctx.fillStyle="#6b7280"; ctx.textAlign="center";
  labels.forEach((l,i)=> ctx.fillText(l, x(i), H-10));
  if(label){
    ctx.textAlign="left"; ctx.fillStyle="#1f2937"; ctx.font="bold 12px sans-serif";
    ctx.fillText(label, pad, 16);
  }
}
window.__drawLine = drawLine;

function openTaskDrawer(task){
  const t = task || {};
  openDrawer(task?"编辑任务":"新建任务", `
    <div class="form-grid">
      <div class="field full"><label>任务内容<span class="req">*</span></label><input name="text" value="${esc(t.text||"")}" placeholder="例如：批改月考二试卷"></div>
      <div class="field"><label>截止日期</label><input type="date" name="due" value="${esc(t.due||today())}"></div>
      <div class="field"><label>优先级</label><select name="priority">${["高","中","低"].map(p=>`<option ${t.priority===p?"selected":""}>${p}</option>`).join("")}</select></div>
      <div class="field full"><label>来源</label><input name="source" value="${esc(t.source||"手工")}" readonly></div>
    </div>`,
    d=>{
      if(!d.text){ toast("请填写任务内容"); return false; }
      if(task) S.update("tasks",task.id,d); else S.insert("tasks",Object.assign({done:false},d));
      toast("任务已保存");
    }, "task");
}
window.__openTaskDrawer = openTaskDrawer;
window.__emptyBox = emptyBox;
window.__drawLine = drawLine;
})();