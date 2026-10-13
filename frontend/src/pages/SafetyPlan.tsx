import React, { useState } from 'react';
import { ShieldAlert, PhoneCall, AlertOctagon, HeartHandshake, Save, Plus, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function SafetyPlan() {
  const [warningSigns, setWarningSigns] = useState<string>(() => localStorage.getItem('shadowmind_safety_warning') || '');
  const [copingStrategies, setCopingStrategies] = useState<string>(() => localStorage.getItem('shadowmind_safety_coping') || '');
  const [safePlaces, setSafePlaces] = useState<string>(() => localStorage.getItem('shadowmind_safety_places') || '');
  
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const stored = localStorage.getItem('shadowmind_safety_contacts');
      return stored ? JSON.parse(stored) : [
        { id: '1', name: 'Emergency Services', phone: '911 / 112', relationship: 'Official Emergency Response' },
        { id: '2', name: 'National Crisis Lifeline', phone: '988', relationship: '24/7 Suicide & Crisis Lifeline' }
      ];
    } catch {
      return [];
    }
  });

  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('');

  const handleTriggerSos = () => {
    toast.error('Crisis resources are shown below. You are not alone.', { duration: 6000 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = () => {
    localStorage.setItem('shadowmind_safety_warning', warningSigns);
    localStorage.setItem('shadowmind_safety_coping', copingStrategies);
    localStorage.setItem('shadowmind_safety_places', safePlaces);
    localStorage.setItem('shadowmind_safety_contacts', JSON.stringify(contacts));
    toast.success('Personal Safety Plan saved successfully.');
  };

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) {
      toast.error('Please provide a contact name and phone number.');
      return;
    }
    const created: Contact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: newContactPhone,
      relationship: newContactRel || 'Personal Contact'
    };
    const updated = [...contacts, created];
    setContacts(updated);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRel('');
    toast.success('Emergency contact added.');
  };

  const handleDeleteContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    toast.success('Contact removed.');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Emergency SOS Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.4) 100%)',
        border: '1.5px solid #ef4444',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
          }}>
            <ShieldAlert size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>Emergency SOS & Crisis Response</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', margin: '4px 0 0' }}>
              If you or someone you know is in immediate physical danger or distress, please reach out for help immediately.
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerSos}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            padding: '0.85rem 1.75rem',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 16px rgba(239, 68, 68, 0.6)',
            transition: 'all 0.2s ease'
          }}
        >
          <AlertOctagon size={18} /> TRIGGER EMERGENCY SOS
        </button>
      </div>

      {/* Immediate Helpline Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <PhoneCall size={20} color="#ef4444" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>National Crisis Lifeline</h4>
          </div>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-bright)', margin: '4px 0' }}>Dial: 988</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Free, confidential, 24/7 support for individuals in suicidal crisis or emotional distress.</p>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <PhoneCall size={20} color="#3b82f6" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Crisis Text Line</h4>
          </div>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#60a5fa', margin: '4px 0' }}>Text HOME to 741741</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Connect with a volunteer Crisis Counselor 24/7 via text message.</p>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <HeartHandshake size={20} color="#22c55e" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>International Support</h4>
          </div>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80', margin: '4px 0' }}>findahelpline.com</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Free, confidential support from local crisis centers worldwide.</p>
        </div>
      </div>

      {/* Personal Safety Plan Builder */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Personal Safety Plan</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              A structured set of coping strategies and personal contacts to use during emotional distress.
            </p>
          </div>
          <button onClick={handleSavePlan} className="btn btn-primary" style={{ gap: '8px' }}>
            <Save size={16} /> Save Safety Plan
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1 */}
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
              1. My Warning Signs (thoughts, moods, or behaviors indicating a crisis may be developing)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Feeling extreme fatigue, isolating from friends, rapid heart rate..."
              value={warningSigns}
              onChange={e => setWarningSigns(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-dim)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                resize: 'none'
              }}
            />
          </div>

          {/* Section 2 */}
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
              2. Internal Coping Strategies (things I can do to take my mind off problems without relying on others)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. 5-4-3-2-1 breathing exercise, listening to calming music, going for a brisk 10-minute walk..."
              value={copingStrategies}
              onChange={e => setCopingStrategies(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-dim)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                resize: 'none'
              }}
            />
          </div>

          {/* Section 3 */}
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '12px' }}>
              3. Emergency Contacts & Trusted Individuals
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
              {contacts.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '10px' }}>({c.relationship})</span>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-bright)', fontWeight: 600 }}>{c.phone}</div>
                  </div>
                  <button onClick={() => handleDeleteContact(c.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Contact Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px' }}>
              <input
                type="text"
                placeholder="Name"
                value={newContactName}
                onChange={e => setNewContactName(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={newContactPhone}
                onChange={e => setNewContactPhone(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Relationship"
                value={newContactRel}
                onChange={e => setNewContactRel(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '0.85rem' }}
              />
              <button onClick={handleAddContact} className="btn btn-outline" style={{ padding: '8px 14px' }}>
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
