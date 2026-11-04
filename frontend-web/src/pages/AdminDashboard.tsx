import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  LifeBuoy,
  Loader2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import NotificationDropdown from "../components/NotificationDropdown";
import LoadingMotion from "../components/LoadingMotion";
import { apiFetch, logoutSession } from "../utils/api";

const AccountSettings = lazy(() => import("../components/AccountSettings"));
const FarmList = lazy(() => import("../features/farms/FarmList"));
const IncidentDashboard = lazy(
  () => import("../features/incidents/IncidentDashboard"),
);

type Role = "ADMIN" | "FARM_MANAGER" | "TECHNICIAN" | "FARMER";
type PendingUserChange = {
  user: AdminUser;
  field: "role" | "status";
  value: Role | boolean;
};
type AdminTab =
  | "Tổng quan"
  | "Người dùng"
  | "Workspace"
  | "Trang trại"
  | "Giám sát sự cố"
  | "Cảnh báo"
  | "Báo cáo"
  | "Nhật ký"
  | "Hệ thống"
  | "Hỗ trợ"
  | "Cài đặt";
interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}
interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
interface DashboardStats {
  statCards: Array<{
    label: string;
    value: number;
    context: string;
    color: string;
  }>;
  growthData: number[];
  growthLabels: string[];
  roleDistrib: Array<{ label: string; value: number; color: string }>;
  recentActivity: Array<{ text: string; sub: string; color: string }>;
}
interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  actor: { fullName: string; email: string };
}
interface SystemAlert {
  code: string;
  level: "INFO" | "WARNING" | "DANGER";
  title: string;
  count: number;
  description: string;
}
interface SystemHealth {
  status: string;
  checkedAt: string;
  uptimeSeconds: number;
  memory: { usedMb: number; totalMb: number };
  services: Array<{ name: string; status: string; detail: string }>;
}
interface ReportGroup {
  _count: number;
  role?: string;
  status?: string;
}
interface AdminReport {
  year: number;
  generatedAt: string;
  users: ReportGroup[];
  farms: ReportGroup[];
  crops: ReportGroup[];
  incidents: ReportGroup[];
  harvest: {
    count: number;
    actualHarvestKg?: number | null;
    actualHarvestRevenue?: number | null;
    actualHarvestCost?: number | null;
    actualHarvestProfit?: number | null;
  };
}
interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  members: Array<{
    user: { id: string; fullName: string; email: string };
  }>;
  _count: { members: number; farms: number; tickets: number };
}
interface WorkspaceMember {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isActive: boolean;
  joinedAt: string;
  user: AdminUser;
}
interface SupportTicket {
  id: string;
  workspaceId: string | null;
  requesterId: string;
  scope: "SYSTEM" | "WORKSPACE";
  subject: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  resolution?: string | null;
  createdAt: string;
  workspace: { id: string; name: string } | null;
  requester: { fullName: string; email: string };
  assignedTo?: { fullName: string; email: string } | null;
}
interface SaasMetrics {
  totalWorkspaces: number;
  activeWorkspaces: number;
  suspendedWorkspaces: number;
  newWorkspacesLast30Days: number;
  activeMemberships: number;
  workspaceFarms: number;
  openTickets: number;
  unresolvedUrgentTickets: number;
}

const roles: Record<Role, string> = {
  ADMIN: "Admin",
  FARM_MANAGER: "Quản lý",
  TECHNICIAN: "Kỹ thuật viên",
  FARMER: "Nông dân",
};
const navItems: Array<{ label: AdminTab; icon: typeof Home }> = [
  { label: "Tổng quan", icon: Home },
  { label: "Người dùng", icon: Users },
  { label: "Workspace", icon: Network },
  { label: "Trang trại", icon: Building2 },
  { label: "Giám sát sự cố", icon: AlertTriangle },
  { label: "Cảnh báo", icon: BellRing },
  { label: "Báo cáo", icon: BarChart3 },
  { label: "Nhật ký", icon: ClipboardList },
  { label: "Hệ thống", icon: HeartPulse },
  { label: "Hỗ trợ", icon: LifeBuoy },
];

const readUser = (): CurrentUser => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") as CurrentUser;
  } catch {
    return { id: "", fullName: "Admin", email: "", role: "ADMIN" };
  }
};
const responseError = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message)
      ? body.message.join(". ")
      : body.message || fallback;
  } catch {
    return fallback;
  }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentUser] = useState(readUser);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed_admin") === "true",
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = localStorage.getItem("adminActiveTab") as AdminTab | null;
    return [...navItems.map((item) => item.label), "Cài đặt"].includes(
      saved || "",
    )
      ? saved!
      : "Tổng quan";
  });

  useEffect(() => {
    localStorage.setItem("adminActiveTab", activeTab);
  }, [activeTab]);
  useEffect(() => {
    localStorage.setItem("sidebar_collapsed_admin", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  const changeTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const logout = async () => {
    await logoutSession();
    navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {isMobileSidebarOpen && (
        <button
          aria-label="Đóng thanh điều hướng"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-white transition-all duration-500 ease-out lg:relative lg:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} ${isSidebarCollapsed ? "lg:my-3 lg:ml-3 lg:h-[calc(100vh-1.5rem)] lg:w-20 lg:rounded-3xl lg:border lg:border-white/60 lg:bg-white/85 lg:shadow-[0_8px_30px_rgba(0,0,0,0.08)] lg:backdrop-blur-xl" : "lg:h-screen lg:w-72 lg:border-r lg:border-slate-200/80 lg:shadow-sm"}`}
      >
        <div
          className={`flex h-20 shrink-0 items-center border-b border-slate-100 ${isSidebarCollapsed ? "justify-between px-4 lg:justify-center lg:px-2" : "justify-between px-6"}`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logonen.jpg"
              alt="SSFM Logo"
              className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white object-cover shadow-sm"
            />
            <div className={isSidebarCollapsed ? "lg:hidden" : ""}>
              <p className="whitespace-nowrap text-lg font-black text-slate-900">
                SSFM Admin
              </p>
              <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-purple-600">
                Quản trị nền tảng
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav
          className={`flex-1 space-y-1 overflow-y-auto ${isSidebarCollapsed ? "p-2 lg:py-4" : "p-4"}`}
        >
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => changeTab(label)}
              title={isSidebarCollapsed ? label : undefined}
              className={`group relative flex w-full items-center rounded-xl py-3 text-sm font-bold transition-all ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "gap-3 px-4"} ${activeTab === label ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
                {label}
              </span>
            </button>
          ))}
          <p
            className={`${isSidebarCollapsed ? "lg:hidden" : ""} px-4 pb-1 pt-5 text-[10px] font-black uppercase tracking-widest text-slate-400`}
          >
            Tài khoản
          </p>
          <button
            onClick={() => changeTab("Cài đặt")}
            title={isSidebarCollapsed ? "Cài đặt" : undefined}
            className={`flex w-full items-center rounded-xl py-3 text-sm font-bold transition-all ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "gap-3 px-4"} ${activeTab === "Cài đặt" ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`}
          >
            <Settings className="h-5 w-5" />
            <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
              Cài đặt
            </span>
          </button>
        </nav>
        <div
          className={`shrink-0 border-t border-slate-100 ${isSidebarCollapsed ? "p-2 lg:py-3" : "p-4"}`}
        >
          <div
            className={`mb-2 flex items-center rounded-2xl bg-slate-50 ${isSidebarCollapsed ? "gap-3 p-3 lg:justify-center lg:p-2" : "gap-3 p-3"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 font-black text-purple-700">
              {(currentUser.fullName || "A").charAt(0).toUpperCase()}
            </div>
            <div className={`min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-sm font-black">
                {currentUser.fullName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            title={isSidebarCollapsed ? "Đăng xuất" : undefined}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "justify-center gap-2 px-4"}`}
          >
            <LogOut className="h-4 w-4" />
            <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
              Đăng xuất
            </span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-purple-100 bg-white/80 px-5 backdrop-blur-md sm:px-8">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="rounded-xl bg-purple-50 p-2.5 text-purple-700 transition hover:bg-purple-100 lg:hidden"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            className="hidden rounded-xl bg-purple-50 p-2.5 text-purple-700 transition hover:bg-purple-100 lg:block"
            aria-label={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black text-purple-950 sm:text-2xl">
              {activeTab}
            </h1>
            <p className="text-xs text-slate-500">
              Quản trị tài khoản, quyền truy cập và sức khỏe nền tảng SSFM
            </p>
          </div>
          <NotificationDropdown themeColor="purple" />
        </header>
        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          <Suspense
            fallback={
              <LoadingMotion
                mode="card"
                title="Đang tải giao diện quản trị..."
                subtitle="Đang chuẩn bị dữ liệu hệ thống..."
                color="purple"
              />
            }
          >
            {activeTab === "Tổng quan" && <Overview />}
            {activeTab === "Người dùng" && (
              <UsersView currentUserId={currentUser.id} />
            )}
            {activeTab === "Workspace" && <WorkspacesView />}
            {activeTab === "Trang trại" && <FarmList />}
            {activeTab === "Giám sát sự cố" && (
              <IncidentDashboard role="ADMIN" />
            )}
            {activeTab === "Cảnh báo" && <AlertsView />}
            {activeTab === "Báo cáo" && <ReportsView />}
            {activeTab === "Nhật ký" && <AuditView />}
            {activeTab === "Hệ thống" && <HealthView />}
            {activeTab === "Hỗ trợ" && (
              <SupportView currentAdminId={currentUser.id} />
            )}
            {activeTab === "Cài đặt" && <AccountSettings />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function Overview() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<DashboardStats | null>(null);
  const [saas, setSaas] = useState<SaasMetrics | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch(`/api/admin/dashboard-stats?days=${days}`),
      apiFetch("/api/admin/saas-metrics"),
    ])
      .then(async ([dashboardResponse, saasResponse]) => {
        if (!dashboardResponse.ok)
          throw new Error(
            await responseError(dashboardResponse, "Không thể tải tổng quan"),
          );
        if (!saasResponse.ok)
          throw new Error(
            await responseError(saasResponse, "Không thể tải chỉ số SaaS"),
          );
        return Promise.all([
          dashboardResponse.json() as Promise<DashboardStats>,
          saasResponse.json() as Promise<SaasMetrics>,
        ]);
      })
      .then(([dashboard, saasMetrics]) => {
        if (!cancelled) {
          setData(dashboard);
          setSaas(saasMetrics);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không thể tải tổng quan",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [days, revision]);
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => setRevision((value) => value + 1)}
      />
    );
  if (!data || !saas)
    return (
      <LoadingMotion
        mode="card"
        title="Đang tổng hợp toàn hệ thống..."
        subtitle="Đang tải tài khoản, trang trại, vụ nuôi và sự cố..."
        color="purple"
      />
    );
  const max = Math.max(...data.growthData, 1);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.statCards.map((card) => (
          <article
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <span
              className="mb-4 block h-2 w-12 rounded-full"
              style={{ backgroundColor: card.color }}
            />
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-black">
              {card.value.toLocaleString("vi-VN")}
            </p>
            <p className="mt-2 text-xs text-slate-400">{card.context}</p>
          </article>
        ))}
      </div>
      <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-purple-950">Vận hành SaaS</h2>
            <p className="text-xs text-slate-500">
              Chỉ số workspace và hỗ trợ; chưa bao gồm doanh thu thuê bao.
            </p>
          </div>
          <Network className="h-7 w-7 text-purple-600" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Workspace hoạt động" value={saas.activeWorkspaces} />
          <Metric label="Thành viên hoạt động" value={saas.activeMemberships} />
          <Metric label="Trang trại đã phân vùng" value={saas.workspaceFarms} />
          <Metric label="Ticket đang xử lý" value={saas.openTickets} />
        </div>
        {saas.unresolvedUrgentTickets > 0 && (
          <p className="mt-4 rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-700">
            {saas.unresolvedUrgentTickets} ticket khẩn cấp chưa hoàn tất.
          </p>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">Tài khoản đăng ký mới</h2>
              <p className="text-xs text-slate-500">Dữ liệu thực theo ngày</p>
            </div>
            <select
              value={days}
              onChange={(event) => {
                setData(null);
                setDays(Number(event.target.value) as 7 | 30);
              }}
              className="rounded-xl border p-2 text-xs font-bold"
            >
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
          </div>
          <div className="mt-6 flex h-52 items-end gap-1 border-b border-slate-200">
            {data.growthData.map((value, index) => (
              <div
                key={`${data.growthLabels[index]}-${index}`}
                className="group relative flex h-full flex-1 items-end"
              >
                <span className="absolute left-1/2 top-0 hidden -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                  {value}
                </span>
                <div
                  className="w-full rounded-t bg-purple-500"
                  style={{
                    height: `${Math.max(value ? 5 : 1, (value / max) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex">
            {data.growthLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="flex-1 truncate text-center text-[9px] text-slate-400"
              >
                {days === 7 || index % 5 === 0 ? label : ""}
              </span>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-black">Phân bổ vai trò</h2>
          <div className="mt-5 space-y-3">
            {data.roleDistrib.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <i
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-black">Hoạt động gần đây</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.recentActivity.map((item, index) => (
            <div
              key={`${item.text}-${index}`}
              className="flex gap-3 rounded-xl bg-slate-50 p-4"
            >
              <i className={`mt-1 h-3 w-3 rounded-full ${item.color}`} />
              <div>
                <p className="text-sm font-bold">{item.text}</p>
                <p className="text-xs text-slate-400">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UsersView({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingUserChange | null>(
    null,
  );
  const [savingChange, setSavingChange] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("isActive", status);
      void apiFetch(`/api/users?${params}`)
        .then(async (response) => {
          if (!response.ok)
            throw new Error(
              await responseError(response, "Không thể tải người dùng"),
            );
          return response.json() as Promise<{
            items: AdminUser[];
            pagination: Pagination;
          }>;
        })
        .then((value) => {
          if (!cancelled) {
            setUsers(value.items);
            setPagination(value.pagination);
            setError("");
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled)
            setError(
              reason instanceof Error
                ? reason.message
                : "Không thể tải người dùng",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, search, role, status, revision]);
  const patchUser = async () => {
    if (!pendingChange) return;
    const { user, field, value } = pendingChange;
    setSavingChange(true);
    try {
      const response = await apiFetch(`/api/users/${user.id}/${field}`, {
        method: "PATCH",
        body: JSON.stringify(
          field === "role" ? { role: value } : { isActive: value },
        ),
      });
      if (!response.ok)
        throw new Error(await responseError(response, "Cập nhật thất bại"));
      toast.success(
        field === "role"
          ? `Đã đổi vai trò của ${user.fullName}`
          : `Đã ${value ? "mở khóa" : "khóa"} tài khoản ${user.fullName}`,
      );
      setPendingChange(null);
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Cập nhật thất bại",
      );
    } finally {
      setSavingChange(false);
    }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm tên hoặc email..."
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-3 text-sm font-bold"
        >
          <option value="">Tất cả vai trò</option>
          {Object.entries(roles).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-3 text-sm font-bold"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Hoạt động</option>
          <option value="false">Bị khóa</option>
        </select>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </button>
      </div>
      {error ? (
        <ErrorState
          message={error}
          retry={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        />
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="font-black">Danh sách người dùng</h2>
            <p className="text-xs text-slate-500">
              {pagination.total} tài khoản phù hợp
            </p>
          </div>
          {loading ? (
            <LoadingMotion
              mode="card"
              title="Đang tải người dùng..."
              subtitle="Đang áp dụng bộ lọc và phân trang..."
              color="purple"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Người dùng</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4">
                        <p className="font-black">
                          {user.fullName}
                          {user.id === currentUserId && (
                            <small className="ml-2 text-purple-600">Bạn</small>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td>
                        <select
                          disabled={user.id === currentUserId}
                          value={user.role}
                          onChange={(event) =>
                            setPendingChange({
                              user,
                              field: "role",
                              value: event.target.value as Role,
                            })
                          }
                          className="rounded-lg border p-2 text-xs font-bold disabled:opacity-50"
                        >
                          {Object.entries(roles).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          disabled={user.id === currentUserId}
                          value={String(user.isActive)}
                          onChange={(event) =>
                            setPendingChange({
                              user,
                              field: "status",
                              value: event.target.value === "true",
                            })
                          }
                          className="rounded-lg border p-2 text-xs font-bold disabled:opacity-50"
                        >
                          <option value="true">Hoạt động</option>
                          <option value="false">Bị khóa</option>
                        </select>
                      </td>
                      <td className="text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-12 text-center text-slate-500"
                      >
                        Không tìm thấy tài khoản.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pager
            value={pagination}
            setPage={(value) => {
              setLoading(true);
              setPage(value);
            }}
          />
        </section>
      )}
      {createOpen && (
        <CreateUser
          close={() => setCreateOpen(false)}
          created={() => {
            setCreateOpen(false);
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {pendingChange && (
        <UserChangeConfirmation
          change={pendingChange}
          saving={savingChange}
          close={() => setPendingChange(null)}
          confirm={() => void patchUser()}
        />
      )}
    </div>
  );
}

function UserChangeConfirmation({
  change,
  saving,
  close,
  confirm,
}: {
  change: PendingUserChange;
  saving: boolean;
  close: () => void;
  confirm: () => void;
}) {
  const isRoleChange = change.field === "role";
  const nextRole = isRoleChange ? roles[change.value as Role] : null;
  const activating = change.value === true;
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900">
              {isRoleChange
                ? "Xác nhận thay đổi vai trò"
                : "Xác nhận trạng thái tài khoản"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Tài khoản: <strong>{change.user.fullName}</strong>
            </p>
          </div>
          <button disabled={saving} onClick={close} aria-label="Đóng">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isRoleChange ? (
            <p>
              Vai trò sẽ đổi từ <strong>{roles[change.user.role]}</strong> sang{" "}
              <strong>{nextRole}</strong>. Quyền truy cập nghiệp vụ của người
              dùng sẽ thay đổi ngay sau lần gọi API tiếp theo.
            </p>
          ) : (
            <p>
              Tài khoản sẽ được{" "}
              <strong>{activating ? "mở khóa" : "khóa"}</strong>.
              {!activating &&
                " Các phiên đăng nhập làm mới hiện tại cũng sẽ bị thu hồi."}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Thao tác này chỉ dành cho System Admin và sẽ được lưu trong nhật ký
          quản trị.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            disabled={saving}
            onClick={close}
            className="rounded-xl border px-5 py-2.5 font-bold"
          >
            Hủy
          </button>
          <button
            disabled={saving}
            onClick={confirm}
            className="rounded-xl bg-amber-600 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            {saving ? "Đang cập nhật..." : "Xác nhận thay đổi"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CreateUser({
  close,
  created,
}: {
  close: () => void;
  created: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "FARMER" as Role,
  });
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, "Tạo tài khoản thất bại"),
        );
      toast.success("Đã tạo tài khoản");
      created();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Tạo tài khoản thất bại",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex justify-between">
          <div>
            <h2 className="text-xl font-black">Thêm người dùng</h2>
            <p className="text-xs text-slate-500">
              Tài khoản được kích hoạt sau khi tạo.
            </p>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <Field label="Họ tên">
            <input
              required
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
              className="w-full rounded-xl border p-3"
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              className="w-full rounded-xl border p-3"
            />
          </Field>
          <Field label="Mật khẩu ban đầu">
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              className="w-full rounded-xl border p-3"
            />
          </Field>
          <Field label="Vai trò">
            <select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as Role })
              }
              className="w-full rounded-xl border p-3"
            >
              {Object.entries(roles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border px-5 py-2.5 font-bold"
          >
            Hủy
          </button>
          <button
            disabled={saving}
            className="rounded-xl bg-purple-600 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            {saving ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkspacesView() {
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceSummary | null>(null);
  const [pendingStatus, setPendingStatus] = useState<WorkspaceSummary | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch("/api/workspaces"),
      apiFetch("/api/users?isActive=true&pageSize=100"),
    ])
      .then(async ([workspaceResponse, userResponse]) => {
        if (!workspaceResponse.ok)
          throw new Error(
            await responseError(workspaceResponse, "Không thể tải workspace"),
          );
        if (!userResponse.ok)
          throw new Error(
            await responseError(userResponse, "Không thể tải người dùng"),
          );
        const workspaceData =
          (await workspaceResponse.json()) as WorkspaceSummary[];
        const userData = (await userResponse.json()) as {
          items: AdminUser[];
        };
        return { workspaceData, userData };
      })
      .then(({ workspaceData, userData }) => {
        if (!cancelled) {
          setItems(workspaceData);
          setUsers(userData.items);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không thể tải workspace",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const toggleStatus = async (workspace: WorkspaceSummary) => {
    const status = workspace.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const response = await apiFetch(
        `/api/workspaces/${workspace.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      if (!response.ok)
        throw new Error(await responseError(response, "Cập nhật thất bại"));
      toast.success(
        status === "ACTIVE"
          ? "Đã kích hoạt workspace"
          : "Đã tạm ngưng workspace",
      );
      setPendingStatus(null);
      setRevision((value) => value + 1);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Cập nhật thất bại",
      );
    }
  };

  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setLoading(true);
          setRevision((value) => value + 1);
        }}
      />
    );
  if (loading)
    return (
      <LoadingMotion
        mode="card"
        title="Đang tải workspace..."
        subtitle="Đang kiểm tra tenant, thành viên và trang trại..."
        color="purple"
      />
    );
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="text-xs font-black uppercase tracking-wider text-purple-600">
              Quản lý khách hàng SaaS
            </span>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              Tổ chức khách hàng
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Mỗi workspace đại diện cho một khách hàng hoặc doanh nghiệp. Trang
              trại, thành viên và yêu cầu hỗ trợ của các workspace được tách
              biệt với nhau.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-500/20"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Tạo tổ chức mới
          </button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ["1", "Tạo tổ chức", "Chọn một Farm Manager làm chủ sở hữu."],
            [
              "2",
              "Thêm thành viên",
              "Workspace Admin quản lý người dùng của tổ chức.",
            ],
            [
              "3",
              "Quản lý trang trại",
              "Dữ liệu nghiệp vụ chỉ nằm trong đúng tổ chức.",
            ],
          ].map(([step, title, description]) => (
            <div
              key={step}
              className="flex gap-3 rounded-2xl border border-purple-100 bg-white/80 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-sm font-black text-purple-700">
                {step}
              </span>
              <div>
                <p className="text-sm font-black">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-black">Danh sách tổ chức</h3>
          <p className="text-xs text-slate-500">
            {items.length} tổ chức trên hệ thống
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((workspace) => (
          <article
            key={workspace.id}
            className="rounded-3xl border bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-black">{workspace.name}</h3>
                  <p className="text-xs text-slate-400">
                    Tạo ngày{" "}
                    {new Date(workspace.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-lg px-2 py-1 text-[10px] font-black ${workspace.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
              >
                {workspace.status === "ACTIVE" ? "HOẠT ĐỘNG" : "TẠM NGƯNG"}
              </span>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Chủ sở hữu
              </p>
              <p className="mt-1 text-sm font-black">
                {workspace.members[0]?.user.fullName || "Chưa xác định"}
              </p>
              <p className="text-xs text-slate-500">
                {workspace.members[0]?.user.email}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x rounded-2xl border py-3 text-center">
              <div>
                <strong className="block text-lg">
                  {workspace._count.members}
                </strong>
                <span className="text-[10px] text-slate-500">Thành viên</span>
              </div>
              <div>
                <strong className="block text-lg">
                  {workspace._count.farms}
                </strong>
                <span className="text-[10px] text-slate-500">Trang trại</span>
              </div>
              <div>
                <strong className="block text-lg">
                  {workspace._count.tickets}
                </strong>
                <span className="text-[10px] text-slate-500">Hỗ trợ</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSelected(workspace)}
                className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold"
              >
                Quản lý thành viên
              </button>
              <button
                onClick={() => setPendingStatus(workspace)}
                className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold"
              >
                {workspace.status === "ACTIVE"
                  ? "Tạm dừng truy cập"
                  : "Kích hoạt lại"}
              </button>
            </div>
          </article>
        ))}
        {!items.length && (
          <div className="col-span-full rounded-3xl border bg-white p-12 text-center text-slate-500">
            Chưa có tổ chức khách hàng. Hãy tạo tổ chức mới hoặc chuyển các
            trang trại cũ vào workspace.
          </div>
        )}
      </div>
      {createOpen && (
        <CreateWorkspace
          managers={users.filter((user) => user.role === "FARM_MANAGER")}
          close={() => setCreateOpen(false)}
          created={() => {
            setCreateOpen(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {pendingStatus && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/55 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black">
              {pendingStatus.status === "ACTIVE"
                ? "Tạm dừng tổ chức?"
                : "Kích hoạt lại tổ chức?"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pendingStatus.status === "ACTIVE"
                ? `Thành viên của ${pendingStatus.name} sẽ tạm thời không thể truy cập dữ liệu trang trại. Dữ liệu không bị xóa.`
                : `Thành viên của ${pendingStatus.name} sẽ có thể truy cập lại theo quyền được phân công.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingStatus(null)}
                className="rounded-xl border px-5 py-2.5 font-bold"
              >
                Hủy
              </button>
              <button
                onClick={() => void toggleStatus(pendingStatus)}
                className={`rounded-xl px-5 py-2.5 font-black text-white ${pendingStatus.status === "ACTIVE" ? "bg-rose-600" : "bg-emerald-600"}`}
              >
                {pendingStatus.status === "ACTIVE"
                  ? "Tạm dừng truy cập"
                  : "Kích hoạt lại"}
              </button>
            </div>
          </section>
        </div>
      )}
      {selected && (
        <WorkspaceMembers
          workspace={selected}
          users={users.filter((user) => user.role !== "ADMIN")}
          close={() => setSelected(null)}
          changed={() => setRevision((value) => value + 1)}
        />
      )}
    </div>
  );
}

function CreateWorkspace({
  managers,
  close,
  created,
}: {
  managers: AdminUser[];
  close: () => void;
  created: () => void;
}) {
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, ownerId }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, "Không thể tạo workspace"),
        );
      toast.success("Đã tạo workspace");
      created();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Không thể tạo workspace",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex justify-between">
          <div>
            <h3 className="text-xl font-black">Tạo tổ chức khách hàng</h3>
            <p className="mt-1 text-sm text-slate-500">
              Một tổ chức là vùng dữ liệu riêng của một khách hàng.
            </p>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <label className="mt-5 block text-sm font-bold">
          Tên tổ chức
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Công ty Tôm Xanh"
            className="mt-2 w-full rounded-xl border p-3"
          />
          <span className="mt-1 block text-xs font-normal text-slate-400">
            Tên doanh nghiệp hoặc nhóm trang trại của khách hàng.
          </span>
        </label>
        <label className="mt-4 block text-sm font-bold">
          Người sở hữu
          <select
            required
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="mt-2 w-full rounded-xl border p-3"
          >
            <option value="">Chọn một Farm Manager</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.fullName} · {manager.email}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-400">
            Người này quản lý thành viên và hoạt động của tổ chức.
          </span>
        </label>
        {!managers.length && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            Chưa có Farm Manager đang hoạt động. Hãy tạo hoặc cấp vai trò Farm
            Manager trước.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border px-5 py-2.5 font-bold"
          >
            Hủy
          </button>
          <button
            disabled={saving || !managers.length}
            className="rounded-xl bg-purple-600 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            {saving ? "Đang tạo..." : "Tạo tổ chức"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkspaceMembers({
  workspace,
  users,
  close,
  changed,
}: {
  workspace: WorkspaceSummary;
  users: AdminUser[];
  close: () => void;
  changed: () => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [newOwner, setNewOwner] = useState<WorkspaceMember | null>(null);
  const [transferring, setTransferring] = useState(false);
  const load = async () => {
    const response = await apiFetch(`/api/workspaces/${workspace.id}/members`);
    if (!response.ok)
      throw new Error(
        await responseError(response, "Không thể tải thành viên"),
      );
    setMembers((await response.json()) as WorkspaceMember[]);
  };
  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/workspaces/${workspace.id}/members`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể tải thành viên"),
          );
        return response.json() as Promise<WorkspaceMember[]>;
      })
      .then((value) => {
        if (!cancelled) setMembers(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Không thể tải thành viên",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);
  const add = async () => {
    const response = await apiFetch(`/api/workspaces/${workspace.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    });
    if (!response.ok)
      throw new Error(
        await responseError(response, "Không thể thêm thành viên"),
      );
    toast.success("Đã cập nhật thành viên workspace");
    setUserId("");
    await load();
    changed();
  };
  const toggle = async (member: WorkspaceMember) => {
    const response = await apiFetch(
      `/api/workspaces/${workspace.id}/members/${member.id}`,
      { method: "PATCH", body: JSON.stringify({ isActive: !member.isActive }) },
    );
    if (!response.ok)
      throw new Error(
        await responseError(response, "Không thể cập nhật thành viên"),
      );
    await load();
    changed();
  };
  const transferOwnership = async () => {
    if (!newOwner) return;
    setTransferring(true);
    try {
      const response = await apiFetch(`/api/workspaces/${workspace.id}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ newOwnerId: newOwner.user.id }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, "Không thể chuyển chủ sở hữu"),
        );
      toast.success(`Đã chuyển quyền sở hữu cho ${newOwner.user.fullName}`);
      setNewOwner(null);
      await load();
      changed();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Không thể chuyển chủ sở hữu",
      );
    } finally {
      setTransferring(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4">
      <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between">
          <div>
            <h3 className="text-xl font-black">Quản lý thành viên</h3>
            <p className="text-sm text-slate-500">Tổ chức: {workspace.name}</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-purple-100 bg-purple-50 p-4 text-xs text-purple-900 sm:grid-cols-2">
          <p>
            <strong>Quản trị tổ chức:</strong> được thêm và vô hiệu hóa thành
            viên.
          </p>
          <p>
            <strong>Thành viên:</strong> chỉ truy cập farm khi được phân công.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 sm:flex-row">
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border p-2.5"
          >
            <option value="">Chọn tài khoản cần thêm</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} · {user.email}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "ADMIN" | "MEMBER")
            }
            className="rounded-xl border p-2.5"
          >
            <option value="MEMBER">Thành viên</option>
            <option value="ADMIN">Quản trị tổ chức</option>
          </select>
          <button
            disabled={!userId}
            onClick={() =>
              void add().catch((reason: unknown) =>
                toast.error(
                  reason instanceof Error
                    ? reason.message
                    : "Không thể thêm thành viên",
                ),
              )
            }
            className="rounded-xl bg-purple-600 px-4 font-bold text-white disabled:opacity-50"
          >
            Thêm
          </button>
        </div>
        <div className="mt-4 divide-y">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-black">{member.user.fullName}</p>
                <p className="text-xs text-slate-500">
                  {member.user.email} ·{" "}
                  {member.role === "OWNER"
                    ? "Chủ sở hữu"
                    : member.role === "ADMIN"
                      ? "Quản trị tổ chức"
                      : "Thành viên"}
                </p>
              </div>
              <div className="flex gap-2">
                {member.role !== "OWNER" &&
                  member.isActive &&
                  member.user.isActive &&
                  member.user.role === "FARM_MANAGER" && (
                    <button
                      onClick={() => setNewOwner(member)}
                      className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700"
                    >
                      Chuyển thành chủ
                    </button>
                  )}
                <button
                  disabled={member.role === "OWNER"}
                  onClick={() =>
                    void toggle(member).catch((reason: unknown) =>
                      toast.error(
                        reason instanceof Error
                          ? reason.message
                          : "Không thể cập nhật thành viên",
                      ),
                    )
                  }
                  className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  {member.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {newOwner && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black">Chuyển chủ sở hữu tổ chức?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <strong>{newOwner.user.fullName}</strong> sẽ trở thành Chủ tổ
              chức. Chủ hiện tại được chuyển thành Quản trị tổ chức. Dữ liệu
              trang trại không thay đổi.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={transferring}
                onClick={() => setNewOwner(null)}
                className="rounded-xl border px-5 py-2.5 font-bold"
              >
                Hủy
              </button>
              <button
                disabled={transferring}
                onClick={() => void transferOwnership()}
                className="rounded-xl bg-purple-600 px-5 py-2.5 font-black text-white disabled:opacity-50"
              >
                {transferring ? "Đang chuyển..." : "Xác nhận bàn giao"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SupportView({ currentAdminId }: { currentAdminId: string }) {
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<
    SupportTicket["status"] | null
  >(null);
  const updating = updatingStatus !== null;
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (scopeFilter) params.set("scope", scopeFilter);
    if (workspaceFilter) params.set("workspaceId", workspaceFilter);
    void apiFetch(`/api/support-tickets?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể tải yêu cầu hỗ trợ"),
          );
        return response.json() as Promise<{
          items: SupportTicket[];
          pagination: { totalPages: number };
        }>;
      })
      .then((value) => {
        if (!cancelled) {
          setItems(value.items);
          setTotalPages(value.pagination.totalPages);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Không thể tải yêu cầu hỗ trợ",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, priorityFilter, scopeFilter, statusFilter, workspaceFilter]);
  useEffect(() => {
    void apiFetch("/api/workspaces")
      .then((response) => (response.ok ? response.json() : []))
      .then((value: Array<{ id: string; name: string }>) =>
        setWorkspaces(value),
      );
  }, []);
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socket = io(apiUrl + "/notifications", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });
    const matchesFilters = (ticket: SupportTicket) =>
      (!statusFilter || ticket.status === statusFilter) &&
      (!priorityFilter || ticket.priority === priorityFilter) &&
      (!scopeFilter || ticket.scope === scopeFilter) &&
      (!workspaceFilter || ticket.workspaceId === workspaceFilter);
    const handleCreated = (ticket: SupportTicket) => {
      if (page !== 1 || !matchesFilters(ticket)) return;
      setItems((current) =>
        [ticket, ...current.filter((item) => item.id !== ticket.id)].slice(
          0,
          20,
        ),
      );
    };
    const handleUpdated = (
      updated: Partial<SupportTicket> & Pick<SupportTicket, "id">,
    ) => {
      setItems((current) =>
        current.flatMap((ticket) => {
          if (ticket.id !== updated.id) return [ticket];
          const merged = { ...ticket, ...updated };
          return matchesFilters(merged) ? [merged] : [];
        }),
      );
      setSelected((current) =>
        current?.id === updated.id ? { ...current, ...updated } : current,
      );
    };
    socket.on("supportTicketCreated", handleCreated);
    socket.on("supportTicketUpdated", handleUpdated);
    return () => {
      socket.off("supportTicketCreated", handleCreated);
      socket.off("supportTicketUpdated", handleUpdated);
      socket.disconnect();
    };
  }, [page, priorityFilter, scopeFilter, statusFilter, workspaceFilter]);
  const update = async (status: SupportTicket["status"]) => {
    if (!selected || updating) return;
    setUpdatingStatus(status);
    try {
      const response = await apiFetch("/api/support-tickets/" + selected.id, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "IN_PROGRESS" && selected.status === "OPEN"
            ? { assignedToId: currentAdminId }
            : {}),
          ...(status === "RESOLVED" ? { resolution } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, "Không thể cập nhật ticket"),
        );
      const updated = (await response.json()) as Partial<SupportTicket>;
      const merged: SupportTicket = { ...selected, ...updated, status };
      setItems((current) =>
        statusFilter && statusFilter !== status
          ? current.filter((ticket) => ticket.id !== merged.id)
          : current.map((ticket) =>
              ticket.id === merged.id ? merged : ticket,
            ),
      );
      if (status === "CLOSED") setSelected(null);
      else setSelected(merged);
      if (status === "IN_PROGRESS") setResolution("");
      const successMessages: Record<SupportTicket["status"], string> = {
        OPEN: "Đã chuyển ticket về trạng thái mới",
        IN_PROGRESS:
          selected.status === "OPEN"
            ? "Đã tiếp nhận ticket"
            : "Đã mở lại ticket",
        RESOLVED: "Đã hoàn tất xử lý ticket",
        CLOSED: "Đã đóng ticket",
      };
      toast.success(successMessages[status]);
    } finally {
      setUpdatingStatus(null);
    }
  };
  if (loading)
    return (
      <LoadingMotion
        mode="card"
        title="Đang tải trung tâm hỗ trợ..."
        color="purple"
      />
    );
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-3xl border bg-white p-6">
        <h2 className="font-black">Trung tâm hỗ trợ khách hàng</h2>
        <p className="text-xs text-slate-500">
          Ticket gồm lỗi hệ thống và vấn đề thuộc từng workspace, đồng thời lưu
          dấu thao tác xử lý.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={scopeFilter}
            onChange={(event) => {
              setScopeFilter(event.target.value);
              setWorkspaceFilter("");
              setPage(1);
            }}
            className="rounded-xl border p-2.5 text-sm"
          >
            <option value="">Mọi phạm vi</option>
            <option value="SYSTEM">Hệ thống SSFM</option>
            <option value="WORKSPACE">Theo workspace</option>
          </select>
          <select
            value={workspaceFilter}
            disabled={scopeFilter === "SYSTEM"}
            onChange={(event) => {
              setWorkspaceFilter(event.target.value);
              setScopeFilter(event.target.value ? "WORKSPACE" : scopeFilter);
              setPage(1);
            }}
            className="rounded-xl border p-2.5 text-sm disabled:bg-slate-100"
          >
            <option value="">Tất cả workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border p-2.5 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Mới</option>
            <option value="IN_PROGRESS">Đang xử lý</option>
            <option value="RESOLVED">Đã xử lý</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border p-2.5 text-sm"
          >
            <option value="">Mọi mức ưu tiên</option>
            <option value="URGENT">Khẩn cấp</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => {
              setSelected(ticket);
              setResolution(ticket.resolution || "");
            }}
            className="rounded-3xl border bg-white p-6 text-left shadow-sm"
          >
            <div className="flex justify-between gap-3">
              <span className="text-xs font-black text-purple-700">
                {ticket.workspace?.name ?? "Hệ thống SSFM"}
              </span>
              <span className="text-xs font-bold">
                {ticket.priority} · {ticket.status}
              </span>
            </div>
            <h3 className="mt-3 font-black">{ticket.subject}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-slate-500">
              {ticket.description}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              {ticket.requester.fullName} ·{" "}
              {new Date(ticket.createdAt).toLocaleString("vi-VN")}
            </p>
          </button>
        ))}
      </div>
      {!items.length && !loading && (
        <div className="rounded-3xl border bg-white p-12 text-center text-slate-500">
          Không có yêu cầu phù hợp bộ lọc.
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
          className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          Trang trước
        </button>
        <span className="text-sm text-slate-500">
          {page}/{totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          Trang sau
        </button>
      </div>
      {selected && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4">
          <section className="w-full max-w-xl rounded-3xl bg-white p-6">
            <div className="flex justify-between">
              <div>
                <h3 className="text-xl font-black">{selected.subject}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.workspace?.name ?? "Hệ thống SSFM"} ·{" "}
                  {selected.status} · {selected.priority}
                </p>
              </div>
              <button
                disabled={updating}
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <X />
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm">
              {selected.description}
            </p>
            {selected.status === "IN_PROGRESS" && (
              <label className="mt-4 block text-sm font-bold">
                Kết quả xử lý
                <textarea
                  disabled={updating}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border p-3 disabled:bg-slate-50"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              {selected.status === "OPEN" && (
                <button
                  disabled={updating}
                  onClick={() =>
                    void update("IN_PROGRESS").catch((reason: unknown) =>
                      toast.error(
                        reason instanceof Error
                          ? reason.message
                          : "Không thể cập nhật",
                      ),
                    )
                  }
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 font-black text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {updatingStatus === "IN_PROGRESS" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {updatingStatus === "IN_PROGRESS"
                    ? "Đang tiếp nhận"
                    : "Tiếp nhận"}
                </button>
              )}
              {selected.status === "IN_PROGRESS" && (
                <button
                  disabled={updating || !resolution.trim()}
                  onClick={() =>
                    void update("RESOLVED").catch((reason: unknown) =>
                      toast.error(
                        reason instanceof Error
                          ? reason.message
                          : "Không thể cập nhật",
                      ),
                    )
                  }
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingStatus === "RESOLVED" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {updatingStatus === "RESOLVED" ? "Đang hoàn tất" : "Hoàn tất"}
                </button>
              )}
              {selected.status === "RESOLVED" && (
                <>
                  <button
                    disabled={updating}
                    onClick={() =>
                      void update("IN_PROGRESS").catch((reason: unknown) =>
                        toast.error(
                          reason instanceof Error
                            ? reason.message
                            : "Không thể cập nhật",
                        ),
                      )
                    }
                    className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-bold disabled:cursor-wait disabled:opacity-50"
                  >
                    {updatingStatus === "IN_PROGRESS" && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {updatingStatus === "IN_PROGRESS"
                      ? "Đang mở lại"
                      : "Mở lại"}
                  </button>
                  <button
                    disabled={updating}
                    onClick={() =>
                      void update("CLOSED").catch((reason: unknown) =>
                        toast.error(
                          reason instanceof Error
                            ? reason.message
                            : "Không thể cập nhật",
                        ),
                      )
                    }
                    className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 font-black text-white disabled:cursor-wait disabled:opacity-50"
                  >
                    {updatingStatus === "CLOSED" && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {updatingStatus === "CLOSED" ? "Đang đóng" : "Đóng ticket"}
                  </button>
                </>
              )}
              {selected.status === "CLOSED" && (
                <span className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-500">
                  Ticket đã đóng
                </span>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AlertsView() {
  const [data, setData] = useState<SystemAlert[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/admin/alerts")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể tải cảnh báo"),
          );
        return response.json() as Promise<SystemAlert[]>;
      })
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "Không thể tải cảnh báo",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setData(null);
          setError("");
          setRevision((value) => value + 1);
        }}
      />
    );
  if (!data)
    return (
      <LoadingMotion
        mode="card"
        title="Đang phân tích cảnh báo..."
        subtitle="Đang kiểm tra sự cố, trang trại và tài khoản..."
        color="purple"
      />
    );
  return (
    <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
      {data.map((item) => (
        <article
          key={item.code}
          className={`rounded-3xl border bg-white p-6 shadow-sm ${item.level === "DANGER" ? "border-rose-200" : item.level === "WARNING" ? "border-amber-200" : "border-slate-200"}`}
        >
          <div className="flex justify-between">
            <div>
              <p className="font-black">{item.title}</p>
              <p className="mt-2 text-sm text-slate-500">{item.description}</p>
            </div>
            <strong className="text-3xl">{item.count}</strong>
          </div>
          <span className="mt-4 inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">
            {item.level}
          </span>
        </article>
      ))}
    </div>
  );
}

function ReportsView() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<AdminReport | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/admin/report?year=${year}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể tải báo cáo"),
          );
        return response.json() as Promise<AdminReport>;
      })
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "Không thể tải báo cáo",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [year, revision]);
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Chỉ số", "Giá trị"],
      ["Năm", data.year],
      ["Số vụ thu hoạch", data.harvest.count],
      ["Sản lượng (kg)", data.harvest.actualHarvestKg || 0],
      ["Doanh thu", data.harvest.actualHarvestRevenue || 0],
      ["Chi phí", data.harvest.actualHarvestCost || 0],
      ["Lợi nhuận", data.harvest.actualHarvestProfit || 0],
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ssfm-admin-report-${year}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setData(null);
          setRevision((value) => value + 1);
        }}
      />
    );
  if (!data)
    return (
      <LoadingMotion
        mode="card"
        title="Đang tạo báo cáo..."
        subtitle="Đang tổng hợp dữ liệu toàn hệ thống..."
        color="purple"
      />
    );
  const money = (value?: number | null) =>
    (value || 0).toLocaleString("vi-VN") + " ₫";
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex justify-between rounded-3xl border bg-white p-5">
        <div>
          <h2 className="font-black">Báo cáo quản trị hệ thống</h2>
          <p className="text-xs text-slate-500">
            Tổng hợp dữ liệu thật, không thay thế báo cáo vận hành từng farm.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(event) => {
              setData(null);
              setYear(Number(event.target.value));
            }}
            className="rounded-xl border px-3 font-bold"
          >
            {Array.from({ length: 5 }, (_, index) => currentYear - index).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-bold text-white"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vụ thu hoạch" value={data.harvest.count} />
        <Metric
          label="Sản lượng"
          value={`${(data.harvest.actualHarvestKg || 0).toLocaleString("vi-VN")} kg`}
        />
        <Metric
          label="Doanh thu"
          value={money(data.harvest.actualHarvestRevenue)}
        />
        <Metric
          label="Lợi nhuận"
          value={money(data.harvest.actualHarvestProfit)}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[
          ["Người dùng", data.users, "role"],
          ["Trang trại", data.farms, "status"],
          ["Vụ nuôi", data.crops, "status"],
          ["Sự cố", data.incidents, "status"],
        ].map(([title, groups, key]) => (
          <section
            key={String(title)}
            className="rounded-3xl border bg-white p-6"
          >
            <h3 className="font-black">{String(title)}</h3>
            <div className="mt-4 space-y-2">
              {(groups as ReportGroup[]).map((group) => (
                <div
                  key={String(group[key as "role" | "status"])}
                  className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <span>{String(group[key as "role" | "status"])}</span>
                  <strong>{group._count}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/admin/audit-logs?page=${page}&pageSize=20`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể tải nhật ký"),
          );
        return response.json() as Promise<{
          items: AuditLog[];
          pagination: Pagination;
        }>;
      })
      .then((value) => {
        if (!cancelled) {
          setLogs(value.items);
          setPagination(value.pagination);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "Không thể tải nhật ký",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, revision]);
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setLoading(true);
          setRevision((value) => value + 1);
        }}
      />
    );
  return (
    <section className="mx-auto max-w-7xl overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b p-6">
        <h2 className="font-black">Nhật ký quản trị</h2>
        <p className="text-xs text-slate-500">
          Lưu dấu các thao tác có quyền cao.
        </p>
      </div>
      {loading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải nhật ký..."
          subtitle="Đang truy xuất lịch sử quản trị..."
          color="purple"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-4">Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-4 text-xs">
                    {new Date(log.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <b>{log.actor.fullName}</b>
                    <p className="text-xs text-slate-500">{log.actor.email}</p>
                  </td>
                  <td>
                    <span className="rounded-lg bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="text-xs">
                    {log.targetType} {log.targetId?.slice(0, 8)}
                  </td>
                  <td className="max-w-xs truncate text-xs text-slate-500">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    Chưa có nhật ký.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        value={pagination}
        setPage={(value) => {
          setLoading(true);
          setPage(value);
        }}
      />
    </section>
  );
}

function HealthView() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/admin/system-health")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await responseError(response, "Không thể kiểm tra hệ thống"),
          );
        return response.json() as Promise<SystemHealth>;
      })
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không thể kiểm tra hệ thống",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => setRevision((value) => value + 1)}
      />
    );
  if (!data)
    return (
      <LoadingMotion
        mode="card"
        title="Đang kiểm tra hệ thống..."
        subtitle="Đang kiểm tra API, database và dịch vụ tích hợp..."
        color="purple"
      />
    );
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between rounded-3xl border bg-white p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={`h-10 w-10 ${data.status === "HEALTHY" ? "text-emerald-500" : "text-amber-500"}`}
          />
          <div>
            <h2 className="font-black">
              {data.status === "HEALTHY"
                ? "Hệ thống hoạt động bình thường"
                : "Hệ thống cần kiểm tra"}
            </h2>
            <p className="text-xs text-slate-500">
              Cập nhật {new Date(data.checkedAt).toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setData(null);
            setRevision((value) => value + 1);
          }}
          className="rounded-xl border p-2"
        >
          <RefreshCw />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.services.map((service) => (
          <article
            key={service.name}
            className="rounded-3xl border bg-white p-6"
          >
            <div className="flex justify-between">
              <h3 className="font-black">{service.name}</h3>
              <span
                className={`rounded-lg px-2 py-1 text-xs font-bold ${service.status === "UP" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                {service.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">{service.detail}</p>
          </article>
        ))}
      </div>
      <article className="rounded-3xl border bg-white p-6">
        <Activity className="h-6 w-6 text-purple-600" />
        <p className="mt-2 font-black">Bộ nhớ Node.js</p>
        <p className="text-sm text-slate-500">
          {data.memory.usedMb} MB / {data.memory.totalMb} MB heap · Uptime{" "}
          {Math.floor(data.uptimeSeconds / 60)} phút
        </p>
      </article>
    </div>
  );
}

function Pager({
  value,
  setPage,
}: {
  value: Pagination;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-6 py-4">
      <span className="text-xs text-slate-500">
        Trang {value.page}/{value.totalPages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={value.page <= 1}
          onClick={() => setPage(value.page - 1)}
          className="rounded-lg border p-2 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          disabled={value.page >= value.totalPages}
          onClick={() => setPage(value.page + 1)}
          className="rounded-lg border p-2 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-rose-200 bg-white p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-rose-500" />
      <h2 className="mt-3 font-black">Không thể tải dữ liệu</h2>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      <button
        onClick={retry}
        className="mt-5 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
      >
        <RefreshCw className="h-4 w-4" />
        Thử lại
      </button>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-3xl border bg-white p-6">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
