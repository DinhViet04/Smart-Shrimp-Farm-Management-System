import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ImageBackground, StyleSheet, 
  SafeAreaView, Platform, StatusBar, Image, ScrollView, Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Droplets, ArrowRight, Bot, Activity, Thermometer, Waves,
  AlertTriangle, CheckCircle2, Map as MapIcon, Send,
  TrendingUp, ActivitySquare, CheckCircle, Camera,
  Phone, Mail, MapPin 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

type AuthStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
};

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [scrollY, setScrollY] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Dynamic Navigation Bar */}
      <View style={[styles.navBar, scrollY > 50 && styles.navBarScrolled]}>
        <View style={styles.logoWrapper}>
          <Image 
            source={require('../../../assets/images/logonen.jpg')} 
            style={styles.logoImage} 
          />
          <Text style={[styles.logoText, scrollY > 50 && styles.logoTextScrolled]}>SSFM</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.loginLink, scrollY > 50 && styles.loginLinkScrolled]}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {/* HERO SECTION */}
        <ImageBackground 
          source={require('../../../assets/images/unnamed.jpg')} 
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.7)', '#ffffff']}
            style={styles.gradientOverlay}
            locations={[0, 0.4, 1]}
          />
          <View style={styles.heroContent}>
            {/* Pill Badge */}
            <View style={styles.badgeContainer}>
              <View style={styles.pingDotOuter}>
                <View style={styles.pingDotInner} />
              </View>
              <Text style={styles.badgeText}>Hệ thống Quản lý Ao Tôm Thông minh</Text>
            </View>

            <Text style={styles.title}>
              Nâng Tầm{'\n'}
              <Text style={styles.titleHighlight}>Nông Nghiệp</Text>{'\n'}
              Công Nghệ Cao.
            </Text>

            <Text style={styles.subtitle}>
              Chuyển đổi số toàn diện trang trại nuôi tôm. Tự động hóa quy trình, tối ưu hóa hệ số FCR, và cảnh báo sớm rủi ro môi trường.
            </Text>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Register')}
            >
              <LinearGradient
                colors={['#2563eb', '#60a5fa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Dùng thử ngay</Text>
                <ArrowRight color="#fff" size={20} />
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Mockup Dashboard */}
            <View style={styles.heroMockupCard}>
              <View style={styles.mockupHeader}>
                <View>
                  <Text style={{fontWeight: 'bold', fontSize: 16, color: '#1e293b'}}>Ao nuôi A1 - Tăng trưởng</Text>
                  <Text style={{fontSize: 12, color: '#64748b'}}>Cập nhật trực tiếp</Text>
                </View>
                <View style={styles.mockupStatus}>
                  <CheckCircle2 size={12} color="#15803d" />
                  <Text style={{fontSize: 10, fontWeight: 'bold', color: '#15803d', marginLeft: 4}}>Ổn định</Text>
                </View>
              </View>
              
              <View style={styles.mockupContent}>
                <View style={styles.mockupRow}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TrendingUp size={16} color="#2563eb" style={{marginRight: 6}} />
                    <Text style={{fontSize: 13, color: '#475569', fontWeight: '500'}}>Tốc độ tăng trưởng</Text>
                  </View>
                  <Text style={{fontWeight: 'bold', color: '#0f172a'}}>1.2 g/ngày</Text>
                </View>
                
                {/* Fake Bar Chart */}
                <View style={{flexDirection: 'row', height: 40, alignItems: 'flex-end', marginTop: 12, gap: 4}}>
                  {[30, 45, 40, 60, 55, 75, 80, 95].map((h, i) => (
                    <View key={i} style={{flex: 1, height: `${h}%`, backgroundColor: '#3b82f6', borderRadius: 4, opacity: 0.8}} />
                  ))}
                </View>
                
                <View style={{flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16, gap: 12}}>
                  <View style={styles.mockupBox}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                      <Thermometer size={14} color="#64748b" />
                      <Text style={{fontSize: 11, color: '#64748b', marginLeft: 4}}>Nhiệt độ</Text>
                    </View>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: '#0f172a'}}>28.5<Text style={{fontSize: 12, fontWeight: 'normal', color: '#94a3b8'}}> °C</Text></Text>
                  </View>
                  <View style={[styles.mockupBox, {backgroundColor: 'rgba(239, 246, 255, 0.5)', borderColor: 'rgba(219, 234, 254, 0.8)'}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                      <Droplets size={14} color="#2563eb" />
                      <Text style={{fontSize: 11, color: '#2563eb', marginLeft: 4}}>Oxy hòa tan</Text>
                    </View>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: '#0f172a'}}>6.8<Text style={{fontSize: 12, fontWeight: 'normal', color: '#94a3b8'}}> mg/L</Text></Text>
                  </View>
                </View>
              </View>
            </View>
            
          </View>
        </ImageBackground>

        {/* SECTION 1: Features with Real Images (Water Quality) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionSectionSub}>TÍNH NĂNG NÂNG CAO</Text>
          <Text style={styles.sectionTitle}>Kiểm Soát Toàn Diện Với Hình Ảnh Thực Tế</Text>
          
          {/* Real image card */}
          <View style={styles.featureImageCard}>
            <Image 
              source={require('../../../assets/images/xu-ly-ao-nuoi-dam-bao-moi-truong-nuoi-tom-tot-nhat.jpg')} 
              style={styles.featureImage} 
            />
            <LinearGradient
              colors={['transparent', 'rgba(30, 58, 138, 0.8)']}
              style={styles.featureImageOverlay}
            />
            <View style={styles.featureImageTextContainer}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                <Camera size={20} color="#93c5fd" />
                <Text style={{color: '#dbeafe', fontWeight: '600', marginLeft: 8}}>Hình ảnh thực tế từ nông trại</Text>
              </View>
              <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 13}}>Theo dõi thông số môi trường nước cực kỳ chính xác.</Text>
            </View>
          </View>
          
          {/* Water Quality Stats */}
          <View style={styles.featureDetailCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={styles.iconBox}>
                  <Waves size={24} color="#2563eb" />
                </View>
                <View style={{marginLeft: 12}}>
                  <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e3a8a'}}>Chất lượng nước</Text>
                  <Text style={{fontSize: 12, color: '#64748b'}}>Phân tích thời gian thực</Text>
                </View>
              </View>
              <View style={{backgroundColor: '#dcfce3', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0'}}>
                <Text style={{fontSize: 12, fontWeight: 'bold', color: '#15803d'}}>An toàn</Text>
              </View>
            </View>
            
            <View style={styles.chartCard}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <Text style={{fontSize: 14, fontWeight: '600', color: '#475569'}}>Chỉ số pH</Text>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1e3a8a'}}>7.8</Text>
              </View>
              <View style={{flexDirection: 'row', height: 48, alignItems: 'flex-end', gap: 2}}>
                {[40, 45, 50, 55, 60, 55, 50, 48, 50, 55].map((h, i) => (
                  <View key={i} style={{flex: 1, height: `${h}%`, backgroundColor: '#60a5fa', borderTopLeftRadius: 2, borderTopRightRadius: 2}} />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 2: AI & Analytics */}
        <View style={[styles.sectionContainer, {backgroundColor: '#f8fafc'}]}>
          <View style={[styles.featureDetailCard, {backgroundColor: 'rgba(239, 246, 255, 0.5)'}]}>
             <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
                <View style={[styles.iconBox, {backgroundColor: '#2563eb'}]}>
                  <Bot size={24} color="#ffffff" />
                </View>
                <View style={{marginLeft: 12}}>
                  <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e3a8a'}}>Phân tích AI & RAG</Text>
                  <Text style={{fontSize: 12, color: '#64748b'}}>Tư vấn thông minh 24/7</Text>
                </View>
            </View>
            
            <View style={styles.chatMockup}>
              <View style={styles.chatHeader}>
                <View style={{width: 24, height: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8}}>
                  <Bot size={14} color="#fff" />
                </View>
                <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 13}}>Trợ lý Tôm Thông Minh</Text>
              </View>
              <View style={{padding: 16, backgroundColor: '#fff', height: 200}}>
                <View style={{alignSelf: 'flex-end', backgroundColor: '#3b82f6', padding: 10, borderRadius: 16, borderTopRightRadius: 4, marginBottom: 12, maxWidth: '85%'}}>
                  <Text style={{color: '#fff', fontSize: 13}}>Gợi ý lượng thức ăn cho Ao A1 hôm nay?</Text>
                </View>
                <View style={{alignSelf: 'flex-start', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', maxWidth: '90%'}}>
                  <Text style={{color: '#334155', fontSize: 13}}>Dựa trên phân tích <Text style={{fontWeight: 'bold'}}>FCR (1.15)</Text>, hệ thống khuyến nghị:</Text>
                  <Text style={{color: '#475569', fontSize: 13, marginTop: 4}}>• Giảm 10% lượng thức ăn chiều.</Text>
                  <Text style={{color: '#475569', fontSize: 13, marginTop: 2}}>• Bổ sung vitamin C.</Text>
                  <View style={{marginTop: 8, backgroundColor: '#dbeafe', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                    <Text style={{color: '#1d4ed8', fontSize: 10, fontWeight: 'bold'}}>Độ tin cậy: 98%</Text>
                  </View>
                </View>
              </View>
              <View style={{padding: 10, backgroundColor: '#f8fafc', borderTopWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center'}}>
                <View style={{flex: 1, height: 36, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, justifyContent: 'center'}}>
                  <Text style={{color: '#94a3b8', fontSize: 12}}>Hỏi trợ lý AI...</Text>
                </View>
                <View style={{width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginLeft: 8}}>
                  <Send size={16} color="#fff" style={{marginLeft: -2}} />
                </View>
              </View>
            </View>
          </View>
          
          <View style={[styles.featureImageCard, {marginTop: 24}]}>
            <Image 
              source={require('../../../assets/images/chat.jpg')} 
              style={styles.featureImage} 
            />
            <LinearGradient
              colors={['transparent', 'rgba(30, 58, 138, 0.9)']}
              style={styles.featureImageOverlay}
            />
            <View style={styles.featureImageTextContainer}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                <Activity size={20} color="#93c5fd" />
                <Text style={{color: '#dbeafe', fontWeight: '600', marginLeft: 8}}>Quản lý mọi lúc mọi nơi</Text>
              </View>
              <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 13}}>Sử dụng AI để phân tích số liệu ngay trên hiện trường.</Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: Pond Map */}
        <View style={[styles.sectionContainer, {backgroundColor: '#eff6ff'}]}>
          <Text style={styles.sectionSectionSub}>SỐ HÓA TRANG TRẠI</Text>
          <Text style={styles.sectionTitle}>Bản Đồ Quản Lý Trực Quan</Text>
          
          <View style={styles.mapCard}>
            <Image source={require('../../../assets/images/map-bg.png')} style={styles.mapImage} />
            <View style={styles.mapOverlay} />
            
            {/* Ponds */}
            <View style={[styles.pondMarker, {top: '20%', left: '20%', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.4)'}]}>
              <Text style={styles.pondMarkerText}>Ao A1</Text>
            </View>
            <View style={[styles.pondMarker, {top: '45%', left: '55%', borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.4)'}]}>
              <Text style={styles.pondMarkerText}>Ao A2</Text>
            </View>
            <View style={[styles.pondMarker, {bottom: '20%', left: '15%', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.4)'}]}>
              <Text style={styles.pondMarkerText}>Ao B1</Text>
            </View>
            
            {/* Map Legend */}
            <View style={styles.mapLegend}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 6}} />
                <Text style={{fontSize: 10, color: '#334155'}}>Tối ưu & An toàn</Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#fbbf24', marginRight: 6}} />
                <Text style={{fontSize: 10, color: '#334155'}}>Cần lưu ý</Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6}} />
                <Text style={{fontSize: 10, color: '#334155'}}>Cảnh báo nguy cơ</Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.featureDetailCard, {marginTop: 20}]}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
              <MapIcon size={20} color="#3b82f6" style={{marginRight: 8}} />
              <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1e3a8a'}}>Chi tiết Ao A1</Text>
            </View>
            
            <View style={{backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe', marginBottom: 12}}>
              <Text style={{fontSize: 12, color: '#64748b', marginBottom: 4}}>Thông số vụ nuôi</Text>
              <Text style={{fontSize: 18, fontWeight: 'bold', color: '#2563eb'}}>Ngày 45 <Text style={{fontSize: 12, color: '#94a3b8', fontWeight: 'normal'}}>/ 90 ngày</Text></Text>
            </View>
            
            <View style={{backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe', marginBottom: 12}}>
              <Text style={{fontSize: 12, color: '#64748b', marginBottom: 8}}>Tỷ lệ sống ước tính</Text>
              <Text style={{fontSize: 24, fontWeight: 'bold', color: '#16a34a', marginBottom: 8}}>92%</Text>
              <View style={{height: 6, backgroundColor: '#cbd5e1', borderRadius: 3, width: '100%'}}>
                <View style={{height: 6, backgroundColor: '#22c55e', borderRadius: 3, width: '92%'}} />
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 4: Feature Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionSectionSub}>HỆ SINH THÁI TOÀN DIỆN</Text>
          <Text style={styles.sectionTitle}>Đầy Đủ Tính Năng Cho Trang Trại Của Bạn</Text>
          <Text style={{color: '#475569', fontSize: 14, marginBottom: 24, lineHeight: 22}}>Smart Shrimp Farm Management System (SSFM) cung cấp giải pháp số hóa toàn diện giúp bạn theo dõi, quản lý và tối ưu hóa mọi quy trình.</Text>
          
          <View style={{gap: 16}}>
            {[
              { Icon: MapIcon, title: "Quản lý Ao & Nông trại", desc: "Quản lý danh mục, sơ đồ ao nuôi và theo dõi lịch sử vụ nuôi." },
              { Icon: Droplets, title: "Chất lượng Nước", desc: "Theo dõi các thông số môi trường (pH, độ mặn, DO)." },
              { Icon: Activity, title: "Quản lý Tồn kho", desc: "Kiểm soát lượng thức ăn, quản lý nhà cung cấp." },
              { Icon: TrendingUp, title: "Chăm sóc & FCR", desc: "Tính toán tỷ lệ sống, hệ số FCR và dự báo hiệu suất." },
              { Icon: AlertTriangle, title: "Cảnh báo & Sự cố", desc: "Phát hiện rủi ro, cảnh báo sớm biến động môi trường." },
              { Icon: Bot, title: "AI & Thống kê", desc: "Trợ lý ảo RAG giải đáp kỹ thuật, phân tích dữ liệu AI." }
            ].map((feat, i) => (
              <View key={i} style={styles.gridCard}>
                <View style={styles.gridIconBox}>
                  <feat.Icon size={24} color="#2563eb" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4}}>{feat.title}</Text>
                  <Text style={{fontSize: 13, color: '#64748b', lineHeight: 20}}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
            <Image source={require('../../../assets/images/logonen.jpg')} style={{width: 36, height: 36, borderRadius: 18}} />
            <Text style={{fontSize: 20, fontWeight: 'bold', color: '#fff', marginLeft: 12}}>SSFM</Text>
          </View>
          <Text style={{color: '#94a3b8', fontSize: 13, lineHeight: 22, marginBottom: 24}}>
            Hệ thống Quản lý Trang trại Nuôi tôm Thông minh cung cấp nền tảng quản trị kỹ thuật số toàn diện, tối ưu hóa năng suất và giảm thiểu rủi ro môi trường.
          </Text>
          
          <Text style={{color: '#fff', fontWeight: 'bold', marginBottom: 12, fontSize: 14}}>LIÊN HỆ</Text>
          <View style={styles.footerContactRow}>
            <MapPin size={16} color="#3b82f6" />
            <Text style={styles.footerContactText}>123 Đường Công Nghệ, TP. HCM</Text>
          </View>
          <View style={styles.footerContactRow}>
            <Phone size={16} color="#3b82f6" />
            <Text style={styles.footerContactText}>0123 456 789</Text>
          </View>
          <View style={styles.footerContactRow}>
            <Mail size={16} color="#3b82f6" />
            <Text style={styles.footerContactText}>contact@ssfm-example.com</Text>
          </View>
          
          <View style={{marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#334155', alignItems: 'center'}}>
             <Text style={{color: '#64748b', fontSize: 12}}>&copy; {new Date().getFullYear()} SSFM. All rights reserved.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 12 : 12,
    paddingBottom: 12,
    zIndex: 100,
  },
  navBarScrolled: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}) as any,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff', 
    marginLeft: 10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logoTextScrolled: {
    color: '#1e293b',
    textShadowColor: 'transparent',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loginLinkScrolled: {
    color: '#1e293b',
    textShadowColor: 'transparent',
  },
  
  // HERO
  heroBackground: {
    width: '100%',
    minHeight: Dimensions.get('window').height,
    justifyContent: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 40,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)' } : {}) as any,
  },
  pingDotOuter: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#93c5fd', 
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  pingDotInner: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#3b82f6', 
  },
  badgeText: {
    color: '#1e293b', fontSize: 11, fontWeight: '700',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 46,
    marginBottom: 16,
  },
  titleHighlight: {
    color: '#2563eb', 
  },
  subtitle: {
    fontSize: 15,
    color: '#334155', 
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 28,
  },
  primaryButton: {
    width: '100%',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
    marginBottom: 32,
    borderRadius: 30,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  heroMockupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}) as any,
  },
  mockupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
    marginBottom: 16,
  },
  mockupStatus: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#dcfce3', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  mockupContent: {},
  mockupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockupBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },

  // COMMON SECTION
  sectionContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  sectionSectionSub: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e3a8a',
    marginBottom: 24,
    lineHeight: 34,
  },
  
  // FEATURES
  featureImageCard: {
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  featureImage: {
    width: '100%',
    height: '100%',
  },
  featureImageOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  featureImageTextContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  featureDetailCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: '#dbeafe',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  
  chatMockup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  chatHeader: {
    backgroundColor: '#2563eb',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // MAP
  mapCard: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  mapOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(219, 234, 254, 0.2)',
  },
  pondMarker: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pondMarkerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}) as any,
  },
  
  // GRID
  gridCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
  },
  gridIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },

  // FOOTER
  footer: {
    backgroundColor: '#0f172a',
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  footerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerContactText: {
    color: '#94a3b8',
    fontSize: 13,
    marginLeft: 12,
  },
});
