import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const roleLabels = {
  teacher: "Umwarimu ushaka permutation",
  job_seeker: "Umwarimu ushaka akazi",
  school: "Ikigo cy'amashuri",
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("login");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "teacher" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return setProfile(null);
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data, error }) => error ? setError(error.message) : setProfile(data));
  }, [session]);

  const change = e => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError(""); setNotice("");
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: form.full_name.trim(), role: form.role } }
        });
        if (error) throw error;
        if (data.session) { setOpen(false); setNotice("Konti yakozwe neza."); }
        else setNotice("Konti yakozwe. Reba email yawe wemeze konti.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        setOpen(false); setNotice("Winjiye muri konti neza.");
      }
    } catch (e) { setError(e.message || "Habaye ikibazo."); }
    finally { setLoading(false); }
  }

  async function logout() { await supabase.auth.signOut(); setNotice("Wasohotse muri konti."); }

  if (loading && !session) return <div className="loading">Mwarimu Connect irimo gufunguka...</div>;

  return <div>
    <header><div className="brand"><span>↔</span>Mwarimu Connect</div><nav><a href="#home">Ahabanza</a><a href="#services">Serivisi</a></nav>{session?<button className="outline" onClick={logout}>Sohoka</button>:<button className="primary" onClick={()=>{setMode("login");setOpen(true)}}>Injira</button>}</header>
    {notice&&<div className="notice ok">✓ {notice}</div>}{error&&<div className="notice bad">⚠ {error}</div>}
    {!session ? <main>
      <section className="hero" id="home"><div><small>Urubuga rw'abarimu bo mu Rwanda</small><h1>Permutation, akazi n'amahirwe y'abarimu hamwe.</h1><p>Huza n'abarimu bashaka guhana aho bakorera, ushake akazi ko kwigisha cyangwa ubone umwarimu ukenewe n'ikigo.</p><div className="actions"><button className="primary" onClick={()=>{setMode("register");setOpen(true)}}>Fungura konti →</button><button className="outline" onClick={()=>{setMode("login");setOpen(true)}}>Injira</button></div></div><div className="art">👩🏾‍🏫 <b>↔</b> 👨🏾‍🏫</div></section>
      <section className="services" id="services"><article><h3>⇄ Permutation</h3><p>Shaka umwarimu ufite icyifuzo gihuye n'icyawe.</p></article><article><h3>💼 Akazi</h3><p>Reba imyanya y'akazi yo kwigisha kandi uyisabe.</p></article><article><h3>🏫 Ibigo</h3><p>Ibigo bitangaze vacancies kandi bicunge applications.</p></article></section>
    </main> : <main className="dashboard"><section className="welcome"><div><small>Murakaza neza</small><h1>{profile?.full_name || session.user.email}</h1><p>{roleLabels[profile?.role] || profile?.role || "Umukoresha"}</p></div><span className="badge">{profile?.verification_status === "verified" ? "✓ Konti yemejwe" : "Iri gutegereza kwemezwa"}</span></section><section className="metrics"><article><b>0</b><span>Ibyifuzo</span></article><article><b>0</b><span>Matches</span></article><article><b>0</b><span>Ubutumwa</span></article></section></main>}
    <footer>© 2026 Mwarimu Connect</footer>
    {open&&<div className="overlay"><form className="modal" onSubmit={submit}><button type="button" className="close" onClick={()=>setOpen(false)}>✕</button><h2>{mode==="register"?"Fungura konti":"Injira muri konti"}</h2>{mode==="register"&&<><label>Amazina yose<input name="full_name" value={form.full_name} onChange={change} required/></label><label>Ubwoko bwa konti<select name="role" value={form.role} onChange={change}>{Object.entries(roleLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}<label>Email<input name="email" type="email" value={form.email} onChange={change} required/></label><label>Ijambo ry'ibanga<input name="password" type="password" minLength="8" value={form.password} onChange={change} required/></label><button className="primary full" disabled={loading}>{loading?"Tegereza...":mode==="register"?"Kora konti":"Injira"}</button><p className="switch">{mode==="register"?"Usanzwe ufite konti?":"Nta konti ufite?"} <button type="button" className="link" onClick={()=>setMode(mode==="register"?"login":"register")}>{mode==="register"?"Injira":"Fungura konti"}</button></p></form></div>}
  </div>;
}
