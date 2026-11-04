import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  UserCircle2,
  Building2,
  FlaskConical,
  Users,
  Info,
  LifeBuoy,
} from "lucide-react";
import { apiFetch, logoutSession } from "../utils/api";
import { io } from "socket.io-client";

type TabKey = "profile" | "security" | "workspace" | "support";

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl?: string;
  role?: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type FeedbackState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const initialPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const getRoleBadgeInfo = (role?: string) => {
  switch (role) {
    case "ADMIN":
      return {
        name: "Quản trị viên (ADMIN)",
        desc: "Toàn quyền quản trị hệ thống, quản lý người dùng & trang trại",
        badgeBg: "bg-purple-50 border-purple-200 text-purple-800",
        icon: <ShieldCheck className="w-5 h-5 text-purple-600" />,
      };
    case "TECHNICIAN":
      return {
        name: "Kỹ thuật viên (TECHNICIAN)",
        desc: "Giám sát chỉ số nước, cảnh báo môi trường, sức khỏe tôm & mẫu 5T",
        badgeBg: "bg-cyan-50 border-cyan-200 text-cyan-800",
        icon: <FlaskConical className="w-5 h-5 text-cyan-600" />,
      };
    case "FARMER":
      return {
        name: "Nông dân (FARMER)",
        desc: "Nhập nhật ký ao, lượng thức ăn hằng ngày, tôm hao & nhiệt độ",
        badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
        icon: <Users className="w-5 h-5 text-emerald-600" />,
      };
    case "FARM_MANAGER":
    default:
      return {
        name: "Quản lý trang trại (FARM MANAGER)",
        desc: "Quản lý ao nuôi, nhân sự, chi phí, kho bãi & quy trình 5T Care",
        badgeBg: "bg-blue-50 border-blue-200 text-blue-800",
        icon: <Building2 className="w-5 h-5 text-blue-600" />,
      };
  }
};

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileForm>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    role: "FARM_MANAGER",
  });
  const [currentSavedRole, setCurrentSavedRole] =
    useState<string>("FARM_MANAGER");
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(initialPasswordForm);
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hasPassword, setHasPassword] = useState<boolean>(true);
  const [isGoogleAccount, setIsGoogleAccount] = useState<boolean>(false);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    let cancelled = false;
    void apiFetch(`${apiUrl}/api/users/profile`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải hồ sơ");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const userRole = data.role || "FARM_MANAGER";
        const nextProfile: ProfileForm = {
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          avatarUrl: data.avatarUrl || "",
          role: userRole,
        };
        setProfile(nextProfile);
        setCurrentSavedRole(userRole);
        setAvatarPreview(data.avatarUrl || "");
        setHasPassword(data.hasPassword ?? true);
        setIsGoogleAccount(data.isGoogleAccount ?? false);
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem(
          "user",
          JSON.stringify({ ...currentUser, ...nextProfile }),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFeedback({
            type: "error",
            message: error instanceof Error ? error.message : "Đã xảy ra lỗi",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const validateProfile = () => {
    if (!profile.fullName.trim()) {
      return "Họ và tên là bắt buộc";
    }
    if (
      profile.fullName.trim().length < 3 ||
      profile.fullName.trim().length > 100
    ) {
      return "Họ và tên phải có từ 3 đến 100 ký tự";
    }
    if (profile.phone && !/^(0|\+84)(\d{9,10})$/.test(profile.phone)) {
      return "Số điện thoại không đúng định dạng";
    }
    if (profile.address && profile.address.length > 100) {
      return "Địa chỉ tối đa 100 ký tự";
    }
    return "";
  };

  const validatePassword = () => {
    if (hasPassword && !passwordForm.currentPassword.trim()) {
      return "Mật khẩu hiện tại là bắt buộc";
    }
    if (passwordForm.newPassword.length < 8) {
      return "Mật khẩu mới phải có ít nhất 8 ký tự";
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      return "Mật khẩu mới phải có ít nhất 1 chữ hoa";
    }
    if (!/[a-z]/.test(passwordForm.newPassword)) {
      return "Mật khẩu mới phải có ít nhất 1 chữ thường";
    }
    if (!/\d/.test(passwordForm.newPassword)) {
      return "Mật khẩu mới phải có ít nhất 1 số";
    }
    if (!/[^A-Za-z0-9]/.test(passwordForm.newPassword)) {
      return "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt";
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return "Xác nhận mật khẩu không khớp";
    }
    return "";
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateProfile();
    if (validationError) {
      setFeedback({ type: "error", message: validationError });
      return;
    }

    await executeSaveProfile();
  };

  const executeSaveProfile = async () => {
    try {
      setSubmittingProfile(true);
      setFeedback(null);
      const response = await apiFetch(`${apiUrl}/api/users/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: profile.fullName.trim(),
          phone: profile.phone.trim() || undefined,
          address: profile.address.trim() || undefined,
          avatarUrl: avatarPreview || profile.avatarUrl || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message[0]
            : data.message || "Cập nhật hồ sơ thất bại",
        );
      }

      const savedRole = data.role || currentSavedRole;

      setProfile((current) => ({
        ...current,
        role: savedRole,
        avatarUrl: avatarPreview || current.avatarUrl || "",
      }));
      setCurrentSavedRole(savedRole);

      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...currentUser,
          ...profile,
          role: savedRole,
          avatarUrl: avatarPreview || profile.avatarUrl || "",
        }),
      );
      setFeedback({ type: "success", message: "Cập nhật hồ sơ thành công" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Đã xảy ra lỗi";
      setFeedback({ type: "error", message });
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setFeedback({ type: "error", message: validationError });
      return;
    }

    try {
      setSubmittingPassword(true);
      setFeedback(null);
      const response = await apiFetch(`${apiUrl}/api/users/password`, {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: hasPassword
            ? passwordForm.currentPassword
            : undefined,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message[0]
            : data.message ||
                (hasPassword
                  ? "Đổi mật khẩu thất bại"
                  : "Tạo mật khẩu thất bại"),
        );
      }

      setPasswordForm(initialPasswordForm);
      setHasPassword(true);
      setFeedback({
        type: "success",
        message:
          data.message ||
          "Cập nhật mật khẩu thành công. Vui lòng đăng nhập lại.",
      });
      setTimeout(async () => {
        await logoutSession();
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Đã xảy ra lỗi";
      setFeedback({ type: "error", message });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setFeedback({ type: "error", message: "Chỉ hỗ trợ ảnh JPG hoặc PNG" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Ảnh tối đa 5MB" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setFeedback({
        type: "success",
        message: "Ảnh đại diện đã sẵn sàng để lưu",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 relative z-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Cài đặt tài khoản
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý hồ sơ cá nhân và bảo mật đăng nhập của bạn.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Bảo mật được nâng cao
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">
              Chọn mục cần chỉnh sửa
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {[
              {
                key: "profile",
                label: "Hồ sơ",
                icon: <UserCircle2 className="h-4 w-4" />,
              },
              {
                key: "security",
                label: "Bảo mật",
                icon: <Lock className="h-4 w-4" />,
              },
              ...(currentSavedRole === "FARM_MANAGER"
                ? [
                    {
                      key: "workspace",
                      label: "Workspace",
                      icon: <Building2 className="h-4 w-4" />,
                    },
                  ]
                : []),
              ...(currentSavedRole === "ADMIN"
                ? []
                : [
                    {
                      key: "support",
                      label: "Hỗ trợ",
                      icon: <LifeBuoy className="h-4 w-4" />,
                    },
                  ]),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key as TabKey);
                  setFeedback(null);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === item.key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
          {feedback && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
            >
              {feedback.message}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-slate-50">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Đang tải dữ liệu...
                </p>
              </div>
            </div>
          ) : activeTab === "profile" ? (
            <form className="space-y-6" onSubmit={handleProfileSubmit}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:min-w-[220px]">
                  <div className="relative">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-24 w-24 rounded-full object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-md">
                        <UserCircle2 className="h-12 w-12" />
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:text-blue-600">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Ảnh đại diện
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      JPG/PNG · tối đa 5MB
                    </p>
                  </div>
                  <label className="cursor-pointer rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                    Thay đổi ảnh đại diện
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex-1 space-y-4">
                  {/* Current Role Banner (Placed above Full Name) */}
                  {(() => {
                    const badgeInfo = getRoleBadgeInfo(currentSavedRole);
                    return (
                      <div
                        className={`p-4 rounded-2xl border ${badgeInfo.badgeBg} flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                            {badgeInfo.icon}
                          </div>
                          <div>
                            <div className="text-sm font-extrabold">
                              {badgeInfo.name}
                            </div>
                            <div className="text-xs opacity-90 mt-0.5 leading-tight">
                              {badgeInfo.desc}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Họ và tên
                    </label>
                    <input
                      value={profile.fullName}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Nhập họ và tên"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Email
                      </label>
                      {isGoogleAccount && (
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          Tài khoản Google
                        </span>
                      )}
                    </div>
                    <input
                      value={profile.email}
                      readOnly
                      className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Số điện thoại
                      </label>
                      <input
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="0901234567"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Địa chỉ
                      </label>
                      <input
                        value={profile.address}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Nhập địa chỉ"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={submittingProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                >
                  {submittingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          ) : activeTab === "workspace" ? (
            <WorkspaceMemberSettings />
          ) : activeTab === "support" ? (
            <SupportRequestPanel />
          ) : (
            <form className="space-y-6" onSubmit={handlePasswordSubmit}>
              {!hasPassword && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start gap-3 shadow-sm">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-blue-950 text-sm">
                      Tài khoản đăng nhập Google
                    </div>
                    <p className="text-blue-800 leading-relaxed">
                      Tài khoản của bạn hiện chưa có mật khẩu trực tiếp. Bạn chỉ
                      cần nhập <strong>Mật khẩu mới</strong> và{" "}
                      <strong>Xác nhận mật khẩu mới</strong> để hoàn tất thiết
                      lập. Sau khi tạo thành công, hệ thống sẽ tự động gửi email
                      thông báo xác nhận về hộp thư Gmail của bạn.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {hasPassword && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Mật khẩu hiện tại
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.current ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((current) => ({
                            ...current,
                            current: !current.current,
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword.current ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {hasPassword ? "Mật khẩu mới" : "Tạo mật khẩu mới"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.next ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Ít nhất 8 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => ({
                          ...current,
                          next: !current.next,
                        }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.next ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.confirm ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => ({
                          ...current,
                          confirm: !current.confirm,
                        }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">
                  Yêu cầu mật khẩu mới
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Tối thiểu 8 ký tự</li>
                  <li>Có ít nhất 1 chữ hoa</li>
                  <li>Có ít nhất 1 chữ thường</li>
                  <li>Có ít nhất 1 số</li>
                  <li>Có ít nhất 1 ký tự đặc biệt</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={submittingPassword}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
                  type="submit"
                >
                  {submittingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu mới"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceMemberSettings() {
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [members, setMembers] = useState<
    Array<{
      id: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
      isActive: boolean;
      user: {
        id: string;
        fullName: string;
        email: string;
        role: string;
        isActive: boolean;
      };
    }>
  >([]);
  const [candidates, setCandidates] = useState<
    Array<{ id: string; fullName: string; email: string }>
  >([]);
  const [candidateId, setCandidateId] = useState("");
  const [workspaceRole, setWorkspaceRole] = useState<"ADMIN" | "MEMBER">(
    "MEMBER",
  );
  const [message, setMessage] = useState<FeedbackState>(null);
  const [revision, setRevision] = useState(0);
  const [pendingOwner, setPendingOwner] = useState<
    (typeof members)[number] | null
  >(null);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch("/api/workspaces"),
      apiFetch("/api/users/candidates?includeManagers=true"),
    ])
      .then(async ([workspaceResponse, candidateResponse]) => {
        if (!workspaceResponse.ok || !candidateResponse.ok)
          throw new Error("Không thể tải workspace");
        return Promise.all([
          workspaceResponse.json() as Promise<
            Array<{ id: string; name: string }>
          >,
          candidateResponse.json() as Promise<
            Array<{ id: string; fullName: string; email: string }>
          >,
        ]);
      })
      .then(([workspaceData, candidateData]) => {
        if (!cancelled) {
          setWorkspaces(workspaceData);
          setCandidates(candidateData);
          setWorkspaceId((current) => current || workspaceData[0]?.id || "");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Không thể tải workspace",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void apiFetch(`/api/workspaces/${workspaceId}/members`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải thành viên workspace");
        return response.json() as Promise<typeof members>;
      })
      .then((value) => {
        if (!cancelled) setMembers(value);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Không thể tải thành viên",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, revision]);

  const addMember = async () => {
    try {
      const response = await apiFetch(
        `/api/workspaces/${workspaceId}/members`,
        {
          method: "POST",
          body: JSON.stringify({ userId: candidateId, role: workspaceRole }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Không thể thêm thành viên");
      setCandidateId("");
      setMessage({
        type: "success",
        message: "Đã cập nhật thành viên workspace.",
      });
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage({
        type: "error",
        message:
          error instanceof Error ? error.message : "Không thể thêm thành viên",
      });
    }
  };

  const toggleMember = async (memberId: string, isActive: boolean) => {
    try {
      const response = await apiFetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Không thể cập nhật thành viên");
      setMessage({
        type: "success",
        message: "Đã cập nhật trạng thái thành viên.",
      });
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật thành viên",
      });
    }
  };

  const transferOwnership = async () => {
    if (!pendingOwner) return;
    try {
      setTransferring(true);
      const response = await apiFetch(`/api/workspaces/${workspaceId}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ newOwnerId: pendingOwner.user.id }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Không thể chuyển chủ sở hữu");
      setPendingOwner(null);
      setMessage({
        type: "success",
        message: `Đã chuyển quyền sở hữu cho ${pendingOwner.user.fullName}.`,
      });
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Không thể chuyển chủ sở hữu",
      });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Tổ chức của bạn
        </span>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Quản lý thành viên
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Thêm người vào tổ chức trước, sau đó phân công họ vào từng trang trại
          trong mục Quản lý Trang Trại.
        </p>
      </div>
      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
        >
          {message.message}
        </div>
      )}
      <label className="block text-sm font-semibold">
        Tổ chức đang quản lý
        <select
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 p-3"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto]">
        <select
          value={candidateId}
          onChange={(event) => setCandidateId(event.target.value)}
          className="min-w-0 rounded-xl border p-2.5"
        >
          <option value="">Chọn tài khoản cần thêm</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName} · {candidate.email}
            </option>
          ))}
        </select>
        <select
          value={workspaceRole}
          onChange={(event) =>
            setWorkspaceRole(event.target.value as "ADMIN" | "MEMBER")
          }
          className="rounded-xl border p-2.5"
        >
          <option value="MEMBER">Thành viên</option>
          <option value="ADMIN">Quản trị tổ chức</option>
        </select>
        <button
          disabled={!candidateId || !workspaceId}
          onClick={() => void addMember()}
          className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          Thêm thành viên
        </button>
        <p className="text-xs text-slate-500 md:col-span-3">
          <strong>Quản trị tổ chức</strong> có thể quản lý thành viên.{" "}
          <strong>Thành viên</strong> chỉ truy cập trang trại khi được phân
          công.
        </p>
      </div>
      <div>
        <h4 className="mb-3 text-sm font-bold">
          Danh sách thành viên ({members.length})
        </h4>
        <div className="divide-y rounded-2xl border px-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-sm font-bold">{member.user.fullName}</p>
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
                      onClick={() => setPendingOwner(member)}
                      className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                    >
                      Chuyển thành chủ
                    </button>
                  )}
                <button
                  disabled={member.role === "OWNER"}
                  onClick={() => void toggleMember(member.id, member.isActive)}
                  className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  {member.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                </button>
              </div>
            </div>
          ))}
          {!members.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Chưa có thành viên.
            </p>
          )}
        </div>
      </div>
      {pendingOwner && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Bàn giao quyền sở hữu?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <strong>{pendingOwner.user.fullName}</strong> sẽ trở thành Chủ tổ
              chức. Tài khoản của bạn được chuyển thành Quản trị tổ chức.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={transferring}
                onClick={() => setPendingOwner(null)}
                className="rounded-xl border px-5 py-2.5 font-semibold"
              >
                Hủy
              </button>
              <button
                disabled={transferring}
                onClick={() => void transferOwnership()}
                className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white disabled:opacity-50"
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

function SupportRequestPanel() {
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [tickets, setTickets] = useState<
    Array<{
      id: string;
      subject: string;
      status: string;
      priority: string;
      scope: "SYSTEM" | "WORKSPACE";
      createdAt: string;
      resolution?: string | null;
      workspace: { name: string } | null;
    }>
  >([]);
  const [form, setForm] = useState({
    scope: "SYSTEM" as "SYSTEM" | "WORKSPACE",
    workspaceId: "",
    subject: "",
    description: "",
    priority: "MEDIUM",
  });
  const [saving, setSaving] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [message, setMessage] = useState<FeedbackState>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch("/api/workspaces"),
      apiFetch("/api/support-tickets?pageSize=50"),
    ])
      .then(async ([workspaceResponse, ticketResponse]) => {
        if (!workspaceResponse.ok || !ticketResponse.ok) {
          throw new Error("Không thể tải dữ liệu hỗ trợ");
        }
        return Promise.all([
          workspaceResponse.json() as Promise<
            Array<{ id: string; name: string }>
          >,
          ticketResponse.json() as Promise<{ items: typeof tickets }>,
        ]);
      })
      .then(([workspaceData, ticketData]) => {
        if (!cancelled) {
          setWorkspaces(workspaceData);
          setTickets(ticketData.items);
          setForm((current) => ({
            ...current,
            workspaceId: current.workspaceId || workspaceData[0]?.id || "",
          }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Không thể tải dữ liệu hỗ trợ",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTickets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socket = io(`${apiUrl}/notifications`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });
    const handleUpdated = (updated: {
      id: string;
      status?: string;
      resolution?: string | null;
      resolvedAt?: string | null;
      updatedAt?: string;
    }) =>
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === updated.id ? { ...ticket, ...updated } : ticket,
        ),
      );
    socket.on("supportTicketUpdated", handleUpdated);
    return () => {
      socket.off("supportTicketUpdated", handleUpdated);
      socket.disconnect();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch("/api/support-tickets", {
        method: "POST",
        body: JSON.stringify({
          scope: form.scope,
          ...(form.scope === "WORKSPACE"
            ? { workspaceId: form.workspaceId }
            : {}),
          subject: form.subject,
          description: form.description,
          priority: form.priority,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(". ")
            : body.message || "Không thể gửi yêu cầu",
        );
      }
      setMessage({
        type: "success",
        message: "Đã gửi yêu cầu đến đội vận hành SSFM.",
      });
      setForm((current) => ({
        ...current,
        subject: "",
        description: "",
        priority: "MEDIUM",
      }));
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage({
        type: "error",
        message:
          error instanceof Error ? error.message : "Không thể gửi yêu cầu",
      });
    } finally {
      setSaving(false);
    }
  };

  const statusMeta: Record<string, { label: string; className: string }> = {
    OPEN: { label: "Mới", className: "bg-blue-50 text-blue-700" },
    IN_PROGRESS: {
      label: "Đang xử lý",
      className: "bg-amber-50 text-amber-700",
    },
    RESOLVED: {
      label: "Đã xử lý",
      className: "bg-emerald-50 text-emerald-700",
    },
    CLOSED: { label: "Đã đóng", className: "bg-slate-100 text-slate-600" },
  };
  const priorityLabels: Record<string, string> = {
    LOW: "Thấp",
    MEDIUM: "Trung bình",
    HIGH: "Cao",
    URGENT: "Khẩn cấp",
  };
  const formIncomplete =
    !form.subject.trim() ||
    !form.description.trim() ||
    (form.scope === "WORKSPACE" && !form.workspaceId);

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
        >
          {message.message}
        </div>
      )}
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-blue-600 p-2.5 text-white shadow-sm">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Gửi yêu cầu hỗ trợ
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Mô tả vấn đề cụ thể để đội vận hành xử lý đúng nơi và nhanh hơn.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">
              Vấn đề của bạn liên quan đến đâu?
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={form.scope === "SYSTEM"}
                onClick={() => setForm({ ...form, scope: "SYSTEM" })}
                className={
                  "rounded-2xl border p-4 text-left transition " +
                  (form.scope === "SYSTEM"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-300 hover:bg-slate-50")
                }
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-blue-600" /> Hệ thống
                  SSFM
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  Lỗi giao diện, tài khoản, đăng nhập, thông báo hoặc hiệu năng.
                </span>
              </button>
              <button
                type="button"
                aria-pressed={form.scope === "WORKSPACE"}
                onClick={() => setForm({ ...form, scope: "WORKSPACE" })}
                className={
                  "rounded-2xl border p-4 text-left transition " +
                  (form.scope === "WORKSPACE"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-300 hover:bg-slate-50")
                }
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <Building2 className="h-5 w-5 text-blue-600" /> Workspace
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  Vấn đề về dữ liệu, quyền truy cập, thành viên hoặc trang trại.
                </span>
              </button>
            </div>
          </fieldset>
          {form.scope === "WORKSPACE" && (
            <label className="block text-sm font-semibold text-slate-700">
              Workspace
              <select
                required
                value={form.workspaceId}
                onChange={(event) =>
                  setForm({ ...form, workspaceId: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Chọn workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {!workspaces.length && (
                <span className="mt-2 block text-xs font-normal text-amber-700">
                  Bạn chưa thuộc workspace đang hoạt động. Hãy chọn Hệ thống
                  SSFM để báo lỗi chung.
                </span>
              )}
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Tiêu đề
            <input
              required
              maxLength={160}
              value={form.subject}
              onChange={(event) =>
                setForm({ ...form, subject: event.target.value })
              }
              placeholder="Ví dụ: Không nhận được thông báo cảnh báo"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mức độ ảnh hưởng
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="LOW">Thấp — Không cản trở công việc</option>
              <option value="MEDIUM">Trung bình — Có ảnh hưởng</option>
              <option value="HIGH">Cao — Gián đoạn công việc</option>
              <option value="URGENT">Khẩn cấp — Không thể tiếp tục</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mô tả chi tiết
            <textarea
              required
              maxLength={5000}
              rows={5}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Bạn gặp lỗi ở màn hình nào, thao tác gì đã thực hiện và kết quả mong đợi là gì?"
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
            <span className="mt-1 block text-right text-xs font-normal text-slate-400">
              {form.description.length}/5000
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Ticket sẽ xuất hiện trong danh sách bên dưới sau khi gửi.
            </p>
            <button
              disabled={saving || formIncomplete}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </div>
        </div>
      </form>
      <section className="border-t pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Yêu cầu gần đây</h3>
            <p className="mt-1 text-xs text-slate-500">
              Theo dõi tiến độ và kết quả phản hồi từ đội vận hành.
            </p>
          </div>
          {!!tickets.length && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {tickets.length} yêu cầu
            </span>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {loadingTickets &&
            !tickets.length &&
            [0, 1].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-slate-900">
                    {ticket.subject}
                  </strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.workspace?.name ?? "Hệ thống SSFM"} · Mức độ{" "}
                    {priorityLabels[ticket.priority] ?? ticket.priority}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold " +
                    (statusMeta[ticket.status]?.className ??
                      "bg-slate-100 text-slate-600")
                  }
                >
                  {statusMeta[ticket.status]?.label ?? ticket.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Gửi lúc{" "}
                {new Date(ticket.createdAt).toLocaleString("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              {ticket.resolution && (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Kết quả xử lý
                  </p>
                  <p>{ticket.resolution}</p>
                </div>
              )}
            </article>
          ))}
          {!loadingTickets && !tickets.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <LifeBuoy className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Chưa có yêu cầu hỗ trợ
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Yêu cầu mới sẽ được hiển thị và cập nhật trạng thái tại đây.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
