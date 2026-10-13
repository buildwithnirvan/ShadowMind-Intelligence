import { useEffect, useState } from 'react';
import { moodsApi, journalsApi } from '../services/api';
import { Mood, Journal } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, BookOpen, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type TimelineEvent = { type:'mood'|'journal'; date:Date; data:Mood|Journal };

export default function History() {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'mood'|'journal'>('all');
  const [days, setDays] = useState(30);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const [mr,jr]=await Promise.all([moodsApi.list({limit:200,days}),journalsApi.list({limit:100})]);
        setMoods(Array.isArray(mr.data) ? mr.data : []);
        setJournals(Array.isArray(jr.data) ? jr.data : []);
      }catch(e){console.error(e); setMoods([]); setJournals([]);}finally{setLoading(false)}
    })();
  },[days]);

  const safeMoods = Array.isArray(moods) ? moods : [];
  const safeJournals = Array.isArray(journals) ? journals : [];

  const events:TimelineEvent[]=[
    ...safeMoods.map(m=>({type:'mood' as const,date:new Date(m.created_at),data:m})),
    ...safeJournals.map(j=>({type:'journal' as const,date:new Date(j.created_at),data:j})),
  ].filter(e=>filter==='all'||e.type===filter)
   .sort((a,b)=>b.date.getTime()-a.date.getTime());

  // Weekly chart data
  const weeklyData=()=>{
    const map:Record<string,number[]>={};
    safeMoods.forEach(m=>{
      if (m?.created_at) {
        const k=format(new Date(m.created_at),'EEE');
        (map[k]=map[k]||[]).push(m.score);
      }
    });
    return['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>({
      day:d,
      avg:map[d]?.length?+(map[d].reduce((a,b)=>a+b,0)/map[d].length).toFixed(1):null,
      count:map[d]?.length??0
    }));
  };

  if(loading) return <div style={{display:'flex',justifyContent:'center',paddingTop:'4rem'}}><LoadingSpinner message="LOADING HISTORY" size="lg"/></div>;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div style={{marginBottom:'2rem'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',fontWeight:800,letterSpacing:'-.01em',marginBottom:'4px'}}>HISTORY</h1>
        <p style={{fontFamily:'var(--font-mono)',fontSize:'.7rem',color:'var(--text-muted)',letterSpacing:'.08em'}}>Your wellness timeline & patterns</p>
      </div>

      {/* Stats strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'1.5rem'}}>
        {[
          {label:'MOODS',value:safeMoods.length,color:'var(--accent)'},
          {label:'AVG SCORE',value:safeMoods.length?+(safeMoods.reduce((a,m)=>a+(m.score||0),0)/safeMoods.length).toFixed(1):'-',color:'#4488ff'},
          {label:'JOURNALS',value:safeJournals.length,color:'#8844ff'},
          {label:'WORDS',value:safeJournals.reduce((a,j)=>a+(j.word_count||0),0).toLocaleString(),color:'#44dd88'},
        ].map(s=>(
          <div key={s.label} className="card" style={{padding:'1rem',textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'.6rem',color:'var(--text-muted)',letterSpacing:'.1em',marginTop:'2px'}}>{s.label}</div>
          </div>))}
      </div>

      {/* Weekly pattern chart */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:'.7rem',letterSpacing:'.12em',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'1rem'}}>WEEKLY MOOD PATTERN</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData()} margin={{top:4,right:4,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
            <XAxis dataKey="day" tick={{fontFamily:'var(--font-mono)',fontSize:9,fill:'var(--text-muted)'}}/>
            <YAxis domain={[0,10]} tick={{fontFamily:'var(--font-mono)',fontSize:9,fill:'var(--text-muted)'}}/>
            <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--accent-border)',fontFamily:'var(--font-mono)',fontSize:'.7rem',borderRadius:'6px'}} formatter={(v:number)=>[v,'Avg Score']}/>
            <Bar dataKey="avg" fill="var(--accent)" radius={[4,4,0,0]} maxBarSize={40}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Controls */}
      <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap'}}>
        <Filter size={14} color="var(--text-muted)"/>
        {(['all','mood','journal'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className="btn" style={{padding:'4px 12px',fontSize:'.68rem',background:filter===f?'var(--accent-subtle)':'transparent',border:`1px solid ${filter===f?'var(--accent)':'var(--border-dim)'}`,color:filter===f?'var(--accent-bright)':'var(--text-secondary)'}}>
            {f.toUpperCase()}
          </button>))}
        <div style={{marginLeft:'auto',display:'flex',gap:'6px'}}>
          {[14,30,60,90].map(d=>(
            <button key={d} onClick={()=>setDays(d)} className="btn" style={{padding:'4px 10px',fontSize:'.68rem',background:days===d?'var(--accent-subtle)':'transparent',border:`1px solid ${days===d?'var(--accent)':'var(--border-dim)'}`,color:days===d?'var(--accent-bright)':'var(--text-secondary)'}}>
              {d}D
            </button>))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{position:'relative',paddingLeft:'28px'}}>
        {/* Vertical line */}
        <div style={{position:'absolute',left:'11px',top:0,bottom:0,width:'1px',background:'var(--accent-border)'}}/>

        {events.length===0&&(
          <div style={{textAlign:'center',padding:'4rem 0',fontFamily:'var(--font-mono)',fontSize:'.8rem',color:'var(--text-muted)'}}>No entries in this period.</div>
        )}

        {events.map((ev,i)=>{
          const isMood=ev.type==='mood';
          const m=ev.data as Mood;
          const j=ev.data as Journal;
          const sc=isMood?m.score:null;
          const dotColor=isMood?(sc!>=7?'#44dd88':sc!>=4?'#ffcc00':'var(--accent-bright)'):'#8844ff';
          return(
            <div key={i} className="animate-fade-in-up" style={{marginBottom:'1.25rem',animationDelay:`${i*.03}s`}}>
              {/* Timeline dot */}
              <div style={{position:'absolute',left:'6px',width:'12px',height:'12px',borderRadius:'50%',background:dotColor,boxShadow:`0 0 6px ${dotColor}88`,border:'2px solid var(--bg-void)',marginTop:'14px'}}/>

              <div className="card" style={{marginLeft:'8px',padding:'1rem 1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                      {isMood?<Activity size={13} color={dotColor}/>:<BookOpen size={13} color={dotColor}/>}
                      {isMood?(
                        <span style={{fontFamily:'var(--font-mono)',fontSize:'.72rem',color:dotColor,textTransform:'uppercase',letterSpacing:'.06em'}}>{m.label}</span>
                      ):(
                        <span style={{fontFamily:'var(--font-body)',fontSize:'.82rem',color:'var(--text-primary)',fontWeight:500}}>{j.title}</span>
                      )}
                    </div>

                    {isMood&&m.notes&&<p style={{fontFamily:'var(--font-body)',fontSize:'.8rem',color:'var(--text-secondary)',marginTop:'2px'}}>{m.notes}</p>}
                    {!isMood&&<p style={{fontFamily:'var(--font-body)',fontSize:'.8rem',color:'var(--text-secondary)',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{j.content}</p>}

                    {isMood&&m.tags&&m.tags.length>0&&(
                      <div style={{display:'flex',gap:'4px',marginTop:'6px',flexWrap:'wrap'}}>
                        {m.tags.map(t=><span key={t} style={{fontFamily:'var(--font-mono)',fontSize:'.6rem',color:'var(--text-muted)',background:'var(--bg-elevated)',padding:'1px 6px',borderRadius:'3px'}}>#{t}</span>)}
                      </div>)}
                  </div>

                  <div style={{flexShrink:0,textAlign:'right'}}>
                    {isMood&&<div style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:dotColor,fontWeight:700,lineHeight:1}}>{m.score.toFixed(1)}</div>}
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'.6rem',color:'var(--text-muted)',marginTop:'2px'}}>{formatDistanceToNow(ev.date,{addSuffix:true})}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'.58rem',color:'var(--text-muted)'}}>{format(ev.date,'MM/dd HH:mm')}</div>
                  </div>
                </div>
              </div>
            </div>);
        })}
      </div>
    </div>
  );
}
