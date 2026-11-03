import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import{createClient}from"@supabase/supabase-js";
import"./styles.css";
const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const districts=["Bugesera","Burera","Gakenke","Gasabo","Gatsibo","Gicumbi","Gisagara","Huye","Kamonyi","Karongi","Kayonza","Kicukiro","Kirehe","Muhanga","Musanze","Ngoma","Ngororero","Nyabihu","Nyagatare","Nyamagabe","Nyamasheke","Nyanza","Nyarugenge","Nyaruguru","Rubavu","Ruhango","Rulindo","Rusizi","Rutsiro","Rwamagana"];
const roles={teacher:"Umwarimu ushaka permutation",job_seeker:"Umwarimu ushaka akazi",school:"Ikigo cy'amashuri",admin:"Administrator"};
function App(){const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[msg,setMsg]=useState(""),[err,setErr]=useState("");const[authOpen,setAuthOpen]=useState(false),[mode,setMode]=useState("login"),[requestOpen,setRequestOpen]=useState(false);const[auth,setAuth]=useState({full_name:"",email:"",password:"",role:"teacher"});const[requests,setRequests]=useState([]),[matches,setMatches]=useState([]),[jobs,setJobs]=useState([]),[applications,setApplications]=useState([]),[jobOpen,setJobOpen]=useState(false),[chatMatch,setChatMatch]=useState(null),[messages,setMessages]=useState([]),[messageBody,setMessageBody]=useState("");const[request,setRequest]=useState({current_school:"",current_district:"",wanted_district:"",subject:"",teaching_level:"",details:""});
useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session||null);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s||null));return()=>subscription.unsubscribe()},[]);
useEffect(()=>{if(!session?.user){setProfile(null);return}loadAll(session.user.id)},[session]);
useEffect(()=>{if(session?.user)loadJobs(session.user.id)},[session,profile?.role]);
async function loadJobs(id){const{data:j,error:je}=await supabase.from("job_vacancies").select("*,schools(name)").eq("status","published").order("created_at",{ascending:false});if(je)setErr(je.message);else setJobs(j||[]);const{data:a,error:ae}=await supabase.from("job_applications").select("*,job_vacancies(title,subject,district,status)").eq("applicant_id",id).order("created_at",{ascending:false});if(!ae)setApplications(a||[])}
async function loadAll(id){
 setErr("");
 const[{data:p,error:pe},{data:r,error:re},{data:m,error:me}]=await Promise.all([
  supabase.from("profiles").select("*").eq("id",id).single(),
  supabase.from("permutation_requests").select("*").eq("teacher_id",id).order("created_at",{ascending:false}),
  supabase.from("permutation_matches").select("*").or(`teacher_a.eq.${id},teacher_b.eq.${id}`).order("created_at",{ascending:false})
 ]);
 if(pe)setErr(pe.message);else{setProfile(p);setRequest(x=>({...x,current_school:p.school_name||"",current_district:p.district||"",subject:p.subject||"",teaching_level:p.teaching_level||""}))}
 if(re)setErr(re.message);else setRequests(r||[]);
 if(me)setErr(me.message);else{
  const enriched=await Promise.all((m||[]).map(async match=>{
   const otherId=match.teacher_a===id?match.teacher_b:match.teacher_a;
   const{data:other}=await supabase.from("profiles").select("id,full_name,phone,district,school_name,subject,teaching_level").eq("id",otherId).single();
   return{...match,other};
  }));
  setMatches(enriched);
 }
}
async function submitAuth(e){e.preventDefault();setLoading(true);setErr("");try{if(mode==="register"){const{data,error}=await supabase.auth.signUp({email:auth.email.trim(),password:auth.password,options:{emailRedirectTo:window.location.origin,data:{full_name:auth.full_name.trim(),role:auth.role}}});if(error)throw error;setMsg(data.session?"Konti yakozwe.":"Reba email yawe wemeze konti.")}else{const{error}=await supabase.auth.signInWithPassword({email:auth.email.trim(),password:auth.password});if(error)throw error;setAuthOpen(false);setMsg("Winjiye muri konti neza.")}}catch(e){setErr(e.message)}finally{setLoading(false)}}
async function submitRequest(e){e.preventDefault();setLoading(true);setErr("");try{if(profile?.verification_status!=="verified")throw new Error("Konti yawe igomba kubanza kwemezwa na Admin.");if(request.current_district===request.wanted_district)throw new Error("Akarere uvamo ntigashobora guhura n'ako ushaka kujyamo.");const{error}=await supabase.from("permutation_requests").insert({...request,teacher_id:session.user.id,status:"active",published:true});if(error)throw error;setRequestOpen(false);setMsg("Icyifuzo cya permutation cyabitswe.");await loadAll(session.user.id)}catch(e){setErr(e.message.includes("one_active")?"Usanzwe ufite icyifuzo cya permutation gifunguye.":e.message)}finally{setLoading(false)}}
async function setRequestStatus(id,status){const{error}=await supabase.from("permutation_requests").update({status,published:status==="active"}).eq("id",id);if(error)setErr(error.message);else{setMsg(status==="closed"?"Icyifuzo cyafunzwe.":"Icyifuzo cyasubijwe ku rubuga.");loadAll(session.user.id)}}
async function acceptMatch(matchId){
 setLoading(true);setErr("");
 const{error}=await supabase.rpc("accept_permutation_match",{p_match_id:matchId});
 if(error)setErr(error.message);else{setMsg("Match wayemeye. Dutegereje ko n'undi mwarimu ayemeza.");await loadAll(session.user.id)}
 setLoading(false);
}
async function openChat(match){
 setChatMatch(match);setMessageBody("");
 const otherId=match.teacher_a===session.user.id?match.teacher_b:match.teacher_a;
 const{data,error}=await supabase.from("messages").select("*").or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${session.user.id})`).order("created_at",{ascending:true});
 if(error)setErr(error.message);else setMessages(data||[]);
}
async function sendMessage(e){
 e.preventDefault();if(!messageBody.trim()||!chatMatch)return;
 const otherId=chatMatch.teacher_a===session.user.id?chatMatch.teacher_b:chatMatch.teacher_a;
 const{error}=await supabase.from("messages").insert({sender_id:session.user.id,receiver_id:otherId,body:messageBody.trim()});
 if(error)setErr(error.message);else{setMessageBody("");await openChat(chatMatch)}
}
async function completePermutation(matchId){
 if(!window.confirm("Wemeza ko wabonye permutation? Ibi bizafunga ibyifuzo byanyu."))return;
 const{error}=await supabase.rpc("complete_permutation_match",{p_match_id:matchId});
 if(error)setErr(error.message);else{setMsg("Permutation yanditswe ko yabonetse kandi ibyifuzo byafunzwe.");setChatMatch(null);await loadAll(session.user.id)}
}
async function applyJob(job){
 const cover=window.prompt("Andika ubutumwa bugufi bwo gusaba aka kazi:")||"";
 const{error}=await supabase.from("job_applications").insert({vacancy_id:job.id,applicant_id:session.user.id,cover_letter:cover,status:"new"});
 if(error)setErr(error.message);else{setMsg("Application yoherejwe neza.");loadJobs(session.user.id)}
}
async function logout(){await supabase.auth.signOut()}
if(loading&&!session)return <div className="loading">Mwarimu Connect irimo gufunguka...</div>;
return <div><header><div className="brand"><span>↔</span>Mwarimu Connect</div><nav><a href="#home">Ahabanza</a><a href="#permutation">Permutation</a></nav>{session?<button className="outline" onClick={logout}>Sohoka</button>:<button className="primary" onClick={()=>setAuthOpen(true)}>Injira</button>}</header>{msg&&<div className="notice ok">✓ {msg}</div>}{err&&<div className="notice bad">⚠ {err}</div>}{!session?<Home register={()=>{setMode("register");setAuthOpen(true)}}/>:profile?.role==="admin"?<Admin/>:profile?.role==="job_seeker"?<JobSeeker profile={profile} jobs={jobs} applications={applications} applyJob={applyJob}/>:profile?.role==="school"?<SchoolDashboard profile={profile}/>:<Dashboard profile={profile} requests={requests} matches={matches} userId={session.user.id} openRequest={()=>setRequestOpen(true)} setStatus={setRequestStatus} acceptMatch={acceptMatch} openChat={openChat} completePermutation={completePermutation}/>}<footer>© 2026 Mwarimu Connect</footer>{authOpen&&<Auth auth={auth} setAuth={setAuth} mode={mode} setMode={setMode} submit={submitAuth} close={()=>setAuthOpen(false)} loading={loading}/>} {requestOpen&&<RequestModal value={request} setValue={setRequest} submit={submitRequest} close={()=>setRequestOpen(false)} loading={loading}/>} {chatMatch&&<ChatModal match={chatMatch} userId={session.user.id} messages={messages} body={messageBody} setBody={setMessageBody} send={sendMessage} close={()=>setChatMatch(null)} complete={()=>completePermutation(chatMatch.id)}/>}</div>}
function Home({register}){return <main><section className="hero" id="home"><div><small>Urubuga rw'abarimu bo mu Rwanda</small><h1>Permutation, akazi n'amahirwe y'abarimu hamwe.</h1><p>Shaka uwo mwahuza permutation mu buryo bwizewe.</p><button className="primary" onClick={register}>Fungura konti →</button></div><div className="art">👩🏾‍🏫 <b>↔</b> 👨🏾‍🏫</div></section></main>}
function Dashboard({profile,requests,matches,userId,openRequest,setStatus,acceptMatch,openChat,completePermutation}){
 const current=requests.find(x=>["active","matched","submitted","approved"].includes(x.status));
 return <main className="dashboard" id="permutation">
  <section className="welcome"><div><small>Murakaza neza</small><h1>{profile?.full_name}</h1><p>{roles[profile?.role]}</p></div><span className={`badge ${profile?.verification_status==="verified"?"verified":"pending"}`}>{profile?.verification_status==="verified"?"✓ Konti yemejwe":"Iri gutegereza kwemezwa"}</span></section>
  <section className="metrics"><article><b>{requests.length}</b><span>Ibyifuzo</span></article><article><b>{matches.length}</b><span>Matches</span></article><article><b>0</b><span>Ubutumwa</span></article></section>
  <section className="toolbar"><h2>Permutation yanjye</h2><button className="primary" disabled={profile?.verification_status!=="verified"||!!current} onClick={openRequest}>+ Tanga icyifuzo</button></section>
  {profile?.verification_status!=="verified"&&<div className="warning">Konti igomba kubanza kwemezwa kugira ngo utange icyifuzo.</div>}
  <section className="list">{requests.length?requests.map(r=><article key={r.id}><div className="route"><div><small>Arava</small><b>{r.current_district}</b><span>{r.current_school}</span></div><strong>→</strong><div><small>Ashaka kujya</small><b>{r.wanted_district}</b><span>{r.subject} · {r.teaching_level}</span></div></div><div className="row"><span className="badge pending">{r.status}</span>{r.status==="active"?<button className="reject" onClick={()=>setStatus(r.id,"closed")}>Funga icyifuzo</button>:<button className="outline" onClick={()=>setStatus(r.id,"active")}>Subiza ku rubuga</button>}</div></article>):<div className="empty">Nta cyifuzo cya permutation uratanga.</div>}</section>
  <h2>Matches zabonetse</h2>
  <section className="list">{matches.length?matches.map(m=>{
   const mine=m.teacher_a===userId?m.teacher_a_accepted:m.teacher_b_accepted;
   const otherAccepted=m.teacher_a===userId?m.teacher_b_accepted:m.teacher_a_accepted;
   const both=mine===true&&otherAccepted===true;
   return <article key={m.id} className="matchCard"><div className="row"><div><h3>{m.other?.full_name||"Umwarimu wahujwe nawe"}</h3><p>{m.other?.district||""} · {m.other?.school_name||""}</p></div><span className={`badge ${both?"verified":"pending"}`}>{both?"Bombi bemeye":mine?"Wowe waremeje":"Match nshya"}</span></div><div className="adminGrid"><p><b>Isomo:</b> {m.other?.subject||"-"}</p><p><b>Urwego:</b> {m.other?.teaching_level||"-"}</p><p><b>Wowe:</b> {mine?"Wemeje":"Nturayemeza"}</p><p><b>Undi:</b> {otherAccepted?"Yemeje":"Aracyategerejwe"}</p></div>{both?<div className="contactBox"><b>Telefone:</b> {m.other?.phone||"Nta telefone yashyizweho"}<p>Ubu mwembi mwemeye. Mushobora kuvugana mugakomeza inzira ya permutation.</p><div className="matchActions"><button className="primary" onClick={()=>openChat(m)}>Andika ubutumwa</button><button className="approve" onClick={()=>completePermutation(m.id)}>Nabonye permutation</button></div></div>:<button className="approve" disabled={mine===true} onClick={()=>acceptMatch(m.id)}>{mine?"✓ Match wayemeye":"Ndemera iyi match"}</button>}</article>
  }):<div className="empty">Nta match iraboneka. System izakumenyesha igihe habonetse icyifuzo gihuye n'icyawe.</div>}</section>
 </main>
}
function Admin(){
 const[verifications,setVerifications]=useState([]),[permutations,setPermutations]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 useEffect(()=>{loadAdmin()},[]);
 async function loadAdmin(){
  setBusy(true);setError("");
  const[{data:v,error:ve},{data:p,error:pe}]=await Promise.all([
   supabase.from("teacher_verifications").select("id,teacher_id,registration_number,document_path,status,admin_note,created_at,profiles!teacher_id(full_name,email,phone,district,school_name,subject,teaching_level)").order("created_at",{ascending:false}),
   supabase.from("permutation_requests").select("*,profiles!teacher_id(full_name,email,phone,verification_status)").order("created_at",{ascending:false})
  ]);
  if(ve)setError(ve.message);else setVerifications(v||[]);
  if(pe)setError(x=>x||pe.message);else setPermutations(p||[]);
  setBusy(false);
 }
 async function review(item,status){
  const note=status==="rejected"?(window.prompt("Andika impamvu yo kwanga cyangwa ibyo agomba gukosora:")||""):"Konti yagenzuwe kandi yemejwe.";
  const{error}=await supabase.rpc("review_teacher_verification",{p_teacher_id:item.teacher_id,p_status:status,p_note:note});
  if(error)setError(error.message);else loadAdmin();
 }
 async function openDocument(path){
  const{data,error}=await supabase.storage.from("verification-documents").createSignedUrl(path,120);
  if(error)setError(error.message);else window.open(data.signedUrl,"_blank");
 }
 return <main className="dashboard">
  <section className="welcome"><div><small>Admin Dashboard</small><h1>Gucunga Mwarimu Connect</h1><p>{verifications.filter(x=>x.status==="pending").length} bategereje kwemezwa · {permutations.filter(x=>x.status==="active").length} permutation zikora</p></div><button className="outline" onClick={loadAdmin}>Vugurura</button></section>
  {error&&<div className="warning">{error}</div>}
  <h2>Abategereje kwemezwa</h2>
  <section className="list">{busy?<p>Birimo gufunguka...</p>:verifications.length?verifications.map(item=><article key={item.id}><div className="row"><div><h3>{item.profiles?.full_name||"Nta zina"}</h3><p>{item.profiles?.email}</p></div><span className={`badge ${item.status==="verified"?"verified":"pending"}`}>{item.status}</span></div><div className="adminGrid"><p><b>Telefone:</b> {item.profiles?.phone||"-"}</p><p><b>Akarere:</b> {item.profiles?.district||"-"}</p><p><b>Ikigo:</b> {item.profiles?.school_name||"-"}</p><p><b>Isomo:</b> {item.profiles?.subject||"-"}</p><p><b>Urwego:</b> {item.profiles?.teaching_level||"-"}</p><p><b>Registration No:</b> {item.registration_number||"-"}</p></div><div className="adminButtons">{item.document_path&&<button className="outline" onClick={()=>openDocument(item.document_path)}>Reba icyemezo</button>}<button className="approve" onClick={()=>review(item,"verified")}>✓ Emeza</button><button className="reject" onClick={()=>review(item,"rejected")}>✕ Anga</button></div></article>):<div className="empty">Nta cyifuzo cyo kwemezwa kirahari.</div>}</section>
  <h2>Ibyifuzo bya permutation</h2>
  <section className="list">{permutations.length?permutations.map(r=><article key={r.id}><div className="row"><div><h3>{r.profiles?.full_name||"Umwarimu"}</h3><p>{r.profiles?.email} · {r.profiles?.phone||"Nta telefone"}</p></div><span className="badge pending">{r.status}</span></div><div className="route"><div><small>Arava</small><b>{r.current_district}</b><span>{r.current_school}</span></div><strong>→</strong><div><small>Ashaka kujya</small><b>{r.wanted_district}</b><span>{r.subject} · {r.teaching_level}</span></div></div>{r.details&&<p><b>Ibisobanuro:</b> {r.details}</p>}</article>):<div className="empty">Nta cyifuzo cya permutation kiratangwa.</div>}</section>
 </main>
}
function Auth({auth,setAuth,mode,setMode,submit,close,loading}){const c=e=>setAuth({...auth,[e.target.name]:e.target.value});return <div className="overlay"><form className="modal" onSubmit={submit}><button type="button" className="close" onClick={close}>✕</button><h2>{mode==="register"?"Fungura konti":"Injira"}</h2>{mode==="register"&&<><label>Amazina<input name="full_name" value={auth.full_name} onChange={c} required/></label><label>Konti<select name="role" value={auth.role} onChange={c}>{Object.entries(roles).filter(([x])=>x!=="admin").map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}<label>Email<input name="email" type="email" value={auth.email} onChange={c} required/></label><label>Password<input name="password" type="password" minLength="8" value={auth.password} onChange={c} required/></label><button className="primary full" disabled={loading}>{loading?"Tegereza...":mode==="register"?"Kora konti":"Injira"}</button><button type="button" className="link" onClick={()=>setMode(mode==="register"?"login":"register")}>{mode==="register"?"Usanzwe ufite konti? Injira":"Nta konti ufite? Fungura konti"}</button></form></div>}
function RequestModal({value,setValue,submit,close,loading}){const c=e=>setValue({...value,[e.target.name]:e.target.value});return <div className="overlay"><form className="modal wide" onSubmit={submit}><button type="button" className="close" onClick={close}>✕</button><h2>Tanga icyifuzo cya permutation</h2><div className="formGrid"><label>Ikigo ukoreramo<input name="current_school" value={value.current_school} onChange={c} required/></label><label>Akarere ukoreramo<select name="current_district" value={value.current_district} onChange={c} required><option value="">Hitamo</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label><label>Akarere ushaka kujyamo<select name="wanted_district" value={value.wanted_district} onChange={c} required><option value="">Hitamo</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label><label>Isomo<input name="subject" value={value.subject} onChange={c} required/></label><label>Urwego<select name="teaching_level" value={value.teaching_level} onChange={c} required><option value="">Hitamo</option>{["Nursery","Primary","Secondary","TVET"].map(x=><option key={x}>{x}</option>)}</select></label><label>Ibisobanuro<textarea name="details" value={value.details} onChange={c}/></label></div><button className="primary full" disabled={loading}>{loading?"Birimo koherezwa...":"Ohereza icyifuzo"}</button></form></div>}
function JobSeeker({profile,jobs,applications,applyJob}){
 const[jobProfile,setJobProfile]=useState(null),[notifications,setNotifications]=useState([]),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const[form,setForm]=useState({qualification:"",years_experience:0,preferred_districts:"",employment_type:"Full-time",available_from:""});
 const[cvFile,setCvFile]=useState(null);
 useEffect(()=>{loadExtra()},[]);
 async function loadExtra(){
  const[{data:j,error:je},{data:n,error:ne}]=await Promise.all([
   supabase.from("job_profiles").select("*").eq("user_id",profile.id).maybeSingle(),
   supabase.from("notifications").select("*").eq("user_id",profile.id).order("created_at",{ascending:false}).limit(20)
  ]);
  if(je)setError(je.message);else if(j){setJobProfile(j);setForm({qualification:j.qualification||"",years_experience:j.years_experience||0,preferred_districts:(j.preferred_districts||[]).join(", "),employment_type:j.employment_type||"Full-time",available_from:j.available_from||""})}
  if(ne)setError(ne.message);else setNotifications(n||[]);
 }
 async function saveProfile(e){
  e.preventDefault();setSaving(true);setError("");
  try{
   let cvPath=jobProfile?.cv_path||null;
   if(cvFile){
    cvPath=`${profile.id}/cv-${Date.now()}.pdf`;
    const{error:u}=await supabase.storage.from("cvs").upload(cvPath,cvFile,{upsert:false});
    if(u)throw u;
   }
   const payload={user_id:profile.id,qualification:form.qualification,years_experience:Number(form.years_experience)||0,preferred_districts:form.preferred_districts.split(",").map(x=>x.trim()).filter(Boolean),employment_type:form.employment_type,available_from:form.available_from||null,cv_path:cvPath,visible_to_schools:true};
   const{error}=await supabase.from("job_profiles").upsert(payload,{onConflict:"user_id"});
   if(error)throw error;
   setOpen(false);await loadExtra();
  }catch(e){setError(e.message)}finally{setSaving(false)}
 }
 async function markRead(id){await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id);loadExtra()}
 const c=e=>setForm({...form,[e.target.name]:e.target.value});
 return <main className="dashboard">
  <section className="welcome"><div><small>Job Seeker Dashboard</small><h1>{profile?.full_name}</h1><p>Shaka akazi ko kwigisha</p></div><button className="primary" onClick={()=>setOpen(true)}>{jobProfile?"Hindura Job Profile":"Uzuza Job Profile"}</button></section>
  {error&&<div className="warning">{error}</div>}
  <section className="metrics"><article><b>{jobs.length}</b><span>Vacancies</span></article><article><b>{applications.length}</b><span>Applications</span></article><article><b>{notifications.filter(x=>!x.read_at).length}</b><span>Notifications nshya</span></article></section>
  <section className="dashboardGrid"><article><h2>Job Profile</h2><p><b>Impamyabumenyi:</b> {jobProfile?.qualification||"Ntuzuye"}</p><p><b>Uburambe:</b> {jobProfile?.years_experience??0} years</p><p><b>Uturere:</b> {(jobProfile?.preferred_districts||[]).join(", ")||"Ntuzuye"}</p><p><b>CV:</b> {jobProfile?.cv_path?"Yashyizweho":"Ntirashyirwaho"}</p></article><article><h2>Notifications</h2>{notifications.length?notifications.slice(0,5).map(n=><div className={`notification ${n.read_at?"read":"unread"}`} key={n.id} onClick={()=>markRead(n.id)}><b>{n.title}</b><p>{n.body}</p></div>):<p>Nta notification irahari.</p>}</article></section>
  <h2>Imyanya y'akazi ihari</h2><section className="list">{jobs.length?jobs.map(j=><article key={j.id}><div className="row"><div><h3>{j.title}</h3><p>{j.schools?.name||"Ikigo"} · {j.district}</p></div><span className="badge verified">{j.status}</span></div><div className="adminGrid"><p><b>Isomo:</b> {j.subject}</p><p><b>Urwego:</b> {j.teaching_level}</p><p><b>Uburambe:</b> {j.minimum_experience} years</p><p><b>Deadline:</b> {j.deadline}</p></div><p>{j.description}</p><button className="primary" disabled={!jobProfile?.cv_path||applications.some(a=>a.vacancy_id===j.id)} onClick={()=>applyJob(j)}>{!jobProfile?.cv_path?"Banza ushyireho CV":applications.some(a=>a.vacancy_id===j.id)?"Warasabye":"Saba akazi"}</button></article>):<div className="empty">Nta vacancy iratangazwa.</div>}</section>
  <h2>Applications zanjye</h2><section className="list">{applications.length?applications.map(a=><article key={a.id}><h3>{a.job_vacancies?.title}</h3><p>{a.job_vacancies?.subject} · {a.job_vacancies?.district}</p><span className="badge pending">{a.status}</span>{a.status==="interview"&&<div className="interviewBox"><p><b>Itariki n'isaha:</b> {a.interview_at?new Date(a.interview_at).toLocaleString():"Ntibirashyirwaho"}</p><p><b>Aho interview izabera:</b> {a.interview_location||"Ntiharatangazwa"}</p>{a.interview_note&&<p><b>Amabwiriza:</b> {a.interview_note}</p>}</div>}</article>):<div className="empty">Nta kazi urasaba.</div>}</section>
  {open&&<div className="overlay"><form className="modal wide" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setOpen(false)}>✕</button><h2>Job Profile na CV</h2><div className="formGrid"><label>Impamyabumenyi<input name="qualification" value={form.qualification} onChange={c} required/></label><label>Imyaka y'uburambe<input name="years_experience" type="number" min="0" value={form.years_experience} onChange={c} required/></label><label>Uturere ushaka gukoreramo<input name="preferred_districts" value={form.preferred_districts} onChange={c} placeholder="Gasabo, Kicukiro, Huye" required/></label><label>Ubwoko bw'akazi<select name="employment_type" value={form.employment_type} onChange={c}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></label><label>Igihe watangirira<input name="available_from" type="date" value={form.available_from} onChange={c}/></label><label>CV ya PDF<input type="file" accept="application/pdf,.pdf" onChange={e=>setCvFile(e.target.files?.[0]||null)} required={!jobProfile?.cv_path}/></label></div><button className="primary full" disabled={saving}>{saving?"Birimo kubikwa...":"Bika Job Profile"}</button></form></div>}
 </main>
}
function SchoolDashboard({profile}){
 const[school,setSchool]=useState(null),[vacancies,setVacancies]=useState([]),[applications,setApplications]=useState([]),[open,setOpen]=useState(false),[selectedVacancy,setSelectedVacancy]=useState("all"),[form,setForm]=useState({title:"",subject:"",teaching_level:"Primary",district:profile?.district||"",qualification:"",minimum_experience:0,employment_type:"Full-time",description:"",deadline:""}),[error,setError]=useState("");
 useEffect(()=>{load()},[]);
 async function load(){
  setError("");
  const{data:s,error:e}=await supabase.from("schools").select("*").eq("owner_id",profile.id).maybeSingle();
  if(e){setError(e.message);return}
  setSchool(s);
  if(!s)return;
  const{data:v,error:ve}=await supabase.from("job_vacancies").select("*").eq("school_id",s.id).order("created_at",{ascending:false});
  if(ve)setError(ve.message);else setVacancies(v||[]);
  const vacancyIds=(v||[]).map(x=>x.id);
  if(vacancyIds.length){
   const{data:a,error:ae}=await supabase.from("job_applications").select("*,profiles!applicant_id(full_name,email,phone,district,subject,teaching_level),job_vacancies!vacancy_id(title,subject,district)").in("vacancy_id",vacancyIds).order("created_at",{ascending:false});
   if(ae)setError(ae.message);else setApplications(a||[]);
  }else setApplications([]);
 }
 async function create(e){
  e.preventDefault();
  if(!school){setError("Banza ukore umwirondoro w'ikigo kandi Admin awemeze.");return}
  const{error}=await supabase.from("job_vacancies").insert({...form,school_id:school.id,status:"published"});
  if(error)setError(error.message);else{setOpen(false);load()}
 }
 async function scheduleInterview(application){
  const date=window.prompt("Andika itariki n'isaha muri ubu buryo: 2026-11-10 09:00");
  if(!date)return;
  const location=window.prompt("Andika aho interview izabera cyangwa Meeting link:")||"";
  const note=window.prompt("Andika amabwiriza y'inyongera, niba ahari:")||"";
  const{error}=await supabase.rpc("schedule_job_interview",{p_application_id:application.id,p_interview_at:new Date(date).toISOString(),p_location:location,p_note:note});
  if(error)setError(error.message);else load();
 }
 async function updateApplication(id,status){
  const{error}=await supabase.from("job_applications").update({status}).eq("id",id);
  if(error)setError(error.message);else load();
 }
 async function closeVacancy(id){
  const{error}=await supabase.from("job_vacancies").update({status:"closed"}).eq("id",id);
  if(error)setError(error.message);else load();
 }
 const c=e=>setForm({...form,[e.target.name]:e.target.value});
 const filtered=selectedVacancy==="all"?applications:applications.filter(a=>a.vacancy_id===selectedVacancy);
 return <main className="dashboard">
  <section className="welcome"><div><small>School Dashboard</small><h1>{school?.name||profile?.full_name}</h1><p>{school?.verification_status||"pending"}</p></div><button className="primary" disabled={school?.verification_status!=="verified"} onClick={()=>setOpen(true)}>+ Tangaza vacancy</button></section>
  {error&&<div className="warning">{error}</div>}
  <section className="metrics"><article><b>{vacancies.length}</b><span>Vacancies</span></article><article><b>{applications.length}</b><span>Applications</span></article><article><b>{applications.filter(x=>x.status==="interview").length}</b><span>Interviews</span></article></section>
  <h2>Vacancies z'ikigo</h2>
  <section className="list">{vacancies.length?vacancies.map(v=><article key={v.id}><div className="row"><div><h3>{v.title}</h3><p>{v.subject} · {v.district} · Deadline {v.deadline}</p></div><span className={`badge ${v.status==="published"?"verified":"pending"}`}>{v.status}</span></div>{v.status==="published"&&<button className="reject" onClick={()=>closeVacancy(v.id)}>Funga vacancy</button>}</article>):<div className="empty">Nta vacancy iratangazwa.</div>}</section>
  <section className="toolbar"><h2>Abasabye akazi</h2><select value={selectedVacancy} onChange={e=>setSelectedVacancy(e.target.value)}><option value="all">Vacancies zose</option>{vacancies.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></section>
  <section className="list">{filtered.length?filtered.map(a=><article key={a.id} className="applicationCard"><div className="row"><div><h3>{a.profiles?.full_name||"Applicant"}</h3><p>{a.profiles?.email} · {a.profiles?.phone||"Nta telefone"}</p></div><span className="badge pending">{a.status}</span></div><div className="adminGrid"><p><b>Vacancy:</b> {a.job_vacancies?.title}</p><p><b>Isomo:</b> {a.profiles?.subject||a.job_vacancies?.subject||"-"}</p><p><b>Akarere:</b> {a.profiles?.district||"-"}</p><p><b>Urwego:</b> {a.profiles?.teaching_level||"-"}</p></div>{a.cover_letter&&<div className="coverLetter"><b>Ubutumwa:</b><p>{a.cover_letter}</p></div>}<div className="applicationActions"><button className="outline" onClick={()=>updateApplication(a.id,"viewed")}>Viewed</button><button className="primary" onClick={()=>updateApplication(a.id,"shortlisted")}>Shortlist</button><button className="interview" onClick={()=>scheduleInterview(a)}>Tegura Interview</button><button className="approve" onClick={()=>updateApplication(a.id,"selected")}>Selected</button><button className="reject" onClick={()=>updateApplication(a.id,"rejected")}>Reject</button></div></article>):<div className="empty">Nta applications zirahari.</div>}</section>
  {open&&<div className="overlay"><form className="modal wide" onSubmit={create}><button type="button" className="close" onClick={()=>setOpen(false)}>✕</button><h2>Tangaza vacancy</h2><div className="formGrid"><label>Izina ry'umwanya<input name="title" value={form.title} onChange={c} required/></label><label>Isomo<input name="subject" value={form.subject} onChange={c} required/></label><label>Urwego<select name="teaching_level" value={form.teaching_level} onChange={c}>{["Nursery","Primary","Secondary","TVET"].map(x=><option key={x}>{x}</option>)}</select></label><label>Akarere<input name="district" value={form.district} onChange={c} required/></label><label>Impamyabumenyi<input name="qualification" value={form.qualification} onChange={c}/></label><label>Uburambe<input name="minimum_experience" type="number" min="0" value={form.minimum_experience} onChange={c}/></label><label>Ubwoko bw'akazi<input name="employment_type" value={form.employment_type} onChange={c}/></label><label>Deadline<input name="deadline" type="date" value={form.deadline} onChange={c} required/></label><label className="wideField">Ibisobanuro<textarea name="description" value={form.description} onChange={c} required/></label></div><button className="primary full">Tangaza</button></form></div>}
 </main>
}
function ChatModal({match,userId,messages,body,setBody,send,close,complete}){
 return <div className="overlay"><div className="modal wide chatModal"><button type="button" className="close" onClick={close}>✕</button><h2>Ubutumwa na {match.other?.full_name||"uwo mwahujwe"}</h2><div className="chatList">{messages.length?messages.map(m=><div key={m.id} className={`bubble ${m.sender_id===userId?"mine":"theirs"}`}><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small></div>):<div className="empty">Nta butumwa burimo. Tangira ikiganiro.</div>}</div><form onSubmit={send} className="chatForm"><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Andika ubutumwa..." maxLength="3000" required/><button className="primary">Ohereza</button></form><button className="approve full" onClick={complete}>✓ Nabonye permutation</button></div></div>
}
createRoot(document.getElementById("root")).render(<App/>);
