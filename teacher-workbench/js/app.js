/* ===== 路由 / 全局初始化 ===== */
const ROUTES = {
  'dashboard':        { title:'首页仪表盘', crumb:[{label:'首页'}],           render: renderDashboard },
  'lesson-plans':     { title:'课程备课',   crumb:[{label:'首页',href:'#/dashboard'},{label:'课程备课'}], render: renderLessonPlans },
  'teaching-notes':   { title:'教案管理',   crumb:[{label:'首页',href:'#/dashboard'},{label:'教案管理'}], render: renderNotes },
  'courseware':       { title:'课件中心',   crumb:[{label:'首页',href:'#/dashboard'},{label:'课件中心'}], render: renderCourseware },
  'question-bank':    { title:'题库管理',   crumb:[{label:'首页',href:'#/dashboard'},{label:'题库管理'}], render: renderQuestions },
  'grades':           { title:'学生成绩',   crumb:[{label:'首页',href:'#/dashboard'},{label:'学生成绩'}], render: renderGrades },
  'review':           { title:'教学复盘',   crumb:[{label:'首页',href:'#/dashboard'},{label:'教学复盘'}], render: renderReview },
  'planning':         { title:'教学计划',   crumb:[{label:'首页',href:'#/dashboard'},{label:'教学计划'}], render: renderPlanning },
  'settings':         { title:'数据与备份', crumb:[{label:'首页',href:'#/dashboard'},{label:'数据与备份'}], render: renderSettings }
};

let CURRENT_ROUTE = 'dashboard';

function currentRoute(){
  const h = location.hash.replace(/^#\//,'').split('?')[0];
  return ROUTES[h] ? h : 'dashboard';
}

function navigate(){
  const r = currentRoute();
  CURRENT_ROUTE = r;
  const def = ROUTES[r];
  // 侧栏高亮
  document.querySelectorAll('.sidebar-nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.route === r);
  });
  // 顶栏高亮(按前缀匹配)
  document.querySelectorAll('.top-link').forEach(a=>{
    a.classList.toggle('active', a.dataset.top === r);
  });
  // 面包屑
  UI.breadcrumb(def.crumb.concat([{label:def.title}]).slice(0,-1).concat([{label:def.title}]));
  // 渲染
  const view = document.getElementById('view');
  view.innerHTML = '<div class="empty">加载中…</div>';
  try{ def.render(view); }
  catch(e){ console.error(e); view.innerHTML = '<div class="empty">模块加载失败: '+UI.esc(e.message)+'</div>'; }
}

function rerender(){ navigate(); }

function initApp(){
  DB.seed();
  UI.bindDrawer();

  // 侧栏收起
  const sb = document.getElementById('sidebar');
  const setCollapsed = c => {
    sb.classList.toggle('collapsed', c);
    localStorage.setItem('twb_collapsed', c ? '1' : '0');
    const btn = document.getElementById('sidebarToggle');
    if(btn) btn.textContent = c ? '⟩' : '⟨';
  };
  setCollapsed(localStorage.getItem('twb_collapsed') === '1');
  document.getElementById('sidebarToggle').onclick = () => setCollapsed(!sb.classList.contains('collapsed'));
  document.getElementById('topSidebarToggle').onclick = () => setCollapsed(!sb.classList.contains('collapsed'));

  // 全局搜索
  const gs = document.getElementById('globalSearch');
  gs.addEventListener('input', UI.debounce(()=>UI.globalSearch(gs.value), 200));
  gs.addEventListener('focus', ()=>{ if(gs.value) UI.globalSearch(gs.value); });
  document.addEventListener('click', e=>{
    if(!e.target.closest('.top-search')) document.getElementById('searchResults').hidden = true;
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){ UI.hideCtx(); document.getElementById('searchResults').hidden = true; }
    if((e.ctrlKey||e.metaKey) && e.key === 'k'){ e.preventDefault(); gs.focus(); }
  });

  // 快速新增
  document.getElementById('btnQuickAdd').onclick = () => {
    UI.ctxMenu({ preventDefault(){}, stopPropagation(){}, clientX: window.innerWidth-260, clientY:70 }, [
      { act:'lp', label:'＋ 新增课程备课', run:()=>{ location.hash='#/lesson-plans'; setTimeout(()=>window.openLessonPlanDrawer && window.openLessonPlanDrawer(),60); } },
      { act:'n',  label:'＋ 新增教案',     run:()=>{ location.hash='#/teaching-notes'; setTimeout(()=>window.openNoteDrawer && window.openNoteDrawer(),60); } },
      { act:'q',  label:'＋ 新增试题',     run:()=>{ location.hash='#/question-bank'; setTimeout(()=>window.openQuestionDrawer && window.openQuestionDrawer(),60); } },
      { act:'t',  label:'＋ 新增任务',     run:()=>{ location.hash='#/planning'; setTimeout(()=>window.openPlanDrawer && window.openPlanDrawer(),60); } }
    ]);
  };

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', initApp);