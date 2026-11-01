import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const roleLabels = {
  teacher: "Umwarimu ushaka permutation",
  job_seeker: "Umwarimu ushaka akazi",
  school: "Ikigo cy'amashuri",
};
const districts = ["Bugesera","Burera","Gakenke","Gasabo","Gatsibo","Gicumbi","Gisagara","Huye","Kamonyi","Karongi","Kayonza","Kicukiro","Kirehe","Muhanga","Musanze","Ngoma","Ngororero","Nyabihu","Nyagatare","Nyamagabe","Nyamasheke","Nyanza","Nyarugenge","Nyaruguru","Rubavu","Ruhango","Rulindo","Rusizi","Rutsiro","Rwamagana"];
const subjects = ["Mathematics","English","Ikinyarwanda","French","Biology","Chemistry","Physics","Geography","History","ICT","Other"];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("login");
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "", role: "teacher" });
  const [profileForm, setProfileForm] = useState({ phone:"", district:"", sector:"", school_name:"", subject:"", teaching_level:"" });
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [documentFile, setDocumentFile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next || null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (!session?.user) { setProfile(null); return; } loadProfile(session.user.id); }, [session]);

  async function loadProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) setError(error.message); else {
      setProfile(data);
      setProfileForm({ phone:data.phone||"", district:data.district||"", sector:data.sector||"", school_name:data.school_name||"", subject:data.subject||"", teaching_level:data.teaching_level||"" });
    }
  }

  const authChange = e => setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  const profileChange = e => setProfileForm({ ...profileForm, [e.target.name]: e.target.value });

  async function submitAuth(e) {
    e.preventDefault(); setLoading(true); setError(""); setNotice("");
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email:authForm.email.trim(), password:authForm.password, options:{ emailRedirectTo:window.location.origin, data:{ full_name:authForm.full_name.trim(), role:authForm.role } } });
        if (error) throw error;
        if (data.session) { setOpen(false); setNotice("Konti yakozwe neza."); } else setNotice("Konti yakozwe. Reba email yawe wemeze konti.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email:authForm.email.trim(), password:authForm.password });
        if (error) throw error;
        setOpen(false); setNotice("Winjiye muri konti neza.");
      }
    } catch (e) { setError(e.message || "Habaye ikibazo."); } finally { setLoading(false); }
  }

  async function saveProfile(e) {
    e.preventDefault(); setLoading(true); setError(""); setNotice("");
    try {
      const userId = session.user.id;
      const { error: updateError } = await supabase.from("profiles").update(profileForm).eq("id", userId);
      if (updateError) throw updateError;

      let documentPath = null;
      if (documentFile) {
        const ext = documentFile.name.split(".").pop().toLowerCase();
        documentPath = `${userId}/teacher-proof-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("verification-documents").upload(documentPath, documentFile, { upsert:false });
        if (uploadError) throw uploadError;
      }

      if (registrationNumber || documentPath) {
        const { error: verificationError } = await supabase.from("teacher_verifications").insert({ teacher_id:userId, registration_number:registrationNumber || null, document_path:documentPath, status:"pending" });
        if (verificationError && !verificationError.message.toLowerCase().includes("duplicate")) throw verificationError;
      }

      await loadProfile(userId);
      setShowProfile(false); setNotice("Umwirondoro wabitswe. Ubu utegereje kugenzurwa na Admin.");
    } catch (e) { setError(e.message || "Umwirondoro ntiwabitswe."); } finally { setLoading(false); }
  }

  async function logout() { await supabase.auth.signOut(); setNotice("Wasohotse muri konti."); }
  if (loading && !session) return <div className="loading">Mwarimu Connect irimo gufunguka...</div>;

  return <div>
    <header><div className="brand"><span>↔</span>Mwarimu Connect</div><nav><a href="#home">Ahabanza</a><a href="#services">Serivisi</a></nav>{session?<button className="outline" onClick={logout}>Sohoka</button>:<button className="primary" onClick={()=>{setMode("login");setOpen(true)}}>Injira</button>}</header>
    {notice&&<div className="notice ok">✓ {notice}</div>}{error&&<div className="notice bad">⚠ {error}</div>}
    {!session ? <main><section className="hero" id="home"><div><small>Urubuga rw'abarimu bo mu Rwanda</small><h1>Permutation, akazi n'amahirwe y'abarimu hamwe.</h1><p>Huza n'abarimu bashaka guhana aho bakorera, ushake akazi ko kwigisha cyangwa ubone umwarimu ukenewe n'ikigo.</p><div className="actions"><button className="primary" onClick={()=>{setMode("register");setOpen(true)}}>Fungura konti →</button><button className="outline" onClick={()=>{setMode("login");setOpen(true)}}>Injira</button></div></div><div className="art">👩🏾‍🏫 <b>↔</b> 👨🏾‍🏫</div></section><section className="services" id="services"><article><h3>⇄ Permutation</h3><p>Shaka umwarimu ufite icyifuzo gihuye n'icyawe.</p></article><article><h3>💼 Akazi</h3><p>Reba imyanya y'akazi yo kwigisha kandi uyisabe.</p></article><article><h3>🏫 Ibigo</h3><p>Ibigo bitangaze vacancies kandi bicunge applications.</p></article></section></main> :
      <main className="dashboard"><section className="welcome"><div><small>Murakaza neza</small><h1>{profile?.full_name || session.user.email}</h1><p>{roleLabels[profile?.role] || profile?.role || "Umukoresha"}</p></div><span className={`badge ${profile?.verification_status==="verified"?"verified":"pending"}`}>{profile?.verification_status==="verified"?"✓ Konti yemejwe":"Iri gutegereza kwemezwa"}</span></section><section className="metrics"><article><b>0</b><span>Ibyifuzo</span></article><article><b>0</b><span>Matches</span></article><article><b>0</b><span>Ubutumwa</span></article></section><section className="dashboardGrid"><article><h2>Umwirondoro</h2><p><b>Telefone:</b> {profile?.phone||"Ntuzuye"}</p><p><b>Akarere:</b> {profile?.district||"Ntuzuye"}</p><p><b>Ikigo:</b> {profile?.school_name||"Ntuzuye"}</p><p><b>Isomo:</b> {profile?.subject||"Ntuzuye"}</p><p><b>Urwego:</b> {profile?.teaching_level||"Ntuzuye"}</p><button className="primary" onClick={()=>setShowProfile(true)}>Uzuza / Hindura umwirondoro</button></article><article><h2>Kwemeza konti</h2><p>Kohereza teacher registration number cyangwa icyemezo kimwe cy'akazi bituma Admin abasha kugenzura konti.</p><p className="hint">Accepted: PDF, JPG cyangwa PNG. Ntarengwa 5 MB.</p></article></section></main>}
    <footer>© 2026 Mwarimu Connect</footer>
    {open&&<div className="overlay"><form className="modal" onSubmit={submitAuth}><button type="button" className="close" onClick={()=>setOpen(false)}>✕</button><h2>{mode==="register"?"Fungura konti":"Injira muri konti"}</h2>{mode==="register"&&<><label>Amazina yose<input name="full_name" value={authForm.full_name} onChange={authChange} required/></label><label>Ubwoko bwa konti<select name="role" value={authForm.role} onChange={authChange}>{Object.entries(roleLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}<label>Email<input name="email" type="email" value={authForm.email} onChange={authChange} required/></label><label>Ijambo ry'ibanga<input name="password" type="password" minLength="8" value={authForm.password} onChange={authChange} required/></label><button className="primary full" disabled={loading}>{loading?"Tegereza...":mode==="register"?"Kora konti":"Injira"}</button><p className="switch">{mode==="register"?"Usanzwe ufite konti?":"Nta konti ufite?"} <button type="button" className="link" onClick={()=>setMode(mode==="register"?"login":"register")}>{mode==="register"?"Injira":"Fungura konti"}</button></p></form></div>}
    {showProfile&&<div className="overlay"><form className="modal wide" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setShowProfile(false)}>✕</button><h2>Uzuza umwirondoro</h2><div className="formGrid"><label>Nimero ya telefone<input name="phone" value={profileForm.phone} onChange={profileChange} placeholder="078..." required/></label><label>Akarere<select name="district" value={profileForm.district} onChange={profileChange} required><option value="">Hitamo</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label><label>Umurenge<input name="sector" value={profileForm.sector} onChange={profileChange} required/></label><label>Ikigo ukoreramo<input name="school_name" value={profileForm.school_name} onChange={profileChange} required/></label><label>Isomo<select name="subject" value={profileForm.subject} onChange={profileChange} required><option value="">Hitamo</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Urwego<select name="teaching_level" value={profileForm.teaching_level} onChange={profileChange} required><option value="">Hitamo</option>{["Nursery","Primary","Secondary","TVET"].map(x=><option key={x}>{x}</option>)}</select></label><label>Teacher registration number<input value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)}/></label><label>Icyemezo cy'akazi<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setDocumentFile(e.target.files?.[0]||null)}/></label></div><button className="primary full" disabled={loading}>{loading?"Birimo kubikwa...":"Bika kandi wohereze"}</button></form></div>}
  </div>;
}
