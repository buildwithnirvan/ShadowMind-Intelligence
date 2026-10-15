import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { doctorsApi, NearbyPlaceItem, NearbySearchResponse } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MapPin, Calendar, ChevronDown, ChevronUp, Stethoscope, AlertCircle,
  Loader2, X, ExternalLink, ShieldAlert, CheckCircle2, Phone,
  Navigation, Star, Search, RefreshCw, Filter
} from 'lucide-react';

interface Specialist {
  id: string;
  specialty: string;
  icon: string;
  why: string;
  color: string;
  helps_with: string[];
  prepare: string[];
  modalities: string;
  urgency: string;
  match_strength: string;
}

const CATEGORY_MAP: Record<string, string> = {
  therapist: 'counselling',
  psychiatrist: 'psychiatrists',
  gp: 'general_practitioners',
  mindfulness_coach: 'mental_health_clinics',
};

const DIRECTORY_CATEGORIES = [
  { id: 'hospitals', label: 'Hospitals & Emergency', icon: '🏥' },
  { id: 'mental_health_clinics', label: 'Mental-Health Clinics', icon: '🧠' },
  { id: 'psychiatrists', label: 'Psychiatrists', icon: '⚕️' },
  { id: 'psychologists', label: 'Psychologists', icon: '🧩' },
  { id: 'counselling', label: 'Counselling & Therapy', icon: '💬' },
  { id: 'general_practitioners', label: 'General Practitioners', icon: '🩺' },
];

const RADIUS_OPTIONS = [
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

interface PanelState {
  type: 'near' | 'online';
  status: 'loading' | 'location_success' | 'location_denied' | 'location_error' | 'online_info';
  message?: string;
  coords?: { lat: number; lng: number };
}

export default function Doctors() {
  const [recs, setRecs] = useState<Specialist[]>([]);
  const [meta, setMeta] = useState<{ avg_mood?: number; based_on: number; disclaimer: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cardPanels, setCardPanels] = useState<Record<string, PanelState | null>>({});

  // Shared session coordinates for fast nearby re-querying across categories
  const [sessionCoords, setSessionCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<number>(5000);
  const [activeCategory, setActiveCategory] = useState<string>('counselling');
  const [manualQuery, setManualQuery] = useState<string>('');

  // Per-specialist card state for authoritative search parameters
  const [cardCategory, setCardCategory] = useState<Record<string, string>>({});
  const [cardRadius, setCardRadius] = useState<Record<string, number>>({});
  const [cardQuery, setCardQuery] = useState<Record<string, string>>({});

  // Request cancellation and race condition guards
  const activeRequestsRef = useRef<Record<string, number>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Places search results state per specialist panel
  const [placesData, setPlacesData] = useState<Record<string, NearbySearchResponse | null>>({});
  const [placesLoading, setPlacesLoading] = useState<Record<string, boolean>>({});
  const [placesError, setPlacesError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    api.get('/doctors/')
      .then((r) => {
        setRecs(r.data.recommendations);
        setMeta(r.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runNearbyApiSearch = async (
    specialistId: string,
    categoryKey: string,
    coords: { lat: number; lng: number } | null,
    radius: number,
    queryString?: string,
    forceRefresh: boolean = false
  ) => {
    // Abort previous in-flight request for this panel
    abortControllersRef.current[specialistId]?.abort();
    const controller = new AbortController();
    abortControllersRef.current[specialistId] = controller;

    // Increment request ID to ignore stale responses
    const reqId = (activeRequestsRef.current[specialistId] || 0) + 1;
    activeRequestsRef.current[specialistId] = reqId;

    setPlacesLoading((prev) => ({ ...prev, [specialistId]: true }));
    setPlacesError((prev) => ({ ...prev, [specialistId]: null }));

    try {
      const trimmedQuery = queryString !== undefined ? queryString.trim() : '';
      const hasQuery = Boolean(trimmedQuery);

      const validCoords =
        coords &&
        typeof coords.lat === 'number' &&
        typeof coords.lng === 'number' &&
        !isNaN(coords.lat) &&
        !isNaN(coords.lng)
          ? coords
          : null;

      if (!validCoords && !hasQuery) {
        setPlacesLoading((prev) => ({ ...prev, [specialistId]: false }));
        setPlacesError((prev) => ({
          ...prev,
          [specialistId]: 'Please share device location or enter a city or postal code above to search.',
        }));
        return;
      }

      const res = await doctorsApi.findNearby(
        {
          latitude: validCoords ? validCoords.lat : null,
          longitude: validCoords ? validCoords.lng : null,
          radius,
          category: categoryKey,
          query: hasQuery ? trimmedQuery : null,
          refresh: forceRefresh,
        },
        controller.signal
      );

      // Stale check
      if (activeRequestsRef.current[specialistId] !== reqId) {
        return;
      }

      setPlacesData((prev) => ({ ...prev, [specialistId]: res.data }));
      setPlacesError((prev) => ({ ...prev, [specialistId]: null }));

      // If manual search resolved a new search center, update coordinates
      if (res.data.search_center) {
        const resolvedCoords = {
          lat: res.data.search_center.latitude,
          lng: res.data.search_center.longitude,
        };
        setSessionCoords(resolvedCoords);
        setCardPanels((prev) => ({
          ...prev,
          [specialistId]: {
            type: 'near',
            status: 'location_success',
            coords: resolvedCoords,
          },
        }));
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }
      if (activeRequestsRef.current[specialistId] !== reqId) {
        return;
      }
      console.error('Nearby search error:', err);
      let errMsg = 'Failed to fetch nearby medical providers.';
      if (err.response?.status === 504) {
        errMsg = 'The map data provider timed out while querying public servers. Please retry in a few moments.';
      } else if (err.response?.status === 502 || err.response?.status === 503) {
        errMsg = 'The external map data provider is currently unavailable. Please check your network or try again shortly.';
      } else if (err.response?.status === 429) {
        errMsg = 'Directory search rate limit reached. Please wait a moment before searching again.';
      } else if (err.response?.status === 404) {
        errMsg = err.response?.data?.detail || 'Location could not be found. Please check spelling or try a nearby city.';
      } else if (err.response?.data?.detail) {
        errMsg = err.response.data.detail;
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errMsg = 'Search request timed out. Please check your connection and retry.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setPlacesError((prev) => ({ ...prev, [specialistId]: errMsg }));
    } finally {
      if (activeRequestsRef.current[specialistId] === reqId) {
        setPlacesLoading((prev) => ({ ...prev, [specialistId]: false }));
      }
    }
  };

  const handleFindNearMe = (specialistId: string) => {
    const current = cardPanels[specialistId];
    if (current?.type === 'near' && !placesLoading[specialistId]) {
      dismissPanel(specialistId);
      return;
    }

    const defaultCategory = cardCategory[specialistId] || CATEGORY_MAP[specialistId] || 'hospitals';
    setCardCategory((prev) => ({ ...prev, [specialistId]: defaultCategory }));
    setActiveCategory(defaultCategory);

    const radius = cardRadius[specialistId] || selectedRadius || 5000;
    setCardRadius((prev) => ({ ...prev, [specialistId]: radius }));
    const query = cardQuery[specialistId] ?? manualQuery;

    // If we already have coordinates from this session, trigger search directly
    if (sessionCoords) {
      setCardPanels((prev) => ({
        ...prev,
        [specialistId]: {
          type: 'near',
          status: 'location_success',
          coords: sessionCoords,
        },
      }));
      runNearbyApiSearch(specialistId, defaultCategory, sessionCoords, radius, query);
      return;
    }

    if (!navigator.geolocation) {
      setCardPanels((prev) => ({
        ...prev,
        [specialistId]: {
          type: 'near',
          status: 'location_error',
          message: 'Geolocation is not supported by your current browser environment. You can enter an area or city name below.',
        },
      }));
      return;
    }

    setCardPanels((prev) => ({
      ...prev,
      [specialistId]: {
        type: 'near',
        status: 'loading',
        message: 'Requesting device location…',
      },
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setSessionCoords(coords);
        setCardPanels((prev) => ({
          ...prev,
          [specialistId]: {
            type: 'near',
            status: 'location_success',
            coords,
          },
        }));

        runNearbyApiSearch(specialistId, defaultCategory, coords, radius, query);
      },
      (error) => {
        let msg = 'Unable to determine your device location.';
        let status: 'location_denied' | 'location_error' = 'location_error';

        if (error.code === error.PERMISSION_DENIED) {
          status = 'location_denied';
          msg = 'Location permission was denied. You can search by entering your city, postal code, or area below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable from your device or network. You can enter an area manually.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'The location request timed out. Please try again or enter your area manually.';
        }

        setCardPanels((prev) => ({
          ...prev,
          [specialistId]: {
            type: 'near',
            status,
            message: msg,
          },
        }));
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleOnlineOptions = (specialistId: string) => {
    const current = cardPanels[specialistId];
    if (current?.type === 'online') {
      dismissPanel(specialistId);
      return;
    }

    setCardPanels((prev) => ({
      ...prev,
      [specialistId]: {
        type: 'online',
        status: 'online_info',
      },
    }));
  };

  const dismissPanel = (specialistId: string) => {
    abortControllersRef.current[specialistId]?.abort();
    setCardPanels((prev) => ({ ...prev, [specialistId]: null }));
  };

  const handleCategoryChange = (specialistId: string, newCat: string) => {
    setCardCategory((prev) => ({ ...prev, [specialistId]: newCat }));
    setActiveCategory(newCat);
    const panel = cardPanels[specialistId];
    const coords = panel?.coords || sessionCoords;
    const radius = cardRadius[specialistId] || selectedRadius || 5000;
    const query = cardQuery[specialistId] ?? manualQuery;
    runNearbyApiSearch(specialistId, newCat, coords, radius, query);
  };

  const handleRadiusChange = (specialistId: string, newRadius: number) => {
    setCardRadius((prev) => ({ ...prev, [specialistId]: newRadius }));
    setSelectedRadius(newRadius);
    const panel = cardPanels[specialistId];
    const coords = panel?.coords || sessionCoords;
    const cat = cardCategory[specialistId] || CATEGORY_MAP[specialistId] || 'hospitals';
    const query = cardQuery[specialistId] ?? manualQuery;
    runNearbyApiSearch(specialistId, cat, coords, newRadius, query);
  };

  const handleManualSearchSubmit = (e: React.FormEvent, specialistId: string) => {
    e.preventDefault();
    const query = (cardQuery[specialistId] ?? manualQuery).trim();
    const cat = cardCategory[specialistId] || CATEGORY_MAP[specialistId] || 'hospitals';
    const radius = cardRadius[specialistId] || selectedRadius || 5000;

    if (!query && !sessionCoords) {
      setPlacesError((prev) => ({
        ...prev,
        [specialistId]: 'Please enter a city, postal code, or area name to search.',
      }));
      return;
    }

    if (query) {
      runNearbyApiSearch(specialistId, cat, null, radius, query);
    } else {
      const panel = cardPanels[specialistId];
      const coords = panel?.coords || sessionCoords;
      runNearbyApiSearch(specialistId, cat, coords, radius, '');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '5rem' }}>
        <LoadingSpinner message="MATCHING SPECIALISTS" size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Stethoscope size={20} color="var(--accent)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.01em' }}>
            SPECIALIST MATCH
          </h1>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--text-muted)', letterSpacing: '.06em' }}>
          Professional support recommendations and verified nearby clinical directory
        </p>
        {meta && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Avg mood: <span style={{ color: 'var(--accent-bright)' }}>{meta.avg_mood?.toFixed(1)}/10</span> // Based on{' '}
            <span style={{ color: 'var(--accent-bright)' }}>{meta.based_on} entries</span>
          </div>
        )}
      </div>

      {/* Immediate Crisis Support Notice */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.9rem 1.1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '1.75rem',
        }}
      >
        <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#fca5a5', letterSpacing: '0.06em' }}>
              CRISIS & IMMEDIATE EMERGENCY SUPPORT
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              24/7 Free & Confidential
            </span>
          </div>
          <p style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0', lineHeight: 1.5 }}>
            The clinician directory is for scheduled outpatient visits. If you or someone you know is in acute danger or experiencing a mental health emergency, connect immediately to crisis care:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href="tel:988"
              className="btn btn-danger btn-sm"
              style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Phone size={12} /> 988 Lifeline (USA & Canada)
            </a>
            <a
              href="tel:14416"
              className="btn btn-danger btn-sm"
              style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Phone size={12} /> Tele-MANAS (14416 / 1800-891-4416)
            </a>
            <a
              href="tel:112"
              className="btn btn-danger btn-sm"
              style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <ShieldAlert size={12} /> Dial Emergency (112 / 911)
            </a>
          </div>
        </div>
      </div>

      {/* Specialist Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="stagger-children">
        {recs.map((r, i) => {
          const open = expanded === r.id;
          const panel = cardPanels[r.id];
          const isLocating = panel?.type === 'near' && panel?.status === 'loading';
          const isSearchingPlaces = placesLoading[r.id];
          const resultsData = placesData[r.id];
          const currentPlacesError = placesError[r.id];
          const currentCategory = cardCategory[r.id] || CATEGORY_MAP[r.id] || 'hospitals';
          const currentRadius = cardRadius[r.id] || selectedRadius || 5000;
          const currentQuery = cardQuery[r.id] ?? manualQuery;
          const currentCatDef = DIRECTORY_CATEGORIES.find((c) => c.id === currentCategory) || DIRECTORY_CATEGORIES[0];

          return (
            <div
              key={r.id}
              className="card animate-fade-in-up"
              style={{
                borderColor: `${r.color}44`,
                animationDelay: `${i * 0.08}s`,
                padding: 0,
                overflow: 'hidden',
              }}
            >
              {/* Card top stripe */}
              <div style={{ height: '3px', background: `linear-gradient(90deg, ${r.color}, transparent)` }} />

              <div style={{ padding: '1.5rem' }}>
                {/* Header row */}
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => setExpanded(open ? null : r.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{r.icon}</span>
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            letterSpacing: '.02em',
                          }}
                        >
                          {r.specialty}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                          <span className="badge" style={{ background: `${r.color}18`, color: r.color, border: `1px solid ${r.color}44` }}>
                            {r.match_strength}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', color: 'var(--text-muted)' }}>
                            ⏱ {r.urgency}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '.84rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                      {r.why}
                    </p>
                  </div>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px',
                      marginLeft: '1rem',
                      flexShrink: 0,
                    }}
                    aria-label={open ? 'Collapse specialist details' : 'Expand specialist details'}
                  >
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Expanded */}
                {open && (
                  <div className="animate-fade-in-up" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: `1px solid ${r.color}22` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                      {/* Helps with */}
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '.65rem',
                            color: 'var(--text-muted)',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            marginBottom: '8px',
                          }}
                        >
                          HELPS WITH
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {r.helps_with.map((h) => (
                            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                                {h}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* How to prepare */}
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '.65rem',
                            color: 'var(--text-muted)',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            marginBottom: '8px',
                          }}
                        >
                          HOW TO PREPARE
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {r.prepare.map((p, pi) => (
                            <div key={pi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', color: r.color, flexShrink: 0, marginTop: '2px' }}>
                                {pi + 1}.
                              </span>
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {p}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Modalities */}
                    <div style={{ padding: '10px 14px', background: `${r.color}0c`, border: `1px solid ${r.color}22`, borderRadius: '6px', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', color: r.color, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                        APPROACH:{' '}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                        {r.modalities}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        style={{
                          background: r.color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: isLocating || isSearchingPlaces ? 0.75 : 1,
                          cursor: isLocating || isSearchingPlaces ? 'wait' : 'pointer',
                        }}
                        disabled={isLocating || isSearchingPlaces}
                        onClick={() => handleFindNearMe(r.id)}
                      >
                        {isLocating || isSearchingPlaces ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Calendar size={13} />
                        )}
                        {isLocating
                          ? 'LOCATING…'
                          : isSearchingPlaces
                            ? `SEARCHING ${currentCatDef.label.toUpperCase()}…`
                            : 'FIND NEAR ME'}
                      </button>

                      <button
                        className="btn btn-ghost"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderColor: panel?.type === 'online' ? r.color : undefined,
                          background: panel?.type === 'online' ? `${r.color}14` : undefined,
                        }}
                        onClick={() => handleOnlineOptions(r.id)}
                      >
                        <MapPin size={13} /> ONLINE OPTIONS
                      </button>
                    </div>

                    {/* In-app action feedback / directory search panel */}
                    {panel && (
                      <div
                        className="animate-fade-in-up"
                        style={{
                          marginTop: '1.25rem',
                          padding: '1.25rem',
                          background: 'var(--bg-elevated)',
                          border: `1px solid ${
                            panel.status === 'location_denied' || currentPlacesError
                              ? 'rgba(239, 68, 68, 0.35)'
                              : panel.status === 'location_success'
                                ? 'rgba(39, 184, 255, 0.35)'
                                : 'var(--border-mid)'
                          }`,
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        {/* Panel Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {panel.type === 'near' ? (
                              isLocating || isSearchingPlaces ? (
                                <Loader2 size={15} className="animate-spin" color="var(--accent)" />
                              ) : panel.status === 'location_success' ? (
                                <CheckCircle2 size={15} color="#22c55e" />
                              ) : (
                                <AlertCircle size={15} color="#ef4444" />
                              )
                            ) : (
                              <Stethoscope size={15} color={r.color} />
                            )}

                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color:
                                  panel.status === 'location_success'
                                    ? '#38bdf8'
                                    : panel.status === 'location_denied' || currentPlacesError
                                      ? '#fca5a5'
                                      : 'var(--text-primary)',
                              }}
                            >
                              {panel.type === 'near'
                                ? isLocating
                                  ? 'Detecting Location…'
                                  : isSearchingPlaces
                                    ? `Searching Nearby ${currentCatDef.label}…`
                                    : panel.status === 'location_success'
                                      ? `Nearby Clinical Directory · ${currentCatDef.label}`
                                      : panel.status === 'location_denied'
                                        ? 'Location Access Denied'
                                        : `Nearby Clinical Directory · ${currentCatDef.label}`
                                : `Online Options · ${r.specialty}`}
                            </span>
                          </div>

                          <button
                            onClick={() => dismissPanel(r.id)}
                            className="btn-ghost"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            aria-label="Dismiss panel"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Panel Content for Find Near Me */}
                        {panel.type === 'near' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Directory Controls: Category Filter, Radius Selector, Manual Area Search */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                padding: '10px 12px',
                                background: 'rgba(0,0,0,0.25)',
                                borderRadius: '6px',
                                border: '1px solid var(--border-dim)',
                              }}
                            >
                              {/* Category selection */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <Filter size={12} color="var(--accent)" />
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Search Category:
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {DIRECTORY_CATEGORIES.map((cat) => {
                                    const active = currentCategory === cat.id;
                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleCategoryChange(r.id, cat.id)}
                                        style={{
                                          background: active ? 'var(--accent)' : 'rgba(255, 255, 255, 0.04)',
                                          color: active ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                                          border: `1px solid ${active ? 'var(--accent-bright)' : 'var(--border-mid)'}`,
                                          borderRadius: '4px',
                                          padding: '3px 8px',
                                          fontSize: '0.72rem',
                                          fontFamily: 'var(--font-body)',
                                          cursor: 'pointer',
                                          transition: 'var(--transition)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <span>{cat.icon}</span>
                                        <span>{cat.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Radius selector & Manual Area Input Row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                {/* Radius Options */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Radius:
                                  </span>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {RADIUS_OPTIONS.map((opt) => {
                                      const active = currentRadius === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => handleRadiusChange(r.id, opt.value)}
                                          style={{
                                            background: active ? 'rgba(39, 184, 255, 0.18)' : 'transparent',
                                            color: active ? '#38bdf8' : 'var(--text-muted)',
                                            border: `1px solid ${active ? 'rgba(39, 184, 255, 0.45)' : 'var(--border-mid)'}`,
                                            borderRadius: '4px',
                                            padding: '2px 7px',
                                            fontSize: '0.68rem',
                                            fontFamily: 'var(--font-mono)',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Manual location/city search form (essential when geolocation is denied or unavailable) */}
                                <form
                                  onSubmit={(e) => handleManualSearchSubmit(e, r.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', maxWidth: '360px' }}
                                >
                                  <div style={{ position: 'relative', width: '100%' }}>
                                    <input
                                      type="text"
                                      placeholder="City, state, or area..."
                                      value={currentQuery}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setCardQuery((prev) => ({ ...prev, [r.id]: val }));
                                        setManualQuery(val);
                                      }}
                                      className="input-base"
                                      style={{
                                        fontSize: '0.74rem',
                                        padding: '5px 8px 5px 26px',
                                        height: '28px',
                                      }}
                                    />
                                    <Search
                                      size={12}
                                      color="var(--text-muted)"
                                      style={{ position: 'absolute', left: '8px', top: '8px', pointerEvents: 'none' }}
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem', height: '28px', flexShrink: 0 }}
                                    disabled={isSearchingPlaces}
                                  >
                                    SEARCH
                                  </button>
                                </form>
                              </div>
                            </div>

                            {/* Status and Error Alerts */}
                            {panel.status === 'loading' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '10px 0' }}>
                                <Loader2 size={16} className="animate-spin" color="var(--accent)" />
                                <span>Requesting browser geolocation permission to identify your local coverage area…</span>
                              </div>
                            )}

                            {panel.status === 'location_denied' && !resultsData && (
                              <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: '#fca5a5' }}>
                                  {panel.message}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Type your city or area in the search bar above to query facilities without sharing device GPS.
                                </p>
                              </div>
                            )}

                            {panel.status === 'location_error' && !resultsData && (
                              <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#fca5a5' }}>
                                  {panel.message}
                                </p>
                              </div>
                            )}

                            {currentPlacesError && (
                              <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <div style={{ flex: 1, fontSize: '0.78rem', color: '#fca5a5', lineHeight: 1.5 }}>
                                    <strong>Directory Notice:</strong> {currentPlacesError}
                                    <div style={{ marginTop: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => runNearbyApiSearch(r.id, currentCategory, panel.coords || sessionCoords, currentRadius, currentQuery, true)}
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                      >
                                        <RefreshCw size={11} /> RETRY SEARCH
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Searching Indicator */}
                            {isSearchingPlaces && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                <Loader2 size={20} className="animate-spin" color="var(--accent)" />
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', letterSpacing: '0.05em' }}>
                                  QUERYING OPENSTREETMAP HEALTHCARE DIRECTORY…
                                </span>
                              </div>
                            )}

                            {/* Results List */}
                            {!isSearchingPlaces && resultsData && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  <span>
                                    Found <strong style={{ color: 'var(--text-primary)' }}>{resultsData.count}</strong> places for{' '}
                                    <span style={{ color: 'var(--accent-bright)' }}>{resultsData.category_label}</span>
                                    {resultsData.query_used ? ` · "${resultsData.query_used}"` : ` within ${(resultsData.radius_meters / 1000).toFixed(0)} km`}
                                  </span>
                                  <span>Sorted by proximity (nearest first)</span>
                                </div>

                                {resultsData.results.length === 0 ? (
                                  <div
                                    style={{
                                      padding: '1.5rem',
                                      textAlign: 'center',
                                      background: 'rgba(255, 255, 255, 0.02)',
                                      borderRadius: '6px',
                                      border: '1px dashed var(--border-mid)',
                                    }}
                                  >
                                    <MapPin size={22} color="var(--text-muted)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                      No Facilities Found In This Radius
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 10px auto' }}>
                                      No facilities matching <strong style={{ color: 'var(--text-primary)' }}>{currentCatDef.label}</strong> were returned within {(resultsData.radius_meters / 1000).toFixed(0)} km. Try expanding your radius to 25 km or 50 km, or enter a nearby city in the search box.
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleRadiusChange(r.id, 25000)}
                                        className="btn btn-ghost btn-sm"
                                      >
                                        Try 25 km
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRadiusChange(r.id, 50000)}
                                        className="btn btn-ghost btn-sm"
                                      >
                                        Try 50 km
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {resultsData.results.map((place: NearbyPlaceItem) => (
                                      <div
                                        key={place.id}
                                        style={{
                                          padding: '12px 14px',
                                          background: 'rgba(255, 255, 255, 0.025)',
                                          border: '1px solid var(--border-mid)',
                                          borderRadius: '8px',
                                          transition: 'var(--transition)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '8px',
                                        }}
                                      >
                                        {/* Top Place Name & Status */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                              <h4
                                                style={{
                                                  fontFamily: 'var(--font-display)',
                                                  fontSize: '0.96rem',
                                                  fontWeight: 700,
                                                  color: 'var(--text-primary)',
                                                  margin: 0,
                                                }}
                                              >
                                                {place.name}
                                              </h4>

                                              {place.primary_type && (
                                                <span className="badge badge-accent" style={{ fontSize: '0.62rem', padding: '1px 7px' }}>
                                                  {place.primary_type}
                                                </span>
                                              )}

                                              {typeof place.open_now === 'boolean' && (
                                                <span
                                                  className="badge"
                                                  style={{
                                                    fontSize: '0.62rem',
                                                    padding: '1px 7px',
                                                    background: place.open_now ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: place.open_now ? '#4ade80' : '#fca5a5',
                                                    border: `1px solid ${place.open_now ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                                                  }}
                                                >
                                                  {place.open_now ? 'OPEN NOW' : 'CLOSED'}
                                                </span>
                                              )}
                                            </div>

                                            {place.address && (
                                              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <MapPin size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                <span>{place.address}</span>
                                              </p>
                                            )}
                                          </div>

                                          {/* Distance & Rating Badges */}
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                            {typeof place.distance_km === 'number' && (
                                              <span
                                                style={{
                                                  fontFamily: 'var(--font-mono)',
                                                  fontSize: '0.72rem',
                                                  fontWeight: 700,
                                                  color: '#38bdf8',
                                                  background: 'rgba(56, 189, 248, 0.1)',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                }}
                                              >
                                                {place.distance_km.toFixed(1)} km
                                              </span>
                                            )}

                                            {typeof place.rating === 'number' && (
                                              <span
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '3px',
                                                  fontFamily: 'var(--font-mono)',
                                                  fontSize: '0.7rem',
                                                  color: '#fcd34d',
                                                }}
                                              >
                                                <Star size={11} fill="#fcd34d" color="#fcd34d" />
                                                <strong>{place.rating.toFixed(1)}</strong>
                                                {typeof place.user_rating_count === 'number' && (
                                                  <span style={{ color: 'var(--text-muted)' }}>({place.user_rating_count})</span>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Actions row */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            {place.directions_uri && (
                                              <a
                                                href={place.directions_uri}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-primary btn-sm"
                                                style={{ textDecoration: 'none', padding: '3px 9px', fontSize: '0.72rem' }}
                                                title="Get turn-by-turn directions"
                                              >
                                                <Navigation size={11} /> GET DIRECTIONS
                                              </a>
                                            )}

                                            {place.osm_url && (
                                              <a
                                                href={place.osm_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-ghost btn-sm"
                                                style={{ textDecoration: 'none', padding: '3px 9px', fontSize: '0.72rem' }}
                                                title="View record on OpenStreetMap"
                                              >
                                                <MapPin size={11} /> OSM RECORD
                                              </a>
                                            )}

                                            {place.phone && (
                                              <a
                                                href={`tel:${place.phone.replace(/[^0-9+]/g, '')}`}
                                                className="btn btn-ghost btn-sm"
                                                style={{ textDecoration: 'none', padding: '3px 9px', fontSize: '0.72rem' }}
                                              >
                                                <Phone size={11} /> {place.phone}
                                              </a>
                                            )}

                                            {place.website && (
                                              <a
                                                href={place.website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-ghost btn-sm"
                                                style={{ textDecoration: 'none', padding: '3px 9px', fontSize: '0.72rem' }}
                                              >
                                                <ExternalLink size={11} /> WEBSITE
                                              </a>
                                            )}
                                          </div>

                                          {/* OpenStreetMap Attribution Line */}
                                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                                            {resultsData.attribution || 'Data © OpenStreetMap contributors'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Panel Content for Online Options */}
                        {panel.type === 'online' && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
                            <p style={{ margin: '0 0 10px 0' }}>
                              Direct commercial appointment booking for <strong style={{ color: 'var(--text-primary)' }}>{r.specialty}</strong> is currently non-integrated. Use verified national tele-health services and accredited directories below:
                            </p>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                              Verified Tele-Health & Counselling Directories
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <a
                                href="https://telemanas.mohfw.gov.in/"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid var(--border-mid)',
                                  borderRadius: '6px',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  fontSize: '0.78rem',
                                  transition: 'var(--transition)',
                                }}
                              >
                                <span>Tele-MANAS (Govt. of India 24/7 Tele-Mental Health)</span>
                                <ExternalLink size={12} color="var(--accent)" />
                              </a>
                              <a
                                href="https://icallhelpline.org/"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid var(--border-mid)',
                                  borderRadius: '6px',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  fontSize: '0.78rem',
                                  transition: 'var(--transition)',
                                }}
                              >
                                <span>iCall Psychosocial Counselling Directory (TISS)</span>
                                <ExternalLink size={12} color="var(--accent)" />
                              </a>
                              <Link
                                to="/help"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'rgba(56, 189, 248, 0.06)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  borderRadius: '6px',
                                  color: '#38bdf8',
                                  textDecoration: 'none',
                                  fontSize: '0.78rem',
                                  transition: 'var(--transition)',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <ShieldAlert size={13} color="#38bdf8" />
                                  View all Crisis Support & Resources in ShadowMind
                                </span>
                                <span>→</span>
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      {meta && (
        <div style={{ marginTop: '2rem', display: 'flex', gap: '10px', padding: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)', borderRadius: '8px' }}>
          <AlertCircle size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.63rem', color: 'var(--text-muted)', lineHeight: 1.65, letterSpacing: '.02em' }}>
            {meta.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
