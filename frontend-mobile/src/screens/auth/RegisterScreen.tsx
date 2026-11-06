import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { API_ENDPOINT } from '../../config/api';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const ROLES = [
  { key: 'FARM_MANAGER', label: 'Quản lý', sublabel: 'Chủ trang trại' },
  { key: 'TECHNICIAN', label: 'Kỹ thuật viên', sublabel: 'Môi trường & bệnh' },
  { key: 'FARMER', label: 'Nhân viên ao', sublabel: 'Cho ăn & vận hành' },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER'>('FARM_MANAGER');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigation = useNavigation<NavigationProp>();

  const handleRegister = async () => {
    // 1. Validate Họ và tên
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Họ tên không được để trống.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Họ tên không hợp lệ', 'Họ tên phải có ít nhất 2 ký tự.');
      return;
    }

    // 2. Validate Email
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập định dạng email chính xác (ví dụ: user@example.com).');
      return;
    }

    // 3. Validate Số điện thoại (nếu có nhập)
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !/^0[35789][0-9]{8}$/.test(trimmedPhone)) {
      Alert.alert(
        'Số điện thoại không hợp lệ',
        'Số điện thoại phải có đúng 10 chữ số (đầu số 03, 05, 07, 08, 09).'
      );
      return;
    }

    // 4. Validate Mật khẩu (chuẩn DTO Backend & Web)
    const passwordRegex = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
    if (password.length < 8) {
      Alert.alert('Mật khẩu yếu', 'Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Mật khẩu chưa đủ mạnh',
        'Mật khẩu phải chứa chữ hoa, chữ thường và ít nhất một số hoặc ký tự đặc biệt.'
      );
      return;
    }

    // 5. Validate Mật khẩu xác nhận
    if (password !== confirmPassword) {
      Alert.alert('Xác nhận mật khẩu', 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail.toLowerCase(),
          password,
          phone: trimmedPhone || undefined,
          role,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message
          ? (Array.isArray(data.message) ? data.message.join('\n') : data.message)
          : `Đăng ký thất bại (mã ${response.status})`;
        Alert.alert('Đăng ký thất bại', errorMsg);
        return;
      }

      Alert.alert(
        'Đăng ký thành công',
        `Chào mừng ${trimmedName}! Tài khoản của bạn đã được khởi tạo thành công với vai trò ${
          role === 'FARM_MANAGER' ? 'Quản lý' : role === 'TECHNICIAN' ? 'Kỹ thuật viên' : 'Nhân viên ao'
        }. Vui lòng đăng nhập để tiếp tục.`,
        [
          {
            text: 'Đăng nhập ngay',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Lỗi kết nối',
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng và đảm bảo backend đang hoạt động.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../../assets/images/anhnen.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header / Logo */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                style={styles.logoWrapper}
                activeOpacity={0.8}
              >
                <Image source={require('../../../assets/images/logonen.jpg')} style={styles.logo} />
                <Text style={styles.logoText}>SSFM</Text>
              </TouchableOpacity>
            </View>

            {/* Glassmorphism Card */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                accessibilityLabel="Quay lại"
              >
                <ArrowLeft color="#475569" size={20} />
              </TouchableOpacity>

              <Text style={styles.title}>Đăng Ký Tài Khoản</Text>
              <Text style={styles.subtitle}>Điền thông tin của bạn để bắt đầu làm việc trên trang trại.</Text>

              <View style={styles.form}>
                {/* FullName and Phone */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>
                      HỌ VÀ TÊN <Text style={{ color: '#2563eb' }}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <User color="#64748b" size={18} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nguyễn Văn A"
                        placeholderTextColor="#94a3b8"
                        value={fullName}
                        onChangeText={setFullName}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>SỐ ĐIỆN THOẠI</Text>
                    <View style={styles.inputContainer}>
                      <Phone color="#64748b" size={18} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="0912345678"
                        placeholderTextColor="#94a3b8"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    ĐỊA CHỈ EMAIL <Text style={{ color: '#2563eb' }}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <Mail color="#64748b" size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="user@example.com"
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Role Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    VAI TRÒ TRANG TRẠI <Text style={{ color: '#2563eb' }}>*</Text>
                  </Text>
                  <View style={styles.roleContainer}>
                    {ROLES.map((r) => {
                      const isSelected = role === r.key;
                      return (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.roleChip, isSelected && styles.roleChipSelected]}
                          onPress={() => setRole(r.key as any)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.roleHeader}>
                            <Text style={[styles.roleChipLabel, isSelected && styles.roleChipLabelSelected]}>
                              {r.label}
                            </Text>
                            {isSelected && <Check size={14} color="#2563eb" />}
                          </View>
                          <Text style={[styles.roleChipSub, isSelected && styles.roleChipSubSelected]}>
                            {r.sublabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    MẬT KHẨU <Text style={{ color: '#2563eb' }}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <Lock color="#64748b" size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Tối thiểu 8 ký tự (hoa, thường, số)"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? (
                        <EyeOff color="#64748b" size={18} />
                      ) : (
                        <Eye color="#64748b" size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    XÁC NHẬN MẬT KHẨU <Text style={{ color: '#2563eb' }}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <Lock color="#64748b" size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập lại mật khẩu"
                      placeholderTextColor="#94a3b8"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff color="#64748b" size={18} />
                      ) : (
                        <Eye color="#64748b" size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Register Button */}
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#1d4ed8', '#2563eb']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>Hoàn Tất Đăng Ký</Text>
                        <ArrowRight color="#ffffff" size={18} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Đã có tài khoản? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.registerLink}>Đăng nhập ngay</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginLeft: 12,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}) as any,
  },
  backButton: {
    position: 'absolute',
    top: 22,
    right: 22,
    backgroundColor: '#f1f5f9',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748b',
    marginBottom: 18,
  },
  form: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 6,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  roleChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roleChipLabelSelected: {
    color: '#2563eb',
  },
  roleChipSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleChipSubSelected: {
    color: '#3b82f6',
  },
  loginButton: {
    marginTop: 6,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 14,
  },
  buttonGradient: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  footerText: {
    fontSize: 13.5,
    color: '#64748b',
    fontWeight: '500',
  },
  registerLink: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});
