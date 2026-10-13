import React from 'react';
import { HelpCircle, Phone, ShieldAlert, FileText, ExternalLink } from 'lucide-react';
import CrisisResources from '../components/CrisisResources';

export default function Help() {
  return (
    <div className="animate-fade-in-up" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
        <HelpCircle size={28} color="var(--accent)" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, margin: 0 }}>Help & Resources</h1>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} /> Crisis Support
        </h2>
        <div className="card" style={{ padding: 0, border: '1px solid rgba(255,51,51,0.3)' }}>
          <CrisisResources />
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} /> Frequently Asked Questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FaqItem 
            question="Is Shadow a real therapist?" 
            answer="No. Shadow is a supportive AI companion for listening, CBT exercises and mood tracking. It cannot diagnose and is not a substitute for a licensed therapist or doctor."
          />
          <FaqItem 
            question="Is my data private?" 
            answer="Yes. All your journal entries, chats, and mood logs are encrypted and private to your account. ShadowMind does not share your conversations with third-party advertisers."
          />
          <FaqItem 
            question="How do the AI Doctor Recommendations work?" 
            answer="The system analyzes your mood scores, emotional labels (like 'anxious' or 'depressed'), and sleep patterns over the last 30 days. If your data matches certain clinical thresholds, it recommends a specific type of specialist (like a Psychiatrist or CBT Therapist)."
          />
          <FaqItem 
            question="How do I log a chat session to my analytics?" 
            answer="When you are finished with a chat session, click ‘Save to journal’ at the top right of the chat window. Shadow will analyze the conversation and automatically create a Mood and Journal entry for your analytics dashboard."
          />
        </div>
      </div>

      <div>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Phone size={16} /> External Links
        </h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <a href="https://telemanas.mohfw.gov.in/" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            <ExternalLink size={14} color="var(--accent)" /> Tele-MANAS (Government of India)
          </a>
          <a href="https://icallhelpline.org/" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            <ExternalLink size={14} color="var(--accent)" /> iCall (TISS)
          </a>
          <a href="https://988lifeline.org/" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            <ExternalLink size={14} color="var(--accent)" /> 988 Suicide & Crisis Lifeline (US)
          </a>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string, answer: string }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>{question}</h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{answer}</p>
    </div>
  );
}
