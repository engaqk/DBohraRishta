import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.dbohrarishta.app',
  appName: '53DBohraRishta',
  webDir: 'public',
  server: {
    url: 'https://53dbohrarishta.in',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      '53dbohrarishta.in',
      '*.53dbohrarishta.in',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.firebaseapp.com'
    ]
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#881337',
      style: 'DARK'
    }
  }
};

export default config;
