
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Server, 
  LogOut, 
  Search, 
  Plus, 
  AlertTriangle,
  FileText,
  Package,
  PlusCircle,
  XCircle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Info,
  Database,
  Clock,
  ShieldCheck,
  UserCheck,
  Trash2,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  Terminal,
  Copy,
  RefreshCw,
  Trash
} from 'lucide-react';
import { createClient, User } from '@supabase/supabase-js';
import { AppData, Service, ServiceType, Currency, ExpiryStatus, AdditionalService } from './types';
import { 
  formatCurrency, 
  getExpiryStatus, 
  generateId, 
  getDaysRemaining 
} from './utils/helpers';
import Modal from './components/Modal';

// Supabase Initialization
const supabaseUrl = 'https://yvqiyegopttiqlclxfxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cWl5ZWdvcHR0aXFsY2x4Znh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMzUzOTksImV4cCI6MjA4MTkxMTM5OX0.FkXfHMugNRcPAEh3U3jCicjHeDaLAOYqQfqiCPbWLRc';
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY = 'creasion_crm_v4_data';
const APPROVED_USER = 'shahaaseesh@gmail.com'.toLowerCase();

const SQL_SETUP_SCRIPT = `-- 🔥 FORCE RESET & RECREATE TABLE
-- This will delete the broken table and create the correct schema.
DROP TABLE IF EXISTS crm_state;

CREATE TABLE crm_state (
  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE crm_state ENABLE ROW LEVEL SECURITY;

-- Create Security Policy
DROP POLICY IF EXISTS "Users can only access their own state" ON crm_state;
CREATE POLICY "Users can only access their own state"
  ON crm_state FOR ALL
  USING ( auth.uid() = user_id );`.trim();

const DEFAULT_DATA: AppData = {
  clients: [],
  services: [],
  credentials: [],
  settings: {
    masterPasswordHash: '',
    appPasswordHash: '',
    lastBackup: new Date().toISOString()
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services'>('dashboard');
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail] = useState(APPROVED_USER);
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [dbSetupRequired, setDbSetupRequired] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline' | 'error'>('connected');
  
  const [formType, setFormType] = useState<ServiceType>('both');
  const [formIsSynced, setFormIsSynced] = useState(true);
  const [formAdditionalServices, setFormAdditionalServices] = useState<AdditionalService[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user?.email?.toLowerCase() === APPROVED_USER) {
          setUser(session.user);
          loadFromCloud(session.user.id);
        } else if (session?.user) {
          await handleLogout();
        }
      } catch (err: any) {
        console.error("Auth init failed:", err.message || err);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user;
      if (currentUser?.email?.toLowerCase() === APPROVED_USER) {
        setUser(currentUser);
        loadFromCloud(currentUser.id);
      } else {
        setUser(null);
        setData(DEFAULT_DATA);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync Logic
  const syncToCloud = async (newData: AppData, userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('crm_state')
        .upsert({ 
          user_id: targetId, 
          content: newData, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      setDbStatus('connected');
      setDbSetupRequired(false);
    } catch (e: any) {
      console.error("Supabase sync failed:", e.message || JSON.stringify(e));
      setDbStatus('error');
      
      // Error code 42703 is "Undefined Column" in Postgres
      if (e.code === '42703' || e.code === '42P01' || e.message?.includes('user_id')) {
        setDbSetupRequired(true);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromCloud = async (userId: string) => {
    setIsSyncing(true);
    try {
      const { data: record, error } = await supabase
        .from('crm_state')
        .select('content')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          syncToCloud(DEFAULT_DATA, userId);
          return;
        }
        // Column missing or table missing
        if (error.code === '42P01' || error.code === '42703' || error.message?.includes('user_id')) {
          setDbSetupRequired(true);
          setDbStatus('error');
          return;
        }
        throw error;
      }
      
      if (record?.content) {
        setData(record.content);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record.content));
        setDbStatus('connected');
        setDbSetupRequired(false);
      }
    } catch (e: any) {
      console.error("Supabase load failed:", e.message || JSON.stringify(e));
      setDbStatus('error');
      if (e.code === '42703' || e.message?.includes('user_id')) {
        setDbSetupRequired(true);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const updateData = (newData: AppData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    syncToCloud(newData);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ 
          email: authEmail, 
          password: authPassword 
        });
        if (error) throw error;
        setAuthError("Account created! Verify your email then login.");
        setIsRegistering(false);
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ 
          email: authEmail, 
          password: authPassword 
        });
        if (error) throw error;
        
        if (authData.user && authData.user.email?.toLowerCase() === APPROVED_USER) {
          setUser(authData.user);
          loadFromCloud(authData.user.id);
        } else {
          throw new Error("Unauthorized identity.");
        }
      }
    } catch (error: any) {
      console.error("Auth action failed:", error.message || JSON.stringify(error));
      setAuthError(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setData(DEFAULT_DATA);
      setDbSetupRequired(false);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addAdditionalServiceField = () => {
    setFormAdditionalServices(prev => [
      ...prev,
      { id: generateId(), name: '', cost: 0, costCurrency: 'NPR', charge: 0, chargeCurrency: 'INR' }
    ]);
  };

  const removeAdditionalServiceField = (id: string) => {
    setFormAdditionalServices(prev => prev.filter(s => s.id !== id));
  };

  const updateAdditionalServiceField = (id: string, updates: Partial<AdditionalService>) => {
    setFormAdditionalServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const saveService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as ServiceType;
    const isSynced = formData.get('isSynced') === 'on';
    const clientNameInput = (formData.get('clientName') as string).trim();
    
    let targetClientId = '';
    const existingClient = data.clients.find(c => c.name.toLowerCase() === clientNameInput.toLowerCase());
    let updatedClients = [...data.clients];

    if (existingClient) {
      targetClientId = existingClient.id;
    } else {
      const newClientId = generateId();
      updatedClients.push({
        id: newClientId,
        name: clientNameInput,
        email: '',
        phone: '',
        notes: 'Auto-created',
        createdAt: new Date().toISOString()
      });
      targetClientId = newClientId;
    }
    
    const serviceData: Service = {
      id: editItem?.id || generateId(),
      clientId: targetClientId,
      type,
      isSynced,
      domainName: (formData.get('domainName') as string) || '',
      registrar: (formData.get('registrar') as string) || '',
      domainCost: parseFloat(formData.get('domainCost') as string || '0'),
      domainCostCurrency: formData.get('domainCostCurrency') as Currency,
      domainCharge: parseFloat(formData.get('domainCharge') as string || '0'),
      domainChargeCurrency: formData.get('domainChargeCurrency') as Currency,
      domainExpiry: (formData.get('domainExpiry') as string) || '',
      hostingProvider: isSynced ? (formData.get('registrar') as string) : (formData.get('hostingProvider') as string),
      hostingPlan: (formData.get('hostingPlan') as string) || '',
      hostingCost: parseFloat(formData.get('hostingCost') as string || '0'),
      hostingCostCurrency: formData.get('hostingCostCurrency') as Currency,
      hostingCharge: parseFloat(formData.get('hostingCharge') as string || '0'),
      hostingChargeCurrency: formData.get('hostingChargeCurrency') as Currency,
      hostingExpiry: isSynced ? (formData.get('domainExpiry') as string) : (formData.get('hostingExpiry') as string),
      hostingServerIp: (formData.get('hostingServerIp') as string) || '',
      hostingCpUrl: (formData.get('hostingCpUrl') as string) || '',
      additionalServices: formAdditionalServices,
      notes: (formData.get('notes') as string) || '',
      createdAt: editItem?.createdAt || new Date().toISOString()
    };

    updateData({
      ...data,
      clients: updatedClients,
      services: editItem 
        ? data.services.map(s => s.id === editItem.id ? serviceData : s)
        : [...data.services, serviceData]
    });
    setIsModalOpen(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm('Are you sure you want to delete this service record?')) {
      updateData({
        ...data,
        services: data.services.filter(s => s.id !== id)
      });
    }
  };

  const stats = useMemo(() => {
    const alerts: any[] = [];
    
    data.services.forEach(s => {
      if (s.type === 'domain' || s.type === 'both') {
        if (getExpiryStatus(s.domainExpiry || '') !== ExpiryStatus.ACTIVE) alerts.push({ label: s.domainName, expiry: s.domainExpiry, clientId: s.clientId });
      }
      if (s.type === 'hosting' || (s.type === 'both' && !s.isSynced)) {
        if (getExpiryStatus(s.hostingExpiry || '') !== ExpiryStatus.ACTIVE) alerts.push({ label: s.hostingProvider || s.hostingPlan, expiry: s.hostingExpiry, clientId: s.clientId });
      }
      s.additionalServices?.forEach(as => {
        if (as.expiry && getExpiryStatus(as.expiry) !== ExpiryStatus.ACTIVE) alerts.push({ label: as.name, expiry: as.expiry, clientId: s.clientId });
      });
    });
    return { alerts };
  }, [data]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {!user ? (
        <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 bg-indigo-50 w-40 h-40 rounded-full opacity-50"></div>
            <div className="flex flex-col items-center mb-8 text-center relative z-10">
              <div className="bg-indigo-600 p-4 rounded-3xl mb-4 text-white shadow-xl shadow-indigo-500/20">
                <ShieldCheck size={40} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">CREASION CRM</h1>
              <p className="text-slate-500 mt-1 font-bold uppercase text-[10px] tracking-[0.2em]">Restricted Access Portal</p>
            </div>
            
            {authError && (
              <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-sm font-bold border-2 animate-in fade-in duration-300 bg-rose-50 text-rose-700 border-rose-100`}>
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="break-words">{authError}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 px-2">Operator Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={authEmail}
                    readOnly
                    className="w-full pl-12 pr-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-400 rounded-2xl outline-none font-bold cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 px-2">Security Key</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 border-2 border-slate-200 bg-white text-slate-900 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold placeholder:text-slate-300"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={authLoading}
                className={`w-full text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${isRegistering ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}
              >
                {authLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'CREATE ACCOUNT' : 'UNSEAL PORTAL')}
              </button>
            </form>

            <div className="mt-8 text-center relative z-10 flex flex-col gap-4">
              <button 
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
                className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] hover:text-indigo-600 transition-colors"
              >
                {isRegistering ? 'Return to Login' : 'Need to setup your key? Click here'}
              </button>
              <p className="text-slate-300 font-bold uppercase text-[8px] tracking-[0.3em]">Authorized Personnel Only</p>
            </div>
          </div>
        </div>
      ) : dbSetupRequired ? (
        <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-8">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-2xl border-2 border-rose-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Trash size={200} /></div>
            <div className="flex items-center gap-4 mb-6">
               <div className="bg-rose-100 p-4 rounded-[2rem] text-rose-600"><Database size={32} /></div>
               <h2 className="text-3xl font-black text-slate-900 tracking-tight">Database Schema Mismatch</h2>
            </div>
            <p className="text-slate-600 font-bold text-lg mb-8 leading-relaxed">
              The <code className="bg-slate-100 px-2 py-1 rounded-lg text-rose-600">crm_state</code> table exists but lacks the required <code className="bg-slate-100 px-2 py-1 rounded-lg text-rose-600">user_id</code> column.
            </p>
            
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 shadow-inner border border-white/10 relative group">
                <button 
                   onClick={() => { navigator.clipboard.writeText(SQL_SETUP_SCRIPT); alert("SQL copied to clipboard!"); }}
                   className="absolute top-6 right-6 p-3 bg-white/10 text-white/50 hover:text-white hover:bg-white/20 rounded-xl transition-all"
                >
                  <Copy size={16} />
                </button>
                <p className="text-[10px] font-black uppercase text-rose-400 mb-4 tracking-widest">Recreation SQL Script</p>
                <pre className="text-rose-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-60">
                  {SQL_SETUP_SCRIPT}
                </pre>
              </div>

              <div className="p-6 bg-rose-50/50 rounded-[2rem] border-2 border-rose-100">
                <h4 className="font-black text-rose-900 text-sm uppercase tracking-widest mb-4">Crucial Fix Steps:</h4>
                <ul className="text-xs font-bold text-slate-600 space-y-3 list-disc ml-4">
                  <li>Go to your <b>Supabase SQL Editor</b>.</li>
                  <li>Run the script above. <b>Note:</b> This will DROP (delete) the existing table and recreate it correctly. Any data currently in that specific table will be reset.</li>
                  <li>Click <b>Run</b> then click <b>Refresh</b> here.</li>
                </ul>
              </div>

              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-slate-900 text-white py-5 rounded-[2.5rem] font-black text-xl hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
              >
                <RefreshCw size={24} /> VERIFY RECONSTRUCTION
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col shrink-0 relative z-20">
            <div className="p-8 flex items-center space-x-3 border-b border-white/5">
              <div className="bg-indigo-600 p-2 rounded-xl text-white"><Package size={20} /></div>
              <span className="font-black text-white text-xl tracking-tighter">CREASION</span>
            </div>
            <nav className="flex-1 p-4 space-y-2 mt-4">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <LayoutDashboard size={20} /> <span className="font-bold">Dashboard</span>
              </button>
              <button onClick={() => setActiveTab('services')} className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all ${activeTab === 'services' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <Briefcase size={20} /> <span className="font-bold">CRM Tracker</span>
              </button>
            </nav>
            <div className="p-6 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                <span className="truncate max-w-[120px]">{user.email?.split('@')[0]}</span>
                <span className={`h-2 w-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
              </div>
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-bold">
                <LogOut size={16} /> <span>Lock Session</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white h-20 border-b flex items-center justify-between px-10 shrink-0 z-10 shadow-sm">
              <div className="flex items-center space-x-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{activeTab === 'services' ? 'Service Management' : 'System Overview'}</h2>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-6 py-2.5 border-2 border-slate-100 text-slate-900 rounded-2xl text-sm focus:border-indigo-500 bg-slate-50 w-80 font-medium outline-none placeholder:text-slate-400" />
                </div>
              </div>
              <button onClick={() => { setEditItem(null); setFormType('both'); setFormIsSynced(true); setFormAdditionalServices([]); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl flex items-center space-x-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest transition-all hover:-translate-y-0.5">
                <Plus size={20} className="stroke-[3]" /> <span>Provision New</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10">
              {activeTab === 'dashboard' ? (
                <div className="space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                      <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex items-center justify-between transition-transform hover:scale-[1.02]">
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><UserCheck size={14}/> Active Clients</p>
                          <p className="text-5xl font-black text-slate-900 tracking-tighter">{data.clients.length}</p>
                        </div>
                        <div className="bg-indigo-50 p-5 rounded-[2rem] text-indigo-500">
                          <Briefcase size={40} />
                        </div>
                      </div>
                      <div className="bg-white p-10 rounded-[2.5rem] border-2 border-rose-100 bg-rose-50/10 shadow-sm flex items-center justify-between transition-transform hover:scale-[1.02]">
                        <div>
                          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <Clock size={14}/> System Alerts
                          </p>
                          <p className="text-5xl font-black text-rose-600 tracking-tighter">{stats.alerts.length}</p>
                        </div>
                        <div className="bg-rose-100/50 p-5 rounded-[2rem] text-rose-500">
                           <AlertTriangle size={40} />
                        </div>
                      </div>
                   </div>
                   
                   <div className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                      <div className="px-8 py-5 border-b-2 border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Recent Tasks & Alerts</h3>
                        </div>
                        <div className="flex items-center gap-4">
                          {isSyncing && <Loader2 className="animate-spin text-slate-400" size={14} />}
                          <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-3 py-1 rounded-full">MONITORING</span>
                        </div>
                      </div>
                      <div className="divide-y-2 divide-slate-50">
                        {stats.alerts.length === 0 ? (
                          <div className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-sm italic">All systems nominal</div>
                        ) : (
                          stats.alerts.map((alert, i) => (
                            <div key={i} className="px-8 py-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                               <div>
                                 <p className="font-black text-slate-900 text-lg tracking-tight">{alert.label}</p>
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{data.clients.find(c => c.id === alert.clientId)?.name}</p>
                               </div>
                               <div className="text-right">
                                 <p className={`text-sm font-black uppercase tracking-tighter ${getDaysRemaining(alert.expiry) < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                   {getDaysRemaining(alert.expiry) < 0 ? 'EXPIRED' : `${getDaysRemaining(alert.expiry)} Days Left`}
                                 </p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1">{alert.expiry}</p>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                   </div>
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b-2 border-slate-100">
                      <tr>
                        <th className="px-6 py-6 w-14"></th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Client identity</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Active Assets</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Next Expiry</th>
                        <th className="px-6 py-6 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.services.filter(s => {
                        const c = data.clients.find(cli => cli.id === s.clientId);
                        return (s.domainName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (s.hostingPlan || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (c?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
                      }).map(service => {
                        const client = data.clients.find(c => c.id === service.clientId);
                        const isExpanded = !!expandedRows[service.id];
                        const allExpiries = [service.domainExpiry, service.hostingExpiry, ...(service.additionalServices?.map(as => as.expiry) || [])].filter(Boolean) as string[];
                        const nextExpiry = allExpiries.length > 0 ? allExpiries.reduce((a, b) => new Date(a) < new Date(b) ? a : b) : null;
                        
                        return (
                          <React.Fragment key={service.id}>
                            <tr className={`hover:bg-slate-50/80 transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleRow(service.id)}>
                              <td className="px-6 py-6 text-slate-400">
                                {isExpanded ? <ChevronUp size={20} className="stroke-[3]" /> : <ChevronDown size={20} className="stroke-[3]" />}
                              </td>
                              <td className="px-6 py-6">
                                <p className="font-black text-slate-900 tracking-tighter text-lg">{client?.name || 'Unknown'}</p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID: {service.id.slice(0, 8)}</p>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-wrap gap-2">
                                  {service.domainName && <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-indigo-100 flex items-center gap-1"><Globe size={10}/> {service.domainName}</span>}
                                  {service.hostingPlan && <span className="bg-orange-50 text-orange-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-orange-100 flex items-center gap-1"><Server size={10}/> {service.hostingPlan}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                {nextExpiry ? (
                                  <div>
                                    <p className={`text-sm font-black tracking-tighter ${getDaysRemaining(nextExpiry) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{nextExpiry}</p>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{getDaysRemaining(nextExpiry) < 0 ? 'EXPIRED' : `${getDaysRemaining(nextExpiry)}D Left`}</p>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-6 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end space-x-2">
                                  <button onClick={() => { setEditItem(service); setFormType(service.type); setFormIsSynced(service.isSynced); setFormAdditionalServices(service.additionalServices || []); setIsModalOpen(true); }} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><FileText size={20}/></button>
                                  <button onClick={() => deleteItem(service.id)} className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={5} className="px-10 py-10 border-l-4 border-indigo-500">
                                   <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                                      <div className="space-y-6">
                                         <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Globe size={14} className="text-indigo-500"/> INFRASTRUCTURE LOGS</h4>
                                         {(service.type === 'domain' || service.type === 'both') && (
                                           <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-4 shadow-sm relative overflow-hidden">
                                              <div className="absolute top-0 right-0 p-4 opacity-5"><Globe size={64}/></div>
                                              <p className="text-lg font-black text-slate-900 tracking-tighter">{service.domainName}</p>
                                              <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase text-slate-500">
                                                <div className="bg-slate-50 p-2 rounded-xl">Registrar: <span className="text-slate-900 block">{service.registrar || '-'}</span></div>
                                                <div className="bg-slate-50 p-2 rounded-xl">Expiry: <span className="text-slate-900 block">{service.domainExpiry || '-'}</span></div>
                                              </div>
                                              <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between gap-4">
                                                <div className="flex-1">
                                                  <p className="text-[9px] font-black text-rose-800 uppercase">INTERNAL COST</p>
                                                  <p className="text-sm font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 inline-block w-full">{formatCurrency(service.domainCost || 0, service.domainCostCurrency)}</p>
                                                </div>
                                                <div className="flex-1 text-right">
                                                  <p className="text-[9px] font-black text-emerald-800 uppercase">SELLING PRICE</p>
                                                  <p className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 inline-block w-full">{formatCurrency(service.domainCharge || 0, service.domainChargeCurrency)}</p>
                                                </div>
                                              </div>
                                           </div>
                                         )}
                                         {(service.type === 'hosting' || service.type === 'both') && (
                                           <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-4 shadow-sm relative overflow-hidden">
                                              <div className="absolute top-0 right-0 p-4 opacity-5"><Server size={64}/></div>
                                              <p className="text-lg font-black text-slate-900 tracking-tighter">{service.hostingPlan}</p>
                                              <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase text-slate-500">
                                                <div className="bg-slate-50 p-2 rounded-xl">Provider: <span className="text-slate-900 block">{service.hostingProvider || '-'}</span></div>
                                                <div className="bg-slate-50 p-2 rounded-xl">Server IP: <span className="text-slate-900 block">{service.hostingServerIp || '-'}</span></div>
                                              </div>
                                              <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between gap-4">
                                                <div className="flex-1">
                                                  <p className="text-[9px] font-black text-rose-800 uppercase">OPERATING COST</p>
                                                  <p className="text-sm font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 inline-block w-full">{formatCurrency(service.hostingCost || 0, service.hostingCostCurrency)}</p>
                                                </div>
                                                <div className="flex-1 text-right">
                                                  <p className="text-[9px] font-black text-emerald-800 uppercase">CLIENT CHARGE</p>
                                                  <p className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 inline-block w-full">{formatCurrency(service.hostingCharge || 0, service.hostingChargeCurrency)}</p>
                                                </div>
                                              </div>
                                           </div>
                                         )}
                                      </div>

                                      <div className="space-y-6">
                                         <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14} className="text-indigo-500"/> SYSTEM ADD-ONS</h4>
                                         <div className="space-y-4">
                                           {service.additionalServices?.map((as, i) => (
                                             <div key={i} className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-3 shadow-sm hover:border-indigo-200 transition-colors">
                                               <p className="font-black text-slate-900 text-md tracking-tight">{as.name}</p>
                                               {as.expiry && <p className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block">Renew: {as.expiry}</p>}
                                               <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-slate-50 border-dotted">
                                                  <p className="text-xs font-black text-rose-700">Cost: {formatCurrency(as.cost, as.costCurrency)}</p>
                                                  <p className="text-xs font-black text-emerald-700 text-right">Charge: {formatCurrency(as.charge, as.chargeCurrency)}</p>
                                               </div>
                                             </div>
                                           ))}
                                           {(!service.additionalServices || service.additionalServices.length === 0) && (
                                             <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                                                <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">No extra services linked</p>
                                             </div>
                                           )}
                                         </div>
                                      </div>

                                      <div className="space-y-6">
                                         <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-indigo-500"/> JOURNAL & NOTES</h4>
                                         <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl min-h-[250px] relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Database size={120}/></div>
                                            <p className="relative z-10 text-sm font-medium leading-relaxed opacity-90 whitespace-pre-wrap">{service.notes || 'No administrative notes recorded for this cycle.'}</p>
                                            <div className="mt-8 pt-6 border-t border-white/10 text-[9px] font-black uppercase opacity-50 tracking-widest flex justify-between">
                                               <span>CRM UUID: {service.id}</span>
                                               <span className="text-indigo-400">SECURE LOG</span>
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editItem ? 'Edit Provision Record' : 'Create New Provision'}>
             <form onSubmit={saveService} className="space-y-8 pb-10">
                <div className="group">
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2 px-2">Primary Client Identity</label>
                  <input name="clientName" defaultValue={editItem ? data.clients.find(c => c.id === editItem.clientId)?.name : ''} required list="client-suggestions" className="w-full px-6 py-4 border-2 border-slate-300 bg-white text-slate-900 rounded-3xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none font-black text-xl transition-all shadow-sm placeholder:text-slate-400" placeholder="Search or create client..." />
                  <datalist id="client-suggestions">{data.clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
                </div>

                <div className="p-2 bg-slate-200 rounded-3xl flex gap-1 shadow-inner border border-slate-300">
                    {(['domain', 'hosting', 'both'] as ServiceType[]).map(t => (
                      <label key={t} className={`flex-1 px-4 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center font-black text-[10px] uppercase tracking-widest ${formType === t ? 'bg-white text-indigo-700 shadow-md border border-slate-100' : 'text-slate-600 hover:text-slate-800'}`}>
                        <input type="radio" name="type" value={t} checked={formType === t} onChange={() => setFormType(t)} className="hidden" /> <span>{t} Unit</span>
                      </label>
                    ))}
                </div>

                {formType === 'both' && (
                  <div className="flex items-center space-x-3 p-5 bg-indigo-50 rounded-3xl border-2 border-indigo-200 transition-colors">
                    <input type="checkbox" name="isSynced" id="isSynced" checked={formIsSynced} onChange={() => setFormIsSynced(!formIsSynced)} className="w-6 h-6 text-indigo-700 rounded-xl accent-indigo-700 cursor-pointer" />
                    <label htmlFor="isSynced" className="text-xs font-black text-indigo-900 cursor-pointer uppercase tracking-tight">Sync registrar data with hosting provider</label>
                  </div>
                )}

                {(formType === 'domain' || formType === 'both') && (
                  <div className="p-8 rounded-[2.5rem] border-2 border-indigo-200 bg-white space-y-6 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-indigo-100 pb-4">
                      <Globe size={18} className="text-indigo-600"/>
                      <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">Domain Asset Provisioning</p>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-700 px-1">Domain Name</label>
                        <input name="domainName" defaultValue={editItem?.domainName} className="w-full px-5 py-3.5 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-indigo-600 outline-none font-black text-indigo-900 mt-1 placeholder:text-slate-400" placeholder="example.com" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-700 px-1">Registrar</label>
                        <input name="registrar" defaultValue={editItem?.registrar} className="w-full px-5 py-3 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-indigo-600 outline-none text-xs font-bold mt-1 placeholder:text-slate-400" placeholder="e.g. GoDaddy" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-700 px-1">Renewal Date</label>
                        <input name="domainExpiry" type="date" defaultValue={editItem?.domainExpiry} className="w-full px-5 py-3 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-indigo-600 outline-none text-xs font-bold mt-1" />
                      </div>
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-rose-800 px-1">Internal Cost</label>
                           <div className="flex border-2 border-rose-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:border-rose-400">
                             <select name="domainCostCurrency" defaultValue={editItem?.domainCostCurrency || 'NPR'} className="bg-rose-50 text-rose-900 px-3 outline-none font-black text-[10px] border-r border-rose-200"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                             <input name="domainCost" type="number" step="0.01" defaultValue={editItem?.domainCost} className="w-full px-4 py-3 outline-none font-black text-slate-900 bg-white placeholder:text-rose-200" placeholder="0.00" />
                           </div>
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-emerald-800 px-1 text-right block w-full">Selling Price</label>
                           <div className="flex border-2 border-emerald-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:border-emerald-400">
                             <select name="domainChargeCurrency" defaultValue={editItem?.domainChargeCurrency || 'INR'} className="bg-emerald-50 text-emerald-900 px-3 outline-none font-black text-[10px] border-r border-emerald-200"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                             <input name="domainCharge" type="number" step="0.01" defaultValue={editItem?.domainCharge} className="w-full px-4 py-3 outline-none font-black text-slate-900 bg-white placeholder:text-emerald-200" placeholder="0.00" />
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {(formType === 'hosting' || formType === 'both') && (
                  <div className="p-8 rounded-[2.5rem] border-2 border-orange-200 bg-white space-y-6 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-orange-100 pb-4">
                      <Server size={18} className="text-orange-600"/>
                      <p className="text-[11px] font-black text-orange-900 uppercase tracking-widest">Hosting Asset Provisioning</p>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-700 px-1">Service Tier / Plan</label>
                        <input name="hostingPlan" defaultValue={editItem?.hostingPlan} className="w-full px-5 py-3.5 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-orange-600 outline-none font-black text-orange-900 mt-1 placeholder:text-slate-400" placeholder="e.g. Cloud VPS Pro" />
                      </div>
                      {!formIsSynced && (
                        <>
                          <div className="col-span-2">
                             <label className="text-[10px] font-black uppercase text-slate-700 px-1">Service Provider</label>
                             <input name="hostingProvider" defaultValue={editItem?.hostingProvider} className="w-full px-5 py-3 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-orange-600 outline-none text-xs font-bold mt-1 placeholder:text-slate-400" placeholder="e.g. DigitalOcean" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 px-1">Hosting Renewal</label>
                            <input name="hostingExpiry" type="date" defaultValue={editItem?.hostingExpiry} className="w-full px-5 py-3 border-2 border-slate-300 bg-white text-slate-900 rounded-2xl focus:border-orange-600 outline-none text-xs font-bold mt-1" />
                          </div>
                        </>
                      )}
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-rose-800 px-1">Operating Cost</label>
                           <div className="flex border-2 border-rose-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:border-rose-400">
                             <select name="hostingCostCurrency" defaultValue={editItem?.hostingCostCurrency || 'NPR'} className="bg-rose-50 text-rose-900 px-3 outline-none font-black text-[10px] border-r border-rose-200"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                             <input name="hostingCost" type="number" step="0.01" defaultValue={editItem?.hostingCost} className="w-full px-4 py-3 outline-none font-black text-slate-900 bg-white placeholder:text-rose-200" placeholder="0.00" />
                           </div>
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-emerald-800 px-1 text-right block w-full">Selling Price</label>
                           <div className="flex border-2 border-emerald-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:border-emerald-400">
                             <select name="hostingChargeCurrency" defaultValue={editItem?.hostingChargeCurrency || 'INR'} className="bg-emerald-50 text-emerald-900 px-3 outline-none font-black text-[10px] border-r border-emerald-200"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                             <input name="hostingCharge" type="number" step="0.01" defaultValue={editItem?.hostingCharge} className="w-full px-4 py-3 outline-none font-black text-slate-900 bg-white placeholder:text-emerald-200" placeholder="0.00" />
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-8 rounded-[2.5rem] border-2 border-slate-300 bg-slate-100/30 space-y-6 shadow-inner">
                   <div className="flex justify-between items-center mb-4">
                     <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Briefcase size={14}/> Auxiliary Add-ons</p>
                     <button type="button" onClick={addAdditionalServiceField} className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">+ Add Unit</button>
                   </div>
                   <div className="space-y-4">
                     {formAdditionalServices.map(as => (
                       <div key={as.id} className="p-6 border-2 border-slate-300 rounded-3xl bg-white relative shadow-sm group animate-in slide-in-from-top-2">
                          <button type="button" onClick={() => removeAdditionalServiceField(as.id)} className="absolute -top-3 -right-3 bg-white text-rose-500 rounded-full shadow-lg p-1 group-hover:scale-110 transition-transform"><XCircle size={28}/></button>
                          <div className="space-y-4">
                            <input value={as.name} onChange={e => updateAdditionalServiceField(as.id, { name: e.target.value })} className="w-full px-4 py-2 border-b-2 border-slate-200 bg-white text-slate-900 outline-none font-black text-md focus:border-indigo-600 transition-all placeholder:text-slate-400" placeholder="Service Identifier (e.g. SSL Cert)" />
                            <div className="grid grid-cols-2 gap-4">
                               <div className="flex border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm focus-within:border-indigo-400">
                                 <select value={as.costCurrency} onChange={e => updateAdditionalServiceField(as.id, { costCurrency: e.target.value as Currency })} className="bg-slate-100 text-slate-900 text-[9px] px-2 outline-none font-bold border-r border-slate-300"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                                 <input type="number" step="0.01" value={as.cost} onChange={e => updateAdditionalServiceField(as.id, { cost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-white outline-none text-xs font-black text-slate-900 placeholder:text-slate-300" placeholder="Cost" />
                               </div>
                               <div className="flex border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm focus-within:border-indigo-400">
                                 <select value={as.chargeCurrency} onChange={e => updateAdditionalServiceField(as.id, { chargeCurrency: e.target.value as Currency })} className="bg-slate-100 text-slate-900 text-[9px] px-2 outline-none font-bold border-r border-slate-300"><option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option></select>
                                 <input type="number" step="0.01" value={as.charge} onChange={e => updateAdditionalServiceField(as.id, { charge: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-white outline-none text-xs font-black text-slate-900 placeholder:text-slate-300" placeholder="Selling" />
                               </div>
                            </div>
                            <div className="pt-2">
                               <label className="text-[10px] font-black uppercase text-slate-700 px-1">Service Expiry (Optional)</label>
                               <input type="date" value={as.expiry || ''} onChange={e => updateAdditionalServiceField(as.id, { expiry: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-300 bg-slate-50 text-slate-900 rounded-xl outline-none text-[10px] font-bold mt-1" />
                            </div>
                          </div>
                       </div>
                     ))}
                     {formAdditionalServices.length === 0 && <p className="text-center text-slate-500 text-[11px] font-bold uppercase tracking-widest py-8 border-2 border-dashed border-slate-400 rounded-[2rem]">Ready for deployment</p>}
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-slate-700 px-2">Administrative Logs</label>
                  <textarea name="notes" defaultValue={editItem?.notes} className="w-full px-8 py-6 border-2 border-slate-300 rounded-[2.5rem] bg-white text-slate-900 outline-none font-medium text-sm focus:bg-white focus:border-indigo-600 transition-all shadow-inner placeholder:text-slate-400" rows={4} placeholder="Internal package-wide administrative logs..." />
                </div>
                
                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-200 text-slate-700 py-6 rounded-[2.5rem] font-black text-xl hover:bg-slate-300 transition-all border-2 border-slate-300 shadow-sm"
                  >
                    CLOSE
                  </button>
                  <button type="submit" className="flex-[2] bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 group">
                    <Database size={24} className="group-hover:animate-pulse" /> {editItem ? 'COMMIT UPDATE' : 'DEPLOY PROVISION'}
                  </button>
                </div>
             </form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default App;
