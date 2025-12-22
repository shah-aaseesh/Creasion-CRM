
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
  MinusCircle,
  Layers,
  Link
} from 'lucide-react';
import { createClient, User as SupabaseUser } from '@supabase/supabase-js';
import { AppData, Service, ServiceType, Currency, ExpiryStatus, AdditionalService, HostingHubPlan, HostedSite } from './types.ts';
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

const DEFAULT_DATA: AppData = {
  clients: [],
  services: [],
  hostingPlans: [],
  credentials: [],
  settings: {
    masterPasswordHash: '',
    appPasswordHash: '',
    lastBackup: new Date().toISOString()
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'hosting'>('dashboard');
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authEmail] = useState(APPROVED_USER);
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [editPlan, setEditPlan] = useState<HostingHubPlan | null>(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline' | 'error'>('connected');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formType, setFormType] = useState<ServiceType>('both');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [tempAddons, setTempAddons] = useState<AdditionalService[]>([]);
  const [tempSites, setTempSites] = useState<HostedSite[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData({ ...DEFAULT_DATA, ...parsed });
      } catch (e) { console.error(e); }
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user?.email?.toLowerCase() === APPROVED_USER) {
          setUser(session.user);
          loadFromCloud(session.user.id);
        }
      } catch (err: any) { setDbStatus('error'); }
    };

    initAuth();
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
    } catch (e: any) {
      setDbStatus('error');
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
      if (error && error.code !== 'PGRST116') throw error;
      if (record?.content) {
        const cloudData = { ...DEFAULT_DATA, ...record.content };
        setData(cloudData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Logic for Inventory
  const openProvisionModal = (service: Service | null = null) => {
    setEditItem(service);
    setFormType(service?.type || 'both');
    setTempAddons(service?.additionalServices || []);
    setIsModalOpen(true);
  };

  const saveService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const serviceData: Service = {
      id: editItem?.id || generateId(),
      clientId: (formData.get('clientName') as string) || 'Default Client',
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
      additionalServices: tempAddons,
      notes: (formData.get('notes') as string) || '',
      createdAt: editItem?.createdAt || new Date().toISOString()
    };
    updateData({ ...data, services: editItem ? data.services.map(s => s.id === editItem.id ? serviceData : s) : [...data.services, serviceData] });
    setIsModalOpen(false);
  };

  // Logic for Hosting Hub
  const openPlanModal = (plan: HostingHubPlan | null = null) => {
    setEditPlan(plan);
    setTempSites(plan?.sites || []);
    setIsPlanModalOpen(true);
  };

  const saveHostingPlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const planData: HostingHubPlan = {
      id: editPlan?.id || generateId(),
      planName: (formData.get('planName') as string) || 'Unnamed Plan',
      provider: (formData.get('provider') as string) || '',
      expiryDate: (formData.get('expiryDate') as string) || '',
      cost: parseFloat(formData.get('cost') as string || '0'),
      costCurrency: formData.get('costCurrency') as Currency,
      charge: parseFloat(formData.get('charge') as string || '0'),
      chargeCurrency: formData.get('chargeCurrency') as Currency,
      sites: tempSites,
      notes: (formData.get('notes') as string) || '',
    };
    updateData({ ...data, hostingPlans: editPlan ? data.hostingPlans.map(p => p.id === editPlan.id ? planData : p) : [...data.hostingPlans, planData] });
    setIsPlanModalOpen(false);
  };

  const stats = useMemo(() => {
    const alerts: any[] = [];
    data.services.forEach(s => {
      if (s.domainExpiry && getExpiryStatus(s.domainExpiry) !== ExpiryStatus.ACTIVE) alerts.push({ label: s.domainName, expiry: s.domainExpiry });
      if (s.hostingExpiry && getExpiryStatus(s.hostingExpiry) !== ExpiryStatus.ACTIVE) alerts.push({ label: s.hostingPlan, expiry: s.hostingExpiry });
    });
    data.hostingPlans.forEach(p => {
      if (p.expiryDate && getExpiryStatus(p.expiryDate) !== ExpiryStatus.ACTIVE) alerts.push({ label: p.planName, expiry: p.expiryDate });
    });
    return { alerts, total: data.services.length + data.hostingPlans.length };
  }, [data]);

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 flex flex-col items-center">
          <div className="bg-indigo-600 p-4 rounded-3xl mb-6 text-white shadow-xl shadow-indigo-500/20"><ShieldCheck size={40} /></div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-8">CREASION CRM</h1>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setAuthLoading(true);
            const { data: authData, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
            if (error) setAuthError(error.message);
            else if (authData.user) setUser(authData.user);
            setAuthLoading(false);
          }} className="w-full space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" value={authEmail} readOnly className="w-full pl-12 pr-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-400 rounded-2xl font-bold outline-none" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full pl-12 pr-6 py-4 border-2 border-slate-200 bg-white text-slate-900 rounded-2xl focus:border-indigo-500 outline-none font-bold" placeholder="Access Key" required autoFocus />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg transition-all hover:bg-black shadow-xl">
              {authLoading ? 'AUTHORIZING...' : 'UNSEAL PORTAL'}
            </button>
            {authError && <p className="text-center text-rose-500 text-xs font-bold mt-4">{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative no-select">
      <aside className={`fixed inset-y-0 left-0 z-50 lg:relative lg:z-20 bg-slate-900 text-slate-400 flex flex-col shrink-0 shadow-2xl transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shrink-0"><Package size={20} /></div>
            <span className={`font-black text-white text-xl tracking-tighter ${!isSidebarOpen && 'lg:hidden'}`}>CREASION</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden lg:block text-slate-500 hover:text-white transition-colors">{isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}</button>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'services', icon: Briefcase, label: 'Inventory' },
            { id: 'hosting', icon: Layers, label: 'Hosting Hub' },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 px-4 py-4 space-x-3' : 'hover:bg-white/5 hover:text-white px-4 py-4 space-x-3'} ${!isSidebarOpen && 'lg:justify-center lg:px-0'}`}>
              <item.icon size={20} /> <span className={`font-bold ${!isSidebarOpen && 'lg:hidden'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-bold px-4 py-3 space-x-3">
            <LogOut size={16} /> <span className={`${!isSidebarOpen && 'lg:hidden'}`}>Lock Session</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-20 border-b flex items-center justify-between px-10 shrink-0 z-10 shadow-sm">
          <div className="flex items-center space-x-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase text-sm tracking-widest">{activeTab}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-6 py-2.5 border-2 border-slate-100 text-slate-900 rounded-2xl text-sm focus:border-indigo-500 bg-slate-50 w-80 font-medium outline-none" />
            </div>
          </div>
          <button onClick={() => activeTab === 'hosting' ? openPlanModal() : openProvisionModal()} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl flex items-center space-x-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest transition-all">
            <Plus size={18} className="stroke-[3]" /> <span>Provision {activeTab === 'hosting' ? 'Plan' : 'Asset'}</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex items-center justify-between">
                   <div><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Total Managed Units</p><p className="text-5xl font-black text-slate-900">{stats.total}</p></div>
                   <div className="bg-indigo-50 p-4 rounded-3xl text-indigo-500"><Package size={32} /></div>
                 </div>
                 <div className="bg-white p-10 rounded-[2.5rem] border-2 border-rose-100 bg-rose-50/10 shadow-sm flex items-center justify-between">
                   <div><p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Renewal Alerts</p><p className="text-5xl font-black text-rose-600">{stats.alerts.length}</p></div>
                   <div className="bg-rose-100/50 p-4 rounded-3xl text-rose-500"><AlertTriangle size={32} /></div>
                 </div>
              </div>
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <div className="px-8 py-5 border-b-2 border-slate-50 bg-slate-50/50"><h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2"><Clock size={16} className="text-indigo-500" /> Pending Renewals</h3></div>
                <div className="divide-y-2 divide-slate-50">
                  {stats.alerts.map((alert, i) => (
                    <div key={i} className="px-8 py-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div><p className="font-black text-slate-900 text-lg tracking-tight">{alert.label}</p><p className="text-[10px] font-black text-slate-500 uppercase">{alert.expiry}</p></div>
                      <p className={`text-[10px] font-black uppercase tracking-tighter px-4 py-1 rounded-full border ${getDaysRemaining(alert.expiry) < 0 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                        {getDaysRemaining(alert.expiry) < 0 ? 'EXPIRED' : `${getDaysRemaining(alert.expiry)}D REMAINING`}
                      </p>
                    </div>
                  ))}
                  {stats.alerts.length === 0 && <div className="p-10 text-center text-slate-400 italic">No pending renewals found.</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50/80 border-b-2 border-slate-100">
                    <tr>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Unit Identity</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Type</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Expiry</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.services.filter(s => (s.domainName || s.hostingPlan || s.clientId || '').toLowerCase().includes(searchTerm.toLowerCase())).map(service => (
                      <tr key={service.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-8 py-6">
                           <p className="font-black text-slate-900 tracking-tighter text-lg leading-tight">{service.domainName || service.hostingPlan}</p>
                           <p className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 mt-1"><User size={10} /> {service.clientId}</p>
                        </td>
                        <td className="px-8 py-6"><span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg border bg-white border-slate-200 text-slate-600">{service.type}</span></td>
                        <td className="px-8 py-6"><p className={`text-sm font-black ${getDaysRemaining(service.domainExpiry || service.hostingExpiry || '') < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{service.domainExpiry || service.hostingExpiry || '-'}</p></td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => openProvisionModal(service)} className="p-2 text-slate-500 hover:text-indigo-600"><FileText size={18}/></button>
                          <button onClick={() => { if(confirm('Delete?')) updateData({...data, services: data.services.filter(s => s.id !== service.id)}) }} className="p-2 text-slate-500 hover:text-rose-600"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}

          {activeTab === 'hosting' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               {data.hostingPlans.filter(p => p.planName.toLowerCase().includes(searchTerm.toLowerCase())).map(plan => (
                 <div key={plan.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b-2 border-slate-50 flex justify-between items-start bg-slate-50/30">
                       <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{plan.provider}</p>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{plan.planName}</h4>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => openPlanModal(plan)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:text-indigo-600 shadow-sm"><FileText size={20}/></button>
                          <button onClick={() => { if(confirm('Delete Plan?')) updateData({...data, hostingPlans: data.hostingPlans.filter(p => p.id !== plan.id)}) }} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:text-rose-600 shadow-sm"><Trash2 size={20}/></button>
                       </div>
                    </div>
                    <div className="p-8 flex-1 space-y-6">
                       <div className="flex justify-between text-sm">
                          <p className="text-slate-500 font-bold uppercase text-[10px]">Renewal Due</p>
                          <p className={`font-black ${getDaysRemaining(plan.expiryDate) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{plan.expiryDate}</p>
                       </div>
                       <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-2"><Link size={12}/> Hosted Ecosystem</p>
                          <div className="flex flex-wrap gap-2">
                             {plan.sites.map(site => (
                               <span key={site.id} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100">{site.url}</span>
                             ))}
                             {plan.sites.length === 0 && <p className="text-xs text-slate-400 italic">No sites linked to this ecosystem.</p>}
                          </div>
                       </div>
                    </div>
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                       <div><p className="text-[9px] font-black text-slate-400 uppercase">INTERNAL MARGIN</p><p className="text-lg font-black text-emerald-400">+{formatCurrency(plan.charge - plan.cost, plan.chargeCurrency)}</p></div>
                       <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">CLIENT RENEWAL</p><p className="text-lg font-black">{formatCurrency(plan.charge, plan.chargeCurrency)}</p></div>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL FOR ASSETS (DOMAIN/HOSTING) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editItem ? 'Edit Asset' : 'Provision Asset'}>
         <form onSubmit={saveService} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase text-slate-500 px-2">Client / Project</label>
               <input name="clientName" defaultValue={editItem?.clientId} required className="w-full px-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-900 rounded-2xl font-black focus:border-indigo-600 outline-none" placeholder="Project Name" />
            </div>
            <div className="p-2 bg-slate-200 rounded-2xl flex gap-1">
                {(['domain', 'hosting', 'both'] as ServiceType[]).map(t => (
                  <label key={t} className={`flex-1 px-4 py-2 rounded-xl cursor-pointer text-center font-black text-[10px] uppercase tracking-widest ${formType === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
                    <input type="radio" checked={formType === t} onChange={() => setFormType(t)} className="hidden" /> {t}
                  </label>
                ))}
            </div>
            {(formType === 'domain' || formType === 'both') && (
              <div className="p-6 rounded-3xl border-2 border-slate-50 bg-white space-y-4">
                <input name="domainName" defaultValue={editItem?.domainName} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900" placeholder="domain.com" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="registrar" defaultValue={editItem?.registrar} className="w-full px-5 py-3 border-2 border-slate-100 bg-slate-50 rounded-2xl text-xs font-bold" placeholder="Registrar" />
                  <input name="domainExpiry" type="date" defaultValue={editItem?.domainExpiry} style={{ colorScheme: 'light' }} className="w-full px-5 py-3 border-2 border-slate-100 bg-slate-50 rounded-2xl text-xs font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50"><select name="domainCostCurrency" defaultValue={editItem?.domainCostCurrency || 'NPR'} className="bg-slate-200 px-2 outline-none font-black text-[9px]"><option>NPR</option><option>INR</option></select><input name="domainCost" type="number" step="0.01" defaultValue={editItem?.domainCost} className="w-full px-4 py-3 bg-transparent outline-none font-black text-sm" placeholder="Cost" /></div>
                  <div className="flex border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50"><select name="domainChargeCurrency" defaultValue={editItem?.domainChargeCurrency || 'INR'} className="bg-indigo-100 px-2 outline-none font-black text-[9px]"><option>NPR</option><option>INR</option></select><input name="domainCharge" type="number" step="0.01" defaultValue={editItem?.domainCharge} className="w-full px-4 py-3 bg-transparent outline-none font-black text-sm text-indigo-700" placeholder="Charge" /></div>
                </div>
              </div>
            )}
            <textarea name="notes" defaultValue={editItem?.notes} className="w-full px-6 py-4 border-2 border-slate-100 bg-slate-50 rounded-2xl font-medium text-sm focus:border-indigo-600 outline-none h-32" placeholder="Journal entries..." />
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all">Apply Provision</button>
         </form>
      </Modal>

      {/* MODAL FOR HOSTING HUB (MULTI-SITE) */}
      <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title={editPlan ? 'Update Ecosystem' : 'New Hosting Ecosystem'}>
         <form onSubmit={saveHostingPlan} className="space-y-6">
            <div className="space-y-4">
               <input name="planName" defaultValue={editPlan?.planName} required className="w-full px-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-900 rounded-2xl font-black focus:border-indigo-600 outline-none" placeholder="Hosting Plan Name (e.g. Premium Cloud 1)" />
               <div className="grid grid-cols-2 gap-4">
                  <input name="provider" defaultValue={editPlan?.provider} className="w-full px-5 py-3 border-2 border-slate-100 bg-slate-50 rounded-2xl text-xs font-bold" placeholder="Provider (e.g. Google Cloud)" />
                  <input name="expiryDate" type="date" defaultValue={editPlan?.expiryDate} style={{ colorScheme: 'light' }} className="w-full px-5 py-3 border-2 border-slate-100 bg-slate-50 rounded-2xl text-xs font-bold" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50"><select name="costCurrency" defaultValue={editPlan?.costCurrency || 'NPR'} className="bg-slate-200 px-2 outline-none font-black text-[9px]"><option>NPR</option><option>INR</option></select><input name="cost" type="number" step="0.01" defaultValue={editPlan?.cost} className="w-full px-4 py-3 bg-transparent outline-none font-black text-sm" placeholder="Plan Cost" /></div>
                  <div className="flex border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50"><select name="chargeCurrency" defaultValue={editPlan?.chargeCurrency || 'INR'} className="bg-indigo-100 px-2 outline-none font-black text-[9px]"><option>NPR</option><option>INR</option></select><input name="charge" type="number" step="0.01" defaultValue={editPlan?.charge} className="w-full px-4 py-3 bg-transparent outline-none font-black text-sm text-indigo-700" placeholder="Plan Charge" /></div>
               </div>
            </div>

            <div className="p-8 rounded-[2rem] bg-slate-50 space-y-4">
               <div className="flex justify-between items-center"><h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ecosystem Domain Inventory</h5><button type="button" onClick={() => setTempSites([...tempSites, { id: generateId(), url: '' }])} className="p-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase px-4"><Plus size={12}/> Link Domain</button></div>
               <div className="space-y-2">
                  {tempSites.map(site => (
                    <div key={site.id} className="flex gap-2">
                       <input value={site.url} onChange={(e) => setTempSites(tempSites.map(s => s.id === site.id ? {...s, url: e.target.value} : s))} className="flex-1 px-5 py-3 border-2 border-white bg-white rounded-xl font-bold text-sm shadow-sm" placeholder="hostedwebsite.com" />
                       <button type="button" onClick={() => setTempSites(tempSites.filter(s => s.id !== site.id))} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><MinusCircle size={20}/></button>
                    </div>
                  ))}
               </div>
            </div>
            <textarea name="notes" defaultValue={editPlan?.notes} className="w-full px-6 py-4 border-2 border-slate-100 bg-slate-50 rounded-2xl font-medium text-sm focus:border-indigo-600 outline-none h-24" placeholder="Administrative Journal..." />
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200">Sync Hosting Ecosystem</button>
         </form>
      </Modal>
    </div>
  );
};

export default App;
