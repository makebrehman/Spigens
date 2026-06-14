import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatapp.dev',
  appName: 'ChatApp',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
