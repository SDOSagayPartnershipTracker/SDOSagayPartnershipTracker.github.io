const peso=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2});
let records=[],registeredStakeholders=[],registeredStakeholderCount=0;
const number=v=>{const n=Number(String(v??0).replace(/,/g,""));return Number.isFinite(n)?n:0};
const excelDate=v=>{
  if(!v)return null;
  if(/^\d+(\.\d+)?$/.test(String(v)))return new Date(Date.UTC(1899,11,30)+Number(v)*86400000);
  const d=new Date(v);return Number.isNaN(d.getTime())?null:d;
};
const dateText=v=>{const d=excelDate(v);return d?new Intl.DateTimeFormat("en-PH",{year:"numeric",month:"short",day:"numeric"}).format(d):String(v??"")};
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const canonicalPartnerName=v=>{const name=String(v||"Unspecified").trim().replace(/\s+/g," ");const key=name.toLocaleLowerCase();const cityLguAliases=new Set(["local government unit","local government unit city","local government unit sagay","local government unit sagay city","lgu city","lgu sagay","lgu sagay city","lgu-sagay city"]);return cityLguAliases.has(key)?"LOCAL GOVERNMENT UNIT":name;};

function openView(viewId){
  const target=document.getElementById(viewId)||document.getElementById("dashboard");
  document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.view===target.id));
  document.querySelectorAll(".view").forEach(view=>view.classList.toggle("active",view===target));
}
openView(document.body.dataset.defaultView||"dashboard");

function confirmedRows(){return records.filter(r=>String(r.status).trim().toLowerCase()==="confirmed")}

function renderDonations(){
  const rows=document.getElementById("rows"),search=document.getElementById("search");
  if(!rows||!search)return;
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    const filtered=records.filter(r=>Object.values(r).join(" ").toLowerCase().includes(q));
    rows.innerHTML=filtered.map(r=>`<tr><td>${esc(dateText(r.dateReceived))}</td><td><b>${esc(r.stakeholderName)}</b></td><td>${esc(r.donationType)}</td><td>${esc(r.description)}</td><td>${esc(r.programProject)}</td><td>${esc(r.beneficiarySchools)}</td><td>${esc(r.numberOfBeneficiaries)}</td><td><b>${peso.format(number(r.totalValue))}</b></td><td><span class="confirmed">${esc(r.status)}</span></td></tr>`).join("")||'<tr><td colspan="9">No matching records.</td></tr>';
  };
  const head=document.querySelector("#donations thead tr");
  if(head)head.innerHTML="<th>Date</th><th>Partner</th><th>Type</th><th>Description</th><th>Program / Project</th><th>Beneficiary</th><th>Beneficiaries</th><th>Total Value</th><th>Status</th>";
  search.oninput=draw;draw();
  const exportBtn=document.getElementById("exportBtn");
  if(exportBtn)exportBtn.onclick=()=>{
    const keys=["dateReceived","stakeholderName","donationType","description","cashAmount","inKindValue","totalValue","programProject","beneficiarySchools","numberOfBeneficiaries","status"];
    const csv=[keys,...records.map(r=>keys.map(k=>r[k]??""))].map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="SDO-Sagay-Live-Donations.csv";a.click();URL.revokeObjectURL(a.href);
  };
}

function aggregates(key,source=confirmedRows()){
  const map=new Map();
  source.forEach(r=>{
    const rawName=String(r[key]||"Unspecified").trim().replace(/\s+/g," ");
    const name=key==="stakeholderName"?canonicalPartnerName(rawName):rawName;
    const normalized=name.toLocaleLowerCase();
    const item=map.get(normalized)||{name,records:0,cash:0,inkind:0,total:0};
    item.records++;item.cash+=number(r.cashAmount);item.inkind+=number(r.inKindValue);item.total+=number(r.totalValue);map.set(normalized,item);
  });
  return [...map.values()].sort((a,b)=>b.total-a.total);
}

function renderDirectory(sectionId,key,label){
  const host=document.querySelector(`#${sectionId} .empty`);
  if(!host)return;
  let data=aggregates(key);
  if(sectionId==="stakeholders"&&registeredStakeholders.length){
    const totals=new Map(data.map(x=>[x.name.toLocaleLowerCase(),x]));
    data=registeredStakeholders.map(row=>{
      const name=String(row.stakeholderName||"").trim().replace(/\s+/g," ");
      return totals.get(name.toLocaleLowerCase())||{name,records:0,cash:0,inkind:0,total:0};
    });
  }
  host.className="tablewrap";
  host.innerHTML=`<table class="datatable"><thead><tr><th>${label}</th><th>Confirmed Records</th><th>Cash</th><th>In-kind</th><th>Total Support</th></tr></thead><tbody>${data.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.records}</td><td>${peso.format(x.cash)}</td><td>${peso.format(x.inkind)}</td><td><b>${peso.format(x.total)}</b></td></tr>`).join("")}</tbody></table>`;
}

function updateDashboard(){
  const rows=confirmedRows(),cash=rows.reduce((s,r)=>s+number(r.cashAmount),0),inkind=rows.reduce((s,r)=>s+number(r.inKindValue),0),total=rows.reduce((s,r)=>s+number(r.totalValue),0);
  const donationPartners=aggregates("stakeholderName",records),rankedPartners=aggregates("stakeholderName"),projects=aggregates("programProject");
  const partners=registeredStakeholders.length?registeredStakeholders:donationPartners;
  const rawPartnerNames=new Set(records.map(r=>String(r.stakeholderName||"").trim().replace(/\s+/g," ").toLocaleLowerCase()));
  const cityLguNames=[...rawPartnerNames].filter(name=>canonicalPartnerName(name)==="LOCAL GOVERNMENT UNIT");
  const mergedLguDuplicate=Math.max(0,cityLguNames.length-1);
  const partnerCount=(registeredStakeholderCount||partners.length)-mergedLguDuplicate;
  const metrics=document.querySelectorAll("#dashboard .metric");
  if(metrics.length>=4){
    metrics[0].querySelector(".amount").textContent=peso.format(total);metrics[0].querySelector("small").textContent=`${rows.length} confirmed donation records`;
    metrics[1].querySelector(".amount").textContent=peso.format(cash);
    metrics[2].querySelector(".amount").textContent=peso.format(inkind);
    metrics[3].querySelector(".amount").textContent=String(partnerCount);metrics[3].querySelector("small").textContent=`${partnerCount} registered partners`;
  }
  const division=rows.filter(r=>String(r.beneficiarySchools).toLowerCase().includes("division office")).reduce((s,r)=>s+number(r.totalValue),0);
  const schools=total-division,alloc=document.querySelectorAll("#dashboard .allocation strong");
  if(alloc.length>=2){alloc[0].textContent=peso.format(schools);alloc[1].textContent=peso.format(division)}
  const bars=document.querySelectorAll("#dashboard .bar > *");
  if(bars.length>=2&&total){bars[0].style.width=(schools/total*100)+"%";bars[1].style.width=(division/total*100)+"%"}
  const now=new Date(),monthly=rows.filter(r=>{const d=excelDate(r.dateReceived);return d&&d.getUTCFullYear()===now.getUTCFullYear()&&d.getUTCMonth()===now.getUTCMonth()});
  const monthTotal=monthly.reduce((s,r)=>s+number(r.totalValue),0),monthStrong=document.querySelector("#dashboard .month strong");
  if(monthStrong)monthStrong.textContent=peso.format(monthTotal);
  const ranking=document.querySelector("#dashboard .rankings");
  if(ranking){
    const top=rankedPartners.slice(0,5),max=top[0]?.total||1;
    ranking.innerHTML=top.map((x,i)=>`<div class="rank"><span class="rankno">${String(i+1).padStart(2,"0")}</span><div>${esc(x.name)}<div class="track"><i style="width:${x.total/max*100}%"></i></div></div><strong>${peso.format(x.total)}</strong></div>`).join("");
  }
  const monthlyMap=new Map();
  monthly.forEach(r=>{const n=String(r.stakeholderName||"Unspecified").trim();monthlyMap.set(n,(monthlyMap.get(n)||0)+number(r.totalValue))});
  const winner=[...monthlyMap.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(winner){
    const body=document.querySelector("#dashboard .partnerbody");
    if(body){body.querySelector("h3").textContent=winner[0];body.querySelector(".partneramount strong").textContent=peso.format(winner[1]);body.querySelector(".partneramount small").textContent=`${monthly.filter(r=>String(r.stakeholderName).trim()===winner[0]).length} confirmed donation(s) this month`}
  }
  const notice=document.querySelector("#dashboard .notice");
  if(notice)notice.textContent=`ⓘ  Live Excel data · Last synchronized ${new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short"}).format(new Date(window.liveUpdatedAt))}`;
}

async function loadLiveData(){
  try{
    const response=await fetch("https://raw.githubusercontent.com/SDOSagayPartnershipTracker/SDOSagayPartnershipTracker.github.io/main/data.json?v="+Date.now(),{cache:"no-store"});
    if(!response.ok)throw new Error("Data file unavailable");
    const data=await response.json();records=Array.isArray(data.donations)?data.donations:[];registeredStakeholders=Array.isArray(data.stakeholders)?data.stakeholders:[];registeredStakeholderCount=number(data.stakeholderCount);window.liveUpdatedAt=data.updatedAt||new Date().toISOString();
    renderDonations();renderDirectory("stakeholders","stakeholderName","Stakeholder");renderDirectory("projects","programProject","Program / Project");updateDashboard();
  }catch(error){
    console.error(error);
    const notice=document.querySelector("#dashboard .notice");if(notice)notice.textContent="Live Excel data could not be loaded. Please refresh shortly.";
  }
}
loadLiveData();
setInterval(loadLiveData,300000);
