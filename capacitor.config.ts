import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spigens.app',
  appName: 'ChatApp',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
