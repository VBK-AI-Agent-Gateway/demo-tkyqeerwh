/* ===== 教学计划: 周/月视图 + 日历 + 任务同步首页待办 ===== */
let PLAN_VIEW = '月视图';
let CAL_Y = new Date().getFullYear();
let CAL_M = new Date().getMonth(); // 0-11

function planForm(p){
  return `
  <div class="form-row"><label>类型</label>
    <select name="kind">${UI.options(['周计划','月计划','日历'], p.kind||'周计划')}</select></div>
  <div class="form-row"><label>标题 <span class="req">*</span></label>
    <input type="text" name="title" value="${UI.esc(p.title||'')}" placeholder="例如：完成二次函数单元教学"></div>
  <div class="form-grid">
    <div class="form-row"><label>开始日期</label><input type="date" name="start" value="${UI.esc(p.start||p.date||UI.today())}"></div>
    <div class="form-row"><label>结束/日期</label><input type="date" name="end" value="${UI.esc(p.end||p.date||UI.today())}"></div>
  </div>
  <div class="form-row"><label>同步为首页待办</label>
    <select name="syncTask">${UI.options([{v:'no',l:'不同步'},{v:'yes',l:'同步一条待办任务'}], 'no')}</select>
    <div class="hint">选择同步后，将在首页“待完成任务”中出现同一事项，可勾选完成</div>
  </div>`;
}

function openPlanDrawer(id, preset){
  const p = id ? DB.get('plans', id) : null;
  UI.openDrawer({
    title: p ? '编辑计划' : '新增计划',
    formKey: 'plan',
    body: planForm(Object.assign({}, preset||{}, p|| {})),
    onSave(v){
      if(!v.title.trim()){ UI.toast('请填写标题'); return false; }
      const data = { kind:v.kind, title:v.title.trim(), start:v.start, end:v.end, date:v.start, done:p?p.done:false };
      if(p) DB.update('plans', p.id, data);
      else DB.insert('plans', data);
      if(v.syncTask === 'yes'){
        DB.insert('tasks', { text:v.title.trim(), due:v.start, done:false, from:'planning' });
      }
      rerender();
    }
  });
}
window.openPlanDrawer = openPlanDrawer;

function renderPlanning(view){
  const plans = DB.list('plans');
  const tasks = DB.list('tasks');
  const lessons = DB.list('lessonplans');

  // 日历格子
  function monthGrid(){
    const first = new Date(CAL_Y, CAL_M, 1);
    const startDow = (first.getDay() + 6) % 7; // 周一起始
    const daysInMonth = new Date(CAL_Y, CAL_M+1, 0).getDate();
    const prevDays = new Date(CAL_Y, CAL_M, 0).getDate();
    const iso = (y,m,d)=> y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const today = UI.today();
    let cells = '';
    for(let i=0;i<42;i++){
      let y=CAL_Y, m=CAL_M, d, dim=false;
      if(i < startDow){ d = prevDays - startDow + 1 + i; m = CAL_M-1; dim=true; if(m<0){m=11;y--;} }
      else if(i - startDow >= daysInMonth){ d = i - startDow - daysInMonth + 1; m = CAL_M+1; dim=true; if(m>11){m=0;y++;} }
      else { d = i - startDow + 1; }
      const date = iso(y,m,d);
      const evs = [];
      plans.forEach(p=>{
        const s = p.start||p.date, e = p.end||p.date;
        if(s && e && date >= s && date <= e)
          evs.push(`<div class="cal-ev" data-pid="${p.id}">${UI.esc(p.title)}</div>`);
      });
      tasks.filter(t=>t.due===date).forEach(t=>
        evs.push(`<div class="cal-ev task" data-tid="${t.id}">${t.done?'✓ ':''}${UI.esc(t.text)}</div>`));
      lessons.filter(l=>l.date===date && !l.archived).forEach(l=>
        evs.push(`<div class="cal-ev" style="background:#ecfdf5;color:#047857" title="课程">📖 ${UI.esc(l.title)}</div>`));
      cells += `<div class="cal-cell ${dim?'dim':''} ${date===today?'today':''}" data-date="${date}">
        <div class="d">${d}</div>${evs.slice(0,4).join('')}${evs.length>4?'<div class="hint">+'+(evs.length-4)+'</div>':''}</div>`;
      if(i >= 41) break;
    }
    return `<div class="cal-grid">
      ${['一','二','三','四','五','六','日'].map(x=>`<div class="cal-dow">${x}</div>`).join('')}
      ${cells}</div>`;
  }

  const monthLabel = CAL_Y + ' 年 ' + (CAL_M+1) + ' 月';

  let bodyHTML;
  if(PLAN_VIEW === '日历视图'){
    bodyHTML = `<div class="card">
      <div class="cal-head">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-sm" id="calPrev">‹ 上月</button>
          <strong style="font-size:15px">${monthLabel}</strong>
          <button class="btn btn-sm" id="calNext">下月 ›</button>
          <button class="btn btn-sm" id="calToday">回到今天</button>
        </div>
        <span class="hint">点击空白格可快速新建计划；蓝=计划，黄=任务，绿=课程</span>
      </div>
      ${monthGrid()}
    </div>`;
  } else {
    const kind = PLAN_VIEW === '周视图' ? '周计划' : '月计划';
    const list = plans.filter(p=>p.kind===kind);
    bodyHTML = `<div class="card">
      <div class="card-title">${PLAN_VIEW}（${kind}）<span class="hint">周/月计划按开始日期排序</span></div>
      ${list.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th style="width:34px"></th><th>事项</th><th>开始</th><th>结束</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${list.map(p=>`<tr data-id="${p.id}">
          <td><input type="checkbox" class="pDone" ${p.done?'checked':''} style="accent-color:var(--primary)"></td>
          <td><strong>${UI.esc(p.title)}</strong></td>
          <td>${UI.esc(p.start||'')}</td>
          <td>${UI.esc(p.end||'')}</td>
          <td><span class="badge ${p.done?'green':''}">${p.done?'已完成':'进行中'}</span></td>
          <td class="ops"><button class="btn btn-xs" data-act="edit">编辑</button><button class="btn btn-xs" data-act="del">删除</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty">暂无'+kind+'，点击右上角新增</div>'}
    </div>`;
  }

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">教学计划</div><div class="page-sub">周计划 / 月计划 / 日历视图 · 计划与任务同步首页待办</div></div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="pNewTask">＋ 新增任务</button>
      <button class="btn btn-primary" id="pNew">＋ 新增计划</button>
    </div>
  </div>
  <div class="toolbar">
    <div class="seg">
      ${['周视图','月视图','日历视图'].map(v=>`<button data-v="${v}" class="${PLAN_VIEW===v?'active':''}">${v}</button>`).join('')}
    </div>
    <div class="spacer"></div>
    <span class="hint">未完成任务 ${tasks.filter(t=>!t.done).length} 项 · 已完成 ${tasks.filter(t=>t.done).length} 项</span>
  </div>
  ${bodyHTML}
  <div class="card" style="margin-top:14px">
    <div class="card-title">全部任务（同步首页待办）</div>
    <div id="pTasks">
    ${tasks.length ? tasks.map(t=>`
      <label class="task-item ${t.done?'done':''}" data-id="${t.id}">
        <input type="checkbox" ${t.done?'checked':''}>
        <span class="task-text">${UI.esc(t.text)}</span>
        <span class="task-due">${UI.esc(t.due||'')}</span>
        <button class="btn btn-xs" data-act="del" type="button">删除</button>
      </label>`).join('') : '<div class="empty">暂无任务</div>'}
    </div>
  </div>`;

  view.querySelectorAll('.seg button').forEach(b=> b.onclick = ()=>{ PLAN_VIEW = b.dataset.v; rerender(); });
  document.getElementById('pNew').onclick = ()=>openPlanDrawer();
  document.getElementById('pNewTask').onclick = ()=>{
    UI.openDrawer({
      title:'新增任务', formKey:'task',
      body:`<div class="form-row"><label>任务内容 <span class="req">*</span></label><input type="text" name="text"></div>
            <div class="form-row"><label>截止日期</label><input type="date" name="due" value="${UI.today()}"></div>`,
      onSave(v){
        if(!v.text.trim()){ UI.toast('请填写任务内容'); return false; }
        DB.insert('tasks', { text:v.text.trim(), due:v.due, done:false, from:'planning' });
        rerender();
      }
    });
  };
  const cp = document.getElementById('calPrev');
  if(cp){
    cp.onclick = ()=>{ CAL_M--; if(CAL_M<0){CAL_M=11;CAL_Y--;} rerender(); };
    document.getElementById('calNext').onclick = ()=>{ CAL_M++; if(CAL_M>11){CAL_M=0;CAL_Y++;} rerender(); };
    document.getElementById('calToday').onclick = ()=>{ const n=new Date(); CAL_Y=n.getFullYear(); CAL_M=n.getMonth(); rerender(); };
    view.querySelectorAll('.cal-cell').forEach(cell=>{
      cell.onclick = e=>{
        if(e.target.closest('.cal-ev')) return;
        openPlanDrawer(null, { kind:'日历', start:cell.dataset.date, end:cell.dataset.date, title:'' });
      };
      cell.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
        { act:'np', label:'在此日新建计划', run:()=>openPlanDrawer(null,{kind:'日历',start:cell.dataset.date,end:cell.dataset.date}) },
        { act:'nt', label:'在此日新建任务', run:()=>{
            DB.insert('tasks',{ text:'新任务', due:cell.dataset.date, done:false, from:'planning' }); rerender();
          } }
      ]));
    });
    view.querySelectorAll('.cal-ev[data-pid]').forEach(ev=>{
      ev.onclick = e=>{ e.stopPropagation(); openPlanDrawer(ev.dataset.pid); };
    });
  }
  view.querySelectorAll('tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    const chk = tr.querySelector('.pDone');
    if(chk) chk.onchange = ()=>{ DB.update('plans', id, { done: chk.checked }); rerender(); };
    tr.querySelectorAll('button[data-act]').forEach(b=> b.onclick = ()=>{
      if(b.dataset.act==='edit') openPlanDrawer(id);
      if(b.dataset.act==='del'){ DB.remove('plans', id); rerender(); UI.toast('已删除'); }
    });
    tr.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑计划', run:()=>openPlanDrawer(id) },
      { act:'copy', label:'复制计划', run:()=>{ DB.duplicate('plans', id); rerender(); UI.toast('已复制'); } },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>{ DB.remove('plans', id); rerender(); UI.toast('已删除'); } }
    ]));
  });
  view.querySelectorAll('#pTasks .task-item').forEach(el=>{
    el.querySelector('input').onchange = e=>{
      DB.update('tasks', el.dataset.id, { done:e.target.checked }); rerender();
    };
    el.querySelector('[data-act=del]').onclick = e=>{ e.stopPropagation(); DB.remove('tasks', el.dataset.id); rerender(); UI.toast('已删除'); };
    el.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'del', label:'删除任务', danger:true, run:()=>{ DB.remove('tasks', el.dataset.id); rerender(); } }
    ]));
  });
}