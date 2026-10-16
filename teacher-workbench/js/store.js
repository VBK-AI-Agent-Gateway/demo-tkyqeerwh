/* ===== 数据层: localStorage CRUD / 导出导入 / 自动草稿 ===== */
const DB = (() => {
  const NS = 'twb_';            // namespace
  const KEYS = ['lessonplans','notes','courseware','questions','students','scores','reviews','plans','tasks','folders','tags'];
  const SCHEMA_VER = 1;

  function keyOf(c){ return NS + c; }

  function readAll(collection){
    try{
      const raw = localStorage.getItem(keyOf(collection));
      return raw ? JSON.parse(raw) : [];
    }catch(e){ console.error('readAll', collection, e); return []; }
  }

  function writeAll(collection, arr){
    localStorage.setItem(keyOf(collection), JSON.stringify(arr));
    localStorage.setItem(NS + 'updated_' + collection, new Date().toISOString());
    return arr;
  }

  // ---- CRUD ----
  function list(collection, pred){
    const arr = readAll(collection);
    return pred ? arr.filter(pred) : arr.slice();
  }
  function get(collection, id){
    return readAll(collection).find(x => x.id === id) || null;
  }
  function insert(collection, obj){
    const arr = readAll(collection);
    const rec = Object.assign({
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, obj);
    arr.unshift(rec);
    writeAll(collection, arr);
    return rec;
  }
  function update(collection, id, patch){
    const arr = readAll(collection);
    const i = arr.findIndex(x => x.id === id);
    if(i < 0) return null;
    arr[i] = Object.assign({}, arr[i], patch, { updatedAt: new Date().toISOString() });
    writeAll(collection, arr);
    return arr[i];
  }
  function remove(collection, id){
    const arr = readAll(collection);
    writeAll(collection, arr.filter(x => x.id !== id));
    return true;
  }
  function clear(collection){
    writeAll(collection, []);
  }

  // ---- 复制(课程备课等) ----
  function duplicate(collection, id, patch){
    const src = get(collection, id);
    if(!src) return null;
    const { id:_, createdAt:__, updatedAt:___, ...rest } = src;
    return insert(collection, Object.assign({}, rest, patch || {}, {
      title: (src.title || src.name || '副本') + ' (副本)'
    }));
  }

  // ---- 备份: 导出 / 导入 ----
  function exportAll(){
    const data = { app:'teacher-workbench', schema: SCHEMA_VER, exportedAt: new Date().toISOString(), collections:{} };
    KEYS.forEach(k => data.collections[k] = readAll(k));
    data.meta = { collapsed: localStorage.getItem(NS+'collapsed') === '1' };
    return data;
  }
  function downloadBackup(){
    const json = JSON.stringify(exportAll(), null, 2);
    const blob = new Blob([json], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'teacher-workbench-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return true;
  }
  function importBackup(jsonText){
    const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    if(!data || !data.collections) throw new Error('备份格式不正确');
    KEYS.forEach(k => {
      if(Array.isArray(data.collections[k])) writeAll(k, data.collections[k]);
    });
    if(data.meta && data.meta.collapsed != null)
      localStorage.setItem(NS+'collapsed', data.meta.collapsed ? '1' : '0');
    return true;
  }
  function stats(){
    const s = {};
    KEYS.forEach(k => s[k] = readAll(k).length);
    let bytes = 0;
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(NS)) bytes += (localStorage.getItem(k)||'').length;
    }
    s._bytes = bytes;
    s._updatedAt = localStorage.getItem(NS+'updatedAt') ||
      KEYS.map(k=>localStorage.getItem(NS+'updated_'+k)).filter(Boolean).sort().pop() || '';
    return s;
  }

  // ---- 自动草稿 (drawer 表单) ----
  function draftKey(form){ return NS + 'draft_' + form; }
  function saveDraft(form, values){
    try{
      localStorage.setItem(draftKey(form), JSON.stringify({ v: values, t: Date.now() }));
      return true;
    }catch(e){ return false; }
  }
  function loadDraft(form){
    try{
      const raw = localStorage.getItem(draftKey(form));
      if(!raw) return null;
      const d = JSON.parse(raw);
      if(Date.now() - d.t > 7*24*3600*1000){ localStorage.removeItem(draftKey(form)); return null; }
      return d.v || null;
    }catch(e){ return null; }
  }
  function clearDraft(form){ localStorage.removeItem(draftKey(form)); }

  // ---- 种子数据(首次使用) ----
  function seed(){
    if(localStorage.getItem(NS+'seeded') === '1') return;
    const today = new Date();
    const iso = d => d.toISOString().slice(0,10);
    const plus = n => { const d = new Date(today); d.setDate(d.getDate()+n); return iso(d); };

    writeAll('folders', [
      { id:'f1', name:'默认文件夹', kind:'notes' },
      { id:'f2', name:'数学组共享', kind:'notes' },
      { id:'f3', name:'课件-必修一', kind:'courseware' },
      { id:'f4', name:'课件-习题精选', kind:'courseware' }
    ]);
    writeAll('lessonplans', [
      { id:'lp1', title:'二次函数图像与性质', subject:'数学', date: iso(today), time:'08:00-08:45',
        room:'三年2班', goal:'掌握二次函数开口方向、顶点与对称轴', arrangement:'导入5min → 新知探究25min → 例题10min → 小结5min',
        status:'进行中', archived:false },
      { id:'lp2', title:'英语阅读理解技巧', subject:'英语', date: plus(1), time:'10:00-10:45',
        room:'三年3班', goal:'掌握略读与扫读策略', arrangement:'热身 → 策略讲解 → 真题演练 → 总结', status:'待上', archived:false },
      { id:'lp3', title:'光的折射复习课', subject:'物理', date: plus(3), time:'14:00-14:45',
        room:'实验室', goal:'梳理折射定律要点', arrangement:'知识梳理 + 实验回放 + 当堂练', status:'待上', archived:false }
    ]);
    writeAll('notes', [
      { id:'n1', title:'二次函数专题教案', folderId:'f1', tags:['函数','重点'],
        html:'<p>教学目标：理解二次函数三种表达式。</p><ul><li>图像绘制</li><li>顶点公式</li></ul>', linked:['课件-抛物线.pptx'], updatedAt:new Date().toISOString() },
      { id:'n2', title:'英语阅读课教案', folderId:'f2', tags:['阅读'],
        html:'<p>以真实语篇训练略读技巧。</p>', linked:[], updatedAt:new Date().toISOString() }
    ]);
    writeAll('courseware', [
      { id:'c1', name:'抛物线图像探究.pptx', type:'PPT', size:'4.2 MB', folderId:'f3', url:'', uploadedAt:new Date().toISOString(), note:'含动画演示' },
      { id:'c2', name:'函数练习卷.pdf', type:'PDF', size:'860 KB', folderId:'f4', url:'', uploadedAt:new Date().toISOString(), note:'' }
    ]);
    writeAll('questions', [
      { id:'q1', text:'二次函数 y=x²-2x+3 的顶点坐标是？', type:'选择题', kp:'二次函数', diff:'中等',
        options:'A. (1,2)\nB. (2,3)\nC. (-1,4)\nD. (1,3)', answer:'A', feedback:[] },
      { id:'q2', text:'若 a>b，则 2a>2b。（判断对错）', type:'判断题', kp:'不等式性质', diff:'简单',
        options:'', answer:'对', feedback:[] },
      { id:'q3', text:'简述二次函数图像平移规律。', type:'简答题', kp:'二次函数', diff:'较难',
        options:'', answer:'左加右减，上加下减', feedback:[] }
    ]);
    writeAll('students', [
      { id:'s1', name:'林晓明', klass:'三年2班', tag:'', note:'' },
      { id:'s2', name:'陈雨欣', klass:'三年2班', tag:'进步显著', note:'' },
      { id:'s3', name:'王浩然', klass:'三年2班', tag:'需要关注', note:'近期作业缺交2次' },
      { id:'s4', name:'赵子涵', klass:'三年3班', tag:'', note:'' }
    ]);
    writeAll('scores', [
      { id:'sc1', studentId:'s1', subject:'数学', exam:'月考一', score:92, date: plus(-30) },
      { id:'sc2', studentId:'s1', subject:'数学', exam:'期中', score:88, date: plus(-10) },
      { id:'sc3', studentId:'s2', subject:'数学', exam:'月考一', score:75, date: plus(-30) },
      { id:'sc4', studentId:'s2', subject:'数学', exam:'期中', score:86, date: plus(-10) },
      { id:'sc5', studentId:'s3', subject:'数学', exam:'月考一', score:68, date: plus(-30) },
      { id:'sc6', studentId:'s3', subject:'数学', exam:'期中', score:64, date: plus(-10) },
      { id:'sc7', studentId:'s4', subject:'数学', exam:'月考一', score:80, date: plus(-30) },
      { id:'sc8', studentId:'s4', subject:'数学', exam:'期中', score:91, date: plus(-10) }
    ]);
    writeAll('reviews', [
      { id:'rv1', courseId:'lp1', date: iso(today), highlights:'学生对图像平移参与度高',
        problems:'小组讨论超时5分钟', improvements:'控制讨论计时器，准备弹性例题' },
      { id:'rv2', courseId:'lp2', date: plus(-3), highlights:'略读策略示范清晰',
        problems:'后排学生练习量不足', improvements:'增加同伴互检环节' }
    ]);
    writeAll('plans', [
      { id:'p1', kind:'周计划', title:'完成二次函数单元教学', start: iso(today), end: plus(6), done:false, date: iso(today) },
      { id:'p2', kind:'月计划', title:'期中复习卷组编', start: iso(today), end: plus(20), done:false, date: plus(2) },
      { id:'p3', kind:'日历', title:'批改周测并录入成绩', date: plus(1), done:false }
    ]);
    writeAll('tasks', [
      { id:'t1', text:'批改三年2班周测卷', due: iso(today), done:false, from:'planning' },
      { id:'t2', text:'准备《二次函数》课件', due: iso(today), done:false, from:'planning' },
      { id:'t3', text:'上传英语阅读材料到课件中心', due: plus(1), done:true, from:'planning' }
    ]);
    localStorage.setItem(NS+'seeded', '1');
  }

  function resetAll(){
    const rm = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(NS)) rm.push(k);
    }
    rm.forEach(k=>localStorage.removeItem(k));
    seed();
  }

  return { KEYS, list, get, insert, update, remove, clear, duplicate,
           exportAll, downloadBackup, importBackup, stats,
           saveDraft, loadDraft, clearDraft, seed, resetAll };
})();

if(typeof module !== 'undefined') module.exports = DB;