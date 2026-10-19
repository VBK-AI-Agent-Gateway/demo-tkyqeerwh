/* 数据层：localStorage CRUD + 导出导入 + 自动草稿 */
(function(){
"use strict";
const KEY = "twb_v1";
const DRAFT_KEY = "twb_draft_v1";

const SEED = {
  settings:{sidebarCollapsed:false, nextId:1000},
  lessons:[
    {id:1,title:"函数的单调性",subject:"数学",grade:"高一(3)班",date:"2025-01-15",period:"第1节",classroom:"A301",objectives:"理解函数单调性定义；会用定义证明单调性",schedule:"导入10min → 概念讲解20min → 例题15min → 练习10min → 小结5min",status:"active",notes:""},
    {id:2,title:"Unit 3 阅读课",subject:"英语",grade:"高一(3)班",date:"2025-01-16",period:"第3节",classroom:"B205",objectives:"掌握课文重点词汇；提高略读能力",schedule:"热身5min → 快速阅读 → 精读 → 讨论",status:"active",notes:"准备多媒体课件"},
    {id:3,title:"牛顿第二定律复习",subject:"物理",grade:"高二(1)班",date:"2025-01-10",period:"第2节",classroom:"实验楼201",objectives:"复习F=ma应用",schedule:"习题讲解",status:"archived",notes:"已归档"}
  ],
  plans:[
    {id:11,title:"《函数的单调性》教案",folder:"数学",tags:["高一","概念课","重点"],content:"<h2>教学目标</h2><p>1. 理解单调性的定义</p><p>2. 会用定义法证明</p><h2>教学过程</h2><ul><li>情境导入</li><li>概念建构</li><li>例题精讲</li></ul>",linkedCourseware:["课件-单调性.pptx"],linkedQuestions:["Q-001 一次函数单调区间"],updatedAt:"2025-01-14 09:20"},
    {id:12,title:"Unit 3 Reading 教案",folder:"英语",tags:["阅读课","公开课"],content:"<p>Step 1: Lead-in</p><p>Step 2: Skimming</p><p>Step 3: Careful reading</p>",linkedCourseware:["Unit3-reading.pdf"],linkedQuestions:[],updatedAt:"2025-01-13 16:02"}
  ],
  folders:[
    {id:21,name:"数学",type:"courseware"},
    {id:22,name:"英语",type:"courseware"},
    {id:23,name:"物理",type:"courseware"},
    {id:31,name:"数学",type:"plans"},
    {id:32,name:"英语",type:"plans"}
  ],
  files:[
    {id:41,name:"课件-单调性.pptx",type:"PPT",folder:"数学",size:"3.4 MB",date:"2025-01-12",url:"",note:"第1课时课件"},
    {id:42,name:"Unit3-reading.pdf",type:"PDF",folder:"英语",size:"1.2 MB",date:"2025-01-11",url:"",note:""},
    {id:43,name:"牛顿定律练习卷.docx",type:"DOC",folder:"物理",size:"640 KB",date:"2025-01-08",url:"",note:"配套练习"}
  ],
  questions:[
    {id:51,qid:"Q-001",type:"选择",point:"函数单调性",difficulty:"中等",score:4,content:"函数 f(x)=x²-2x 的单调递减区间是？",options:["A. (-∞,1]","B. [1,+∞)","C. (-∞,0]","D. [0,+∞)"],answer:"A",analysis:"对称轴 x=1，开口向上，故递减区间 (-∞,1]",feedback:"2 人对区间开闭仍有疑问"},
    {id:52,qid:"Q-002",type:"填空",point:"函数单调性",difficulty:"简单",score:3,content:"若函数在 R 上单调递增，且 f(1)<f(2)，则 a 的取值范围是____",options:[],answer:"略",analysis:"",feedback:""},
    {id:53,qid:"Q-003",type:"解答",point:"牛顿第二定律",difficulty:"较难",score:10,content:"质量 2kg 的物体受水平拉力 6N，摩擦力 2N，求加速度。",options:[],answer:"2 m/s²",analysis:"F合=6-2=4N，a=F/m=2",feedback:"计算过程需规范书写"}
  ],
  students:[
    {id:61,name:"张三",sno:"202501",klass:"高一(3)班",tag:"",note:""},
    {id:62,name:"李四",sno:"202502",klass:"高一(3)班",tag:"进步明显",note:""},
    {id:63,name:"王五",sno:"202503",klass:"高一(3)班",tag:"需关注",note:"近期作业上交不及时"},
    {id:64,name:"赵六",sno:"202504",klass:"高一(3)班",tag:"",note:""}
  ],
  scores:[
    {id:71,student:"张三",exam:"月考一",date:"2024-10-20",score:88},
    {id:72,student:"张三",exam:"期中",date:"2024-11-25",score:92},
    {id:73,student:"张三",exam:"月考二",date:"2024-12-22",score:85},
    {id:74,student:"李四",exam:"月考一",date:"2024-10-20",score:76},
    {id:75,student:"李四",exam:"期中",date:"2024-11-25",score:81},
    {id:76,student:"李四",exam:"月考二",date:"2024-12-22",score:89},
    {id:77,student:"王五",exam:"月考一",date:"2024-10-20",score:65},
    {id:78,student:"王五",exam:"期中",date:"2024-11-25",score:71},
    {id:79,student:"王五",exam:"月考二",date:"2024-12-22",score:68},
    {id:80,student:"赵六",exam:"月考一",date:"2024-10-20",score:95},
    {id:81,student:"赵六",exam:"期中",date:"2024-11-25",score:93},
    {id:82,student:"赵六",exam:"月考二",date:"2024-12-22",score:96}
  ],
  reflections:[
    {id:91,lesson:"函数的单调性",course:"数学",date:"2025-01-15",highlight:"学生参与度高，图像导入有效",problem:"证明书写步骤部分学生跳步",improve:"下节课增加规范板演",todo:"整理规范解题模板"},
    {id:92,lesson:"Unit 3 阅读课",course:"英语",date:"2025-01-13",highlight:"小组讨论热烈",problem:"时间超时 5 分钟",improve:"压缩展示环节",todo:""}
  ],
  tasks:[
    {id:95,text:"批改月考二试卷",due:"2025-01-16",priority:"高",done:false,source:"手工"},
    {id:96,text:"完成《函数的单调性》课件",due:"2025-01-15",priority:"高",done:false,source:"课程备课"},
    {id:97,text:"出一份单元练习卷",due:"2025-01-17",priority:"中",done:false,source:"题库管理"},
    {id:98,text:"录入高一(3)班月考成绩",due:"2025-01-18",priority:"高",done:false,source:"学生成绩"},
    {id:99,text:"撰写期末复习计划",due:"2025-01-20",priority:"中",done:false,source:"教学计划"},
    {id:100,text:"上周复盘整理",due:"2025-01-12",priority:"低",done:true,source:"教学复盘"}
  ],
  calendar:[
    {id:101,date:"2025-01-15",title:"函数的单调性(课)",type:"course",done:false},
    {id:102,date:"2025-01-15",title:"批改试卷",type:"task",done:false},
    {id:103,date:"2025-01-16",title:"Unit 3 阅读课",type:"course",done:false},
    {id:104,date:"2025-01-17",title:"出单元练习卷",type:"task",done:false},
    {id:105,date:"2025-01-20",title:"期末复习计划",type:"month",done:false},
    {id:106,date:"2025-01-10",title:"教研组听课",type:"week",done:true}
  ]
};

let db = null;

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function load(){
  if(db) return db;
  try{
    const raw = localStorage.getItem(KEY);
    db = raw ? JSON.parse(raw) : clone(SEED);
  }catch(e){ db = clone(SEED); }
  if(!db.settings) db.settings = {sidebarCollapsed:false,nextId:1000};
  return db;
}

function save(){
  db = db || load();
  try{ localStorage.setItem(KEY, JSON.stringify(db)); }
  catch(e){ UI.toast("保存失败：本地存储空间不足"); }
}

function uid(){
  db = db || load();
  db.settings.nextId = (db.settings.nextId||1000) + 1;
  return db.settings.nextId;
}

/* 通用 CRUD：coll 为集合名 */
const Store = {
  all(coll){ const d=load(); return d[coll] ? d[coll] : []; },
  get(coll,id){ return this.all(coll).find(x=>x.id===+id) || null; },
  insert(coll,obj){
    const d=load(); if(!d[coll]) d[coll]=[];
    obj.id = uid();
    d[coll].push(obj); save(); return obj;
  },
  update(coll,id,patch){
    const d=load(); const item=(d[coll]||[]).find(x=>x.id===+id);
    if(item){ Object.assign(item,patch); save(); return item; }
    return null;
  },
  remove(coll,id){
    const d=load();
    if(d[coll]){ d[coll] = d[coll].filter(x=>x.id!==+id); save(); return true; }
    return false;
  },
  query(coll,pred){ return this.all(coll).filter(pred||(()=>true)); }
};

/* 导出 / 导入 */
function exportBackup(){
  const data = JSON.stringify(load(), null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "教学工作台备份_" + new Date().toISOString().slice(0,10) + ".json";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  UI.toast("已导出全部数据备份");
}
function importBackup(text){
  try{
    const obj = JSON.parse(text);
    if(!obj || typeof obj!=="object") throw new Error("格式错误");
    localStorage.setItem(KEY, JSON.stringify(obj));
    db = obj;
    UI.toast("导入成功，正在刷新…");
    setTimeout(()=>location.reload(), 600);
  }catch(e){ UI.toast("导入失败：文件格式不正确"); }
}

/* 自动草稿：表单输入自动存草稿 */
let draftTimer = null;
function draftSave(formEl, tag){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>{
    try{
      const data = {};
      formEl.querySelectorAll("[name]").forEach(el=>{
        if(el.type==="checkbox"){
          if(!data[el.name]) data[el.name]=[];
          if(el.checked) data[el.name].push(el.value);
        } else data[el.name] = el.value;
      });
      localStorage.setItem(DRAFT_KEY+"_"+tag, JSON.stringify({tag, data, ts:Date.now()}));
      const el = document.getElementById("draftStatus");
      if(el){ el.textContent = "草稿已自动保存 " + new Date().toLocaleTimeString(); }
    }catch(e){}
  }, 500);
}
function draftGet(tag){
  try{
    const raw = localStorage.getItem(DRAFT_KEY+"_"+tag);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function draftClear(tag){ try{ localStorage.removeItem(DRAFT_KEY+"_"+tag); }catch(e){} }

window.DB = {SEED, load, save, uid, Store, exportBackup, importBackup, draftSave, draftGet, draftClear, reset(){ localStorage.removeItem(KEY); location.reload(); }};
})();