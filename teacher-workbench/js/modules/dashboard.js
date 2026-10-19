/* ===== 首页仪表盘 ===== */
function renderDashboard(view){
  const today = UI.today();
  const lessons = DB.list('lesson-plans' === '' ? 'x' : 'lessonplans');
  const todayList = lessons.filter(l => !l.archived && l.date === today);
  const upcoming = lessons.filter(l => !l.archived && l.date > today).slice(0,3);
  const tasks = DB.list('tasks').sort((a,b)=> (a.due||'').localeCompare(b.due||''));
  const openTasks = tasks.filter(t=>!t.done);
  const notes = DB.list('notes').sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4);
  const students = DB.list('students');
  const scores = DB.list('scores');
  const avg = scores.length ? (scores.reduce((s,x)=>s+(+x.score||0),0)/scores.length).toFixed(1) : '--';

  view.innerHTML = `
  <div class="page-head">
    <div>
      <div class="page-title">工作台首页</div>
      <div class="page-sub">${today} · 今天有 ${todayList.length} 节课，${openTasks.length} 项待办</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="dashNewTask">＋ 待办任务</button>
      <button class="btn btn-primary" id="dashNewLesson">＋ 今日备课</button>
    </div>
  </div>

  <div class="grid grid-4" style="margin-bottom:14px">
    <div class="stat-card"><div class="stat-ico">📚</div><div><div class="stat-num">${lessons.filter(l=>!l.archived).length}</div><div class="stat-label">进行中备课</div></div></div>
    <div class="stat-card"><div class="stat-ico">📝</div><div><div class="stat-num">${DB.list('notes').length}</div><div class="stat-label">教案总数</div></div></div>
    <div class="stat-card"><div class="stat-ico">👥</div><div><div class="stat-num">${students.length}</div><div class="stat-label">学生档案</div></div></div>
    <div class="stat-card"><div class="stat-ico">📈</div><div><div class="stat-num">${avg}</div><div class="stat-label">平均分（全部成绩）</div></div></div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">今日课程 <a href="#/lesson-plans" style="font-size:12px;font-weight:400">全部 →</a></div>
      <div id="dashToday">
        ${todayList.length ? todayList.map(l=>`
          <div class="today-course" data-id="${l.id}">
            <div><div class="tc-name">${UI.esc(l.title)}</div>
            <div class="tc-meta">${UI.esc(l.time||'')} · ${UI.esc(l.room||'')} · ${UI.esc(l.subject||'')}</div></div>
            <span class="badge">${UI.esc(l.status||'待上')}</span>
          </div>`).join('') : '<div class="empty">今天暂无排课</div>'}
        ${upcoming.length ? '<div class="hint" style="margin-top:8px">接下来：</div>' + upcoming.map(l=>`
          <div class="today-course" data-id="${l.id}" style="opacity:.85">
            <div><div class="tc-name">${UI.esc(l.title)}</div>
            <div class="tc-meta">${UI.esc(l.date)} ${UI.esc(l.time||'')} · ${UI.esc(l.room||'')}</div></div>
            <span class="badge gray">${UI.esc(l.status||'待上')}</span>
          </div>`).join('') : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title">待完成任务 <a href="#/planning" style="font-size:12px;font-weight:400">计划视图 →</a></div>
      <div id="dashTasks">
        ${tasks.length ? tasks.map(t=>`
          <label class="task-item ${t.done?'done':''}" data-id="${t.id}">
            <input type="checkbox" ${t.done?'checked':''}>
            <span class="task-text">${UI.esc(t.text)}</span>
            <span class="task-due">${UI.esc(t.due||'')}</span>
          </label>`).join('') : '<div class="empty">暂无任务</div>'}
      </div>
      <div style="margin-top:10px"><button class="btn btn-sm" id="dashAddTask">＋ 添加任务</button></div>
    </div>

    <div class="card">
      <div class="card-title">最近教案 <a href="#/teaching-notes" style="font-size:12px;font-weight:400">全部 →</a></div>
      ${notes.length ? notes.map(n=>`
        <div class="note-mini" data-id="${n.id}">
          <div class="nm-title">${UI.esc(n.title)}</div>
          <div class="nm-meta">${(n.tags||[]).map(t=>'#'+UI.esc(t)).join(' ')} · 更新于 ${UI.fmtDate(n.updatedAt)}</div>
        </div>`).join('') : '<div class="empty">还没有教案</div>'}
    </div>

    <div class="card">
      <div class="card-title">学生数据概览 <a href="#/grades" style="font-size:12px;font-weight:400">成绩详情 →</a></div>
      <div class="grid grid-2" style="gap:10px">
        <div class="stat-card" style="box-shadow:none;border:1px solid var(--line)"><div class="stat-ico">🗂️</div><div><div class="stat-num">${DB.list('courseware').length}</div><div class="stat-label">课件资料</div></div></div>
        <div class="stat-card" style="box-shadow:none;border:1px solid var(--line)"><div class="stat-ico">❓</div><div><div class="stat-num">${DB.list('questions').length}</div><div class="stat-label">题库试题</div></div></div>
        <div class="stat-card" style="box-shadow:none;border:1px solid var(--line)"><div class="stat-ico">✅</div><div><div class="stat-num">${tasks.filter(t=>t.done).length}/${tasks.length}</div><div class="stat-label">任务完成</div></div></div>
        <div class="stat-card" style="box-shadow:none;border:1px solid var(--line)"><div class="stat-ico">🔄</div><div><div class="stat-num">${DB.list('reviews').length}</div><div class="stat-label">教学复盘</div></div></div>
      </div>
      <div class="hint" style="margin-top:10px">标记学生：
        ${students.filter(s=>s.tag).map(s=>`<span class="badge ${s.tag==='需要关注'?'red':'green'}" style="margin-right:6px">${UI.esc(s.name)}·${UI.esc(s.tag)}</span>`).join('') || '暂无'}
      </div>
    </div>
  </div>`;

  // 事件
  view.querySelectorAll('#dashTasks .task-item').forEach(el=>{
    el.querySelector('input').onchange = e=>{
      DB.update('tasks', el.dataset.id, { done: e.target.checked });
      el.classList.toggle('done', e.target.checked);
      UI.toast(e.target.checked ? '任务已完成' : '已恢复为待办');
    };
    el.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'del', label:'删除任务', danger:true, run:()=>{ DB.remove('tasks', el.dataset.id); rerender(); UI.toast('已删除'); } }
    ]));
  });
  const addTask = ()=>{
    UI.openDrawer({
      title:'新增待办任务', formKey:'task',
      body:`<div class="form-row"><label>任务内容 <span class="req">*</span></label><input type="text" name="text" placeholder="例如：批改周测卷"></div>
            <div class="form-row"><label>截止日期</label><input type="date" name="due" value="${UI.today()}"></div>
            <div class="form-row"><label>来源</label><select name="from">${UI.options(['planning','手动'], 'planning')}</select></div>`,
      onSave(v){
        if(!v.text.trim()){ UI.toast('请填写任务内容'); return false; }
        DB.insert('tasks', { text:v.text.trim(), due:v.due, done:false, from:v.from });
        rerender();
      }
    });
  };
  const nl = document.getElementById('dashNewLesson');
  if(nl) nl.onclick = ()=>{ location.hash = '#/lesson-plans'; setTimeout(()=>window.openLessonPlanDrawer && window.openLessonPlanDrawer(), 80); };
  const nt = document.getElementById('dashNewTask'); if(nt) nt.onclick = addTask;
  const at = document.getElementById('dashAddTask'); if(at) at.onclick = addTask;
  view.querySelectorAll('.note-mini').forEach(el=>{
    el.onclick = ()=>{ location.hash = '#/teaching-notes'; setTimeout(()=>window.openNoteDrawer && window.openNoteDrawer(el.dataset.id), 80); };
  });
  view.querySelectorAll('.today-course').forEach(el=>{
    el.onclick = ()=>{ location.hash = '#/lesson-plans'; };
  });
}