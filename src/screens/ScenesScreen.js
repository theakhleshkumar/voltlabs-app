/**
 * ScenesScreen
 * Preset scenes and lighting effects
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

// Preset scenes with their configurations
const PRESET_SCENES = [
  { 
    id: 'reading', 
    name: 'Reading', 
    icon: 'book-open-variant',
    description: 'Bright, neutral light',
    color: '#FFF4E5',
    config: { colorTemp: 4000, brightness: 100 }
  },
  { 
    id: 'relax', 
    name: 'Relax', 
    icon: 'sofa',
    description: 'Warm, dim ambiance',
    color: '#FFB46B',
    config: { colorTemp: 2700, brightness: 40 }
  },
  { 
    id: 'night', 
    name: 'Night Light', 
    icon: 'weather-night',
    description: 'Very dim, warm glow',
    color: '#FF9329',
    config: { colorTemp: 1900, brightness: 10 }
  },
  { 
    id: 'focus', 
    name: 'Focus', 
    icon: 'head-lightbulb',
    description: 'Cool, energizing light',
    color: '#E0E7FF',
    config: { colorTemp: 5500, brightness: 100 }
  },
  { 
    id: 'movie', 
    name: 'Movie', 
    icon: 'movie-open',
    description: 'Soft bias lighting',
    color: '#6366F1',
    config: { color: { r: 99, g: 102, b: 241 }, brightness: 20 }
  },
  { 
    id: 'dinner', 
    name: 'Dinner', 
    icon: 'silverware-fork-knife',
    description: 'Romantic warm glow',
    color: '#F59E0B',
    config: { colorTemp: 2200, brightness: 50 }
  },
];

// Lighting effects/animations
const EFFECTS = [
  { 
    id: 'breathing', 
    name: 'Breathing', 
    icon: 'sine-wave',
    description: 'Gentle pulse fade',
    color: '#10B981',
  },
  { 
    id: 'rainbow', 
    name: 'Rainbow', 
    icon: 'looks',
    description: 'Smooth color cycle',
    color: '#EC4899',
  },
  { 
    id: 'candle', 
    name: 'Candle', 
    icon: 'candle',
    description: 'Flickering flame',
    color: '#F97316',
  },
  { 
    id: 'party', 
    name: 'Party', 
    icon: 'party-popper',
    description: 'Fast color changes',
    color: '#8B5CF6',
  },
  { 
    id: 'sunrise', 
    name: 'Sunrise', 
    icon: 'weather-sunset-up',
    description: 'Gradual warm up',
    color: '#FBBF24',
  },
  { 
    id: 'ocean', 
    name: 'Ocean', 
    icon: 'waves',
    description: 'Calming blue waves',
    color: '#06B6D4',
  },
];

const ScenesScreen = ({ route }) => {
  const { deviceName } = route.params || {};
  const { isOnline, sendCommand } = useDeviceStatus(deviceName);
  
  const [activeScene, setActiveScene] = useState(null);
  const [activeEffect, setActiveEffect] = useState(null);

  const isEnabled = isOnline === true;

  const handleScenePress = async (scene) => {
    if (!isEnabled) return;
    
    // Stop any running effect
    if (activeEffect) {
      await sendCommand({ effect: 'stop' }).catch(console.error);
      setActiveEffect(null);
    }
    
    setActiveScene(scene.id);
    
    // Send scene configuration to device
    try {
      await sendCommand({ scene: scene.id, ...scene.config });
    } catch (err) {
      console.error('Scene command error:', err);
    }
  };

  const handleEffectPress = async (effect) => {
    if (!isEnabled) return;
    
    // Clear active scene when starting effect
    setActiveScene(null);
    
    // Toggle effect off if same one is pressed
    if (activeEffect === effect.id) {
      setActiveEffect(null);
      try {
        await sendCommand({ effect: 'stop' });
      } catch (err) {
        console.error('Effect stop error:', err);
      }
      return;
    }
    
    setActiveEffect(effect.id);
    
    // Send effect command to device
    try {
      await sendCommand({ effect: effect.id });
    } catch (err) {
      console.error('Effect command error:', err);
    }
  };

  if (!isEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.disabledContainer}>
          <Icon name="lightbulb-group" size={80} color="#9CA3AF" />
          <Text style={styles.disabledTitle}>Scenes</Text>
          <Text style={styles.disabledText}>
            Device offline - controls disabled
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Preset Scenes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scenes</Text>
          <Text style={styles.sectionSubtitle}>Quick lighting presets</Text>
          <View style={styles.scenesGrid}>
            {PRESET_SCENES.map((scene) => (
              <TouchableOpacity
                key={scene.id}
                style={[
                  styles.sceneCard,
                  activeScene === scene.id && styles.sceneCardActive,
                ]}
                onPress={() => handleScenePress(scene)}
                activeOpacity={0.7}
              >
                <View style={[styles.sceneIconContainer, { backgroundColor: scene.color + '30' }]}>
                  <Icon name={scene.icon} size={28} color={scene.color} />
                </View>
                <Text style={[
                  styles.sceneName,
                  activeScene === scene.id && styles.sceneNameActive,
                ]}>
                  {scene.name}
                </Text>
                <Text style={styles.sceneDescription}>{scene.description}</Text>
                {activeScene === scene.id && (
                  <View style={styles.activeIndicator}>
                    <Icon name="check-circle" size={18} color="#10B981" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Effects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effects</Text>
          <Text style={styles.sectionSubtitle}>Dynamic lighting animations</Text>
          <View style={styles.effectsGrid}>
            {EFFECTS.map((effect) => (
              <TouchableOpacity
                key={effect.id}
                style={[
                  styles.effectCard,
                  activeEffect === effect.id && styles.effectCardActive,
                ]}
                onPress={() => handleEffectPress(effect)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.effectIconContainer, 
                  { backgroundColor: effect.color + '20' },
                  activeEffect === effect.id && { backgroundColor: effect.color + '40' },
                ]}>
                  <Icon 
                    name={effect.icon} 
                    size={32} 
                    color={activeEffect === effect.id ? '#fff' : effect.color} 
                  />
                  {activeEffect === effect.id && (
                    <View style={[styles.effectRunning, { backgroundColor: effect.color }]} />
                  )}
                </View>
                <Text style={[
                  styles.effectName,
                  activeEffect === effect.id && styles.effectNameActive,
                ]}>
                  {effect.name}
                </Text>
                <Text style={styles.effectDescription}>{effect.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stop Button */}
        {(activeScene || activeEffect) && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={async () => {
              setActiveScene(null);
              setActiveEffect(null);
              try {
                await sendCommand({ effect: 'stop' });
              } catch (err) {
                console.error('Stop error:', err);
              }
            }}
          >
            <Icon name="stop-circle" size={24} color="#EF4444" />
            <Text style={styles.stopButtonText}>Stop All Effects</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disabledTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 16,
  },
  disabledText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  // Section styles
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  // Scenes grid
  scenesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sceneCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  sceneCardActive: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  sceneIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  sceneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  sceneNameActive: {
    color: '#10B981',
  },
  sceneDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activeIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  // Effects grid
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  effectCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  effectCardActive: {
    backgroundColor: '#1F2937',
  },
  effectIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  effectRunning: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    opacity: 0.6,
  },
  effectName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  effectNameActive: {
    color: '#fff',
  },
  effectDescription: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  // Stop button
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default ScenesScreen;
