import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function FiveTCareScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FiveTCare (Đang phát triển)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
});
