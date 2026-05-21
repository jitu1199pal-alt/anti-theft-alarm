# PRIVACY POLICY (गोपनीयता नीति)
**Effective Date:** May 21, 2026
**App Name:** ChargeGuard Pro Anti-Theft

---

## ENGLISH VERSION

Welcome to **ChargeGuard Pro Anti-Theft**. We respect your privacy and are committed to protecting it. This Privacy Policy describes how we collect, use, and handle information within the application.

Our app is fully functional client-side, designed to secure your mobile phone against theft and manage charging optimization intelligently. By using the app, you agree to the practices outlined below.

### 1. Information Collection & Use
We believe in absolute data minimalism. Here is what we do and do not collect:
- **No Personal Identifiable Information (PII):** We do NOT collect or store your name, email address, physical address, phone number, location, or contacts.
- **Local Device Storage:** All application configs (such as trigger charging percentages, temperature thresholds, custom alarm sounds, and disarm PIN/Patterns) are recorded and saved strictly in your device's private local storage (Sandboxed Context). They never leave your device.
- **Charging Cycles & Logs:** Session histories, duration, and cycle count data are processed and maintained fully locally. No personal charging metrics are uploaded.
- **Anonymous Authentication:** Our application integrates Firebase services matching secure anonymous identifiers. This authentication is initialized solely to maintain reliable security handshakes and settings references. It does NOT associate with your real identity.

### 2. Sensitive Device Permissions
To provide real-time anti-theft alarms and battery safety controls, our app utilizes specialized Android hardware system permissions. Here is why we need them:

| Permission | Type | Purpose & How it works |
| :--- | :--- | :--- |
| **FOREGROUND_SERVICE & SPECIAL_USE** | Critical | Keeps the active Charge Guard protection awake in the background. It monitors charger disconnection (anti-theft) and thermal status in real-time, even when the screen is locked, and sounds the alarm instantly if the cable is pulled. |
| **SYSTEM_ALERT_WINDOW** | Critical | Enables drawing the secure disarm keypad screen over other apps and the lock screen. This prevents an unauthorized user or thief from easily dismissing the alarm or exiting our app. |
| **USE_FULL_SCREEN_INTENT** | Critical | Triggers the fullscreen disarm overlay immediately when a security breach occurs, ignoring sleeping states. |
| **WAKE_LOCK** | Normal | Prevents the phone's CPU from entering deep sleep so the charger status can be surveyed constantly, ensuring instantaneous response. |
| **RECEIVE_BOOT_COMPLETED** | Normal | Automatically restarts the background protection service when your device finishes rebooting, so your device remains secure. |
| **DISABLE_KEYGUARD** | Sensitive | Allows our app to temporarily bypass standard keyguards when an alert fires so the disarm PIN pad can be entered without sliding hassles. |
| **VIBRATE** | Normal | Generates rapid physical alerts alongside loud alarm audio frequencies when a theft event occurs. |
| **POST_NOTIFICATIONS** | Normal | Shows a sticky foreground notification in your status bar indicating active security mode and enabling immediate access to disarm settings. |

### 3. Advertising and Third-Party Services
To offer this utility free of charge, our application includes ad monetization via Google AdSense/AdMob. These third-party networks may use non-sensitive device parameters, installation metrics, and unique mobile advertising identifiers (like Google Advertising ID - AAID) to present contextual or personalized ads. These identifiers are governed entirely under Google Partner Policies.

### 4. Data Security
We implement strict measures to protect your local configurations. Because your data doesn't exit your local hardware boundaries, the security of your disarm PIN depends on you keeping it secret from secondary users.

### 5. Children's Privacy
Our app does not target, collect, or store any information from children under the age of 13. Since we do not collect personal profiles whatsoever, we are in complete compliance with COPPA regulations.

### 6. Contact Us
If you have any questions or feedback regarding our Privacy Policy or app security, please reach out to us at:
- **Email:** jitu1199pal@gmail.com

---

## हिंदी संस्करण (HINDI VERSION)

**चार्जगार्ड प्रो एंटी-थेफ्ट (ChargeGuard Pro Anti-Theft)** में आपका स्वागत है। हम आपकी गोपनीयता का सम्मान करते हैं और इसे सुरक्षित रखने के लिए पूरी तरह प्रतिबद्ध हैं। यह गोपनीयता नीति (Privacy Policy) बताती है कि हम एप्लिकेशन के भीतर आपकी जानकारी को कैसे संभालते हैं।

हमारा ऐप मुख्य रूप से आपके डिवाइस के स्तर पर (Client-side) काम करता है। यह आपके फ़ोन को चोरी से बचाने और चार्जिंग को सुरक्षित रूप से अनुकूलित करने के लिए डिज़ाइन किया गया है। ऐप का उपयोग करके, आप इस नीति में वर्णित शर्तों से सहमत होते हैं।

### 1. डेटा का संग्रह और उपयोग
हम न्यूनतम डेटा उपयोग में विश्वास करते हैं। हम क्या एकत्र करते हैं और क्या नहीं, इसकी सूची नीचे दी गई है:
- **कोई व्यक्तिगत जानकारी नहीं (No Personal Information):** हम आपका नाम, ईमेल पता, शारीरिक पता, फ़ोन नंबर, संपर्क (Contacts) या आपकी वास्तविक लोकेशन (Location) का संग्रह बिल्कुल नहीं करते हैं।
- **स्थानीय डिवाइस स्टोरेज (Local Storage):** एप्लिकेशन से जुड़े सभी सेटिंग्स (जैसे चार्ज प्रतिशत अलर्ट, तापमान की चेतावनी सीमा, चुनी गई अलार्म ध्वनि, और अलार्म बंद करने का PIN/Pattern) आपके फ़ोन के सुरक्षित स्थानीय स्टोरेज में संचित किए जाते हैं। ये विवरण आपके फ़ोन से बाहर कभी नहीं भेजे जाते।
- **चार्जिंग साइकिल और इतिहास:** आपके चार्जिंग इतिहास और चक्रों की गणना केवल स्थानीय स्तर पर की जाती है।
- **अनाम प्रमाणीकरण (Anonymous Auth):** हमारा ऐप सुरक्षित अनाम पहचानकर्ताओं (Anonymous Tokens) के माध्यम से फायरबेस से जुड़ता है। इसका उद्देश्य केवल विश्वसनीय सुरक्षा तालमेल बनाए रखना है। यह आपके वास्तविक जीवन की पहचान से नहीं जुड़ता।

### 2. डिवाइस की संवेदनशील अनुमतियाँ (Device Permissions)
डिवाइस की चोरी और बैटरी ओवरहीटिंग की वास्तविक समय में निगरानी करने के लिए ऐप को विशेष एंड्रॉइड अनुमतियों की आवश्यकता होती है। इनका कार्य इस प्रकार है:

| अनुमति (Permission) | प्रकार | उद्देश्य और कार्यप्रणाली |
| :--- | :--- | :--- |
| **FOREGROUND_SERVICE & SPECIAL_USE** | महत्वपूर्ण | चार्ज सुरक्षा निगरानी (Charge Guard) को बैकग्राउंड में चालू रखता है। यदि स्क्रीन लॉक होने या ऐप बंद होने पर चार्जर अचानक अनप्लग किया जाता है, तो यह तुरंत अलार्म बजाने का आदेश देता है। |
| **SYSTEM_ALERT_WINDOW** | महत्वपूर्ण | ऐप को अन्य ऐप्स और लॉकस्क्रीन के ऊपर अलार्म का PIN/Pattern कीपैड दिखाने की अनुमति देता है। इससे कोई अवांछित व्यक्ति या चोर सीधे फ़ोन बंद या ऐप को एग्जिट नहीं कर पाता। |
| **USE_FULL_SCREEN_INTENT** | महत्वपूर्ण | डिवाइस के सोने की स्थिति में भी संवेदनशील अलार्म ट्रिगर होने पर पूर्ण स्क्रीन पर तुरंत disarm overlay स्क्रीन खोल देता है। |
| **WAKE_LOCK** | सामान्य | फ़ोन के प्रोसेसर को गहरी नींद (Deep Sleep) में जाने से रोकता है ताकि चार्जर कनेक्शन की स्थिति पर हर पल कड़ी नज़र रखी जा सके। |
| **RECEIVE_BOOT_COMPLETED** | सामान्य | फ़ोन को रीस्टार्ट या चालू करने पर सुरक्षा सेवाओं को बैकग्राउंड में स्वयं से शुरू कर देता है ताकि आपका फ़ोन हमेशा सुरक्षित रहे। |
| **DISABLE_KEYGUARD** | संवेदनशील | अलार्म बजते ही की-गार्ड को कुछ समय के लिए बाईपास करता है ताकि आप बिना किसी अतिरिक्त परेशानी के तुरंत अपना सही PIN दर्ज कर अलार्म शांत कर सकें। |
| **VIBRATE** | सामान्य | चोरी की चेतावनी अलार्म के बजने के साथ-साथ डिवाइस में तीव्र कंपन (Vibration) उत्पन्न करता है। |
| **POST_NOTIFICATIONS** | सामान्य | आपके स्टेटस बार में एक स्थायी नोटिफिकेशन दिखाता है, जो सक्रिय सुरक्षा मोड की जानकारी देता है। |

### 3. विज्ञापन और तृतीय-पक्ष सेवाएँ (Ads Integration)
इस ऐप को निःशुल्क उपलब्ध कराने के लिए, हम Google AdSense/AdMob विज्ञापनों का उपयोग करते हैं। ये तृतीय-पक्ष सेवा नेटवर्क प्रासंगिक या वैयक्तिकृत विज्ञापन दिखाने के लिए गैर-संवेदनशील विवरण जैसे डिवाइस पैरामीटर, ऐप इंस्टॉलेशन मेट्रिक्स और विशिष्ट मोबाइल विज्ञापन आईडी (Google Advertising ID - AAID) का उपयोग कर सकते हैं। ये प्रक्रियाएँ पूरी तरह से Google Partner Policies के नियमों के अधीन काम करती हैं।

### 4. बच्चों की गोपनीयता (Children's Privacy)
यह ऐप 13 वर्ष से कम उम्र के बच्चों से कोई जानकारी एकत्र नहीं करता है। चूंकि हम कोई भी व्यक्तिगत डेटा एकत्र नहीं करते हैं, इसलिए हम COPPA नियमों का पूरी तरह से पालन करते हैं।

### 5. हमसे संपर्क करें
यदि आपके पास ऐप की गोपनीयता नीति, सेटिंग्स या सुरक्षा के बारे में कोई प्रश्न है, तो बेझिझक हमसे ईमेल पर संपर्क करें:
- **ईमेल:** jitu1199pal@gmail.com
