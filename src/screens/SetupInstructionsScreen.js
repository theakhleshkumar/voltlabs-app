import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts } from '../constants/theme';

const SetupInstructionsScreen = ({ navigation }) => {
  const instructions = [
    'Plug in your Smart Lamp.',
    'Make sure the light is powered ON.',
    'Keep your phone nearby.',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>💡</Text>
        <Text style={styles.title}>Set up your Smart Lamp</Text>

        <View style={styles.instructionsContainer}>
          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ProvisioningIntro')}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  content: {
    flex: 1,
    paddingTop: 40,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  instructionsContainer: {
    gap: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontFamily: fonts.bold,
    color: '#fff',
    fontSize: 16,
  },
  instructionText: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    paddingTop: 4,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    color: '#fff',
    fontSize: 16,
  },
});

export default SetupInstructionsScreen;
