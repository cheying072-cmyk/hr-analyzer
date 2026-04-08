// ═══════════════════════════════════════════════════════════════
//  HR 人才画像分析 - Console 一键脚本
//  使用方法：在 hr.xiaohongshu.com 任意页面打开 Console，粘贴全部内容回车
// ═══════════════════════════════════════════════════════════════

(async function HRAnalyzer() {

  // ─── 0. 防重复运行 ─────────────────────────────────────────────
  if (document.getElementById('hr-analyzer-panel')) {
    document.getElementById('hr-analyzer-panel').remove()
  }

  // ─── 1. 从当前页面 URL / body 读取筛选参数 ─────────────────────
  // 直接用空参数查询（会返回当前登录用户负责的所有候选人）
  // 如果需要按部门/状态过滤，可以在下面的 buildBody() 里调整

  const API = 'https://hr.xiaohongshu.com/oasis/api/recruit/recruit/applicantController/applicantIdxQuery'

  function buildBody(pageNum, pageSize = 100) {
    return JSON.stringify({
      interviewSearchStatus: "",
      positionPageQueryForApplicantParam: {
        searchScopeList: ["in_charge", "create", "self_create_and_share"],
        recruitType: "club_recruit"
      },
      pageNum,
      pageSize
    })
  }

  async function fetchPage(pageNum) {
    const res = await fetch(API, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
      },
      body: buildBody(pageNum)
    })
    return res.json()
  }

  // ─── 2. 显示加载中面板 ─────────────────────────────────────────
  showPanel('<div style="text-align:center;padding:40px 20px"><div class="hr-spin"></div><p style="color:#888;margin-top:12px">正在拉取候选人数据...</p></div>')

  // ─── 3. 拉取第一页，获取总数 ──────────────────────────────────
  let allCandidates = []
  let firstData

  try {
    firstData = await fetchPage(1)
    console.log('[HR Analyzer] 接口响应:', firstData)
  } catch(e) {
    showPanel(`<p style="color:red;padding:20px">接口请求失败：${e.message}</p>`)
    return
  }

  // 自动探测数据路径
  const root = firstData?.data || firstData?.result || firstData
  const list = root?.list || root?.records || root?.items || []
  const total = root?.total || root?.totalCount || root?.count || list.length

  if (!list.length) {
    console.warn('[HR Analyzer] 原始响应:', firstData)
    showPanel(`<p style="color:#f7b731;padding:20px">⚠️ 未获取到候选人数据，请检查当前筛选条件。<br><small>原始响应已打印到 Console。</small></p>`)
    return
  }

  allCandidates = [...list]
  const totalPages = Math.ceil(total / 100)
  updatePanelStatus(`第 1/${totalPages} 页，已获取 ${allCandidates.length}/${total} 人...`)

  // ─── 4. 翻页拉全量 ────────────────────────────────────────────
  for (let p = 2; p <= totalPages; p++) {
    try {
      const d = await fetchPage(p)
      const r = d?.data || d?.result || d
      const l = r?.list || r?.records || r?.items || []
      allCandidates = [...allCandidates, ...l]
      updatePanelStatus(`第 ${p}/${totalPages} 页，已获取 ${allCandidates.length}/${total} 人...`)
    } catch(e) {
      console.warn(`[HR Analyzer] 第${p}页失败:`, e)
    }
  }

  console.log('[HR Analyzer] 原始数据样本（第1条）:', allCandidates[0])

  // ─── 5. 字段标准化 ────────────────────────────────────────────
  const candidates = allCandidates.map(raw => {
    const get = (...keys) => {
      for (const k of keys) {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k]
      }
      return null
    }

    return {
      name:           get('name','candidateName','realName','applicantName','trueName') || String(raw.id || raw.applicantId || ''),
      age:            toNum(get('age','candidateAge')),
      workYears:      toNum(get('workYears','workYear','totalWorkYear','experienceYear','experienceYears','experience')),
      education:      normalEdu(get('education','highestEducation','educationLevel','degree','highestDegree','educationBackground')),
      school:         get('school','graduateSchool','university','college','schoolName','latestSchool','highestSchool','graduationSchool'),
      major:          get('major','speciality','specialty','majorName','latestMajor'),
      currentCompany: get('currentCompany','latestCompany','lastCompany','companyName','latestWorkCompany','newCompanyName','company'),
      firstCompany:   get('firstCompany','firstEmployer','firstWorkCompany'),
    }
  }).filter(c => c.name)

  console.log(`[HR Analyzer] 标准化完成，共 ${candidates.length} 人`)

  // ─── 6. 分析 ──────────────────────────────────────────────────
  const report = analyze(candidates)

  // ─── 7. 渲染结果 ──────────────────────────────────────────────
  renderReport(report, candidates)

  // ════════════════════════════════════════════════════════════════
  //  分析函数
  // ════════════════════════════════════════════════════════════════

  function analyze(cs) {
    return {
      total: cs.length,
      education:        dist(cs, c => c.education || '未知', ['博士','硕士','本科','大专','未知']),
      schools:          analyzeSchools(cs),
      age:              analyzeNum(cs, c => c.age, [[0,25,'25以下'],[25,28,'25-28'],[28,30,'28-30'],[30,35,'30-35'],[35,99,'35以上']]),
      workYears:        analyzeNum(cs, c => c.workYears, [[0,1,'1年内'],[1,3,'1-3年'],[3,5,'3-5年'],[5,8,'5-8年'],[8,10,'8-10年'],[10,99,'10年+']]),
      majors:           topN(cs, c => c.major ? categorizeMajor(c.major) : null, 8),
      currentCompanies: topN(cs, c => c.currentCompany, 10),
    }
  }

  function dist(cs, keyFn, order) {
    const counts = {}
    cs.forEach(c => { const k = keyFn(c); counts[k] = (counts[k]||0)+1 })
    return Object.entries(counts)
      .sort((a,b) => {
        const ia = order.indexOf(a[0]), ib = order.indexOf(b[0])
        return (ia<0?99:ia) - (ib<0?99:ib)
      })
      .map(([label,count]) => ({ label, count, pct: pct(count, cs.length) }))
  }

  function analyzeSchools(cs) {
    const withSchool = cs.filter(c => c.school)
    const counts = {}
    let n985=0, n211=0, nLaw=0
    withSchool.forEach(c => {
      counts[c.school] = (counts[c.school]||0)+1
      if (is985(c.school)) n985++
      if (is211(c.school)) n211++
      if (isLaw(c.school)) nLaw++
    })
    const t = withSchool.length || 1
    return {
      top: Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10)
        .map(([school,count]) => ({ school, count, pct: pct(count,cs.length), tag: schoolTag(school) })),
      pct985: pct(n985, t),
      pct211: pct(n211, t),
      pctLaw: pct(nLaw, t),
    }
  }

  function analyzeNum(cs, valFn, buckets) {
    const vals = cs.map(valFn).filter(v => v !== null && v >= 0)
    if (!vals.length) return null
    const counts = buckets.map(([min,max,label]) => {
      const count = vals.filter(v => v >= min && v < max).length
      return { label, count, pct: pct(count, vals.length) }
    }).filter(b => b.count > 0)
    return {
      buckets: counts,
      avg: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10,
      median: (() => { const s=[...vals].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2*10)/10 })(),
      coverage: pct(vals.length, cs.length)
    }
  }

  function topN(cs, keyFn, n) {
    const counts = {}
    cs.forEach(c => { const k = keyFn(c); if(k) counts[k] = (counts[k]||0)+1 })
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n)
      .map(([label,count]) => ({ label, count, pct: pct(count, cs.filter(c=>keyFn(c)).length||1) }))
  }

  function pct(n, total) { return total ? Math.round(n/total*100) : 0 }
  function toNum(v) { const n = Number(v); return (v===null||v===undefined||isNaN(n)) ? null : n }

  function normalEdu(v) {
    if (!v) return null
    const s = String(v)
    if (/博士|doctor|phd/i.test(s)) return '博士'
    if (/硕士|master|研究生/i.test(s)) return '硕士'
    if (/本科|bachelor|undergraduate/i.test(s)) return '本科'
    if (/大专|专科|junior/i.test(s)) return '大专'
    return s
  }

  const S985 = ['北京大学','清华大学','中国人民大学','中国政法大学','复旦大学','上海交通大学','浙江大学','南京大学','武汉大学','中山大学','华中科技大学','西安交通大学','哈尔滨工业大学','北京师范大学','南开大学','厦门大学','同济大学','吉林大学','东南大学','天津大学','大连理工大学','华南理工大学','四川大学','山东大学','兰州大学','重庆大学','电子科技大学','中南大学']
  const SLAW = ['华东政法大学','西南政法大学','中南财经政法大学','西北政法大学','对外经济贸易大学']
  const S211_EXTRA = ['中央财经大学','中国传媒大学','北京交通大学','北京邮电大学','华东理工大学','东华大学','河海大学','南京航空航天大学','南京理工大学','苏州大学','安徽大学','合肥工业大学','福州大学','南昌大学','郑州大学','华中农业大学','华中师范大学','武汉理工大学','广西大学','贵州大学','云南大学','西北大学','陕西师范大学','内蒙古大学','新疆大学']

  function is985(s) { return S985.some(x => s.includes(x)) }
  function is211(s) { return is985(s) || SLAW.some(x=>s.includes(x)) || S211_EXTRA.some(x=>s.includes(x)) }
  function isLaw(s) { return [...S985.slice(0,4), ...SLAW].some(x=>s.includes(x)) }
  function schoolTag(s) { if(is985(s)) return '985'; if(is211(s)) return '211'; if(SLAW.some(x=>s.includes(x))) return '法律名校'; return '' }

  function categorizeMajor(m) {
    if (/法|law/i.test(m)) return '法学'
    if (/金融|finance|经济|会计|财/i.test(m)) return '金融/经济'
    if (/计算机|软件|信息|cs|it/i.test(m)) return '计算机/信息'
    if (/管理|mba|商学/i.test(m)) return '管理/商科'
    if (/中文|汉语|文学/i.test(m)) return '中文'
    if (/英语|外语|翻译/i.test(m)) return '外语'
    if (/新闻|传播|媒体/i.test(m)) return '新闻传播'
    if (/心理/i.test(m)) return '心理学'
    return m.slice(0,6)
  }

  // ════════════════════════════════════════════════════════════════
  //  渲染
  // ════════════════════════════════════════════════════════════════

  function renderReport(report, candidates) {
    const COLORS = ['#ff2d55','#ff6b6b','#ffa502','#1e90ff','#2ed573','#a29bfe','#fd79a8','#74b9ff','#55efc4','#fdcb6e']

    function barRow(label, p, count, color, wide=false) {
      return `<div style="display:flex;align-items:center;margin-bottom:6px;gap:8px">
        <div style="width:${wide?110:80}px;font-size:12px;color:#444;text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${label}">${label}</div>
        <div style="flex:1;background:#f0f1f5;border-radius:4px;height:14px;overflow:hidden">
          <div style="width:${p}%;height:100%;background:${color};border-radius:4px;transition:width 0.4s"></div>
        </div>
        <div style="width:30px;font-size:11px;color:#888;text-align:right;flex-shrink:0">${p}%</div>
        <div style="width:20px;font-size:11px;color:#ccc;text-align:right;flex-shrink:0">${count}</div>
      </div>`
    }

    function section(title, bodyHtml) {
      return `<div style="background:white;border-radius:10px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
        <div style="padding:9px 14px 7px;font-size:11px;font-weight:700;color:#999;letter-spacing:0.5px;border-bottom:1px solid #f5f5f5">${title}</div>
        <div style="padding:10px 14px 12px">${bodyHtml}</div>
      </div>`
    }

    function statCard(value, label) {
      return `<div style="flex:1;background:#f7f8fc;border-radius:8px;padding:10px 6px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#ff2d55;line-height:1">${value}</div>
        <div style="font-size:10px;color:#999;margin-top:4px">${label}</div>
      </div>`
    }

    // 概览
    const overviewHTML = `<div style="display:flex;gap:8px">
      ${statCard(report.total, '候选人总数')}
      ${statCard(report.age ? report.age.avg+'岁' : '-', '平均年龄')}
      ${statCard(report.workYears ? report.workYears.avg+'年' : '-', '平均工龄')}
    </div>`

    // 学历
    const eduHTML = report.education.map((d,i) => barRow(d.label, d.pct, d.count, COLORS[i])).join('')

    // 院校
    const s = report.schools
    const schoolsHTML = `
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <div style="flex:1;background:#f7f8fc;border-radius:8px;padding:7px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#ff2d55">${s.pct985}%</div>
          <div style="font-size:10px;color:#999;margin-top:2px">985</div>
        </div>
        <div style="flex:1;background:#f7f8fc;border-radius:8px;padding:7px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#ffa502">${s.pct211}%</div>
          <div style="font-size:10px;color:#999;margin-top:2px">211</div>
        </div>
        <div style="flex:1;background:#f7f8fc;border-radius:8px;padding:7px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#6c5ce7">${s.pctLaw}%</div>
          <div style="font-size:10px;color:#999;margin-top:2px">法律名校</div>
        </div>
      </div>
      ${s.top.map((d,i) => {
        const tag = d.tag ? `<span style="font-size:9px;padding:1px 4px;border-radius:3px;margin-left:3px;font-weight:600;background:${d.tag==='985'?'#fff0f3':d.tag==='211'?'#fff8e6':'#f0f0ff'};color:${d.tag==='985'?'#ff2d55':d.tag==='211'?'#f7b731':'#6c5ce7'}">${d.tag}</span>` : ''
        const label = `<span>${d.school.slice(0,8)}</span>${tag}`
        return barRow(label, d.pct, d.count, COLORS[i%10], true)
      }).join('')}
    `

    // 年龄/工龄
    function numSection(title, data) {
      if (!data) return ''
      return section(`${title} · 均值 ${data.avg} · 中位 ${data.median}${data.coverage<80?` · ⚠️仅${data.coverage}%有数据`:''}`,
        data.buckets.map((d,i) => barRow(d.label, d.pct, d.count, COLORS[i])).join(''))
    }

    // 专业
    const majorHTML = report.majors.length
      ? report.majors.map((d,i) => barRow(d.label, d.pct, d.count, COLORS[i])).join('')
      : '<p style="color:#ccc;text-align:center;font-size:12px">暂无专业数据</p>'

    // 当前公司
    const compHTML = report.currentCompanies.length
      ? report.currentCompanies.map((d,i) => barRow(d.label.slice(0,10), d.pct, d.count, COLORS[i%10], true)).join('')
      : '<p style="color:#ccc;text-align:center;font-size:12px">暂无公司数据</p>'

    // 导出函数
    window.__hrAnalyzerData = candidates

    const bodyHTML = `
      ${section('📊 总体概览', overviewHTML)}
      ${section('📚 学历分布', eduHTML)}
      ${section('🏫 毕业院校', schoolsHTML)}
      ${numSection('👤 年龄分布', report.age)}
      ${numSection('💼 工作年限', report.workYears)}
      ${section('🎓 专业背景', majorHTML)}
      ${section('🏢 当前公司 Top10', compHTML)}
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button onclick="(function(){
          const cs=window.__hrAnalyzerData;
          const r=document.getElementById('hr-analyzer-panel').__report;
          const lines=['【人才画像】共'+cs.length+'人','','▌学历',...r.education.map(e=>'  '+e.label+'：'+e.count+'人('+e.pct+'%)'),'','▌院校','  985:'+r.schools.pct985+'%  211:'+r.schools.pct211+'%',...r.schools.top.slice(0,5).map(s=>'  '+s.school+'：'+s.count+'人'),'','▌年龄均值：'+(r.age?r.age.avg+'岁':'-')+'  工龄均值：'+(r.workYears?r.workYears.avg+'年':'-')];
          navigator.clipboard.writeText(lines.join('\\n')).then(()=>this.textContent='✅ 已复制').catch(()=>alert(lines.join('\\n')));
          setTimeout(()=>this.textContent='📋 复制摘要',2000)
        }).call(this)" style="flex:1;padding:7px;background:#f0f1f5;border:none;border-radius:7px;font-size:12px;color:#555;cursor:pointer;font-weight:500">📋 复制摘要</button>
        <button onclick="(function(){
          const cs=window.__hrAnalyzerData;
          const headers=['姓名','年龄','工龄','学历','院校','专业','当前公司','第一家公司'];
          const rows=cs.map(c=>[c.name,c.age??'',c.workYears??'',c.education??'',c.school??'',c.major??'',c.currentCompany??'',c.firstCompany??'']);
          const csv=[headers,...rows].map(r=>r.map(v=>'\"'+String(v).replace(/\"/g,'\"\"')+'\"').join(',')).join('\\n');
          const blob=new Blob(['\\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
          const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='人才画像_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
        })()" style="flex:1;padding:7px;background:#f0f1f5;border:none;border-radius:7px;font-size:12px;color:#555;cursor:pointer;font-weight:500">⬇️ 下载 CSV</button>
      </div>
      <div style="text-align:center;font-size:11px;color:#ccc;padding-bottom:4px">数据实时从接口获取 · 字段未填写则不计入统计</div>
    `

    const panel = document.getElementById('hr-analyzer-panel')
    panel.innerHTML = `
      <div style="background:linear-gradient(135deg,#ff2d55,#ff6b6b);padding:13px 16px 11px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:700;color:white">🎯 人才画像分析</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px">共 ${report.total} 人</div>
        </div>
        <button onclick="document.getElementById('hr-analyzer-panel').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:14px;line-height:1">✕</button>
      </div>
      <div style="padding:12px 14px;overflow-y:auto;max-height:calc(90vh - 60px)">${bodyHTML}</div>
    `
    panel.__report = report
  }

  // ════════════════════════════════════════════════════════════════
  //  面板 UI 工具
  // ════════════════════════════════════════════════════════════════

  function showPanel(html) {
    let panel = document.getElementById('hr-analyzer-panel')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'hr-analyzer-panel'
      Object.assign(panel.style, {
        position:    'fixed',
        top:         '0',
        right:       '0',
        width:       '420px',
        height:      '100vh',
        background:  '#f7f8fc',
        boxShadow:   '-4px 0 20px rgba(0,0,0,0.15)',
        zIndex:      '999999',
        fontFamily:  "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif",
        fontSize:    '13px',
        color:       '#1a1a2e',
        overflowY:   'auto',
      })

      // 加载动画 CSS
      const style = document.createElement('style')
      style.textContent = `.hr-spin{width:28px;height:28px;border:3px solid #f0f0f0;border-top-color:#ff2d55;border-radius:50%;animation:hr-spin .7s linear infinite;margin:0 auto} @keyframes hr-spin{to{transform:rotate(360deg)}}`
      document.head.appendChild(style)

      document.body.appendChild(panel)
    }
    panel.innerHTML = html
    return panel
  }

  function updatePanelStatus(text) {
    const panel = document.getElementById('hr-analyzer-panel')
    if (panel) {
      const p = panel.querySelector('p')
      if (p) p.textContent = text
    }
  }

  console.log('[HR Analyzer] 完成 ✓')

})()
