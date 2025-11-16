import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

const STORAGE_KEY = 'fortuneflip:wheels';
const COLORS = ['#FF6B6B', '#FFD166', '#06D6A0', '#4ECDC4', '#1A535C', '#EF476F'];

const createSegment = (label = 'Default') => ({
  id: `${Date.now()}-${Math.random()}`,
  label,
});

const createWheel = (name) => ({
  id: `${Date.now()}-${Math.random()}`,
  name,
  segments: [createSegment()],
});

const ensureSegments = (segments) =>
  segments.length > 0 ? segments : [createSegment()];

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const createArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${x} ${y} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

const WheelCanvas = ({ segments, selectedSegmentId, spinAnimatedValue }) => {
  const size = 280;
  const radius = size / 2;
  const anglePerSegment = 360 / segments.length;

  return (
    <View style={styles.wheelWrapper}>
      <Animated.View
        style={{
          transform: [
            {
              rotate: spinAnimatedValue.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
                extrapolate: 'extend',
              }),
            },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G origin={`${radius}, ${radius}`}>
            {segments.map((segment, index) => {
              const startAngle = anglePerSegment * index;
              const endAngle = startAngle + anglePerSegment;
              const path = createArc(radius, radius, radius, startAngle, endAngle);
              const isSelected = selectedSegmentId === segment.id;
              const fillColor = isSelected
                ? '#FFF'
                : COLORS[index % COLORS.length];
              const textAngle = startAngle + anglePerSegment / 2;
              const textRadius = radius * 0.6;
              const textPoint = polarToCartesian(radius, radius, textRadius, textAngle);
              return (
                <G key={segment.id}>
                  <Path d={path} fill={fillColor} stroke="#fff" strokeWidth={1} />
                  <SvgText
                    x={textPoint.x}
                    y={textPoint.y}
                    fill={isSelected ? COLORS[index % COLORS.length] : '#222'}
                    fontSize={12}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {segment.label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </Animated.View>
      <View style={styles.pointer} />
    </View>
  );
};

const App = () => {
  const [wheels, setWheels] = useState([]);
  const [activeWheelId, setActiveWheelId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setWheels(parsed.wheels || []);
          setActiveWheelId(parsed.activeWheelId || parsed.wheels?.[0]?.id || null);
        } else {
          const starterWheel = createWheel('Wheel 1');
          setWheels([starterWheel]);
          setActiveWheelId(starterWheel.id);
        }
      } catch (err) {
        console.warn('Failed to load wheels', err);
        const starterWheel = createWheel('Wheel 1');
        setWheels([starterWheel]);
        setActiveWheelId(starterWheel.id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ wheels, activeWheelId })
        );
      } catch (err) {
        console.warn('Failed to save wheels', err);
      }
    };
    if (wheels.length) {
      persist();
    }
  }, [wheels, activeWheelId]);

  const activeWheel = useMemo(
    () => wheels.find((wheel) => wheel.id === activeWheelId) || wheels[0],
    [wheels, activeWheelId]
  );

  useEffect(() => {
    if (activeWheel) {
      setActiveWheelId(activeWheel.id);
    }
  }, [activeWheel?.id]);

  const updateWheel = (wheelId, updater) => {
    setWheels((prev) =>
      prev.map((wheel) =>
        wheel.id === wheelId ? { ...wheel, ...updater(wheel) } : wheel
      )
    );
  };

  const addWheel = () => {
    const wheelNumber = wheels.length + 1;
    const newWheel = createWheel(`Wheel ${wheelNumber}`);
    setWheels((prev) => [...prev, newWheel]);
    setActiveWheelId(newWheel.id);
    setSelectedSegmentId(null);
  };

  const deleteWheel = (wheelId) => {
    if (wheels.length === 1) {
      return;
    }
    setWheels((prev) => prev.filter((wheel) => wheel.id !== wheelId));
    if (activeWheelId === wheelId) {
      const nextWheel = wheels.find((wheel) => wheel.id !== wheelId);
      setActiveWheelId(nextWheel?.id || null);
      setSelectedSegmentId(null);
    }
  };

  const addSegment = () => {
    if (!activeWheel) return;
    updateWheel(activeWheel.id, (wheel) => ({
      segments: [...wheel.segments, createSegment(`Segment ${wheel.segments.length + 1}`)],
    }));
  };

  const updateSegmentLabel = (segmentId, label) => {
    if (!activeWheel) return;
    updateWheel(activeWheel.id, (wheel) => ({
      segments: wheel.segments.map((segment) =>
        segment.id === segmentId ? { ...segment, label } : segment
      ),
    }));
  };

  const deleteSegment = (segmentId) => {
    if (!activeWheel) return;
    updateWheel(activeWheel.id, (wheel) => ({
      segments: ensureSegments(
        wheel.segments.filter((segment) => segment.id !== segmentId)
      ),
    }));
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(null);
    }
  };

  const renameWheel = (name) => {
    if (!activeWheel) return;
    updateWheel(activeWheel.id, () => ({ name }));
  };

  const spinWheel = () => {
    if (!activeWheel || isSpinning) return;
    const segments = activeWheel.segments;
    const winningIndex = Math.floor(Math.random() * segments.length);
    const winner = segments[winningIndex];
    const extraSpins = 4;
    const anglePerSegment = 360 / segments.length;
    const randomOffset = Math.random() * anglePerSegment;
    const targetRotation = extraSpins * 360 + winningIndex * anglePerSegment + randomOffset;

    setIsSpinning(true);
    setSelectedSegmentId(null);
    spinValue.setValue(0);

    Animated.timing(spinValue, {
      toValue: targetRotation,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsSpinning(false);
      setSelectedSegmentId(winner.id);
    });
  };

  const winnerLabel = useMemo(() => {
    if (!activeWheel || !selectedSegmentId) return '';
    const segment = activeWheel.segments.find((seg) => seg.id === selectedSegmentId);
    return segment?.label || '';
  }, [activeWheel, selectedSegmentId]);

  if (!activeWheel) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Create a wheel to get started.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={addWheel}>
          <Text style={styles.primaryButtonText}>Add Wheel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fortune Flip</Text>
      <ScrollView horizontal contentContainerStyle={styles.wheelSelector}>
        {wheels.map((wheel) => (
          <TouchableOpacity
            key={wheel.id}
            style={[
              styles.wheelChip,
              wheel.id === activeWheelId && styles.activeWheelChip,
            ]}
            onPress={() => {
              setActiveWheelId(wheel.id);
              setSelectedSegmentId(null);
            }}
            onLongPress={() => deleteWheel(wheel.id)}
          >
            <Text
              style={[
                styles.wheelChipText,
                wheel.id === activeWheelId && styles.activeWheelChipText,
              ]}
            >
              {wheel.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addWheelChip} onPress={addWheel}>
          <Text style={styles.addWheelText}>+ Wheel</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.section}>
        <Text style={styles.label}>Active wheel name</Text>
        <TextInput
          value={activeWheel.name}
          onChangeText={renameWheel}
          style={styles.input}
        />
      </View>

      <WheelCanvas
        segments={activeWheel.segments}
        selectedSegmentId={selectedSegmentId}
        spinAnimatedValue={spinValue}
      />

      <View style={styles.winnerContainer}>
        <Text style={styles.label}>Winner</Text>
        <Text style={styles.winnerText}>
          {winnerLabel ? winnerLabel : 'Tap spin to choose a segment'}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.segmentHeader}>
          <Text style={styles.label}>Segments</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={addSegment}>
            <Text style={styles.secondaryButtonText}>+ Segment</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.segmentList}>
          {activeWheel.segments.map((segment) => (
            <View key={segment.id} style={styles.segmentRow}>
              <TextInput
                style={styles.segmentInput}
                value={segment.label}
                onChangeText={(text) => updateSegmentLabel(segment.id, text)}
              />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteSegment(segment.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isSpinning && styles.disabledButton]}
        onPress={spinWheel}
        disabled={isSpinning}
      >
        <Text style={styles.primaryButtonText}>{isSpinning ? 'Spinning…' : 'Spin Wheel'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F0F0F0',
    textAlign: 'center',
    marginBottom: 12,
  },
  wheelSelector: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  wheelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C2541',
    marginRight: 8,
  },
  activeWheelChip: {
    backgroundColor: '#5BC0BE',
  },
  wheelChipText: {
    color: '#F0F0F0',
    fontWeight: '600',
  },
  activeWheelChipText: {
    color: '#0B132B',
  },
  addWheelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#5BC0BE',
  },
  addWheelText: {
    color: '#5BC0BE',
    fontWeight: '600',
  },
  section: {
    marginVertical: 12,
  },
  label: {
    color: '#9FB3C8',
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1C2541',
    borderRadius: 8,
    padding: 10,
    color: '#F0F0F0',
    fontSize: 16,
  },
  wheelWrapper: {
    alignSelf: 'center',
    marginVertical: 12,
  },
  pointer: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFD166',
  },
  winnerContainer: {
    alignItems: 'center',
    marginVertical: 6,
  },
  winnerText: {
    fontSize: 20,
    color: '#FFD166',
    fontWeight: '700',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#5BC0BE',
  },
  secondaryButtonText: {
    color: '#0B132B',
    fontWeight: '700',
  },
  segmentList: {
    maxHeight: 200,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2541',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  segmentInput: {
    flex: 1,
    color: '#F0F0F0',
    fontSize: 16,
  },
  deleteButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EF476F',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 'auto',
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#EF476F',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 16,
  },
});

export default App;
