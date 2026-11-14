import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
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
  Trash2,
  Users,
  Waves,
  X,
} from "lucide-react";
import NotificationDropdown from "../components/NotificationDropdown";
import LoadingMotion from "../components/LoadingMotion";
import { chatbotService, type KnowledgeDoc } from "../services/chatbot.service";
import { apiFetch, logoutSession } from "../utils/api";

const AccountSettings = lazy(() => import("../components/AccountSettings"));
const FarmList = lazy(() => import("../features/farms/FarmList"));
const PondCropDashboard = lazy(() => import("../components/PondCropDashboard"));
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
  | "Kho tri thức AI"
  | "Trang trại"
  | "Ao & Mùa vụ"
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
  avatarUrl?: string;
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
const ticketPriorityLabels: Record<SupportTicket["priority"], string> = {
  URGENT: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};
const ticketPriorityColors: Record<SupportTicket["priority"], string> = {
  URGENT: "bg-rose-100 text-rose-700",
  HIGH: "bg-amber-100 text-amber-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  LOW: "bg-slate-100 text-slate-600",
};
const ticketStatusLabels: Record<SupportTicket["status"], string> = {
  OPEN: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
};
const ticketStatusColors: Record<SupportTicket["status"], string> = {
  OPEN: "bg-purple-100 text-purple-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};
const auditActionLabels: Record<string, string> = {
  USER_CREATED: "Tạo tài khoản",
  USER_ROLE_CHANGED: "Đổi vai trò",
  USER_ACTIVATED: "Mở khóa tài khoản",
  USER_DEACTIVATED: "Khóa tài khoản",
  WORKSPACE_CREATED: "Tạo tổ chức",
  WORKSPACE_STATUS_CHANGED: "Đổi trạng thái tổ chức",
  WORKSPACE_MEMBER_ADDED_OR_REACTIVATED: "Thêm/Kích hoạt thành viên",
  WORKSPACE_MEMBER_UPDATED: "Cập nhật thành viên",
  WORKSPACE_OWNERSHIP_TRANSFERRED: "Chuyển chủ sở hữu",
  FARM_OWNERSHIP_TRANSFERRED: "Chuyển chủ trang trại",
  SUPPORT_TICKET_UPDATED: "Cập nhật hỗ trợ",
};
const auditTargetLabels: Record<string, string> = {
  USER: "Người dùng",
  WORKSPACE: "Tổ chức",
  WORKSPACE_MEMBER: "Thành viên tổ chức",
  FARM: "Trang trại",
  SUPPORT_TICKET: "Ticket hỗ trợ",
};
const reportValueLabels: Record<string, string> = {
  ...roles,
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  SUSPENDED: "Tạm ngưng",
  HARVESTED: "Đã thu hoạch",
  FAILED: "Thất bại",
  OPEN: "Đang mở",
  TREATING: "Đang điều trị",
  RESOLVED: "Đã xử lý",
};
const navGroups: Array<{
  title: string;
  items: Array<{ label: AdminTab; icon: typeof Home }>;
}> = [
    {
      title: "Quản trị nền tảng",
      items: [
        { label: "Tổng quan", icon: Home },
        { label: "Người dùng", icon: Users },
        { label: "Workspace", icon: Network },
        { label: "Kho tri thức AI", icon: Bot },
      ],
    },
    {
      title: "Giám sát vận hành",
      items: [
        { label: "Trang trại", icon: Building2 },
        { label: "Ao & Mùa vụ", icon: Waves },
        { label: "Giám sát sự cố", icon: AlertTriangle },
        { label: "Cảnh báo", icon: BellRing },
        { label: "Báo cáo", icon: BarChart3 },
      ],
    },
    {
      title: "Hệ thống & Hỗ trợ",
      items: [
        { label: "Nhật ký", icon: ClipboardList },
        { label: "Hệ thống", icon: HeartPulse },
        { label: "Hỗ trợ", icon: LifeBuoy },
      ],
    },
  ];
const navItems = navGroups.flatMap((group) => group.items);

type AdminFilterPreset = {
  userStatus?: string;
  workspaceStatus?: string;
  ticketPriority?: string;
  ticketStatus?: string;
  farmId?: string;
};

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
  const [filterPreset, setFilterPreset] = useState<AdminFilterPreset>({});
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
  const changeTab = (tab: AdminTab, preset: AdminFilterPreset = {}) => {
    setFilterPreset(preset);
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
        {/* Header / Logo & Top Toggle */}
        {isSidebarCollapsed ? (
          <div className="hidden lg:flex flex-col items-center py-3.5 px-2 gap-2 border-b border-purple-50/80 flex-shrink-0">
            <img
              src="/logonen.jpg"
              alt="SSFM Logo"
              className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200 flex-shrink-0 transition-transform duration-300 hover:scale-105"
            />
            {/* Dedicated Expand Button */}
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              title="Mở rộng thanh điều hướng"
              className="group relative flex items-center justify-center w-8 h-8 rounded-xl bg-purple-50/80 hover:bg-purple-100 text-purple-600 hover:scale-105 active:scale-95 transition-all duration-200 border border-purple-100/80 shadow-2xs cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : null}

        <div
          className={`h-20 shrink-0 items-center justify-between px-6 border-b border-slate-100 ${isSidebarCollapsed ? "flex lg:hidden" : "flex"}`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logonen.jpg"
              alt="SSFM Logo"
              className="w-10 h-10 shrink-0 rounded-full border border-slate-200 bg-white object-cover shadow-sm transition-transform duration-300 hover:scale-105"
            />
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-purple-900 tracking-tight whitespace-nowrap">
              SSFM
            </span>
          </div>
          {/* Collapse Button (Desktop) */}
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            title="Thu gọn thanh điều hướng"
            className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
          {/* Close Button (Mobile) */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav
          className={`flex-1 space-y-4 overflow-y-auto ${isSidebarCollapsed ? "p-2 lg:py-4" : "p-4"}`}
        >
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p
                className={`${isSidebarCollapsed ? "lg:hidden" : ""} px-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400`}
              >
                {group.title}
              </p>
              {group.items.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => changeTab(label)}
                  title={isSidebarCollapsed ? label : undefined}
                  className={`group relative flex w-full items-center rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "gap-3 px-4"} ${activeTab === label ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          ))}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <p
              className={`${isSidebarCollapsed ? "lg:hidden" : ""} px-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400`}
            >
              Tài khoản
            </p>
            <button
              onClick={() => changeTab("Cài đặt")}
              title={isSidebarCollapsed ? "Cài đặt" : undefined}
              className={`flex w-full items-center rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "gap-3 px-4"} ${activeTab === "Cài đặt" ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"}`}
            >
              <Settings className="h-5 w-5" />
              <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
                Cài đặt
              </span>
            </button>
          </div>
        </nav>
        <div
          className={`shrink-0 border-t border-slate-100 ${isSidebarCollapsed ? "p-2 lg:py-3" : "p-4"}`}
        >
          <div
            className={`mb-2 flex items-center rounded-2xl border border-slate-200/80 bg-slate-50 ${isSidebarCollapsed ? "gap-3 p-3 lg:justify-center lg:p-2" : "gap-3 p-3"}`}
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="h-9 w-9 shrink-0 rounded-full object-cover border border-white ring-2 ring-purple-100 shadow-sm"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 font-black text-purple-700">
                {(currentUser.fullName || "A").charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-sm font-black text-slate-900">
                {currentUser.fullName}
              </p>
              <p className="truncate text-[11px] font-bold text-purple-600">
                Quản trị viên hệ thống
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            title={isSidebarCollapsed ? "Đăng xuất" : undefined}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer ${isSidebarCollapsed ? "justify-start gap-3 px-4 lg:justify-center lg:px-2" : "justify-center gap-2 px-4"}`}
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

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-xl font-black text-purple-950 sm:text-2xl">
                {activeTab}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                System Admin
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Quản trị tài khoản, quyền truy cập, tri thức AI và giám sát sức khỏe nền tảng SSFM
            </p>
          </div>
          <NotificationDropdown
            themeColor="purple"
            onNavigateTab={(tab, config) => {
              if (
                tab === "Sự cố trang trại" ||
                tab === "Báo cáo sự cố" ||
                tab === "Sự cố" ||
                tab === "Sự cố & Điều trị"
              ) {
                changeTab("Giám sát sự cố");
              } else if (tab === "Quản lý Trang Trại") {
                changeTab("Trang trại");
              } else if (tab === "Quản lý Ao/Vụ") {
                changeTab("Ao & Mùa vụ", { farmId: config?.farmId });
              }
            }}
          />
        </header>
        <main className="relative flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[480px] w-[480px] rounded-full bg-purple-400/5 blur-[100px]" />
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
            {activeTab === "Tổng quan" && <Overview onNavigate={changeTab} />}
            {activeTab === "Người dùng" && (
              <UsersView
                currentUserId={currentUser.id}
                initialStatus={filterPreset.userStatus}
              />
            )}
            {activeTab === "Workspace" && (
              <WorkspacesView initialStatus={filterPreset.workspaceStatus} />
            )}
            {activeTab === "Kho tri thức AI" && <KnowledgeBaseView />}
            {activeTab === "Trang trại" && (
              <FarmList
                onNavigateToPonds={(farmId) =>
                  changeTab("Ao & Mùa vụ", { farmId })
                }
              />
            )}
            {activeTab === "Ao & Mùa vụ" && (
              <PondCropDashboard initialFarmId={filterPreset.farmId} />
            )}
            {activeTab === "Giám sát sự cố" && (
              <IncidentDashboard role="ADMIN" />
            )}
            {activeTab === "Cảnh báo" && <AlertsView onNavigate={changeTab} />}
            {activeTab === "Báo cáo" && <ReportsView />}
            {activeTab === "Nhật ký" && <AuditView />}
            {activeTab === "Hệ thống" && <HealthView />}
            {activeTab === "Hỗ trợ" && (
              <SupportView
                currentAdminId={currentUser.id}
                initialPriority={filterPreset.ticketPriority}
                initialStatus={filterPreset.ticketStatus}
              />
            )}
            {activeTab === "Cài đặt" && <AccountSettings />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function Overview({
  onNavigate,
}: {
  onNavigate: (tab: AdminTab, preset?: AdminFilterPreset) => void;
}) {
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
  const totalRoles = Math.max(
    data.roleDistrib.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  const statCardIcons = [Users, Building2, Waves, AlertTriangle];
  const statCardNavTargets: Array<AdminTab> = [
    "Người dùng",
    "Trang trại",
    "Ao & Mùa vụ",
    "Giám sát sự cố",
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.statCards.map((card, idx) => {
          const CardIcon = statCardIcons[idx] || Activity;
          const navTarget = statCardNavTargets[idx];
          return (
            <article
              key={card.label}
              onClick={() => navTarget && onNavigate(navTarget)}
              className="group cursor-pointer rounded-3xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-purple-900/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 shadow-inner"
                  style={{
                    backgroundColor: `${card.color}15`,
                    color: card.color,
                  }}
                >
                  <CardIcon className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-400 transition-colors group-hover:bg-purple-50 group-hover:text-purple-600">
                  Chi tiết <ChevronRight className="h-3 w-3" />
                </span>
              </div>
              <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-800">
                {card.value.toLocaleString("vi-VN")}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {card.context}
              </p>
            </article>
          );
        })}
      </div>
      <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 p-6 shadow-lg shadow-purple-900/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-200/70 bg-white text-purple-600 shadow-sm">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-purple-950">
                Chỉ số vận hành nền tảng SaaS
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi các tổ chức (Workspace), thành viên, trang trại phân vùng và phiếu hỗ trợ
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setData(null);
              setRevision((value) => value + 1);
            }}
            className="rounded-xl border border-purple-200/80 bg-white p-2.5 text-purple-600 transition hover:bg-purple-50 cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Workspace hoạt động" value={saas.activeWorkspaces} />
          <Metric label="Thành viên hoạt động" value={saas.activeMemberships} />
          <Metric label="Trang trại đã phân vùng" value={saas.workspaceFarms} />
          <Metric label="Ticket đang xử lý" value={saas.openTickets} />
        </div>
        {saas.unresolvedUrgentTickets > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-700">
            <span>
              {saas.unresolvedUrgentTickets} ticket khẩn cấp chưa hoàn tất.
            </span>
            <button
              onClick={() =>
                onNavigate("Hỗ trợ", {
                  ticketPriority: "URGENT",
                  ticketStatus: "OPEN",
                })
              }
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-rose-700 cursor-pointer"
            >
              Xử lý ngay
            </button>
          </div>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-purple-900/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-800">
                Tài khoản đăng ký mới
              </h2>
              <p className="text-xs text-slate-500">
                Thống kê số lượng người dùng mới theo ngày
              </p>
            </div>
            <select
              value={days}
              onChange={(event) => {
                setData(null);
                setDays(Number(event.target.value) as 7 | 30);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value={7}>7 ngày qua</option>
              <option value={30}>30 ngày qua</option>
            </select>
          </div>
          <div className="mt-6 flex h-52 items-end gap-1.5 border-b border-slate-200 px-1">
            {data.growthData.map((value, index) => (
              <div
                key={`${data.growthLabels[index]}-${index}`}
                className="group relative flex h-full flex-1 items-end"
              >
                <span className="absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow group-hover:block">
                  {data.growthLabels[index]}: {value} tài khoản
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${value > 0 ? "bg-gradient-to-t from-purple-600 to-violet-400 group-hover:from-purple-700 group-hover:to-violet-500" : "bg-slate-100"}`}
                  style={{
                    height: `${Math.max(value ? 8 : 3, (value / max) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex">
            {data.growthLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="flex-1 truncate text-center text-[10px] font-semibold text-slate-400"
              >
                {days === 7 || index % 5 === 0 ? label : ""}
              </span>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-purple-900/5">
          <h2 className="text-base font-black text-slate-800">
            Phân bổ vai trò người dùng
          </h2>
          <p className="text-xs text-slate-500">
            Tỷ trọng tài khoản theo từng nhóm quyền
          </p>
          <div className="mt-5 space-y-3.5">
            {data.roleDistrib.map((item) => {
              const pct = Math.round((item.value / totalRoles) * 100);
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-bold text-slate-700">
                      <i
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                    <span className="font-black text-slate-900">
                      {item.value}{" "}
                      <span className="text-xs font-semibold text-slate-400">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, item.value > 0 ? 4 : 0)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
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

function UsersView({
  currentUserId,
  initialStatus = "",
}: {
  currentUserId: string;
  initialStatus?: string;
}) {
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
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingUserChange | null>(
    null,
  );
  const [savingChange, setSavingChange] = useState(false);
  useEffect(() => {
    setStatus(initialStatus);
    setPage(1);
  }, [initialStatus]);
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

function WorkspacesView({ initialStatus = "" }: { initialStatus?: string }) {
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceSummary | null>(null);
  const [pendingStatus, setPendingStatus] = useState<WorkspaceSummary | null>(
    null,
  );

  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch("/api/workspaces"),
      apiFetch("/api/users/candidates?includeManagers=true"),
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
        const userData = (await userResponse.json()) as AdminUser[];
        return { workspaceData, userData };
      })
      .then(({ workspaceData, userData }) => {
        if (!cancelled) {
          setItems(workspaceData);
          setUsers(userData);
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
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black">Danh sách tổ chức</h3>
          <p className="text-xs text-slate-500">
            {items.length} tổ chức trên hệ thống
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên tổ chức hoặc chủ sở hữu..."
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm sm:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border px-3 py-2 text-sm font-bold"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="SUSPENDED">Tạm ngưng</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items
          .filter((workspace) => {
            if (statusFilter && workspace.status !== statusFilter) return false;
            const keyword = search.trim().toLowerCase();
            if (!keyword) return true;
            const ownerName =
              workspace.members[0]?.user.fullName?.toLowerCase() || "";
            const ownerEmail =
              workspace.members[0]?.user.email?.toLowerCase() || "";
            return (
              workspace.name.toLowerCase().includes(keyword) ||
              ownerName.includes(keyword) ||
              ownerEmail.includes(keyword)
            );
          })
          .map((workspace) => (
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
  const [ownerQuery, setOwnerQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const filteredManagers = managers.filter((manager) => {
    const q = ownerQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      manager.fullName.toLowerCase().includes(q) ||
      manager.email.toLowerCase().includes(q)
    );
  });
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
          {managers.length > 5 && (
            <input
              value={ownerQuery}
              onChange={(event) => setOwnerQuery(event.target.value)}
              placeholder="Lọc nhanh theo tên hoặc email..."
              className="mt-2 w-full rounded-xl border px-3 py-2 text-xs font-normal"
            />
          )}
          <select
            required
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="mt-2 w-full rounded-xl border p-3"
          >
            <option value="">Chọn một Farm Manager</option>
            {filteredManagers.map((manager) => (
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
  const [userQuery, setUserQuery] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [newOwner, setNewOwner] = useState<WorkspaceMember | null>(null);
  const [transferring, setTransferring] = useState(false);
  const filteredUsers = users.filter((user) => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      user.fullName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    );
  });
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
        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">
          {users.length > 5 && (
            <input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Tìm nhanh tài khoản theo tên hoặc email..."
              className="w-full rounded-xl border bg-white px-3 py-2 text-xs"
            />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border bg-white p-2.5"
            >
              <option value="">Chọn tài khoản cần thêm</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} · {user.email} ({roles[user.role]})
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "ADMIN" | "MEMBER")
              }
              className="rounded-xl border bg-white p-2.5"
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
              className="rounded-xl bg-purple-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
            >
              Thêm
            </button>
          </div>
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

function SupportView({
  currentAdminId,
  initialPriority = "",
  initialStatus = "",
}: {
  currentAdminId: string;
  initialPriority?: string;
  initialStatus?: string;
}) {
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<
    SupportTicket["status"] | null
  >(null);
  const updating = updatingStatus !== null;
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [scopeFilter, setScopeFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  useEffect(() => {
    setStatusFilter(initialStatus);
    setPriorityFilter(initialPriority);
    setPage(1);
  }, [initialPriority, initialStatus]);
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-purple-700">
                {ticket.workspace?.name ?? "Hệ thống SSFM"}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${ticketPriorityColors[ticket.priority]}`}
                >
                  {ticketPriorityLabels[ticket.priority]}
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${ticketStatusColors[ticket.status]}`}
                >
                  {ticketStatusLabels[ticket.status]}
                </span>
              </div>
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
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>{selected.workspace?.name ?? "Hệ thống SSFM"}</span>
                  <span>·</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${ticketStatusColors[selected.status]}`}
                  >
                    {ticketStatusLabels[selected.status]}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${ticketPriorityColors[selected.priority]}`}
                  >
                    {ticketPriorityLabels[selected.priority]}
                  </span>
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

function AlertsView({
  onNavigate,
}: {
  onNavigate: (tab: AdminTab, preset?: AdminFilterPreset) => void;
}) {
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
  const levelLabels: Record<SystemAlert["level"], string> = {
    DANGER: "Khẩn cấp",
    WARNING: "Cảnh báo",
    INFO: "Thông tin",
  };
  const levelBadgeStyles: Record<SystemAlert["level"], string> = {
    DANGER: "bg-rose-100 text-rose-700",
    WARNING: "bg-amber-100 text-amber-700",
    INFO: "bg-slate-100 text-slate-600",
  };
  const resolveAlertAction = (
    code: string,
  ): { label: string; run: () => void } | null => {
    switch (code) {
      case "UNASSIGNED_INCIDENTS":
      case "STALE_INCIDENTS":
        return {
          label: "Mở giám sát sự cố",
          run: () => onNavigate("Giám sát sự cố"),
        };
      case "INACTIVE_FARMS":
        return {
          label: "Xem danh sách trang trại",
          run: () => onNavigate("Trang trại"),
        };
      case "LOCKED_USERS":
        return {
          label: "Xem tài khoản bị khóa",
          run: () => onNavigate("Người dùng", { userStatus: "false" }),
        };
      case "SUSPENDED_WORKSPACES":
        return {
          label: "Xem tổ chức tạm ngưng",
          run: () => onNavigate("Workspace", { workspaceStatus: "SUSPENDED" }),
        };
      case "URGENT_SUPPORT_TICKETS":
        return {
          label: "Xử lý ticket khẩn cấp",
          run: () =>
            onNavigate("Hỗ trợ", {
              ticketPriority: "URGENT",
              ticketStatus: "OPEN",
            }),
        };
      default:
        return null;
    }
  };
  return (
    <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
      {data.map((item) => {
        const action = resolveAlertAction(item.code);
        return (
          <article
            key={item.code}
            className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm ${item.level === "DANGER" ? "border-rose-200" : item.level === "WARNING" ? "border-amber-200" : "border-slate-200"}`}
          >
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-black">{item.title}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>
              <strong className="text-3xl">{item.count}</strong>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span
                className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${levelBadgeStyles[item.level]}`}
              >
                {levelLabels[item.level]}
              </span>
              {action && (
                <button
                  onClick={action.run}
                  className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-700 transition hover:bg-purple-100"
                >
                  {action.label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </article>
        );
      })}
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
  const buildReportRows = (report: AdminReport): Array<[string, string | number]> => {
    const rows: Array<[string, string | number]> = [
      ["Hạng mục / Chỉ số", "Giá trị"],
      ["Năm báo cáo", report.year],
      ["Ngày xuất báo cáo", new Date(report.generatedAt).toLocaleString("vi-VN")],
      ["--- TỔNG HỢP THU HOẠCH ---", ""],
      ["Số vụ thu hoạch", report.harvest.count],
      ["Sản lượng (kg)", report.harvest.actualHarvestKg || 0],
      ["Doanh thu (VNĐ)", report.harvest.actualHarvestRevenue || 0],
      ["Chi phí (VNĐ)", report.harvest.actualHarvestCost || 0],
      ["Lợi nhuận (VNĐ)", report.harvest.actualHarvestProfit || 0],
      ["--- NGƯỜI DÙNG THEO VAI TRÒ ---", ""],
      ...report.users.map((u): [string, number] => [
        u.role || "Không xác định",
        u._count,
      ]),
      ["--- TRANG TRẠI THEO TRẠNG THÁI ---", ""],
      ...report.farms.map((f): [string, number] => [
        f.status || "Không xác định",
        f._count,
      ]),
      ["--- MÙA VỤ THEO TRẠNG THÁI ---", ""],
      ...report.crops.map((c): [string, number] => [
        c.status || "Không xác định",
        c._count,
      ]),
      ["--- SỰ CỐ THEO TRẠNG THÁI ---", ""],
      ...report.incidents.map((i): [string, number] => [
        i.status || "Không xác định",
        i._count,
      ]),
    ];
    return rows;
  };
  const exportCsv = () => {
    if (!data) return;
    const rows = buildReportRows(data);
    const escapeCell = (val: string | number) => {
      const str = String(val ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(escapeCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ssfm-admin-report-${year}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const exportExcel = () => {
    if (!data) return;
    const rows = buildReportRows(data);
    const escapeHtml = (val: string | number) =>
      String(val ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const tableRows = rows
      .map(([label, value], idx) => {
        const isHeader = idx === 0;
        const isSection = String(label).startsWith("---");
        const bg = isHeader
          ? "background:#6d28d9;color:#ffffff;font-weight:bold;"
          : isSection
            ? "background:#ede9fe;color:#4c1d95;font-weight:bold;"
            : "";
        return `<tr><td style="border:1px solid #cbd5e1;padding:6px 10px;${bg}">${escapeHtml(label)}</td><td style="border:1px solid #cbd5e1;padding:6px 10px;${bg}">${escapeHtml(value)}</td></tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><table>${tableRows}</table></body></html>`;
    const blob = new Blob(["\uFEFF" + html], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ssfm-admin-report-${year}.xls`;
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
      <div className="flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg shadow-purple-900/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 shadow-inner">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">
              Báo cáo quản trị hệ thống
            </h2>
            <p className="text-xs text-slate-500">
              Tổng hợp dữ liệu toàn nền tảng năm {year}, không thay thế báo cáo vận hành từng trang trại
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(event) => {
              setData(null);
              setYear(Number(event.target.value));
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, index) => currentYear - index).map(
              (value) => (
                <option key={value} value={value}>
                  Năm {value}
                </option>
              ),
            )}
          </select>
          <button
            onClick={() => {
              setData(null);
              setRevision((value) => value + 1);
            }}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 cursor-pointer"
            title="Làm mới báo cáo"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-700 transition hover:bg-purple-100 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Xuất CSV
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-500/20 transition hover:from-purple-700 hover:to-violet-600 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Xuất Excel
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
        ].map(([title, groups, key]) => {
          const groupList = groups as ReportGroup[];
          const totalCount = Math.max(
            groupList.reduce((acc, item) => acc + item._count, 0),
            1,
          );
          return (
            <section
              key={String(title)}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800">{String(title)}</h3>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                  Tổng:{" "}
                  {groupList.reduce((acc, item) => acc + item._count, 0)}
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {groupList.map((group) => {
                  const rawKey = String(group[key as "role" | "status"] || "");
                  const pct = Math.round((group._count / totalCount) * 100);
                  return (
                    <div
                      key={rawKey}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">
                          {reportValueLabels[rawKey] || rawKey}
                        </span>
                        <strong className="font-black text-slate-900">
                          {group._count}{" "}
                          <span className="text-xs font-semibold text-slate-400">
                            ({pct}%)
                          </span>
                        </strong>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500"
                          style={{
                            width: `${Math.max(pct, group._count > 0 ? 4 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!groupList.length && (
                  <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
                    Chưa có dữ liệu phát sinh trong năm {year}.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function formatAuditDetails(details?: Record<string, unknown> | null): string {
  if (!details || typeof details !== "object") return "—";
  const parts: string[] = [];
  if (typeof details.name === "string") parts.push(`Tên: ${details.name}`);
  if (typeof details.farmName === "string")
    parts.push(`Trang trại: ${details.farmName}`);
  if (typeof details.workspaceName === "string")
    parts.push(`Tổ chức: ${details.workspaceName}`);
  if (typeof details.email === "string") parts.push(`Email: ${details.email}`);
  if (typeof details.role === "string")
    parts.push(`Vai trò: ${reportValueLabels[details.role] || details.role}`);
  if (typeof details.from === "string" && typeof details.to === "string") {
    parts.push(
      `${reportValueLabels[details.from] || details.from} → ${reportValueLabels[details.to] || details.to}`,
    );
  } else if (
    typeof details.from === "boolean" &&
    typeof details.to === "boolean"
  ) {
    parts.push(
      `${details.from ? "Hoạt động" : "Bị khóa"} → ${details.to ? "Hoạt động" : "Bị khóa"}`,
    );
  }
  if (
    typeof details.fromStatus === "string" &&
    typeof details.toStatus === "string"
  ) {
    const fromLabel =
      ticketStatusLabels[details.fromStatus as SupportTicket["status"]] ||
      details.fromStatus;
    const toLabel =
      ticketStatusLabels[details.toStatus as SupportTicket["status"]] ||
      details.toStatus;
    parts.push(`${fromLabel} → ${toLabel}`);
  }
  if (
    typeof details.fromOwnerName === "string" &&
    typeof details.toOwnerName === "string"
  ) {
    parts.push(`${details.fromOwnerName} → ${details.toOwnerName}`);
  }
  if (
    typeof details.fromActive === "boolean" &&
    typeof details.toActive === "boolean" &&
    details.fromActive !== details.toActive
  ) {
    parts.push(
      details.toActive ? "Đã kích hoạt thành viên" : "Đã vô hiệu hóa thành viên",
    );
  }
  return parts.length ? parts.join(" · ") : JSON.stringify(details);
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
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (actionFilter) params.set("action", actionFilter);
    void apiFetch(`/api/admin/audit-logs?${params.toString()}`)
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
  }, [page, actionFilter, revision]);
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
      <div className="flex flex-col gap-3 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black">Nhật ký quản trị</h2>
          <p className="text-xs text-slate-500">
            Lưu dấu các thao tác có quyền cao ({pagination.total} bản ghi).
          </p>
        </div>
        <select
          value={actionFilter}
          onChange={(event) => {
            setLoading(true);
            setActionFilter(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-3 py-2 text-xs font-bold"
        >
          <option value="">Tất cả hành động</option>
          {Object.entries(auditActionLabels).map(([action, label]) => (
            <option key={action} value={action}>
              {label}
            </option>
          ))}
        </select>
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
                    <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">
                      {auditActionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="text-xs text-slate-700">
                    <span className="font-semibold">
                      {auditTargetLabels[log.targetType] || log.targetType}
                    </span>{" "}
                    {log.targetId && (
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                        #{log.targetId.slice(0, 8)}
                      </code>
                    )}
                  </td>
                  <td className="max-w-md py-3 pr-4 text-xs text-slate-600">
                    {formatAuditDetails(log.details)}
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
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${service.status === "UP" ? "bg-emerald-50 text-emerald-700" : service.status === "DOWN" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
              >
                {service.status === "UP"
                  ? "Hoạt động"
                  : service.status === "DOWN"
                    ? "Mất kết nối"
                    : service.status === "NOT_CONFIGURED"
                      ? "Chưa cấu hình"
                      : "Dự phòng"}
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
function KnowledgeBaseView() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<
    (KnowledgeDoc & { chunks?: Array<{ id: string; chunkIndex: number; content: string }> }) | null
  >(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "DISEASE_TREATMENT",
    content: "",
  });

  const categoryLabels: Record<string, string> = {
    WATER_QUALITY: "Môi trường nước",
    DISEASE_TREATMENT: "Bệnh & Phác đồ điều trị",
    FEEDING_NUTRITION: "Dinh dưỡng & Cho ăn",
    FARM_OPERATIONS: "Quy trình vận hành",
    GENERAL: "Cẩm nang chung",
  };

  const loadDocs = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await chatbotService.getDocuments();
      setDocs(list);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải kho tri thức AI",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  const openDetail = async (doc: KnowledgeDoc) => {
    setViewingDoc(doc);
    setLoadingDetail(true);
    try {
      const response = await apiFetch(`/api/chatbot/documents/${doc.id}`);
      if (response.ok) {
        const detail = (await response.json()) as KnowledgeDoc & {
          chunks?: Array<{ id: string; chunkIndex: number; content: string }>;
        };
        setViewingDoc(detail);
      }
    } catch {
      // fallback to base doc content
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Vui lòng nhập tiêu đề và nội dung tài liệu");
      return;
    }
    setSaving(true);
    try {
      const result = await chatbotService.createDocument({
        title: form.title.trim(),
        category: form.category,
        content: form.content.trim(),
      });
      toast.success(result.message || "Đã nạp tài liệu vào Kho tri thức AI");
      setCreateOpen(false);
      setForm({ title: "", category: "DISEASE_TREATMENT", content: "" });
      await loadDocs();
    } catch (reason: unknown) {
      toast.error(
        reason instanceof Error ? reason.message : "Không thể lưu tài liệu",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: KnowledgeDoc) => {
    setDeletingId(doc.id);
    try {
      await chatbotService.deleteDocument(doc.id);
      toast.success(`Đã xóa tài liệu "${doc.title}"`);
      if (viewingDoc?.id === doc.id) setViewingDoc(null);
      await loadDocs();
    } catch (reason: unknown) {
      toast.error(
        reason instanceof Error ? reason.message : "Không thể xóa tài liệu",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return <ErrorState message={error} retry={() => void loadDocs()} />;
  }

  const filteredDocs = docs.filter((doc) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      doc.title.toLowerCase().includes(q) ||
      doc.content.toLowerCase().includes(q);
    const matchCategory =
      categoryFilter === "ALL" || doc.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalChunks = docs.reduce(
    (sum, doc) => sum + (doc._count?.chunks || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg shadow-purple-900/5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-600 shadow-inner">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 sm:text-2xl">
              Kho Tri Thức AI (RAG Knowledge Base)
            </h2>
            <p className="text-xs font-medium text-slate-500 sm:text-sm">
              Quản trị cẩm nang kỹ thuật nuôi tôm, phác đồ xử lý bệnh và ngưỡng môi trường phục vụ Trợ lý AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void loadDocs()}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50 cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 transition hover:-translate-y-0.5 hover:from-purple-700 hover:to-violet-600 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Nạp tài liệu RAG mới
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Tổng tài liệu kỹ thuật" value={docs.length} />
        <Metric label="Tổng đoạn trích (RAG Chunks)" value={totalChunks} />
        <Metric
          label="Danh mục chuyên môn"
          value={new Set(docs.map((d) => d.category)).size}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung cẩm nang..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-purple-500 focus:bg-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
        >
          <option value="ALL">Tất cả danh mục ({docs.length})</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {loading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải kho tri thức AI..."
          subtitle="Đang đồng bộ danh sách cẩm nang và phân đoạn RAG..."
          color="purple"
        />
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-black text-slate-700">
            Không tìm thấy tài liệu tri thức phù hợp
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Hãy nạp tài liệu kỹ thuật mới để nâng cao độ chính xác khi Trợ lý AI tư vấn cho trang trại.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDocs.map((doc) => (
            <article
              key={doc.id}
              onClick={() => void openDetail(doc)}
              className="group flex cursor-pointer flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700">
                    <Bot className="h-3.5 w-3.5" />
                    {categoryLabels[doc.category] || doc.category}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {doc._count?.chunks || 0} đoạn trích
                  </span>
                </div>
                <h3 className="mt-3 text-base font-black text-slate-800 group-hover:text-purple-700">
                  {doc.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
                  {doc.content}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-400">
                <span>
                  Cập nhật:{" "}
                  {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                </span>
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => void openDetail(doc)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Xem đoạn trích
                  </button>
                  <button
                    disabled={deletingId === doc.id}
                    onClick={() => void handleDelete(doc)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                    title="Xóa tài liệu"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Document Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => !saving && setCreateOpen(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  Nạp Tài Liệu Huấn Luyện RAG Mới
                </h3>
                <p className="text-xs text-slate-500">
                  Hệ thống sẽ tự động chia nhỏ văn bản thành các đoạn trích (chunks) để AI tra cứu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tiêu đề tài liệu *">
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: Phác đồ xử lý bệnh phân trắng trên tôm thẻ"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                />
              </Field>
              <Field label="Danh mục chuyên môn">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold outline-none focus:border-purple-500"
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Nội dung cẩm nang kỹ thuật *">
              <textarea
                required
                rows={8}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Nhập chi tiết triệu chứng, nguyên nhân, ngưỡng chỉ số môi trường và các bước xử lý..."
                className="w-full rounded-xl border border-slate-200 p-3.5 text-sm outline-none focus:border-purple-500"
              />
            </Field>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60 cursor-pointer"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Đang phân đoạn & lưu..." : "Lưu vào Kho tri thức"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Document & Chunks Modal */}
      {viewingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => setViewingDoc(null)}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="inline-block rounded-lg bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                  {categoryLabels[viewingDoc.category] || viewingDoc.category}
                </span>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  {viewingDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Nội dung gốc
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {viewingDoc.content}
                </p>
              </div>
              {loadingDetail ? (
                <p className="text-center text-xs text-slate-400 animate-pulse">
                  Đang tải danh sách đoạn trích RAG...
                </p>
              ) : viewingDoc.chunks && viewingDoc.chunks.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs font-black uppercase tracking-wider text-purple-700">
                    Các đoạn trích RAG ({viewingDoc.chunks.length} đoạn)
                  </p>
                  {viewingDoc.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded-2xl border border-purple-100 bg-purple-50/40 p-3.5 text-xs text-slate-700"
                    >
                      <span className="font-black text-purple-700">
                        Đoạn #{chunk.chunkIndex + 1}:
                      </span>{" "}
                      {chunk.content}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-200">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
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
