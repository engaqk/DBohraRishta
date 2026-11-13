import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.dbohrarishta.app',
  appName: '53DBohraRishta',
  webDir: 'public',
  server: {
    url: 'https://53dbohrarishta.in',
    cleartext: false,
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#881337',
      style: 'DARK'
    }
  }
};

export default config;
