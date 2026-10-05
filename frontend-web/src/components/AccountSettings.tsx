import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
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
  Info
} from 'lucide-react';
import { apiFetch, logoutSession } from '../utils/api';

type TabKey = 'profile' | 'security';

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
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

const initialPasswordForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const getRoleBadgeInfo = (role?: string) => {
  switch (role) {
    case 'ADMIN':
      return {
        name: 'Quản trị viên (ADMIN)',
        desc: 'Toàn quyền quản trị hệ thống, quản lý người dùng & trang trại',
        badgeBg: 'bg-purple-50 border-purple-200 text-purple-800',
        icon: <ShieldCheck className="w-5 h-5 text-purple-600" />,
      };
    case 'TECHNICIAN':
      return {
        name: 'Kỹ thuật viên (TECHNICIAN)',
        desc: 'Giám sát chỉ số nước, cảnh báo môi trường, sức khỏe tôm & mẫu 5T',
        badgeBg: 'bg-cyan-50 border-cyan-200 text-cyan-800',
        icon: <FlaskConical className="w-5 h-5 text-cyan-600" />,
      };
    case 'FARMER':
      return {
        name: 'Nông dân (FARMER)',
        desc: 'Nhập nhật ký ao, lượng thức ăn hằng ngày, tôm hao & nhiệt độ',
        badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <Users className="w-5 h-5 text-emerald-600" />,
      };
    case 'FARM_MANAGER':
    default:
      return {
        name: 'Quản lý trang trại (FARM MANAGER)',
        desc: 'Quản lý ao nuôi, nhân sự, chi phí, kho bãi & quy trình 5T Care',
        badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: <Building2 className="w-5 h-5 text-blue-600" />,
      };
  }
};

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileForm>({ fullName: '', email: '', phone: '', address: '', role: 'FARM_MANAGER' });
  const [currentSavedRole, setCurrentSavedRole] = useState<string>('FARM_MANAGER');
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(initialPasswordForm);
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hasPassword, setHasPassword] = useState<boolean>(true);
  const [isGoogleAccount, setIsGoogleAccount] = useState<boolean>(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiFetch(`${apiUrl}/api/users/profile`);
      if (!response.ok) {
        throw new Error('Không thể tải hồ sơ');
      }

      const data = await response.json();
      const userRole = data.role || 'FARM_MANAGER';
      const nextProfile: ProfileForm = {
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        avatarUrl: data.avatarUrl || '',
        role: userRole,
      };
      setProfile(nextProfile);
      setCurrentSavedRole(userRole);
      setAvatarPreview(data.avatarUrl || '');
      setHasPassword(data.hasPassword ?? true);
      setIsGoogleAccount(data.isGoogleAccount ?? false);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...nextProfile }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      setFeedback({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const validateProfile = () => {
    if (!profile.fullName.trim()) {
      return 'Họ và tên là bắt buộc';
    }
    if (profile.fullName.trim().length < 3 || profile.fullName.trim().length > 100) {
      return 'Họ và tên phải có từ 3 đến 100 ký tự';
    }
    if (profile.phone && !/^(0|\+84)(\d{9,10})$/.test(profile.phone)) {
      return 'Số điện thoại không đúng định dạng';
    }
    if (profile.address && profile.address.length > 100) {
      return 'Địa chỉ tối đa 100 ký tự';
    }
    return '';
  };

  const validatePassword = () => {
    if (hasPassword && !passwordForm.currentPassword.trim()) {
      return 'Mật khẩu hiện tại là bắt buộc';
    }
    if (passwordForm.newPassword.length < 8) {
      return 'Mật khẩu mới phải có ít nhất 8 ký tự';
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 chữ hoa';
    }
    if (!/[a-z]/.test(passwordForm.newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 chữ thường';
    }
    if (!/\d/.test(passwordForm.newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 số';
    }
    if (!/[^A-Za-z0-9]/.test(passwordForm.newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return 'Xác nhận mật khẩu không khớp';
    }
    return '';
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateProfile();
    if (validationError) {
      setFeedback({ type: 'error', message: validationError });
      return;
    }

    await executeSaveProfile();
  };

  const executeSaveProfile = async () => {
    try {
      setSubmittingProfile(true);
      setFeedback(null);
      const response = await apiFetch(`${apiUrl}/api/users/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: profile.fullName.trim(),
          phone: profile.phone.trim() || undefined,
          address: profile.address.trim() || undefined,
          avatarUrl: avatarPreview || profile.avatarUrl || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || 'Cập nhật hồ sơ thất bại');
      }

      const savedRole = data.role || currentSavedRole;

      setProfile((current) => ({ ...current, role: savedRole, avatarUrl: avatarPreview || current.avatarUrl || '' }));
      setCurrentSavedRole(savedRole);

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...profile, role: savedRole, avatarUrl: avatarPreview || profile.avatarUrl || '' }));
      setFeedback({ type: 'success', message: 'Cập nhật hồ sơ thành công' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      setFeedback({ type: 'error', message });
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setFeedback({ type: 'error', message: validationError });
      return;
    }

    try {
      setSubmittingPassword(true);
      setFeedback(null);
      const response = await apiFetch(`${apiUrl}/api/users/password`, {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: hasPassword ? passwordForm.currentPassword : undefined,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || (hasPassword ? 'Đổi mật khẩu thất bại' : 'Tạo mật khẩu thất bại'));
      }

      setPasswordForm(initialPasswordForm);
      setHasPassword(true);
      setFeedback({ type: 'success', message: data.message || 'Cập nhật mật khẩu thành công. Vui lòng đăng nhập lại.' });
      setTimeout(async () => {
        await logoutSession();
        window.location.href = '/login';
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      setFeedback({ type: 'error', message });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFeedback({ type: 'error', message: 'Chỉ hỗ trợ ảnh JPG hoặc PNG' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Ảnh tối đa 5MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setFeedback({ type: 'success', message: 'Ảnh đại diện đã sẵn sàng để lưu' });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative z-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Cài đặt tài khoản</h2>
            <p className="mt-1 text-sm text-slate-500">Quản lý hồ sơ cá nhân và bảo mật đăng nhập của bạn.</p>
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
            <p className="font-semibold text-slate-800">Chọn mục cần chỉnh sửa</p>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { key: 'profile', label: 'Hồ sơ', icon: <UserCircle2 className="h-4 w-4" /> },
              { key: 'security', label: 'Bảo mật', icon: <Lock className="h-4 w-4" /> },
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
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {feedback.message}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-slate-50">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : activeTab === 'profile' ? (
            <form className="space-y-6" onSubmit={handleProfileSubmit}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:min-w-[220px]">
                  <div className="relative">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="h-24 w-24 rounded-full object-cover shadow-md" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-md">
                        <UserCircle2 className="h-12 w-12" />
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:text-blue-600">
                      <Camera className="h-4 w-4" />
                      <input type="file" accept="image/png,image/jpeg" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">Ảnh đại diện</p>
                    <p className="mt-1 text-xs text-slate-500">JPG/PNG · tối đa 5MB</p>
                  </div>
                  <label className="cursor-pointer rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                    Thay đổi ảnh đại diện
                    <input type="file" accept="image/png,image/jpeg" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>

                <div className="flex-1 space-y-4">
                  {/* Current Role Banner (Placed above Full Name) */}
                  {(() => {
                    const badgeInfo = getRoleBadgeInfo(currentSavedRole);
                    return (
                      <div className={`p-4 rounded-2xl border ${badgeInfo.badgeBg} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                            {badgeInfo.icon}
                          </div>
                          <div>
                            <div className="text-sm font-extrabold">{badgeInfo.name}</div>
                            <div className="text-xs opacity-90 mt-0.5 leading-tight">{badgeInfo.desc}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Họ và tên</label>
                    <input
                      value={profile.fullName}
                      onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Nhập họ và tên"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">Email</label>
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
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Số điện thoại</label>
                      <input
                        value={profile.phone}
                        onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="0901234567"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Địa chỉ</label>
                      <input
                        value={profile.address}
                        onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
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
                  {submittingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handlePasswordSubmit}>
              {!hasPassword && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start gap-3 shadow-sm">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-blue-950 text-sm">Tài khoản đăng nhập Google</div>
                    <p className="text-blue-800 leading-relaxed">
                      Tài khoản của bạn hiện chưa có mật khẩu trực tiếp. Bạn chỉ cần nhập <strong>Mật khẩu mới</strong> và <strong>Xác nhận mật khẩu mới</strong> để hoàn tất thiết lập. Sau khi tạo thành công, hệ thống sẽ tự động gửi email thông báo xác nhận về hộp thư Gmail của bạn.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {hasPassword && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Mật khẩu hiện tại</label>
                    <div className="relative">
                      <input
                        type={showPassword.current ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => ({ ...current, current: !current.current }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {hasPassword ? 'Mật khẩu mới' : 'Tạo mật khẩu mới'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.next ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Ít nhất 8 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => ({ ...current, next: !current.next }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showPassword.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => ({ ...current, confirm: !current.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Yêu cầu mật khẩu mới</p>
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
                  {submittingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {hasPassword ? 'Đổi mật khẩu' : 'Tạo mật khẩu mới'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}

