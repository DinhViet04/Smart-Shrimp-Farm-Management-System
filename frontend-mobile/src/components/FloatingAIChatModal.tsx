import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatbotScreen from '../screens/ChatbotScreen';

const MASCOT_IMAGE = require('../../assets/images/shrimp-mascot.jpg');

// Kích thước bong bóng và khoảng cách mép an toàn
const BUTTON_SIZE = 62;
const SCREEN_MARGIN = 14; // Giữ mép 14px để bong bóng luôn trọn vẹn 100% trên màn hình, KHÔNG bị mất góc
const STORAGE_KEY = '@ssfm_floating_messenger_pos';
const TAB_H = Platform.OS === 'ios' ? 82 : 62;
const DISMISS_SIZE = 54;

// Trạng thái mờ khi nghỉ (idle) và sáng khi kích hoạt (active)
const IDLE_OPACITY = 0.38;
const ACTIVE_OPACITY = 1.0;
const IDLE_DELAY_MS = 3200; // 3.2s sau khi không tương tác sẽ tự động mờ đi

function dims() {
  const { width, height } = Dimensions.get('window');
  return { W: width, H: height };
}

function getDefaultPos() {
  const { W, H } = dims();
  return { x: W - BUTTON_SIZE - SCREEN_MARGIN, y: H * 0.52 };
}

// Tính toán vị trí snap về cạnh màn hình gần nhất, đảm bảo hiển thị trọn vẹn toàn bộ hình tròn
function snapToEdge(x: number, y: number) {
  const { W, H } = dims();
  const snapX = x + BUTTON_SIZE / 2 < W / 2
    ? SCREEN_MARGIN                       // Hút về mép trái, cách lề 14px (không bị lẹm góc)
    : W - BUTTON_SIZE - SCREEN_MARGIN;    // Hút về mép phải, cách lề 14px (không bị lẹm góc)

  const topBound = Platform.OS === 'ios' ? 54 : 40;
  const bottomBound = H - BUTTON_SIZE - TAB_H - 12;
  const clampedY = Math.max(topBound, Math.min(bottomBound, y));

  return { x: snapX, y: clampedY };
}

// Kiểm tra xem vị trí kéo có đang nằm trong ô huỷ (Dismiss Zone) ở đáy màn hình không
function isInDismissZone(x: number, y: number) {
  const { W, H } = dims();
  const dzCenterX = W / 2;
  const dzCenterY = H - TAB_H - DISMISS_SIZE / 2 - 20;

  const bubbleCenterX = x + BUTTON_SIZE / 2;
  const bubbleCenterY = y + BUTTON_SIZE / 2;

  const dist = Math.hypot(bubbleCenterX - dzCenterX, bubbleCenterY - dzCenterY);
  return dist < 65;
}

interface FloatingAIChatModalProps { }

export default function FloatingAIChatModal(_props: FloatingAIChatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [nearDismiss, setNearDismiss] = useState(false);

  const defaultPos = getDefaultPos();
  const pan = useRef(new Animated.ValueXY(defaultPos)).current;
  const panOffset = useRef(defaultPos);
  const dragStartTime = useRef<number>(0);
  const hasMoved = useRef(false);

  // Animated values cho hiệu ứng
  const idleFadeAnim = useRef(new Animated.Value(ACTIVE_OPACITY)).current; // Hiệu ứng mờ đi / hiện lên
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dismissScale = useRef(new Animated.Value(1)).current;
  const dismissOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kích hoạt làm mờ dần sau thời gian chờ (idle)
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      Animated.timing(idleFadeAnim, {
        toValue: IDLE_OPACITY,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, IDLE_DELAY_MS);
  }, [idleFadeAnim]);

  // Đánh thức con tôm hiện rõ lên 100% khi người dùng tương tác
  const wakeUpBubble = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    Animated.timing(idleFadeAnim, {
      toValue: ACTIVE_OPACITY,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [idleFadeAnim]);

  // Tải vị trí đã lưu từ AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const pos = JSON.parse(saved);
          // Đảm bảo vị trí đã lưu không bị lẹm góc màn hình
          const safePos = snapToEdge(pos.x, pos.y);
          pan.setValue(safePos);
          panOffset.current = safePos;
        }
      } catch (_) { }
    })();

    // Ban đầu hiện rõ, sau 3.2s không thao tác sẽ tự động mờ đi
    startIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [startIdleTimer]);

  // Vòng lặp nhịp thở nhẹ (Breathing pulse ring)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 1100, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(1400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, pulseOpacity]);

  const savePos = async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch (_) { }
  };

  // Hiển thị ô Dismiss ở đáy màn hình khi bắt đầu kéo
  const showDismiss = () => {
    Animated.parallel([
      Animated.spring(dismissScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(dismissOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const hideDismiss = () => {
    Animated.parallel([
      Animated.timing(dismissOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) =>
        Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,

      onPanResponderGrant: () => {
        dragStartTime.current = Date.now();
        hasMoved.current = false;
        pan.setOffset(panOffset.current);
        pan.setValue({ x: 0, y: 0 });
        setIsDragging(false);

        // ĐÁNH THỨC: Hiện rõ lên 100% ngay lập tức khi ngón tay chạm vào
        wakeUpBubble();

        // Hiệu ứng Pop-up & Glow: Phóng to nảy lên + phát sáng rực rỡ
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true, friction: 4, tension: 70 }),
          Animated.timing(glowAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();

        showDismiss();
      },

      onPanResponderMove: (_e, gs) => {
        if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6) {
          if (!hasMoved.current) {
            setIsDragging(true);
            hasMoved.current = true;
          }
        }

        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_e, gs);

        // Kiểm tra khu vực Dismiss
        const curX = panOffset.current.x + gs.dx;
        const curY = panOffset.current.y + gs.dy;
        const inZone = isInDismissZone(curX, curY);
        setNearDismiss(inZone);

        if (inZone) {
          Animated.spring(dismissScale, { toValue: 1.35, useNativeDriver: true, friction: 4 }).start();
        } else {
          Animated.spring(dismissScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
        }
      },

      onPanResponderRelease: (_e, gs) => {
        pan.flattenOffset();

        const elapsed = Date.now() - dragStartTime.current;
        const moved = hasMoved.current;

        // Trả scale & glow về bình thường với hiệu ứng nhún lò xo
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 50 }),
          Animated.timing(glowAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
        hideDismiss();

        // Nếu chỉ là một cú Chạm (Tap nhẹ < 220ms và không kéo xa) -> MỞ CHAT TOÀN MÀN HÌNH
        if (!moved || elapsed < 220) {
          setIsDragging(false);
          setNearDismiss(false);
          wakeUpBubble();
          setIsOpen(true);
          return;
        }

        const rawX = panOffset.current.x + gs.dx;
        const rawY = panOffset.current.y + gs.dy;

        // Nếu thả vào ô Huỷ ở đáy màn hình -> ẩn bong bóng
        if (isInDismissZone(rawX, rawY)) {
          Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 0.1, useNativeDriver: true, friction: 5 }),
          ]).start(() => setIsVisible(false));
          setIsDragging(false);
          setNearDismiss(false);
          return;
        }

        // HÚT VỀ CẠNH MÀN HÌNH: Đảm bảo nằm trọn vẹn trong màn hình, không bị mất góc nào
        const snapped = snapToEdge(rawX, rawY);
        Animated.spring(pan, {
          toValue: snapped,
          useNativeDriver: false,
          friction: 6,
          tension: 52,
          overshootClamping: false,
        }).start(() => {
          panOffset.current = snapped;
          savePos(snapped.x, snapped.y);
          // Sau khi hút về vị trí cố định 3.2s, lại tự động mờ dần đi
          startIdleTimer();
        });

        setIsDragging(false);
        setNearDismiss(false);
      },
    })
  ).current;

  if (!isVisible) return null;

  const { W } = dims();
  const dismissZoneBottom = TAB_H + 20;
  const dismissZoneCenterX = W / 2 - DISMISS_SIZE / 2;

  return (
    <>
      {/* ── KHU VỰC HUỶ KÉO (Hiển thị khi đang kéo bong bóng) ── */}
      <Animated.View
        style={[
          styles.dismissZone,
          {
            bottom: dismissZoneBottom,
            left: dismissZoneCenterX,
            opacity: dismissOpacity,
            transform: [{ scale: dismissScale }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.dismissInner, nearDismiss && styles.dismissInnerActive]}>
          <View style={styles.dismissIcon}>
            <View style={styles.dismissXBar1} />
            <View style={styles.dismissXBar2} />
          </View>
        </View>
      </Animated.View>

      {/* ── BONG BÓNG CHAT MASCOT TÔM AI (MESSENGER STYLE) ── */}
      <Animated.View
        style={[
          styles.bubbleContainer,
          {
            opacity: idleFadeAnim, // Hiệu ứng mờ đi khi không chạm, sáng rõ 100% khi nhấn vào
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scaleAnim }, // Hiệu ứng phóng to nảy đàn hồi
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Vòng hào quang sáng rực rỡ khi nhấn vào */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowAnim,
              transform: [{ scale: 1.25 }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Vòng thở nhịp nhàng (Breathing pulse ring) */}
        {!isDragging && !isOpen && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Nút tròn Mascot Tôm AI 3D */}
        <TouchableOpacity
          onPress={() => {
            if (!isDragging) {
              wakeUpBubble();
              setIsOpen(true);
            }
          }}
          activeOpacity={0.9}
          accessibilityLabel="Trợ lý Tôm AI"
          style={styles.mascotTouchable}
        >
          <View style={[
            styles.mascotRing,
            nearDismiss && styles.mascotRingDismiss,
            isDragging && styles.mascotRingDragging,
          ]}>
            <Image source={MASCOT_IMAGE} style={styles.mascotImage} />
          </View>

          {/* Huy hiệu AI Online (Chấm xanh nhỏ góc dưới - Messenger style) */}
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── MÀN HÌNH CHAT AI TOÀN MÀN HÌNH ── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setIsOpen(false);
          wakeUpBubble();
          startIdleTimer();
        }}
      >
        <ChatbotScreen
          onClose={() => {
            setIsOpen(false);
            wakeUpBubble();
            startIdleTimer();
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vòng hào quang neon cam khi ngón tay chạm vào
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 16,
  },

  // Vòng phát xung notification
  pulseRing: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: '#f97316',
    backgroundColor: 'transparent',
  },

  mascotTouchable: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 14,
  },
  mascotRing: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2.8,
    borderColor: '#f97316',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  mascotRingDragging: {
    borderColor: '#fbbf24',
    borderWidth: 3,
  },
  mascotRingDismiss: {
    borderColor: '#ef4444',
    borderWidth: 3.5,
  },
  mascotImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Chấm xanh AI sẵn sàng (Messenger online indicator)
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981', // Xanh ngọc online
  },

  // Ô Dismiss ở đáy màn hình
  dismissZone: {
    position: 'absolute',
    width: DISMISS_SIZE,
    height: DISMISS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissInner: {
    width: DISMISS_SIZE,
    height: DISMISS_SIZE,
    borderRadius: DISMISS_SIZE / 2,
    backgroundColor: 'rgba(20, 24, 33, 0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissInnerActive: {
    backgroundColor: '#ef4444',
    borderColor: '#fca5a5',
  },
  dismissIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissXBar1: {
    position: 'absolute',
    width: 16,
    height: 2.2,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  dismissXBar2: {
    position: 'absolute',
    width: 16,
    height: 2.2,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
});
