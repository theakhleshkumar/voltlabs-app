/**
 * ColorPickerScreen
 * Full RGB color selection and color temperature controls
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import ColorPicker from 'react-native-wheel-color-picker';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { colors, fonts } from '../constants/theme';
import { showToast } from '../components/Toast';

// Quick preset colors
const PRESET_COLORS = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Orange', hex: '#FF8000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Cyan', hex: '#00FFFF' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Purple', hex: '#8000FF' },
  { name: 'Pink', hex: '#FF00FF' },
  { name: 'White', hex: '#FFFFFF' },
];

// Color temperature presets
const COLOR_TEMPS = [
  { name: 'Candle', temp: 1900, color: '#FF9329' },
  { name: 'Warm', temp: 2700, color: '#FFB46B' },
  { name: 'Soft', temp: 3000, color: '#FFC89B' },
  { name: 'Neutral', temp: 4000, color: '#FFF4E5' },
  { name: 'Cool', temp: 5000, color: '#FFF9F5' },
  { name: 'Daylight', temp: 6500, color: '#F5F5FF' },
];

const ColorPickerScreen = ({ route }) => {
  const { deviceName } = route.params || {};
  const { isOnline, sendCommand } = useDeviceStatus(deviceName);
  
  const [selectedColor, setSelectedColor] = useState('#FFC107');
  const [colorTemp, setColorTemp] = useState(4000);
  const [activeTab, setActiveTab] = useState('color'); // 'color' or 'temp'
  const [savedColors, setSavedColors] = useState([
    '#FFC107', '#FF5722', '#4CAF50', '#2196F3', '#9C27B0'
  ]);

  const isEnabled = isOnline === true;

  const handleColorChange = useCallback((color) => {
    setSelectedColor(color);
  }, []);

  const handleColorChangeComplete = useCallback((color) => {
    setSelectedColor(color);
    if (isEnabled) {
      // Convert hex to RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      sendCommand({ color: { r, g, b } }).catch((err) => {
        console.error('Color command error:', err);
      });
    }
  }, [isEnabled, sendCommand]);

  const handlePresetColor = (hex) => {
    setSelectedColor(hex);
    if (isEnabled) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      sendCommand({ color: { r, g, b } }).catch((err) => {
        console.error('Preset color error:', err);
      });
    }
  };

  const handleColorTempChange = (temp) => {
    setColorTemp(temp);
  };

  const handleColorTempComplete = (temp) => {
    setColorTemp(temp);
    if (isEnabled) {
      sendCommand({ colorTemp: Math.round(temp) }).catch((err) => {
        console.error('Color temp error:', err);
      });
    }
  };

  const handleSaveColor = () => {
    if (savedColors.includes(selectedColor)) {
      showToast('This color is already in your favorites');
      return;
    }
    if (savedColors.length >= 8) {
      showToast('Remove a saved color to add a new one');
      return;
    }
    setSavedColors([...savedColors, selectedColor]);
  };

  const handleRemoveSavedColor = (color) => {
    setSavedColors(savedColors.filter(c => c !== color));
  };

  const getColorTempLabel = () => {
    if (colorTemp <= 2000) return 'Candle';
    if (colorTemp <= 2800) return 'Warm White';
    if (colorTemp <= 3500) return 'Soft White';
    if (colorTemp <= 4500) return 'Neutral';
    if (colorTemp <= 5500) return 'Cool White';
    return 'Daylight';
  };

  if (!isEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.disabledContainer}>
          <Icon name="palette" size={80} color={colors.textPlaceholder} />
          <Text style={styles.disabledTitle}>Colors</Text>
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
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'color' && styles.tabActive]}
            onPress={() => setActiveTab('color')}
          >
            <Icon 
              name="palette" 
              size={20} 
              color={activeTab === 'color' ? '#FFC107' : colors.textPlaceholder} 
            />
            <Text style={[styles.tabText, activeTab === 'color' && styles.tabTextActive]}>
              Color
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'temp' && styles.tabActive]}
            onPress={() => setActiveTab('temp')}
          >
            <Icon 
              name="thermometer" 
              size={20} 
              color={activeTab === 'temp' ? '#FFC107' : colors.textPlaceholder} 
            />
            <Text style={[styles.tabText, activeTab === 'temp' && styles.tabTextActive]}>
              Temperature
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'color' ? (
          <>
            {/* Color Preview */}
            <View style={styles.previewCard}>
              <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
              <Text style={styles.colorHex}>{selectedColor.toUpperCase()}</Text>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveColor}
                accessibilityRole="button"
                accessibilityLabel="Save current color"
              >
                <Icon name="heart-outline" size={24} color="#FFC107" />
              </TouchableOpacity>
            </View>

            {/* Color Wheel */}
            <View style={styles.pickerCard}>
              <Text style={styles.sectionTitle}>Pick a Color</Text>
              <View style={styles.colorPickerWrapper}>
                <ColorPicker
                  color={selectedColor}
                  onColorChange={handleColorChange}
                  onColorChangeComplete={handleColorChangeComplete}
                  thumbSize={30}
                  sliderSize={30}
                  noSnap={true}
                  row={false}
                  swatches={false}
                />
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsCard}>
              <Text style={styles.sectionTitle}>Quick Colors</Text>
              <View style={styles.presetsGrid}>
                {PRESET_COLORS.map((preset) => (
                  <TouchableOpacity
                    key={preset.name}
                    style={[
                      styles.presetButton,
                      { backgroundColor: preset.hex },
                    ]}
                    onPress={() => handlePresetColor(preset.hex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set color to ${preset.name}`}
                  >
                    {preset.hex === '#FFFFFF' && (
                      <View style={styles.whitePresetBorder} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Saved Colors */}
            {savedColors.length > 0 && (
              <View style={styles.savedCard}>
                <Text style={styles.sectionTitle}>Saved Colors</Text>
                <View style={styles.savedGrid}>
                  {savedColors.map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.savedButton, { backgroundColor: color }]}
                      onPress={() => handlePresetColor(color)}
                      onLongPress={() => handleRemoveSavedColor(color)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set saved color ${color}. Long press to remove`}
                    >
                      {selectedColor.toUpperCase() === color.toUpperCase() && (
                        <Icon name="check" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.savedHint}>Long press to remove</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Color Temperature */}
            <View style={styles.tempCard}>
              <View style={styles.tempPreview}>
                <View 
                  style={[
                    styles.tempPreviewCircle, 
                    { 
                      backgroundColor: colorTemp <= 3000 ? '#FFB46B' : 
                                       colorTemp <= 4500 ? '#FFF4E5' : '#F5F5FF',
                    }
                  ]} 
                />
                <Text style={styles.tempValue}>{Math.round(colorTemp)}K</Text>
                <Text style={styles.tempLabel}>{getColorTempLabel()}</Text>
              </View>

              <View style={styles.tempSliderContainer}>
                <Icon name="candle" size={24} color="#FF9329" />
                <Slider
                  style={styles.tempSlider}
                  minimumValue={1900}
                  maximumValue={6500}
                  step={100}
                  value={colorTemp}
                  onValueChange={handleColorTempChange}
                  onSlidingComplete={handleColorTempComplete}
                  minimumTrackTintColor="#FFB46B"
                  maximumTrackTintColor="#E0E7FF"
                  thumbTintColor="#FFC107"
                />
                <Icon name="white-balance-sunny" size={24} color="#6B7FFF" />
              </View>
            </View>

            {/* Temperature Presets */}
            <View style={styles.tempPresetsCard}>
              <Text style={styles.sectionTitle}>Presets</Text>
              <View style={styles.tempPresetsGrid}>
                {COLOR_TEMPS.map((preset) => (
                  <TouchableOpacity
                    key={preset.name}
                    style={[
                      styles.tempPresetButton,
                      colorTemp === preset.temp && styles.tempPresetActive,
                    ]}
                    onPress={() => {
                      setColorTemp(preset.temp);
                      handleColorTempComplete(preset.temp);
                    }}
                  >
                    <View 
                      style={[styles.tempPresetCircle, { backgroundColor: preset.color }]} 
                    />
                    <Text style={[
                      styles.tempPresetText,
                      colorTemp === preset.temp && styles.tempPresetTextActive,
                    ]}>
                      {preset.name}
                    </Text>
                    <Text style={styles.tempPresetValue}>{preset.temp}K</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textPlaceholder,
    marginTop: 16,
  },
  disabledText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPlaceholder,
    textAlign: 'center',
    marginTop: 8,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#FFF8E1',
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPlaceholder,
  },
  tabTextActive: {
    color: '#FFC107',
  },
  // Preview card
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  colorPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.border,
  },
  colorHex: {
    fontFamily: fonts.bold,
    flex: 1,
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 16,
  },
  saveButton: {
    padding: 8,
  },
  // Picker card
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  colorPickerWrapper: {
    height: 280,
    paddingHorizontal: 8,
  },
  // Presets card
  presetsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  presetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  presetButtonActive: {
    borderWidth: 3,
    borderColor: '#FFC107',
  },
  whitePresetBorder: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Saved colors
  savedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  savedButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  savedHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textPlaceholder,
    marginTop: 12,
    textAlign: 'center',
  },
  // Temperature styles
  tempCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  tempPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tempPreviewCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.border,
    marginBottom: 12,
  },
  tempValue: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.textSecondary,
  },
  tempLabel: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 4,
  },
  tempSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  tempSlider: {
    flex: 1,
    height: 40,
  },
  // Temperature presets
  tempPresetsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tempPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  tempPresetButton: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tempPresetActive: {
    borderColor: '#FFC107',
    backgroundColor: '#FFF8E1',
  },
  tempPresetCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 8,
  },
  tempPresetText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tempPresetTextActive: {
    color: '#FFC107',
  },
  tempPresetValue: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textPlaceholder,
    marginTop: 2,
  },
});

export default ColorPickerScreen;
