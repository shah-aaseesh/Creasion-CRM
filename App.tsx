
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Briefcase,
  ChevronDown,
  ChevronUp,
  Info,
  Database,
  Clock,
  ShieldCheck,
  Trash2,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Copy,
  User,
  PlusSquare,
  MinusCircle
} from 'lucide-react';
import { createClient, User as SupabaseUser } from '@supabase/supabase-js';
import { AppData, Service, ServiceType, Currency, ExpiryStatus, AdditionalService } from './types.ts';
import { 
  formatCurrency, 
  getExpiryStatus, 
  generateId, 
  getDaysRemaining 
} from './utils/helpers.ts';
import Modal from './components/Modal.tsx';

// Supabase Initialization
const supabaseUrl = 'https://yvqiyegopttiqlclxfxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cWl5ZWdvcHR0aXFsY2x4Znh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMzUzOTksImV4cCI6MjA4MTkxMTM5OX0.FkXfHMugNRcPAEh3U3jCicjHeDaLAOYqQfqiCPbWLRc';
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY = 'creasion_crm_v4_data';
const APPROVED_USER = 'shahaaseesh@gmail.com'.toLowerCase();

const SQL_SETUP_SCRIPT = `-- 🔥 CORE TABLE INITIALIZATION
CREATE TABLE IF NOT EXISTS crm_state (
  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE crm_state ENABLE ROW LEVEL SECURITY;
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authEmail] = useState(APPROVED_USER);
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbSetupRequired, setDbSetupRequired] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline' | 'error'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  // Sidebar & Modal State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formType, setFormType] = useState<ServiceType>('both');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [tempAddons, setTempAddons] = useState<AdditionalService[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) { console.error(e); }
    }

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
      } catch (err: any) { setDbStatus('error'); }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user;
      if (currentUser?.email?.toLowerCase() === APPROVED_USER) {
        setUser(currentUser);
        loadFromCloud(currentUser.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setLastSyncTime(new Date().toISOString());
      setDbSetupRequired(false);
    } catch (e: any) {
      setDbStatus('error');
      if (e.code === '42703' || e.code === '42P01') setDbSetupRequired(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromCloud = async (userId: string) => {
    setIsSyncing(true);
    try {
      const { data: record, error } = await supabase
        .from('crm_state')
        .select('content, updated_at')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          syncToCloud(data, userId);
          return;
        }
        throw error;
      }
      
      if (record?.content) {
        setData(record.content);
        setLastSyncTime(record.updated_at);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record.content));
        setDbStatus('connected');
      }
    } catch (e: any) { setDbStatus('error'); }
    finally { setIsSyncing(false); }
  };

  const updateData = (newData: AppData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    syncToCloud(newData);
  };

  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (window.confirm("Overwrite current inventory?")) {
          updateData(imported);
          alert("Success!");
        }
      } catch (err) { alert("Invalid file."); }
    };
    reader.readAsText(file);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ 
        email: authEmail, 
        password: authPassword 
      });
      if (error) throw error;
      if (authData.user && authData.user.email?.toLowerCase() === APPROVED_USER) {
        setUser(authData.user);
        loadFromCloud(authData.user.id);
      } else {
        throw new Error("Denied");
      }
    } catch (error: any) {
      setAuthError(error.message || "Auth failed");
    } finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsMobileMenuOpen(false);
  };

  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const openProvisionModal = (service: Service | null = null) => {
    setEditItem(service);
    setFormType(service?.type || 'both');
    setTempAddons(service?.additionalServices || []);
    setIsModalOpen(true);
  };

  const addAddonField = () => {
    const newAddon: AdditionalService = {
      id: generateId(),
      name: '',
      cost: 0,
      costCurrency: 'NPR',
      charge: 0,
      chargeCurrency: 'INR'
    };
    setTempAddons([...tempAddons, newAddon]);
  };

  const removeAddonField = (id: string) => {
    setTempAddons(tempAddons.filter(a => a.id !== id));
  };

  const updateAddonField = (id: string, field: keyof AdditionalService, value: any) => {
    setTempAddons(tempAddons.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const saveService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientName = (formData.get('clientName') as string) || 'Default Client';
    
    const serviceData: Service = {
      id: editItem?.id || generateId(),
      clientId: clientName,
      type: formType,
      isSynced: true,
      domainName: (formData.get('domainName') as string) || '',
      registrar: (formData.get('registrar') as string) || '',
      domainCost: parseFloat(formData.get('domainCost') as string || '0'),
      domainCostCurrency: formData.get('domainCostCurrency') as Currency,
      domainCharge: parseFloat(formData.get('domainCharge') as string || '0'),
      domainChargeCurrency: formData.get('domainChargeCurrency') as Currency,
      domainExpiry: (formData.get('domainExpiry') as string) || '',
      hostingProvider: (formData.get('hostingProvider') as string) || '',
      hostingPlan: (formData.get('hostingPlan') as string) || '',
      hostingCost: parseFloat(formData.get('hostingCost') as string || '0'),
      hostingCostCurrency: formData.get('hostingCostCurrency') as Currency,
      hostingCharge: parseFloat(formData.get('hostingCharge') as string || '0'),
      hostingChargeCurrency: formData.get('hostingChargeCurrency') as Currency,
      hostingExpiry: (formData.get('hostingExpiry') as string) || '',
      hostingServerIp: (formData.get('hostingServerIp') as string) || '',
      hostingCpUrl: (formData.get('hostingCpUrl') as string) || '',
      additionalServices: tempAddons,
      notes: (formData.get('notes') as string) || '',
      createdAt: editItem?.createdAt || new Date().toISOString()
    };

    updateData({
      ...data,
      services: editItem 
        ? data.services.map(s => s.id === editItem.id ? serviceData : s)
        : [...data.services, serviceData]
    });
    setIsModalOpen(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm('Delete permanently?')) {
      updateData({ ...data, services: data.services.filter(s => s.id !== id) });
    }
  };

  const stats = useMemo(() => {
    const alerts: any[] = [];
    data.services.forEach(s => {
      if (s.domainExpiry && getExpiryStatus(s.domainExpiry) !== ExpiryStatus.ACTIVE) alerts.push({ label: s.domainName, expiry: s.domainExpiry });
      if (s.hostingExpiry && getExpiryStatus(s.hostingExpiry) !== ExpiryStatus.ACTIVE) alerts.push({ label: s.hostingPlan, expiry: s.hostingExpiry });
    });
    return { alerts, total: data.services.length };
  }, [data]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 bg-indigo-50 w-40 h-40 rounded-full opacity-50"></div>
          <div className="flex flex-col items-center mb-8 text-center relative z-10">
            <div className="bg-indigo-600 p-4 rounded-3xl mb-4 text-white shadow-xl shadow-indigo-500/20">
              <ShieldCheck size={40} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">CREASION CRM</h1>
            <p className="text-slate-500 mt-1 font-bold uppercase text-[10px] tracking-[0.2em]">Private Asset Vault</p>
          </div>
          {authError && <div className="mb-6 p-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-2"><AlertCircle size={16} /> {authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2">Operator</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" value={authEmail} readOnly className="w-full pl-12 pr-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-400 rounded-2xl font-bold outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2">Access Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full pl-12 pr-6 py-4 border-2 border-slate-200 bg-white text-slate-900 rounded-2xl focus:border-indigo-500 outline-none font-bold" placeholder="••••••••" required autoFocus />
              </div>
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg transition-all hover:bg-black shadow-xl flex items-center justify-center gap-2">
              {authLoading ? <Loader2 className="animate-spin" size={20} /> : 'UNSEAL PORTAL'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (dbSetupRequired) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border-2 border-rose-100">
          <div className="flex items-center gap-4 mb-6">
             <div className="bg-rose-100 p-4 rounded-2xl text-rose-600"><Database size={32} /></div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Core System Setup</h2>
          </div>
          <p className="text-slate-600 font-bold mb-8 leading-relaxed">Run this SQL in Supabase to initialize your schema:</p>
          <div className="bg-slate-900 rounded-2xl p-6 mb-8 shadow-inner relative">
            <button onClick={() => { navigator.clipboard.writeText(SQL_SETUP_SCRIPT); alert("SQL Copied!"); }} className="absolute top-4 right-4 p-2 bg-white/10 text-white/50 hover:text-white rounded-xl"><Copy size={16} /></button>
            <pre className="text-emerald-400 font-mono text-xs overflow-x-auto max-h-60">{SQL_SETUP_SCRIPT}</pre>
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xl hover:bg-black transition-all flex items-center justify-center gap-3"><RefreshCw size={24} /> INITIALIZE KERNEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans no-select relative">
      <input type="file" ref={fileInputRef} onChange={importFromJson} accept=".json" className="hidden" />
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] lg:hidden" onClick={toggleMobileMenu} />}

      <aside className={`fixed inset-y-0 left-0 z-[100] lg:relative lg:z-20 bg-slate-900 text-slate-400 flex flex-col shrink-0 shadow-2xl transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-6 md:p-8 flex items-center justify-between border-b border-white/5 ${!isSidebarOpen && 'lg:justify-center'}`}>
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shrink-0"><Package size={20} /></div>
            <span className={`font-black text-white text-xl tracking-tighter ${!isSidebarOpen ? 'lg:hidden' : ''}`}>CREASION</span>
          </div>
          <button onClick={toggleSidebar} className="hidden lg:flex text-slate-500 hover:text-white transition-colors">{isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}</button>
          <button onClick={toggleMobileMenu} className="lg:hidden text-slate-500 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'services', icon: Briefcase, label: 'Inventory' },
          ].map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }} className={`w-full flex items-center rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'hover:bg-white/5 hover:text-white'} ${isSidebarOpen ? 'px-4 py-4 space-x-3' : 'px-0 py-4 justify-center'}`}>
              <item.icon size={20} /> <span className={`font-bold ${!isSidebarOpen ? 'lg:hidden' : ''}`}>{item.label}</span>
            </button>
          ))}
          
          <div className="pt-8 space-y-2">
            <p className={`text-[10px] font-black uppercase tracking-widest text-slate-500 px-4 mb-2 ${!isSidebarOpen ? 'lg:hidden' : ''}`}>Maintenance</p>
            <button onClick={exportToJson} className={`w-full flex items-center rounded-2xl transition-all hover:bg-white/5 hover:text-white ${isSidebarOpen ? 'px-4 py-3 space-x-3' : 'px-0 py-3 justify-center'}`}>
              <Download size={18} /> <span className={`font-bold text-sm ${!isSidebarOpen ? 'lg:hidden' : ''}`}>Export JSON</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className={`w-full flex items-center rounded-2xl transition-all hover:bg-white/5 hover:text-white ${isSidebarOpen ? 'px-4 py-3 space-x-3' : 'px-0 py-3 justify-center'}`}>
              <Upload size={18} /> <span className={`font-bold text-sm ${!isSidebarOpen ? 'lg:hidden' : ''}`}>Import JSON</span>
            </button>
          </div>
        </nav>

        <div className={`p-6 border-t border-white/5 space-y-4 ${!isSidebarOpen && 'lg:items-center'}`}>
          <button onClick={handleLogout} className={`w-full flex items-center text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-bold ${isSidebarOpen ? 'px-4 py-3 space-x-3' : 'px-0 py-3 justify-center'}`}>
            <LogOut size={16} /> <span className={`${!isSidebarOpen ? 'lg:hidden' : ''}`}>Lock Session</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white h-20 border-b flex items-center justify-between px-4 md:px-10 shrink-0 z-10 shadow-sm">
          <div className="flex items-center space-x-3 md:space-x-8">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"><Menu size={24} /></button>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{activeTab === 'services' ? 'Inventory' : 'Dashboard'}</h2>
            <div className="hidden lg:relative lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-6 py-2.5 border-2 border-slate-100 text-slate-900 rounded-2xl text-sm focus:border-indigo-500 bg-slate-50 w-80 font-medium outline-none transition-all" />
            </div>
          </div>
          <button onClick={() => openProvisionModal()} className="bg-indigo-600 text-white p-2.5 md:px-8 md:py-3.5 rounded-xl md:rounded-2xl flex items-center space-x-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-black uppercase text-[10px] md:text-xs tracking-widest transition-all">
            <Plus size={20} className="stroke-[3]" /> <span className="hidden md:inline">Provision New</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          {activeTab === 'dashboard' ? (
            <div className="space-y-6 md:space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                 <div className="bg-white p-6 md:p-10 rounded-[2rem] border-2 border-slate-100 shadow-sm flex items-center justify-between">
                   <div><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Total Managed Assets</p><p className="text-3xl md:text-5xl font-black text-slate-900">{stats.total}</p></div>
                   <div className="bg-indigo-50 p-4 rounded-3xl text-indigo-500"><Package size={32} /></div>
                 </div>

                 <div className="bg-white p-6 md:p-10 rounded-[2rem] border-2 border-rose-100 bg-rose-50/10 shadow-sm flex items-center justify-between">
                   <div><p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Action Required</p><p className="text-3xl md:text-5xl font-black text-rose-600">{stats.alerts.length}</p></div>
                   <div className="bg-rose-100/50 p-4 rounded-3xl text-rose-500"><AlertTriangle size={32} /></div>
                 </div>
              </div>

              <div className="bg-white rounded-2xl md:rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <div className="px-6 md:px-8 py-5 border-b-2 border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2"><Clock size={16} className="text-indigo-500" /> Upcoming Service Renewals</h3>
                </div>
                <div className="divide-y-2 divide-slate-50">
                  {stats.alerts.length === 0 ? (
                    <div className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">All infrastructure is secure</div>
                  ) : (
                    stats.alerts.map((alert, i) => (
                      <div key={i} className="px-6 py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors gap-3">
                        <div><p className="font-black text-slate-900 text-base md:text-lg tracking-tight">{alert.label}</p><p className="text-[10px] font-black text-slate-500 uppercase">{alert.expiry}</p></div>
                        <p className={`w-fit text-[10px] font-black uppercase tracking-tighter px-4 py-1 rounded-full border ${getDaysRemaining(alert.expiry) < 0 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                          {getDaysRemaining(alert.expiry) < 0 ? 'EXPIRED' : `${getDaysRemaining(alert.expiry)}D REMAINING`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50/80 border-b-2 border-slate-100">
                    <tr>
                      <th className="px-6 py-6 w-14"></th>
                      <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Client & Asset</th>
                      <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Infrastructure</th>
                      <th className="px-6 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Expiration</th>
                      <th className="px-6 py-6 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.services.filter(s => (s.domainName || s.hostingPlan || s.clientId || '').toLowerCase().includes(searchTerm.toLowerCase())).map(service => {
                      const isExpanded = !!expandedRows[service.id];
                      const allExpiries = [service.domainExpiry, service.hostingExpiry, ...(service.additionalServices?.map(as => as.expiry) || [])].filter(Boolean) as string[];
                      const nextExpiry = allExpiries.length > 0 ? allExpiries.reduce((a, b) => new Date(a) < new Date(b) ? a : b) : null;
                      return (
                        <React.Fragment key={service.id}>
                          <tr className={`hover:bg-slate-50 transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleRow(service.id)}>
                            <td className="px-6 py-6 text-slate-400">{isExpanded ? <ChevronUp size={20} className="stroke-[3]" /> : <ChevronDown size={20} className="stroke-[3]" />}</td>
                            <td className="px-6 py-6">
                              <p className="font-black text-slate-900 tracking-tighter text-lg leading-tight">{service.domainName || service.hostingPlan || 'Custom Service'}</p>
                              <p className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 mt-1"><User size={10} /> {service.clientId}</p>
                            </td>
                            <td className="px-6 py-6"><div className="flex gap-2"><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border bg-white border-slate-200 text-slate-600`}>{service.type}</span></div></td>
                            <td className="px-6 py-6">{nextExpiry ? <p className={`text-sm font-black ${getDaysRemaining(nextExpiry) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{nextExpiry}</p> : '-'}</td>
                            <td className="px-6 py-6 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end space-x-2">
                                <button onClick={() => openProvisionModal(service)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><FileText size={18}/></button>
                                <button onClick={() => deleteItem(service.id)} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50"><td colSpan={5} className="px-10 py-10 border-l-4 border-indigo-500">
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                                    <div className="space-y-6">
                                      <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Globe size={14} className="text-indigo-500"/> INFRASTRUCTURE</h4>
                                      <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-4 shadow-sm relative overflow-hidden">
                                          {(service.type === 'domain' || service.type === 'both') && (
                                            <div className="space-y-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                              <p className="text-lg font-black text-slate-900 tracking-tighter">{service.domainName} <span className="text-[10px] text-slate-400 font-bold">({service.registrar})</span></p>
                                              <div className="flex justify-between gap-4">
                                                <div className="flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">INTERNAL COST</p><p className="text-sm font-black text-slate-800">{formatCurrency(service.domainCost || 0, service.domainCostCurrency)}</p></div>
                                                <div className="flex-1 text-right"><p className="text-[9px] font-black text-indigo-600 uppercase">RENEWAL CHARGE</p><p className="text-sm font-black text-indigo-700">{formatCurrency(service.domainCharge || 0, service.domainChargeCurrency)}</p></div>
                                              </div>
                                            </div>
                                          )}
                                          {(service.type === 'hosting' || service.type === 'both') && (
                                            <div className="space-y-4">
                                              <p className="text-lg font-black text-slate-900 tracking-tighter">{service.hostingPlan} <span className="text-[10px] text-slate-400 font-bold">({service.hostingProvider})</span></p>
                                              <p className="text-[10px] font-mono bg-slate-50 p-2 rounded-lg text-slate-500">IP: {service.hostingServerIp || '0.0.0.0'}</p>
                                              <div className="flex justify-between gap-4">
                                                <div className="flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">INTERNAL COST</p><p className="text-sm font-black text-slate-800">{formatCurrency(service.hostingCost || 0, service.hostingCostCurrency)}</p></div>
                                                <div className="flex-1 text-right"><p className="text-[9px] font-black text-indigo-600 uppercase">RENEWAL CHARGE</p><p className="text-sm font-black text-indigo-700">{formatCurrency(service.hostingCharge || 0, service.hostingChargeCurrency)}</p></div>
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    <div className="space-y-6">
                                      <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14} className="text-indigo-500"/> ADDITIONAL ASSETS</h4>
                                      <div className="space-y-4">
                                        {service.additionalServices?.length ? service.additionalServices.map((as, i) => (
                                          <div key={i} className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-3 shadow-sm">
                                            <div className="flex justify-between items-start"><p className="font-black text-slate-900 text-md tracking-tight">{as.name}</p><p className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{formatCurrency(as.charge, as.chargeCurrency)}</p></div>
                                          </div>
                                        )) : <p className="text-xs text-slate-400 italic font-medium">No additional assets linked.</p>}
                                      </div>
                                    </div>
                                    <div className="space-y-6">
                                      <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-indigo-500"/> SYSTEM JOURNAL</h4>
                                      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl min-h-[200px] relative overflow-hidden">
                                          <p className="relative z-10 text-sm font-medium leading-relaxed opacity-90 italic whitespace-pre-wrap">{service.notes || 'No journal entries for this asset.'}</p>
                                          <div className="absolute bottom-0 right-0 p-8 opacity-5"><Database size={100}/></div>
                                      </div>
                                    </div>
                                </div>
                              </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editItem ? 'Update Asset Provision' : 'Provision New Infrastructure'}>
         <form onSubmit={saveService} className="space-y-8 pb-10">
            {/* Project / Client Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Client / Project Identity</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700"><User size={18} /></div>
                <input name="clientName" defaultValue={editItem?.clientId} required className="w-full pl-12 pr-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-900 rounded-2xl font-black outline-none focus:border-indigo-600 transition-all placeholder:text-slate-400" placeholder="Enter Client or Project Name" />
              </div>
            </div>

            <div className="p-2 bg-slate-200 rounded-3xl flex gap-1">
                {(['domain', 'hosting', 'both'] as ServiceType[]).map(t => (
                  <label key={t} className={`flex-1 px-4 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center font-black text-[10px] uppercase tracking-widest ${formType === t ? 'bg-white text-indigo-700 shadow-md border border-slate-100' : 'text-slate-600 hover:text-slate-800'}`}>
                    <input type="radio" name="type" value={t} checked={formType === t} onChange={() => setFormType(t)} className="hidden" /> <span>{t}</span>
                  </label>
                ))}
            </div>

            {(formType === 'domain' || formType === 'both') && (
              <div className="p-8 rounded-[2.5rem] border-2 border-slate-100 border-l-8 border-l-indigo-600 bg-white space-y-6 shadow-sm">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Globe size={18} className="text-indigo-600"/> Domain Configuration</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2"><input name="domainName" defaultValue={editItem?.domainName} className="w-full px-5 py-3.5 border-2 border-slate-200 bg-slate-50 rounded-2xl focus:border-indigo-600 outline-none font-black text-slate-900 placeholder:text-slate-400" placeholder="domain.com" /></div>
                  <input name="registrar" defaultValue={editItem?.registrar} className="w-full px-5 py-3 border-2 border-slate-200 bg-slate-50 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400" placeholder="Registrar" />
                  <input name="domainExpiry" type="date" defaultValue={editItem?.domainExpiry} style={{ colorScheme: 'light' }} className="w-full px-5 py-3 border-2 border-slate-200 bg-slate-50 rounded-2xl text-xs font-bold text-slate-900" />
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                     <div className="flex border-2 border-slate-100 rounded-2xl overflow-hidden"><select name="domainCostCurrency" defaultValue={editItem?.domainCostCurrency || 'NPR'} className="bg-slate-100 text-slate-900 px-2 outline-none font-black text-[9px] border-r border-slate-100"><option value="NPR">NPR</option><option value="INR">INR</option></select><input name="domainCost" type="number" step="0.01" defaultValue={editItem?.domainCost} className="w-full px-4 py-3 bg-slate-50 outline-none text-sm font-black text-slate-900 placeholder:text-slate-400" placeholder="Buying Cost" /></div>
                     <div className="flex border-2 border-slate-100 rounded-2xl overflow-hidden"><select name="domainChargeCurrency" defaultValue={editItem?.domainChargeCurrency || 'INR'} className="bg-slate-100 text-slate-900 px-2 outline-none font-black text-[9px] border-r border-slate-100"><option value="NPR">NPR</option><option value="INR">INR</option></select><input name="domainCharge" type="number" step="0.01" defaultValue={editItem?.domainCharge} className="w-full px-4 py-3 bg-slate-50 outline-none text-sm font-black text-slate-900 placeholder:text-slate-400" placeholder="Selling Price" /></div>
                  </div>
                </div>
              </div>
            )}

            {(formType === 'hosting' || formType === 'both') && (
              <div className="p-8 rounded-[2.5rem] border-2 border-slate-100 border-l-8 border-l-indigo-600 bg-white space-y-6 shadow-sm">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Server size={18} className="text-indigo-600"/> Hosting Parameters</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2"><input name="hostingPlan" defaultValue={editItem?.hostingPlan} className="w-full px-5 py-3.5 border-2 border-slate-200 bg-slate-50 rounded-2xl focus:border-indigo-600 outline-none font-black text-slate-900 placeholder:text-slate-400" placeholder="Plan Name" /></div>
                  <input name="hostingProvider" defaultValue={editItem?.hostingProvider} className="w-full px-5 py-3 border-2 border-slate-200 bg-slate-50 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400" placeholder="Host" />
                  <input name="hostingExpiry" type="date" defaultValue={editItem?.hostingExpiry} style={{ colorScheme: 'light' }} className="w-full px-5 py-3 border-2 border-slate-200 bg-slate-50 rounded-2xl text-xs font-bold text-slate-900" />
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                     <div className="flex border-2 border-slate-100 rounded-2xl overflow-hidden"><select name="hostingCostCurrency" defaultValue={editItem?.hostingCostCurrency || 'NPR'} className="bg-slate-100 text-slate-900 px-2 outline-none font-black text-[9px] border-r border-slate-100"><option value="NPR">NPR</option><option value="INR">INR</option></select><input name="hostingCost" type="number" step="0.01" defaultValue={editItem?.hostingCost} className="w-full px-4 py-3 bg-slate-50 outline-none text-sm font-black text-slate-900 placeholder:text-slate-400" placeholder="Cost" /></div>
                     <div className="flex border-2 border-slate-100 rounded-2xl overflow-hidden"><select name="hostingChargeCurrency" defaultValue={editItem?.hostingChargeCurrency || 'INR'} className="bg-slate-100 text-slate-900 px-2 outline-none font-black text-[9px] border-r border-slate-100"><option value="NPR">NPR</option><option value="INR">INR</option></select><input name="hostingCharge" type="number" step="0.01" defaultValue={editItem?.hostingCharge} className="w-full px-4 py-3 bg-slate-50 outline-none text-sm font-black text-slate-900 placeholder:text-slate-400" placeholder="Charge" /></div>
                  </div>
                </div>
              </div>
            )}

            {/* ADDITIONAL SERVICES SECTION */}
            <div className="p-8 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><PlusSquare size={18} className="text-indigo-600"/> Additional Services</p>
                <button type="button" onClick={addAddonField} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2"><Plus size={14}/> Add New</button>
              </div>
              
              <div className="space-y-4">
                {tempAddons.map((addon) => (
                  <div key={addon.id} className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm relative">
                    <button type="button" onClick={() => removeAddonField(addon.id)} className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 transition-colors"><MinusCircle size={20}/></button>
                    <input value={addon.name} onChange={(e) => updateAddonField(addon.id, 'name', e.target.value)} className="w-full px-4 py-2 border-b-2 border-slate-100 bg-white focus:border-indigo-600 outline-none font-bold text-sm text-slate-900 placeholder:text-slate-400" placeholder="Service Name (SSL, Email, etc)" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex border-2 border-slate-100 rounded-xl overflow-hidden"><select value={addon.chargeCurrency} onChange={(e) => updateAddonField(addon.id, 'chargeCurrency', e.target.value)} className="bg-slate-100 text-slate-900 px-2 outline-none font-black text-[9px] border-r border-slate-100"><option value="NPR">NPR</option><option value="INR">INR</option></select><input type="number" value={addon.charge} onChange={(e) => updateAddonField(addon.id, 'charge', parseFloat(e.target.value))} className="w-full px-4 py-2 bg-slate-50 outline-none text-xs font-black text-slate-900 placeholder:text-slate-400" placeholder="Charge" /></div>
                      <input type="date" value={addon.expiry} onChange={(e) => updateAddonField(addon.id, 'expiry', e.target.value)} style={{ colorScheme: 'light' }} className="w-full px-4 py-2 border-2 border-slate-100 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-900" />
                    </div>
                  </div>
                ))}
                {tempAddons.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No additional services defined.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Administrative Journal</label>
              <textarea name="notes" defaultValue={editItem?.notes} className="w-full px-8 py-6 border-2 border-slate-100 rounded-[2.5rem] bg-slate-50 text-slate-900 outline-none font-medium text-sm focus:border-indigo-600 shadow-sm placeholder:text-slate-400" rows={4} placeholder="Internal project details, passwords, or maintenance logs..." />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 py-6 rounded-[2.5rem] font-black text-xs hover:bg-slate-200 transition-all uppercase tracking-widest">DISCARD</button>
              <button type="submit" className="flex-[2] bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-sm shadow-2xl hover:bg-indigo-700 transition-all uppercase tracking-widest">CONFIRM PROVISION</button>
            </div>
         </form>
      </Modal>
    </div>
  );
};

export default App;
