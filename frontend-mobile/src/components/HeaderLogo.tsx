import React from 'react';
import { TouchableOpacity, Image, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

interface HeaderLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

export default function HeaderLogo({
  size = 32,
  showText = true,
  textColor = '#0f172a',
}: HeaderLogoProps) {
  const navigation = useNavigation<any>();
  const { userToken, setIsViewingHome } = useAuth();

  const handlePress = () => {
    if (userToken) {
      // Vẫn giữ phiên đăng nhập, chỉ chuyển về hiển thị Trang chủ (HomeScreen)
      setIsViewingHome(true);
    } else {
      // Nếu ở luồng auth (Login, Register), bấm logo sẽ quay về Home
      if (navigation?.navigate) {
        navigation.navigate('Home');
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Về trang chủ SSFM"
    >
      <Image
        source={require('../../assets/images/logonen.jpg')}
        style={[styles.logo, { width: size, height: size, borderRadius: size / 2 }]}
      />
      {showText && (
        <Text style={[styles.brandText, { color: textColor }]}>SSFM</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    gap: 8,
  },
  logo: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
