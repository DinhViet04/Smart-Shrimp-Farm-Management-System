import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  LogOut,
  Settings,
  User,
  KeyRound,
  Shield,
  CircleHelp,
  ChevronRight,
  Phone,
  Mail,
  Building,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userService, UserProfile } from '../services/userService';

export default function SettingsScreen() {
  const { currentUser, userRole, logout, updateCurrentUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(currentUser);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Modal: Change Password
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Modal: Edit Profile
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editAddress, setEditAddress] = useState(currentUser?.address || '');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const fetchLatestProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const data = await userService.getProfile();
        setProfile(data);
        updateCurrentUser(data);
        setEditFullName(data.fullName || '');
        setEditPhone(data.phone || '');
        setEditAddress(data.address || '');
      } catch (e) {
        // Fallback to existing currentUser from context
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchLatestProfile();
  }, []);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Quản trị viên';
      case 'FARM_MANAGER':
        return 'Quản lý trang trại';
      case 'TECHNICIAN':
        return 'Kỹ thuật viên';
      case 'FARMER':
        return 'Nông dân thực địa';
      default:
        return 'Thành viên';
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'FARM_MANAGER':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'TECHNICIAN':
        return { bg: '#e0e7ff', text: '#4f46e5', border: '#c7d2fe' };
      case 'FARMER':
      default:
        return { bg: '#f0fdfa', text: '#0d9488', border: '#ccfbf1' };
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Bạn có chắc chắn muốn đăng xuất không?');
      if (confirmLogout) {
        await logout();
      }
    } else {
      Alert.alert('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất không?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ]);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ mật khẩu mới');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsChangingPassword(true);
    try {
      await userService.changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
        confirmPassword,
      });

      setIsPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (Platform.OS === 'web') {
        window.alert('Đổi mật khẩu thành công!');
      } else {
        Alert.alert('Thành công', 'Mật khẩu đã được cập nhật thành công');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    if (!editFullName.trim()) {
      setProfileError('Họ và tên không được để trống');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await userService.updateProfile({
        fullName: editFullName.trim(),
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
      });

      setProfile(updated);
      updateCurrentUser(updated);
      setIsProfileModalVisible(false);

      if (Platform.OS === 'web') {
        window.alert('Cập nhật hồ sơ thành công!');
      } else {
        Alert.alert('Thành công', 'Hồ sơ đã được lưu thành công');
      }
    } catch (err: any) {
      setProfileError(err.message || 'Không thể cập nhật hồ sơ');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const roleStyle = getRoleBadgeStyle(profile?.role || userRole || undefined);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── 1. User Profile Header ──────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>
            {(profile?.fullName || currentUser?.fullName || 'U')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {profile?.fullName || currentUser?.fullName || 'Người dùng'}
          </Text>
          <Text style={styles.profileEmail}>
            {profile?.email || currentUser?.email || 'user@ssfm.vn'}
          </Text>

          <View
            style={[
              styles.roleBadge,
              { backgroundColor: roleStyle.bg, borderColor: roleStyle.border },
            ]}
          >
            <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
              {getRoleLabel(profile?.role || userRole || undefined)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 2. Account Security & Profile Settings ──────────────────────── */}
      <Text style={styles.sectionHeader}>TÀI KHOẢN & BẢO MẬT</Text>
      <View style={styles.menuContainer}>
        {/* Chỉnh sửa thông tin cá nhân */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsProfileModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#f0fdfa' }]}>
            <User size={20} color="#0d9488" />
          </View>
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Thông tin cá nhân</Text>
            <Text style={styles.menuSubtitle}>
              {profile?.phone ? `SĐT: ${profile.phone}` : 'Cập nhật SĐT, địa chỉ'}
            </Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Đổi mật khẩu */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsPasswordModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
            <KeyRound size={20} color="#2563eb" />
          </View>
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Đổi mật khẩu</Text>
            <Text style={styles.menuSubtitle}>Tăng cường bảo mật tài khoản</Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* ── 3. Support & Application Info ──────────────────────────────── */}
      <Text style={styles.sectionHeader}>HỖ TRỢ & HỆ THỐNG</Text>
      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#f8fafc' }]}>
            <Shield size={20} color="#64748b" />
          </View>
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Phiên bản ứng dụng</Text>
            <Text style={styles.menuSubtitle}>SSFM Mobile 1.0.0</Text>
          </View>
        </View>

        <View style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
            <CircleHelp size={20} color="#b45309" />
          </View>
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Tổng đài tư vấn kỹ thuật</Text>
            <Text style={styles.menuSubtitle}>Hotline hỗ trợ: 1900 6868</Text>
          </View>
        </View>
      </View>

      {/* ── 4. Logout Button ───────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut color="#ef4444" size={20} />
        <Text style={styles.logoutText}>Đăng xuất khỏi thiết bị</Text>
      </TouchableOpacity>

      {/* ── Modal: Đổi Mật Khẩu ────────────────────────────────────────── */}
      <Modal visible={isPasswordModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Lock size={20} color="#2563eb" />
                <Text style={styles.modalTitle}>Đổi mật khẩu tài khoản</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>MẬT KHẨU HIỆN TẠI (NẾU CÓ)</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#94a3b8"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>MẬT KHẨU MỚI (*)</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="Ít nhất 8 ký tự, 1 hoa, 1 thường, 1 số"
                placeholderTextColor="#94a3b8"
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>XÁC NHẬN MẬT KHẨU MỚI (*)</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsPasswordModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Xác nhận đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Cập Nhật Hồ Sơ ───────────────────────────────────────── */}
      <Modal visible={isProfileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <User size={20} color="#0d9488" />
                <Text style={styles.modalTitle}>Cập nhật thông tin cá nhân</Text>
              </View>
              <TouchableOpacity onPress={() => setIsProfileModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {profileError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{profileError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>HỌ VÀ TÊN (*)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập họ và tên"
                placeholderTextColor="#94a3b8"
                value={editFullName}
                onChangeText={setEditFullName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>SỐ ĐIỆN THOẠI</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="phone-pad"
                placeholder="Ví dụ: 0912345678"
                placeholderTextColor="#94a3b8"
                value={editPhone}
                onChangeText={setEditPhone}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>ĐỊA CHỈ</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ví dụ: TX. Giá Rai, Bạc Liêu"
                placeholderTextColor="#94a3b8"
                value={editAddress}
                onChangeText={setEditAddress}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsProfileModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#0d9488' }]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  /* 1. Profile Card */
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ccfbf1',
  },
  avatarLargeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  profileEmail: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* 2. Menu Section */
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginTop: 6,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },

  /* 3. Logout */
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#fef2f2',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '800',
  },

  /* 4. Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  formGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
