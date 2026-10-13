import { useEffect, useState } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { MapPin, Calendar, ChevronDown, ChevronUp, Stethoscope, AlertCircle } from 'lucide-react';

interface Specialist {
  id:string; specialty:string; icon:string; why:string; color:string;
  helps_with:string[]; prepare:string[]; modalities:string;
  urgency:string; match_strength:string;
}

export default function Doctors() {
  const [recs, setRecs] = useState<Specialist[]>([]);
  const [meta, setMeta] = useState<{avg_mood?:number;based_on:number;disclaimer:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);

  useEffect(()=>{
    api.get('/doctors/').then(r=>{setRecs(r.data.recommendations);setMeta(r.data)}).catch(console.error).finally(()=>setLoading(false));
  },[]);

  if(loading) return <div style={{display:'flex',justifyContent:'center',paddingTop:'5rem'}}><LoadingSpinner message="MATCHING SPECIALISTS" size="lg"/></div>;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div style={{marginBottom:'2rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
          <Stethoscope size={20} color="var(--accent)"/>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',fontWeight:800,letterSpacing:'-.01em'}}>SPECIALIST MATCH</h1>
        </div>
        <p style={{fontFamily:'var(--font-mono)',fontSize:'.7rem',color:'var(--text-muted)',letterSpacing:'.06em'}}>
          Professional support recommendations based on your wellness data
        </p>
        {meta&&<div style={{fontFamily:'var(--font-mono)',fontSize:'.65rem',color:'var(--text-muted)',marginTop:'8px'}}>
          Avg mood: <span style={{color:'var(--accent-bright)'}}>{meta.avg_mood?.toFixed(1)}/10</span> // Based on <span style={{color:'var(--accent-bright)'}}>{meta.based_on} entries</span>
        </div>}
      </div>

      {/* Cards */}
      <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}} className="stagger-children">
        {recs.map((r,i)=>{
          const open=expanded===r.id;
          return (
            <div key={r.id} className="card animate-fade-in-up" style={{borderColor:`${r.color}44`,animationDelay:`${i*.08}s`,padding:0,overflow:'hidden'}}>
              {/* Card top stripe */}
              <div style={{height:'3px',background:`linear-gradient(90deg,${r.color},transparent)`}}/>

              <div style={{padding:'1.5rem'}}>
                {/* Header row */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',cursor:'pointer'}} onClick={()=>setExpanded(open?null:r.id)}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
                      <span style={{fontSize:'1.6rem',lineHeight:1}}>{r.icon}</span>
                      <div>
                        <div style={{fontFamily:'var(--font-display)',fontSize:'1.05rem',fontWeight:700,color:'var(--text-primary)',letterSpacing:'.02em'}}>{r.specialty}</div>
                        <div style={{display:'flex',gap:'6px',marginTop:'4px',alignItems:'center'}}>
                          <span className="badge" style={{background:`${r.color}18`,color:r.color,border:`1px solid ${r.color}44`}}>
                            {r.match_strength}
                          </span>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:'.62rem',color:'var(--text-muted)'}}>⏱ {r.urgency}</span>
                        </div>
                      </div>
                    </div>
                    <p style={{fontFamily:'var(--font-body)',fontSize:'.84rem',color:'var(--text-secondary)',lineHeight:1.65}}>{r.why}</p>
                  </div>
                  <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'4px',marginLeft:'1rem',flexShrink:0}}>
                    {open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
                  </button>
                </div>

                {/* Expanded */}
                {open&&(
                  <div className="animate-fade-in-up" style={{marginTop:'1.25rem',paddingTop:'1.25rem',borderTop:`1px solid ${r.color}22`}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.25rem'}}>
                      {/* Helps with */}
                      <div>
                        <div style={{fontFamily:'var(--font-mono)',fontSize:'.65rem',color:'var(--text-muted)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>HELPS WITH</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {r.helps_with.map(h=>(
                            <div key={h} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{width:5,height:5,borderRadius:'50%',background:r.color,flexShrink:0}}/>
                              <span style={{fontFamily:'var(--font-body)',fontSize:'.8rem',color:'var(--text-secondary)'}}>{h}</span>
                            </div>))}
                        </div>
                      </div>
                      {/* How to prepare */}
                      <div>
                        <div style={{fontFamily:'var(--font-mono)',fontSize:'.65rem',color:'var(--text-muted)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>HOW TO PREPARE</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {r.prepare.map((p,pi)=>(
                            <div key={pi} style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
                              <span style={{fontFamily:'var(--font-mono)',fontSize:'.65rem',color:r.color,flexShrink:0,marginTop:'2px'}}>{pi+1}.</span>
                              <span style={{fontFamily:'var(--font-body)',fontSize:'.78rem',color:'var(--text-secondary)',lineHeight:1.5}}>{p}</span>
                            </div>))}
                        </div>
                      </div>
                    </div>

                    {/* Modalities */}
                    <div style={{padding:'10px 14px',background:`${r.color}0c`,border:`1px solid ${r.color}22`,borderRadius:'6px',marginBottom:'1rem'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'.62rem',color:r.color,letterSpacing:'.08em',textTransform:'uppercase'}}>APPROACH: </span>
                      <span style={{fontFamily:'var(--font-body)',fontSize:'.8rem',color:'var(--text-secondary)'}}>{r.modalities}</span>
                    </div>

                    {/* Action buttons */}
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <button className="btn btn-primary" style={{background:r.color,display:'flex',alignItems:'center',gap:'6px'}}
                        onClick={()=>alert('In a full deployment, this would open a booking flow or directory search.')}>
                        <Calendar size={13}/> FIND NEAR ME
                      </button>
                      <button className="btn btn-ghost" style={{display:'flex',alignItems:'center',gap:'6px'}}
                        onClick={()=>alert('This would link to a vetted online therapy platform.')}>
                        <MapPin size={13}/> ONLINE OPTIONS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>);})}
      </div>

      {/* Disclaimer */}
      {meta&&(
        <div style={{marginTop:'2rem',display:'flex',gap:'10px',padding:'1rem',background:'var(--bg-elevated)',border:'1px solid var(--border-dim)',borderRadius:'8px'}}>
          <AlertCircle size={15} color="var(--text-muted)" style={{flexShrink:0,marginTop:'1px'}}/>
          <p style={{fontFamily:'var(--font-mono)',fontSize:'.63rem',color:'var(--text-muted)',lineHeight:1.65,letterSpacing:'.02em'}}>{meta.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
