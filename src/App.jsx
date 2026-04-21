import { useState, useRef } from "react";
import { Search, FileText, BarChart2, Download, RefreshCw, MapPin, Building, Bookmark, CheckCircle, ExternalLink, Copy, Upload } from "lucide-react";

const BASE_PROFILE = `FORMATION: Licence 2 MIASHS, Université de Toulouse 2024-2026, niveau visé Bac+3/Bac+4 alternance.
COMPÉTENCES DEV: Java, Python, HTML/CSS, PHP, MySQL, Kotlin Android, JavaScript, Git/GitHub, MVC, Agile/Scrum, JIRA, Z-Wave/IoT, Domoticz, Raspberry Pi.
COMPÉTENCES DATA: Python/Pandas, SQL, Power BI, Matplotlib, Excel, statistiques, nettoyage données, visualisation.
PROJETS: (1) Smart Bus Stop IoT Z-Wave Raspberry Pi PHP MySQL supervision temps réel. (2) App web gestion bibliothèque SQL PHP auth. (3) Analyse chômage régional Python Pandas INSEE Matplotlib. (4) TipCalculator Kotlin Android Studio.
EXPÉRIENCES: Agent Logistique Chronopost/Geodis 2023. Employé Polyvalent Réception Montempô 2025.
LANGUES: Français natif, Anglais intermédiaire.`;

function safeParseJSON(text) {
  if (!text) return [];
  try {
    const s = text.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim();
    const i = s.indexOf("[");
    const j = s.lastIndexOf("]");
    if (i !== -1 && j !== -1 && j > i) return JSON.parse(s.slice(i, j+1));
  } catch(e) {}
  return [];
}

async function callClaude(messages, maxTokens=1000) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens: maxTokens, messages })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
}

// NOUVEAU : définition des sources avec couleurs et URL de recherche réelle
const SOURCES = [
  { name: "Indeed",                color: "#2164f3", bg: "rgba(33,100,243,.18)",  url: "https://fr.indeed.com/jobs?q=alternance+informatique" },
  { name: "Welcome to the Jungle", color: "#10b981", bg: "rgba(16,185,129,.18)", url: "https://www.welcometothejungle.com/fr/jobs?query=alternance+informatique" },
  { name: "LinkedIn",              color: "#0a66c2", bg: "rgba(10,102,194,.18)",  url: "https://www.linkedin.com/jobs/search/?keywords=alternance+informatique" },
  { name: "Alternance.gouv.fr",    color: "#e1000f", bg: "rgba(225,0,15,.18)",    url: "https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage?display=list&radius=30&romes=M1805,M1802" },
  { name: "HelloWork",             color: "#7c3aed", bg: "rgba(124,58,237,.18)",  url: "https://www.hellowork.com/fr-fr/emploi/recherche.html?k=alternance+informatique" },
];
const SOURCES_LIST = SOURCES.map(s => s.name);

// NOUVEAU : anciennetés de publication simulées (en jours)
const PUBLISHED_AGES = [1, 2, 3, 7, 14, 30];

// NOUVEAU : badge de source coloré
function SourceBadge({ source }) {
  const s = SOURCES.find(x => x.name === source) || SOURCES[0];
  return (
    <span style={{display:"inline-flex",alignItems:"center",padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:600,background:s.bg,color:s.color,border:`1px solid ${s.color}55`,whiteSpace:"nowrap"}}>
      {s.name}
    </span>
  );
}

// NOUVEAU : affichage humain de l ancienneté de publication
function formatAge(days) {
  if (!days) return "—";
  if (days <= 1) return "Aujourd hui";
  if (days <= 3) return `Il y a ${days}j`;
  if (days <= 7) return "Il y a 1 sem.";
  if (days <= 14) return "Il y a 2 sem.";
  return "Il y a 1 mois";
}

function ScorePill({ score }) {
  const s = Math.round(score);
  const cfg = s>=80 ? {cls:"emerald",lbl:"Top"} : s>=65 ? {cls:"blue",lbl:"Bon"} : s>=45 ? {cls:"amber",lbl:"Moyen"} : {cls:"red",lbl:"Faible"};
  const colors = {emerald:{bg:"rgba(6,95,70,.25)",border:"#065f46",text:"#6ee7b7"},blue:{bg:"rgba(37,99,235,.2)",border:"#1d4ed8",text:"#93c5fd"},amber:{bg:"rgba(180,83,9,.25)",border:"#92400e",text:"#fcd34d"},red:{bg:"rgba(185,28,28,.2)",border:"#991b1b",text:"#fca5a5"}};
  const c = colors[cfg.cls];
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:4,border:`1px solid ${c.border}`,background:c.bg,color:c.text,fontSize:11,fontFamily:"monospace",fontWeight:600}}>{s}% · {cfg.lbl}</span>;
}

function DomainBadge({ domain }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".04em",background:domain==="Data"?"rgba(147,51,234,.25)":"rgba(20,184,166,.2)",color:domain==="Data"?"#c084fc":"#5eead4"}}>{domain}</span>;
}

const STATUS_OPTS = ["À envoyer","Candidaté","En attente","Entretien","Accepté","Refusé"];

export default function App() {
  const [tab, setTab] = useState("search");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adaptedCV, setAdaptedCV] = useState("");
  const [cvLoading, setCvLoading] = useState(false);
  const [tracking, setTracking] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loc1, setLoc1] = useState("Toulouse");
  const [loc2, setLoc2] = useState("Paris / Île-de-France");

  // NOUVEAU : paramètres de recherche avancés
  const [searchType, setSearchType] = useState("Alternance informatique");
  const [keywords, setKeywords] = useState("");
  const [studyLevel, setStudyLevel] = useState("Indifférent");

  // NOUVEAU : filtres côté client sur les offres générées
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");

  // NOUVEAU : profil CV importé depuis .docx, sauvegardé dans localStorage
  const [importedProfile, setImportedProfile] = useState(() => localStorage.getItem("importedProfile") || "");
  const cvFileRef = useRef(null);

  // NOUVEAU : état "lien copié" pour le feedback visuel
  const [copied, setCopied] = useState(null);

  // Profil actif : CV importé si disponible, sinon profil MIASHS par défaut
  const activeProfile = importedProfile || BASE_PROFILE;

  async function handleSearch() {
    setLoading(true); setError(""); setJobs([]); setSelected(null); setAdaptedCV("");
    try {
      setLoadingMsg("Génération des offres...");
      // NOUVEAU : injection du type, niveau et mots-clés dans le prompt
      const levelClause = studyLevel === "Indifférent" ? "niveaux Bac+2 à Bac+4" : `niveau ${studyLevel}`;
      const keywordsClause = keywords.trim() ? ` Inclure des offres avec compétences: ${keywords.trim()}.` : "";
      const jobsPrompt = `Génère 12 offres "${searchType}" informatique réalistes pour la France 2025-2026 dans les villes ${loc1} et ${loc2}, ${levelClause}. 6 offres domaine Dev (web/mobile/logiciel), 6 offres domaine Data (analyst/BI/scientist).${keywordsClause} Utilise des entreprises françaises connues: Capgemini, Sopra Steria, Airbus, CNES, SNCF, Météo-France, Aubay, CGI, Atos, Thales, Mairie de Toulouse, INSEE, La Poste, Crédit Agricole, Engie, Orange, Total, Renault, etc. Alterne les localisations entre ${loc1} et ${loc2}.

Réponds UNIQUEMENT avec le tableau JSON ci-dessous, AUCUN texte avant ou après, AUCUN backtick markdown:
[{"id":"1","title":"Développeur Web Full Stack","company":"Capgemini","location":"Toulouse","level":"Bac+3","domain":"Dev","description":"Intégration dans une équipe Agile pour développer des applications web en React et Node.js pour des clients grands comptes. Participation aux sprints, code reviews et déploiements CI/CD.","requirements":["JavaScript","React","SQL","Git","HTML/CSS","Agile"],"duration":"24 mois","url":"https://fr.indeed.com/jobs"},{"id":"2","title":"Data Analyst","company":"SNCF","location":"Paris","level":"Bac+4","domain":"Data","description":"Analyse des données de trafic ferroviaire et construction de dashboards Power BI. Automatisation de rapports Python/Pandas et présentation aux équipes métiers.","requirements":["Python","Pandas","SQL","Power BI","Excel","Statistiques"],"duration":"24 mois","url":"https://fr.indeed.com/jobs"}]
Génère exactement 12 offres dans ce format, ids de 1 à 12.`;

      const r1 = await callClaude([{role:"user",content:jobsPrompt}], 2500);
      const found = safeParseJSON(r1);
      if (!found.length) throw new Error("Format de réponse invalide. Réessaie dans quelques secondes.");

      setLoadingMsg("Scoring des offres selon ton profil...");
      const scorePrompt = `Score ces offres de 0 à 100 selon l adéquation avec ce profil étudiant MIASHS polyvalent Dev/Data:
${activeProfile}

Offres à scorer:
${JSON.stringify(found.map(j=>({id:j.id,title:j.title,domain:j.domain,level:j.level,requirements:j.requirements})))}

Réponds UNIQUEMENT avec le tableau JSON ci-dessous, AUCUN texte avant ou après, AUCUN backtick:
[{"id":"1","score":82,"reason":"Python + SQL requis correspondent aux projets data du profil"}]
Un objet par offre, score entre 0 et 100.`;

      const r2 = await callClaude([{role:"user",content:scorePrompt}], 1000);
      const scores = safeParseJSON(r2);

      // NOUVEAU : attribution aléatoire de la source et de l ancienneté de publication
      const scored = found.map(j => {
        const s = scores.find(sc => String(sc.id)===String(j.id));
        const source = SOURCES_LIST[Math.floor(Math.random() * SOURCES_LIST.length)];
        const publishedAge = PUBLISHED_AGES[Math.floor(Math.random() * PUBLISHED_AGES.length)];
        return {...j, score: Math.min(100,Math.max(0,s?.score??55)), reason: s?.reason??"", source, publishedAge};
      }).sort((a,b)=>b.score-a.score);

      setJobs(scored);
      setTab("results");
    } catch(e) {
      setError(e.message||"Erreur inconnue. Réessaie.");
    } finally {
      setLoading(false); setLoadingMsg("");
    }
  }

  async function handleAdaptCV(job) {
    setCvLoading(true); setAdaptedCV("");
    try {
      const r = await callClaude([{role:"user",content:`Génère un CV professionnel adapté pour ce poste. En français, structuré, prêt à l emploi. Commence DIRECTEMENT par le CV sans introduction.

PROFIL DE BASE:
${activeProfile}

POSTE CIBLE: ${job.title} | ${job.company} | ${job.location} | ${job.domain} | ${job.level} | ${job.duration}
Description: ${job.description}
Compétences requises: ${(job.requirements||[]).join(", ")}

Structure obligatoire: PROFIL PROFESSIONNEL · COMPÉTENCES CLÉS (les plus pertinentes en premier) · PROJETS PERTINENTS (2-3 max, adaptés au poste) · FORMATION · EXPÉRIENCES · LANGUES & OUTILS`}], 1000);
      setAdaptedCV(r);
    } catch(e) {
      setAdaptedCV("Erreur lors de la génération. Réessaie.");
    } finally {
      setCvLoading(false);
    }
  }

  // NOUVEAU : import .docx via mammoth.js chargé depuis CDN à la demande
  async function handleImportCV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!window.mammoth) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (text) {
        setImportedProfile(text);
        localStorage.setItem("importedProfile", text);
      }
    } catch(err) {
      alert("Impossible de lire le fichier .docx. Assure-toi qu il s agit d un fichier Word valide.");
    }
    e.target.value = "";
  }

  // NOUVEAU : export PDF via window.print()
  function downloadPDF() {
    if (!adaptedCV || !selected) return;
    const safe = adaptedCV.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>CV</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:32px auto;color:#1a1a2e;line-height:1.75;padding:0 24px}h1{font-size:18px}.meta{color:#475569;font-size:13px;margin-bottom:20px}pre{white-space:pre-wrap;font-size:13px;line-height:1.8}@media print{@page{margin:2cm}}</style>
</head><body><h1>CV – ${selected.title}</h1><div class="meta">${selected.company} · ${selected.location} · ${selected.level} · Score ${Math.round(selected.score)}%</div>
<pre>${safe}</pre><script>window.onload=function(){window.print();}<\/script></body></html>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"})), "_blank");
  }

  // NOUVEAU : export .doc compatible Word
  function downloadDoc() {
    if (!adaptedCV || !selected) return;
    const safe = adaptedCV.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>CV</title></head><body><pre style="font-family:Arial;font-size:12pt;line-height:1.8;">${safe}</pre></body></html>`;
    const blob = new Blob(['\ufeff', html], {type:'application/msword'});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `CV_${selected.title.replace(/\s+/g,"_")}_${selected.company.replace(/\s+/g,"_")}.doc`;
    a.click();
  }

  function downloadCV() {
    if (!adaptedCV||!selected) return;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>CV – ${selected.title}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:32px auto;color:#1a1a2e;line-height:1.75;padding:0 24px}.banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#1e3a8a}.hint{color:#475569;font-size:12px;margin-top:4px}pre{white-space:pre-wrap;font-size:14px;line-height:1.8}@media print{.banner{display:none}}</style>
</head><body><div class="banner"><strong>CV Adapté – ${selected.title} @ ${selected.company}</strong><br>${selected.level} · ${selected.duration} · Score ${Math.round(selected.score)}%<div class="hint">Ctrl+P → Enregistrer en PDF</div></div>
<pre>${adaptedCV.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
    a.download = `CV_${selected.title.replace(/\s+/g,"_")}_${selected.company.replace(/\s+/g,"_")}.html`;
    a.click();
  }

  function addToTracking(job, hasCV=false) {
    setTracking(prev => {
      const exists = prev.find(t=>t.title===job.title&&t.company===job.company);
      if (exists) return prev.map(t=>t.title===job.title&&t.company===job.company?{...t,hasCV:t.hasCV||hasCV}:t);
      return [{id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),title:job.title,company:job.company,location:job.location,domain:job.domain,score:job.score,url:job.url||"",status:"À envoyer",hasCV},...prev];
    });
  }

  function exportCSV() {
    const hdr = ["Date","Poste","Entreprise","Ville","Domaine","Score","Statut","CV Adapté","URL"];
    const rows = tracking.map(t=>[t.date,t.title,t.company,t.location,t.domain,t.score,t.status,t.hasCV?"Oui":"Non",t.url]);
    const csv = [hdr,...rows].map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download = "suivi_candidatures_alternance.csv";
    a.click();
  }

  // NOUVEAU : copier le lien dans le presse-papiers
  function copyLink(jobId, url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(jobId);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const isTracked = job => !!tracking.find(t=>t.title===job?.title&&t.company===job?.company);

  // NOUVEAU : filtrage enrichi — domaine + date de publication + durée de contrat
  const filtered = jobs.filter(j => {
    if (filter==="dev" && j.domain!=="Dev") return false;
    if (filter==="data" && j.domain!=="Data") return false;
    if (filter==="top" && j.score<75) return false;
    if (publishedFilter!=="all" && j.publishedAge > parseInt(publishedFilter)) return false;
    if (durationFilter!=="all" && j.duration!==durationFilter) return false;
    return true;
  });

  const TABS = [{id:"search",icon:Search,label:"Recherche"},{id:"results",icon:BarChart2,label:jobs.length?`Offres (${jobs.length})`:"Offres"},{id:"cv",icon:FileText,label:"CV Adapté"},{id:"suivi",icon:Bookmark,label:tracking.length?`Suivi (${tracking.length})`:"Suivi"}];
  const bg = "#0a0a0f", card = "#111118", border = "#1e1e2a", muted = "#555570", dim = "#888898", text = "#e8e8f0", sub = "#c8c8d8";
  const inputStyle = {width:"100%",background:bg,border:`1px solid #333345`,borderRadius:7,padding:"7px 10px",fontSize:13,color:text,boxSizing:"border-box"};

  return (
    <div style={{minHeight:"100vh",background:bg,color:text,fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} input:focus,select:focus,textarea:focus{outline:none!important}`}</style>

      <div style={{background:card,borderBottom:`1px solid ${border}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:"#2563eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎯</div>
          <div>
            <div style={{fontWeight:600,fontSize:13,lineHeight:1.2}}>JobBot Alternance</div>
            <div style={{fontSize:11,color:muted,fontFamily:"monospace"}}>MIASHS · Bac+3/+4</div>
          </div>
        </div>
        <nav style={{display:"flex",gap:3}}>
          {TABS.map(t=>{const Icon=t.icon;return(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,background:tab===t.id?"#2563eb":"transparent",color:tab===t.id?"#fff":dim,transition:"all .15s"}}>
              <Icon size={11}/>{t.label}
            </button>
          );})}
        </nav>
      </div>

      <div style={{padding:16,maxWidth:1000,margin:"0 auto"}}>

        {tab==="search" && (
          <div style={{maxWidth:440,margin:"32px auto"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <h1 style={{fontSize:20,fontWeight:700,margin:"0 0 5px"}}>Trouver ton alternance</h1>
              <p style={{color:muted,fontSize:12,margin:0}}>IA qui génère, score et adapte ton CV automatiquement</p>
            </div>
            <div style={{background:card,borderRadius:14,border:`1px solid ${border}`,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              {[["Localisation principale",loc1,setLoc1],["Localisation secondaire",loc2,setLoc2]].map(([label,val,setter])=>(
                <div key={label}>
                  <label style={{display:"block",fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>{label}</label>
                  <input value={val} onChange={e=>setter(e.target.value)} style={inputStyle}/>
                </div>
              ))}
              {/* NOUVEAU : type de recherche */}
              <div>
                <label style={{display:"block",fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>Type de recherche</label>
                <select value={searchType} onChange={e=>setSearchType(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                  {["Alternance informatique","Job étudiant","Stage","CDI Junior"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* NOUVEAU : niveau d études */}
              <div>
                <label style={{display:"block",fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>Niveau d études</label>
                <select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                  {["Bac+2","Bac+3","Bac+4","Indifférent"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* NOUVEAU : mots-clés supplémentaires */}
              <div>
                <label style={{display:"block",fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>
                  Mots-clés supplémentaires <span style={{color:"#444460",textTransform:"none"}}>(optionnel)</span>
                </label>
                <input value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="ex: React, Power BI, IoT" style={{...inputStyle}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>Domaines couverts</label>
                <div style={{display:"flex",gap:5}}>
                  {["Développement","Data / BI","Les deux"].map(d=>(
                    <div key={d} style={{flex:1,background:"rgba(37,99,235,.12)",border:"1px solid rgba(37,99,235,.3)",borderRadius:7,padding:"5px 4px",textAlign:"center",fontSize:10,color:"#93c5fd",fontWeight:500}}>{d}</div>
                  ))}
                </div>
              </div>
              {error&&<div style={{background:"rgba(220,38,38,.12)",border:"1px solid rgba(220,38,38,.3)",borderRadius:7,padding:"9px 11px",color:"#fca5a5",fontSize:12}}>{error}</div>}
              {loading&&<div style={{background:"rgba(37,99,235,.1)",border:"1px solid rgba(37,99,235,.22)",borderRadius:7,padding:"9px 12px",color:"#93c5fd",fontSize:12,display:"flex",alignItems:"center",gap:9}}>
                <RefreshCw size={12} style={{animation:"spin 1s linear infinite",flexShrink:0}}/>{loadingMsg}
              </div>}
              <button onClick={handleSearch} disabled={loading} style={{padding:"10px 0",borderRadius:9,border:"none",cursor:loading?"not-allowed":"pointer",fontSize:13,fontWeight:600,background:loading?"#1c1c2a":"#2563eb",color:loading?"#444460":"#fff"}}>
                {loading?"Recherche en cours...":"🚀 Lancer la recherche IA"}
              </button>
            </div>
            <div style={{background:card,borderRadius:10,border:`1px solid ${border}`,padding:12,marginTop:8}}>
              <p style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 7px"}}>Compétences dans ton profil</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {["Java","Python/Pandas","SQL","PHP","HTML/CSS","Kotlin","Git","Power BI","Matplotlib","IoT/Z-Wave","Agile"].map(s=>(
                  <span key={s} style={{background:"#1c1c2a",color:"#9898b8",fontSize:10,padding:"2px 7px",borderRadius:3}}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==="results" && (
          <div style={{display:"flex",gap:10,height:620}}>
            <div style={{width:275,display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{background:card,border:`1px solid ${border}`,borderRadius:"9px 9px 0 0",padding:7,display:"flex",gap:3,flexWrap:"wrap"}}>
                {[{id:"all",label:`Tous (${jobs.length})`},{id:"top",label:"🔥 Top"},{id:"dev",label:"Dev"},{id:"data",label:"Data"}].map(f=>(
                  <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"3px 8px",borderRadius:5,border:"none",cursor:"pointer",fontSize:10,fontWeight:500,background:filter===f.id?"#2563eb":"transparent",color:filter===f.id?"#fff":dim,transition:"all .12s"}}>{f.label}</button>
                ))}
              </div>
              {/* NOUVEAU : filtres date de publication et durée */}
              <div style={{background:card,border:`1px solid ${border}`,borderTop:"none",padding:"5px 7px",display:"flex",gap:4}}>
                <select value={publishedFilter} onChange={e=>setPublishedFilter(e.target.value)} style={{flex:1,background:bg,border:`1px solid #2a2a3a`,borderRadius:5,color:dim,fontSize:9,padding:"3px 4px",cursor:"pointer"}}>
                  <option value="all">📅 Toute date</option>
                  <option value="1">Aujourd hui</option>
                  <option value="3">3 derniers jours</option>
                  <option value="7">1 semaine</option>
                  <option value="30">1 mois</option>
                </select>
                <select value={durationFilter} onChange={e=>setDurationFilter(e.target.value)} style={{flex:1,background:bg,border:`1px solid #2a2a3a`,borderRadius:5,color:dim,fontSize:9,padding:"3px 4px",cursor:"pointer"}}>
                  <option value="all">⏱ Toute durée</option>
                  <option value="6 mois">6 mois</option>
                  <option value="12 mois">12 mois</option>
                  <option value="24 mois">24 mois</option>
                </select>
              </div>
              <div style={{flex:1,overflowY:"auto",border:`1px solid ${border}`,borderTop:"none",borderRadius:"0 0 9px 9px"}}>
                {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#444460",fontSize:12}}>Aucune offre</div>}
                {filtered.map(job=>(
                  <div key={job.id} onClick={()=>setSelected(job)} style={{padding:"9px 11px",cursor:"pointer",borderBottom:`1px solid rgba(30,30,42,.7)`,background:selected?.id===job.id?"rgba(37,99,235,.1)":"transparent",borderLeft:selected?.id===job.id?"2px solid #2563eb":"2px solid transparent",transition:"all .1s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:5,marginBottom:3}}>
                      <span style={{fontSize:11,fontWeight:600,color:text,lineHeight:1.3,flex:1}}>{job.title}</span>
                      <ScorePill score={job.score}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:muted,marginBottom:4}}>
                      <Building size={8}/>{job.company} · <MapPin size={8}/>{job.location}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                      <DomainBadge domain={job.domain}/>
                      {/* NOUVEAU : badge source + ancienneté */}
                      <SourceBadge source={job.source}/>
                      <span style={{fontSize:9,color:"#444460"}}>{formatAge(job.publishedAge)}</span>
                    </div>
                    {job.reason&&<p style={{fontSize:9,color:"#444460",margin:"3px 0 0",fontStyle:"italic",lineHeight:1.3}}>{job.reason}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{flex:1,background:card,border:`1px solid ${border}`,borderRadius:9,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {selected?<>
                <div style={{padding:"14px 16px",borderBottom:`1px solid ${border}`,flexShrink:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div>
                      <h2 style={{fontSize:15,fontWeight:700,margin:"0 0 3px",lineHeight:1.3}}>{selected.title}</h2>
                      <p style={{color:dim,fontSize:12,margin:0}}>{selected.company} · {selected.location} · {selected.duration}</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                      <ScorePill score={selected.score}/><DomainBadge domain={selected.domain}/>
                    </div>
                  </div>
                  {/* NOUVEAU : source + lien + bouton copier */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    <SourceBadge source={selected.source}/>
                    <span style={{fontSize:10,color:muted}}>{formatAge(selected.publishedAge)}</span>
                    {(() => {
                      const src = SOURCES.find(s=>s.name===selected.source) || SOURCES[0];
                      return <>
                        <a href={src.url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:"#3b82f6",textDecoration:"none"}}>
                          <ExternalLink size={9}/>Voir l offre
                        </a>
                        <button onClick={()=>copyLink(selected.id, src.url)} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,background:"transparent",border:"none",color:copied===selected.id?"#6ee7b7":muted,cursor:"pointer",padding:0}}>
                          <Copy size={9}/>{copied===selected.id?"Copié !":"Copier le lien"}
                        </button>
                      </>;
                    })()}
                  </div>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <p style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>Description</p>
                    <p style={{color:sub,fontSize:13,lineHeight:1.7,margin:0}}>{selected.description}</p>
                  </div>
                  <div>
                    <p style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>Compétences requises</p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {(selected.requirements||[]).map(r=>(
                        <span key={r} style={{background:"#1c1c2a",color:"#93c5fd",fontSize:11,padding:"2px 6px",borderRadius:3,border:`1px solid #333345`}}>{r}</span>
                      ))}
                    </div>
                  </div>
                  {selected.reason&&<div style={{background:"rgba(37,99,235,.08)",border:"1px solid rgba(37,99,235,.2)",borderRadius:7,padding:"9px 11px"}}>
                    <p style={{fontSize:12,color:"#93c5fd",margin:0}}>💡 {selected.reason}</p>
                  </div>}
                  <div style={{display:"flex",gap:7,paddingTop:2}}>
                    <button onClick={()=>{handleAdaptCV(selected);setTab("cv");}} style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:"#2563eb",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      <FileText size={12}/>Adapter mon CV
                    </button>
                    <button onClick={()=>addToTracking(selected)} style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${isTracked(selected)?"#065f46":border}`,cursor:"pointer",fontSize:13,background:isTracked(selected)?"rgba(6,95,70,.25)":"#1c1c2a",color:isTracked(selected)?"#6ee7b7":dim,transition:"all .12s"}}>
                      {isTracked(selected)?<CheckCircle size={13}/>:<Bookmark size={13}/>}
                    </button>
                  </div>
                </div>
              </>:<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#333345",gap:7}}>
                <span style={{fontSize:26}}>👈</span><span style={{fontSize:12}}>Sélectionne une offre</span>
              </div>}
            </div>
          </div>
        )}

        {tab==="cv" && (
          <div style={{display:"flex",gap:10,height:620}}>
            <div style={{width:215,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{background:card,border:`1px solid ${border}`,borderRadius:9,padding:12}}>
                {selected?<>
                  <p style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>Poste ciblé</p>
                  <p style={{fontWeight:600,fontSize:12,lineHeight:1.3,margin:"0 0 2px"}}>{selected.title}</p>
                  <p style={{color:dim,fontSize:11,margin:"0 0 7px"}}>{selected.company} · {selected.location}</p>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}><ScorePill score={selected.score}/><DomainBadge domain={selected.domain}/></div>
                </>:<p style={{color:muted,fontSize:12,margin:0}}>Sélectionne une offre dans Offres</p>}
              </div>
              {/* NOUVEAU : import .docx */}
              <div style={{background:card,border:`1px solid ${border}`,borderRadius:9,padding:10}}>
                <p style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 5px"}}>Profil utilisé</p>
                <p style={{fontSize:10,color:importedProfile?"#6ee7b7":dim,margin:"0 0 7px",lineHeight:1.4}}>
                  {importedProfile ? "✓ CV importé (.docx)" : "Profil par défaut (MIASHS)"}
                </p>
                <input type="file" accept=".docx" ref={cvFileRef} onChange={handleImportCV} style={{display:"none"}}/>
                <button onClick={()=>cvFileRef.current?.click()} style={{width:"100%",padding:"5px 0",borderRadius:7,border:`1px solid #334155`,cursor:"pointer",fontSize:10,fontWeight:500,background:"rgba(37,99,235,.1)",color:"#93c5fd",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                  <Upload size={9}/>Importer mon CV (.docx)
                </button>
                {importedProfile&&(
                  <button onClick={()=>{setImportedProfile("");localStorage.removeItem("importedProfile");}} style={{width:"100%",marginTop:4,padding:"4px 0",borderRadius:7,border:`1px solid #2a2a3a`,cursor:"pointer",fontSize:9,background:"transparent",color:"#444460"}}>
                    Réinitialiser (profil défaut)
                  </button>
                )}
              </div>
              {selected&&<div style={{background:card,border:`1px solid ${border}`,borderRadius:9,padding:10,display:"flex",flexDirection:"column",gap:5}}>
                <button onClick={()=>handleAdaptCV(selected)} disabled={cvLoading} style={{padding:"6px 0",borderRadius:7,border:`1px solid #334155`,cursor:cvLoading?"not-allowed":"pointer",fontSize:11,fontWeight:500,background:cvLoading?"#1c1c2a":"rgba(37,99,235,.12)",color:cvLoading?"#444460":"#93c5fd",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                  <RefreshCw size={10} style={cvLoading?{animation:"spin 1s linear infinite"}:{}}/>{cvLoading?"Génération...":"Regénérer"}
                </button>
                {adaptedCV&&!cvLoading&&<>
                  {/* NOUVEAU : bouton PDF */}
                  <button onClick={downloadPDF} style={{padding:"6px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"rgba(220,38,38,.18)",color:"#fca5a5",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <Download size={10}/>Télécharger en PDF
                  </button>
                  {/* NOUVEAU : bouton .doc */}
                  <button onClick={downloadDoc} style={{padding:"6px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"rgba(37,99,235,.2)",color:"#93c5fd",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <Download size={10}/>Télécharger en .doc
                  </button>
                  <button onClick={downloadCV} style={{padding:"6px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"#065f46",color:"#6ee7b7",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <Download size={10}/>Télécharger (HTML)
                  </button>
                  <button onClick={()=>{addToTracking(selected,true);setTab("suivi");}} style={{padding:"6px 0",borderRadius:7,border:`1px solid ${border}`,cursor:"pointer",fontSize:11,background:"#1c1c2a",color:dim,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <Bookmark size={10}/>Ajouter au suivi
                  </button>
                </>}
              </div>}
            </div>
            {/* NOUVEAU : textarea éditable pour retouches manuelles */}
            <div style={{flex:1,background:card,border:`1px solid ${border}`,borderRadius:9,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{padding:"9px 14px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <span style={{fontSize:10,color:muted,textTransform:"uppercase",letterSpacing:".06em"}}>CV Adapté</span>
                {adaptedCV&&!cvLoading&&<span style={{fontSize:10,color:"#6ee7b7",display:"flex",alignItems:"center",gap:3}}><CheckCircle size={9}/>Généré — modifiable</span>}
              </div>
              <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                {cvLoading?(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:9,color:muted}}>
                    <RefreshCw size={20} style={{color:"#2563eb",animation:"spin 1s linear infinite"}}/><span style={{fontSize:12}}>Adaptation du CV...</span>
                  </div>
                ):adaptedCV?(
                  <textarea
                    value={adaptedCV}
                    onChange={e=>setAdaptedCV(e.target.value)}
                    style={{flex:1,width:"100%",background:"transparent",border:"none",resize:"none",padding:14,fontSize:11,color:sub,lineHeight:1.75,fontFamily:"monospace",boxSizing:"border-box"}}
                  />
                ):(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:9,color:"#444460"}}>
                    <FileText size={24}/><span style={{fontSize:12,textAlign:"center"}}>Sélectionne une offre<br/>puis clique "Adapter mon CV"</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="suivi" && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div>
                <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 2px"}}>Suivi des candidatures</h2>
                <p style={{color:muted,fontSize:12,margin:0}}>{tracking.length} / 30 objectif</p>
              </div>
              {tracking.length>0&&<button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",background:"rgba(6,95,70,.2)",border:"1px solid #065f46",color:"#6ee7b7",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:500}}>
                <Download size={11}/>Exporter CSV
              </button>}
            </div>
            <div style={{background:card,border:`1px solid ${border}`,borderRadius:9,padding:12,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:muted,marginBottom:5}}>
                <span>Progression</span><span style={{fontFamily:"monospace"}}>{tracking.length}/30</span>
              </div>
              <div style={{height:5,background:"#1c1c2a",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#2563eb,#10b981)",borderRadius:99,width:`${Math.min(100,(tracking.length/30)*100)}%`,transition:"width .5s"}}/>
              </div>
              {tracking.length>0&&<div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:muted}}>
                {STATUS_OPTS.filter(s=>s!=="À envoyer").map(s=>{const n=tracking.filter(t=>t.status===s).length;return n>0?<span key={s}>{s}: <strong style={{color:sub}}>{n}</strong></span>:null;})}
              </div>}
            </div>
            {tracking.length===0?<div style={{background:card,border:`1px solid ${border}`,borderRadius:9,padding:48,textAlign:"center",color:"#444460"}}>
              <Bookmark size={26} style={{margin:"0 auto 8px",opacity:.3}}/>
              <p style={{fontSize:12,margin:"0 0 3px"}}>Aucune candidature suivie pour l instant</p>
              <p style={{fontSize:10,color:"#333345",margin:0}}>Ajoute des offres depuis l onglet Offres ou CV Adapté</p>
            </div>:<div style={{background:card,border:`1px solid ${border}`,borderRadius:9,overflow:"hidden"}}>
              <table style={{width:"100%",tableLayout:"fixed",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${border}`,background:bg}}>
                    {[["Date","9%"],["Poste","22%"],["Entreprise","15%"],["Ville","10%"],["Score","11%"],["CV","7%"],["Statut","16%"],["Lien","10%"]].map(([h,w])=>(
                      <th key={h} style={{textAlign:"left",padding:"7px 9px",fontSize:9,color:muted,textTransform:"uppercase",letterSpacing:".05em",fontWeight:500,width:w}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tracking.map((t,i)=>(
                    <tr key={t.id} style={{borderBottom:`1px solid rgba(30,30,42,.5)`,background:i%2?"rgba(10,10,15,.4)":"transparent"}}>
                      <td style={{padding:"7px 9px",fontSize:10,color:muted,fontFamily:"monospace"}}>{t.date}</td>
                      <td style={{padding:"7px 9px",fontSize:10,fontWeight:500,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                      <td style={{padding:"7px 9px",fontSize:10,color:dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.company}</td>
                      <td style={{padding:"7px 9px",fontSize:10,color:muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.location}</td>
                      <td style={{padding:"7px 9px"}}><ScorePill score={t.score}/></td>
                      <td style={{padding:"7px 9px",fontSize:10,color:t.hasCV?"#6ee7b7":"#333345"}}>{t.hasCV?"✓ Prêt":"—"}</td>
                      <td style={{padding:"7px 9px"}}>
                        <select value={t.status} onChange={e=>setTracking(prev=>prev.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{background:"#1c1c2a",border:`1px solid #333345`,color:sub,fontSize:9,borderRadius:4,padding:"2px 3px",width:"100%"}}>
                          {STATUS_OPTS.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"7px 9px"}}>
                        {t.url?<a href={t.url} target="_blank" rel="noopener noreferrer" style={{color:"#3b82f6",fontSize:9,display:"flex",alignItems:"center",gap:2}}><ExternalLink size={8}/>Voir</a>:<span style={{color:"#333345",fontSize:9}}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}