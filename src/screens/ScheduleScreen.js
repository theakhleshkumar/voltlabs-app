/**
 * ScheduleScreen
 * Sleep timer, wake-up alarms, and scheduling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

// Sleep timer durations in minutes
const SLEEP_DURATIONS = [5, 15, 30, 45, 60];

// Default names for known schedule IDs (firmware doesn't store names)
const SCHEDULE_NAMES = { 1: 'Morning', 2: 'Evening' };

// Firmware supports at most this many schedule entries (MAX_SCHEDULES in main.c)
const MAX_SCHEDULES = 4;

const ScheduleScreen = ({ route }) => {
  const { deviceName } = route.params || {};
  const { isOnline, sendCommand, wakeUp, schedules: deviceSchedules, sleepTimer } = useDeviceStatus(deviceName);

  // Sleep timer state
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const [sleepDuration, setSleepDuration] = useState(30);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);
  const sleepIntervalRef = useRef(null);
  
  // Wake-up light state
  const [wakeUpEnabled, setWakeUpEnabled] = useState(false);
  const [wakeUpTime, setWakeUpTime] = useState({ hour: 7, minute: 0 });
  const [wakeUpDuration, setWakeUpDuration] = useState(30); // minutes to full brightness
  
  // Daily schedules
  const [schedules, setSchedules] = useState([
    { id: 1, name: 'Morning', time: { hour: 7, minute: 0 }, action: 'on', enabled: false },
    { id: 2, name: 'Evening', time: { hour: 22, minute: 30 }, action: 'off', enabled: false },
  ]);

  // Add/Edit schedule modal state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalTime, setModalTime] = useState({ hour: 7, minute: 0 });
  const [modalAction, setModalAction] = useState('on');

  const isEnabled = isOnline === true;

  // Sync wake-up/schedule state from the device once its status first arrives,
  // so the UI reflects what's persisted on the device rather than the defaults above.
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    if (wakeUp === null && deviceSchedules === null && sleepTimer === null) return;

    if (wakeUp !== null) {
      setWakeUpEnabled(wakeUp.enabled);
      setWakeUpTime({ hour: wakeUp.hour, minute: wakeUp.minute });
      setWakeUpDuration(wakeUp.duration);
    }

    if (Array.isArray(deviceSchedules) && deviceSchedules.length > 0) {
      setSchedules((prev) =>
        deviceSchedules.map((d) => {
          const existing = prev.find((p) => p.id === d.id);
          return {
            id: d.id,
            name: existing?.name ?? SCHEDULE_NAMES[d.id] ?? `Schedule ${d.id}`,
            time: { hour: d.hour, minute: d.minute },
            action: d.action,
            enabled: d.enabled,
          };
        })
      );
    }

    // Reflect a sleep timer that's already counting down on the device
    // (e.g. it was started before the app was reopened)
    if (sleepTimer !== null && sleepTimer.active) {
      setSleepTimerActive(true);
      setSleepTimeRemaining(sleepTimer.remaining);
    }

    hasSyncedRef.current = true;
  }, [wakeUp, deviceSchedules, sleepTimer]);

  // Cosmetic 1-second countdown for the mm:ss display between the device's
  // own state updates. The device owns the actual dim/power-off sequence
  // (see CMD_SET_SLEEP_TIMER in main.c) so this keeps running correctly even
  // if the app is closed or crashes.
  useEffect(() => {
    if (!sleepTimerActive) return;
    sleepIntervalRef.current = setInterval(() => {
      setSleepTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(sleepIntervalRef.current);
  }, [sleepTimerActive]);

  // Once the device's timer finishes (or is cancelled) on its own, it reports
  // sleepTimer.active: false - mirror that here so the screen flips back to
  // the "Start Sleep Timer" view instead of getting stuck showing 0:00.
  useEffect(() => {
    if (sleepTimer === null) return;
    setSleepTimerActive(sleepTimer.active);
  }, [sleepTimer]);

  const startSleepTimer = () => {
    if (!isEnabled) return;
    const durationSec = sleepDuration * 60;
    setSleepTimerActive(true);
    setSleepTimeRemaining(durationSec);
    sendCommand({ sleepTimer: { enabled: true, duration: durationSec } }).catch(console.error);
  };

  const stopSleepTimer = () => {
    setSleepTimerActive(false);
    setSleepTimeRemaining(0);
    if (isEnabled) {
      sendCommand({ sleepTimer: { enabled: false } }).catch(console.error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeDisplay = (time) => {
    const hour12 = time.hour % 12 || 12;
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${time.minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const adjustTime = (type, field, delta) => {
    const setter = type === 'wakeup' ? setWakeUpTime : setModalTime;
    setter((prev) => {
      const newTime = { ...prev };
      if (field === 'hour') {
        newTime.hour = (prev.hour + delta + 24) % 24;
      } else {
        newTime.minute = (prev.minute + delta + 60) % 60;
      }
      return newTime;
    });
  };

  // Send the full schedules array to the device (firmware replaces its list wholesale)
  const sendSchedulesUpdate = (updated) => {
    if (isEnabled) {
      sendCommand({
        schedules: updated.map((s) => ({
          id: s.id,
          hour: s.time.hour,
          minute: s.time.minute,
          action: s.action,
          enabled: s.enabled,
        })),
      }).catch(console.error);
    }
  };

  const toggleSchedule = (id) => {
    setSchedules((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      sendSchedulesUpdate(updated);
      return updated;
    });
  };

  const openAddScheduleModal = () => {
    if (schedules.length >= MAX_SCHEDULES) {
      Alert.alert('Limit reached', `You can only have up to ${MAX_SCHEDULES} schedules.`);
      return;
    }
    setEditingScheduleId(null);
    setModalName('');
    setModalTime({ hour: 7, minute: 0 });
    setModalAction('on');
    setScheduleModalVisible(true);
  };

  const openEditScheduleModal = (schedule) => {
    setEditingScheduleId(schedule.id);
    setModalName(schedule.name);
    setModalTime(schedule.time);
    setModalAction(schedule.action);
    setScheduleModalVisible(true);
  };

  const saveSchedule = () => {
    const name = modalName.trim() || 'Schedule';
    setSchedules((prev) => {
      let updated;
      if (editingScheduleId !== null) {
        updated = prev.map((s) =>
          s.id === editingScheduleId
            ? { ...s, name, time: modalTime, action: modalAction }
            : s
        );
      } else {
        const usedIds = new Set(prev.map((s) => s.id));
        let newId = 1;
        while (usedIds.has(newId)) newId++;
        updated = [...prev, { id: newId, name, time: modalTime, action: modalAction, enabled: true }];
      }
      sendSchedulesUpdate(updated);
      return updated;
    });
    setScheduleModalVisible(false);
  };

  const deleteSchedule = () => {
    const schedule = schedules.find((s) => s.id === editingScheduleId);
    Alert.alert(
      'Delete Schedule',
      `Delete "${schedule?.name ?? 'this schedule'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSchedules((prev) => {
              const updated = prev.filter((s) => s.id !== editingScheduleId);
              sendSchedulesUpdate(updated);
              return updated;
            });
            setScheduleModalVisible(false);
          },
        },
      ]
    );
  };

  // Re-send wake-up config when time/duration change while enabled (skip the
  // very first run so mount/sync-on-load doesn't immediately echo a command back)
  const skipNextResendRef = useRef(true);
  useEffect(() => {
    if (skipNextResendRef.current) {
      skipNextResendRef.current = false;
      return;
    }
    if (wakeUpEnabled && isEnabled) {
      sendCommand({
        wakeUp: {
          enabled: true,
          hour: wakeUpTime.hour,
          minute: wakeUpTime.minute,
          duration: wakeUpDuration,
        },
      }).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeUpTime.hour, wakeUpTime.minute, wakeUpDuration]);

  const handleWakeUpToggle = (value) => {
    setWakeUpEnabled(value);
    if (value && isEnabled) {
      // Send wake-up config to device
      sendCommand({ 
        wakeUp: { 
          enabled: true, 
          hour: wakeUpTime.hour, 
          minute: wakeUpTime.minute,
          duration: wakeUpDuration 
        } 
      }).catch(console.error);
    } else if (isEnabled) {
      sendCommand({ wakeUp: { enabled: false } }).catch(console.error);
    }
  };

  if (!isEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.disabledContainer}>
          <Icon name="clock-outline" size={80} color="#9CA3AF" />
          <Text style={styles.disabledTitle}>Schedule</Text>
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
        {/* Sleep Timer */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="power-sleep" size={28} color="#6366F1" />
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>Sleep Timer</Text>
              <Text style={styles.cardSubtitle}>Gradually dims then turns off</Text>
            </View>
          </View>
          
          {!sleepTimerActive ? (
            <>
              <Text style={styles.durationLabel}>Duration</Text>
              <View style={styles.durationOptions}>
                {SLEEP_DURATIONS.map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationButton,
                      sleepDuration === duration && styles.durationButtonActive,
                    ]}
                    onPress={() => setSleepDuration(duration)}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      sleepDuration === duration && styles.durationButtonTextActive,
                    ]}>
                      {duration}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.startButton}
                onPress={startSleepTimer}
              >
                <Icon name="play" size={20} color="#fff" />
                <Text style={styles.startButtonText}>Start Sleep Timer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.timerActive}>
              <Text style={styles.timerDisplay}>{formatTime(sleepTimeRemaining)}</Text>
              <Text style={styles.timerLabel}>remaining</Text>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopSleepTimer}
              >
                <Icon name="stop" size={20} color="#EF4444" />
                <Text style={styles.stopButtonText}>Stop Timer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Wake-up Light */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="weather-sunset-up" size={28} color="#F59E0B" />
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>Wake-up Light</Text>
              <Text style={styles.cardSubtitle}>Sunrise simulation alarm</Text>
            </View>
            <Switch
              value={wakeUpEnabled}
              onValueChange={handleWakeUpToggle}
              trackColor={{ false: '#E5E7EB', true: '#FDE68A' }}
              thumbColor={wakeUpEnabled ? '#F59E0B' : '#9CA3AF'}
            />
          </View>
          
          {wakeUpEnabled && (
            <>
              <View style={styles.timePickerContainer}>
                <View style={styles.timePicker}>
                  <TouchableOpacity 
                    style={styles.timeAdjustButton}
                    onPress={() => adjustTime('wakeup', 'hour', 1)}
                  >
                    <Icon name="chevron-up" size={24} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>
                    {(wakeUpTime.hour % 12 || 12).toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity 
                    style={styles.timeAdjustButton}
                    onPress={() => adjustTime('wakeup', 'hour', -1)}
                  >
                    <Icon name="chevron-down" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeColon}>:</Text>
                <View style={styles.timePicker}>
                  <TouchableOpacity 
                    style={styles.timeAdjustButton}
                    onPress={() => adjustTime('wakeup', 'minute', 5)}
                  >
                    <Icon name="chevron-up" size={24} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>
                    {wakeUpTime.minute.toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity 
                    style={styles.timeAdjustButton}
                    onPress={() => adjustTime('wakeup', 'minute', -5)}
                  >
                    <Icon name="chevron-down" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.ampm}>{wakeUpTime.hour >= 12 ? 'PM' : 'AM'}</Text>
              </View>
              
              <View style={styles.wakeUpDurationContainer}>
                <Text style={styles.wakeUpDurationLabel}>Sunrise duration</Text>
                <View style={styles.wakeUpDurationOptions}>
                  {[15, 30, 45, 60].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.wakeUpDurationButton,
                        wakeUpDuration === d && styles.wakeUpDurationButtonActive,
                      ]}
                      onPress={() => setWakeUpDuration(d)}
                    >
                      <Text style={[
                        styles.wakeUpDurationText,
                        wakeUpDuration === d && styles.wakeUpDurationTextActive,
                      ]}>
                        {d} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Daily Schedules */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="calendar-clock" size={28} color="#10B981" />
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>Daily Schedules</Text>
              <Text style={styles.cardSubtitle}>Automatic on/off times</Text>
            </View>
          </View>
          
          {schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleItem}>
              <TouchableOpacity
                style={styles.scheduleInfo}
                onPress={() => openEditScheduleModal(schedule)}
                activeOpacity={0.6}
              >
                <Text style={styles.scheduleName}>{schedule.name}</Text>
                <View style={styles.scheduleDetails}>
                  <Icon
                    name={schedule.action === 'on' ? 'lightbulb-on' : 'lightbulb-off'}
                    size={16}
                    color={schedule.action === 'on' ? '#10B981' : '#EF4444'}
                  />
                  <Text style={styles.scheduleTime}>
                    {formatTimeDisplay(schedule.time)}
                  </Text>
                  <Text style={[
                    styles.scheduleAction,
                    { color: schedule.action === 'on' ? '#10B981' : '#EF4444' }
                  ]}>
                    Turn {schedule.action}
                  </Text>
                </View>
              </TouchableOpacity>
              <Switch
                value={schedule.enabled}
                onValueChange={() => toggleSchedule(schedule.id)}
                trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                thumbColor={schedule.enabled ? '#10B981' : '#9CA3AF'}
              />
            </View>
          ))}

          <TouchableOpacity
            style={styles.addScheduleButton}
            onPress={openAddScheduleModal}
          >
            <Icon name="plus" size={20} color="#6B7280" />
            <Text style={styles.addScheduleText}>Add Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add/Edit Schedule Modal */}
      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingScheduleId !== null ? 'Edit Schedule' : 'Add Schedule'}
              </Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={modalName}
              onChangeText={setModalName}
              placeholder="e.g. Morning"
              placeholderTextColor="#9CA3AF"
              maxLength={20}
            />

            <Text style={styles.modalLabel}>Time</Text>
            <View style={styles.timePickerContainer}>
              <View style={styles.timePicker}>
                <TouchableOpacity
                  style={styles.timeAdjustButton}
                  onPress={() => adjustTime('modal', 'hour', 1)}
                >
                  <Icon name="chevron-up" size={24} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.timeValue}>
                  {(modalTime.hour % 12 || 12).toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={styles.timeAdjustButton}
                  onPress={() => adjustTime('modal', 'hour', -1)}
                >
                  <Icon name="chevron-down" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.timeColon}>:</Text>
              <View style={styles.timePicker}>
                <TouchableOpacity
                  style={styles.timeAdjustButton}
                  onPress={() => adjustTime('modal', 'minute', 5)}
                >
                  <Icon name="chevron-up" size={24} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.timeValue}>
                  {modalTime.minute.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={styles.timeAdjustButton}
                  onPress={() => adjustTime('modal', 'minute', -5)}
                >
                  <Icon name="chevron-down" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.ampm}>{modalTime.hour >= 12 ? 'PM' : 'AM'}</Text>
            </View>

            <Text style={styles.modalLabel}>Action</Text>
            <View style={styles.actionToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.actionToggleButton,
                  modalAction === 'on' && styles.actionToggleButtonOnActive,
                ]}
                onPress={() => setModalAction('on')}
              >
                <Icon
                  name="lightbulb-on"
                  size={18}
                  color={modalAction === 'on' ? '#10B981' : '#9CA3AF'}
                />
                <Text style={[
                  styles.actionToggleText,
                  modalAction === 'on' && { color: '#10B981' },
                ]}>
                  Turn ON
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionToggleButton,
                  modalAction === 'off' && styles.actionToggleButtonOffActive,
                ]}
                onPress={() => setModalAction('off')}
              >
                <Icon
                  name="lightbulb-off"
                  size={18}
                  color={modalAction === 'off' ? '#EF4444' : '#9CA3AF'}
                />
                <Text style={[
                  styles.actionToggleText,
                  modalAction === 'off' && { color: '#EF4444' },
                ]}>
                  Turn OFF
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalSaveButton} onPress={saveSchedule}>
              <Text style={styles.modalSaveButtonText}>Save</Text>
            </TouchableOpacity>

            {editingScheduleId !== null && (
              <TouchableOpacity style={styles.modalDeleteButton} onPress={deleteSchedule}>
                <Icon name="trash-can-outline" size={18} color="#EF4444" />
                <Text style={styles.modalDeleteButtonText}>Delete Schedule</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Sleep timer styles
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#6366F1',
  },
  durationButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  durationButtonTextActive: {
    color: '#fff',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timerActive: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: '#6366F1',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 16,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Wake-up light styles
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timePicker: {
    alignItems: 'center',
  },
  timeAdjustButton: {
    padding: 8,
  },
  timeValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#374151',
    fontVariant: ['tabular-nums'],
  },
  timeColon: {
    fontSize: 40,
    fontWeight: '700',
    color: '#374151',
    marginHorizontal: 8,
  },
  ampm: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 12,
  },
  wakeUpDurationContainer: {
    marginTop: 8,
  },
  wakeUpDurationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
  },
  wakeUpDurationOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  wakeUpDurationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  wakeUpDurationButtonActive: {
    backgroundColor: '#FDE68A',
  },
  wakeUpDurationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  wakeUpDurationTextActive: {
    color: '#B45309',
  },
  // Schedule styles
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  scheduleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  scheduleAction: {
    fontSize: 13,
    fontWeight: '500',
  },
  addScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    borderStyle: 'dashed',
    gap: 6,
  },
  addScheduleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Add/Edit schedule modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#374151',
  },
  actionToggleContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  actionToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  actionToggleButtonOnActive: {
    backgroundColor: '#D1FAE5',
  },
  actionToggleButtonOffActive: {
    backgroundColor: '#FEE2E2',
  },
  actionToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  modalSaveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
    gap: 6,
  },
  modalDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default ScheduleScreen;
