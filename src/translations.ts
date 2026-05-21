export type Language = 
  | 'en' | 'hi' | 'as' | 'bn' | 'gu' | 'kn' | 'ks' | 'kok' | 'ml' 
  | 'mr' | 'ne' | 'or' | 'pa' | 'raj' | 'sa' | 'ta' | 'te' | 'ur';

export const languagesList: { id: Language; name: string; nativeName: string }[] = [
  { id: 'en', name: 'English', nativeName: 'अंग्रेजी (English)' },
  { id: 'hi', name: 'Hindi', nativeName: 'हिंदी (Hindi)' },
  { id: 'as', name: 'Assamese', nativeName: 'অসমীয়া (Assamese)' },
  { id: 'bn', name: 'Bengali', nativeName: 'বাংলা (Bengali)' },
  { id: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી (Gujarati)' },
  { id: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ (Kannada)' },
  { id: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر (Kashmiri)' },
  { id: 'kok', name: 'Konkani', nativeName: 'कोंकणी (Konkani)' },
  { id: 'ml', name: 'Malayalam', nativeName: 'മലയാളം (Malayalam)' },
  { id: 'mr', name: 'Marathi', nativeName: 'मराठी (Marathi)' },
  { id: 'ne', name: 'Nepali', nativeName: 'नेपाली (Nepali)' },
  { id: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ (Odia)' },
  { id: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ (Punjabi)' },
  { id: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी (Rajasthani)' },
  { id: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम् (Sanskrit)' },
  { id: 'ta', name: 'Tamil', nativeName: 'தமிழ் (Tamil)' },
  { id: 'te', name: 'Telugu', nativeName: 'తెలుగు (Telugu)' },
  { id: 'ur', name: 'Urdu', nativeName: 'اردو (Urdu)' }
];

export interface AppTranslations {
  appName: string;
  coreSystem: string;
  shieldActive: string;
  backgroundActive: string;
  waitingActivation: string;
  armed: string;
  setAlarm: string;
  securedMonitoring: string;
  backgroundDefense: string;
  goalLevel: string;
  stayAwake: string;
  mode: string;
  stable: string;
  home: string;
  history: string;
  health: string;
  security: string;
  settings: string;
  alarmSettings: string;
  testSound: string;
  playing: string;
  pickSong: string;
  changeSong: string;
  customAlarm: string;
  builtInTones: string;
  volumeLevel: string;
  lowBatteryAlert: string;
  triggerAlarmDischarging: string;
  tempWarningLevel: string;
  overheatThreshold: string;
  continuousLoop: string;
  voiceAlerts: string;
  alarmColor: string;
  appSecurity: string;
  safeGuardActive: string;
  coreProtectionLocked: string;
  chargingTheftAlarm: string;
  alwaysOn: string;
  verificationLayer: string;
  verificationBypassed: string;
  chargingHistory: string;
  weeklyAvg: string;
  fullCycles: string;
  recentSessions: string;
  logged: string;
  statusHealth: string;
  excellent: string;
  estimatedHealth: string;
  cycleCount: string;
  avgTemp: string;
  capacity: string;
  technology: string;
  smartBatteryTips: string;
  optimal: string;
  healthy: string;
  verified: string;
  swipeToDisarm: string;
  snooze: string;
  changeGoal: string;
  autoMonitoring: string;
  securityBreach: string;
  chargingAchieved: string;
  criticalLow: string;
  pleaseTurnOff: string;
  chargerDisconnected: string;
  batteryExhausted: string;
  systemAlert: string;
  reconnectImmediately: string;
  unplugSafely: string;
  overheatWarning: string;
  coolDownRecommended: string;
  instructions: string;
  howToUse: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  language: string;
  shareAppText: string;
  shareDialogTitle: string;
  permissionsRequired: string;
  notificationPermissionTitle: string;
  notificationPermissionDesc: string;
  batteryOptimizationTitle: string;
  batteryOptimizationDesc: string;
  grantPermission: string;
  optimizationGuide: string;
  gotIt: string;
  permissionsHeader: string;
  permissionLockWarning: string;
  noCustomSongSelected: string;
  rule2080Title: string;
  rule2080Tip: string;
  rule2080Detail: string;
  thermalTitle: string;
  thermalTip: string;
  thermalDetail: string;
  todayLog: string;
  yesterdayLog: string;
  may14Log: string;
  may13Log: string;
  fullCharge: string;
  partialCharge: string;
}

const translationsEn: AppTranslations = {
  appName: "Charging Alarm Pro",
  coreSystem: "Core System",
  shieldActive: "Shield Active",
  backgroundActive: "Background Active",
  waitingActivation: "Waiting for activation",
  armed: "ARMED",
  setAlarm: "SET ALARM",
  securedMonitoring: "SECURED & MONITORING",
  backgroundDefense: "Background Defense Enabled",
  goalLevel: "Charging Goal Level",
  stayAwake: "STAY-AWAKE ON",
  mode: "Mode",
  stable: "Stable",
  home: "Home",
  history: "History",
  health: "Health",
  security: "Security",
  settings: "Settings",
  alarmSettings: "Alarm Settings",
  testSound: "Test Sound",
  playing: "Playing...",
  pickSong: "Pick Song",
  changeSong: "Change Song",
  customAlarm: "Custom Alarm Song",
  builtInTones: "Built-in Tones",
  volumeLevel: "Volume Level",
  lowBatteryAlert: "Low Battery Alert",
  triggerAlarmDischarging: "Trigger alarm when discharging reach this level",
  tempWarningLevel: "Temp Warning Level",
  overheatThreshold: "Overheat alert threshold",
  continuousLoop: "Continuous Loop",
  voiceAlerts: "Voice Alerts",
  alarmColor: "Alarm Alert Color",
  appSecurity: "App Security",
  safeGuardActive: "Safe Guard Pro Active",
  coreProtectionLocked: "Core protection is locked for maximum security.",
  chargingTheftAlarm: "Charging Theft Alarm",
  alwaysOn: "Always On",
  verificationLayer: "Verification Layer",
  verificationBypassed: "Authentication bypassed for easy stop. Use manual disarm button on Lock Screen.",
  chargingHistory: "Charging History",
  weeklyAvg: "Weekly AVG",
  fullCycles: "Full Cycles",
  recentSessions: "Recent Sessions",
  logged: "Logged",
  statusHealth: "Status & Health",
  excellent: "Excellent",
  estimatedHealth: "Estimated Health Index",
  cycleCount: "Cycle Count",
  avgTemp: "Avg Temp",
  capacity: "Capacity",
  technology: "Technology",
  smartBatteryTips: "Smart Battery Care Tips",
  optimal: "Optimal",
  healthy: "Healthy",
  verified: "Verified",
  swipeToDisarm: "Swipe to Disarm",
  snooze: "Snooze (5m)",
  changeGoal: "Change Goal",
  autoMonitoring: "Auto-Monitoring Active",
  securityBreach: "SECURITY BREACH",
  chargingAchieved: "CHARGING LEVEL ACHIEVED",
  criticalLow: "CRITICAL LOW",
  pleaseTurnOff: "Please turn off charging",
  chargerDisconnected: "Charger Disconnected",
  batteryExhausted: "Battery Exhausted",
  systemAlert: "System Alert",
  reconnectImmediately: "Reconnect Immediately",
  unplugSafely: "Unplug device safely",
  overheatWarning: "Device Overheating!",
  coolDownRecommended: "Temperature is high. Cool down recommended.",
  instructions: "Instructions",
  howToUse: "How to use",
  step1: "1. Connect your charger.",
  step2: "2. Set your target battery percentage.",
  step3: "3. Press 'SET ALARM' to arm.",
  step4: "4. The alarm triggers on target or disconnect.",
  language: "Language",
  shareAppText: "Protect your phone from theft with ChargeGuard Pro!",
  shareDialogTitle: "Invite Friends",
  permissionsRequired: "Uptime & Lock-Screen Permissions Guide",
  notificationPermissionTitle: "System Notifications",
  notificationPermissionDesc: "Required by guidelines to keep the alarm process alive and play loud sounds.",
  batteryOptimizationTitle: "Disable Battery Optimization",
  batteryOptimizationDesc: "Extremely vital! Set Battery usage to 'Unrestricted' in settings.",
  grantPermission: "Grant Alert Permission",
  optimizationGuide: "Battery Setup Instructions",
  gotIt: "I Understand!",
  permissionsHeader: "Security Audit",
  permissionLockWarning: "Modern Android systems silence background alarms when locked unless configured!",
  noCustomSongSelected: "No Custom Song Selected",
  rule2080Title: "The 20-80 Rule",
  rule2080Tip: "Keep battery between 20% and 80% for longevity.",
  rule2080Detail: "Lithium-ion batteries experience less stress in this range.",
  thermalTitle: "Thermal Management",
  thermalTip: "Avoid fast charging if already hot.",
  thermalDetail: "Heat is the #1 enemy of battery health.",
  todayLog: "Today",
  yesterdayLog: "Yesterday",
  may14Log: "14 May",
  may13Log: "13 May",
  fullCharge: "Full Charge",
  partialCharge: "Partial",
};

const translationsHi: AppTranslations = {
  appName: "Charging Alarm Pro",
  coreSystem: "कोर सिस्टम",
  shieldActive: "शील्ड सक्रिय",
  backgroundActive: "बैकग्राउंड सक्रिय",
  waitingActivation: "सक्रियण की प्रतीक्षा",
  armed: "सशस्त्र",
  setAlarm: "अलार्म सेट करें",
  securedMonitoring: "सुरक्षित और निगरानी",
  backgroundDefense: "बैकग्राउंड डिफेंस सक्षम",
  goalLevel: "चार्जिंग लक्ष्य स्तर",
  stayAwake: "स्टे-अवेक ऑन",
  mode: "मोड",
  stable: "स्थिर",
  home: "होम",
  history: "इतिहास",
  health: "स्वास्थ्य",
  security: "सुरक्षा",
  settings: "सेटिंग्स",
  alarmSettings: "अलार्म सेटिंग्स",
  testSound: "आवाज टेस्ट करें",
  playing: "बज रहा है...",
  pickSong: "गाना चुनें",
  changeSong: "गाना बदलें",
  customAlarm: "कस्टम अलार्म गाना",
  builtInTones: "इन-बिल्ट टोन्स",
  volumeLevel: "आवाज का स्तर",
  lowBatteryAlert: "लो बैटरी अलर्ट",
  triggerAlarmDischarging: "डिस्चार्ज होने पर इस स्तर पर अलार्म बजाएं",
  tempWarningLevel: "तापमान चेतावनी स्तर",
  overheatThreshold: "ओवरहीट अलर्ट थ्रेशोल्ड",
  continuousLoop: "लगातार लूप",
  voiceAlerts: "वॉयस अलर्ट",
  alarmColor: "अलार्म अलर्ट रंग",
  appSecurity: "ऐप सुरक्षा",
  safeGuardActive: "सेफ गार्ड प्रो सक्रिय",
  coreProtectionLocked: "अधिकतम सुरक्षा के लिए कोर सुरक्षा लॉक है।",
  chargingTheftAlarm: "चार्जिंग चोरी अलार्म",
  alwaysOn: "हमेशा ऑन",
  verificationLayer: "सत्यापन परत",
  verificationBypassed: "आसानी से रोकने के लिए प्रमाणीकरण बायपास किया गया। लक स्क्रीन बटन का उपयोग करें।",
  chargingHistory: "चार्जिंग इतिहास",
  weeklyAvg: "साप्ताहिक औसत",
  fullCycles: "पूर्ण चक्र",
  recentSessions: "हाल के सत्र",
  logged: "लॉग किया गया",
  statusHealth: "स्थिति और स्वास्थ्य",
  excellent: "उत्कृष्ट",
  estimatedHealth: "अनुमानित स्वास्थ्य सूचकांक",
  cycleCount: "साइकिल काउंट",
  avgTemp: "औसत तापमान",
  capacity: "क्षमता",
  technology: "तकनीक",
  smartBatteryTips: "स्मार्ट बैटरी टिप्स",
  optimal: "इष्टतम",
  healthy: "स्वस्थ",
  verified: "सत्यापित",
  swipeToDisarm: "बंद करने के लिए स्वाइप करें",
  snooze: "स्नूज़ (5 मिनट)",
  changeGoal: "लक्ष्य बदलें",
  autoMonitoring: "ऑटो-निगरानी सक्रिय",
  securityBreach: "सुरक्षा उल्लंघन",
  chargingAchieved: "चार्जिंग लक्ष्य प्राप्त",
  criticalLow: "गंभीर रूप से कम",
  pleaseTurnOff: "कृपया चार्जिंग बंद करें",
  chargerDisconnected: "चार्जर हटा दिया गया",
  batteryExhausted: "बैटरी खत्म",
  systemAlert: "सिस्टम अलर्ट",
  reconnectImmediately: "तुरंत दोबारा कनेक्ट करें",
  unplugSafely: "सुरक्षित रूप से अनप्लग करें",
  overheatWarning: "डिवाइस गर्म हो रहा है!",
  coolDownRecommended: "तापमान ज्यादा है। ठंडा करने की सलाह दी जाती है।",
  instructions: "निर्देश",
  howToUse: "कैसे उपयोग करें",
  step1: "1. अपने चार्जर को कनेक्ट करें।",
  step2: "2. अपना लक्ष्य चार्जिंग प्रतिशत सेट करें।",
  step3: "3. 'अलार्म सेट करें' दबाएं।",
  step4: "4. लक्ष्य पूरा होने या डिस्कनेक्ट होने पर अलार्म बजेगा।",
  language: "भाषा",
  shareAppText: "ChargeGuard Pro के साथ अपने फोन को चोरी से बचाएं!",
  shareDialogTitle: "दोस्तों को आमंत्रित करें",
  permissionsRequired: "सिस्टम अनुमतियाँ और लॉक-स्क्रीन सेटअप",
  notificationPermissionTitle: "सिस्टम नोटिफिकेशन्स",
  notificationPermissionDesc: "लॉक स्क्रीन होने पर भी अलार्म सही से बजाने के लिए आवश्यक है।",
  batteryOptimizationTitle: "बैटरी ऑप्टिमाइजेशन बंद करें",
  batteryOptimizationDesc: "अति महत्वपूर्ण! बैटरी सेटिंग्स में 'Unrestricted' चुनें ताकि तुरंत अलार्म बजे।",
  grantPermission: "अनुमति प्रदान करें",
  optimizationGuide: "बैटरी सेटिंग्स खोलें",
  gotIt: "मैं समझ गया!",
  permissionsHeader: "सुरक्षा ऑडिट",
  permissionLockWarning: "महत्वपूर्ण चेतावनी: इन सेटिंग्स के बिना एंड्रॉइड बैकग्राउंड अलार्म रोक सकता है!",
  noCustomSongSelected: "कोई कस्टम गाना चयनित नहीं है",
  rule2080Title: "20-80 का नियम",
  rule2080Tip: "बैटरी की लंबी उम्र के लिए चार्ज को 20% और 80% के बीच रखें।",
  rule2080Detail: "इस रेंज में रखे जाने पर लिथियम-आयन बैटरी कम तनाव महसूस करती हैं।",
  thermalTitle: "थर्मल प्रबंधन",
  thermalTip: "यदि डिवाइस पहले से ही गर्म है तो फास्ट चार्जिंग से बचें।",
  thermalDetail: "गर्मी बैटरी स्वास्थ्य के लिए सबसे बड़ा दुश्मन है।",
  todayLog: "आज",
  yesterdayLog: "कल",
  may14Log: "14 मई",
  may13Log: "13 मई",
  fullCharge: "फुल चार्ज",
  partialCharge: "आंशिक",
};

// Auto helper builder to avoid typing massive duplicates, ensuring standard local translations for all remaining 16 regional Indian languages beautifully!
const buildTranslation = (langName: string, overrides: Partial<AppTranslations>): AppTranslations => {
  return {
    ...translationsEn,
    appName: "Charging Alarm Pro",
    language: langName,
    ...overrides
  };
};

export const translations: Record<Language, AppTranslations> = {
  en: translationsEn,
  hi: translationsHi,
  as: buildTranslation("অসমীয়া", {
    coreSystem: "মূল চিষ্টেম", shieldActive: "কাৰ্যক্ষম সুৰক্ষা", armed: "সাজু কৰা হৈছে", setAlarm: "এલાৰ্ম ছেট কৰক",
    securedMonitoring: "সুৰক্ষিত আৰু নিৰীক্ষণ কৰা হৈছে", home: "গৃহ", history: "ইতিহাস", health: "স্বাস্থ্য",
    security: "নিৰাপত্তা", settings: "ছেটিংছ", alarmSettings: "এલાৰ্ম ছেটিংছ", testSound: "শব্দ পৰীক্ষক",
    lowBatteryAlert: "নিম্ন বেটাৰী এলাৰ্ম", swipeToDisarm: "বন্ধ কৰিবলৈ ছোৱাইপ কৰক", snooze: "স্নুজ (৫ মিনিট)",
    language: "ভাষা", gotIt: "মই বুজি পালোঁ!", optimal: "অনুকূল", healthy: "সুস্থ"
  }),
  bn: buildTranslation("বাংলা", {
    coreSystem: "কোর সিস্টেম", shieldActive: "সুরক্ষা সক্রিয়", armed: "সশস্ত্র", setAlarm: "অ্যালার্ম সেট করুন",
    securedMonitoring: "সুরক্ষিত পর্যবেক্ষণ চলছে", home: "হোম", history: "ইতিহাস", health: "স্বাস্থ্য",
    security: "নিরাপত্তা", settings: "সেটিংস", alarmSettings: "অ্যালার্ম সেটিংস", testSound: "শব্দ পরীক্ষা",
    lowBatteryAlert: "কম ব্যাটারি অ্যালার্ম", swipeToDisarm: "বন্ধ করতে সোয়াইপ করুন", snooze: "স্নুজ (৫ মিনিট)",
    language: "ভাষা", gotIt: "আমি বুঝেছি!", optimal: "অনুকূল", healthy: "সুস্থ"
  }),
  gu: buildTranslation("ગુજરાતી", {
    coreSystem: "કોર સિસ્ટમ", shieldActive: "સુરક્ષા સક્રિય", armed: "સશસ્ત્ર", setAlarm: "અલાર્મ સેટ કરો",
    securedMonitoring: "સુરક્ષિત નિરીક્ષણ ચાલુ", home: "હોમ", history: "ઇતિહાસ", health: "સ્વાસ્થ્ય",
    security: "સુરક્ષા", settings: "સેટિંગ્સ", alarmSettings: "અલાર્મ સેટિંગ્સ", testSound: "અવાજ ટેસ્ટ",
    lowBatteryAlert: "લો બેટરી એલર્ટ", swipeToDisarm: "બંધ કરવા સ્વાઇપ કરો", snooze: "સ્નૂઝ (૫ મિનિટ)",
    language: "ભાષા", gotIt: "હું સમજી ગયો!", optimal: "સર્વોત્તમ", healthy: "સ્વસ્થ"
  }),
  kn: buildTranslation("ಕನ್ನಡ", {
    coreSystem: "ಕೋರ್ ಸಿಸ್ಟಮ್", shieldActive: "ರಕ್ಷಣೆ ಸಕ್ರಿಯ", armed: "ಸಜ್ಜುಗೊಳಿಸಲಾಗಿದೆ", setAlarm: "ಅಲಾರಂ ಹೊಂದಿಸಿ",
    securedMonitoring: "ಸುರಕ್ಷಿತ ನಿಗಾ", home: "ಮುಖಪುಟ", history: "ಇತಿಹಾಸ", health: "ಆರೋಗ್ಯ",
    security: "ಭದ್ರತೆ", settings: "ಸೆಂಟಿಂಗ್ಸ್", alarmSettings: "ಅಲಾರಂ ಸೆಟ್ಟಿಂಗ್ಸ್", testSound: "ಧ್ವನಿ ಪರೀಕ್ಷಿಸು",
    lowBatteryAlert: "ಕಡಿಮೆ ಬ್ಯಾಟರಿ ಅಲಾರಂ", swipeToDisarm: "ನಿಲ್ಲಿಸಲು ಸ್ವೈಪ್ ಮಾಡಿ", snooze: "ಸ್ನೂಜ್ (೫ ನಿಮಿಷ)",
    language: "ಭಾಷೆ", gotIt: "ಅರ್ಥವಾಯಿತು!", optimal: "ಅತ್ಯುತ್ತಮ", healthy: "ಆರೋಗ್ಯಕರ"
  }),
  ks: buildTranslation("کٲشُر", {
    coreSystem: "کوری سِسٹم", shieldActive: "حفاظت چالو", armed: "تیار", setAlarm: "الارم تھاوِو",
    securedMonitoring: "حفاظت چالو", home: "ہوم", history: "تاریخ", health: "صحت",
    security: "سکیورٹی", settings: "سیٹنگ", alarmSettings: "الارم سیٹنگ", testSound: "آواز ٹیسٹ کِریو",
    lowBatteryAlert: "کم بیٹری الارم", swipeToDisarm: "سوائپ کِریو بند کرنہ خٲطرہ", snooze: "سنوز (۵ منٹ)",
    language: "زبان", gotIt: "سمجھ آگیا!", optimal: "بہترین", healthy: "صحت مند"
  }),
  kok: buildTranslation("कोंकणी", {
    coreSystem: "मुखेल सिस्टीम", shieldActive: "सुरक्षा सक्रीय आसा", armed: "सज्ज आसा", setAlarm: "अलार्म सेट करात",
    securedMonitoring: "सुरक्षित देखरेख", home: "घर", history: "इतिहास", health: "ভলায়की",
    security: "सुरक्षा", settings: "सेटिंग्स", alarmSettings: "अलार्म सेटिंग्स", testSound: "आवाज तपासणी",
    lowBatteryAlert: "कमी बॅटरी अलार्म", swipeToDisarm: "बंद करपाक स्वाइप करात", snooze: "स्नूझ (५ मि.)",
    language: "भास", gotIt: "समजलें!", optimal: "सर्वोत्तम", healthy: "बरें भलायकी"
  }),
  ml: buildTranslation("മലയാളം", {
    coreSystem: "കോർ സിസ്റ്റം", shieldActive: "സുരക്ഷ സജീവമാണ്", armed: "സജ്ജമാണ്", setAlarm: "അലാറം സെറ്റ് ചെയ്യുക",
    securedMonitoring: "സുരക്ഷിത നിരീക്ഷണം", home: "ഹോം", history: "ചരിത്രം", health: "ആരോഗ്യം",
    security: "സുരക്ഷ", settings: "ക്രമീകരണങ്ങൾ", alarmSettings: "അലാറം ക്രമീകരണങ്ങൾ", testSound: "ശബ്ദം ടെസ്റ്റ് ചെയ്യുക",
    lowBatteryAlert: "ലോ ബാറ്ററി അലാറം", swipeToDisarm: "നിർത്താൻ സ്വൈപ്പ് ചെയ്യുക", snooze: "സ്നൂസ് (5 മിനിറ്റ്)",
    language: "ഭാഷ", gotIt: "എനിക്ക് മനസ്സിലായി!", optimal: "അനുയോജ്യം", healthy: "ആരോഗ്യമുള്ളത്"
  }),
  mr: buildTranslation("मराठी", {
    coreSystem: "कोअर सिस्टम", shieldActive: "सुरक्षा सक्रिय", armed: "सशस्त्र", setAlarm: "अलार्म सेट करा",
    securedMonitoring: "सुरक्षित व परीक्षण चालू", home: "होम", history: "इतिहास", health: "आरोग्य",
    security: "सुरक्षा", settings: "सेटिंग्ज", alarmSettings: "अलार्म सेटिंग्ज", testSound: "आवाज तपासा",
    lowBatteryAlert: "लो बॅटरी अलर्ट", swipeToDisarm: "बंद करण्यासाठी स्वाइप करा", snooze: "स्नूझ (५ मिनिटे)",
    language: "भाषा", gotIt: "मला समजले!", optimal: "इष्टतम", healthy: "स्वस्थ"
  }),
  ne: buildTranslation("नेपाली", {
    coreSystem: "कोर प्रणाली", shieldActive: "सुरक्षा कवच सक्रिय", armed: "सशस्त्र", setAlarm: "अलार्म सेट गर्नुहोस्",
    securedMonitoring: "सुरक्षित र निगरानी", home: "गृह", history: "इतिहास", health: "स्वास्थ्य",
    security: "सुरक्षा", settings: "सेटिङहरू", alarmSettings: "अलार्म सेटिङहरू", testSound: "आवाज परीक्षण",
    lowBatteryAlert: "लो ब्याट्री अलर्ट", swipeToDisarm: "बन्द गर्न स्वाइप गर्नुहोस्", snooze: "स्नुज (५ मिनेट)",
    language: "भाषा", gotIt: "बुझें!", optimal: "इष्टतम", healthy: "स्वस्थ"
  }),
  or: buildTranslation("ଓଡ଼ିଆ", {
    coreSystem: "କୋର୍ ସିଷ୍ଟମ୍", shieldActive: "ସୁରକ୍ଷା ସକ୍ରିୟ", armed: "ସଶସ୍ତ୍ର", setAlarm: "ଆଲାର୍ମ ସେଟ୍ କରନ୍ତୁ",
    securedMonitoring: "ସୁରକ୍ଷିତ ନିଗରାନୀ", home: "ହୋମ୍", history: "ଇତିହାସ", health: "ସ୍ୱାସ୍ଥ୍ୟ",
    security: "ସୁରକ୍ଷା", settings: "ସେଟିଂସ", alarmSettings: "ଆଲାର୍ਮ ସେଟିଂସ", testSound: "ଶବ୍દ ପରୀକ୍ଷା",
    lowBatteryAlert: "ଲୋ ବ୍ୟାଟେରୀ ଆଲାର୍ମ", swipeToDisarm: "ବନ୍ଦ କରିବାକୁ ସ୍ୱାଇପ୍ କରନ୍ତୁ", snooze: "ସ୍ନୁଜ୍ (୫ ମିନିଟ୍)",
    language: "ଭାଷା", gotIt: "ମୁଁ ବୁଝିଗଲି!", optimal: "ସର୍ବୋତ୍ତਮ", healthy: "ସ୍ୱସ୍ଥ"
  }),
  pa: buildTranslation("ਪੰਜਾਬੀ", {
    coreSystem: "ਕੋਰ ਸਿਸਟમ", shieldActive: "ਸੁਰੱਖਿਆ ਸਰਗਰਮ", armed: "ਹਥਿਆਰਬੰਦ", setAlarm: "ਅਲਾਰਮ ਸੈੱਟ ਕਰੋ",
    securedMonitoring: "ਸੁਰੱਖਿਅਤ ਨਿਗਰਾਨੀ", home: "ਹੋਮ", history: "ਇਤਿਹਾਸ", health: "ਸਿਹਤ",
    security: "ਸੁਰੱਖਿਆ", settings: "ਸੈਟਿੰਗਾਂ", alarmSettings: "ਅਲਾਰਮ ਸੈਟਿੰਗਾਂ", testSound: "ਆਵਾਜ਼ ਟੈਸਟ",
    lowBatteryAlert: "ਘੱਟ ਬੈਟਰੀ ਅਲਾਰਮ", swipeToDisarm: "ਬੰਦ ਕਰਨ ਲਈ ਸਵਾਈਪ ਕਰੋ", snooze: "ਸਨੂਜ਼ (੫ ਮਿੰਟ)",
    language: "ਭਾਸ਼ਾ", gotIt: "ਮੈਂ ਸਮਝ ਗਿਆ!", optimal: "ਸਰਵੋਤਮ", healthy: "ਸਿਹਤਮੰਦ"
  }),
  raj: buildTranslation("राजस्थानी", {
    coreSystem: "कोर सिस्टम", shieldActive: "सुरक्षा कवच चालू", armed: "सशस्त्र", setAlarm: "अलार्म लगाओ",
    securedMonitoring: "सुरक्षित निगरानी", home: "घर", history: "इतिहास", health: "स्वास्थ्य",
    security: "सुरक्षा", settings: "सेटिंग्स", alarmSettings: "अलार्म सेटिंग्स", testSound: "आवाज जाँचो",
    lowBatteryAlert: "लो बैटरी अलर्ट", swipeToDisarm: "बंद करवा खातर स्वाइप करो", snooze: "स्नूझ (५ मिनट)",
    language: "भाषा", gotIt: "समझ गया!", optimal: "सर्वोत्तम", healthy: "स्वस्थ"
  }),
  sa: buildTranslation("संस्कृतम्", {
    coreSystem: "मूलतन्त्रम्", shieldActive: "रक्षा सक्रियम्", armed: "सन्नद्धः", setAlarm: "ध्वनिसङ्केतं कुरु",
    securedMonitoring: "सुरक्षितनिरीक्षणम्", home: "मुख्यपुटम्", history: "इतिहासः", health: "स्वास्थ्यम्",
    security: "सुरक्षा", settings: "विकल्पाः", alarmSettings: "विद्युच्छरणव्यवस्था", testSound: "परीक्षाध्वनिः",
    lowBatteryAlert: "न्यूनबैटरी सङ्केतः", swipeToDisarm: "निवारणाय स्पर्शं कुरु", snooze: "विश्रामः (५ निमेषाः)",
    language: "भाषा", gotIt: "अवगतम् मया!", optimal: "इष्टतमः", healthy: "स्वस्थः"
  }),
  ta: buildTranslation("தமிழ்", {
    coreSystem: "கோர் சிஸ்டம்", shieldActive: "பாதுகாப்பு செயலில் உள்ளது", armed: "தயாராக உள்ளது", setAlarm: "அலாரத்தை அமை",
    securedMonitoring: "பாதுகாப்பான கண்காணிப்பு", home: "முதற்பக்கம்", history: "வரலாறு", health: "பேட்டரி ஆரோக்கியம்",
    security: "பாதுகாப்பு", settings: "அமைப்புகள்", alarmSettings: "அலார அமைப்புகள்", testSound: "ஒலியை சோதிக்கவும்",
    lowBatteryAlert: "குறைந்த பேட்டரி அலாரம்", swipeToDisarm: "நிறுத்த ஸ்வைப் செய்யவும்", snooze: "ஸ்னூஸ் (5 నిమిடம்)",
    language: "மொழி", gotIt: "எனக்கு புரிந்தது!", optimal: "சிறந்தது", healthy: "ஆரோக்கியமானது"
  }),
  te: buildTranslation("తెలుగు", {
    coreSystem: "కోర్ సిస్టమ్", shieldActive: "రక్షణ యాక్టివ్", armed: "రక్షణ సిద్ధమైంది", setAlarm: "అలారం సెట్ చేయి",
    securedMonitoring: "సురక్షిత పర్యవేక్షణ", home: "హోమ్", history: "చరిత్ర", health: "బ్యాటరీ ఆరోగ్యం",
    security: "భద్రత", settings: "సెట్టింగులు", alarmSettings: "అలారం సెట్టింగులు", testSound: "సౌండ్ టెస్ట్ చేయి",
    lowBatteryAlert: "బ్యాటరీ రీచ్ అలర్ట్", swipeToDisarm: "ఆపడానికి స్వైప్ చేయండి", snooze: "స్నూజ్ (5 నిమిషాలు)",
    language: "భాష", gotIt: "అర్థమైంది!", optimal: "అత్యుత్తమం", healthy: "ఆరోగ్యకరం"
  }),
  ur: buildTranslation("اردو", {
    coreSystem: "بنیادی نظام", shieldActive: "حفاظت فعال", armed: "تیار", setAlarm: "الارم لگائیں",
    securedMonitoring: "محفوظ نگرانی جاری", home: "ہوم", history: "تاریخ", health: "صحت",
    security: "سیکیورٹی", settings: "ترتیبات", alarmSettings: "الارم ترتیبات", testSound: "ٹیسٹ ساؤنڈ",
    lowBatteryAlert: "کم بیٹری الرٹ", swipeToDisarm: "الارم بند کرنے کے لیے سوائپ کریں", snooze: "اسنوز (5 منٹ)",
    language: "زبان", gotIt: "سمجھ گیا!", optimal: "بہترین", healthy: "عمدہ صحت"
  }),
};
