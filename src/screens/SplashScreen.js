import React, { useEffect } from 'react';
import { View, Image, StyleSheet, BackHandler } from 'react-native';

const SplashScreen = () => {
  useEffect(() => {
    // Block hardware back button while the app checks auth state
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    );

    return () => backHandler.remove();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/volt_labs_composite_logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logo: {
    width: 200,
    height: 200,
  },
});

export default SplashScreen;
