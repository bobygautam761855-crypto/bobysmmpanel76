import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Wallet,
  ShoppingBag,
  Package,
  Users,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Ban,
  CheckCircle2,
  Search,
  X,
  AlertTriangle,
  ExternalLink,
  Save,
  Download
} from 'lucide-react';
import { User, SMMService, PlacedOrder, DepositRecord } from '../types.ts';
import { getCachedIdToken } from '../lib/firebaseAuth.ts';
import { apiUrl } from '../lib/api.ts';

interface AdminPanelViewProps {
  currentUser: User | null;
  onServicesUpdated: () => Promise<void> | void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

type AdminSectionTab = 'deposits' | 'orders' | 'services' | 'users';

interface AdminStats {
  totalBalanceAdded: number;
  todayBalanceAdded: number;
  successfulDepositsCount: number;
  pendingDepositsCount: number;
  totalUserWalletBalance: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  completedOrdersCount: number;
  totalOrderRevenue: number;
  totalServicesCount: number;
  addedServicesCount: number;
  editedServicesCount: number;
  removedServicesCount: number;
  totalUsersCount: number;
  blockedUsersCount: number;
}

interface AdminDepositRow extends DepositRecord {
  userName?: string;
}

interface AdminOrderRow extends PlacedOrder {
  userId?: string;
  userName?: string;
  userEmail?: string;
}

interface AdminUserRow extends User {
  orderCount?: number;
  totalDeposited?: number;
}

interface AdminServiceRow extends SMMService {
  isCustom?: boolean;
  isEdited?: boolean;
}

const PLATFORMS: SMMService['platform'][] = [
  'Instagram',
  'YouTube',
  'TikTok',
  'Facebook',
  'LinkedIn',
  'Other'
];

const ORDER_STATUS_OPTIONS = [
  'Pending',
  'In Progress',
  'Processing',
  'Completed',
  'Partial',
  'Cancelled'
];

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  onServicesUpdated,
  onShowToast
}) => {
  const [section, setSection] = useState<AdminSectionTab>('deposits');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [deposits, setDeposits] = useState<AdminDepositRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [services, setServices] = useState<AdminServiceRow[]>([]);
  const [removedServices, setRemovedServices] = useState<AdminServiceRow[]>([]);

  // Filters
  const [depositSearch, setDepositSearch] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [serviceSearch, setServiceSearch] = useState('');
  const [servicePlatformFilter, setServicePlatformFilter] = useState<string>('all');
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [showRemovedServices, setShowRemovedServices] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);

  const [newServiceForm, setNewServiceForm] = useState({
    id: '',
    name: '',
    platform: 'Instagram' as SMMService['platform'],
    category: 'Instagram Followers',
    rate: '',
    min: '100',
    max: '50000',
    desc: ''
  });

  const [editingService, setEditingService] = useState<AdminServiceRow | null>(null);
  const [editServiceForm, setEditServiceForm] = useState({
    name: '',
    platform: 'Instagram' as SMMService['platform'],
    category: '',
    rate: '',
    min: '',
    max: '',
    desc: ''
  });

  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);

  const getAuthHeaders = useCallback(async (includeJson = false) => {
    const token = currentUser?.token || localStorage.getItem('hanuman_auth_token') || '';
    const fbToken = await getCachedIdToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (fbToken) headers['X-Firebase-Token'] = fbToken;
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
  }, [currentUser?.token]);

  const fetchOverview = useCallback(async () => {
    if (currentUser?.role !== 'admin') return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/admin/overview'), {
        cache: 'no-store',
        headers
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load admin control panel.');
      }
      setStats(data.stats);
      setDeposits(Array.isArray(data.deposits) ? data.deposits : []);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setServices(Array.isArray(data.services) ? data.services : []);
      setRemovedServices(Array.isArray(data.removedServices) ? data.removedServices : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to fetch admin overview.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.role, getAuthHeaders]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchOverview();
    }
  }, [currentUser?.role, fetchOverview]);

  // Strict client-side guard (backend also enforces requireAdmin -> 403)
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto my-12 bg-[#0f172a] border border-rose-800/60 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/70 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-white">Admin Access Required</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          This control center is strictly restricted to administrator accounts.
        </p>
      </div>
    );
  }

  // Filtered lists
  const filteredDeposits = useMemo(() => {
    const q = depositSearch.trim().toLowerCase();
    return deposits.filter(d => {
      const statusNorm = String(d.status || '').toLowerCase();
      if (depositStatusFilter === 'success' && statusNorm !== 'success' && statusNorm !== 'completed') return false;
      if (depositStatusFilter === 'pending' && statusNorm !== 'pending' && statusNorm !== 'verifying') return false;
      if (depositStatusFilter === 'failed' && statusNorm !== 'failed') return false;
      if (!q) return true;
      return (
        String(d.depositId || '').toLowerCase().includes(q) ||
        String(d.razorpayOrderId || '').toLowerCase().includes(q) ||
        String(d.razorpayPaymentId || '').toLowerCase().includes(q) ||
        String(d.userName || '').toLowerCase().includes(q) ||
        String(d.userEmail || '').toLowerCase().includes(q)
      );
    });
  }, [deposits, depositSearch, depositStatusFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter(o => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        String(o.orderId || '').toLowerCase().includes(q) ||
        String(o.serviceName || '').toLowerCase().includes(q) ||
        String(o.userName || '').toLowerCase().includes(q) ||
        String(o.userEmail || '').toLowerCase().includes(q) ||
        String(o.link || '').toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return services.filter(s => {
      if (servicePlatformFilter !== 'all' && s.platform !== servicePlatformFilter) return false;
      if (!q) return true;
      return (
        String(s.id).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q)
      );
    });
  }, [services, serviceSearch, servicePlatformFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter(u => {
      if (userFilter === 'active' && u.blocked) return false;
      if (userFilter === 'blocked' && !u.blocked) return false;
      if (!q) return true;
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, userFilter]);

  // Handlers
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceForm.name.trim() || !newServiceForm.rate) {
      onShowToast('error', 'Missing Fields', 'Service name and rate per 1K are required.');
      return;
    }
    setIsSavingService(true);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(apiUrl('/api/admin/services'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: newServiceForm.id ? Number(newServiceForm.id) : undefined,
          name: newServiceForm.name.trim(),
          platform: newServiceForm.platform,
          category: newServiceForm.category.trim() || 'General',
          rate: Number(newServiceForm.rate),
          min: Number(newServiceForm.min || 100),
          max: Number(newServiceForm.max || 50000),
          desc: newServiceForm.desc.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add service.');
      }
      onShowToast('success', 'Service Added', data.message);
      setNewServiceForm({
        id: '',
        name: '',
        platform: 'Instagram',
        category: 'Instagram Followers',
        rate: '',
        min: '100',
        max: '50000',
        desc: ''
      });
      setShowAddServiceForm(false);
      await fetchOverview();
      await onServicesUpdated();
    } catch (err: any) {
      onShowToast('error', 'Add Service Failed', err?.message || 'Could not add service.');
    } finally {
      setIsSavingService(false);
    }
  };

  const openEditService = (service: AdminServiceRow) => {
    setEditingService(service);
    setEditServiceForm({
      name: service.name,
      platform: service.platform,
      category: service.category,
      rate: String(service.rate),
      min: String(service.min),
      max: String(service.max),
      desc: service.desc || ''
    });
  };

  const handleSaveEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setIsSavingService(true);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(apiUrl(`/api/admin/services/${editingService.id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editServiceForm.name.trim(),
          platform: editServiceForm.platform,
          category: editServiceForm.category.trim(),
          rate: Number(editServiceForm.rate),
          min: Number(editServiceForm.min),
          max: Number(editServiceForm.max),
          desc: editServiceForm.desc.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update service.');
      }
      onShowToast('success', 'Service Updated', data.message);
      setEditingService(null);
      await fetchOverview();
      await onServicesUpdated();
    } catch (err: any) {
      onShowToast('error', 'Update Failed', err?.message || 'Could not update service.');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleRemoveService = async (service: AdminServiceRow) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/admin/services/${service.id}`), {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove service.');
      }
      onShowToast('info', 'Service Removed', data.message);
      await fetchOverview();
      await onServicesUpdated();
    } catch (err: any) {
      onShowToast('error', 'Remove Failed', err?.message || 'Could not remove service.');
    }
  };

  const handleRestoreService = async (serviceId: number) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/admin/services/${serviceId}/restore`), {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore service.');
      }
      onShowToast('success', 'Service Restored', data.message);
      await fetchOverview();
      await onServicesUpdated();
    } catch (err: any) {
      onShowToast('error', 'Restore Failed', err?.message || 'Could not restore service.');
    }
  };

  const handleToggleBlockUser = async (targetUser: AdminUserRow) => {
    const nextBlocked = !Boolean(targetUser.blocked);
    setBlockingUserId(targetUser.id);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(targetUser.id)}/block`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ blocked: nextBlocked })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user block status.');
      }
      onShowToast(
        nextBlocked ? 'warning' : 'success',
        nextBlocked ? 'User Blocked' : 'User Unblocked',
        data.message
      );
      await fetchOverview();
    } catch (err: any) {
      onShowToast('error', 'Action Failed', err?.message || 'Could not update user status.');
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string | number, nextStatus: string) => {
    setUpdatingOrderId(String(orderId));
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(String(orderId))}/status`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update order status.');
      }
      onShowToast('success', 'Order Updated', data.message);
      await fetchOverview();
    } catch (err: any) {
      onShowToast('error', 'Status Update Failed', err?.message || 'Could not update order.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/download-zip'), {
        cache: 'no-store',
        headers
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download source code archive.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'boby-smm-panel.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onShowToast('success', 'Code Downloaded', 'Complete website source code downloaded as boby-smm-panel.zip.');
    } catch (err: any) {
      onShowToast('error', 'Download Failed', err?.message || 'Could not download source archive.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0f172a] border border-orange-800/50 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-orange-600/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Admin Control Center
              </h1>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-orange-950/70 border border-orange-700/80 text-orange-300 font-mono">
                Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitor total balance added, all user orders, customize services (add/edit/remove), and block or unblock users.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
            <span>{isDownloadingZip ? 'Preparing ZIP...' : 'Download Full Code (.zip)'}</span>
          </button>

          <button
            type="button"
            onClick={fetchOverview}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Stats</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={fetchOverview}
            className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Balance Added */}
        <button
          type="button"
          onClick={() => setSection('deposits')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            section === 'deposits'
              ? 'bg-emerald-950/30 border-emerald-500/70 shadow-lg shadow-emerald-950/30'
              : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold">Total Balance Added</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
            ₹{(stats?.totalBalanceAdded ?? 0).toFixed(2)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Today: <strong className="text-slate-200 font-mono">₹{(stats?.todayBalanceAdded ?? 0).toFixed(2)}</strong></span>
            <span>{stats?.successfulDepositsCount ?? 0} Paid · {stats?.pendingDepositsCount ?? 0} Pending</span>
          </div>
        </button>

        {/* Card 2: Total Orders */}
        <button
          type="button"
          onClick={() => setSection('orders')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            section === 'orders'
              ? 'bg-orange-950/30 border-orange-500/70 shadow-lg shadow-orange-950/30'
              : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold">Total Orders Received</span>
            <ShoppingBag className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {stats?.totalOrdersCount ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Revenue: <strong className="text-amber-400 font-mono">₹{(stats?.totalOrderRevenue ?? 0).toFixed(2)}</strong></span>
            <span>{stats?.pendingOrdersCount ?? 0} Active · {stats?.completedOrdersCount ?? 0} Done</span>
          </div>
        </button>

        {/* Card 3: Total Services */}
        <button
          type="button"
          onClick={() => setSection('services')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            section === 'services'
              ? 'bg-amber-950/30 border-amber-500/70 shadow-lg shadow-amber-950/30'
              : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold">Active Services</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 tabular-nums">
            {stats?.totalServicesCount ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>+{stats?.addedServicesCount ?? 0} Added</span>
            <span>{stats?.editedServicesCount ?? 0} Edited · {stats?.removedServicesCount ?? 0} Removed</span>
          </div>
        </button>

        {/* Card 4: Users & Blocked */}
        <button
          type="button"
          onClick={() => setSection('users')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            section === 'users'
              ? 'bg-rose-950/30 border-rose-500/70 shadow-lg shadow-rose-950/30'
              : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold">Users & Access</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {stats?.totalUsersCount ?? 0}
            <span className="text-xs font-semibold text-rose-400 ml-2">
              ({stats?.blockedUsersCount ?? 0} Blocked)
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Wallets Total: <strong className="text-emerald-400 font-mono">₹{(stats?.totalUserWalletBalance ?? 0).toFixed(2)}</strong></span>
          </div>
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-2">
        <button
          type="button"
          onClick={() => setSection('deposits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            section === 'deposits'
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Balance Added ({deposits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            section === 'orders'
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>All Orders ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            section === 'services'
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Manage Services ({services.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            section === 'users'
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Block ({users.length})</span>
        </button>
      </div>

      {/* SECTION 1: DEPOSITS / BALANCE ADDED */}
      {section === 'deposits' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Balance Added Ledger</h2>
              <p className="text-xs text-slate-400">All user deposits across Razorpay and wallet top-ups.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={depositSearch}
                  onChange={e => setDepositSearch(e.target.value)}
                  placeholder="Search email, ID, payment..."
                  className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <select
                value={depositStatusFilter}
                onChange={e => setDepositStatusFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success / Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Deposit / RZP ID</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-right">Credited</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No deposit transactions found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map(d => {
                    const st = String(d.status || '').toLowerCase();
                    const badgeClass =
                      st === 'success' || st === 'completed'
                        ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-400'
                        : st === 'failed'
                        ? 'bg-rose-950/60 border-rose-700/70 text-rose-400'
                        : 'bg-amber-950/60 border-amber-700/70 text-amber-300';
                    return (
                      <tr key={d.id} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3 font-mono text-slate-200">
                          <div>{d.depositId}</div>
                          {d.razorpayPaymentId && (
                            <div className="text-[10px] text-slate-500">{d.razorpayPaymentId}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{d.userName || 'User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{d.userEmail || '—'}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{d.methodTitle || d.method}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          ₹{Number(d.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          ₹{Number(d.totalCredited ?? d.amount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${badgeClass}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">{formatDate(d.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: ALL ORDERS */}
      {section === 'orders' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">All Panel Orders</h2>
              <p className="text-xs text-slate-400">Inspect user orders, links, quantities, charges, and update order status.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Order ID, service, user, link..."
                  className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={e => setOrderStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="all">All Statuses</option>
                {ORDER_STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Service & Link</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Charge</th>
                  <th className="py-3 px-3">Status Control</th>
                  <th className="py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No orders found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-900/60">
                      <td className="py-3 px-3 font-mono font-bold text-orange-400">
                        #{o.orderId}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{o.userName || 'User'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{o.userEmail || '—'}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-semibold text-slate-200 truncate" title={o.serviceName}>
                          [{o.serviceId}] {o.serviceName}
                        </div>
                        <a
                          href={o.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 truncate max-w-full"
                        >
                          <span className="truncate">{o.link}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200">
                        {Number(o.quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(o.charge || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={o.status}
                          disabled={updatingOrderId === String(o.orderId)}
                          onChange={e => handleUpdateOrderStatus(o.orderId, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-orange-500 cursor-pointer disabled:opacity-50"
                        >
                          {ORDER_STATUS_OPTIONS.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: SERVICES MANAGEMENT (ADD / EDIT / REMOVE / RESTORE) */}
      {section === 'services' && (
        <div className="space-y-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Services Catalog Manager</h2>
                <p className="text-xs text-slate-400">
                  Add new services, edit price/min/max/name, or remove unwanted services. Changes sync live across the panel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddServiceForm(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-xs font-bold text-white shadow cursor-pointer"
                >
                  {showAddServiceForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{showAddServiceForm ? 'Close Form' : 'Add New Service'}</span>
                </button>
              </div>
            </div>

            {/* Add New Service Collapsible Form */}
            {showAddServiceForm && (
              <form
                onSubmit={handleAddService}
                className="bg-slate-900/90 border border-orange-700/50 rounded-2xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-orange-400">Create New Service</h3>
                  <span className="text-[11px] text-slate-400">Leave Service ID blank to auto-assign</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Service Name *</label>
                    <input
                      type="text"
                      required
                      value={newServiceForm.name}
                      onChange={e => setNewServiceForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Instagram Real Followers"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Platform *</label>
                    <select
                      value={newServiceForm.platform}
                      onChange={e => setNewServiceForm(f => ({ ...f, platform: e.target.value as SMMService['platform'] }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    >
                      {PLATFORMS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={newServiceForm.category}
                      onChange={e => setNewServiceForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Instagram Followers"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Custom ID (Optional)</label>
                    <input
                      type="number"
                      min={1}
                      value={newServiceForm.id}
                      onChange={e => setNewServiceForm(f => ({ ...f, id: e.target.value }))}
                      placeholder="Auto"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Rate per 1K (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={newServiceForm.rate}
                      onChange={e => setNewServiceForm(f => ({ ...f, rate: e.target.value }))}
                      placeholder="e.g. 49.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Min Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={newServiceForm.min}
                      onChange={e => setNewServiceForm(f => ({ ...f, min: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={newServiceForm.max}
                      onChange={e => setNewServiceForm(f => ({ ...f, max: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={newServiceForm.desc}
                      onChange={e => setNewServiceForm(f => ({ ...f, desc: e.target.value }))}
                      placeholder="Speed, refill, quality notes"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddServiceForm(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingService}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingService ? 'Saving...' : 'Add Service to Catalog'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                    placeholder="Search ID, name, category..."
                    className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <select
                  value={servicePlatformFilter}
                  onChange={e => setServicePlatformFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="all">All Platforms</option>
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {removedServices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRemovedServices(prev => !prev)}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {showRemovedServices
                    ? 'Hide Removed Services'
                    : `View Removed Services (${removedServices.length})`}
                </button>
              )}
            </div>

            {/* Services Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Service Name & Category</th>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3 text-right">Rate / 1K</th>
                    <th className="py-3 px-3 text-right">Min - Max</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No services match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.slice(0, 120).map(s => (
                      <tr key={s.id} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3 font-mono font-bold text-slate-300">#{s.id}</td>
                        <td className="py-3 px-3 max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{s.name}</span>
                            {s.isCustom && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/70 text-[10px] font-bold text-emerald-400">
                                Custom
                              </span>
                            )}
                            {s.isEdited && !s.isCustom && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-700/70 text-[10px] font-bold text-amber-300">
                                Edited
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{s.category}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{s.platform}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          ₹{Number(s.rate || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {Number(s.min || 0).toLocaleString()} - {Number(s.max || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditService(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold cursor-pointer"
                              title="Edit Service"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveService(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/70 text-rose-300 font-semibold cursor-pointer"
                              title="Remove Service"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredServices.length > 120 && (
                <p className="text-[11px] text-slate-500 mt-3 text-center">
                  Showing first 120 of {filteredServices.length} matching services. Use the search box to narrow down.
                </p>
              )}
            </div>

            {/* Removed Services Restore Drawer */}
            {showRemovedServices && removedServices.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Removed Services ({removedServices.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {removedServices.map(rs => (
                    <div
                      key={rs.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          #{rs.id} · {rs.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {rs.platform} · ₹{Number(rs.rate || 0).toFixed(2)}/1K
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreService(rs.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/70 text-emerald-300 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: USERS & BLOCK / UNBLOCK */}
      {section === 'users' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Registered Users & Access Control</h2>
              <p className="text-xs text-slate-400">
                Inspect user balances, total deposits, orders count, and block or unblock accounts immediately.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="blocked">Blocked Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-right">Wallet</th>
                  <th className="py-3 px-3 text-right">Deposited</th>
                  <th className="py-3 px-3 text-right">Orders</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Joined</th>
                  <th className="py-3 px-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No users found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isAdminUser = u.role === 'admin' || u.id === currentUser.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{u.name || `@${u.username}`}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          {u.phone && (
                            <div className="text-[10px] text-slate-500 font-mono">{u.phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                              u.role === 'admin'
                                ? 'bg-orange-950/60 border-orange-700 text-orange-300'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          ₹{Number(u.balance || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          ₹{Number(u.totalDeposited || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {u.orderCount ?? 0}
                        </td>
                        <td className="py-3 px-3">
                          {u.blocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 border border-rose-700/70 text-[10px] font-bold uppercase text-rose-400">
                              <Ban className="w-3 h-3" />
                              Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/70 text-[10px] font-bold uppercase text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {isAdminUser ? (
                            <span className="text-[11px] text-slate-500 font-mono">Protected</span>
                          ) : (
                            <button
                              type="button"
                              disabled={blockingUserId === u.id}
                              onClick={() => handleToggleBlockUser(u)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                u.blocked
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-rose-600/90 hover:bg-rose-500 text-white'
                              }`}
                            >
                              {u.blocked ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Unblock</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Block User</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEditService}
            className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Edit Service #{editingService.id}
                </h3>
                <p className="text-[11px] text-slate-400">Changes apply immediately across the catalog.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={editServiceForm.name}
                  onChange={e => setEditServiceForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Platform</label>
                  <select
                    value={editServiceForm.platform}
                    onChange={e => setEditServiceForm(f => ({ ...f, platform: e.target.value as SMMService['platform'] }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    {PLATFORMS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editServiceForm.category}
                    onChange={e => setEditServiceForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Rate / 1K (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editServiceForm.rate}
                    onChange={e => setEditServiceForm(f => ({ ...f, rate: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Min Qty</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editServiceForm.min}
                    onChange={e => setEditServiceForm(f => ({ ...f, min: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Qty</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editServiceForm.max}
                    onChange={e => setEditServiceForm(f => ({ ...f, max: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editServiceForm.desc}
                  onChange={e => setEditServiceForm(f => ({ ...f, desc: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingService}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingService ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
