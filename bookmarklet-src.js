(async()=>{
const ID='hra-panel';
document.getElementById(ID)?.remove();
const API='https://hr.xiaohongshu.com/oasis/api/recruit/recruit/applicantController/applicantIdxQuery';
const post=(p)=>fetch(API,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({interviewSearchStatus:'',positionPageQueryForApplicantParam:{searchScopeList:['in_charge','create','self_create_and_share'],recruitType:'club_recruit'},pageNum:p,pageSize:100})}).then(r=>r.json());

const panel=Object.assign(document.createElement('div'),{id:ID});
Object.assign(panel.style,{position:'fixed',top:'0',right:'0',width:'400px',height:'100vh',background:'#f7f8fc',boxShadow:'-4px 0 20px rgba(0,0,0,0.15)',zIndex:'999999',fontFamily:'-apple-system,PingFang SC,sans-serif',fontSize:'13px',overflowY:'auto'});
document.body.appendChild(panel);
panel.innerHTML='<div style="background:linear-gradient(135deg,#ff2d55,#ff6b6b);padding:14px 16px;color:white;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:15px;font-weight:700">🎯 人才画像分析</div></div><button onclick="document.getElementById(\'hra-panel\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:26px;height:26px;cursor:pointer">✕</button></div><div id="hra-body" style="padding:16px;text-align:center;color:#888"><div style="width:28px;height:28px;border:3px solid #f0f0f0;border-top-color:#ff2d55;border-radius:50%;animation:hra-spin .7s linear infinite;margin:0 auto 10px"></div>正在拉取数据...</div><style>@keyframes hra-spin{to{transform:rotate(360deg)}}</style>';

const first=await post(1);
const root=first?.data||first?.result||first;
const list0=root?.list||root?.records||[];
const total=root?.total||list0.length;
let all=[...list0];
const pages=Math.ceil(total/100);
for(let p=2;p<=pages;p++){const d=await post(p);const r=d?.data||d?.result||d;all=[...all,...(r?.list||r?.records||[])];}

window.__hra=all;
const g=(...ks)=>o=>{for(const k of ks)if(o[k]!=null&&o[k]!=='')return o[k];return null};
const getName=g('name','candidateName','realName','applicantName');
const getAge=g('age','candidateAge');
const getWY=g('workYears','workYear','totalWorkYear','experienceYear','experienceYears');
const getEdu=g('education','highestEducation','educationLevel','degree');
const getSchool=g('school','graduateSchool','university','schoolName','latestSchool','highestSchool');
const getMajor=g('major','speciality','majorName','latestMajor');
const getCo=g('currentCompany','latestCompany','lastCompany','companyName','latestWorkCompany');

const cs=all.map(r=>({name:getName(r)||String(r.id||''),age:Number(getAge(r))||null,wy:Number(getWY(r))||null,edu:normEdu(getEdu(r)),school:getSchool(r),major:getMajor(r),co:getCo(r)})).filter(c=>c.name);

function normEdu(v){if(!v)return null;const s=String(v);if(/博士|phd/i.test(s))return'博士';if(/硕士|master|研究生/i.test(s))return'硕士';if(/本科|bachelor/i.test(s))return'本科';if(/大专|专科/i.test(s))return'大专';return s;}
function cnt(arr,fn){const m={};arr.forEach(x=>{const k=fn(x);if(k)m[k]=(m[k]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
function pct(n,t){return t?Math.round(n/t*100):0;}
function avg(arr){return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10:'-';}
function bars(data,total,colors=['#ff2d55','#ff6b6b','#ffa502','#1e90ff','#2ed573','#a29bfe','#fd79a8','#74b9ff']){
  return data.map(([k,n],i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><div style="width:80px;font-size:11px;color:#555;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${k}">${k}</div><div style="flex:1;background:#f0f1f5;border-radius:3px;height:13px"><div style="width:${pct(n,total)}%;height:100%;background:${colors[i%8]};border-radius:3px"></div></div><div style="width:28px;font-size:10px;color:#888;text-align:right">${pct(n,total)}%</div><div style="width:18px;font-size:10px;color:#ccc;text-align:right">${n}</div></div>`).join('');}

const S985=['北京大学','清华大学','中国人民大学','复旦大学','上海交通大学','浙江大学','南京大学','武汉大学','中山大学','华中科技大学','西安交通大学','哈尔滨工业大学','北京师范大学','南开大学','厦门大学','同济大学','吉林大学','东南大学','天津大学','四川大学','山东大学','兰州大学','重庆大学','电子科技大学','中南大学','中国政法大学'];
const SLAW=['华东政法大学','西南政法大学','中南财经政法大学','西北政法大学'];
const is985=s=>S985.some(x=>s.includes(x));
const is211=s=>is985(s)||SLAW.some(x=>s.includes(x));
const tag=s=>is985(s)?'<span style="font-size:9px;background:#fff0f3;color:#ff2d55;padding:0 3px;border-radius:2px">985</span>':is211(s)?'<span style="font-size:9px;background:#fff8e6;color:#f7b731;padding:0 3px;border-radius:2px">211</span>':'';

const eduDist=cnt(cs,c=>c.edu||'未知');
const schoolDist=cnt(cs,c=>c.school);
const withSchool=cs.filter(c=>c.school);
const n985=withSchool.filter(c=>is985(c.school)).length;
const n211=withSchool.filter(c=>is211(c.school)).length;
const ages=cs.map(c=>c.age).filter(Boolean);
const wys=cs.map(c=>c.wy).filter(v=>v>=0&&v!==null);
const majDist=cnt(cs,c=>{const m=c.major;if(!m)return null;if(/法/i.test(m))return'法学';if(/金融|经济|会计|财/i.test(m))return'金融/经济';if(/计算机|软件|信息/i.test(m))return'计算机';if(/管理|mba|商/i.test(m))return'管理/商科';if(/英语|外语/i.test(m))return'外语';if(/新闻|传播/i.test(m))return'新闻传播';return m.slice(0,5);});
const coDist=cnt(cs,c=>c.co);

function sec(title,body){return`<div style="background:white;border-radius:10px;margin-bottom:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)"><div style="padding:8px 12px 6px;font-size:10px;font-weight:700;color:#aaa;letter-spacing:.5px;border-bottom:1px solid #f5f5f5">${title}</div><div style="padding:8px 12px 10px">${body}</div></div>`;}

const html=`
${sec('📊 总览',`<div style="display:flex;gap:6px"><div style="flex:1;background:#f7f8fc;border-radius:7px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#ff2d55">${cs.length}</div><div style="font-size:10px;color:#999;margin-top:2px">候选人</div></div><div style="flex:1;background:#f7f8fc;border-radius:7px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#ff2d55">${avg(ages)}岁</div><div style="font-size:10px;color:#999;margin-top:2px">平均年龄</div></div><div style="flex:1;background:#f7f8fc;border-radius:7px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#ff2d55">${avg(wys)}年</div><div style="font-size:10px;color:#999;margin-top:2px">平均工龄</div></div></div>`)}
${sec('📚 学历',bars(eduDist,cs.length))}
${sec('🏫 院校',`<div style="display:flex;gap:6px;margin-bottom:8px"><div style="flex:1;background:#f7f8fc;border-radius:7px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:800;color:#ff2d55">${pct(n985,withSchool.length||1)}%</div><div style="font-size:10px;color:#999">985</div></div><div style="flex:1;background:#f7f8fc;border-radius:7px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:800;color:#ffa502">${pct(n211,withSchool.length||1)}%</div><div style="font-size:10px;color:#999">211</div></div></div>${schoolDist.slice(0,8).map(([k,n],i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><div style="width:90px;font-size:11px;color:#555;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${k.slice(0,7)}${tag(k)}</div><div style="flex:1;background:#f0f1f5;border-radius:3px;height:13px"><div style="width:${pct(n,cs.length)}%;height:100%;background:${'#ff2d55,#ff6b6b,#ffa502,#1e90ff,#2ed573,#a29bfe,#fd79a8,#74b9ff'.split(',')[i%8]};border-radius:3px"></div></div><div style="width:28px;font-size:10px;color:#888;text-align:right">${pct(n,cs.length)}%</div><div style="width:18px;font-size:10px;color:#ccc;text-align:right">${n}</div></div>`).join('')}`)}
${sec('🎓 专业',bars(majDist.slice(0,6),cs.filter(c=>c.major).length||1))}
${sec('🏢 当前公司 Top8',bars(coDist.slice(0,8),cs.filter(c=>c.co).length||1))}
<div style="display:flex;gap:6px;margin-bottom:12px">
<button onclick="(()=>{const lines=['【人才画像】共${cs.length}人','学历：${eduDist.slice(0,3).map(([k,n])=>k+n+'人').join('/')}','985：${pct(n985,withSchool.length||1)}%  211：${pct(n211,withSchool.length||1)}%','均龄：${avg(ages)}岁  均工龄：${avg(wys)}年'];navigator.clipboard.writeText(lines.join('\\n')).then(()=>{this.textContent='✅已复制';setTimeout(()=>this.textContent='📋复制摘要',2000)});})()" style="flex:1;padding:7px;background:#f0f1f5;border:none;border-radius:7px;font-size:12px;cursor:pointer">📋 复制摘要</button>
<button onclick="(()=>{const h=['姓名','年龄','工龄','学历','院校','专业','公司'];const rows=window.__hra.map(r=>{const g=(...ks)=>{for(const k of ks)if(r[k]!=null&&r[k]!=='')return r[k];return''};return[g('name','candidateName','realName'),g('age','candidateAge'),g('workYears','workYear','totalWorkYear'),g('education','highestEducation'),g('school','graduateSchool','schoolName'),g('major','speciality'),g('currentCompany','latestCompany','companyName')];});const csv=[h,...rows].map(r=>r.map(v=>'\"'+String(v).replace(/\"/g,'\"\"')+'\"').join(',')).join('\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\uFEFF'+csv],{type:'text/csv'}));a.download='人才画像_${new Date().toISOString().slice(0,10)}.csv';a.click();})()" style="flex:1;padding:7px;background:#f0f1f5;border:none;border-radius:7px;font-size:12px;cursor:pointer">⬇️ 下载CSV</button>
</div>`;

document.getElementById('hra-body').innerHTML=html;
})()
