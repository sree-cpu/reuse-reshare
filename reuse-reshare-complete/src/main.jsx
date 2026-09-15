import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation
} from "react-router-dom";
import {
 Menu, X, Bell, UserCircle, Home as HomeIcon, Search, PlusCircle, AlertTriangle,
  Flag, MessageSquare, ShieldCheck, LogOut, HeartHandshake, Settings,
  PackageSearch, ClipboardList, CheckCircle2, XCircle, Trash2, Users,
  ChevronRight, MapPin, CalendarDays, Phone, RefreshCw
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

const LOCATIONS = [
  "Men's Hostel","Ganga","Cauvery","Yamuna","Ladies Hostel","GMSC",
  "Mechanical Workshop","Canteen","New Block","Main Block","IC Block",
  "EC Block","CS Block","Alumni Block","MH Ground","LH 2","Main Gate",
  "Football Ground","Volleyball Ground","Volleyball Court",
  "Basketball Court","Almaram"
];

const CATEGORIES = ["Stationery","Books","Electronics","Tools","Department","Other"];

function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [ready,setReady] = useState(false);
  const [mobileOpen,setMobileOpen] = useState(false);
  const [configError,setConfigError] = useState(!supabase);

  async function loadProfile(user) {
    if (!supabase || !user) { setProfile(null); return; }
    const {data,error} = await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if (error) console.error(error);
    setProfile(data || null);
  }

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({data}) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user);
      setReady(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange(async (_event,newSession) => {
      setSession(newSession);
      if (newSession?.user) await loadProfile(newSession.user);
      else setProfile(null);
    });
    return () => { alive=false; subscription.unsubscribe(); };
  },[]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null);
  }

  if (!ready) return <Loading/>;

  return (
    <BrowserRouter>
      {configError && <ConfigBanner/>}
      <div className="app-shell">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={()=>setMobileOpen(true)}><Menu/></button>
          <Link to="/" className="brand">
            <div className="brand-mark"><HeartHandshake size={25}/></div>
            <div><b>Reuse & Reshare</b><small>Campus Community</small></div>
          </Link>
          <div className="top-actions">
            {session && <Link to="/notifications" className="notification-top"><Bell size={21}/><UnreadDot/></Link>}
            {session ? (
              <Link to="/account" className="account-top"><UserCircle size={21}/><span>{profile?.name || "My Account"}</span></Link>
            ) : <Link className="signin-top" to="/login">Sign In</Link>}
          </div>
        </header>
        <div className="body-layout">
          <Sidebar open={mobileOpen} close={()=>setMobileOpen(false)} session={session} profile={profile} logout={logout}/>
          {mobileOpen && <div className="overlay" onClick={()=>setMobileOpen(false)}/>}
          <main className="main"><Routes>
            <Route path="/" element={<Home session={session} profile={profile}/>}/>
            <Route path="/login" element={<Login session={session} onProfile={loadProfile}/>}/>
            <Route path="/browse" element={<Guard session={session}><Browse/></Guard>}/>
            <Route path="/post" element={<Guard session={session}><Post profile={profile}/></Guard>}/>
            <Route path="/emergency" element={<Guard session={session}><Emergency/></Guard>}/>
            <Route path="/notifications" element={<Guard session={session}><Notifications/></Guard>}/>
            <Route path="/requests" element={<Guard session={session}><Requests/></Guard>}/>
            <Route path="/report" element={<Guard session={session}><Report/></Guard>}/>
            <Route path="/feedback" element={<Guard session={session}><Feedback/></Guard>}/>
            <Route path="/account" element={<Guard session={session}><Account profile={profile} refresh={()=>loadProfile(session?.user)}/></Guard>}/>
            <Route path="/admin" element={profile?.role==="admin" ? <Admin/> : <Denied/>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes></main>
        </div>
      </div>
    </BrowserRouter>
  );
}

function Sidebar({open,close,session,profile,logout}) {
  const links = [
   ["/","Home",HomeIcon],["/browse","Find Item",Search],
    ["/emergency","Emergency Items",AlertTriangle],["/notifications","Notifications",Bell],
    ["/requests","My Requests",ClipboardList],["/report","Raise a Flag",Flag],["/feedback","Feedback",MessageSquare]
  ];
  return <aside className={"sidebar "+(open?"open":"")}>
    <div className="side-head"><span>Navigation</span><button onClick={close}><X/></button></div>
    <nav>
      {links.map(([p,n,I])=><NavLink key={p} to={p} onClick={close} className={({isActive})=>"side-link "+(isActive?"active":"")}><I size={19}/><span>{n}</span><ChevronRight size={14}/></NavLink>)}
      {session && <NavLink to="/account" onClick={close} className="side-link"><UserCircle size={19}/><span>My Account</span><ChevronRight size={14}/></NavLink>}
      {profile?.role==="admin" && <NavLink to="/admin" onClick={close} className="side-link admin-side"><ShieldCheck size={19}/><span>Admin Moderation</span><ChevronRight size={14}/></NavLink>}
    </nav>
    <div className="side-bottom">
      {session ? <button className="side-link logout" onClick={logout}><LogOut size={19}/><span>Logout</span></button> :
      <Link to="/login" onClick={close} className="side-link"><UserCircle size={19}/><span>Sign In / Register</span><ChevronRight size={14}/></Link>}
    </div>
  </aside>
}

function UnreadDot(){ return <span className="unread-dot"/> }

function Loading(){ return <div className="loading"><div className="loading-logo"><HeartHandshake/></div><h2>Reuse & Reshare</h2><p>Loading...</p></div> }
function ConfigBanner(){ return <div className="config-banner">Supabase is not connected yet. Create the <b>.env</b> file using the values provided in the setup instructions.</div> }

function Home({session,profile}) {
  return <div className="page">
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">♻ SHARE • REUSE • CARE</div>
        <h1>Useful things deserve <span>a second life.</span></h1>
        <p>A trusted campus space to share, borrow, exchange, find and responsibly sell useful items between students and faculty.</p>
        <div className="hero-buttons">
          <Link to="/browse" className="btn primary"><Search size={18}/> Find an Item</Link>
          <Link to={session?"/post":"/login"} className="btn secondary"><PlusCircle size={18}/> Post an Item</Link>
        </div>
        <div className="hero-points"><span>✓ Campus locations</span><span>✓ Admin moderation</span><span>✓ Request notifications</span></div>
      </div>
      <div className="hero-visual">
        <div className="floating-card card-a"><PackageSearch/><b>Find what you need</b><small>Books • Tools • Electronics</small></div>
        <div className="hero-circle"><HeartHandshake size={92}/></div>
        <div className="floating-card card-b"><ShieldCheck/><b>Safer sharing</b><small>Community + moderation</small></div>
      </div>
    </section>
    <section className="stats">
      <div><strong>6+</strong><span>Item categories</span></div><div><strong>22</strong><span>Campus locations</span></div>
      <div><strong>24/7</strong><span>Community access</span></div><div><strong>1</strong><span>Shared purpose</span></div>
    </section>
    <section className="section">
      <SectionTitle eyebrow="HOW IT WORKS" title={profile?`Welcome back, ${profile.name || "member"}!`:"Share more. Waste less."} text="Three simple steps make campus sharing easier."/>
      <div className="steps"><Step n="01" icon={<Search/>} title="Find" text="Search items posted by students and faculty."/><Step n="02" icon={<PlusCircle/>} title="Share" text="Post books, tools, electronics, stationery or project materials."/><Step n="03" icon={<HeartHandshake/>} title="Connect" text="Request an item and coordinate a campus meeting." /></div>
    </section>
    <section className="section callout"><div><span className="eyebrow">BUILT FOR CAMPUS</span><h2>From one department to another.</h2><p>Extra tools, papers, components and project materials can find a new user instead of sitting unused.</p></div><Link to={session?"/post":"/login"} className="btn primary">Start Sharing <ChevronRight size={18}/></Link></section>
  </div>
}
function Step({n,icon,title,text}){return <div className="step"><span>{n}</span><div className="step-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>}

function Login({session,onProfile}) {
  const nav=useNavigate(); const [mode,setMode]=useState("signin"); const [role,setRole]=useState("student");
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [department,setDepartment]=useState("");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
  useEffect(()=>{if(session) nav("/")},[session,nav]);
  async function submit(e){
    e.preventDefault(); if(!supabase){setMsg("Supabase is not connected. Please complete the .env setup.");return}
    setBusy(true);setMsg("");
    if(mode==="signup"){
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name,phone,department,role}}});
      if(error) setMsg(error.message);
      else { setMsg(data.session?"Account created successfully.":"Account created. Check your email if email confirmation is enabled."); setMode("signin"); }
    } else {
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error) setMsg(error.message);
      else { await onProfile(data.user); nav("/"); }
    }
    setBusy(false);
  }
  return <div className="auth-wrap"><div className="auth-card">
    <div className="auth-symbol"><HeartHandshake/></div><h1>{mode==="signin"?"Welcome back":"Join the campus community"}</h1>
    <p>{mode==="signin"?"Sign in to your Reuse & Reshare account.":"Create one account with your email."}</p>
    <div className="tabs"><button className={mode==="signin"?"selected":""} onClick={()=>setMode("signin")}>Sign In</button><button className={mode==="signup"?"selected":""} onClick={()=>setMode("signup")}>Register</button></div>
    <form onSubmit={submit}>
      {mode==="signup" && <><Field label="Full Name"><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Your full name"/></Field>
      <Field label="Phone Number"><input value={phone} onChange={e=>setPhone(e.target.value)} required pattern="[0-9+() -]{8,}" placeholder="Your phone number"/></Field>
      <Field label="Account Type"><select value={role} onChange={e=>setRole(e.target.value)}><option value="student">Student</option><option value="faculty">Faculty</option></select></Field>
      <Field label="Department (optional)"><input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Example: Mechanical Engineering"/></Field></>}
      <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@example.com"/></Field>
      <Field label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6" placeholder="At least 6 characters"/></Field>
      {msg && <div className="message">{msg}</div>}
      <button disabled={busy} className="btn primary full">{busy?"Please wait...":mode==="signin"?"Sign In":"Create Account"}</button>
    </form>
    <small className="security-note"><ShieldCheck size={15}/> One email can have one account. Admin accounts are assigned by the administrator.</small>
  </div></div>
}

function Browse(){
  const [items,setItems]=useState([]); const [q,setQ]=useState(""); const [cat,setCat]=useState("All"); const [selected,setSelected]=useState(null);
  async function load(){const {data,error}=await supabase.from("items").select("*").eq("status","active").order("created_at",{ascending:false});if(error) alert(error.message);setItems(data||[])}
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>items.filter(x=>(cat==="All"||x.category===cat)&&((x.item_name+" "+x.description).toLowerCase().includes(q.toLowerCase()))),[items,q,cat]);
  async function request(item){const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("item_requests").insert({item_id:item.id,requester_id:user.id,message:"I am interested in this item."});alert(error?error.message:"Request sent. The owner will receive a notification.");if(!error)setSelected(null)}
  return <div className="page"><SectionTitle eyebrow="CAMPUS MARKETPLACE" title="Find an Item" text="Search what you need and request it from the owner."/>
    <div className="toolbar"><div className="search-input"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search books, tools, electronics..."/></div><button className="refresh" onClick={load}><RefreshCw size={18}/> Refresh</button></div>
    <div className="chips"><button className={cat==="All"?"chip active":"chip"} onClick={()=>setCat("All")}>All</button>{CATEGORIES.map(c=><button key={c} className={cat===c?"chip active":"chip"} onClick={()=>setCat(c)}>{c}</button>)}</div>
    <div className="item-grid">{filtered.map(item=><ItemCard key={item.id} item={item} open={()=>setSelected(item)}/>)}</div>
    {!filtered.length && <Empty icon={<PackageSearch/>} title="No items found" text="Try a different search or category."/>}
    {selected && <Modal close={()=>setSelected(null)}><div className="modal-item">{selected.image_url?<img src={selected.image_url} alt=""/>:<div className="modal-image">♻</div>}<div><span className="tag">{selected.category}</span><h2>{selected.item_name}</h2><p>{selected.description}</p><div className="detail-list"><span><HeartHandshake/> {selected.type}</span><span><MapPin/> {selected.location}</span>{selected.meeting_date&&<span><CalendarDays/> {selected.meeting_date} {selected.meeting_time||""}</span>}</div><button className="btn primary full" onClick={()=>request(selected)}>Request this item</button></div></div></Modal>}
  </div>
}
function ItemCard({item,open}){return <article className="item-card">{item.image_url?<img src={item.image_url} alt={item.item_name}/>:<div className="item-placeholder"><PackageSearch size={42}/></div>}<div className="item-body"><span className="tag">{item.category}</span><h3>{item.item_name}</h3><p>{item.description}</p><div className="item-info"><span>{item.type}</span><span><MapPin size={14}/> {item.location}</span></div><button className="btn outline full" onClick={open}>View & Request</button></div></article>}

function Post({profile}){
  const [f,setF]=useState({item_name:"",category:"Books",description:"",type:"Free/Give away",meeting_date:"",meeting_time:"",location:"Main Block",contact_phone:profile?.phone||""});
  const [file,setFile]=useState(null);const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);
  function set(k,v){setF(x=>({...x,[k]:v}))}
  async function submit(e){e.preventDefault();setBusy(true);setMsg("");const {data:{user}}=await supabase.auth.getUser();let image_url=null;
    if(file){if(file.size>5*1024*1024){setMsg("Image must be 5 MB or smaller.");setBusy(false);return}const ext=file.name.split(".").pop().toLowerCase();if(!["jpg","jpeg","png","webp"].includes(ext)){setMsg("Use JPG, JPEG, PNG or WEBP.");setBusy(false);return}const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from("item-images").upload(path,file);if(error){setMsg(error.message);setBusy(false);return}image_url=supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl}
    const {error}=await supabase.from("items").insert({...f,owner_id:user.id,image_url});setMsg(error?error.message:"Item posted successfully.");if(!error)setF(x=>({...x,item_name:"",description:"",meeting_date:"",meeting_time:""}));setFile(null);setBusy(false)}
  return <div className="page narrow"><SectionTitle eyebrow="SHARE SOMETHING USEFUL" title="Post an Item" text="Tell the campus community what you can share."/><form className="form-card" onSubmit={submit}>
    <Field label="Photo (JPG, PNG or WEBP — max 5 MB)"><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></Field>
    <Field label="Item Name"><input value={f.item_name} onChange={e=>set("item_name",e.target.value)} required placeholder="Example: Drawing instruments"/></Field>
    <Field label="Category"><select value={f.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Description"><textarea value={f.description} onChange={e=>set("description",e.target.value)} required rows="5" placeholder="Condition, size, important details..."/></Field>
    <Field label="Type"><select value={f.type} onChange={e=>set("type",e.target.value)}><option>Free/Give away</option><option>Borrow</option><option>Exchange</option><option>Sell</option></select></Field>
    <div className="two"><Field label="Meeting Date"><input type="date" value={f.meeting_date} onChange={e=>set("meeting_date",e.target.value)}/></Field><Field label="Meeting Time"><input type="time" value={f.meeting_time} onChange={e=>set("meeting_time",e.target.value)}/></Field></div>
   <Field label="Campus Location">
  <select
    value={LOCATIONS.includes(f.location) ? f.location : "Custom Location"}
    onChange={e => set("location", e.target.value === "Custom Location" ? "" : e.target.value)}
  >
    {LOCATIONS.map(x => <option key={x}>{x}</option>)}
    <option>Custom Location</option>
  </select>
</Field>

{!LOCATIONS.includes(f.location) && (
  <Field label="Enter Custom Location">
    <input
      value={f.location}
      onChange={e => set("location", e.target.value)}
      required
      placeholder="Example: Near Mechanical Workshop Gate"
    />
  </Field>
)}
    <Field label="Contact Phone"><input value={f.contact_phone} onChange={e=>set("contact_phone",e.target.value)} required placeholder="Phone number"/></Field>
    {msg&&<div className="message">{msg}</div>}<button className="btn primary full" disabled={busy}>{busy?"Posting...":"Post Item"}</button>
  </form></div>
}

function Emergency(){
  const [kind,setKind]=useState("Found");const [title,setTitle]=useState("");const [desc,setDesc]=useState("");const [loc,setLoc]=useState("Main Gate");const [phone,setPhone]=useState("");const [posts,setPosts]=useState([]);const [msg,setMsg]=useState("");
  async function load(){const {data}=await supabase.from("emergency_posts").select("*").eq("status","active").order("created_at",{ascending:false});setPosts(data||[])}
  useEffect(()=>{load()},[]);
  async function submit(e){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("emergency_posts").insert({user_id:user.id,kind,title,description:desc,location:loc,contact_phone:phone});setMsg(error?error.message:"Emergency post published.");if(!error){setTitle("");setDesc("");await load()}}
  return <div className="page"><SectionTitle eyebrow="URGENT CAMPUS HELP" title="Emergency Items" text="Lost or found keys, IDs, phones, wallets, documents and other urgent items."/>
    <div className="emergency-layout"><form className="form-card" onSubmit={submit}><Field label="Type"><select value={kind} onChange={e=>setKind(e.target.value)}><option>Lost</option><option>Found</option><option>Urgent</option></select></Field><Field label="Title"><input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Example: Found ID card"/></Field><Field label="Details"><textarea value={desc} onChange={e=>setDesc(e.target.value)} required rows="5"/></Field><Field label="Location"><select value={loc} onChange={e=>setLoc(e.target.value)}>{LOCATIONS.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Contact Phone (optional)"><input value={phone} onChange={e=>setPhone(e.target.value)}/></Field>{msg&&<div className="message">{msg}</div>}<button className="btn primary full">Publish Emergency Post</button></form>
    <div><h2 className="subhead">Active alerts</h2>{posts.map(p=><div className="em-card" key={p.id}><span className="tag danger">{p.kind}</span><h3>{p.title}</h3><p>{p.description}</p><small><MapPin size={14}/> {p.location}{p.contact_phone&&<> • <Phone size={14}/> {p.contact_phone}</>}</small></div>)}{!posts.length&&<Empty icon={<AlertTriangle/>} title="No active alerts" text="Emergency posts will appear here."/>}</div></div>
  </div>
}

function Notifications(){
  const [list,setList]=useState([]);
  async function load(){const {data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false});setList(data||[])}
  useEffect(()=>{load()},[]);
  async function read(id){await supabase.from("notifications").update({is_read:true}).eq("id",id);load()}
  return <div className="page"><SectionTitle eyebrow="STAY UPDATED" title="Notifications" text="Requests, decisions and important account updates."/><div className="notification-list">{list.map(n=><button key={n.id} onClick={()=>read(n.id)} className={"notification-card "+(!n.is_read?"unread":"")}><div className="notice-icon"><Bell/></div><div><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString()}</small></div></button>)}</div>{!list.length&&<Empty icon={<Bell/>} title="You're all caught up" text="New notifications will appear here."/>}</div>
}

function Requests(){
  const [incoming,setIncoming]=useState([]);const [mine,setMine]=useState([]);
  async function load(){const {data:{user}}=await supabase.auth.getUser();const {data:i}=await supabase.from("item_requests").select("*, items!inner(item_name,owner_id)").eq("items.owner_id",user.id).order("created_at",{ascending:false});const {data:m}=await supabase.from("item_requests").select("*, items(item_name)").eq("requester_id",user.id).order("created_at",{ascending:false});setIncoming(i||[]);setMine(m||[])}
  useEffect(()=>{load()},[]);
  async function decide(id,status){const {error}=await supabase.from("item_requests").update({status}).eq("id",id);if(error)alert(error.message);else load()}
  return <div className="page"><SectionTitle eyebrow="YOUR ACTIVITY" title="Requests" text="Manage requests for your items and see the requests you have made."/>
    <div className="request-section"><h2>Requests for my items</h2>{incoming.map(r=><div className="request-card" key={r.id}><div><b>{r.items?.item_name}</b><p>{r.message||"No message."}</p><span className={"status "+r.status}>{r.status}</span></div>{r.status==="pending"&&<div className="request-actions"><button className="btn accept" onClick={()=>decide(r.id,"accepted")}><CheckCircle2/> Accept</button><button className="btn reject" onClick={()=>decide(r.id,"rejected")}><XCircle/> Reject</button></div>}</div>)}{!incoming.length&&<p className="muted">No incoming requests yet.</p>}</div>
    <div className="request-section"><h2>My requests</h2>{mine.map(r=><div className="request-card" key={r.id}><div><b>{r.items?.item_name}</b><p>Your request status</p><span className={"status "+r.status}>{r.status}</span></div></div>)}{!mine.length&&<p className="muted">You haven't requested anything yet.</p>}</div>
  </div>
}

function Report(){
  const [cat,setCat]=useState("Nuisance");const [desc,setDesc]=useState("");const [msg,setMsg]=useState("");
  async function submit(e){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("flags").insert({reporter_id:user.id,category:cat,description:desc});setMsg(error?error.message:"Flag submitted to admin for review.");if(!error)setDesc("")}
  return <div className="page narrow"><SectionTitle eyebrow="COMMUNITY SAFETY" title="Raise a Flag" text="Report scams, prohibited items, stolen property, harassment or nuisance. Admin will review it."/><form className="form-card"><Field label="Reason"><select value={cat} onChange={e=>setCat(e.target.value)}><option>Nuisance</option><option>Illegal / Prohibited Item</option><option>Scam / Fraud</option><option>Stolen Property</option><option>Dangerous Activity</option><option>Harassment / Abuse</option><option>Spam / Nuisance</option><option>Other</option></select></Field><Field label="Details"><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows="7" required placeholder="Explain what happened..."/></Field>{msg&&<div className="message">{msg}</div>}<button className="btn primary full" onClick={submit}>Submit Flag</button></form></div>
}

function Feedback(){
  const [rating,setRating]=useState(5);const [text,setText]=useState("");const [msg,setMsg]=useState("");
  async function submit(e){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("feedback").insert({user_id:user.id,rating,message:text});setMsg(error?error.message:"Thank you for your feedback!");if(!error)setText("")}
  return <div className="page narrow"><SectionTitle eyebrow="HELP US IMPROVE" title="Feedback" text="Tell us what works well and what should be improved."/><form className="form-card"><Field label="Rating"><select value={rating} onChange={e=>setRating(Number(e.target.value))}><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Very good</option><option value="3">★★★ Good</option><option value="2">★★ Needs improvement</option><option value="1">★ Poor</option></select></Field><Field label="Feedback"><textarea value={text} onChange={e=>setText(e.target.value)} rows="7" required placeholder="Your feedback..."/></Field>{msg&&<div className="message">{msg}</div>}<button className="btn primary full" onClick={submit}>Submit Feedback</button></form></div>
}

function Account({profile,refresh}){
  const [name,setName]=useState(profile?.name||"");
  const [phone,setPhone]=useState(profile?.phone||"");
  const [dept,setDept]=useState(profile?.department||"");
  const [photo,setPhoto]=useState(profile?.avatar_url||"");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  async function save(){
    setBusy(true);
    setMsg("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setMsg("Please sign in again.");
      setBusy(false);
      return;
    }

    let avatar_url=photo;

    const file=document.getElementById("profile-photo-input")?.files?.[0];

    if(file){
      if(file.size>5*1024*1024){
        setMsg("Profile photo must be 5 MB or smaller.");
        setBusy(false);
        return;
      }

      const ext=file.name.split(".").pop().toLowerCase();

      if(!["jpg","jpeg","png","webp"].includes(ext)){
        setMsg("Use JPG, JPEG, PNG or WEBP.");
        setBusy(false);
        return;
      }

      const path=`${user.id}/profile.${ext}`;

      const {error:uploadError}=await supabase
        .storage
        .from("profile-photos")
        .upload(path,file,{upsert:true});

      if(uploadError){
        setMsg(uploadError.message);
        setBusy(false);
        return;
      }

      avatar_url=supabase
        .storage
        .from("profile-photos")
        .getPublicUrl(path)
        .data
        .publicUrl;
    }

    const {error}=await supabase
      .from("profiles")
      .update({
        name,
        phone,
        department:dept,
        avatar_url
      })
      .eq("id",user.id);

    setMsg(error?error.message:"Account details saved successfully.");

    if(!error){
      setPhoto(avatar_url);
      await refresh();
    }

    setBusy(false);
  }

  async function reset(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setMsg("Please sign in again.");
      return;
    }

    const {error}=await supabase.auth.resetPasswordForEmail(
      user.email,
      {redirectTo:window.location.origin+"/account"}
    );

    setMsg(
      error
        ? error.message
        : "Password reset email sent."
    );
  }

  return (
    <div className="page narrow">

      <SectionTitle
        eyebrow="YOUR PROFILE"
        title="My Account"
        text="View and edit your campus account."
      />

      <div className="account-card">

        <div className="profile-photo-section">

  {photo ? (
    <img
      src={photo}
      alt="Profile"
      className="profile-photo"
    />
  ) : (
    <div className="profile-photo-placeholder">
      <UserCircle size={70}/>
    </div>
  )}

  <label className="btn outline profile-upload">
    <UserCircle size={18}/>
    Choose Profile Photo

    <input
      id="profile-photo-input"
      type="file"
      accept=".jpg,.jpeg,.png,.webp"
      hidden
      onChange={e => {
        const file = e.target.files?.[0];

        if (file) {
          const previewUrl = URL.createObjectURL(file);
          setPhoto(previewUrl);
          setMsg(`Selected: ${file.name}`);
        }
      }}
    />
  </label>

  <small>JPG, PNG or WEBP • Maximum 5 MB</small>

</div>

        <span className="role-badge">
          {profile?.role==="admin"
            ? "Administrator"
            : profile?.role==="faculty"
            ? "Faculty"
            : "Student"}
        </span>

        <Field label="Name">
          <input
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>

        <Field label="Registered Email">
          <input
            value={profile?.email||""}
            disabled
          />
        </Field>

        <Field label="Phone Number">
          <input
            value={phone}
            onChange={e=>setPhone(e.target.value)}
            placeholder="Your phone number"
          />
        </Field>

        <Field label="Department">
          <input
            value={dept}
            onChange={e=>setDept(e.target.value)}
            placeholder="Example: Mechanical Engineering"
          />
        </Field>

        <div className="account-info">
          <div>
            <span>Account Type</span>
            <b>
              {profile?.role==="admin"
                ? "Administrator"
                : profile?.role==="faculty"
                ? "Faculty"
                : "Student"}
            </b>
          </div>

          <div>
            <span>Login Email</span>
            <b>{profile?.email||"Not available"}</b>
          </div>

          <div>
            <span>Phone</span>
            <b>{phone||"Not added"}</b>
          </div>

          <div>
            <span>Department</span>
            <b>{dept||"Not added"}</b>
          </div>
        </div>

        {msg && (
          <div className="message">
            {msg}
          </div>
        )}

        <button
          className="btn primary full"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Saving..." : "Save Account Details"}
        </button>

        <button
          className="btn outline full"
          onClick={reset}
        >
          Send Password Reset Email
        </button>

      </div>
    </div>
  );
}

function Admin(){
  const [flags,setFlags]=useState([]);const [items,setItems]=useState([]);const [users,setUsers]=useState([]);const [feedback,setFeedback]=useState([]);
  async function load(){const [a,b,c,d]=await Promise.all([supabase.from("flags").select("*").order("created_at",{ascending:false}),supabase.from("items").select("*").eq("status","active").order("created_at",{ascending:false}),supabase.from("profiles").select("*").order("created_at",{ascending:false}),supabase.from("feedback").select("*").order("created_at",{ascending:false})]);setFlags(a.data||[]);setItems(b.data||[]);setUsers(c.data||[]);setFeedback(d.data||[])}
  useEffect(()=>{load()},[]);
  async function updateFlag(id,status){await supabase.from("flags").update({status}).eq("id",id);load()}
  async function remove(id){if(!confirm("Remove this post?"))return;await supabase.from("items").update({status:"removed"}).eq("id",id);load()}
  async function suspend(id,status){await supabase.from("profiles").update({status}).eq("id",id);load()}
  return <div className="page"><SectionTitle eyebrow="ADMIN CONTROL CENTER" title="Admin Moderation" text="Review reports, remove posts and manage accounts."/>
    <AdminSection title="Open / recent flags">{flags.map(f=><div className="admin-row" key={f.id}><div><span className="tag danger">{f.category}</span><p>{f.description}</p><small>Status: {f.status}</small></div><div className="admin-actions">{f.status==="open"&&<><button className="btn accept" onClick={()=>updateFlag(f.id,"resolved")}>Resolve</button><button className="btn outline" onClick={()=>updateFlag(f.id,"dismissed")}>No Action</button></>}</div></div>)}{!flags.length&&<p className="muted">No flags.</p>}</AdminSection>
    <AdminSection title="Active posts">{items.map(i=><div className="admin-row" key={i.id}><div><b>{i.item_name}</b><p>{i.description}</p></div><button className="btn reject" onClick={()=>remove(i.id)}><Trash2/> Remove</button></div>)}{!items.length&&<p className="muted">No active posts.</p>}</AdminSection>
    <AdminSection title="Accounts">{users.map(u=><div className="admin-row" key={u.id}><div><b>{u.name||"Unnamed"} <span className="role-badge">{u.role}</span></b><p>{u.email} • {u.phone||"No phone"}</p></div>{u.role!=="admin"&&<button className={u.status==="active"?"btn reject":"btn accept"} onClick={()=>suspend(u.id,u.status==="active"?"suspended":"active")}>{u.status==="active"?"Suspend":"Restore"}</button>}</div>)}</AdminSection>
    <AdminSection title="Feedback">{feedback.map(f=><div className="admin-row" key={f.id}><div><b>{"★".repeat(f.rating)}{"☆".repeat(5-f.rating)}</b><p>{f.message}</p></div></div>)}{!feedback.length&&<p className="muted">No feedback yet.</p>}</AdminSection>
  </div>
}
function AdminSection({title,children}){return <section className="admin-section"><h2>{title}</h2>{children}</section>}

function Guard({session,children}){return session?children:<LoginRequired/>}
function LoginRequired(){return <div className="center"><div className="simple-card"><ShieldCheck size={45}/><h2>Sign in required</h2><p>Please sign in to use this feature.</p><Link to="/login" className="btn primary">Sign In</Link></div></div>}
function Denied(){return <div className="center"><div className="simple-card"><ShieldCheck size={45}/><h2>Admin access only</h2><p>This area is restricted to the administrator.</p><Link to="/" className="btn primary">Go Home</Link></div></div>}
function NotFound(){return <div className="center"><div className="simple-card"><h2>Page not found</h2><Link to="/" className="btn primary">Go Home</Link></div></div>}
function Modal({close,children}){return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X/></button>{children}</div></div>}
function Empty({icon,title,text}){return <div className="empty"><div>{icon}</div><h3>{title}</h3><p>{text}</p></div>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function SectionTitle({eyebrow,title,text}){return <div className="section-title"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
