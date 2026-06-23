import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spigens.app',
  appName: 'Spigens',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
