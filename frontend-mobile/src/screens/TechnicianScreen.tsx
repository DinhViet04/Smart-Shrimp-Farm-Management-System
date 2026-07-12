import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Wrench } from 'lucide-react-native';

export default function TechnicianScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Wrench color="#6366f1" size={48} />
        </View>
        <Text style={styles.title}>Khu Vực Kỹ Thuật Viên</Text>
        <Text style={styles.subtitle}>
          Giao diện và các tính năng chi tiết dành cho chuyên gia kỹ thuật sẽ được phát triển và tích hợp trong các bản cập nhật sắp tới.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e7ff',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#312e81',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
});
